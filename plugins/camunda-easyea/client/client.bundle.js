/**
 * EasyEA Integration Suite for Camunda Modeler Desktop (v5.x+)
 * Client extension communicating with Camunda Modeler EventBus and EasyEA REST API
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'easyea_config';
  var ACTIVE_CHECKOUT_KEY = 'easyea_active_checkout';

  var state = {
    serverUrl: 'http://localhost:8000',
    token: '',
    username: '',
    fullName: '',
    activeModelId: null,
    activeSchema: null
  };

  var activeModeler = null;
  var camundaProps = null;

  // Load configuration from localStorage
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      var parsed = JSON.parse(saved);
      state.serverUrl = parsed.serverUrl || 'http://localhost:8000';
      state.token = parsed.token || '';
      state.username = parsed.username || '';
      state.fullName = parsed.fullName || '';
      state.activeModelId = parsed.activeModelId || null;
    }
    var activeCheckout = localStorage.getItem(ACTIVE_CHECKOUT_KEY);
    if (activeCheckout) {
      state.activeSchema = JSON.parse(activeCheckout);
    }
  } catch (e) {
    console.error('[EasyEA] Error loading configuration:', e);
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        serverUrl: state.serverUrl,
        token: state.token,
        username: state.username,
        fullName: state.fullName,
        activeModelId: state.activeModelId
      }));
      if (state.activeSchema) {
        localStorage.setItem(ACTIVE_CHECKOUT_KEY, JSON.stringify(state.activeSchema));
      } else {
        localStorage.removeItem(ACTIVE_CHECKOUT_KEY);
      }
      updateToolbarWidget();
    } catch (e) {
      console.error('[EasyEA] Error saving configuration:', e);
    }
  }

  function showToast(message, type) {
    if (camundaProps && camundaProps.displayNotification) {
      camundaProps.displayNotification({
        type: type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'success'),
        title: 'EasyEA',
        content: message,
        duration: 4000
      });
    }

    var toast = document.createElement('div');
    toast.className = 'easyea-toast';
    var icon = type === 'error' ? '❌ ' : (type === 'warning' ? '⚠️ ' : '✅ ');
    toast.innerHTML = icon + message;
    if (document.body) {
      document.body.appendChild(toast);
      setTimeout(function() {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 4000);
    }
  }

  function apiFetch(endpoint, options) {
    options = options || {};
    var headers = options.headers || {};
    if (state.token) {
      headers['Authorization'] = 'Bearer ' + state.token;
    }
    if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    options.headers = headers;
    var url = state.serverUrl.replace(/\/$/, '') + endpoint;
    return fetch(url, options).then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          try {
            var data = JSON.parse(text);
            var detail = data && data.detail ? data.detail : text;
            throw new Error(detail);
          } catch (e) {
            var msg = e.message && !e.message.startsWith('Unexpected') ? e.message : ('HTTP Error ' + res.status + ': ' + text.slice(0, 150));
            throw new Error(msg);
          }
        });
      }
      return res.json();
    });
  }

  function closeModal() {
    var overlay = document.getElementById('easyea-modal-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  function openModal(title, bodyHtml, footerHtml, isLarge) {
    closeModal();
    var overlay = document.createElement('div');
    overlay.id = 'easyea-modal-overlay';
    overlay.className = 'easyea-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'easyea-modal' + (isLarge ? ' large' : '');

    modal.innerHTML = 
      '<div class="easyea-modal-header">' +
        '<h3>' + title + '</h3>' +
        '<button class="easyea-modal-close" id="easyea-modal-close-btn">&times;</button>' +
      '</div>' +
      '<div class="easyea-modal-body" id="easyea-modal-body">' +
        bodyHtml +
      '</div>' +
      '<div class="easyea-modal-footer" id="easyea-modal-footer">' +
        (footerHtml || '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Close</button>') +
      '</div>';

    overlay.appendChild(modal);
    if (document.body) {
      document.body.appendChild(overlay);
    }

    var topCloseBtn = modal.querySelector('#easyea-modal-close-btn');
    if (topCloseBtn) {
      topCloseBtn.onclick = closeModal;
    }

    var closeBtn = modal.querySelector('#easyea-btn-close');
    if (closeBtn) {
      closeBtn.onclick = closeModal;
    }

    overlay.onclick = function(e) {
      if (e.target === overlay) closeModal();
    };

    return modal;
  }

  // 1. Settings / Login Modal
  function openSettingsModal() {
    var body = 
      '<div class="easyea-form-group">' +
        '<label>EasyEA Server URL:</label>' +
        '<input type="text" id="eea-set-url" class="easyea-input" value="' + (state.serverUrl || 'http://localhost:8000') + '" placeholder="http://localhost:8000">' +
      '</div>' +
      '<div class="easyea-form-group">' +
        '<label>Username:</label>' +
        '<input type="text" id="eea-set-user" class="easyea-input" value="' + (state.username || '') + '" placeholder="admin">' +
      '</div>' +
      '<div class="easyea-form-group">' +
        '<label>Password:</label>' +
        '<input type="password" id="eea-set-pass" class="easyea-input" placeholder="••••••••">' +
        '<div style="font-size: 11px; color: #64748b; margin-top: 4px;">Default credentials: <code>admin</code> / <code>AdminEasyEA2026!</code></div>' +
      '</div>' +
      '<div id="eea-login-status" style="margin-top: 10px; font-size: 13px;">' +
        (state.token ? ('<span style="color: #34d399;">🟢 Connected as <b>' + (state.fullName || state.username) + '</b></span>') : '<span style="color: #94a3b8;">⚪ Not authenticated</span>') +
      '</div>';

    var footer = 
      '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Cancel</button>' +
      '<button class="easyea-btn easyea-btn-primary" id="eea-btn-login">Connect / Save</button>';

    var modal = openModal('⚙️ EasyEA - Settings & Login', body, footer, false);

    var loginBtn = modal.querySelector('#eea-btn-login');
    if (loginBtn) {
      loginBtn.onclick = function() {
        var urlInput = modal.querySelector('#eea-set-url');
        var userInput = modal.querySelector('#eea-set-user');
        var passInput = modal.querySelector('#eea-set-pass');

        var url = urlInput ? urlInput.value.trim() : 'http://localhost:8000';
        var user = userInput ? userInput.value.trim() : '';
        var pass = passInput ? passInput.value : '';

        state.serverUrl = url;
        if (!user || !pass) {
          saveConfig();
          showToast('Configuration saved.', 'info');
          closeModal();
          return;
        }

        var statusDiv = modal.querySelector('#eea-login-status');
        if (statusDiv) {
          statusDiv.innerHTML = '<span style="color: #93c5fd;">⏳ Authenticating...</span>';
        }

        fetch(url.replace(/\/$/, '') + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user,
            password: pass
          })
        })
        .then(function(res) {
          if (!res.ok) {
            return res.json().then(function(data) {
              throw new Error(data && data.detail ? data.detail : 'Invalid credentials or server unreachable.');
            }).catch(function(err) {
              throw new Error(err.message || 'Invalid credentials or server unreachable.');
            });
          }
          return res.json();
        })
        .then(function(data) {
          state.token = data.token;
          state.username = data.user && data.user.username ? data.user.username : user;
          state.fullName = data.user && data.user.full_name ? data.user.full_name : state.username;
          saveConfig();
          showToast('Login successful! Connected as ' + state.fullName, 'success');
          closeModal();
        })
        .catch(function(err) {
          if (statusDiv) {
            statusDiv.innerHTML = '<span style="color: #f87171;">❌ ' + err.message + '</span>';
          }
        });
      };
    }
  }

  // 2. Check-out BPMN Process Modal
  // 2. Check-out BPMN Process Modal
  function openCheckoutModal() {
    if (!state.token) {
      showToast('Please login first via EasyEA Settings.', 'warning');
      openSettingsModal();
      return;
    }

    var body = 
      '<div style="margin-bottom: 12px; display: flex; gap: 8px;">' +
        '<input type="text" id="eea-checkout-search" class="easyea-input" placeholder="🔍 Search BPMN processes by name or description..." style="flex: 1;">' +
        '<select id="eea-checkout-format" class="easyea-select" style="width: 150px;">' +
          '<option value="bpmn">BPMN 2.0 Only</option>' +
          '<option value="all">All Formats</option>' +
          '<option value="archi">ArchiMate (.archimate)</option>' +
          '<option value="drawio">Draw.io</option>' +
        '</select>' +
      '</div>' +
      '<div id="eea-checkout-list" style="max-height: 360px; overflow-y: auto;">' +
        '<p style="color: #94a3b8; font-size: 13px;">⏳ Loading BPMN processes from EasyEA...</p>' +
      '</div>';
    var footer = 
      '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Cancel</button>' +
      '<button class="easyea-btn easyea-btn-primary" id="easyea-btn-create-new" style="margin-left: 8px;">💾 Save as New Schema</button>';

    var modal = openModal('📥 Check-out BPMN Process from EasyEA', body, footer, true);

    var createNewBtn = modal.querySelector('#easyea-btn-create-new');
    if (createNewBtn) {
      createNewBtn.onclick = function() {
        closeModal();
        openCreateSchemaModal();
      };
    }

    var searchInput = modal.querySelector('#eea-checkout-search');
    var formatSelect = modal.querySelector('#eea-checkout-format');
    var listContainer = modal.querySelector('#eea-checkout-list');
    var allSchemas = [];

    function renderList(schemas) {
      if (!listContainer) return;
      if (!schemas || schemas.length === 0) {
        listContainer.innerHTML = 
          '<div style="padding: 30px; text-align: center; background: rgba(30, 41, 59, 0.4); border: 1px dashed #334155; border-radius: 8px;">' +
            '<p style="color: #94a3b8; font-size: 14px; margin-bottom: 12px;">No processes found matching your criteria.</p>' +
            '<p style="color: #64748b; font-size: 12px; margin-bottom: 16px;">You can create and save a new BPMN process directly from Camunda Modeler.</p>' +
            '<button class="easyea-btn easyea-btn-primary" onclick="window.EasyEA.openCreateSchema()">💾 Save Current Diagram as New BPMN Schema</button>' +
          '</div>';
        return;
      }

      var html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
      schemas.forEach(function(s) {
        var isLocked = s.status === 'checked_out';
        var lockBadge = isLocked 
          ? '<span class="easyea-badge red">🔒 Locked by ' + (s.locked_by_username || 'another user') + '</span>'
          : '<span class="easyea-badge green">🟢 Available</span>';
        
        var formatBadge = s.format === 'bpmn'
          ? '<span class="easyea-badge purple">BPMN 2.0</span>'
          : '<span class="easyea-badge blue">' + (s.format ? s.format.toUpperCase() : 'ARCHI') + '</span>';

        var docHtml = s.documentation 
          ? ('<div style="font-size: 11px; color: #94a3b8; margin-top: 2px; max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + s.documentation + '</div>')
          : '';

        html += 
          '<div class="easyea-tree-item" id="schema-item-' + s.id + '" style="padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 6px;">' +
            '<div style="flex: 1; min-width: 0; padding-right: 12px;">' +
              '<div style="display: flex; align-items: center; gap: 8px;">' +
                '<span style="font-weight: 600; font-size: 14px; color: #ffffff;">📋 ' + s.name + '</span> ' +
                formatBadge +
                '<span style="font-size: 11px; color: #94a3b8;">' + (s.current_version || 'v1.0') + '</span>' +
              '</div>' +
              '<div style="font-size: 11px; color: #64748b; margin-top: 2px;">' +
                'Workspace: <strong style="color: #cbd5e1;">' + (s.workspace_name || s.model_id) + '</strong> &bull; Viewpoint: ' + (s.viewpoint || 'Business Process') +
              '</div>' +
              docHtml +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">' +
              lockBadge +
              '<button class="easyea-btn easyea-btn-primary" style="padding: 5px 12px; font-size: 12px;" data-action="checkout" data-id="' + s.id + '">' + (isLocked ? 'Open' : '📥 Check-out') + '</button>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
      listContainer.innerHTML = html;
    }

    if (listContainer) {
      listContainer.onclick = function(e) {
        var chkBtn = e.target.closest('[data-action="checkout"]');
        if (chkBtn) {
          var schemaId = chkBtn.getAttribute('data-id');
          if (schemaId) {
            doCheckout(schemaId);
          }
          return;
        }
        var newBtn = e.target.closest('[data-action="create-new"]');
        if (newBtn) {
          closeModal();
          openCreateSchemaModal();
        }
      };
    }

    function filterAndRender() {
      var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      var fmt = formatSelect ? formatSelect.value : 'bpmn';

      var filtered = allSchemas.filter(function(s) {
        var matchFmt = (fmt === 'all') || (s.format === fmt) || (!s.format && fmt === 'archi');
        if (!matchFmt) return false;
        if (!q) return true;
        return (s.name && s.name.toLowerCase().indexOf(q) !== -1) ||
               (s.documentation && s.documentation.toLowerCase().indexOf(q) !== -1) ||
               (s.viewpoint && s.viewpoint.toLowerCase().indexOf(q) !== -1);
      });

      renderList(filtered);
    }

    apiFetch('/api/schemas/tree')
      .then(function(res) {
        if (Array.isArray(res)) {
          allSchemas = res;
        } else if (res && res.schemas) {
          allSchemas = res.schemas;
        } else if (res && res.root_schemas) {
          allSchemas = res.root_schemas;
        } else {
          allSchemas = [];
        }
        filterAndRender();
      })
      .catch(function(err) {
        if (listContainer) {
          listContainer.innerHTML = '<p style="color: #f87171;">Error loading processes: ' + err.message + '</p>';
        }
      });

    if (searchInput) {
      searchInput.oninput = filterAndRender;
    }
    if (formatSelect) {
      formatSelect.onchange = filterAndRender;
    }
  }

  function applyXmlToModeler(xml) {
    if (!xml) return;
    
    if (activeModeler && activeModeler.importXML) {
      try {
        var p = activeModeler.importXML(xml);
        if (p && typeof p.then === 'function') {
          p.then(function() {
            var canvas = activeModeler.get('canvas');
            if (canvas && canvas.zoom) canvas.zoom('fit-viewport');
          }).catch(function(e) {
            console.warn('[EasyEA] Error importing XML:', e);
          });
        }
      } catch (err) {
        console.warn('[EasyEA] Direct importXML failed:', err);
      }
      return;
    }

    // If no active modeler tab is open yet, trigger new BPMN diagram tab
    if (camundaProps && camundaProps.triggerAction) {
      camundaProps.triggerAction('create-bpmn-diagram');
      setTimeout(function() {
        if (activeModeler && activeModeler.importXML) {
          try {
            var p2 = activeModeler.importXML(xml);
            if (p2 && typeof p2.then === 'function') {
              p2.then(function() {
                var canvas = activeModeler.get('canvas');
                if (canvas && canvas.zoom) canvas.zoom('fit-viewport');
              });
            }
          } catch (e2) {
            console.warn('[EasyEA] ImportXML on new tab failed:', e2);
          }
        }
      }, 500);
    }
  }

  function doCheckout(schemaId) {
    var btn = document.querySelector('#schema-item-' + schemaId + ' button');
    if (btn) btn.innerHTML = '⏳ Checking out...';

    apiFetch('/api/schemas/' + schemaId + '/checkout', { method: 'POST' })
      .then(function(res) {
        state.activeSchema = res.schema;
        saveConfig();
        closeModal();
        showToast('Check-out completed for: ' + (res.schema && res.schema.name ? res.schema.name : 'process'), 'success');

        if (res.xml_content) {
          applyXmlToModeler(res.xml_content);
        }
      })
      .catch(function(err) {
        if (btn) btn.innerHTML = '📥 Check-out';
        showToast('Check-out error: ' + err.message, 'error');
      });
  }

  // 3. EA Catalog Search Modal
  state.catalogCache = {};
  var currentLayerFilter = 'all';

  function openCatalogModal() {
    if (!state.token) {
      showToast('Please login first.', 'warning');
      openSettingsModal();
      return;
    }

    var body = 
      '<div style="margin-bottom: 12px; display: flex; gap: 8px;">' +
        '<input type="text" id="eea-catalog-search" class="easyea-input" placeholder="🔍 Search Business Roles, Processes, Applications, Objects..." style="flex: 1;">' +
        '<select id="eea-catalog-layer" class="easyea-select" style="width: 140px;">' +
          '<option value="all">All Layers</option>' +
          '<option value="Business">Business</option>' +
          '<option value="Application">Application</option>' +
          '<option value="Technology">Technology</option>' +
          '<option value="Strategy">Strategy</option>' +
        '</select>' +
      '</div>' +
      '<div id="eea-catalog-results" style="max-height: 360px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">' +
        '<p style="color: #94a3b8; font-size: 13px;">⏳ Loading EA Catalog elements...</p>' +
      '</div>';

    var modal = openModal('🔍 EasyEA Enterprise Architecture Catalog', body, null, true);

    var searchInput = modal.querySelector('#eea-catalog-search');
    var layerSelect = modal.querySelector('#eea-catalog-layer');
    var resultsContainer = modal.querySelector('#eea-catalog-results');
    var timer = null;

    function renderElements(elements) {
      if (!resultsContainer) return;
      if (!elements || elements.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8;">No elements found in catalog matching the query.</div>';
        return;
      }

      var html = '';
      elements.forEach(function(el) {
        state.catalogCache[el.id] = el;
        
        var badgeColor = 'purple';
        if (el.layer === 'Business') badgeColor = 'amber';
        else if (el.layer === 'Application') badgeColor = 'blue';
        else if (el.layer === 'Technology') badgeColor = 'green';
        else if (el.layer === 'Strategy') badgeColor = 'rose';

        var docHtml = el.documentation ? ('<div style="font-size: 11px; color: #94a3b8; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">' + el.documentation + '</div>') : '';

        html += 
          '<div class="easyea-tree-item" style="padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 6px;">' +
            '<div style="flex: 1; min-width: 0; padding-right: 12px;">' +
              '<div style="display: flex; align-items: center; gap: 6px;">' +
                '<span style="font-weight: 600; color: #f8fafc; font-size: 13px;">' + el.name + '</span> ' +
                '<span class="easyea-badge ' + badgeColor + '">' + el.type + '</span>' +
              '</div>' +
              '<div style="font-size: 11px; color: #64748b; margin-top: 2px;">' +
                'ID: <code>' + el.id + '</code> &bull; Layer: <strong style="color: #cbd5e1;">' + el.layer + '</strong>' +
              '</div>' +
              docHtml +
            '</div>' +
            '<div style="display: flex; gap: 6px; flex-shrink: 0;">' +
              '<button class="easyea-btn easyea-btn-primary" style="padding: 4px 8px; font-size: 11px;" data-action="insert" data-id="' + el.id + '" title="Insert as new BPMN shape on canvas">➕ Insert</button>' +
              '<button class="easyea-btn easyea-btn-secondary" style="padding: 4px 8px; font-size: 11px;" data-action="link" data-id="' + el.id + '" title="Apply name to selected element on canvas">🔗 Link Selected</button>' +
              '<button class="easyea-btn easyea-btn-secondary" style="padding: 4px 6px; font-size: 11px;" data-action="copy" data-id="' + el.id + '" title="Copy metadata to clipboard">📋</button>' +
            '</div>' +
          '</div>';
      });

      resultsContainer.innerHTML = html;
    }

    if (resultsContainer) {
      resultsContainer.onclick = function(e) {
        var insertBtn = e.target.closest('[data-action="insert"]');
        if (insertBtn) {
          var id = insertBtn.getAttribute('data-id');
          if (id) insertElementToCanvas(id);
          return;
        }
        var linkBtn = e.target.closest('[data-action="link"]');
        if (linkBtn) {
          var id = linkBtn.getAttribute('data-id');
          if (id) linkElementToSelected(id);
          return;
        }
        var copyBtn = e.target.closest('[data-action="copy"]');
        if (copyBtn) {
          var id = copyBtn.getAttribute('data-id');
          if (id) copyMeta(id);
          return;
        }
      };
    }

    function fetchCatalog() {
      var q = searchInput ? searchInput.value.trim() : '';
      var layer = layerSelect ? layerSelect.value : 'all';
      if (resultsContainer) {
        resultsContainer.innerHTML = '<p style="color: #94a3b8; font-size: 12px;">⏳ Searching catalog...</p>';
      }

      var url = '/api/elements/search?limit=60';
      if (q) url += '&query=' + encodeURIComponent(q);
      if (layer && layer !== 'all') url += '&layer=' + encodeURIComponent(layer);

      apiFetch(url)
        .then(function(elements) {
          renderElements(elements);
        })
        .catch(function(err) {
          if (resultsContainer) {
            resultsContainer.innerHTML = '<p style="color: #f87171;">Error searching catalog: ' + err.message + '</p>';
          }
        });
    }

    if (searchInput) {
      searchInput.oninput = function() {
        clearTimeout(timer);
        timer = setTimeout(fetchCatalog, 250);
      };
    }

    if (layerSelect) {
      layerSelect.onchange = function() {
        fetchCatalog();
      };
    }

    // Initial load
    fetchCatalog();
  }

  function insertElementToCanvas(elemId) {
    var el = state.catalogCache[elemId];
    if (!el) {
      showToast('Element not found in cache.', 'error');
      return;
    }
    if (!activeModeler) {
      showToast('No active BPMN modeler open in Camunda.', 'warning');
      return;
    }

    try {
      var modeling = activeModeler.get('modeling');
      var elementFactory = activeModeler.get('elementFactory');
      var canvas = activeModeler.get('canvas');
      var selection = activeModeler.get('selection');

      if (!modeling || !elementFactory || !canvas) {
        showToast('Camunda Modeler services are not available.', 'warning');
        return;
      }

      var root = canvas.getRootElement();

      var bpmnType = 'bpmn:Task';
      if (el.layer === 'Business') {
        if (el.type === 'BusinessActor' || el.type === 'BusinessRole') {
          bpmnType = 'bpmn:UserTask';
        } else if (el.type === 'BusinessEvent') {
          bpmnType = 'bpmn:IntermediateCatchEvent';
        } else {
          bpmnType = 'bpmn:Task';
        }
      } else if (el.layer === 'Application' || el.type === 'ApplicationComponent' || el.type === 'ApplicationService') {
        bpmnType = 'bpmn:ServiceTask';
      } else if (el.type === 'DataObject' || el.type === 'BusinessObject') {
        bpmnType = 'bpmn:DataObjectReference';
      }

      var shape = elementFactory.createShape({ type: bpmnType });
      var viewbox = canvas.viewbox();
      var posX = 320;
      var posY = 200;
      if (viewbox && viewbox.width) {
        posX = Math.round(viewbox.x + viewbox.width / 2 - 50 + (Math.random() * 40 - 20));
        posY = Math.round(viewbox.y + viewbox.height / 2 - 40 + (Math.random() * 40 - 20));
      }

      modeling.createShape(shape, { x: posX, y: posY }, root);
      modeling.updateProperties(shape, { name: el.name });

      if (selection && typeof selection.select === 'function') {
        try {
          selection.select(shape);
        } catch (selErr) {
          console.warn('[EasyEA] Could not select newly created shape:', selErr);
        }
      }
      closeModal();
      showToast('Inserted "' + el.name + '" (' + el.type + ') as ' + bpmnType.replace('bpmn:', '') + ' into canvas.', 'success');
    } catch (err) {
      console.error('[EasyEA] Error inserting BPMN shape:', err);
      showToast('Insert failed: ' + err.message, 'error');
    }
  }

  function linkElementToSelected(elemId) {
    var el = state.catalogCache[elemId];
    if (!el) {
      showToast('Element not found in cache.', 'error');
      return;
    }
    if (!activeModeler) {
      showToast('No active BPMN modeler open in Camunda.', 'warning');
      return;
    }

    try {
      var selection = activeModeler.get('selection');
      var modeling = activeModeler.get('modeling');
      var selected = selection ? selection.get() : [];

      if (!selected || selected.length === 0) {
        showToast('Please select a shape on the BPMN canvas first.', 'warning');
        return;
      }

      var target = selected[0];
      modeling.updateProperties(target, { name: el.name });
      closeModal();
      showToast('Linked "' + el.name + '" (' + el.type + ') to selected shape.', 'success');
    } catch (err) {
      console.error('[EasyEA] Error linking shape:', err);
      showToast('Link failed: ' + err.message, 'error');
    }
  }

  function copyMeta(elemId) {
    var el = state.catalogCache[elemId];
    if (!el) return;
    var metaSnippet = 'easyeaId="' + el.id + '" archimateType="' + el.type + '" layer="' + el.layer + '"';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(metaSnippet);
    }
    showToast('Copied metadata for: ' + el.name, 'success');
  }

  // 4. Check-in with Semantic Diff
  function openCheckinModal() {
    if (!state.token) {
      showToast('Please login first.', 'warning');
      openSettingsModal();
      return;
    }
    if (!state.activeSchema) {
      openCreateSchemaModal();
      return;
    }

    var body = '<div id="eea-diff-loading"><p style="color: #94a3b8;">⏳ Computing BPMN & ArchiMate semantic diff...</p></div>';
    var footer = '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Cancel</button>';

    var modal = openModal('📤 Check-in Process: ' + state.activeSchema.name, body, footer, true);

    function getXml(callback) {
      if (activeModeler && activeModeler.saveXML) {
        activeModeler.saveXML({ format: true }).then(function(res) {
          callback(res.xml);
        }).catch(function(err) {
          console.warn('[EasyEA] Could not extract XML from activeModeler:', err);
          callback(null);
        });
        return;
      }
      callback(null);
    }

    getXml(function(xmlContent) {
      var formData = new FormData();
      var blob = new Blob([xmlContent || '<definitions></definitions>'], { type: 'application/xml' });
      formData.append('file', blob, (state.activeSchema.name || 'process') + '.bpmn');

      var headers = {};
      if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

      fetch(state.serverUrl.replace(/\/$/, '') + '/api/schemas/' + state.activeSchema.id + '/checkin-diff', {
        method: 'POST',
        headers: headers,
        body: formData
      })
      .then(function(res) {
        if (!res.ok) throw new Error('Error computing diff from server.');
        return res.json();
      })
      .then(function(diff) {
        var container = modal.querySelector('#eea-diff-loading');
        if (!container) return;

        var newElems = (diff.new_elements || []).length;
        var modElems = (diff.modified_elements || []).length;
        var newRels = (diff.new_relationships || []).length;
        var delElems = (diff.catalog_removals || []).length;

        var html = 
          '<div class="easyea-diff-grid" style="margin-bottom: 12px;">' +
            '<div class="easyea-diff-stat"><div class="num" style="color: #34d399;">+' + newElems + '</div><div class="lbl">New Elements</div></div>' +
            '<div class="easyea-diff-stat"><div class="num" style="color: #60a5fa;">' + modElems + '</div><div class="lbl">Modified</div></div>' +
            '<div class="easyea-diff-stat"><div class="num" style="color: #c084fc;">+' + newRels + '</div><div class="lbl">New Relations</div></div>' +
            '<div class="easyea-diff-stat"><div class="num" style="color: #f87171;">' + delElems + '</div><div class="lbl">Removed</div></div>' +
          '</div>';

        // Detailed changes list
        html += '<div style="margin-bottom: 14px; max-height: 220px; overflow-y: auto; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 6px; padding: 10px;">';

        if (newElems === 0 && modElems === 0 && newRels === 0 && delElems === 0) {
          html += '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px;">No structural or semantic changes detected against EasyEA database.</div>';
        }

        // New Elements
        if (diff.new_elements && diff.new_elements.length > 0) {
          html += '<div style="font-size: 11px; font-weight: 700; color: #34d399; margin: 4px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">➕ New Elements to Sync with Catalog (' + diff.new_elements.length + ')</div>';
          diff.new_elements.forEach(function(el) {
            var badgeColor = el.layer === 'Business' ? 'amber' : (el.layer === 'Application' ? 'blue' : 'purple');
            html += 
              '<div style="font-size: 12px; padding: 6px 8px; margin-bottom: 4px; background: rgba(30, 41, 59, 0.6); border-left: 3px solid #34d399; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">' +
                '<span><strong style="color: #ffffff;">' + el.name + '</strong></span>' +
                '<span class="easyea-badge ' + badgeColor + '" style="font-size: 10px;">' + (el.type || 'Element') + '</span>' +
              '</div>';
          });
        }

        // Modified Elements
        if (diff.modified_elements && diff.modified_elements.length > 0) {
          html += '<div style="font-size: 11px; font-weight: 700; color: #60a5fa; margin: 10px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">📝 Modified Elements (' + diff.modified_elements.length + ')</div>';
          diff.modified_elements.forEach(function(el) {
            var changesSummary = (el.changes || []).map(function(c) {
              return '<code>' + c.field + (c.prop_key ? ('.' + c.prop_key) : '') + '</code>: "' + (c.old_value || '') + '" ➔ <strong style="color: #60a5fa;">"' + (c.new_value || '') + '"</strong>';
            }).join(', ');
            var badgeColor = el.layer === 'Business' ? 'amber' : (el.layer === 'Application' ? 'blue' : 'purple');
            html += 
              '<div style="font-size: 12px; padding: 6px 8px; margin-bottom: 4px; background: rgba(30, 41, 59, 0.6); border-left: 3px solid #60a5fa; border-radius: 4px;">' +
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                  '<span><strong style="color: #ffffff;">' + el.name + '</strong></span>' +
                  '<span class="easyea-badge ' + badgeColor + '" style="font-size: 10px;">' + (el.type || 'Element') + '</span>' +
                '</div>' +
                (changesSummary ? ('<div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">' + changesSummary + '</div>') : '') +
              '</div>';
          });
        }

        // New Relationships
        if (diff.new_relationships && diff.new_relationships.length > 0) {
          html += '<div style="font-size: 11px; font-weight: 700; color: #c084fc; margin: 10px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">🔗 New Relationships (' + diff.new_relationships.length + ')</div>';
          diff.new_relationships.forEach(function(rel) {
            var src = rel.source_name || rel.source_id || 'Source';
            var tgt = rel.target_name || rel.target_id || 'Target';
            html += 
              '<div style="font-size: 12px; padding: 6px 8px; margin-bottom: 4px; background: rgba(30, 41, 59, 0.6); border-left: 3px solid #c084fc; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">' +
                '<span><strong style="color: #cbd5e1;">' + src + '</strong> ➔ <strong style="color: #cbd5e1;">' + tgt + '</strong></span>' +
                '<span class="easyea-badge purple" style="font-size: 10px;">' + (rel.type || 'Relation') + '</span>' +
              '</div>';
          });
        }

        // Removed from Diagram/Catalog
        if (diff.catalog_removals && diff.catalog_removals.length > 0) {
          html += '<div style="font-size: 11px; font-weight: 700; color: #f87171; margin: 10px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">🗑️ Removed from Flow (' + diff.catalog_removals.length + ')</div>';
          diff.catalog_removals.forEach(function(rm) {
            html += 
              '<div style="font-size: 12px; padding: 6px 8px; margin-bottom: 4px; background: rgba(30, 41, 59, 0.6); border-left: 3px solid #f87171; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">' +
                '<span><strong style="color: #f87171;">' + (rm.name || rm.id) + '</strong></span>' +
                '<span class="easyea-badge red" style="font-size: 10px;">' + (rm.type || 'Removed') + '</span>' +
              '</div>';
          });
        }

        html += '</div>';

        html += 
          '<div class="easyea-form-group">' +
            '<label>Commit / Version Message:</label>' +
            '<textarea id="eea-commit-msg" class="easyea-textarea" rows="2" placeholder="Describe the changes made to the BPMN process flow..."></textarea>' +
          '</div>';

        container.innerHTML = html;

        var footerContainer = modal.querySelector('#easyea-modal-footer');
        if (footerContainer) {
          footerContainer.innerHTML = 
            '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Cancel</button>' +
            '<button class="easyea-btn easyea-btn-primary" id="eea-btn-confirm-checkin">🚀 Confirm Check-in & Sync</button>';

          var cancelBtn = footerContainer.querySelector('#easyea-btn-close');
          if (cancelBtn) cancelBtn.onclick = closeModal;

          var confirmBtn = footerContainer.querySelector('#eea-btn-confirm-checkin');
          if (confirmBtn) {
            confirmBtn.onclick = function() {
              var msgInput = modal.querySelector('#eea-commit-msg');
              var msg = (msgInput ? msgInput.value.trim() : '') || 'Updated BPMN process diagram';
              apiFetch('/api/schemas/' + state.activeSchema.id + '/checkin-confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  commit_message: msg,
                  raw_xml: xmlContent,
                  new_elements: diff.new_elements || [],
                  new_relationships: diff.new_relationships || [],
                  overwrite_attributes: true
                })
              })
              .then(function() {
                showToast('Check-in completed! Catalog and ArchiMate synchronized.', 'success');
                state.activeSchema = null;
                saveConfig();
                closeModal();

                // Automatically close the diagram tab in Camunda Modeler
                if (camundaProps && camundaProps.triggerAction) {
                  try {
                    camundaProps.triggerAction('close-active-tab');
                  } catch (closeErr) {
                    console.warn('[EasyEA] Error closing active tab after checkin:', closeErr);
                  }
                }
              })
              .catch(function(err) {
                showToast('Check-in confirmation error: ' + err.message, 'error');
              });
            };
          }
        }
      })
      .catch(function(err) {
        var container = modal.querySelector('#eea-diff-loading');
        if (container) container.innerHTML = '<p style="color: #f87171;">Error: ' + err.message + '</p>';
      });
    });
  }

  // 4b. Create & Save as New BPMN Schema
  function openCreateSchemaModal() {
    if (!state.token) {
      showToast('Please login first via EasyEA Settings.', 'warning');
      openSettingsModal();
      return;
    }

    var body = '<div id="eea-create-schema-body"><p style="color: #94a3b8;">⏳ Loading EasyEA workspaces...</p></div>';
    var footer = '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Cancel</button>';

    var modal = openModal('💾 Save as New BPMN Schema in EasyEA', body, footer, false);

    function getXml(callback) {
      if (activeModeler && activeModeler.saveXML) {
        activeModeler.saveXML({ format: true }).then(function(res) {
          callback(res.xml);
        }).catch(function(err) {
          console.warn('[EasyEA] Could not extract XML from activeModeler:', err);
          callback(null);
        });
        return;
      }
      callback(null);
    }

    apiFetch('/api/models')
      .then(function(models) {
        var container = modal.querySelector('#eea-create-schema-body');
        if (!container) return;

        if (!models || models.length === 0) {
          container.innerHTML = '<p style="color: #f87171;">No workspaces found. Please create a workspace first in EasyEA.</p>';
          return;
        }

        var optionsHtml = models.map(function(m) {
          var sel = (state.activeModelId === m.id) ? ' selected' : '';
          return '<option value="' + m.id + '"' + sel + '>' + m.name + (m.code ? (' [' + m.code + ']') : '') + '</option>';
        }).join('');

        var html = 
          '<div class="easyea-form-group">' +
            '<label>Target Workspace / Library:</label>' +
            '<select id="eea-new-model" class="easyea-input">' + optionsHtml + '</select>' +
          '</div>' +
          '<div class="easyea-form-group">' +
            '<label>BPMN Schema Name:</label>' +
            '<input type="text" id="eea-new-name" class="easyea-input" placeholder="e.g. Customer Onboarding Process" value="New Business Process">' +
          '</div>' +
          '<div class="easyea-form-group">' +
            '<label>Viewpoint / Category:</label>' +
            '<input type="text" id="eea-new-viewpoint" class="easyea-input" placeholder="e.g. Business Process Viewpoint" value="Business Process Viewpoint">' +
          '</div>' +
          '<div id="eea-create-status" style="margin-top: 8px; font-size: 13px;"></div>';

        container.innerHTML = html;

        var footerContainer = modal.querySelector('#easyea-modal-footer');
        if (footerContainer) {
          footerContainer.innerHTML = 
            '<button class="easyea-btn easyea-btn-secondary" id="easyea-btn-close">Cancel</button>' +
            '<button class="easyea-btn easyea-btn-primary" id="eea-btn-create-submit">🚀 Save & Check-in</button>';

          var cancelBtn = footerContainer.querySelector('#easyea-btn-close');
          if (cancelBtn) cancelBtn.onclick = closeModal;

          var submitBtn = footerContainer.querySelector('#eea-btn-create-submit');
          if (submitBtn) {
            submitBtn.onclick = function() {
              var modelSelect = modal.querySelector('#eea-new-model');
              var nameInput = modal.querySelector('#eea-new-name');
              var vpInput = modal.querySelector('#eea-new-viewpoint');
              var statusDiv = modal.querySelector('#eea-create-status');

              var modelId = modelSelect ? modelSelect.value : (models[0] && models[0].id);
              var schemaName = nameInput ? nameInput.value.trim() : 'New Business Process';
              var viewpoint = vpInput ? vpInput.value.trim() : 'Business Process Viewpoint';

              if (!schemaName) {
                if (statusDiv) statusDiv.innerHTML = '<span style="color: #f87171;">⚠️ Please enter a schema name.</span>';
                return;
              }

              if (statusDiv) statusDiv.innerHTML = '<span style="color: #93c5fd;">⏳ Saving schema and synchronizing BPMN elements into ArchiMate...</span>';

              getXml(function(xmlContent) {
                var formData = new FormData();
                var blob = new Blob([xmlContent || '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1"></bpmn:definitions>'], { type: 'application/xml' });
                formData.append('file', blob, schemaName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.bpmn');
                formData.append('schema_name', schemaName);

                var headers = {};
                if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

                fetch(state.serverUrl.replace(/\/$/, '') + '/api/schemas/' + modelId + '/import-file', {
                  method: 'POST',
                  headers: headers,
                  body: formData
                })
                .then(function(res) {
                  if (!res.ok) {
                    return res.json().then(function(d) { throw new Error(d && d.detail ? d.detail : ('HTTP Error ' + res.status)); });
                  }
                  return res.json();
                })
                .then(function(createdSchema) {
                  state.activeSchema = createdSchema;
                  state.activeModelId = modelId;
                  saveConfig();
                  showToast('Schema "' + createdSchema.name + '" successfully saved to EasyEA!', 'success');
                  closeModal();
                })
                .catch(function(err) {
                  if (statusDiv) statusDiv.innerHTML = '<span style="color: #f87171;">❌ ' + err.message + '</span>';
                });
              });
            };
          }
        }
      })
      .catch(function(err) {
        var container = modal.querySelector('#eea-create-schema-body');
        if (container) container.innerHTML = '<p style="color: #f87171;">Error loading workspaces: ' + err.message + '</p>';
      });
  }

  // 5. Discard Checkout
  function discardCheckout() {
    if (!state.activeSchema) {
      showToast('No process currently in check-out.', 'info');
      return;
    }
    if (!confirm('Are you sure you want to discard check-out for "' + state.activeSchema.name + '"? The server lock will be released.')) {
      return;
    }
    apiFetch('/api/schemas/' + state.activeSchema.id + '/discard-checkout', { method: 'POST' })
      .then(function() {
        showToast('Check-out discarded and lock released.', 'info');
        state.activeSchema = null;
        saveConfig();
      })
      .catch(function(err) {
        showToast('Error: ' + err.message, 'error');
      });
  }

  // Floating Status Widget on Camunda Canvas
  function updateToolbarWidget() {
    if (!document.body) return;

    var widget = document.getElementById('easyea-floating-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'easyea-floating-widget';
      widget.style.position = 'fixed';
      widget.style.bottom = '16px';
      widget.style.left = '16px';
      widget.style.zIndex = '99999';
      document.body.appendChild(widget);
    }

    var authText = state.token ? ('🟢 ' + (state.fullName || state.username)) : '⚙️ EasyEA Login';
    var schemaText = state.activeSchema ? ('📋 ' + state.activeSchema.name) : '💾 Save to EasyEA';

    widget.innerHTML = 
      '<div class="easyea-toolbar-widget">' +
        '<span style="font-weight: 600; cursor: pointer; color: #a5b4fc;" id="eea-tb-settings" title="Click to open Settings & Login">' + authText + '</span>' +
        '<span style="color: #475569;">|</span>' +
        '<span style="cursor: pointer; color: #cbd5e1;" id="eea-tb-checkout" title="Click to browse and check-out processes">' + (state.activeSchema ? ('📋 ' + state.activeSchema.name) : '📥 Check-out') + '</span>' +
        '<button class="easyea-toolbar-btn primary" id="eea-tb-checkin">' + (state.activeSchema ? '📤 Check-in' : '💾 Save as New') + '</button>' +
      '</div>';

    var setBtn = document.getElementById('eea-tb-settings');
    if (setBtn) setBtn.onclick = openSettingsModal;
    var chkBtn = document.getElementById('eea-tb-checkout');
    if (chkBtn) chkBtn.onclick = openCheckoutModal;
    var inBtn = document.getElementById('eea-tb-checkin');
    if (inBtn) inBtn.onclick = state.activeSchema ? openCheckinModal : openCreateSchemaModal;
  }

  // Keyboard shortcut listeners (Fallback)
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.altKey) {
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); openSettingsModal(); }
      if (e.key === 'o' || e.key === 'O') { e.preventDefault(); openCheckoutModal(); }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); openCatalogModal(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openCreateSchemaModal(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); openCheckinModal(); }
      if (e.key === 'd' || e.key === 'D') { e.preventDefault(); discardCheckout(); }
    }
  });

  // Global window namespace
  window.EasyEA = {
    openSettings: openSettingsModal,
    openCheckout: openCheckoutModal,
    openCatalog: openCatalogModal,
    openCreateSchema: openCreateSchemaModal,
    openCheckin: openCheckinModal,
    discardCheckout: discardCheckout,
    doCheckout: doCheckout,
    insertElement: insertElementToCanvas,
    linkElement: linkElementToSelected,
    copyMeta: copyMeta,
    closeModal: closeModal
  };

  // Official Camunda Modeler Client Extension Component
  function EasyEAClientExtension(props) {
    if (props) {
      camundaProps = props;

      if (props.subscribe && !EasyEAClientExtension._subscribed) {
        EasyEAClientExtension._subscribed = true;

        props.subscribe('easyea:openSettings', function() { openSettingsModal(); });
        props.subscribe('easyea:checkoutSchema', function() { openCheckoutModal(); });
        props.subscribe('easyea:insertFromCatalog', function() { openCatalogModal(); });
        props.subscribe('easyea:createSchema', function() { openCreateSchemaModal(); });
        props.subscribe('easyea:checkinSchema', function() { openCheckinModal(); });
        props.subscribe('easyea:discardCheckout', function() { discardCheckout(); });

        props.subscribe('bpmn.modeler.created', function(event) {
          if (event && event.modeler) {
            activeModeler = event.modeler;
          }
        });

        props.subscribe('app.activeTabChanged', function(event) {
          if (event && event.activeTab && event.activeTab.modeler) {
            activeModeler = event.activeTab.modeler;
          }
        });
      }
    }

    setTimeout(updateToolbarWidget, 200);
    return null;
  }

  EasyEAClientExtension.displayName = 'EasyEAClientExtension';

  // Register in Camunda Modeler Plugin Registry
  var plugins = window['plugins'] || [];
  window['plugins'] = plugins;
  plugins.push({
    type: 'client',
    plugin: EasyEAClientExtension
  });

  // Mount floating widget immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateToolbarWidget);
  } else {
    updateToolbarWidget();
  }

  console.log('[EasyEA] Camunda Modeler Plugin v1.0.0 successfully loaded and registered.');
})();
