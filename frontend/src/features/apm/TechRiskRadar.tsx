import React, { useState, useEffect, useMemo } from 'react';
import { TechRiskAnalysisData, AppTechRiskInfo, TechnologyItemInfo, DoraComplianceAlert } from '../../types';
import { api } from '../../lib/api';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Server,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Calendar,
  Cpu,
  RefreshCw,
  ExternalLink,
  Edit2,
  DollarSign,
  ChevronRight,
  Info,
  Flame,
  Activity,
  Check
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface TechRiskRadarProps {
  modelId: string;
}

export const TechRiskRadar: React.FC<TechRiskRadarProps> = ({ modelId }) => {
  const { t, language, interpolate } = useLanguage();
  const { user } = useAuth();
  const userRoles = useMemo(() => new Set((user?.assignments || []).map((a) => a.role)), [user]);
  const canViewFinancials = Boolean(userRoles.has('admin') || userRoles.has('c_level') || !user);

  const [data, setData] = useState<TechRiskAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<string | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechnologyItemInfo | null>(null);
  const [editingTech, setEditingTech] = useState<TechnologyItemInfo | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingTech, setSavingTech] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'timeline' | 'blast_radius' | 'apps'>('matrix');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTechRiskAnalysis(modelId);
      setData(res);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load technology risk data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [modelId]);

  const handleEditTechClick = (tech: TechnologyItemInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTech(tech);
    setEditForm({
      vendor: tech.vendor || '',
      version: tech.version || '',
      category: tech.category || 'Database / RDBMS',
      status: tech.status || 'Supported',
      eol_date: tech.eol_date || '',
      eoes_date: tech.eoes_date || '',
      cve_risk: tech.cve_risk || 'Low / Negligible'
    });
  };

  const handleSaveTechEdit = async () => {
    if (!editingTech) return;
    setSavingTech(true);
    try {
      await api.updateTechnologyLifecycle(editingTech.id, editForm);
      await loadData();
      setEditingTech(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTech(false);
    }
  };

  const formatEUR = (val: number | null | undefined) => {
    if (val === null || val === undefined) return `🔒 ${t.apm.confidentialCLevel}`;
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.apm.techRiskLoading}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-rose-800">{t.apm.techRiskErrorLoading}</h4>
        <p className="text-xs text-rose-600 mt-1">{error || t.apm.techRiskDataUnavailable}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition"
        >
          {t.apm.techRiskRetry}
        </button>
      </div>
    );
  }

  const { summary, dora_compliance_alerts, criticality_vs_risk_matrix, eol_timeline_horizon, technology_blast_radius, applications } = data;

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.business_owner.toLowerCase().includes(search.toLowerCase()) ||
      app.technical_owner.toLowerCase().includes(search.toLowerCase()) ||
      app.technologies.some((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.vendor.toLowerCase().includes(search.toLowerCase()));

    const matchesRisk = riskFilter ? app.tech_risk_level === riskFilter : true;
    return matchesSearch && matchesRisk;
  });

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Critical':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">{t.apm.techRiskBadgeCriticalEol}</span>;
      case 'High':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">{t.apm.techRiskBadgeHighRisk}</span>;
      case 'Medium':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-yellow-100 text-yellow-800 border border-yellow-200">{t.apm.techRiskBadgeMediumRisk}</span>;
      case 'Low':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">{t.apm.techRiskBadgeLowSupported}</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">{t.apm.techRiskBadgeUnassessed}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'End of Life / Obsolete':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">{t.apm.techRiskBadgeEol}</span>;
      case 'Extended Support':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{t.apm.techRiskBadgeExtendedSupport}</span>;
      case 'Approaching EOL':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">{t.apm.techRiskStatusApproaching}</span>;
      case 'Supported':
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">{t.apm.techRiskBadgeSupported}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* High/Critical Risk Percentage */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.apm.techRiskAppsAtRisk}</span>
            <div className={`p-2.5 rounded-xl border ${summary.high_critical_risk_pct > 30 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-900">{summary.high_critical_risk_pct}%</span>
            <span className="text-xs font-semibold text-slate-500">
              {interpolate(t.apm.techRiskAppsAtRiskDetail, { count: summary.risk_distribution.Critical + summary.risk_distribution.High, total: summary.assessed_applications })}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{t.apm.techRiskAppsAtRiskDesc}</p>
        </div>

        {/* DORA Violations */}
        <div
          onClick={() => setRiskFilter(riskFilter === 'Critical' ? null : 'Critical')}
          className={`bg-white border rounded-2xl p-5 shadow-sm cursor-pointer transition ${
            summary.dora_compliance_alerts_count > 0 ? 'border-rose-300 hover:border-rose-500 bg-rose-50/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">{t.apm.techRiskDoraAlerts}</span>
            <span className="px-2 py-0.5 text-xs font-black rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {interpolate(t.apm.techRiskDoraViolations, { count: summary.dora_compliance_alerts_count })}
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-900">
            {summary.dora_compliance_alerts_count > 0 ? interpolate(t.apm.techRiskDoraCriticalApps, { count: summary.dora_compliance_alerts_count }) : t.apm.techRiskDoraNone}
          </div>
          <p className="text-[11px] text-rose-700 mt-1">{t.apm.techRiskDoraDesc}</p>
        </div>

        {/* Obsolete Technologies Count */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">{t.apm.techRiskEolActive}</span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {interpolate(t.apm.techRiskEolActiveDetail, { count: summary.obsolete_technologies_count, total: summary.total_technologies })}
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{interpolate(t.apm.techRiskEolActiveProducts, { count: summary.obsolete_technologies_count })}</div>
          <p className="text-[11px] text-slate-500 mt-1">{t.apm.techRiskEolActiveDesc}</p>
        </div>

        {/* Approaching EOL */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">{t.apm.techRiskApproachingEol}</span>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{interpolate(t.apm.techRiskApproachingEolProducts, { count: summary.approaching_eol_count })}</div>
          <p className="text-[11px] text-slate-500 mt-1">{t.apm.techRiskApproachingEolDesc}</p>
        </div>
      </div>

      {/* DORA Regulatory Compliance Alert Banner */}
      {dora_compliance_alerts.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-rose-50/70 to-amber-50 border border-rose-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-700 mt-0.5">
              <Flame className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-extrabold text-rose-950 flex items-center gap-2">
                  <span>{t.apm.techRiskDoraBannerHeader}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
                    {t.apm.techRiskDoraActionRequired}
                  </span>
                </h4>
                <span className="text-xs font-semibold text-rose-700">
                  {interpolate(t.apm.techRiskDoraCriticalAppsExposed, { count: dora_compliance_alerts.length })}
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-1">
                {t.apm.techRiskDoraDetailedExplanation}
              </p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {dora_compliance_alerts.map((alert) => (
                  <div key={alert.application_id} className="bg-white/80 border border-rose-200/80 rounded-xl p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{alert.application_name}</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        {alert.business_criticality}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-rose-700">
                      <strong>{t.apm.techRiskObsoleteStack}</strong> {alert.obsolete_components.join(', ')}
                    </div>
                    <div className="mt-2 pt-2 border-t border-rose-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{t.apm.techRiskOwner} {alert.business_owner}</span>
                      <span className="font-semibold text-slate-700">
                        {alert.annual_cost !== null && alert.annual_cost !== undefined ? (
                          `${t.apm.techRiskTco} ${formatEUR(alert.annual_cost)}`
                        ) : (
                          <span className="text-slate-400 font-normal">🔒 {t.apm.confidentialCLevel}</span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tabs Navigation for Radar Analysis */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'matrix' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t.apm.techRiskSubtabMatrix}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('timeline')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'timeline' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t.apm.techRiskSubtabTimeline}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('blast_radius')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'blast_radius' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{interpolate(t.apm.techRiskSubtabBlastRadius, { count: technology_blast_radius.length })}</span>
          </button>
          <button
            onClick={() => setActiveSubTab('apps')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
              activeSubTab === 'apps' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{interpolate(t.apm.techRiskSubtabApps, { count: applications.length })}</span>
          </button>
        </div>

        <button
          onClick={loadData}
          className="flex items-center space-x-1 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition px-2.5 py-1 rounded-lg hover:bg-slate-100"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t.apm.techRiskBtnRefresh}</span>
        </button>
      </div>

      {/* VIEW 1: Matrice 4x4 Criticality vs Technology Risk */}
      {activeSubTab === 'matrix' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{t.apm.techRiskMatrixTitle}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {t.apm.techRiskMatrixSubtitle}
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold">
              <span className="flex items-center gap-1 text-rose-700"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> {t.apm.techRiskMatrixRedZone}</span>
              <span className="flex items-center gap-1 text-emerald-700"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> {t.apm.techRiskMatrixSafeZone}</span>
            </div>
          </div>

          {/* 4x4 Interactive Grid Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left text-xs font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-200 rounded-tl-xl w-1/5">
                    {t.apm.techRiskMatrixAxisHeader}
                  </th>
                  <th className="p-3 text-xs font-extrabold text-rose-800 bg-rose-50 border border-slate-200 w-1/5">
                    {t.apm.techRiskMatrixColCritical}
                  </th>
                  <th className="p-3 text-xs font-extrabold text-amber-800 bg-amber-50 border border-slate-200 w-1/5">
                    {t.apm.techRiskMatrixColHigh}
                  </th>
                  <th className="p-3 text-xs font-extrabold text-yellow-800 bg-yellow-50 border border-slate-200 w-1/5">
                    {t.apm.techRiskMatrixColMedium}
                  </th>
                  <th className="p-3 text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-slate-200 rounded-tr-xl w-1/5">
                    {t.apm.techRiskMatrixColLow}
                  </th>
                </tr>
              </thead>
              <tbody>
                {['Mission Critical', 'Business Critical', 'Business Operational', 'Administrative'].map((crit, idx) => (
                  <tr key={crit} className="hover:bg-slate-50/50 transition">
                    <td className="p-3.5 text-left text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200">
                      {crit}
                    </td>

                    {/* Critical Column */}
                    <td
                      onClick={() => setRiskFilter('Critical')}
                      className={`p-3.5 border border-slate-200 cursor-pointer font-black text-sm transition ${
                        (crit === 'Mission Critical' || crit === 'Business Critical') && criticality_vs_risk_matrix[crit]['Critical'] > 0
                          ? 'bg-rose-100 text-rose-900 ring-2 ring-rose-400 font-extrabold'
                          : criticality_vs_risk_matrix[crit]['Critical'] > 0
                          ? 'bg-rose-50/70 text-rose-800'
                          : 'text-slate-300'
                      }`}
                    >
                      {interpolate(t.apm.techRiskMatrixCountApp, { count: criticality_vs_risk_matrix[crit]['Critical'] })}
                    </td>

                    {/* High Column */}
                    <td
                      onClick={() => setRiskFilter('High')}
                      className={`p-3.5 border border-slate-200 cursor-pointer font-black text-sm transition ${
                        criticality_vs_risk_matrix[crit]['High'] > 0 ? 'bg-amber-100 text-amber-900' : 'text-slate-300'
                      }`}
                    >
                      {interpolate(t.apm.techRiskMatrixCountApp, { count: criticality_vs_risk_matrix[crit]['High'] })}
                    </td>

                    {/* Medium Column */}
                    <td
                      onClick={() => setRiskFilter('Medium')}
                      className={`p-3.5 border border-slate-200 cursor-pointer font-black text-sm transition ${
                        criticality_vs_risk_matrix[crit]['Medium'] > 0 ? 'bg-yellow-100 text-yellow-900' : 'text-slate-300'
                      }`}
                    >
                      {interpolate(t.apm.techRiskMatrixCountApp, { count: criticality_vs_risk_matrix[crit]['Medium'] })}
                    </td>

                    {/* Low Column */}
                    <td
                      onClick={() => setRiskFilter('Low')}
                      className={`p-3.5 border border-slate-200 cursor-pointer font-black text-sm transition ${
                        criticality_vs_risk_matrix[crit]['Low'] > 0 ? 'bg-emerald-100 text-emerald-900' : 'text-slate-300'
                      }`}
                    >
                      {interpolate(t.apm.techRiskMatrixCountApp, { count: criticality_vs_risk_matrix[crit]['Low'] })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Explanation */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-slate-600 space-y-1">
              <p>
                <strong>{t.apm.techRiskHowCalculatedTitle}</strong> {t.apm.techRiskHowCalculatedP1}
              </p>
              <p>
                {t.apm.techRiskHowCalculatedP2}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Horizon EOL Timeline */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.apm.techRiskTimelineTitle}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.apm.techRiskTimelineSubtitle}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Expired Column */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-rose-200">
                  <span className="text-xs font-black text-rose-900 uppercase tracking-wider">{t.apm.techRiskTimelineExpired}</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-200 text-rose-900">
                    {eol_timeline_horizon.already_expired.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2 flex-1">
                  {eol_timeline_horizon.already_expired.map((tech) => (
                    <div
                      key={tech.id}
                      onClick={() => setSelectedTech(tech)}
                      className="bg-white border border-rose-200 rounded-xl p-3 shadow-xs hover:border-rose-400 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{tech.name}</span>
                        <button
                          onClick={(e) => handleEditTechClick(tech, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{interpolate(t.apm.techRiskTimelineVendor, { vendor: tech.vendor, version: tech.version })}</div>
                      <div className="mt-2 text-[11px] text-rose-700 font-bold flex items-center justify-between">
                        <span>{interpolate(t.apm.techRiskTimelineEol, { date: tech.eol_date })}</span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-100">{interpolate(t.apm.techRiskTimelineImpactedApps, { count: tech.impacted_applications_count })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expiring 6 Months */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-amber-200">
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wider">{t.apm.techRiskTimeline6Months}</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-200 text-amber-900">
                    {eol_timeline_horizon.expiring_6_months.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2 flex-1">
                  {eol_timeline_horizon.expiring_6_months.map((tech) => (
                    <div
                      key={tech.id}
                      onClick={() => setSelectedTech(tech)}
                      className="bg-white border border-amber-200 rounded-xl p-3 shadow-xs hover:border-amber-400 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{tech.name}</span>
                        <button
                          onClick={(e) => handleEditTechClick(tech, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{interpolate(t.apm.techRiskTimelineVendor, { vendor: tech.vendor, version: tech.version })}</div>
                      <div className="mt-2 text-[11px] text-amber-800 font-bold flex items-center justify-between">
                        <span>{interpolate(t.apm.techRiskTimelineEol, { date: tech.eol_date })}</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-100">{interpolate(t.apm.techRiskTimelineImpactedApps, { count: tech.impacted_applications_count })}</span>
                      </div>
                    </div>
                  ))}
                  {eol_timeline_horizon.expiring_6_months.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-6">{t.apm.techRiskTimelineNoExpiring6}</p>
                  )}
                </div>
              </div>

              {/* Expiring 12 Months */}
              <div className="bg-yellow-50/60 border border-yellow-200 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-yellow-200">
                  <span className="text-xs font-black text-yellow-900 uppercase tracking-wider">{t.apm.techRiskTimeline12Months}</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-200 text-yellow-900">
                    {eol_timeline_horizon.expiring_12_months.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2 flex-1">
                  {eol_timeline_horizon.expiring_12_months.map((tech) => (
                    <div
                      key={tech.id}
                      onClick={() => setSelectedTech(tech)}
                      className="bg-white border border-yellow-200 rounded-xl p-3 shadow-xs hover:border-yellow-400 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{tech.name}</span>
                        <button
                          onClick={(e) => handleEditTechClick(tech, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{interpolate(t.apm.techRiskTimelineVendor, { vendor: tech.vendor, version: tech.version })}</div>
                      <div className="mt-2 text-[11px] text-yellow-800 font-bold flex items-center justify-between">
                        <span>{interpolate(t.apm.techRiskTimelineEol, { date: tech.eol_date })}</span>
                        <span className="px-1.5 py-0.2 rounded bg-yellow-100">{interpolate(t.apm.techRiskTimelineImpactedApps, { count: tech.impacted_applications_count })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supported / Beyond 24 Months */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                  <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">{t.apm.techRiskTimeline24Months}</span>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-200 text-emerald-900">
                    {eol_timeline_horizon.expiring_24_months_plus.length}
                  </span>
                </div>
                <div className="mt-3 space-y-2 flex-1">
                  {eol_timeline_horizon.expiring_24_months_plus.map((tech) => (
                    <div
                      key={tech.id}
                      onClick={() => setSelectedTech(tech)}
                      className="bg-white border border-emerald-200 rounded-xl p-3 shadow-xs hover:border-emerald-400 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">{tech.name}</span>
                        <button
                          onClick={(e) => handleEditTechClick(tech, e)}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">{interpolate(t.apm.techRiskTimelineVendor, { vendor: tech.vendor, version: tech.version })}</div>
                      <div className="mt-2 text-[11px] text-emerald-800 font-bold flex items-center justify-between">
                        <span>{interpolate(t.apm.techRiskTimelineEol, { date: tech.eol_date })}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100">{interpolate(t.apm.techRiskTimelineImpactedApps, { count: tech.impacted_applications_count })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Blast Radius per Technology */}
      {activeSubTab === 'blast_radius' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.apm.techRiskBlastRadiusTitle}</h3>
              <p className="text-xs text-slate-500">
                {t.apm.techRiskBlastRadiusSubtitle}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t.apm.techRiskColTechComponent}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColVendorVersion}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColCategory}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColEolStatus}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColEolExpiration}</th>
                  <th className="py-3 px-4 text-center">{t.apm.techRiskColImpactedApps}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColMaxCriticality}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColEconomicValueAtRisk}</th>
                  <th className="py-3 px-4 text-right">{t.apm.techRiskColActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technology_blast_radius.map((tech) => (
                  <tr key={tech.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center space-x-2">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        <span>{tech.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {tech.vendor} ({tech.version})
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {tech.category}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(tech.status)}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {tech.eol_date || t.apm.techRiskEolUndefined}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                        (tech.impacted_applications_count || 0) > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {tech.impacted_applications_count}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`font-bold ${
                        tech.highest_criticality === 'Mission Critical' ? 'text-rose-600' : 'text-slate-700'
                      }`}>
                        {tech.highest_criticality}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {tech.total_impacted_annual_cost !== null && tech.total_impacted_annual_cost !== undefined ? (
                        formatEUR(tech.total_impacted_annual_cost)
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">🔒 {t.apm.confidentialCLevel}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => handleEditTechClick(tech, e)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition"
                        title={t.apm.techRiskBtnEditLifecycle}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: Dettaglio Applicazioni */}
      {activeSubTab === 'apps' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.apm.techRiskAppsTitle}</h3>
              <p className="text-xs text-slate-500">
                {t.apm.techRiskAppsSubtitle}
              </p>
            </div>

            {/* Search & Filter pills */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t.apm.techRiskSearchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-56"
                />
              </div>

              {riskFilter && (
                <button
                  onClick={() => setRiskFilter(null)}
                  className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl flex items-center space-x-1"
                >
                  <span>{interpolate(t.apm.techRiskFilterActive, { riskFilter })}</span>
                  <XCircle className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t.apm.techRiskColApplication}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColCriticality}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColTechRisk}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColRiskScore}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColEolComponents}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColConnectedStack}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColNextEol}</th>
                  <th className="py-3 px-4">{t.apm.techRiskColAnnualCost}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span>{app.name}</span>
                        <span className="text-[10px] font-normal text-slate-400">Owner: {app.business_owner}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        app.business_criticality === 'Mission Critical' ? 'bg-rose-100 text-rose-800' :
                        app.business_criticality === 'Business Critical' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {app.business_criticality}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getRiskBadge(app.tech_risk_level)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              app.composite_risk_score >= 80 ? 'bg-rose-600' :
                              app.composite_risk_score >= 50 ? 'bg-amber-500' :
                              app.composite_risk_score >= 30 ? 'bg-yellow-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${app.composite_risk_score}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-800 text-xs">{app.composite_risk_score}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {app.counts.obsolete > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {app.counts.obsolete} EOL
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {app.technologies.map((t) => (
                          <span
                            key={t.id}
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                              t.status === 'End of Life / Obsolete' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              t.status === 'Extended Support' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              t.status === 'Approaching EOL' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            {t.name}
                          </span>
                        ))}
                        {app.technologies.length === 0 && (
                          <span className="text-[10px] text-slate-400 italic">{t.apm.techRiskNoConnectedComponents}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {app.next_eol_date || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {app.annual_cost !== null && app.annual_cost !== undefined ? (
                        formatEUR(app.annual_cost)
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">🔒 {t.apm.confidentialCLevel}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Technology Lifecycle Modal */}
      {editingTech && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{t.apm.techRiskModalTitle}</h3>
                <p className="text-xs text-slate-500">{editingTech.name} ({editingTech.type})</p>
              </div>
              <button
                onClick={() => setEditingTech(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelVendor}</label>
                <input
                  type="text"
                  value={editForm.vendor || ''}
                  onChange={(e) => setEditForm({ ...editForm, vendor: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelVersion}</label>
                  <input
                    type="text"
                    value={editForm.version || ''}
                    onChange={(e) => setEditForm({ ...editForm, version: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelCategory}</label>
                  <select
                    value={editForm.category || 'Database / RDBMS'}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                  >
                    <option value="Database / RDBMS">Database / RDBMS</option>
                    <option value="Runtime & Programming Language">Runtime & Programming Language</option>
                    <option value="Middleware & Messaging">Middleware & Messaging</option>
                    <option value="Operating System">Operating System</option>
                    <option value="Container & Kubernetes">Container & Kubernetes</option>
                    <option value="Application Server / Web Server">Application Server / Web Server</option>
                    <option value="Mainframe Software & OS">Mainframe Software & OS</option>
                    <option value="Virtualization & Cloud">Virtualization & Cloud</option>
                    <option value="In-Memory Cache & NoSQL">In-Memory Cache & NoSQL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelStatus}</label>
                <select
                  value={editForm.status || 'Supported'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="Supported">{t.apm.techRiskModalStatusSupported}</option>
                  <option value="Approaching EOL">{t.apm.techRiskModalStatusApproaching}</option>
                  <option value="Extended Support">{t.apm.techRiskModalStatusExtended}</option>
                  <option value="End of Life / Obsolete">{t.apm.techRiskModalStatusObsolete}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelEol}</label>
                  <input
                    type="date"
                    value={editForm.eol_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, eol_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelEoes}</label>
                  <input
                    type="date"
                    value={editForm.eoes_date || ''}
                    onChange={(e) => setEditForm({ ...editForm, eoes_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t.apm.techRiskModalLabelCve}</label>
                <select
                  value={editForm.cve_risk || 'Low / Negligible'}
                  onChange={(e) => setEditForm({ ...editForm, cve_risk: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="Low / Negligible">Low / Negligible</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical / Active Exploits">Critical / Active Exploits</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingTech(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
              >
                {t.apm.techRiskModalBtnCancel}
              </button>
              <button
                onClick={handleSaveTechEdit}
                disabled={savingTech}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
              >
                {savingTech ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{t.apm.techRiskModalBtnSave}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
