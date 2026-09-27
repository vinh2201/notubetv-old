// Add a "button" to fool you...
(function () {

  function getSearchBar() {
    const searchBars = document.querySelectorAll('[idomkey="sLdtsd"]');
    return searchBars[searchBars.length - 1] ?? null;
  }

  function addMenuButton() {

    const searchBar = getSearchBar();
    if (!searchBar) return;
    console.log('Search bar found');

    const parent = searchBar.parentNode;
    if (parent.querySelector('button[data-notubetv="menu"]'))
      return // already exists

    // Align horizontally to the search box
    parent.style.display = 'flex';
    parent.style.flexDirection = 'row';
    parent.style.alignItems = 'center';

    // Create the NoTUbeTV Menu button
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

  // Here the fooling part begins.
  // If the search tab is focused and the 'right arrow" is pressed, open up the menu.
  document.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') {
       const searchBar = getSearchBar();
       const isFocused = searchBar?.classList?.contains('ytLrSearchTextBoxFocused');
       if (searchBar && isFocused) {
          modernUI(); // from 'userscript.js'
          menuButton = document.querySelector('button[data-notubetv="menu"]');
          menuButton.style.background = 'black'
       }
      }
    });


  const observer = new MutationObserver((mutations) => {


    const searchBar = getSearchBar();
    if (searchBar && !searchBar.parentNode.querySelector('[data-notubetv="menu"]')) {
      addMenuButton(); // Re-add if missing
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();