import { 
    signInWithGoogle, checkAuth, getUser, getFeed, getCurrentBank,
    getUserProfile, updateUserBalance, saveArtwork, publishArtwork,
    cancelAuction, getUserArtworks, likeArtwork, recordView,
    getTodayViews, claimDailyStar, getLastWinner
} from './supabase.js';

import { DrawingCanvas } from './canvas.js';

class ArtStarsApp {
    constructor() {
        this.user = null;
        this.currentPage = 'feed';
        this.drawingCanvas = null;
        this.viewCount = 0;
        this.viewTimer = null;
        this.viewTimerSeconds = 0;
        
        this.init();
    }

    async init() {
        this.user = await checkAuth();
        
        if (this.user) {
            await this.loadMainApp();
        } else {
            this.showAuthScreen();
        }
    }

    showAuthScreen() {
        document.getElementById('app').innerHTML = `
            <div class="auth-screen">
                <div class="auth-logo">ArtStars</div>
                <p style="margin-bottom:30px; color: var(--text-secondary)">Рисуй, публикуй, побеждай!</p>
                <button class="google-btn" onclick="window.signIn()">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                    Войти через Google
                </button>
            </div>
        `;
        
        window.signIn = () => signInWithGoogle();
    }

    async loadMainApp() {
        document.getElementById('app').innerHTML = `
            <div class="main-screen">
                <div class="header">
                    <div class="user-stars">
                        <span>⭐</span>
                        <span id="starsDisplay">0</span>
                    </div>
                    <div class="bank-display">
                        <span>💰 Банк:</span>
                        <span id="bankDisplay">0</span>
                        <span>звёзд</span>
                    </div>
                </div>
                
                <div class="page-container" id="pageContainer">
                    <!-- Контент страниц -->
                </div>
                
                <div class="bottom-nav">
                    <button class="nav-btn active" data-page="feed">
                        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="9" height="9"/><rect x="13" y="2" width="9" height="9"/><rect x="2" y="13" width="9" height="9"/><rect x="13" y="13" width="9" height="9"/></svg>
                        Лента
                    </button>
                    <button class="nav-btn" data-page="draw">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        Рисовать
                    </button>
                    <button class="nav-btn" data-page="profile">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        Профиль
                    </button>
                </div>
            </div>
            
            <div id="canvasContainer" class="canvas-container">
                <div class="canvas-toolbar">
                    <button class="tool-btn active" data-tool="brush">✏️</button>
                    <button class="tool-btn" data-tool="eraser">🧹</button>
                    <input type="color" id="colorPicker" class="color-picker" value="#ff2d95">
                    <input type="range" id="sizeSlider" class="size-slider" min="1" max="20" value="5">
                    <span id="sizeValue" style="color:white">5</span>
                    <button class="tool-btn" onclick="window.undoCanvas()">↩️</button>
                    <button class="tool-btn" onclick="window.clearCanvas()">🗑️</button>
                </div>
                <canvas id="drawCanvas"></canvas>
                <div class="canvas-actions">
                    <button class="neon-btn" onclick="window.saveCanvas()">💾 Сохранить</button>
                    <button class="neon-btn publish" onclick="window.publishCanvas()">🚀 Опубликовать (50 ⭐)</button>
                </div>
            </div>
        `;
        
        await this.initApp();
    }

