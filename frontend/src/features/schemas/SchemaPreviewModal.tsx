import React, { useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArchiSchema, ArchimateElementItem } from '../../types';
import { X, Layers, Box, Download, RefreshCw, ZoomIn, Info } from 'lucide-react';
import { api } from '../../lib/api';
import {
  ArchimateStandardNode,
  ArchimateSvgDefs,
  getArchimateEdgeProps,
  getLayerTheme,
  ArchiConceptIcon
} from '../../lib/archimateVisuals';

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
  const [schemaDetail, setSchemaDetail] = useState<ArchiSchema>(initialSchema);
  const [elementsList, setElementsList] = useState<ArchimateElementItem[]>(initialElements);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  // Fetch full schema detail & elements on mount
  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      setLoading(true);
      try {
        const [detail, elems] = await Promise.all([
          api.getSchemaDetail(initialSchema.id),
          initialElements.length > 0 ? Promise.resolve(initialElements) : api.getElements(initialSchema.model_id).catch(() => [])
        ]);
        if (isMounted) {
          setSchemaDetail(detail);
          setElementsList(elems);
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

  const viewData = schemaDetail.view_data || {};
  const rawNodes = viewData.nodes || [];
  const rawConns = viewData.connections || [];

  const nodes = useMemo(() => {
    return rawNodes.map((n: any, idx: number) => {
      const el = n.element_id ? elementLookup.get(n.element_id) : null;
      const label = el ? el.name : n.name || n.element_id || `Element ${idx + 1}`;
      const type = el ? el.type : n.type || 'ApplicationComponent';
      const layer = el ? el.layer : n.layer || 'Application';
      const nodeId = n.id || `node-${idx}`;

      return {
        id: nodeId,
        type: 'archimateNode',
        position: { x: Number(n.x) || 100 + (idx % 4) * 220, y: Number(n.y) || 100 + Math.floor(idx / 4) * 130 },
        data: {
          label,
          type,
          layer,
          documentation: el?.documentation || n.documentation || '',
          properties: el?.properties || n.properties || {},
          rawElement: el,
          isSelected: selectedNode?.id === nodeId
        },
      };
    });
  }, [rawNodes, elementLookup, selectedNode]);

  const edges = useMemo(() => {
    return rawConns.map((c: any, idx: number) => {
      const edgeProps = getArchimateEdgeProps(c.type || c.name || '', c.name || '');
      return {
        id: c.id || `edge-${idx}`,
        source: c.source_node_id || c.source,
        target: c.target_node_id || c.target,
        type: 'smoothstep',
        ...edgeProps,
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: '#cbd5e1', strokeWidth: 1, rx: 4, ry: 4 }
      };
    });
  }, [rawConns]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-800">{schemaDetail.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  {schemaDetail.current_version}
                </span>
                {schemaDetail.viewpoint && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                    {schemaDetail.viewpoint}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {schemaDetail.documentation || 'Nessuna documentazione disponibile'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={api.downloadSchemaXmlUrl(schemaDetail.id)}
              download={`${schemaDetail.name}.archimate`}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica .archimate</span>
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Diagram Area */}
        <div className="flex-1 relative flex">
          <div className="flex-1 h-full">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs font-semibold">Caricamento nodi diagramma...</p>
              </div>
            ) : nodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <Box className="w-12 h-12 stroke-[1.5] mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">Nessun nodo presente in questo schema</p>
                <p className="text-xs text-slate-400 mt-1">Esegui il checkout e disegna i componenti su Archi.</p>
              </div>
            ) : (
              <>
                <ArchimateSvgDefs />
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  onNodeClick={(_, node) => setSelectedNode(node)}
                  className="bg-slate-50/50"
                  minZoom={0.2}
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
                <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur border border-slate-200/80 rounded-xl px-3.5 py-2 shadow-md flex items-center space-x-3 text-[11px] font-semibold text-slate-700 select-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Layer:</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FFFFC8] border border-[#C6B726]"></span> Business</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#C2FFFF] border border-[#3DA3C0]"></span> Application</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#D4F0C2] border border-[#6EA84B]"></span> Technology</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FBF0D9] border border-[#C89234]"></span> Strategy</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#DCDCFE] border border-[#7878CC]"></span> Motivation</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FFEAE8] border border-[#CB7C7C]"></span> Impl.</span>
                </div>
              </>
            )}
          </div>

          {/* Node Inspector Drawer */}
          {selectedNode && (
            <div className="w-80 border-l border-slate-200 bg-white p-5 overflow-y-auto flex flex-col justify-between shrink-0 shadow-lg">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dettaglio Elemento</span>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-4">
                  <div className="text-sm font-bold text-slate-900">{selectedNode.data?.label}</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {selectedNode.data?.type}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                      {selectedNode.data?.layer}
                    </span>
                  </div>

                  {selectedNode.data?.documentation && (
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Descrizione
                      </div>
                      <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                        {selectedNode.data.documentation}
                      </p>
                    </div>
                  )}

                  {selectedNode.data?.properties && Object.keys(selectedNode.data.properties).length > 0 && (
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Proprietà
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(selectedNode.data.properties).map(([k, v]) => (
                          <div key={k} className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-semibold text-slate-600">{k}: </span>
                            <span className="text-slate-800">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                EasyEA ArchiMate Engine
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
