import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PackageWithViews,
  PackageViewSummary,
  PackageViewExecuteResponse,
  ActivePackageViewSelection,
  MetamodelLayer,
  CustomAttributeDefinition,
  ArchiSchema
} from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { SchemaPreviewModal } from '../schemas/SchemaPreviewModal';
import {
  Layers,
  Table as TableIcon,
  BarChart3,
  Grid,
  Search,
  Download,
  RotateCcw,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  PieChart,
  Package,
  Eye,
  Tag,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Folder,
  FolderGit2,
  Lock,
  Unlock,
  Share2,
  FileText,
  Info,
  Clock,
  AlertTriangle,
  CircleDot,
  LayoutGrid,
  Coins,
  Cloud,
  Server,
  Building2,
  Workflow,
  Sparkles,
  Database,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface FrameworkInsightsProps {
  modelId: string;
  packages?: PackageWithViews[];
  activePackageView?: ActivePackageViewSelection | null;
  onSelectPackageView?: (packageId: string, viewId: string) => void;
}

export const FrameworkInsights: React.FC<FrameworkInsightsProps> = ({
  modelId,
  packages: initialPackages,
  activePackageView,
  onSelectPackageView
}) => {
  const { t, interpolate } = useLanguage();

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [packages, setPackages] = useState<PackageWithViews[]>(initialPackages || []);
  const [selectedPackage, setSelectedPackage] = useState<PackageWithViews | null>(null);
  const [selectedView, setSelectedView] = useState<PackageViewSummary | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [viewData, setViewData] = useState<PackageViewExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Runtime Filters for View
  const [searchQuery, setSearchQuery] = useState('');
  const [facetFilters, setFacetFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination for Views
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Reset page when view or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedView?.id, searchQuery, facetFilters, sortField, sortDir]);

  // Matrix View Mode (Matrice 2x2 a Bolle vs Quadranti vs Tabella vs Pivot 2D)
  const [matrixViewMode, setMatrixViewMode] = useState<'bubble' | 'cards' | 'table' | 'pivot'>('bubble');

  const isTimeMatrix = useMemo(() => {
    if (!selectedView) return false;
    return (
      selectedView.view_key === 'apm_time_matrix' ||
      (selectedView as any).config?.matrix_type === 'time' ||
      (viewData as any)?.config?.matrix_type === 'time'
    );
  }, [selectedView, viewData]);

  useEffect(() => {
    if (selectedView?.view_type === 'matrix') {
      if (selectedView.view_key === 'apm_time_matrix' || (selectedView as any).config?.matrix_type === 'time') {
        setMatrixViewMode('bubble');
      } else {
        setMatrixViewMode('pivot');
      }
    }
  }, [selectedView?.id, selectedView?.view_key, selectedView?.view_type]);

  const formatEUR = (amount: number | string | undefined | null) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
  };

  const formatCompactEUR = (amount: number | string | undefined | null) => {
    const num = Number(amount) || 0;
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M €`;
    }
    if (num >= 1000) {
      return `${Math.round(num / 1000)}k €`;
    }
    return `${num} €`;
  };

  const totalPages = useMemo(() => {
    if (!viewData?.rows) return 1;
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(viewData.rows.length / pageSize));
  }, [viewData?.rows, pageSize]);

  const paginatedRows = useMemo(() => {
    if (!viewData?.rows) return [];
    if (pageSize === 'all') return viewData.rows;
    const page = Math.min(Math.max(1, currentPage), totalPages);
    const start = (page - 1) * pageSize;
    return viewData.rows.slice(start, start + pageSize);
  }, [viewData?.rows, currentPage, pageSize, totalPages]);

  // Calcolo posizioni cartesiane X (Technical Fit), Y (Business Fit) e raggio (TCO) per Scatter Bubble Chart
  const bubbleApps = useMemo(() => {
    if (!viewData?.rows || viewData.rows.length === 0) return [];

    const rows = viewData.rows;
    const costs = rows.map((r: any) => Number(r.apm_annual_cost) || 0);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const costSpread = Math.max(1, maxCost - minCost);

    // Raggruppa per coordinate discrete per calcolare jitter / dispersione ed evitare sovrapposizioni al 100%
    const groups: { [key: string]: any[] } = {};
    rows.forEach((r: any) => {
      const bFit = Number(r.business_fit_score) || (r.apm_functional_fit ? parseInt(String(r.apm_functional_fit)[0], 10) : 3) || 3;
      const tFit = Number(r.technical_fit_score) || (r.apm_technical_fit ? parseInt(String(r.apm_technical_fit)[0], 10) : 3) || 3;
      const key = `${bFit}_${tFit}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return rows.map((app: any) => {
      const bFit = Number(app.business_fit_score) || (app.apm_functional_fit ? parseInt(String(app.apm_functional_fit)[0], 10) : 3) || 3;
      const tFit = Number(app.technical_fit_score) || (app.apm_technical_fit ? parseInt(String(app.apm_technical_fit)[0], 10) : 3) || 3;
      const cost = Number(app.apm_annual_cost) || 0;

      // Raggio proporzionale alla radice quadrata del TCO (area del pallino proporzionale al costo)
      const costRatio = Math.sqrt(Math.max(0, cost - minCost) / costSpread);
      // Min radius 20px (diametro 40px), Max radius 52px (diametro 104px)
      const radius = 20 + costRatio * 32;

      // Coordinate cartesiane normalizzate in percentuale:
      // X = Technical Fit (1.0 -> 4.0). Soglia 2.5 corrisponde al 50%. Margine 8% .. 92%
      const minX = 8;
      const maxX = 92;
      const baseX = minX + ((tFit - 1) / 3) * (maxX - minX);

      // Y = Business Fit (1.0 in basso -> 4.0 in alto).
      // In CSS top%, 0% è in alto (4.0) e 100% è in basso (1.0). Margine 9% .. 91%
      const minY = 9;
      const maxY = 91;
      const baseY = maxY - ((bFit - 1) / 3) * (maxY - minY);

      // Dispersione orbitale deterministica per app con le stesse identiche coordinate discrete
      const key = `${bFit}_${tFit}`;
      const group = groups[key] || [];
      const indexInGroup = group.indexOf(app);
      let offsetX = 0;
      let offsetY = 0;

      if (group.length > 1) {
        // Angolo aureo per distribuzione uniforme multi-cluster
        const angle = indexInGroup * 2.39996;
        const dist = Math.min(4.5, 1.2 + Math.sqrt(indexInGroup) * 0.95);
        offsetX = Math.cos(angle) * dist;
        offsetY = Math.sin(angle) * dist;

        // Limita l'offset per evitare che travalichi la soglia del quadrante (50%)
        if (tFit >= 2.5 && baseX + offsetX < 52) offsetX = Math.abs(offsetX);
        if (tFit < 2.5 && baseX + offsetX > 48) offsetX = -Math.abs(offsetX);
        if (bFit >= 2.5 && baseY + offsetY > 48) offsetY = -Math.abs(offsetY);
        if (bFit < 2.5 && baseY + offsetY < 52) offsetY = Math.abs(offsetY);
      }

      const posX = Math.max(minX, Math.min(maxX, baseX + offsetX));
      const posY = Math.max(minY, Math.min(maxY, baseY + offsetY));

      const quadrant = app.computed_time_quadrant || app.apm_time_quadrant_override || (
        bFit >= 2.5 && tFit >= 2.5 ? 'Invest' :
        bFit >= 2.5 && tFit < 2.5 ? 'Tolerate' :
        bFit < 2.5 && tFit >= 2.5 ? 'Migrate' : 'Eliminate'
      );

      const shortName = app.apm_short_name || (app.name ? app.name.slice(0, 12) : 'App');
      const appCode = app.apm_app_code || 'AP0000';

      return {
        app,
        posX,
        posY,
        radius,
        diameter: radius * 2,
        quadrant,
        shortName,
        appCode,
        cost,
        bFit,
        tFit
      };
    });
  }, [viewData?.rows]);

  // TIME Matrix Summary
  const timeSummary = useMemo(() => {
    if (!viewData || !viewData.rows) return null;
    const counts = { Invest: 0, Tolerate: 0, Migrate: 0, Eliminate: 0 };
    const costs = { Invest: 0, Tolerate: 0, Migrate: 0, Eliminate: 0 };

    for (const r of viewData.rows) {
      const q = (r.computed_time_quadrant || r.apm_time_quadrant_override || 'Invest') as keyof typeof counts;
      if (counts[q] !== undefined) {
        counts[q] += 1;
        costs[q] += Number(r.apm_annual_cost) || 0;
      }
    }
    return { counts, costs };
  }, [viewData]);

  // Lifecycle Roadmap Summary (Vista A)
  const lifecycleSummary = useMemo(() => {
    if (!viewData || !viewData.rows || selectedView?.view_key !== 'apm_lifecycle_roadmap') return null;
    const counts: Record<string, number> = {
      Plan: 0,
      'Phase In': 0,
      Live: 0,
      'Phase Out': 0,
      Retired: 0
    };
    let riskCount = 0;

    for (const r of viewData.rows) {
      const st = r.apm_lifecycle_status || 'Live';
      if (counts[st] !== undefined) {
        counts[st] += 1;
      }
      if (r.obsolescence_risk && r.obsolescence_risk !== 'Stabile / Manutenuta') {
        riskCount += 1;
      }
    }
    return { counts, riskCount };
  }, [viewData, selectedView]);

  // Element Detail View State (takes full table area)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [elementDetail, setElementDetail] = useState<any | null>(null);
  const [activeSectionTab, setActiveSectionTab] = useState<string>('');
  const [copiedId, setCopiedId] = useState(false);
  const [previewSchema, setPreviewSchema] = useState<ArchiSchema | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreviewSchema = async (schemaId: string) => {
    setPreviewLoading(true);
    try {
      const sDetail = await api.getSchemaDetail(schemaId);
      setPreviewSchema(sDetail);
    } catch (err: any) {
      console.error('Failed to load schema preview', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Horizontal scrolling for section tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const scrollAmount = 260;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(checkScroll, 320);
  };

  // Metamodel Layers for sections & attributes lookup
  const [metamodelLayers, setMetamodelLayers] = useState<MetamodelLayer[]>([]);
  const [loadingMetamodel, setLoadingMetamodel] = useState(false);

  const loadMetamodel = async () => {
    if (!modelId) return;
    setLoadingMetamodel(true);
    try {
      const layers = await api.getMetamodelTypes(modelId);
      setMetamodelLayers(layers || []);
    } catch (err) {
      console.warn('Failed to load metamodel types:', err);
    } finally {
      setLoadingMetamodel(false);
    }
  };

  useEffect(() => {
    loadMetamodel();
  }, [modelId]);

  const handleOpenElementDetail = async (elementId: string) => {
    setSelectedElementId(elementId);
    setLoadingDetail(true);
    setElementDetail(null);
    try {
      const detail = await api.getElementDetail(elementId);
      setElementDetail(detail);
    } catch (err: any) {
      console.error('Failed to load element detail', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedElementId(null);
    setElementDetail(null);
    setActiveSectionTab('');
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Load catalog if not provided via props
  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    setError(null);
    try {
      const res = await api.getPackageViews(modelId);
      setPackages(res.packages || []);
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero delle viste dei pacchetti');
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    if (initialPackages && initialPackages.length > 0) {
      setPackages(initialPackages);
    } else if (modelId) {
      fetchCatalog();
    }
  }, [modelId, initialPackages]);

  // Synchronize with activePackageView prop
  useEffect(() => {
    if (!packages || packages.length === 0) return;

    if (activePackageView) {
      const pkg = packages.find(
        (p) => p.id === activePackageView.packageId || p.code === activePackageView.packageId
      );
      if (pkg) {
        const view = pkg.views.find(
          (v) => v.id === activePackageView.viewId || v.view_key === activePackageView.viewId
        );
        if (view) {
          setSelectedPackage(pkg);
          setSelectedView(view);
          setSearchQuery('');
          setFacetFilters({});
          setSortField(null);
          setSortDir('asc');
          handleCloseDetail();
          return;
        }
      }
    }

    // Fallback: auto-select first available view if none chosen
    if (!selectedView) {
      for (const p of packages) {
        if (p.views && p.views.length > 0) {
          setSelectedPackage(p);
          setSelectedView(p.views[0]);
          handleCloseDetail();
          break;
        }
      }
    }
  }, [activePackageView, packages]);

  // Execute selected view
  const executeView = async (view: PackageViewSummary) => {
    setLoadingData(true);
    setError(null);
    try {
      const res = await api.executePackageView(view.id, modelId, {
        search: searchQuery,
        filters: facetFilters,
        sort_field: sortField || undefined,
        sort_direction: sortDir
      });
      setViewData(res);
    } catch (err: any) {
      setError(err.message || 'Error processing view');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (selectedView) {
      executeView(selectedView);
    }
  }, [selectedView, searchQuery, facetFilters, sortField, sortDir]);

  const handleSelectView = (pkg: PackageWithViews, view: PackageViewSummary) => {
    handleCloseDetail();
    if (onSelectPackageView) {
      onSelectPackageView(pkg.id, view.id);
    } else {
      setSelectedPackage(pkg);
      setSelectedView(view);
      setSearchQuery('');
      setFacetFilters({});
      setSortField(null);
      setSortDir('asc');
    }
  };

  const handleFacetChange = (field: string, val: string) => {
    setFacetFilters((prev) => {
      const next = { ...prev };
      if (!val) {
        delete next[field];
      } else {
        next[field] = val;
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setFacetFilters({});
    setSortField(null);
    setSortDir('asc');
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExportCsv = () => {
    if (!viewData || !viewData.rows || viewData.rows.length === 0) return;

    const columns = viewData.columns || [
      { field: 'name', label: 'Nome' },
      { field: 'type', label: 'Tipo' },
      { field: 'layer', label: 'Layer' }
    ];

    const headers = columns.map((c) => `"${(c.label || c.field).replace(/"/g, '""')}"`).join(';');
    const rows = viewData.rows.map((row) =>
      columns.map((c) => `"${String(row[c.field] ?? '').replace(/"/g, '""')}"`).join(';')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${viewData.view_key || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getViewIcon = (iconName?: string, viewType?: string) => {
    if (viewType === 'kpi_dashboard') return BarChart3;
    if (viewType === 'matrix') return Grid;
    if (iconName === 'Building2') return Building2;
    if (iconName === 'Workflow') return Workflow;
    if (iconName === 'Server') return Server;
    if (iconName === 'Sparkles') return Sparkles;
    if (iconName === 'Package') return Package;
    if (iconName === 'Database') return Database;
    if (iconName === 'Layers') return Layers;
    if (iconName === 'ShieldAlert') return ShieldAlert;
    if (iconName === 'PieChart') return PieChart;
    if (iconName === 'Clock') return Clock;
    return TableIcon;
  };

  const getColorClasses = (colorName?: string) => {
    switch (colorName) {
      case 'emerald': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'purple': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'blue': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'amber': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'indigo': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getLayerColor = (layer?: string) => {
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

  const getStereotypeBadgeClass = (color?: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'purple': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'emerald': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'teal': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'cyan': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  // Group all attributes for the inspected element by sections defined in Admin / Metamodel
  const { sections, allSectionsList } = useMemo(() => {
    if (!elementDetail) {
      return { sections: {} as Record<string, CustomAttributeDefinition[]>, allSectionsList: [] as string[] };
    }

    const isEasyModel = Boolean(
      modelId && (modelId === 'sample-easybank-ea' || modelId.toLowerCase().includes('easy'))
    );
    const isEasyApp = isEasyModel && elementDetail.type === 'ApplicationComponent';

    const typeInfo = metamodelLayers
      .flatMap((l) => l.element_types || [])
      .find((et) => et.type === elementDetail.type);

    const st = elementDetail.stereotype_id
      ? typeInfo?.stereotypes?.find((s) => s.id === elementDetail.stereotype_id)
      : undefined;

    const linkMap = new Map((st?.attribute_links || []).map((l) => [l.attribute_name, l]));

    const sectionsMap: Record<string, CustomAttributeDefinition[]> = {};
    const processedAttrNames = new Set<string>();

    if (isEasyApp) {
      const genericAttrs: CustomAttributeDefinition[] = [];
      const apmAttrs: CustomAttributeDefinition[] = [];
      const resilienceAttrs: CustomAttributeDefinition[] = [];
      const otherPackageAttrs: Record<string, CustomAttributeDefinition[]> = {};

      // 1. Standard / core attributes of ApplicationComponent
      const standardAttrs = typeInfo?.standard_attributes || [
        { name: 'id', label: 'Element ID', data_type: 'string', is_required: true, description: 'Unique ArchiMate identifier' },
        { name: 'name', label: 'Application Name', data_type: 'string', is_required: true, description: 'Name of the system or application' },
        { name: 'documentation', label: 'Documentation', data_type: 'text', is_required: false, description: 'Architectural summary and documentation' }
      ];

      standardAttrs.forEach((std) => {
        processedAttrNames.add(std.name);
        genericAttrs.push({
          id: std.name,
          name: std.name,
          label: std.label,
          description: std.description,
          element_type: 'ApplicationComponent',
          layer: 'Application',
          data_type: std.data_type || 'string',
          is_required: Boolean(std.is_required),
          section: 'Attributi Generici'
        });
      });

      // 2. Custom & Package attributes: split APM, Resilience, and Generic
      (typeInfo?.custom_attributes || []).forEach((attr) => {
        processedAttrNames.add(attr.name);
        const pkgCode = (attr.package_code || '').toUpperCase();
        const pkgId = (attr as any).package_id || '';
        const name = attr.name || '';
        const isResilience =
          pkgCode === 'RESILIENCE' ||
          pkgId === 'pkg-resilience' ||
          name.startsWith('app_rto') ||
          name.startsWith('app_rpo') ||
          name.startsWith('dr_') ||
          name.startsWith('app_sla') ||
          name.startsWith('infra_') ||
          name.startsWith('target_rto') ||
          name.startsWith('target_rpo') ||
          name.startsWith('target_sla') ||
          name.startsWith('resilience_') ||
          name.startsWith('dora_');

        const isApm =
          !isResilience &&
          (pkgCode === 'APM' || pkgId === 'pkg-apm' || name.startsWith('apm_'));

        if (isResilience) {
          resilienceAttrs.push({
            ...attr,
            section: 'Package Resilience'
          });
        } else if (isApm) {
          apmAttrs.push({
            ...attr,
            section: 'Package APM'
          });
        } else if (attr.is_package && attr.package_code) {
          const sec = `Package ${pkgCode}`;
          if (!otherPackageAttrs[sec]) otherPackageAttrs[sec] = [];
          otherPackageAttrs[sec].push({
            ...attr,
            section: sec
          });
        } else {
          genericAttrs.push({
            ...attr,
            section: 'Attributi Generici'
          });
        }
      });

      // 3. Extra properties in elementDetail.properties
      if (elementDetail.properties) {
        Object.entries(elementDetail.properties).forEach(([k, v]) => {
          if (!processedAttrNames.has(k)) {
            processedAttrNames.add(k);
            const matchedCol = viewData?.columns?.find((c) => c.field === k);
            const rawLabel = matchedCol?.label || k.replace(/^([a-z0-9]+)_/, '').replace(/_/g, ' ');
            const formattedLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
            const isResilience =
              k.startsWith('app_rto') ||
              k.startsWith('app_rpo') ||
              k.startsWith('dr_') ||
              k.startsWith('app_sla') ||
              k.startsWith('infra_') ||
              k.startsWith('target_rto') ||
              k.startsWith('target_rpo') ||
              k.startsWith('target_sla') ||
              k.startsWith('resilience_') ||
              k.startsWith('dora_');
            const isApm = !isResilience && k.startsWith('apm_');

            const targetSection = isResilience ? 'Package Resilience' : isApm ? 'Package APM' : 'Attributi Generici';
            const extraAttr: CustomAttributeDefinition = {
              id: k,
              name: k,
              label: formattedLabel,
              element_type: elementDetail.type,
              layer: elementDetail.layer,
              data_type: typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'string',
              is_required: false,
              section: targetSection
            };
            if (isResilience) {
              resilienceAttrs.push(extraAttr);
            } else if (isApm) {
              apmAttrs.push(extraAttr);
            } else {
              genericAttrs.push(extraAttr);
            }
          }
        });
      }

      const activeSections: string[] = [];
      if (genericAttrs.length > 0) {
        sectionsMap['Attributi Generici'] = genericAttrs;
        activeSections.push('Attributi Generici');
      }
      if (apmAttrs.length > 0) {
        sectionsMap['Package APM'] = apmAttrs;
        activeSections.push('Package APM');
      }
      if (resilienceAttrs.length > 0) {
        sectionsMap['Package Resilience'] = resilienceAttrs;
        activeSections.push('Package Resilience');
      }
      Object.keys(otherPackageAttrs).forEach((sec) => {
        if (otherPackageAttrs[sec].length > 0) {
          sectionsMap[sec] = otherPackageAttrs[sec];
          activeSections.push(sec);
        }
      });

      return {
        sections: sectionsMap,
        allSectionsList: activeSections
      };
    }

    (typeInfo?.custom_attributes || []).forEach((attr) => {
      processedAttrNames.add(attr.name);
      const link = linkMap.get(attr.name);
      const secName = (link?.section_override || attr.section || 'Attributi Personalizzati').trim() || 'Attributi Personalizzati';
      if (!sectionsMap[secName]) {
        sectionsMap[secName] = [];
      }
      if (!sectionsMap[secName].some((a) => a.name === attr.name)) {
        sectionsMap[secName].push(attr);
      }
    });

    // Check for any properties in elementDetail.properties not yet represented in any section
    const unmappedProps: CustomAttributeDefinition[] = [];
    if (elementDetail.properties) {
      Object.entries(elementDetail.properties).forEach(([k, v]) => {
        if (!processedAttrNames.has(k)) {
          const matchedCol = viewData?.columns?.find((c) => c.field === k);
          const rawLabel = matchedCol?.label || k.replace(/^([a-z0-9]+)_/, '').replace(/_/g, ' ');
          unmappedProps.push({
            id: k,
            name: k,
            label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
            element_type: elementDetail.type,
            layer: elementDetail.layer,
            data_type: typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : 'string',
            is_required: false,
            section: 'Altre Proprietà'
          });
        }
      });
    }

    if (unmappedProps.length > 0) {
      sectionsMap['Altre Proprietà'] = unmappedProps;
    }

    const allSections = Object.keys(sectionsMap);
    return { sections: sectionsMap, allSectionsList: allSections };
  }, [elementDetail, metamodelLayers, viewData, modelId]);

  // Set default active section tab
  useEffect(() => {
    if (allSectionsList.length > 0) {
      if (!activeSectionTab || (!sections[activeSectionTab] && activeSectionTab !== 'relazioni')) {
        setActiveSectionTab(allSectionsList[0]);
      }
    } else if (elementDetail) {
      setActiveSectionTab('relazioni');
    }
  }, [allSectionsList, activeSectionTab, elementDetail]);

  // Monitor scroll arrows visibility when tabs or element change
  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(checkScroll, 120);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [allSectionsList, activeSectionTab, elementDetail]);

  // Executive & Business-friendly attribute value formatting
  const renderAttributeValue = (attr: CustomAttributeDefinition, rawVal: any) => {
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return (
        <span className="text-slate-300 font-medium text-xs select-none">
          —
        </span>
      );
    }

    if (typeof rawVal === 'boolean' || attr.data_type === 'boolean') {
      const boolVal = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1';
      return boolVal ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3 text-emerald-600" />
          <span>Sì</span>
        </span>
      ) : (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
          No
        </span>
      );
    }

    if (typeof rawVal === 'object') {
      return (
        <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 p-2.5 rounded-xl overflow-x-auto max-h-32">
          {JSON.stringify(rawVal, null, 2)}
        </pre>
      );
    }

    const strVal = String(rawVal).trim();
    const lower = strVal.toLowerCase();

    // Critical / Mission Critical / High / Eliminate
    if (
      lower === 'mission critical' ||
      lower === 'alta' ||
      lower === 'high' ||
      lower === 'critica' ||
      lower === 'critical' ||
      lower === 'eliminate'
    ) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          {strVal}
        </span>
      );
    }

    // Active / Production / Invest / Good
    if (
      lower === 'in produzione' ||
      lower === 'active' ||
      lower === 'attivo' ||
      lower === 'invest' ||
      lower === 'live' ||
      lower === 'ottimo'
    ) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {strVal}
        </span>
      );
    }

    // Medium / Warning / Tolerate / Migrate / Deprecated
    if (
      lower === 'media' ||
      lower === 'medium' ||
      lower === 'warning' ||
      lower === 'tolerate' ||
      lower === 'migrate' ||
      lower === 'in dismissione' ||
      lower === 'legacy'
    ) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
          {strVal}
        </span>
      );
    }

    // Low / Draft / Planned
    if (
      lower === 'bassa' ||
      lower === 'low' ||
      lower === 'draft' ||
      lower === 'pianificato' ||
      lower === 'in valutazione'
    ) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
          {strVal}
        </span>
      );
    }

    // URL
    if (strVal.startsWith('http://') || strVal.startsWith('https://')) {
      return (
        <a
          href={strVal}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 underline font-semibold flex items-center gap-1 text-xs break-all"
        >
          <span>{strVal}</span>
          <ArrowRight className="w-3 h-3 shrink-0" />
        </a>
      );
    }

    // Currency / Financials
    if (
      !isNaN(Number(strVal)) &&
      (attr.name.includes('cost') ||
        attr.label.toLowerCase().includes('costo') ||
        attr.label.includes('€') ||
        attr.name.includes('tco'))
    ) {
      const num = Number(strVal);
      return (
        <span className="text-sm font-black text-slate-900 font-mono tracking-tight">
          € {num.toLocaleString('it-IT')}
        </span>
      );
    }

    // Standard business string / number
    return (
      <span className="text-xs font-bold text-slate-900 break-words">
        {strVal}
      </span>
    );
  };

  const totalRelations =
    (elementDetail?.outgoing_relations?.length || 0) +
    (elementDetail?.incoming_relations?.length || 0);

  const hasActiveFilters = searchQuery !== '' || Object.keys(facetFilters).length > 0;

  // If no packages with views are available
  if (!loadingCatalog && packages.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center shadow-sm max-w-2xl mx-auto my-8">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-extrabold text-slate-800 mb-1">{t.insights.noPackages}</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">{t.insights.noPackagesHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* FULL-WIDTH VIEW CONTAINER */}
      {selectedPackage && selectedView && (
        <div className="space-y-4">
          {/* If Element Detail is selected, display the full-width detail view taking the table space */}
          {selectedElementId ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Back to list & Breadcrumb Navigation Bar */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCloseDetail}
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer group"
                  >
                    <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
                    <span>{t.insights?.backToList || 'Torna alla tabella'}</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200" />

                  <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium overflow-hidden">
                    <span className="truncate max-w-[150px]">{selectedPackage.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="truncate max-w-[150px] text-slate-700 font-semibold">{selectedView.name}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="truncate max-w-[220px] text-indigo-700 font-bold">
                      {elementDetail?.name || 'Dettaglio Elemento'}
                    </span>
                  </div>
                </div>

                {elementDetail?.id && (
                  <button
                    onClick={() => handleCopyId(elementDetail.id)}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-600 transition cursor-pointer"
                    title={t.insights?.copyId || 'Copia ID'}
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-sans font-bold">{t.insights?.copiedId || 'Copiato!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">ID: {elementDetail.id.slice(0, 12)}...</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Element Header & Tabbed Sections Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
                {loadingDetail ? (
                  <div className="py-16 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span className="text-xs font-semibold">{t.common.loading}</span>
                  </div>
                ) : !elementDetail ? (
                  <div className="py-16 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <span className="text-xs font-semibold">Elemento non trovato</span>
                  </div>
                ) : (
                  <>
                    {/* Element Summary Header */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getLayerColor(elementDetail.layer)}`}>
                          {elementDetail.layer} • {elementDetail.type}
                        </span>

                        {elementDetail.stereotype && (
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono ${getStereotypeBadgeClass(elementDetail.stereotype.icon_color)}`}>
                            {elementDetail.stereotype.label || `«${elementDetail.stereotype.name}»`}
                          </span>
                        )}

                        {elementDetail.is_reference && (
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            {t.insights?.referenceElement || 'Elemento Standard di Riferimento'}
                          </span>
                        )}

                        {elementDetail.package_name && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            [{elementDetail.package_code || elementDetail.package_name}]
                          </span>
                        )}
                      </div>

                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                        {elementDetail.name}
                      </h2>

                      {/* Documentation */}
                      {elementDetail.documentation && (
                        <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-1 mt-2">
                          <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{t.insights?.documentation || 'Documentation & Description'}</span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {elementDetail.documentation}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* METAMODEL SECTION TABS BAR WITH ARROW CONTROLS */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="relative flex items-center gap-1.5">
                        {/* Left Scroll Arrow */}
                        {canScrollLeft && (
                          <button
                            type="button"
                            onClick={() => scrollTabs('left')}
                            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs transition shrink-0 cursor-pointer animate-in fade-in"
                            title="Scorri sezioni a sinistra"
                            aria-label="Scorri sezioni a sinistra"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}

                        {/* Scrollable Tabs Track - No Scrollbar */}
                        <div
                          ref={tabsContainerRef}
                          onScroll={checkScroll}
                          className="flex items-center space-x-1.5 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-1 w-full"
                        >
                          {allSectionsList.map((secName) => {
                            const count = sections[secName]?.length || 0;
                            const isActive = activeSectionTab === secName;
                            return (
                              <button
                                key={secName}
                                type="button"
                                onClick={() => setActiveSectionTab(secName)}
                                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                                  isActive
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                                <span>{secName}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    isActive ? 'bg-slate-800 text-indigo-300' : 'bg-white/80 text-slate-600 border border-slate-200/60'
                                  }`}
                                >
                                  {count}
                                </span>
                              </button>
                            );
                          })}

                          {/* Architecture Relationships Tab */}
                          <button
                            type="button"
                            onClick={() => setActiveSectionTab('relazioni')}
                            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                              activeSectionTab === 'relazioni'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <Share2 className={`w-3.5 h-3.5 ${activeSectionTab === 'relazioni' ? 'text-indigo-400' : 'text-slate-400'}`} />
                            <span>{t.insights?.relationsTab || 'Relazioni di Architettura'}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                activeSectionTab === 'relazioni' ? 'bg-slate-800 text-indigo-300' : 'bg-white/80 text-slate-600 border border-slate-200/60'
                              }`}
                            >
                              {totalRelations}
                            </span>
                          </button>
                        </div>

                        {/* Right Scroll Arrow */}
                        {canScrollRight && (
                          <button
                            type="button"
                            onClick={() => scrollTabs('right')}
                            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs transition shrink-0 cursor-pointer animate-in fade-in"
                            title="Scorri sezioni a destra"
                            aria-label="Scorri sezioni a destra"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ACTIVE TAB CONTENT */}
                    <div className="pt-2">
                      {activeSectionTab === 'relazioni' ? (
                        /* ARCHITECTURE RELATIONS */
                        <div className="space-y-6">
                          {/* Outgoing Relations */}
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-800 block">
                              {t.insights?.outgoingRelations || 'Relazioni in Uscita'} ({elementDetail.outgoing_relations?.length || 0})
                            </span>

                            {elementDetail.outgoing_relations && elementDetail.outgoing_relations.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {elementDetail.outgoing_relations.map((rel: any) => (
                                  <div
                                    key={rel.id}
                                    className="p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs flex items-center justify-between gap-3 shadow-2xs"
                                  >
                                    <div className="flex items-center space-x-2 min-w-0">
                                      <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shrink-0">
                                        {rel.type}
                                      </span>
                                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="font-bold text-slate-800 truncate" title={rel.target_name}>
                                        {rel.target_name || rel.target_id}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getLayerColor(rel.target_layer)}`}>
                                      {rel.target_type}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                {t.insights?.noOutgoingRelations || 'No outgoing relationships.'}
                              </div>
                            )}
                          </div>

                          {/* Incoming Relations */}
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-800 block">
                              {t.insights?.incomingRelations || 'Incoming Relationships'} ({elementDetail.incoming_relations?.length || 0})
                            </span>

                            {elementDetail.incoming_relations && elementDetail.incoming_relations.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {elementDetail.incoming_relations.map((rel: any) => (
                                  <div
                                    key={rel.id}
                                    className="p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-xs flex items-center justify-between gap-3 shadow-2xs"
                                  >
                                    <div className="flex items-center space-x-2 min-w-0">
                                      <span className="font-bold text-slate-800 truncate" title={rel.source_name}>
                                        {rel.source_name || rel.source_id}
                                      </span>
                                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded shrink-0">
                                        {rel.type}
                                      </span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getLayerColor(rel.source_layer)}`}>
                                      {rel.source_type}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                {t.insights?.noIncomingRelations || 'No incoming relationships.'}
                              </div>
                            )}
                          </div>

                          {/* Schemas and Views where this element is used */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <FolderGit2 className="w-3.5 h-3.5 text-purple-600" />
                              <span>{t.insights?.usedInSchemasTitle?.replace('{count}', String(elementDetail.used_in_schemas?.length || 0)) || `Schemi & Viste di Utilizzo (${elementDetail.used_in_schemas?.length || 0})`}</span>
                            </span>

                            {elementDetail.used_in_schemas && elementDetail.used_in_schemas.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {elementDetail.used_in_schemas.map((sItem: any) => (
                                  <div
                                    key={sItem.id}
                                    className="p-3 rounded-xl border border-purple-200/80 bg-purple-50/30 hover:bg-purple-50/70 text-xs flex items-center justify-between gap-3 shadow-2xs transition"
                                  >
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-bold text-slate-900 truncate max-w-xs" title={sItem.name}>
                                          {sItem.name}
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                          {sItem.current_version || 'v1.0'}
                                        </span>
                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                          sItem.format === 'drawio'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                          {sItem.format === 'drawio' ? '🎨 Draw.io' : '🏛️ Archi'}
                                        </span>
                                        {sItem.folder_name && (
                                          <span className="text-[10px] font-medium text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                                            📁 {sItem.folder_name}
                                          </span>
                                        )}
                                      </div>
                                      {sItem.documentation && (
                                        <p className="text-[11px] text-slate-500 line-clamp-1 italic">{sItem.documentation}</p>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handlePreviewSchema(sItem.id)}
                                      disabled={previewLoading}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-700 bg-white hover:bg-purple-100/70 border border-purple-200 transition flex items-center space-x-1 shrink-0 shadow-2xs cursor-pointer"
                                      title="Anteprima diagramma"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-purple-600" />
                                      <span>Anteprima</span>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                {t.insights?.noSchemasForElement || 'Questo elemento non è ancora inserito in alcuno schema o diagramma.'}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* BUSINESS ATTRIBUTES GRID FOR SELECTED SECTION */
                        <div className="space-y-3.5">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-extrabold text-slate-800">{activeSectionTab}</span>
                              <span className="text-[11px] text-slate-400 font-medium">
                                ({sections[activeSectionTab]?.length || 0} {t.insights?.attributesCountLabel || 'attributes'})
                              </span>
                            </div>
                          </div>

                          {(!sections[activeSectionTab] || sections[activeSectionTab].length === 0) ? (
                            <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                              {t.insights?.noAttributesInSection || 'Nessun attributo configurato per questa sezione.'}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {sections[activeSectionTab].map((attr) => {
                                const rawVal =
                                  elementDetail.properties?.[attr.name] !== undefined
                                    ? elementDetail.properties[attr.name]
                                    : (elementDetail as any)[attr.name];
                                return (
                                  <div
                                    key={attr.id || attr.name}
                                    className="bg-slate-50/70 hover:bg-white border border-slate-200/70 hover:border-slate-300 rounded-xl p-3.5 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between space-y-1.5"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span
                                        className="text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-snug truncate"
                                        title={attr.label}
                                      >
                                        {attr.label}
                                      </span>

                                      {attr.description && (
                                        <div className="relative group/tip shrink-0">
                                          <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition cursor-help" />
                                          <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover/tip:block w-48 p-2 bg-slate-900 text-white text-[10px] rounded-lg shadow-lg z-30 pointer-events-none leading-relaxed">
                                            {attr.description}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="pt-0.5">
                                      {renderAttributeValue(attr, rawVal)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* NORMAL VIEW: HEADER, FILTERS & TABLE/DASHBOARD */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* VIEW HEADER & BREADCRUMB */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="min-w-0">
                    {/* Breadcrumbs & Package badge */}
                    <div className="flex items-center gap-2 mb-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-slate-500">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pacchetti</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${getColorClasses(selectedPackage.icon_color)}`}>
                        {selectedPackage.name}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                      <span className="font-bold text-slate-600">{selectedView.category}</span>
                    </div>

                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                      {React.createElement(getViewIcon(selectedView.icon, selectedView.view_type), {
                        className: 'w-5 h-5 text-indigo-600'
                      })}
                      <span>{selectedView.name}</span>
                    </h2>

                    {selectedView.description && (
                      <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                        {selectedView.description}
                      </p>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {(selectedView.view_type === 'matrix' || selectedView.view_key === 'apm_time_matrix') && (
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        {isTimeMatrix ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setMatrixViewMode('bubble')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                matrixViewMode === 'bubble'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Visualizzazione cartesiana 2x2 a bolle proporzionali al TCO"
                            >
                              <CircleDot className="w-3.5 h-3.5" />
                              <span>Matrice a Bolle</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMatrixViewMode('cards')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                matrixViewMode === 'cards'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Visualizzazione classica a schede nei 4 quadranti"
                            >
                              <LayoutGrid className="w-3.5 h-3.5" />
                              <span>Quadranti</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMatrixViewMode('table')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                matrixViewMode === 'table'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Elenco tabellare con filtri e ordinamento"
                            >
                              <TableIcon className="w-3.5 h-3.5" />
                              <span>Tabella</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setMatrixViewMode('pivot')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                matrixViewMode === 'pivot'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Griglia pivot bidimensionale di incrocio dati"
                            >
                              <Grid className="w-3.5 h-3.5" />
                              <span>Matrice Pivot 2D</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMatrixViewMode('table')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                matrixViewMode === 'table'
                                  ? 'bg-white text-indigo-700 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                              title="Elenco tabellare con filtri e ordinamento"
                            >
                              <TableIcon className="w-3.5 h-3.5" />
                              <span>Tabella</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleExportCsv}
                      disabled={!viewData || (viewData.rows && viewData.rows.length === 0)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{t.insights.exportCsv}</span>
                    </button>
                  </div>
                </div>

                {/* RUNTIME FACET FILTERS BAR */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                  {/* Search box */}
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={t.insights.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>

                  {/* Dynamic Faceted Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {viewData?.facet_options && Object.entries(viewData.facet_options).map(([field, options]) => {
                      const matchedCol = viewData.columns?.find((c) => c.field === field);
                      const fieldLabel = matchedCol?.label || field.replace(/_/g, ' ');

                      return (
                        <div key={field} className="relative">
                          <select
                            value={facetFilters[field] || ''}
                            onChange={(e) => handleFacetChange(field, e.target.value)}
                            className={`text-xs font-semibold py-1.5 pl-3 pr-8 rounded-xl border transition appearance-none cursor-pointer ${
                              facetFilters[field]
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <option value="">{fieldLabel}: {t.insights.allFilter}</option>
                            {options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <ChevronRight className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                        </div>
                      );
                    })}

                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition flex items-center gap-1 font-semibold cursor-pointer"
                        title={t.insights.resetFilters}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t.insights.resetFilters}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* DATA VIEW AREA */}
              {loadingData ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                  <p className="text-xs font-semibold text-slate-600">{t.common.loading}</p>
                </div>
              ) : error ? (
                <div className="bg-rose-50 rounded-2xl border border-rose-200 p-6 text-center text-rose-800 space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto text-rose-600" />
                  <p className="text-xs font-bold">{error}</p>
                  <button
                    onClick={() => selectedView && executeView(selectedView)}
                    className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    {t.common.retry}
                  </button>
                </div>
              ) : !viewData || !viewData.rows || viewData.rows.length === 0 ? (
                selectedView?.view_key === 'archimate_undocumented_audit' ? (
                  <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-12 text-center shadow-xs space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-emerald-950">{t.insights.noUndocumentedElementsTitle}</h4>
                    <p className="text-xs text-emerald-700 max-w-md mx-auto">
                      {t.insights.noUndocumentedElementsDesc}
                    </p>
                  </div>
                ) : selectedView?.view_key === 'archimate_orphan_audit' ? (
                  <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-12 text-center shadow-xs space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-emerald-950">{t.insights.noOrphanElementsTitle}</h4>
                    <p className="text-xs text-emerald-700 max-w-md mx-auto">
                      {t.insights.noOrphanElementsDesc}
                    </p>
                  </div>
                ) : selectedView?.target_stereotypes && selectedView.target_stereotypes.length > 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm space-y-2">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-amber-500">
                      <Tag className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">{t.insights.noMatchingElements}</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {t.insights.noMatchingElementsHint}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-sm space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <TableIcon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">{t.insights.noFilteredElementsTitle}</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {t.insights.noFilteredElementsDesc}
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {/* LIFECYCLE ROADMAP PIPELINE OVERVIEW (VISTA A) */}
                  {selectedView.view_key === 'apm_lifecycle_roadmap' && lifecycleSummary && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Clock className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            Pipeline Ciclo di Vita Applicativo (LeanIX / TOGAF)
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Monitoraggio dell'avanzamento dal piano alla produzione fino alla dismissione.
                          </p>
                        </div>
                      </div>

                      {lifecycleSummary.riskCount > 0 && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs self-start sm:self-auto">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>{lifecycleSummary.riskCount} con debito o dismissione pianificata</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Plan</span>
                        <div className="text-lg font-black text-slate-800 mt-0.5">{lifecycleSummary.counts.Plan || 0}</div>
                        <span className="text-[10px] text-slate-400">Pianificazione</span>
                      </div>
                      <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Phase In</span>
                        <div className="text-lg font-black text-purple-900 mt-0.5">{lifecycleSummary.counts['Phase In'] || 0}</div>
                        <span className="text-[10px] text-purple-600">Rollout / Pilot</span>
                      </div>
                      <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Live</span>
                        <div className="text-lg font-black text-emerald-900 mt-0.5">{lifecycleSummary.counts.Live || 0}</div>
                        <span className="text-[10px] text-emerald-600">In Produzione</span>
                      </div>
                      <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Phase Out</span>
                        <div className="text-lg font-black text-amber-900 mt-0.5">{lifecycleSummary.counts['Phase Out'] || 0}</div>
                        <span className="text-[10px] text-amber-700">In Dismissione</span>
                      </div>
                      <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Retired</span>
                        <div className="text-lg font-black text-slate-900 mt-0.5">{lifecycleSummary.counts.Retired || 0}</div>
                        <span className="text-[10px] text-slate-500">Dismesse / Spente</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* GARTNER TIME 2X2 VISUAL MATRIX (VISTA B) */}
                {(selectedView.view_type === 'matrix' || selectedView.view_key === 'apm_time_matrix') && isTimeMatrix && (matrixViewMode === 'bubble' || matrixViewMode === 'cards') && viewData?.rows && viewData.rows.length > 0 ? (
                  <div className="space-y-4">
                    {/* Summary 4 Quadrants Cards */}
                    {timeSummary && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">Invest (Investi)</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          </div>
                          <div className="mt-2 text-2xl font-black text-emerald-950">{timeSummary.counts.Invest} app</div>
                          <div className="text-xs font-bold text-emerald-700 font-mono mt-0.5">{formatEUR(timeSummary.costs.Invest)}</div>
                          <p className="text-[11px] text-emerald-800/80 mt-1">Alto Business & Tech Fit</p>
                        </div>

                        <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800">Tolerate (Mantieni)</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          </div>
                          <div className="mt-2 text-2xl font-black text-blue-950">{timeSummary.counts.Tolerate} app</div>
                          <div className="text-xs font-bold text-blue-700 font-mono mt-0.5">{formatEUR(timeSummary.costs.Tolerate)}</div>
                          <p className="text-[11px] text-blue-800/80 mt-1">Alto Business, Basso Tech Fit</p>
                        </div>

                        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">Migrate (Riorganizza)</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          </div>
                          <div className="mt-2 text-2xl font-black text-amber-950">{timeSummary.counts.Migrate} app</div>
                          <div className="text-xs font-bold text-amber-700 font-mono mt-0.5">{formatEUR(timeSummary.costs.Migrate)}</div>
                          <p className="text-[11px] text-amber-800/80 mt-1">Basso Business, Alto Tech Fit</p>
                        </div>

                        <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">Eliminate (Dismetti)</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                          </div>
                          <div className="mt-2 text-2xl font-black text-rose-950">{timeSummary.counts.Eliminate} app</div>
                          <div className="text-xs font-bold text-rose-700 font-mono mt-0.5">{formatEUR(timeSummary.costs.Eliminate)}</div>
                          <p className="text-[11px] text-rose-800/80 mt-1">Basso Business & Tech Fit</p>
                        </div>
                      </div>
                    )}

                    {/* VISTA 1: MATRICE A BOLLE 2X2 (SCATTER BUBBLE CHART) */}
                    {matrixViewMode === 'bubble' ? (
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                              <CircleDot className="w-4 h-4 text-indigo-600" />
                              <span>Matrice Cartesiana a Bolle 2x2 (Gartner TIME)</span>
                            </h3>
                            <p className="text-xs text-slate-500">
                              Ogni pallino posizionato all'incrocio di <strong>Technical Fit</strong> (X) e <strong>Business Fit</strong> (Y), con raggio proporzionale al <strong>TCO</strong> e <strong>Nome Breve</strong> all'interno.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                            <span className="font-semibold text-slate-700">Dimensione Bolla:</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Basso TCO</span>
                            <span className="text-slate-300">➔</span>
                            <span className="flex items-center gap-1"><span className="w-4.5 h-4.5 rounded-full bg-slate-700 inline-block" /> Alto TCO</span>
                          </div>
                        </div>

                        {/* Scatter Plot with External Axis Labels */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-stretch gap-2.5">
                            {/* Y-Axis Label Area (Appena a SINISTRA del grafico) */}
                            <div className="w-10 sm:w-12 shrink-0 flex flex-col items-center justify-between py-6 select-none bg-slate-50/80 border border-slate-200/90 rounded-2xl">
                              <div className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Massimo (4.0)">
                                4.0
                              </div>
                              <div className="-rotate-90 whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded-full shadow-xs">
                                ▲ BUSINESS FIT
                              </div>
                              <div className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Minimo (1.0)">
                                1.0
                              </div>
                            </div>

                            {/* Chart Canvas Area */}
                            <div className="relative flex-1 h-[660px] bg-slate-900/[0.02] border-2 border-slate-200/90 rounded-2xl overflow-hidden select-none">
                              {/* 4 Quadrants Background Areas */}
                              {/* Top-Left: TOLERATE */}
                              <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-r-2 border-b-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-wider text-blue-900 bg-blue-100/90 border border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs">
                                    TOLERATE (Mantieni / Tolleranza)
                                  </span>
                                  <span className="text-[11px] font-bold text-blue-700 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200 font-mono">
                                    {timeSummary?.counts.Tolerate || 0} app
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold text-blue-800/60 max-w-[200px]">
                                  Alto valore funzionale per il business, architettura o tecnologia da manutenere
                                </div>
                              </div>

                              {/* Top-Right: INVEST */}
                              <div className="absolute top-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-bl from-emerald-500/10 via-emerald-500/5 to-transparent border-b-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-2xs">
                                    INVEST (Investi / Strategiche)
                                  </span>
                                  <span className="text-[11px] font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                                    {timeSummary?.counts.Invest || 0} app
                                  </span>
                                </div>
                                <div className="text-[11px] font-semibold text-emerald-800/60 max-w-[200px] text-right ml-auto">
                                  Eccellente allineamento di business e architettura cloud native / standard moderno
                                </div>
                              </div>

                              {/* Bottom-Left: ELIMINATE */}
                              <div className="absolute top-1/2 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-rose-500/10 via-rose-500/5 to-transparent border-r-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                                <div className="text-[11px] font-semibold text-rose-800/60 max-w-[200px]">
                                  Basso valore di business e tecnologia obsoleta o con alto debito tecnico
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-wider text-rose-900 bg-rose-100/90 border border-rose-300 px-2.5 py-1 rounded-lg shadow-2xs">
                                    ELIMINATE (Dismetti / Decommission)
                                  </span>
                                  <span className="text-[11px] font-bold text-rose-700 bg-white/80 px-2 py-0.5 rounded-md border border-rose-200 font-mono">
                                    {timeSummary?.counts.Eliminate || 0} app
                                  </span>
                                </div>
                              </div>

                              {/* Bottom-Right: MIGRATE */}
                              <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-gradient-to-tl from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col justify-between">
                                <div className="text-[11px] font-semibold text-amber-800/60 max-w-[200px] text-right ml-auto">
                                  Buona tecnologia ma basso valore percepito: razionalizzare, consolidare o migrare
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
                                    MIGRATE (Riorganizza / Consolida)
                                  </span>
                                  <span className="text-[11px] font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded-md border border-amber-200 font-mono">
                                    {timeSummary?.counts.Migrate || 0} app
                                  </span>
                                </div>
                              </div>

                              {/* Center Origin Threshold Marker */}
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-lg z-30 border border-slate-600">
                                Soglia 2.5
                              </div>

                              {/* Bubble Elements */}
                              {bubbleApps.map((b) => (
                            <div
                              key={b.app.id}
                              className="absolute group z-20 hover:z-50 transition-all duration-200"
                              style={{
                                left: `${b.posX}%`,
                                top: `${b.posY}%`,
                                transform: 'translate(-50%, -50%)'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleOpenElementDetail(b.app.id)}
                                className={`rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-200 transform group-hover:scale-115 group-hover:shadow-xl focus:outline-none focus:ring-4 ${
                                  b.quadrant === 'Invest'
                                    ? 'bg-emerald-600/95 hover:bg-emerald-500 text-white border-2 border-emerald-300 shadow-md ring-2 ring-emerald-500/30'
                                    : b.quadrant === 'Tolerate'
                                    ? 'bg-blue-600/95 hover:bg-blue-500 text-white border-2 border-blue-300 shadow-md ring-2 ring-blue-500/30'
                                    : b.quadrant === 'Migrate'
                                    ? 'bg-amber-500/95 hover:bg-amber-400 text-slate-950 font-black border-2 border-amber-200 shadow-md ring-2 ring-amber-500/30'
                                    : 'bg-rose-600/95 hover:bg-rose-500 text-white border-2 border-rose-300 shadow-md ring-2 ring-rose-500/30'
                                }`}
                                style={{
                                  width: `${b.diameter}px`,
                                  height: `${b.diameter}px`
                                }}
                                aria-label={`${b.shortName} (${b.appCode})`}
                              >
                                <span className="font-extrabold text-[10px] leading-tight px-1 text-center truncate max-w-full select-none">
                                  {b.shortName}
                                </span>
                                {b.diameter >= 54 && (
                                  <span className="text-[9px] font-mono opacity-85 mt-0.5 select-none font-bold">
                                    {formatCompactEUR(b.cost)}
                                  </span>
                                )}
                              </button>

                              {/* Rich Hover Floating Tooltip */}
                              <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-slate-950/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl z-50 min-w-[250px] max-w-[320px] pointer-events-none backdrop-blur-md">
                                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                                  <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                                    {b.appCode}
                                  </span>
                                  <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                    b.quadrant === 'Invest' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                    b.quadrant === 'Tolerate' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                                    b.quadrant === 'Migrate' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                    'bg-rose-950 text-rose-300 border border-rose-800'
                                  }`}>
                                    {b.quadrant}
                                  </span>
                                </div>
                                <div className="text-xs font-black text-slate-100 leading-snug">{b.app.name}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">Nome Breve: <span className="text-slate-200 font-bold">{b.shortName}</span></div>
                                <div className="mt-2 space-y-1 text-[11px] border-t border-slate-800/80 pt-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">TCO Annuo:</span>
                                    <span className="font-mono font-bold text-amber-300">{formatEUR(b.cost)}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Business Fit:</span>
                                    <span className="font-bold text-slate-200">{b.bFit} / 4</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Technical Fit:</span>
                                    <span className="font-bold text-slate-200">{b.tFit} / 4</span>
                                  </div>
                                  {b.app.apm_business_owner && (
                                    <div className="text-[10px] text-slate-400 truncate pt-1 border-t border-slate-900">
                                      Owner: {b.app.apm_business_owner}
                                    </div>
                                  )}
                                  {b.app.apm_vendor && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                      Vendor: {b.app.apm_vendor}
                                    </div>
                                  )}
                                </div>
                                <div className="text-[9px] text-indigo-300/90 mt-2 text-center italic">
                                  Fai clic per aprire la scheda di dettaglio
                                </div>
                              </div>
                            </div>
                          ))}
                            </div>
                          </div>

                          {/* X-Axis Label Area (Appena SOTTO il grafico) */}
                          <div className="flex items-center justify-between pl-12 sm:pl-14 pr-4 py-2 select-none bg-slate-50/80 border border-slate-200/90 rounded-2xl">
                            <div className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Minimo (1.0)">
                              1.0 Obsoleto
                            </div>
                            <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 bg-white border border-slate-300 px-4 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                              <span>TECHNICAL FIT (Qualità Architetturale & Tecnologia)</span>
                              <span className="text-slate-400">►</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Massimo (4.0)">
                              4.0 Cloud Native
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* VISTA 2: QUADRANTI A SCHEDE (CARDS) */
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Vista a Quadranti TIME (Elenco Schede)
                            </h3>
                            <p className="text-xs text-slate-500">
                              Fai clic su un'applicazione per aprire la scheda di dettaglio completa.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Top-Left: TOLERATE */}
                          <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 mb-2">
                              <span className="text-xs font-black text-blue-900">TOLERATE (Mantieni / Tolleranza)</span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-mono">
                                {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Tolerate').length} app
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                              {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Tolerate').map((app: any) => (
                                <button
                                  key={app.id}
                                  onClick={() => handleOpenElementDetail(app.id)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                                  title={`[${app.apm_app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.apm_annual_cost)}`}
                                >
                                  <span className="font-mono text-[10px] opacity-80">[{app.apm_app_code || 'AP0000'}]</span>
                                  <span>{app.apm_short_name || app.name}</span>
                                  <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.apm_annual_cost)})</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Top-Right: INVEST */}
                          <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 mb-2">
                              <span className="text-xs font-black text-emerald-900">INVEST (Investi / Strategiche)</span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                                {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Invest').length} app
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                              {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Invest').map((app: any) => (
                                <button
                                  key={app.id}
                                  onClick={() => handleOpenElementDetail(app.id)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                                  title={`[${app.apm_app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.apm_annual_cost)}`}
                                >
                                  <span className="font-mono text-[10px] opacity-80">[{app.apm_app_code || 'AP0000'}]</span>
                                  <span>{app.apm_short_name || app.name}</span>
                                  <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.apm_annual_cost)})</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Bottom-Left: ELIMINATE */}
                          <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 mb-2">
                              <span className="text-xs font-black text-rose-900">ELIMINATE (Dismetti / Decommission)</span>
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-mono">
                                {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Eliminate').length} app
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                              {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Eliminate').map((app: any) => (
                                <button
                                  key={app.id}
                                  onClick={() => handleOpenElementDetail(app.id)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                                  title={`[${app.apm_app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.apm_annual_cost)}`}
                                >
                                  <span className="font-mono text-[10px] opacity-80">[{app.apm_app_code || 'AP0000'}]</span>
                                  <span>{app.apm_short_name || app.name}</span>
                                  <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.apm_annual_cost)})</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Bottom-Right: MIGRATE */}
                          <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 mb-2">
                              <span className="text-xs font-black text-amber-900">MIGRATE (Riorganizza / Consolida)</span>
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-mono">
                                {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Migrate').length} app
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                              {viewData.rows.filter((r: any) => (r.computed_time_quadrant || r.apm_time_quadrant_override) === 'Migrate').map((app: any) => (
                                <button
                                  key={app.id}
                                  onClick={() => handleOpenElementDetail(app.id)}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs border border-amber-600 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                                  title={`[${app.apm_app_code || 'AP0000'}] ${app.name} • TCO: ${formatEUR(app.apm_annual_cost)}`}
                                >
                                  <span className="font-mono text-[10px] opacity-80">[{app.apm_app_code || 'AP0000'}]</span>
                                  <span>{app.apm_short_name || app.name}</span>
                                  <span className="text-[10px] opacity-90 font-mono">({formatCompactEUR(app.apm_annual_cost)})</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (selectedView.view_type === 'matrix' && !isTimeMatrix && matrixViewMode !== 'table') ? (
                  /* GENERIC 2D PIVOT MATRIX VIEW */
                  (() => {
                    const matrixCfg = (viewData?.config?.matrix || (selectedView as any)?.config?.matrix) || {};
                    const matrixXField = matrixCfg.x_axis?.field || 'layer';
                    const matrixXLabel = matrixCfg.x_axis?.label || matrixCfg.x_axis?.field || 'Dimensione X';
                    const matrixYField = matrixCfg.y_axis?.field || 'type';
                    const matrixYLabel = matrixCfg.y_axis?.label || matrixCfg.y_axis?.field || 'Dimensione Y';

                    const grid = (viewData?.matrix_summary?.grid || {}) as Record<string, Record<string, number>>;
                    const rowKeys = Object.keys(grid).sort();
                    const colKeys = Array.from(new Set(rowKeys.flatMap((rk) => Object.keys(grid[rk])))).sort();

                    const colTotals: Record<string, number> = {};
                    const rowTotals: Record<string, number> = {};
                    let grandTotal = 0;

                    rowKeys.forEach((rk) => {
                      let rowSum = 0;
                      colKeys.forEach((ck) => {
                        const val = grid[rk]?.[ck] || 0;
                        rowSum += val;
                        colTotals[ck] = (colTotals[ck] || 0) + val;
                      });
                      rowTotals[rk] = rowSum;
                      grandTotal += rowSum;
                    });

                    return (
                      <div className="space-y-4">
                        {/* Matrix Header Banner */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Grid className="w-4 h-4" />
                              </span>
                              <h3 className="text-sm font-extrabold text-slate-900">
                                Matrice Pivot 2D: {matrixYLabel} × {matrixXLabel}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Incrocio bidimensionale e distribuzione degli elementi del modello ArchiMate ({matrixYLabel} sulle righe, {matrixXLabel} sulle colonne).
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700">
                              <strong>{rowKeys.length}</strong> {matrixYLabel}
                            </span>
                            <span className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700">
                              <strong>{colKeys.length}</strong> {matrixXLabel}
                            </span>
                            <span className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-indigo-900 font-bold">
                              <strong>{grandTotal || viewData?.total || 0}</strong> Totale
                            </span>
                          </div>
                        </div>

                        {/* Matrix Table */}
                        {rowKeys.length === 0 ? (
                          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                              <Grid className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-extrabold text-slate-800">Nessun dato nella matrice</h4>
                            <p className="text-xs text-slate-500 max-w-md mx-auto">
                              Non sono stati trovati elementi nel modello che incrocino le dimensioni {matrixYLabel} e {matrixXLabel} con i filtri attuali.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="p-3.5 font-black text-slate-800 bg-slate-100 sticky left-0 z-10 select-none uppercase tracking-wider text-[11px] border-r border-slate-200">
                                      {matrixYLabel} \ {matrixXLabel}
                                    </th>
                                    {colKeys.map((ck) => (
                                      <th
                                        key={ck}
                                        className="p-3.5 font-bold text-indigo-900 bg-indigo-50/70 border-l border-slate-200 text-center whitespace-nowrap min-w-[110px]"
                                      >
                                        <div className="flex items-center justify-center gap-1.5">
                                          {matrixXField === 'layer' ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLayerColor(ck)}`}>
                                              {ck}
                                            </span>
                                          ) : (
                                            <span>{ck}</span>
                                          )}
                                        </div>
                                      </th>
                                    ))}
                                    <th className="p-3.5 font-black text-slate-900 bg-slate-100/90 border-l-2 border-slate-300 text-center uppercase tracking-wider text-[11px] min-w-[90px]">
                                      Totale Riga
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {rowKeys.map((rk) => (
                                    <tr key={rk} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="p-3.5 font-bold text-slate-800 bg-slate-50/60 sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          {matrixYField === 'layer' ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLayerColor(rk)}`}>
                                              {rk}
                                            </span>
                                          ) : (
                                            <span>{rk}</span>
                                          )}
                                        </div>
                                      </td>
                                      {colKeys.map((ck) => {
                                        const count = grid[rk]?.[ck] || 0;
                                        return (
                                          <td key={ck} className="p-3 border-l border-slate-100 text-center">
                                            {count > 0 ? (
                                              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-black text-xs shadow-2xs">
                                                {count}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 text-xs select-none">—</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                      <td className="p-3 border-l-2 border-slate-300 bg-slate-50/80 text-center font-mono font-black text-slate-900">
                                        {rowTotals[rk] || 0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-slate-300 bg-slate-100/90 font-black text-slate-900">
                                    <td className="p-3.5 sticky left-0 z-10 bg-slate-200/90 border-r border-slate-300 uppercase tracking-wider text-[11px]">
                                      Totale Colonne
                                    </td>
                                    {colKeys.map((ck) => (
                                      <td key={ck} className="p-3 border-l border-slate-200 text-center font-mono text-indigo-950 font-black bg-indigo-50/40">
                                        {colTotals[ck] || 0}
                                      </td>
                                    ))}
                                    <td className="p-3 border-l-2 border-slate-300 bg-indigo-600 text-white text-center font-mono font-black text-sm shadow-xs">
                                      {grandTotal}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (selectedView.view_type === 'kpi_dashboard' || viewData?.view_type === 'kpi_dashboard') ? (
                  /* DYNAMIC KPI DASHBOARD VIEW */
                  <div className="space-y-6">
                    {/* 1. Dynamic Top KPI Cards */}
                    {(() => {
                      const metrics = (viewData.metrics && viewData.metrics.length > 0)
                        ? viewData.metrics
                        : [
                            { id: 'total_elements', label: 'Totale Elementi', value: viewData.rows?.length ?? 0, type: 'count' }
                          ];

                      const getMetricIcon = (m: any) => {
                        const id = (m.id || '').toLowerCase();
                        const lbl = (m.label || '').toLowerCase();
                        if (id.includes('app') || lbl.includes('app')) return Building2;
                        if (id.includes('process') || lbl.includes('process') || id.includes('flow')) return Workflow;
                        if (id.includes('infra') || id.includes('node') || id.includes('server') || id.includes('device')) return Server;
                        if (id.includes('data') || lbl.includes('data')) return Database;
                        if (id.includes('cost') || id.includes('tco') || lbl.includes('€') || lbl.includes('tco') || id.includes('spend')) return Coins;
                        if (id.includes('critical') || id.includes('risk') || id.includes('audit')) return ShieldAlert;
                        if (id.includes('cloud')) return Cloud;
                        if (id.includes('layer')) return Layers;
                        return Sparkles;
                      };

                      const isCurrencyMetric = (m: any) => {
                        const lbl = (m.label || '').toLowerCase();
                        const id = (m.id || '').toLowerCase();
                        return m.type === 'sum' && (lbl.includes('€') || lbl.includes('cost') || lbl.includes('tco') || id.includes('cost') || id.includes('tco') || id.includes('spend'));
                      };

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {metrics.map((m: any, idx: number) => {
                            const IconComponent = getMetricIcon(m);
                            const isCurr = isCurrencyMetric(m);
                            const isTotalMetric = m.id === 'total_elements' || m.id === 'total_apps' || m.id === 'total_items';
                            const formattedVal = isCurr
                              ? formatEUR(m.value)
                              : (typeof m.value === 'number' ? m.value.toLocaleString() : (m.value ?? 0));

                            let subtitle = 'Elementi censiti nel modello';
                            if (isCurr) {
                              subtitle = 'Valore complessivo calcolato';
                            } else if (m.type === 'average') {
                              subtitle = 'Media per elemento';
                            } else if (m.type === 'count' && !isTotalMetric && viewData.rows && viewData.rows.length > 0) {
                              const pct = Math.round(((Number(m.value) || 0) / Math.max(1, viewData.rows.length)) * 100);
                              subtitle = `${pct}% sul totale analizzato`;
                            }

                            return (
                              <div
                                key={m.id || idx}
                                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate mr-2" title={m.label}>
                                    {m.label}
                                  </span>
                                  <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                                    <IconComponent className="w-4 h-4" />
                                  </span>
                                </div>
                                <div className="mt-3">
                                  <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono truncate" title={String(formattedVal)}>
                                    {formattedVal}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 truncate">
                                    {subtitle}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* 2. Dynamic Analytical Charts Grid */}
                    {(() => {
                      const charts = viewData.charts || [];
                      if (charts.length === 0) return null;

                      const colorPalette = [
                        'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
                        'bg-purple-500', 'bg-rose-500', 'bg-cyan-500', 'bg-teal-500', 'bg-slate-500'
                      ];

                      const getKnownColor = (lbl: string): string | null => {
                        switch (lbl) {
                          case 'Live': return 'bg-emerald-500';
                          case 'Phase Out': return 'bg-amber-500';
                          case 'Phase In': return 'bg-purple-500';
                          case 'Plan': return 'bg-blue-500';
                          case 'Retired': return 'bg-slate-400';
                          case 'Mission Critical': return 'bg-rose-500';
                          case 'Business Critical': return 'bg-amber-500';
                          case 'Business Operational': return 'bg-blue-500';
                          case 'Administrative': return 'bg-slate-400';
                          case 'Application': return 'bg-indigo-500';
                          case 'Business': return 'bg-amber-500';
                          case 'Technology': return 'bg-emerald-500';
                          case 'Motivation': return 'bg-purple-500';
                          case 'Strategy': return 'bg-rose-500';
                          default: return null;
                        }
                      };

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {charts.map((chart: any, cIdx: number) => {
                            const data = chart.data || [];
                            const isSumMetric = chart.metric === 'sum' || chart.title?.includes('€') || chart.title?.toLowerCase().includes('spend') || chart.title?.toLowerCase().includes('cost');
                            const total = isSumMetric
                              ? (data.reduce((acc: number, d: any) => acc + (Number(d.value) || 0), 0) || 1)
                              : (data.reduce((acc: number, d: any) => acc + (Number(d.count) || 0), 0) || 1);

                            return (
                              <div key={chart.id || cIdx} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                    {chart.type === 'pie' ? (
                                      <PieChart className="w-3.5 h-3.5 text-indigo-600" />
                                    ) : (
                                      <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                                    )}
                                    <span>{chart.title}</span>
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {chart.group_by ? `Raggruppato per: ${chart.group_by}` : (isSumMetric ? 'Somma Valori' : 'Distribuzione Conteggi')}
                                  </span>
                                </div>
                                <div className="space-y-2.5 pt-1">
                                  {data.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-400">Nessun dato registrato</div>
                                  ) : (
                                    data.map((item: any, iIdx: number) => {
                                      const valNum = isSumMetric ? (Number(item.value) || 0) : (Number(item.count) || 0);
                                      const pct = Math.round((valNum / total) * 100);
                                      const barColor = getKnownColor(item.label) || colorPalette[iIdx % colorPalette.length];

                                      return (
                                        <div key={item.label || iIdx} className="space-y-1">
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-[240px]" title={item.label}>
                                              <span className={`w-2 h-2 rounded-full shrink-0 ${barColor}`} />
                                              <span className="truncate">{item.label}</span>
                                            </span>
                                            <span className="font-mono text-xs font-black text-slate-700 shrink-0">
                                              {isSumMetric ? formatEUR(item.value) : item.count}{' '}
                                              <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                                            </span>
                                          </div>
                                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                              style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* 3. Detailed Elements Table */}
                    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                            {selectedView.name} • Elementi di Dettaglio
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {t.insights?.portfolioDetailSubtitle || 'Clicca su qualsiasi riga per aprire la scheda di dettaglio dell\'elemento.'}
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded-xl border border-slate-200">
                          {viewData.rows?.length || 0} {t.insights?.elementsCountLabel || 'elementi'}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {viewData.columns?.map((col: any) => (
                                <th
                                  key={col.field}
                                  onClick={() => handleSort(col.field)}
                                  className="px-4 py-3 hover:bg-slate-100/80 cursor-pointer select-none transition"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span>{col.label}</span>
                                    {sortField === col.field ? (
                                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {paginatedRows?.map((row: any) => (
                              <tr
                                key={row.id}
                                onClick={() => handleOpenElementDetail(row.id)}
                                className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                              >
                                {viewData.columns?.map((col: any) => (
                                  <td key={col.field} className="px-4 py-3">
                                    {col.field === 'apm_annual_cost' || col.type === 'currency' ? (
                                      <span className="font-mono font-bold text-slate-900">{formatEUR(row[col.field])}</span>
                                    ) : col.field === 'layer' ? (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLayerColor(row[col.field])}`}>
                                        {row[col.field]}
                                      </span>
                                    ) : col.field === 'type' ? (
                                      <span className="font-semibold text-slate-600">{row[col.field]}</span>
                                    ) : col.field === 'apm_app_code' ? (
                                      <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{row[col.field]}</span>
                                    ) : col.field === 'apm_business_criticality' ? (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        row[col.field] === 'Mission Critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                        row[col.field] === 'Business Critical' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}>{row[col.field] || '—'}</span>
                                    ) : col.field === 'apm_lifecycle_status' ? (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        row[col.field] === 'Live' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                        row[col.field] === 'Phase Out' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                        'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}>{row[col.field] || '—'}</span>
                                    ) : (
                                      <span>{row[col.field] || '—'}</span>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* KPI Table Footer & Pagination */}
                      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                        <div className="flex items-center gap-3">
                          <span>
                            {interpolate(t.insights.totalRecords, { count: viewData.total ?? viewData.rows?.length ?? 0 })}
                          </span>
                          {hasActiveFilters && (
                            <span className="text-[11px] text-indigo-600 font-bold">
                              (Filtri runtime applicati)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-600">Per pagina:</span>
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                                setPageSize(val);
                                setCurrentPage(1);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                              <option value="all">Tutti ({viewData.rows?.length || 0})</option>
                            </select>
                          </div>

                          {pageSize !== 'all' && totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-600 mr-1">
                                {Math.min((currentPage - 1) * (pageSize as number) + 1, viewData.rows?.length || 0)}-
                                {Math.min(currentPage * (pageSize as number), viewData.rows?.length || 0)} di {viewData.rows?.length || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                                title="Pagina precedente"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono text-xs font-bold text-slate-700 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs">
                                {currentPage} / {totalPages}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                                title="Pagina successiva"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                /* INTERACTIVE TABLE WITH ROWS CLICKABLE TO OPEN DETAIL IN PLACE */
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {viewData.columns?.map((col) => {
                            const isSorted = sortField === col.field;
                            return (
                              <th
                                key={col.field}
                                onClick={() => handleSort(col.field)}
                                className="px-4 py-3 hover:bg-slate-100/80 cursor-pointer select-none transition"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span>{col.label || col.field}</span>
                                  {isSorted ? (
                                    sortDir === 'asc' ? (
                                      <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    ) : (
                                      <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-slate-300 shrink-0 opacity-50 hover:opacity-100" />
                                  )}
                                </div>
                              </th>
                            );
                          })}
                          <th className="px-4 py-3 text-center w-16">
                            <span>Dettagli</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {paginatedRows.map((row: any, idx: number) => (
                          <tr
                            key={row.id || idx}
                            onClick={() => handleOpenElementDetail(row.id)}
                            className="hover:bg-indigo-50/60 transition-colors group cursor-pointer"
                          >
                            {viewData.columns?.map((col) => {
                              const val = row[col.field];

                              if (col.field === 'name') {
                                return (
                                  <td key={col.field} className="px-4 py-3 font-bold text-slate-900 group-hover:text-indigo-900 transition-colors">
                                    <div className="flex items-center space-x-2">
                                      <span className="truncate max-w-[280px]" title={val}>
                                        {val}
                                      </span>
                                      {row.stereotype_label && (
                                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border font-mono shrink-0 ${getStereotypeBadgeClass(row.stereotype_color)}`}>
                                          {row.stereotype_label}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              }

                              if (col.field === 'layer') {
                                return (
                                  <td key={col.field} className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLayerColor(val)}`}>
                                      {val}
                                    </span>
                                  </td>
                                );
                              }

                              if (col.field === 'type') {
                                return (
                                  <td key={col.field} className="px-4 py-3 font-semibold text-slate-600">
                                    {val}
                                  </td>
                                );
                              }

                              if (typeof val === 'boolean') {
                                return (
                                  <td key={col.field} className="px-4 py-3">
                                    {val ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Sì
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        No
                                      </span>
                                    )}
                                  </td>
                                );
                              }

                              if (col.type === 'currency' || col.field === 'apm_annual_cost') {
                                return (
                                  <td key={col.field} className="px-4 py-3 font-mono font-bold text-slate-800">
                                    {formatEUR(val)}
                                  </td>
                                );
                              }

                              if (col.field === 'computed_time_quadrant' || col.field === 'apm_time_quadrant_override') {
                                const qColor: Record<string, string> = {
                                  Invest: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                  Tolerate: 'bg-blue-50 text-blue-800 border-blue-200',
                                  Migrate: 'bg-amber-50 text-amber-800 border-amber-200',
                                  Eliminate: 'bg-rose-50 text-rose-800 border-rose-200'
                                };
                                const qVal = String(val || '');
                                return (
                                  <td key={col.field} className="px-4 py-3">
                                    {qVal ? (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${qColor[qVal] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                        {qVal}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                );
                              }

                              if (col.field === 'obsolescence_risk') {
                                const riskStr = String(val || '');
                                let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                                if (riskStr.includes('Retired')) badgeClass = 'bg-slate-800 text-white border-slate-900';
                                else if (riskStr.includes('Phase Out')) badgeClass = 'bg-rose-100 text-rose-900 border-rose-300';
                                else if (riskStr.includes('Debito')) badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
                                else if (riskStr.includes('Programmata')) badgeClass = 'bg-purple-100 text-purple-900 border-purple-300';
                                else if (riskStr.includes('Stabile')) badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';

                                return (
                                  <td key={col.field} className="px-4 py-3">
                                    {riskStr ? (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass}`}>
                                        {riskStr}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                );
                              }

                              return (
                                <td key={col.field} className="px-4 py-3 text-slate-600">
                                  {val !== null && val !== undefined && val !== '' ? (
                                    <span className="truncate max-w-[220px] block" title={String(val)}>
                                      {String(val)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Action column */}
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenElementDetail(row.id);
                                }}
                                className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                                title="Visualizza dettaglio elemento"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer & Pagination */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-3">
                      <span>
                        {interpolate(t.insights.totalRecords, { count: viewData.total ?? viewData.rows?.length ?? 0 })}
                      </span>
                      {hasActiveFilters && (
                        <span className="text-[11px] text-indigo-600 font-bold">
                          (Filtri runtime applicati)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-600">Per pagina:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                            setPageSize(val);
                            setCurrentPage(1);
                          }}
                          className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value="all">Tutti ({viewData.rows?.length || 0})</option>
                        </select>
                      </div>

                      {pageSize !== 'all' && totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-600 mr-1">
                            {Math.min((currentPage - 1) * (pageSize as number) + 1, viewData.rows.length)}-
                            {Math.min(currentPage * (pageSize as number), viewData.rows.length)} di {viewData.rows.length}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                            title="Pagina precedente"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono text-xs font-bold text-slate-700 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs">
                            {currentPage} / {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
                            title="Pagina successiva"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Schema Preview Modal */}
      {previewSchema && (
        <SchemaPreviewModal
          schema={previewSchema}
          onClose={() => setPreviewSchema(null)}
        />
      )}
    </div>
  );
};
