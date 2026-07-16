const SUPABASE_URL = 'https://aywfviexlltujeoaqeaq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y';
const REDIRECT_URL = 'https://vds-game.ink';

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
    return request('artworks?is_published=eq.true&select=*,users(username,avatar_url)&order=created_at.desc&limit=50');
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

async function updateUserProfile(userId, data) {
    return request(`users?id=eq.${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
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

async function updateArtwork(artworkId, data) {
    return request(`artworks?id=eq.${artworkId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
    });
}

async function deleteArtwork(artworkId) {
    return request(`artworks?id=eq.${artworkId}`, {
        method: 'DELETE'
    });
}

async function publishArtwork(artworkId) {
    return request(`artworks?id=eq.${artworkId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: true, stars_spent: 50 })
    });
}

async function getUserArtworks(userId) {
    return request(`artworks?user_id=eq.${userId}&order=created_at.desc`);
}

// Likes
async function likeArtwork(userId, artworkId) {
    const existing = await request(`likes?user_id=eq.${userId}&artwork_id=eq.${artworkId}`);
    
    if (existing.length > 0) return null;
    
    await request('likes', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, artwork_id: artworkId })
    });
    
    const artwork = await getArtwork(artworkId);
    if (artwork) {
        await request(`artworks?id=eq.${artworkId}`, {
            method: 'PATCH',
            body: JSON.stringify({ likes_count: (artwork.likes_count || 0) + 1 })
        });
    }
    
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
    
    const existing = await request(`star_claims?user_id=eq.${userId}&claim_type=eq.daily&claimed_at=gte.${today.toISOString()}`);
    
    if (existing.length > 0) return null;
    
    await updateUserBalance(userId, 1);
    
    await request('star_claims', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, claim_type: 'daily', stars_claimed: 1 })
    });
    
    return true;
}

async function claimViewStar(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const views = await getTodayViews(userId);
    
    if (views < 5) return { success: false, message: `Нужно 5 просмотров, сейчас ${views}` };
    
    const existing = await request(`star_claims?user_id=eq.${userId}&claim_type=eq.views&claimed_at=gte.${today.toISOString()}`);
    
    if (existing.length > 0) return { success: false, message: 'Уже получена звезда за просмотры сегодня' };
    
    await updateUserBalance(userId, 1);
    
    await request('star_claims', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, claim_type: 'views', stars_claimed: 1 })
    });
    
    return { success: true, message: 'Звезда получена!' };
}

// Winner
async function getLastWinner() {
    const data = await request('auction_winners?select=*,users(username,avatar_url)&order=won_at.desc&limit=1');
    return data[0] || null;
}

// Admin functions
async function isAdmin(userId) {
    const data = await request(`admins?user_id=eq.${userId}&select=*`);
    return data.length > 0;
}

async function getAllUsers() {
    return request('users?select=*&order=created_at.desc');
}

export {
    signInWithGoogle,
    checkAuth,
    getUser,
    getFeed,
    getArtwork,
    getCurrentBank,
    getUserProfile,
    updateUserProfile,
    updateUserBalance,
    saveArtwork,
    updateArtwork,
    deleteArtwork,
    publishArtwork,
    getUserArtworks,
    likeArtwork,
    recordView,
    getTodayViews,
    claimDailyStar,
    claimViewStar,
    getLastWinner,
    isAdmin,
    getAllUsers
};

// Добавьте эти функции перед export в конце файла:

// Ad functions
async function recordAdView(userId) {
    try {
        await request('ad_views', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId })
        });
        return true;
    } catch {
        return false;
    }
}

async function getTodayAdViews(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    const data = await request(`ad_views?user_id=eq.${userId}&viewed_at=gte.${todayISO}&select=count`);
    return data[0]?.count || 0;
}

async function claimAdStar(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const adViews = await getTodayAdViews(userId);
    
    if (adViews < 5) return { success: false, message: `Нужно 5 просмотров рекламы, сейчас ${adViews}` };
    
    // Проверяем, не получал ли уже звезду за рекламу сегодня
    const existing = await request(`star_claims?user_id=eq.${userId}&claim_type=eq.ads&claimed_at=gte.${today.toISOString()}`);
    
    if (existing.length > 0) return { success: false, message: 'Уже получена звезда за рекламу сегодня' };
    
    await updateUserBalance(userId, 1);
    
    await request('star_claims', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, claim_type: 'ads', stars_claimed: 1 })
    });
    
    return { success: true, message: 'Звезда за рекламу получена!' };
}

// Добавьте в export:
export {
    // ... все существующие экспорты ...
    recordAdView,
    getTodayAdViews,
    claimAdStar
};
