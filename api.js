// ================================================================
// API.JS — ПОДКЛЮЧЕНИЕ К SUPABASE
// ================================================================

// ВАШИ ПРАВИЛЬНЫЕ КЛЮЧИ (из скриншота)
const SUPABASE_URL = 'https://l2ls0oS3ZwF9GUTochw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_l2ls0oS3ZwF9GUTochw_NQ_FKV4rF6Y';

// Инициализация Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================================
// ОСНОВНЫЕ ФУНКЦИИ API
// ================================================================

const API = {
    // ---- АВТОРИЗАЦИЯ ----
    async registerOrLogin(userInfo) {
        try {
            // Проверяем, есть ли пользователь с таким googleId
            const { data: existing, error: findError } = await supabaseClient
                .from('users')
                .select('*')
                .eq('google_id', userInfo.googleId)
                .single();

            if (existing) {
                // Пользователь найден — обновляем данные
                const { data: updated, error: updateError } = await supabaseClient
                    .from('users')
                    .update({
                        email: userInfo.email,
                        name: userInfo.name,
                        picture: userInfo.picture,
                        last_login: new Date().toISOString()
                    })
                    .eq('google_id', userInfo.googleId)
                    .select()
                    .single();

                if (updateError) throw updateError;
                return {
                    success: true,
                    user_uid: updated.user_uid || updated.id,
                    nickname: updated.name || updated.nickname || 'Игрок',
                    email: updated.email,
                    picture: updated.picture,
                    diamonds: updated.diamonds || 100,
                    treasure_progress: updated.treasure_progress || 0,
                    free_spins: updated.free_spins || 0,
                    jackpot_boost: updated.jackpot_boost || false
                };
            } else {
                // Новый пользователь — создаём
                const userUid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                const { data: newUser, error: createError } = await supabaseClient
                    .from('users')
                    .insert({
                        google_id: userInfo.googleId,
                        user_uid: userUid,
                        email: userInfo.email,
                        name: userInfo.name,
                        nickname: userInfo.name || 'Игрок',
                        picture: userInfo.picture,
                        diamonds: 100,
                        treasure_progress: 0,
                        free_spins: 0,
                        jackpot_boost: false,
                        created_at: new Date().toISOString(),
                        last_login: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                return {
                    success: true,
                    user_uid: newUser.user_uid || newUser.id,
                    nickname: newUser.nickname || 'Игрок',
                    email: newUser.email,
                    picture: newUser.picture,
                    diamonds: newUser.diamonds || 100,
                    treasure_progress: newUser.treasure_progress || 0,
                    free_spins: newUser.free_spins || 0,
                    jackpot_boost: newUser.jackpot_boost || false
                };
            }
        } catch (error) {
            console.error('Auth error:', error);
            return { success: false, error: error.message };
        }
    },

    // ---- СОХРАНЕНИЕ ДАННЫХ ----
    async saveUserData(userUid, data) {
        try {
            const { error } = await supabaseClient
                .from('users')
                .update({
                    diamonds: data.diamonds,
                    treasure_progress: data.treasure_progress,
                    free_spins: data.free_spins,
                    jackpot_boost: data.jackpot_boost,
                    updated_at: new Date().toISOString()
                })
                .eq('user_uid', userUid);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Save error:', error);
            return false;
        }
    },

    // ---- ИСТОРИЯ ДЖЕКПОТОВ ----
    async getJackpotHistory(userUid) {
        try {
            const { data, error } = await supabaseClient
                .from('jackpots')
                .select('*')
                .eq('user_uid', userUid)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('History error:', error);
            return [];
        }
    },

    async saveJackpot(userUid, nickname, mode, icon, wish, winAmount) {
        try {
            const { error } = await supabaseClient
                .from('jackpots')
                .insert({
                    user_uid: userUid,
                    nickname: nickname,
                    mode: mode || 'generic',
                    icon: icon,
                    wish: wish,
                    win_amount: winAmount || 20,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Save jackpot error:', error);
            return false;
        }
    },

    // ---- ПОДДЕРЖКА (ЧАТ) ----
    async getSupportChats() {
        try {
            const { data, error } = await supabaseClient
                .from('support_chats')
                .select('*')
                .limit(1)
                .order('created_at', { ascending: false });

            if (error) throw error;
            // Возвращаем объект с чатами
            const chats = {};
            if (data && data.length > 0) {
                data.forEach(chat => {
                    chats[chat.user_uid] = {
                        messages: chat.messages || [],
                        userName: chat.user_name || 'Гость'
                    };
                });
            }
            return chats;
        } catch (error) {
            console.error('Support chats error:', error);
            return {};
        }
    },

    async saveSupportChats(chats) {
        try {
            // Сохраняем каждый чат
            for (const [userUid, chatData] of Object.entries(chats)) {
                const { error } = await supabaseClient
                    .from('support_chats')
                    .upsert({
                        user_uid: userUid,
                        user_name: chatData.userName || 'Гость',
                        messages: chatData.messages || [],
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_uid' });

                if (error) throw error;
            }
            return true;
        } catch (error) {
            console.error('Save support error:', error);
            return false;
        }
    },

    // ---- КРИПТО-КУРСЫ ----
    async getCryptoRates() {
        try {
            // Используем бесплатный API для курсов
            const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,tron,tether&vs_currencies=usd');
            const data = await response.json();
            
            return {
                USDT: { symbol: 'USDTUSDT', price_usd: 1.00, last_update: new Date().toISOString() },
                TRX: { symbol: 'TRXUSDT', price_usd: data.tron?.usd || 0.12, last_update: new Date().toISOString() },
                BNB: { symbol: 'BNBUSDT', price_usd: data.binancecoin?.usd || 500, last_update: new Date().toISOString() },
                ETH: { symbol: 'ETHUSDT', price_usd: data.ethereum?.usd || 3000, last_update: new Date().toISOString() },
                BTC: { symbol: 'BTCUSDT', price_usd: data.bitcoin?.usd || 60000, last_update: new Date().toISOString() }
            };
        } catch (error) {
            console.error('Rates error:', error);
            // Возвращаем запасные курсы
            return {
                USDT: { symbol: 'USDTUSDT', price_usd: 1.00, last_update: new Date().toISOString() },
                TRX: { symbol: 'TRXUSDT', price_usd: 0.12, last_update: new Date().toISOString() },
                BNB: { symbol: 'BNBUSDT', price_usd: 500, last_update: new Date().toISOString() },
                ETH: { symbol: 'ETHUSDT', price_usd: 3000, last_update: new Date().toISOString() },
                BTC: { symbol: 'BTCUSDT', price_usd: 60000, last_update: new Date().toISOString() }
            };
        }
    },

    // ---- ПРОМОКОДЫ ----
    async redeemPromoCode(userUid, code) {
        try {
            // Проверяем промокод
            const { data: promo, error: findError } = await supabaseClient
                .from('promo_codes')
                .select('*')
                .eq('code', code)
                .eq('is_active', true)
                .single();

            if (findError || !promo) {
                return { success: false, error: 'Неверный промокод' };
            }

            // Проверяем, использовал ли пользователь этот промокод
            const { data: used, error: usedError } = await supabaseClient
                .from('promo_usage')
                .select('id')
                .eq('user_uid', userUid)
                .eq('promo_code_id', promo.id)
                .single();

            if (used) {
                return { success: false, error: 'Промокод уже использован' };
            }

            // Записываем использование
            await supabaseClient
                .from('promo_usage')
                .insert({
                    user_uid: userUid,
                    promo_code_id: promo.id,
                    used_at: new Date().toISOString()
                });

            // Начисляем награду
            const rewardType = promo.reward_type || 'diamonds';
            const rewardAmount = promo.reward_amount || 20;

            return {
                success: true,
                type: rewardType,
                amount: rewardAmount,
                message: `Промокод активирован! +${rewardAmount} ${rewardType === 'spins' ? 'бесплатных спинов' : 'алмазов'}`
            };
        } catch (error) {
            console.error('Promo error:', error);
            return { success: false, error: 'Ошибка активации' };
        }
    },

    // ---- ВЫХОД ----
    async logOut(userUid, nickname) {
        try {
            // Обновляем время последнего выхода
            await supabaseClient
                .from('users')
                .update({ last_logout: new Date().toISOString() })
                .eq('user_uid', userUid);
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    },

    // ---- СМЕНА НИКНЕЙМА ----
    async updateNickname(userUid, newNickname) {
        try {
            // Проверяем, занят ли никнейм
            const { data: existing, error: findError } = await supabaseClient
                .from('users')
                .select('user_uid')
                .eq('nickname', newNickname)
                .neq('user_uid', userUid)
                .single();

            if (existing) return 'taken';

            // Обновляем никнейм
            const { error } = await supabaseClient
                .from('users')
                .update({ nickname: newNickname })
                .eq('user_uid', userUid);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Update nickname error:', error);
            return false;
        }
    }
};

// ---- ДОБАВЛЯЕМ В ГЛОБАЛЬНЫЙ ОБЪЕКТ ----
window.API = API;
window.supabaseClient = supabaseClient;

console.log('✅ API.js загружен!');
console.log('🔑 Supabase URL:', SUPABASE_URL);
