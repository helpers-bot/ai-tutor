import { CONFIG } from './config.js';

const SUPABASE_URL = CONFIG.supabase.url;
const SUPABASE_KEY = CONFIG.supabase.publishableKey; // Только публичный ключ!

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
        const token = localStorage.getItem('supabase_token');
        const headers = {
            ...this.headers
        };
        
        // Используем токен пользователя, а не секретный ключ
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            headers,
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Request failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Request error:', error);
            throw error;
        }
    }

    async signUp(email, password, username) {
        const response = await fetch(`${this.url}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'apikey': this.key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.user && data.access_token) {
            // Сохраняем сессию
            localStorage.setItem('supabase_token', data.access_token);
            localStorage.setItem('supabase_user', JSON.stringify(data.user));
            
            // Создаем профиль
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
            headers: {
                'apikey': this.key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.access_token) {
            localStorage.setItem('supabase_token', data.access_token);
            localStorage.setItem('supabase_user', JSON.stringify(data.user));
        }
        
        return data;
    }

    async getFeed() {
        return await this.request('content?select=*,users(username)');
    }

    async createContent(data) {
        return await this.request('content', {
            method: 'POST',
            headers: {
                ...this.headers,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    async toggleLike(contentId, userId) {
        const existing = await this.request(
            `likes?user_id=eq.${userId}&content_id=eq.${contentId}`
        );
        
        if (existing.length > 0) {
            await fetch(
                `${this.url}/rest/v1/likes?user_id=eq.${userId}&content_id=eq.${contentId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': this.key,
                        'Authorization': `Bearer ${localStorage.getItem('supabase_token')}`
                    }
                }
            );
        } else {
            await this.request('likes', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    content_id: contentId
                })
            });
        }
    }

    async getLikesCount(contentId) {
        const data = await this.request(
            `likes?content_id=eq.${contentId}&select=count`
        );
        return data[0]?.count || 0;
    }

    async addComment(userId, contentId, text) {
        return await this.request('comments', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                content_id: contentId,
                text: text
            })
        });
    }

    async getComments(contentId) {
        return await this.request(
            `comments?content_id=eq.${contentId}&select=*,users(username)`
        );
    }

    async repost(userId, contentId) {
        return await this.request('reposts', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                content_id: contentId
            })
        });
    }

    async getUserBalance(userId) {
        const data = await this.request(
            `users?id=eq.${userId}&select=stars_balance`
        );
        return data[0]?.stars_balance || 0;
    }

    async buyContent(userId, contentId, stars) {
        await this.request('purchases', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                content_id: contentId,
                stars_spent: stars
            })
        });
        
        const currentBalance = await this.getUserBalance(userId);
        await this.request(`users?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                stars_balance: currentBalance - stars
            })
        });
    }

    async addStars(userId, amount) {
        const currentBalance = await this.getUserBalance(userId);
        return await this.request(`users?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                stars_balance: currentBalance + amount
            })
        });
    }

    async canAccessContent(contentId, userId) {
        const data = await this.request('rpc/can_access_content', {
            method: 'POST',
            body: JSON.stringify({
                content_id: contentId,
                user_id: userId
            })
        });
        return data;
    }
}

export const supabase = new SupabaseClient();
