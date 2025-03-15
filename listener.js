(function () {
    if (typeof window === "undefined") return; // Ensure script runs only on the client

    console.log("Iframe listener script loaded");

    let detectedIframes = new Set(); // to store all detected iframes
   


    const messageHandler = (event) => {
        const validIframe = [...detectedIframes].some((iframe) => { //validating iframe
            return event.origin === new URL(iframe.src).origin;
        });


        if (!validIframe) return;

        const { type, ...data } = event.data;

        if (type === "REQUEST_DATA") {
            console.log("Parent handling data request.");
            event.source?.postMessage(
                {
                    type: "DATA_RESPONSE",
                    message: "Hi User",
                    loginStatus: "User",
                    parentData: { key: "value_from_parent" },
                },
                event.origin
            );
        } else if (type) {
            // Commented out Mixpanel tracking, replaced with logs
            // mixpanel.track(type, data);
            console.log(`Tracked iframe event: ${type}`, data);

            if (data.userId) {
                console.log(`Identifying user: ${data.userId}`);
                // mixpanel.identify(data.userId);
                // mixpanel.people.set({
                //     $name: data.userName || "Unknown User",
                //     $email: data.userEmail || "No Email",
                // });
            }
        }
    };

    // Detect and track all iframes (including dynamically added ones)
    const findIframes = (root = document) => {
        const iframes = root.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
            if (!detectedIframes.has(iframe)) {
                console.log("Iframe detected:", iframe.src);
                detectedIframes.add(iframe);
            }
        });
    };

    // Observe DOM changes to detect dynamically added iframes
    const observeIframes = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === "IFRAME") {
                        console.log("New iframe detected:", node.src);
                        detectedIframes.add(node);
                    } else if (node.nodeType === 1) {
                        // Check for nested iframes
                        findIframes(node);
                    }
                });

                // Handle removed iframes
                mutation.removedNodes.forEach((node) => {
                    if (node.tagName === "IFRAME") {
                        console.log("Iframe removed:", node.src);
                        detectedIframes.delete(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initial scan for existing iframes
        findIframes();
    };

    observeIframes();
    window.addEventListener("message", messageHandler);

    // Intercept events from iframes
    const interceptAllEvents = () => {
        const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
        EventTarget.prototype.dispatchEvent = function (event) {
            if ([...detectedIframes].some(iframe => event.target === iframe.contentWindow) || event.target === window) {
                if (event instanceof CustomEvent) {
                    //console.log(`[Iframe Custom Event Intercepted]: ${event.type}`, event.detail);
                    // mixpanel.track(`CUSTOM_${event.type}`, event.detail || {});
                    console.log(`Tracked custom event: CUSTOM_${event.type}`, event.detail);

                    event.target.postMessage({
                        type: `CUSTOM_${event.type}`,
                        detail: event.detail || {},
                    }, "*");
                } else {
                    //console.log(`[Iframe Standard Event Intercepted]: ${event.type}`, event);
                    // mixpanel.track(`STANDARD_${event.type}`);
                    console.log(`(Tracked standard event: STANDARD_${event.type})`);

                    event.target.postMessage({
                        type: `STANDARD_${event.type}`,
                    }, "*");
                }
            }
            return originalDispatchEvent.call(this, event);
        };
    };

    interceptAllEvents();

    // Cleanup function
    window.onunload = () => {
        window.removeEventListener("message", messageHandler);
    };
})();
