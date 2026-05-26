importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

const IDB_NAME = 'fcm-config';
const IDB_STORE = 'config';
const IDB_KEY = 'firebase';

let initialized = false;

function initWithConfig(config) {
  if (initialized) return;
  if (!config || !config.apiKey) return;
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
      data: payload.data,
    });
  });
}

function initFromIdb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(IDB_STORE, 'readonly');
          const get = tx.objectStore(IDB_STORE).get(IDB_KEY);
          get.onsuccess = () => { initWithConfig(get.result); resolve(); };
          get.onerror = () => resolve();
        } catch { resolve(); }
      };
      req.onerror = () => resolve();
    } catch { resolve(); }
  });
}

// postMessage 経由でも初期化（メインアプリから）
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG') {
    initWithConfig(event.data.config);
  }
});

// SW アクティブ化時に IDB から先読み初期化
self.addEventListener('activate', (event) => {
  event.waitUntil(initFromIdb());
});

// push 到達時に未初期化なら IDB から初期化
self.addEventListener('push', (event) => {
  if (!initialized) {
    event.waitUntil(
      initFromIdb().then(() => {
        // Firebase compat SDK が onBackgroundMessage で処理するため
        // ここでは追加の showNotification は不要
      })
    );
  }
});

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
