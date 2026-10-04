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

Draw.loadPlugin(function(ui) {
    'use strict';

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

    function getConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_CONFIG_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return { server_url: 'http://localhost:8000', token: '', username: '', full_name: '' };
    }

    function saveConfig(cfg) {
        try {
            localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
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

    function getShapeStyle(elemType, layer) {
        var baseStyle = SHAPE_STYLES[elemType] || 'rounded=1;whiteSpace=wrap;html=1;arcSize=10;';
        var colors = LAYER_COLORS[layer] || LAYER_COLORS['Application'];
        return baseStyle + 'fillColor=' + colors.fill + ';strokeColor=' + colors.stroke + ';fontColor=' + colors.text + ';fontStyle=1;';
    }

    function getRelStyle(relType) {
        return RELATIONSHIP_STYLES[relType] || 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;strokeColor=#4F46E5;strokeWidth=2;';
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
        var container = createModalContainer('⚙️ Configurazione & Accesso EasyEA', 480);

        var form = document.createElement('div');
        form.innerHTML = 
            '<div style="margin-bottom: 14px;">' +
                '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">URL Server EasyEA:</label>' +
                '<input type="text" id="easyea_server_url" value="' + (config.server_url || 'http://localhost:8000') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
            '</div>' +
            '<div style="margin-bottom: 14px;">' +
                '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Username o Email:</label>' +
                '<input type="text" id="easyea_username" value="' + (config.username || 'admin') + '" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
            '</div>' +
            '<div style="margin-bottom: 14px;">' +
                '<label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px;color:#475569;">Password:</label>' +
                '<input type="password" id="easyea_password" placeholder="Inserisci password..." style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;" />' +
            '</div>' +
            '<div id="easyea_status_box" style="padding:10px;border-radius:6px;font-size:12px;margin-bottom:14px;display:' + (config.token ? 'block' : 'none') + ';background:' + (config.token ? '#f0fdf4' : '#f8fafc') + ';border:1px solid ' + (config.token ? '#bbf7d0' : '#e2e8f0') + ';color:' + (config.token ? '#166534' : '#64748b') + ';">' +
                (config.token ? '🟢 Connesso come <strong>' + (config.full_name || config.username) + '</strong>' : '') +
            '</div>';

        var btnBar = document.createElement('div');
        btnBar.style.display = 'flex';
        btnBar.style.justifyContent = 'flex-end';
        btnBar.style.gap = '8px';
        btnBar.style.marginTop = '16px';

        var btnCancel = document.createElement('button');
        btnCancel.innerText = 'Chiudi';
        btnCancel.style.padding = '8px 14px';
        btnCancel.style.border = '1px solid #cbd5e1';
        btnCancel.style.borderRadius = '6px';
        btnCancel.style.background = '#fff';
        btnCancel.style.cursor = 'pointer';
        btnCancel.onclick = function() { ui.hideDialog(); };

        var btnLogin = document.createElement('button');
        btnLogin.innerText = 'Accedi & Salva';
        btnLogin.style.padding = '8px 16px';
        btnLogin.style.border = 'none';
        btnLogin.style.borderRadius = '6px';
        btnLogin.style.background = '#4f46e5';
        btnLogin.style.color = '#fff';
        btnLogin.style.fontWeight = '600';
        btnLogin.style.cursor = 'pointer';

        btnLogin.onclick = function() {
            var sUrl = (document.getElementById('easyea_server_url').value || '').trim().replace(/\/+$/, '');
            var uName = (document.getElementById('easyea_username').value || '').trim();
            var pWord = (document.getElementById('easyea_password').value || '').trim();
            var statusBox = document.getElementById('easyea_status_box');

            if (!sUrl) { alert('Specificare un URL del server valido.'); return; }
            if (!uName) { alert('Inserire lo username.'); return; }

            btnLogin.disabled = true;
            btnLogin.innerText = 'Accesso in corso...';

            fetch(sUrl + '/api/auth/login', {
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
                statusBox.innerHTML = '🟢 Connesso con successo come <strong>' + newCfg.full_name + '</strong>!';
                btnLogin.disabled = false;
                btnLogin.innerText = 'Accedi & Salva';
                setTimeout(function() { ui.hideDialog(); }, 1200);
            })
            .catch(function(err) {
                btnLogin.disabled = false;
                btnLogin.innerText = 'Accedi & Salva';
                statusBox.style.display = 'block';
                statusBox.style.background = '#fef2f2';
                statusBox.style.border = '1px solid #fecaca';
                statusBox.style.color = '#991b1b';
                statusBox.innerHTML = '❌ ' + err.message;
            });
        };

        btnBar.appendChild(btnCancel);
        btnBar.appendChild(btnLogin);
        container.appendChild(form);
        container.appendChild(btnBar);

        ui.showDialog(container, 480, 360, true, true);
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
        content.innerHTML = '<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Caricamento librerie e schemi disponibili...</div>';
        container.appendChild(content);
        ui.showDialog(container, 620, 480, true, true);

        fetch(config.server_url + '/api/models', {
            headers: { 'Authorization': 'Bearer ' + config.token }
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Sessione scaduta o server non raggiungibile (HTTP ' + res.status + ')');
            return res.json();
        })
        .then(function(models) {
            if (!models || models.length === 0) {
                content.innerHTML = '<div style="color:#ef4444;font-size:13px;">Nessuna libreria trovata sul repository EasyEA.</div>';
                return;
            }

            var modelId = models[0].id;

            function loadSchemasForModel(mId) {
                content.innerHTML = '<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Caricamento schemi per la libreria selezionata...</div>';
                fetch(config.server_url + '/api/schemas/' + mId + '/list', {
                    headers: { 'Authorization': 'Bearer ' + config.token }
                })
                .then(function(res) { return res.json(); })
                .then(function(schemas) {
                    renderSchemasList(models, mId, schemas);
                })
                .catch(function(err) {
                    content.innerHTML = '<div style="color:#ef4444;">Errore: ' + err.message + '</div>';
                });
            }

            function renderSchemasList(modelsList, selectedModelId, schemas) {
                var html = 
                    '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;">' +
                        '<label style="font-size:12px;font-weight:600;color:#475569;">Libreria:</label>' +
                        '<select id="easyea_model_select" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;flex:1;">';
                
                for (var mi = 0; mi < modelsList.length; mi++) {
                    var m = modelsList[mi];
                    html += '<option value="' + m.id + '" ' + (m.id === selectedModelId ? 'selected' : '') + '>' + (m.name || m.id) + ' (' + (m.modeling_tool || 'drawio') + ')</option>';
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
                            ? (isLockedByMe ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">🔒 In uso da te</span>' : '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">🔒 ' + (s.locked_by_username || 'In uso') + '</span>')
                            : '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">🟢 Disponibile</span>';

                        html += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                            '<td style="padding:10px 12px;font-weight:500;">' + s.name + '</td>' +
                            '<td style="padding:10px 12px;color:#64748b;">' + s.current_version + '</td>' +
                            '<td style="padding:10px 12px;">' + badge + '</td>' +
                            '<td style="padding:10px 12px;text-align:right;">';

                        if (!isLocked || isLockedByMe) {
                            html += '<button class="btn-checkout" data-id="' + s.id + '" data-name="' + s.name + '" data-version="' + s.current_version + '" data-locked="' + (isLockedByMe ? '1' : '0') + '" style="background:#4f46e5;color:#fff;border:none;padding:5px 12px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;">' + (isLockedByMe ? 'Riapri' : 'Check-out') + '</button>';
                        } else {
                            html += '<button disabled style="background:#e2e8f0;color:#94a3b8;border:none;padding:5px 12px;border-radius:5px;font-size:12px;cursor:not-allowed;">Bloccato</button>';
                        }
                        html += '</td></tr>';
                    }
                    html += '</tbody></table>';
                }
                html += '</div>';

                content.innerHTML = html;

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
            content.innerHTML = '<div style="color:#ef4444;font-size:13px;">❌ Errore: ' + err.message + '</div>';
        });

        function performCheckout(schemaId, modelId, schemaName, version, alreadyLocked) {
            var doLockPromise = alreadyLocked 
                ? Promise.resolve() 
                : fetch(config.server_url + '/api/schemas/' + schemaId + '/checkout', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + config.token }
                }).then(function(res) {
                    if (!res.ok) return res.json().then(function(d) { throw new Error(d.detail || 'Impossibile bloccare lo schema'); });
                });

            doLockPromise
            .then(function() {
                return fetch(config.server_url + '/api/schemas/' + schemaId + '/download', {
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
            '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">Schema attivo: <strong>' + activeSchema.schema_name + '</strong></div>' +
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

        container.innerHTML += html;
        ui.showDialog(container, 600, 440, true, true);

        document.getElementById('easyea_close_add_elem').onclick = function() { ui.hideDialog(); };

        function executeSearch(query) {
            var resBox = document.getElementById('easyea_catalog_results');
            resBox.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:13px;">Ricerca in corso...</div>';

            var url = config.server_url + '/api/elements?model_id=' + encodeURIComponent(targetModelId);
            if (query) url += '&search=' + encodeURIComponent(query);

            fetch(url, {
                headers: { 'Authorization': 'Bearer ' + config.token }
            })
            .then(function(res) { return res.json(); })
            .then(function(elements) {
                if (!elements || elements.length === 0) {
                    resBox.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:13px;">Nessun elemento trovato nel catalogo.</div>';
                    return;
                }

                var rHtml = '<table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">' +
                    '<thead><tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;">' +
                    '<th style="padding:8px 12px;">Nome</th><th style="padding:8px 12px;">Tipo</th><th style="padding:8px 12px;">Layer</th><th style="padding:8px 12px;text-align:right;">Azione</th></tr></thead><tbody>';

                for (var ei = 0; ei < elements.length; ei++) {
                    var el = elements[ei];
                    var layer = el.layer || 'Application';
                    var lColors = LAYER_COLORS[layer] || LAYER_COLORS['Application'];

                    rHtml += '<tr style="border-bottom:1px solid #f1f5f9;">' +
                        '<td style="padding:8px 12px;font-weight:500;">' + el.name + '</td>' +
                        '<td style="padding:8px 12px;color:#64748b;font-size:12px;">' + el.type + '</td>' +
                        '<td style="padding:8px 12px;"><span style="background:' + lColors.fill + ';color:' + lColors.text + ';border:1px solid ' + lColors.stroke + ';padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">' + layer + '</span></td>' +
                        '<td style="padding:8px 12px;text-align:right;">' +
                            '<button class="btn-insert-elem" data-elem=\'' + JSON.stringify(el).replace(/'/g, "&apos;") + '\' style="background:#059669;color:#fff;border:none;padding:4px 10px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;">+ Inserisci</button>' +
                        '</td></tr>';
                }
                rHtml += '</tbody></table>';
                resBox.innerHTML = rHtml;

                var insertButtons = resBox.querySelectorAll('.btn-insert-elem');
                insertButtons.forEach(function(ib) {
                    ib.onclick = function() {
                        var elemData = JSON.parse(ib.getAttribute('data-elem'));
                        insertElementIntoDiagram(elemData);
                    };
                });
            })
            .catch(function(err) {
                resBox.innerHTML = '<div style="padding:16px;color:#ef4444;font-size:13px;">Errore: ' + err.message + '</div>';
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

            var style = getShapeStyle(elem.type || 'ApplicationComponent', elem.layer || 'Application');

            // Find neat center position
            var view = graph.getView();
            var bounds = graph.getGraphBounds();
            var x = 120 + Math.floor(Math.random() * 80);
            var y = 120 + Math.floor(Math.random() * 80);
            var width = 160;
            var height = 65;

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
        content.innerHTML = '<div style="font-size:13px;color:#64748b;margin-bottom:12px;">Calcolo delle differenze (Diff) con il repository in corso...</div>';
        container.appendChild(content);
        ui.showDialog(container, 680, 520, true, true);

        // Send multipart form-data to /api/schemas/{id}/checkin-diff
        var formData = new FormData();
        var blob = new Blob([xmlContent], { type: 'application/xml' });
        formData.append('file', blob, 'schema.drawio');

        fetch(config.server_url + '/api/schemas/' + schemaId + '/checkin-diff', {
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
            content.innerHTML = '<div style="color:#ef4444;font-size:13px;">❌ Errore durante il calcolo del diff: ' + err.message + '</div>';
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
                    html += '<div style="font-weight:600;color:#16a34a;margin-bottom:4px;">➕ Nuovi Elementi: ' + newElems.map(function(e){ return e.name; }).join(', ') + '</div>';
                }
                if (newRels.length > 0) {
                    html += '<div style="font-weight:600;color:#2563eb;margin-bottom:4px;">➕ Nuove Relazioni: ' + newRels.map(function(r){ return (r.source_name || 'Src') + ' ➔ ' + (r.target_name || 'Tgt'); }).join(', ') + '</div>';
                }
                if (modElems.length > 0) {
                    html += '<div style="font-weight:600;color:#d97706;margin-bottom:4px;">✏️ Elementi Modificati: ' + modElems.map(function(e){ return e.name; }).join(', ') + '</div>';
                }
                if (modRels.length > 0) {
                    html += '<div style="font-weight:600;color:#9333ea;margin-bottom:4px;">✏️ Relazioni Modificate: ' + modRels.map(function(r){ return (r.source_name || '') + ' ➔ ' + (r.target_name || ''); }).join(', ') + '</div>';
                }
                if (remElems.length > 0) {
                    html += '<div style="font-weight:600;color:#dc2626;margin-bottom:4px;">🗑️ Elementi Rimossi: ' + remElems.map(function(e){ return e.name; }).join(', ') + '</div>';
                }
                if (remRels.length > 0) {
                    html += '<div style="font-weight:600;color:#e11d48;margin-bottom:4px;">🗑️ Relazioni Rimosse: ' + remRels.map(function(r){ return (r.source_name || '') + ' ➔ ' + (r.target_name || ''); }).join(', ') + '</div>';
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

            content.innerHTML = html;

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

                fetch(config.server_url + '/api/schemas/' + schemaId + '/checkin-confirm', {
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

        fetch(config.server_url + '/api/schemas/' + activeSchema.schema_id + '/discard-checkout', {
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
        container.innerHTML += 
            '<div style="font-size:13px;line-height:1.6;color:#334155;margin-bottom:16px;">' +
                '<p><strong>EasyEA Platform Integration</strong> consente la sincronizzazione bidirezionale dei modelli ArchiMate 3.x tra Draw.io Desktop e il catalogo aziendale EasyEA.</p>' +
                '<div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px;border-radius:6px;margin-top:10px;font-size:12px;">' +
                    '<div><strong>Server:</strong> ' + (config.server_url || 'Non configurato') + '</div>' +
                    '<div><strong>Utente:</strong> ' + (config.full_name || config.username || 'Non autenticato') + '</div>' +
                    '<div><strong>Schema Attivo:</strong> ' + (activeSchema ? activeSchema.schema_name + ' (' + activeSchema.version + ')' : 'Nessuno (Disponibile)') + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:flex-end;">' +
                '<button id="easyea_about_close" style="padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Chiudi</button>' +
            '</div>';

        ui.showDialog(container, 420, 260, true, true);
        document.getElementById('easyea_about_close').onclick = function() { ui.hideDialog(); };
    }

    // -------------------------------------------------------------
    // Register Actions & Menus in Draw.io UI
    // -------------------------------------------------------------
    ui.actions.addAction('easyeaSettings', function() { showSettingsDialog(); });
    ui.actions.addAction('easyeaCheckout', function() { showCheckoutDialog(); });
    ui.actions.addAction('easyeaAddElement', function() { showAddElementDialog(); });
    ui.actions.addAction('easyeaCheckin', function() { showCheckinDialog(); });
    ui.actions.addAction('easyeaDiscard', function() { showDiscardCheckoutDialog(); });
    ui.actions.addAction('easyeaAbout', function() { showAboutDialog(); });

    // Add Menu to Menubar
    var menuBar = ui.menubar;
    if (menuBar) {
        menuBar.addMenu('EasyEA', function(menu, parent) {
            ui.menus.addMenuItem(menu, 'easyeaSettings', parent).firstChild.nextSibling.innerHTML = '⚙️ Impostazioni / Login...';
            menu.addSeparator(parent);
            ui.menus.addMenuItem(menu, 'easyeaCheckout', parent).firstChild.nextSibling.innerHTML = '📥 Check-out Schema...';
            ui.menus.addMenuItem(menu, 'easyeaAddElement', parent).firstChild.nextSibling.innerHTML = '🔍 Inserisci Elemento da Catalogo...';
            ui.menus.addMenuItem(menu, 'easyeaCheckin', parent).firstChild.nextSibling.innerHTML = '📤 Check-in Schema (Commit & Diff)...';
            ui.menus.addMenuItem(menu, 'easyeaDiscard', parent).firstChild.nextSibling.innerHTML = '❌ Annulla Check-out (Discard)...';
            menu.addSeparator(parent);
            ui.menus.addMenuItem(menu, 'easyeaAbout', parent).firstChild.nextSibling.innerHTML = 'ℹ️ Informazioni su EasyEA';
        });
    }

});
