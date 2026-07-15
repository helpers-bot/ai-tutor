import { CONFIG } from './config.js';

const URL = CONFIG.supabase.url;
const KEY = CONFIG.supabase.publishableKey;

async function request(endpoint, options = {}) {
    const res = await fetch(`${URL}/rest/v1/${endpoint}`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) throw new Error('Error ' + res.status);
    const text = await res.text();
    return text ? JSON.parse(text) : [];
}

function toast(msg) {
    const existing = document.querySelector('.toast-msg');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'toast-msg';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
}

export const supabase = {
    toast,
    signInWithGoogle() {
        window.location.href = `${URL}/auth/v1/authorize?provider=google&redirect_to=https://vds-game.ink`;
    },
    async getUserProfile() {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const res = await fetch(`${URL}/auth/v1/user`, { headers: { 'apikey': KEY, 'Authorization': `Bearer ${token}` } });
        return res.json();
    },
    async getUserById(uid) { const d = await request(`users?id=eq.${uid}&select=*`); return d[0] || null; },
    async getAllUsers() { return request('users?select=*&order=created_at.desc'); },
    async getUserContent(uid) { return request(`content?user_id=eq.${uid}&order=created_at.desc`); },
    async getModerationStatus(cid) {
        const d = await request(`content_moderation?content_id=eq.${cid}&select=status`);
        return d[0]?.status || 'approved';
    },
    async getViewsCount(cid) {
        const d = await request(`views?content_id=eq.${cid}&select=count`);
        return d[0]?.count || 0;
    },
    async addView(uid, cid) {
        await request('views', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) });
    },
    signOut() { localStorage.clear(); },
    getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } },
    isAuth() { return !!localStorage.getItem('token'); },
    getFeed() { return request('content?select=*,users(username,avatar_url)&order=created_at.desc'); },
    
    async createContent(d) {
        const data = await request('content', { method: 'POST', body: JSON.stringify(d) });
        const user = this.getUser();
        const contentId = Array.isArray(data) ? data[0]?.id : data.id;
        if (contentId) {
            await request('content_moderation', {
                method: 'POST',
                body: JSON.stringify({
                    content_id: contentId,
                    user_id: d.user_id,
                    media_url: d.media_url,
                    media_type: d.media_type,
                    description: d.description || '',
                    is_premium: d.is_premium || false,
                    price_stars: d.price_stars || 0,
                    username: user?.email?.split('@')[0] || 'user',
                    status: 'pending'
                })
            });
        }
        return data;
    },
    
    async getPendingContent() { return request('content_moderation?status=eq.pending&order=created_at.desc'); },
    async getModerationHistory() { return request('content_moderation?order=created_at.desc&limit=50'); },
    
    async approveContent(id) {
        await request(`content_moderation?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
    },
    
    async rejectContent(id) {
        const item = await request(`content_moderation?id=eq.${id}&select=*`);
        if (item[0]) {
            await request(`content_moderation?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
            if (item[0].content_id) {
                await fetch(`${URL}/rest/v1/content?id=eq.${item[0].content_id}`, { method: 'DELETE', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` } });
            }
        }
    },
    
    async deleteContent(cid) {
        await fetch(`${URL}/rest/v1/content?id=eq.${cid}`, { method: 'DELETE', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` } });
    },
    
    async updateUser(uid, data) { return request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify(data) }); },
    
    async isAdmin(uid) {
        const d = await request(`admins?user_id=eq.${uid}&select=id`);
        return d.length > 0;
    },
    
    async getLikesCount(cid) { const d = await request(`likes?content_id=eq.${cid}&select=count`); return d[0]?.count || 0; },
    
    async toggleLike(cid, uid) {
        const ex = await request(`likes?user_id=eq.${uid}&content_id=eq.${cid}`);
        if (ex.length) {
            await fetch(`${URL}/rest/v1/likes?user_id=eq.${uid}&content_id=eq.${cid}`, { method: 'DELETE', headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` } });
        } else {
            await request('likes', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) });
        }
    },
    
    addComment(uid, cid, text) { return request('comments', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid, text }) }); },
    getComments(cid) { return request(`comments?content_id=eq.${cid}&select=*,users(username,avatar_url)&order=created_at.asc`); },
    repost(uid, cid) { return request('reposts', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid }) }); },
    async getUserBalance(uid) { const d = await request(`users?id=eq.${uid}&select=stars_balance,username,avatar_url`); return d[0] || { stars_balance: 0, username: '', avatar_url: '' }; },
    async updateUsername(uid, username) { return request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ username }) }); },
    async updateAvatar(uid, avatar_url) { return request(`users?id=eq.${uid}`, { method: 'PATCH', body: JSON.stringify({ avatar_url }) }); },
    
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
        const d = await request(`content?id=eq.${cid}&select=user_id,is_premium`);
        const item = d[0];
        if (!item || !item.is_premium) return true;
        if (item.user_id === uid) return true;
        const p = await request(`purchases?user_id=eq.${uid}&content_id=eq.${cid}&select=id`);
        return p.length > 0;
    },
    
    async shareContent(item) {
        const url = `https://vds-game.ink?video=${item.id}`;
        if (navigator.share) {
            await navigator.share({ title: 'VDS видео', text: item.description || 'Смотри видео!', url });
        } else {
            await navigator.clipboard.writeText(url);
            toast('🔗 Ссылка скопирована!');
        }
    }
};
