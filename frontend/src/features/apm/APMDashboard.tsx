import React, { useState, useEffect, useMemo } from 'react';
import { APMPortfolio, ApplicationInfo } from '../../types';
import { api } from '../../lib/api';
import { UserAutocomplete } from '../../components/common/UserAutocomplete';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Server,
  Edit2,
  Check,
  X,
  Search,
  Filter,
  ShieldAlert,
  SlidersHorizontal,
  Cloud,
  CircleDot,
  LayoutGrid,
  Coins,
  Download,
  Zap,
  Calendar,
  Package,
  ArrowRight,
  Layers,
  Network,
  FileDown,
  FileText,
  Loader2
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { TechRiskRadar } from './TechRiskRadar';
import { TCOBreakdownDashboard } from './TCOBreakdownDashboard';
import { LifecycleRoadmapDashboard } from './LifecycleRoadmapDashboard';
import { ApplicationCatalogDashboard } from './ApplicationCatalogDashboard';
import { InterfaceInventoryDashboard } from './InterfaceInventoryDashboard';

interface APMDashboardProps {
  modelId: string;
  isApmPackageActive?: boolean;
  onNavigateMetamodel?: () => void;
  initialTab?: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle';
  activeTab?: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle';
  onTabChange?: (tab: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle') => void;
}

export const APMDashboard: React.FC<APMDashboardProps> = ({
  modelId,
  isApmPackageActive,
  onNavigateMetamodel,
  initialTab = 'catalog',
  activeTab,
  onTabChange
}) => {
  const { t, language, interpolate } = useLanguage();
  const { user } = useAuth();
  const userRoles = new Set((user?.assignments || []).map((a) => a.role));
  const canViewFinancials = userRoles.has('admin') || userRoles.has('c_level') || !user;

  const [data, setData] = useState<APMPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const isPackageActive = isApmPackageActive !== undefined ? isApmPackageActive : (data?.is_apm_package_active ?? true);
  const [internalActiveApmTab, setInternalActiveApmTab] = useState<'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle'>(activeTab || initialTab);

  const activeApmTab = activeTab !== undefined ? activeTab : internalActiveApmTab;
  const setActiveApmTab = (tab: 'catalog' | 'interfaces' | 'portfolio' | 'tech_risk' | 'tco' | 'lifecycle') => {
    setInternalActiveApmTab(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (activeTab) {
      setInternalActiveApmTab(activeTab);
    } else if (initialTab) {
      setInternalActiveApmTab(initialTab);
    }
  }, [activeTab, initialTab]);
  const [search, setSearch] = useState('');
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null);
  const [matrixViewMode, setMatrixViewMode] = useState<'bubble' | 'cards'>('bubble');
  const [techRiskMap, setTechRiskMap] = useState<Record<string, { level: string; score: number; eolCount: number }>>({});
  const [editingApp, setEditingApp] = useState<ApplicationInfo | null>(null);
  const [editForm, setEditForm] = useState<Partial<ApplicationInfo>>({});
  const [saving, setSaving] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const handleExportDocx = async () => {
    if (!modelId) return;
    try {
      setIsExportingDocx(true);
      await api.exportAPMDocxReport(modelId, language);
    } catch (err: any) {
      console.error('Error exporting APM DOCX report:', err);
      alert(t.apm.exportError);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, techRes] = await Promise.all([
        api.getAPMPortfolio(modelId),
        api.getTechRiskAnalysis(modelId).catch(() => null)
      ]);
      setData(res);
      if (techRes && techRes.applications) {
        const tMap: Record<string, { level: string; score: number; eolCount: number }> = {};
        techRes.applications.forEach((a: any) => {
          tMap[a.id] = {
            level: a.tech_risk_level,
            score: a.composite_risk_score,
            eolCount: a.counts?.obsolete || 0
          };
        });
        setTechRiskMap(tMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const handleEditClick = (app: ApplicationInfo) => {
    setEditingApp(app);
    const assetActive = isAsset(app);
    setEditForm({
      business_fit: app.business_fit,
      technical_fit: app.technical_fit,
      time_quadrant_override: app.time_quadrant_override || '',
      annual_cost: app.annual_cost,
      cost_software_licenses: app.cost_software_licenses || 0,
      cost_cloud_infrastructure: app.cost_cloud_infrastructure || 0,
      cost_vendor_maintenance: app.cost_vendor_maintenance || 0,
      cost_internal_labor: app.cost_internal_labor || 0,
      active_users: app.active_users || 0,
      capex_ratio: app.capex_ratio || 0,
      cost_type: app.cost_type || 'OPEX (SaaS / Canone Cloud)',
      cost_center: app.cost_center || '',
      business_criticality: app.business_criticality,
      lifecycle_status: app.lifecycle_status,
      live_date: app.live_date || '',
      retirement_date: app.retirement_date || '',
      business_owner: app.business_owner,
      technical_owner: app.technical_owner,
      vendor: app.vendor,
      hosting_type: app.hosting_type,
      architecture_type: app.architecture_type || '3-Tier Web App',
      data_classification: app.data_classification || 'Internal',
      personal_data: app.personal_data || false,
      sla_level: app.sla_level || 'Silver (99.0%)',
      rto_hours: app.rto_hours || '< 4 ore',
      is_business_app: assetActive,
      is_enterprise_app: assetActive,
      notes: app.notes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setSaving(true);
    try {
      await api.updateApplicationAPM(editingApp.id, editForm);
      await loadData();
      setEditingApp(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isAsset = (a: ApplicationInfo) => a.is_business_app !== false && a.is_enterprise_app !== false && a.in_apm_scope !== false;

  const businessApps = useMemo(() => {
    if (!data?.applications) return [];
    return data.applications.filter(isAsset);
  }, [data?.applications]);

  const totalBusinessCost = useMemo(() => {
    return businessApps.reduce((acc, a) => acc + (a.annual_cost || 0), 0);
  }, [businessApps]);

  const filteredApps = useMemo(() => {
    return businessApps.filter((app) => {
      const matchesSearch =
        app.name.toLowerCase().includes(search.toLowerCase()) ||
        app.vendor.toLowerCase().includes(search.toLowerCase()) ||
        app.business_owner.toLowerCase().includes(search.toLowerCase());
      const matchesQuad = selectedQuadrant ? (app.time_quadrant_override || app.time_quadrant) === selectedQuadrant : true;
      return matchesSearch && matchesQuad;
    });
  }, [businessApps, search, selectedQuadrant]);

  const handleExportCsv = () => {
    const appsToExport = filteredApps.length > 0 ? filteredApps : businessApps;
    if (appsToExport.length === 0) return;

    const isEn = language === 'en';

    const financialFields = new Set([
      'annual_cost',
      'cost_software_licenses',
      'cost_cloud_infrastructure',
      'cost_vendor_maintenance',
      'cost_internal_labor',
      'cost_per_user',
      'capex_ratio',
      'cost_center'
    ]);

    const columnsToExport = [
      { field: 'name', label: isEn ? 'Application Name' : 'Nome Applicazione' },
      { field: 'app_code', label: isEn ? 'Application Code' : 'Codice Applicazione' },
      { field: 'short_name', label: isEn ? 'Short Name' : 'Nome Breve' },
      { field: 'documentation', label: isEn ? 'Description / Documentation' : 'Descrizione / Documentazione' },
      { field: 'time_quadrant', label: isEn ? 'Gartner TIME Quadrant' : 'Quadrante Gartner TIME' },
      { field: 'time_quadrant_override', label: isEn ? 'TIME Override' : 'TIME Override' },
      { field: 'business_fit', label: isEn ? 'Business Fit Score (1-4)' : 'Business Fit Score (1-4)' },
      { field: 'technical_fit', label: isEn ? 'Technical Fit Score (1-4)' : 'Technical Fit Score (1-4)' },
      { field: 'business_criticality', label: isEn ? 'Business Criticality' : 'Criticità di Business' },
      { field: 'lifecycle_status', label: isEn ? 'Lifecycle Status' : 'Stato Ciclo di Vita' },
      { field: 'live_date', label: isEn ? 'Go-Live Date' : 'Data Rilascio (Go-Live)' },
      { field: 'retirement_date', label: isEn ? 'Planned Retirement Date' : 'Data Dismissione Prevista' },
      { field: 'annual_cost', label: isEn ? 'Total Annual TCO (€)' : 'TCO Annuo Totale (€)' },
      { field: 'cost_software_licenses', label: isEn ? 'Software Licenses & SaaS (€)' : 'Licenze Software & SaaS (€)' },
      { field: 'cost_cloud_infrastructure', label: isEn ? 'Cloud & Hosting Infrastructure (€)' : 'Cloud & Hosting Infrastructure (€)' },
      { field: 'cost_vendor_maintenance', label: isEn ? 'Vendor Support & AMS (€)' : 'Supporto Fornitore & AMS (€)' },
      { field: 'cost_internal_labor', label: isEn ? 'Internal FTE Labor (€)' : 'Personale Interno FTE (€)' },
      { field: 'active_users', label: isEn ? 'Active Users (Count)' : 'Utenti Attivi (Conteggio)' },
      { field: 'cost_per_user', label: isEn ? 'Annual Cost per User (€)' : 'Costo Annuo per Utente (€)' },
      { field: 'capex_ratio', label: isEn ? 'CAPEX Ratio (%)' : 'Quota CAPEX (%)' },
      { field: 'cost_type', label: isEn ? 'Cost Model' : 'Modello di Costo' },
      { field: 'cost_center', label: isEn ? 'Cost Center' : 'Centro di Costo' },
      { field: 'business_owner', label: isEn ? 'Business Owner' : 'Business Owner' },
      { field: 'technical_owner', label: isEn ? 'Technical Owner' : 'Technical Owner' },
      { field: 'vendor', label: isEn ? 'Vendor / Supplier' : 'Fornitore / Vendor' },
      { field: 'hosting_type', label: isEn ? 'Hosting Model' : 'Modello di Hosting' },
      { field: 'architecture_type', label: isEn ? 'Architecture Pattern' : 'Pattern Architetturale' },
      { field: 'sla_level', label: isEn ? 'SLA Level' : 'Livello SLA' },
      { field: 'rto_hours', label: isEn ? 'RTO (Recovery Time Objective)' : 'RTO (Recovery Time Objective)' },
      { field: 'data_classification', label: isEn ? 'Data Classification' : 'Classificazione Dati' },
      { field: 'personal_data', label: isEn ? 'GDPR Personal Data' : 'Trattamento Dati Personali (GDPR)' },
      { field: 'notes', label: isEn ? 'Notes' : 'Note' }
    ].filter((col) => canViewFinancials || !financialFields.has(col.field));

    const getCellValue = (row: any, col: { field: string }) => {
      const val = row[col.field];
      if (val === undefined || val === null) return '';
      if (typeof val === 'boolean') return val ? 'Sì' : 'No';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    const headers = columnsToExport.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(';');
    const rows = appsToExport.map((row) =>
      columnsToExport.map((c) => `"${getCellValue(row, c).replace(/"/g, '""')}"`).join(';')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `business_applications_apm_full_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatEUR = (val: number) =>
    new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  const formatCompactEUR = (val: number) => {
    if (val >= 1000000) return `€${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `€${(val / 1000).toFixed(0)}k`;
    return `€${val}`;
  };

  const getCalculatedTimeQuadrant = (businessFit: number, technicalFit: number): 'Invest' | 'Tolerate' | 'Migrate' | 'Eliminate' => {
    if (businessFit >= 3 && technicalFit >= 3) return 'Invest';
    if (businessFit >= 3 && technicalFit < 3) return 'Tolerate';
    if (businessFit < 3 && technicalFit >= 3) return 'Migrate';
    return 'Eliminate';
  };

  const timeSummary = useMemo(() => {
    if (!businessApps || businessApps.length === 0) return null;
    const counts = { Invest: 0, Tolerate: 0, Migrate: 0, Eliminate: 0 };
    const costs = { Invest: 0, Tolerate: 0, Migrate: 0, Eliminate: 0 };

    businessApps.forEach((app) => {
      const q = (app.time_quadrant_override || app.time_quadrant) as keyof typeof counts;
      if (counts[q] !== undefined) {
        counts[q] += 1;
        costs[q] += app.annual_cost || 0;
      }
    });

    return { counts, costs };
  }, [businessApps]);

  const bubbleApps = useMemo(() => {
    if (!businessApps || businessApps.length === 0) return [];

    const costs = businessApps.map((r) => Number(r.annual_cost) || 0);
    const minCost = Math.min(...costs);
    const maxCost = Math.max(...costs);
    const costSpread = Math.max(1, maxCost - minCost);

    const groups: { [key: string]: ApplicationInfo[] } = {};
    businessApps.forEach((r) => {
      const bFit = Number(r.business_fit) || 3;
      const tFit = Number(r.technical_fit) || 3;
      const key = `${bFit}_${tFit}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return businessApps.map((app) => {
      const bFit = Number(app.business_fit) || 3;
      const tFit = Number(app.technical_fit) || 3;
      const cost = Number(app.annual_cost) || 0;

      const costRatio = canViewFinancials ? Math.sqrt(Math.max(0, cost - minCost) / costSpread) : 0;
      const radius = canViewFinancials ? 20 + costRatio * 32 : 24;

      const minX = 8;
      const maxX = 92;
      const baseX = minX + ((tFit - 1) / 3) * (maxX - minX);

      const minY = 9;
      const maxY = 91;
      const baseY = maxY - ((bFit - 1) / 3) * (maxY - minY);

      const key = `${bFit}_${tFit}`;
      const group = groups[key] || [];
      const indexInGroup = group.indexOf(app);
      let offsetX = 0;
      let offsetY = 0;

      if (group.length > 1) {
        const angle = indexInGroup * 2.39996;
        const dist = Math.min(4.5, 1.2 + Math.sqrt(indexInGroup) * 0.95);
        offsetX = Math.cos(angle) * dist;
        offsetY = Math.sin(angle) * dist;

        if (tFit >= 2.5 && baseX + offsetX < 52) offsetX = Math.abs(offsetX);
        if (tFit < 2.5 && baseX + offsetX > 48) offsetX = -Math.abs(offsetX);
        if (bFit >= 2.5 && baseY + offsetY > 48) offsetY = -Math.abs(offsetY);
        if (bFit < 2.5 && baseY + offsetY < 52) offsetY = Math.abs(offsetY);
      }

      const posX = Math.max(minX, Math.min(maxX, baseX + offsetX));
      const posY = Math.max(minY, Math.min(maxY, baseY + offsetY));

      const calculatedQuadrant = getCalculatedTimeQuadrant(bFit, tFit);
      const quadrant = app.time_quadrant_override || app.time_quadrant || calculatedQuadrant;
      const hasOverride = Boolean(
        (app.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override) && app.time_quadrant_override !== calculatedQuadrant) ||
        (app.time_quadrant && app.time_quadrant !== calculatedQuadrant)
      );
      const shortName = app.short_name || (app.name ? app.name.slice(0, 14) : 'App');
      const appCode = app.app_code || (app.id.startsWith('elem-') ? app.id.replace('elem-', 'AP') : 'AP0000');

      return {
        app,
        posX,
        posY,
        radius,
        diameter: radius * 2,
        quadrant,
        calculatedQuadrant,
        hasOverride,
        shortName,
        appCode,
        cost,
        bFit,
        tFit
      };
    });
  }, [businessApps]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.apm.loadingPortfolio}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t.apm.title}</h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.apm.subtitle}
          </p>
        </div>
        {/* Global Actions */}
        {canViewFinancials && (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleExportDocx}
              disabled={isExportingDocx || !data}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600 shadow-sm transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              title={t.apm.btnExportDocx}
            >
              {isExportingDocx ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
              )}
              <span>{isExportingDocx ? t.apm.btnExportingDocx : t.apm.btnExportDocx}</span>
            </button>
          </div>
        )}
      </div>

      {/* Informative Banner when APM package is not active on this workspace */}
      {!loading && !isPackageActive && !isBannerDismissed && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-amber-500/20 text-amber-700 rounded-xl shrink-0 mt-0.5 md:mt-0">
              <Package className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <span>{t.apm.pkgInactiveBannerTitle}</span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-800 rounded-full">
                  TIP
                </span>
              </h4>
              <p className="text-xs text-amber-800/90 leading-relaxed max-w-3xl">
                {t.apm.pkgInactiveBannerMessage}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
            {onNavigateMetamodel && (
              <button
                onClick={onNavigateMetamodel}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{t.apm.pkgInactiveBannerAction}</span>
              </button>
            )}
            <button
              onClick={() => setIsBannerDismissed(true)}
              className="p-1.5 rounded-xl text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 transition cursor-pointer"
              title={t.apm.pkgInactiveBannerDismiss}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Module Switcher Bar */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveApmTab('catalog')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
            activeApmTab === 'catalog'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-500" />
          <span>{t.apm.tabCatalog}</span>
        </button>

        <button
          onClick={() => setActiveApmTab('interfaces')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
            activeApmTab === 'interfaces'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <Network className="w-4 h-4 text-cyan-500" />
          <span>{t.apm.tabInterfaces}</span>
        </button>

        <button
          onClick={() => setActiveApmTab('portfolio')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition shrink-0 ${
            activeApmTab === 'portfolio'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{t.apm.tabGartnerTime}</span>
        </button>

        <button
          onClick={() => setActiveApmTab('tech_risk')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition relative shrink-0 ${
            activeApmTab === 'tech_risk'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <span>{t.apm.tabTechRisk}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500 text-white uppercase tracking-wider">
            {t.apm.tabBadgeDora}
          </span>
        </button>

        {canViewFinancials && (
          <button
            onClick={() => setActiveApmTab('tco')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition relative shrink-0 ${
              activeApmTab === 'tco'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
            }`}
          >
            <Coins className="w-4 h-4 text-emerald-500" />
            <span>{t.apm.tabTcoBreakdown}</span>
          </button>
        )}

        <button
          onClick={() => setActiveApmTab('lifecycle')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition relative shrink-0 ${
            activeApmTab === 'lifecycle'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-500" />
          <span>{t.apm.tabLifecycle}</span>
        </button>
      </div>

      {activeApmTab === 'catalog' && (
        <ApplicationCatalogDashboard
          modelId={modelId}
          applications={businessApps}
          onEditApp={handleEditClick}
          onRefreshParent={loadData}
          loading={loading}
        />
      )}

      {activeApmTab === 'interfaces' && (
        <InterfaceInventoryDashboard
          modelId={modelId}
          applications={businessApps}
          onRefreshParent={loadData}
        />
      )}

      {activeApmTab === 'tech_risk' && (
        <TechRiskRadar modelId={modelId} />
      )}

      {activeApmTab === 'tco' && (
        <TCOBreakdownDashboard modelId={modelId} onRefreshParent={loadData} />
      )}

      {activeApmTab === 'lifecycle' && (
        <LifecycleRoadmapDashboard modelId={modelId} onEditApp={handleEditClick} onRefreshParent={loadData} />
      )}

      {activeApmTab === 'portfolio' && (
        <>
      {/* Top Metric Cards & Executive KPI */}
      <div className="space-y-4">
        {/* Total Cost & Scope Summary Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-xl border ${canViewFinancials ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
              {canViewFinancials ? <DollarSign className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {canViewFinancials ? t.apm.totalAnnualCost : t.apm.totalApplicationsScope}
              </span>
              <div className="text-2xl font-black text-slate-900">
                {canViewFinancials ? formatEUR(totalBusinessCost) : interpolate(t.apm.businessAppsRegistered, { count: businessApps.length })}
              </div>
              <p className="text-[11px] text-slate-500">
                {canViewFinancials ? t.apm.costDesc : t.apm.appsRegisteredDesc}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {canViewFinancials && (
              <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-slate-600">
                {interpolate(t.apm.businessAppsRegistered, { count: businessApps.length })}
              </div>
            )}
            {selectedQuadrant && (
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>{interpolate(t.apm.removeFilter, { quadrant: selectedQuadrant })}</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Quadrants Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Invest */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Invest' ? null : 'Invest')}
            className={`bg-emerald-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Invest' ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-100/50' : 'border-emerald-200/80 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">{t.apm.investTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-950">{timeSummary?.counts.Invest || 0} app</div>
            {canViewFinancials && (
              <div className="text-xs font-bold text-emerald-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Invest || 0)}</div>
            )}
            <p className="text-[11px] text-emerald-800/80 mt-1">{t.apm.investDesc}</p>
          </div>

          {/* Tolerate */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Tolerate' ? null : 'Tolerate')}
            className={`bg-blue-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Tolerate' ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-100/50' : 'border-blue-200/80 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800">{t.apm.tolerateTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-blue-950">{timeSummary?.counts.Tolerate || 0} app</div>
            {canViewFinancials && (
              <div className="text-xs font-bold text-blue-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Tolerate || 0)}</div>
            )}
            <p className="text-[11px] text-blue-800/80 mt-1">{t.apm.tolerateDesc}</p>
          </div>

          {/* Migrate */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Migrate' ? null : 'Migrate')}
            className={`bg-amber-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Migrate' ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-100/50' : 'border-amber-200/80 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">{t.apm.migrateTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-950">{timeSummary?.counts.Migrate || 0} app</div>
            {canViewFinancials && (
              <div className="text-xs font-bold text-amber-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Migrate || 0)}</div>
            )}
            <p className="text-[11px] text-amber-800/80 mt-1">{t.apm.migrateDesc}</p>
          </div>

          {/* Eliminate */}
          <div
            onClick={() => setSelectedQuadrant(selectedQuadrant === 'Eliminate' ? null : 'Eliminate')}
            className={`bg-rose-50/60 border rounded-2xl p-4 shadow-2xs cursor-pointer transition ${
              selectedQuadrant === 'Eliminate' ? 'border-rose-500 ring-2 ring-rose-500/30 bg-rose-100/50' : 'border-rose-200/80 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">{t.apm.eliminateTitle}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-rose-950">{timeSummary?.counts.Eliminate || 0} app</div>
            {canViewFinancials && (
              <div className="text-xs font-bold text-rose-700 font-mono mt-0.5">{formatEUR(timeSummary?.costs.Eliminate || 0)}</div>
            )}
            <p className="text-[11px] text-rose-800/80 mt-1">{t.apm.eliminateDesc}</p>
          </div>
        </div>
      </div>

      {/* Gartner TIME Matrix (Interactive Visual 2x2 Bubble Matrix & Cards) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <CircleDot className="w-4 h-4 text-indigo-600" />
              <span>{t.apm.matrixCartesianTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.apm.matrixCartesianSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden lg:flex items-center gap-2.5 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <span className="font-semibold text-slate-700">{t.apm.bubbleSizeLegend}</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> {t.apm.bubbleSizeLow}</span>
              <span className="text-slate-300">➔</span>
              <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-slate-700 inline-block" /> {t.apm.bubbleSizeHigh}</span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center text-slate-950 font-black">
                  <Zap className="w-2 h-2 fill-slate-950 text-slate-950" />
                </span>
                {t.apm.overrideLegend}
              </span>
            </div>

            {/* View Switcher: Bubble vs Cards */}
            <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMatrixViewMode('bubble')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                  matrixViewMode === 'bubble'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.apm.viewModeBubbleTitle}
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span>{t.apm.viewModeBubble}</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                  matrixViewMode === 'cards'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={t.apm.viewModeCardsTitle}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{t.apm.viewModeCards}</span>
              </button>
            </div>
          </div>
        </div>

        {matrixViewMode === 'bubble' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-stretch gap-2.5">
              {/* Y-Axis Label Area */}
              <div className="w-10 sm:w-12 shrink-0 flex flex-col items-center justify-between py-6 select-none bg-slate-50/80 border border-slate-200/90 rounded-2xl">
                <div className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Massimo (4.0)">
                  4.0
                </div>
                <div className="-rotate-90 whitespace-nowrap text-[11px] font-black uppercase tracking-wider text-slate-800 bg-white border border-slate-300 px-3 py-1 rounded-full shadow-xs">
                  {t.apm.axisBusinessFit}
                </div>
                <div className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Minimo (1.0)">
                  1.0
                </div>
              </div>

              {/* Chart Canvas Area */}
              <div className="relative flex-1 h-[640px] bg-slate-900/[0.02] border-2 border-slate-200/90 rounded-2xl overflow-hidden select-none">
                {/* 4 Quadrants Background Areas */}
                {/* Top-Left: TOLERATE */}
                <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-r-2 border-b-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-blue-900 bg-blue-100/90 border border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantTolerateTitle}
                    </span>
                    <span className="text-[11px] font-bold text-blue-700 bg-white/80 px-2 py-0.5 rounded-md border border-blue-200 font-mono">
                      {timeSummary?.counts.Tolerate || 0} app
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-blue-800/60 max-w-[260px]">
                    {t.apm.quadrantTolerateSubtitle}
                  </div>
                </div>

                {/* Top-Right: INVEST */}
                <div className="absolute top-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-bl from-emerald-500/10 via-emerald-500/5 to-transparent border-b-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantInvestTitle}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                      {timeSummary?.counts.Invest || 0} app
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800/60 max-w-[260px] text-right ml-auto">
                    {t.apm.quadrantInvestSubtitle}
                  </div>
                </div>

                {/* Bottom-Left: ELIMINATE */}
                <div className="absolute top-1/2 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-rose-500/10 via-rose-500/5 to-transparent border-r-2 border-dashed border-slate-300 p-4 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-rose-800/60 max-w-[260px]">
                    {t.apm.quadrantEliminateSubtitle}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-900 bg-rose-100/90 border border-rose-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantEliminateTitle}
                    </span>
                    <span className="text-[11px] font-bold text-rose-700 bg-white/80 px-2 py-0.5 rounded-md border border-rose-200 font-mono">
                      {timeSummary?.counts.Eliminate || 0} app
                    </span>
                  </div>
                </div>

                {/* Bottom-Right: MIGRATE */}
                <div className="absolute top-1/2 left-1/2 w-1/2 h-1/2 bg-gradient-to-tl from-amber-500/10 via-amber-500/5 to-transparent p-4 flex flex-col justify-between">
                  <div className="text-[11px] font-semibold text-amber-800/60 max-w-[260px] text-right ml-auto">
                    {t.apm.quadrantMigrateSubtitle}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs">
                      {t.apm.quadrantMigrateTitle}
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-white/80 px-2 py-0.5 rounded-md border border-amber-200 font-mono">
                      {timeSummary?.counts.Migrate || 0} app
                    </span>
                  </div>
                </div>

                {/* Center Origin Threshold Marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-lg z-30 border border-slate-600">
                  {t.apm.threshold25}
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
                      onClick={() => handleEditClick(b.app)}
                      className={`relative rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-200 transform group-hover:scale-115 group-hover:shadow-xl focus:outline-none focus:ring-4 ${
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
                      {b.hasOverride && (
                        <span
                          className="absolute -top-1 -right-1 z-30 flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-slate-950 shadow-md ring-2 ring-white border border-amber-500 font-black animate-pulse"
                          title={interpolate(t.apm.overrideDetail, {
                            calculated: b.calculatedQuadrant,
                            bFit: String(b.bFit),
                            tFit: String(b.tFit)
                          })}
                        >
                          <Zap className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                        </span>
                      )}
                      <span className="font-extrabold text-[10px] leading-tight px-1 text-center truncate max-w-full select-none">
                        {b.shortName}
                      </span>
                      {b.diameter >= 52 && (
                        <span className="text-[9px] font-mono opacity-85 mt-0.5 select-none font-bold">
                          {formatCompactEUR(b.cost)}
                        </span>
                      )}
                    </button>

                    {/* Rich Hover Floating Tooltip */}
                    <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col bg-slate-950/95 text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl z-50 min-w-[260px] max-w-[340px] pointer-events-none backdrop-blur-md">
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                          {b.appCode}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {b.hasOverride && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                              <Zap className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                              {t.apm.overrideBadge}
                            </span>
                          )}
                          <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            b.quadrant === 'Invest' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                            b.quadrant === 'Tolerate' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                            b.quadrant === 'Migrate' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                            'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {b.quadrant}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs font-black text-slate-100 leading-snug">{b.app.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{t.apm.tooltipShortName} <span className="text-slate-200 font-bold">{b.shortName}</span></div>

                      {b.hasOverride && (
                        <div className="bg-amber-500/20 border border-amber-400/40 rounded-lg p-2 my-2 text-[10px] space-y-1">
                          <div className="flex items-center gap-1.5 font-black text-amber-300 uppercase tracking-wider">
                            <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                            <span>{t.apm.overrideStrategic}</span>
                          </div>
                          <div className="text-amber-100 font-medium leading-tight">
                            {interpolate(t.apm.overrideDetail, {
                              calculated: b.calculatedQuadrant,
                              bFit: String(b.bFit),
                              tFit: String(b.tFit)
                            })}
                          </div>
                          <div className="text-amber-200/70 text-[9px] italic">
                            {t.apm.overrideTooltip}
                          </div>
                        </div>
                      )}

                      <div className="mt-1 space-y-1 text-[11px] border-t border-slate-800/80 pt-1.5">
                        {canViewFinancials && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">{t.apm.tooltipAnnualTco}</span>
                            <span className="font-mono font-bold text-amber-300">{formatEUR(b.cost)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t.apm.tooltipBusinessFit}</span>
                          <span className="font-bold text-slate-200">{b.bFit} / 4</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">{t.apm.tooltipTechnicalFit}</span>
                          <span className="font-bold text-slate-200">{b.tFit} / 4</span>
                        </div>
                        {b.app.business_owner && (
                          <div className="text-[10px] text-slate-400 truncate pt-1 border-t border-slate-900">
                            {t.apm.tooltipOwner} {b.app.business_owner}
                          </div>
                        )}
                        {b.app.vendor && (
                          <div className="text-[10px] text-slate-400 truncate">
                            {t.apm.tooltipVendor} {b.app.vendor}
                          </div>
                        )}
                      </div>
                      <div className="text-[9px] text-indigo-300/90 mt-2 text-center italic">
                        {t.apm.clickToEditTooltip}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Label Area */}
            <div className="flex items-center justify-between pl-12 sm:pl-14 pr-4 py-2 select-none bg-slate-50/80 border border-slate-200/90 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Minimo (1.0)">
                {t.apm.axisObsolete}
              </div>
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 bg-white border border-slate-300 px-4 py-1 rounded-full shadow-xs flex items-center gap-1.5">
                <span>{t.apm.axisTechnicalFit}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded shadow-2xs border border-slate-200 font-mono" title="Punteggio Massimo (4.0)">
                {t.apm.axisCloudNative}
              </div>
            </div>
          </div>
        ) : (
          /* VISTA 2: QUADRANTI A SCHEDE (CARDS) */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top-Left: TOLERATE */}
              <div className="bg-blue-50/40 border border-blue-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 mb-2">
                  <span className="text-xs font-black text-blue-900">{t.apm.quadrantTolerateTitle}</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Tolerate').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Tolerate').map((app) => {
                    const calcQ = getCalculatedTimeQuadrant(Number(app.business_fit) || 3, Number(app.technical_fit) || 3);
                    const isOverride = Boolean(
                      (app.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override) && app.time_quadrant_override !== calcQ) ||
                      (app.time_quadrant && app.time_quadrant !== calcQ)
                    );
                    return (
                      <button
                        key={app.id}
                        onClick={() => handleEditClick(app)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                        title={`[${app.app_code || 'AP0000'}] ${app.name}${canViewFinancials ? ` • TCO: ${formatEUR(app.annual_cost)}` : ''}${isOverride ? ` • [${t.apm.overrideStrategic}: ${calcQ} -> Tolerate]` : ''}`}
                      >
                        <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                        <span>{app.short_name || app.name}</span>
                        {isOverride && (
                          <span
                            className="flex items-center text-amber-300"
                            title={interpolate(t.apm.overrideDetail, {
                              calculated: calcQ,
                              bFit: String(app.business_fit || 3),
                              tFit: String(app.technical_fit || 3)
                            })}
                          >
                            <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                          </span>
                        )}
                        {canViewFinancials && (
                          <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                        )}
                      </button>
                    );
                  })}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Tolerate').length === 0 && (
                    <span className="text-xs text-blue-500 italic p-2">{t.apm.noAppsInQuadrant}</span>
                  )}
                </div>
              </div>

              {/* Top-Right: INVEST */}
              <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60 mb-2">
                  <span className="text-xs font-black text-emerald-900">{t.apm.quadrantInvestTitle}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Invest').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Invest').map((app) => {
                    const calcQ = getCalculatedTimeQuadrant(Number(app.business_fit) || 3, Number(app.technical_fit) || 3);
                    const isOverride = Boolean(
                      (app.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override) && app.time_quadrant_override !== calcQ) ||
                      (app.time_quadrant && app.time_quadrant !== calcQ)
                    );
                    return (
                      <button
                        key={app.id}
                        onClick={() => handleEditClick(app)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                        title={`[${app.app_code || 'AP0000'}] ${app.name}${canViewFinancials ? ` • TCO: ${formatEUR(app.annual_cost)}` : ''}${isOverride ? ` • [${t.apm.overrideStrategic}: ${calcQ} -> Invest]` : ''}`}
                      >
                        <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                        <span>{app.short_name || app.name}</span>
                        {isOverride && (
                          <span
                            className="flex items-center text-amber-300"
                            title={interpolate(t.apm.overrideDetail, {
                              calculated: calcQ,
                              bFit: String(app.business_fit || 3),
                              tFit: String(app.technical_fit || 3)
                            })}
                          >
                            <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                          </span>
                        )}
                        {canViewFinancials && (
                          <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                        )}
                      </button>
                    );
                  })}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Invest').length === 0 && (
                    <span className="text-xs text-emerald-500 italic p-2">{t.apm.noAppsInQuadrant}</span>
                  )}
                </div>
              </div>

              {/* Bottom-Left: ELIMINATE */}
              <div className="bg-rose-50/40 border border-rose-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 mb-2">
                  <span className="text-xs font-black text-rose-900">{t.apm.quadrantEliminateTitle}</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Eliminate').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Eliminate').map((app) => {
                    const calcQ = getCalculatedTimeQuadrant(Number(app.business_fit) || 3, Number(app.technical_fit) || 3);
                    const isOverride = Boolean(
                      (app.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override) && app.time_quadrant_override !== calcQ) ||
                      (app.time_quadrant && app.time_quadrant !== calcQ)
                    );
                    return (
                      <button
                        key={app.id}
                        onClick={() => handleEditClick(app)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-700 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                        title={`[${app.app_code || 'AP0000'}] ${app.name}${canViewFinancials ? ` • TCO: ${formatEUR(app.annual_cost)}` : ''}${isOverride ? ` • [${t.apm.overrideStrategic}: ${calcQ} -> Eliminate]` : ''}`}
                      >
                        <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                        <span>{app.short_name || app.name}</span>
                        {isOverride && (
                          <span
                            className="flex items-center text-amber-300"
                            title={interpolate(t.apm.overrideDetail, {
                              calculated: calcQ,
                              bFit: String(app.business_fit || 3),
                              tFit: String(app.technical_fit || 3)
                            })}
                          >
                            <Zap className="w-3 h-3 fill-amber-300 text-amber-300" />
                          </span>
                        )}
                        {canViewFinancials && (
                          <span className="text-[10px] opacity-80 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                        )}
                      </button>
                    );
                  })}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Eliminate').length === 0 && (
                    <span className="text-xs text-rose-500 italic p-2">{t.apm.noAppsInQuadrant}</span>
                  )}
                </div>
              </div>

              {/* Bottom-Right: MIGRATE */}
              <div className="bg-amber-50/40 border border-amber-200/80 rounded-xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 mb-2">
                  <span className="text-xs font-black text-amber-900">{t.apm.quadrantMigrateTitle}</span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono">
                    {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Migrate').length} app
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 content-start max-h-72 overflow-y-auto">
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Migrate').map((app) => {
                    const calcQ = getCalculatedTimeQuadrant(Number(app.business_fit) || 3, Number(app.technical_fit) || 3);
                    const isOverride = Boolean(
                      (app.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override) && app.time_quadrant_override !== calcQ) ||
                      (app.time_quadrant && app.time_quadrant !== calcQ)
                    );
                    return (
                      <button
                        key={app.id}
                        onClick={() => handleEditClick(app)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-xs border border-amber-600 flex items-center gap-1.5 cursor-pointer transition transform hover:scale-105"
                        title={`[${app.app_code || 'AP0000'}] ${app.name}${canViewFinancials ? ` • TCO: ${formatEUR(app.annual_cost)}` : ''}${isOverride ? ` • [${t.apm.overrideStrategic}: ${calcQ} -> Migrate]` : ''}`}
                      >
                        <span className="font-mono text-[10px] opacity-80">[{app.app_code || 'AP0000'}]</span>
                        <span>{app.short_name || app.name}</span>
                        {isOverride && (
                          <span
                            className="flex items-center text-slate-950"
                            title={interpolate(t.apm.overrideDetail, {
                              calculated: calcQ,
                              bFit: String(app.business_fit || 3),
                              tFit: String(app.technical_fit || 3)
                            })}
                          >
                            <Zap className="w-3 h-3 fill-slate-950 text-slate-950" />
                          </span>
                        )}
                        {canViewFinancials && (
                          <span className="text-[10px] opacity-90 font-mono">({formatCompactEUR(app.annual_cost)})</span>
                        )}
                      </button>
                    );
                  })}
                  {businessApps.filter((a) => (a.time_quadrant_override || a.time_quadrant) === 'Migrate').length === 0 && (
                    <span className="text-xs text-amber-600 italic p-2">{t.apm.noAppsInQuadrant}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Application Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">{t.apm.inventoryTitle}</h3>
            <p className="text-xs text-slate-500">{t.apm.inventorySubtitle}</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCsv}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 shadow-2xs transition shrink-0 cursor-pointer"
              title={t.apm.btnExportCsvFullTitle}
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t.apm.btnExportCsvFull}</span>
            </button>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t.apm.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white w-64"
              />
            </div>
            {selectedQuadrant && (
              <button
                onClick={() => setSelectedQuadrant(null)}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100"
              >
                <span>{interpolate(t.apm.filterActive, { quadrant: selectedQuadrant })}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">{t.apm.colApplication}</th>
                <th className="py-3 px-4">{t.apm.colTimeQuadrant}</th>
                <th className="py-3 px-4">{t.apm.colTechRiskEol}</th>
                <th className="py-3 px-4">{t.apm.colFitScores}</th>
                <th className="py-3 px-4">{t.apm.colAnnualCost}</th>
                <th className="py-3 px-4">{t.apm.colCriticality}</th>
                <th className="py-3 px-4">{t.apm.colLifecycle}</th>
                <th className="py-3 px-4">{t.apm.colBusinessOwner}</th>
                <th className="py-3 px-4">{t.apm.colVendorHosting}</th>
                <th className="py-3 px-4 text-right">{t.apm.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1.5">
                        <span>{app.name}</span>
                        <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                          «Business App»
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">{app.id}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {(() => {
                      const calcQ = getCalculatedTimeQuadrant(Number(app.business_fit) || 3, Number(app.technical_fit) || 3);
                      const isOverride = Boolean(
                        (app.time_quadrant_override && ['Invest', 'Tolerate', 'Migrate', 'Eliminate'].includes(app.time_quadrant_override) && app.time_quadrant_override !== calcQ) ||
                        (app.time_quadrant && app.time_quadrant !== calcQ)
                      );
                      return (
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              app.time_quadrant === 'Invest'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : app.time_quadrant === 'Migrate'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : app.time_quadrant === 'Tolerate'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {app.time_quadrant}
                          </span>
                          {isOverride && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs"
                              title={interpolate(t.apm.overrideDetail, {
                                calculated: calcQ,
                                bFit: String(app.business_fit || 3),
                                tFit: String(app.technical_fit || 3)
                              })}
                            >
                              <Zap className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              <span>{t.apm.overrideBadge}</span>
                              <span className="opacity-75 font-normal">({calcQ})</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 px-4">
                    {techRiskMap[app.id] ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          techRiskMap[app.id].level === 'Critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : techRiskMap[app.id].level === 'High'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : techRiskMap[app.id].level === 'Medium'
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                            : techRiskMap[app.id].level === 'Low'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {techRiskMap[app.id].level === 'Critical' ? '🔴 Critical' :
                         techRiskMap[app.id].level === 'High' ? '🟠 High' :
                         techRiskMap[app.id].level === 'Medium' ? '🟡 Medium' :
                         techRiskMap[app.id].level === 'Low' ? '🟢 Supported' : '⚪ N/A'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">⚪ N/A</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold">
                    <span className="text-slate-900">B:{app.business_fit}</span> / <span className="text-slate-500">T:{app.technical_fit}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {canViewFinancials && app.annual_cost !== null && app.annual_cost !== undefined ? (
                      formatEUR(app.annual_cost)
                    ) : (
                      <span className="text-slate-400 text-xs italic font-normal flex items-center gap-1">
                        <span>🔒</span>
                        <span>{t.apm.confidentialCLevel}</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-medium">
                    <span className="text-slate-700 flex items-center gap-1">
                      {app.business_criticality === 'Mission Critical' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                      {app.business_criticality}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      app.lifecycle_status === 'Live' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {app.lifecycle_status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{app.business_owner}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="flex flex-col text-[11px]">
                      <span className="text-slate-900 font-semibold">{app.vendor}</span>
                      <span className="text-slate-500">{app.hosting_type}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleEditClick(app)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title={t.apm.colActions}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Edit Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingApp(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">{interpolate(t.apm.editModalTitle, { name: editingApp.name })}</h3>
            <p className="text-xs text-slate-500 mb-5">{t.apm.editModalSubtitle}</p>

            <div className="space-y-5">
              
              {/* Enterprise Application Stereotype Toggle */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-900 block flex items-center gap-1.5">
                    <span>{t.apm.labelInApmScope}</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-black rounded bg-indigo-600 text-white uppercase">
                      Stereotipo
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-600 mt-0.5">{t.apm.labelInApmScopeDesc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.is_business_app !== false}
                  onChange={(e) => setEditForm({ ...editForm, is_business_app: e.target.checked, is_enterprise_app: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
              </div>

              {/* Sezione: Fit & TIME */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Valutazione Gartner TIME & Fit
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelBusinessFit}
                    </label>
                    <select
                      value={editForm.business_fit || 3}
                      onChange={(e) => setEditForm({ ...editForm, business_fit: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={1}>1 - Unreasonable (Inadeguata)</option>
                      <option value={2}>2 - Insufficient (Lacunosa)</option>
                      <option value={3}>3 - Appropriate (Adeguata)</option>
                      <option value={4}>4 - Perfect (Eccellente)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelTechnicalFit}
                    </label>
                    <select
                      value={editForm.technical_fit || 3}
                      onChange={(e) => setEditForm({ ...editForm, technical_fit: parseInt(e.target.value) || 1 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value={1}>1 - Unreasonable (Obsoleta)</option>
                      <option value={2}>2 - Insufficient (Debito Tecnico)</option>
                      <option value={3}>3 - Appropriate (Stabile/Standard)</option>
                      <option value={4}>4 - Perfect (Cloud Native)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelTimeOverride}
                    </label>
                    <select
                      value={editForm.time_quadrant_override || ''}
                      onChange={(e) => setEditForm({ ...editForm, time_quadrant_override: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">{t.apm.overrideAutoOption}</option>
                      <option value="Invest">{t.apm.optionInvestDesc}</option>
                      <option value="Migrate">{t.apm.optionMigrateDesc}</option>
                      <option value="Tolerate">{t.apm.optionTolerateDesc}</option>
                      <option value="Eliminate">{t.apm.optionEliminateDesc}</option>
                    </select>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                      <span>{interpolate(t.apm.editModalTimeAutoHelp, { calculated: getCalculatedTimeQuadrant(Number(editForm.business_fit) || 3, Number(editForm.technical_fit) || 3) })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sezione: Ciclo di Vita & Criticità */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t.apm.sectionLifecycleCriticality}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelLifecycle}
                    </label>
                    <select
                      value={editForm.lifecycle_status}
                      onChange={(e) => setEditForm({ ...editForm, lifecycle_status: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Plan">Plan</option>
                      <option value="Phase In">Phase In</option>
                      <option value="Live">Live</option>
                      <option value="Phase Out">Phase Out</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelCriticality}
                    </label>
                    <select
                      value={editForm.business_criticality}
                      onChange={(e) => setEditForm({ ...editForm, business_criticality: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Mission Critical">Mission Critical</option>
                      <option value="Business Critical">Business Critical</option>
                      <option value="Business Operational">Business Operational</option>
                      <option value="Administrative">Administrative</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelGoLiveDate}
                    </label>
                    <input
                      type="date"
                      value={editForm.live_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, live_date: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelRetirementDate}
                    </label>
                    <input
                      type="date"
                      value={editForm.retirement_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, retirement_date: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione: TCO & Finanza */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t.apm.sectionFinancialsTco}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelAnnualCost}
                    </label>
                    <input
                      type="number"
                      value={editForm.annual_cost || 0}
                      onChange={(e) => setEditForm({ ...editForm, annual_cost: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelCostType}
                    </label>
                    <select
                      value={editForm.cost_type || 'OPEX (SaaS / Canone Cloud)'}
                      onChange={(e) => setEditForm({ ...editForm, cost_type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="OPEX (SaaS / Canone Cloud)">OPEX (SaaS / Canone Cloud)</option>
                      <option value="CAPEX (Licenza Perpetua)">CAPEX (Licenza Perpetua)</option>
                      <option value="Internal (Sviluppo Interno)">Internal (Sviluppo Interno)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelCostCenter}
                    </label>
                    <input
                      type="text"
                      placeholder="es. CC-1020"
                      value={editForm.cost_center || ''}
                      onChange={(e) => setEditForm({ ...editForm, cost_center: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione: Architettura & Hosting */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t.apm.sectionArchitectureHosting}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelHosting}
                    </label>
                    <select
                      value={editForm.hosting_type}
                      onChange={(e) => setEditForm({ ...editForm, hosting_type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SaaS">SaaS</option>
                      <option value="Public Cloud">Public Cloud (AWS/GCP/Azure)</option>
                      <option value="Private Cloud">Private Cloud</option>
                      <option value="On-Premise">On-Premise</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelArchitectureType}
                    </label>
                    <select
                      value={editForm.architecture_type || '3-Tier Web App'}
                      onChange={(e) => setEditForm({ ...editForm, architecture_type: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="SaaS Standard">SaaS Standard</option>
                      <option value="Microservices / Cloud Native">Microservices / Cloud Native</option>
                      <option value="3-Tier Web App">3-Tier Web App</option>
                      <option value="Monolith / Client-Server">Monolith / Client-Server</option>
                      <option value="Legacy Mainframe">Legacy Mainframe</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Sezione: Governance & Ownership */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  {t.apm.sectionGovernanceOwnership}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelBusinessOwner}
                    </label>
                    <UserAutocomplete
                      mode="string"
                      value={editForm.business_owner || ''}
                      onChange={(u, str) => setEditForm({ ...editForm, business_owner: u ? (u.full_name ? `${u.full_name} (${u.email})` : u.email) : (str || '') })}
                      minChars={3}
                      allowCustomValue={true}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelTechnicalOwner}
                    </label>
                    <UserAutocomplete
                      mode="string"
                      value={editForm.technical_owner || ''}
                      onChange={(u, str) => setEditForm({ ...editForm, technical_owner: u ? (u.full_name ? `${u.full_name} (${u.email})` : u.email) : (str || '') })}
                      minChars={3}
                      allowCustomValue={true}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelVendor}
                    </label>
                    <input
                      type="text"
                      value={editForm.vendor || ''}
                      onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Sezione: Sicurezza & Resilienza */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Sicurezza, Privacy & SLA
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelDataClassification}
                    </label>
                    <select
                      value={editForm.data_classification || 'Internal'}
                      onChange={(e) => setEditForm({ ...editForm, data_classification: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Public">Public</option>
                      <option value="Internal">Internal</option>
                      <option value="Confidential">Confidential</option>
                      <option value="Restricted / GDPR PII">Restricted / GDPR PII</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelSla}
                    </label>
                    <select
                      value={editForm.sla_level || 'Silver (99.0%)'}
                      onChange={(e) => setEditForm({ ...editForm, sla_level: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Platinum (99.99%)">Platinum (99.99%)</option>
                      <option value="Gold (99.9%)">Gold (99.9%)</option>
                      <option value="Silver (99.0%)">Silver (99.0%)</option>
                      <option value="Bronze (95.0%)">Bronze (95.0%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t.apm.labelRto}
                    </label>
                    <select
                      value={editForm.rto_hours || '< 4 ore'}
                      onChange={(e) => setEditForm({ ...editForm, rto_hours: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="< 1 ora">&lt; 1 ora</option>
                      <option value="< 4 ore">&lt; 4 ore</option>
                      <option value="< 24 ore">&lt; 24 ore</option>
                      <option value="> 24 ore / Best Effort">&gt; 24 ore / Best Effort</option>
                    </select>
                  </div>
                </div>
                <div className="pt-2 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="chk_personal_data"
                    checked={editForm.personal_data || false}
                    onChange={(e) => setEditForm({ ...editForm, personal_data: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="chk_personal_data" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    {t.apm.labelPersonalData}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.apm.labelNotes}
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Salvataggio...' : t.common.save}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
