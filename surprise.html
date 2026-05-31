self.addEventListener('push', function(event) {
    let data = { title: '💝 Сюрприз!', body: 'Тебя ждёт кое-что особенное...' };
    if (event.data) {
        try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💝</text></svg>',
            vibrate: [200,100,200],
            requireInteraction: true,
            tag: 'surprise-quest',
        })
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({type:'window',includeUncontrolled:true}).then(function(clientList){
            for(const client of clientList){
                if(client.url.includes('surprise.html') && 'focus' in client) return client.focus();
            }
            if(clients.openWindow) return clients.openWindow('/surprise.html');
        })
    );
});

self.addEventListener('message', function(event) {
    if(event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: event.data.icon,
            vibrate: [200,100,200],
            requireInteraction: true,
            tag: 'surprise-quest',
        });
    }
});
