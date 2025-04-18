(function () {
    if (typeof window === "undefined") return;

    const messageHandler = (event) => {
        if (!event || !event.data) return;

        console.log("[Listener B] Received message:", event.data);
    };

    // Attach message listener to capture forwarded events
    window.addEventListener("message", messageHandler);

    // Cleanup when page unloads
    window.onunload = () => {
        window.removeEventListener("message", messageHandler);
    };
})();
