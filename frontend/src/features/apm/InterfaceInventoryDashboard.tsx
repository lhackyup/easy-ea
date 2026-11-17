import React, { useState, useEffect, useMemo } from 'react';
import {
  Network,
  Share2,
  ArrowRight,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Layers,
  Shield,
  Activity,
  Check,
  X,
  ExternalLink,
  Edit2,
  Database,
  Lock,
  Clock,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import { InterfaceInventoryData, InterfaceItem, ApplicationInfo } from '../../types';

interface InterfaceInventoryDashboardProps {
  modelId: string;
  applications?: ApplicationInfo[];
  onRefreshParent?: () => void;
}

export const InterfaceInventoryDashboard: React.FC<InterfaceInventoryDashboardProps> = ({
  modelId,
  applications = [],
  onRefreshParent
}) => {
  const { t, language, interpolate } = useLanguage();

  const [data, setData] = useState<InterfaceInventoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedProtocol, setSelectedProtocol] = useState<string>('all');
  const [selectedPattern, setSelectedPattern] = useState<string>('all');
  const [selectedCriticality, setSelectedCriticality] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Detail / Edit modal
  const [selectedInterface, setSelectedInterface] = useState<InterfaceItem | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<Partial<InterfaceItem>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'overview' | 'technical' | 'security' | 'schemas'>('overview');

  // Create interface modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    source_id: '',
    target_id: '',
    protocol: 'REST API / JSON',
    pattern: 'Synchronous',
    data_format: 'JSON Payload',
    criticality: 'Business Critical',
    frequency: 'Real-time',
    security_auth: 'OAuth 2.0 / JWT',
    data_classification: 'Internal',
    status: 'Live',
    documentation: ''
  });
  const [creating, setCreating] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getInterfaceInventory(modelId);
      setData(res);
    } catch (err: any) {
      console.error('Failed to load interface inventory:', err);
      setError(err?.message || t.apm.interfacesErrorDefault);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modelId) {
      loadData();
    }
  }, [modelId]);

  // Protocols & Patterns lists for dropdowns
  const availableProtocols = useMemo(() => {
    if (!data?.interfaces) return [];
    const set = new Set<string>();
    data.interfaces.forEach((i) => {
      if (i.protocol) set.add(i.protocol);
    });
    return Array.from(set).sort();
  }, [data]);

  const availablePatterns = useMemo(() => {
    if (!data?.interfaces) return [];
    const set = new Set<string>();
    data.interfaces.forEach((i) => {
      if (i.pattern) set.add(i.pattern);
    });
    return Array.from(set).sort();
  }, [data]);

  const availableCriticalities = useMemo(() => {
    if (!data?.interfaces) return [];
    const set = new Set<string>();
    data.interfaces.forEach((i) => {
      if (i.criticality) set.add(i.criticality);
    });
    return Array.from(set).sort();
  }, [data]);

  const availableStatuses = useMemo(() => {
    if (!data?.interfaces) return [];
    const set = new Set<string>();
    data.interfaces.forEach((i) => {
      if (i.status) set.add(i.status);
    });
    return Array.from(set).sort();
  }, [data]);

  // Filtered interfaces
  const filteredInterfaces = useMemo(() => {
    if (!data?.interfaces) return [];
    return data.interfaces.filter((item) => {
      if (selectedProtocol !== 'all' && item.protocol !== selectedProtocol) return false;
      if (selectedPattern !== 'all' && item.pattern !== selectedPattern) return false;
      if (selectedCriticality !== 'all' && item.criticality !== selectedCriticality) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const docMatch = (item.documentation || '').toLowerCase().includes(q);
        const srcMatch = (item.source_app?.name || '').toLowerCase().includes(q);
        const tgtMatch = (item.target_app?.name || '').toLowerCase().includes(q);
        const protoMatch = (item.protocol || '').toLowerCase().includes(q);
        const dataMatch = (item.data_format || '').toLowerCase().includes(q);
        if (!nameMatch && !docMatch && !srcMatch && !tgtMatch && !protoMatch && !dataMatch) {
          return false;
        }
      }
      return true;
    });
  }, [data, selectedProtocol, selectedPattern, selectedCriticality, selectedStatus, search]);

  const hasActiveFilters =
    selectedProtocol !== 'all' ||
    selectedPattern !== 'all' ||
    selectedCriticality !== 'all' ||
    selectedStatus !== 'all' ||
    search.trim() !== '';

  const clearFilters = () => {
    setSelectedProtocol('all');
    setSelectedPattern('all');
    setSelectedCriticality('all');
    setSelectedStatus('all');
    setSearch('');
  };

  // Open detail modal
  const handleOpenDetail = (item: InterfaceItem) => {
    setSelectedInterface(item);
    setEditForm({
      name: item.name,
      documentation: item.documentation,
      protocol: item.protocol,
      pattern: item.pattern,
      data_format: item.data_format,
      criticality: item.criticality,
      frequency: item.frequency,
      security_auth: item.security_auth,
      data_classification: item.data_classification,
      status: item.status
    });
    setIsEditing(false);
    setModalTab('overview');
  };

  const handleCloseDetail = () => {
    setSelectedInterface(null);
    setIsEditing(false);
  };

  const handleSaveInterface = async () => {
    if (!selectedInterface) return;
    setSaving(true);
    try {
      await api.updateInterfaceAttributes(selectedInterface.id, editForm);
      await loadData();
      onRefreshParent?.();
      setSelectedInterface((prev) => (prev ? { ...prev, ...editForm } as InterfaceItem : null));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update interface:', err);
      alert(t.apm.interfacesSaveError);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInterface = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.source_id || !createForm.target_id || !createForm.name.trim()) return;
    setCreating(true);
    try {
      await api.createInterface(modelId, createForm);
      await loadData();
      onRefreshParent?.();
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        source_id: '',
        target_id: '',
        protocol: 'REST API / JSON',
        pattern: 'Synchronous',
        data_format: 'JSON Payload',
        criticality: 'Business Critical',
        frequency: 'Real-time',
        security_auth: 'OAuth 2.0 / JWT',
        data_classification: 'Internal',
        status: 'Live',
        documentation: ''
      });
    } catch (err) {
      console.error('Failed to create interface:', err);
      alert(t.apm.interfacesCreateError);
    } finally {
      setCreating(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (!filteredInterfaces.length) return;
    const headers = [
      t.apm.interfacesCsvColId,
      t.apm.interfacesCsvColName,
      t.apm.interfacesCsvColKind,
      t.apm.interfacesCsvColSource,
      t.apm.interfacesCsvColTarget,
      t.apm.interfacesCsvColProtocol,
      t.apm.interfacesCsvColPattern,
      t.apm.interfacesCsvColDataFormat,
      t.apm.interfacesCsvColCriticality,
      t.apm.interfacesCsvColFrequency,
      t.apm.interfacesCsvColSecurity,
      t.apm.interfacesCsvColClassification,
      t.apm.interfacesCsvColStatus,
      t.apm.interfacesCsvColSchemasCount
    ];

    const rows = filteredInterfaces.map((item) => [
      `"${item.id}"`,
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${item.kind === 'application_flow' ? t.apm.interfacesDetailFlowKind : t.apm.interfacesDetailElementKind}"`,
      `"${(item.source_app?.name || '').replace(/"/g, '""')}"`,
      `"${(item.target_app?.name || '').replace(/"/g, '""')}"`,
      `"${(item.protocol || '').replace(/"/g, '""')}"`,
      `"${(item.pattern || '').replace(/"/g, '""')}"`,
      `"${(item.data_format || '').replace(/"/g, '""')}"`,
      `"${(item.criticality || '').replace(/"/g, '""')}"`,
      `"${(item.frequency || '').replace(/"/g, '""')}"`,
      `"${(item.security_auth || '').replace(/"/g, '""')}"`,
      `"${(item.data_classification || '').replace(/"/g, '""')}"`,
      `"${(item.status || '').replace(/"/g, '""')}"`,
      item.schemas_count || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `EasyEA_Interfaces_Inventory_${modelId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper badge styles
  const getProtocolBadge = (protocol: string) => {
    if (protocol.includes('Kafka') || protocol.includes('Stream')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (protocol.includes('REST') || protocol.includes('JSON')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (protocol.includes('ISO') || protocol.includes('SWIFT')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (protocol.includes('Database') || protocol.includes('JDBC')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (protocol.includes('Batch') || protocol.includes('Pipeline')) {
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getCriticalityBadge = (criticality: string) => {
    switch (criticality) {
      case 'Mission Critical':
        return 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold';
      case 'Business Critical':
        return 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
      case 'Operational':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getPatternBadge = (pattern: string) => {
    switch (pattern) {
      case 'Synchronous':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'Asynchronous':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Batch':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">{t.apm.interfacesLoading}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-rose-900">{t.apm.interfacesErrorTitle}</h3>
        <p className="text-xs text-rose-700 max-w-md mx-auto">{error}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
        >
          {t.apm.interfacesRetry}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">{t.apm.interfacesTitle}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{t.apm.interfacesSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t.apm.interfacesAddBtn}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredInterfaces.length === 0}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{t.apm.interfacesExportCsv}</span>
          </button>

          <button
            onClick={loadData}
            title={t.apm.tcoReloadData}
            className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.apm.interfacesKpiTotal}</span>
              <Share2 className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900">{data.summary.total_interfaces}</span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-medium">{t.apm.interfacesElementsLabel}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.apm.interfacesKpiApps}</span>
              <Layers className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-900">{data.summary.unique_applications}</span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-medium">{t.apm.interfacesAppsConnected}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.apm.interfacesKpiSync}</span>
              <Zap className="w-4 h-4 text-sky-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-sky-700">{data.summary.patterns_breakdown['Synchronous'] || 0}</span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-medium">API REST / RPC</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.apm.interfacesKpiAsync}</span>
              <Activity className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-indigo-700">
                {(data.summary.patterns_breakdown['Asynchronous'] || 0) + (data.summary.patterns_breakdown['Batch'] || 0)}
              </span>
              <span className="text-[11px] text-slate-400 ml-1.5 font-medium">Kafka / Queue</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t.apm.interfacesKpiMissionCritical}</span>
              <Shield className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-700">{data.summary.criticality_breakdown['Mission Critical'] || 0}</span>
              <span className="text-[11px] text-rose-500 ml-1.5 font-bold uppercase tracking-wider">Tier 1</span>
            </div>
          </div>
        </div>
      )}

      {/* Search & Multi-Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Free search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.apm.interfacesSearchPlaceholder}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Protocol */}
            <select
              value={selectedProtocol}
              onChange={(e) => setSelectedProtocol(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t.apm.interfacesFilterProtocol}</option>
              {availableProtocols.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Pattern */}
            <select
              value={selectedPattern}
              onChange={(e) => setSelectedPattern(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t.apm.interfacesFilterPattern}</option>
              {availablePatterns.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>

            {/* Criticality */}
            <select
              value={selectedCriticality}
              onChange={(e) => setSelectedCriticality(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t.apm.interfacesFilterCriticality}</option>
              {availableCriticalities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t.apm.interfacesFilterStatus}</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center space-x-1 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t.apm.interfacesClearFilters}</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            {interpolate(t.apm.interfacesCountBadge, {
              filtered: filteredInterfaces.length,
              total: data?.interfaces?.length || 0
            })}
          </span>
        </div>
      </div>

      {/* Interfaces Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-3 px-4">{t.apm.interfacesColName}</th>
                <th className="py-3 px-4">{t.apm.interfacesColProvider}</th>
                <th className="py-3 px-2 text-center"></th>
                <th className="py-3 px-4">{t.apm.interfacesColConsumer}</th>
                <th className="py-3 px-3">{t.apm.interfacesColProtocol}</th>
                <th className="py-3 px-3">{t.apm.interfacesColPattern}</th>
                <th className="py-3 px-3">{t.apm.interfacesColData}</th>
                <th className="py-3 px-3">{t.apm.interfacesColCriticality}</th>
                <th className="py-3 px-3 text-center">{t.apm.interfacesColSchemas}</th>
                <th className="py-3 px-4 text-right">{t.apm.interfacesColActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredInterfaces.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 font-medium">
                    {t.apm.interfacesEmptyState}
                  </td>
                </tr>
              ) : (
                filteredInterfaces.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    {/* Interface Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-indigo-600 transition">
                      <div className="flex flex-col">
                        <span>{item.name}</span>
                        {item.documentation && (
                          <span className="text-[11px] font-normal text-slate-400 line-clamp-1 mt-0.5">
                            {item.documentation}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Source Provider */}
                    <td className="py-3.5 px-4">
                      {item.source_app ? (
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="font-semibold text-slate-800 line-clamp-1">{item.source_app.name}</span>
                            {item.source_app.app_code && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                                {item.source_app.app_code}
                              </span>
                            )}
                          </div>
                          {item.source_app.component_name && (
                            <span className="text-[10px] text-slate-400 pl-4 font-mono truncate">
                              {item.source_app.component_name.includes('[')
                                ? item.source_app.component_name.split('[').pop()?.replace(']', '')
                                : item.source_app.component_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">{t.apm.interfacesUnspecified}</span>
                      )}
                    </td>

                    {/* Arrow */}
                    <td className="py-3.5 px-2 text-center text-slate-300">
                      <ArrowRight className="w-3.5 h-3.5 mx-auto text-slate-400" />
                    </td>

                    {/* Target Consumer */}
                    <td className="py-3.5 px-4">
                      {item.target_app ? (
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <span className="font-semibold text-slate-800 line-clamp-1">{item.target_app.name}</span>
                            {item.target_app.app_code && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded">
                                {item.target_app.app_code}
                              </span>
                            )}
                          </div>
                          {item.target_app.component_name && (
                            <span className="text-[10px] text-slate-400 pl-4 font-mono truncate">
                              {item.target_app.component_name.includes('[')
                                ? item.target_app.component_name.split('[').pop()?.replace(']', '')
                                : item.target_app.component_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">{t.apm.interfacesUnspecified}</span>
                      )}
                    </td>

                    {/* Protocol */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${getProtocolBadge(item.protocol)}`}>
                        {item.protocol}
                      </span>
                    </td>

                    {/* Pattern */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${getPatternBadge(item.pattern)}`}>
                        {item.pattern}
                      </span>
                    </td>

                    {/* Data format */}
                    <td className="py-3.5 px-3 font-medium text-slate-600 text-[11px]">
                      <span className="line-clamp-1">{item.data_format}</span>
                    </td>

                    {/* Criticality */}
                    <td className="py-3.5 px-3">
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] ${getCriticalityBadge(item.criticality)}`}>
                        {item.criticality}
                      </span>
                    </td>

                    {/* Schemas count */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                        <Layers className="w-3 h-3 text-slate-500" />
                        <span>{item.schemas_count}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(item);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-100 transition"
                      >
                        {t.apm.interfacesBtnEdit}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Edit Modal with fixed dimensions to prevent jumping */}
      {selectedInterface && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 h-[88vh] max-h-[850px] min-h-[600px] w-full max-w-4xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shrink-0">
                  <Network className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black text-slate-900 truncate">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="px-2 py-1 border border-indigo-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        selectedInterface.name
                      )}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                      {selectedInterface.kind === 'application_flow'
                        ? t.apm.interfacesDetailFlowKind
                        : t.apm.interfacesDetailElementKind}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{selectedInterface.id}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{t.apm.interfacesBtnEdit}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveInterface}
                      disabled={saving}
                      className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{saving ? t.common.loading : t.apm.interfacesBtnSave}</span>
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                    >
                      {t.apm.interfacesBtnCancel}
                    </button>
                  </>
                )}
                <button
                  onClick={handleCloseDetail}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs Bar */}
            <div className="px-6 border-b border-slate-200 bg-white flex space-x-4 shrink-0">
              <button
                onClick={() => setModalTab('overview')}
                className={`py-3 text-xs font-bold border-b-2 transition ${
                  modalTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.apm.interfacesDetailGeneral}
              </button>
              <button
                onClick={() => setModalTab('technical')}
                className={`py-3 text-xs font-bold border-b-2 transition ${
                  modalTab === 'technical'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.apm.interfacesDetailIntegration}
              </button>
              <button
                onClick={() => setModalTab('security')}
                className={`py-3 text-xs font-bold border-b-2 transition ${
                  modalTab === 'security'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.apm.interfacesDetailSecurity}
              </button>
              <button
                onClick={() => setModalTab('schemas')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
                  modalTab === 'schemas'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <span>{t.apm.interfacesDetailDiagrams}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                  {selectedInterface.schemas_count}
                </span>
              </button>
            </div>

            {/* Modal Body with internal scrolling */}
            <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-6">
              {/* Overview Tab */}
              {modalTab === 'overview' && (
                <div className="space-y-6">
                  {/* Provider & Consumer Connection Card */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      {/* Provider */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {t.apm.interfacesSourceApp}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                          <h4 className="font-bold text-slate-900 text-sm">
                            {selectedInterface.source_app?.name || t.apm.interfacesUnspecified}
                          </h4>
                        </div>
                        {selectedInterface.source_app?.component_name && (
                          <p className="text-[11px] text-slate-400 font-mono">
                            {selectedInterface.source_app.component_name}
                          </p>
                        )}
                        {selectedInterface.source_app?.app_code && (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                            Code: {selectedInterface.source_app.app_code}
                          </span>
                        )}
                      </div>

                      {/* Consumer */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {t.apm.interfacesTargetApp}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                          <h4 className="font-bold text-slate-900 text-sm">
                            {selectedInterface.target_app?.name || t.apm.interfacesUnspecified}
                          </h4>
                        </div>
                        {selectedInterface.target_app?.component_name && (
                          <p className="text-[11px] text-slate-400 font-mono">
                            {selectedInterface.target_app.component_name}
                          </p>
                        )}
                        {selectedInterface.target_app?.app_code && (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md">
                            Code: {selectedInterface.target_app.app_code}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Documentation / Description */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldDoc}</label>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        value={editForm.documentation || ''}
                        onChange={(e) => setEditForm({ ...editForm, documentation: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Architectural purpose, endpoints, data contract..."
                      />
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {selectedInterface.documentation || t.apm.interfacesNoDocumentation}
                      </div>
                    )}
                  </div>

                  {/* Status & Criticality Quick Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{t.apm.interfacesFieldProtocol}</span>
                      <div className="text-xs font-bold text-slate-800 mt-1">{selectedInterface.protocol}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{t.apm.interfacesFieldPattern}</span>
                      <div className="text-xs font-bold text-slate-800 mt-1">{selectedInterface.pattern}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{t.apm.interfacesFieldCriticality}</span>
                      <div className="text-xs font-bold text-slate-800 mt-1">{selectedInterface.criticality}</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{t.apm.interfacesFieldStatus}</span>
                      <div className="text-xs font-bold text-emerald-700 mt-1">{selectedInterface.status}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical / Integration Tab */}
              {modalTab === 'technical' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldProtocol}</label>
                    {isEditing ? (
                      <select
                        value={editForm.protocol || ''}
                        onChange={(e) => setEditForm({ ...editForm, protocol: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="REST API / JSON">REST API / JSON</option>
                        <option value="Kafka / Event Stream">Kafka / Event Stream</option>
                        <option value="ISO 20022 / Messaging">ISO 20022 / Messaging</option>
                        <option value="Batch / Data Pipeline">Batch / Data Pipeline</option>
                        <option value="Database / JDBC">Database / JDBC</option>
                        <option value="GraphQL">GraphQL</option>
                        <option value="gRPC / Protobuf">gRPC / Protobuf</option>
                        <option value="SOAP / XML">SOAP / XML</option>
                        <option value="SFTP / File Transfer">SFTP / File Transfer</option>
                        <option value="MQ / JMS">MQ / JMS</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {selectedInterface.protocol}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldPattern}</label>
                    {isEditing ? (
                      <select
                        value={editForm.pattern || ''}
                        onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Synchronous">Synchronous (Request-Response)</option>
                        <option value="Asynchronous">Asynchronous (Publish-Subscribe / Event-Driven)</option>
                        <option value="Batch">Batch (Scheduled ETL / File Exchange)</option>
                        <option value="Event-Driven">Event-Driven (Webhook / Streaming)</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {selectedInterface.pattern}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldDataFormat}</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.data_format || ''}
                        onChange={(e) => setEditForm({ ...editForm, data_format: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. JSON Payload, pacs.008 XML, Protobuf"
                      />
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800">
                        {selectedInterface.data_format}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldFrequency}</label>
                    {isEditing ? (
                      <select
                        value={editForm.frequency || ''}
                        onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Real-time">Real-time (&lt; 100ms)</option>
                        <option value="Near Real-time">Near Real-time (&lt; 5s)</option>
                        <option value="Hourly">Hourly</option>
                        <option value="Daily Batch">Daily Batch</option>
                        <option value="Weekly Batch">Weekly Batch</option>
                        <option value="On Demand">On Demand / Ad-Hoc</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800">
                        {selectedInterface.frequency}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Security & Governance Tab */}
              {modalTab === 'security' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldCriticality}</label>
                    {isEditing ? (
                      <select
                        value={editForm.criticality || ''}
                        onChange={(e) => setEditForm({ ...editForm, criticality: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Mission Critical">Mission Critical (Tier 1)</option>
                        <option value="Business Critical">Business Critical (Tier 2)</option>
                        <option value="Operational">Operational (Tier 3)</option>
                        <option value="Low">Low / Administrative</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {selectedInterface.criticality}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldSecurity}</label>
                    {isEditing ? (
                      <select
                        value={editForm.security_auth || ''}
                        onChange={(e) => setEditForm({ ...editForm, security_auth: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="OAuth 2.0 / JWT">OAuth 2.0 / JWT Bearer</option>
                        <option value="mTLS / Hardware Token">mTLS (Mutual TLS) / Certificate</option>
                        <option value="API Key / Token">API Key / Token</option>
                        <option value="SASL / SCRAM">SASL / SCRAM (Kafka Auth)</option>
                        <option value="Basic Auth / LDAP">Basic Auth / LDAP</option>
                        <option value="IP Whitelist / VPN">IP Whitelist / VPN Tunnel</option>
                        <option value="None / Internal">None / Internal VPC</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {selectedInterface.security_auth}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldClassification}</label>
                    {isEditing ? (
                      <select
                        value={editForm.data_classification || ''}
                        onChange={(e) => setEditForm({ ...editForm, data_classification: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Confidential / PII">Confidential / PII (GDPR / Banking Secrets)</option>
                        <option value="Restricted">Restricted / Financial Transaction Data</option>
                        <option value="Internal">Internal Corporate Data</option>
                        <option value="Public">Public Data</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {selectedInterface.data_classification}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldStatus}</label>
                    {isEditing ? (
                      <select
                        value={editForm.status || ''}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Live">Live / In Production</option>
                        <option value="In Development">In Development</option>
                        <option value="Deprecated">Deprecated / Phase Out</option>
                        <option value="Retired">Retired</option>
                      </select>
                    ) : (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                        {selectedInterface.status}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Schemas / Traceability Tab */}
              {modalTab === 'schemas' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    {interpolate(t.apm.interfacesSchemasCount, { count: selectedInterface.schemas_count })}:
                  </p>
                  {selectedInterface.used_in_schemas?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedInterface.used_in_schemas.map((schema) => (
                        <div
                          key={schema.id}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3"
                        >
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-slate-900 truncate">{schema.name}</h5>
                            <span className="text-[10px] font-semibold text-slate-400">Viewpoint: {schema.viewpoint}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                      {t.apm.interfacesNoSchemas}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register New Interface Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">{t.apm.interfacesCreateTitle}</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInterface} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldName} *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. FX Settlement Stream, Real-time Customer Verification"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t.apm.interfacesSelectSource} *</label>
                  <select
                    required
                    value={createForm.source_id}
                    onChange={(e) => setCreateForm({ ...createForm, source_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- {t.apm.interfacesSelectSource} --</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t.apm.interfacesSelectTarget} *</label>
                  <select
                    required
                    value={createForm.target_id}
                    onChange={(e) => setCreateForm({ ...createForm, target_id: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- {t.apm.interfacesSelectTarget} --</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldProtocol}</label>
                  <select
                    value={createForm.protocol}
                    onChange={(e) => setCreateForm({ ...createForm, protocol: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="REST API / JSON">REST API / JSON</option>
                    <option value="Kafka / Event Stream">Kafka / Event Stream</option>
                    <option value="ISO 20022 / Messaging">ISO 20022 / Messaging</option>
                    <option value="Batch / Data Pipeline">Batch / Data Pipeline</option>
                    <option value="Database / JDBC">Database / JDBC</option>
                    <option value="GraphQL">GraphQL</option>
                    <option value="gRPC / Protobuf">gRPC / Protobuf</option>
                    <option value="SOAP / XML">SOAP / XML</option>
                    <option value="SFTP / File Transfer">SFTP / File Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldPattern}</label>
                  <select
                    value={createForm.pattern}
                    onChange={(e) => setCreateForm({ ...createForm, pattern: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Synchronous">Synchronous</option>
                    <option value="Asynchronous">Asynchronous</option>
                    <option value="Batch">Batch</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldCriticality}</label>
                  <select
                    value={createForm.criticality}
                    onChange={(e) => setCreateForm({ ...createForm, criticality: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Mission Critical">Mission Critical</option>
                    <option value="Business Critical">Business Critical</option>
                    <option value="Operational">Operational</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">{t.apm.interfacesFieldDoc}</label>
                <textarea
                  rows={2}
                  value={createForm.documentation}
                  onChange={(e) => setCreateForm({ ...createForm, documentation: e.target.value })}
                  placeholder="Architectural description..."
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  {t.apm.interfacesBtnCancel}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  {creating ? t.common.loading : t.apm.interfacesCreateBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
