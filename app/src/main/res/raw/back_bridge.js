// Translates the native back press to "escape key".

(function() {
  function dispatchKey(key, keyCode, code) {
    const downEvent = new KeyboardEvent('keydown', {
      key: key,
      keyCode: keyCode,
      code: code,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    const upEvent = new KeyboardEvent('keyup', {
      key: key,
      keyCode: keyCode,
      code: code,
      which: keyCode,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(downEvent);
    document.dispatchEvent(upEvent);
  }
  dispatchKey('Escape', 27, 'Escape');
})();

// Exit Bridge to react to exit button call.
(function () {
    if (window.location.href !== "https://www.youtube.com/tv#/") return;

    const observer = new MutationObserver((mutations, obs) => {
        const exitButton = document.querySelector('.ytVirtualListItemLast ytlr-button.zylon-ve');
        if (exitButton) {
            exitButton.addEventListener('keydown', (e) => {
                if (
                    e.key === 'Enter' &&
                    typeof ExitBridge !== 'undefined' &&
                    ExitBridge.onExitCalled
                ) {
                    ExitBridge.onExitCalled();
                }
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
