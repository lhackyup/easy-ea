import React, { useEffect, useRef, useState } from 'react';
import { DiagramViewDetail } from '../../types';
import { easyEAToDrawioXml, createEmptyDrawioXml, drawioXmlToEasyEA, DrawioParseResult } from '../../lib/drawio/drawioConverter';
import { buildDrawioArchimateLibrary } from '../../lib/drawio/archimatePalette';
import { openDrawioWeb, setCacheInvalidationCookies, getDrawioBaseUrl } from '../../lib/drawio/drawioWebManager';
import { X, Save, Download, RefreshCw, CheckCircle2, AlertCircle, Layers, PlusCircle, Eye, GitCommit, Globe, ExternalLink } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';

const DRAWIO_ORIGIN = 'https://embed.diagrams.net';

interface DrawioEditorModalProps {
  modelId: string;
  viewDetail?: DiagramViewDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (viewId: string) => void;
}

export const DrawioEditorModal: React.FC<DrawioEditorModalProps> = ({
  modelId,
  viewDetail,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { t } = useLanguage();
  const currentDrawioBaseUrl = getDrawioBaseUrl();
  const activeOrigin = React.useMemo(() => {
    try {
      return new URL(currentDrawioBaseUrl).origin;
    } catch (e) {
      return DRAWIO_ORIGIN;
    }
  }, [currentDrawioBaseUrl]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentXml, setCurrentXml] = useState<string>('');
  const [diagramName, setDiagramName] = useState<string>(viewDetail?.name || 'Nuova Vista Architetturale');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffResult, setDiffResult] = useState<DrawioParseResult | null>(null);
  const [relRules, setRelRules] = useState<Record<string, Record<string, string[]>>>({});
  const [relWarnings, setRelWarnings] = useState<Array<{
    connId: string;
    sourceName: string;
    sourceType: string;
    targetName: string;
    targetType: string;
    requestedType: string;
    fallbackType: string;
  }>>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const xmlRef = useRef<string>('');
  const nameRef = useRef<string>(diagramName);
  const isExportingDownloadRef = useRef<boolean>(false);
  const relRulesRef = useRef<Record<string, Record<string, string[]>>>({});

  // Keep refs in sync
  useEffect(() => {
    nameRef.current = diagramName;
  }, [diagramName]);

  useEffect(() => {
    xmlRef.current = currentXml;
  }, [currentXml]);

  useEffect(() => {
    relRulesRef.current = relRules;
  }, [relRules]);

  // Load ArchiMate relationship rules once when modal opens
  useEffect(() => {
    if (isOpen) {
      api.getMetamodelRelationshipsMatrix()
        .then((matrix) => {
          if (matrix && matrix.rules) {
            setRelRules(matrix.rules);
            relRulesRef.current = matrix.rules;
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Initialize XML string
  useEffect(() => {
    if (isOpen) {
      let initialXml = '';
      if (viewDetail) {
        const name = viewDetail.name || 'Vista Architetturale';
        setDiagramName(name);
        nameRef.current = name;
        initialXml = easyEAToDrawioXml(viewDetail);
      } else {
        const name = 'Nuova Vista Architetturale';
        setDiagramName(name);
        nameRef.current = name;
        initialXml = createEmptyDrawioXml('Nuova Vista EasyEA');
      }
      setCurrentXml(initialXml);
      xmlRef.current = initialXml;
      setLoading(true);
      setStatusMessage(null);
      setShowDiffModal(false);
    }
  }, [isOpen, viewDetail]);

  // Handle postMessage protocol with draw.io embed
  useEffect(() => {
    if (!isOpen) return;

    // Safety fallback: if init is delayed, clear loading after timeout
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const handleMessage = async (event: MessageEvent) => {
      const allowedOrigins = [activeOrigin, DRAWIO_ORIGIN, 'http://localhost:8080', 'http://127.0.0.1:8080'];
      if (!allowedOrigins.includes(event.origin)) return;
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return;
      if (typeof event.data !== 'string') return;

      try {
        const msg = JSON.parse(event.data);
        const postOrigin = activeOrigin || '*';

        // 1. Draw.io requests configuration (when configure=1 is set)
        if (msg.event === 'configure') {
          const archimateLibs = buildDrawioArchimateLibrary();
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({
              action: 'configure',
              config: {
                defaultLibraries: 'archimate3;general',
                enabledLibraries: ['archimate3', 'general'],
                customLibraries: [
                  {
                    title: 'EasyEA ArchiMate 3.x (Metamodello)',
                    entries: archimateLibs
                  }
                ]
              }
            }),
            postOrigin
          );
        }

        // 2. Draw.io is initialized -> Load diagram
        if (msg.event === 'init') {
          setLoading(false);
          clearTimeout(fallbackTimer);
          const xmlToLoad = xmlRef.current || createEmptyDrawioXml(nameRef.current || 'Nuova Vista EasyEA');
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({
              action: 'load',
              autosave: 1,
              xml: xmlToLoad,
              title: nameRef.current || 'EasyEA Diagram'
            }),
            postOrigin
          );
        }

        // 3. User clicked Save inside Draw.io
        if (msg.event === 'save') {
          const xml = msg.xml;
          if (xml) {
            setCurrentXml(xml);
            xmlRef.current = xml;
            await handleProcessSave(xml);
          }
        }

        // 4. User clicked Exit inside Draw.io
        if (msg.event === 'exit') {
          onClose();
        }

        // 5. Export response from draw.io
        if (msg.event === 'export') {
          const xml = msg.data;
          if (xml) {
            setCurrentXml(xml);
            xmlRef.current = xml;

            if (isExportingDownloadRef.current) {
              isExportingDownloadRef.current = false;
              const blob = new Blob([xml], { type: 'application/xml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${(nameRef.current || 'Diagram').replace(/[^a-zA-Z0-9_-]/g, '_')}.drawio`;
              a.click();
              URL.revokeObjectURL(url);
            } else {
              // Triggered from "Salva in EasyEA" button
              await handleProcessSave(xml);
            }
          }
        }
      } catch (e) {
        // Not a JSON message or unrelated message
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      clearTimeout(fallbackTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, viewDetail]);

  // Trigger Save from top toolbar by requesting latest XML from draw.io
  const triggerSaveToEasyEA = () => {
    setSaving(true);
    isExportingDownloadRef.current = false;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        action: 'export',
        format: 'xml'
      }),
      activeOrigin || '*'
    );
  };

  // Trigger Export download from top toolbar
  const triggerExportDownload = () => {
    isExportingDownloadRef.current = true;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({
        action: 'export',
        format: 'xml'
      }),
      activeOrigin || '*'
    );
  };

  // Process and parse XML to update EasyEA repository & views
  const handleProcessSave = async (xmlString: string) => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const parsed = drawioXmlToEasyEA(xmlString, viewDetail);
      setDiffResult(parsed);

      // Validate connections against ArchiMate metamodel rules
      const rules = relRulesRef.current;
      const warnings: Array<{
        connId: string;
        sourceName: string;
        sourceType: string;
        targetName: string;
        targetType: string;
        requestedType: string;
        fallbackType: string;
      }> = [];

      if (rules && Object.keys(rules).length > 0) {
        for (const conn of parsed.connections) {
          const srcNode = parsed.nodes.find((n) => n.id === conn.sourceNodeId);
          const tgtNode = parsed.nodes.find((n) => n.id === conn.targetNodeId);
          if (srcNode && tgtNode) {
            const cleanRel = (conn.type || 'ServingRelationship').replace('Relationship', '').replace('archimate:', '');
            if (cleanRel !== 'Association') {
              const allowedForPair = rules[srcNode.type]?.[tgtNode.type] || [];
              if (!allowedForPair.includes(cleanRel)) {
                warnings.push({
                  connId: conn.id,
                  sourceName: srcNode.name,
                  sourceType: srcNode.type,
                  targetName: tgtNode.name,
                  targetType: tgtNode.type,
                  requestedType: conn.type,
                  fallbackType: 'AssociationRelationship'
                });
              }
            }
          }
        }
      }
      setRelWarnings(warnings);

      const hasNewConns = parsed.connections.some((c) => !c.relationshipId || c.isNew);
      if (parsed.addedElements.length > 0 || hasNewConns || warnings.length > 0) {
        setShowDiffModal(true);
        setSaving(false);
      } else {
        await executeCommit(parsed, xmlString);
      }
    } catch (err: any) {
      console.error('Error saving draw.io diagram:', err);
      setStatusMessage({ type: 'error', text: `Errore durante il salvataggio: ${err.message}` });
      setSaving(false);
    }
  };

  // Commit changes to backend
  const executeCommit = async (parsed: DrawioParseResult, xmlString: string) => {
    setSaving(true);
    try {
      // Map node id -> EasyEA element id
      const nodeToElemMap = new Map<string, string>();
      for (const node of parsed.nodes) {
        if (node.elementId) {
          nodeToElemMap.set(node.id, node.elementId);
        }
      }

      // 1. Create any new elements in EasyEA repository
      for (const elem of parsed.addedElements) {
        try {
          const created = await api.createElement(modelId, {
            name: elem.name,
            type: elem.type || 'ApplicationComponent',
            layer: elem.layer || 'Application',
            documentation: elem.documentation || 'Creato tramite Draw.io Modeler'
          });
          if (created && created.id) {
            elem.elementId = created.id;
            nodeToElemMap.set(elem.id, created.id);
          }
        } catch (e) {
          console.warn('Could not auto-create element in repo:', e);
        }
      }

      // 2. Update any modified existing elements in EasyEA repository
      for (const elem of parsed.updatedElements) {
        if (elem.elementId) {
          try {
            await api.updateElement(elem.elementId, {
              name: elem.name,
              type: elem.type,
              layer: elem.layer
            });
          } catch (e) {
            console.warn('Could not update element in repo:', e);
          }
        }
      }

      // 3. Create or update relationships in EasyEA repository
      for (const conn of parsed.connections) {
        const sourceElemId = nodeToElemMap.get(conn.sourceNodeId) || parsed.nodes.find((n) => n.id === conn.sourceNodeId)?.elementId;
        const targetElemId = nodeToElemMap.get(conn.targetNodeId) || parsed.nodes.find((n) => n.id === conn.targetNodeId)?.elementId;

        if ((!conn.relationshipId || conn.isNew) && sourceElemId && targetElemId) {
          const relType = conn.type || 'ServingRelationship';
          let createdRel;
          try {
            createdRel = await api.createRelationship(modelId, {
              source_id: sourceElemId,
              target_id: targetElemId,
              type: relType,
              name: conn.name || '',
              documentation: 'Creata tramite Draw.io Modeler'
            });
          } catch (relErr) {
            // If specific metamodel rule forbids this type, fallback to AssociationRelationship
            if (relType !== 'AssociationRelationship' && relType !== 'Association') {
              try {
                createdRel = await api.createRelationship(modelId, {
                  source_id: sourceElemId,
                  target_id: targetElemId,
                  type: 'AssociationRelationship',
                  name: conn.name || '',
                  documentation: 'Creata tramite Draw.io Modeler (Associazione)'
                });
              } catch (fallbackErr) {
                console.warn('Could not create fallback relationship in repo:', fallbackErr);
              }
            }
          }

          if (createdRel && createdRel.id) {
            conn.relationshipId = createdRel.id;
          }
        } else if (conn.relationshipId && (conn.name !== undefined || conn.type !== undefined)) {
          try {
            await api.updateRelationship(conn.relationshipId, {
              name: conn.name || '',
              type: conn.type
            });
          } catch (e) {
            console.warn('Could not update relationship in repo:', e);
          }
        }
      }

      // 4. Enrich raw XML with updated easyea_id and relationship_id attributes
      let enrichedXml = xmlString;
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        for (const n of parsed.nodes) {
          const eId = nodeToElemMap.get(n.id) || n.elementId;
          if (eId) {
            const el = xmlDoc.querySelector(`object[id="${n.id}"]`) || xmlDoc.querySelector(`mxCell[id="${n.id}"]`);
            if (el) el.setAttribute('easyea_id', eId);
          }
        }
        for (const c of parsed.connections) {
          if (c.relationshipId) {
            const el = xmlDoc.querySelector(`object[id="${c.id}"]`) || xmlDoc.querySelector(`mxCell[id="${c.id}"]`);
            if (el) el.setAttribute('relationship_id', c.relationshipId);
          }
        }
        enrichedXml = new XMLSerializer().serializeToString(xmlDoc);
      } catch (e) {
        console.warn('Could not enrich drawio xml with ids:', e);
      }

      setCurrentXml(enrichedXml);
      xmlRef.current = enrichedXml;

      // 5. Format view_data for EasyEA
      const viewData = {
        nodes: parsed.nodes.map((n) => ({
          id: n.id,
          element_id: nodeToElemMap.get(n.id) || n.elementId || n.id,
          name: n.name,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          parent_id: n.parentId
        })),
        connections: parsed.connections.map((c) => ({
          id: c.id,
          relationship_id: c.relationshipId,
          type: c.type,
          name: c.name || '',
          source_node_id: c.sourceNodeId,
          target_node_id: c.targetNodeId
        })),
        drawio_xml: enrichedXml
      };

      let targetViewId = viewDetail?.id;
      if (targetViewId) {
        // Update existing view
        await api.updateView(targetViewId, {
          name: diagramName,
          view_data: viewData
        });
        setStatusMessage({ type: 'success', text: 'Vista e catalogo EasyEA salvati con successo!' });
        if (onSaved) onSaved(targetViewId);
      } else {
        // Create new view
        const newView = await api.createView(modelId, {
          name: diagramName,
          viewpoint: 'Total',
          documentation: 'Creata con Draw.io Editor',
          view_data: viewData
        });
        targetViewId = newView.id;
        setStatusMessage({ type: 'success', text: 'Nuova vista creata e salvata con successo!' });
        if (onSaved) onSaved(targetViewId);
      }

      setShowDiffModal(false);
    } catch (err: any) {
      console.error('Commit failed:', err);
      setStatusMessage({ type: 'error', text: `Salvataggio fallito: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  // Download .drawio file
  const downloadDrawioFile = () => {
    const blob = new Blob([currentXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName.replace(/[^a-zA-Z0-9_-]/g, '_')}.drawio`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shadow-lg">
        {/* Left: Diagram Info */}
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={diagramName}
                onChange={(e) => setDiagramName(e.target.value)}
                className="bg-transparent text-white font-bold text-base focus:outline-none focus:border-b focus:border-indigo-500 hover:border-b hover:border-slate-600 transition px-1"
                placeholder={t.schemas.viewNamePlaceholder}
              />
              <span className="text-xs bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                Draw.io + ArchiMate 3.x
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {viewDetail ? `ID: ${viewDetail.id}` : 'Nuova vista da sincronizzare'}
            </p>
          </div>
        </div>

        {/* Center: Status Toast */}
        {statusMessage && (
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold animate-in fade-in slide-in-from-top-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              setCacheInvalidationCookies(modelId, viewDetail?.id);
              openDrawioWeb({
                schemaId: viewDetail?.id || modelId,
                schemaName: diagramName,
                modelId: modelId,
                initialXml: currentXml || (viewDetail ? easyEAToDrawioXml(viewDetail) : createEmptyDrawioXml(diagramName)),
                readonly: false,
                onSave: async (savedXml) => {
                  setCurrentXml(savedXml);
                  await handleProcessSave(savedXml);
                }
              });
            }}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-950/70 hover:bg-indigo-900 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition border border-indigo-700/50 cursor-pointer shadow-sm"
            title={t.schemas.openInNewTabDrawioWeb || 'Apri in nuova scheda (Draw.io Web)'}
          >
            <Globe className="w-4 h-4 text-indigo-400" />
            <span>Nuova Scheda</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </button>

          <button
            onClick={triggerExportDownload}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
            title={t.schemas.downloadDrawioDesktopTooltip}
          >
            <Download className="w-4 h-4" />
            <span>Esporta .drawio</span>
          </button>

          <button
            onClick={triggerSaveToEasyEA}
            disabled={saving}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? t.common.loading : 'Salva in EasyEA'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title={t.schemas.closeEditorTooltip}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Canvas / Iframe Container */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950 text-white space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="text-sm font-bold">{t.schemas.loadingDrawioPalette}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Iniezione stencils e sincronizzazione metamodello EasyEA in corso...
              </p>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={`${currentDrawioBaseUrl}/?embed=1&ui=atlas&spin=1&proto=json&configure=1&libraries=1&libs=archimate3&noExitBtn=0&saveAndExit=0&stealth=1&local=1&sync=none&pwa=0&offline=0&_cb=${Date.now()}`}
          className="w-full h-full border-0"
          title="EasyEA Draw.io Editor"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          allow="fullscreen"
        />
      </div>

      {/* Diff & Sync Confirmation Modal */}
      {showDiffModal && diffResult && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <GitCommit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Riepilogo Differenze Draw.io</h3>
                  <p className="text-xs text-slate-500">
                    Rilevati nuovi elementi disegnati nel canvas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiffModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
              <div className="text-xs text-slate-600 leading-relaxed">
                Le seguenti modifiche rilevate nel canvas Draw.io verranno sincronizzate e registrate nel repository centrale EasyEA:
              </div>

              {diffResult.addedElements.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                    Nuovi Elementi da Creare ({diffResult.addedElements.length})
                  </div>
                  {diffResult.addedElements.map((elem, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900">{elem.name}</span>
                        <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                          {elem.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">{elem.layer}</span>
                    </div>
                  ))}
                </div>
              )}

              {diffResult.connections.filter((c) => !c.relationshipId || c.isNew).length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                    Nuove Relazioni da Registrare ({diffResult.connections.filter((c) => !c.relationshipId || c.isNew).length})
                  </div>
                  {diffResult.connections
                    .filter((c) => !c.relationshipId || c.isNew)
                    .map((conn, idx) => {
                      const srcNode = diffResult.nodes.find((n) => n.id === conn.sourceNodeId);
                      const tgtNode = diffResult.nodes.find((n) => n.id === conn.targetNodeId);
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">
                              {srcNode?.name || conn.sourceNodeId} &rarr; {tgtNode?.name || conn.targetNodeId}
                            </span>
                            <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              {conn.type}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {relWarnings.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase font-bold text-amber-600 tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Avvisi Metamodello ArchiMate ({relWarnings.length})</span>
                  </div>
                  {relWarnings.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1"
                    >
                      <div className="font-bold">
                        {w.sourceName} ({w.sourceType}) &rarr; {w.targetName} ({w.targetType})
                      </div>
                      <div className="text-[11px] text-amber-800">
                        La relazione <span className="font-mono font-semibold">{w.requestedType}</span> non è ammessa dallo standard ArchiMate 3.x tra questi due tipi e verrà registrata come <span className="font-mono font-semibold">{w.fallbackType}</span>.
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-800 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-indigo-600" />
                <span>Tutte le connessioni e posizioni grafiche verranno collegate alla vista.</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowDiffModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Annulla
              </button>
              <button
                onClick={() => executeCommit(diffResult, xmlRef.current)}
                disabled={saving}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Creazione in corso...' : 'Conferma e Salva'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
