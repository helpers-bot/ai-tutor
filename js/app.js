import { supabase } from './supabase.js';
import { uploadToCloudinary, getVideoDuration } from './cloudinary.js';
import { CONFIG } from './config.js';

const appEl = document.getElementById('app');

// Проверка редиректа после Google входа
if (window.location.hash.includes('access_token')) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
        localStorage.setItem('token', token);
        fetch('https://aywfviexlltujeoaqeaq.supabase.co/auth/v1/user', {
            headers: { 'apikey': 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y', 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()).then(user => {
            localStorage.setItem('user', JSON.stringify(user));
            window.location.hash = '';
            showFeed();
        }).catch(() => showFeed());
    }
}

let authMode = 'login';

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
                    <input type="text" id="username" placeholder="Ваше имя">
                </div>
                <div class="form-group"><label>Email</label><input type="email" id="email" placeholder="your@email.com" required></div>
                <div class="form-group"><label>Пароль</label><input type="password" id="password" placeholder="Минимум 6 символов" minlength="6" required></div>
                <button type="submit" class="submit-btn" id="submitBtn">${authMode==='login'?'Войти':'Зарегистрироваться'}</button>
            </form>
            <div style="text-align:center;margin-top:15px;color:#888">или</div>
            <button id="googleBtn" style="width:100%;padding:12px;background:#fff;color:#000;border:none;border-radius:5px;cursor:pointer;font-weight:bold;margin-top:15px;display:flex;align-items:center;justify-content:center;gap:10px">
                <span style="font-size:20px">G</span> Войти через Google
            </button>
            <div id="msg"></div>
        </div>`;
    
    document.getElementById('tabLogin').onclick = () => { authMode = 'login'; showAuth(); };
    document.getElementById('tabRegister').onclick = () => { authMode = 'register'; showAuth(); };
    document.getElementById('googleBtn').onclick = () => supabase.signInWithGoogle();
    document.getElementById('authForm').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const username = document.getElementById('username')?.value?.trim();
        const btn = document.getElementById('submitBtn');
        const msg = document.getElementById('msg');
        
        btn.disabled = true;
        btn.textContent = 'Подождите...';
        msg.innerHTML = '';
        
        try {
            if (authMode === 'register') {
                await supabase.signUp(email, password, username || email.split('@')[0]);
                msg.innerHTML = '<div style="color:#4f4;padding:10px;text-align:center">✅ Регистрация успешна! Можете войти.</div>';
                authMode = 'login';
                setTimeout(showAuth, 1500);
            } else {
                await supabase.signIn(email, password);
                showFeed();
            }
        } catch (err) {
            msg.innerHTML = `<div style="color:#f44;padding:10px;text-align:center">❌ ${err.message}</div>`;
            btn.disabled = false;
            btn.textContent = authMode === 'login' ? 'Войти' : 'Зарегистрироваться';
        }
    };
}

async function showFeed() {
    const user = supabase.getUser();
    if (!user || !user.id) {
        supabase.signOut();
        showAuth();
        return;
    }
    
    let content = [];
    try { content = await supabase.getFeed(); } catch (e) { console.error(e); }
    
    let html = `<div class="feed-container">
        <div class="nav">
            <h2>TikTok Clone</h2>
            <div class="nav-actions">
                <button class="btn btn-gold" id="buyBtn">⭐ Купить</button>
                <button class="btn btn-primary" id="uploadBtn">+ Загрузить</button>
                <button class="btn btn-secondary" id="logoutBtn">Выйти</button>
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
    
    document.getElementById('logoutBtn').onclick = async () => { await supabase.signOut(); showAuth(); };
    document.getElementById('uploadBtn').onclick = showUpload;
    document.getElementById('buyBtn').onclick = showBuyStars;
    
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.onclick = async () => {
            await supabase.toggleLike(btn.dataset.id, user.id);
            const c = await supabase.getLikesCount(btn.dataset.id);
            btn.querySelector('span').textContent = c;
        };
    });
    
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.onclick = () => showComments(btn.dataset.id);
    });
    
    document.querySelectorAll('.repost-btn').forEach(btn => {
        btn.onclick = async () => {
            await supabase.repost(user.id, btn.dataset.id);
            alert('✅ Поделились!');
        };
    });
    
    document.querySelectorAll('.unlock-area').forEach(el => {
        el.onclick = async () => {
            const cid = el.dataset.id;
            const price = parseInt(el.dataset.price);
            if (!confirm(`Разблокировать за ${price} ⭐?`)) return;
            const bal = await supabase.getUserBalance(user.id);
            if (bal < price) return alert(`Недостаточно звёзд! У вас: ${bal} ⭐`);
            await supabase.buyContent(user.id, cid, price);
            alert('✅ Разблокировано!');
            showFeed();
        };
    });
}

