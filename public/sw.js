// Service worker del gestionale (24/11/2026): serve solo per le notifiche push. Non salva pagine né dati sul dispositivo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titolo: 'Salzillo Hospitality', testo: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.titolo || 'Salzillo Hospitality', {
    body: d.testo || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/nuovo' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/nuovo';
  event.waitUntil((async () => {
    const aperte = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of aperte) {
      if ('focus' in c) { try { await c.navigate(url); } catch { /* */ } return c.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
