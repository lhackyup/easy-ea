import React, { useState, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../lib/api';
import { DiagramViewDetail } from '../../types';
import { Layers, Box, Info, Edit3, PlusCircle, Palette, Sparkles, Filter, Focus, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { DrawioEditorModal } from './DrawioEditorModal';
import {
  ArchimateStandardNode,
  ArchimateSvgDefs,
  getArchimateEdgeProps,
  getLayerTheme
} from '../../lib/archimateVisuals';

interface DiagramViewerProps {
  modelId: string;
}

const nodeTypes = {
  archimateNode: ArchimateStandardNode,
};

const ALL_LAYERS = ['Motivation', 'Strategy', 'Business', 'Application', 'Technology', 'Implementation'];

const LAYER_ORDER: Record<string, number> = {
  Motivation: 0,
  Strategy: 1,
  Business: 2,
  Application: 3,
  Technology: 4,
  Implementation: 5,
  Other: 6
};

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ modelId }) => {
  const { t } = useLanguage();
  const [views, setViews] = useState<any[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [currentView, setCurrentView] = useState<DiagramViewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Layer Filter & 1-Hop Neighborhood Focus State
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(ALL_LAYERS));
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Draw.io Editor Modal State
  const [isDrawioOpen, setIsDrawioOpen] = useState(false);
  const [drawioEditView, setDrawioEditView] = useState<DiagramViewDetail | null>(null);

  const fetchViews = async (selectId?: string) => {
    setLoading(true);
    try {
      const vList = await api.getViews(modelId);
      setViews(vList);
      if (vList.length > 0) {
        if (selectId && vList.some((v) => v.id === selectId)) {
          setSelectedViewId(selectId);
        } else if (!selectedViewId || !vList.some((v) => v.id === selectedViewId)) {
          setSelectedViewId(vList[0].id);
        }
      } else {
        setSelectedViewId('');
        setCurrentView(null);
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViews();
  }, [modelId]);

  const buildReactFlowElements = (view: DiagramViewDetail) => {
    const nodeIdsSet = new Set(view.nodes.map((n) => n.id));
    const parentIdsSet = new Set(
      view.nodes
        .map((n) => n.parent_id)
        .filter((pid): pid is string => Boolean(pid && nodeIdsSet.has(pid)))
    );

    // Topological sort so parent nodes always precede child nodes in @xyflow/react
    const nodeById = new Map(view.nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();
    const orderedRawNodes: typeof view.nodes = [];

    const visitNode = (n: (typeof view.nodes)[0]) => {
      if (visited.has(n.id)) return;
      if (n.parent_id && nodeById.has(n.parent_id) && !visited.has(n.parent_id)) {
        visitNode(nodeById.get(n.parent_id)!);
      }
      visited.add(n.id);
      orderedRawNodes.push(n);
    };
    view.nodes.forEach(visitNode);

    const rfNodes = orderedRawNodes.map((n) => {
      const isContainer = parentIdsSet.has(n.id);
      const validParentId = n.parent_id && nodeIdsSet.has(n.parent_id) ? n.parent_id : undefined;
      return {
        id: n.id,
        type: 'archimateNode',
        position: { x: n.x ?? 100, y: n.y ?? 100 },
        parentId: validParentId,
        style: isContainer
          ? {
              width: n.width && n.width > 180 ? n.width : 340,
              height: n.height && n.height > 110 ? n.height : 200,
              zIndex: 0
            }
          : { zIndex: 1 },
        data: {
          label: n.name,
          type: n.type,
          layer: n.layer || 'Application',
          documentation: n.documentation,
          isContainer,
          isSelected: false,
          isDimmed: false
        },
      };
    });

    const rfEdges = view.connections.map((c, idx) => {
      const edgeProps = getArchimateEdgeProps(c.type || c.name || '', c.name || c.type.replace('Relationship', ''));
      return {
        id: c.id || `edge-${idx}`,
        source: c.source_node_id,
        target: c.target_node_id,
        type: 'smoothstep',
        ...edgeProps,
        labelStyle: { fill: '#334155', fontSize: 10, fontWeight: 700 },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.95, stroke: '#cbd5e1', strokeWidth: 1, rx: 4, ry: 4 }
      };
    });

    return { rfNodes, rfEdges };
  };

  const loadViewDetail = async (viewIdToLoad?: string) => {
    const targetId = viewIdToLoad || selectedViewId;
    if (!targetId) return;
    try {
      const view = await api.getViewDetail(targetId);
      setCurrentView(view);
      setFocusedNodeId(null);
      setActiveLayers(new Set(ALL_LAYERS));
      const { rfNodes, rfEdges } = buildReactFlowElements(view);
      setNodes(rfNodes as any);
      setEdges(rfEdges as any);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadViewDetail();
  }, [selectedViewId]);

  // Apply Layer Auto-Layout (ArchiMate Stratified Layout)
  const handleAutoLayoutByLayer = () => {
    setNodes((prevNodes: any[]) => {
      const topLevelNodes = prevNodes.filter((n) => !n.parentId);
      const childNodesByParent = new Map<string, any[]>();
      prevNodes.filter((n) => n.parentId).forEach((c) => {
        const list = childNodesByParent.get(c.parentId) || [];
        list.push(c);
        childNodesByParent.set(c.parentId, list);
      });

      // Group top-level nodes by ArchiMate layer
      const bands = new Map<number, any[]>();
      topLevelNodes.forEach((n) => {
        const layerName = n.data?.layer || 'Application';
        const bandIdx = LAYER_ORDER[layerName] ?? 3;
        const list = bands.get(bandIdx) || [];
        list.push(n);
        bands.set(bandIdx, list);
      });

      const updatedPositions = new Map<string, { x: number; y: number }>();
      const updatedStyles = new Map<string, any>();

      // First layout children inside containers so container sizes are accurate
      childNodesByParent.forEach((children, parentId) => {
        const cols = Math.max(1, Math.ceil(Math.sqrt(children.length)));
        children.forEach((child, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          updatedPositions.set(child.id, {
            x: 24 + col * 190,
            y: 48 + row * 95
          });
        });
        const totalRows = Math.ceil(children.length / cols);
        updatedStyles.set(parentId, {
          width: Math.max(320, cols * 190 + 40),
          height: Math.max(170, totalRows * 95 + 65),
          zIndex: 0
        });
      });

      // Layout top-level bands vertically
      let currentY = 40;
      const sortedBandKeys = Array.from(bands.keys()).sort((a, b) => a - b);
      sortedBandKeys.forEach((bandKey) => {
        const rowNodes = bands.get(bandKey) || [];
        let currentX = 50;
        let maxBandHeight = 95;
        rowNodes.forEach((node) => {
          updatedPositions.set(node.id, { x: currentX, y: currentY });
          const st = updatedStyles.get(node.id) || node.style;
          const nodeWidth = st?.width ? Number(st.width) : 210;
          const nodeHeight = st?.height ? Number(st.height) : 95;
          currentX += nodeWidth + 45;
          if (nodeHeight > maxBandHeight) maxBandHeight = nodeHeight;
        });
        currentY += maxBandHeight + 65;
      });

      return prevNodes.map((n) => ({
        ...n,
        position: updatedPositions.get(n.id) || n.position,
        style: updatedStyles.get(n.id) || n.style
      }));
    });
  };

  const toggleLayerFilter = (layer: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        if (next.size > 1) next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  // Compute visible and focused nodes/edges
  const { displayNodes, displayEdges } = useMemo(() => {
    const visibleNodeIds = new Set(
      nodes
        .filter((n: any) => activeLayers.has(n.data?.layer || 'Application'))
        .map((n: any) => n.id)
    );

    const neighborIds = new Set<string>();
    if (focusedNodeId && visibleNodeIds.has(focusedNodeId)) {
      neighborIds.add(focusedNodeId);
      edges.forEach((e: any) => {
        if (e.source === focusedNodeId) neighborIds.add(e.target);
        if (e.target === focusedNodeId) neighborIds.add(e.source);
      });
      // Also include parent/children of focused node
      nodes.forEach((n: any) => {
        if (n.id === focusedNodeId && n.parentId) neighborIds.add(n.parentId);
        if (n.parentId === focusedNodeId) neighborIds.add(n.id);
      });
    }

    const dNodes = nodes
      .filter((n: any) => visibleNodeIds.has(n.id))
      .map((n: any) => {
        const parentVisible = n.parentId && visibleNodeIds.has(n.parentId);
        return {
          ...n,
          parentId: parentVisible ? n.parentId : undefined,
          data: {
            ...n.data,
            isSelected: n.id === focusedNodeId,
            isDimmed: Boolean(focusedNodeId && neighborIds.size > 0 && !neighborIds.has(n.id))
          }
        };
      });

    const dEdges = edges
      .filter((e: any) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e: any) => {
        const isIncidentToFocus =
          !focusedNodeId || e.source === focusedNodeId || e.target === focusedNodeId;
        return {
          ...e,
          style: {
            ...e.style,
            opacity: isIncidentToFocus ? 1 : 0.15
          }
        };
      });

    return { displayNodes: dNodes, displayEdges: dEdges };
  }, [nodes, edges, activeLayers, focusedNodeId]);

  const focusedNodeLabel = useMemo(() => {
    if (!focusedNodeId) return null;
    const found: any = nodes.find((n: any) => n.id === focusedNodeId);
    return found?.data?.label || focusedNodeId;
  }, [focusedNodeId, nodes]);

  const handleOpenDrawioEdit = async () => {
    if (selectedViewId) {
      try {
        const fresh = await api.getViewDetail(selectedViewId);
        setCurrentView(fresh);
        setDrawioEditView(fresh);
      } catch {
        setDrawioEditView(currentView);
      }
    } else {
      setDrawioEditView(currentView);
    }
    setIsDrawioOpen(true);
  };

  const handleOpenDrawioCreate = () => {
    setDrawioEditView(null);
    setIsDrawioOpen(true);
  };

  const handleDrawioSaved = async (savedViewId: string) => {
    await fetchViews(savedViewId);
    setSelectedViewId(savedViewId);
    await loadViewDetail(savedViewId);
    try {
      const fresh = await api.getViewDetail(savedViewId);
      setDrawioEditView(fresh);
      setCurrentView(fresh);
    } catch {
      // fallback
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.common.initializing}</p>
        </div>
      </div>
    );
  }

  if (views.length === 0) {
    return (
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center space-y-4">
        <Layers className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">{t.architect.noDiagramsInLibrary}</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {t.architect.noDiagramsDesc}
        </p>
        <div>
          <button
            onClick={handleOpenDrawioCreate}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t.schemas.createWithDrawio}</span>
          </button>
        </div>

        {/* Draw.io Modal */}
        <DrawioEditorModal
          modelId={modelId}
          viewDetail={drawioEditView}
          isOpen={isDrawioOpen}
          onClose={() => setIsDrawioOpen(false)}
          onSaved={handleDrawioSaved}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* View Selector Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              {t.architect.selectDiagram}
            </label>
            <select
              value={selectedViewId}
              onChange={(e) => setSelectedViewId(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer"
            >
              {views.map((v) => (
                <option key={v.id} value={v.id} className="bg-white text-slate-900">
                  {v.name} ({v.node_count} {t.common.nodes})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {currentView && (
            <div className="hidden lg:flex items-center space-x-3 text-xs text-slate-500 font-medium mr-2">
              <span>{t.architect.viewpoint} <strong className="text-slate-900">{currentView.viewpoint || 'Standard'}</strong></span>
              <span>•</span>
              <span>{t.common.nodes}: <strong className="text-slate-900">{nodes.length}</strong></span>
              <span>•</span>
              <span>{t.architect.connections} <strong className="text-slate-900">{edges.length}</strong></span>
            </div>
          )}

          {/* Auto-Layout & Draw.io Actions */}
          <button
            onClick={handleAutoLayoutByLayer}
            className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition border border-emerald-200"
            title="Riorganizza automaticamente i nodi per Layer ArchiMate (Motivation/Strategy -> Business -> Application -> Technology)"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Auto-Layout Layer</span>
          </button>

          <button
            onClick={handleOpenDrawioCreate}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer"
            title={t.schemas.createWithDrawioTooltip}
          >
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            <span>{t.schemas.newDrawioView}</span>
          </button>

          {currentView && (
            <button
              onClick={handleOpenDrawioEdit}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow-indigo-600/30 cursor-pointer"
              title={t.schemas.editInDrawioTooltip}
            >
              <Palette className="w-4 h-4" />
              <span>{t.schemas.editInDrawio}</span>
            </button>
          )}
        </div>
      </div>

      {/* Layer Filter & Neighborhood Focus Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Filtra Layer:</span>
          </span>
          {ALL_LAYERS.map((layer) => {
            const isActive = activeLayers.has(layer);
            const theme = getLayerTheme(layer);
            return (
              <button
                key={layer}
                onClick={() => toggleLayerFilter(layer)}
                style={{
                  backgroundColor: isActive ? theme.bg : '#f8fafc',
                  borderColor: isActive ? theme.border : '#e2e8f0',
                  color: isActive ? theme.text : '#94a3b8'
                }}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center space-x-1.5"
              >
                <span
                  style={{ backgroundColor: isActive ? theme.border : '#cbd5e1' }}
                  className="w-2 h-2 rounded-full"
                />
                <span>{layer}</span>
              </button>
            );
          })}
          {activeLayers.size < ALL_LAYERS.length && (
            <button
              onClick={() => setActiveLayers(new Set(ALL_LAYERS))}
              className="text-[11px] font-semibold text-indigo-600 hover:underline ml-1"
            >
              Mostra tutti
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {focusedNodeId ? (
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-bold">
              <Focus className="w-3.5 h-3.5 text-blue-600" />
              <span>Focus 1-Hop: {focusedNodeLabel}</span>
              <button
                onClick={() => setFocusedNodeId(null)}
                className="p-0.5 hover:bg-blue-100 rounded text-blue-600"
                title="Rimuovi isolamento nodo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              Clicca su un nodo per isolarne le relazioni dirette (1-hop)
            </span>
          )}
        </div>
      </div>

      {/* React Flow Interactive Graph Canvas */}
      <div className="h-[620px] bg-slate-50 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
        <ArchimateSvgDefs />
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) =>
            setFocusedNodeId((prev) => (prev === node.id ? null : node.id))
          }
          onPaneClick={() => setFocusedNodeId(null)}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.2}
          maxZoom={2.5}
        >
          <Background color="#cbd5e1" gap={16} />
          <Controls className="bg-white border-slate-200 text-slate-700 shadow-sm" />
          <MiniMap
            nodeColor={(node: any) => {
              const theme = getLayerTheme(node.data?.layer);
              return theme.border;
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-sm"
          />
        </ReactFlow>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-md flex items-center space-x-3 text-[11px] text-slate-700 font-semibold select-none">
          <span className="font-bold text-slate-900">{t.architect.legendTitle}</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FFFFC8] border border-[#C6B726]"></span> Business</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#C2FFFF] border border-[#3DA3C0]"></span> Application</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#D4F0C2] border border-[#6EA84B]"></span> Technology</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#FBF0D9] border border-[#C89234]"></span> Strategy</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#DCDCFE] border border-[#7878CC]"></span> Motivation</span>
        </div>
      </div>

      {/* Draw.io Embedded Editor Modal */}
      <DrawioEditorModal
        modelId={modelId}
        viewDetail={drawioEditView}
        isOpen={isDrawioOpen}
        onClose={() => setIsDrawioOpen(false)}
        onSaved={handleDrawioSaved}
      />
    </div>
  );
};

