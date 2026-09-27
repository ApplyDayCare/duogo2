const CACHE_NAME = "duogo-pwa-v4";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/favicon.ico"]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first fetch handler satisfying Chromium PWA install criteria
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL).then((res) => res || Response.error());
      })
    );
    return;
  }
  // For static assets or API requests, fetch from network directly
  event.respondWith(fetch(event.request));
});

// Web Push handling
self.addEventListener("push", (event) => {
  let data = {
    title: "duogo",
    body: "You have a new update in duogo",
    url: "/notifications",
    type: "general",
    tag: "duogo-notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    timestamp: Date.now(),
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = { ...data, ...payload };
    }
  } catch (e) {
    try {
      if (event.data) {
        data.body = event.data.text();
      }
    } catch {
      // ignore
    }
  }

  // Determine actions based on notification type
  const actions = [];
  if (data.type === "chat" || data.type === "chat_message") {
    actions.push({ action: "open_chat", title: "💬 Open Chat" });
    actions.push({ action: "dismiss", title: "Dismiss" });
  } else if (data.type === "match" || data.type === "match_request" || data.type === "mutual_match") {
    actions.push({ action: "view_match", title: "✨ View Match" });
    actions.push({ action: "dismiss", title: "Dismiss" });
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    image: data.image || undefined,
    data: {
      url: data.url || "/notifications",
      type: data.type,
      tag: data.tag,
      matchId: data.matchId,
    },
    tag: data.tag || `duogo-${data.type || "general"}-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.type === "mutual_match" || data.type === "chat",
    actions: actions.length > 0 ? actions : undefined,
  };

  event.waitUntil(self.registration.showNotification(data.title, notificationOptions));
});

// Handle local background messages posted from client when tab is hidden
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_BACKGROUND_NOTIFICATION") {
    const { title, options } = event.data.payload || {};
    if (title && self.registration && self.registration.showNotification) {
      event.waitUntil(
        self.registration.showNotification(title, {
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [200, 100, 200],
          ...options,
        })
      );
    }
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const action = event.action;
  if (action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  const applicationServerKey = urlBase64ToUint8Array("BM2wzi9DNHlsYCm45Gn6JC6CAvoYW4HiEYj_-DWz3NqWD3Tybm4Qr82cI4taetONkD-oXaMiA_c_nNiRB2ZTXS4");
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      })
      .then((newSub) => {
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "PUSH_SUBSCRIPTION_CHANGED",
              subscription: newSub ? newSub.toJSON() : null,
            });
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] pushsubscriptionchange failed:", err);
      })
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

