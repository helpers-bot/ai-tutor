import { CONFIG } from './config.js';

// Инициализация Supabase клиента
const SUPABASE_URL = CONFIG.supabase.url;
const SUPABASE_KEY = CONFIG.supabase.publishableKey;

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_KEY;
        this.headers = {
            'apikey': this.key,
            'Authorization': `Bearer ${this.key}`,
            'Content-Type': 'application/json'
        };
    }

    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            headers: this.headers,
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Supabase request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Supabase request error:', error);
            throw error;
        }
    }

    // Аутентификация
    async signUp(email, password, username) {
        const response = await fetch(`${this.url}/auth/v1/signup`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.user) {
            // Создаем профиль пользователя
            await this.request('users', {
                method: 'POST',
                body: JSON.stringify({
                    id: data.user.id,
                    username: username,
                    stars_balance: 0
                })
            });
        }
        
        return data;
    }

    async signIn(email, password) {
        const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ email, password })
        });
        
        return await response.json();
    }

    async signOut() {
        const token = localStorage.getItem('supabase_token');
        await fetch(`${this.url}/auth/v1/logout`, {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`
            }
        });
        
        localStorage.removeItem('supabase_token');
        localStorage.removeItem('supabase_user');
    }

    // Контент
    async getFeed() {
        const token = localStorage.getItem('supabase_token');
        const response = await fetch(
            `${this.url}/rest/v1/content?select=*,users(username)`,
            {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        return await response.json();
    }

    async createContent(data) {
        const token = localStorage.getItem('supabase_token');
        return await this.request('content', {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    // Лайки
    async toggleLike(contentId, userId) {
        const token = localStorage.getItem('supabase_token');
        
        // Проверяем существующий лайк
        const existing = await fetch(
            `${this.url}/rest/v1/likes?user_id=eq.${userId}&content_id=eq.${contentId}`,
            {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        const likes = await existing.json();
        
        if (likes.length > 0) {
            // Удаляем лайк
            await fetch(
                `${this.url}/rest/v1/likes?user_id=eq.${userId}&content_id=eq.${contentId}`,
                {
                    method: 'DELETE',
                    headers: {
                        ...this.headers,
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
        } else {
            // Добавляем лайк
            await this.request('likes', {
                method: 'POST',
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    user_id: userId,
                    content_id: contentId
                })
            });
        }
    }

    async getLikesCount(contentId) {
        const response = await fetch(
            `${this.url}/rest/v1/likes?content_id=eq.${contentId}&select=count`,
            { headers: this.headers }
        );
        
        const data = await response.json();
        return data[0]?.count || 0;
    }

    // Комментарии
    async addComment(userId, contentId, text) {
        const token = localStorage.getItem('supabase_token');
        return await this.request('comments', {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                user_id: userId,
                content_id: contentId,
                text: text
            })
        });
    }

    async getComments(contentId) {
        const response = await fetch(
            `${this.url}/rest/v1/comments?content_id=eq.${contentId}&select=*,users(username)`,
            { headers: this.headers }
        );
        
        return await response.json();
    }

    // Репосты
    async repost(userId, contentId) {
        const token = localStorage.getItem('supabase_token');
        return await this.request('reposts', {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                user_id: userId,
                content_id: contentId
            })
        });
    }

    // Покупки и звезды
    async buyContent(userId, contentId, stars) {
        const token = localStorage.getItem('supabase_token');
        
        // Создаем запись о покупке
        await this.request('purchases', {
            method: 'POST',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                user_id: userId,
                content_id: contentId,
                stars_spent: stars
            })
        });
        
        // Обновляем баланс пользователя
        const currentBalance = await this.getUserBalance(userId);
        await this.request(`users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stars_balance: currentBalance - stars
            })
        });
    }

    async getUserBalance(userId) {
        const response = await fetch(
            `${this.url}/rest/v1/users?id=eq.${userId}&select=stars_balance`,
            { headers: this.headers }
        );
        
        const data = await response.json();
        return data[0]?.stars_balance || 0;
    }

    async addStars(userId, amount) {
        const token = localStorage.getItem('supabase_token');
        const currentBalance = await this.getUserBalance(userId);
        
        return await this.request(`users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                ...this.headers,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                stars_balance: currentBalance + amount
            })
        });
    }

    // Проверка доступа к контенту
    async canAccessContent(contentId, userId) {
        const response = await fetch(
            `${this.url}/rest/v1/rpc/can_access_content`,
            {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    content_id: contentId,
                    user_id: userId
                })
            }
        );
        
        return await response.json();
    }
}

export const supabase = new SupabaseClient();
