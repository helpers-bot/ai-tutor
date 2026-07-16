import { 
    signInWithGoogle, checkAuth, getUser, getFeed, getCurrentBank,
    getUserProfile, updateUserProfile, updateUserBalance, saveArtwork,
    updateArtwork, deleteArtwork, publishArtwork, getUserArtworks,
    likeArtwork, recordView, claimDailyStar,
    getLastWinner, isAdmin, getAllUsers, claimTimerBonus,
    saveTimerState, getTimerState
} from './supabase.js';

import { DrawingCanvas } from './canvas.js';

const SUPABASE_URL = 'https://aywfviexlltujeoaqeaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y';

class ArtStarsApp {
    constructor() {
        this.user = null;
        this.currentPage = 'feed';
        this.drawingCanvas = null;
        this.editingArtworkId = null;
        this.viewedUser = null;
        this.timerInterval = null;
        this.timerSeconds = 1800;
        this.timerActive = false;
        this.isPageVisible = true;
        
        this.init();
    }

    async init() {
        this.user = await checkAuth();
        
        if (this.user) {
            await this.loadTimerState();
            await this.loadMainApp();
        } else {
            this.showAuthScreen();
        }
    }

    async loadTimerState() {
        if (!this.user) return;
        
        const state = await getTimerState(this.user.id);
        this.timerSeconds = state.timer_seconds;
        
        // Если таймер истек, начисляем звезду
        if (this.timerSeconds <= 0) {
            await claimTimerBonus(this.user.id);
            this.showNotification('⭐ Бонус!', 'Получена 1 звезда за время на сайте!', 'success');
            this.timerSeconds = 1800;
            await saveTimerState(this.user.id, this.timerSeconds);
        }
    }

