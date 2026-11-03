import React, { useState, useEffect } from 'react';
import { ArchiSchema } from '../../types';
import { api } from '../../lib/api';
import {
  FileCode2,
  Play,
  Download,
  Save,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArchimateStandardNode,
  ArchimateSvgDefs,
  getArchimateEdgeProps
} from '../../lib/archimateVisuals';
import { useLanguage } from '../../context/LanguageContext';

const nodeTypes = {
  archimateNode: ArchimateStandardNode,
};

interface SchemaAsCodeModalProps {
  schema?: ArchiSchema | null;
  activeModelId: string;
  folderId?: string;
  onClose: () => void;
  onSaveSuccess?: (updatedSchema: ArchiSchema) => void;
}

export const SchemaAsCodeModal: React.FC<SchemaAsCodeModalProps> = ({
  schema,
  activeModelId,
  folderId,
  onClose,
  onSaveSuccess
}) => {
  const { language } = useLanguage();
  const isIt = language === 'it';
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [validationResult, setValidationResult] = useState<{
    valid?: boolean;
    error?: string;
    line?: number;
    summary?: {
      name: string;
      elements_count: number;
      relationships_count: number;
    };
  } | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Initial code template if creating a new schema
  const defaultTemplate = `schema "Nuova Architettura" {
    model_id: "${activeModelId}"
    version: "1.0"
    documentation: "Architettura definita tramite Schema-as-Code"

    business {
        actor Customer "Cliente Consumer"
        process OrderProcess "Processo d'Ordine" [criticality: "High"]
    }

    application {
        component PortalApp "Web Portal" [time: "Invest", hosting: "Cloud - AWS"]
        component CoreEngine "Core Processing Engine" [time: "Tolerate", sla: "Gold"]
        service OrderService "Servizio Ordini"
    }

    technology {
        node CloudCluster "Kubernetes Cluster"
        data OrderDB "PostgreSQL Database"
    }

    relationships {
        Customer -> OrderProcess : triggers
        OrderProcess -> OrderService : serves
        PortalApp -> CoreEngine : flow "REST/JSON"
        CoreEngine -> OrderService : realizes
        CoreEngine -> OrderDB : access "Lettura e Scrittura"
        CoreEngine -> CloudCluster : assigned-to
    }
}`;

  useEffect(() => {
    const loadCode = async () => {
      setLoading(true);
      try {
        if (schema?.id) {
          const res = await api.getSchemaSaC(schema.id);
          setCode(res.code || '');
        } else {
          setCode(defaultTemplate);
        }
      } catch (err: any) {
        setCode(defaultTemplate);
      } finally {
        setLoading(false);
      }
    };
    loadCode();
  }, [schema?.id]);

  // Validate & Compile
  const handleValidate = async (showSuccessAlert: boolean = true) => {
    if (!code.trim()) return null;
    try {
      const res = await api.compileSaC(code, schema?.model_id || activeModelId);
      if (res.success) {
        setValidationResult({
          valid: true,
          summary: res.summary
        });

        // Update ReactFlow preview nodes/edges
        const viewData = res.data?.view_data || {};
        const rfNodes = (viewData.nodes || []).map((n: any) => ({
          id: n.id,
          type: 'archimateNode',
          position: { x: n.x || 50, y: n.y || 50 },
          data: {
            label: n.name,
            type: n.type,
            layer: n.layer,
            properties: n.properties || {}
          },
          style: { width: n.width || 160, height: n.height || 65 }
        }));

        const rfEdges = (viewData.connections || []).map((c: any) => {
          const edgeVisualProps = getArchimateEdgeProps(c.type);
          return {
            id: c.id,
            source: c.source_node_id || c.source,
            target: c.target_node_id || c.target,
            label: c.name || undefined,
            type: 'default',
            style: edgeVisualProps.style,
            markerEnd: edgeVisualProps.markerEnd
          };
        });

        setNodes(rfNodes);
        setEdges(rfEdges);
        return res;
      } else {
        setValidationResult({
          valid: false,
          error: res.error,
          line: res.line
        });
        return null;
      }
    } catch (err: any) {
      setValidationResult({
        valid: false,
        error: err.message || (isIt ? 'Errore di validazione SaC.' : 'SaC validation error.')
      });
      return null;
    }
  };

  const handleTabChange = async (tab: 'editor' | 'preview') => {
    setActiveTab(tab);
    if (tab === 'preview') {
      await handleValidate(false);
    }
  };

  // Download .eac
  const handleDownloadEac = () => {
    const safeName = (schema?.name || 'schema').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.eac`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download .archimate
  const handleDownloadArchimate = async () => {
    try {
      const blob = await api.downloadSacAsArchimate(code, schema?.model_id || activeModelId);
      const safeName = (schema?.name || 'schema').replace(/[^a-zA-Z0-9_-]/g, '_');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}.archimate`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(isIt ? `Errore nella generazione del file ArchiMate: ${err.message}` : `Error generating ArchiMate file: ${err.message}`);
    }
  };

  // Save changes
  const handleSave = async () => {
    const valRes = await handleValidate(false);
    if (!valRes) {
      alert(isIt ? 'Impossibile salvare: correggi gli errori di sintassi prima di procedere.' : 'Cannot save: please fix syntax errors before proceeding.');
      return;
    }

    setSaving(true);
    try {
      if (schema?.id) {
        const res = await api.updateSchemaFromSaC(schema.id, code, isIt ? 'Aggiornamento da Schema-as-Code Web Editor' : 'Updated from Schema-as-Code Web Editor');
        if (onSaveSuccess) onSaveSuccess(res.schema);
        onClose();
      } else {
        const res = await api.createSchemaFromSaC(code, activeModelId, folderId);
        if (onSaveSuccess) onSaveSuccess(res.schema);
        onClose();
      }
    } catch (err: any) {
      alert(isIt ? `Errore durante il salvataggio: ${err.message}` : `Error while saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {schema ? schema.name : (isIt ? 'Nuovo Schema da Codice' : 'New Schema from Code')}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Schema-as-Code (.eac)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isIt ? 'Linguaggio dichiarativo per Enterprise Architecture bidirezionale con Archi (ArchiMate 3.x)' : 'Declarative language for bidirectional Enterprise Architecture with Archi (ArchiMate 3.x)'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700/60 mr-2">
              <button
                onClick={() => handleTabChange('editor')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  activeTab === 'editor'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>{isIt ? 'Editor Codice' : 'Code Editor'}</span>
              </button>
              <button
                onClick={() => handleTabChange('preview')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-all ${
                  activeTab === 'preview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isIt ? 'Anteprima Diagramma' : 'Diagram Preview'}</span>
              </button>
            </div>

            <button
              onClick={handleDownloadEac}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
              title={isIt ? 'Scarica sorgente .eac' : 'Download .eac source'}
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isIt ? 'Scarica .eac' : 'Download .eac'}</span>
            </button>

            <button
              onClick={handleDownloadArchimate}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors"
              title={isIt ? 'Compila e scarica file .archimate per Archi' : 'Compile and download .archimate file for Archi'}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isIt ? 'Scarica .archimate' : 'Download .archimate'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-slate-950">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <RefreshCw className="w-7 h-7 animate-spin text-indigo-500" />
              <span className="text-sm">{isIt ? 'Caricamento sorgente Schema-as-Code...' : 'Loading Schema-as-Code source...'}</span>
            </div>
          ) : activeTab === 'editor' ? (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              <div className="flex-1 relative rounded-xl border border-slate-800/80 bg-slate-900/90 shadow-inner overflow-hidden flex">
                <textarea
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (validationResult) setValidationResult(null);
                  }}
                  spellCheck={false}
                  placeholder={isIt ? 'Scrivi qui il tuo codice Schema-as-Code (.eac)...' : 'Write your Schema-as-Code (.eac) here...'}
                  className="w-full h-full p-4 font-mono text-sm leading-relaxed text-indigo-100 bg-transparent resize-none focus:outline-none focus:ring-0 selection:bg-indigo-500/30 overflow-auto"
                />
              </div>

              {/* Status bar */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleValidate(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-medium flex items-center space-x-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                    <span>{isIt ? 'Verifica Sintassi' : 'Verify Syntax'}</span>
                  </button>

                  {validationResult?.valid && (
                    <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isIt
                          ? `Sintassi corretta: ${validationResult.summary?.elements_count} elementi, ${validationResult.summary?.relationships_count} relazioni.`
                          : `Valid syntax: ${validationResult.summary?.elements_count} elements, ${validationResult.summary?.relationships_count} relationships.`}
                      </span>
                    </div>
                  )}

                  {validationResult && !validationResult.valid && (
                    <div className="flex items-center space-x-1.5 text-rose-400 font-medium">
                      <AlertTriangle className="w-4 h-4" />
                      <span>
                        {validationResult.line ? (isIt ? `Riga ${validationResult.line}: ` : `Line ${validationResult.line}: `) : ''}
                        {validationResult.error}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-slate-500">
                  <Info className="w-3.5 h-3.5" />
                  <span>{isIt ? 'Sintassi DSL ArchiMate 3.x supportata nativamente' : 'Native ArchiMate 3.x DSL syntax support'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Tab Preview */
            <div className="flex-1 w-full h-full relative">
              <ArchimateSvgDefs />
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                className="bg-slate-950"
              >
                <Background color="#334155" gap={20} size={1} />
                <Controls className="bg-slate-900 border-slate-800 fill-slate-300" />
                <MiniMap
                  className="bg-slate-900 border-slate-800 rounded-lg overflow-hidden"
                  nodeColor="#4f46e5"
                />
              </ReactFlow>

              <div className="absolute top-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-xl shadow-lg flex items-center space-x-2 text-xs text-slate-300">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>
                  {isIt ? 'Anteprima generata dinamicamente con Auto-Layout gerarchico ArchiMate' : 'Dynamically generated preview with hierarchical ArchiMate auto-layout'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {schema ? (
              <span>{isIt ? 'Salvando verrà generata una nuova versione nello storico dello schema.' : 'Saving will create a new version in the schema history.'}</span>
            ) : (
              <span>{isIt ? 'Verrà creato un nuovo schema nel catalogo corrente.' : 'A new schema will be created in the current catalog.'}</span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              {isIt ? 'Annulla' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center space-x-1.5 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{isIt ? 'Salvataggio...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{schema ? (isIt ? 'Salva Modifiche' : 'Save Changes') : (isIt ? 'Crea Schema da SaC' : 'Create Schema from SaC')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
