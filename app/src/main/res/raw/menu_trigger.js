// Add a "button" to fool you...
(function () {

  function getSearchBar() {
    // Dùng trực tiếp tên thẻ thay vì idomkey để không bị gãy khi YouTube update
    const searchBars = document.querySelectorAll('ytlr-search-text-box');
    return searchBars[searchBars.length - 1] ?? null;
  }

  function addMenuButton() {
    const searchBar = getSearchBar();
    if (!searchBar) return;

    const parent = searchBar.parentNode; // Chính là thẻ <ytlr-search-bar>
    if (parent.querySelector('button[data-notubetv="menu"]'))
      return; // Đã tồn tại thì bỏ qua

    // Căn chỉnh hiển thị theo chiều ngang
    parent.style.display = 'flex';
    parent.style.flexDirection = 'row';
    parent.style.alignItems = 'center';

    // Tạo nút NoTUbeTV Menu
    const menuButton = document.createElement('button');
    menuButton.setAttribute('data-notubetv', 'menu');
    menuButton.textContent = 'NoTubeTV Menu';
    menuButton.style.marginLeft = '60px';
    menuButton.style.padding = '16px 32px';
    menuButton.style.background = 'linear-gradient(90deg, #ff0000 0%, #e60000 50%, #b30000 100%)';
    menuButton.style.color = '#fff';
    menuButton.style.border = 'none';
    menuButton.style.borderRadius = '22px';
    menuButton.style.fontSize = '60px'; // Lưu ý font-size 60px có thể hơi to so với search box
    menuButton.style.fontWeight = 'bold';
    menuButton.style.height = '120px';

    // Chèn nút vào ngay sau khung search
    parent.insertBefore(menuButton, searchBar.nextSibling);
  }

  addMenuButton();

  // Bắt sự kiện bàn phím
  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight') {
      const searchBar = getSearchBar();
      
      // Sử dụng document.activeElement để check focus thay vì check class name (tránh lỗi class bị đổi)
      const isFocused = searchBar && searchBar.contains(document.activeElement);
      
      if (isFocused) {
        if (typeof modernUI === 'function') {
           modernUI(); // Gọi hàm từ 'userscript.js'
        }
        const menuBtn = document.querySelector('button[data-notubetv="menu"]');
        if (menuBtn) {
          menuBtn.style.background = 'black';
        }
      }
    }
  });

  // Tối ưu hoá Observer: Kiểm tra kỹ để tránh spam vòng lặp gây tràn RAM trên môi trường TV/Wrapper
  const observer = new MutationObserver((mutations) => {
    const searchBar = getSearchBar();
    // Chỉ chèn lại nếu searchBar đang render trên DOM và chưa có nút
    if (searchBar && document.body.contains(searchBar) && !searchBar.parentNode.querySelector('[data-notubetv="menu"]')) {
      addMenuButton(); 
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();