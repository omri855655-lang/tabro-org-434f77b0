// Push-only worker: it never caches private app pages or API responses.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const TABRO_ICON = '/icons/tabro-v3-192.png';
const TABRO_BADGE = '/icons/tabro-badge-v3-96.png';

self.addEventListener('push', (event) => {
  let data = { title: 'Tabro', body: 'יש לך עדכון חדש' };
  
  try {
    if (event.data) {
      const received = event.data.json();
      if (received && typeof received === 'object' && !Array.isArray(received)) data = { ...data, ...received };
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
  }

  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 500) : '',
    icon: TABRO_ICON,
    badge: TABRO_BADGE,
    dir: 'rtl',
    lang: 'he',
    ...(typeof data.tag === 'string' && data.tag ? { tag: data.tag.slice(0, 200) } : {}),
    data: data.url ? { url: data.url } : {},
    actions: Array.isArray(data.actions) ? data.actions.filter(item => item && typeof item.action === 'string' && typeof item.title === 'string').slice(0, 2) : [],
  };

  const title = typeof data.title === 'string' && data.title.trim() ? data.title.slice(0, 150) : 'Tabro';
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let url = new URL('/personal', self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url || '/personal', self.location.origin);
    if (requested.origin === self.location.origin) url = requested;
  } catch { /* Keep malformed or external targets inside the app. */ }
  event.waitUntil(self.clients.openWindow(url.href));
});
