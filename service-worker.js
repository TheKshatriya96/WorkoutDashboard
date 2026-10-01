const CACHE_VERSION = 'workout-dashboard-v2-2026-09-30-4';
const APP_SHELL = [
  './',
  './index.html',
  './image-chart.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/css/image-chart.css',
  './assets/js/data.js',
  './assets/js/app.js',
  './assets/js/image-chart.js',
  './assets/js/storage/indexed-db.js',
  './assets/js/storage/storage-adapter.js',
  './assets/js/storage/supabase-sync.js',
  './assets/icons/icon.svg',
  './assets/icons/maskable-icon.svg',
  './assets/images/exercises/monday/01-band-resisted-push-up-a.png',
  './assets/images/exercises/monday/01-band-resisted-push-up-b.png',
  './assets/images/exercises/monday/02-feet-elevated-push-up-a.png',
  './assets/images/exercises/monday/02-feet-elevated-push-up-b.png',
  './assets/images/exercises/monday/03-deep-push-up-a.png',
  './assets/images/exercises/monday/03-deep-push-up-b.png',
  './assets/images/exercises/monday/04-pike-push-up-a.png',
  './assets/images/exercises/monday/04-pike-push-up-b.png',
  './assets/images/exercises/monday/05-band-lateral-raise-a.png',
  './assets/images/exercises/monday/05-band-lateral-raise-b.png',
  './assets/images/exercises/monday/06-band-triceps-extension-a.png',
  './assets/images/exercises/monday/06-band-triceps-extension-b.png',
  './assets/images/exercises/tuesday/01-strict-pull-up-a.png',
  './assets/images/exercises/tuesday/01-strict-pull-up-b.png',
  './assets/images/exercises/tuesday/02-band-lathi-row-a.png',
  './assets/images/exercises/tuesday/02-band-lathi-row-b.png',
  './assets/images/exercises/tuesday/03-one-arm-band-row-a.png',
  './assets/images/exercises/tuesday/03-one-arm-band-row-b.png',
  './assets/images/exercises/tuesday/04-straight-arm-pulldown-a.png',
  './assets/images/exercises/tuesday/04-straight-arm-pulldown-b.png',
  './assets/images/exercises/tuesday/05-rear-delt-fly-a.png',
  './assets/images/exercises/tuesday/05-rear-delt-fly-b.png',
  './assets/images/exercises/tuesday/06-band-biceps-curl-a.png',
  './assets/images/exercises/tuesday/06-band-biceps-curl-b.png',
  './assets/images/exercises/tuesday/07-hammer-band-curl-a.png',
  './assets/images/exercises/tuesday/07-hammer-band-curl-b.png',
  './assets/images/exercises/thursday/01-band-lathi-squat-a.png',
  './assets/images/exercises/thursday/01-band-lathi-squat-b.png',
  './assets/images/exercises/thursday/02-bulgarian-split-squat-a.png',
  './assets/images/exercises/thursday/02-bulgarian-split-squat-b.png',
  './assets/images/exercises/thursday/03-band-romanian-deadlift-a.png',
  './assets/images/exercises/thursday/03-band-romanian-deadlift-b.png',
  './assets/images/exercises/thursday/04-hip-thrust-a.png',
  './assets/images/exercises/thursday/04-hip-thrust-b.png',
  './assets/images/exercises/thursday/05-single-leg-calf-raise-a.png',
  './assets/images/exercises/thursday/05-single-leg-calf-raise-b.png',
  './assets/images/exercises/thursday/06-hanging-knee-raise-a.png',
  './assets/images/exercises/thursday/06-hanging-knee-raise-b.png',
  './assets/images/exercises/thursday/07-reverse-crunch-a.png',
  './assets/images/exercises/thursday/07-reverse-crunch-b.png',
  './assets/images/exercises/saturday/01-strict-pull-up-a.png',
  './assets/images/exercises/saturday/01-strict-pull-up-b.png',
  './assets/images/exercises/saturday/02-band-resisted-push-up-a.png',
  './assets/images/exercises/saturday/02-band-resisted-push-up-b.png',
  './assets/images/exercises/saturday/03-band-row-a.png',
  './assets/images/exercises/saturday/03-band-row-b.png',
  './assets/images/exercises/saturday/04-band-chest-fly-a.png',
  './assets/images/exercises/saturday/04-band-chest-fly-b.png',
  './assets/images/exercises/saturday/05-band-lateral-raise-a.png',
  './assets/images/exercises/saturday/05-band-lateral-raise-b.png',
  './assets/images/exercises/saturday/06-rear-delt-fly-a.png',
  './assets/images/exercises/saturday/06-rear-delt-fly-b.png',
  './assets/images/exercises/saturday/07-band-biceps-curl-a.png',
  './assets/images/exercises/saturday/07-band-biceps-curl-b.png',
  './assets/images/exercises/saturday/08-band-triceps-extension-a.png',
  './assets/images/exercises/saturday/08-band-triceps-extension-b.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;
  if (event.request.method !== 'GET') return;

  if (url.pathname.includes('/assets/images/exercises/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          return response;
        }))
      .catch(() => caches.match('./index.html'))
  );
});
