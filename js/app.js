import { supabase } from './supabase.js';
import { uploadToCloudinary, getVideoDuration } from './cloudinary.js';
import { CONFIG } from './config.js';

const appEl = document.getElementById('app');

// Google редирект
if (window.location.hash.includes('access_token')) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
        localStorage.setItem('token', token);
        supabase.getUserProfile().then(user => {
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                window.location.hash = '';
                showFeed();
            }
        }).catch(() => showFeed());
    }
}

// ====== ГЛАВНЫЙ ЭКРАН (только Google) ======
function showAuth() {
    appEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center">
            <div style="font-size:60px;margin-bottom:20px">🎬</div>
            <h1 style="font-size:36px;margin-bottom:10px">VDS</h1>
            <p style="color:#888;margin-bottom:40px">Короткие видео · Premium контент</p>
            <button id="googleBtn" style="width:100%;max-width:300px;padding:16px;background:#fff;color:#000;border:none;border-radius:15px;cursor:pointer;font-weight:bold;font-size:16px;display:flex;align-items:center;justify-content:center;gap:10px">
                G &nbsp; Войти через Google
            </button>
            <p style="color:#666;margin-top:30px;font-size:12px">Нажимая, вы соглашаетесь с условиями</p>
        </div>`;
    document.getElementById('googleBtn').onclick = () => supabase.signInWithGoogle();
}

// ====== НАВИГАЦИЯ ======
function renderNav(active) {
    const items = [
        { id: 'feed', icon: '🏠', label: 'Главная' },
        { id: 'upload', icon: '➕', label: 'Создать' },
        { id: 'profile', icon: '👤', label: 'Профиль' }
    ];
    let html = '<nav class="bottom-nav">';
    items.forEach(i => {
        html += `<button class="nav-item" data-page="${i.id}" style="color:${active===i.id?'#fff':'#888'}">
            <div style="font-size:22px">${i.icon}</div>
            <div style="font-size:10px;margin-top:2px">${i.label}</div>
        </button>`;
    });
    return html + '</nav>';
}

function attachNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            const p = btn.dataset.page;
            if (p === 'feed') showFeed();
            else if (p === 'upload') showUpload();
            else if (p === 'profile') showProfile();
        };
    });
}

// ====== ЛЕНТА ======
async function showFeed() {
    const user = supabase.getUser();
    if (!user || !user.id) { supabase.signOut(); showAuth(); return; }

    let content = [];
    try { content = await supabase.getFeed(); } catch (e) { console.error(e); }

    let html = '<div class="page-container">';

    if (content.length === 0) {
        html += `<div class="empty-state" style="padding-top:80px">
            <div style="font-size:60px">🎬</div><h2>Пока нет видео</h2><p>Станьте первым!</p></div>`;
    } else {
        for (const item of content) {
            const canAccess = item.is_premium ? await supabase.canAccess(item.id, user.id) : true;
            const likes = await supabase.getLikesCount(item.id);
            const comments = await supabase.getComments(item.id);
            html += renderCard(item, canAccess, likes, comments.length);
        }
    }
    html += renderNav('feed') + '</div>';
    appEl.innerHTML = html;
    attachNav();
    attachFeedEvents(user);
}

function renderCard(item, canAccess, likes, comments) {
    const initial = (item.users?.username || 'U')[0].toUpperCase();
    const blur = !canAccess;
    return `<div class="content-card">
        <div class="content-header">
            <div class="user-info">
                <div class="user-avatar">${initial}</div>
                <div><div class="username">@${item.users?.username||'user'}</div>
                ${item.is_premium?'<span class="premium-badge">⭐ Premium</span>':''}</div>
            </div>
        </div>
        <div class="content-body">
            ${blur ? `<div class="blurred-content unlock-area" data-id="${item.id}" data-price="${item.price_stars}"><div class="blur-overlay"><div class="lock-icon">🔒</div><h3>Закрытый контент</h3><p style="font-size:24px;color:gold">${item.price_stars} ⭐</p><button class="unlock-btn">Смотреть</button></div>${renderMedia(item,true)}</div>` : renderMedia(item)}
        </div>
        ${item.description?`<div class="content-description">${item.description}</div>`:''}
        <div class="content-actions">
            <button class="action-btn like-btn" data-id="${item.id}">❤️ <span>${likes}</span></button>
            <button class="action-btn comment-btn" data-id="${item.id}">💬 <span>${comments}</span></button>
            <button class="action-btn repost-btn" data-id="${item.id}">🔄</button>
        </div>
    </div>`;
}

function renderMedia(item, blurred) {
    const b = blurred ? 'class="blurred"' : '';
    if (item.media_type === 'video') return `<video ${b} loop muted playsinline onmouseenter="if(!this.classList.contains('blurred'))this.play()" onmouseleave="this.pause()"><source src="${item.media_url}"></video>`;
    return `<img ${b} src="${item.media_url}" alt="Content">`;
}

function attachFeedEvents(user) {
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.onclick = async () => {
            await supabase.toggleLike(btn.dataset.id, user.id);
            btn.querySelector('span').textContent = await supabase.getLikesCount(btn.dataset.id);
        };
    });
    document.querySelectorAll('.comment-btn').forEach(btn => btn.onclick = () => showComments(btn.dataset.id));
    document.querySelectorAll('.repost-btn').forEach(btn => {
        btn.onclick = async () => { await supabase.repost(user.id, btn.dataset.id); alert('✅ Поделились!'); };
    });
    document.querySelectorAll('.unlock-area').forEach(el => {
        el.onclick = async () => {
            const cid = el.dataset.id, price = parseInt(el.dataset.price);
            if (!confirm(`Открыть за ${price} ⭐?`)) return;
            const bal = await supabase.getUserBalance(user.id);
            if (bal.stars_balance < price) return alert('Недостаточно звёзд!');
            await supabase.buyContent(user.id, cid, price);
            alert('✅ Открыто!'); showFeed();
        };
    });
}

// ====== ЗАГРУЗКА ======
function showUpload() {
    appEl.innerHTML = `<div class="page-container"><div class="upload-container">
        <h2>📤 Новое видео</h2>
        <div class="upload-form">
            <div class="file-upload-area" id="fileArea"><input type="file" id="fileInput" accept="image/*,video/*"><div class="upload-icon">📁</div><h3>Выбрать файл</h3><p style="color:#888">Фото или видео до 15с</p></div>
            <div class="preview-container" id="preview"></div>
            <div class="form-group"><textarea id="description" placeholder="Описание..."></textarea></div>
            <div class="premium-settings"><label class="checkbox-group"><input type="checkbox" id="isPremium"><span>Закрытый контент (Premium)</span></label><div class="price-input" id="priceSettings"><label>Цена ⭐</label><input type="number" id="priceStars" min="1" value="10"></div></div>
            <button class="btn btn-primary" id="doUpload" style="width:100%;padding:14px">Загрузить</button>
        </div>
    </div>${renderNav('upload')}</div>`;

    let selectedFile = null;
    document.getElementById('fileArea').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = (e) => { selectedFile = e.target.files[0]; previewFile(selectedFile); };
    document.getElementById('isPremium').onchange = (e) => document.getElementById('priceSettings').classList.toggle('active', e.target.checked);
    document.getElementById('doUpload').onclick = async () => {
        if (!selectedFile) return alert('Выберите файл');
        const user = supabase.getUser();
        if (selectedFile.type.startsWith('video/')) {
            const d = await getVideoDuration(selectedFile);
            if (d > CONFIG.content.maxVideoDuration) return alert('Видео не длиннее 15с');
        }
        const btn = document.getElementById('doUpload');
        btn.disabled = true; btn.textContent = 'Загрузка...';
        try {
            const url = await uploadToCloudinary(selectedFile);
            await supabase.createContent({
                user_id: user.id, media_url: url,
                media_type: selectedFile.type.startsWith('video/') ? 'video' : 'photo',
                description: document.getElementById('description').value,
                is_premium: document.getElementById('isPremium').checked,
                price_stars: parseInt(document.getElementById('priceStars').value) || 10
            });
            alert('✅ Загружено!'); showFeed();
        } catch (err) { alert('Ошибка: ' + err.message); btn.disabled = false; btn.textContent = 'Загрузить'; }
    };
    attachNav();
}

function previewFile(file) {
    const preview = document.getElementById('preview');
    preview.className = 'preview-container active';
    const reader = new FileReader();
    reader.onload = (e) => preview.innerHTML = file.type.startsWith('video/') ? `<video src="${e.target.result}" controls></video>` : `<img src="${e.target.result}">`;
    reader.readAsDataURL(file);
}

// ====== ПРОФИЛЬ ======
async function showProfile() {
    const user = supabase.getUser();
    if (!user || !user.id) { supabase.signOut(); showAuth(); return; }

    const profile = await supabase.getUserBalance(user.id);
    const initial = (profile.username || user.email || 'U')[0].toUpperCase();
    const username = profile.username || user.email?.split('@')[0] || 'user';

    appEl.innerHTML = `<div class="page-container">
        <div style="text-align:center;padding:40px 20px">
            <div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#ff0050,#ff6b6b);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto;font-weight:bold">${initial}</div>
            <h2 style="margin-top:15px" id="displayName">@${username}</h2>
            <p style="color:#888">${user.email}</p>
            <button class="btn btn-secondary" id="editNameBtn" style="margin:10px">✏️ Сменить ник</button>
            <div style="background:#111;border-radius:15px;padding:20px;margin:20px 0;display:inline-block">
                <div style="font-size:14px;color:#888">Баланс</div>
                <div style="font-size:36px;color:gold;font-weight:bold">⭐ ${profile.stars_balance}</div>
            </div>
            <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                <button class="btn btn-gold" id="buyBtn">Купить звёзды</button>
                <button class="btn btn-secondary" id="logoutBtn">Выйти</button>
            </div>
        </div>${renderNav('profile')}</div>`;

    document.getElementById('editNameBtn').onclick = () => editUsername(user.id);
    document.getElementById('buyBtn').onclick = showBuyStars;
    document.getElementById('logoutBtn').onclick = async () => { await supabase.signOut(); showAuth(); };
    attachNav();
}

async function editUsername(uid) {
    const newName = prompt('Новый никнейм:', '');
    if (!newName || newName.length < 3) return alert('Минимум 3 символа');
    try {
        await supabase.updateUsername(uid, newName);
        alert('✅ Никнейм изменён!');
        showProfile();
    } catch (e) {
        alert('❌ Ошибка. Возможно, ник занят.');
    }
}

// ====== КОММЕНТАРИИ ======
async function showComments(cid) {
    const user = supabase.getUser();
    const comments = await supabase.getComments(cid);
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>💬 Комментарии</h3><button class="close-btn" id="closeMod">✕</button></div>`;
    if (!comments.length) h += '<p style="color:#888;text-align:center;padding:20px">Нет комментариев</p>';
    else comments.forEach(c => h += `<div class="comment"><div class="comment-user">@${c.users?.username||'user'}</div><div class="comment-text">${c.text}</div></div>`);
    h += `<div class="comment-input-group"><input id="ci" placeholder="Написать..."><button class="btn btn-primary" id="sb">Отправить</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('closeMod').onclick = () => document.getElementById('mod').remove();
    document.getElementById('mod').onclick = (e) => { if (e.target.id === 'mod') document.getElementById('mod').remove(); };
    document.getElementById('sb').onclick = async () => {
        const t = document.getElementById('ci').value.trim();
        if (!t) return;
        await supabase.addComment(user.id, cid, t);
        document.getElementById('mod').remove();
        showComments(cid);
    };
}

// ====== ЗВЁЗДЫ ======
function showBuyStars() {
    const pkgs = [{s:50,p:49},{s:150,p:129},{s:500,p:399},{s:1200,p:899}];
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>⭐ Купить звёзды</h3><button class="close-btn" id="closeMod">✕</button></div><div class="shop-grid">`;
    pkgs.forEach(p => h += `<div class="star-package" id="pkg${p.s}"><div class="star-amount">⭐ ${p.s}</div><div class="star-price">$${p.p}</div></div>`);
    h += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('closeMod').onclick = () => document.getElementById('mod').remove();
    pkgs.forEach(p => document.getElementById(`pkg${p.s}`).onclick = async () => {
        await supabase.addStars(supabase.getUser().id, p.s);
        alert(`✅ +${p.s} ⭐!`);
        document.getElementById('mod').remove();
        showProfile();
    });
}

// Старт
if (supabase.isAuth()) showFeed();
else showAuth();
