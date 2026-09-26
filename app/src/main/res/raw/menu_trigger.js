// Add a "button" to fool you...
(function () {

  function getSearchBar() {
    const searchBars = document.querySelectorAll('[idomkey="ytLrSearchBarSearchTextBox"]');
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
    const menuButton = document.createElement('button');
    menuButton.setAttribute('data-notubetv', 'menu');
    menuButton.textContent = 'NoTubeTV Menu';
    menuButton.style.marginLeft = '60px';
    menuButton.style.padding = '16px 32px';
    menuButton.style.background = 'linear-gradient(90deg, #ff0000 0%, #e60000 50%, #b30000 100%)';
    menuButton.style.color = '#fff';
    menuButton.style.border = 'none';
    menuButton.style.borderRadius = '22px';
    menuButton.style.fontSize = '60px';
    menuButton.style.fontWeight = 'bold';
    menuButton.style.height = '120px';

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