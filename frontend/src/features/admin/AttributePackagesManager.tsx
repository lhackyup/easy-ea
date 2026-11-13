import React, { useState, useEffect, useMemo } from 'react';
import {
  AttributePackage,
  AttributePackageItem,
  PackageUsageAudit,
  ModelWorkspace,
  PackageInspectResult
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
  Tag,
  Upload,
  Download,
  Loader2,
  FileUp,
  FileArchive,
  Globe,
  RefreshCw,
  DownloadCloud,
  ExternalLink,
  CheckCircle2,
  ArrowUpCircle,
  Settings,
  ShoppingBag
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface AttributePackagesManagerProps {
  models?: ModelWorkspace[];
  selectedScope: string; // 'global' or a specific model_id
  readOnly?: boolean;
  onSelectScope?: (scope: string) => void;
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
  readOnly = false,
  onSelectScope,
  onPackageUpdated
}) => {
  const { t, interpolate } = useLanguage();

  const [packages, setPackages] = useState<AttributePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});
  const [pkgActiveTab, setPkgActiveTab] = useState<Record<string, 'attributes' | 'stereotypes' | 'views'>>({});
  const [pkgDetailsCache, setPkgDetailsCache] = useState<Record<string, any>>({});
  const [loadingPkgDetails, setLoadingPkgDetails] = useState<Record<string, boolean>>({});

  const loadPackageDetails = async (pkgId: string) => {
    if (pkgDetailsCache[pkgId] || loadingPkgDetails[pkgId]) return;
    setLoadingPkgDetails((prev) => ({ ...prev, [pkgId]: true }));
    try {
      const data = await api.getAttributePackage(pkgId);
      setPkgDetailsCache((prev) => ({ ...prev, [pkgId]: data }));
    } catch (err) {
      console.error('Failed to load package details', err);
    } finally {
      setLoadingPkgDetails((prev) => ({ ...prev, [pkgId]: false }));
    }
  };

  const handleUpdateViewTargetHub = async (pkgId: string, viewId: string, targetHub: 'business' | 'architecture' | 'both') => {
    try {
      await api.updatePackageViewTargetHub(viewId, targetHub);
      setPkgDetailsCache((prev) => {
        const pkgData = prev[pkgId];
        if (!pkgData || !pkgData.views) return prev;
        return {
          ...prev,
          [pkgId]: {
            ...pkgData,
            views: pkgData.views.map((v: any) => v.id === viewId ? { ...v, target_hub: targetHub } : v)
          }
        };
      });
      if (onPackageUpdated) {
        onPackageUpdated();
      }
    } catch (err: any) {
      alert(err.message || "Errore nell'aggiornamento del target hub");
    }
  };

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

  // Package Export State
  const [exportingPkgId, setExportingPkgId] = useState<string | null>(null);

  // Package Install / Import Modal State
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedBundleFile, setSelectedBundleFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [inspectResult, setInspectResult] = useState<PackageInspectResult | null>(null);
  const [forceInstall, setForceInstall] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);

  const handleOpenInstallModal = () => {
    setSelectedBundleFile(null);
    setInspectResult(null);
    setForceInstall(false);
    setInstallError(null);
    setInstallSuccess(null);
    setIsInstallModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processBundleFile(file);
  };

  const processBundleFile = async (file: File) => {
    setSelectedBundleFile(file);
    setInspectResult(null);
    setInstallError(null);
    setInstallSuccess(null);
    setInspecting(true);

    try {
      const res = await api.inspectPackageBundle(file);
      setInspectResult(res);
      if (res.action === 'downgrade' || (res.warnings && res.warnings.length > 0)) {
        setForceInstall(false);
      }
    } catch (err: any) {
      setInstallError(err.message || 'Errore durante la verifica del pacchetto .eap');
    } finally {
      setInspecting(false);
    }
  };

  const handleConfirmInstall = async () => {
    if (!selectedBundleFile) return;
    setInstalling(true);
    setInstallError(null);

    try {
      const res = await api.installPackageBundle(selectedBundleFile, forceInstall);
      setInstallSuccess(res.message || t.metamodel?.packageInstallSuccess || 'Pacchetto installato con successo!');
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
      setTimeout(() => {
        setIsInstallModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setInstallError(err.message || 'Errore durante l\'installazione del pacchetto.');
    } finally {
      setInstalling(false);
    }
  };

  const handleExportPackage = async (pkg: AttributePackage) => {
    setExportingPkgId(pkg.id);
    try {
      const fileName = `${(pkg.code || 'pkg').toLowerCase()}_v${(pkg as any).version || '1.0.0'}.eap`;
      await api.exportPackageBundle(pkg.id, fileName);
    } catch (err: any) {
      console.error('Failed to export package', err);
      alert(err.message || 'Errore durante l\'esportazione del pacchetto.');
    } finally {
      setExportingPkgId(null);
    }
  };

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

  // Repository / Marketplace State
  const [mainTab, setMainTab] = useState<'installed' | 'repository'>('installed');
  const [repoData, setRepoData] = useState<any | null>(null);
  const [repoLoading, setRepoLoading] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [repoCategory, setRepoCategory] = useState<string>('all');
  const [installingPkgCode, setInstallingPkgCode] = useState<string | null>(null);
  const [isRepoConfigModalOpen, setIsRepoConfigModalOpen] = useState(false);
  const [repoConfigUrl, setRepoConfigUrl] = useState('');
  const [testingRepoUrl, setTestingRepoUrl] = useState(false);
  const [testRepoResult, setTestRepoResult] = useState<any | null>(null);
  const [savingRepoConfig, setSavingRepoConfig] = useState(false);

  const fetchRepoPackages = async () => {
    setRepoLoading(true);
    setRepoError(null);
    try {
      const data = await api.getRepositoryPackages();
      setRepoData(data);
    } catch (err: any) {
      setRepoError(err.message || 'Errore durante il caricamento del repository dei pacchetti');
    } finally {
      setRepoLoading(false);
    }
  };

  const handleOpenRepoConfig = async () => {
    setIsRepoConfigModalOpen(true);
    setTestRepoResult(null);
    try {
      const cfg = await api.getRepositoryConfig();
      setRepoConfigUrl(cfg.configured_url || '');
    } catch (err) {
      console.error('Failed to load repo config', err);
    }
  };

  const handleTestRepoConnection = async () => {
    setTestingRepoUrl(true);
    setTestRepoResult(null);
    try {
      const res = await api.testRepositoryConnection(repoConfigUrl.trim() || 'local');
      setTestRepoResult({ success: true, message: `Connessione riuscita! Trovati ${res.packages_count} pacchetti.` });
    } catch (err: any) {
      setTestRepoResult({ success: false, message: err.message || 'Errore di connessione al repository' });
    } finally {
      setTestingRepoUrl(false);
    }
  };

  const handleSaveRepoConfig = async () => {
    setSavingRepoConfig(true);
    try {
      await api.updateRepositoryConfig(repoConfigUrl.trim());
      setIsRepoConfigModalOpen(false);
      await fetchRepoPackages();
    } catch (err: any) {
      alert(err.message || 'Errore durante il salvataggio della configurazione');
    } finally {
      setSavingRepoConfig(false);
    }
  };

  const handleInstallFromRepo = async (pkgCode: string, force: boolean = false) => {
    setInstallingPkgCode(pkgCode);
    try {
      await api.installPackageFromRepository(pkgCode, force);
      await fetchRepoPackages();
      await fetchPackages();
      if (onPackageUpdated) onPackageUpdated();
    } catch (err: any) {
      alert(err.message || "Errore durante l'installazione dal repository");
    } finally {
      setInstallingPkgCode(null);
    }
  };

  useEffect(() => {
    if (mainTab === 'repository' && !repoData && !repoLoading) {
      fetchRepoPackages();
    }
  }, [mainTab]);

  const filteredRepoPackages = useMemo(() => {
    if (!repoData?.packages) return [];
    let list = repoData.packages;
    if (repoCategory !== 'all') {
      list = list.filter((p: any) => p.category === repoCategory);
    }
    const q = repoSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [repoData, repoCategory, repoSearch]);

  const repoCategories = useMemo(() => {
    if (!repoData?.packages) return ['all'];
    const cats = new Set<string>();
    repoData.packages.forEach((p: any) => {
      if (p.category) cats.add(p.category);
    });
    return ['all', ...Array.from(cats)];
  }, [repoData]);

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

        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.metamodel.packageSearchPlaceholder}
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 w-44 shadow-2xs"
            />
          </div>

          {/* Install Package (.eap) Button */}
          {!readOnly ? (
            <>
              <button
                onClick={handleOpenInstallModal}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                title={t.metamodel.installPackageBtn}
              >
                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t.metamodel.installPackageBtn}</span>
              </button>

              {selectedScope === 'global' && (
                <button
                  onClick={handleOpenCreatePkg}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-purple-600/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.metamodel.addPackageBtn}</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-xl">
              👁️ {t.common.readOnly || 'Sola Lettura'}
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs: Catalogo Installato vs Repository & Marketplace */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setMainTab('installed')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              mainTab === 'installed'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t.metamodel.packageCatalogInstalled || 'Catalogo Pacchetti Installati'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
              {packages.length}
            </span>
          </button>

          <button
            onClick={() => setMainTab('repository')}
            className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer ${
              mainTab === 'repository'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Repository Esterno (Marketplace)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-mono">
              {repoData?.total ?? 2}
            </span>
          </button>
        </div>

        {mainTab === 'repository' && (
          <div className="flex items-center space-x-2 mb-1">
            <button
              onClick={fetchRepoPackages}
              disabled={repoLoading}
              className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Sincronizza catalogo repository"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${repoLoading ? 'animate-spin' : ''}`} />
              <span>Sincronizza</span>
            </button>
            <button
              onClick={handleOpenRepoConfig}
              className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Configura URL repository"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Impostazioni URL</span>
            </button>
          </div>
        )}
      </div>

      {mainTab === 'installed' ? (
        <>
          {/* Packages List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-medium">
          {t.metamodel.loadingPackages || 'Caricamento pacchetti di attributi...'}
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
          {t.metamodel.noPackagesFound || 'Nessun pacchetto di attributi trovato.'}
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
                        {(pkg.stereotypes_count || 0) > 0 && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded-full">
                            {pkg.stereotypes_count} {pkg.stereotypes_count === 1 ? 'Stereotipo' : 'Stereotipi'}
                          </span>
                        )}
                        {(pkg.views_count || 0) > 0 && (
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.2 rounded-full">
                            {pkg.views_count} {pkg.views_count === 1 ? 'Vista' : 'Viste'}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded-full">
                          {items.length} {t.metamodel.attributesCount ? interpolate(t.metamodel.attributesCount, { count: items.length }) : 'attributi'}
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

                    {/* Export Package Button (.eap) */}
                    <button
                      onClick={() => handleExportPackage(pkg)}
                      disabled={exportingPkgId === pkg.id}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                      title={t.metamodel.exportPackageBtn}
                    >
                      {exportingPkgId === pkg.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>{t.metamodel.exportPackageBtn}</span>
                    </button>

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
                  <div className="bg-slate-50/60 p-4 sm:p-5 space-y-4">
                    {/* Sub-tabs if package includes Stereotypes or Business Views */}
                    {((pkg.stereotypes_count || 0) > 0 || (pkg.views_count || 0) > 0) && (
                      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                        <button
                          type="button"
                          onClick={() => setPkgActiveTab({ ...pkgActiveTab, [pkg.id]: 'attributes' })}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            (pkgActiveTab[pkg.id] || 'attributes') === 'attributes'
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {items.length} {t.metamodel.attributesCount ? interpolate(t.metamodel.attributesCount, { count: items.length }) : 'Attributi'}
                        </button>
                        {(pkg.stereotypes_count || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPkgActiveTab({ ...pkgActiveTab, [pkg.id]: 'stereotypes' });
                              loadPackageDetails(pkg.id);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              pkgActiveTab[pkg.id] === 'stereotypes'
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>« »</span>
                            <span>{pkg.stereotypes_count} {pkg.stereotypes_count === 1 ? 'Stereotipo' : 'Stereotipi'}</span>
                          </button>
                        )}
                        {(pkg.views_count || 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPkgActiveTab({ ...pkgActiveTab, [pkg.id]: 'views' });
                              loadPackageDetails(pkg.id);
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              pkgActiveTab[pkg.id] === 'views'
                                ? 'bg-purple-600 text-white shadow-2xs'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span>📊</span>
                            <span>{pkg.views_count} {pkg.views_count === 1 ? 'Vista di Business' : 'Viste di Business'}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* TAB 1: ATTRIBUTES */}
                    {(pkgActiveTab[pkg.id] || 'attributes') === 'attributes' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            {interpolate(t.metamodel.packageItemsInPkg || 'Attributi inclusi nel pacchetto [{code}]', { code: pkg.code.toUpperCase() })}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Tutti gli identificatori iniziano con il prefisso <code className="font-mono font-bold text-slate-600">{pkg.code}_</code>
                          </span>
                        </div>

                        {items.length === 0 ? (
                          <div className="p-4 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-400 italic text-center">
                            {t.metamodel.noPackageItems || 'Nessun attributo registrato in questo pacchetto.'}
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

                    {/* TAB 2: STEREOTYPES */}
                    {pkgActiveTab[pkg.id] === 'stereotypes' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Stereotipi ArchiMate forniti da [{pkg.code.toUpperCase()}]
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            Estensione Metamodello
                          </span>
                        </div>

                        {loadingPkgDetails[pkg.id] ? (
                          <div className="p-8 text-center text-xs text-slate-400">{t.metamodel.loadingStereotypes || 'Caricamento stereotipi...'}</div>
                        ) : !pkgDetailsCache[pkg.id]?.stereotypes || pkgDetailsCache[pkg.id]?.stereotypes.length === 0 ? (
                          <div className="p-4 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-400 italic text-center">
                            {t.metamodel.noStereotypesInPkg || 'Nessuno stereotipo registrato in questo pacchetto.'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {pkgDetailsCache[pkg.id].stereotypes.map((st: any) => (
                              <div
                                key={st.id}
                                className="bg-white border border-indigo-200/80 rounded-xl p-3.5 text-xs space-y-2 shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-indigo-900 text-xs px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded">
                                      «{st.label || st.name}»
                                    </span>
                                    <span className="font-bold text-slate-800 text-xs">{st.name}</span>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                    {st.base_type}
                                  </span>
                                </div>
                                {st.description && (
                                  <p className="text-[11px] text-slate-600 leading-relaxed">{st.description}</p>
                                )}
                                {st.stencil_shape && (
                                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-indigo-50 text-[10px] text-amber-900 font-bold">
                                    <Sparkles className="w-3 h-3 text-amber-600" />
                                    <span>Stencil: <strong className="font-mono text-amber-950">{st.stencil_shape}</strong></span>
                                    {st.stencil_icon && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">({st.stencil_icon})</span>}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: BUSINESS VIEWS */}
                    {pkgActiveTab[pkg.id] === 'views' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Viste di Business fornite da [{pkg.code.toUpperCase()}]
                          </span>
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                            Reportistica & Cruscotti Predefiniti
                          </span>
                        </div>

                        {loadingPkgDetails[pkg.id] ? (
                          <div className="p-8 text-center text-xs text-slate-400">{t.metamodel.loadingBusinessViews || 'Caricamento viste di business...'}</div>
                        ) : !pkgDetailsCache[pkg.id]?.views || pkgDetailsCache[pkg.id]?.views.length === 0 ? (
                          <div className="p-4 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-400 italic text-center">
                            {t.metamodel.noBusinessViewsInPkg || 'Nessuna vista di business registrata in questo pacchetto.'}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {pkgDetailsCache[pkg.id].views.map((v: any) => (
                              <div
                                key={v.id}
                                className="bg-white border border-purple-200/80 rounded-xl p-3.5 text-xs space-y-2 shadow-2xs"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">📊</span>
                                    <span className="font-extrabold text-slate-900 text-xs">{v.name}</span>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase">
                                    {v.view_type}
                                  </span>
                                </div>
                                {v.description && (
                                  <p className="text-[11px] text-slate-600 leading-relaxed">{v.description}</p>
                                )}
                                {v.target_stereotypes && v.target_stereotypes.length > 0 && (
                                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-500">
                                    <span className="font-semibold">Filtro Stereotipo:</span>
                                    {v.target_stereotypes.map((targetSt: string) => (
                                      <span key={targetSt} className="font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded font-semibold">
                                        «{targetSt}»
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                  <span className="font-semibold text-slate-500">Destinazione Hub:</span>
                                  <select
                                    value={v.target_hub || 'business'}
                                    onChange={(e) => handleUpdateViewTargetHub(pkg.id, v.id, e.target.value as any)}
                                    className="text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                                  >
                                    <option value="business">💼 Business Hub</option>
                                    <option value="architecture">🏛️ Architecture Hub</option>
                                    <option value="both">🌐 Entrambi (Business & Arch)</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  ) : (
    /* Marketplace / External Repository View */
    <div className="space-y-5">
      {/* Repository Subheader: Filter & Search */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <span className="text-xs font-bold text-slate-600 mr-1">Categoria:</span>
          {repoCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setRepoCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                repoCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat === 'all' ? (t.metamodel.allPackagesCategory || 'Tutti i Pacchetti') : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={repoSearch}
              onChange={(e) => setRepoSearch(e.target.value)}
              placeholder={t.common.search || 'Cerca nel repository...'}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-52 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Repo Loading / Error */}
      {repoLoading ? (
        <div className="p-16 text-center text-slate-400 text-xs font-medium flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span>{t.common.loading || 'Connessione e lettura catalogo dal repository esterno...'}</span>
        </div>
      ) : repoError ? (
        <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">{t.metamodel.repoCommunicationError || 'Errore di comunicazione con il repository'}</div>
            <div>{repoError}</div>
            <button
              onClick={fetchRepoPackages}
              className="mt-2 px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
            >
              {t.common.retry || 'Riprova'}
            </button>
          </div>
        </div>
      ) : filteredRepoPackages.length === 0 ? (
        <div className="p-16 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
          {t.metamodel.noPackagesInRepo || 'Nessun pacchetto trovato nel repository per i criteri selezionati.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRepoPackages.map((pkg: any) => {
            const theme = THEME_COLORS[pkg.icon_color || 'blue'] || THEME_COLORS.blue;
            const isInstalling = installingPkgCode === pkg.code;

            return (
              <div
                key={pkg.id || pkg.code}
                className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span className={`p-2.5 rounded-xl border ${theme.bg} ${theme.text} ${theme.border}`}>
                        <Package className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition">
                            {pkg.name}
                          </h5>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">
                          [{pkg.code}]
                        </span>
                      </div>
                    </div>

                    {pkg.category && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {pkg.category}
                      </span>
                    )}
                  </div>

                  {/* Versions & Metadata Badges */}
                  <div className="flex items-center flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono font-bold text-[11px]">
                      v{pkg.version}
                    </span>
                    {pkg.standard_version && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-medium">
                        Standard {pkg.standard_version}
                      </span>
                    )}
                    {pkg.package_type === 'framework' && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase">
                        Framework
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {pkg.description || 'Nessuna descrizione disponibile.'}
                  </p>

                  {/* Tags */}
                  {pkg.tags && pkg.tags.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1 pt-1">
                      {pkg.tags.map((tag: string) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Author / License */}
                  {(pkg.author || pkg.license) && (
                    <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
                      <span>{pkg.author || 'Open Standard'}</span>
                      <span>{pkg.license || ''}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer / Action */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    {pkg.status === 'installed' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{interpolate(t.metamodel.installedVersionBadge || 'Installato (v{version})', { version: pkg.installed_version })}</span>
                      </span>
                    )}
                    {pkg.status === 'update_available' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        <span>Aggiorna a v{pkg.version}</span>
                      </span>
                    )}
                    {pkg.status === 'available' && (
                      <span className="text-xs text-slate-500 font-medium">
                        Disponibile nel Repository
                      </span>
                    )}
                  </div>

                  <div>
                    {pkg.status === 'available' && (
                      <button
                        onClick={() => handleInstallFromRepo(pkg.code, false)}
                        disabled={isInstalling}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-indigo-600/20 transition cursor-pointer"
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{t.metamodel.installingBtn || 'Installazione...'}</span>
                          </>
                        ) : (
                          <>
                            <DownloadCloud className="w-3.5 h-3.5" />
                            <span>{t.metamodel.installToCatalogBtn || 'Installa nel Catalogo'}</span>
                          </>
                        )}
                      </button>
                    )}

                    {pkg.status === 'update_available' && (
                      <button
                        onClick={() => handleInstallFromRepo(pkg.code, true)}
                        disabled={isInstalling}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm shadow-amber-600/20 transition cursor-pointer"
                      >
                        {isInstalling ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Aggiornamento...</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span>Aggiorna a v{pkg.version}</span>
                          </>
                        )}
                      </button>
                    )}

                    {pkg.status === 'installed' && (
                      <button
                        onClick={() => handleInstallFromRepo(pkg.code, true)}
                        disabled={isInstalling}
                        className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                        title={t.metamodel.forceReinstallTooltip || 'Forza reinstallazione dal repository'}
                      >
                        {isInstalling ? (t.metamodel.reinstalling || 'In corso...') : (t.metamodel.reinstallBtn || 'Reinstalla')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
                    {editingPkg ? (t.metamodel.modalEditPackageTitle || 'Modifica Pacchetto di Attributi') : (t.metamodel.modalCreatePackageTitle || 'Nuovo Pacchetto di Attributi')}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {t.metamodel.modalPackageSubtitle || 'Definisci le proprietà del pacchetto del catalogo globale.'}
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
                  {savingPkg ? (t.metamodel.saving || 'Salvataggio...') : editingPkg ? (t.metamodel.saveChangesBtn || 'Salva Modifiche') : (t.metamodel.createPackageBtn || 'Crea Pacchetto')}
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
                    {editingItem ? (t.metamodel.modalEditItemTitle || 'Modifica Attributo di Pacchetto') : (t.metamodel.modalCreateItemTitle || 'Aggiungi Attributo al Pacchetto')}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {t.metamodel.modalItemSubtitle || "L'attributo apparterrà al namespace con prefisso a 3 lettere del pacchetto."}
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
                  {savingItem ? (t.metamodel.saving || 'Salvataggio...') : editingItem ? (t.metamodel.saveChangesBtn || 'Salva Modifiche') : (t.metamodel.addItemBtn || 'Aggiungi Attributo')}
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

      {/* Install Package (.eap) Modal */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {t.metamodel.installModalTitle}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {t.metamodel.installModalSubtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* File Dropzone */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t.metamodel.packageBundleFileLabel || 'File del pacchetto (.eap)'}
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processBundleFile(file);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                    selectedBundleFile
                      ? 'border-indigo-400 bg-indigo-50/30'
                      : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60'
                  }`}
                  onClick={() => document.getElementById('bundle-upload-input')?.click()}
                >
                  <input
                    id="bundle-upload-input"
                    type="file"
                    accept=".eap,.zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileUp className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-800">
                    {selectedBundleFile ? selectedBundleFile.name : t.metamodel.installModalDropzone}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {t.metamodel.installModalDropzoneHint}
                  </p>
                </div>
              </div>

              {/* Preflight inspecting spinner */}
              {inspecting && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-2">
                  <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {t.metamodel.inspectingPackage}
                  </p>
                </div>
              )}

              {/* Preflight Inspection Result */}
              {inspectResult && !inspecting && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-800">
                      {t.metamodel.preflightSummaryTitle}
                    </span>
                    {inspectResult.action === 'new_install' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.metamodel.preflightNewInstall}</span>
                      </span>
                    )}
                    {inspectResult.action === 'upgrade' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{t.metamodel.preflightUpgrade}</span>
                      </span>
                    )}
                    {inspectResult.action === 'reinstall' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Info className="w-3.5 h-3.5" />
                        <span>{t.metamodel.preflightReinstall}</span>
                      </span>
                    )}
                    {inspectResult.action === 'downgrade' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>{t.metamodel.preflightDowngrade}</span>
                      </span>
                    )}
                  </div>

                  {/* Package Metadata Summary */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                          [{inspectResult.manifest.code}]
                        </span>
                        <h5 className="text-sm font-black text-slate-900">
                          {inspectResult.manifest.name}
                        </h5>
                      </div>
                      <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                        v{inspectResult.manifest.version}
                      </span>
                    </div>

                    {inspectResult.manifest.description && (
                      <p className="text-xs text-slate-600">
                        {inspectResult.manifest.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 flex-wrap">
                      {inspectResult.manifest.standard_version && (
                        <span>Standard: <strong>{inspectResult.manifest.standard_version}</strong></span>
                      )}
                      {inspectResult.manifest.author && (
                        <span>Autore: <strong>{inspectResult.manifest.author}</strong></span>
                      )}
                      <span>Tipo: <strong>{inspectResult.manifest.package_type === 'framework' ? (t.metamodel.frameworkTypeFull || 'Framework Completo') : (t.metamodel.frameworkTypeAttrsOnly || 'Solo Attributi')}</strong></span>
                      {inspectResult.existing_package && (
                        <span className="text-slate-400">
                          ({interpolate(t.metamodel.currentlyInstalledVersion || 'Installato attualmente: {version}', { version: `v${inspectResult.existing_package.version}` })})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics Counts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Attributi</span>
                      <span className="text-lg font-black text-slate-900">{inspectResult.counts.attributes}</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Stereotipi</span>
                      <span className="text-lg font-black text-slate-900">{inspectResult.counts.stereotypes}</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Elementi Ref.</span>
                      <span className="text-lg font-black text-slate-900">{inspectResult.counts.reference_elements}</span>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-center shadow-2xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Relazioni Ref.</span>
                      <span className="text-lg font-black text-slate-900">{inspectResult.counts.reference_relationships}</span>
                    </div>
                  </div>

                  {/* Warnings */}
                  {inspectResult.warnings && inspectResult.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>{t.metamodel.installWarnings || 'Avvisi di installazione:'}</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                        {inspectResult.warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Errors */}
                  {inspectResult.errors && inspectResult.errors.length > 0 && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>{t.metamodel.installErrors || 'Errori critici nel pacchetto:'}</span>
                      </div>
                      <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                        {inspectResult.errors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Force install checkbox if downgrade or warnings */}
                  {(inspectResult.action === 'downgrade' || (inspectResult.warnings && inspectResult.warnings.length > 0)) && (
                    <label className="flex items-center space-x-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceInstall}
                        onChange={(e) => setForceInstall(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {t.metamodel.forceInstallCheckbox}
                      </span>
                    </label>
                  )}
                </div>
              )}

              {/* Install Error Banner */}
              {installError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{installError}</span>
                </div>
              )}

              {/* Install Success Banner */}
              {installSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{installSuccess}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsInstallModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmInstall}
                disabled={
                  !inspectResult ||
                  (!inspectResult.valid && !forceInstall) ||
                  installing ||
                  (inspectResult.errors && inspectResult.errors.length > 0 && !forceInstall)
                }
                className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer"
              >
                {installing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.metamodel.installingPackage}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>{t.metamodel.confirmInstallBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: REPOSITORY URL CONFIGURATION                    */}
      {/* ======================================================== */}
      {isRepoConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <span className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Globe className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {t.metamodel.repoConfigTitle || 'Configurazione Repository Pacchetti'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Definisci l'endpoint del registro esterno (HTTP/HTTPS) o usa il repository locale predefinito.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRepoConfigModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  URL del Catalogo Repository (index.json)
                </label>
                <input
                  type="text"
                  value={repoConfigUrl}
                  onChange={(e) => setRepoConfigUrl(e.target.value)}
                  placeholder="Lascia vuoto per usare il repository locale predefinito (packages_repository/index.json)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Esempio: <code>https://packages.easyea.org/index.json</code> oppure <code>https://raw.githubusercontent.com/.../index.json</code>
                </p>
              </div>

              {testRepoResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testRepoResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {testRepoResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{testRepoResult.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleTestRepoConnection}
                disabled={testingRepoUrl}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {testingRepoUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Testa Connessione</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsRepoConfigModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveRepoConfig}
                  disabled={savingRepoConfig}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                >
                  {savingRepoConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Salva Configurazione</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
