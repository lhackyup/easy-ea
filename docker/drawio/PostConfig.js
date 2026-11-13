/**
 * EasyEA Draw.io Web PostConfig
 * Registers and auto-loads EasyEA Plugin inside Draw.io Web
 */
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;
EditorUi.enableLogging = false;
App.prototype.isDriveDomain = function() { return true; };

// Fix Draw.io getResource and title resolution when plain strings or custom objects are passed
try {
  if (typeof EditorUi !== 'undefined' && EditorUi.prototype) {
    var origGetResource = EditorUi.prototype.getResource;
    EditorUi.prototype.getResource = function(obj) {
      if (typeof obj === 'string') return obj;
      if (obj && typeof obj === 'object') {
        var lang = (typeof mxLanguage !== 'undefined' && mxLanguage) ? mxLanguage : 'main';
        return obj[lang] || obj.main || obj.default || obj.it || obj.en || Object.values(obj)[0] || '';
      }
      if (origGetResource) {
        var res = origGetResource.apply(this, arguments);
        if (res !== null && res !== undefined) return res;
      }
      return (obj != null) ? String(obj) : '';
    };
  }

  if (typeof Sidebar !== 'undefined' && Sidebar.prototype) {
    var origSetTitleText = Sidebar.prototype.setTitleText;
    Sidebar.prototype.setTitleText = function(title, text) {
      if (!text || text === 'undefined') {
        // Prevent clearing title with 'undefined'
        return;
      }
      if (origSetTitleText) {
        origSetTitleText.apply(this, arguments);
      }
    };
  }
} catch (e) {}

// Enable Custom Plugins and register easyea plugin alias with cache-busting
window.ALLOW_CUSTOM_PLUGINS = true;
var easyeaVersion = '1.0.2-' + (window.EASYEA_CACHE_BUST || Date.now());
if (typeof App !== 'undefined' && App.pluginRegistry) {
  App.pluginRegistry['easyea'] = 'plugins/easyea.js?v=' + easyeaVersion;
}

// Auto-inject EasyEA plugin via script tag ONLY if not already loaded or queued
if (!window.EASYEA_PLUGIN_INJECTED) {
  window.EASYEA_PLUGIN_INJECTED = true;
  var pluginScript = document.createElement('script');
  pluginScript.src = 'plugins/easyea.js?v=' + easyeaVersion;
  document.head.appendChild(pluginScript);
}
