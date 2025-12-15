/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let coepCredentialless = false;
if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "deregister") {
      self.registration.unregister().then(() => {
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach((client) => client.navigate(client.url));
      });
    }
  });

  self.addEventListener("fetch", function (event) {
    if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
      return;
    }

    if (event.request.mode === "navigate") {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
          })
          .catch((e) => console.error(e))
      );
    }
  });

} else {
  (() => {
    // You can customize the path to your service worker here if needed
    // In this setup, it's in the same directory.
    
    if (window.crossOriginIsolated) {
        return;
    }

    const n = navigator;
    if (n.serviceWorker) {
        n.serviceWorker.register(window.document.currentScript.src).then(
          (registration) => {
            console.log("COI Service Worker registered. Reloading...");
            registration.addEventListener("updatefound", () => {
                window.location.reload();
            });
            if (registration.active) {
                window.location.reload();
            }
          },
          (err) => {
            console.error("COI Service Worker failed to register:", err);
          }
        );
    }
  })();
}