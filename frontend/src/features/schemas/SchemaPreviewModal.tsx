import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArchiSchema, ArchimateElementItem, ArchimateRelationshipItem } from '../../types';
import {
  X,
  Layers,
  Box,
  Download,
  RefreshCw,
  LayoutGrid,
  Maximize2,
  FolderTree,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  ArchimateStandardNode,
  ArchimateSvgDefs,
  getArchimateEdgeProps,
  getLayerTheme,
  ArchiConceptIcon
} from '../../lib/archimateVisuals';
import {
  computeArchiMateLayout,
  ARCHIMATE_LAYER_ORDER,
  ARCHIMATE_LAYER_LABELS,
  LayoutOptions
} from '../../lib/archimateLayout';

interface SchemaPreviewModalProps {
  schema: ArchiSchema;
  elements?: ArchimateElementItem[];
  onClose: () => void;
}

const nodeTypes = {
  archimateNode: ArchimateStandardNode,
};

export const SchemaPreviewModal: React.FC<SchemaPreviewModalProps> = ({
  schema: initialSchema,
  elements: initialElements = [],
  onClose
}) => {
  const { t } = useLanguage();
  const [schemaDetail, setSchemaDetail] = useState<ArchiSchema>(initialSchema);
  const [elementsList, setElementsList] = useState<ArchimateElementItem[]>(initialElements);
  const [relationshipsList, setRelationshipsList] = useState<ArchimateRelationshipItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Layout mode controls
  const [layoutMode, setLayoutMode] = useState<LayoutOptions['mode']>('layered');
  const [activeLayerFilter, setActiveLayerFilter] = useState<string>('all');

  // Load details, elements, and relationships
  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const [detail, elems, rels] = await Promise.all([
          api.getSchemaDetail(initialSchema.id),
          initialElements.length > 0 ? Promise.resolve(initialElements) : api.getElements(initialSchema.model_id).catch(() => []),
          api.getRelationships(initialSchema.model_id).catch(() => [])
        ]);
        if (isMounted) {
          setSchemaDetail(detail);
          setElementsList(elems);
          setRelationshipsList(rels);
        }
      } catch (err) {
        console.error('Error loading schema detail for preview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [initialSchema.id, initialSchema.model_id]);

  const elementLookup = useMemo(() => {
    const map = new Map<string, ArchimateElementItem>();
    elementsList.forEach((e) => map.set(e.id, e));
    return map;
  }, [elementsList]);

  const relationshipLookup = useMemo(() => {
    const map = new Map<string, ArchimateRelationshipItem>();
    relationshipsList.forEach((r) => map.set(r.id, r));
    return map;
  }, [relationshipsList]);

  const viewData = schemaDetail.view_data || {};
  const rawNodes = viewData.nodes || [];
  const rawConns = viewData.connections || [];

  // Compute Layout with Auto-Nesting & Layers
  const { layoutNodes, layoutEdges, availableLayers } = useMemo(() => {
    const result = computeArchiMateLayout(
      rawNodes,
      rawConns,
      elementLookup,
      relationshipLookup,
      { mode: layoutMode }
    );

    // Collect layers present in this schema
    const layersPresent = new Set<string>();
    result.nodes.forEach((n) => {
      if (n.data?.layer) {
        layersPresent.add(n.data.layer.toLowerCase());
      }
    });

    // Decorate edges with authentic ArchiMate visual markers & styles
    const enrichedEdges = result.edges.map((e) => {
      const edgeProps = getArchimateEdgeProps(e.type || '', e.label || '');
      return {
        ...e,
        ...edgeProps,
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: '#cbd5e1', strokeWidth: 1, rx: 4, ry: 4 }
      };
    });

    return {
      layoutNodes: result.nodes,
      layoutEdges: enrichedEdges,
      availableLayers: Array.from(layersPresent)
    };
  }, [rawNodes, rawConns, elementLookup, relationshipLookup, layoutMode]);

  // Apply layer filtering & selection highlighting
  const displayNodes = useMemo(() => {
    return layoutNodes.map((n) => {
      const isFilteredOut = activeLayerFilter !== 'all' && n.data?.layer?.toLowerCase() !== activeLayerFilter;
      const isSelected = selectedNode?.id === n.id;

      return {
        ...n,
        data: {
          ...n.data,
          isSelected,
          isDimmed: isFilteredOut
        }
      };
    });
  }, [layoutNodes, activeLayerFilter, selectedNode]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800">{schemaDetail.name}</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {schemaDetail.current_version}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  schemaDetail.format === 'drawio'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {schemaDetail.format === 'drawio' ? '🎨 Draw.io' : '🏛️ ArchiMate'}
                </span>
                {schemaDetail.viewpoint && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                    {schemaDetail.viewpoint}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xl">
                {schemaDetail.documentation || 'Anteprima ad alta definizione con ordinamento per layer e contenitori ArchiMate.'}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center space-x-2">
            {/* Layout Mode Selector */}
            <div className="bg-white border border-slate-300 rounded-xl p-0.5 flex items-center shadow-sm">
              <button
                type="button"
                onClick={() => setLayoutMode('layered')}
                title="Ordina per Strati ArchiMate (Strategy, Business, Application, Technology)"
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  layoutMode === 'layered'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Strati ArchiMate</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('nested')}
                title={t.schemas.nestedContainersTooltip}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  layoutMode === 'nested'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Annidati</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('original')}
                title={t.schemas.originalCoordinatesTooltip}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                  layoutMode === 'original'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Originale</span>
              </button>
            </div>

            <a
              href={api.downloadSchemaXmlUrl(schemaDetail.id)}
              download={`${schemaDetail.name}.${schemaDetail.format === 'drawio' ? 'drawio' : 'archimate'}`}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center space-x-1.5 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar for Layer Sub-selection */}
        {availableLayers.length > 1 && (
          <div className="px-6 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center space-x-2 text-xs">
            <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3" /> Filtra Strato:
            </span>
            <button
              onClick={() => setActiveLayerFilter('all')}
              className={`px-2 py-0.5 rounded-md font-semibold transition ${
                activeLayerFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tutti gli strati
            </button>
            {availableLayers.map((l) => {
              const theme = getLayerTheme(l);
              return (
                <button
                  key={l}
                  onClick={() => setActiveLayerFilter(l === activeLayerFilter ? 'all' : l)}
                  style={{
                    backgroundColor: activeLayerFilter === l ? theme.accent : '#ffffff',
                    color: activeLayerFilter === l ? '#ffffff' : theme.text,
                    borderColor: theme.border
                  }}
                  className="px-2.5 py-0.5 rounded-md font-semibold border text-xs capitalize transition shadow-xs flex items-center gap-1.5"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}
                  />
                  <span>{ARCHIMATE_LAYER_LABELS[l] || l}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Diagram Canvas Area */}
        <div className="flex-1 relative flex">
          <div className="flex-1 h-full">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">{t.schemas.calculatingLayout}</p>
              </div>
            ) : displayNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <Box className="w-12 h-12 stroke-[1.5] mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">{t.schemas.noNodesInSchema}</p>
                <p className="text-xs text-slate-400 mt-1">{t.schemas.checkoutDrawHint}</p>
              </div>
            ) : (
              <>
                <ArchimateSvgDefs />
                <ReactFlow
                  nodes={displayNodes}
                  edges={layoutEdges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  onNodeClick={(_, node) => setSelectedNode(node)}
                  className="bg-slate-50/60"
                  minZoom={0.15}
                  maxZoom={2.5}
                >
                  <Background color="#cbd5e1" gap={16} size={1} />
                  <Controls className="bg-white border-slate-200 shadow-sm rounded-lg overflow-hidden" />
                  <MiniMap
                    className="bg-white border border-slate-200 rounded-lg shadow-sm"
                    nodeColor={(n: any) => {
                      const theme = getLayerTheme(n.data?.layer);
                      return theme.border;
                    }}
                  />
                </ReactFlow>

                {/* ArchiMate Layer Legend */}
                <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur border border-slate-200/90 rounded-xl px-3.5 py-2 shadow-md flex items-center space-x-3 text-[11px] font-semibold text-slate-700 select-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Strati:</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FBF0D9] border border-[#C89234]"></span> Strategy</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FFFFC8] border border-[#C6B726]"></span> Business</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#C2FFFF] border border-[#3DA3C0]"></span> Application</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#D4F0C2] border border-[#6EA84B]"></span> Technology</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#DCDCFE] border border-[#7878CC]"></span> Motivation</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FFEAE8] border border-[#CB7C7C]"></span> Impl.</span>
                </div>
              </>
            )}
          </div>

          {/* Node Inspector Drawer */}
          {selectedNode && (
            <div className="w-80 border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col justify-between shrink-0 shadow-xl animate-in slide-in-from-right duration-150">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ArchiConceptIcon type={selectedNode.data?.type} color="#4f46e5" className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.schemas.componentDetail}</span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-bold text-slate-900 leading-snug">{selectedNode.data?.label}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedNode.data?.type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 capitalize">
                      {selectedNode.data?.layer} Layer
                    </span>
                    {selectedNode.data?.isContainer && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Contenitore ({selectedNode.data?.childrenCount} elementi)
                      </span>
                    )}
                  </div>

                  {selectedNode.data?.documentation && (
                    <div className="mt-4">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Descrizione
                      </div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                        {selectedNode.data.documentation}
                      </p>
                    </div>
                  )}

                  {selectedNode.data?.properties && Object.keys(selectedNode.data.properties).length > 0 && (
                    <div className="mt-4">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Proprietà & Tag
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {Object.entries(selectedNode.data.properties).map(([k, v]) => (
                          <div key={k} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center">
                            <span className="font-semibold text-slate-600">{k}:</span>
                            <span className="text-slate-800 font-medium truncate max-w-[140px]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>EasyEA ArchiMate Layout</span>
                <span className="text-slate-300">v3.x</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
