const URL = 'https://aywfviexlltujeoaqeaq.supabase.co';
const KEY = 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y';

async function request(endpoint, options = {}) {
    const res = await fetch(`${URL}/rest/v1/${endpoint}`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        ...options
    });
    return res.ok ? res.json() : [];
}

window.supabase = {
    signInWithGoogle() { window.location.href = `${URL}/auth/v1/authorize?provider=google&redirect_to=https://vds-game.ink`; },
    getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } },
    async getFeed() { return request('content?status=eq.approved&select=*,users(username,avatar_url)&order=created_at.desc'); },
    async createContent(d) { return request('content', { method: 'POST', body: JSON.stringify({ ...d, status: 'pending' }) }); },
    async approveContent(id) { return request(`content?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) }); },
    async getUserContent(uid) { return request(`content?user_id=eq.${uid}&order=created_at.desc`); },
    async getUserBalance(uid) { const d = await request(`users?id=eq.${uid}&select=*`); return d[0] || { stars_balance: 0 }; },
    // Остальные методы (likes, comments, etc) оставляем БЕЗ ИЗМЕНЕНИЙ
    async getPendingContent() { return request('content_moderation?status=eq.pending'); },
    async getLikesCount(cid) { return request(`likes?content_id=eq.${cid}&select=count`).then(d=>d[0]?.count||0); },
    async addComment(uid, cid, text) { return request('comments', { method: 'POST', body: JSON.stringify({ user_id: uid, content_id: cid, text }) }); }
};
