import { supabase } from './supabase.js';
import { uploadToCloudinary, getVideoDuration } from './cloudinary.js';
import { CONFIG } from './config.js';

const appEl = document.getElementById('app');
let authMode = 'login';

// ====== AUTH ======
function showAuth() {
    appEl.innerHTML = `
        <div class="auth-container">
            <h1>TikTok Clone</h1>
            <div class="auth-tabs">
                <button class="${authMode==='login'?'active':''}" id="tabLogin">Вход</button>
                <button class="${authMode==='register'?'active':''}" id="tabRegister">Регистрация</button>
            </div>
            <form class="auth-form" id="authForm">
                <div class="form-group" id="usernameGroup" style="display:${authMode==='register'?'block':'none'}">
                    <label>Имя пользователя</label>
                    <input type="text" id="username" placeholder="Ваше имя" minlength="3">
                </div>
                <div class="form-group"><label>Email</label><input type="email" id="email" placeholder="your@email.com" required></div>
                <div class="form-group"><label>Пароль</label><input type="password" id="password" placeholder="Минимум 6 символов" minlength="6" required></div>
                <button type="submit" class="submit-btn" id="submitBtn">${authMode==='login'?'Войти':'Зарегистрироваться'}</button>
            </form>
        </div>`;
    
    document.getElementById('tabLogin').onclick = () => { authMode = 'login'; showAuth(); };
    document.getElementById('tabRegister').onclick = () => { authMode = 'register'; showAuth(); };
    document.getElementById('authForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const username = document.getElementById('username')?.value;
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.textContent = 'Подождите...';
        try {
            let r;
            if (authMode === 'register') r = await supabase.signUp(email, password, username);
            else r = await supabase.signIn(email, password);
            if (r.user || r.access_token) { showFeed(); return; }
            throw new Error(r.error?.message || 'Ошибка');
        } catch (err) {
            alert(err.message);
            btn.disabled = false;
            btn.textContent = authMode === 'login' ? 'Войти' : 'Зарегистрироваться';
        }
    };
}

// ====== FEED ======
async function showFeed() {
    const user = supabase.getUser();
    if (!user) return showAuth();
    
    let content = [];
    try { content = await supabase.getFeed(); } catch (e) { console.error(e); }
    
    let html = `<div class="feed-container">
        <div class="nav">
            <h2>TikTok Clone</h2>
            <div class="nav-actions">
                <button class="btn btn-gold" onclick="window._buyStars()">⭐ Купить</button>
                <button class="btn btn-primary" onclick="window._showUpload()">+ Загрузить</button>
                <button class="btn btn-secondary" onclick="window._logout()">Выйти</button>
            </div>
        </div>`;
    
    if (content.length === 0) {
        html += `<div class="empty-state"><h2>Пока нет контента</h2><p>Загрузите первое фото или видео!</p></div></div>`;
    } else {
        for (const item of content) {
            const canAccess = item.is_premium ? await supabase.canAccess(item.id, user.id) : true;
            const likes = await supabase.getLikesCount(item.id);
            const comments = await supabase.getComments(item.id);
            html += renderCard(item, canAccess, likes, comments.length);
        }
        html += '</div>';
    }
    appEl.innerHTML = html;
}

function renderCard(item, canAccess, likes, comments) {
    const blur = !canAccess;
    return `<div class="content-card">
        <div class="content-header">
            <div class="user-info"><div class="user-avatar">${(item.users?.username||'U')[0].toUpperCase()}</div><div><div class="username">@${item.users?.username||'user'}</div>${item.is_premium?'<span class="premium-badge">⭐ Premium</span>':''}</div></div>
        </div>
        <div class="content-body">
            ${blur ? `<div class="blurred-content" onclick="window._unlock('${item.id}',${item.price_stars})"><div class="blur-overlay"><div class="lock-icon">🔒</div><h3>Закрытый контент</h3><p style="font-size:24px;color:gold">${item.price_stars} ⭐</p><button class="unlock-btn">Разблокировать</button></div>${renderMedia(item,true)}</div>` : renderMedia(item)}
        </div>
        ${item.description?`<div class="content-description">${item.description}</div>`:''}
        <div class="content-actions">
            <button class="action-btn" onclick="window._like('${item.id}')">❤️ <span>${likes}</span></button>
            <button class="action-btn" onclick="window._comments('${item.id}')">💬 <span>${comments}</span></button>
            <button class="action-btn" onclick="window._repost('${item.id}')">🔄</button>
        </div>
    </div>`;
}

function renderMedia(item, blurred) {
    const b = blurred ? 'class="blurred"' : '';
    if (item.media_type === 'video') return `<video ${b} loop muted playsinline onmouseenter="if(!this.classList.contains('blurred'))this.play()" onmouseleave="this.pause()"><source src="${item.media_url}"></video>`;
    return `<img ${b} src="${item.media_url}">`;
}

