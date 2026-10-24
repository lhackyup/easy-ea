import React, { useState, useEffect, useMemo } from 'react';
import {
  AttributePackage,
  AttributePackageItem,
  PackageUsageAudit,
  ModelWorkspace
} from '../../types';
import { api } from '../../lib/api';
import {
  Package,
  Plus,
  Trash2,
  AlertCircle,
  Search,
  Sliders,
  X,
  Check,
  Info,
  Layers,
  Sparkles,
  BarChart2,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Database,
  Building2,
  Lock,
  Tag
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface AttributePackagesManagerProps {
  models?: ModelWorkspace[];
  selectedScope: string; // 'global' or a specific model_id
  onPackageUpdated?: () => void;
}

const THEME_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-800' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800' },
};

const ARCHIMATE_TYPES = [
  'ApplicationComponent',
  'BusinessProcess',
  'BusinessService',
  'BusinessActor',
  'DataObject',
  'Node',
  'TechnologyService',
  'SystemSoftware',
  'Capability',
  'Resource',
  'Plateau',
  'Deliverable',
  'WorkPackage',
  '*'
];

const ARCHIMATE_LAYERS = ['All', 'Strategy', 'Business', 'Application', 'Technology', 'Motivation', 'Implementation'];

export const AttributePackagesManager: React.FC<AttributePackagesManagerProps> = ({
  models = [],
  selectedScope,
  onPackageUpdated
}) => {
  const { t, interpolate } = useLanguage();

  const [packages, setPackages] = useState<AttributePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({
    'pkg-apm': true,
    'pkg-tme': true
  });

  // Package Modal (Create / Edit)
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<AttributePackage | null>(null);
  const [pkgFormData, setPkgFormData] = useState({
    code: '',
    name: '',
    description: '',
    icon_color: 'blue',
    is_default_active: true
  });
  const [savingPkg, setSavingPkg] = useState(false);
  const [pkgModalError, setPkgModalError] = useState<string | null>(null);

  // Item Modal (Create / Edit)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [targetPkgId, setTargetPkgId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<AttributePackageItem | null>(null);
  const [itemFormData, setItemFormData] = useState({
    name: '',
    label: '',
    description: '',
    element_type: 'ApplicationComponent',
    layer: 'Application',
    data_type: 'string',
    optionsString: '',
    default_value: '',
    is_required: false,
    section: 'General',
    sort_order: 1
  });
  const [savingItem, setSavingItem] = useState(false);
  const [itemModalError, setItemModalError] = useState<string | null>(null);

  // Usage Audit Modal
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditData, setAuditData] = useState<PackageUsageAudit | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Strict Deactivation Blocked Modal
  const [deactivationBlockModal, setDeactivationBlockModal] = useState<{
    isOpen: boolean;
    packageName: string;
    detail: any;
  }>({
    isOpen: false,
    packageName: '',
    detail: null
  });

  // Load packages
  const fetchPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAttributePackages(selectedScope);
      setPackages(data);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento dei pacchetti');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [selectedScope]);

  const toggleExpand = (pkgId: string) => {
    setExpandedPackages((prev) => ({
      ...prev,
      [pkgId]: !prev[pkgId]
    }));
  };

  const currentLibrary = useMemo(() => {
    if (selectedScope === 'global') return null;
    return models.find((m) => m.id === selectedScope) || null;
  }, [models, selectedScope]);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [packages, search]);

  // Toggle package activation on current library
  const handleTogglePackage = async (pkg: AttributePackage) => {
    if (selectedScope === 'global') return;
    const newActiveState = !pkg.is_active;

    try {
      await api.toggleLibraryPackage(selectedScope, pkg.id, newActiveState);
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
    } catch (err: any) {
      if (err.data && err.data.error === 'package_deactivation_blocked') {
        setDeactivationBlockModal({
          isOpen: true,
          packageName: pkg.name,
          detail: err.data
        });
      } else {
        alert(err.message || 'Errore durante la modifica dello stato del pacchetto.');
      }
    }
  };

  // Open Create Package Modal
  const handleOpenCreatePkg = () => {
    setEditingPkg(null);
    setPkgFormData({
      code: '',
      name: '',
      description: '',
      icon_color: 'blue',
      is_default_active: true
    });
    setPkgModalError(null);
    setIsPkgModalOpen(true);
  };

  // Open Edit Package Modal
  const handleOpenEditPkg = (pkg: AttributePackage) => {
    setEditingPkg(pkg);
    setPkgFormData({
      code: pkg.code,
      name: pkg.name,
      description: pkg.description || '',
      icon_color: pkg.icon_color || 'blue',
      is_default_active: pkg.is_default_active ?? true
    });
    setPkgModalError(null);
    setIsPkgModalOpen(true);
  };

  // Save Package (Create / Update)
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setPkgModalError(null);
    setSavingPkg(true);

    try {
      if (editingPkg) {
        await api.updateAttributePackage(editingPkg.id, {
          name: pkgFormData.name,
          description: pkgFormData.description,
          icon_color: pkgFormData.icon_color,
          is_default_active: pkgFormData.is_default_active
        });
      } else {
        await api.createAttributePackage({
          code: pkgFormData.code.toLowerCase(),
          name: pkgFormData.name,
          description: pkgFormData.description,
          icon_color: pkgFormData.icon_color,
          is_default_active: pkgFormData.is_default_active
        });
      }
      setIsPkgModalOpen(false);
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
    } catch (err: any) {
      setPkgModalError(err.message || 'Errore nel salvataggio del pacchetto.');
    } finally {
      setSavingPkg(false);
    }
  };

  // Delete Package
  const handleDeletePackage = async (pkg: AttributePackage) => {
    if (pkg.is_system) {
      alert(t.metamodel.packageSystemCannotDelete);
      return;
    }
    if (!confirm(interpolate(t.metamodel.packageConfirmDelete, { name: pkg.name, code: pkg.code.toUpperCase() }))) {
      return;
    }

    try {
      await api.deleteAttributePackage(pkg.id);
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione del pacchetto.');
    }
  };

  // Open Add Item Modal
  const handleOpenAddItem = (pkg: AttributePackage) => {
    setTargetPkgId(pkg.id);
    setEditingItem(null);
    setItemFormData({
      name: '',
      label: '',
      description: '',
      element_type: 'ApplicationComponent',
      layer: 'Application',
      data_type: 'string',
      optionsString: '',
      default_value: '',
      is_required: false,
      section: pkg.code === 'apm' ? 'APM Portfolio' : pkg.code === 'tme' ? 'TIME Assessment' : `${pkg.name}`,
      sort_order: (pkg.items?.length || 0) + 1
    });
    setItemModalError(null);
    setIsItemModalOpen(true);
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (pkgId: string, item: AttributePackageItem) => {
    setTargetPkgId(pkgId);
    setEditingItem(item);
    setItemFormData({
      name: item.name,
      label: item.label,
      description: item.description || '',
      element_type: item.element_type,
      layer: item.layer,
      data_type: item.data_type,
      optionsString: (item.options || []).join(', '),
      default_value: item.default_value || '',
      is_required: item.is_required,
      section: item.section || 'General',
      sort_order: item.sort_order || 1
    });
    setItemModalError(null);
    setIsItemModalOpen(true);
  };

  // Save Item (Create / Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPkgId) return;

    setItemModalError(null);
    setSavingItem(true);

    const optionsList = itemFormData.data_type === 'select'
      ? itemFormData.optionsString.split(',').map((o) => o.trim()).filter(Boolean)
      : [];

    try {
      if (editingItem) {
        await api.updatePackageItem(targetPkgId, editingItem.id, {
          label: itemFormData.label,
          description: itemFormData.description,
          element_type: itemFormData.element_type,
          layer: itemFormData.layer,
          data_type: itemFormData.data_type,
          options: optionsList,
          default_value: itemFormData.default_value,
          is_required: itemFormData.is_required,
          section: itemFormData.section,
          sort_order: itemFormData.sort_order
        });
      } else {
        await api.createPackageItem(targetPkgId, {
          name: itemFormData.name,
          label: itemFormData.label,
          description: itemFormData.description,
          element_type: itemFormData.element_type,
          layer: itemFormData.layer,
          data_type: itemFormData.data_type,
          options: optionsList,
          default_value: itemFormData.default_value,
          is_required: itemFormData.is_required,
          section: itemFormData.section,
          sort_order: itemFormData.sort_order
        });
      }
      setIsItemModalOpen(false);
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
    } catch (err: any) {
      setItemModalError(err.message || 'Errore nel salvataggio dell\'attributo.');
    } finally {
      setSavingItem(false);
    }
  };

  // Delete Item
  const handleDeleteItem = async (pkgId: string, item: AttributePackageItem) => {
    if (!confirm(interpolate(t.metamodel.packageItemConfirmDelete, { label: item.label, name: item.name }))) {
      return;
    }
    try {
      await api.deletePackageItem(pkgId, item.id);
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione dell\'attributo.');
    }
  };

  // Open Usage Audit
  const handleOpenAudit = async (pkg: AttributePackage) => {
    setIsAuditModalOpen(true);
    setAuditData(null);
    setLoadingAudit(true);

    try {
      const data = await api.getPackageUsageAudit(pkg.id);
      setAuditData(data);
    } catch (err: any) {
      alert(err.message || 'Errore nel caricamento del report di utilizzo.');
      setIsAuditModalOpen(false);
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner & Actions Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                {t.metamodel.packagesTitle}
                {selectedScope === 'global' && (
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
                    🌐 Catalogo Globale
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedScope === 'global'
                  ? t.metamodel.packagesSubtitleGlobal
                  : t.metamodel.packagesSubtitleLibrary}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.metamodel.packageSearchPlaceholder}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 w-48 shadow-2xs"
            />
          </div>

          {selectedScope === 'global' && (
            <button
              onClick={handleOpenCreatePkg}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-600/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.metamodel.addPackageBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Packages List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-medium">
          Caricamento pacchetti di attributi...
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
          Nessun pacchetto di attributi trovato.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPackages.map((pkg) => {
            const isExpanded = !!expandedPackages[pkg.id];
            const theme = THEME_COLORS[pkg.icon_color || 'blue'] || THEME_COLORS.blue;
            const items = pkg.items || [];

            return (
              <div
                key={pkg.id}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all"
              >
                {/* Package Header Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 bg-white">
                  <div className="flex items-start space-x-3.5">
                    <button
                      onClick={() => toggleExpand(pkg.id)}
                      className="mt-1 p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition"
                      title={isExpanded ? 'Comprimi' : 'Espandi'}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 3-letter code badge */}
                        <span className={`text-xs font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-lg border ${theme.bg} ${theme.text} ${theme.border}`}>
                          [{pkg.code}]
                        </span>
                        <h5 className="text-sm font-extrabold text-slate-900">{pkg.name}</h5>

                        {pkg.is_system && (
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.2 rounded-full flex items-center gap-1">
                            ⚡ {t.metamodel.easyEaExtensionBadge}
                          </span>
                        )}
                        {pkg.is_default_active && (
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.2 rounded-full flex items-center gap-1">
                            ⭐ Attivo di default
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded-full">
                          {items.length} attributi
                        </span>
                      </div>

                      {pkg.description && (
                        <p className="text-xs text-slate-600 max-w-2xl">{pkg.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Activation Controls */}
                  <div className="flex items-center flex-wrap gap-2.5 pl-8 lg:pl-0">
                    {/* If viewing in library scope: Activation Switch */}
                    {selectedScope !== 'global' && (
                      <button
                        onClick={() => handleTogglePackage(pkg)}
                        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shadow-2xs ${
                          pkg.is_active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {pkg.is_active ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>{t.metamodel.packageActiveInLibrary}</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-slate-400" />
                            <span>{t.metamodel.packageInactiveInLibrary}</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Audit Usage Button (Available to all) */}
                    <button
                      onClick={() => handleOpenAudit(pkg)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      title={t.metamodel.packageAuditTooltip}
                    >
                      <BarChart2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>{t.metamodel.packageAuditBtn}</span>
                    </button>

                    {/* Global Scope: Edit / Add / Delete */}
                    {selectedScope === 'global' && (
                      <>
                        <button
                          onClick={() => handleOpenAddItem(pkg)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t.metamodel.packageAddAttributeBtn}</span>
                        </button>

                        <button
                          onClick={() => handleOpenEditPkg(pkg)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                          title={t.metamodel.packageEditTooltip}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {!pkg.is_system && (
                          <button
                            onClick={() => handleDeletePackage(pkg)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                            title={t.metamodel.packageDeleteTooltip}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Package Attributes Table (Accordion Content) */}
                {isExpanded && (
                  <div className="bg-slate-50/60 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Attributi inclusi nel pacchetto [{pkg.code.toUpperCase()}]
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Tutti gli identificatori iniziano con il prefisso <code className="font-mono font-bold text-slate-600">{pkg.code}_</code>
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="p-4 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-400 italic text-center">
                        Nessun attributo registrato in questo pacchetto.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {items.map((it) => (
                          <div
                            key={it.id}
                            className="bg-white border border-slate-200/80 rounded-xl p-3 text-xs space-y-2 shadow-2xs flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800 text-xs">{it.label}</span>
                                    {it.is_required && (
                                      <span className="text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">
                                        {t.metamodel.required}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                                    <Tag className="w-2.5 h-2.5 text-purple-600" />
                                    <span>{it.name}</span>
                                  </div>
                                </div>

                                <span className="text-[9px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {it.data_type}
                                </span>
                              </div>

                              {it.description && (
                                <p className="text-[11px] text-slate-500 leading-tight pt-0.5">
                                  {it.description}
                                </p>
                              )}
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                  {it.section}
                                </span>
                                <span>•</span>
                                <span>Target: {it.element_type} ({it.layer})</span>
                              </div>

                              {selectedScope === 'global' && !pkg.is_system && (
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleOpenEditItem(pkg.id, it)}
                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
                                    title={t.metamodel.packageEditItemTooltip}
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(pkg.id, it)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                    title={t.metamodel.packageDeleteItemTooltip}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE / EDIT PACKAGE                           */}
      {/* ======================================================== */}
      {isPkgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {editingPkg ? 'Modifica Pacchetto di Attributi' : 'Nuovo Pacchetto di Attributi'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Definisci le proprietà del pacchetto del catalogo globale.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPkgModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pkgModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pkgModalError}</span>
              </div>
            )}

            <form onSubmit={handleSavePackage} className="space-y-4 text-xs">
              {/* Code */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 flex items-center justify-between">
                  <span>{t.metamodel.packageCode}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Esattamente 3 lettere minuscole (es. apm, tme, sec)</span>
                </label>
                <input
                  type="text"
                  maxLength={3}
                  disabled={!!editingPkg}
                  value={pkgFormData.code}
                  onChange={(e) => setPkgFormData({ ...pkgFormData, code: e.target.value.toLowerCase() })}
                  placeholder="es. apm"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold text-slate-800 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  required
                />
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">{t.metamodel.packageName}</label>
                <input
                  type="text"
                  value={pkgFormData.name}
                  onChange={(e) => setPkgFormData({ ...pkgFormData, name: e.target.value })}
                  placeholder={t.metamodel.packageNamePlaceholder}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">{t.metamodel.packageDescription}</label>
                <textarea
                  rows={2}
                  value={pkgFormData.description}
                  onChange={(e) => setPkgFormData({ ...pkgFormData, description: e.target.value })}
                  placeholder={t.metamodel.packageDescPlaceholder}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Theme Color */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">{t.metamodel.packageIconColor}</label>
                <div className="flex items-center gap-2">
                  {Object.keys(THEME_COLORS).map((cKey) => (
                    <button
                      type="button"
                      key={cKey}
                      onClick={() => setPkgFormData({ ...pkgFormData, icon_color: cKey })}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                        pkgFormData.icon_color === cKey
                          ? `${THEME_COLORS[cKey].bg} ${THEME_COLORS[cKey].text} ${THEME_COLORS[cKey].border} ring-2 ring-purple-400`
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {cKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Active checkbox */}
              <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pkgFormData.is_default_active}
                  onChange={(e) => setPkgFormData({ ...pkgFormData, is_default_active: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="font-bold text-slate-700">{t.metamodel.packageDefaultActive}</span>
              </label>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPkgModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingPkg}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  {savingPkg ? 'Salvataggio...' : editingPkg ? 'Salva Modifiche' : 'Crea Pacchetto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ADD / EDIT PACKAGE ITEM                         */}
      {/* ======================================================== */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                  <Sliders className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {editingItem ? 'Modifica Attributo di Pacchetto' : 'Aggiungi Attributo al Pacchetto'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    L'attributo apparterrà al namespace con prefisso a 3 lettere del pacchetto.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {itemModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{itemModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              {/* Technical Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Nome Tecnico (Chiave Identificativa)</label>
                <input
                  type="text"
                  disabled={!!editingItem}
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  placeholder="es. annual_cost oppure apm_annual_cost"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  required
                />
              </div>

              {/* Label */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Etichetta Visiva (Label)</label>
                <input
                  type="text"
                  value={itemFormData.label}
                  onChange={(e) => setItemFormData({ ...itemFormData, label: e.target.value })}
                  placeholder="es. Costo Totale Annuo TCO (€)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">{t.metamodel.packageDescription}</label>
                <textarea
                  rows={2}
                  value={itemFormData.description}
                  onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                  placeholder={t.metamodel.placeholderFieldDescription}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Target Element Type & Layer */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">{t.metamodel.labelTargetType}</label>
                  <select
                    value={itemFormData.element_type}
                    onChange={(e) => setItemFormData({ ...itemFormData, element_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-purple-500"
                  >
                    {ARCHIMATE_TYPES.map((tItem) => (
                      <option key={tItem} value={tItem}>{tItem === '*' ? '★ Tutti i tipi (*)' : tItem}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">{t.metamodel.packageTargetLayer}</label>
                  <select
                    value={itemFormData.layer}
                    onChange={(e) => setItemFormData({ ...itemFormData, layer: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-purple-500"
                  >
                    {ARCHIMATE_LAYERS.map((ly) => (
                      <option key={ly} value={ly}>{ly}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Type & Section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">{t.metamodel.labelDataType}</label>
                  <select
                    value={itemFormData.data_type}
                    onChange={(e) => setItemFormData({ ...itemFormData, data_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-purple-500"
                  >
                    <option value="string">{t.metamodel.typeString}</option>
                    <option value="number">{t.metamodel.typeNumber}</option>
                    <option value="boolean">{t.metamodel.typeBoolean}</option>
                    <option value="date">{t.metamodel.typeDate}</option>
                    <option value="select">{t.metamodel.typeSelect}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">{t.metamodel.labelSection}</label>
                  <input
                    type="text"
                    value={itemFormData.section}
                    onChange={(e) => setItemFormData({ ...itemFormData, section: e.target.value })}
                    placeholder="es. APM Governance"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Options if select */}
              {itemFormData.data_type === 'select' && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">{t.metamodel.labelOptions}</label>
                  <input
                    type="text"
                    value={itemFormData.optionsString}
                    onChange={(e) => setItemFormData({ ...itemFormData, optionsString: e.target.value })}
                    placeholder={t.metamodel.placeholderOptions}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {/* Default Value & Required */}
              <div className="grid grid-cols-2 gap-3 items-center pt-1">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">{t.metamodel.labelDefaultValue}</label>
                  <input
                    type="text"
                    value={itemFormData.default_value}
                    onChange={(e) => setItemFormData({ ...itemFormData, default_value: e.target.value })}
                    placeholder={t.metamodel.placeholderDefaultValue}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <label className="flex items-center space-x-2 pt-5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemFormData.is_required}
                    onChange={(e) => setItemFormData({ ...itemFormData, is_required: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-bold text-slate-700">Campo Obbligatorio</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  {savingItem ? 'Salvataggio...' : editingItem ? 'Salva Modifiche' : 'Aggiungi Attributo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: STRICT DEACTIVATION BLOCKED MODAL               */}
      {/* ======================================================== */}
      {deactivationBlockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <span className="p-2.5 rounded-2xl bg-rose-100 border border-rose-200">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  {t.metamodel.packageDeactivationBlockedTitle}
                </h4>
                <span className="text-[11px] font-bold text-rose-600">
                  Integrità Dati: Disattivazione Impedita
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200/80 rounded-xl space-y-2">
              <p className="text-xs text-rose-900 leading-relaxed font-medium">
                {t.metamodel.packageDeactivationBlockedDesc}
              </p>
              <div className="text-xs font-extrabold text-rose-700">
                {interpolate(t.metamodel.packageDeactivationBlockedCount, {
                  count: deactivationBlockModal.detail?.populated_count || 0
                })}
              </div>
            </div>

            {/* Affected elements sample */}
            {deactivationBlockModal.detail?.affected_elements && deactivationBlockModal.detail.affected_elements.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Elementi con dati compilati:
                </span>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50 text-[11px]">
                  {deactivationBlockModal.detail.affected_elements.map((el: any) => (
                    <div key={el.id} className="p-1.5 bg-white border border-slate-200/70 rounded-lg flex items-center justify-between gap-2">
                      <div className="font-bold text-slate-800 truncate">{el.name}</div>
                      <div className="text-[9px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 flex-shrink-0">
                        {el.populated_attributes?.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDeactivationBlockModal({ isOpen: false, packageName: '', detail: null })}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Ho capito / Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: PACKAGE USAGE AUDIT REPORT                      */}
      {/* ======================================================== */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <span className="p-2.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
                  <BarChart2 className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {auditData ? interpolate(t.metamodel.packageAuditTitle, { name: auditData.package_name, code: auditData.package_code.toUpperCase() }) : 'Analisi Utilizzo Pacchetto'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Riepilogo delle librerie attive e degli elementi che valorizzano gli attributi del pacchetto.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingAudit ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Analisi in corso tra le librerie...
              </div>
            ) : auditData ? (
              <div className="space-y-4">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-purple-700">Librerie con pacchetto attivo</span>
                    <div className="text-xl font-extrabold text-purple-900 mt-0.5">{auditData.total_active_libraries}</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-indigo-700">Elementi con attributi compilati</span>
                    <div className="text-xl font-extrabold text-indigo-900 mt-0.5">{auditData.total_populated_elements}</div>
                  </div>
                </div>

                {/* Libraries Breakdown Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3">Libreria</th>
                        <th className="p-3 text-center">Stato</th>
                        <th className="p-3 text-center">Elementi Totali</th>
                        <th className="p-3 text-center">Con Attributi Compilati</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {auditData.libraries.map((lib) => (
                        <tr key={lib.model_id} className="hover:bg-slate-50/70 transition">
                          <td className="p-3">
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{lib.model_name}</span>
                              <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 rounded">
                                [{lib.model_code || '----'}]
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {lib.is_active ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Attivo
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                Non attivo
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-mono">{lib.total_elements}</td>
                          <td className="p-3 text-center">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                              lib.populated_elements_count > 0
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'text-slate-400'
                            }`}>
                              {lib.populated_elements_count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
