import React, { useState, useEffect } from 'react';
import { ArchimateElementItem } from '../../types';
import { api } from '../../lib/api';
import { Database, Filter, Search, Plus, Box, Layers, ArrowRight, BookOpen, Check } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ArchitectRepositoryProps {
  modelId: string;
}

const LAYERS = ['All', 'Strategy', 'Business', 'Application', 'Technology', 'Motivation', 'Implementation'];

export const ArchitectRepository: React.FC<ArchitectRepositoryProps> = ({ modelId }) => {
  const { t, interpolate } = useLanguage();
  const [elements, setElements] = useState<ArchimateElementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedElement, setSelectedElement] = useState<any | null>(null);

  const loadElements = async () => {
    setLoading(true);
    try {
      const res = await api.getElements(modelId, selectedLayer === 'All' ? undefined : selectedLayer);
      setElements(res);
      if (res.length > 0 && !selectedElement) {
        const elRes = await fetch(`/api/elements/${res[0].id}`);
        if (elRes.ok) setSelectedElement(await elRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadElements();
  }, [modelId, selectedLayer]);

  const handleSelectElement = async (elemId: string) => {
    try {
      const res = await fetch(`/api/elements/${elemId}`);
      if (res.ok) {
        setSelectedElement(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredElements = elements.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase())
  );

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'Strategy': return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Business': return 'bg-yellow-100 text-yellow-900 border-yellow-300';
      case 'Application': return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'Technology': return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Motivation': return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Implementation': return 'bg-rose-100 text-rose-900 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.architect.repoTitle}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.architect.repoSubtitle}
          </p>
        </div>
      </div>

      {/* Layer Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {LAYERS.map((layer) => (
          <button
            key={layer}
            onClick={() => setSelectedLayer(layer)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              selectedLayer === layer
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {layer === 'All' ? t.architect.allLayers : layer}
          </button>
        ))}
      </div>

      {/* 2-Column Split: Element List (Left) + Element Detail & Relations (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Element List */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t.architect.filterPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredElements.map((el) => {
              const isSelected = selectedElement?.id === el.id;
              return (
                <div
                  key={el.id}
                  onClick={() => handleSelectElement(el.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500/40 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Box className="w-4 h-4 text-slate-400" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{el.name}</h4>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{el.type}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLayerColor(el.layer)}`}>
                    {el.layer}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Element Inspector */}
        <div className="lg:col-span-6">
          {selectedElement ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
              
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getLayerColor(selectedElement.layer)}`}>
                    {selectedElement.layer} Layer • {selectedElement.type}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">ID: {selectedElement.id}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mt-2">{selectedElement.name}</h3>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedElement.documentation || t.architect.noDocAssociated}
                </p>
              </div>

              {/* Business APM Extension if Application */}
              {selectedElement.apm && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 block">
                    {t.architect.connectedApmMetadata}
                  </span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">TIME Quadrant:</span>{' '}
                      <strong className="text-slate-900">{selectedElement.apm.time_quadrant}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">{t.architect.annualCost}:</span>{' '}
                      <strong className="text-slate-900">€{selectedElement.apm.annual_cost?.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">{t.architect.businessOwner}:</span>{' '}
                      <strong className="text-slate-900">{selectedElement.apm.business_owner || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">{t.architect.criticality}:</span>{' '}
                      <strong className="text-slate-900">{selectedElement.apm.business_criticality}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Outgoing Relations */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {interpolate(t.architect.outgoingRelations, { count: selectedElement.outgoing_relations?.length || 0 })}
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedElement.outgoing_relations?.length > 0 ? (
                    selectedElement.outgoing_relations.map((rel: any) => (
                      <div key={rel.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                        <span className="font-mono text-[10px] text-emerald-700 font-bold">{rel.type}</span>
                        <div className="flex items-center space-x-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-bold text-slate-900">{rel.target_name || rel.target_id}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">{t.architect.noOutgoingRelations}</span>
                  )}
                </div>
              </div>

              {/* Incoming Relations */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {interpolate(t.architect.incomingRelations, { count: selectedElement.incoming_relations?.length || 0 })}
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedElement.incoming_relations?.length > 0 ? (
                    selectedElement.incoming_relations.map((rel: any) => (
                      <div key={rel.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                        <span className="font-bold text-slate-900">{rel.source_name || rel.source_id}</span>
                        <span className="font-mono text-[10px] text-indigo-700 font-bold">{rel.type}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">{t.architect.noIncomingRelations}</span>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 text-xs">
              {t.architect.selectElementHint}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

