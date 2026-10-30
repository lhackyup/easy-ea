import React, { useState, useEffect, useMemo } from 'react';
import { ArchimateElementItem, ArchimateRelationshipItem } from '../../types';
import { api } from '../../lib/api';
import {
  GitMerge,
  ArrowRight,
  Search,
  Filter,
  Layers,
  Database,
  Box,
  Grid,
  List,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
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
  'AccessRelationship',
  'FlowRelationship',
  'TriggeringRelationship',
  'AssociationRelationship'
];

const MATRIX_PRESETS = [
  {
    label: 'App → Processi (Copertura)',
    rowType: 'ApplicationComponent',
    colType: 'BusinessProcess'
  },
  {
    label: 'App → Data Object (Dati/Access)',
    rowType: 'ApplicationComponent',
    colType: 'DataObject'
  },
  {
    label: 'Tech Node → App (Hosting)',
    rowType: 'Node',
    colType: 'ApplicationComponent'
  },
  {
    label: 'App → Capability (Strategia)',
    rowType: 'ApplicationComponent',
    colType: 'Capability'
  }
];

export const RelationsMatrix: React.FC<RelationsMatrixProps> = ({ modelId }) => {
  const { t } = useLanguage();
  const [elements, setElements] = useState<ArchimateElementItem[]>([]);
  const [relationships, setRelationships] = useState<ArchimateRelationshipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'matrix' | 'table'>('matrix');

  // Table mode filters
  const [selectedType, setSelectedType] = useState('All');
  const [search, setSearch] = useState('');

  // 2D Pivot Matrix state
  const [rowElementType, setRowElementType] = useState<string>('ApplicationComponent');
  const [colElementType, setColElementType] = useState<string>('BusinessProcess');
  const [showDerived, setShowDerived] = useState<boolean>(true);
  const [highlightOrphans, setHighlightOrphans] = useState<boolean>(true);

  // Cell Quick-Action Modal state
  const [activeCell, setActiveCell] = useState<{
    rowElem: ArchimateElementItem;
    colElem: ArchimateElementItem;
    directRels: ArchimateRelationshipItem[];
    derivedRels: Array<{ viaName: string; viaType: string; relType: string }>;
  } | null>(null);
  const [allowedTypes, setAllowedTypes] = useState<any[]>([]);
  const [newRelType, setNewRelType] = useState<string>('ServingRelationship');
  const [newRelName, setNewRelName] = useState<string>('');
  const [newRelDirection, setNewRelDirection] = useState<'row_to_col' | 'col_to_row'>('row_to_col');
  const [savingRel, setSavingRel] = useState<boolean>(false);

  // 2D Matrix Row Pagination (drastically speeds up DOM rendering for hundreds of rows)
  const [matrixRowPage, setMatrixRowPage] = useState<number>(1);
  const [matrixRowPageSize, setMatrixRowPageSize] = useState<number | 'all'>(30);

  // Flat Table Pagination
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize, setTablePageSize] = useState<number>(50);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [elemsRes, relsRes] = await Promise.all([
        api.getElements(modelId),
        api.getRelationships(modelId, selectedType === 'All' ? undefined : selectedType)
      ]);
      setElements(elemsRes);
      setRelationships(relsRes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [modelId, selectedType]);

  // Distinct element types present in the workspace
  const availableElementTypes = useMemo(() => {
    const counts = new Map<string, number>();
    elements.forEach((e) => {
      counts.set(e.type, (counts.get(e.type) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));
  }, [elements]);

  // Row and Column elements for the 2D Matrix
  const rowElements = useMemo(() => {
    return elements
      .filter((e) => e.type === rowElementType && (!search || e.name.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [elements, rowElementType, search]);

  const colElements = useMemo(() => {
    return elements
      .filter((e) => e.type === colElementType)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [elements, colElementType]);

  // Build Direct and 2-Hop Derived Relationship Lookup for the 2D Matrix
  const matrixData = useMemo(() => {
    const elemById = new Map(elements.map((e) => [e.id, e]));
    const directMap = new Map<string, ArchimateRelationshipItem[]>();
    const outgoingBySource = new Map<string, ArchimateRelationshipItem[]>();

    relationships.forEach((r) => {
      const key1 = `${r.source_id}::${r.target_id}`;
      const key2 = `${r.target_id}::${r.source_id}`;
      directMap.set(key1, [...(directMap.get(key1) || []), r]);
      if (key1 !== key2) {
        directMap.set(key2, [...(directMap.get(key2) || []), r]);
      }
      outgoingBySource.set(r.source_id, [...(outgoingBySource.get(r.source_id) || []), r]);
    });

    // 2-hop derived relationships: Row -> Intermediate -> Col (optimized with colIds filter)
    const derivedMap = new Map<string, Array<{ viaName: string; viaType: string; relType: string }>>();
    if (showDerived) {
      const colIds = new Set(colElements.map((c) => c.id));
      rowElements.forEach((rEl) => {
        const firstHops = outgoingBySource.get(rEl.id) || [];
        firstHops.forEach((hop1) => {
          const midEl = elemById.get(hop1.target_id);
          if (!midEl || midEl.id === rEl.id) return;
          const secondHops = outgoingBySource.get(midEl.id) || [];
          secondHops.forEach((hop2) => {
            if (hop2.target_id === rEl.id || !colIds.has(hop2.target_id)) return;
            const pairKey = `${rEl.id}::${hop2.target_id}`;
            if (!directMap.has(pairKey)) {
              const list = derivedMap.get(pairKey) || [];
              if (!list.some((d) => d.viaName === midEl.name)) {
                list.push({
                  viaName: midEl.name,
                  viaType: midEl.type,
                  relType: `${hop1.type.replace('Relationship', '')} → ${hop2.type.replace('Relationship', '')}`
                });
                derivedMap.set(pairKey, list);
              }
            }
          });
        });
      });
    }

    // Count coverage per row and per column
    const rowCoverage = new Map<string, number>();
    const colCoverage = new Map<string, number>();
    rowElements.forEach((rEl) => {
      let rCount = 0;
      colElements.forEach((cEl) => {
        const k = `${rEl.id}::${cEl.id}`;
        const hasDirect = (directMap.get(k)?.length || 0) > 0;
        const hasDerived = (derivedMap.get(k)?.length || 0) > 0;
        if (hasDirect || hasDerived) {
          rCount++;
          colCoverage.set(cEl.id, (colCoverage.get(cEl.id) || 0) + 1);
        }
      });
      rowCoverage.set(rEl.id, rCount);
    });

    return { directMap, derivedMap, rowCoverage, colCoverage };
  }, [elements, relationships, rowElements, colElements, showDerived]);

  const totalMatrixRowPages = useMemo(() => {
    if (matrixRowPageSize === 'all') return 1;
    return Math.max(1, Math.ceil(rowElements.length / matrixRowPageSize));
  }, [rowElements.length, matrixRowPageSize]);

  useEffect(() => {
    if (matrixRowPage > totalMatrixRowPages) {
      setMatrixRowPage(1);
    }
  }, [totalMatrixRowPages, matrixRowPage]);

  useEffect(() => {
    setMatrixRowPage(1);
  }, [rowElementType, colElementType, search]);

  const paginatedRowElements = useMemo(() => {
    if (matrixRowPageSize === 'all') return rowElements;
    const start = (matrixRowPage - 1) * matrixRowPageSize;
    return rowElements.slice(start, start + matrixRowPageSize);
  }, [rowElements, matrixRowPage, matrixRowPageSize]);

  const filtered = useMemo(() => {
    return relationships.filter((r) =>
      r.source_name.toLowerCase().includes(search.toLowerCase()) ||
      r.target_name.toLowerCase().includes(search.toLowerCase()) ||
      r.type.toLowerCase().includes(search.toLowerCase())
    );
  }, [relationships, search]);

  const totalTablePages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / tablePageSize));
  }, [filtered.length, tablePageSize]);

  useEffect(() => {
    if (tablePage > totalTablePages) {
      setTablePage(1);
    }
  }, [totalTablePages, tablePage]);

  useEffect(() => {
    setTablePage(1);
  }, [search, selectedType]);

  const paginatedTableRelations = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filtered.slice(start, start + tablePageSize);
  }, [filtered, tablePage, tablePageSize]);

  const orphanRowsCount = useMemo(() => {
    return rowElements.filter((r) => (matrixData.rowCoverage.get(r.id) || 0) === 0).length;
  }, [rowElements, matrixData.rowCoverage]);

  const orphanColsCount = useMemo(() => {
    return colElements.filter((c) => (matrixData.colCoverage.get(c.id) || 0) === 0).length;
  }, [colElements, matrixData.colCoverage]);

  // Open cell modal and load allowed ArchiMate relationship types
  const handleCellClick = async (rowElem: ArchimateElementItem, colElem: ArchimateElementItem) => {
    if (rowElem.id === colElem.id) return;
    const key = `${rowElem.id}::${colElem.id}`;
    const directRels = matrixData.directMap.get(key) || [];
    const derivedRels = matrixData.derivedMap.get(key) || [];
    setActiveCell({ rowElem, colElem, directRels, derivedRels });
    setNewRelDirection('row_to_col');
    setNewRelName('');
    try {
      const allowed = await api.getAllowedRelationshipTypes(rowElem.type, colElem.type);
      setAllowedTypes(allowed || []);
      if (allowed && allowed.length > 0) {
        setNewRelType(allowed[0].type);
      }
    } catch {
      setAllowedTypes([{ type: 'ServingRelationship', name: 'Serving' }, { type: 'AssociationRelationship', name: 'Association' }]);
    }
  };

  const handleDirectionChange = async (dir: 'row_to_col' | 'col_to_row') => {
    setNewRelDirection(dir);
    if (!activeCell) return;
    const srcT = dir === 'row_to_col' ? activeCell.rowElem.type : activeCell.colElem.type;
    const tgtT = dir === 'row_to_col' ? activeCell.colElem.type : activeCell.rowElem.type;
    try {
      const allowed = await api.getAllowedRelationshipTypes(srcT, tgtT);
      setAllowedTypes(allowed || []);
      if (allowed && allowed.length > 0) {
        setNewRelType(allowed[0].type);
      }
    } catch {
      // ignore
    }
  };

  const handleCreateRelationInCell = async () => {
    if (!activeCell) return;
    setSavingRel(true);
    try {
      const srcId = newRelDirection === 'row_to_col' ? activeCell.rowElem.id : activeCell.colElem.id;
      const tgtId = newRelDirection === 'row_to_col' ? activeCell.colElem.id : activeCell.rowElem.id;
      await api.createRelationship(modelId, {
        source_id: srcId,
        target_id: tgtId,
        type: newRelType,
        name: newRelName.trim(),
        documentation: 'Creata da Matrice Relazionale 2D'
      });
      await fetchAllData();
      setActiveCell(null);
    } catch (err: any) {
      alert(err.message || 'Errore nella creazione della relazione');
    } finally {
      setSavingRel(false);
    }
  };

  const handleDeleteRelationInCell = async (relId: string) => {
    setSavingRel(true);
    try {
      await api.deleteRelationship(relId);
      await fetchAllData();
      setActiveCell(null);
    } catch (err: any) {
      alert(err.message || 'Errore nella rimozione della relazione');
    } finally {
      setSavingRel(false);
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

  return (
    <div className="space-y-6 pb-12">
      {/* Title & View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.architect.relationsTitle}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.architect.relationsSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'matrix'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Matrice Pivot 2D</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista Relazioni ({relationships.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* VIEW MODE 1: INTERACTIVE 2D PIVOT MATRIX                           */}
      {/* ================================================================== */}
      {viewMode === 'matrix' && (
        <div className="space-y-4">
          {/* Matrix Controls & Presets */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Viste Rapide EA:
                </span>
                {MATRIX_PRESETS.map((preset, idx) => {
                  const isCurrent = rowElementType === preset.rowType && colElementType === preset.colType;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setRowElementType(preset.rowType);
                        setColElementType(preset.colType);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        isCurrent
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDerived}
                    onChange={(e) => setShowDerived(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Relazioni Derivate (2-Hop)</span>
                  </span>
                </label>

                <label className="inline-flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={highlightOrphans}
                    onChange={(e) => setHighlightOrphans(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <span className="font-semibold text-slate-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Evidenzia Orfani</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Row & Column Type Selectors + Search */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Tipo Elemento su Righe (Asse Y)
                </label>
                <select
                  value={rowElementType}
                  onChange={(e) => setRowElementType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {availableElementTypes.map((item) => (
                    <option key={item.type} value={item.type}>
                      {item.type} ({item.count})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Tipo Elemento su Colonne (Asse X)
                </label>
                <select
                  value={colElementType}
                  onChange={(e) => setColElementType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  {availableElementTypes.map((item) => (
                    <option key={item.type} value={item.type}>
                      {item.type} ({item.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtra righe per nome..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Orphan / Coverage Summary Banner */}
            {highlightOrphans && (orphanRowsCount > 0 || orphanColsCount > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Analisi di Copertura Architetturale:</strong> rilevati{' '}
                    <strong>{orphanRowsCount}</strong> elementi riga ({rowElementType}) e{' '}
                    <strong>{orphanColsCount}</strong> elementi colonna ({colElementType}) privi di relazioni in questa vista.
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 font-semibold">
                  Clicca su una cella per creare o modificare una relazione
                </span>
              </div>
            )}
          </div>

          {/* 2D Pivot Matrix Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {rowElements.length === 0 || colElements.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Nessun elemento trovato per la combinazione <strong>{rowElementType}</strong> &times;{' '}
                <strong>{colElementType}</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="sticky left-0 top-0 z-20 bg-slate-100 p-3 text-left font-extrabold text-slate-800 border-r border-slate-200 min-w-[220px]">
                        <div className="text-[10px] uppercase text-slate-500">
                          {rowElementType} &darr; \ {colElementType} &rarr;
                        </div>
                      </th>
                      {colElements.map((colEl) => {
                        const isColOrphan = highlightOrphans && (matrixData.colCoverage.get(colEl.id) || 0) === 0;
                        return (
                          <th
                            key={colEl.id}
                            className={`sticky top-0 z-10 p-2.5 text-center font-bold border-r border-slate-200 min-w-[135px] max-w-[160px] align-bottom ${
                              isColOrphan ? 'bg-amber-50/90 text-amber-900' : 'bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="line-clamp-2 leading-tight">{colEl.name}</div>
                            {isColOrphan && (
                              <span className="mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-extrabold uppercase">
                                Scoperto
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedRowElements.map((rowEl) => {
                      const isRowOrphan = highlightOrphans && (matrixData.rowCoverage.get(rowEl.id) || 0) === 0;
                      return (
                        <tr key={rowEl.id} className="hover:bg-slate-50/60">
                          <td
                            className={`sticky left-0 z-10 p-3 font-bold border-r border-slate-200 ${
                              isRowOrphan ? 'bg-amber-50 text-amber-950' : 'bg-white text-slate-900'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate max-w-[180px]" title={rowEl.name}>
                                {rowEl.name}
                              </span>
                              {isRowOrphan && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-extrabold uppercase shrink-0">
                                  Orfano
                                </span>
                              )}
                            </div>
                          </td>
                          {colElements.map((colEl) => {
                            const key = `${rowEl.id}::${colEl.id}`;
                            const directRels = matrixData.directMap.get(key) || [];
                            const derivedRels = matrixData.derivedMap.get(key) || [];
                            const isSelf = rowEl.id === colEl.id;

                            return (
                              <td
                                key={colEl.id}
                                onClick={() => !isSelf && handleCellClick(rowEl, colEl)}
                                className={`p-2 text-center border-r border-slate-100 align-middle transition ${
                                  isSelf
                                    ? 'bg-slate-100/70 cursor-not-allowed'
                                    : directRels.length > 0
                                    ? 'bg-emerald-50/50 hover:bg-emerald-100/70 cursor-pointer'
                                    : derivedRels.length > 0
                                    ? 'bg-indigo-50/40 hover:bg-indigo-100/60 cursor-pointer'
                                    : 'hover:bg-slate-100 cursor-pointer group'
                                }`}
                              >
                                {isSelf ? (
                                  <span className="text-slate-300">—</span>
                                ) : directRels.length > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {directRels.map((dr) => {
                                      const isForward = dr.source_id === rowEl.id;
                                      return (
                                        <span
                                          key={dr.id}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300"
                                          title={`${dr.source_name} → ${dr.target_name} (${dr.type})`}
                                        >
                                          <span>{dr.type.replace('Relationship', '')}</span>
                                          <span>{isForward ? '→' : '←'}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : derivedRels.length > 0 ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-dashed border-indigo-300"
                                      title={`Relazione derivata via ${derivedRels[0].viaName} (${derivedRels[0].relType})`}
                                    >
                                      <span>Derivata</span>
                                    </span>
                                    <span className="text-[9px] text-indigo-600 truncate max-w-[110px]">
                                      via {derivedRels[0].viaName}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="opacity-0 group-hover:opacity-100 inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-200/70 text-slate-600 transition">
                                    <Plus className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Matrix Row Pagination Controls */}
            {rowElements.length > 0 && (
              <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">Righe visualizzate:</span>
                  <select
                    value={matrixRowPageSize}
                    onChange={(e) => {
                      const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                      setMatrixRowPageSize(val);
                      setMatrixRowPage(1);
                    }}
                    className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value={20}>20 righe</option>
                    <option value={40}>40 righe</option>
                    <option value={60}>60 righe</option>
                    <option value="all">Tutte ({rowElements.length})</option>
                  </select>
                </div>

                {matrixRowPageSize !== 'all' && totalMatrixRowPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Righe {Math.min((matrixRowPage - 1) * (matrixRowPageSize as number) + 1, rowElements.length)}-
                      {Math.min(matrixRowPage * (matrixRowPageSize as number), rowElements.length)} di {rowElements.length} ({rowElementType})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMatrixRowPage((p) => Math.max(1, p - 1))}
                        disabled={matrixRowPage === 1}
                        className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                        title="Pagina precedente"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-xs font-bold text-slate-800 px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                        {matrixRowPage} / {totalMatrixRowPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMatrixRowPage((p) => Math.min(totalMatrixRowPages, p + 1))}
                        disabled={matrixRowPage === totalMatrixRowPages}
                        className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                        title="Pagina successiva"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* VIEW MODE 2: FLAT TABLE VIEW                                       */}
      {/* ================================================================== */}
      {viewMode === 'table' && (
        <>
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
                  {paginatedTableRelations.map((r) => (
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

            {/* Table Pagination Footer */}
            {filtered.length > 0 && (
              <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <span className="text-[11px] font-semibold text-slate-600">
                  Visualizzate {Math.min((tablePage - 1) * tablePageSize + 1, filtered.length)}-
                  {Math.min(tablePage * tablePageSize, filtered.length)} di {filtered.length} relazioni
                </span>
                {totalTablePages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage === 1}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                      title="Pagina precedente"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-xs font-bold text-slate-800 px-2 py-0.5 bg-white border border-slate-200 rounded-md">
                      {tablePage} / {totalTablePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                      disabled={tablePage === totalTablePages}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                      title="Pagina successiva"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* CELL QUICK-ACTION MODAL (CREATE / INSPECT / DELETE RELATIONSHIP)   */}
      {/* ================================================================== */}
      {activeCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <GitMerge className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Gestione Relazione Cella</h3>
              </div>
              <button
                onClick={() => setActiveCell(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Existing direct relationships */}
              {activeCell.directRels.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Relazioni Dirette Esistenti
                  </div>
                  {activeCell.directRels.map((dr) => (
                    <div
                      key={dr.id}
                      className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {dr.source_name} &rarr; {dr.target_name}
                        </div>
                        <div className="text-[11px] text-emerald-800 font-mono">
                          {dr.type} {dr.name ? `• "${dr.name}"` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteRelationInCell(dr.id)}
                        disabled={savingRel}
                        className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                        title="Elimina relazione"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing derived relationships */}
              {activeCell.derivedRels.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                    Relazioni Indirette / Derivate (2-Hop)
                  </div>
                  {activeCell.derivedRels.map((der, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-indigo-50/70 border border-dashed border-indigo-200 rounded-xl text-xs text-indigo-900"
                    >
                      Passa attraverso <strong>{der.viaName}</strong> ({der.viaType}):{' '}
                      <span className="font-mono text-[11px]">{der.relType}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Create new relationship form */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Aggiungi Nuova Relazione ArchiMate
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Direzione</label>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDirectionChange('row_to_col')}
                      className={`p-2 rounded-xl border text-left text-xs font-bold transition ${
                        newRelDirection === 'row_to_col'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {activeCell.rowElem.name} &rarr; {activeCell.colElem.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDirectionChange('col_to_row')}
                      className={`p-2 rounded-xl border text-left text-xs font-bold transition ${
                        newRelDirection === 'col_to_row'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {activeCell.colElem.name} &rarr; {activeCell.rowElem.name}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tipo Relazione (ammessi dallo standard ArchiMate 3.2)
                  </label>
                  <select
                    value={newRelType}
                    onChange={(e) => setNewRelType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    {allowedTypes.map((at) => (
                      <option key={at.type} value={at.type}>
                        {at.name || at.type.replace('Relationship', '')} ({at.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Etichetta / Descrizione (opzionale)
                  </label>
                  <input
                    type="text"
                    value={newRelName}
                    onChange={(e) => setNewRelName(e.target.value)}
                    placeholder="Es. Serve processo / Legge dati..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveCell(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={handleCreateRelationInCell}
                disabled={savingRel}
                className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingRel ? 'Salvataggio...' : 'Crea Relazione'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


