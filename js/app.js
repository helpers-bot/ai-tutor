<script type="module" src="js/supabase.js"></script>
import { uploadToCloudinary, getVideoDuration } from './cloudinary.js';
import { CONFIG } from './config.js';

const appEl = document.getElementById('app');
let currentIndex = 0;
let feedData = [];
let touchStartY = 0;
let touchEndY = 0;
let viewingUserId = null;
let likedSet = new Set();

// Google редирект
if (window.location.hash.includes('access_token')) {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
        localStorage.setItem('token', token);
        supabase.getUserProfile().then(user => {
            if (user) { localStorage.setItem('user', JSON.stringify(user)); window.location.hash = ''; showFeed(); }
        }).catch(() => showFeed());
    }
}

function showAuth() {
    appEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;background:#000">
        <div style="font-size:60px;margin-bottom:20px">🎬</div>
        <h1 style="font-size:36px;margin-bottom:10px">VDS</h1>
        <p style="color:#888;margin-bottom:40px">Короткие видео · Premium</p>
        <button id="googleBtn" style="width:100%;max-width:300px;padding:16px;background:#fff;color:#000;border:none;border-radius:15px;cursor:pointer;font-weight:bold;font-size:16px;display:flex;align-items:center;justify-content:center;gap:10px">G &nbsp; Войти через Google</button>
    </div>`;
    document.getElementById('googleBtn').onclick = () => supabase.signInWithGoogle();
}

function renderNav(active) {
    const items = [
        { id: 'feed', icon: '🏠', label: 'Главная' },
        { id: 'upload', icon: '➕', label: 'Создать' },
        { id: 'profile', icon: '👤', label: 'Профиль' }
    ];
    let html = '<nav class="bottom-nav">';
    items.forEach(i => html += `<button class="nav-item" data-page="${i.id}" style="color:${active===i.id?'#fff':'#888'}"><div style="font-size:22px">${i.icon}</div><div style="font-size:10px;margin-top:2px">${i.label}</div></button>`);
    return html + '</nav>';
}

function attachNav() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            viewingUserId = null;
            const p = btn.dataset.page;
            if (p === 'feed') showFeed();
            else if (p === 'upload') showUpload();
            else if (p === 'profile') showProfile();
        };
    });
}

async function showFeed() {
    const user = supabase.getUser();
    if (!user || !user.id) { supabase.signOut(); showAuth(); return; }
    try { feedData = await supabase.getFeed(); } catch (e) { feedData = []; }
    currentIndex = 0;
    likedSet = new Set();
    if (feedData.length === 0) {
        appEl.innerHTML = `<div class="page-container"><div class="empty-state" style="padding-top:80px"><div style="font-size:60px">🎬</div><h2>Пока нет видео</h2><p>Станьте первым!</p></div>${renderNav('feed')}</div>`;
        attachNav(); return;
    }
    renderCurrentVideo(user);
    attachNav();
}

async function renderCurrentVideo(user) {
    if (currentIndex >= feedData.length) { currentIndex = 0; showFeed(); return; }
    const item = feedData[currentIndex];
    let canAccess = true;
    if (item.is_premium) { try { canAccess = await supabase.canAccess(item.id, user.id); } catch(e) { canAccess = false; } }
    const likes = await supabase.getLikesCount(item.id);
    const comments = await supabase.getComments(item.id);
    const isLiked = likedSet.has(item.id);
    const avatarUrl = item.users?.avatar_url || '';
    const initial = (item.users?.username || 'U')[0].toUpperCase();

    appEl.innerHTML = `<div class="video-container" id="videoContainer">
        <div class="video-wrapper">
            ${canAccess ? renderMediaFull(item) : renderBlurredMedia(item)}
            <div class="video-overlay">
                <div class="video-info">
                    <div class="user-row" id="profileLink" data-uid="${item.user_id}" style="cursor:pointer">
                        ${avatarUrl ? `<img src="${avatarUrl}" class="user-avatar-small" style="object-fit:cover">` : `<div class="user-avatar-small">${initial}</div>`}
                        <span class="username">@${item.users?.username||'user'}</span>
                        ${item.is_premium ? '<span style="color:gold;font-size:12px">⭐</span>' : ''}
                    </div>
                    <div class="desc-text">${item.description || ''}</div>
                </div>
                <div class="actions-right">
                    <button class="action-round like-btn ${isLiked ? 'liked' : ''}" data-id="${item.id}">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="${isLiked ? '#ff0040' : 'none'}" stroke="${isLiked ? '#ff0040' : '#fff'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        <span>${likes}</span>
                    </button>
                    <button class="action-round comment-btn" data-id="${item.id}">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>${comments.length}</span>
                    </button>
                    <button class="action-round share-btn" data-id="${item.id}">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                </div>
                ${!canAccess ? `<div class="premium-lock" data-id="${item.id}" data-price="${item.price_stars}"><div class="lock-content"><div class="lock-icon">🔒</div><h3>Premium контент</h3><p>@${item.users?.username||'user'} выставил контент за <b style="color:gold;font-size:24px">${item.price_stars} ⭐</b></p>${item.description?`<p style="color:#ccc;margin-top:10px">📝 ${item.description.substring(0,100)}${item.description.length>100?'...':''}</p>`:''}<button class="unlock-btn">Открыть за ${item.price_stars} ⭐</button></div></div>` : ''}
            </div>
        </div>
        ${renderNav('feed')}
    </div>`;

    const container = document.getElementById('videoContainer');
    container.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; });
    container.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].clientY;
        if (touchStartY - touchEndY > 50) { currentIndex++; renderCurrentVideo(user); }
        if (touchEndY - touchStartY > 50 && currentIndex > 0) { currentIndex--; renderCurrentVideo(user); }
    });
    container.addEventListener('wheel', (e) => {
        if (e.deltaY > 30) { currentIndex++; renderCurrentVideo(user); }
        else if (e.deltaY < -30 && currentIndex > 0) { currentIndex--; renderCurrentVideo(user); }
    }, { passive: true });

    const profileLink = document.getElementById('profileLink');
    if (profileLink) profileLink.onclick = () => showUserProfile(item.user_id);
    attachNav();
    attachActions(user, item);
}

function renderMediaFull(item) {
    if (item.media_type === 'video') return `<video src="${item.media_url}" loop playsinline autoplay class="full-media"></video>`;
    return `<img src="${item.media_url}" class="full-media">`;
}

function renderBlurredMedia(item) {
    if (item.media_type === 'video') return `<video src="${item.media_url}" loop muted playsinline class="full-media blurred-heavy"></video>`;
    return `<img src="${item.media_url}" class="full-media blurred-heavy">`;
}

function attachActions(user, item) {
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.dataset.id;
            await supabase.toggleLike(id, user.id);
            likedSet.has(id) ? likedSet.delete(id) : likedSet.add(id);
            btn.querySelector('span').textContent = await supabase.getLikesCount(id);
            const liked = likedSet.has(id);
            btn.classList.toggle('liked', liked);
            const svg = btn.querySelector('svg');
            if (svg) { svg.setAttribute('fill', liked ? '#ff0040' : 'none'); svg.setAttribute('stroke', liked ? '#ff0040' : '#fff'); }
        };
    });
    document.querySelectorAll('.comment-btn').forEach(btn => btn.onclick = () => showComments(btn.dataset.id));
    document.querySelectorAll('.share-btn').forEach(btn => { btn.onclick = async () => { await supabase.shareContent(item); }; });
    const lock = document.querySelector('.premium-lock');
    if (lock) {
        lock.onclick = async () => {
            const cid = lock.dataset.id, price = parseInt(lock.dataset.price);
            if (!confirm(`Открыть за ${price} ⭐?`)) return;
            const bal = await supabase.getUserBalance(user.id);
            if (bal.stars_balance < price) return supabase.toast('Недостаточно звёзд!');
            await supabase.buyContent(user.id, cid, price);
            supabase.toast('✅ Открыто!'); renderCurrentVideo(user);
        };
    }
}

async function showUserProfile(uid) {
    viewingUserId = uid;
    const profile = await supabase.getUserById(uid);
    if (!profile) return supabase.toast('Пользователь не найден');
    const myContent = await supabase.getUserContent(uid);
    const avatarUrl = profile.avatar_url || '';
    const initial = (profile.username || 'U')[0].toUpperCase();
    let grid = myContent.length === 0 ? '<p style="color:#888;text-align:center;padding:20px">Нет публикаций</p>' : '<div class="profile-grid">'+myContent.map(item => `<div class="profile-grid-item">${item.media_type==='video'?`<video src="${item.media_url}" muted style="width:100%;height:100%;object-fit:cover"></video>`:`<img src="${item.media_url}" style="width:100%;height:100%;object-fit:cover">`}${item.is_premium?'<span style="position:absolute;top:5px;left:5px;background:gold;color:#000;padding:2px 6px;border-radius:8px;font-size:10px">⭐</span>':''}</div>`).join('')+'</div>';

    appEl.innerHTML = `<div class="page-container"><div style="text-align:center;padding:40px 20px 20px">
        <button class="btn btn-secondary" id="backBtn" style="position:absolute;top:20px;left:20px">← Назад</button>
        ${avatarUrl?`<img src="${avatarUrl}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;margin:0 auto">`:`<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#ff0050,#ff6b6b);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto;font-weight:bold">${initial}</div>`}
        <h2 style="margin-top:15px">@${profile.username||'user'}</h2>
        <h3 style="text-align:left;margin-top:30px;margin-bottom:15px">📱 Публикации</h3>${grid}
    </div>${renderNav('feed')}</div>`;
    document.getElementById('backBtn').onclick = () => { viewingUserId = null; showFeed(); };
    attachNav();
}

function showUpload() {
    appEl.innerHTML = `<div class="page-container"><div class="upload-container"><h2>📤 Новое видео</h2><div class="upload-form">
        <div class="file-upload-area" id="fileArea"><input type="file" id="fileInput" accept="image/*,video/*"><div class="upload-icon">📁</div><h3>Выбрать файл</h3><p style="color:#888">Фото или видео до 15с</p></div>
        <div class="preview-container" id="preview"></div>
        <div class="form-group"><textarea id="description" placeholder="Описание (до 2000 символов)..." maxlength="2000"></textarea><small style="color:#888"><span id="charCount">0</span>/2000</small></div>
        <div class="form-group"><input type="text" id="hashtags" placeholder="#хештеги (до 5, через пробел)" maxlength="200"></div>
        <div class="premium-settings"><label class="checkbox-group"><input type="checkbox" id="isPremium"><span>Закрытый контент (Premium)</span></label><div class="price-input" id="priceSettings"><label>Цена ⭐</label><input type="number" id="priceStars" min="1" value="10"></div></div>
        <div id="premiumHint" style="display:none;background:#1a1a1a;padding:15px;border-radius:10px;color:gold;font-size:14px;margin-top:10px">💡 Чтобы ваш контент купили, опишите его и поставьте 5 хештегов.</div>
        <button class="btn btn-primary" id="doUpload" style="width:100%;padding:14px">Загрузить</button>
    </div></div>${renderNav('upload')}</div>`;

    let selectedFile = null;
    document.getElementById('fileArea').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = (e) => { selectedFile = e.target.files[0]; previewFile(selectedFile); };
    document.getElementById('isPremium').onchange = (e) => { document.getElementById('priceSettings').classList.toggle('active', e.target.checked); document.getElementById('premiumHint').style.display = e.target.checked ? 'block' : 'none'; };
    document.getElementById('description').oninput = (e) => { document.getElementById('charCount').textContent = e.target.value.length; };
    document.getElementById('doUpload').onclick = async () => {
        if (!selectedFile) return supabase.toast('Выберите файл');
        const user = supabase.getUser();
        const desc = document.getElementById('description').value;
        const tags = document.getElementById('hashtags').value;
        if (desc.length > 2000) return supabase.toast('Максимум 2000 символов');
        if (tags.split(' ').filter(t => t.startsWith('#')).length > 5) return supabase.toast('Максимум 5 хештегов');
        if (selectedFile.type.startsWith('video/')) { const d = await getVideoDuration(selectedFile); if (d > CONFIG.content.maxVideoDuration) return supabase.toast('Видео не длиннее 15с'); }
        const btn = document.getElementById('doUpload'); btn.disabled = true; btn.textContent = 'Загрузка...';
        try {
            const url = await uploadToCloudinary(selectedFile);
            await supabase.createContent({ user_id: user.id, media_url: url, media_type: selectedFile.type.startsWith('video/')?'video':'photo', description: desc+(tags?'\n'+tags:''), is_premium: document.getElementById('isPremium').checked, price_stars: parseInt(document.getElementById('priceStars').value)||10 });
            supabase.toast('✅ Контент отправлен на проверку!'); showFeed();
        } catch (err) { supabase.toast('Ошибка: '+err.message); btn.disabled = false; btn.textContent = 'Загрузить'; }
    };
    attachNav();
}

function previewFile(file) {
    const preview = document.getElementById('preview'); preview.className = 'preview-container active';
    const reader = new FileReader();
    reader.onload = (e) => preview.innerHTML = file.type.startsWith('video/')?`<video src="${e.target.result}" controls style="max-width:100%;max-height:300px"></video>`:`<img src="${e.target.result}" style="max-width:100%;max-height:300px">`;
    reader.readAsDataURL(file);
}

async function showProfile() {
    const user = supabase.getUser();
    if (!user||!user.id) { supabase.signOut(); showAuth(); return; }
    const profile = await supabase.getUserBalance(user.id);
    const myContent = await supabase.getUserContent(user.id);
    const avatarUrl = profile.avatar_url||'';
    const initial = (profile.username||user.email||'U')[0].toUpperCase();
    const username = profile.username||user.email?.split('@')[0]||'user';

    let grid = myContent.length===0?'<p style="color:#888;text-align:center;padding:20px">Нет публикаций</p>':'<div class="profile-grid">'+myContent.map(item => `<div class="profile-grid-item" style="position:relative">${item.media_type==='video'?`<video src="${item.media_url}" muted style="width:100%;height:100%;object-fit:cover"></video>`:`<img src="${item.media_url}" style="width:100%;height:100%;object-fit:cover">`}${item.is_premium?'<span style="position:absolute;top:5px;left:5px;background:gold;color:#000;padding:2px 6px;border-radius:8px;font-size:10px">⭐</span>':''}<button class="delete-btn" data-id="${item.id}" style="position:absolute;top:5px;right:5px;background:rgba(255,0,0,0.8);color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">🗑</button></div>`).join('')+'</div>';

    appEl.innerHTML = `<div class="page-container"><div style="text-align:center;padding:40px 20px 20px">
        <div style="position:relative;display:inline-block">${avatarUrl?`<img src="${avatarUrl}" style="width:90px;height:90px;border-radius:50%;object-fit:cover">`:`<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#ff0050,#ff6b6b);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto;font-weight:bold">${initial}</div>`}<button id="changeAvatarBtn" style="position:absolute;bottom:0;right:0;background:#333;color:#fff;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:14px">📷</button><input type="file" id="avatarInput" accept="image/*" style="display:none"></div>
        <h2 style="margin-top:15px">@${username}</h2><p style="color:#888">${user.email}</p>
        <button class="btn btn-secondary" id="editNameBtn" style="margin:10px">✏️ Сменить ник</button>
        <a href="/admin.html" class="btn btn-gold" style="display:inline-block;margin:10px;text-decoration:none;padding:8px 16px;border-radius:20px;font-size:14px">⚙️ Админка</a>
        <div style="background:#111;border-radius:15px;padding:20px;margin:20px 0;display:inline-block"><div style="font-size:14px;color:#888">Баланс</div><div style="font-size:36px;color:gold;font-weight:bold">⭐ ${profile.stars_balance}</div></div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:30px"><button class="btn btn-gold" id="buyBtn">Купить звёзды</button><button class="btn btn-secondary" id="logoutBtn">Выйти</button></div>
        <h3 style="text-align:left;margin-bottom:15px">📱 Мои публикации</h3>${grid}
    </div>${renderNav('profile')}</div>`;

    document.getElementById('changeAvatarBtn').onclick = () => document.getElementById('avatarInput').click();
    document.getElementById('avatarInput').onchange = async (e) => { const f=e.target.files[0]; if(!f)return; try{const url=await uploadToCloudinary(f);await supabase.updateAvatar(user.id,url);supabase.toast('✅ Готово!');showProfile();}catch(err){supabase.toast('❌ Ошибка');} };
    document.getElementById('editNameBtn').onclick = async () => { const n=prompt('Новый ник:',username); if(!n||n.length<3)return supabase.toast('Минимум 3 символа'); try{await supabase.updateUsername(user.id,n);supabase.toast('✅ Готово!');showProfile();}catch(e){supabase.toast('❌ Ошибка');} };
    document.getElementById('buyBtn').onclick = showBuyStars;
    document.getElementById('logoutBtn').onclick = async () => { await supabase.signOut(); showAuth(); };
    document.querySelectorAll('.delete-btn').forEach(btn => { btn.onclick = async (e) => { e.stopPropagation(); if(confirm('Удалить?')){await supabase.deleteContent(btn.dataset.id);supabase.toast('✅ Удалено');showProfile();} }; });
    attachNav();
}

async function showComments(cid) {
    const user = supabase.getUser(); const comments = await supabase.getComments(cid);
    let h = `<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>💬 Комментарии</h3><button class="close-btn" id="closeMod">✕</button></div>`;
    if(!comments.length) h+='<p style="color:#888;text-align:center;padding:20px">Нет комментариев</p>';
    else comments.forEach(c => h+=`<div class="comment"><div class="comment-user">@${c.users?.username||'user'}</div><div class="comment-text">${c.text}</div></div>`);
    h+=`<div class="comment-input-group"><input id="ci" placeholder="Написать..."><button class="btn btn-primary" id="sb">Отправить</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend',h);
    document.getElementById('closeMod').onclick=()=>document.getElementById('mod').remove();
    document.getElementById('mod').onclick=(e)=>{if(e.target.id==='mod')document.getElementById('mod').remove();};
    document.getElementById('sb').onclick=async()=>{const t=document.getElementById('ci').value.trim();if(!t)return;await supabase.addComment(user.id,cid,t);document.getElementById('mod').remove();showComments(cid);};
}

function showBuyStars() {
    const pkgs=[{s:50,p:49},{s:150,p:129},{s:500,p:399},{s:1200,p:899}];
    let h=`<div class="modal active" id="mod"><div class="modal-content"><div class="modal-header"><h3>⭐ Купить звёзды</h3><button class="close-btn" id="closeMod">✕</button></div><div class="shop-grid">`;
    pkgs.forEach(p=>h+=`<div class="star-package" id="pkg${p.s}"><div class="star-amount">⭐ ${p.s}</div><div class="star-price">$${p.p}</div></div>`);
    h+='</div></div></div>'; document.body.insertAdjacentHTML('beforeend',h);
    document.getElementById('closeMod').onclick=()=>document.getElementById('mod').remove();
    pkgs.forEach(p=>document.getElementById(`pkg${p.s}`).onclick=async()=>{await supabase.addStars(supabase.getUser().id,p.s);supabase.toast(`✅ +${p.s} ⭐!`);document.getElementById('mod').remove();showProfile();});
}

if (supabase.isAuth()) showFeed(); else showAuth();
