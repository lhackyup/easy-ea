import React, { useState, useEffect, useMemo } from 'react';
import { SchemaFolder, ArchiSchema, ArchimateElementItem, ModelWorkspace, SchemaDiffResult } from '../../types';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { SchemaPreviewModal } from './SchemaPreviewModal';
import { CheckinDiffModal } from './CheckinDiffModal';
import { SchemaVersionHistoryModal } from './SchemaVersionHistoryModal';
import { CreateSchemaModal } from './CreateSchemaModal';
import { SchemaAsCodeModal } from './SchemaAsCodeModal';
import { ArchiPluginModal } from './ArchiPluginModal';
import { DrawioPaletteModal } from './DrawioPaletteModal';
import { CamundaPluginModal } from './CamundaPluginModal';
import {
  openDrawioWeb,
  DrawioWebSession,
  setCacheInvalidationCookies,
  getDrawioMode,
  setDrawioMode,
  getDrawioBaseUrl,
  checkDrawioLocalHealth,
  DrawioServerMode,
  DEFAULT_LOCAL_DRAWIO_URL,
  DEFAULT_CLOUD_DRAWIO_URL
} from '../../lib/drawio/drawioWebManager';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  FileCode,
  FileCode2,
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
  Palette,
  Workflow,
  ExternalLink,
  Globe,
  Monitor,
  Settings,
  X
} from 'lucide-react';

interface SchemaRepositoryProps {
  modelId: string;
}

