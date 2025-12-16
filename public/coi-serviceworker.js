/*! coi-serviceworker v0.1.7 - Modified for stability */

if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (ev) => {
        if (!ev.data) {
            return;
        } else if (ev.data.type === "deregister") {
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
                        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
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
        // If already isolated, we don't need to do anything
        if (window.crossOriginIsolated) {
            return;
        }

        const n = navigator;
        if (n.serviceWorker) {
            n.serviceWorker.register(window.document.currentScript.src || 'coi-serviceworker.js').then(
                (registration) => {
                    console.log("COI Service Worker registered");
                    
                    // If the controller is already active but we are not isolated, reload
                    if (registration.active && !window.crossOriginIsolated) {
                        console.log("Reloading to enable COOP/COEP...");
                        window.location.reload();
                    }

                    registration.addEventListener("updatefound", () => {
                        console.log("New COI Service Worker found, reloading...");
                        window.location.reload();
                    });
                },
                (err) => {
                    console.error("COI Service Worker failed to register:", err);
                }
            );
        } else {
            console.warn("Service Workers are not supported in this environment (is it secure context?)");
        }
    })();
}