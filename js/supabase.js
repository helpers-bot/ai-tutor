import { SUPABASE_URL, SUPABASE_KEY, REDIRECT_URL } from './config.js';

async function request(endpoint, options = {}) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            ...options
        });
        
        if (!res.ok) {
            console.error('API Error:', await res.text());
            return [];
        }
        
        return await res.json();
    } catch (error) {
        console.error('Request error:', error);
        return [];
    }
}

// Auth functions
async function signInWithGoogle() {
    window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${REDIRECT_URL}`;
}

function getUser() {
    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
}

async function checkAuth() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            localStorage.setItem('user', JSON.stringify({ ...user, access_token: accessToken }));
            window.location.hash = '';
            return user;
        }
    }
    
    return getUser();
}

// Feed functions
async function getFeed() {
    return request('artworks?is_published=eq.true&is_auction_cancelled=eq.false&select=*,users(username,avatar_url)&order=created_at.desc&limit=50');
}

async function getArtwork(id) {
    const data = await request(`artworks?id=eq.${id}&select=*,users(username,avatar_url)`);
    return data[0] || null;
}

// Bank functions
async function getCurrentBank() {
    const data = await request('rpc/get_current_bank');
    return data?.[0]?.get_current_bank || 0;
}

// User functions
async function getUserProfile(userId) {
    const data = await request(`users?id=eq.${userId}&select=*`);
    return data[0] || null;
}

async function updateUserBalance(userId, amount) {
    const profile = await getUserProfile(userId);
    if (!profile) return false;
    
    await request(`users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stars_balance: profile.stars_balance + amount })
    });
    
    return true;
}

// Artwork functions
async function saveArtwork(data) {
    return request('artworks', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function publishArtwork(artworkId) {
    return request(`artworks?id=eq.${artworkId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: true, stars_spent: 50 })
    });
}

async function cancelAuction(artworkId) {
    return request(`artworks?id=eq.${artworkId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_auction_cancelled: true, is_published: false })
    });
}

async function getUserArtworks(userId) {
    return request(`artworks?user_id=eq.${userId}&order=created_at.desc`);
}

// Likes
async function likeArtwork(userId, artworkId) {
    const existing = await request(`likes?user_id=eq.${userId}&artwork_id=eq.${artworkId}`);
    
    if (existing.length > 0) return null;
    
    // Создаем лайк
    await request('likes', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, artwork_id: artworkId })
    });
    
    // Обновляем счетчик
    const artwork = await getArtwork(artworkId);
    if (artwork) {
        await request(`artworks?id=eq.${artworkId}`, {
            method: 'PATCH',
            body: JSON.stringify({ likes_count: (artwork.likes_count || 0) + 1 })
        });
    }
    
    // Записываем покупку
    await request('purchases', {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            artwork_id: artworkId,
            stars_spent: 1,
            purchase_type: 'like'
        })
    });
    
    return true;
}

// Views
async function recordView(userId, artworkId) {
    try {
        await request('view_rewards', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, artwork_id: artworkId })
        });
        
        // Обновляем счетчик просмотров
        const artwork = await getArtwork(artworkId);
        if (artwork) {
            await request(`artworks?id=eq.${artworkId}`, {
                method: 'PATCH',
                body: JSON.stringify({ views_count: (artwork.views_count || 0) + 1 })
            });
        }
        
        return true;
    } catch {
        return false;
    }
}

async function getUserViewCount(userId) {
    const data = await request(`view_rewards?user_id=eq.${userId}&select=count`);
    return data[0]?.count || 0;
}

async function getTodayViews(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    const data = await request(`view_rewards?user_id=eq.${userId}&viewed_at=gte.${todayISO}&select=count`);
    return data[0]?.count || 0;
}

// Stars
async function claimDailyStar(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existing = await request(`star_claims?user_id=eq.${userId}&claimed_at=gte.${today.toISOString()}`);
    
    if (existing.length > 0) return null;
    
    await updateUserBalance(userId, 1);
    
    await request('star_claims', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, stars_claimed: 1 })
    });
    
    return true;
}

// Winner
async function getLastWinner() {
    const data = await request('auction_winners?select=*,users(username,avatar_url)&order=won_at.desc&limit=1');
    return data[0] || null;
}

async function determineWinner() {
    return request('rpc/determine_weekly_winner');
}

export {
    signInWithGoogle,
    checkAuth,
    getUser,
    getFeed,
    getArtwork,
    getCurrentBank,
    getUserProfile,
    updateUserBalance,
    saveArtwork,
    publishArtwork,
    cancelAuction,
    getUserArtworks,
    likeArtwork,
    recordView,
    getUserViewCount,
    getTodayViews,
    claimDailyStar,
    getLastWinner,
    determineWinner
};
