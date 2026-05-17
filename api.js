// api.js - База данных через JSON файлы на GitHub
const DB_CONFIG = {
    username: 'helpers-bot',
    repo: 'ai-gdz',
    branch: 'main',
    dataPath: 'data'
};

class GameAPI {
    constructor() {
        this.cache = {};
        this.baseURL = `https://api.github.com/repos/${DB_CONFIG.username}/${DB_CONFIG.repo}/contents/${DB_CONFIG.dataPath}`;
    }

    async _fetchJSON(path) {
        const url = `https://raw.githubusercontent.com/${DB_CONFIG.username}/${DB_CONFIG.repo}/${DB_CONFIG.branch}/${DB_CONFIG.dataPath}/${path}`;
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('Fetch error:', e);
            return null;
        }
    }

    async _saveJSON(path, data, sha = null) {
        const url = `https://api.github.com/repos/${DB_CONFIG.username}/${DB_CONFIG.repo}/contents/${DB_CONFIG.dataPath}/${path}`;
        const body = {
            message: `Update ${path}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
            branch: DB_CONFIG.branch
        };
        if (sha) body.sha = sha;
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('vds_github_token') || ''}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const err = await res.json();
                console.error('Save error:', err);
                return false;
            }
            const result = await res.json();
            return result.content?.sha || true;
        } catch (e) {
            console.error('Save error:', e);
            return false;
        }
    }

    async _getSHA(path) {
        const url = `https://api.github.com/repos/${DB_CONFIG.username}/${DB_CONFIG.repo}/contents/${DB_CONFIG.dataPath}/${path}`;
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('vds_github_token') || ''}` }
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.sha;
        } catch (e) { return null; }
    }

    generateUID() {
        let uid;
        do { uid = String(Math.floor(10000000 + Math.random() * 90000000)); }
        while (this._usedUIDs && this._usedUIDs.has(uid));
        return uid;
    }

    async getUsers() {
        const data = await this._fetchJSON('users.json');
        if (!data || !data.users) return { users: [], _sha: null };
        return data;
    }

    async findUserByGoogleId(googleId) {
        const data = await this.getUsers();
        return data.users.find(u => u.google_id === googleId) || null;
    }

    async findUserByUID(uid) {
        const data = await this.getUsers();
        return data.users.find(u => u.user_uid === uid) || null;
    }

    async registerOrLogin(googleProfile) {
        const { googleId, email, name, picture } = googleProfile;
        let data = await this.getUsers();
        let user = data.users.find(u => u.google_id === googleId);
        
        if (user) {
            user.last_login = new Date().toISOString();
            user.email = email;
            user.name = name;
            user.picture = picture;
            await this._saveJSON('users.json', data, await this._getSHA('users.json'));
            await this.logOnline(user.user_uid, user.nickname || name, 'login');
            return {
                success: true,
                user_uid: user.user_uid,
                nickname: user.nickname || name,
                email: user.email,
                picture: user.picture,
                diamonds: user.diamonds || 100,
                treasure_progress: user.treasure_progress || 0,
                free_spins: user.free_spins || 0,
                jackpot_boost: !!(user.jackpot_boost),
                is_new: false
            };
        }

        let uid;
        do { uid = this.generateUID(); }
        while (data.users.find(u => u.user_uid === uid));

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
            last_login: new Date().toISOString()
        };

        data.users.push(newUser);
        await this._saveJSON('users.json', data, await this._getSHA('users.json'));
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
        let data = await this.getUsers();
        let user = data.users.find(u => u.user_uid === user_uid);
        if (!user) return false;
        user.diamonds = gameData.diamonds;
        user.treasure_progress = gameData.treasure_progress;
        user.free_spins = gameData.free_spins;
        user.jackpot_boost = gameData.jackpot_boost ? 1 : 0;
        user.last_save = new Date().toISOString();
        return await this._saveJSON('users.json', data, await this._getSHA('users.json'));
    }

    async loadUserData(user_uid) {
        let data = await this.getUsers();
        let user = data.users.find(u => u.user_uid === user_uid);
        if (!user) return null;
        return {
            user_uid: user.user_uid,
            nickname: user.nickname,
            email: user.email,
            picture: user.picture,
            diamonds: user.diamonds,
            treasure_progress: user.treasure_progress,
            free_spins: user.free_spins,
            jackpot_boost: !!(user.jackpot_boost)
        };
    }

    async saveJackpot(user_uid, nickname, mode_key, icon, wish, diamonds_won) {
        let data = await this._fetchJSON('jackpots.json');
        if (!data) data = { jackpots: [] };
        data.jackpots.unshift({
            user_uid, nickname, mode_key, icon, wish, diamonds_won,
            created_at: new Date().toISOString()
        });
        if (data.jackpots.length > 200) data.jackpots = data.jackpots.slice(0, 200);
        return await this._saveJSON('jackpots.json', data, await this._getSHA('jackpots.json'));
    }

    async getJackpotsByUser(user_uid) {
        const data = await this._fetchJSON('jackpots.json');
        if (!data) return [];
        return data.jackpots.filter(j => j.user_uid === user_uid);
    }

    async getAllJackpots() {
        const data = await this._fetchJSON('jackpots.json');
        if (!data) return [];
        return data.jackpots;
    }

    async logOnline(user_uid, nickname, action) {
        let data = await this._fetchJSON('online.json');
        if (!data) data = { logs: [] };
        data.logs.push({ user_uid, nickname, action, created_at: new Date().toISOString() });
        if (data.logs.length > 1000) data.logs = data.logs.slice(-1000);
        return await this._saveJSON('online.json', data, await this._getSHA('online.json'));
    }

    async logOut(user_uid, nickname) {
        return await this.logOnline(user_uid, nickname, 'logout');
    }

    async getOnlineStats() {
        const data = await this._fetchJSON('online.json');
        if (!data || !data.logs) return { online_now: 0, online_today: 0 };
        const now = new Date();
        const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const onlineNow = new Set();
        const onlineToday = new Set();
        data.logs.forEach(log => {
            if (log.created_at >= fifteenMinAgo && log.action === 'login') onlineNow.add(log.user_uid);
            if (log.created_at >= todayStart && log.action === 'login') onlineToday.add(log.user_uid);
        });
        return { online_now: onlineNow.size, online_today: onlineToday.size };
    }

    async getAllUsers() {
        const data = await this.getUsers();
        return data.users || [];
    }

    async searchUsers(query) {
        const data = await this.getUsers();
        const q = query.toLowerCase();
        return data.users.filter(u => 
            u.user_uid.includes(q) || 
            (u.nickname && u.nickname.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q))
        );
    }

    async addDiamonds(user_uid, amount, adminName) {
        let data = await this.getUsers();
        let user = data.users.find(u => u.user_uid === user_uid);
        if (!user) return { success: false, error: 'Пользователь не найден' };
        user.diamonds = (user.diamonds || 0) + amount;
        await this._saveJSON('users.json', data, await this._getSHA('users.json'));
        await this._saveTransaction(user_uid, user.nickname || user.email, amount, 'add', 'Начисление админом', adminName);
        return { success: true, new_balance: user.diamonds };
    }

    async removeDiamonds(user_uid, amount, adminName) {
        let data = await this.getUsers();
        let user = data.users.find(u => u.user_uid === user_uid);
        if (!user) return { success: false, error: 'Пользователь не найден' };
        user.diamonds = Math.max(0, (user.diamonds || 0) - amount);
        await this._saveJSON('users.json', data, await this._getSHA('users.json'));
        await this._saveTransaction(user_uid, user.nickname || user.email, amount, 'remove', 'Списание админом', adminName);
        return { success: true, new_balance: user.diamonds };
    }

    async _saveTransaction(user_uid, nickname, amount, type, reason, admin_username) {
        let data = await this._fetchJSON('transactions.json');
        if (!data) data = { transactions: [] };
        data.transactions.unshift({ user_uid, nickname, amount, type, reason, admin_username, created_at: new Date().toISOString() });
        if (data.transactions.length > 500) data.transactions = data.transactions.slice(0, 500);
        return await this._saveJSON('transactions.json', data, await this._getSHA('transactions.json'));
    }

    async getTransactions() {
        const data = await this._fetchJSON('transactions.json');
        if (!data) return [];
        return data.transactions;
    }

    async getSpentByMode() {
        const data = await this._fetchJSON('jackpots.json');
        if (!data || !data.jackpots) return {};
        const spent = {};
        data.jackpots.forEach(j => {
            if (!spent[j.mode_key]) spent[j.mode_key] = 0;
            spent[j.mode_key] += (j.diamonds_won || 0);
        });
        return spent;
    }

    async updateNickname(user_uid, newNickname) {
        let data = await this.getUsers();
        let user = data.users.find(u => u.user_uid === user_uid);
        if (!user) return false;
        if (data.users.find(u => u.nickname && u.nickname.toLowerCase() === newNickname.toLowerCase() && u.user_uid !== user_uid)) {
            return 'taken';
        }
        user.nickname = newNickname;
        return await this._saveJSON('users.json', data, await this._getSHA('users.json'));
    }
}

const API = new GameAPI();
