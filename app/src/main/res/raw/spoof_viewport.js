// Enables Full HD 1080p resolution tricking YouTube into correct Leanback TV scaling
(function () {
  if (window.__notube_spoof_applied) return;
  window.__notube_spoof_applied = true;

  // Sử dụng chuẩn 1920x1080 để giao diện hiển thị vừa vặn, không bị phình to quá cỡ
  var TARGET_WIDTH = 1920;
  var TARGET_HEIGHT = 1080;

  function defineReadOnly(obj, prop, value) {
    try {
      Object.defineProperty(obj, prop, {
        get: function () { return value; },
        configurable: true,
      });
    } catch (_) {}
  }

  try {
    if (window.screen) {
      defineReadOnly(window.screen, "width", TARGET_WIDTH);
      defineReadOnly(window.screen, "height", TARGET_HEIGHT);
      defineReadOnly(window.screen, "availWidth", TARGET_WIDTH);
      defineReadOnly(window.screen, "availHeight", TARGET_HEIGHT);
    }

    var existing = document.querySelector('meta[name="viewport"]');
    var content = "width=device-width, initial-scale=1.0";
    if (existing) {
      existing.setAttribute("content", content);
    } else {
      var meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = content;
      (document.head || document.documentElement).appendChild(meta);
    }
  } catch (_) {}
})();