self.addEventListener('push', event => {
  const payload = event.data?.json() || {};
  const title = payload.title || 'Ivent Manager';
  const body = payload.body || '';
  const data = payload.data || {};

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    tag: data.type ? `${data.type}:${data.eventId || 'global'}` : 'ivent-push',
    data,
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({
        type: 'push-received',
        payload: { title, body, data },
      });
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const eventId = event.notification.data?.eventId;
  const targetUrl = eventId ? `/?event=${encodeURIComponent(eventId)}` : '/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        client.postMessage({ type: 'open-event', eventId: eventId || null });
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});
