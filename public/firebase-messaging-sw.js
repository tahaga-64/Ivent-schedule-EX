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
