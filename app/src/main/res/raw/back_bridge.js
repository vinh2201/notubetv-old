(function () {
    const observer = new MutationObserver(() => {
        const exitSelectors = [
            ".ytVirtualListItemLast ytlr-button.ytLrButtonLargeShape",
            "[aria-label='Exit']",
            "[aria-label='Close']",
            "button[aria-label*='exit' i]",
            "button[aria-label*='close' i]",
            ".ytlr-guide-entry-renderer[tabindex='0']:last-child",
            "[idomkey='guide-entry']:last-child"
        ];

        let exitButton = null;
        for (const selector of exitSelectors) {
            exitButton = document.querySelector(selector);
            if (exitButton) break;
        }

        if (exitButton && !exitButton.dataset.exitBridgeAttached) {
            exitButton.dataset.exitBridgeAttached = "true";
            exitButton.addEventListener(
                "keydown",
                (e) => {
                    if (
                        (e.key === "Enter" || e.keyCode === 13) &&
                        typeof ExitBridge !== "undefined" &&
                        ExitBridge.exit
                    ) {
                        e.preventDefault();
                        e.stopPropagation();
                        ExitBridge.exit();
                    }
                },
                true
            );

            exitButton.addEventListener("click", (e) => {
                if (typeof ExitBridge !== "undefined" && ExitBridge.exit) {
                    e.preventDefault();
                    ExitBridge.exit();
                }
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();