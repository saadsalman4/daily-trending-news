// Service worker: receives push messages and opens the story when tapped.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Daily Brief", body: event.data ? event.data.text() : "" };
  }

  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: data.tag,
    renotify: Boolean(data.tag && data.tag.startsWith("breaking")),
    data: { url: data.url || "/" },
  };
  // Large images show on Android/desktop Chrome; iOS ignores this.
  if (data.image) options.image = data.image;

  event.waitUntil(self.registration.showNotification(data.title || "Daily Brief", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Internal links reuse an open app window; external articles open fresh.
      if (target.startsWith(self.location.origin)) {
        for (const client of windows) {
          if ("focus" in client) {
            await client.navigate(target).catch(() => {});
            return client.focus();
          }
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
