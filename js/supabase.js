import { CONFIG } from './config.js';

const URL = CONFIG.supabase.url;
const KEY = CONFIG.supabase.publishableKey;

async function request(endpoint, options = {}) {
    const res = await fetch(`${URL}/rest/v1/${endpoint}`, {
        headers: {
            'apikey': KEY,
            'Authorization': `Bearer ${KEY}`,
            'Content-Type': 'application/json'
        },
        ...options
    });
    if (!res.ok) throw new Error('Ошибка: ' + res.status);
    return res.json();
}

export const supabase = {
    signInWithGoogle() {
        window.location.href = `${URL}/auth/v1/authorize?provider=google&redirect_to=https://vds-game.ink`;
    },

    async getUserProfile() {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const res = await fetch(`${URL}/auth/v1/user`, {
            headers: { 'apikey': KEY, 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return null;
        return res.json();
    },

    signOut() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },

    getUser() {
        try { return JSON.parse(localStorage.getItem('user')); }
        catch(e) { return null; }
    },

    isAuth() { return !!localStorage.getItem('token'); },

    getFeed() { return request('content?select=*,users(username)&order=created_at.desc'); },

    createContent(d) { return request('content', { method: 'POST', body: JSON.stringify(d) }); },

    async getLikesCount(cid) {
        const d = await request(`likes?content_id=eq.${cid}&select=count`);
        return d[0]?.count || 0;
    },

    async toggleLike(cid, uid) {
        const ex = await request(`likes?user_id=eq.${uid}&content_id=eq.${cid}`);
        if (ex.length) {
            await fetch(`${URL}/rest/v1/likes?user_id=eq.${uid}&content_id=eq.${cid}`, {
                method: 'DELETE',
                headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
            });
        } else {
            await request('likes', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) });
        }
    },

    addComment(uid, cid, text) {
        return request('comments', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid, text }) });
    },

    getComments(cid) {
        return request(`comments?content_id=eq.${cid}&select=*,users(username)&order=created_at.asc`);
    },

    repost(uid, cid) {
        return request('reposts', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) });
    },

    async getUserBalance(uid) {
        const d = await request(`users?id=eq.${uid}&select=stars_balance,username`);
        return d[0] || { stars_balance: 0, username: '' };
    },

    async updateUsername(uid, username) {
        return request(`users?id=eq.${uid}`, {
            method: 'PATCH',
            body: JSON.stringify({ username })
        });
    },

    async buyContent(uid, cid, stars) {
        await request('purchases', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid, stars_spent: stars }) });
        const bal = await this.getUserBalance(uid);
        await request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ stars_balance: bal.stars_balance - stars }) });
    },

    async addStars(uid, amount) {
        const bal = await this.getUserBalance(uid);
        await request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ stars_balance: bal.stars_balance + amount }) });
    },

    async canAccess(cid, uid) {
        const d = await request('rpc/can_access_content', { method: 'POST', body: JSON.stringify({ content_id: cid, user_id: uid }) });
        return d === true || d === 'true';
    }
};
