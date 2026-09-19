import React, { useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  Handle
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { api } from '../../lib/api';
import { DiagramViewDetail } from '../../types';
import { Layers, Box, Info } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface DiagramViewerProps {
  modelId: string;
}

// Custom ArchiMate Node Component for Light Theme
const ArchimateNode = ({ data }: any) => {
  const getLayerStyle = (layer: string) => {
    switch (layer) {
      case 'Strategy':
        return 'bg-amber-100 border-amber-400 text-amber-950';
      case 'Business':
        return 'bg-yellow-100 border-yellow-400 text-yellow-950';
      case 'Application':
        return 'bg-cyan-100 border-cyan-400 text-cyan-950';
      case 'Technology':
        return 'bg-emerald-100 border-emerald-400 text-emerald-950';
      case 'Motivation':
        return 'bg-purple-100 border-purple-400 text-purple-950';
      default:
        return 'bg-slate-100 border-slate-300 text-slate-900';
    }
  };

  return (
    <div
      className={`px-3 py-2 rounded-xl border-2 shadow-sm min-w-[160px] text-center transition hover:shadow-md ${getLayerStyle(
        data.layer
      )}`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-slate-600" />
      <div className="text-[9px] uppercase font-extrabold tracking-wider opacity-75 mb-0.5">
        {data.type}
      </div>
      <div className="text-xs font-bold leading-snug">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-slate-600" />
    </div>
  );
};

const nodeTypes = {
  archimateNode: ArchimateNode,
};

export const DiagramViewer: React.FC<DiagramViewerProps> = ({ modelId }) => {
  const { t } = useLanguage();
  const [views, setViews] = useState<any[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [currentView, setCurrentView] = useState<DiagramViewDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const fetchViews = async () => {
      setLoading(true);
      try {
        const vList = await api.getViews(modelId);
        setViews(vList);
        if (vList.length > 0) {
          setSelectedViewId(vList[0].id);
        } else {
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
    fetchViews();
  }, [modelId]);

  useEffect(() => {
    if (!selectedViewId) return;

    const loadViewDetail = async () => {
      try {
        const view = await api.getViewDetail(selectedViewId);
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

        const rfEdges = view.connections.map((c) => ({
          id: c.id,
          source: c.source_node_id,
          target: c.target_node_id,
          label: c.name || c.type.replace('Relationship', ''),
          type: 'smoothstep',
          animated: c.type.includes('Flow') || c.type.includes('Triggering'),
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: '#4f46e5',
          },
          style: { stroke: '#4f46e5', strokeWidth: 2 },
          labelStyle: { fill: '#1e293b', fontSize: 10, fontWeight: 700 },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9, stroke: '#e2e8f0' },
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch (err) {
        console.error(err);
      }
    };

    loadViewDetail();
  }, [selectedViewId]);

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
      <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center space-y-3">
        <Layers className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-sm font-bold text-slate-900">{t.architect.noDiagramsInLibrary}</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {t.architect.noDiagramsDesc}
        </p>
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

        {currentView && (
          <div className="flex items-center space-x-3 text-xs text-slate-500 font-medium">
            <span>{t.architect.viewpoint} <strong className="text-slate-900">{currentView.viewpoint || 'Standard'}</strong></span>
            <span>•</span>
            <span>{t.common.nodes}: <strong className="text-slate-900">{nodes.length}</strong></span>
            <span>•</span>
            <span>{t.architect.connections} <strong className="text-slate-900">{edges.length}</strong></span>
          </div>
        )}
      </div>

      {/* React Flow Interactive Graph Canvas */}
      <div className="h-[620px] bg-slate-50 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
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
              switch (node.data?.layer) {
                case 'Strategy': return '#f59e0b';
                case 'Business': return '#eab308';
                case 'Application': return '#06b6d4';
                case 'Technology': return '#10b981';
                default: return '#94a3b8';
              }
            }}
            className="bg-white border border-slate-200 rounded-lg shadow-sm"
          />
        </ReactFlow>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 shadow-md flex items-center space-x-3 text-[11px] text-slate-700 font-semibold">
          <span className="font-bold text-slate-900">{t.architect.legendTitle}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-200 border border-yellow-500"></span> {t.architect.layerBusiness}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-cyan-200 border border-cyan-500"></span> {t.architect.layerApplication}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-500"></span> {t.architect.layerTechnology}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-500"></span> {t.architect.layerStrategy}</span>
        </div>
      </div>
    </div>
  );
};

