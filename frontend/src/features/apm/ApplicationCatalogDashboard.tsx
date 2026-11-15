import React, { useState, useMemo, useEffect } from 'react';
import { ApplicationInfo, MetamodelLayer, CustomAttributeDefinition } from '../../types';
import { api } from '../../lib/api';
import {
  Search,
  Filter,
  Download,
  Edit2,
  Layers,
  DollarSign,
  CheckCircle2,
  Zap,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Server,
  Cloud,
  Check,
  X,
  Folder,
  Share2,
  FileText,
  Info,
  ArrowRight,
  FolderGit2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface ApplicationCatalogDashboardProps {
  modelId: string;
  applications: ApplicationInfo[];
  onEditApp: (app: ApplicationInfo) => void;
  onRefreshParent?: () => Promise<void> | void;
  loading?: boolean;
}

export const ApplicationCatalogDashboard: React.FC<ApplicationCatalogDashboardProps> = ({
  modelId,
  applications,
  onEditApp,
  onRefreshParent,
  loading = false
}) => {
  const { t, language, interpolate } = useLanguage();
  const isIt = language === 'it';

  // Base list: STRICTLY Business Applications only
  const businessApps = useMemo(() => {
    return applications.filter(
      (app) => app.is_business_app !== false && app.is_enterprise_app !== false && app.in_apm_scope !== false
    );
  }, [applications]);

  // Metamodel Layers State for dynamic sections
  const [metamodelLayers, setMetamodelLayers] = useState<MetamodelLayer[]>([]);

  // Element Detail Slide-over / Modal State
  const [selectedApp, setSelectedApp] = useState<ApplicationInfo | null>(null);
  const [elementDetail, setElementDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState<string>('');

  // Load metamodel types for dynamic section grouping
  useEffect(() => {
    if (modelId) {
      api
        .getMetamodelTypes(modelId)
        .then((layers) => {
          setMetamodelLayers(layers || []);
        })
        .catch((err) => console.warn('Failed to load metamodel types:', err));
    }
  }, [modelId]);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [criticalityFilter, setCriticalityFilter] = useState<string>('all');
  const [hostingFilter, setHostingFilter] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');

  // Sorting state
  const [sortField, setSortField] = useState<keyof ApplicationInfo>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Currency formatter
  const formatEUR = (amount: number | string | undefined | null) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat(isIt ? 'it-IT' : 'en-US', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(num);
  };

  // Open Element Detail Modal and fetch complete properties from API
  const handleOpenDetail = async (app: ApplicationInfo) => {
    setSelectedApp(app);
    setIsDetailOpen(true);
    setDetailLoading(true);
    setActiveSectionTab('Attributi Generici');
    try {
      const detail = await api.getElementDetail(app.id);
      setElementDetail(detail);
    } catch (err) {
      console.error('Failed to load element detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedApp(null);
    setElementDetail(null);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDetailOpen) {
        handleCloseDetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailOpen]);

  // Compute sections and group attributes according to metamodel definitions
  const { sections, allSectionsList } = useMemo(() => {
    if (!elementDetail) {
      return { sections: {} as Record<string, CustomAttributeDefinition[]>, allSectionsList: [] as string[] };
    }

    const typeInfo = metamodelLayers
      .flatMap((l) => l.element_types || [])
      .find((et) => et.type === (elementDetail.type || 'ApplicationComponent'));

    const st = elementDetail.stereotype_id
      ? typeInfo?.stereotypes?.find((s) => s.id === elementDetail.stereotype_id)
      : undefined;

    const sectionsMap: Record<string, CustomAttributeDefinition[]> = {};
    const processedAttrNames = new Set<string>();

    const genericAttrs: CustomAttributeDefinition[] = [];
    const apmAttrs: CustomAttributeDefinition[] = [];
    const resilienceAttrs: CustomAttributeDefinition[] = [];
    const otherPackageAttrs: Record<string, CustomAttributeDefinition[]> = {};

    // 1. Standard attributes (ArchiMate core)
    const standardAttrs = typeInfo?.standard_attributes || [
      { name: 'id', label: 'Element ID', data_type: 'string', is_required: true, description: 'Unique ArchiMate identifier' },
      { name: 'name', label: 'Application Name', data_type: 'string', is_required: true, description: 'Name of the business application' },
      { name: 'documentation', label: 'Documentation', data_type: 'text', is_required: false, description: 'Architectural documentation and description' }
    ];

    standardAttrs.forEach((std: any) => {
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

    // 2. Custom & Package attributes from metamodel
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
        resilienceAttrs.push({ ...attr, section: 'Package Resilience' });
      } else if (isApm) {
        apmAttrs.push({ ...attr, section: 'Package APM' });
      } else if (attr.is_package && attr.package_code) {
        const sec = `Package ${pkgCode}`;
        if (!otherPackageAttrs[sec]) otherPackageAttrs[sec] = [];
        otherPackageAttrs[sec].push({ ...attr, section: sec });
      } else {
        genericAttrs.push({ ...attr, section: 'Attributi Generici' });
      }
    });

    // 3. Extra properties present in elementDetail.properties
    if (elementDetail.properties) {
      Object.entries(elementDetail.properties).forEach(([k, v]) => {
        if (!processedAttrNames.has(k)) {
          processedAttrNames.add(k);
          const rawLabel = k.replace(/^([a-z0-9]+)_/, '').replace(/_/g, ' ');
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
            element_type: elementDetail.type || 'ApplicationComponent',
            layer: elementDetail.layer || 'Application',
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
  }, [elementDetail, metamodelLayers]);

  // Set initial active section when modal opens
  useEffect(() => {
    if (allSectionsList.length > 0) {
      if (activeSectionTab === 'relazioni') return;
      if (!activeSectionTab || !allSectionsList.includes(activeSectionTab)) {
        setActiveSectionTab(allSectionsList[0]);
      }
    }
  }, [allSectionsList, activeSectionTab]);

  // Filter and sort applications
  const filteredApps = useMemo(() => {
    let result = [...businessApps];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (app) =>
          (app.name && app.name.toLowerCase().includes(q)) ||
          (app.app_code && app.app_code.toLowerCase().includes(q)) ||
          (app.short_name && app.short_name.toLowerCase().includes(q)) ||
          (app.business_owner && app.business_owner.toLowerCase().includes(q)) ||
          (app.technical_owner && app.technical_owner.toLowerCase().includes(q)) ||
          (app.vendor && app.vendor.toLowerCase().includes(q)) ||
          (app.notes && app.notes.toLowerCase().includes(q))
      );
    }

    // Stage filter
    if (stageFilter !== 'all') {
      result = result.filter((app) => (app.lifecycle_status || 'Live') === stageFilter);
    }

    // Criticality filter
    if (criticalityFilter !== 'all') {
      result = result.filter((app) => (app.business_criticality || 'Business Operational') === criticalityFilter);
    }

    // Hosting filter
    if (hostingFilter !== 'all') {
      result = result.filter((app) => (app.hosting_type || 'On-Premise') === hostingFilter);
    }

    // TIME filter
    if (timeFilter !== 'all') {
      result = result.filter((app) => {
        const q = app.time_quadrant_override || app.time_quadrant || 'Invest';
        return q === timeFilter;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });

    return result;
  }, [
    businessApps,
    searchQuery,
    stageFilter,
    criticalityFilter,
    hostingFilter,
    timeFilter,
    sortField,
    sortDirection
  ]);

  // Pagination calculation
  const totalItems = filteredApps.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));

  const paginatedApps = useMemo(() => {
    if (pageSize === 'all') return filteredApps;
    const page = Math.min(Math.max(1, currentPage), totalPages);
    const start = (page - 1) * pageSize;
    return filteredApps.slice(start, start + pageSize);
  }, [filteredApps, currentPage, pageSize, totalPages]);

  // Overall KPI stats
  const totalAppsCount = businessApps.length;
  const liveAppsCount = useMemo(
    () => businessApps.filter((a) => (a.lifecycle_status || 'Live') === 'Live').length,
    [businessApps]
  );
  const totalAnnualCost = useMemo(
    () => businessApps.reduce((sum, a) => sum + (Number(a.annual_cost) || 0), 0),
    [businessApps]
  );

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    stageFilter !== 'all' ||
    criticalityFilter !== 'all' ||
    hostingFilter !== 'all' ||
    timeFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setStageFilter('all');
    setCriticalityFilter('all');
    setHostingFilter('all');
    setTimeFilter('all');
    setCurrentPage(1);
  };

  const handleSort = (field: keyof ApplicationInfo) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'Name',
      'Code',
      'Short Name',
      'Stereotype',
      'Lifecycle Status',
      'Business Criticality',
      'TIME Strategy',
      'TIME Override Active',
      'Functional Fit',
      'Technical Fit',
      'Annual Cost EUR',
      'Hosting Type',
      'Business Owner',
      'Technical Owner',
      'Vendor',
      'Live Date',
      'Retirement Date',
      'Notes'
    ];

    const rows = filteredApps.map((a) => {
      const isOverride = Boolean(
        a.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(a.time_quadrant_override)
      );
      const effectiveTime = a.time_quadrant_override || a.time_quadrant || 'Invest';

      return [
        `"${a.id}"`,
        `"${(a.name || '').replace(/"/g, '""')}"`,
        `"${(a.app_code || '').replace(/"/g, '""')}"`,
        `"${(a.short_name || '').replace(/"/g, '""')}"`,
        `"Business Application"`,
        `"${a.lifecycle_status || 'Live'}"`,
        `"${a.business_criticality || 'Business Operational'}"`,
        `"${effectiveTime}"`,
        `"${isOverride ? 'Yes' : 'No'}"`,
        a.business_fit ?? 3,
        a.technical_fit ?? 3,
        a.annual_cost || 0,
        `"${a.hosting_type || 'On-Premise'}"`,
        `"${(a.business_owner || '').replace(/"/g, '""')}"`,
        `"${(a.technical_owner || '').replace(/"/g, '""')}"`,
        `"${(a.vendor || '').replace(/"/g, '""')}"`,
        `"${a.live_date || ''}"`,
        `"${a.retirement_date || ''}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `easyea_business_application_catalog_${modelId}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Badges color mapping
  const getStageBadgeClass = (stage?: string) => {
    switch (stage) {
      case 'Plan':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Phase In':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Live':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Phase Out':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Retired':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getCriticalityBadgeClass = (crit?: string) => {
    switch (crit) {
      case 'Mission Critical':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Business Critical':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Business Operational':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Administrative':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getTimeBadgeClass = (quadrant?: string) => {
    switch (quadrant) {
      case 'Invest':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Tolerate':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Migrate':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'Eliminate':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getLayerColor = (layer?: string) => {
    switch (layer) {
      case 'Strategy':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Business':
        return 'bg-yellow-100 text-yellow-900 border-yellow-300';
      case 'Application':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300';
      case 'Technology':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'Motivation':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'Implementation':
        return 'bg-rose-100 text-rose-900 border-rose-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const renderAttributeValue = (attr: CustomAttributeDefinition, rawVal: any) => {
    if (rawVal === undefined || rawVal === null || rawVal === '') {
      return <span className="text-slate-300 font-normal italic">—</span>;
    }
    if (typeof rawVal === 'boolean') {
      return rawVal ? (
        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          <Check className="w-3.5 h-3.5" />
          <span>{t.architect?.booleanTrue || (isIt ? 'Sì' : 'Yes')}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
          <X className="w-3.5 h-3.5" />
          <span>{t.architect?.booleanFalse || 'No'}</span>
        </span>
      );
    }
    if (attr.name.includes('cost') || attr.name.includes('annual') || attr.label.toLowerCase().includes('cost')) {
      return (
        <span className="font-mono font-bold text-slate-900">
          {formatEUR(rawVal)}
        </span>
      );
    }
    if (typeof rawVal === 'number') {
      return <span className="font-mono font-bold text-slate-900">{rawVal.toLocaleString()}</span>;
    }
    return <span className="font-medium text-slate-900 break-words">{String(rawVal)}</span>;
  };

  const totalRelations =
    (elementDetail?.incoming_relations?.length || 0) + (elementDetail?.outgoing_relations?.length || 0);

  return (
    <div className="space-y-5">
      {/* 1. Header & Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>{t.apm.catalogTitle}</span>
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-4xl">
            {t.apm.catalogSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{t.apm.catalogExportCsv}</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Business Applications */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.catalogKpiTotal}
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{totalAppsCount}</span>
            <span className="text-xs font-bold text-purple-600">
              «{t.apm.catalogInScopeBadge}»
            </span>
          </div>
        </div>

        {/* Total Spend TCO */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.catalogKpiTotalCost}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{formatEUR(totalAnnualCost)}</span>
          </div>
        </div>

        {/* Live in Production */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.catalogKpiLive}
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{liveAppsCount}</span>
            <span className="text-xs text-slate-500">
              ({totalAppsCount > 0 ? Math.round((liveAppsCount / totalAppsCount) * 100) : 0}%)
            </span>
          </div>
        </div>

        {/* Filtered Count */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t.apm.catalogKpiFiltered}
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Filter className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{filteredApps.length}</span>
            <span className="text-xs text-slate-500">
              / {totalAppsCount}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search & Multifaceted Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Full-text search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.apm.catalogSearchPlaceholder}
              className="w-full pl-9 pr-4 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Stage filter */}
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">{t.apm.catalogFilterStageAll}</option>
            <option value="Plan">Plan</option>
            <option value="Phase In">Phase In</option>
            <option value="Live">Live</option>
            <option value="Phase Out">Phase Out</option>
            <option value="Retired">Retired</option>
          </select>

          {/* Criticality filter */}
          <select
            value={criticalityFilter}
            onChange={(e) => {
              setCriticalityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">{t.apm.catalogFilterCriticalityAll}</option>
            <option value="Mission Critical">Mission Critical</option>
            <option value="Business Critical">Business Critical</option>
            <option value="Business Operational">Business Operational</option>
            <option value="Administrative">Administrative</option>
          </select>

          {/* TIME filter */}
          <select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="all">{t.apm.catalogFilterTimeAll}</option>
            <option value="Invest">Invest</option>
            <option value="Tolerate">Tolerate</option>
            <option value="Migrate">Migrate</option>
            <option value="Eliminate">Eliminate</option>
          </select>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition shrink-0 cursor-pointer"
              title={t.apm.catalogResetFilters}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.apm.catalogResetFilters}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Applications Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColApp}</span>
                    {sortField === 'name' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lifecycle_status')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColStage}</span>
                    {sortField === 'lifecycle_status' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('business_criticality')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColCriticality}</span>
                    {sortField === 'business_criticality' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('time_quadrant')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColTime}</span>
                    {sortField === 'time_quadrant' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 select-none">
                  <span>{t.apm.catalogColFits}</span>
                </th>
                <th
                  onClick={() => handleSort('annual_cost')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColCost}</span>
                    {sortField === 'annual_cost' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('hosting_type')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColHosting}</span>
                    {sortField === 'hosting_type' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('vendor')}
                  className="px-4 py-3 hover:bg-slate-100 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.apm.catalogColOwners}</span>
                    {sortField === 'vendor' && (
                      <span className="text-indigo-600 font-black">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right">
                  <span>{t.apm.catalogColActions}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedApps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-semibold">{t.apm.catalogNoAppsFound}</p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                      >
                        {t.apm.catalogResetFilters}
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedApps.map((app) => {
                  const effectiveTime = app.time_quadrant_override || app.time_quadrant || 'Invest';
                  const hasOverride = Boolean(
                    app.time_quadrant_override &&
                      ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override)
                  );

                  return (
                    <tr
                      key={app.id}
                      onClick={() => handleOpenDetail(app)}
                      className="hover:bg-indigo-50/50 hover:border-indigo-100 cursor-pointer transition group"
                      title={isIt ? 'Clicca per visualizzare tutti gli attributi divisi per sezione' : 'Click to inspect all attributes by section'}
                    >
                      {/* Name & Code */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="p-1.5 rounded-lg bg-indigo-50/80 text-indigo-600 border border-indigo-100 shrink-0 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition">
                            <Server className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition block truncate max-w-[280px]" title={app.name}>
                              {app.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {app.app_code && (
                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  {app.app_code}
                                </span>
                              )}
                              {app.short_name && app.short_name !== app.name && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={app.short_name}>
                                  {app.short_name}
                                </span>
                              )}
                              <span className="text-[9px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                «{t.apm.catalogInScopeBadge}»
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Lifecycle Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStageBadgeClass(
                            app.lifecycle_status
                          )}`}
                        >
                          {app.lifecycle_status || 'Live'}
                        </span>
                      </td>

                      {/* Criticality */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCriticalityBadgeClass(
                            app.business_criticality
                          )}`}
                        >
                          {app.business_criticality || 'Business Operational'}
                        </span>
                      </td>

                      {/* TIME Strategy */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getTimeBadgeClass(
                              effectiveTime
                            )}`}
                          >
                            {effectiveTime}
                          </span>
                          {hasOverride && (
                            <span
                              className="inline-flex items-center p-0.5 rounded bg-amber-400 text-slate-900 shadow-2xs"
                              title={isIt ? `Override manuale applicato (${effectiveTime})` : `Strategic Override active (${effectiveTime})`}
                            >
                              <Zap className="w-3 h-3 fill-slate-900 text-slate-900" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Fits */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]">
                        <span className="font-bold text-slate-800">B: {app.business_fit ?? 3}</span>
                        <span className="text-slate-300 mx-1">/</span>
                        <span className="font-bold text-slate-800">T: {app.technical_fit ?? 3}</span>
                      </td>

                      {/* TCO Cost */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs font-black text-slate-900">
                        {formatEUR(app.annual_cost)}
                      </td>

                      {/* Hosting */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                          <Cloud className="w-3 h-3 text-slate-400" />
                          <span>{app.hosting_type || 'On-Premise'}</span>
                        </span>
                      </td>

                      {/* Ownership & Vendor */}
                      <td className="px-4 py-3 text-[11px]">
                        <div className="truncate max-w-[180px] font-medium text-slate-700" title={app.vendor || '-'}>
                          {app.vendor || '-'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={app.business_owner || '-'}>
                          {app.business_owner || '-'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditApp(app);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition border border-transparent hover:border-indigo-200 cursor-pointer"
                          title={t.apm.catalogEditTooltip}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Bar */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>{t.apm.catalogRowsPerPage}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">{isIt ? 'Tutti' : 'All'}</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              {interpolate(t.apm.catalogPageInfo, {
                current: currentPage,
                total: totalPages,
                count: totalItems
              })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || pageSize === 'all'}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title={t.apm.catalogPrev}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || pageSize === 'all'}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title={t.apm.catalogNext}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. Sectioned Attributes Slide-Over / Modal */}
      {isDetailOpen && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[88vh] max-h-[850px] min-h-[600px] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getLayerColor(elementDetail?.layer || 'Application')}`}>
                    {elementDetail?.type || 'ApplicationComponent'}
                  </span>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    «{t.apm.catalogInScopeBadge}»
                  </span>
                  {selectedApp.app_code && (
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                      {selectedApp.app_code}
                    </span>
                  )}
                  {elementDetail?.package_code && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      [{elementDetail.package_code}]
                    </span>
                  )}
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate max-w-3xl" title={selectedApp.name}>
                  {selectedApp.name}
                </h3>

                {(elementDetail?.documentation || selectedApp.notes) && (
                  <p className="text-xs text-slate-600 line-clamp-2 max-w-4xl leading-relaxed">
                    {elementDetail?.documentation || selectedApp.notes}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleCloseDetail();
                    onEditApp(selectedApp);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{t.common?.edit || 'Modifica'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                  title={t.common?.close || 'Chiudi'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metamodel Section Tabs Bar */}
            <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-white shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                {allSectionsList.map((secName) => {
                  const count = sections[secName]?.length || 0;
                  const isActive = activeSectionTab === secName;
                  return (
                    <button
                      key={secName}
                      type="button"
                      onClick={() => setActiveSectionTab(secName)}
                      className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                      <span>{secName}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? 'bg-slate-800 text-indigo-300'
                            : 'bg-white text-slate-600 border border-slate-200'
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
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSectionTab === 'relazioni'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Share2 className={`w-3.5 h-3.5 ${activeSectionTab === 'relazioni' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{t.insights?.relationsTab || 'Relazioni di Architettura'}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      activeSectionTab === 'relazioni'
                        ? 'bg-slate-800 text-indigo-300'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {totalRelations}
                  </span>
                </button>
              </div>
            </div>

            {/* Modal Body / Active Section Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
              {detailLoading ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">{t.common?.loading || 'Caricamento attributi...'}</p>
                </div>
              ) : activeSectionTab === 'relazioni' ? (
                /* ARCHITECTURE RELATIONS TAB */
                <div className="space-y-6">
                  {/* Outgoing Relations */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      {t.insights?.outgoingRelations || 'Relazioni in Uscita'} ({elementDetail?.outgoing_relations?.length || 0})
                    </span>

                    {elementDetail?.outgoing_relations && elementDetail.outgoing_relations.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {elementDetail.outgoing_relations.map((rel: any) => (
                          <div
                            key={rel.id}
                            className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 text-xs flex items-center justify-between gap-3 shadow-2xs"
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
                        {t.insights?.noOutgoingRelations || 'Nessuna relazione in uscita.'}
                      </div>
                    )}
                  </div>

                  {/* Incoming Relations */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      {t.insights?.incomingRelations || 'Relazioni in Entrata'} ({elementDetail?.incoming_relations?.length || 0})
                    </span>

                    {elementDetail?.incoming_relations && elementDetail.incoming_relations.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {elementDetail.incoming_relations.map((rel: any) => (
                          <div
                            key={rel.id}
                            className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 text-xs flex items-center justify-between gap-3 shadow-2xs"
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
                        {t.insights?.noIncomingRelations || 'Nessuna relazione in entrata.'}
                      </div>
                    )}
                  </div>

                  {/* Schemas where used */}
                  {elementDetail?.used_in_schemas && elementDetail.used_in_schemas.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <FolderGit2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>{interpolate(t.insights?.usedInSchemasTitle || 'Schemi & Viste ({count})', { count: elementDetail.used_in_schemas.length })}</span>
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {elementDetail.used_in_schemas.map((sItem: any) => (
                          <div
                            key={sItem.id}
                            className="p-3 rounded-xl border border-purple-200/80 bg-purple-50/30 text-xs flex items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-slate-900 truncate max-w-xs" title={sItem.name}>
                                  {sItem.name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  {sItem.current_version || 'v1.0'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ATTRIBUTES GRID FOR SELECTED SECTION */
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{activeSectionTab}</span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        ({sections[activeSectionTab]?.length || 0} {t.insights?.attributesCountLabel || 'attributi'})
                      </span>
                    </div>
                  </div>

                  {!sections[activeSectionTab] || sections[activeSectionTab].length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      {t.insights?.noAttributesInSection || 'Nessun attributo configurato per questa sezione.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sections[activeSectionTab].map((attr) => {
                        const rawVal =
                          elementDetail?.properties?.[attr.name] !== undefined
                            ? elementDetail.properties[attr.name]
                            : elementDetail?.[attr.name] !== undefined
                            ? elementDetail[attr.name]
                            : (selectedApp as any)?.[attr.name];

                        return (
                          <div
                            key={attr.id || attr.name}
                            className="bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3.5 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between space-y-2"
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

                            <div className="text-xs">
                              {renderAttributeValue(attr, rawVal)}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[9px] text-slate-400 font-mono">
                              <span>{attr.name}</span>
                              <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-500 uppercase">
                                {attr.data_type}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