function renderCard(item, canAccess, likes, comments) {
    const blur = !canAccess;
    return `<div class="content-card">
        <div class="content-header">
            <div class="user-info"><div class="user-avatar">${(item.users?.username||'U')[0].toUpperCase()}</div><div><div class="username">@${item.users?.username||'user'}</div>${item.is_premium?'<span class="premium-badge">⭐ Premium</span>':''}</div></div>
        </div>
        <div class="content-body">
            ${blur ? `<div class="blurred-content unlock-area" data-id="${item.id}" data-price="${item.price_stars}"><div class="blur-overlay"><div class="lock-icon">🔒</div><h3>Закрытый контент</h3><p style="font-size:24px;color:gold">${item.price_stars} ⭐</p><button class="unlock-btn">Разблокировать</button></div>${renderMedia(item,true)}</div>` : renderMedia(item)}
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
    return `<img ${b} src="${item.media_url}">`;
}

function showUpload() {
    appEl.innerHTML = `<div class="upload-container"><h2>Загрузить контент</h2>
        <div class="upload-form">
            <div class="file-upload-area" id="fileArea"><input type="file" id="fileInput" accept="image/*,video/*"><div class="upload-icon">📁</div><h3>Выберите файл</h3><p style="color:#888">Фото или видео до 15с</p></div>
            <div class="preview-container" id="preview"></div>
            <div class="form-group"><textarea id="description" placeholder="Описание..."></textarea></div>
            <div class="premium-settings"><label class="checkbox-group"><input type="checkbox" id="isPremium"><span>Закрытый контент</span></label><div class="price-input" id="priceSettings"><label>Цена ⭐</label><input type="number" id="priceStars" min="1" value="10"></div></div>
            <div style="display:flex;gap:10px"><button class="btn btn-primary" id="doUpload" style="flex:1">Загрузить</button><button class="btn btn-secondary" id="cancelUpload">Отмена</button></div>
        </div></div>`;
    
    let selectedFile = null;
    document.getElementById('fileArea').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = (e) => { selectedFile = e.target.files[0]; previewFile(selectedFile); };
    document.getElementById('isPremium').onchange = (e) => document.getElementById('priceSettings').classList.toggle('active', e.target.checked);
    document.getElementById('cancelUpload').onclick = showFeed;
    document.getElementById('doUpload').onclick = async () => {
        if (!selectedFile) return alert('Выберите файл');
        const user = supabase.getUser();
        if (selectedFile.type.startsWith('video/')) {
            const d = await getVideoDuration(selectedFile);
            if (d > CONFIG.content.maxVideoDuration) return alert(`Видео не длиннее 15с`);
        }
        const btn = document.getElementById('doUpload');
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
    reader.onload = (e) => preview.innerHTML = file.type.startsWith('video/') ? `<video src="${e.target.result}" controls></video>` : `<img src="${e.target.result}">`;
    reader.readAsDataURL(file);
}

async function showComments(cid) {
    const user = supabase.getUser();
    const comments = await supabase.getComments(cid);
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>Комментарии</h3><button class="close-btn" id="closeMod">✕</button></div>`;
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

function showBuyStars() {
    const pkgs = [{s:50,p:49},{s:150,p:129},{s:500,p:399},{s:1200,p:899}];
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>Купить звёзды</h3><button class="close-btn" id="closeMod">✕</button></div><div class="shop-grid">`;
    pkgs.forEach(p => h += `<div class="star-package" id="pkg${p.s}"><div class="star-amount">⭐ ${p.s}</div><div class="star-price">$${p.p}</div></div>`);
    h += `</div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('closeMod').onclick = () => document.getElementById('mod').remove();
    pkgs.forEach(p => {
        document.getElementById(`pkg${p.s}`).onclick = async () => {
            await supabase.addStars(supabase.getUser().id, p.s);
            alert(`✅ Куплено ${p.s} ⭐!`);
            document.getElementById('mod').remove();
            showFeed();
        };
    });
}

// Старт
if (supabase.isAuth()) showFeed();
else showAuth();
