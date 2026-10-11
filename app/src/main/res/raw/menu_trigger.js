// Add a balanced menu button for NotubeTV
(function () {
  function getSearchBar() {
    return document.querySelector('ytlr-search-text-box') || document.querySelector('ytlr-search-bar');
  }

  function addMenuButton() {
    const searchBar = getSearchBar();
    if (!searchBar) return;

    const parent = searchBar.closest('ytlr-search-bar') || searchBar.parentNode;
    if (!parent || parent.querySelector('button[data-notubetv="menu"]')) return;

    // Thiết lập flex vừa vặn, không ép kích thước quá đà
    parent.style.display = 'flex';
    parent.style.flexDirection = 'row';
    parent.style.alignItems = 'center';

    const menuButton = document.createElement('button');
    menuButton.setAttribute('data-notubetv', 'menu');

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("height", "28px");
    svg.setAttribute("width", "28px");
    svg.setAttribute("viewBox", "0 -960 960 960");
    svg.setAttribute("fill", "#FFFFFF");
    svg.setAttribute("fill-opacity", "0.9");

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M480-480q0-91 64.5-155.5T700-700q91 0 155.5 64.5T920-480H480ZM260-260q-91 0-155.5-64.5T40-480h440q0 91-64.5 155.5T260-260Zm220-220q-91 0-155.5-64.5T260-700q0-91 64.5-155.5T480-920v440Zm0 440v-440q91 0 155.5 64.5T700-260q0 91-64.5 155.5T480-40Z");
    svg.appendChild(path);
    menuButton.appendChild(svg);

    // Kích thước chuẩn gọn gàng, tránh bóp méo layout
    menuButton.style.display = "flex";
    menuButton.style.justifyContent = "center";
    menuButton.style.alignItems = "center";
    menuButton.style.marginLeft = "16px";
    menuButton.style.padding = "10px";
    menuButton.style.background = "rgba(255, 255, 255, 0.15)";
    menuButton.style.border = "none";
    menuButton.style.borderRadius = "50%";
    menuButton.style.cursor = "pointer";

    parent.appendChild(menuButton);
  }

  const initInterval = setInterval(() => {
    if (getSearchBar()) {
      addMenuButton();
      clearInterval(initInterval);
    }
  }, 300);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight' || event.key === 'Enter') {
      const searchBar = getSearchBar();
      if (searchBar && searchBar.contains(document.activeElement)) {
        if (typeof modernUI === 'function') modernUI();
        const menuBtn = document.querySelector('button[data-notubetv="menu"]');
        if (menuBtn) menuBtn.style.background = '#000000';
      }
    }
  });

  const observer = new MutationObserver(() => {
    if (!document.querySelector('button[data-notubetv="menu"]')) {
      addMenuButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();