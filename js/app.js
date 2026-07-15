import { CONFIG } from './config.js';
const appEl = document.getElementById('app');

function showAuth() {
    appEl.innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <h1 class="neon-logo">VDS</h1>
        <button id="googleBtn" class="btn-neon">ВОЙТИ ЧЕРЕЗ GOOGLE</button>
    </div>`;
    document.getElementById('googleBtn').onclick = () => supabase.signInWithGoogle();
}

async function showProfile() {
    const user = supabase.getUser();
    const myContent = await supabase.getUserContent(user.id);
    // Ссылка на админку оставлена только для тех, кому нужно (убери условие, если нужна всем)
    let grid = myContent.map(item => `
        <div class="video-glow-border" style="margin:5px">
            <div class="video-content">
                ${item.media_type==='video'?`<video src="${item.media_url}" style="width:100%"></video>`:`<img src="${item.media_url}" style="width:100%">`}
                <div style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,0.8);padding:3px;font-size:10px;color:${item.status==='approved'?'#0f0':'#ff0'}">
                    ${item.status==='approved'?'✅ Опубликовано':'⏳ На модерации'}
                </div>
            </div>
        </div>
    `).join('');

    import './supabase.js';
async function renderAdminPanel(tab = 'moderation') {
    const pending = await window.supabase.getPendingContent(); 
    // ... отрисовка списка из таблицы content, где status = pending
    // При клике на "Одобрить" вызывай supabase.approveContent(id)
}
    appEl.innerHTML = `<div style="padding:20px"><a href="/">Назад</a><h2>Мои видео</h2><div style="display:grid;grid-template-columns:1fr 1fr">${grid}</div></div>`;
}
