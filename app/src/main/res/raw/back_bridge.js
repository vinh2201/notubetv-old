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

// Exit Bridge to react to exit button call safely.
(function () {
  function __notubeRafThrottle(fn) {
    var scheduled = false;
    return function () {
      if (scheduled) return;
      scheduled = true;
      var raf = window.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      raf(function () {
        scheduled = false;
        fn();
      });
    };
  }

  const observer = new MutationObserver(
    __notubeRafThrottle(function () {
      const exitButton = document.querySelector(
        ".ytVirtualListItemLast ytlr-button.ytLrButtonLargeShape"
      );

      if (!exitButton) return;
      if (exitButton.dataset.notubetvExitBound === "1") return;
      exitButton.dataset.notubetvExitBound = "1";

      exitButton.addEventListener(
        "keydown",
        (e) => {
          if (
            (e.key === "Enter" || e.keyCode === 13) &&
            typeof ExitBridge !== "undefined" &&
            ExitBridge.onExitCalled
          ) {
            e.preventDefault();
            e.stopPropagation();
            ExitBridge.onExitCalled();
          }
        },
        true
      );
    })
  );
  observer.observe(document.body, { childList: true, subtree: true });
})();