// ====== UPLOAD ======
function showUpload() {
    appEl.innerHTML = `<div class="upload-container"><h2>Загрузить контент</h2>
        <div class="upload-form">
            <div class="file-upload-area" id="fileArea"><input type="file" id="fileInput" accept="image/*,video/*"><div class="upload-icon">📁</div><h3>Выберите файл</h3><p style="color:#888">Фото или видео до 15с</p></div>
            <div class="preview-container" id="preview"></div>
            <div class="form-group"><textarea id="description" placeholder="Описание..."></textarea></div>
            <div class="premium-settings"><label class="checkbox-group"><input type="checkbox" id="isPremium"><span>Закрытый контент</span></label><div class="price-input" id="priceSettings"><label>Цена ⭐</label><input type="number" id="priceStars" min="1" value="10"></div></div>
            <div style="display:flex;gap:10px"><button class="btn btn-primary submit-btn" id="btnUpload" style="flex:1">Загрузить</button><button class="btn btn-secondary" onclick="showFeed()">Отмена</button></div>
        </div></div>`;
    
    let selectedFile = null;
    document.getElementById('fileArea').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = (e) => { selectedFile = e.target.files[0]; previewFile(selectedFile); };
    document.getElementById('isPremium').onchange = (e) => document.getElementById('priceSettings').classList.toggle('active', e.target.checked);
    document.getElementById('btnUpload').onclick = async () => {
        if (!selectedFile) return alert('Выберите файл');
        const user = supabase.getUser();
        if (!user) return alert('Авторизуйтесь');
        if (selectedFile.type.startsWith('video/')) {
            const d = await getVideoDuration(selectedFile);
            if (d > CONFIG.content.maxVideoDuration) return alert(`Видео должно быть не длиннее ${CONFIG.content.maxVideoDuration}с`);
        }
        const btn = document.getElementById('btnUpload');
        btn.disabled = true; btn.textContent = 'Загрузка...';
        try {
            const url = await uploadToCloudinary(selectedFile);
            await supabase.createContent({
                user_id: user.id,
                media_url: url,
                media_type: selectedFile.type.startsWith('video/') ? 'video' : 'photo',
                description: document.getElementById('description').value,
                is_premium: document.getElementById('isPremium').checked,
                price_stars: parseInt(document.getElementById('priceStars').value) || 10
            });
            alert('✅ Загружено!');
            showFeed();
        } catch (err) { alert('Ошибка: ' + err.message); btn.disabled = false; btn.textContent = 'Загрузить'; }
    };
}

function previewFile(file) {
    const preview = document.getElementById('preview');
    preview.className = 'preview-container active';
    const reader = new FileReader();
    reader.onload = (e) => {
        preview.innerHTML = file.type.startsWith('video/') ? `<video src="${e.target.result}" controls></video>` : `<img src="${e.target.result}">`;
    };
    reader.readAsDataURL(file);
}

// ====== ACTIONS ======
window._like = async (id) => {
    await supabase.toggleLike(id, supabase.getUser().id);
    showFeed();
};
window._comments = async (id) => {
    const comments = await supabase.getComments(id);
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>Комментарии</h3><button class="close-btn" onclick="document.getElementById('mod').remove()">✕</button></div>`;
    if (!comments.length) h += '<p style="color:#888;text-align:center;padding:20px">Нет комментариев</p>';
    else comments.forEach(c => h += `<div class="comment"><div class="comment-user">@${c.users?.username||'user'}</div><div class="comment-text">${c.text}</div></div>`);
    h += `<div class="comment-input-group"><input id="ci" placeholder="Написать..."><button class="btn btn-primary" id="sb">Отправить</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('mod').onclick = (e) => { if (e.target.id === 'mod') document.getElementById('mod').remove(); };
    document.getElementById('sb').onclick = async () => {
        const t = document.getElementById('ci').value.trim();
        if (!t) return;
        await supabase.addComment(supabase.getUser().id, id, t);
        document.getElementById('mod').remove();
        window._comments(id);
    };
};
window._repost = async (id) => {
    await supabase.repost(supabase.getUser().id, id);
    alert('✅ Поделились!');
};
window._unlock = async (id, price) => {
    const user = supabase.getUser();
    if (!confirm(`Разблокировать за ${price} ⭐?`)) return;
    const bal = await supabase.getUserBalance(user.id);
    if (bal < price) return alert(`Недостаточно звёзд! У вас: ${bal} ⭐`);
    await supabase.buyContent(user.id, id, price);
    alert('✅ Разблокировано!');
    showFeed();
};
window._buyStars = () => {
    const pkgs = [{s:50,p:49},{s:150,p:129},{s:500,p:399},{s:1200,p:899}];
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>⭐ Купить звёзды</h3><button class="close-btn" onclick="document.getElementById('mod').remove()">✕</button></div><div class="shop-grid">`;
    pkgs.forEach(p => h += `<div class="star-package" onclick="window._doBuy(${p.s})"><div class="star-amount">⭐ ${p.s}</div><div class="star-price">$${p.p}</div></div>`);
    h += `</div><div class="payment-info"><p>Оплата через NOWPayments</p></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('mod').onclick = (e) => { if (e.target.id === 'mod') document.getElementById('mod').remove(); };
};
window._doBuy = async (stars) => {
    // Заглушка — в реальности здесь интеграция с NOWPayments
    await supabase.addStars(supabase.getUser().id, stars);
    alert(`✅ Куплено ${stars} ⭐!`);
    document.getElementById('mod')?.remove();
    showFeed();
};
window._showUpload = showUpload;
window._logout = async () => { await supabase.signOut(); showAuth(); };

// ====== INIT ======
if (supabase.isAuth()) showFeed();
else showAuth();
