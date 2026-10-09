'use strict';

module.exports = function(electronApp, menuState) {
  return [
    {
      label: '⚙️ Settings / Login...',
      accelerator: 'CommandOrControl+Alt+E',
      enabled: true,
      action: function() {
        electronApp.emit('menu:action', 'emit-event', { type: 'easyea:openSettings' });
      }
    },
    {
      label: '📥 Check-out BPMN Process...',
      accelerator: 'CommandOrControl+Alt+O',
      enabled: true,
      action: function() {
        electronApp.emit('menu:action', 'emit-event', { type: 'easyea:checkoutSchema' });
      }
    },
    {
      label: '🔍 Insert Element from EA Catalog...',
      accelerator: 'CommandOrControl+Alt+I',
      enabled: true,
      action: function() {
        electronApp.emit('menu:action', 'emit-event', { type: 'easyea:insertFromCatalog' });
      }
    },
    {
      label: '💾 Save as New Schema in EasyEA...',
      accelerator: 'CommandOrControl+Alt+N',
      enabled: true,
      action: function() {
        electronApp.emit('menu:action', 'emit-event', { type: 'easyea:createSchema' });
      }
    },
    {
      label: '📤 Check-in Process (Commit & Diff)...',
      accelerator: 'CommandOrControl+Alt+S',
      enabled: true,
      action: function() {
        electronApp.emit('menu:action', 'emit-event', { type: 'easyea:checkinSchema' });
      }
    },
    {
      label: '🔓 Discard Check-out...',
      accelerator: 'CommandOrControl+Alt+D',
      enabled: true,
      action: function() {
        electronApp.emit('menu:action', 'emit-event', { type: 'easyea:discardCheckout' });
      }
    }
  ];
};
