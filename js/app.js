import { 
    signInWithGoogle, checkAuth, getFeed, getCurrentBank,
    getUserProfile, updateUserProfile, updateUserBalance, saveArtwork,
    updateArtwork, deleteArtwork, publishArtwork, getUserArtworks,
    likeArtwork, claimDailyStar, getLastWinner, isAdmin, getAllUsers,
    claimTimerBonus, saveTimerState, getTimerState
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
        this.isPageVisible = true;
        this.init();
    }

    async init() {
        this.user = await checkAuth();
        if (this.user) {
            await this.restoreTimerState();
            await this.loadMainApp();
        } else {
            this.showAuthScreen();
        }
    }

    async restoreTimerState() {
        if (!this.user) return;
        const state = await getTimerState(this.user.id);
        this.timerSeconds = state.timer_seconds;
        if (this.timerSeconds <= 0) {
            const bonuses = Math.floor(Math.abs(this.timerSeconds) / 1800) + 1;
            for (let i = 0; i < bonuses; i++) {
                await claimTimerBonus(this.user.id);
            }
            this.showNotification('⭐ Бонус!', `Начислено ${bonuses} звёзд!`, 'success');
            this.timerSeconds = 1800;
            await saveTimerState(this.user.id, this.timerSeconds);
            await this.updateDisplay();
        }
    }

    showNotification(title, message, type = 'success') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        const colors = { success: 'var(--neon-green)', info: 'var(--neon-blue)', warning: 'var(--neon-yellow)' };
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: var(--glass-bg); backdrop-filter: blur(20px);
            border: 2px solid ${colors[type]}; border-radius: 15px;
            padding: 15px 20px; color: white; min-width: 280px; max-width: 350px;
            box-shadow: 0 0 20px ${colors[type]}44;
            animation: slideIn 0.3s ease forwards; cursor: pointer; pointer-events: auto;
        `;
        notification.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:24px;">${type === 'success' ? '⭐' : type === 'info' ? '⏰' : '⚠️'}</span>
                <div><strong>${title}</strong><p style="font-size:12px; margin-top:5px; color:var(--text-secondary);">${message}</p></div>
            </div>
        `;
        notification.onclick = () => { notification.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => notification.remove(), 300); };
        container.appendChild(notification);
        setTimeout(() => { if (notification.parentNode) { notification.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => notification.remove(), 300); } }, 5000);
    }

    showAuthScreen() {
        document.getElementById('app').innerHTML = `
            <div class="auth-screen">
                <div class="auth-logo">ArtStars</div>
                <p style="margin-bottom:30px; color: var(--text-secondary)">Рисуй, публикуй, побеждай!</p>
                <button class="google-btn" onclick="window.signIn()">
                    <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
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
                    <div class="user-stars"><span>⭐</span> <span id="starsDisplay">0</span></div>
                    <div class="bank-display"><span>💰 Банк:</span> <span id="bankDisplay">0</span> <span>звёзд</span></div>
                </div>
                <div class="page-container" id="pageContainer"></div>
                <div class="bottom-nav">
                    <button class="nav-btn active" data-page="feed"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="9" height="9"/><rect x="13" y="2" width="9" height="9"/><rect x="2" y="13" width="9" height="9"/><rect x="13" y="13" width="9" height="9"/></svg>Лента</button>
                    <button class="nav-btn" data-page="draw"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>Рисовать</button>
                    <button class="nav-btn" data-page="profile"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>Профиль</button>
                    ${adminCheck ? `<button class="nav-btn" data-page="admin"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>Админ</button>` : ''}
                </div>
            </div>
            <div id="canvasContainer" class="canvas-container">
                <div class="canvas-toolbar">
                    <button class="tool-btn" onclick="window.closeCanvas()" style="background:var(--neon-pink);border-color:var(--neon-pink);">✕</button>
                    <button class="tool-btn active" data-tool="brush">✏️</button>
                    <button class="tool-btn" data-tool="spray">💨</button>
                    <button class="tool-btn" data-tool="eraser">🧹</button>
                    <button class="tool-btn" data-tool="fill">🪣</button>
                    <span style="color:white;font-size:11px;">Цвет:</span><input type="color" id="colorPicker" class="color-picker" value="#ff2d95">
                    <span style="color:white;font-size:11px;">Фон:</span><input type="color" id="bgColorPicker" class="color-picker" value="#ffffff">
                    <span style="color:white;font-size:11px;">Размер:</span><input type="range" id="sizeSlider" class="size-slider" min="1" max="30" value="5"><span id="sizeValue" style="color:white;font-size:11px;">5px</span>
                    <button class="tool-btn" onclick="window.undoCanvas()">↩️</button>
                    <button class="tool-btn" onclick="window.clearCanvas()">🗑️</button>
                </div>
                <div style="display:flex;justify-content:center;align-items:center;flex:1;background:#2a2a2a;overflow:hidden;"><canvas id="drawCanvas"></canvas></div>
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
        this.startBonusTimer();
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
            if (document.hidden) { this.isPageVisible = false; this.saveTimerToServer(); }
            else { this.isPageVisible = true; this.restoreTimerState(); }
        });
        window.addEventListener('beforeunload', () => { this.saveTimerToServer(); });
    }

    async saveTimerToServer() { if (this.user) await saveTimerState(this.user.id, this.timerSeconds); }

    startBonusTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(async () => {
            if (this.isPageVisible) {
                this.timerSeconds--;
                if (this.timerSeconds % 30 === 0) this.saveTimerToServer();
                if (this.timerSeconds <= 0) {
                    if (this.user) { await claimTimerBonus(this.user.id); await this.updateDisplay(); this.showNotification('⭐ Бонус!', '1 звезда за 30 минут!', 'success'); }
                    this.timerSeconds = 1800;
                    await this.saveTimerToServer();
                    if (this.currentPage === 'profile') await this.loadProfile();
                }
            }
        }, 1000);
    }

    getTimerDisplay() { const m = Math.floor(this.timerSeconds / 60); const s = this.timerSeconds % 60; return `${m}:${s.toString().padStart(2, '0')}`; }

    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelector('.nav-btn.active')?.classList.remove('active');
                btn.classList.add('active');
                this.currentPage = btn.dataset.page;
                this.viewedUser = null;
                if (this.currentPage !== 'draw') this.closeCanvas();
                if (this.currentPage === 'draw') this.openCanvas();
                else if (this.currentPage === 'feed') await this.loadFeed();
                else if (this.currentPage === 'profile') await this.loadProfile();
                else if (this.currentPage === 'admin') await this.loadAdminPanel();
            });
        });
    }

    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.user) return;
        if (file.size > 5*1024*1024) { alert('Файл слишком большой!'); return; }
        try {
            const fileName = `${this.user.id}-${Date.now()}.${file.name.split('.').pop()}`;
            const r = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, { method:'POST', headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}, body:file });
            if (r.ok) { await updateUserProfile(this.user.id, { avatar_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}` }); await this.loadProfile(); this.showNotification('✅ Готово', 'Аватар обновлен!', 'success'); }
        } catch(e) { console.error(e); }
    }

    openCanvas(existingImage = null, artworkId = null) {
        document.getElementById('canvasContainer').style.display = 'flex';
        this.editingArtworkId = artworkId;
        const db = document.getElementById('deleteArtworkBtn'); if(db) db.style.display = artworkId ? 'block' : 'none';
        setTimeout(() => { this.drawingCanvas = new DrawingCanvas(existingImage); }, 100);
    }

    closeCanvas() { document.getElementById('canvasContainer').style.display = 'none'; this.drawingCanvas = null; this.editingArtworkId = null; }

    async updateDisplay() {
        if (!this.user) return;
        const p = await getUserProfile(this.user.id);
        if (p) { const d = document.getElementById('starsDisplay'); if(d) d.textContent = p.stars_balance || 0; }
    }

    async updateBankDisplay() {
        const bank = await getCurrentBank();
        const d = document.getElementById('bankDisplay');
        if(d) { d.textContent = bank; d.style.animation = 'none'; d.offsetHeight; d.style.animation = 'pulse 0.5s ease-in-out'; }
    }

    async loadFeed() {
        const c = document.getElementById('pageContainer');
        if(!c) return;
        c.innerHTML = '<div style="text-align:center;padding:40px;">Загрузка...</div>';
        try {
            const artworks = await getFeed();
            if(!artworks.length) { c.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary);">Пока нет работ</div>'; return; }
            c.innerHTML = '<div class="feed-grid"></div>';
            const g = c.querySelector('.feed-grid');
            artworks.forEach(art => {
                const card = document.createElement('div'); card.className = 'art-card';
                card.innerHTML = `<img src="${art.image_url}" loading="lazy"><div class="art-card-overlay"><div class="art-stats"><span>👁 ${art.views_count||0}</span><span>❤️ ${art.likes_count||0}</span></div><button class="like-btn" onclick="event.stopPropagation();window.likeArt('${art.id}')">❤️</button></div>`;
                card.addEventListener('click', () => this.openArtworkModal(art));
                g.appendChild(card);
            });
        } catch(e) { c.innerHTML = '<div style="text-align:center;padding:40px;">Ошибка</div>'; }
        window.likeArt = async (artworkId) => {
            if(!this.user) return;
            const p = await getUserProfile(this.user.id);
            if(p.stars_balance < 1) { this.showNotification('❌ Ошибка', 'Нужна 1 звезда', 'warning'); return; }
            await updateUserBalance(this.user.id, -1);
            await likeArtwork(this.user.id, artworkId);
            await this.updateDisplay();
            await this.loadFeed();
        };
    }

    async openArtworkModal(artwork) {
        const modal = document.createElement('div'); modal.className = 'modal'; modal.style.display = 'flex';
        modal.innerHTML = `<div class="modal-content" style="text-align:center;"><img src="${artwork.image_url}" class="art-detail-image"><h3>${artwork.title}</h3><div class="author-info" style="cursor:pointer;display:inline-flex;align-items:center;gap:10px;margin:10px 0;" onclick="window.viewUserProfile('${artwork.user_id}')"><img src="${artwork.users?.avatar_url||'icon.svg'}" style="width:30px;height:30px;border-radius:50%;border:2px solid var(--neon-purple);"><span style="color:var(--neon-blue);text-decoration:underline;">${artwork.users?.username||'Неизвестный'}</span></div><div style="display:flex;gap:20px;margin:15px 0;justify-content:center;"><span>👁 ${artwork.views_count||0}</span><span>❤️ ${artwork.likes_count||0}</span></div><button class="neon-btn" onclick="this.parentElement.parentElement.remove()">Закрыть</button></div>`;
        modal.addEventListener('click', (e) => { if(e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
        window.viewUserProfile = (userId) => { modal.remove(); this.viewedUser = userId; this.loadProfile(); document.querySelector('.nav-btn[data-page="profile"]')?.classList.add('active'); document.querySelector('.nav-btn[data-page="feed"]')?.classList.remove('active'); };
    }

    async saveCanvas() {
        if(!this.drawingCanvas||!this.user) return;
        const img = this.drawingCanvas.getImage();
        try {
            if(this.editingArtworkId) { await updateArtwork(this.editingArtworkId, {image_url:img}); this.showNotification('✅ Готово', 'Обновлён!', 'success'); }
            else { await saveArtwork({user_id:this.user.id, image_url:img, title:'Мой рисунок', is_published:false}); this.showNotification('💾 Сохранено', 'В профиле!', 'success'); }
            this.closeCanvas(); await this.loadProfile(); document.querySelector('.nav-btn[data-page="profile"]')?.click();
        } catch(e) { console.error(e); }
    }

    async publishCanvas() {
        if(!this.drawingCanvas||!this.user) return;
        const p = await getUserProfile(this.user.id);
        if(p.stars_balance < 50) { this.showNotification('❌ Ошибка', 'Нужно 50 звёзд', 'warning'); return; }
        const img = this.drawingCanvas.getImage();
        try {
            let artworkId = this.editingArtworkId;
            await updateUserBalance(this.user.id, -50);
            if(artworkId) { await updateArtwork(artworkId, {image_url:img, is_published:true, stars_spent:50}); }
            else { const s = await saveArtwork({user_id:this.user.id, image_url:img, title:'Мой рисунок', is_published:true, stars_spent:50}); if(s?.length) artworkId = s[0].id; }
            if(artworkId) { await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {method:'POST', headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=representation'}, body:JSON.stringify({user_id:this.user.id, artwork_id:artworkId, stars_spent:50, purchase_type:'publish'})}); }
            this.showNotification('🚀 Готово', '+50 в банк!', 'success');
            await this.updateDisplay(); await this.updateBankDisplay();
            this.closeCanvas(); document.querySelector('.nav-btn[data-page="feed"]')?.click();
        } catch(e) { console.error(e); }
    }

    async deleteCurrentArtwork() {
        if(!this.editingArtworkId) return;
        if(confirm('Удалить?')) { await deleteArtwork(this.editingArtworkId); this.closeCanvas(); await this.loadProfile(); this.showNotification('🗑️ Удалено', '', 'info'); document.querySelector('.nav-btn[data-page="profile"]')?.click(); }
    }

    async loadProfile() {
        const c = document.getElementById('pageContainer'); if(!c) return;
        const userId = this.viewedUser || this.user.id;
        const isOwn = userId === this.user.id;
        const p = await getUserProfile(userId);
        const arts = await getUserArtworks(userId);
        const winner = await getLastWinner();
        c.innerHTML = `
            <div class="profile-screen">
                <div class="profile-header">
                    <img src="${p?.avatar_url||'icon.svg'}" class="profile-avatar" ${isOwn?'onclick="document.getElementById(\'avatarInput\').click()" style="cursor:pointer;"':''}>
                    ${isOwn?`<div style="margin-top:10px;"><button class="neon-btn" onclick="document.getElementById('avatarInput').click()" style="font-size:12px;padding:5px 15px;">📷 Аватар</button><button class="neon-btn" onclick="window.changeUsername()" style="font-size:12px;padding:5px 15px;">✏️ Имя</button></div>`:''}
                    <h2>${p?.username||'Пользователь'}</h2><p>⭐ ${p?.stars_balance||0} звёзд</p>
                </div>
                ${isOwn?`
                    <div class="star-claim-section">
                        <h3>🎁 Ежедневная звезда</h3>
                        <button class="neon-btn" onclick="window.claimDaily()" style="margin:10px 0;">🎁 Получить 1 звезду</button>
                        <h3>⏰ Бонус за время</h3>
                        <div style="text-align:center;padding:20px;background:var(--bg-secondary);border-radius:15px;margin:10px 0;">
                            <p style="font-size:14px;color:var(--text-secondary);">До следующей звезды:</p>
                            <p style="font-size:48px;color:var(--neon-yellow);font-weight:bold;margin:10px 0;">${this.getTimerDisplay()}</p>
                            <p style="font-size:12px;color:var(--text-secondary);">30 минут = 1 звезда</p>
                        </div>
                    </div>
                `:''}
                ${winner&&isOwn?`<div class="star-claim-section" style="border-color:var(--neon-yellow);box-shadow:0 0 20px var(--neon-yellow);"><h3>🏆 Победитель</h3><p>${winner.users?.username} — ${winner.total_bank} звёзд!</p></div>`:''}
                <h3>Работы (${arts.length})</h3>
                <div class="my-artworks">
                    ${arts.map(art => `
                        <div class="artwork-item" onclick="window.editArtwork('${art.id}')">
                            <img src="${art.image_url}">
                            ${art.is_published?'<div style="position:absolute;top:5px;right:5px;background:var(--neon-purple);padding:2px 8px;border-radius:10px;font-size:10px;">Опубл.</div>':''}
                            <div class="artwork-actions">
                                ${!art.is_published?`<button class="mini-btn" onclick="event.stopPropagation();window.publishExistingArtwork('${art.id}')">🚀</button>`:''}
                                <button class="mini-btn" style="border-color:red;color:red;" onclick="event.stopPropagation();window.deleteUserArtwork('${art.id}')">🗑️</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        window.changeUsername = async () => { const n = prompt('Новое имя:'); if(n) { await updateUserProfile(this.user.id, {username:n}); await this.loadProfile(); this.showNotification('✅', 'Имя изменено!', 'success'); } };
        window.claimDaily = async () => { const r = await claimDailyStar(this.user.id); if(r) { this.showNotification('⭐', 'Звезда получена!', 'success'); await this.updateDisplay(); await this.loadProfile(); } else { this.showNotification('⏰', 'Уже получена', 'warning'); } };
        window.editArtwork = async (id) => { const {getArtwork} = await import('./supabase.js'); const a = await getArtwork(id); if(a) { this.openCanvas(a.image_url, id); document.querySelector('.nav-btn[data-page="draw"]')?.click(); } };
        window.publishExistingArtwork = async (id) => { const pr = await getUserProfile(this.user.id); if(pr.stars_balance < 50) { this.showNotification('❌', 'Нужно 50', 'warning'); return; } await updateUserBalance(this.user.id, -50); await publishArtwork(id); await fetch(`${SUPABASE_URL}/rest/v1/purchases`, {method:'POST', headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=representation'}, body:JSON.stringify({user_id:this.user.id, artwork_id:id, stars_spent:50, purchase_type:'publish'})}); this.showNotification('🚀', '+50 в банк!', 'success'); await this.updateDisplay(); await this.updateBankDisplay(); await this.loadProfile(); };
        window.deleteUserArtwork = async (id) => { if(confirm('Удалить?')) { await deleteArtwork(id); await this.loadProfile(); } };
    }

    async loadAdminPanel() {
        const c = document.getElementById('pageContainer'); if(!c) return;
        c.innerHTML = '<div style="text-align:center;padding:40px;">Загрузка...</div>';
        try {
            const users = await getAllUsers();
            c.innerHTML = `<div style="padding:20px;"><h2 style="text-align:center;">👑 Админ</h2><p>Пользователей: ${users.length}</p>${users.map(u => `<div style="background:var(--glass-bg);padding:10px;border-radius:10px;margin:5px 0;display:flex;align-items:center;gap:10px;"><img src="${u.avatar_url||'icon.svg'}" style="width:40px;height:40px;border-radius:50%;"><div style="flex:1;"><strong>${u.username||'Нет имени'}</strong><p style="font-size:11px;">⭐ ${u.stars_balance}</p></div><button class="mini-btn" onclick="window.editStars('${u.id}',${u.stars_balance})">⭐</button><button class="mini-btn" style="border-color:red;color:red;" onclick="window.delUser('${u.id}')">🗑️</button></div>`).join('')}</div>`;
            window.editStars = async (id, cur) => { const v = prompt('+/- или число:'); if(v) { let n = cur; if(v.startsWith('+')) n = cur+parseInt(v.substring(1)); else if(v.startsWith('-')) n = cur-parseInt(v.substring(1)); else n = parseInt(v); if(!isNaN(n)) { await updateUserProfile(id, {stars_balance:n}); await this.loadAdminPanel(); } } };
            window.delUser = async (id) => { if(confirm('Удалить?')) { await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${id}`, {method:'DELETE', headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}}); await this.loadAdminPanel(); } };
        } catch(e) { console.error(e); }
    }
}

window.app = new ArtStarsApp();
