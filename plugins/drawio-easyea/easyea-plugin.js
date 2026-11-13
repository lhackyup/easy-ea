/**
 * EasyEA Integration Plugin for Draw.io (Desktop & Web)
 * 
 * Enables Enterprise Architecture modeling with EasyEA directly inside Draw.io:
 * - Server settings & authentication (Local & SSO)
 * - Exclusive Schema Check-out & Check-in
 * - Interactive visual Diff review before committing
 * - Direct insertion and reuse of central catalog elements (ArchiMate 3.x)
 * - Check-out cancellation (Discard Lock)
 * 
 * Compatible with Draw.io Desktop (Linux, macOS, Windows) and Draw.io Web.
 */

(function() {
    function registerEasyEAPlugin(initFn) {
        if (typeof Draw !== 'undefined' && typeof Draw.loadPlugin === 'function') {
            Draw.loadPlugin(initFn);
        } else if (typeof App !== 'undefined' && App.DrawPlugins) {
            App.DrawPlugins.push(initFn);
        } else {
            setTimeout(function() { registerEasyEAPlugin(initFn); }, 50);
        }
    }

    registerEasyEAPlugin(function(ui) {
        'use strict';

        if (window.__EASYEA_PLUGIN_INITIALIZED__) {
            return;
        }
        window.__EASYEA_PLUGIN_INITIALIZED__ = true;

        // Fix Draw.io getResource and setTitleText to prevent any 'undefined' titles
        try {
            if (ui && ui.getResource) {
                var prevGetResource = ui.getResource;
                ui.getResource = function(obj) {
                    if (typeof obj === 'string') return obj;
                    if (obj && typeof obj === 'object') {
                        var lang = (typeof mxLanguage !== 'undefined' && mxLanguage) ? mxLanguage : 'main';
                        return obj[lang] || obj.main || obj.default || obj.it || obj.en || Object.values(obj)[0] || '';
                    }
                    if (prevGetResource) {
                        var res = prevGetResource.apply(this, arguments);
                        if (res !== null && res !== undefined) return res;
                    }
                    return (obj != null) ? String(obj) : '';
                };
            }
            if (ui && ui.sidebar && ui.sidebar.setTitleText) {
                var prevSetTitle = ui.sidebar.setTitleText;
                ui.sidebar.setTitleText = function(title, text) {
                    if (!text || text === 'undefined') return;
                    prevSetTitle.apply(this, arguments);
                };
            }
        } catch(e) {}

    // -------------------------------------------------------------
    // Configuration & State Management
    // -------------------------------------------------------------
    var STORAGE_CONFIG_KEY = 'easyea_plugin_config';
    var STORAGE_ACTIVE_SCHEMA_KEY = 'easyea_active_schema';

    var LAYER_COLORS = {
        'Strategy': { fill: '#F5DEAA', stroke: '#C89234', text: '#5C3806' },
        'Business': { fill: '#FFFFB5', stroke: '#C4B827', text: '#4B4204' },
        'Application': { fill: '#B5FFFF', stroke: '#40A9C4', text: '#053B47' },
        'Technology': { fill: '#C9E7B7', stroke: '#6EA84B', text: '#1E430B' },
        'Physical': { fill: '#C9E7B7', stroke: '#6EA84B', text: '#1E430B' },
        'Motivation': { fill: '#CCCCFF', stroke: '#7575C7', text: '#1E1E5E' },
        'Implementation': { fill: '#FFE0E0', stroke: '#C77A7A', text: '#531B1B' }
    };

    var SHAPE_STYLES = {
        'BusinessActor': 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;',
        'BusinessRole': 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
        'BusinessProcess': 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
        'BusinessFunction': 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
        'BusinessService': 'rounded=1;whiteSpace=wrap;html=1;arcSize=25;',
        'BusinessEvent': 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
        'BusinessObject': 'rounded=0;whiteSpace=wrap;html=1;',
        'ApplicationComponent': 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
        'ApplicationInterface': 'ellipse;whiteSpace=wrap;html=1;',
        'ApplicationService': 'rounded=1;whiteSpace=wrap;html=1;arcSize=25;',
        'ApplicationProcess': 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
        'DataObject': 'rounded=0;whiteSpace=wrap;html=1;',
        'Node': 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;',
        'Device': 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;',
        'SystemSoftware': 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;',
        'TechnologyService': 'rounded=1;whiteSpace=wrap;html=1;arcSize=25;',
        'Artifact': 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
        'Goal': 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;',
        'Principle': 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
        'Requirement': 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;',
        'Constraint': 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;fixedSize=1;',
        'WorkPackage': 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;',
        'Deliverable': 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
        'Plateau': 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;'
    };

    var RELATIONSHIP_STYLES = {
        'ServingRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;endFill=0;strokeColor=#4F46E5;strokeWidth=2;',
        'RealizationRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=block;endFill=0;strokeColor=#0284C7;strokeWidth=2;',
        'AssignmentRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=oval;endFill=1;startArrow=oval;startFill=1;strokeColor=#059669;strokeWidth=2;',
        'CompositionRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;startArrow=diamond;startFill=1;endArrow=none;strokeColor=#1E293B;strokeWidth=2;',
        'AggregationRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;startArrow=diamond;startFill=0;endArrow=none;strokeColor=#475569;strokeWidth=2;',
        'AccessRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=open;endFill=0;strokeColor=#D97706;strokeWidth=2;',
        'TriggeringRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=classic;endFill=1;strokeColor=#DC2626;strokeWidth=2;',
        'FlowRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;endArrow=classic;endFill=1;strokeColor=#7C3AED;strokeWidth=2;',
        'SpecializationRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=0;strokeColor=#0F766E;strokeWidth=2;',
        'AssociationRelationship': 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=none;strokeColor=#64748B;strokeWidth=2;'
    };

    function parseJwtPayload(token) {
        try {
            if (!token || token.indexOf('.') < 0) return null;
            var parts = token.split('.');
            if (parts.length >= 2) {
                var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                while (b64.length % 4) b64 += '=';
                return JSON.parse(decodeURIComponent(escape(atob(b64))));
            }
        } catch(e) {}
        return null;
    }

    function getConfig() {
        var cfg = { server_url: 'http://localhost:8000', token: '', username: '', full_name: '' };
        try {
            var raw = localStorage.getItem(STORAGE_CONFIG_KEY);
            if (raw) cfg = Object.assign(cfg, JSON.parse(raw));
        } catch(e) {}

        if (cfg.token && (!cfg.full_name || !cfg.username)) {
            var claims = parseJwtPayload(cfg.token);
            if (claims) {
                cfg.username = cfg.username || claims.username || claims.preferred_username || claims.sub || 'admin';
                cfg.full_name = cfg.full_name || claims.full_name || claims.name || cfg.username;
            }
        }
        return cfg;
    }

    function saveConfig(cfg) {
        try {
            localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
            if (window.electron && typeof window.electron.request === 'function') {
                window.electron.request({ action: 'easyeaSaveConfig', config: cfg }, function() {});
            }
        } catch(e) {}
    }

    function getActiveSchema() {
        try {
            var raw = localStorage.getItem(STORAGE_ACTIVE_SCHEMA_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return null;
    }

    function setActiveSchema(schema) {
        try {
            if (schema) {
                localStorage.setItem(STORAGE_ACTIVE_SCHEMA_KEY, JSON.stringify(schema));
            } else {
                localStorage.removeItem(STORAGE_ACTIVE_SCHEMA_KEY);
            }
        } catch(e) {}
    }

    var MODERN_STENCILS = {
        'modern_card': { style: 'rounded=1;arcSize=14;shadow=1;strokeWidth=1.5;html=1;whiteSpace=wrap;', w: 170, h: 70 },
        'modern_microservice': { style: 'shape=ext;double=1;rounded=1;arcSize=14;shadow=1;strokeWidth=1.5;html=1;whiteSpace=wrap;', w: 175, h: 75 },
        'modern_database': { style: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=14;shadow=1;strokeWidth=1.5;rounded=1;arcSize=8;', w: 150, h: 75 },
        'modern_cloud_node': { style: 'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.04;darkOpacity2=0.08;shadow=1;rounded=1;arcSize=10;strokeWidth=1.5;', w: 170, h: 80 },
        'modern_api_interface': { style: 'shape=ext;rounded=1;arcSize=30;shadow=1;strokeWidth=1.5;html=1;whiteSpace=wrap;', w: 160, h: 55 },
        'modern_hex': { style: 'shape=hexagon;perimeter=hexagonPerimeter2;fixedSize=1;size=16;rounded=1;arcSize=10;shadow=1;strokeWidth=1.5;whiteSpace=wrap;html=1;', w: 160, h: 80 },
        'modern_process': { style: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;rounded=1;arcSize=12;shadow=1;strokeWidth=1.5;', w: 170, h: 65 },
        'modern_event_stream': { style: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;rounded=1;arcSize=20;shadow=1;strokeWidth=1.5;', w: 160, h: 60 },
        'modern_actor': { style: 'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;shadow=1;strokeWidth=1.5;', w: 45, h: 75 }
    };

    function getShapeStyle(elemType, layer, stereoInfo) {
        var stencilMode = 'standard';
        try {
            var saved = localStorage.getItem('easyea_drawio_stencil_mode');
            if (saved === 'modern') stencilMode = 'modern';
        } catch(e) {}

        var colors = LAYER_COLORS[layer] || LAYER_COLORS['Application'];
        var baseStyle = SHAPE_STYLES[elemType] || 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;';

        if (stencilMode === 'modern') {
            if (stereoInfo && stereoInfo.custom_drawio_style) {
                baseStyle = stereoInfo.custom_drawio_style;
            } else if (stereoInfo && stereoInfo.stencil_shape && MODERN_STENCILS[stereoInfo.stencil_shape]) {
                baseStyle = MODERN_STENCILS[stereoInfo.stencil_shape].style;
            } else {
                if (baseStyle.indexOf('rounded=1') >= 0) {
                    baseStyle = MODERN_STENCILS.modern_card.style;
                } else {
                    baseStyle = baseStyle + 'shadow=1;strokeWidth=1.5;';
                }
            }
        }

        return baseStyle + 'fillColor=' + colors.fill + ';strokeColor=' + colors.stroke + ';fontColor=' + colors.text + ';fontStyle=1;';
    }

    function getRelStyle(relType) {
        return RELATIONSHIP_STYLES[relType] || 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;strokeColor=#4F46E5;strokeWidth=2;';
    }

    // -------------------------------------------------------------
    // Helper: Universal Network Fetch (CORS-immune via Electron IPC)
    // -------------------------------------------------------------
    function eaFetch(url, opts) {
        opts = opts || {};
        var isFormData = (opts.body && typeof FormData !== 'undefined' && opts.body instanceof FormData);
        if (!isFormData && window.electron && typeof window.electron.request === 'function') {
            return new Promise(function(resolve, reject) {
                var reqBody = null;
                if (typeof opts.body === 'string') {
                    reqBody = opts.body;
                } else if (opts.body) {
                    reqBody = JSON.stringify(opts.body);
                }

                window.electron.request({
                    action: 'easyeaApiFetch',
                    url: url,
                    method: opts.method || 'GET',
                    headers: opts.headers || {},
                    body: reqBody
                }, function(res) {
                    if (res && res.error) {
                        fetch(url, opts).then(resolve).catch(reject);
                    } else if (res) {
                        resolve({
                            ok: Boolean(res.ok),
                            status: res.status,
                            statusText: res.statusText || '',
                            json: function() { return Promise.resolve(res.data); },
                            text: function() { return Promise.resolve(typeof res.data === 'string' ? res.data : JSON.stringify(res.data)); }
                        });
                    } else {
                        fetch(url, opts).then(resolve).catch(reject);
                    }
                }, function(err) {
                    fetch(url, opts).then(resolve).catch(reject);
                });
            });
        }
        return fetch(url, opts);
    }

    // -------------------------------------------------------------
    // Helper: HTML Escaping & Safe DOM Rendering (SAST-HIGH-03)
    // -------------------------------------------------------------
    function escHtml(val) {
        if (val === null || val === undefined) return '';
        return String(val)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setSafeHtml(container, htmlStr, append) {
        if (!container) return;
        if (!append) {
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        }
        var parser = new DOMParser();
        var doc = parser.parseFromString(String(htmlStr || ''), 'text/html');
        var dangerous = doc.body.querySelectorAll('script, iframe, object, embed');
        for (var i = 0; i < dangerous.length; i++) {
            dangerous[i].remove();
        }
        var allElems = doc.body.querySelectorAll('*');
        for (var j = 0; j < allElems.length; j++) {
            var attrs = allElems[j].attributes;
            for (var k = attrs.length - 1; k >= 0; k--) {
                var attrName = attrs[k].name.toLowerCase();
                if (attrName.indexOf('on') === 0) {
                    allElems[j].removeAttribute(attrs[k].name);
                }
            }
        }
        while (doc.body.firstChild) {
            container.appendChild(doc.body.firstChild);
        }
    }

    // -------------------------------------------------------------
    // Helper: Modal Builder
    // -------------------------------------------------------------
    function createModalContainer(titleText, widthPx) {
        var container = document.createElement('div');
        container.style.padding = '20px';
        container.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
        container.style.color = '#1e293b';
        container.style.boxSizing = 'border-box';
        container.style.maxHeight = '80vh';
        container.style.overflowY = 'auto';

        var header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.style.borderBottom = '1px solid #e2e8f0';
        header.style.paddingBottom = '12px';
        header.style.marginBottom = '16px';

        var title = document.createElement('h3');
        title.style.margin = '0';
        title.style.fontSize = '18px';
        title.style.fontWeight = '600';
        title.style.color = '#0f172a';
        title.innerText = titleText;

        header.appendChild(title);
        container.appendChild(header);

        return container;
    }

    // -------------------------------------------------------------
    // Action 1: Settings & Login
    // -------------------------------------------------------------
    function showSettingsDialog() {
        var config = getConfig();
        var activeSchema = getActiveSchema();
        var container = createModalContainer('⚙️ Configurazione & Accesso EasyEA', 500);

        var isAuth = Boolean(config.token);
        var content = document.createElement('div');

        if (isAuth) {
            setSafeHtml(content,
                '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:16px;">' +
                    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                        '<span style="font-size:24px;">🟢</span>' +
                        '<div>' +
                            '<div style="font-weight:700;color:#166534;font-size:15px;">Autenticato su EasyEA</div>' +
                            '<div style="font-size:13px;color:#15803d;">Utente: <strong>' + escHtml(config.full_name || config.username) + '</strong> (' + escHtml(config.username) + ')</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="border-top:1px solid #bbf7d0;padding-top:10px;font-size:12px;color:#334155;line-height:1.6;">' +
                        '<div><strong>Server EasyEA:</strong> ' + escHtml(config.server_url || 'http://localhost:8000') + '</div>' +
                        '<div><strong>Stato:</strong> Sessione sincronizzata (Web Check-out)</div>' +
                        (activeSchema ? '<div><strong>Schema Attivo:</strong> ' + escHtml(activeSchema.schema_name) + ' (' + escHtml(activeSchema.version) + ')</div>' : '') +
                    '</div>' +
                '</div>' +
                '<div id="easyea_relogin_section" style="display:none;margin-top:14px;border-top:1px dashed #cbd5e1;padding-top:14px;">' +
                    '<div style="margin-bottom: 12px;">' +
                        '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">URL Server EasyEA:</label>' +
                        '<input type="text" id="easyea_server_url" value="' + escHtml(config.server_url || 'http://localhost:8000') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                    '</div>' +
                    '<div style="margin-bottom: 12px;">' +
                        '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Username o Email:</label>' +
                        '<input type="text" id="easyea_username" value="' + escHtml(config.username || 'admin') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                    '</div>' +
                    '<div style="margin-bottom: 12px;">' +
                        '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Password:</label>' +
                        '<input type="password" id="easyea_password" placeholder="Inserisci password..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                    '</div>' +
                    '<div id="easyea_status_box" style="padding:10px;border-radius:6px;font-size:12px;margin-bottom:12px;display:none;"></div>' +
                '</div>'
            );
        } else {
            setSafeHtml(content,
                '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:12px;margin-bottom:14px;font-size:12px;color:#9a3412;">' +
                    '⚠️ <strong>Non autenticato.</strong> Inserisci le credenziali del server EasyEA per collegare Draw.io.' +
                '</div>' +
                '<div style="margin-bottom: 12px;">' +
                    '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">URL Server EasyEA:</label>' +
                    '<input type="text" id="easyea_server_url" value="' + escHtml(config.server_url || 'http://localhost:8000') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                '</div>' +
                '<div style="margin-bottom: 12px;">' +
                    '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Username o Email:</label>' +
                    '<input type="text" id="easyea_username" value="' + escHtml(config.username || 'admin') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                '</div>' +
                '<div style="margin-bottom: 12px;">' +
                    '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Password:</label>' +
                    '<input type="password" id="easyea_password" placeholder="Inserisci password..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                '</div>' +
                '<div id="easyea_status_box" style="padding:10px;border-radius:6px;font-size:12px;margin-bottom:12px;display:none;"></div>'
            );
        }

        var btnBar = document.createElement('div');
        btnBar.style.display = 'flex';
        btnBar.style.justifyContent = 'space-between';
        btnBar.style.alignItems = 'center';
        btnBar.style.marginTop = '16px';

        var leftBtns = document.createElement('div');
        var rightBtns = document.createElement('div');
        rightBtns.style.display = 'flex';
        rightBtns.style.gap = '8px';

        if (isAuth) {
            var btnToggleRelogin = document.createElement('button');
            btnToggleRelogin.innerText = '🔄 Cambia Account...';
            btnToggleRelogin.style.cssText = 'padding:7px 12px;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;font-size:12px;cursor:pointer;color:#475569;';
            btnToggleRelogin.onclick = function() {
                var sec = document.getElementById('easyea_relogin_section');
                if (sec) {
                    sec.style.display = (sec.style.display === 'none') ? 'block' : 'none';
                    if (sec.style.display === 'block') {
                        btnLogin.style.display = 'inline-block';
                    }
                }
            };
            leftBtns.appendChild(btnToggleRelogin);
        }

        var btnClose = document.createElement('button');
        btnClose.innerText = isAuth ? 'OK, Chiudi' : 'Annulla';
        btnClose.style.cssText = 'padding:8px 16px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-weight:600;cursor:pointer;color:#334155;';
        btnClose.onclick = function() { ui.hideDialog(); };

        var btnLogin = document.createElement('button');
        btnLogin.innerText = 'Accedi & Salva';
        btnLogin.style.cssText = 'padding:8px 18px;border:none;border-radius:6px;background:#4f46e5;color:#fff;font-weight:600;cursor:pointer;';
        if (isAuth) {
            btnLogin.style.display = 'none';
        }

        btnLogin.onclick = function() {
            var sUrl = (document.getElementById('easyea_server_url').value || '').trim().replace(/\/+$/, '');
            var uName = (document.getElementById('easyea_username').value || '').trim();
            var pWord = (document.getElementById('easyea_password').value || '').trim();
            var statusBox = document.getElementById('easyea_status_box');

            if (!sUrl) { alert('Specificare un URL del server valido.'); return; }
            if (!uName) { alert('Inserire lo username.'); return; }

            btnLogin.disabled = true;
            btnLogin.innerText = 'Accesso in corso...';

            eaFetch(sUrl + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: uName, password: pWord })
            })
            .then(function(res) {
                if (!res.ok) throw new Error('Credenziali non valide o errore server (HTTP ' + res.status + ')');
                return res.json();
            })
            .then(function(data) {
                var newCfg = {
                    server_url: sUrl,
                    token: data.token,
                    username: uName,
                    full_name: (data.user && data.user.full_name) ? data.user.full_name : uName
                };
                saveConfig(newCfg);
                statusBox.style.display = 'block';
                statusBox.style.background = '#f0fdf4';
                statusBox.style.border = '1px solid #bbf7d0';
                statusBox.style.color = '#166534';
                setSafeHtml(statusBox, '🟢 Connesso con successo come <strong>' + escHtml(newCfg.full_name) + '</strong>!');
                btnLogin.disabled = false;
                btnLogin.innerText = 'Accedi & Salva';
                setTimeout(function() {
                    ui.hideDialog();
                    showSettingsDialog();
                }, 1000);
            })
            .catch(function(err) {
                btnLogin.disabled = false;
                btnLogin.innerText = 'Accedi & Salva';
                statusBox.style.display = 'block';
                statusBox.style.background = '#fef2f2';
                statusBox.style.border = '1px solid #fecaca';
                statusBox.style.color = '#991b1b';
                statusBox.textContent = '❌ ' + err.message;
            });
        };

        rightBtns.appendChild(btnClose);
        rightBtns.appendChild(btnLogin);
        btnBar.appendChild(leftBtns);
        btnBar.appendChild(rightBtns);

        container.appendChild(content);
        container.appendChild(btnBar);

        ui.showDialog(container, 500, isAuth ? 260 : 360, true, true);
    }

    // -------------------------------------------------------------
    // Action 2: Check-out Schema
    // -------------------------------------------------------------
    function showCheckoutDialog() {
        var config = getConfig();
        if (!config.token) {
            alert('Autenticazione richiesta. Apri "Impostazioni / Login" prima di eseguire il Check-out.');
            showSettingsDialog();
            return;
        }

        var container = createModalContainer('📥 Check-out Schema da EasyEA', 620);
        var content = document.createElement('div');
        setSafeHtml(content, '<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Caricamento librerie e schemi disponibili...</div>');
        container.appendChild(content);
        ui.showDialog(container, 620, 480, true, true);

        eaFetch(config.server_url + '/api/models', {
            headers: { 'Authorization': 'Bearer ' + config.token }
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Sessione scaduta o server non raggiungibile (HTTP ' + res.status + ')');
            return res.json();
        })
        .then(function(models) {
            if (!models || models.length === 0) {
                setSafeHtml(content, '<div style="color:#ef4444;font-size:13px;">Nessuna libreria trovata sul repository EasyEA.</div>');
                return;
            }

            var modelId = models[0].id;

            function loadSchemasForModel(mId) {
                setSafeHtml(content, '<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Caricamento schemi per la libreria selezionata...</div>');
                eaFetch(config.server_url + '/api/schemas/' + encodeURIComponent(mId) + '/list', {
                    headers: { 'Authorization': 'Bearer ' + config.token }
                })
                .then(function(res) { return res.json(); })
                .then(function(schemas) {
                    renderSchemasList(models, mId, schemas);
                })
                .catch(function(err) {
                    setSafeHtml(content, '<div style="color:#ef4444;">Errore: ' + escHtml(err.message) + '</div>');
                });
            }

            function renderSchemasList(modelsList, selectedModelId, schemas) {
                var html = 
                    '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;">' +
                        '<label style="font-size:12px;font-weight:600;color:#475569;">Libreria:</label>' +
                        '<select id="easyea_model_select" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;flex:1;">';
                
                for (var mi = 0; mi < modelsList.length; mi++) {
                    var m = modelsList[mi];
                    html += '<option value="' + escHtml(m.id) + '" ' + (m.id === selectedModelId ? 'selected' : '') + '>' + escHtml(m.name || m.id) + ' (' + escHtml(m.modeling_tool || 'drawio') + ')</option>';
                }
                html += '</select></div>';

                html += '<div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:8px;">Schemi disponibili:</div>';
                html += '<div style="max-height:240px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:16px;">';

                if (!schemas || schemas.length === 0) {
                    html += '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Nessuno schema trovato in questa libreria.</div>';
                } else {
                    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">' +
                        '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;">' +
                        '<th style="padding:8px 12px;">Nome Schema</th><th style="padding:8px 12px;">Versione</th><th style="padding:8px 12px;">Stato</th><th style="padding:8px 12px;text-align:right;">Azione</th></tr></thead><tbody>';

                    for (var si = 0; si < schemas.length; si++) {
                        var s = schemas[si];
                        var isLocked = s.status === 'checked_out';
                        var isLockedByMe = isLocked && s.locked_by_username === config.username;
                        var badge = isLocked
                            ? (isLockedByMe ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">🔒 In uso da te</span>' : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">🔒 ' + escHtml(s.locked_by_username || 'In uso') + '</span>')
                            : '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">🟢 Disponibile</span>';

                        html += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                            '<td style="padding:10px 12px;font-weight:500;">' + escHtml(s.name) + '</td>' +
                            '<td style="padding:10px 12px;color:#64748b;">' + escHtml(s.current_version) + '</td>' +
                            '<td style="padding:10px 12px;">' + badge + '</td>' +
                            '<td style="padding:10px 12px;text-align:right;">';

                        if (!isLocked || isLockedByMe) {
                            html += '<button class="btn-checkout" data-id="' + escHtml(s.id) + '" data-name="' + escHtml(s.name) + '" data-version="' + escHtml(s.current_version) + '" data-locked="' + (isLockedByMe ? '1' : '0') + '" style="background:#4f46e5;color:#fff;border:none;padding:5px 12px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;">' + (isLockedByMe ? 'Riapri' : 'Check-out') + '</button>';
                        } else {
                            html += '<button disabled style="background:#e2e8f0;color:#94a3b8;border:none;padding:5px 12px;border-radius:5px;font-size:12px;cursor:not-allowed;">Bloccato</button>';
                        }
                        html += '</td></tr>';
                    }
                    html += '</tbody></table>';
                }
                html += '</div>';

                setSafeHtml(content, html);

                document.getElementById('easyea_model_select').onchange = function(e) {
                    loadSchemasForModel(e.target.value);
                };

                var buttons = content.querySelectorAll('.btn-checkout');
                buttons.forEach(function(btn) {
                    btn.onclick = function() {
                        var schemaId = btn.getAttribute('data-id');
                        var schemaName = btn.getAttribute('data-name');
                        var version = btn.getAttribute('data-version');
                        var alreadyLocked = btn.getAttribute('data-locked') === '1';

                        performCheckout(schemaId, selectedModelId, schemaName, version, alreadyLocked);
                    };
                });
            }

            loadSchemasForModel(modelId);
        })
        .catch(function(err) {
            setSafeHtml(content, '<div style="color:#ef4444;font-size:13px;">❌ Errore: ' + escHtml(err.message) + '</div>');
        });

        function performCheckout(schemaId, modelId, schemaName, version, alreadyLocked) {
            var doLockPromise = alreadyLocked 
                ? Promise.resolve() 
                : eaFetch(config.server_url + '/api/schemas/' + encodeURIComponent(schemaId) + '/checkout', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + config.token }
                }).then(function(res) {
                    if (!res.ok) return res.json().then(function(d) { throw new Error(d.detail || 'Impossibile bloccare lo schema'); });
                });

            doLockPromise
            .then(function() {
                return eaFetch(config.server_url + '/api/schemas/' + encodeURIComponent(schemaId) + '/download', {
                    headers: { 'Authorization': 'Bearer ' + config.token }
                });
            })
            .then(function(res) {
                if (!res.ok) throw new Error('Errore durante il download del diagramma');
                return res.text();
            })
            .then(function(xmlContent) {
                // Set file data in Draw.io
                ui.setFileData(xmlContent);

                // Save active checkout in state
                setActiveSchema({
                    schema_id: schemaId,
                    model_id: modelId,
                    schema_name: schemaName,
                    version: version,
                    checked_out_at: new Date().toISOString()
                });

                ui.hideDialog();
                alert('Schema "' + schemaName + '" caricato e bloccato con successo!\n\nPuoi ora modificare il diagramma. Al termine, esegui "Check-in Schema" dal menu EasyEA.');
            })
            .catch(function(err) {
                alert('Errore Check-out: ' + err.message);
            });
        }
    }

    // -------------------------------------------------------------
    // Action 3: Add Element from Catalog (Reuse)
    // -------------------------------------------------------------
    function showAddElementDialog() {
        var config = getConfig();
        var activeSchema = getActiveSchema();

        if (!config.token) {
            alert('Autenticazione richiesta.');
            showSettingsDialog();
            return;
        }

        if (!activeSchema) {
            alert('Accesso Limitato:\n\nQuesta funzione è attiva SOLO per gli schemi attualmente in Check-out.\nEsegui prima un Check-out per poter aggiungere elementi dal catalogo EasyEA.');
            return;
        }

        var container = createModalContainer('🔍 Inserisci Elemento dal Catalogo Globale', 600);
        var targetModelId = activeSchema.model_id || '';

        var html = 
            '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">Schema attivo: <strong>' + escHtml(activeSchema.schema_name) + '</strong></div>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
                '<input type="text" id="easyea_catalog_search" placeholder="Cerca elemento per nome o tipo..." style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
                '<button id="easyea_btn_do_search" style="padding:8px 14px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Cerca</button>' +
            '</div>' +
            '<div id="easyea_catalog_results" style="max-height:260px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:16px;">' +
                '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Digita un termine e clicca "Cerca" o visualizza il catalogo.</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
                '<button id="easyea_close_add_elem" style="padding:8px 14px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;">Chiudi</button>' +
            '</div>';

        setSafeHtml(container, html, true);
        ui.showDialog(container, 600, 440, true, true);

        document.getElementById('easyea_close_add_elem').onclick = function() { ui.hideDialog(); };

        function executeSearch(query) {
            var resBox = document.getElementById('easyea_catalog_results');
            setSafeHtml(resBox, '<div style="padding:16px;text-align:center;color:#64748b;font-size:13px;">Ricerca in corso...</div>');

            var url = config.server_url + '/api/elements?model_id=' + encodeURIComponent(targetModelId);
            if (query) url += '&search=' + encodeURIComponent(query);

            eaFetch(url, {
                headers: { 'Authorization': 'Bearer ' + config.token }
            })
            .then(function(res) { return res.json(); })
            .then(function(elements) {
                if (!elements || elements.length === 0) {
                    setSafeHtml(resBox, '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Nessun elemento trovato nel catalogo.</div>');
                    return;
                }

                var rHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">' +
                    '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;">' +
                    '<th style="padding:8px 12px;">Nome</th><th style="padding:8px 12px;">Tipo</th><th style="padding:8px 12px;">Layer</th><th style="padding:8px 12px;text-align:right;">Azione</th></tr></thead><tbody>';

                var elemCache = {};
                for (var ei = 0; ei < elements.length; ei++) {
                    var el = elements[ei];
                    elemCache[String(ei)] = el;
                    var layer = el.layer || 'Application';
                    var lColors = LAYER_COLORS[layer] || LAYER_COLORS['Application'];

                    rHtml += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                        '<td style="padding:8px 12px;font-weight:500;">' + escHtml(el.name) + '</td>' +
                        '<td style="padding:8px 12px;color:#64748b;font-size:12px;">' + escHtml(el.type) + '</td>' +
                        '<td style="padding:8px 12px;"><span style="background:' + lColors.fill + ';color:' + lColors.text + ';border:1px solid ' + lColors.stroke + ';padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">' + escHtml(layer) + '</span></td>' +
                        '<td style="padding:8px 12px;text-align:right;">' +
                            '<button class="btn-insert-elem" data-idx="' + ei + '" style="background:#059669;color:#fff;border:none;padding:4px 10px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;">+ Inserisci</button>' +
                        '</td></tr>';
                }
                rHtml += '</tbody></table>';
                setSafeHtml(resBox, rHtml);

                var insertButtons = resBox.querySelectorAll('.btn-insert-elem');
                insertButtons.forEach(function(ib) {
                    ib.onclick = function() {
                        var elemData = elemCache[ib.getAttribute('data-idx')];
                        if (elemData) insertElementIntoDiagram(elemData);
                    };
                });
            })
            .catch(function(err) {
                setSafeHtml(resBox, '<div style="padding:16px;color:#ef4444;font-size:13px;">Errore: ' + escHtml(err.message) + '</div>');
            });
        }

        document.getElementById('easyea_btn_do_search').onclick = function() {
            var q = (document.getElementById('easyea_catalog_search').value || '').trim();
            executeSearch(q);
        };

        document.getElementById('easyea_catalog_search').onkeydown = function(e) {
            if (e.key === 'Enter') {
                var q = (document.getElementById('easyea_catalog_search').value || '').trim();
                executeSearch(q);
            }
        };

        // Initial search to populate
        executeSearch('');

        function insertElementIntoDiagram(elem) {
            var graph = ui.editor.graph;
            var parent = graph.getDefaultParent();

            var doc = mxUtils.createXmlDocument();
            var obj = doc.createElement('object');
            obj.setAttribute('label', elem.name || 'Element');
            obj.setAttribute('easyea_id', elem.id);
            obj.setAttribute('archimate_type', elem.type || 'ApplicationComponent');
            obj.setAttribute('layer', elem.layer || 'Application');
            obj.setAttribute('documentation', elem.documentation || '');

            var stereoInfo = elem.stereotype || elem.properties?.stereotype;
            var style = getShapeStyle(elem.type || 'ApplicationComponent', elem.layer || 'Application', stereoInfo);

            // Find neat center position
            var view = graph.getView();
            var bounds = graph.getGraphBounds();
            var x = 120 + Math.floor(Math.random() * 80);
            var y = 120 + Math.floor(Math.random() * 80);
            var width = 160;
            var height = 65;
            if (stereoInfo && stereoInfo.stencil_shape && MODERN_STENCILS[stereoInfo.stencil_shape]) {
                width = MODERN_STENCILS[stereoInfo.stencil_shape].w;
                height = MODERN_STENCILS[stereoInfo.stencil_shape].h;
            }

            graph.getModel().beginUpdate();
            try {
                graph.insertVertex(parent, null, obj, x, y, width, height, style);
            } finally {
                graph.getModel().endUpdate();
            }

            ui.hideDialog();
            alert('Elemento "' + elem.name + '" inserito nel diagramma!');
        }
    }

    // -------------------------------------------------------------
    // Action 4: Check-in Schema (with visual Diff)
    // -------------------------------------------------------------
    function showCheckinDialog() {
        var config = getConfig();
        var activeSchema = getActiveSchema();

        if (!config.token) {
            alert('Autenticazione richiesta.');
            showSettingsDialog();
            return;
        }

        if (!activeSchema) {
            alert('Nessuno schema risulta attualmente in Check-out locale.\nEsegui prima un Check-out per poter effettuare il Check-in.');
            return;
        }

        var schemaId = activeSchema.schema_id;
        var xmlContent = ui.getFileData(true);

        if (!xmlContent || xmlContent.trim().length === 0) {
            alert('Il diagramma corrente è vuoto.');
            return;
        }

        var container = createModalContainer('📤 Check-in Schema: Revisione Modifiche', 680);
        var content = document.createElement('div');
        setSafeHtml(content, '<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Calcolo delle differenze (Diff) con il repository in corso...</div>');
        container.appendChild(content);
        ui.showDialog(container, 680, 520, true, true);

        // Send checkin-diff (via Electron IPC to bypass CORS / FormData sandbox restrictions)
        if (window.electron && typeof window.electron.request === 'function') {
            window.electron.request({
                action: 'easyeaCheckinDiff',
                server_url: config.server_url,
                schema_id: schemaId,
                token: config.token,
                xmlContent: xmlContent
            }, function(res) {
                if (res && res.ok) {
                    renderDiffModal(res.data, xmlContent);
                } else {
                    var msg = (res && res.data && res.data.detail) ? res.data.detail : (res && res.error ? res.error : 'Errore calcolo diff');
                    setSafeHtml(content, '<div style="color:#ef4444;font-size:13px;">❌ Errore durante il calcolo del diff: ' + escHtml(msg) + '</div>');
                }
            }, function(err) {
                setSafeHtml(content, '<div style="color:#ef4444;font-size:13px;">❌ Errore durante il calcolo del diff: ' + escHtml(err ? (err.message || err) : 'Errore sconosciuto') + '</div>');
            });
            return;
        }

        // Web fallback (standard fetch)
        var formData = new FormData();
        var blob = new Blob([xmlContent], { type: 'application/xml' });
        formData.append('file', blob, 'schema.drawio');

        fetch(config.server_url + '/api/schemas/' + encodeURIComponent(schemaId) + '/checkin-diff', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + config.token },
            body: formData
        })
        .then(function(res) {
            if (!res.ok) return res.json().then(function(d) { throw new Error(d.detail || 'Errore calcolo diff'); });
            return res.json();
        })
        .then(function(diff) {
            renderDiffModal(diff, xmlContent);
        })
        .catch(function(err) {
            setSafeHtml(content, '<div style="color:#ef4444;font-size:13px;">❌ Errore durante il calcolo del diff: ' + escHtml(err.message) + '</div>');
        });

        function renderDiffModal(diff, rawXml) {
            var newElems = diff.new_elements || [];
            var modElems = diff.modified_elements || [];
            var remElems = diff.removed_elements || [];
            var newRels = diff.new_relationships || [];
            var modRels = diff.modified_relationships || [];
            var remRels = diff.removed_relationships || [];

            var html = 
                '<div style="display:grid;grid-template-columns:repeat(6, 1fr);gap:8px;margin-bottom:16px;">' +
                    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:8px;border-radius:6px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#16a34a;">' + newElems.length + '</div><div style="font-size:10px;color:#166534;font-weight:600;">Nuovi Elem.</div></div>' +
                    '<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:8px;border-radius:6px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#2563eb;">' + newRels.length + '</div><div style="font-size:10px;color:#1e40af;font-weight:600;">Nuove Rel.</div></div>' +
                    '<div style="background:#fffbeb;border:1px solid #fde68a;padding:8px;border-radius:6px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#d97706;">' + modElems.length + '</div><div style="font-size:10px;color:#92400e;font-weight:600;">Elem. Mod.</div></div>' +
                    '<div style="background:#fdf4ff;border:1px solid #f5d0fe;padding:8px;border-radius:6px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#9333ea;">' + modRels.length + '</div><div style="font-size:10px;color:#6b21a8;font-weight:600;">Rel. Mod.</div></div>' +
                    '<div style="background:#fef2f2;border:1px solid #fecaca;padding:8px;border-radius:6px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#dc2626;">' + remElems.length + '</div><div style="font-size:10px;color:#991b1b;font-weight:600;">Elem. Rim.</div></div>' +
                    '<div style="background:#fff1f2;border:1px solid #fecdd3;padding:8px;border-radius:6px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#e11d48;">' + remRels.length + '</div><div style="font-size:10px;color:#9f1239;font-weight:600;">Rel. Rim.</div></div>' +
                '</div>';

            html += '<div style="max-height:160px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:6px;padding:8px;margin-bottom:14px;font-size:12px;background:#f8fafc;">';
            if (newElems.length === 0 && modElems.length === 0 && remElems.length === 0 && newRels.length === 0 && modRels.length === 0 && remRels.length === 0) {
                html += '<div style="color:#64748b;text-align:center;padding:10px;">Nessuna modifica strutturale rilevata. Verrà aggiornato solo il layout visuale dello schema.</div>';
            } else {
                if (newElems.length > 0) {
                    html += '<div style="font-weight:600;color:#16a34a;margin-bottom:4px;">➕ Nuovi Elementi: ' + newElems.map(function(e){ return escHtml(e.name); }).join(', ') + '</div>';
                }
                if (newRels.length > 0) {
                    html += '<div style="font-weight:600;color:#2563eb;margin-bottom:4px;">➕ Nuove Relazioni: ' + newRels.map(function(r){ return escHtml(r.source_name || 'Src') + ' ➔ ' + escHtml(r.target_name || 'Tgt'); }).join(', ') + '</div>';
                }
                if (modElems.length > 0) {
                    html += '<div style="font-weight:600;color:#d97706;margin-bottom:4px;">✏️ Elementi Modificati: ' + modElems.map(function(e){ return escHtml(e.name); }).join(', ') + '</div>';
                }
                if (modRels.length > 0) {
                    html += '<div style="font-weight:600;color:#9333ea;margin-bottom:4px;">✏️ Relazioni Modificate: ' + modRels.map(function(r){ return escHtml(r.source_name || '') + ' ➔ ' + escHtml(r.target_name || ''); }).join(', ') + '</div>';
                }
                if (remElems.length > 0) {
                    html += '<div style="font-weight:600;color:#dc2626;margin-bottom:4px;">🗑️ Elementi Rimossi: ' + remElems.map(function(e){ return escHtml(e.name); }).join(', ') + '</div>';
                }
                if (remRels.length > 0) {
                    html += '<div style="font-weight:600;color:#e11d48;margin-bottom:4px;">🗑️ Relazioni Rimosse: ' + remRels.map(function(r){ return escHtml(r.source_name || '') + ' ➔ ' + escHtml(r.target_name || ''); }).join(', ') + '</div>';
                }
            }
            html += '</div>';

            html += '<div style="margin-bottom:14px;">' +
                '<label style="display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:4px;">Messaggio di Commit / Descrizione Modifiche:</label>' +
                '<textarea id="easyea_commit_msg" style="width:100%;box-sizing:border-box;height:60px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;" placeholder="Descrivi brevemente cosa hai modificato..."></textarea>' +
            '</div>';

            html += '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
                '<button id="easyea_cancel_checkin" style="padding:8px 14px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;">Annulla</button>' +
                '<button id="easyea_confirm_checkin" style="padding:8px 18px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;">Conferma Check-in e Sblocca</button>' +
            '</div>';

            setSafeHtml(content, html);

            document.getElementById('easyea_cancel_checkin').onclick = function() { ui.hideDialog(); };
            
            document.getElementById('easyea_confirm_checkin').onclick = function() {
                var btnConfirm = document.getElementById('easyea_confirm_checkin');
                var commitMsg = (document.getElementById('easyea_commit_msg').value || '').trim() || 'Aggiornamento schema da Draw.io';

                btnConfirm.disabled = true;
                btnConfirm.innerText = 'Salvataggio in corso...';

                // Build auto resolution list
                var autoChanges = [];
                if (modElems) {
                    for (var mi = 0; mi < modElems.length; mi++) {
                        var me = modElems[mi];
                        if (me.changes) {
                            for (var ci = 0; ci < me.changes.length; ci++) {
                                var ch = me.changes[ci];
                                autoChanges.push({
                                    id: me.id,
                                    field: ch.field,
                                    prop_key: ch.prop_key,
                                    new_value: ch.new_value,
                                    overwrite: true
                                });
                            }
                        }
                    }
                }

                var payload = {
                    file_content: rawXml,
                    xml_content: rawXml,
                    commit_message: commitMsg,
                    new_elements: newElems,
                    new_relationships: newRels,
                    attribute_resolutions: autoChanges,
                    overwrite_attributes: true,
                    remove_deleted_from_catalog: false
                };

                eaFetch(config.server_url + '/api/schemas/' + encodeURIComponent(schemaId) + '/checkin-confirm', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + config.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                })
                .then(function(res) {
                    if (!res.ok) return res.json().then(function(d) { throw new Error(d.detail || 'Errore salvataggio check-in'); });
                    return res.json();
                })
                .then(function(result) {
                    setActiveSchema(null);
                    ui.hideDialog();
                    alert('Check-in completato con successo!\n\nSchema: ' + activeSchema.schema_name + '\nNuova Versione: ' + (result.schema ? result.schema.current_version : 'v1.x') + '\n\nIl blocco (lock) è stato rilasciato.');
                    // In Draw.io Web, se aperta come popup o nuova finestra/tab da EasyEA, chiudi automaticamente la finestra
                    if (!window.electron && window.opener && !window.opener.closed) {
                        try {
                            window.opener.postMessage(JSON.stringify({ event: 'easyeaCheckinCompleted', schema_id: schemaId }), '*');
                        } catch(e) {}
                        setTimeout(function() { window.close(); }, 300);
                    }
                })
                .catch(function(err) {
                    btnConfirm.disabled = false;
                    btnConfirm.innerText = 'Conferma Check-in e Sblocca';
                    alert('Errore Check-in: ' + err.message);
                });
            };
        }
    }

    // -------------------------------------------------------------
    // Action 5: Discard Check-out
    // -------------------------------------------------------------
    function showDiscardCheckoutDialog() {
        var config = getConfig();
        var activeSchema = getActiveSchema();

        if (!config.token) {
            alert('Autenticazione richiesta.');
            return;
        }

        if (!activeSchema) {
            alert('Nessuno schema risulta attualmente in Check-out.');
            return;
        }

        if (!confirm('Sei sicuro di voler annullare il Check-out per lo schema "' + activeSchema.schema_name + '"?\n\nIl blocco su EasyEA verrà rilasciato e le modifiche non committate andranno perse.')) {
            return;
        }

        eaFetch(config.server_url + '/api/schemas/' + encodeURIComponent(activeSchema.schema_id) + '/discard-checkout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + config.token }
        })
        .then(function(res) {
            if (!res.ok) return res.json().then(function(d) { throw new Error(d.detail || 'Errore rilascio lock'); });
            setActiveSchema(null);
            alert('Check-out annullato e blocco rilasciato con successo su EasyEA.');
        })
        .catch(function(err) {
            alert('Errore rilascio blocco: ' + err.message);
        });
    }

    // -------------------------------------------------------------
    // Action 6: About Info
    // -------------------------------------------------------------
    function showAboutDialog() {
        var config = getConfig();
        var activeSchema = getActiveSchema();

        var container = createModalContainer('ℹ️ EasyEA Draw.io Plugin', 420);
        setSafeHtml(container,
            '<div style="font-size:13px;line-height:1.6;color:#334155;margin-bottom:16px;">' +
                '<p><strong>EasyEA Platform Integration</strong> consente la sincronizzazione bidirezionale dei modelli ArchiMate 3.x tra Draw.io Desktop e il catalogo aziendale EasyEA.</p>' +
                '<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;margin-top:10px;font-size:12px;">' +
                    '<div><strong>Server:</strong> ' + escHtml(config.server_url || 'Non configurato') + '</div>' +
                    '<div><strong>Utente:</strong> ' + escHtml(config.full_name || config.username || 'Non autenticato') + '</div>' +
                    '<div><strong>Schema Attivo:</strong> ' + (activeSchema ? escHtml(activeSchema.schema_name) + ' (' + escHtml(activeSchema.version) + ')' : 'Nessuno (Disponibile)') + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;">' +
                '<button id="easyea_about_close" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Chiudi</button>' +
            '</div>',
            true
        );

        ui.showDialog(container, 420, 260, true, true);
        document.getElementById('easyea_about_close').onclick = function() { ui.hideDialog(); };
    }

    // -------------------------------------------------------------
    // Register Actions & Resources in Draw.io UI
    // -------------------------------------------------------------
    try {
        mxResources.parse('easyeaSettings=EasyEA: ⚙️ Impostazioni / Login...');
        mxResources.parse('easyeaCheckout=EasyEA: 📥 Check-out Schema...');
        mxResources.parse('easyeaAddElement=EasyEA: 🔍 Inserisci Elemento da Catalogo...');
        mxResources.parse('easyeaCheckin=EasyEA: 📤 Check-in Schema (Commit & Diff)...');
        mxResources.parse('easyeaDiscard=EasyEA: ❌ Annulla Check-out (Discard)...');
        mxResources.parse('easyeaAbout=EasyEA: ℹ️ Informazioni su EasyEA...');
        mxResources.parse('easyeaModernizeCanvas=EasyEA: ✨ Applica Stile Moderno a tutte le forme');
        mxResources.parse('easyeaStandardizeCanvas=EasyEA: 📐 Ripristina Stile Standard ArchiMate');
        mxResources.parse('easyeaToggleStencil=EasyEA: 🎨 Commuta Stile Stencil (Moderno / Standard)');
    } catch(e) {}

    ui.actions.addAction('easyeaSettings', function() { checkIncomingExternalSession(function() { showSettingsDialog(); }); });
    ui.actions.addAction('easyeaCheckout', function() { checkIncomingExternalSession(function() { showCheckoutDialog(); }); });
    ui.actions.addAction('easyeaAddElement', function() { checkIncomingExternalSession(function() { showAddElementDialog(); }); });
    ui.actions.addAction('easyeaCheckin', function() { checkIncomingExternalSession(function() { showCheckinDialog(); }); });
    ui.actions.addAction('easyeaDiscard', function() { checkIncomingExternalSession(function() { showDiscardCheckoutDialog(); }); });
    ui.actions.addAction('easyeaAbout', function() { checkIncomingExternalSession(function() { showAboutDialog(); }); });
    ui.actions.addAction('easyeaModernizeCanvas', function() { applyModernStyleToCanvas(true); });
    ui.actions.addAction('easyeaStandardizeCanvas', function() { applyModernStyleToCanvas(false); });
    ui.actions.addAction('easyeaToggleStencil', function() { toggleStencilMode(); });

    // -------------------------------------------------------------
    // Dynamic Diagram Canvas Modernization
    // -------------------------------------------------------------
    function applyModernStyleToCanvas(isModern) {
        var graph = ui.editor.graph;
        if (!graph) return;
        var parent = graph.getDefaultParent();
        var vertices = graph.getChildVertices(parent);
        if (!vertices || vertices.length === 0) {
            alert('Nessun elemento presente nel diagramma da stilizzare.');
            return;
        }

        graph.getModel().beginUpdate();
        var count = 0;
        try {
            for (var i = 0; i < vertices.length; i++) {
                var cell = vertices[i];
                var style = graph.getModel().getStyle(cell) || '';
                if (!style) continue;

                if (isModern) {
                    if (style.indexOf('shadow=1') < 0) {
                        style = style.replace(/shadow=0;?/g, '') + ';shadow=1;';
                    }
                    if (style.indexOf('strokeWidth=') < 0) {
                        style = style + ';strokeWidth=1.5;';
                    } else {
                        style = style.replace(/strokeWidth=[0-9.]+;?/g, 'strokeWidth=1.5;');
                    }
                    if (style.indexOf('rounded=') < 0) {
                        style = style + ';rounded=1;';
                    }
                    if (style.indexOf('arcSize=') >= 0) {
                        style = style.replace(/arcSize=[0-9]+;?/g, 'arcSize=14;');
                    } else {
                        style = style + ';arcSize=14;';
                    }
                    if (style.indexOf('archiType=square') >= 0) {
                        style = style.replace('archiType=square', 'archiType=rounded;arcSize=14');
                    }
                } else {
                    style = style.replace(/shadow=1;?/g, '');
                    style = style.replace(/strokeWidth=1.5;?/g, 'strokeWidth=1;');
                    style = style.replace(/arcSize=14;?/g, 'arcSize=10;');
                }
                style = style.replace(/;+/g, ';');
                graph.getModel().setStyle(cell, style);
                count++;
            }
        } finally {
            graph.getModel().endUpdate();
        }

        if (isModern) {
            alert('✨ ' + count + ' forme del diagramma aggiornate con successo allo Stile Moderno EasyEA (angoli smussati e ombre morbide)!');
        } else {
            alert('📐 ' + count + ' forme ripristinate allo Stile Standard ArchiMate.');
        }
    }

    function toggleStencilMode() {
        var current = 'standard';
        try {
            var saved = localStorage.getItem('easyea_drawio_stencil_mode');
            if (saved === 'modern') current = 'modern';
        } catch(e) {}

        var next = current === 'modern' ? 'standard' : 'modern';
        try {
            localStorage.setItem('easyea_drawio_stencil_mode', next);
        } catch(e) {}

        initEasyEASidebarPalette();
        alert('Stile Stencil EasyEA impostato su: ' + (next === 'modern' ? '✨ Moderno (Attivo)' : '📐 Standard ArchiMate (Default)') + '.\nLa palette nella barra laterale sinistra è stata aggiornata!');
    }

    // -------------------------------------------------------------
    // Native Draw.io Sidebar Palette Injection & Expansion
    // -------------------------------------------------------------
    function applyModernPaletteExpansion() {
        if (!ui || !ui.sidebar || !ui.sidebar.palettes) return;
        try {
            var isModern = (typeof urlParams !== 'undefined' && urlParams['stencil'] === 'modern') ||
                           (window.__EASYEA_STENCIL_MODE__ === 'modern') ||
                           (localStorage.getItem('easyea_drawio_stencil_mode') === 'modern');
            if (!isModern) return;

            Object.keys(ui.sidebar.palettes).forEach(function(id) {
                var p = ui.sidebar.palettes[id];
                if (!p || !p[0] || !p[1]) return;
                var title = p[0];
                var outer = p[1];
                var content = outer.firstChild || outer;
                if (!content || !content.style) return;

                var isEasyeaModern = (id === 'easyea_stencils' || id.indexOf('easyea_modern') >= 0);
                if (isEasyeaModern) {
                    if (content.style.display === 'none') {
                        title.click();
                    }
                } else if (id.indexOf('archimate3') >= 0 || id === 'general' || id === 'misc' || id === 'advanced' || id === 'basic' || id.indexOf('arrows') >= 0) {
                    // Close all official Draw.io built-in palettes
                    if (content.style.display !== 'none') {
                        title.click();
                    }
                }
            });
        } catch(e) {}
    }

    function initEasyEASidebarPalette() {
        if (!ui.sidebar || typeof ui.sidebar.addPalette !== 'function') {
            setTimeout(initEasyEASidebarPalette, 300);
            return;
        }

        // If customEntries already defined by host configure message, apply expansion and return to avoid duplicate palettes
        if (ui.sidebar.customEntries && ui.sidebar.customEntries.length > 0) {
            applyModernPaletteExpansion();
            return;
        }

        var stencilMode = 'standard';
        try {
            if (typeof urlParams !== 'undefined' && urlParams['stencil']) {
                stencilMode = urlParams['stencil'];
            } else if (window.__EASYEA_STENCIL_MODE__) {
                stencilMode = window.__EASYEA_STENCIL_MODE__;
            } else {
                var saved = localStorage.getItem('easyea_drawio_stencil_mode');
                if (saved === 'modern') stencilMode = 'modern';
            }
        } catch(e) {}

        // Remove previous palette if existing to avoid duplicates
        try {
            if (ui.sidebar.palettes && ui.sidebar.palettes['easyea_stencils']) {
                ui.sidebar.removePalette('easyea_stencils');
            }
        } catch(e) {}

        var isModern = (stencilMode === 'modern');
        var paletteTitle = isModern ? '✨ EasyEA Stencil Moderni' : '📐 EasyEA ArchiMate Standard';

        ui.sidebar.addPalette('easyea_stencils', paletteTitle, true, function(content) {
            function addEntry(style, w, h, title, label, archimateType, layer, stereotype) {
                var doc = mxUtils.createXmlDocument();
                var obj = doc.createElement('object');
                obj.setAttribute('label', label || title);
                obj.setAttribute('archimate_type', archimateType || 'ApplicationComponent');
                if (layer) obj.setAttribute('layer', layer);
                if (stereotype) obj.setAttribute('stereotype', stereotype);

                var entry = ui.sidebar.createVertexTemplateEntry(
                    style,
                    w,
                    h,
                    obj,
                    title,
                    true,
                    null,
                    null
                );
                if (entry) {
                    content.appendChild(entry);
                }
            }

            if (isModern) {
                // 1. Modern Microservice
                addEntry(
                    MODERN_STENCILS.modern_microservice.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    175, 75,
                    'Microservice (Modern)',
                    '«Microservice»\n⚡ Service Name',
                    'ApplicationComponent',
                    'Application',
                    'Microservice'
                );
                // 2. Modern Database / Storage
                addEntry(
                    MODERN_STENCILS.modern_database.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    150, 75,
                    'Database / Storage (Modern)',
                    '🗄️ Database Storage',
                    'DataObject',
                    'Application',
                    'Database'
                );
                // 3. Modern Cloud Node / Kubernetes
                addEntry(
                    MODERN_STENCILS.modern_cloud_node.style + 'fillColor=#C9E7B7;strokeColor=#6EA84B;fontColor=#1E430B;fontStyle=1;',
                    170, 80,
                    'Kubernetes Cluster (Modern)',
                    '«K8s Cluster»\n☁️ Cluster Node',
                    'Node',
                    'Technology',
                    'Kubernetes Cluster'
                );
                // 4. Modern Event Stream / Queue
                addEntry(
                    MODERN_STENCILS.modern_event_stream.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    160, 60,
                    'Event Driven Service (Modern)',
                    '«Event Stream»\n📦 Message Queue',
                    'ApplicationComponent',
                    'Application',
                    'Event Driven Service'
                );
                // 5. Modern API Gateway / Interface
                addEntry(
                    MODERN_STENCILS.modern_api_interface.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    160, 55,
                    'API Gateway (Modern)',
                    '⚡ REST / API Gateway',
                    'ApplicationInterface',
                    'Application'
                );
                // 6. Modern Hexagon (Domain/DDD)
                addEntry(
                    MODERN_STENCILS.modern_hex.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    160, 80,
                    'Domain Hexagon (DDD)',
                    'Domain / Core',
                    'ApplicationComponent',
                    'Application'
                );
                // 7. Modern SaaS Application
                addEntry(
                    MODERN_STENCILS.modern_card.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    170, 70,
                    'SaaS Application (Modern)',
                    '«SaaS»\n☁️ SaaS Provider',
                    'ApplicationComponent',
                    'Application',
                    'SaaS Application'
                );
                // 8. Modern Automated Process
                addEntry(
                    MODERN_STENCILS.modern_process.style + 'fillColor=#FFFFB5;strokeColor=#C4B827;fontColor=#4B4204;fontStyle=1;',
                    170, 65,
                    'Automated Process (Modern)',
                    '«Automated»\n⚙️ Business Process',
                    'BusinessProcess',
                    'Business',
                    'Automated Process'
                );
                // 9. Modern Legacy Mainframe
                addEntry(
                    MODERN_STENCILS.modern_card.style + 'fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    170, 70,
                    'Legacy Mainframe (Modern)',
                    '«Legacy Mainframe»\n🖥️ Core Monolith',
                    'ApplicationComponent',
                    'Application',
                    'Legacy Mainframe'
                );
                // 10. Modern Architecture Decision (ADR)
                addEntry(
                    MODERN_STENCILS.modern_hex.style + 'fillColor=#ECC8EC;strokeColor=#A04FA0;fontColor=#470547;fontStyle=1;',
                    160, 80,
                    'Architecture Decision (Modern ADR)',
                    '«Architecture Decision»\n🛡️ ADR Assessment',
                    'Assessment',
                    'Motivation',
                    'Architecture Decision'
                );
            } else {
                // Standard ArchiMate Shapes
                addEntry(
                    'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    160, 65,
                    'Application Component (Standard)',
                    'Application Component'
                );
                addEntry(
                    'rounded=1;whiteSpace=wrap;html=1;arcSize=25;fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    160, 65,
                    'Application Service (Standard)',
                    'Application Service'
                );
                addEntry(
                    'rounded=0;whiteSpace=wrap;html=1;fillColor=#B5FFFF;strokeColor=#40A9C4;fontColor=#053B47;fontStyle=1;',
                    160, 65,
                    'Data Object (Standard)',
                    'Data Object'
                );
                addEntry(
                    'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#FFFFB5;strokeColor=#C4B827;fontColor=#4B4204;fontStyle=1;',
                    170, 65,
                    'Business Process (Standard)',
                    'Business Process'
                );
                addEntry(
                    'rounded=1;whiteSpace=wrap;html=1;arcSize=10;fillColor=#FFFFB5;strokeColor=#C4B827;fontColor=#4B4204;fontStyle=1;',
                    160, 65,
                    'Business Role (Standard)',
                    'Business Role'
                );
                addEntry(
                    'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#FFFFB5;strokeColor=#C4B827;fontColor=#4B4204;fontStyle=1;',
                    40, 70,
                    'Business Actor (Standard)',
                    'Business Actor'
                );
                addEntry(
                    'shape=cube;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;darkOpacity=0.05;darkOpacity2=0.1;fillColor=#C9E7B7;strokeColor=#6EA84B;fontColor=#1E430B;fontStyle=1;',
                    160, 70,
                    'Node / Device (Standard)',
                    'Node'
                );
                addEntry(
                    'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#C9E7B7;strokeColor=#6EA84B;fontColor=#1E430B;fontStyle=1;',
                    150, 70,
                    'System Software (Standard)',
                    'System Software'
                );
            }
        });
    }

    setTimeout(initEasyEASidebarPalette, 500);
    setTimeout(applyModernPaletteExpansion, 800);
    setTimeout(initEasyEASidebarPalette, 1500);
    setTimeout(applyModernPaletteExpansion, 2200);

    // -------------------------------------------------------------
    // Automatic Session Pickup from EasyEA Protocol Handler (easyea://)
    // -------------------------------------------------------------
    function checkIncomingExternalSession(cb) {
        if (window.electron && typeof window.electron.request === 'function') {
            var currFilePath = null;
            try {
                var cur = ui.getCurrentFile();
                if (cur && cur.fileObject && cur.fileObject.path) {
                    currFilePath = cur.fileObject.path;
                }
            } catch(e) {}

            window.electron.request({ action: 'easyeaGetSession', filePath: currFilePath }, function(data) {
                if (data) {
                    if (data.config && data.config.token) {
                        saveConfig(data.config);
                    }
                    if (data.active_schema) {
                        setActiveSchema(data.active_schema);
                    }
                }
                if (typeof cb === 'function') cb();
            }, function(err) {
                if (typeof cb === 'function') cb();
            });
            return;
        }

        try {
            var electron = window.require ? window.require('electron') : null;
            var fs = window.require ? window.require('fs') : null;
            var path = window.require ? window.require('path') : null;
            var os = window.require ? window.require('os') : null;

            if (fs && path && os) {
                var home = os.homedir();
                var candidateSessionFiles = [
                    path.join(home, '.easyea', 'drawio_active_session.json'),
                    path.join(home, '.easyea', 'config.json')
                ];

                for (var ci = 0; ci < candidateSessionFiles.length; ci++) {
                    var sessionFile = candidateSessionFiles[ci];
                    if (fs.existsSync(sessionFile)) {
                        var data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
                        if (data && data.config) {
                            saveConfig(data.config);
                        } else if (data && data.token) {
                            saveConfig(data);
                        }
                        if (data && data.active_schema) {
                            setActiveSchema(data.active_schema);
                        }
                        break;
                    }
                }
            }
        } catch(e) {}
        if (typeof cb === 'function') cb();
    }

    // Run check on startup and when window regains focus
    checkIncomingExternalSession();
    setTimeout(function() { checkIncomingExternalSession(); }, 400);
    setTimeout(function() { checkIncomingExternalSession(); }, 1500);
    window.addEventListener('focus', function() { checkIncomingExternalSession(); });

    // HTML5 postMessage bridge for Draw.io Web: receive auth & active schema session from parent window or opener
    window.addEventListener('message', function(evt) {
        if (!evt.data) return;
        try {
            var d = (typeof evt.data === 'string') ? JSON.parse(evt.data) : evt.data;
            if (d && (d.action === 'easyeaAuthSession' || d.event === 'easyeaAuthSession')) {
                if (d.config && d.config.token) {
                    saveConfig(d.config);
                } else if (d.token) {
                    saveConfig({
                        server_url: d.server_url || window.location.origin,
                        token: d.token,
                        username: d.username || 'admin',
                        full_name: d.full_name || 'Amministratore'
                    });
                }
                if (d.config && d.config.stencil_mode) {
                    try {
                        localStorage.setItem('easyea_drawio_stencil_mode', d.config.stencil_mode);
                    } catch(e) {}
                    setTimeout(initEasyEASidebarPalette, 100);
                }
                if (d.active_schema) {
                    setActiveSchema(d.active_schema);
                }
            }
        } catch(e) {}
    });

    // -------------------------------------------------------------
    // Hook into Extras menu (available in ALL themes & hamburger menu)
    // -------------------------------------------------------------
    if (ui.menus && typeof ui.menus.addPluginMenuItems === 'function') {
        ui.menus.addPluginMenuItems('extras', [
            '-',
            'easyeaSettings',
            'easyeaCheckout',
            'easyeaAddElement',
            'easyeaModernizeCanvas',
            'easyeaStandardizeCanvas',
            'easyeaToggleStencil',
            'easyeaCheckin',
            'easyeaDiscard',
            'easyeaAbout'
        ]);
    }

    // -------------------------------------------------------------
    // Add Menu to Menubar (when classic horizontal menubar is active)
    // -------------------------------------------------------------
    var menuBar = ui.menubar;
    if (menuBar && typeof menuBar.addMenu === 'function') {
        menuBar.addMenu('EasyEA', function(menu, parent) {
            ui.menus.addMenuItem(menu, 'easyeaSettings', parent);
            menu.addSeparator(parent);
            ui.menus.addMenuItem(menu, 'easyeaCheckout', parent);
            ui.menus.addMenuItem(menu, 'easyeaAddElement', parent);
            menu.addSeparator(parent);
            ui.menus.addMenuItem(menu, 'easyeaModernizeCanvas', parent);
            ui.menus.addMenuItem(menu, 'easyeaStandardizeCanvas', parent);
            ui.menus.addMenuItem(menu, 'easyeaToggleStencil', parent);
            menu.addSeparator(parent);
            ui.menus.addMenuItem(menu, 'easyeaCheckin', parent);
            ui.menus.addMenuItem(menu, 'easyeaDiscard', parent);
            menu.addSeparator(parent);
            ui.menus.addMenuItem(menu, 'easyeaAbout', parent);
        });
    }

    // -------------------------------------------------------------
    // Context Menu (Right-Click on Canvas or Element)
    // -------------------------------------------------------------
    if (ui.menus && typeof ui.menus.createPopupMenu === 'function') {
        var oldCreatePopupMenu = ui.menus.createPopupMenu;
        ui.menus.createPopupMenu = function(menu, cell, evt) {
            oldCreatePopupMenu.apply(this, arguments);
            menu.addSeparator();
            var subMenu = menu.addItem('🏛️ EasyEA', null, null);
            ui.menus.addMenuItem(menu, 'easyeaCheckout', subMenu);
            ui.menus.addMenuItem(menu, 'easyeaAddElement', subMenu);
            menu.addSeparator(subMenu);
            ui.menus.addMenuItem(menu, 'easyeaModernizeCanvas', subMenu);
            ui.menus.addMenuItem(menu, 'easyeaStandardizeCanvas', subMenu);
            ui.menus.addMenuItem(menu, 'easyeaToggleStencil', subMenu);
            menu.addSeparator(subMenu);
            ui.menus.addMenuItem(menu, 'easyeaCheckin', subMenu);
            ui.menus.addMenuItem(menu, 'easyeaDiscard', subMenu);
            menu.addSeparator(subMenu);
            ui.menus.addMenuItem(menu, 'easyeaSettings', subMenu);
            ui.menus.addMenuItem(menu, 'easyeaAbout', subMenu);
        };
    }

    // -------------------------------------------------------------
    // Prominent "EasyEA ▾" Button on top header / button container
    // Works in all modern themes (Simple, Atlas, Minimal, Classic)
    // -------------------------------------------------------------
    function installTopHeaderButton() {
        if (document.getElementById('easyea-header-button')) return;
        var container = ui.buttonContainer || document.querySelector('.geMenubarContainer') || document.body;
        if (!container) return;

        var btn = document.createElement('div');
        btn.id = 'easyea-header-button';
        btn.className = 'geBtn';
        btn.style.cssText = 'display:inline-flex;align-items:center;cursor:pointer;padding:4px 10px;margin-right:8px;font-weight:700;font-size:12px;background:#4f46e5;color:#ffffff;border-radius:4px;border:none;box-shadow:0 1px 3px rgba(0,0,0,0.15);user-select:none;vertical-align:middle;';
        setSafeHtml(btn, '<span style="margin-right:6px;font-size:13px;">🏛️</span><span>EasyEA</span><span style="margin-left:5px;font-size:9px;opacity:0.8;">▼</span>');

        btn.addEventListener('click', function(evt) {
            checkIncomingExternalSession(function() {
                var rect = btn.getBoundingClientRect();
                if (typeof ui.showPopupMenu === 'function') {
                    ui.showPopupMenu(function(menu, parent) {
                        ui.menus.addMenuItem(menu, 'easyeaSettings', parent);
                        menu.addSeparator(parent);
                        ui.menus.addMenuItem(menu, 'easyeaCheckout', parent);
                        ui.menus.addMenuItem(menu, 'easyeaAddElement', parent);
                        menu.addSeparator(parent);
                        ui.menus.addMenuItem(menu, 'easyeaModernizeCanvas', parent);
                        ui.menus.addMenuItem(menu, 'easyeaStandardizeCanvas', parent);
                        ui.menus.addMenuItem(menu, 'easyeaToggleStencil', parent);
                        menu.addSeparator(parent);
                        ui.menus.addMenuItem(menu, 'easyeaCheckin', parent);
                        ui.menus.addMenuItem(menu, 'easyeaDiscard', parent);
                        menu.addSeparator(parent);
                        ui.menus.addMenuItem(menu, 'easyeaAbout', parent);
                    }, rect.left, rect.bottom + 4, evt);
                }
            });
        });

        if (ui.buttonContainer && ui.buttonContainer.firstChild) {
            ui.buttonContainer.insertBefore(btn, ui.buttonContainer.firstChild);
        } else if (container.firstChild) {
            container.insertBefore(btn, container.firstChild);
        } else {
            container.appendChild(btn);
        }
    }

    setTimeout(installTopHeaderButton, 100);
    setTimeout(installTopHeaderButton, 1000);
    setTimeout(installTopHeaderButton, 3000);
});
})();
