// File: back_bridge.js
(function() {
    // Dịch phím Back vật lý thành Escape (nếu cần dùng qua BackHandler)
    function dispatchKey(key, keyCode, code) {
        const downEvent = new KeyboardEvent('keydown', { key, keyCode, code, which: keyCode, bubbles: true, cancelable: true });
        const upEvent = new KeyboardEvent('keyup', { key, keyCode, code, which: keyCode, bubbles: true, cancelable: true });
        document.dispatchEvent(downEvent);
        document.dispatchEvent(upEvent);
    }
    window.dispatchEscapeKey = () => dispatchKey('Escape', 27, 'Escape');
})();

// Logic Exit: Nhấn phím Escape 2 lần liên tiếp khi đang trỏ (focus) ở thẻ item cuối cùng trong menu sidebar (.ytVirtualListItemLast)
(function () {
    if (window.location.href !== "https://www.youtube.com/tv#/") return;

    let escapeCount = 0;
    let escapeTimer = null;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.keyCode === 27) {
            // Thẻ item cuối cùng trên thanh sidebar (nơi chứa profile/cài đặt/thoát)
            const lastItem = document.querySelector('.ytVirtualListItemLast');
            
            // Kiểm tra xem phần tử đang active/focus có nằm trong thẻ đó hay không
            const isFocusedOnLastItem = lastItem && lastItem.contains(document.activeElement);

            if (isFocusedOnLastItem) {
                escapeCount++;
                
                if (escapeCount === 1) {
                    // Đợi lần bấm Escape tiếp theo trong vòng 1.2 giây
                    escapeTimer = setTimeout(() => {
                        escapeCount = 0;
                    }, 1200);
                } else if (escapeCount >= 2) {
                    clearTimeout(escapeTimer);
                    escapeCount = 0;
                    if (typeof ExitBridge !== 'undefined' && ExitBridge.onExitCalled) {
                        ExitBridge.onExitCalled();
                    }
                }
            } else {
                // Nếu user trỏ ra chỗ khác thì reset đếm
                escapeCount = 0;
                clearTimeout(escapeTimer);
            }
        }
    }, true);
})();