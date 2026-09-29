import React, { useState, useEffect } from 'react';
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
import { Layers, Box, Info, Edit3, PlusCircle, Palette } from 'lucide-react';
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

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ modelId }) => {
  const { t } = useLanguage();
  const [views, setViews] = useState<any[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [currentView, setCurrentView] = useState<DiagramViewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  const loadViewDetail = async (viewIdToLoad?: string) => {
    const targetId = viewIdToLoad || selectedViewId;
    if (!targetId) return;
    try {
      const view = await api.getViewDetail(targetId);
      setCurrentView(view);

      const rfNodes = view.nodes.map((n) => ({
        id: n.id,
        type: 'archimateNode',
        position: { x: n.x, y: n.y },
        data: {
          label: n.name,
          type: n.type,
          layer: n.layer,
          documentation: n.documentation,
        },
      }));

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

      setNodes(rfNodes);
      setEdges(rfEdges);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadViewDetail();
  }, [selectedViewId]);

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
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Crea Nuova Vista con Draw.io</span>
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

          {/* Draw.io Actions */}
          <button
            onClick={handleOpenDrawioCreate}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200"
            title="Crea una nuova vista con l'editor Draw.io"
          >
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            <span>Nuova Vista Draw.io</span>
          </button>

          {currentView && (
            <button
              onClick={handleOpenDrawioEdit}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow-indigo-600/30"
              title="Modifica il diagramma corrente nell'editor Draw.io integrato"
            >
              <Palette className="w-4 h-4" />
              <span>Modifica in Draw.io</span>
            </button>
          )}
        </div>
      </div>

      {/* React Flow Interactive Graph Canvas */}
      <div className="h-[620px] bg-slate-50 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
        <ArchimateSvgDefs />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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

