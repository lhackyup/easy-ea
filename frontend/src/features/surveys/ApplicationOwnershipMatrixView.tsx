import React, { useState, useEffect } from 'react';
import { ApplicationOwnershipRow, OwnershipMatrixResponse } from '../../types';
import { api } from '../../lib/api';
import { UserAutocomplete } from '../../components/common/UserAutocomplete';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Users,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Layers,
  Search,
  UserPlus,
  X,
  Building,
  GitBranch,
  User as UserIcon,
} from 'lucide-react';

interface ApplicationOwnershipMatrixViewProps {
  selectedModelId: string;
}

export type OwnershipScope = 'all' | 'applications' | 'processes';

export const ApplicationOwnershipMatrixView: React.FC<ApplicationOwnershipMatrixViewProps> = ({ selectedModelId }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OwnershipMatrixResponse | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);

  // Scope: All, Applications, Business Processes
  const [activeScope, setActiveScope] = useState<OwnershipScope>('all');

  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Assignment Modal
  const [selectedItemForAssignment, setSelectedItemForAssignment] = useState<ApplicationOwnershipRow | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignType, setAssignType] = useState<string>('technical_owner');
  const [assignNotes, setAssignNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userRoles = new Set((user?.assignments || []).map((a) => a.role));
  const canManageOwnership = userRoles.has('admin') || userRoles.has('architect') || userRoles.has('lead_architect');

  useEffect(() => {
    loadMatrix();
    loadUsers();
  }, [selectedModelId]);

  const loadMatrix = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getOwnershipMatrix(selectedModelId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento della matrice di ownership');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.getUsers();
      setUsersList(res || []);
    } catch {
      // Non-admins might not be able to list all users; fallback gracefully
    }
  };

  const handleOpenAssignModal = (item: ApplicationOwnershipRow) => {
    setSelectedItemForAssignment(item);
    setAssignUserId(usersList[0]?.id || '');
    if (item.type === 'BusinessProcess') {
      setAssignType('process_owner');
    } else {
      setAssignType('technical_owner');
    }
    setAssignNotes('');
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForAssignment || !assignUserId) return;

    try {
      setSubmitting(true);
      await api.assignApplicationOwner(selectedItemForAssignment.id, {
        user_id: assignUserId,
        ownership_type: assignType,
        notes: assignNotes || undefined
      });
      setSelectedItemForAssignment(null);
      await loadMatrix();
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'assegnazione dell\'owner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveOwner = async (elementId: string, ownerUserId: string) => {
    if (!window.confirm(t.governance.removeConfirm)) return;
    try {
      await api.removeApplicationOwner(elementId, ownerUserId);
      await loadMatrix();
    } catch (err: any) {
      alert(err.message || 'Errore durante la rimozione dell\'owner');
    }
  };

  // Determine current elements based on scope
  const scopedItems: ApplicationOwnershipRow[] = React.useMemo(() => {
    if (!data) return [];
    if (activeScope === 'applications') return data.applications || [];
    if (activeScope === 'processes') return data.processes || [];
    return data.elements || [...(data.applications || []), ...(data.processes || [])];
  }, [data, activeScope]);

  const filteredItems = scopedItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.owners.some(
        (o) =>
          (o.full_name && o.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (o.username && o.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (o.email && o.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );

    if (!matchesSearch) return false;

    if (filterType === 'assigned') return item.has_owner;
    if (filterType === 'unassigned') return !item.has_owner;
    return true;
  });

  // Calculate scope-specific KPIs
  const kpiTotal = activeScope === 'applications'
    ? (data?.total_applications || 0)
    : activeScope === 'processes'
      ? (data?.total_processes || 0)
      : (data?.total_elements || ((data?.total_applications || 0) + (data?.total_processes || 0)));

  const kpiAssigned = activeScope === 'applications'
    ? (data?.assigned_applications ?? data?.assigned_count ?? 0)
    : activeScope === 'processes'
      ? (data?.assigned_processes ?? 0)
      : (data?.assigned_count || 0);

  const kpiUnassigned = activeScope === 'applications'
    ? (data?.unassigned_applications ?? data?.unassigned_count ?? 0)
    : activeScope === 'processes'
      ? (data?.unassigned_processes ?? 0)
      : (data?.unassigned_count || 0);

  const kpiCoverage = activeScope === 'applications'
    ? (data?.coverage_applications ?? data?.coverage_percentage ?? 0)
    : activeScope === 'processes'
      ? (data?.coverage_processes ?? 0)
      : (data?.coverage_percentage || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 flex items-center space-x-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{t.governance.ownershipTitle}</h1>
              <p className="text-xs text-slate-500">{t.governance.ownershipSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Scope Switcher: All | Applications | Business Processes */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/60 self-start md:self-auto">
          <button
            onClick={() => setActiveScope('all')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeScope === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.governance.scopeAll} ({data?.total_elements || scopedItems.length})</span>
          </button>
          <button
            onClick={() => setActiveScope('applications')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeScope === 'applications'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-600 hover:text-amber-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>{t.governance.scopeApps} ({data?.total_applications || 0})</span>
          </button>
          <button
            onClick={() => setActiveScope('processes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeScope === 'processes'
                ? 'bg-white text-indigo-900 shadow-2xs'
                : 'text-slate-600 hover:text-indigo-900'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>{t.governance.scopeProcesses} ({data?.total_processes || 0})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Elements in Scope */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              {activeScope === 'applications'
                ? t.governance.totalApps
                : activeScope === 'processes'
                  ? t.governance.totalProcesses
                  : t.governance.totalElements}
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">{kpiTotal}</div>
          </div>
          <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
            {activeScope === 'processes' ? <GitBranch className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
          </div>
        </div>

        {/* Assigned */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              {activeScope === 'processes' ? t.governance.assignedProcesses : t.governance.assignedApps}
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{kpiAssigned}</div>
          </div>
          <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Unassigned / Orphans */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">
              {activeScope === 'processes' ? t.governance.unassignedProcesses : t.governance.unassignedApps}
            </span>
            <div className="text-2xl font-black text-amber-600 mt-1">{kpiUnassigned}</div>
          </div>
          <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Coverage Percentage */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500">{t.governance.coverageRate}</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{kpiCoverage}%</div>
            <div className="w-24 bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(kpiCoverage, 100)}%` }}
              />
            </div>
          </div>
          <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.governance.filterAll} ({scopedItems.length})
          </button>
          <button
            onClick={() => setFilterType('assigned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'assigned'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-emerald-700'
            }`}
          >
            {t.governance.filterAssigned} ({scopedItems.filter(i => i.has_owner).length})
          </button>
          <button
            onClick={() => setFilterType('unassigned')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'unassigned'
                ? 'bg-white text-amber-700 shadow-2xs'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            {t.governance.filterUnassigned} ({scopedItems.filter(i => !i.has_owner).length})
          </button>
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.governance.searchPlaceholder}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Elements Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">
                  {activeScope === 'applications'
                    ? t.governance.colAppName
                    : activeScope === 'processes'
                      ? t.governance.colProcessName
                      : t.governance.colElementName}
                </th>
                <th className="px-4 py-3.5">{t.governance.colType}</th>
                <th className="px-4 py-3.5">
                  {activeScope === 'processes'
                    ? t.governance.colProcessOwner
                    : activeScope === 'applications'
                      ? t.governance.colBusinessOwner
                      : t.governance.colPrimaryOwner}
                </th>
                <th className="px-4 py-3.5">
                  {activeScope === 'processes'
                    ? t.governance.colProcessManager
                    : activeScope === 'applications'
                      ? t.governance.colTechnicalOwner
                      : t.governance.colSecondaryOwner}
                </th>
                <th className="px-4 py-3.5 text-right">{t.governance.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    {t.governance.noElementsFound}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isProcess = item.type === 'BusinessProcess';
                  
                  // Primary owners: business_owner or process_owner
                  const primaryOwners = item.owners.filter(
                    (o) => o.ownership_type === 'business_owner' || o.ownership_type === 'process_owner'
                  );

                  // Secondary owners: technical_owner or process_manager
                  const secondaryOwners = item.owners.filter(
                    (o) => o.ownership_type === 'technical_owner' || o.ownership_type === 'process_manager'
                  );

                  // Delegates
                  const delegateOwners = item.owners.filter((o) => o.ownership_type === 'delegate');

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        <div className="flex items-center space-x-2.5">
                          {isProcess ? (
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                              <GitBranch className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <span className="block">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ID: {item.id} • {item.layer || (isProcess ? 'Business' : 'Application')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            isProcess
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {primaryOwners.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {primaryOwners.map((bo) => (
                              <span
                                key={bo.id}
                                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                                  isProcess
                                    ? 'bg-indigo-50 text-indigo-800 border border-indigo-200/60'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                }`}
                              >
                                <UserIcon className="w-3 h-3 text-amber-600" />
                                <span>{bo.full_name || bo.username}</span>
                                {canManageOwnership && (
                                  <button
                                    onClick={() => handleRemoveOwner(item.id, bo.user_id)}
                                    className="text-amber-500 hover:text-rose-600 transition ml-1"
                                    title="Rimuovi"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (item.legacy_business_owner || item.legacy_process_owner) ? (
                          <span className="text-[11px] text-slate-600 italic">
                            {item.legacy_business_owner || item.legacy_process_owner} (legacy)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {t.governance.noOwnerBadge}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {secondaryOwners.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {secondaryOwners.map((to) => (
                              <span
                                key={to.id}
                                className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200/60"
                              >
                                <UserIcon className="w-3 h-3 text-blue-600" />
                                <span>{to.full_name || to.username}</span>
                                {canManageOwnership && (
                                  <button
                                    onClick={() => handleRemoveOwner(item.id, to.user_id)}
                                    className="text-blue-500 hover:text-rose-600 transition ml-1"
                                    title="Rimuovi"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (item.legacy_technical_owner || item.legacy_process_manager) ? (
                          <span className="text-[11px] text-slate-600 italic">
                            {item.legacy_technical_owner || item.legacy_process_manager} (legacy)
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {t.governance.noOwnerBadge}
                          </span>
                        )}

                        {/* Delegate owners badge if present */}
                        {delegateOwners.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {delegateOwners.map((d) => (
                              <span
                                key={d.id}
                                className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                <span>{d.full_name || d.username} (del.)</span>
                                {canManageOwnership && (
                                  <button
                                    onClick={() => handleRemoveOwner(item.id, d.user_id)}
                                    className="text-slate-400 hover:text-rose-600 ml-0.5"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {canManageOwnership && (
                          <button
                            onClick={() => handleOpenAssignModal(item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{item.has_owner ? t.governance.editOwnerBtn : t.governance.assignOwnerBtn}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Owner Modal */}
      {selectedItemForAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  selectedItemForAssignment.type === 'BusinessProcess'
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  {selectedItemForAssignment.type === 'BusinessProcess' ? (
                    <GitBranch className="w-4 h-4" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t.governance.modalTitle} {selectedItemForAssignment.name}
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {selectedItemForAssignment.type === 'BusinessProcess'
                      ? t.governance.colProcessName
                      : t.governance.colAppName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedItemForAssignment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4 pt-4">
              {/* Select User */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.governance.selectUser} *
                </label>
                <UserAutocomplete
                  value={assignUserId}
                  onChange={(u) => setAssignUserId(u ? u.id : '')}
                  minChars={3}
                />
              </div>

              {/* Ownership Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.governance.selectRole}
                </label>
                {selectedItemForAssignment.type === 'BusinessProcess' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignType('process_owner')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                        assignType === 'process_owner'
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>{t.governance.roleProcessOwner}</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">{t.governance.roleDescProcessOwner}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssignType('process_manager')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                        assignType === 'process_manager'
                          ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>{t.governance.roleProcessManager}</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">{t.governance.roleDescProcessManager}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssignType('delegate')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition col-span-2 ${
                        assignType === 'delegate'
                          ? 'border-slate-500 bg-slate-100 text-slate-900 ring-1 ring-slate-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>{t.governance.roleDelegate}</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">{t.governance.roleDescDelegate}</div>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignType('technical_owner')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                        assignType === 'technical_owner' || assignType === 'app_owner'
                          ? 'border-blue-500 bg-blue-50 text-blue-900 ring-1 ring-blue-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>{t.governance.roleTechnicalOwner}</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">{t.governance.roleDescTechnicalOwner}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAssignType('delegate')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                        assignType === 'delegate'
                          ? 'border-slate-500 bg-slate-100 text-slate-900 ring-1 ring-slate-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>{t.governance.roleDelegate}</div>
                      <div className="text-[10px] font-normal text-slate-500 mt-0.5">{t.governance.roleDescDelegate}</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.governance.notesPlaceholder}
                </label>
                <textarea
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder={t.governance.notesPlaceholder}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedItemForAssignment(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !assignUserId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  {submitting ? t.common.loading : t.governance.saveAssignment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
