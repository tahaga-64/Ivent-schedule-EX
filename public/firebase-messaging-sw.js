importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB6KpVGCcKyPb5Sb6jCdM0YILQdw_TZ6z0",
  projectId: "ivent-schedule-ex",
  messagingSenderId: "485064505718",
  appId: "1:485064505718:web:2cbd840e8c07172669a257",
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon.png',
  });
});
