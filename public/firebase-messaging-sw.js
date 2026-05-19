// クライアントの firebase パッケージとメジャーを揃える（互換性のため）
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB6KpVGCcKyPb5Sb6jCdM0YILQdw_TZ6z0",
  projectId: "ivent-schedule-ex",
  messagingSenderId: "485064505718",
  appId: "1:485064505718:web:2cbd840e8c07172669a257",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? '通知';
  const body = payload.notification?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
  });
});