    async initApp() {
        this.setupNavigation();
        await this.updateDisplay();
        await this.loadFeed();
        
        // Обновляем банк каждые 10 секунд
        setInterval(() => this.updateBankDisplay(), 10000);
        this.updateBankDisplay();
        
        // Инициализируем canvas при необходимости
        document.getElementById('drawCanvas')?.addEventListener('click', () => {
            if (!this.drawingCanvas) {
                this.drawingCanvas = new DrawingCanvas();
            }
        });
        
        window.saveCanvas = () => this.saveCanvas();
        window.publishCanvas = () => this.publishCanvas();
        window.undoCanvas = () => this.drawingCanvas?.undo();
        window.clearCanvas = () => this.drawingCanvas?.clear();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelector('.nav-btn.active')?.classList.remove('active');
                btn.classList.add('active');
                
                this.currentPage = btn.dataset.page;
                const canvasContainer = document.getElementById('canvasContainer');
                
                if (this.currentPage === 'draw') {
                    canvasContainer.style.display = 'flex';
                    if (!this.drawingCanvas) {
                        this.drawingCanvas = new DrawingCanvas();
                    }
                } else {
                    canvasContainer.style.display = 'none';
                }
                
                if (this.currentPage === 'feed') {
                    await this.loadFeed();
                } else if (this.currentPage === 'profile') {
                    await this.loadProfile();
                }
            });
        });
    }

    async updateDisplay() {
        if (!this.user) return;
        
        const profile = await getUserProfile(this.user.id);
        if (profile) {
            document.getElementById('starsDisplay').textContent = profile.stars_balance || 0;
        }
    }

    async updateBankDisplay() {
        const bank = await getCurrentBank();
        const bankDisplay = document.getElementById('bankDisplay');
        if (bankDisplay) {
            bankDisplay.textContent = bank;
            // Добавляем анимацию
            bankDisplay.style.animation = 'none';
            bankDisplay.offsetHeight;
            bankDisplay.style.animation = 'pulse 0.5s ease-in-out';
        }
    }

    async loadFeed() {
        const container = document.getElementById('pageContainer');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align:center; padding: 40px;">Загрузка...</div>';
        
        try {
            const artworks = await getFeed();
            
            if (artworks.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-secondary)">Пока нет опубликованных работ</div>';
                return;
            }
            
            container.innerHTML = '<div class="feed-grid"></div>';
            const grid = container.querySelector('.feed-grid');
            
            artworks.forEach(art => {
                const card = document.createElement('div');
                card.className = 'art-card';
                card.innerHTML = `
                    <img src="${art.image_url}" alt="${art.title}" loading="lazy">
                    <div class="art-card-overlay">
                        <div class="art-stats">
                            <span>👁 ${art.views_count || 0}</span>
                            <span>❤️ ${art.likes_count || 0}</span>
                        </div>
                        <button class="like-btn" onclick="event.stopPropagation(); window.likeArt('${art.id}')">❤️</button>
                    </div>
                `;
                
                card.addEventListener('click', () => this.openArtworkModal(art));
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('Error loading feed:', error);
            container.innerHTML = '<div style="text-align:center; padding: 40px;">Ошибка загрузки</div>';
        }
        
        window.likeArt = async (artworkId) => {
            if (!this.user) return;
            
            const profile = await getUserProfile(this.user.id);
            if (profile.stars_balance < 1) {
                alert('Недостаточно звёзд! Нужна 1 звезда.');
                return;
            }
            
            await updateUserBalance(this.user.id, -1);
            await likeArtwork(this.user.id, artworkId);
            await this.updateDisplay();
            await this.loadFeed();
        };
    }

    async openArtworkModal(artwork) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <img src="${artwork.image_url}" class="art-detail-image" alt="${artwork.title}">
                <h3>${artwork.title}</h3>
                <p>Автор: ${artwork.users?.username || 'Неизвестный'}</p>
                <div style="display:flex; gap:20px; margin:15px 0;">
                    <span>👁 ${artwork.views_count || 0}</span>
                    <span>❤️ ${artwork.likes_count || 0}</span>
                </div>
                <button class="neon-btn" onclick="this.parentElement.parentElement.remove()">Закрыть</button>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
        
        // Записываем просмотр
        if (this.user) {
            await recordView(this.user.id, artwork.id);
            await this.updateViewProgress();
        }
    }

    async saveCanvas() {
        if (!this.drawingCanvas || !this.user) return;
        
        const imageData = this.drawingCanvas.getImage();
        
        try {
            await saveArtwork({
                user_id: this.user.id,
                image_url: imageData,
                title: 'Мой рисунок',
                is_published: false
            });
            
            alert('Рисунок сохранён в профиле!');
        } catch (error) {
            console.error('Error saving artwork:', error);
            alert('Ошибка сохранения');
        }
    }

    async publishCanvas() {
        if (!this.drawingCanvas || !this.user) return;
        
        const profile = await getUserProfile(this.user.id);
        
        if (profile.stars_balance < 50) {
            alert('Недостаточно звёзд! Нужно 50 звёзд для публикации.');
            return;
        }
        
        const imageData = this.drawingCanvas.getImage();
        
        try {
            // Сохраняем
            const saved = await saveArtwork({
                user_id: this.user.id,
                image_url: imageData,
                title: 'Мой рисунок',
                is_published: false
            });
            
            if (saved && saved.length > 0) {
                // Публикуем
                await publishArtwork(saved[0].id);
                
                // Списываем звёзды
                await updateUserBalance(this.user.id, -50);
                
                // Записываем покупку
                await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        user_id: this.user.id,
                        artwork_id: saved[0].id,
                        stars_spent: 50,
                        purchase_type: 'publish'
                    })
                });
                
                alert('Рисунок опубликован!');
                await this.updateDisplay();
                await this.updateBankDisplay();
                
                // Переключаем на ленту
                document.querySelector('[data-page="feed"]')?.click();
            }
        } catch (error) {
            console.error('Error publishing artwork:', error);
            alert('Ошибка публикации');
        }
    }

    async loadProfile() {
        if (!this.user) return;
        
        const container = document.getElementById('pageContainer');
        if (!container) return;
        
        const profile = await getUserProfile(this.user.id);
        const artworks = await getUserArtworks(this.user.id);
        const todayViews = await getTodayViews(this.user.id);
        const lastWinner = await getLastWinner();
        
        container.innerHTML = `
            <div class="profile-screen">
                <div class="profile-header">
                    <img src="${this.user.user_metadata?.avatar_url || 'icon.svg'}" class="profile-avatar" alt="Avatar">
                    <h2>${profile?.username || 'Пользователь'}</h2>
                    <p>⭐ ${profile?.stars_balance || 0} звёзд</p>
                </div>
                
                <div class="star-claim-section">
                    <h3>🎁 Получить звезду</h3>
                    <div class="claim-progress">
                        ${Array.from({length: 5}, (_, i) => `
                            <div class="progress-cell ${i < (todayViews % 5) ? 'filled' : ''}"></div>
                        `).join('')}
                    </div>
                    <p>Просмотрено сегодня: ${todayViews}/5 видео</p>
                    ${this.viewTimerSeconds > 0 ? `
                        <p class="view-timer">⏰ Следующий просмотр через: ${Math.floor(this.viewTimerSeconds / 60)}:${(this.viewTimerSeconds % 60).toString().padStart(2, '0')}</p>
                    ` : ''}
                    <button class="neon-btn" onclick="window.claimStar()">🎁 Получить звезду</button>
                </div>
                
                ${lastWinner ? `
                    <div class="star-claim-section" style="border-color: var(--neon-yellow); box-shadow: 0 0 20px var(--neon-yellow);">
                        <h3>🏆 Последний победитель</h3>
                        <p>${lastWinner.users?.username} — ${lastWinner.total_bank} звёзд!</p>
                        <p>${lastWinner.likes_count} лайков</p>
                    </div>
                ` : ''}
                
                <h3>Мои работы (${artworks.length})</h3>
                <div class="my-artworks">
                    ${artworks.map(art => `
                        <div class="artwork-item">
                            <img src="${art.image_url}" alt="${art.title}">
                            <div class="artwork-actions">
                                ${!art.is_published && !art.is_auction_cancelled ? `
                                    <button class="mini-btn" onclick="window.cancelArtwork('${art.id}')">Отменить</button>
                                ` : ''}
                                ${art.is_auction_cancelled ? '<span style="color:red">Отменено</span>' : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        window.claimStar = async () => {
            const result = await claimDailyStar(this.user.id);
            if (result) {
                alert('Звезда получена!');
                await this.updateDisplay();
                await this.loadProfile();
            } else {
                alert('Вы уже получили звезду сегодня!');
            }
        };
        
        window.cancelArtwork = async (artworkId) => {
            if (confirm('Отменить участие в аукционе? Звёзды не возвращаются.')) {
                await cancelAuction(artworkId);
                await this.loadProfile();
            }
        };
    }

    async updateViewProgress() {
        if (!this.user) return;
        
        const todayViews = await getTodayViews(this.user.id);
        
        // Запускаем таймер после просмотра
        if (todayViews < 5) {
            this.startViewTimer();
        }
        
        if (this.currentPage === 'profile') {
            await this.loadProfile();
        }
    }

    startViewTimer() {
        if (this.viewTimer) return;
        
        this.viewTimerSeconds = 120;
        this.viewTimer = setInterval(() => {
            this.viewTimerSeconds--;
            
            if (this.viewTimerSeconds <= 0) {
                clearInterval(this.viewTimer);
                this.viewTimer = null;
                
                if (this.currentPage === 'profile') {
                    this.loadProfile();
                }
            }
            
            // Обновляем отображение в профиле
            if (this.currentPage === 'profile') {
                this.loadProfile();
            }
        }, 1000);
    }
}

// Запускаем приложение
window.app = new ArtStarsApp();
