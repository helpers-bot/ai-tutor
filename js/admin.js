import { supabase } from './supabase.js';

const ADMIN_PASSWORD = '135710Aa!';
const adminApp = document.getElementById('adminApp');

// Проверка авторизации админа
if (sessionStorage.getItem('admin_auth') === 'true') {
    renderAdminPanel();
} else {
    showLoginForm();
}

function showLoginForm() {
    adminApp.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;background:#000">
            <div style="font-size:60px;margin-bottom:20px">🔐</div>
            <h1 style="color:#ff0050;margin-bottom:10px">VDS</h1>
            <p style="color:#888;margin-bottom:30px">Админ-панель</p>
            <input type="password" id="adminPass" placeholder="Введите пароль" style="width:100%;max-width:300px;padding:14px;background:#111;border:1px solid #333;border-radius:10px;color:#fff;font-size:16px;text-align:center;margin-bottom:20px">
            <button id="adminLoginBtn" style="width:100%;max-width:300px;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:16px;font-weight:bold">Войти</button>
            <p id="adminError" style="color:#f44;margin-top:15px;display:none">Неверный пароль</p>
            <a href="/" style="color:#888;margin-top:30px;text-decoration:none">← На сайт</a>
        </div>`;

    document.getElementById('adminLoginBtn').onclick = () => {
        const pass = document.getElementById('adminPass').value;
        if (pass === ADMIN_PASSWORD) {
            sessionStorage.setItem('admin_auth', 'true');
            renderAdminPanel();
        } else {
            document.getElementById('adminError').style.display = 'block';
        }
    };

    document.getElementById('adminPass').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
    });
}

async function renderAdminPanel(tab = 'moderation') {
    let users = [];
    let pending = [];
    let history = [];

    try { users = await supabase.getAllUsers(); } catch(e) {}
    try { pending = await supabase.getPendingContent(); } catch(e) {}
    try { history = await supabase.getModerationHistory(); } catch(e) {}

    let html = `<div style="max-width:900px;margin:0 auto;padding:20px;color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <h1 style="color:#ff0050">⚙️ Админ-панель VDS</h1>
            <div>
                <a href="/" class="btn btn-secondary" style="text-decoration:none;margin-right:10px">🏠 На сайт</a>
                <button class="btn btn-secondary" onclick="sessionStorage.removeItem('admin_auth');location.reload()">🚪 Выйти</button>
            </div>
        </div>
        <div style="display:flex;gap:10px;margin:20px 0;flex-wrap:wrap">
            <button class="btn ${tab==='moderation'?'btn-primary':'btn-secondary'}" onclick="window._adminTab('moderation')">📋 Модерация (${pending.length})</button>
            <button class="btn ${tab==='users'?'btn-primary':'btn-secondary'}" onclick="window._adminTab('users')">👥 Пользователи (${users.length})</button>
            <button class="btn ${tab==='history'?'btn-primary':'btn-secondary'}" onclick="window._adminTab('history')">📜 История</button>
        </div>`;

    if (tab === 'moderation') {
        if (pending.length === 0) {
            html += '<p style="color:#888;text-align:center;padding:40px">✅ Нет контента на проверку</p>';
        } else {
            pending.forEach(item => {
                html += `<div style="background:#111;border-radius:15px;padding:15px;margin-bottom:15px;border:1px solid #222">
                    <div style="display:flex;gap:15px;align-items:start;flex-wrap:wrap">
                        <div style="width:120px;height:180px;background:#000;border-radius:10px;overflow:hidden;flex-shrink:0">
                            ${item.media_type==='video'?`<video src="${item.media_url}" controls style="width:100%;height:100%;object-fit:cover"></video>`:`<img src="${item.media_url}" style="width:100%;height:100%;object-fit:cover">`}
                        </div>
                        <div style="flex:1;min-width:200px">
                            <p><b>@${item.username||'user'}</b> — ${item.is_premium?`<span style="color:gold">⭐ ${item.price_stars} звёзд</span>`:'Бесплатный'}</p>
                            <p style="color:#ccc;font-size:14px">${item.description||'Без описания'}</p>
                            <div style="display:flex;gap:10px;margin-top:10px">
                                <button class="btn btn-primary" onclick="window._approve('${item.id}')">✅ Одобрить</button>
                                <button class="btn btn-secondary" onclick="window._reject('${item.id}')">❌ Отклонить</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
        }
    } else if (tab === 'users') {
        html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #333"><th style="padding:10px;text-align:left">Пользователь</th><th style="padding:10px">Баланс</th><th style="padding:10px">Дата регистрации</th><th style="padding:10px">Действия</th></tr>';
        users.forEach(u => {
            html += `<tr style="border-bottom:1px solid #222">
                <td style="padding:10px"><b>@${u.username||'user'}</b><br><small style="color:#888">${u.id?.substring(0,8)}...</small></td>
                <td style="padding:10px;text-align:center">⭐ ${u.stars_balance||0}</td>
                <td style="padding:10px;text-align:center;font-size:12px;color:#888">${new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                <td style="padding:10px;text-align:center">
                    <button class="btn btn-secondary" style="margin:2px;font-size:12px" onclick="window._editStars('${u.id}',${u.stars_balance||0})">⭐ Изменить</button>
                    <button class="btn btn-secondary" style="margin:2px;font-size:12px" onclick="window._editUser('${u.id}','${u.username||''}')">✏️ Ник</button>
                </td>
            </tr>`;
        });
        html += '</table></div>';
    } else if (tab === 'history') {
        if (history.length === 0) {
            html += '<p style="color:#888;text-align:center;padding:40px">История пуста</p>';
        } else {
            history.forEach(item => {
                const statusColor = item.status==='approved'?'#0f0':item.status==='rejected'?'#f00':'#888';
                const statusText = item.status==='approved'?'Одобрен':item.status==='rejected'?'Отклонён':'Ожидает';
                const statusIcon = item.status==='approved'?'✅':item.status==='rejected'?'❌':'⏳';
                html += `<div style="background:#111;border-radius:10px;padding:10px;margin-bottom:10px;border-left:3px solid ${statusColor}">
                    <b>@${item.username||'user'}</b> — ${statusIcon} ${statusText}
                    <span style="color:#888;font-size:12px;float:right">${new Date(item.created_at).toLocaleString('ru-RU')}</span>
                    <p style="font-size:12px;color:#888;margin-top:5px">${item.description?.substring(0,80)||'Без описания'}</p>
                </div>`;
            });
        }
    }

    html += '</div>';
    adminApp.innerHTML = html;
}

window._adminTab = (tab) => renderAdminPanel(tab);

window._approve = async (id) => {
    await supabase.approveContent(id);
    supabase.toast('✅ Контент одобрен!');
    renderAdminPanel('moderation');
};

window._reject = async (id) => {
    if (confirm('Отклонить этот контент?')) {
        await supabase.rejectContent(id);
        supabase.toast('❌ Контент отклонён');
        renderAdminPanel('moderation');
    }
};

window._editStars = async (uid, current) => {
    const amount = prompt('Новый баланс звёзд:', current);
    if (amount === null) return;
    const newAmount = parseInt(amount);
    if (isNaN(newAmount)) return;
    await supabase.updateUser(uid, { stars_balance: newAmount });
    supabase.toast('✅ Баланс обновлён!');
    renderAdminPanel('users');
};

window._editUser = async (uid, currentName) {
    const name = prompt('Новый никнейм:', currentName);
    if (!name || name.length < 3) return;
    await supabase.updateUser(uid, { username: name });
    supabase.toast('✅ Никнейм обновлён!');
    renderAdminPanel('users');
};
