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

async function getFeed() {
    return request('artworks?is_published=eq.true&select=*,users(username,avatar_url)&order=created_at.desc&limit=50');
}

async function getArtwork(id) {
    const data = await request(`artworks?id=eq.${id}&select=*,users(username,avatar_url)`);
    return data[0] || null;
}

async function getCurrentBank() {
    const data = await request('rpc/get_current_bank');
    return data?.[0]?.get_current_bank || 0;
}

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

async function getLastWinner() {
    const data = await request('auction_winners?select=*,users(username,avatar_url)&order=won_at.desc&limit=1');
    return data[0] || null;
}

async function isAdmin(userId) {
    const data = await request(`admins?user_id=eq.${userId}&select=*`);
    return data.length > 0;
}

async function getAllUsers() {
    return request('users?select=*&order=created_at.desc');
}

// Таймер бонус
async function claimTimerBonus(userId) {
    await updateUserBalance(userId, 1);
    
    await request('star_claims', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, claim_type: 'timer', stars_claimed: 1 })
    });
    
    return true;
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
    claimDailyStar,
    getLastWinner,
    isAdmin,
    getAllUsers,
    claimTimerBonus
};
// Добавьте в существующий файл перед export:

// Timer functions
async function saveTimerState(userId, seconds) {
    const existing = await request(`user_timers?user_id=eq.${userId}`);
    
    if (existing.length > 0) {
        return request(`user_timers?user_id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ 
                timer_seconds: seconds,
                last_updated: new Date().toISOString()
            })
        });
    } else {
        return request('user_timers', {
            method: 'POST',
            body: JSON.stringify({ 
                user_id: userId,
                timer_seconds: seconds,
                last_updated: new Date().toISOString()
            })
        });
    }
}

async function getTimerState(userId) {
    const data = await request(`user_timers?user_id=eq.${userId}`);
    
    if (data.length > 0) {
        const saved = data[0];
        const savedTime = new Date(saved.last_updated).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - savedTime) / 1000);
        const remainingSeconds = Math.max(0, saved.timer_seconds - elapsedSeconds);
        
        return {
            timer_seconds: remainingSeconds,
            last_updated: saved.last_updated
        };
    }
    
    return { timer_seconds: 1800, last_updated: new Date().toISOString() };
}

// Добавьте в export:
export {
    // ... все существующие экспорты ...
    saveTimerState,
    getTimerState
};
