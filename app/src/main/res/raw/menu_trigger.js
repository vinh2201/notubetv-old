// Add a menu button and handle remote triggers safely
(function () {
  // Gom nhóm requestAnimationFrame để tránh nghẽn luồng UI (jank)
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

  function getSearchBar() {
    const searchBars = document.querySelectorAll(
      '[idomkey="ytLrSearchBarSearchTextBox"]'
    );
    return searchBars[searchBars.length - 1] ?? null;
  }

  function addMenuButton() {
    const searchBar = getSearchBar();
    if (!searchBar) return;

    const parent = searchBar.parentNode;
    if (parent.querySelector('button[data-notubetv="menu"]')) return;

    parent.style.display = "flex";
    parent.style.flexDirection = "row";
    parent.style.alignItems = "center";

    const menuButton = document.createElement("button");
    menuButton.setAttribute("data-notubetv", "menu");
    menuButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#FFFFFF" fill-opacity="0.8">
        <path d="M480-480q0-91 64.5-155.5T700-700q91 0 155.5 64.5T920-480H480ZM260-260q-91 0-155.5-64.5T40-480h440q0 91-64.5 155.5T260-260Zm220-220q-91 0-155.5-64.5T260-700q0-91 64.5-155.5T480-920v440Zm0 440v-440q91 0 155.5 64.5T700-260q0 91-64.5 155.5T480-40Z"/>
      </svg>`;
    menuButton.style.marginLeft = "36px";
    menuButton.style.padding = "24px";
    menuButton.style.background = "rgba(255, 255, 255, 0.1)";
    menuButton.style.border = "none";
    menuButton.style.borderRadius = "56px";

    parent.insertBefore(menuButton, searchBar.nextSibling);
  }

  addMenuButton();

  document.addEventListener("keydown", function (event) {
    if (event.key === "ArrowRight") {
      const searchBar = getSearchBar();
      const isFocused = searchBar?.classList?.contains(
        "ytLrSearchTextBoxFocused"
      );
      if (searchBar && isFocused) {
        if (typeof modernUI === 'function') {
          modernUI();
        }
        const menuButton = document.querySelector(
          'button[data-notubetv="menu"]'
        );
        if (menuButton) menuButton.style.background = "white";
      }
    }
  });

  const observer = new MutationObserver(
    __notubeRafThrottle(function () {
      const searchBar = getSearchBar();
      if (
        searchBar &&
        !searchBar.parentNode.querySelector('[data-notubetv="menu"]')
      ) {
        addMenuButton();
      }
    })
  );

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();