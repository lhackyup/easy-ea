import React, { useState, useEffect } from 'react';
import {
  UserItem,
  UserRoleAssignmentItem,
  RoleDefinition,
  RolesMetadataResponse,
  PermissionCheckResult,
  ModelWorkspace,
  RoleType
} from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Shield,
  Users,
  UserPlus,
  Key,
  Globe,
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Plus,
  X,
  Check,
  Sliders,
  Sparkles,
  ArrowRight,
  Lock,
  Unlock,
  Layers,
  HelpCircle,
  Building2,
  FileCheck2,
  Eye,
  EyeOff
} from 'lucide-react';

interface RolesManagerProps {
  models: ModelWorkspace[];
  selectedModelId?: string;
}

export const RolesManager: React.FC<RolesManagerProps> = ({
  models,
  selectedModelId
}) => {
  const { t, interpolate } = useLanguage();
  const [activeTab, setActiveTab] = useState<'roles' | 'users' | 'simulator'>('roles');

  // RBAC Data
  const [rolesMeta, setRolesMeta] = useState<RolesMetadataResponse | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserItem | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New User Form State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  };

  // Assign Role Form State
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleType>('architect');
  const [selectedTargetModelId, setSelectedTargetModelId] = useState<string>(selectedModelId || (models[0]?.id || ''));

  // Simulator State
  const [simUserId, setSimUserId] = useState<string>('');
  const [simTargetModelId, setSimTargetModelId] = useState<string>(selectedModelId || (models[0]?.id || ''));
  const [simAction, setSimAction] = useState<string>('create_element');
  const [simResult, setSimResult] = useState<PermissionCheckResult | null>(null);
  const [simEvaluating, setSimEvaluating] = useState(false);

  // Delete Confirm State
  const [deleteConfirmAssignmentId, setDeleteConfirmAssignmentId] = useState<string | null>(null);

  const loadRbacData = async () => {
    setLoading(true);
    try {
      const [metaData, usersData] = await Promise.all([
        api.getRolesMetadata(),
        api.getUsers()
      ]);
      setRolesMeta(metaData);
      setUsers(usersData);
      if (usersData.length > 0 && !simUserId) {
        setSimUserId(usersData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRbacData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserFullName.trim()) return;

    if (newUserPassword.trim() && newUserPassword.trim().length < 8) {
      setFormError(t.rbac.placeholderPassword);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await api.createUser({
        email: newUserEmail.trim(),
        full_name: newUserFullName.trim(),
        password: newUserPassword.trim() || undefined
      });
      await loadRbacData();
      setIsAddUserOpen(false);
      setNewUserEmail('');
      setNewUserFullName('');
      setNewUserPassword('');
      setShowNewUserPassword(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error creating user');
    } finally {
      setSubmitting(false);
    }
  };

  const openResetPasswordModal = (user: UserItem) => {
    setResetTargetUser(user);
    setNewPasswordVal('');
    setShowResetPassword(false);
    setFormError(null);
    setResetSuccessMessage(null);
    setIsResetPasswordOpen(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPasswordVal.trim()) return;
    if (newPasswordVal.trim().length < 8) {
      setFormError(t.rbac.placeholderPassword);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await api.resetUserPassword(resetTargetUser.id, newPasswordVal.trim());
      setResetSuccessMessage(t.rbac.passwordResetSuccess);
      setTimeout(() => {
        setIsResetPasswordOpen(false);
        setResetTargetUser(null);
        setNewPasswordVal('');
        setResetSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error resetting password');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await api.assignRole({
        user_id: selectedUserId,
        role: selectedRole,
        model_id: selectedRole === 'admin' ? null : selectedTargetModelId
      });
      await loadRbacData();
      setIsAssignRoleOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error assigning role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await api.deleteRoleAssignment(assignmentId);
      setDeleteConfirmAssignmentId(null);
      await loadRbacData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEvaluatePermission = async () => {
    if (!simUserId) return;
    setSimEvaluating(true);
    try {
      const res = await api.checkPermission({
        user_id: simUserId,
        action: simAction,
        target_model_id: simTargetModelId
      });
      setSimResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setSimEvaluating(false);
    }
  };

  const SIMULATOR_ACTIONS = [
    { action: 'create_element', label: t.rbac.simActionCreateElement },
    { action: 'edit_element', label: t.rbac.simActionEditElement },
    { action: 'delete_element', label: t.rbac.simActionDeleteElement },
    { action: 'edit_diagram', label: t.rbac.simActionEditDiagram },
    { action: 'import_model_file', label: t.rbac.simActionImportModelFile },
    { action: 'create_library_attribute', label: t.rbac.simActionCreateLibAttr },
    { action: 'edit_apm_attributes', label: t.rbac.simActionEditApmAttr },
    { action: 'toggle_apm_scope', label: t.rbac.simActionToggleApmScope },
    { action: 'simulate_impact', label: t.rbac.simActionSimulateImpact },
    { action: 'read_repository', label: t.rbac.simActionReadRepo },
    { action: 'view_executive_overview', label: t.rbac.simActionViewExecutive },
    { action: 'manage_global_metamodel', label: t.rbac.simActionManageGlobalMetamodel },
    { action: 'create_library', label: t.rbac.simActionCreateLibrary }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.rbac.loadingRbac}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-600" />
            <span>{t.rbac.title}</span>
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            {t.rbac.subtitle}
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'roles'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>{t.rbac.tabRolesOverview}</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'users'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t.rbac.tabUsersAssignments}</span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
              activeTab === 'simulator'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t.rbac.tabSimulator}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: ROLES OVERVIEW & PERMISSIONS MATRIX               */}
      {/* ======================================================== */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          
          {/* Roles Hierarchy & Scope Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Role 1: System Administrator (Global) */}
            <div className="bg-white border-2 border-rose-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-100/40 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 shadow-sm">
                    <Globe className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    {t.rbac.roleAdminBadge}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-3">{t.rbac.roleAdminTitle}</h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {t.rbac.roleAdminFullDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-rose-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>{t.rbac.roleAdminFooter}</span>
              </div>
            </div>

            {/* Role 2: Enterprise Architect (Library) */}
            <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/40 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {t.rbac.roleArchitectBadge}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-3">{t.rbac.roleArchitectTitle}</h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {t.rbac.roleArchitectFullDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t.rbac.roleArchitectFooter}</span>
              </div>
            </div>

            {/* Role 3: Business Analyst (Library) */}
            <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-100/40 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    {t.rbac.roleAnalystBadge}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-3">{t.rbac.roleAnalystTitle}</h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {t.rbac.roleAnalystFullDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-indigo-700 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{t.rbac.roleAnalystFooter}</span>
              </div>
            </div>

            {/* Role 4: CIO / CFO / Board (Executive) */}
            <div className="bg-white border-2 border-blue-200 rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/40 rounded-full blur-xl -mr-8 -mt-8 pointer-events-none" />
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shadow-sm">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {t.rbac.roleExecutiveBadge}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-3">{t.rbac.roleExecutiveTitle}</h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {t.rbac.roleExecutiveFullDesc}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>{t.rbac.roleExecutiveFooter}</span>
              </div>
            </div>

          </div>

          {/* Granular Permission Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">{t.rbac.permissionMatrixTitle}</h4>
                <p className="text-xs text-slate-500">{t.rbac.permissionMatrixSubtitle}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="p-3 font-bold">{t.rbac.colDomain}</th>
                    <th className="p-3 font-bold">{t.rbac.colAction}</th>
                    <th className="p-3 font-bold text-rose-700 bg-rose-50/50">{t.rbac.colAdmin}</th>
                    <th className="p-3 font-bold text-emerald-700 bg-emerald-50/50">{t.rbac.colArchitect}</th>
                    <th className="p-3 font-bold text-indigo-700 bg-indigo-50/50">{t.rbac.colAnalyst}</th>
                    <th className="p-3 font-bold text-blue-700 bg-blue-50/50">{t.rbac.colExecutive}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Row 1: Workspace Management */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainWorkspaces}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionWorkspaces}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permAllLibraries}</td>
                    <td className="p-3 text-slate-400 bg-emerald-50/20">{t.rbac.permDenied}</td>
                    <td className="p-3 text-slate-400 bg-indigo-50/20">{t.rbac.permDenied}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permDenied}</td>
                  </tr>

                  {/* Row 2: Metamodel Global */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainGlobalMetamodel}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionGlobalMetamodel}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-slate-400 bg-emerald-50/20">{t.rbac.permReadOnly}</td>
                    <td className="p-3 text-slate-400 bg-indigo-50/20">{t.rbac.permReadOnly}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permReadOnly}</td>
                  </tr>

                  {/* Row 3: Metamodel Library */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainLibraryMetamodel}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionLibraryMetamodel}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-emerald-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-slate-400 bg-indigo-50/20">{t.rbac.permDenied}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permDenied}</td>
                  </tr>

                  {/* Row 4: Architecture Topology */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainArchTopology}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionArchTopology}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-emerald-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-slate-400 bg-indigo-50/20">{t.rbac.permReadOnly}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permReadOnly}</td>
                  </tr>

                  {/* Row 5: Diagrams & Graphic Views */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainDiagrams}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionDiagrams}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-emerald-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-slate-400 bg-indigo-50/20">{t.rbac.permReadOnly}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permReadOnly}</td>
                  </tr>

                  {/* Row 6: APM Portfolio & TIME */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainApmTime}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionApmTime}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-emerald-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-indigo-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permReadOnly}</td>
                  </tr>

                  {/* Row 7: Impact Simulation */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainImpactSim}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionImpactSim}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-emerald-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-indigo-50/20">{t.rbac.permLibraryOnly}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-blue-50/20">{t.rbac.permConsultation}</td>
                  </tr>

                  {/* Row 8: User & Roles Governance */}
                  <tr>
                    <td className="p-3 font-bold text-slate-800">{t.rbac.matrixDomainUsersRoles}</td>
                    <td className="p-3 text-slate-600">{t.rbac.matrixActionUsersRoles}</td>
                    <td className="p-3 text-emerald-700 font-bold bg-rose-50/20">{t.rbac.permFull}</td>
                    <td className="p-3 text-slate-400 bg-emerald-50/20">{t.rbac.permDenied}</td>
                    <td className="p-3 text-slate-400 bg-indigo-50/20">{t.rbac.permDenied}</td>
                    <td className="p-3 text-slate-400 bg-blue-50/20">{t.rbac.permDenied}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: USERS & ROLE ASSIGNMENTS                          */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">{t.rbac.userDirectoryTitle}</h4>
                <p className="text-xs text-slate-500">{t.rbac.userDirectorySubtitle}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setFormError(null);
                    setIsAddUserOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{t.rbac.addUserBtn}</span>
                </button>

                <button
                  onClick={() => {
                    setFormError(null);
                    if (users.length > 0) setSelectedUserId(users[0].id);
                    setIsAssignRoleOpen(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{t.rbac.assignRoleBtn}</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <th className="p-3 font-bold">{t.rbac.colUser}</th>
                    <th className="p-3 font-bold">{t.rbac.colStatus}</th>
                    <th className="p-3 font-bold">{t.rbac.colAssignedRoles}</th>
                    <th className="p-3 font-bold text-right">{t.rbac.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{u.full_name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> {t.rbac.statusActive}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {t.rbac.statusInactive}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {u.role_assignments && u.role_assignments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {u.role_assignments.map((ra) => {
                              const isGlobal = ra.role === 'admin' || !ra.model_id;
                              return (
                                <div
                                  key={ra.id}
                                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border shadow-2xs ${
                                    ra.role === 'admin'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : ra.role === 'architect'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : ra.role === 'analyst'
                                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}
                                >
                                  <span>
                                    {ra.role === 'admin' && t.rbac.roleAdminName}
                                    {ra.role === 'architect' && t.rbac.roleArchitectName}
                                    {ra.role === 'analyst' && t.rbac.roleAnalystName}
                                    {ra.role === 'executive' && t.rbac.roleExecutiveName}
                                  </span>

                                  {isGlobal ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/80 rounded border border-rose-200">
                                      {t.rbac.scopeGlobalBadge}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-white/80 rounded border font-mono">
                                      📚 [{ra.library_code || '----'}] {ra.library_name}
                                    </span>
                                  )}

                                  {/* Delete Assignment Button */}
                                  {deleteConfirmAssignmentId === ra.id ? (
                                    <div className="flex items-center space-x-1 pl-1">
                                      <button
                                        onClick={() => handleDeleteAssignment(ra.id)}
                                        className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-bold"
                                      >
                                        {t.rbac.confirmYes}
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmAssignmentId(null)}
                                        className="text-[9px] text-slate-500 hover:text-slate-800"
                                      >
                                        {t.rbac.confirmNo}
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmAssignmentId(ra.id)}
                                      className="text-slate-400 hover:text-rose-600 transition pl-1"
                                      title={t.rbac.revokeRole}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">{t.rbac.noRolesAssigned}</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => openResetPasswordModal(u)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition"
                          title={t.rbac.resetPasswordBtn}
                        >
                          <Key className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t.rbac.resetPasswordBtn}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LIVE RBAC PERMISSION SIMULATOR                    */}
      {/* ======================================================== */}
      {activeTab === 'simulator' && (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-600" />
                <span>{t.rbac.simulatorTitle}</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.rbac.simulatorSubtitle}
              </p>
            </div>

            {/* Simulator Form Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Select User */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.simUserLabel}
                </label>
                <select
                  value={simUserId}
                  onChange={(e) => setSimUserId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Library */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.simTargetLibLabel}
                </label>
                <select
                  value={simTargetModelId}
                  onChange={(e) => setSimTargetModelId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.code || '----'}] {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.simActionLabel}
                </label>
                <select
                  value={simAction}
                  onChange={(e) => setSimAction(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                >
                  {SIMULATOR_ACTIONS.map((a) => (
                    <option key={a.action} value={a.action}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleEvaluatePermission}
                disabled={simEvaluating || !simUserId}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center space-x-2 disabled:opacity-50"
              >
                <Key className="w-4 h-4" />
                <span>{simEvaluating ? t.rbac.simEvaluating : t.rbac.testPermissionBtn}</span>
              </button>
            </div>

            {/* Evaluation Result Card */}
            {simResult && (
              <div
                className={`p-5 rounded-2xl border transition shadow-sm space-y-3 ${
                  simResult.allowed
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-rose-50/70 border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{t.rbac.simResultTitle}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold shadow-sm ${
                      simResult.allowed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {simResult.allowed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> {t.rbac.permissionAllowed}
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" /> {t.rbac.permissionDenied}
                      </>
                    )}
                  </span>
                </div>

                <div className="text-xs text-slate-800 space-y-1">
                  <div>
                    <span className="font-bold text-slate-700">{t.rbac.simReasonLabel}</span>{' '}
                    <span className="font-medium">{simResult.reason}</span>
                  </div>
                  {simResult.role && (
                    <div className="text-[11px] text-slate-600 font-mono">
                      {t.rbac.simActiveRoleApplied} <strong>{simResult.role}</strong> ({simResult.scope})
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 italic">
                  💡 {t.rbac.simIsolationHint}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD USER                                        */}
      {/* ======================================================== */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddUserOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">{t.rbac.modalAddUserTitle}</h3>
            <p className="text-xs text-slate-500 mb-4">{t.rbac.modalAddUserSubtitle}</p>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.labelEmail} *
                </label>
                <input
                  type="email"
                  required
                  placeholder={t.rbac.placeholderEmail}
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.labelFullName} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.rbac.placeholderFullName}
                  value={newUserFullName}
                  onChange={(e) => setNewUserFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {t.rbac.labelPassword}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateRandomPassword();
                      setNewUserPassword(pwd);
                      setShowNewUserPassword(true);
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {t.rbac.generatePassword}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    placeholder={t.rbac.placeholderPassword}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-10 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {t.rbac.passwordHint}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.rbac.saveUserBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: ASSIGN ROLE TO USER                             */}
      {/* ======================================================== */}
      {isAssignRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAssignRoleOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">{t.rbac.modalAssignRoleTitle}</h3>
            <p className="text-xs text-slate-500 mb-4">{t.rbac.modalAssignRoleSubtitle}</p>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAssignRole} className="space-y-4">
              
              {/* Select User */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.labelSelectUser} *
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.rbac.labelSelectRole} *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as RoleType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                >
                  <option value="architect">{t.rbac.optArchitect}</option>
                  <option value="analyst">{t.rbac.optAnalyst}</option>
                  <option value="executive">{t.rbac.optExecutive}</option>
                  <option value="admin">{t.rbac.optAdmin}</option>
                </select>
              </div>

              {/* Target Library (if not admin) */}
              {selectedRole !== 'admin' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.rbac.labelSelectLibrary} *
                  </label>
                  <select
                    value={selectedTargetModelId}
                    onChange={(e) => setSelectedTargetModelId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.code || '----'}] {m.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-indigo-700 mt-1.5 leading-snug">
                    ℹ️ {t.rbac.libraryScopeNote}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-snug">
                  🌐 {t.rbac.globalAdminNote}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAssignRoleOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.rbac.saveAssignmentBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: RESET USER PASSWORD                             */}
      {/* ======================================================== */}
      {isResetPasswordOpen && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setIsResetPasswordOpen(false);
                setResetTargetUser(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-1">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t.rbac.modalResetPasswordTitle}</h3>
                <p className="text-xs text-slate-500">{t.rbac.modalResetPasswordSubtitle}</p>
              </div>
            </div>

            <div className="my-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-xs font-bold text-slate-900">{resetTargetUser.full_name}</div>
              <div className="text-[11px] font-mono text-slate-500">{resetTargetUser.email}</div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {resetSuccessMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{resetSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {t.rbac.labelNewPassword} *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateRandomPassword();
                      setNewPasswordVal(pwd);
                      setShowResetPassword(true);
                    }}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {t.rbac.generatePassword}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    placeholder={t.rbac.placeholderNewPassword}
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-10 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetPasswordOpen(false);
                    setResetTargetUser(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !!resetSuccessMessage}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.rbac.saveNewPasswordBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
