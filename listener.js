(function () {
    if (typeof window === "undefined") return;

    // Set to track detected iframes by their unique sources
    let detectedIframes = new Set();
    let hasNotifiedParent = false;
    let mixpanelChecked = false;

    // Track processed events to prevent duplicates
    const processedEvents = new Set();

    // Generate unique event identifier
    const getEventId = (eventName, detail) => {
        const stableId =
            detail?.gameId ||
            detail?.sessionId ||
            detail?.userId ||
            detail?.playerId ||
            detail?.id ||
            "default";
        return `${eventName}_${stableId}`;
    };

    // Check if Mixpanel is initialized (runs only once)
    const isMixpanelInitialized = () => {
        if (!mixpanelChecked) {
            mixpanelChecked = true;
            if (window.mixpanel && typeof window.mixpanel.track === "function") {
                console.log("Mixpanel is initialized and ready.");
                return true;
            }
            console.warn("Mixpanel is not initialized or unavailable.");
            return false;
        }
        return window.mixpanel && typeof window.mixpanel.track === "function";
    };

    // Improved origin validation to allow safe communication
    const isValidOrigin = (event) => {
        // Always allow messages from same origin or parent window
        if (event.origin === window.location.origin || event.source === window.parent) {
            return true;
        }

        // Allow localhost/127.0.0.1 origins for development
        if (/^http:\/\/localhost:\d+$/.test(event.origin) ||
            /^http:\/\/127\.0\.0\.1:\d+$/.test(event.origin)) {
            return true;
        }

        // Allow messages from detected iframe content windows
        const iframeWindows = [...detectedIframes].map(iframe => iframe.contentWindow);
        return iframeWindows.includes(event.source);
    };

    // Event message handler
    const messageHandler = (event) => {
        if (!event || !event.data) return;

        if (!isValidOrigin(event)) {
            console.debug("Message from unrecognized origin:", event.origin);
            return;
        }

        const { type, eventName, detail, popupShown } = event.data;

        // Generate unique event identifier to track events
        const eventId = getEventId(eventName || type, detail);

        // Skip if we've already processed this event
        if (processedEvents.has(eventId)) {
            return;
        }

        // Add to processed events to avoid duplicates
        processedEvents.add(eventId);

        // Clean up old events after 5 seconds
        setTimeout(() => {
            processedEvents.delete(eventId);
        }, 5000);

        // Track event via Mixpanel if initialized
        if (isMixpanelInitialized()) {
            try {
                if (type === 'custom' && eventName) {
                    window.mixpanel.track(eventName, detail);
                    console.log(`Mixpanel Tracked Custom Event: ${eventName}`, detail);
                } else if (type === 'standard') {
                    window.mixpanel.track('standard', detail);
                    console.log(`Mixpanel Tracked Standard Event: ${eventName}`, detail);
                }
            } catch (error) {
                console.error("Error in Mixpanel tracking:", error);
            }
        }

        // Handle game end event and notify parent window only once
        if (type === "custom" && eventName === "GGgameEnded" && !hasNotifiedParent) {
            hasNotifiedParent = true;
            console.log("GGgameEnded event intercepted. Notifying parent...");

            window.parent.postMessage(
                {
                    type: "GGgameEnded",
                    detail: detail,
                },
                "*"
            );

            // Reset hasNotifiedParent after a delay to allow for the next event
            setTimeout(() => {
                hasNotifiedParent = false;
            }, 1000);
        }
        // Forward all events to parent (test.html) except popupConfirmed
        if (type !== "popupConfirmed") {
            window.top.postMessage( //TODO: Always check hier
                {
                    type,
                    eventName,
                    detail,
                },
                "*"
            );
        }

    };

    // Detect iframes dynamically in the document
    const findIframes = (root = document) => {
        const iframes = root.querySelectorAll("iframe");
        iframes.forEach((iframe) => {
            if (!detectedIframes.has(iframe)) {
                detectedIframes.add(iframe);

                // Log iframe details (src or srcdoc)
                if (iframe.src) {
                    console.log("Iframe detected with src:", iframe.src);
                } else if (iframe.srcdoc) {
                    console.log("Iframe detected with srcdoc");
                }

                // Add event listener to iframe load event
                iframe.addEventListener('load', () => {
                    if (iframe.src) {
                        console.log("Iframe source updated:", iframe.src);
                    }
                });

                // Add message listener directly to iframe content window
                try {
                    // Skipping direct contentWindow message listeners to avoid duplication
                    // iframe.contentWindow.addEventListener('message', (e) => {
                    //     messageHandler(e);
                    // });
                } catch (err) {
                    // Ignore cross-origin errors
                }
            }
        });
    };

    // Monitor DOM changes for dynamic iframe additions or removals
    const observeIframes = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.tagName === "IFRAME") {
                        detectedIframes.add(node);
                        console.log("New iframe added:", node.src || "with srcdoc");
                    } else if (node.nodeType === 1) {
                        findIframes(node);
                    }
                });

                mutation.removedNodes.forEach((node) => {
                    if (node.tagName === "IFRAME" && detectedIframes.has(node)) {
                        console.log("Iframe removed:", node.src || "with srcdoc");
                        detectedIframes.delete(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        findIframes();
    };

    // Initialize the iframe observation and message listener when the DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observeIframes();

            // Attach message handler only once
            if (!window.__messageHandlerAttached) {
                window.addEventListener("message", messageHandler);
                window.__messageHandlerAttached = true;
            }
        });
    } else {
        observeIframes();

        // Attach message handler only once
        if (!window.__messageHandlerAttached) {
            window.addEventListener("message", messageHandler);
            window.__messageHandlerAttached = true;
        }
    }

    // Clean up listeners when the window is unloaded
    window.onunload = () => {
        window.removeEventListener("message", messageHandler);
        window.__messageHandlerAttached = false;
    };
})();
