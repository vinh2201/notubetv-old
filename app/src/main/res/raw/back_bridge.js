// File: back_bridge.js
(function() {
    function dispatchKey(key, keyCode, code) {
        const downEvent = new KeyboardEvent('keydown', { key, keyCode, code, which: keyCode, bubbles: true, cancelable: true });
        const upEvent = new KeyboardEvent('keyup', { key, keyCode, code, which: keyCode, bubbles: true, cancelable: true });
        document.dispatchEvent(downEvent);
        document.dispatchEvent(upEvent);
    }

    // Kiểm tra xem user có đang trỏ vào thẻ item cuối cùng của sidebar hay không (.ytVirtualListItemLast)
    const lastItem = document.querySelector('.ytVirtualListItemLast');
    const isFocusedOnLastItem = lastItem && lastItem.contains(document.activeElement);

    if (isFocusedOnLastItem) {
        if (!window._exitPressCount) window._exitPressCount = 0;
        window._exitPressCount++;

        if (window._exitPressCount === 1) {
            if (window._exitTimer) clearTimeout(window._exitTimer);
            window._exitTimer = setTimeout(() => {
                window._exitPressCount = 0;
            }, 1200);
            // Gửi phím Escape lần đầu
            dispatchKey('Escape', 27, 'Escape');
        } else if (window._exitPressCount >= 2) {
            if (window._exitTimer) clearTimeout(window._exitTimer);
            window._exitPressCount = 0;
            // Nhấn lần 2 liên tiếp ở vị trí này -> Thoát ứng dụng
            if (typeof ExitBridge !== 'undefined' && ExitBridge.onExitCalled) {
                ExitBridge.onExitCalled();
                return;
            }
        }
    } else {
        // Reset bộ đếm và thực hiện hành vi Escape bình thường (đóng video, quay lại menu...)
        window._exitPressCount = 0;
        dispatchKey('Escape', 27, 'Escape');
    }
})();