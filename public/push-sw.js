self.addEventListener('push', event => {
  const payload = event.data?.json() || {};
  const title = payload.title || 'Ivent Manager';

  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || '',
    icon: '/favicon.svg',
    data: payload.data || {},
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
