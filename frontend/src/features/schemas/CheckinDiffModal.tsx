import React, { useState } from 'react';
import {
  ArchiSchema,
  SchemaDiffResult,
  SchemaDiffModifiedElement,
  SchemaDiffRemovedElement,
  SchemaDiffNewElement,
  SchemaDiffModifiedRelationship,
  SchemaDiffNewRelationship,
  SchemaDiffRemovedRelationship
} from '../../types';
import { api } from '../../lib/api';
import {
  Upload,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Trash2,
  PlusCircle,
  FileCheck,
  X,
  RefreshCw,
  Sliders,
  GitMerge,
  Workflow,
  Layers,
  FileCode,
  Link2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface CheckinDiffModalProps {
  schema: ArchiSchema;
  onClose: () => void;
  onSuccess: (updatedSchema: ArchiSchema) => void;
}

export const CheckinDiffModal: React.FC<CheckinDiffModalProps> = ({
  schema,
  onClose,
  onSuccess
}) => {
  const { language } = useLanguage();
  const isIt = language === 'it';
  const [step, setStep] = useState<'upload' | 'diff' | 'confirm'>('upload');
  const [diffViewTab, setDiffViewTab] = useState<'all' | 'elements' | 'relationships'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<SchemaDiffResult | null>(null);

  // Resolution States
  // item_id (element or relationship) -> { field: boolean (overwrite) }
  const [attributeResolutions, setAttributeResolutions] = useState<Record<string, Record<string, boolean>>>({});
  // id -> boolean (remove_from_catalog)
  const [catalogRemovals, setCatalogRemovals] = useState<Record<string, boolean>>({});
  const [commitMessage, setCommitMessage] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleAnalyzeDiff = async () => {
    if (!selectedFile) {
      setError('Seleziona un file .archimate, .drawio o XML prima di procedere.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.checkinDiff(schema.id, selectedFile);
      setDiffResult(res);

      // Initialize default resolutions: overwrite=true for all modified attributes
      const initialAttrRes: Record<string, Record<string, boolean>> = {};
      res.modified_elements.forEach((mel) => {
        initialAttrRes[mel.id] = {};
        mel.changes.forEach((c) => {
          initialAttrRes[mel.id][c.field] = true;
        });
      });
      res.modified_relationships.forEach((mrel) => {
        if (!initialAttrRes[mrel.id]) initialAttrRes[mrel.id] = {};
        mrel.changes.forEach((c) => {
          initialAttrRes[mrel.id][c.field] = true;
        });
      });
      setAttributeResolutions(initialAttrRes);

      // Default: remove_from_catalog = false (keep in catalog)
      const initialCatRem: Record<string, boolean> = {};
      res.removed_elements.forEach((rel) => {
        initialCatRem[rel.id] = false;
      });
      res.removed_relationships.forEach((rel) => {
        initialCatRem[rel.id] = false;
      });
      setCatalogRemovals(initialCatRem);

      const isDrawio = selectedFile.name.toLowerCase().endsWith('.drawio');
      const toolName = isDrawio ? 'Draw.io' : 'Archi';
      const totalNew = (res.summary.new_elements_count || 0) + (res.summary.new_relationships_count || 0);
      const totalMod = (res.summary.modified_elements_count || 0) + (res.summary.modified_relationships_count || 0);
      const totalRem = (res.summary.removed_elements_count || 0) + (res.summary.removed_relationships_count || 0);

      setCommitMessage(
        `Check-in modifiche da ${toolName} (${totalNew} nuovi, ${totalMod} modificati, ${totalRem} rimossi)`
      );
      setStep('diff');
    } catch (err: any) {
      setError(err.message || 'Errore durante l’analisi del diff.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttributeOverwrite = (itemId: string, field: string) => {
    setAttributeResolutions((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: !prev[itemId]?.[field]
      }
    }));
  };

  const handleToggleCatalogRemoval = (id: string) => {
    setCatalogRemovals((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleConfirmCheckin = async () => {
    if (!diffResult) return;
    setLoading(true);
    setError(null);
    try {
      // Build resolution payloads for elements & relationships
      const flatAttrResolutions: any[] = [];
      diffResult.modified_elements.forEach((mel) => {
        mel.changes.forEach((c) => {
          const overwrite = attributeResolutions[mel.id]?.[c.field] ?? true;
          flatAttrResolutions.push({
            id: mel.id,
            field: c.field,
            prop_key: c.prop_key,
            new_value: c.new_value,
            overwrite
          });
        });
      });
      diffResult.modified_relationships.forEach((mrel) => {
        mrel.changes.forEach((c) => {
          const overwrite = attributeResolutions[mrel.id]?.[c.field] ?? true;
          flatAttrResolutions.push({
            id: mrel.id,
            field: c.field,
            prop_key: c.prop_key,
            new_value: c.new_value,
            overwrite
          });
        });
      });

      const flatCatalogRemovals: any[] = [];
      diffResult.removed_elements.forEach((rel) => {
        flatCatalogRemovals.push({
          id: rel.id,
          remove_from_catalog: catalogRemovals[rel.id] ?? false
        });
      });
      diffResult.removed_relationships.forEach((rel) => {
        flatCatalogRemovals.push({
          id: rel.id,
          remove_from_catalog: catalogRemovals[rel.id] ?? false
        });
      });

      const payload = {
        file_content: diffResult.xml_content,
        commit_message: commitMessage.trim() || 'Check-in schema ArchiMate',
        attribute_resolutions: flatAttrResolutions,
        catalog_removals: flatCatalogRemovals,
        new_elements: diffResult.new_elements,
        new_relationships: diffResult.new_relationships
      };

      const res = await api.checkinConfirm(schema.id, payload);
      onSuccess(res.schema);
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio del check-in.');
    } finally {
      setLoading(false);
    }
  };

  const totalElemDiffs = diffResult
    ? (diffResult.summary.new_elements_count || 0) +
      (diffResult.summary.modified_elements_count || 0) +
      (diffResult.summary.removed_elements_count || 0)
    : 0;

  const totalRelDiffs = diffResult
    ? (diffResult.summary.new_relationships_count || 0) +
      (diffResult.summary.modified_relationships_count || 0) +
      (diffResult.summary.removed_relationships_count || 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Check-in Schema ArchiMate</h2>
              <p className="text-xs text-slate-500">
                Schema: <span className="font-semibold text-slate-700">{schema.name}</span> ({schema.current_version}) • Formato: <span className="font-bold text-slate-700">{schema.format === 'drawio' ? 'Draw.io' : 'Archi'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600 shrink-0">
          <div className="flex items-center space-x-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 'upload' ? 'bg-indigo-600 text-white font-bold' : 'bg-emerald-600 text-white'}`}>
              1
            </span>
            <span className={step === 'upload' ? 'text-indigo-900 font-bold' : 'text-slate-500'}>Carica File</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-300" />
          <div className="flex items-center space-x-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 'diff' ? 'bg-indigo-600 text-white font-bold' : step === 'confirm' ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
              2
            </span>
            <span className={step === 'diff' ? 'text-indigo-900 font-bold' : 'text-slate-500'}>Review Diff (Elementi & Relazioni)</span>
          </div>
          <div className="w-8 h-[1px] bg-slate-300" />
          <div className="flex items-center space-x-2">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 'confirm' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-300 text-slate-600'}`}>
              3
            </span>
            <span className={step === 'confirm' ? 'text-indigo-900 font-bold' : 'text-slate-500'}>Conferma & Rilascio</span>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <span className="font-bold">Attenzione: </span>
                {error}
              </div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-5">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".archimate,.drawio,.xml"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-3">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-sm font-bold text-slate-800">
                  {selectedFile
                    ? selectedFile.name
                    : isIt
                    ? 'Seleziona o trascina qui il file modificato (.archimate o .drawio)'
                    : 'Select or drag the modified file here (.archimate or .drawio)'}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {isIt
                    ? 'Supporta file nativi Archi (.archimate), Draw.io Desktop (.drawio) e Open Exchange Format (.xml)'
                    : 'Supports native Archi (.archimate), Draw.io Desktop (.drawio) and Open Exchange Format (.xml)'}
                </p>
                {schema.format === 'drawio' && (
                  <p className="text-[11px] font-mono text-slate-600 bg-slate-200/70 px-2.5 py-1 rounded-md mt-2">
                    📁 {isIt ? 'Percorso Draw.io:' : 'Draw.io Path:'} ~/snap/drawio/current/checked_out/ (o ~/.easyea/checked_out/)
                  </p>
                )}
                {selectedFile && (
                  <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{isIt ? 'File pronto' : 'File ready'} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>Matching automatico e Diff Engine completo:</span>
                </div>
                <p>
                  EasyEA effettua il matching per <strong className="font-semibold">Nome + Tipo di elemento</strong> e confronta sia gli elementi che le relazioni del diagramma.
                  Nel passaggio successivo potrai visualizzare tutte le differenze (nuovi elementi/relazioni, attributi modificati, elementi/relazioni rimossi) e confermare le risoluzioni desiderate.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: DIFF REVIEW */}
          {step === 'diff' && diffResult && (
            <div className="space-y-6">
              {/* Comprehensive Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Nuovi Elementi</div>
                  <div className="text-xl font-black text-blue-900 mt-0.5">{diffResult.summary.new_elements_count || 0}</div>
                </div>
                <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Nuove Relazioni</div>
                  <div className="text-xl font-black text-indigo-900 mt-0.5">{diffResult.summary.new_relationships_count || 0}</div>
                </div>
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Elem. Modificati</div>
                  <div className="text-xl font-black text-amber-900 mt-0.5">{diffResult.summary.modified_elements_count || 0}</div>
                </div>
                <div className="p-3 bg-orange-50/80 border border-orange-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Rel. Modificate</div>
                  <div className="text-xl font-black text-orange-900 mt-0.5">{diffResult.summary.modified_relationships_count || 0}</div>
                </div>
                <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Elem. Rimossi</div>
                  <div className="text-xl font-black text-rose-900 mt-0.5">{diffResult.summary.removed_elements_count || 0}</div>
                </div>
                <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Rel. Rimosse</div>
                  <div className="text-xl font-black text-red-900 mt-0.5">{diffResult.summary.removed_relationships_count || 0}</div>
                </div>
              </div>

              {/* Sub-Tabs: All / Elements / Relationships */}
              <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setDiffViewTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    diffViewTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Tutte le Differenze</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiffViewTab('elements')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    diffViewTab === 'elements'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Elementi ({totalElemDiffs})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiffViewTab('relationships')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                    diffViewTab === 'relationships'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Relazioni ({totalRelDiffs})</span>
                </button>
              </div>

              {!diffResult.has_differences && (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-800">Nessuna differenza semantica rilevata</h3>
                  <p className="text-xs text-slate-500">
                    Gli elementi e le relazioni nel file corrispondono al catalogo. Procedendo aggiornerai il layout visivo e creerai una nuova versione dello schema.
                  </p>
                </div>
              )}

              {/* ======================================================== */}
              {/* SECTION: ELEMENT DIFFS                                  */}
              {/* ======================================================== */}
              {(diffViewTab === 'all' || diffViewTab === 'elements') && (
                <>
                  {/* 1. Attributi Elementi Modificati */}
                  {diffResult.modified_elements.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <Sliders className="w-4 h-4 text-amber-600" />
                        <span>Attributi Elementi con Valori Differenti (Scegli se sovrascrivere)</span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">Elemento / Tipo</th>
                              <th className="px-3.5 py-2.5">Attributo</th>
                              <th className="px-3.5 py-2.5 text-slate-500">Valore Attuale in EasyEA</th>
                              <th className="px-3.5 py-2.5 text-indigo-700">Nuovo Valore da File</th>
                              <th className="px-3.5 py-2.5 text-center">Azione</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffResult.modified_elements.map((mel) =>
                              mel.changes.map((change, cIdx) => {
                                const isOverwrite = attributeResolutions[mel.id]?.[change.field] ?? true;
                                return (
                                  <tr key={`${mel.id}-${change.field}-${cIdx}`} className="hover:bg-slate-50">
                                    {cIdx === 0 && (
                                      <td className="px-3.5 py-2.5 font-bold text-slate-900 align-top" rowSpan={mel.changes.length}>
                                        <div>{mel.name}</div>
                                        <div className="text-[10px] text-slate-400 font-normal">{mel.type}</div>
                                      </td>
                                    )}
                                    <td className="px-3.5 py-2.5 font-semibold text-slate-700">{change.label}</td>
                                    <td className="px-3.5 py-2.5 text-slate-500 bg-slate-50/50 max-w-[150px] truncate" title={change.current_value}>
                                      {change.current_value || <span className="italic text-slate-400 font-normal">Vuoto</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-indigo-900 font-semibold max-w-[150px] truncate" title={change.new_value}>
                                      {change.new_value || <span className="italic text-slate-400 font-normal">Vuoto</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAttributeOverwrite(mel.id, change.field)}
                                        className={`px-3 py-1 rounded-lg font-bold text-[11px] transition ${
                                          isOverwrite
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        {isOverwrite ? 'Sovrascrivi' : 'Mantieni Attuale'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 2. Nuovi Elementi */}
                  {diffResult.new_elements.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <PlusCircle className="w-4 h-4 text-emerald-600" />
                        <span>Nuovi Elementi da Aggiungere al Catalogo ({diffResult.new_elements.length})</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                        {diffResult.new_elements.map((ne, idx) => (
                          <div key={idx} className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs flex items-center justify-between">
                            <div>
                              <div className="font-bold text-emerald-950">{ne.name}</div>
                              <div className="text-[10px] text-emerald-700 mt-0.5">{ne.type} • {ne.layer}</div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-full">
                              Nuovo
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Elementi Rimossi */}
                  {diffResult.removed_elements.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>Elementi non più presenti nel disegno ({diffResult.removed_elements.length})</span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">Elemento</th>
                              <th className="px-3.5 py-2.5">Tipo</th>
                              <th className="px-3.5 py-2.5">Layer</th>
                              <th className="px-3.5 py-2.5 text-center">Rimuovi anche dal Catalogo Globale?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffResult.removed_elements.map((rel) => {
                              const removeCatalog = catalogRemovals[rel.id] ?? false;
                              return (
                                <tr key={rel.id} className="hover:bg-slate-50">
                                  <td className="px-3.5 py-2.5 font-bold text-slate-900">{rel.name}</td>
                                  <td className="px-3.5 py-2.5 text-slate-600">{rel.type}</td>
                                  <td className="px-3.5 py-2.5 text-slate-600">{rel.layer}</td>
                                  <td className="px-3.5 py-2.5 text-center">
                                    <label className="inline-flex items-center space-x-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={removeCatalog}
                                        onChange={() => handleToggleCatalogRemoval(rel.id)}
                                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                                      />
                                      <span className={`font-semibold ${removeCatalog ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
                                        {removeCatalog ? 'Sì, elimina dal catalogo' : 'No, rimuovi solo dallo schema'}
                                      </span>
                                    </label>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ======================================================== */}
              {/* SECTION: RELATIONSHIP DIFFS                             */}
              {/* ======================================================== */}
              {(diffViewTab === 'all' || diffViewTab === 'relationships') && (
                <>
                  {/* 4. Relazioni Modificate */}
                  {diffResult.modified_relationships && diffResult.modified_relationships.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <Sliders className="w-4 h-4 text-orange-600" />
                        <span>Relazioni con Attributi Modificati ({diffResult.modified_relationships.length})</span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">Relazione (Sorgente &rarr; Destinazione)</th>
                              <th className="px-3.5 py-2.5">Tipo</th>
                              <th className="px-3.5 py-2.5">Attributo</th>
                              <th className="px-3.5 py-2.5 text-slate-500">Valore EasyEA</th>
                              <th className="px-3.5 py-2.5 text-indigo-700">Nuovo Valore</th>
                              <th className="px-3.5 py-2.5 text-center">Azione</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffResult.modified_relationships.map((mrel) =>
                              mrel.changes.map((change, cIdx) => {
                                const isOverwrite = attributeResolutions[mrel.id]?.[change.field] ?? true;
                                return (
                                  <tr key={`${mrel.id}-${change.field}-${cIdx}`} className="hover:bg-slate-50">
                                    {cIdx === 0 && (
                                      <td className="px-3.5 py-2.5 font-bold text-slate-900 align-top" rowSpan={mrel.changes.length}>
                                        <div className="flex items-center space-x-1.5">
                                          <span>{mrel.source_name || 'Sorgente'}</span>
                                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                          <span>{mrel.target_name || 'Destinazione'}</span>
                                        </div>
                                      </td>
                                    )}
                                    <td className="px-3.5 py-2.5 text-slate-600 font-mono text-[11px]">{mrel.type}</td>
                                    <td className="px-3.5 py-2.5 font-semibold text-slate-700">{change.label}</td>
                                    <td className="px-3.5 py-2.5 text-slate-500 bg-slate-50/50 max-w-[130px] truncate" title={change.current_value}>
                                      {change.current_value || <span className="italic text-slate-400 font-normal">Vuoto</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-indigo-900 font-semibold max-w-[130px] truncate" title={change.new_value}>
                                      {change.new_value || <span className="italic text-slate-400 font-normal">Vuoto</span>}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAttributeOverwrite(mrel.id, change.field)}
                                        className={`px-3 py-1 rounded-lg font-bold text-[11px] transition ${
                                          isOverwrite
                                            ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                                        }`}
                                      >
                                        {isOverwrite ? 'Sovrascrivi' : 'Mantieni'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 5. Nuove Relazioni */}
                  {diffResult.new_relationships && diffResult.new_relationships.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <GitMerge className="w-4 h-4 text-indigo-600" />
                        <span>Nuove Relazioni da Aggiungere al Catalogo ({diffResult.new_relationships.length})</span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">Sorgente</th>
                              <th className="px-3.5 py-2.5">Tipo Relazione</th>
                              <th className="px-3.5 py-2.5">Destinazione</th>
                              <th className="px-3.5 py-2.5">Nome / Note</th>
                              <th className="px-3.5 py-2.5 text-center">Stato</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffResult.new_relationships.map((nrel, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-3.5 py-2.5 font-bold text-slate-900">{nrel.source_name || nrel.source_xml_id}</td>
                                <td className="px-3.5 py-2.5">
                                  <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {nrel.type}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 font-bold text-slate-900">{nrel.target_name || nrel.target_xml_id}</td>
                                <td className="px-3.5 py-2.5 text-slate-500">{nrel.name || nrel.documentation || '—'}</td>
                                <td className="px-3.5 py-2.5 text-center">
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full">
                                    Nuova
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 6. Relazioni Rimosse */}
                  {diffResult.removed_relationships && diffResult.removed_relationships.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm font-bold text-slate-800">
                        <Trash2 className="w-4 h-4 text-red-600" />
                        <span>Relazioni non più presenti nel disegno ({diffResult.removed_relationships.length})</span>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                              <th className="px-3.5 py-2.5">Sorgente &rarr; Destinazione</th>
                              <th className="px-3.5 py-2.5">Tipo Relazione</th>
                              <th className="px-3.5 py-2.5">Nome</th>
                              <th className="px-3.5 py-2.5 text-center">Rimuovi anche dal Catalogo Globale?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {diffResult.removed_relationships.map((rrel) => {
                              const removeCatalog = catalogRemovals[rrel.id] ?? false;
                              return (
                                <tr key={rrel.id} className="hover:bg-slate-50">
                                  <td className="px-3.5 py-2.5 font-bold text-slate-900">
                                    <div className="flex items-center space-x-1.5">
                                      <span>{rrel.source_name || 'Sorgente'}</span>
                                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{rrel.target_name || 'Destinazione'}</span>
                                    </div>
                                  </td>
                                  <td className="px-3.5 py-2.5 text-slate-600 font-mono text-[11px]">{rrel.type}</td>
                                  <td className="px-3.5 py-2.5 text-slate-500">{rrel.name || '—'}</td>
                                  <td className="px-3.5 py-2.5 text-center">
                                    <label className="inline-flex items-center space-x-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={removeCatalog}
                                        onChange={() => handleToggleCatalogRemoval(rrel.id)}
                                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                                      />
                                      <span className={`font-semibold ${removeCatalog ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
                                        {removeCatalog ? 'Sì, elimina dal catalogo' : 'No, rimuovi solo dallo schema'}
                                      </span>
                                    </label>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* STEP 3: COMMIT MESSAGE & FINAL CONFIRM */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isIt ? 'Messaggio di Commit / Note di Rilascio' : 'Commit Message / Release Notes'}
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={isIt ? 'Descrivi brevemente cosa è stato modificato...' : 'Briefly describe what has been modified...'}
                  rows={4}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">{isIt ? 'Riepilogo finale operazione:' : 'Final operation summary:'}</div>
                <div>{isIt ? `• Verrà creata una nuova versione nello storico (${schema.current_version} → successiva).` : `• A new version will be created in history (${schema.current_version} → next).`}</div>
                <div>{isIt ? '• Lo schema verrà sbloccato e tornerà disponibile per gli altri architetti.' : '• The schema will be unlocked and available again to other architects.'}</div>
                <div>{isIt ? '• Gli attributi, le relazioni e il catalogo EasyEA verranno sincronizzati in base alle scelte effettuate.' : '• EasyEA attributes, relationships and catalog will be synchronized according to your choices.'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition"
          >
            Annulla
          </button>

          <div className="flex items-center space-x-2">
            {step === 'diff' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
              >
                Indietro
              </button>
            )}

            {step === 'confirm' && (
              <button
                type="button"
                onClick={() => setStep('diff')}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
              >
                Indietro
              </button>
            )}

            {step === 'upload' && (
              <button
                type="button"
                onClick={handleAnalyzeDiff}
                disabled={!selectedFile || loading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 flex items-center space-x-1.5 shadow-sm shadow-indigo-200"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Analizza Differenze &rarr;</span>
              </button>
            )}

            {step === 'diff' && (
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-1.5 shadow-sm shadow-indigo-200"
              >
                <span>Procedi al Commit &rarr;</span>
              </button>
            )}

            {step === 'confirm' && (
              <button
                type="button"
                onClick={handleConfirmCheckin}
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 flex items-center space-x-1.5 shadow-sm shadow-emerald-200"
              >
                {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Conferma Check-in & Rilascia Blocco</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