    showNotification(title, message, type = 'success') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const colors = {
            success: 'var(--neon-green)',
            info: 'var(--neon-blue)',
            warning: 'var(--neon-yellow)'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 2px solid ${colors[type]};
            border-radius: 15px;
            padding: 15px 20px;
            color: white;
            min-width: 250px;
            max-width: 350px;
            box-shadow: 0 0 20px ${colors[type]}44;
            animation: slideIn 0.3s ease;
            cursor: pointer;
            margin-bottom: 10px;
        `;
        
        notification.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:24px;">${type === 'success' ? '⭐' : type === 'info' ? '⏰' : '⚠️'}</span>
                <div>
                    <strong>${title}</strong>
                    <p style="font-size:12px; margin-top:5px; color:var(--text-secondary);">${message}</p>
                </div>
            </div>
        `;
        
        notification.onclick = () => notification.remove();
        container.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
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
        const adminCheck = await isAdmin(this.user.id);
        
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
                
                <div class="page-container" id="pageContainer"></div>
                
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
                    ${adminCheck ? `
                        <button class="nav-btn" data-page="admin">
                            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                            Админ
                        </button>
                    ` : ''}
                </div>
            </div>
            
            <div id="canvasContainer" class="canvas-container">
                <div class="canvas-toolbar">
                    <button class="tool-btn" onclick="window.closeCanvas()" style="background: var(--neon-pink); border-color: var(--neon-pink);" title="Закрыть">✕</button>
                    <button class="tool-btn active" data-tool="brush" title="Кисть">✏️</button>
                    <button class="tool-btn" data-tool="spray" title="Распылитель">💨</button>
                    <button class="tool-btn" data-tool="eraser" title="Ластик">🧹</button>
                    <button class="tool-btn" data-tool="fill" title="Заливка">🪣</button>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="color:white; font-size:11px;">Цвет:</span>
                        <input type="color" id="colorPicker" class="color-picker" value="#ff2d95">
                    </div>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="color:white; font-size:11px;">Фон:</span>
                        <input type="color" id="bgColorPicker" class="color-picker" value="#ffffff">
                    </div>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <span style="color:white; font-size:11px;">Размер:</span>
                        <input type="range" id="sizeSlider" class="size-slider" min="1" max="30" value="5">
                        <span id="sizeValue" style="color:white; font-size:11px;">5px</span>
                    </div>
                    <button class="tool-btn" onclick="window.undoCanvas()" title="Отменить">↩️</button>
                    <button class="tool-btn" onclick="window.clearCanvas()" title="Очистить">🗑️</button>
                </div>
                <div style="display:flex; justify-content:center; align-items:center; flex:1; background:#2a2a2a; overflow:hidden;">
                    <canvas id="drawCanvas"></canvas>
                </div>
                <div class="canvas-actions">
                    <button class="neon-btn" onclick="window.saveCanvas()">💾 Сохранить</button>
                    <button class="neon-btn publish" onclick="window.publishCanvas()">🚀 Опубликовать (50 ⭐)</button>
                    <button class="neon-btn danger" id="deleteArtworkBtn" style="display:none;" onclick="window.deleteCurrentArtwork()">❌ Удалить</button>
                </div>
            </div>
            
            <input type="file" id="avatarInput" accept="image/*" style="display:none;" onchange="window.handleAvatarUpload(event)">
        `;
        
        await this.initApp();
    }

    async initApp() {
        this.setupNavigation();
        await this.updateDisplay();
        await this.loadFeed();
        
        setInterval(() => this.updateBankDisplay(), 10000);
        this.updateBankDisplay();
        
        // Запускаем таймер бонуса
        this.startBonusTimer();
        
        // Отслеживаем видимость страницы
        this.setupVisibilityTracking();
        
        window.closeCanvas = () => this.closeCanvas();
        window.saveCanvas = () => this.saveCanvas();
        window.publishCanvas = () => this.publishCanvas();
        window.deleteCurrentArtwork = () => this.deleteCurrentArtwork();
        window.undoCanvas = () => this.drawingCanvas?.undo();
        window.clearCanvas = () => this.drawingCanvas?.clear();
        window.handleAvatarUpload = (e) => this.handleAvatarUpload(e);
    }

    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.isPageVisible = false;
                // Сохраняем состояние таймера
                this.saveTimerToServer();
            } else {
                this.isPageVisible = true;
                // Восстанавливаем таймер
                this.restoreTimerFromServer();
            }
        });
        
        window.addEventListener('beforeunload', () => {
            this.saveTimerToServer();
        });
    }

    async saveTimerToServer() {
        if (this.user && this.timerActive) {
            await saveTimerState(this.user.id, this.timerSeconds);
        }
    }

    async restoreTimerFromServer() {
        if (this.user) {
            const state = await getTimerState(this.user.id);
            this.timerSeconds = state.timer_seconds;
            
            // Если таймер истек пока страница была неактивна
            if (this.timerSeconds <= 0) {
                const bonuses = Math.floor(Math.abs(this.timerSeconds) / 1800) + 1;
                for (let i = 0; i < bonuses; i++) {
                    await claimTimerBonus(this.user.id);
                }
                this.showNotification('⭐ Бонус!', `Получено ${bonuses} звёзд за время отсутствия!`, 'success');
                this.timerSeconds = 1800 - (Math.abs(this.timerSeconds) % 1800);
                await this.updateDisplay();
            }
        }
    }

    startBonusTimer() {
        this.timerActive = true;
        
        this.timerInterval = setInterval(async () => {
            if (this.isPageVisible) {
                this.timerSeconds--;
                
                // Сохраняем состояние каждые 30 секунд
                if (this.timerSeconds % 30 === 0) {
                    this.saveTimerToServer();
                }
                
                if (this.timerSeconds <= 0) {
                    if (this.user) {
                        await claimTimerBonus(this.user.id);
                        await this.updateDisplay();
                        this.showNotification('⭐ Бонус!', 'Получена 1 звезда за 30 минут на сайте!', 'success');
                    }
                    
                    this.timerSeconds = 1800;
                    await this.saveTimerToServer();
                    
                    if (this.currentPage === 'profile') {
                        await this.loadProfile();
                    }
                }
            }
        }, 1000);
    }

    getTimerDisplay() {
        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelector('.nav-btn.active')?.classList.remove('active');
                btn.classList.add('active');
                
                this.currentPage = btn.dataset.page;
                this.viewedUser = null;
                
                if (this.currentPage !== 'draw') {
                    this.closeCanvas();
                }
                
                if (this.currentPage === 'draw') {
                    this.openCanvas();
                } else if (this.currentPage === 'feed') {
                    await this.loadFeed();
                } else if (this.currentPage === 'profile') {
                    await this.loadProfile();
                } else if (this.currentPage === 'admin') {
                    await this.loadAdminPanel();
                }
            });
        });
    }

    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.user) return;
        
        if (file.size > 5 * 1024 * 1024) {
            alert('Файл слишком большой! Максимальный размер 5MB.');
            return;
        }
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${this.user.id}-${Date.now()}.${fileExt}`;
            
            const response = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                body: file
            });
            
            if (response.ok) {
                const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
                await updateUserProfile(this.user.id, { avatar_url: avatarUrl });
                await this.loadProfile();
                this.showNotification('✅ Готово', 'Аватар обновлен!', 'success');
            }
        } catch (error) {
            console.error('Error uploading avatar:', error);
        }
    }

    openCanvas(existingImage = null, artworkId = null) {
        const canvasContainer = document.getElementById('canvasContainer');
        canvasContainer.style.display = 'flex';
        
        this.editingArtworkId = artworkId;
        
        const deleteBtn = document.getElementById('deleteArtworkBtn');
        if (deleteBtn) {
            deleteBtn.style.display = artworkId ? 'block' : 'none';
        }
        
        setTimeout(() => {
            this.drawingCanvas = new DrawingCanvas(existingImage);
        }, 100);
    }

    closeCanvas() {
        const canvasContainer = document.getElementById('canvasContainer');
        canvasContainer.style.display = 'none';
        this.drawingCanvas = null;
        this.editingArtworkId = null;
    }

    async updateDisplay() {
        if (!this.user) return;
        
        const profile = await getUserProfile(this.user.id);
        if (profile) {
            const starsDisplay = document.getElementById('starsDisplay');
            if (starsDisplay) {
                starsDisplay.textContent = profile.stars_balance || 0;
            }
        }
    }

    async updateBankDisplay() {
        const bank = await getCurrentBank();
        const bankDisplay = document.getElementById('bankDisplay');
        if (bankDisplay) {
            bankDisplay.textContent = bank;
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
                this.showNotification('❌ Ошибка', 'Недостаточно звёзд! Нужна 1 звезда.', 'warning');
                return;
            }
            
            await updateUserBalance(this.user.id, -1);
            await likeArtwork(this.user.id, artworkId);
            await this.updateDisplay();
            await this.loadFeed();
            await this.updateBankDisplay();
        };
    }

    async openArtworkModal(artwork) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="text-align:center;">
                <img src="${artwork.image_url}" class="art-detail-image" alt="${artwork.title}">
                <h3>${artwork.title}</h3>
                <div class="author-info" style="cursor:pointer; display:inline-flex; align-items:center; gap:10px; margin:10px 0;" onclick="window.viewUserProfile('${artwork.user_id}')">
                    <img src="${artwork.users?.avatar_url || 'icon.svg'}" style="width:30px;height:30px;border-radius:50%;border:2px solid var(--neon-purple);">
                    <span style="color:var(--neon-blue); text-decoration:underline;">${artwork.users?.username || 'Неизвестный'}</span>
                </div>
                <div style="display:flex; gap:20px; margin:15px 0; justify-content:center;">
                    <span>👁 ${artwork.views_count || 0} просмотров</span>
                    <span>❤️ ${artwork.likes_count || 0} лайков</span>
                </div>
                <button class="neon-btn" style="margin-top:10px;" onclick="this.parentElement.parentElement.remove()">Закрыть</button>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
        
        window.viewUserProfile = (userId) => {
            modal.remove();
            this.viewedUser = userId;
            this.loadProfile();
            document.querySelector('.nav-btn[data-page="profile"]')?.classList.add('active');
            document.querySelector('.nav-btn[data-page="feed"]')?.classList.remove('active');
        };
        
        if (this.user) {
            await recordView(this.user.id, artwork.id);
        }
    }

    async saveCanvas() {
        if (!this.drawingCanvas || !this.user) return;
        
        const imageData = this.drawingCanvas.getImage();
        
        try {
            if (this.editingArtworkId) {
                await updateArtwork(this.editingArtworkId, { image_url: imageData });
                this.showNotification('✅ Готово', 'Рисунок обновлён!', 'success');
            } else {
                await saveArtwork({
                    user_id: this.user.id,
                    image_url: imageData,
                    title: 'Мой рисунок',
                    is_published: false
                });
                this.showNotification('💾 Сохранено', 'Рисунок сохранён в профиле!', 'success');
            }
            
            this.closeCanvas();
            await this.loadProfile();
            document.querySelector('.nav-btn[data-page="profile"]')?.click();
        } catch (error) {
            console.error('Error saving artwork:', error);
        }
    }

    async publishCanvas() {
        if (!this.drawingCanvas || !this.user) return;
        
        const profile = await getUserProfile(this.user.id);
        
        if (profile.stars_balance < 50) {
            this.showNotification('❌ Ошибка', 'Недостаточно звёзд! Нужно 50 звёзд.', 'warning');
            return;
        }
        
        const imageData = this.drawingCanvas.getImage();
        
        try {
            let artworkId = this.editingArtworkId;
            
            if (artworkId) {
                await updateArtwork(artworkId, {
                    image_url: imageData,
                    is_published: true,
                    stars_spent: 50
                });
            } else {
                const saved = await saveArtwork({
                    user_id: this.user.id,
                    image_url: imageData,
                    title: 'Мой рисунок',
                    is_published: true,
                    stars_spent: 50
                });
                
                if (saved && saved.length > 0) {
                    artworkId = saved[0].id;
                }
            }
            
            // Списываем звёзды
            await updateUserBalance(this.user.id, -50);
            
            // Добавляем в банк (записываем покупку)
            if (artworkId) {
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
                        artwork_id: artworkId,
                        stars_spent: 50,
                        purchase_type: 'publish'
                    })
                });
            }
            
            this.showNotification('🚀 Опубликовано', 'Рисунок появился в ленте! +50 звёзд в банк', 'success');
            await this.updateDisplay();
            await this.updateBankDisplay();
            this.closeCanvas();
            document.querySelector('.nav-btn[data-page="feed"]')?.click();
        } catch (error) {
            console.error('Error publishing artwork:', error);
        }
    }

    async deleteCurrentArtwork() {
        if (!this.editingArtworkId) return;
        
        if (confirm('Удалить этот рисунок? Это действие нельзя отменить.')) {
            await deleteArtwork(this.editingArtworkId);
            this.closeCanvas();
            await this.loadProfile();
            this.showNotification('🗑️ Удалено', 'Рисунок удален', 'info');
            document.querySelector('.nav-btn[data-page="profile"]')?.click();
        }
    }

    async loadProfile() {
        const container = document.getElementById('pageContainer');
        if (!container) return;
        
        const userId = this.viewedUser || this.user.id;
        const isOwnProfile = userId === this.user.id;
        
        const profile = await getUserProfile(userId);
        const artworks = await getUserArtworks(userId);
        const lastWinner = await getLastWinner();
        
        container.innerHTML = `
            <div class="profile-screen">
                <div class="profile-header">
                    <img src="${profile?.avatar_url || 'icon.svg'}" class="profile-avatar" alt="Avatar" 
                         ${isOwnProfile ? 'onclick="document.getElementById(\'avatarInput\').click()" style="cursor:pointer;"' : ''}>
                    ${isOwnProfile ? `
                        <div style="margin-top:10px;">
                            <button class="neon-btn" onclick="document.getElementById('avatarInput').click()" style="font-size:12px; padding:5px 15px;">📷 Загрузить аватар</button>
                            <button class="neon-btn" onclick="window.changeUsername()" style="font-size:12px; padding:5px 15px;">✏️ Сменить имя</button>
                        </div>
                    ` : ''}
                    <h2>${profile?.username || 'Пользователь'}</h2>
                    <p>⭐ ${profile?.stars_balance || 0} звёзд</p>
                </div>
                
                ${isOwnProfile ? `
                    <div class="star-claim-section">
                        <h3>🎁 Ежедневная звезда</h3>
                        <button class="neon-btn" onclick="window.claimDaily()" style="margin:10px 0;">🎁 Получить 1 звезду (раз в сутки)</button>
                        
                        <h3>⏰ Бонус за время на сайте</h3>
                        <div style="text-align:center; padding:20px; background:var(--bg-secondary); border-radius:15px; margin:10px 0;">
                            <p style="font-size:14px; color:var(--text-secondary);">До следующей звезды:</p>
                            <p style="font-size:48px; color:var(--neon-yellow); font-weight:bold; margin:10px 0;">${this.getTimerDisplay()}</p>
                            <p style="font-size:12px; color:var(--text-secondary);">Каждые 30 минут на сайте вы получаете 1 звезду автоматически!</p>
                        </div>
                    </div>
                ` : ''}
                
                ${lastWinner && isOwnProfile ? `
                    <div class="star-claim-section" style="border-color: var(--neon-yellow); box-shadow: 0 0 20px var(--neon-yellow);">
                        <h3>🏆 Последний победитель</h3>
                        <p>${lastWinner.users?.username} — ${lastWinner.total_bank} звёзд!</p>
                        <p>${lastWinner.likes_count} лайков</p>
                    </div>
                ` : ''}
                
                <h3>Работы (${artworks.length})</h3>
                <div class="my-artworks">
                    ${artworks.map(art => `
                        <div class="artwork-item" onclick="window.editArtwork('${art.id}')">
                            <img src="${art.image_url}" alt="${art.title}">
                            ${art.is_published ? '<div style="position:absolute;top:5px;right:5px;background:var(--neon-purple);padding:2px 8px;border-radius:10px;font-size:10px;">Опубл.</div>' : ''}
                            <div class="artwork-actions">
                                ${!art.is_published ? `
                                    <button class="mini-btn" onclick="event.stopPropagation(); window.publishExistingArtwork('${art.id}')">🚀 Опубликовать</button>
                                ` : ''}
                                <button class="mini-btn" style="border-color:red; color:red;" onclick="event.stopPropagation(); window.deleteUserArtwork('${art.id}')">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        window.changeUsername = async () => {
            const name = prompt('Введите новое имя:');
            if (name) {
                await updateUserProfile(this.user.id, { username: name });
                await this.loadProfile();
                this.showNotification('✅ Готово', 'Имя изменено!', 'success');
            }
        };
        
        window.claimDaily = async () => {
            const result = await claimDailyStar(this.user.id);
            if (result) {
                this.showNotification('⭐ Получено!', 'Ежедневная звезда начислена!', 'success');
                await this.updateDisplay();
                await this.loadProfile();
            } else {
                this.showNotification('⏰ Подождите', 'Вы уже получили звезду сегодня!', 'warning');
            }
        };
        
        window.editArtwork = async (artworkId) => {
            const { getArtwork } = await import('./supabase.js');
            const artwork = await getArtwork(artworkId);
            if (artwork) {
                this.openCanvas(artwork.image_url, artworkId);
                document.querySelector('.nav-btn[data-page="draw"]')?.click();
            }
        };
        
        window.publishExistingArtwork = async (artworkId) => {
            const profile = await getUserProfile(this.user.id);
            if (profile.stars_balance < 50) {
                this.showNotification('❌ Ошибка', 'Недостаточно звёзд! Нужно 50.', 'warning');
                return;
            }
            
            await publishArtwork(artworkId);
            await updateUserBalance(this.user.id, -50);
            
            // Добавляем в банк
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
                    artwork_id: artworkId,
                    stars_spent: 50,
                    purchase_type: 'publish'
                })
            });
            
            this.showNotification('🚀 Готово', 'Рисунок опубликован! +50 в банк', 'success');
            await this.updateDisplay();
            await this.updateBankDisplay();
            await this.loadProfile();
        };
        
        window.deleteUserArtwork = async (artworkId) => {
            if (confirm('Удалить этот рисунок?')) {
                await deleteArtwork(artworkId);
                await this.loadProfile();
                this.showNotification('🗑️ Удалено', 'Рисунок удален', 'info');
            }
        };
    }

    async loadAdminPanel() {
        const container = document.getElementById('pageContainer');
        if (!container) return;
        
        container.innerHTML = '<div style="text-align:center; padding: 40px;">Загрузка админ-панели...</div>';
        
        try {
            const users = await getAllUsers();
            
            container.innerHTML = `
                <div class="admin-panel" style="padding:20px;">
                    <h2 style="text-align:center; margin-bottom:20px;">👑 Админ-панель</h2>
                    <div style="background: var(--glass-bg); padding:15px; border-radius:15px; margin-bottom:20px;">
                        <h3>📊 Статистика</h3>
                        <p>Всего пользователей: ${users.length}</p>
                    </div>
                    
                    <div style="max-height:70vh; overflow-y:auto;">
                        ${users.map(u => `
                            <div style="background: var(--glass-bg); padding:15px; border-radius:15px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.1);">
                                <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                                    <img src="${u.avatar_url || 'icon.svg'}" style="width:50px;height:50px;border-radius:50%;border:2px solid var(--neon-purple);">
                                    <div style="flex:1;">
                                        <strong>${u.username || 'Без имени'}</strong>
                                        <p style="font-size:12px; color:var(--text-secondary);">ID: ${u.id}</p>
                                        <p style="color:var(--neon-yellow);">⭐ ${u.stars_balance} звёзд</p>
                                    </div>
                                </div>
                                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                                    <button class="mini-btn" onclick="window.editUserField('${u.id}', 'username', 'Имя')">✏️ Имя</button>
                                    <button class="mini-btn" onclick="window.editUserField('${u.id}', 'avatar_url', 'URL аватара')">📷 Аватар</button>
                                    <button class="mini-btn" onclick="window.editUserStars('${u.id}', ${u.stars_balance})">⭐ Звёзды</button>
                                    <button class="mini-btn" style="border-color:red; color:red;" onclick="window.deleteUser('${u.id}', '${u.username}')">🗑️ Удалить</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            
            window.editUserField = async (userId, field, label) => {
                const value = prompt(`Введите новое значение для ${label}:`);
                if (value !== null) {
                    await updateUserProfile(userId, { [field]: value });
                    await this.loadAdminPanel();
                }
            };
            
            window.editUserStars = async (userId, currentStars) => {
                const action = prompt('Введите "+50" чтобы начислить, "-50" чтобы снять, или число для установки:');
                if (action !== null) {
                    let newBalance = currentStars;
                    
                    if (action.startsWith('+')) {
                        newBalance = currentStars + parseInt(action.substring(1));
                    } else if (action.startsWith('-')) {
                        newBalance = currentStars - parseInt(action.substring(1));
                    } else {
                        newBalance = parseInt(action);
                    }
                    
                    if (!isNaN(newBalance)) {
                        await updateUserProfile(userId, { stars_balance: newBalance });
                        await this.loadAdminPanel();
                    }
                }
            };
            
            window.deleteUser = async (userId, username) => {
                if (confirm(`Удалить пользователя ${username}? Это действие нельзя отменить!`)) {
                    await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
                        method: 'DELETE',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`
                        }
                    });
                    await this.loadAdminPanel();
                }
            };
            
        } catch (error) {
            console.error('Error loading admin panel:', error);
            container.innerHTML = '<div style="text-align:center; padding: 40px;">Ошибка загрузки админ-панели</div>';
        }
    }
}

window.app = new ArtStarsApp();
