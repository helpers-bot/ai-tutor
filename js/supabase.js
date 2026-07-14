import { CONFIG } from './config.js';

const SUPABASE_URL = CONFIG.supabase.url;
const SUPABASE_KEY = CONFIG.supabase.publishableKey;

class SupabaseClient {
    constructor() {
        this.url = SUPABASE_URL;
        this.key = SUPABASE_KEY;
    }
    
    getHeaders() {
        const headers = {
            'apikey': this.key,
            'Content-Type': 'application/json'
        };
        
        const token = localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };
        
        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `Request failed: ${response.status}`);
        }
        
        return await response.json();
    }
    
    // Аутентификация
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
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            await this.request('users', {
                method: 'POST',
                body: JSON.stringify({
                    id: data.user.id,
                    username,
                    stars_balance: 0,
                    created_at: new Date().toISOString()
                })
            });
        }
        
        return data;
    }
    
    async signIn(email, password) {
        const response = await fetch(
            `${this.url}/auth/v1/token?grant_type=password`,
            {
                method: 'POST',
                headers: {
                    'apikey': this.key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            }
        );
        
        const data = await response.json();
        
        if (data.access_token) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        
        return data;
    }
    
    async signOut() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            await fetch(`${this.url}/auth/v1/logout`, {
                method: 'POST',
                headers: {
                    'apikey': this.key,
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
    }
    
    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }
    
    isAuthenticated() {
        return !!localStorage.getItem('auth_token');
    }
    
    // Контент
    async getFeed() {
        return await this.request(
            'content?select=*,users(username,avatar_url)&order=created_at.desc'
        );
    }
    
    async createContent(data) {
        return await this.request('content', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    // Лайки
    async toggleLike(contentId, userId) {
        const existing = await this.request(
            `likes?user_id=eq.${userId}&content_id=eq.${contentId}`
        );
        
        if (existing.length > 0) {
            await fetch(
                `${this.url}/rest/v1/likes?user_id=eq.${userId}&content_id=eq.${contentId}`,
                {
                    method: 'DELETE',
                    headers: this.getHeaders()
                }
            );
            return false; // лайк убран
        } else {
            await this.request('likes', {
                method: 'POST',
                body: JSON.stringify({ user_id: userId, content_id: contentId })
            });
            return true; // лайк поставлен
        }
    }
    
    async getLikesCount(contentId) {
        const data = await this.request(
            `likes?content_id=eq.${contentId}&select=count`
        );
        return data[0]?.count || 0;
    }
    
    // Комментарии
    async addComment(userId, contentId, text) {
        return await this.request('comments', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, content_id: contentId, text })
        });
    }
    
    async getComments(contentId) {
        return await this.request(
            `comments?content_id=eq.${contentId}&select=*,users(username)&order=created_at.asc`
        );
    }
    
    // Репосты
    async repost(userId, contentId) {
        return await this.request('reposts', {
            method: 'POST',
            body: JSON.stringify({ user_id: userId, content_id: contentId })
        });
    }
    
    // Покупки
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
        
        const balance = await this.getUserBalance(userId);
        await this.request(`users?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ stars_balance: balance - stars })
        });
    }
    
    async addStars(userId, amount) {
        const balance = await this.getUserBalance(userId);
        await this.request(`users?id=eq.${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ stars_balance: balance + amount })
        });
    }
    
    async canAccessContent(contentId, userId) {
        const data = await this.request('rpc/can_access_content', {
            method: 'POST',
            body: JSON.stringify({ content_id: contentId, user_id: userId })
        });
        return data === true || data === 'true';
    }
}

export const supabase = new SupabaseClient();
