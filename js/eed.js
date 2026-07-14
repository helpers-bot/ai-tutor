import { supabase } from './supabase.js';

export class FeedManager {
    constructor() {
        this.content = [];
    }
    
    async load() {
        try {
            this.content = await supabase.getFeed();
        } catch (error) {
            console.error('Feed load error:', error);
            this.content = [];
        }
    }
    
    async render(container, currentUser) {
        await this.load();
        
        let html = `
            <div class="feed-container">
                <div class="nav">
                    <h2>TikTok Clone</h2>
                    <div class="nav-actions">
                        <button class="btn btn-gold" id="btnBuyStars">
                            ⭐ Купить
                        </button>
                        <button class="btn btn-primary" id="btnUpload">
                            + Загрузить
                        </button>
                        <button class="btn btn-secondary" id="btnLogout">
                            Выйти
                        </button>
                    </div>
                </div>
        `;
        
        if (this.content.length === 0) {
            html += `
                <div class="empty-state">
                    <h2>📱 Пока нет контента</h2>
                    <p>Будьте первым, кто загрузит видео или фото!</p>
                    <button class="btn btn-primary" id="btnUploadEmpty">+ Загрузить контент</button>
                </div>
            </div>`;
        } else {
            for (const item of this.content) {
                const canAccess = item.is_premium 
                    ? await supabase.canAccessContent(item.id, currentUser.id)
                    : true;
                
                const likesCount = await supabase.getLikesCount(item.id);
                const comments = await supabase.getComments(item.id);
                
                html += this.renderCard(item, canAccess, likesCount, comments.length);
            }
            html += '</div>';
        }
        
        container.innerHTML = html;
        this.attachFeedEvents(currentUser);
    }
    
    renderCard(item, canAccess, likesCount, commentsCount) {
        const userInitial = (item.users?.username || 'U').charAt(0).toUpperCase();
        const date = new Date(item.created_at).toLocaleDateString('ru-RU');
        
        return `
            <div class="content-card" data-id="${item.id}">
                <div class="content-header">
                    <div class="user-info">
                        <div class="user-avatar">${userInitial}</div>
                        <div>
                            <div class="username">@${item.users?.username || 'user'}</div>
                            ${item.is_premium ? '<span class="premium-badge">⭐ Premium</span>' : ''}
                        </div>
                    </div>
                    <span style="color:#888;font-size:12px">${date}</span>
                </div>
                
                <div class="content-body">
                    ${!canAccess ? this.renderBlurred(item) : this.renderMedia(item)}
                </div>
                
                ${item.description ? `<div class="content-description">${item.description}</div>` : ''}
                
                <div class="content-actions">
                    <button class="action-btn like-btn" data-id="${item.id}">
                        ❤️ <span>${likesCount}</span>
                    </button>
                    <button class="action-btn comment-btn" data-id="${item.id}">
                        💬 <span>${commentsCount}</span>
                    </button>
                    <button class="action-btn repost-btn" data-id="${item.id}">
                        🔄
                    </button>
                </div>
            </div>
        `;
    }
    
    renderBlurred(item) {
        return `
            <div class="blurred-content" data-unlock="${item.id}" data-price="${item.price_stars}">
                <div class="blur-overlay">
                    <div class="lock-icon">🔒</div>
                    <h3>Закрытый контент</h3>
                    <p style="font-size:24px;color:gold;">${item.price_stars} ⭐</p>
                    <button class="unlock-btn">Разблокировать</button>
                </div>
                ${this.renderMedia(item, true)}
            </div>
        `;
    }
    
    renderMedia(item, blurred = false) {
        const blurClass = blurred ? 'class="blurred"' : '';
        
        if (item.media_type === 'video') {
            return `
                <video ${blurClass} loop muted playsinline 
                       onmouseenter="if(!this.classList.contains('blurred')) this.play()" 
                       onmouseleave="this.pause()">
                    <source src="${item.media_url}" type="video/mp4">
                </video>`;
        }
        return `<img ${blurClass} src="${item.media_url}" alt="Content">`;
    }
    
    attachFeedEvents(currentUser) {
        // Кнопки в навбаре
        document.getElementById('btnUpload')?.addEventListener('click', () => {
            if (this.onUpload) this.onUpload();
        });
        document.getElementById('btnUploadEmpty')?.addEventListener('click', () => {
            if (this.onUpload) this.onUpload();
        });
        document.getElementById('btnBuyStars')?.addEventListener('click', () => {
            if (this.onBuyStars) this.onBuyStars();
        });
        document.getElementById('btnLogout')?.addEventListener('click', () => {
            if (this.onLogout) this.onLogout();
        });
        
        // Лайки
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const contentId = btn.dataset.id;
                await supabase.toggleLike(contentId, currentUser.id);
                const count = await supabase.getLikesCount(contentId);
                btn.querySelector('span').textContent = count;
            });
        });
        
        // Разблокировка
        document.querySelectorAll('.blurred-content').forEach(el => {
            el.addEventListener('click', async () => {
                const contentId = el.dataset.unlock;
                const price = parseInt(el.dataset.price);
                if (this.onUnlock) this.onUnlock(contentId, price);
            });
        });
        
        // Комментарии
        document.querySelectorAll('.comment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const contentId = btn.dataset.id;
                if (this.onComment) this.onComment(contentId);
            });
        });
        
        // Репосты
        document.querySelectorAll('.repost-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const contentId = btn.dataset.id;
                await supabase.repost(currentUser.id, contentId);
                this.showToast('✅ Вы поделились контентом!');
            });
        });
    }
    
    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 3000);
    }
}
