// SW_VERSION: 3 — direct push handling, no Firebase init timing dependency

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let title = 'Ivent Manager';
    let body = '';
    try {
      const data = event.data?.json();
      // FCM webpush payload: { notification: { title, body }, data: {...} }
      title = data?.notification?.title ?? data?.data?.title ?? data?.title ?? title;
      body  = data?.notification?.body  ?? data?.data?.body  ?? data?.body  ?? '';
    } catch {
      body = event.data?.text() ?? '';
    }
    await self.registration.showNotification(title, {
      body,
      icon:  '/icon.png',
      badge: '/icon.png',
      data:  { link: '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(link);
    })
  );
});
