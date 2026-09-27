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
    const observer = new MutationObserver((mutations, obs) => {
        const exitButton = document.querySelector('.ytVirtualListItemLast ytlr-button.ytLrButtonLargeShape');

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
            exitButton.addEventListener('click', (e) => {
                if (
                    typeof ExitBridge !== 'undefined' &&
                    ExitBridge.onExitCalled
                ) {
                    ExitBridge.onExitCalled();
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            obs.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
