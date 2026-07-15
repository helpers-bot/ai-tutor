async function showProfile() {
    const user = supabase.getUser();
    if (!user||!user.id) { supabase.signOut(); showAuth(); return; }
    const profile = await supabase.getUserBalance(user.id);
    const myContent = await supabase.getUserContent(user.id);
    const avatarUrl = profile.avatar_url||'';
    const initial = (profile.username||user.email||'U')[0].toUpperCase();
    const username = profile.username||user.email?.split('@')[0]||'user';

    let grid = '';
    if (myContent.length === 0) {
        grid = '<p style="color:#888;text-align:center;padding:20px">Нет публикаций</p>';
    } else {
        grid = '<div class="profile-grid">';
        for (const item of myContent) {
            const modStatus = await supabase.getModerationStatus(item.id);
            const likes = await supabase.getLikesCount(item.id);
            const views = await supabase.getViewsCount(item.id);
            const statusText = modStatus === 'pending' ? '⏳ На модерации' : modStatus === 'rejected' ? '❌ Отклонено' : '✅ Опубликовано';
            const statusColor = modStatus === 'pending' ? '#ffaa00' : modStatus === 'rejected' ? '#ff0000' : '#00ff00';
            
            grid += '<div class="profile-grid-item" style="position:relative">'+
                (item.media_type==='video'?'<video src="'+item.media_url+'" muted style="width:100%;height:100%;object-fit:cover"></video>':'<img src="'+item.media_url+'" style="width:100%;height:100%;object-fit:cover">')+
                '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);padding:5px;font-size:10px;display:flex;justify-content:space-around">'+
                '<span>❤️ '+likes+'</span><span>👁 '+views+'</span>'+
                '</div>'+
                '<span style="position:absolute;top:5px;left:5px;background:'+statusColor+';color:#fff;padding:2px 6px;border-radius:8px;font-size:9px">'+statusText+'</span>'+
                (item.is_premium?'<span style="position:absolute;top:5px;right:35px;background:gold;color:#000;padding:2px 6px;border-radius:8px;font-size:10px">⭐</span>':'')+
                '<button class="delete-btn" data-id="'+item.id+'" style="position:absolute;top:5px;right:5px;background:rgba(255,0,0,0.8);color:#fff;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">🗑</button>'+
                '</div>';
        }
        grid += '</div>';
    }

    appEl.innerHTML = '<div class="page-container"><div style="text-align:center;padding:40px 20px 20px">'+
        '<div style="position:relative;display:inline-block">'+(avatarUrl?'<img src="'+avatarUrl+'" style="width:90px;height:90px;border-radius:50%;object-fit:cover">':'<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#ff0050,#ff6b6b);display:flex;align-items:center;justify-content:center;font-size:40px;margin:0 auto;font-weight:bold">'+initial+'</div>')+'<button id="changeAvatarBtn" style="position:absolute;bottom:0;right:0;background:#333;color:#fff;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:14px">📷</button><input type="file" id="avatarInput" accept="image/*" style="display:none"></div>'+
        '<h2 style="margin-top:15px">@'+username+'</h2><p style="color:#888">'+user.email+'</p>'+
        '<button class="btn btn-secondary" id="editNameBtn" style="margin:10px">✏️ Сменить ник</button>'+
        '<a href="/admin.html" class="btn btn-gold" style="display:inline-block;margin:10px;text-decoration:none;padding:8px 16px;border-radius:20px;font-size:14px">⚙️ Админка</a>'+
        '<div style="background:#111;border-radius:15px;padding:20px;margin:20px 0;display:inline-block"><div style="font-size:14px;color:#888">Баланс</div><div style="font-size:36px;color:gold;font-weight:bold">⭐ '+profile.stars_balance+'</div></div>'+
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:30px"><button class="btn btn-gold" id="buyBtn">Купить звёзды</button><button class="btn btn-secondary" id="logoutBtn">Выйти</button></div>'+
        '<h3 style="text-align:left;margin-bottom:15px">📱 Мои публикации</h3>'+grid+
        '</div>'+renderNav('profile')+'</div>';

    document.getElementById('changeAvatarBtn').onclick = function() { document.getElementById('avatarInput').click(); };
    document.getElementById('avatarInput').onchange = async function(e) { var f=e.target.files[0]; if(!f)return; try{var url=await uploadToCloudinary(f);await supabase.updateAvatar(user.id,url);supabase.toast('✅ Готово!');showProfile();}catch(err){supabase.toast('❌ Ошибка');} };
    document.getElementById('editNameBtn').onclick = async function() { var n=prompt('Новый ник:',username); if(!n||n.length<3)return supabase.toast('Минимум 3 символа'); try{await supabase.updateUsername(user.id,n);supabase.toast('✅ Готово!');showProfile();}catch(e){supabase.toast('❌ Ошибка');} };
    document.getElementById('buyBtn').onclick = showBuyStars;
    document.getElementById('logoutBtn').onclick = async function() { await supabase.signOut(); showAuth(); };
    
    var delBtns = document.querySelectorAll('.delete-btn');
    for (var i = 0; i < delBtns.length; i++) {
        delBtns[i].onclick = async function(e) { e.stopPropagation(); if(confirm('Удалить?')){await supabase.deleteContent(this.dataset.id);supabase.toast('✅ Удалено');showProfile();} };
    }
    attachNav();
}
