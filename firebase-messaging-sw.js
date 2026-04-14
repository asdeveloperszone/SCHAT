/**
 * firebase-messaging-sw.js — ASChat FCM Background Service Worker v5
 *
 * THIS FILE MUST BE AT THE ROOT of your domain (same level as index.html).
 * Firebase Cloud Messaging requires it at: /firebase-messaging-sw.js
 *
 * This handles BACKGROUND push notifications — when:
 *   • The browser/Chrome is fully closed
 *   • The phone screen is off
 *   • The user is in another app
 *   • The PWA is installed but not running
 *
 * Works alongside sw.js (caching + foreground notifications).
 */

// ─── FIREBASE CONFIG — keep in sync with js/firebase-config.js ───────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyA_h36fA_bjB9dA35_FWpcO15fsdMOXr4M",
  authDomain:        "aschat-10454.firebaseapp.com",
  databaseURL:       "https://aschat-10454-default-rtdb.firebaseio.com",
  projectId:         "aschat-10454",
  storageBucket:     "aschat-10454.firebasestorage.app",
  messagingSenderId: "1000988226480",
  appId:             "1:1000988226480:web:24ef431489b19037e49c75"
};

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// ─── BACKGROUND MESSAGE HANDLER ───────────────────────────────────────────────
// Fires when push arrives and NO app window is open/focused.
// Cloud Function must send `data` payload (not `notification`) so we control appearance.

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const type = data.type;
  if (!type) return;

  switch (type) {
    case 'message':      return showMessageNotification(data);
    case 'photo':        return showPhotoNotification(data);
    case 'voice':        return showVoiceNotification(data);
    case 'call':         return showCallNotification(data);
    case 'missed_call':  return showMissedCallNotification(data);
    case 'reaction':     return showReactionNotification(data);
    default:
      console.warn('[FCM-SW] Unknown push type:', type);
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Compute the base path from this SW file's location
// e.g. if SW is at /ASCHATS/firebase-messaging-sw.js → base = /ASCHATS
const FCM_BASE = self.location.pathname.replace(/\/firebase-messaging-sw\.js$/, '') || '';
const ICON     = FCM_BASE + '/icons/icon-192.png';
const BADGE    = FCM_BASE + '/icons/icon-192.png';

function buildChatURL(userID, userName) {
  return `${FCM_BASE}/chat.html?id=${encodeURIComponent(userID)}&name=${encodeURIComponent(userName || '')}`;
}

// ─── NOTIFICATION BUILDERS ────────────────────────────────────────────────────

function showMessageNotification(data) {
  const { senderName, senderID, text, senderPhoto } = data;
  return self.registration.showNotification(`ASChat — ${senderName}`, {
    body:      text || 'New message',
    icon:      senderPhoto || ICON,
    badge:     BADGE,
    tag:       'msg-' + senderID,
    renotify:  true,
    silent:    false,
    vibrate:   [200, 100, 200],
    timestamp: Date.now(),
    data:      { type: 'message', senderID, senderName, url: buildChatURL(senderID, senderName) },
    actions: [
      { action: 'open',  title: '💬 Open'   },
      { action: 'close', title: '✕ Dismiss' }
    ]
  });
}

function showPhotoNotification(data) {
  data.text = '📷 Photo';
  return showMessageNotification(data);
}

function showVoiceNotification(data) {
  data.text = '🎤 Voice message';
  return showMessageNotification(data);
}

function showCallNotification(data) {
  const { callerName, callerID, callType, callerPhoto } = data;
  const icon  = callType === 'video' ? '📹' : '📞';
  const label = callType === 'video' ? 'Incoming Video Call' : 'Incoming Voice Call';
  const chatURL = buildChatURL(callerID, callerName) + `&autocall=accept&calltype=${callType}`;

  return self.registration.showNotification(`${icon} ${callerName} is calling...`, {
    body:               label,
    icon:               callerPhoto || ICON,
    badge:              BADGE,
    tag:                'call-' + callerID,
    renotify:           true,
    requireInteraction: true,
    silent:             false,
    vibrate:            [500, 200, 500, 200, 500, 200, 500],
    timestamp:          Date.now(),
    data: { type: 'call', callerID, callerName, callType, url: chatURL },
    actions: [
      { action: 'accept',  title: '✅ Accept'  },
      { action: 'decline', title: '❌ Decline' }
    ]
  });
}

function showMissedCallNotification(data) {
  const { callerName, callerID, callType, callerPhoto } = data;
  const icon = callType === 'video' ? '📹' : '📞';

  // Close any still-ringing call notification
  self.registration.getNotifications({ tag: 'call-' + callerID })
    .then(n => n.forEach(x => x.close()));

  return self.registration.showNotification(`Missed call from ${callerName}`, {
    body:      `${icon} You missed a ${callType} call`,
    icon:      callerPhoto || ICON,
    badge:     BADGE,
    tag:       'missed-' + callerID,
    renotify:  true,
    silent:    false,
    vibrate:   [200, 100, 200],
    timestamp: Date.now(),
    data: { type: 'message', senderID: callerID, senderName: callerName, url: buildChatURL(callerID, callerName) },
    actions: [
      { action: 'open',  title: '💬 Open Chat' },
      { action: 'close', title: '✕ Dismiss'    }
    ]
  });
}

function showReactionNotification(data) {
  const { senderName, senderID, emoji, senderPhoto } = data;
  return self.registration.showNotification(`${senderName} reacted to your message`, {
    body:      emoji || '❤️',
    icon:      senderPhoto || ICON,
    badge:     BADGE,
    tag:       'reaction-' + senderID,
    renotify:  true,
    silent:    true,
    vibrate:   [100],
    timestamp: Date.now(),
    data: { type: 'message', senderID, senderName, url: buildChatURL(senderID, senderName) },
    actions: [
      { action: 'open',  title: '💬 Open'   },
      { action: 'close', title: '✕ Dismiss' }
    ]
  });
}

// ─── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action       = event.action;
  const data         = notification.data || {};

  notification.close();

  // Decline call
  if (data.type === 'call' && action === 'decline') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        if (clients.length > 0) {
          clients.forEach(c => c.postMessage({ type: 'DECLINE_CALL_FROM_NOTIFICATION', callerID: data.callerID }));
        } else {
          return self.clients.openWindow(buildChatURL(data.callerID, data.callerName));
        }
      })
    );
    return;
  }

  // Dismiss / close — no navigation
  if (action === 'close' || action === 'dismiss') return;

  // Open / Accept / tap body — navigate to chat
  const targetURL = data.url || (FCM_BASE + '/chats.html');
  event.waitUntil(navigateToURL(targetURL));
});

// ─── NOTIFICATION DISMISS (swipe away) ───────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  // Swipe-dismissing a call notification = decline
  if (event.notification.tag && event.notification.tag.startsWith('call-')) {
    const data = event.notification.data || {};
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients =>
      clients.forEach(c => c.postMessage({ type: 'DECLINE_CALL_FROM_NOTIFICATION', callerID: data.callerID }))
    );
  }
});

// ─── NAVIGATE HELPER ─────────────────────────────────────────────────────────
async function navigateToURL(targetURL) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  let targetID, targetIsChat;
  try {
    const u       = new URL(targetURL, self.location.origin);
    targetID      = u.searchParams.get('id');
    targetIsChat  = u.pathname.endsWith('chat.html');
  } catch (e) {}

  // Focus existing matching chat window
  for (const client of clients) {
    try {
      const u = new URL(client.url);
      if (targetIsChat && targetID && u.searchParams.get('id') === targetID) {
        return client.focus();
      }
    } catch (e) {}
  }

  // Navigate any open window
  for (const client of clients) {
    if ('navigate' in client) {
      try { return (await client.navigate(targetURL)).focus(); } catch (e) {}
    }
  }

  // No window — open new one
  return self.clients.openWindow(targetURL);
}
