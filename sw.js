const CACHE_NAME = 'swiftfile-v3';
const ASSETS = [
  './',
  './index.html',
  './logo.png',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Handle share target POST requests
  if (e.request.method === 'POST' && (url.pathname.endsWith('share-target.html') || url.pathname.endsWith('share-target'))) {
    e.respondWith(
      (async () => {
        try {
          const formData = await e.request.formData();
          const files = formData.getAll('files');
          const text = formData.get('text') || '';
          const title = formData.get('title') || '';
          const sharedUrl = formData.get('url') || '';

          // Open IndexedDB to store the shared items
          const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open('SwiftFileShareDB', 1);
            req.onupgradeneeded = (evt) => {
              const database = evt.target.result;
              if (!database.objectStoreNames.contains('shared-files')) {
                database.createObjectStore('shared-files', { keyPath: 'id', autoIncrement: true });
              }
            };
            req.onsuccess = (evt) => resolve(evt.target.result);
            req.onerror = (evt) => reject(evt.target.error);
          });

          // Store files in DB
          const transaction = db.transaction('shared-files', 'readwrite');
          const store = transaction.objectStore('shared-files');

          for (const file of files) {
            if (file && file.size > 0) {
              const buffer = await file.arrayBuffer();
              store.add({
                name: file.name,
                type: file.type,
                data: buffer
              });
            }
          }

          if (text || title || sharedUrl) {
            // Also store text/link shares as text file
            const shareText = `Title: ${title}\nText: ${text}\nURL: ${sharedUrl}`;
            const textEncoder = new TextEncoder();
            const buffer = textEncoder.encode(shareText).buffer;
            store.add({
              name: 'shared_link.txt',
              type: 'text/plain',
              data: buffer
            });
          }

          await new Promise((resolve) => {
            transaction.oncomplete = () => {
              db.close();
              resolve();
            };
          });

          // Redirect to main page with query params to parse the shared files
          return Response.redirect('./index.html?shared=1', 303);

        } catch (err) {
          console.error('SW share error:', err);
          return Response.redirect('./index.html?share-error=1', 303);
        }
      })()
    );
    return;
  }

  // Normal fetch
  e.respondWith(
    (async () => {
      // Network-First for index.html & the root directory
      if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname === '/index.html') {
        try {
          const networkResponse = await fetch(e.request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Network failed, fall back to cached version
        }
      }

      // Default to Cache-First for static assets
      const cachedResponse = await caches.match(e.request);
      return cachedResponse || fetch(e.request);
    })()
  );
});
