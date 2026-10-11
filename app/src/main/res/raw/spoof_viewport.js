// Enables 1080p Leanback scaling safely via viewport meta tag
(function() {
    var existing = document.querySelector('meta[name="viewport"]');
    if (existing) {
        existing.setAttribute('content', 'width=1920, height=1080, initial-scale=1.0');
    } else {
        var meta = document.createElement('meta');
        meta.name = 'viewport';
        meta.content = 'width=1920, height=1080, initial-scale=1.0';
        document.head.appendChild(meta);
    }
})();