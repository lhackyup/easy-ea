import React, { useState, useEffect, useMemo } from 'react';
import { SchemaFolder, ArchiSchema, ArchimateElementItem } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SchemaPreviewModal } from './SchemaPreviewModal';
import { CheckinDiffModal } from './CheckinDiffModal';
import { SchemaVersionHistoryModal } from './SchemaVersionHistoryModal';
import { CreateSchemaModal } from './CreateSchemaModal';
import { ArchiPluginModal } from './ArchiPluginModal';
import { DrawioPaletteModal } from './DrawioPaletteModal';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  FileCode,
  Lock,
  Unlock,
  Download,
  Upload,
  History,
  Eye,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  MoreVertical,
  CheckCircle2,
  Move,
  Cpu,
  Palette
} from 'lucide-react';

interface SchemaRepositoryProps {
  modelId: string;
}

export const SchemaRepository: React.FC<SchemaRepositoryProps> = ({ modelId }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [folders, setFolders] = useState<SchemaFolder[]>([]);
  const [schemas, setSchemas] = useState<ArchiSchema[]>([]);
  const [elements, setElements] = useState<ArchimateElementItem[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'checked_out'>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPluginModalOpen, setIsPluginModalOpen] = useState(false);
  const [isDrawioPaletteOpen, setIsDrawioPaletteOpen] = useState(false);
  const [previewSchema, setPreviewSchema] = useState<ArchiSchema | null>(null);
  const [checkinSchema, setCheckinSchema] = useState<ArchiSchema | null>(null);
  const [historySchema, setHistorySchema] = useState<ArchiSchema | null>(null);

  // Folder Operations State
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [newSubfolderParentId, setNewSubfolderParentId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState('');

  // Drag and Drop state
  const [draggedSchemaId, setDraggedSchemaId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Notifications / feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.assignments.some(
      (a) => a.role === 'admin' && (!a.model_id || a.model_id === modelId)
    );
  }, [user, modelId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fList, sList, eList] = await Promise.all([
        api.getSchemaFolders(modelId),
        api.getSchemas(modelId),
        api.getElements(modelId).catch(() => [])
      ]);
      setFolders(fList);
      setSchemas(sList);
      setElements(eList);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Errore nel caricamento dei dati del repository', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  // Tree helper: build recursive hierarchy
  const folderTree = useMemo(() => {
    const map = new Map<string, SchemaFolder[]>();
    folders.forEach((f) => {
      const pId = f.parent_id || '__root__';
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push(f);
    });
    return map;
  }, [folders]);

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleCreateFolder = async (parentId: string | null) => {
    if (!newFolderName.trim()) return;
    try {
      const created = await api.createSchemaFolder(modelId, {
        name: newFolderName.trim(),
        parent_id: parentId
      });
      setFolders((prev) => [...prev, created]);
      setNewFolderName('');
      setNewSubfolderParentId(undefined);
      if (parentId) {
        setExpandedFolders((prev) => ({ ...prev, [parentId]: true }));
      }
      showToast('Cartella creata con successo.');
    } catch (err: any) {
      showToast(err.message || 'Errore creazione cartella', 'error');
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editingFolderName.trim()) return;
    try {
      await api.updateSchemaFolder(folderId, { name: editingFolderName.trim() });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: editingFolderName.trim() } : f))
      );
      setEditingFolderId(null);
      setEditingFolderName('');
      showToast('Cartella rinominata.');
    } catch (err: any) {
      showToast(err.message || 'Errore rinomina cartella', 'error');
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Eliminare questa cartella? Gli schemi interni verranno spostati nella cartella principale.')) {
      return;
    }
    try {
      await api.deleteSchemaFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      await loadData();
      showToast('Cartella eliminata.');
    } catch (err: any) {
      showToast(err.message || 'Errore eliminazione cartella', 'error');
    }
  };

  // Drag and Drop Schema to Folder
  const handleDragStartSchema = (e: React.DragEvent, schemaId: string) => {
    e.dataTransfer.setData('text/plain', schemaId);
    setDraggedSchemaId(schemaId);
  };

  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    setDragOverFolderId(null);
    const schemaId = e.dataTransfer.getData('text/plain') || draggedSchemaId;
    if (!schemaId) return;

    try {
      const updated = await api.moveSchema(schemaId, targetFolderId);
      setSchemas((prev) => prev.map((s) => (s.id === schemaId ? updated : s)));
      setDraggedSchemaId(null);
      showToast('Schema spostato con successo.');
    } catch (err: any) {
      showToast(err.message || 'Errore durante lo spostamento dello schema', 'error');
    }
  };

  // Schema Actions
  const handleCheckout = async (schema: ArchiSchema) => {
    try {
      const res = await api.checkoutSchema(schema.id);
      setSchemas((prev) => prev.map((s) => (s.id === schema.id ? res.schema : s)));

      // Trigger automatic file download of .archimate
      const blob = new Blob([res.xml_content], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Check-out effettuato con successo. Download del file ${res.filename} avviato.`);
    } catch (err: any) {
      showToast(err.message || 'Errore durante il check-out.', 'error');
    }
  };

  const handleDiscardCheckout = async (schema: ArchiSchema) => {
    if (!window.confirm('Annullare il check-out? Il blocco verrà rilasciato.')) return;
    try {
      const res = await api.discardCheckout(schema.id);
      setSchemas((prev) => prev.map((s) => (s.id === schema.id ? res.schema : s)));
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'Errore durante l’annullamento del check-out.', 'error');
    }
  };

  const handleForcedUnlock = async (schema: ArchiSchema) => {
    if (!window.confirm(`Sblocco forzato: vuoi rimuovere il blocco impostato da ${schema.locked_by_username}?`)) return;
    try {
      const res = await api.forcedUnlock(schema.id);
      setSchemas((prev) => prev.map((s) => (s.id === schema.id ? res.schema : s)));
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'Errore durante lo sblocco forzato.', 'error');
    }
  };

  const handleDeleteSchema = async (schema: ArchiSchema) => {
    if (!window.confirm(`Sei sicuro di voler eliminare definitivamente lo schema "${schema.name}"?`)) return;
    try {
      await api.deleteSchema(schema.id);
      setSchemas((prev) => prev.filter((s) => s.id !== schema.id));
      showToast('Schema eliminato.');
    } catch (err: any) {
      showToast(err.message || 'Errore eliminazione schema', 'error');
    }
  };

  // Filter schemas
  const filteredSchemas = useMemo(() => {
    return schemas.filter((s) => {
      // Folder filter
      if (selectedFolderId === '__root__') {
        if (s.folder_id !== null) return false;
      } else if (selectedFolderId !== null) {
        if (s.folder_id !== selectedFolderId) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDoc = (s.documentation || '').toLowerCase().includes(q);
        const matchesVp = (s.viewpoint || '').toLowerCase().includes(q);
        const matchesLock = (s.locked_by_username || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDoc && !matchesVp && !matchesLock) return false;
      }

      return true;
    });
  }, [schemas, selectedFolderId, statusFilter, searchQuery]);

  // Selected folder breadcrumb label
  const selectedFolderObj = folders.find((f) => f.id === selectedFolderId);

  // Render Recursive Folder Item
  const renderFolderItem = (folder: SchemaFolder, depth: number = 0) => {
    const subfolders = folderTree.get(folder.id) || [];
    const isExpanded = expandedFolders[folder.id];
    const isSelected = selectedFolderId === folder.id;
    const isDragOver = dragOverFolderId === folder.id;
    const count = schemas.filter((s) => s.folder_id === folder.id).length;

    return (
      <div key={folder.id} className="select-none">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => handleDropOnFolder(e, folder.id)}
          onClick={() => setSelectedFolderId(folder.id)}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`py-1.5 pr-2 rounded-xl flex items-center justify-between text-xs font-medium transition group cursor-pointer ${
            isSelected
              ? 'bg-indigo-50 text-indigo-700 font-bold'
              : isDragOver
              ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center space-x-1.5 truncate flex-1">
            {subfolders.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderExpand(folder.id);
                }}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-400"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-4 h-4 shrink-0 text-amber-500" />
            ) : (
              <Folder className="w-4 h-4 shrink-0 text-amber-500" />
            )}

            {editingFolderId === folder.id ? (
              <input
                type="text"
                autoFocus
                value={editingFolderName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameFolder(folder.id);
                  if (e.key === 'Escape') setEditingFolderId(null);
                }}
                onBlur={() => handleRenameFolder(folder.id)}
                className="px-1.5 py-0.5 text-xs bg-white border border-indigo-400 rounded outline-none"
              />
            ) : (
              <span className="truncate">{folder.name}</span>
            )}
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            {count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-600 font-semibold">
                {count}
              </span>
            )}

            {/* Folder context actions */}
            <div className="hidden group-hover:flex items-center space-x-0.5">
              <button
                type="button"
                title="Nuova sottocartella"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewSubfolderParentId(folder.id);
                  setExpandedFolders((prev) => ({ ...prev, [folder.id]: true }));
                }}
                className="p-1 hover:bg-slate-200 text-slate-500 rounded"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <button
                type="button"
                title="Rinomina"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFolderId(folder.id);
                  setEditingFolderName(folder.name);
                }}
                className="p-1 hover:bg-slate-200 text-slate-500 rounded"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                title="Elimina cartella"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(folder.id);
                }}
                className="p-1 hover:bg-rose-100 text-rose-500 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Inline input for new subfolder */}
        {newSubfolderParentId === folder.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }} className="py-1 pr-2 flex items-center space-x-1">
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Nome sottocartella..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder(folder.id);
                if (e.key === 'Escape') setNewSubfolderParentId(undefined);
              }}
              className="px-2 py-0.5 text-xs bg-white border border-indigo-400 rounded outline-none flex-1"
            />
            <button
              onClick={() => handleCreateFolder(folder.id)}
              className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded"
            >
              Crea
            </button>
          </div>
        )}

        {/* Subfolders list */}
        {isExpanded && subfolders.map((sub) => renderFolderItem(sub, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-50 relative overflow-hidden">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`absolute top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center space-x-2 animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* LEFT COLUMN: Folder Explorer Tree */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Folder className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Cartelle Schemi</h3>
          </div>
          <button
            type="button"
            onClick={() => setNewSubfolderParentId(null)}
            title="Nuova cartella principale"
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 overflow-y-auto flex-1 space-y-1">
          {/* Quick Root items */}
          <div
            onClick={() => setSelectedFolderId(null)}
            className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs font-medium cursor-pointer transition ${
              selectedFolderId === null
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center space-x-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              <span>Tutti gli Schemi</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-600 font-semibold">
              {schemas.length}
            </span>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverFolderId('__root__');
            }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleDropOnFolder(e, null)}
            onClick={() => setSelectedFolderId('__root__')}
            className={`px-3 py-2 rounded-xl flex items-center justify-between text-xs font-medium cursor-pointer transition ${
              selectedFolderId === '__root__'
                ? 'bg-indigo-50 text-indigo-700 font-bold'
                : dragOverFolderId === '__root__'
                ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>Cartella Principale (Root)</span>
            </div>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-600 font-semibold">
              {schemas.filter((s) => s.folder_id === null).length}
            </span>
          </div>

          {/* New Root Folder Input */}
          {newSubfolderParentId === null && (
            <div className="p-2 bg-indigo-50/50 rounded-xl border border-indigo-200 flex items-center space-x-1.5">
              <FolderPlus className="w-4 h-4 text-indigo-600 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Nome cartella..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder(null);
                  if (e.key === 'Escape') setNewSubfolderParentId(undefined);
                }}
                className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg outline-none flex-1"
              />
              <button
                onClick={() => handleCreateFolder(null)}
                className="px-2 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg"
              >
                Crea
              </button>
            </div>
          )}

          <div className="h-[1px] bg-slate-200 my-2" />

          {/* Root-level folders list */}
          {(folderTree.get('__root__') || []).map((rootFolder) => renderFolderItem(rootFolder, 0))}
        </div>

        {/* Bottom hint */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center space-x-1.5">
          <Move className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Trascina gli schemi sulle cartelle per spostarli</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Schemas List & Actions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span>Schema Repository</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="font-semibold text-slate-700">
                {selectedFolderId === null
                  ? 'Tutti gli Schemi'
                  : selectedFolderId === '__root__'
                  ? 'Cartella Principale (Root)'
                  : selectedFolderObj?.name || 'Cartella'}
              </span>
            </div>
            <h1 className="text-lg font-black text-slate-800 mt-0.5">
              {selectedFolderId === null
                ? 'Tutti gli Schemi ArchiMate'
                : selectedFolderId === '__root__'
                ? 'Schemi nella Root'
                : selectedFolderObj?.name}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cerca schemi, autori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/60 focus:bg-white border border-transparent focus:border-indigo-500 rounded-xl outline-none w-56 transition"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/60 border border-slate-200 rounded-xl outline-none text-slate-700 font-semibold"
            >
              <option value="all">Tutti gli stati</option>
              <option value="available">🟢 Disponibili</option>
              <option value="checked_out">🔒 In Check-out</option>
            </select>

            {/* Archi Plugin Button */}
            <button
              type="button"
              onClick={() => setIsPluginModalOpen(true)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-slate-300"
              title="Scarica e configura il plugin per Architool (jArchi)"
            >
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Plugin Archi</span>
            </button>

            {/* Draw.io Palette Button */}
            <button
              type="button"
              onClick={() => setIsDrawioPaletteOpen(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-amber-200"
              title="Scarica la Palette ArchiMate 3.x per Draw.io Desktop"
            >
              <Palette className="w-4 h-4 text-amber-200" />
              <span>Palette Draw.io</span>
            </button>

            {/* New Schema Button */}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-indigo-200"
            >
              <Plus className="w-4 h-4" />
              <span>Nuovo Schema</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs font-semibold">Caricamento schemi...</p>
            </div>
          ) : filteredSchemas.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-white">
              <FileCode className="w-12 h-12 stroke-[1.5] text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">Nessuno schema trovato</p>
              <p className="text-xs text-slate-400 mt-1">
                Crea un nuovo schema o trascina un file .archimate per iniziare.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold rounded-xl transition"
              >
                + Crea Primo Schema
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSchemas.map((schema) => {
                const isLocked = schema.status === 'checked_out';
                const isLockedByMe = isLocked && schema.locked_by_user_id === user?.id;

                return (
                  <div
                    key={schema.id}
                    draggable
                    onDragStart={(e) => handleDragStartSchema(e, schema.id)}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between space-y-4 cursor-grab active:cursor-grabbing group relative"
                  >
                    {/* Top Row: Icon, Name, Version */}
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                              isLocked
                                ? 'bg-amber-50 border-amber-200 text-amber-600'
                                : 'bg-indigo-50 border-indigo-200 text-indigo-600'
                            }`}
                          >
                            <FileCode className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug">
                              {schema.name}
                            </h3>
                            <div className="flex items-center space-x-2 mt-0.5">
                              <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {schema.current_version}
                              </span>
                              <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                                schema.format === 'drawio'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {schema.format === 'drawio' ? '🎨 Draw.io' : '🏛️ Archi'}
                              </span>
                              {schema.viewpoint && (
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {schema.viewpoint}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isLocked ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Lock className="w-3 h-3" />
                              <span>In Check-out</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <Unlock className="w-3 h-3" />
                              <span>Disponibile</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lock details */}
                      {isLocked && (
                        <div className="mt-2.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 flex items-center justify-between">
                          <span>
                            Bloccato da <span className="font-bold">{schema.locked_by_username || 'Architetto'}</span>
                          </span>
                          {schema.locked_at && (
                            <span className="text-[10px] text-amber-700 opacity-80">
                              {new Date(schema.locked_at).toLocaleDateString('it-IT', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Documentation */}
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {schema.documentation || 'Nessuna documentazione inserita per questo schema.'}
                      </p>
                    </div>

                    {/* Nodes and Connection stats */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div>
                        {schema.nodes_count || 0} nodi • {schema.connections_count || 0} connessioni
                      </div>
                      <button
                        type="button"
                        onClick={() => setHistorySchema(schema)}
                        title="Vedi storico versioni"
                        className="flex items-center space-x-1 text-slate-500 hover:text-purple-600 transition"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Storico</span>
                      </button>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      {/* Left: Preview & Download */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewSchema(schema)}
                          title="Anteprima diagramma nel browser"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Anteprima</span>
                        </button>

                        <a
                          href={api.downloadSchemaXmlUrl(schema.id)}
                          download={`${schema.name}.${schema.format === 'drawio' ? 'drawio' : 'archimate'}`}
                          title={`Scarica copia .${schema.format === 'drawio' ? 'drawio' : 'archimate'}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>

                      {/* Right: Checkout / Checkin / Unlock */}
                      <div className="flex items-center space-x-1.5">
                        {!isLocked ? (
                          <button
                            type="button"
                            onClick={() => handleCheckout(schema)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-1 shadow-sm shadow-indigo-200"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Check-out</span>
                          </button>
                        ) : isLockedByMe ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setCheckinSchema(schema)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center space-x-1 shadow-sm shadow-emerald-200"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Check-in</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscardCheckout(schema)}
                              title="Annulla check-out"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          </>
                        ) : isAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleForcedUnlock(schema)}
                            title="Sblocco forzato amministratore"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center space-x-1"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Sblocco Forzato</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold px-2 py-1 bg-slate-100 rounded-lg">
                            In sola lettura
                          </span>
                        )}

                        {/* Delete Schema */}
                        <button
                          type="button"
                          onClick={() => handleDeleteSchema(schema)}
                          title="Elimina schema"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {isCreateOpen && (
        <CreateSchemaModal
          modelId={modelId}
          folders={folders}
          currentFolderId={selectedFolderId}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={(newSchema) => {
            setSchemas((prev) => [newSchema, ...prev]);
            setIsCreateOpen(false);
            showToast(`Schema "${newSchema.name}" creato.`);
          }}
        />
      )}

      {previewSchema && (
        <SchemaPreviewModal
          schema={previewSchema}
          elements={elements}
          onClose={() => setPreviewSchema(null)}
        />
      )}

      {checkinSchema && (
        <CheckinDiffModal
          schema={checkinSchema}
          onClose={() => setCheckinSchema(null)}
          onSuccess={(updatedSchema) => {
            setSchemas((prev) => prev.map((s) => (s.id === updatedSchema.id ? updatedSchema : s)));
            setCheckinSchema(null);
            showToast(`Check-in completato con successo (${updatedSchema.current_version}).`);
          }}
        />
      )}

      {historySchema && (
        <SchemaVersionHistoryModal
          schema={historySchema}
          onClose={() => setHistorySchema(null)}
          onRollbackSuccess={(updatedSchema) => {
            setSchemas((prev) => prev.map((s) => (s.id === updatedSchema.id ? updatedSchema : s)));
            setHistorySchema(null);
            showToast(`Ripristino completato con successo (${updatedSchema.current_version}).`);
          }}
        />
      )}
      {isPluginModalOpen && (
        <ArchiPluginModal
          isOpen={isPluginModalOpen}
          onClose={() => setIsPluginModalOpen(false)}
        />
      )}
      {isDrawioPaletteOpen && (
        <DrawioPaletteModal
          isOpen={isDrawioPaletteOpen}
          onClose={() => setIsDrawioPaletteOpen(false)}
        />
      )}
    </div>
  );
};
