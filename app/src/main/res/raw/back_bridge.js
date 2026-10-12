// File: back_bridge.js
(function() {
    function dispatchKey(key, keyCode, code) {
        const downEvent = new KeyboardEvent('keydown', { key, keyCode, code, which: keyCode, bubbles: true, cancelable: true });
        const upEvent = new KeyboardEvent('keyup', { key, keyCode, code, which: keyCode, bubbles: true, cancelable: true });
        document.dispatchEvent(downEvent);
        document.dispatchEvent(upEvent);
    }

    const video = document.querySelector('video');
    const isPlayingVideo = video && !video.paused;

    if (isPlayingVideo) {
        dispatchKey('Escape', 27, 'Escape');
        return;
    }

    const isRootPage = window.location.hash === "#/" || window.location.hash === "" || window.location.hash === "#" || window.location.href.includes("signin");

    if (!isRootPage) {
        window._exitPressCount = 0;
        if (window._exitTimer) clearTimeout(window._exitTimer);
        dispatchKey('Escape', 27, 'Escape');
        return;
    }

    if (!window._exitPressCount) window._exitPressCount = 0;
    window._exitPressCount++;

    if (window._exitPressCount === 1) {
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window._exitTimer = setTimeout(() => { 
            window._exitPressCount = 0; 
        }, 1200);
        dispatchKey('Escape', 27, 'Escape');
    } else if (window._exitPressCount >= 2) {
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window._exitPressCount = 0;
        if (typeof ExitBridge !== 'undefined' && ExitBridge.onExitCalled) {
            ExitBridge.onExitCalled();
        }
    }
})();