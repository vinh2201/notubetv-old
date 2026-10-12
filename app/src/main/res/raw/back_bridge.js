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

    // 1. Nếu đang xem video thì ẩn player bằng Escape
    if (isPlayingVideo) {
        dispatchKey('Escape', 27, 'Escape');
        return;
    }

    // 2. Nhận diện các trạng thái đặc biệt: Trang chủ hoặc màn hình đăng nhập (dựa trên thẻ cố định <ytlr-welcome>)
    const currentHash = window.location.hash;
    const isRoot = currentHash === "#/" || currentHash === "" || currentHash === "#";
    const isSignInScreen = !!document.querySelector('ytlr-welcome');

    // Nếu đang ở các trang con bên trong (không phải root và không phải màn hình đăng nhập) -> Lùi trang
    if (!isRoot && !isSignInScreen) {
        window._exitPressCount = 0;
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window.history.back();
        return;
    }

    // 3. Nếu đang ở Trang chủ hoặc Màn hình đăng nhập -> Thực hiện cơ chế bấm Back/Escape 2 lần liên tiếp để thoát hẳn app
    if (!window._exitPressCount) window._exitPressCount = 0;
    window._exitPressCount++;

    if (window._exitPressCount === 1) {
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window._exitTimer = setTimeout(() => { 
            window._exitPressCount = 0; 
        }, 1200);
        
        // Nếu ở trang chủ thì có thể gửi Escape nhẹ nhàng, còn ở màn hình đăng nhập thì giữ nguyên để chờ lần bấm thứ 2
        if (!isSignInScreen) {
            dispatchKey('Escape', 27, 'Escape');
        }
    } else if (window._exitPressCount >= 2) {
        if (window._exitTimer) clearTimeout(window._exitTimer);
        window._exitPressCount = 0;
        // Bấm lần 2 -> Gọi lệnh thoát app từ Android Native Bridge
        if (typeof ExitBridge !== 'undefined' && ExitBridge.onExitCalled) {
            ExitBridge.onExitCalled();
        }
    }
})();