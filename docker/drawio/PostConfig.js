/**
 * EasyEA Draw.io Web PostConfig
 * Registers and auto-loads EasyEA Plugin inside Draw.io Web
 */
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;
EditorUi.enableLogging = false;
App.prototype.isDriveDomain = function() { return true; };

// Enable Custom Plugins and register easyea plugin alias
window.ALLOW_CUSTOM_PLUGINS = true;
if (typeof App !== 'undefined' && App.pluginRegistry) {
  App.pluginRegistry['easyea'] = 'plugins/easyea.js';
}

// Auto-inject EasyEA plugin via Draw.loadPlugin
if (typeof Draw !== 'undefined' && typeof Draw.loadPlugin === 'function') {
  var pluginScript = document.createElement('script');
  pluginScript.src = 'plugins/easyea.js';
  document.head.appendChild(pluginScript);
}
