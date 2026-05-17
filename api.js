// api.js - База данных через Supabase
const SUPABASE_URL = 'https://kmkgqegtulbmdjlmllka.supabase.co';
const SUPABASE_KEY = 'sb_publishable_azFcv95b6rBSnDxU2jYWEA_pO2Z5qTI';

class GameAPI {
    constructor() {
        this.cache = {};
    }

    async _fetch(endpoint, options = {}) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };
        
        if (options.select) {
            headers['Prefer'] = 'return=representation';
        }

        const config = {
            headers: headers,
            ...options
        };

        try {
            const res = await fetch(url, config);
            if (!res.ok) {
                const err = await res.text();
                console.error('API error:', res.status, err);
                return null;
            }
            const text = await res.text();
            if (!text) return [];
            return JSON.parse(text);
        } catch (e) {
            console.error('Fetch error:', e);
            return null;
        }
    }

    generateUID() {
        return String(Math.floor(10000000 + Math.random() * 90000000));
    }

    // ===== ПОЛЬЗОВАТЕЛИ =====
    async findUserByGoogleId(googleId) {
        const data = await this._fetch(`users?google_id=eq.${encodeURIComponent(googleId)}&limit=1`);
        return (data && data.length > 0) ? data[0] : null;
    }

    async findUserByUID(uid) {
        const data = await this._fetch(`users?user_uid=eq.${encodeURIComponent(uid)}&limit=1`);
        return (data && data.length > 0) ? data[0] : null;
    }

    async registerOrLogin(googleProfile) {
        const { googleId, email, name, picture } = googleProfile;
        
        let user = await this.findUserByGoogleId(googleId);
        
        if (user) {
            // Обновляем last_login
            await this._fetch(`users?user_uid=eq.${user.user_uid}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    last_login: new Date().toISOString(),
                    email: email,
                    nickname: user.nickname || name,
                    picture: picture
                })
            });
            
            await this.logOnline(user.user_uid, user.nickname || name, 'login');
            
            return {
                success: true,
                user_uid: user.user_uid,
                nickname: user.nickname || name,
                email: user.email || email,
                picture: user.picture || picture,
                diamonds: user.diamonds || 100,
                treasure_progress: parseFloat(user.treasure_progress) || 0,
                free_spins: user.free_spins || 0,
                jackpot_boost: !!(user.jackpot_boost),
                is_new: false
            };
        }

        // Новый пользователь
        let uid;
        let existing;
        do {
            uid = this.generateUID();
            existing = await this.findUserByUID(uid);
        } while (existing);

        const newUser = {
            user_uid: uid,
            google_id: googleId,
            nickname: name,
            email: email,
            picture: picture,
            diamonds: 100,
            treasure_progress: 0,
            free_spins: 0,
            jackpot_boost: 0,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
            provider: 'google',
            role: 'user',
            history: [],
            support_messages: []
        };

        const result = await this._fetch('users', {
            method: 'POST',
            body: JSON.stringify(newUser)
        });

        if (!result) {
            return { success: false, error: 'Ошибка создания пользователя' };
        }

        await this.logOnline(uid, name, 'login');

        return {
            success: true,
            user_uid: uid,
            nickname: name,
            email: email,
            picture: picture,
            diamonds: 100,
            treasure_progress: 0,
            free_spins: 0,
            jackpot_boost: false,
            is_new: true
        };
    }

    async saveUserData(user_uid, gameData) {
        const result = await this._fetch(`users?user_uid=eq.${encodeURIComponent(user_uid)}`, {
            method: 'PATCH',
            body: JSON.stringify({
                diamonds: gameData.diamonds,
                treasure_progress: gameData.treasure_progress,
                free_spins: gameData.free_spins,
                jackpot_boost: gameData.jackpot_boost ? 1 : 0,
                last_save: new Date().toISOString()
            })
        });
        return !!result;
    }

    async loadUserData(user_uid) {
        const user = await this.findUserByUID(user_uid);
        if (!user) return null;
        return {
            user_uid: user.user_uid,
            nickname: user.nickname,
            email: user.email,
            picture: user.picture,
            diamonds: user.diamonds,
            treasure_progress: parseFloat(user.treasure_progress) || 0,
            free_spins: user.free_spins || 0,
            jackpot_boost: !!(user.jackpot_boost)
        };
    }

    // ===== ДЖЕКПОТЫ =====
    async saveJackpot(user_uid, nickname, mode_key, icon, wish, diamonds_won) {
        return await this._fetch('jackpots', {
            method: 'POST',
            body: JSON.stringify({
                user_uid, nickname, mode_key, icon, wish, diamonds_won,
                created_at: new Date().toISOString()
            })
        });
    }

    async getJackpotsByUser(user_uid) {
        const data = await this._fetch(`jackpots?user_uid=eq.${encodeURIComponent(user_uid)}&order=created_at.desc&limit=50`);
        return data || [];
    }

    async getAllJackpots() {
        const data = await this._fetch('jackpots?order=created_at.desc&limit=100');
        return data || [];
    }

    // ===== ОНЛАЙН =====
    async logOnline(user_uid, nickname, action) {
        return await this._fetch('online_logs', {
            method: 'POST',
            body: JSON.stringify({
                user_uid, nickname, action,
                created_at: new Date().toISOString()
            })
        });
    }

    async logOut(user_uid, nickname) {
        return await this.logOnline(user_uid, nickname, 'logout');
    }

    async getOnlineStats() {
        const now = new Date();
        const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const [recentLogs, todayLogs] = await Promise.all([
            this._fetch(`online_logs?created_at=gte.${fifteenMinAgo}&action=eq.login&select=user_uid`),
            this._fetch(`online_logs?created_at=gte.${todayStart}&action=eq.login&select=user_uid`)
        ]);

        const onlineNow = new Set((recentLogs || []).map(l => l.user_uid));
        const onlineToday = new Set((todayLogs || []).map(l => l.user_uid));

        return {
            online_now: onlineNow.size,
            online_today: onlineToday.size
        };
    }

    // ===== ПОЛЬЗОВАТЕЛИ ДЛЯ АДМИНКИ =====
    async getAllUsers() {
        const data = await this._fetch('users?order=created_at.desc&limit=100');
        return data || [];
    }

    async searchUsers(query) {
        const data = await this._fetch(`users?or=(user_uid.ilike.*${encodeURIComponent(query)}*,nickname.ilike.*${encodeURIComponent(query)}*,email.ilike.*${encodeURIComponent(query)}*)&limit=50`);
        return data || [];
    }

    async addDiamonds(user_uid, amount, adminName) {
        const user = await this.findUserByUID(user_uid);
        if (!user) return { success: false, error: 'Пользователь не найден' };
        
        const newBalance = (user.diamonds || 0) + amount;
        await this._fetch(`users?user_uid=eq.${encodeURIComponent(user_uid)}`, {
            method: 'PATCH',
            body: JSON.stringify({ diamonds: newBalance })
        });
        
        await this._saveTransaction(user_uid, user.nickname || user.email, amount, 'add', 'Начисление админом', adminName);
        return { success: true, new_balance: newBalance };
    }

    async removeDiamonds(user_uid, amount, adminName) {
        const user = await this.findUserByUID(user_uid);
        if (!user) return { success: false, error: 'Пользователь не найден' };
        
        const newBalance = Math.max(0, (user.diamonds || 0) - amount);
        await this._fetch(`users?user_uid=eq.${encodeURIComponent(user_uid)}`, {
            method: 'PATCH',
            body: JSON.stringify({ diamonds: newBalance })
        });
        
        await this._saveTransaction(user_uid, user.nickname || user.email, amount, 'remove', 'Списание админом', adminName);
        return { success: true, new_balance: newBalance };
    }

    async _saveTransaction(user_uid, nickname, amount, type, reason, admin_username) {
        return await this._fetch('transactions', {
            method: 'POST',
            body: JSON.stringify({
                user_uid, nickname, amount, type, reason, admin_username,
                created_at: new Date().toISOString()
            })
        });
    }

    async getTransactions() {
        const data = await this._fetch('transactions?order=created_at.desc&limit=100');
        return data || [];
    }

    async getSpentByMode() {
        const data = await this._fetch('jackpots?select=mode_key,diamonds_won');
        if (!data) return {};
        const spent = {};
        data.forEach(j => {
            if (!spent[j.mode_key]) spent[j.mode_key] = 0;
            spent[j.mode_key] += (j.diamonds_won || 0);
        });
        return spent;
    }

    // ===== ЧАТЫ ПОДДЕРЖКИ =====
    async getSupportChats() {
        const data = await this._fetch('support_chats?order=updated_at.desc&limit=50');
        if (!data) return {};
        const chats = {};
        data.forEach(chat => {
            chats[chat.user_uid] = {
                messages: chat.messages || [],
                userName: chat.user_name || ''
            };
        });
        return chats;
    }

    async saveSupportChats(chats) {
        for (const [uid, chat] of Object.entries(chats)) {
            const existing = await this._fetch(`support_chats?user_uid=eq.${encodeURIComponent(uid)}&limit=1`);
            
            if (existing && existing.length > 0) {
                await this._fetch(`support_chats?user_uid=eq.${encodeURIComponent(uid)}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                        messages: chat.messages,
                        user_name: chat.userName,
                        updated_at: new Date().toISOString()
                    })
                });
            } else {
                await this._fetch('support_chats', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_uid: uid,
                        user_name: chat.userName,
                        messages: chat.messages,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                });
            }
        }
        return true;
    }
}

const API = new GameAPI();
