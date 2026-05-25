// クライアントの firebase パッケージとメジャーを揃える（互換性のため）
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

// Firebase config is received from the main app via postMessage to avoid duplication.
// Fallback values match firebase.ts so the SW works even before the message arrives.
let initialized = false;

function initIfNeeded(config) {
  if (initialized) return;
  initialized = true;
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'Ivent Manager';
    const body  = payload.notification?.body  ?? '';
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      badge: '/icon.png',
    });
  });
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    initIfNeeded(event.data.config);
  }
});

// 通知をタップしたらアプリを開く（またはフォーカスする）
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.FCM_MSG?.notification?.click_action
    || event.notification.data?.link
    || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
