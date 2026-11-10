/**
 * EasyEA Draw.io Web PreConfig
 */
(function() {
  try {
    var s = document.createElement('meta');
    s.setAttribute('content', 'default-src * \'unsafe-inline\' \'unsafe-eval\' data: blob:; connect-src * \'unsafe-inline\';');
    s.setAttribute('http-equiv', 'Content-Security-Policy');
    var t = document.getElementsByTagName('meta')[0];
    if (t && t.parentNode) {
      t.parentNode.insertBefore(s, t);
    }
  } catch (e) {}
})();

window.DRAWIO_SERVER_URL = window.location.origin + '/';
window.DRAWIO_BASE_URL = window.location.origin;
window.DRAWIO_VIEWER_URL = '';
window.DRAWIO_LIGHTBOX_URL = '';
window.EXPORT_URL = null;
window.ALLOW_CUSTOM_PLUGINS = true;

// Ensure plugins are enabled and auto-load easyea
urlParams['plugins'] = '1';
if (!urlParams['p']) {
  urlParams['p'] = 'easyea';
} else if (urlParams['p'].indexOf('easyea') === -1) {
  urlParams['p'] = urlParams['p'] + ';easyea';
}
