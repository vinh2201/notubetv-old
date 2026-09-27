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
    const menuButton = document.createElement("button");
    menuButton.setAttribute("data-notubetv", "menu");
    menuButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="56px" viewBox="0 -960 960 960" width="56px" fill="#FFFFFF" fill-opacity="0.8">
        <path d="M480-480q0-91 64.5-155.5T700-700q91 0 155.5 64.5T920-480H480ZM260-260q-91 0-155.5-64.5T40-480h440q0 91-64.5 155.5T260-260Zm220-220q-91 0-155.5-64.5T260-700q0-91 64.5-155.5T480-920v440Zm0 440v-440q91 0 155.5 64.5T700-260q0 91-64.5 155.5T480-40Z"/>
      </svg>`;
    menuButton.style.marginLeft = "54px";
    menuButton.style.padding = "35px";
    menuButton.style.background = "rgba(255, 255, 255, 0.1)";
    menuButton.style.border = "none";
    menuButton.style.borderRadius = "88px";

    // Insert right next the search box
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