import json
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from flask import Flask, render_template, request, jsonify, make_response, abort
from datetime import datetime, timedelta
from urllib.parse import quote
import hashlib

app = Flask(__name__)

# Конфигурация
CACHE_DURATION = 3 * 60 * 60  # 3 часа в секундах
WG_API_URL = "https://api.worldoftanks.ru/wot"
LESTA_API_URL = "https://api.lesta.ru/wot"

# Загрузка данных
def load_json(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_json(filename, data):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

# ========== ПАРСЕР НОВОСТЕЙ ==========
def fetch_news():
    """Парсит новости с официального сайта World of Tanks"""
    cache_file = 'news_cache.json'
    
    # Проверяем кэш
    cached_data = load_json(cache_file)
    if cached_data.get('timestamp', 0) + CACHE_DURATION > time.time():
        return cached_data.get('news', [])
    
    news = []
    try:
        # Парсим новости с официального сайта
        url = "https://worldoftanks.ru/ru/news/"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Находим блоки новостей
        news_items = soup.find_all('div', class_='b-news-item')
        
        for item in news_items[:10]:  # Берем последние 10 новостей
            try:
                title_elem = item.find('a', class_='b-news-item__title')
                date_elem = item.find('span', class_='b-news-item__date')
                desc_elem = item.find('p', class_='b-news-item__text')
                img_elem = item.find('img')
                
                if title_elem:
                    news.append({
                        'title': title_elem.text.strip(),
                        'url': 'https://worldoftanks.ru' + title_elem.get('href', ''),
                        'date': date_elem.text.strip() if date_elem else '',
                        'description': desc_elem.text.strip()[:200] if desc_elem else '',
                        'image': img_elem.get('src', '') if img_elem else ''
                    })
            except Exception as e:
                continue
        
        # Если не удалось получить новости, создаем заглушки
        if not news:
            news = get_default_news()
        
    except Exception as e:
        print(f"Error fetching news: {e}")
        news = get_default_news()
    
    # Сохраняем в кэш
    save_json(cache_file, {
        'timestamp': time.time(),
        'news': news
    })
    
    return news

def get_default_news():
    """Возвращает заглушки новостей, если парсинг не удался"""
    return [
        {
            'title': 'Обновление 1.24.1 уже в игре',
            'url': '#',
            'date': datetime.now().strftime('%d.%m.%Y'),
            'description': 'Встречайте новое обновление с балансными правками и новыми механиками.',
            'image': 'https://worldoftanks.ru/static/3.110.0/common/img/wot-logo.png'
        },
        {
            'title': 'Марафон: Заработай новый премиум танк',
            'url': '#',
            'date': datetime.now().strftime('%d.%m.%Y'),
            'description': 'Участвуйте в марафоне и получите уникальный танк в свой ангар.',
            'image': 'https://worldoftanks.ru/static/3.110.0/common/img/wot-logo.png'
        },
        {
            'title': 'Выходные с x5 опытом',
            'url': '#',
            'date': datetime.now().strftime('%d.%m.%Y'),
            'description': 'С пятницы по воскресенье получайте x5 опыта за первый победный бой.',
            'image': 'https://worldoftanks.ru/static/3.110.0/common/img/wot-logo.png'
        }
    ]

# ========== БОНУС-КОДЫ ==========
def validate_code(code):
    """Проверяет формат и статус бонус-кода"""
    # Проверка формата (обычно 12-16 символов, буквы и цифры)
    pattern = r'^[A-Z0-9]{8,20}$'
    if not re.match(pattern, code.upper()):
        return False
    
    # Проверка даты (если есть)
    if 'expiry' in code:
        expiry_date = datetime.strptime(code['expiry'], '%Y-%m-%d')
        if datetime.now() > expiry_date:
            return False
    
    return True

def update_codes_status():
    """Обновляет статус кодов"""
    codes = load_json('codes.json')
    updated = False
    
    for code in codes.get('codes', []):
        if validate_code(code):
            if code.get('status') != 'Рабочий':
                code['status'] = 'Рабочий'
                updated = True
        else:
            if code.get('status') != 'Неактивный':
                code['status'] = 'Неактивный'
                updated = True
    
    if updated:
        save_json('codes.json', codes)
    
    return codes

# ========== API LESTA / WARGAMING ==========
def get_player_stats(nickname):
    """Получает статистику игрока через API"""
    try:
        # Сначала ищем игрока
        search_url = f"{WG_API_URL}/account/list/"
        params = {
            'application_id': os.environ.get('WG_API_KEY', 'demo'),
            'search': nickname,
            'type': 'exact'
        }
        
        response = requests.get(search_url, params=params, timeout=10)
        data = response.json()
        
        if data.get('status') == 'ok' and data.get('data'):
            player_id = data['data'][0]['account_id']
            
            # Получаем статистику
            stats_url = f"{WG_API_URL}/account/info/"
            stats_params = {
                'application_id': os.environ.get('WG_API_KEY', 'demo'),
                'account_id': player_id,
                'fields': 'statistics.all.wins,statistics.all.battles,statistics.all.damage_dealt,statistics.all.frags,global_rating,statistics.all.max_damage'
            }
            
            stats_response = requests.get(stats_url, params=stats_params, timeout=10)
            stats_data = stats_response.json()
            
            if stats_data.get('status') == 'ok' and stats_data.get('data'):
                player_stats = stats_data['data'][str(player_id)]['statistics']['all']
                battles = player_stats.get('battles', 0)
                wins = player_stats.get('wins', 0)
                damage = player_stats.get('damage_dealt', 0)
                frags = player_stats.get('frags', 0)
                
                # Расчет WN8 (упрощенная формула)
                if battles > 0:
                    avg_damage = damage / battles
                    avg_frags = frags / battles
                    winrate = (wins / battles) * 100
                    
                    # Упрощенный расчет WN8
                    wn8 = calculate_wn8(avg_damage, avg_frags, winrate, battles)
                else:
                    wn8 = 0
                    winrate = 0
                    avg_damage = 0
                
                return {
                    'nickname': data['data'][0]['nickname'],
                    'battles': battles,
                    'winrate': round(winrate, 2),
                    'avg_damage': round(avg_damage, 1),
                    'wn8': round(wn8),
                    'global_rating': stats_data['data'][str(player_id)].get('global_rating', 0),
                    'status': 'ok'
                }
        
        return {'status': 'error', 'message': 'Игрок не найден'}
    
    except Exception as e:
        return {'status': 'error', 'message': f'Ошибка API: {str(e)}'}

def calculate_wn8(avg_damage, avg_frags, winrate, battles):
    """Упрощенная формула расчета WN8"""
    # Базовые ожидаемые значения для среднего игрока
    expected_damage = 1000
    expected_frags = 0.8
    expected_winrate = 49.0
    
    # Коэффициенты
    rDAMAGE = avg_damage / expected_damage
    rFRAG = avg_frags / expected_frags
    rWIN = winrate / expected_winrate
    
    # Нормализация
    rWINc = max(0, (rWIN - 0.71) / (1 - 0.71))
    rDAMAGEc = max(0, (rDAMAGE - 0.22) / (1 - 0.22))
    rFRAGc = max(0, min(rDAMAGEc + 0.2, (rFRAG - 0.12) / (1 - 0.12)))
    
    wn8 = 980 * rDAMAGEc + 210 * rDAMAGEc * rFRAGc + 155 * rFRAGc * rWINc + 75 * rWINc
    
    return wn8

# ========== МАРШРУТЫ ==========
@app.route('/')
def index():
    """Главная страница с новостями и кодами"""
    news = fetch_news()
    codes_data = update_codes_status()
    
    # Фильтруем только рабочие коды
    working_codes = [code for code in codes_data.get('codes', []) if code.get('status') == 'Рабочий']
    
    return render_template('index.html',
                         news=news,
                         codes=working_codes,
                         site_name='WoT Hub - Мир танков')

@app.route('/calculator')
def calculator():
    """Страница калькулятора фарма"""
    tanks_data = load_json('tanks_db.json')
    return render_template('calc.html',
                         tanks=tanks_data.get('tanks', []),
                         site_name='Калькулятор фарма - WoT Hub')

@app.route('/stats')
def stats():
    """Страница проверки статистики"""
    return render_template('stats.html', site_name='Статистика игрока - WoT Hub')

@app.route('/api/stats/<nickname>')
def api_stats(nickname):
    """API для получения статистики игрока"""
    result = get_player_stats(nickname)
    return jsonify(result)

@app.route('/api/calculate', methods=['POST'])
def api_calculate():
    """API для расчета фарма"""
    data = request.json
    
    tank_id = data.get('tank_id')
    battles = int(data.get('battles', 10))
    avg_damage = int(data.get('avg_damage', 2000))
    premium = data.get('premium', False)
    boosters = data.get('boosters', 0)
    
    # Загружаем данные о танке
    tanks_data = load_json('tanks_db.json')
    tank = next((t for t in tanks_data.get('tanks', []) if t['id'] == tank_id), None)
    
    if not tank:
        return jsonify({'error': 'Танк не найден'}), 404
    
    # Расчет прибыли
    # Базовая прибыль за бой
    base_income = avg_damage * tank['credit_multiplier'] * 10
    
    # Бонусы
    if premium:
        base_income *= 1.5
    
    if boosters > 0:
        base_income *= (1 + boosters * 0.15)
    
    # Расходы на снаряды
    ammo_cost = tank['ammo_cost'] * (avg_damage / tank['avg_damage_per_shot'])
    
    # Ремонт (примерно 5000-15000 за бой)
    repair_cost = 8000
    
    # Чистая прибыль за бой
    net_income = base_income - ammo_cost - repair_cost
    
    # За сессию
    session_income = net_income * battles
    
    return jsonify({
        'per_battle': round(net_income),
        'per_session': round(session_income),
        'breakdown': {
            'base_income': round(base_income),
            'ammo_cost': round(ammo_cost),
            'repair_cost': repair_cost,
            'premium_bonus': round(base_income * 0.5 if premium else 0),
            'booster_bonus': round(base_income * boosters * 0.15 if boosters > 0 else 0)
        }
    })

@app.route('/sitemap.xml')
def sitemap():
    """Генерация sitemap.xml"""
    base_url = request.url_root.rstrip('/')
    
    sitemap_xml = ['<?xml version="1.0" encoding="UTF-8"?>']
    sitemap_xml.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    
    # Статические страницы
    pages = [
        {'url': '/', 'priority': '1.0', 'changefreq': 'hourly'},
        {'url': '/calculator', 'priority': '0.8', 'changefreq': 'daily'},
        {'url': '/stats', 'priority': '0.8', 'changefreq': 'daily'}
    ]
    
    for page in pages:
        sitemap_xml.append(f'''
    <url>
        <loc>{base_url}{page['url']}</loc>
        <lastmod>{datetime.now().strftime('%Y-%m-%d')}</lastmod>
        <changefreq>{page['changefreq']}</changefreq>
        <priority>{page['priority']}</priority>
    </url>''')
    
    sitemap_xml.append('</urlset>')
    
    response = make_response('\n'.join(sitemap_xml))
    response.headers['Content-Type'] = 'application/xml'
    return response

@app.route('/robots.txt')
def robots():
    """Генерация robots.txt"""
    base_url = request.url_root.rstrip('/')
    robots_txt = f"""User-agent: *
Allow: /
Disallow: /api/
Sitemap: {base_url}/sitemap.xml
"""
    response = make_response(robots_txt)
    response.headers['Content-Type'] = 'text/plain'
    return response

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
