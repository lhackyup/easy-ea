import React, { useState, useEffect } from 'react';
import { ArchimateRelationshipItem } from '../../types';
import { api } from '../../lib/api';
import { GitMerge, ArrowRight, Search, Filter, Layers, Database, Box } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface RelationsMatrixProps {
  modelId: string;
}

const RELATION_TYPES = [
  'All',
  'ServingRelationship',
  'RealizationRelationship',
  'CompositionRelationship',
  'AssignmentRelationship',
  'FlowRelationship',
  'TriggeringRelationship',
  'AssociationRelationship'
];

export const RelationsMatrix: React.FC<RelationsMatrixProps> = ({ modelId }) => {
  const { t } = useLanguage();
  const [relationships, setRelationships] = useState<ArchimateRelationshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchRelations = async () => {
      setLoading(true);
      try {
        const res = await api.getRelationships(modelId, selectedType === 'All' ? undefined : selectedType);
        setRelationships(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRelations();
  }, [modelId, selectedType]);

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

  const filtered = relationships.filter((r) =>
    r.source_name.toLowerCase().includes(search.toLowerCase()) ||
    r.target_name.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.architect.relationsTitle}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.architect.relationsSubtitle}
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800">
          {t.architect.totalActiveRelations} <strong className="text-emerald-700">{relationships.length}</strong>
        </div>
      </div>

      {/* Filter by Relation Type */}
      <div className="flex flex-wrap items-center gap-2">
        {RELATION_TYPES.map((tType) => (
          <button
            key={tType}
            onClick={() => setSelectedType(tType)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              selectedType === tType
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tType === 'All' ? t.architect.allLayers : tType.replace('Relationship', '')}
          </button>
        ))}
      </div>

      {/* Search & Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t.architect.filterSourceTarget}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">{t.architect.colSource}</th>
                <th className="py-3.5 px-4 text-center">{t.architect.colRelType}</th>
                <th className="py-3.5 px-4">{t.architect.colTarget}</th>
                <th className="py-3.5 px-4">{t.architect.colDesc}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex flex-col">
                      <span>{r.source_name || r.source_id}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">{r.source_type}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span>{r.type.replace('Relationship', '')}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-600" />
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex flex-col">
                      <span>{r.target_name || r.target_id}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">{r.target_type}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 italic">
                    {r.name || r.documentation || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

