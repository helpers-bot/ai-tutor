// ========== ЛОАДЕР ==========
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
    }, 800);
});

// ========== МОБИЛЬНОЕ МЕНЮ ==========
function toggleMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('active');
}

// ========== КОПИРОВАНИЕ КОДОВ ==========
function copyCode(code, element) {
    navigator.clipboard.writeText(code).then(() => {
        // Показываем уведомление
        showNotification('Код скопирован!', 'success');
        
        // Визуальная обратная связь
        const originalText = element.innerHTML;
        element.innerHTML = '✅ Скопировано!';
        element.style.color = '#00e676';
        
        setTimeout(() => {
            element.innerHTML = originalText;
            element.style.color = '';
        }, 2000);
    }).catch(err => {
        showNotification('Ошибка копирования', 'error');
    });
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 5px;
        background: ${type === 'success' ? '#00e676' : '#ff1744'};
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// ========== КАЛЬКУЛЯТОР ФАРМА ==========
function calculateFarm() {
    const tankId = document.getElementById('tankSelect').value;
    const battles = parseInt(document.getElementById('battles').value);
    const avgDamage = parseInt(document.getElementById('avgDamage').value);
    const premium = document.getElementById('premiumAccount').checked;
    const boosters = parseInt(document.getElementById('boosters').value);
    
    const data = {
        tank_id: tankId,
        battles: battles,
        avg_damage: avgDamage,
        premium: premium,
        boosters: boosters
    };
    
    fetch('/api/calculate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        displayResults(result);
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showNotification('Ошибка расчета', 'error');
    });
}

function displayResults(result) {
    // Обновляем значения
    document.getElementById('perBattle').textContent = `${result.per_battle.toLocaleString()} ₵`;
    document.getElementById('perSession').textContent = `${result.per_session.toLocaleString()} ₵`;
    
    // Детализация
    const breakdown = document.getElementById('breakdown');
    breakdown.innerHTML = `
        <div class="breakdown-item">
            <span>Базовая прибыль:</span>
            <span>${result.breakdown.base_income.toLocaleString()} ₵</span>
        </div>
        <div class="breakdown-item">
            <span>Расходы на снаряды:</span>
            <span>-${result.breakdown.ammo_cost.toLocaleString()} ₵</span>
        </div>
        <div class="breakdown-item">
            <span>Ремонт:</span>
            <span>-${result.breakdown.repair_cost.toLocaleString()} ₵</span>
        </div>
        ${result.breakdown.premium_bonus ? `
        <div class="breakdown-item bonus">
            <span>Премиум бонус:</span>
            <span>+${result.breakdown.premium_bonus.toLocaleString()} ₵</span>
        </div>` : ''}
        ${result.breakdown.booster_bonus ? `
        <div class="breakdown-item bonus">
            <span>Бустеры:</span>
            <span>+${result.breakdown.booster_bonus.toLocaleString()} ₵</span>
        </div>` : ''}
    `;
    
    // Обновляем шкалу
    const maxIncome = 200000; // Максимальная прибыль для шкалы
    const percentage = Math.min((result.per_session / maxIncome) * 100, 100);
    document.getElementById('incomeBar').style.width = `${percentage}%`;
    
    // Анимация шкалы
    document.getElementById('incomeBar').style.transition = 'width 1s ease-out';
}

// ========== СТАТИСТИКА ИГРОКА ==========
function searchPlayer() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    
    if (!nickname) {
        showNotification('Введите никнейм', 'error');
        return;
    }
    
    // Показываем загрузку
    const statsResult = document.getElementById('statsResult');
    statsResult.innerHTML = '<div class="loading">🔍 Поиск игрока...</div>';
    
    fetch(`/api/stats/${encodeURIComponent(nickname)}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'ok') {
                displayPlayerStats(data);
            } else {
                statsResult.innerHTML = `
                    <div class="error-message">
                        <p>❌ ${data.message || 'Игрок не найден'}</p>
                        <p>Попробуйте другой никнейм</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Ошибка:', error);
            statsResult.innerHTML = '<div class="error-message">Ошибка получения данных</div>';
        });
}

function displayPlayerStats(data) {
    const statsResult = document.getElementById('statsResult');
    
    // Определяем цвет WN8
    let wn8Color = '#888';
    let wn8Rating = 'Н/Д';
    
    if (data.wn8 >= 2450) {
        wn8Color = '#9c27b0';
        wn8Rating = 'Уникум';
    } else if (data.wn8 >= 1900) {
        wn8Color = '#00bcd4';
        wn8Rating = 'Отличный';
    } else if (data.wn8 >= 1400) {
        wn8Color = '#2196f3';
        wn8Rating = 'Хороший';
    } else if (data.wn8 >= 1000) {
        wn8Color = '#4caf50';
        wn8Rating = 'Средний';
    } else if (data.wn8 >= 500) {
        wn8Color = '#ff9800';
        wn8Rating = 'Ниже среднего';
    } else if (data.wn8 > 0) {
        wn8Color = '#f44336';
        wn8Rating = 'Низкий';
    }
    
    statsResult.innerHTML = `
        <div class="player-card">
            <h2 class="player-nickname">${data.nickname}</h2>
            
            <div class="player-stats-grid">
                <div class="player-stat">
                    <div class="stat-label">WN8</div>
                    <div class="stat-value" style="color: ${wn8Color}">${data.wn8}</div>
                    <div class="stat-rating" style="color: ${wn8Color}">${wn8Rating}</div>
                </div>
                
                <div class="player-stat">
                    <div class="stat-label">Процент побед</div>
                    <div class="stat-value">${data.winrate}%</div>
                </div>
                
                <div class="player-stat">
                    <div class="stat-label">Бои</div>
                    <div class="stat-value">${data.battles.toLocaleString()}</div>
                </div>
                
                <div class="player-stat">
                    <div class="stat-label">Средний урон</div>
                    <div class="stat-value">${data.avg_damage.toLocaleString()}</div>
                </div>
            </div>
            
            <div class="player-rating-bar">
                <div class="rating-label">Прогресс WN8:</div>
                <div class="rating-bar">
                    <div class="rating-fill" style="width: ${Math.min(data.wn8 / 30, 100)}%; background: ${wn8Color}"></div>
                </div>
            </div>
        </div>
    `;
}

// ========== МОДАЛЬНОЕ ОКНО ==========
function showModal(content) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');
    modalBody.innerHTML = content;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.remove('active');
}

// Закрытие модального окна при клике вне
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        closeModal();
    }
});

// Закрытие по ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('WoT Hub загружен!');
    
    // Добавляем обработчик Enter для поиска
    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput) {
        nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchPlayer();
            }
        });
    }
    
    // Автоматический расчет при изменении параметров
    const calcInputs = ['tankSelect', 'battles', 'avgDamage', 'premiumAccount', 'boosters'];
    calcInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', calculateFarm);
        }
    });
    
    // Первичный расчет
    if (document.getElementById('tankSelect')) {
        calculateFarm();
    }
});