export const SchemaRepository: React.FC<SchemaRepositoryProps> = ({ modelId }) => {
  const { user, token } = useAuth();
  const { t, interpolate } = useLanguage();

  const [folders, setFolders] = useState<SchemaFolder[]>([]);
  const [schemas, setSchemas] = useState<ArchiSchema[]>([]);
  const [elements, setElements] = useState<ArchimateElementItem[]>([]);
  const [modelWorkspace, setModelWorkspace] = useState<ModelWorkspace | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'checked_out'>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPluginModalOpen, setIsPluginModalOpen] = useState(false);
  const [isDrawioPaletteOpen, setIsDrawioPaletteOpen] = useState(false);
  const [isCamundaModalOpen, setIsCamundaModalOpen] = useState(false);
  const [previewSchema, setPreviewSchema] = useState<ArchiSchema | null>(null);
  const [checkinSchema, setCheckinSchema] = useState<ArchiSchema | null>(null);
  const [checkinDiffData, setCheckinDiffData] = useState<{
    file?: File | null;
    diff?: SchemaDiffResult | null;
  } | null>(null);
  const [activeDrawioSession, setActiveDrawioSession] = useState<{
    schemaId: string;
    schemaName: string;
    session: DrawioWebSession;
  } | null>(null);
  const [historySchema, setHistorySchema] = useState<ArchiSchema | null>(null);
  const [sacModalSchema, setSacModalSchema] = useState<ArchiSchema | null>(null);
  const [isNewSacOpen, setIsNewSacOpen] = useState(false);
  const [drawioServerMode, setDrawioServerMode] = useState<DrawioServerMode>(getDrawioMode());
  const [isDrawioConfigModalOpen, setIsDrawioConfigModalOpen] = useState(false);
  const [isLocalDrawioHealthy, setIsLocalDrawioHealthy] = useState<boolean | null>(null);
  const [customDrawioUrl, setCustomDrawioUrl] = useState<string>(
    localStorage.getItem('easyea_drawio_custom_url') || ''
  );

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

  const isViewer = useMemo(() => {
    if (!user) return false;
    return user.assignments.some((a) => a.role === 'viewer') && !isAdmin;
  }, [user, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fList, sList, eList, mDetail] = await Promise.all([
        api.getSchemaFolders(modelId),
        api.getSchemas(modelId),
        api.getElements(modelId).catch(() => []),
        api.getModelDetail(modelId).catch(() => null)
      ]);
      setFolders(fList);
      setSchemas(sList);
      setElements(eList);
      if (mDetail) {
        setModelWorkspace(mDetail);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Errore nel caricamento dei dati del repository', 'error');
    } finally {
      setLoading(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const refreshSchemas = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const sList = await api.getSchemas(modelId);
      setSchemas(sList);
      if (!silent) {
        showToast(t.schemas.schemasRefreshed || 'Stato schemi aggiornato con successo.');
      }
    } catch (err: any) {
      if (!silent) {
        showToast(err.message || 'Errore durante l\'aggiornamento degli schemi', 'error');
      }
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    api.getDrawioConfig().then((cfg) => {
      const mode = getDrawioMode();
      const targetUrl = mode === 'custom' && customDrawioUrl ? customDrawioUrl : (cfg.local_url || DEFAULT_LOCAL_DRAWIO_URL);
      checkDrawioLocalHealth(targetUrl).then((healthy) => setIsLocalDrawioHealthy(healthy));
    }).catch(() => {
      checkDrawioLocalHealth().then((healthy) => setIsLocalDrawioHealthy(healthy));
    });
  }, [modelId]);

  // Auto-refresh schema states when returning to the browser tab or window (e.g. after Archi / Draw.io check-in)
  useEffect(() => {
    const handleFocus = () => {
      refreshSchemas(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshSchemas(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
    if (!window.confirm(t.schemas.confirmDeleteFolder)) {
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
  const handleCheckout = async (schema: ArchiSchema, launchApp: boolean = true) => {
    try {
      const res = await api.checkoutSchema(schema.id);
      setSchemas((prev) => prev.map((s) => (s.id === schema.id ? res.schema : s)));

      const activeToken = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token') || '';
      const toolType = schema.format === 'drawio' ? 'drawio' : (schema.format === 'bpmn' ? 'camunda' : 'archi');

      if (launchApp) {
        // Construct easyea:// protocol URI
        const serverOrigin = window.location.origin;
        const easyeaUri = `easyea://open?tool=${encodeURIComponent(toolType)}&schema_id=${encodeURIComponent(schema.id)}&model_id=${encodeURIComponent(schema.model_id)}&token=${encodeURIComponent(activeToken)}&server=${encodeURIComponent(serverOrigin)}`;

        // Trigger protocol handler to launch desktop application
        window.location.href = easyeaUri;

        const appLabel = toolType === 'drawio' ? 'Draw.io' : (toolType === 'camunda' ? 'Camunda Modeler' : 'Archi');
        showToast(`Check-out effettuato! Apertura diretta in ${appLabel} avviata.`);
      } else {
        // Trigger automatic manual file download fallback
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
      }
    } catch (err: any) {
      showToast(err.message || 'Errore durante il check-out.', 'error');
    }
  };

  const handleLaunchAppOnly = (schema: ArchiSchema) => {
    const activeToken = sessionStorage.getItem('easyea_auth_token') || localStorage.getItem('easyea_auth_token') || '';
    const toolType = schema.format === 'drawio' ? 'drawio' : (schema.format === 'bpmn' ? 'camunda' : 'archi');
    const serverOrigin = window.location.origin;
    const easyeaUri = `easyea://open?tool=${encodeURIComponent(toolType)}&schema_id=${encodeURIComponent(schema.id)}&model_id=${encodeURIComponent(schema.model_id)}&token=${encodeURIComponent(activeToken)}&server=${encodeURIComponent(serverOrigin)}`;
    window.location.href = easyeaUri;
    const appLabel = toolType === 'drawio' ? 'Draw.io' : (toolType === 'camunda' ? 'Camunda Modeler' : 'Archi');
    showToast(`Riapertura di ${schema.name} in ${appLabel}...`);
  };

  const handleOpenDrawioWeb = async (schema: ArchiSchema, isEdit: boolean = true) => {
    try {
      const activeMode = getDrawioMode();
      const serverUrl = getDrawioBaseUrl();

      if (activeMode === 'local') {
        const isHealthy = await checkDrawioLocalHealth(serverUrl);
        setIsLocalDrawioHealthy(isHealthy);
        if (!isHealthy) {
          showToast(`Server Draw.io Web locale (${serverUrl}) non in ascolto. Avvia il container Docker o passa alla modalità Cloud.`, 'error');
          setIsDrawioConfigModalOpen(true);
          return;
        }
      }

      let xmlContent = '';
      let targetSchema = schema;

      if (isEdit) {
        if (isViewer) {
          showToast(t.rbac.demoCheckoutForbidden || 'Il Check-out per modifica esterna non è disponibile in modalità Demo (Sola Lettura)', 'error');
          return;
        }

        if (schema.status !== 'checked_out') {
          showToast('Esecuzione del check-out sul server EasyEA...');
          const res = await api.checkoutSchema(schema.id);
          targetSchema = res.schema;
          setSchemas((prev) => prev.map((s) => (s.id === targetSchema.id ? targetSchema : s)));
          xmlContent = res.xml_content;
        } else if (schema.locked_by_user_id === user?.id || isAdmin) {
          showToast('Recupero dello schema aggiornato dal repository...');
          xmlContent = await api.getSchemaXml(schema.id);
        } else {
          showToast(`Lo schema è bloccato da ${schema.locked_by_username || 'un altro utente'}. Apertura in sola lettura.`, 'error');
          xmlContent = await api.getSchemaXml(schema.id);
          isEdit = false;
        }
      } else {
        xmlContent = await api.getSchemaXml(schema.id);
      }

      setCacheInvalidationCookies(targetSchema.id, targetSchema.current_version);

      const session = openDrawioWeb({
        schemaId: targetSchema.id,
        schemaName: targetSchema.name,
        modelId: targetSchema.model_id,
        version: targetSchema.current_version,
        initialXml: xmlContent,
        readonly: !isEdit,
        serverUrl: serverUrl,
        authToken: token || sessionStorage.getItem('easyea_auth_token') || undefined,
        username: user?.username,
        fullName: user?.full_name,
        catalogElements: elements.map((e) => ({
          id: e.id,
          name: e.name,
          type: e.type,
          layer: e.layer,
          documentation: e.documentation
        })),
        onSave: async (savedXml: string) => {
          try {
            const file = new File([savedXml], `${targetSchema.name}.drawio`, { type: 'application/xml' });
            const diff = await api.checkinDiff(targetSchema.id, file);
            setCheckinSchema(targetSchema);
            setCheckinDiffData({ file, diff });
            showToast('Modifiche salvate da Draw.io Web! Rivedi il Diff e conferma il Check-in.', 'success');
          } catch (err: any) {
            showToast(`Errore salvataggio Draw.io: ${err.message}`, 'error');
            throw err;
          }
        },
        onStatusChange: (status) => {
          if (status === 'ready') {
            const modeLabel = activeMode === 'local' ? 'Locale Docker' : 'Cloud';
            showToast(`Diagramma '${targetSchema.name}' aperto in Draw.io Web (${modeLabel}) in nuova finestra.`, 'success');
          } else if (status === 'closed') {
            setActiveDrawioSession((curr) => (curr?.schemaId === targetSchema.id ? null : curr));
          }
        }
      });

      if (!session) {
        showToast('Impossibile aprire Draw.io Web: verifica che il browser non blocchi le finestre popup.', 'error');
      } else {
        setActiveDrawioSession({ schemaId: targetSchema.id, schemaName: targetSchema.name, session });
      }
    } catch (err: any) {
      showToast(err.message || 'Errore durante l’apertura di Draw.io Web.', 'error');
    }
  };

  const handleDiscardCheckout = async (schema: ArchiSchema) => {
    if (!window.confirm(t.schemas.confirmCancelCheckout)) return;
    try {
      const res = await api.discardCheckout(schema.id);
      setSchemas((prev) => prev.map((s) => (s.id === schema.id ? res.schema : s)));
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'Errore durante l’annullamento del check-out.', 'error');
    }
  };

  const handleForcedUnlock = async (schema: ArchiSchema) => {
    if (!window.confirm(interpolate(t.schemas.confirmForceUnlock, { user: schema.locked_by_username || '' }))) return;
    try {
      const res = await api.forcedUnlock(schema.id);
      setSchemas((prev) => prev.map((s) => (s.id === schema.id ? res.schema : s)));
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'Errore durante lo sblocco forzato.', 'error');
    }
  };

  const handleDeleteSchema = async (schema: ArchiSchema) => {
    if (!window.confirm(interpolate(t.schemas.confirmDeleteSchema, { name: schema.name }))) return;
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
            {!isViewer && (
              <div className="hidden group-hover:flex items-center space-x-0.5">
                <button
                  type="button"
                  title={t.schemas.newSubfolderTooltip}
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
                  title={t.common.edit}
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
                  title={t.schemas.deleteFolderTooltip}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  className="p-1 hover:bg-rose-100 text-rose-500 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
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
            <h3 className="text-sm font-bold text-slate-800">{t.schemas.foldersTitle || 'Cartelle Schemi'}</h3>
          </div>
          {!isViewer && (
            <button
              type="button"
              onClick={() => setNewSubfolderParentId(null)}
              title={t.schemas.newRootFolderTooltip}
              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          )}
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
              <span>{t.schemas.allSchemas}</span>
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
                placeholder={t.schemas.folderNamePlaceholder || 'Nome cartella...'}
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
                className="px-2 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg cursor-pointer"
              >
                {t.schemas.createBtn || 'Crea'}
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
          <span>{t.schemas.dragSchemasHint}</span>
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
                  ? t.schemas.allSchemas
                  : selectedFolderId === '__root__'
                  ? 'Cartella Principale (Root)'
                  : selectedFolderObj?.name || 'Cartella'}
              </span>
            </div>
            <h1 className="text-lg font-black text-slate-800 mt-0.5">
              {selectedFolderId === null
                ? t.schemas.allSchemas
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
                placeholder={t.schemas.searchSchemasPlaceholder}
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
              <option value="all">{t.schemas.allStatuses}</option>
              <option value="available">🟢 Disponibili</option>
              <option value="checked_out">🔒 In Check-out</option>
            </select>

            {/* Refresh Schemas Button */}
            <button
              type="button"
              onClick={() => refreshSchemas(false)}
              disabled={refreshing}
              className={`px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
                refreshing ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              title={t.schemas.refreshSchemasTooltip}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">{t.schemas.refreshSchemasBtn}</span>
            </button>

            {/* Draw.io Web Server Mode Selector */}
            <button
              type="button"
              onClick={() => setIsDrawioConfigModalOpen(true)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              title="Configura l'istanza di Draw.io Web (Locale Docker http://localhost:8080 vs Cloud)"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline text-slate-500">Draw.io Web:</span>
              <span className="font-bold text-slate-800">
                {drawioServerMode === 'local' ? 'Locale (Docker)' : (drawioServerMode === 'cloud' ? 'Cloud' : 'Custom')}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  drawioServerMode === 'local'
                    ? (isLocalDrawioHealthy ? 'bg-emerald-500 shadow-sm shadow-emerald-400' : 'bg-rose-500 animate-pulse')
                    : 'bg-indigo-500'
                }`}
                title={
                  drawioServerMode === 'local'
                    ? (isLocalDrawioHealthy ? 'Container locale attivo' : 'Container locale non raggiungibile')
                    : 'Modalità Cloud'
                }
              />
            </button>

            {/* Tool-specific Plugin Button: Archi vs Draw.io */}
            {modelWorkspace?.modeling_tool === 'drawio' ? (
              <button
                type="button"
                onClick={() => setIsDrawioPaletteOpen(true)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-amber-200 cursor-pointer"
                title={t.schemas.downloadDrawioPaletteTooltip}
              >
                <Palette className="w-4 h-4 text-amber-200" />
                <span>Palette Draw.io</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsPluginModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-slate-300 cursor-pointer"
                title={t.schemas.downloadJArchiTooltip}
              >
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>Plugin Archi</span>
              </button>
            )}

            {/* Camunda Modeler BPMN 2.0 Plugin Button */}
            <button
              type="button"
              onClick={() => setIsCamundaModalOpen(true)}
              className="px-3.5 py-1.5 bg-orange-700 hover:bg-orange-800 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-orange-200 cursor-pointer"
              title={t.schemas.downloadCamundaTooltip}
            >
              <Workflow className="w-4 h-4 text-orange-200" />
              <span>Plugin Camunda</span>
            </button>

            {/* Schema as Code & New Schema Buttons */}
            {!isViewer ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsNewSacOpen(true)}
                  title={t.schemas.schemaAsCodeTooltip || 'Crea uno schema scrivendo codice con Schema-as-Code (.eac)'}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-indigo-300 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer"
                >
                  <FileCode2 className="w-4 h-4 text-indigo-400" />
                  <span>{t.schemas.schemaAsCodeBtn || 'Schema as Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm shadow-indigo-200 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.schemas.newSchemaBtn}</span>
                </button>
              </>
            ) : (
              <span className="px-3.5 py-1.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded-xl text-xs font-bold flex items-center space-x-1 shadow-2xs">
                <span>👁️</span>
                <span>{t.rbac.demoModeBadge || 'Modalità Demo (Sola Lettura)'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Active Draw.io Web Session Notification Banner */}
          {activeDrawioSession && (
            <div className="mb-4 px-4 py-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center animate-pulse shadow-sm">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-indigo-900">
                      {t.schemas.drawioWebActiveSession || 'Sessione Draw.io Web attiva per'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {activeDrawioSession.schemaName}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Sincronizzazione Live & Anti-Cache
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {t.schemas.drawioWebActiveSessionHint || 'Le modifiche salvate in Draw.io Web (Ctrl+S / Salva) vengono ricevute e validate automaticamente.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const sc = schemas.find((s) => s.id === activeDrawioSession.schemaId);
                    if (sc) setCheckinSchema(sc);
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center space-x-1 shadow-sm cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Rivedi e Check-in</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    activeDrawioSession.session.close();
                    setActiveDrawioSession(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Chiudi sessione Draw.io Web"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs font-semibold">{t.schemas.loadingSchemas || 'Caricamento schemi...'}</p>
            </div>
          ) : filteredSchemas.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 bg-white">
              <FileCode className="w-12 h-12 stroke-[1.5] text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">{t.schemas.noSchemasFound || 'Nessuno schema trovato'}</p>
              <p className="text-xs text-slate-400 mt-1">
                {t.schemas.noSchemasHint || 'Crea un nuovo schema o trascina un file .archimate per iniziare.'}
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold rounded-xl transition"
              >
                {t.schemas.createFirstSchemaBtn || '+ Crea Primo Schema'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredSchemas.map((schema) => {
                const isLocked = schema.status === 'checked_out';
                const isLockedByMe = isLocked && schema.locked_by_user_id === user?.id;

                return (
                  <div
                    key={schema.id}
                    draggable
                    onDragStart={(e) => handleDragStartSchema(e, schema.id)}
                    className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-grab active:cursor-grabbing group relative"
                  >
                    {/* Left Section: Icon, Name, Badges, Lock details and Description */}
                    <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          isLocked
                            ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-600'
                        }`}
                      >
                        <FileCode className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Title and Badges Row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition truncate max-w-md">
                            {schema.name}
                          </h3>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            {schema.current_version}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                            schema.format === 'drawio'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {schema.format === 'drawio' ? '🎨 Draw.io' : '🏛️ Archi'}
                          </span>
                          {schema.viewpoint && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shrink-0">
                              {schema.viewpoint}
                            </span>
                          )}
                          {/* Status Badge */}
                          {isLocked ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              <Lock className="w-3 h-3" />
                              <span>{t.schemas.checkedOutBadge || 'In Check-out'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                              <Unlock className="w-3 h-3" />
                              <span>{t.common.active || 'Disponibile'}</span>
                            </span>
                          )}
                        </div>

                        {/* Lock details */}
                        {isLocked && (
                          <div className="mt-1.5 p-1.5 px-2.5 bg-amber-50/80 rounded-lg border border-amber-200/60 text-[11px] text-amber-900 inline-flex items-center space-x-2">
                            <span>
                              {interpolate(t.schemas.lockedBy || 'Bloccato da {user}', { user: schema.locked_by_username || 'Architetto' })}
                            </span>
                            {schema.locked_at && (
                              <span className="text-[10px] text-amber-700 opacity-80">
                                • {new Date(schema.locked_at).toLocaleDateString(undefined, {
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
                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 leading-relaxed">
                          {schema.documentation || t.schemas.noDocumentation || 'Nessuna documentazione inserita per questo schema.'}
                        </p>

                        {/* Stats and History */}
                        <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1.5">
                          <span>{interpolate(t.schemas.nodesConnectionsCount || '{nodes} nodi • {connections} connessioni', { nodes: schema.nodes_count || 0, connections: schema.connections_count || 0 })}</span>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setHistorySchema(schema)}
                            title={t.schemas.viewHistoryTooltip || 'Vedi storico versioni'}
                            className="flex items-center space-x-1 text-slate-500 hover:text-purple-600 transition cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>{interpolate(t.schemas.historyBtn || 'Storico ({version})', { version: schema.current_version })}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100 justify-end">
                      {/* Left Actions: Preview, SAC, Download */}
                      <button
                        type="button"
                        onClick={() => setPreviewSchema(schema)}
                        title="Anteprima diagramma nel browser"
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Anteprima</span>
                      </button>

                      {schema.format === 'drawio' && (
                        <button
                          type="button"
                          onClick={() => handleOpenDrawioWeb(schema, false)}
                          title={t.schemas.viewInDrawioWeb || 'Visualizza in Draw.io Web (sola lettura)'}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
                        >
                          <Globe className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSacModalSchema(schema)}
                        title="Visualizza e modifica sorgente Schema-as-Code (.eac)"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
                      >
                        <FileCode2 className="w-4 h-4" />
                      </button>

                      <a
                        href={api.downloadSchemaXmlUrl(schema.id)}
                        download={`${schema.name}.${schema.format === 'drawio' ? 'drawio' : 'archimate'}`}
                        title={interpolate(t.schemas.downloadCopyTooltip || 'Scarica copia .{format}', { format: schema.format === 'drawio' ? 'drawio' : 'archimate' })}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      {/* Primary Actions: Checkout / Open / Check-in / Unlock */}
                      {!isLocked ? (
                        !isViewer ? (
                          schema.format === 'drawio' ? (
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenDrawioWeb(schema, true)}
                                title={t.schemas.editWithDrawioWebTooltip || 'Effettua il check-out e apri in Draw.io Web in una nuova scheda (con invalidazione cache)'}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-1.5 shadow-sm shadow-indigo-200 cursor-pointer"
                              >
                                <Lock className="w-3.5 h-3.5" />
                                <span>{t.schemas.editWithDrawioWeb || 'Draw.io Web'}</span>
                                <ExternalLink className="w-3 h-3 opacity-80" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCheckout(schema, true)}
                                title="Check-out e scarica per Draw.io Desktop"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
                              >
                                <Monitor className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCheckout(schema, true)}
                              title={`Effettua il check-out e apri direttamente in ${schema.format === 'bpmn' ? 'Camunda' : 'Archi'}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition flex items-center space-x-1.5 shadow-sm shadow-indigo-200 cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>{t.schemas.checkoutBtn || 'Check-out'}</span>
                              <ExternalLink className="w-3 h-3 opacity-80" />
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={t.rbac.demoCheckoutForbidden || 'Il Check-out per modifica esterna non è disponibile in modalità Demo (Sola Lettura)'}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 bg-slate-100 border border-slate-200 transition flex items-center space-x-1.5 cursor-not-allowed select-none opacity-80"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t.schemas.checkoutBtn || 'Check-out'}</span>
                          </button>
                        )
                      ) : isLockedByMe ? (
                        schema.format === 'drawio' ? (
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenDrawioWeb(schema, true)}
                              title={t.schemas.reopenDrawioWebTooltip || 'Riapri in Draw.io Web (invalida cache e carica l’ultima versione)'}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition flex items-center space-x-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>{t.schemas.reopenDrawioWeb || 'Draw.io Web'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLaunchAppOnly(schema)}
                              title="Riapri file con Draw.io Desktop"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition cursor-pointer"
                            >
                              <Monitor className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCheckinSchema(schema)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center space-x-1 shadow-sm shadow-emerald-200 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Check-in</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscardCheckout(schema)}
                              title={t.schemas.cancelCheckoutTooltip || 'Annulla check-out'}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleLaunchAppOnly(schema)}
                              title={`Riapri direttamente in ${schema.format === 'bpmn' ? 'Camunda' : 'Archi'}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition flex items-center space-x-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Apri</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCheckinSchema(schema)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center space-x-1 shadow-sm shadow-emerald-200 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Check-in</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDiscardCheckout(schema)}
                              title={t.schemas.cancelCheckoutTooltip || 'Annulla check-out'}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          </>
                        )
                      ) : isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleForcedUnlock(schema)}
                          title="Sblocco forzato amministratore"
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center space-x-1 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Sblocco Forzato</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold px-2 py-1 bg-slate-100 rounded-lg">
                          {t.common.readOnly || 'In sola lettura'}
                        </span>
                      )}

                      {/* Delete Schema */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSchema(schema)}
                        title={t.schemas.deleteSchemaTooltip || 'Elimina schema'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          initialFile={checkinDiffData?.file}
          initialDiffResult={checkinDiffData?.diff}
          onClose={() => {
            setCheckinSchema(null);
            setCheckinDiffData(null);
          }}
          onSuccess={(updatedSchema) => {
            setSchemas((prev) => prev.map((s) => (s.id === updatedSchema.id ? updatedSchema : s)));
            setCheckinSchema(null);
            setCheckinDiffData(null);
            // Chiudi automaticamente la finestra di Draw.io Web se attiva per questo schema
            if (activeDrawioSession && activeDrawioSession.schemaId === updatedSchema.id) {
              activeDrawioSession.session.close();
              setActiveDrawioSession(null);
            }
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
      {(sacModalSchema || isNewSacOpen) && (
        <SchemaAsCodeModal
          schema={sacModalSchema}
          activeModelId={modelId}
          folderId={selectedFolderId && selectedFolderId !== '__root__' ? selectedFolderId : undefined}
          onClose={() => {
            setSacModalSchema(null);
            setIsNewSacOpen(false);
          }}
          onSaveSuccess={(updatedSchema) => {
            setSchemas((prev) => {
              const exists = prev.some((s) => s.id === updatedSchema.id);
              if (exists) {
                return prev.map((s) => (s.id === updatedSchema.id ? updatedSchema : s));
              } else {
                return [updatedSchema, ...prev];
              }
            });
            setSacModalSchema(null);
            setIsNewSacOpen(false);
            showToast(`Schema "${updatedSchema.name}" salvato da Schema-as-Code.`);
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
      {isCamundaModalOpen && (
        <CamundaPluginModal
          isOpen={isCamundaModalOpen}
          onClose={() => setIsCamundaModalOpen(false)}
        />
      )}

      {/* Draw.io Web Instance Configuration Modal */}
      {isDrawioConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Configurazione Draw.io Web</h3>
                  <p className="text-xs text-slate-500">
                    Scegli dove eseguire l'istanza Web di Draw.io (Locale vs Cloud)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawioConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Option 1: Local Docker Container */}
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border transition cursor-pointer ${
                  drawioServerMode === 'local'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="drawioMode"
                  value="local"
                  checked={drawioServerMode === 'local'}
                  onChange={() => {
                    setDrawioServerMode('local');
                    setDrawioMode('local');
                    checkDrawioLocalHealth().then(setIsLocalDrawioHealthy);
                  }}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      🟢 Istanza Web Locale (Docker)
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isLocalDrawioHealthy
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isLocalDrawioHealthy ? 'Online (Porta 8080)' : 'Non in ascolto'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    URL: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-mono font-semibold">http://localhost:8080</code>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Massima privacy, zero chiamate a server esterni, nessun cookie di terze parti e totale isolamento cache.
                  </p>
                  {!isLocalDrawioHealthy && (
                    <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 space-y-1">
                      <div className="font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Come avviare Draw.io Web locale:</span>
                      </div>
                      <div className="font-mono text-[10px] bg-white p-1 rounded border border-amber-200 select-all">
                        docker compose up -d drawio
                      </div>
                      <span className="text-[10px] text-slate-500">oppure: <code>docker run -d -p 8080:8080 jgraph/drawio</code></span>
                    </div>
                  )}
                </div>
              </label>

              {/* Option 2: Cloud diagrams.net */}
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border transition cursor-pointer ${
                  drawioServerMode === 'cloud'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="drawioMode"
                  value="cloud"
                  checked={drawioServerMode === 'cloud'}
                  onChange={() => {
                    setDrawioServerMode('cloud');
                    setDrawioMode('cloud');
                  }}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      ☁️ Cloud Ufficiale (embed.diagrams.net)
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      Fallback Internet
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    URL: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">https://embed.diagrams.net</code>
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Richiede connessione internet. Usa parametri anti-cache stealth mode.
                  </p>
                </div>
              </label>

              {/* Option 3: Custom URL */}
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border transition cursor-pointer ${
                  drawioServerMode === 'custom'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="drawioMode"
                  value="custom"
                  checked={drawioServerMode === 'custom'}
                  onChange={() => {
                    setDrawioServerMode('custom');
                    setDrawioMode('custom', customDrawioUrl);
                  }}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <span className="font-bold text-sm text-slate-900">
                    ⚙️ URL Personalizzato (Intranet / On-Premise)
                  </span>
                  <div className="mt-2">
                    <input
                      type="text"
                      value={customDrawioUrl}
                      onChange={(e) => {
                        setCustomDrawioUrl(e.target.value);
                        if (drawioServerMode === 'custom') {
                          setDrawioMode('custom', e.target.value);
                        }
                      }}
                      placeholder="es. http://drawio.mia-azienda.local:8080"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </label>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  checkDrawioLocalHealth().then((h) => {
                    setIsLocalDrawioHealthy(h);
                    showToast(h ? 'Container locale raggiungibile!' : 'Container locale non raggiungibile.', h ? 'success' : 'error');
                  });
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Verifica Connessione</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDrawioMode(drawioServerMode, customDrawioUrl);
                  setIsDrawioConfigModalOpen(false);
                  showToast(`Modalità Draw.io impostata: ${drawioServerMode === 'local' ? 'Locale (Docker)' : (drawioServerMode === 'cloud' ? 'Cloud' : 'Personalizzata')}`);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
              >
                Salva e Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
