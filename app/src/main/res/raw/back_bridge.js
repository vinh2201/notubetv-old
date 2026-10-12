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

    // 1. Nếu đang xem video thì giả lập phím Escape để YouTube TV đóng player
    if (isPlayingVideo) {
        dispatchKey('Escape', 27, 'Escape');
        return;
    }

    // 2. Kiểm tra xem có đang ở trang chủ (root) hay không
    const currentHash = window.location.hash;
    const isAtRoot = currentHash === "#/" || currentHash === "" || currentHash === "#";

    if (!isAtRoot) {
        // Nếu đang ở các trang con (Tin tức, Thư viện,...), cho phép lùi về trang trước
        window._exitPressCount = 0;
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window.history.back();
        return;
    }

    // 3. Nếu đã ở trang chủ, thực hiện cơ chế bấm 2 lần liên tiếp để thoát hẳn app
    if (!window._exitPressCount) window._exitPressCount = 0;
    window._exitPressCount++;

    if (window._exitPressCount === 1) {
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window._exitTimer = setTimeout(() => { 
            window._exitPressCount = 0; 
        }, 1200);
    } else if (window._exitPressCount >= 2) {
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window._exitPressCount = 0;
        if (typeof ExitBridge !== 'undefined' && ExitBridge.onExitCalled) {
            ExitBridge.onExitCalled();
        }
    }
})();