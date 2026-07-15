import { supabase } from '/js/supabase.js';

const ADMIN_PASSWORD = '135710Aa!';
const adminApp = document.getElementById('adminApp');

if (sessionStorage.getItem('admin_auth') === 'true') {
    renderAdminPanel();
} else {
    showLoginForm();
}

function showLoginForm() {
    adminApp.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;text-align:center;background:#000"><div style="font-size:60px;margin-bottom:20px">🔐</div><h1 style="color:#ff0050;margin-bottom:10px">VDS</h1><p style="color:#888;margin-bottom:30px">Админ-панель</p><input type="password" id="adminPass" placeholder="Введите пароль" style="width:100%;max-width:300px;padding:14px;background:#111;border:1px solid #333;border-radius:10px;color:#fff;font-size:16px;text-align:center;margin-bottom:20px"><button id="adminLoginBtn" style="width:100%;max-width:300px;padding:14px;background:#ff0050;color:#fff;border:none;border-radius:10px;cursor:pointer;font-size:16px;font-weight:bold">Войти</button><p id="adminError" style="color:#f44;margin-top:15px;display:none">Неверный пароль</p><a href="/" style="color:#888;margin-top:30px;text-decoration:none">← На сайт</a></div>';
    document.getElementById('adminLoginBtn').onclick = function() {
        if (document.getElementById('adminPass').value === ADMIN_PASSWORD) {
            sessionStorage.setItem('admin_auth', 'true');
            renderAdminPanel();
        } else {
            document.getElementById('adminError').style.display = 'block';
        }
    };
}

