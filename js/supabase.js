import { CONFIG } from './config.js';

const URL = CONFIG.supabase.url;
const KEY = CONFIG.supabase.publishableKey;

function headers() {
    const h = { 'apikey': KEY, 'Content-Type': 'application/json' };
    const token = localStorage.getItem('auth_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

async function request(endpoint, options = {}) {
    const res = await fetch(`${URL}/rest/v1/${endpoint}`, { headers: headers(), ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error ' + res.status);
    }
    return res.json();
}

export const supabase = {
    async signUp(email, password, username) {
        const res = await fetch(`${URL}/auth/v1/signup`, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.user) {
            localStorage.setItem('auth_token', data.access_token || '');
            localStorage.setItem('user', JSON.stringify(data.user));
            try {
                await request('users', {
                    method: 'POST',
                    body: JSON.stringify({ id: data.user.id, username: username || email.split('@')[0], stars_balance: 0 })
                });
            } catch (e) {
                console.log('User already exists in users table');
            }
        }
        if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Signup failed');
        return data;
    },
    
    async signIn(email, password) {
        const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.access_token) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        if (!res.ok) throw new Error((await res.json().catch(()=>({}))).message || 'Login failed');
        return data;
    },
    
    async signOut() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    },
    
    getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    },
    
    isAuth() { return !!localStorage.getItem('auth_token'); },
    
    getFeed() { return request('content?select=*,users(username)&order=created_at.desc'); },
    
    createContent(data) { return request('content', { method: 'POST', body: JSON.stringify(data) }); },
    
    async toggleLike(cid, uid) {
        const ex = await request(`likes?user_id=eq.${uid}&content_id=eq.${cid}`);
        if (ex.length > 0) {
            await fetch(`${URL}/rest/v1/likes?user_id=eq.${uid}&content_id=eq.${cid}`, { method: 'DELETE', headers: headers() });
            return false;
        } else {
            await request('likes', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) });
            return true;
        }
    },
    
    async getLikesCount(cid) {
        const d = await request(`likes?content_id=eq.${cid}&select=count`);
        return d[0]?.count || 0;
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
