import { CONFIG } from './config.js';

const URL = CONFIG.supabase.url;
const KEY = CONFIG.supabase.publishableKey;

function headers() {
    const h = { 'apikey': KEY, 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

async function request(endpoint, options = {}) {
    const res = await fetch(`${URL}/rest/v1/${endpoint}`, { headers: headers(), ...options });
    if (!res.ok) throw new Error('Ошибка сервера');
    return res.json();
}

export const supabase = {
    signInWithGoogle() {
        window.location.href = `${URL}/auth/v1/authorize?provider=google&redirect_to=https://vds-game.ink`;
    },

    async signUp(email, password, username) {
        const res = await fetch(`${URL}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.status === 429) throw new Error('Слишком много попыток. Подождите немного.');
        if (!res.ok) throw new Error(data.msg || data.message || 'Ошибка регистрации');
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },
    
    async signIn(email, password) {
        const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (res.status === 429) throw new Error('Слишком много попыток. Подождите немного.');
        if (!res.ok) throw new Error('Неверный email или пароль');
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    },
    
    signOut() { 
        localStorage.removeItem('token'); 
        localStorage.removeItem('user'); 
    },
    
    getUser() { 
        const u = localStorage.getItem('user');
        if (!u || u === 'undefined' || u === 'null') return null;
        try { return JSON.parse(u); } 
        catch(e) { return null; }
    },
    
    isAuth() { 
        const t = localStorage.getItem('token');
        const u = this.getUser();
        return !!(t && u);
    },
    
    getFeed() { return request('content?select=*,users(username)&order=created_at.desc'); },
    createContent(d) { return request('content', { method: 'POST', body: JSON.stringify(d) }); },
    
    async getLikesCount(cid) {
        const d = await request(`likes?content_id=eq.${cid}&select=count`);
        return d[0]?.count || 0;
    },
    
    async toggleLike(cid, uid) {
        const ex = await request(`likes?user_id=eq.${uid}&content_id=eq.${cid}`);
        if (ex.length) await fetch(`${URL}/rest/v1/likes?user_id=eq.${uid}&content_id=eq.${cid}`, { method: 'DELETE', headers: headers() });
        else await request('likes', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) });
    },
    
    addComment(uid, cid, text) { return request('comments', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid, text }) }); },
    getComments(cid) { return request(`comments?content_id=eq.${cid}&select=*,users(username)&order=created_at.asc`); },
    repost(uid, cid) { return request('reposts', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) }); },
    
    async getUserBalance(uid) {
        const d = await request(`users?id=eq.${uid}&select=stars_balance`);
        return d[0]?.stars_balance || 0;
    },
    
    async buyContent(uid, cid, stars) {
        await request('purchases', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid, stars_spent: stars }) });
        const bal = await this.getUserBalance(uid);
        await request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ stars_balance: bal - stars }) });
    },
    
    async addStars(uid, amount) {
        const bal = await this.getUserBalance(uid);
        await request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ stars_balance: bal + amount }) });
    },
    
    async canAccess(cid, uid) {
        const d = await request('rpc/can_access_content', { method: 'POST', body: JSON.stringify({ content_id: cid, user_id: uid }) });
        return d === true || d === 'true';
    }
};