async function renderAdminPanel(tab) {
    tab = tab || 'moderation';
    var users = [], pending = [], history = [];
    try { users = await supabase.getAllUsers(); } catch(e) {}
    try { pending = await supabase.getPendingContent(); } catch(e) {}
    try { history = await supabase.getModerationHistory(); } catch(e) {}

    var html = '<div style="max-width:900px;margin:0 auto;padding:20px;color:#fff"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h1 style="color:#ff0050">⚙️ Админ-панель</h1><div><a href="/" class="btn btn-secondary" style="text-decoration:none;margin-right:10px">🏠 На сайт</a><button class="btn btn-secondary" id="logoutAdmin">🚪 Выйти</button></div></div><div style="display:flex;gap:10px;margin:20px 0;flex-wrap:wrap"><button class="btn '+(tab==='moderation'?'btn-primary':'btn-secondary')+'" id="tabModeration">📋 Модерация ('+pending.length+')</button><button class="btn '+(tab==='users'?'btn-primary':'btn-secondary')+'" id="tabUsers">👥 Пользователи ('+users.length+')</button><button class="btn '+(tab==='history'?'btn-primary':'btn-secondary')+'" id="tabHistory">📜 История</button></div>';

    if (tab === 'moderation') {
        if (!pending.length) html += '<p style="color:#888;text-align:center;padding:40px">Нет контента на проверку</p>';
        else pending.forEach(function(item) {
            html += '<div style="background:#111;border-radius:15px;padding:15px;margin-bottom:15px;border:1px solid #222"><div style="display:flex;gap:15px;align-items:start;flex-wrap:wrap"><div style="width:120px;height:180px;background:#000;border-radius:10px;overflow:hidden;flex-shrink:0">'+(item.media_type==='video'?'<video src="'+item.media_url+'" controls style="width:100%;height:100%;object-fit:cover"></video>':'<img src="'+item.media_url+'" style="width:100%;height:100%;object-fit:cover">')+'</div><div style="flex:1;min-width:200px"><p><b>@'+(item.username||'user')+'</b> '+(item.is_premium?'<span style="color:gold">⭐ '+item.price_stars+' звёзд</span>':'Бесплатный')+'</p><p style="color:#ccc;font-size:14px">'+(item.description||'Без описания')+'</p><div style="display:flex;gap:10px;margin-top:10px"><button class="btn btn-primary" data-approve="'+item.id+'">✅ Одобрить</button><button class="btn btn-secondary" data-reject="'+item.id+'">❌ Отклонить</button></div></div></div></div>';
        });
    } else if (tab === 'users') {
        html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><tr style="border-bottom:1px solid #333"><th style="padding:10px;text-align:left">Пользователь</th><th style="padding:10px">Баланс</th><th style="padding:10px">Дата</th><th style="padding:10px">Действия</th></tr>';
        users.forEach(function(u) {
            html += '<tr style="border-bottom:1px solid #222"><td style="padding:10px"><b>@'+(u.username||'user')+'</b><br><small style="color:#888">'+(u.id||'').substring(0,8)+'...</small></td><td style="padding:10px;text-align:center">⭐ '+(u.stars_balance||0)+'</td><td style="padding:10px;text-align:center;font-size:12px;color:#888">'+new Date(u.created_at).toLocaleDateString('ru-RU')+'</td><td style="padding:10px;text-align:center"><button class="btn btn-secondary" data-stars="'+u.id+'" data-bal="'+(u.stars_balance||0)+'" style="margin:2px;font-size:12px">⭐</button><button class="btn btn-secondary" data-name="'+u.id+'" data-cur="'+(u.username||'')+'" style="margin:2px;font-size:12px">✏️</button></td></tr>';
        });
        html += '</table></div>';
    } else if (tab === 'history') {
        if (!history.length) html += '<p style="color:#888;text-align:center;padding:40px">История пуста</p>';
        else history.forEach(function(item) {
            var c = item.status==='approved'?'#0f0':item.status==='rejected'?'#f00':'#888';
            var t = item.status==='approved'?'Одобрен':item.status==='rejected'?'Отклонён':'Ожидает';
            html += '<div style="background:#111;border-radius:10px;padding:10px;margin-bottom:10px;border-left:3px solid '+c+'"><b>@'+(item.username||'user')+'</b> — '+t+' <span style="color:#888;font-size:12px;float:right">'+new Date(item.created_at).toLocaleString('ru-RU')+'</span></div>';
        });
    }
    html += '</div>';
    adminApp.innerHTML = html;

    document.getElementById('logoutAdmin').onclick = function() { sessionStorage.removeItem('admin_auth'); location.reload(); };
    document.getElementById('tabModeration').onclick = function() { renderAdminPanel('moderation'); };
    document.getElementById('tabUsers').onclick = function() { renderAdminPanel('users'); };
    document.getElementById('tabHistory').onclick = function() { renderAdminPanel('history'); };

    var approveBtns = document.querySelectorAll('[data-approve]');
    for (var i = 0; i < approveBtns.length; i++) {
        approveBtns[i].onclick = function() {
            var id = this.getAttribute('data-approve');
            supabase.approveContent(id).then(function() {
                supabase.toast('✅ Одобрено!');
                renderAdminPanel('moderation');
            });
        };
    }

    var rejectBtns = document.querySelectorAll('[data-reject]');
    for (var i = 0; i < rejectBtns.length; i++) {
        rejectBtns[i].onclick = function() {
            var id = this.getAttribute('data-reject');
            if (confirm('Отклонить?')) {
                supabase.rejectContent(id).then(function() {
                    supabase.toast('❌ Отклонено');
                    renderAdminPanel('moderation');
                });
            }
        };
    }

    var starsBtns = document.querySelectorAll('[data-stars]');
    for (var i = 0; i < starsBtns.length; i++) {
        starsBtns[i].onclick = function() {
            var uid = this.getAttribute('data-stars');
            var bal = this.getAttribute('data-bal');
            var a = prompt('Новый баланс:', bal);
            if (a !== null) {
                supabase.updateUser(uid, { stars_balance: parseInt(a) }).then(function() {
                    supabase.toast('✅ Готово!');
                    renderAdminPanel('users');
                });
            }
        };
    }

    var nameBtns = document.querySelectorAll('[data-name]');
    for (var i = 0; i < nameBtns.length; i++) {
        nameBtns[i].onclick = function() {
            var uid = this.getAttribute('data-name');
            var cur = this.getAttribute('data-cur');
            var n = prompt('Новый ник:', cur);
            if (n && n.length >= 3) {
                supabase.updateUser(uid, { username: n }).then(function() {
                    supabase.toast('✅ Готово!');
                    renderAdminPanel('users');
                });
            }
        };
    }
}
