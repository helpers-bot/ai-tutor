import { supabase } from './supabase.js';

const appEl = document.getElementById('app');

// Проверка
console.log('App started');
console.log('Supabase URL:', 'https://aywfviexlltujeoaqeaq.supabase.co');

// Форма авторизации
appEl.innerHTML = `
<div class="auth-container">
    <h1>TikTok Clone</h1>
    <input type="email" id="email" placeholder="Email" style="width:100%;padding:10px;margin:10px 0;background:#111;border:1px solid #333;border-radius:5px;color:#fff">
    <input type="password" id="password" placeholder="Пароль" style="width:100%;padding:10px;margin:10px 0;background:#111;border:1px solid #333;border-radius:5px;color:#fff">
    <button id="btnReg" style="width:100%;padding:12px;background:#ff0050;color:#fff;border:none;border-radius:5px;cursor:pointer;margin:5px 0">Регистрация</button>
    <button id="btnLogin" style="width:100%;padding:12px;background:#333;color:#fff;border:none;border-radius:5px;cursor:pointer;margin:5px 0">Вход</button>
    <div id="msg"></div>
</div>`;

document.getElementById('btnReg').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    document.getElementById('msg').innerHTML = 'Регистрация...';
    
    try {
        const res = await fetch('https://aywfviexlltujeoaqeaq.supabase.co/auth/v1/signup', {
            method: 'POST',
            headers: {
                'apikey': 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        console.log('Response:', data);
        document.getElementById('msg').innerHTML = JSON.stringify(data);
    } catch (err) {
        document.getElementById('msg').innerHTML = 'Ошибка: ' + err.message;
        console.error(err);
    }
};

document.getElementById('btnLogin').onclick = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    document.getElementById('msg').innerHTML = 'Вход...';
    
    try {
        const res = await fetch('https://aywfviexlltujeoaqeaq.supabase.co/auth/v1/token?grant_type=password', {
            method: 'POST',
            headers: {
                'apikey': 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        console.log('Response:', data);
        document.getElementById('msg').innerHTML = JSON.stringify(data);
    } catch (err) {
        document.getElementById('msg').innerHTML = 'Ошибка: ' + err.message;
        console.error(err);
    }
};
