import React, { useState, useEffect, useMemo } from 'react';
import {
  ADRItem,
  ADRStatus,
  ADRDomain,
  ADRImpactType,
  ADRConsideredOption,
  ADRLinkedElementItem,
  ADRListSummary,
  ArchimateElementItem
} from '../../types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
  Scale,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Download,
  Pencil,
  Trash2,
  GitBranch,
  ArrowRight,
  Layers,
  ShieldCheck,
  Sparkles,
  Check,
  X,
  Copy,
  BookOpen,
  Link2,
  UserCheck,
  Calendar
} from 'lucide-react';

interface ADRManagerProps {
  modelId: string;
  initialAdrId?: string | null;
  onClearInitialAdr?: () => void;
}

const ADR_STATUSES: ADRStatus[] = ['Draft', 'Proposed', 'Accepted', 'Rejected', 'Deprecated', 'Superseded'];
const ADR_DOMAINS: ADRDomain[] = [
  'Strategy',
  'Business',
  'Application',
  'Data',
  'Technology',
  'Security',
  'Integration',
  'Governance'
];
const IMPACT_TYPES: ADRImpactType[] = ['driven_by', 'introduces', 'governs', 'modifies', 'retires'];

export const ADRManager: React.FC<ADRManagerProps> = ({
  modelId,
  initialAdrId,
  onClearInitialAdr
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const isIt = language === 'it';

  const [adrs, setAdrs] = useState<ADRItem[]>([]);
  const [summary, setSummary] = useState<ADRListSummary>({
    total: 0,
    accepted: 0,
    proposed: 0,
    draft: 0,
    rejected: 0,
    deprecated: 0,
    superseded: 0,
    by_status: {},
    by_domain: {}
  });
  const [selectedAdr, setSelectedAdr] = useState<ADRItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [domainFilter, setDomainFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  // Catalog Elements for linking
  const [catalogElements, setCatalogElements] = useState<ArchimateElementItem[]>([]);
  const [elementSearchQuery, setElementSearchQuery] = useState<string>('');
  const [selectedElementToLink, setSelectedElementToLink] = useState<string>('');
  const [selectedImpactRole, setSelectedImpactRole] = useState<ADRImpactType>('governs');
  const [selectedImpactNote, setSelectedImpactNote] = useState<string>('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'supersede'>('create');
  const [supersedingSourceAdr, setSupersedingSourceAdr] = useState<ADRItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Markdown Preview Modal
  const [mdPreviewOpen, setMdPreviewOpen] = useState(false);
  const [mdPreviewContent, setMdPreviewContent] = useState<string>('');
  const [mdPreviewFilename, setMdPreviewFilename] = useState<string>('ADR.md');
  const [copiedMd, setCopiedMd] = useState(false);

  // Notification toast
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    code: string;
    title: string;
    status: ADRStatus;
    domain: ADRDomain;
    context_and_problem: string;
    decision_drivers: string[];
    considered_options: ADRConsideredOption[];
    decision_outcome: string;
    consequences: string;
    compliance_impact: string;
    deciders: string;
    linked_elements: ADRLinkedElementItem[];
  }>({
    code: '',
    title: '',
    status: 'Draft',
    domain: 'Application',
    context_and_problem: '',
    decision_drivers: [''],
    considered_options: [{ title: '', description: '', pros: '', cons: '' }],
    decision_outcome: '',
    consequences: '',
    compliance_impact: '',
    deciders: 'Enterprise Architecture Board',
    linked_elements: []
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadADRs = async (preserveId?: string) => {
    if (!modelId) return;
    setLoading(true);
    try {
      const res = await api.getADRs(modelId, {
        status: statusFilter,
        domain: domainFilter,
        search: search.trim() || undefined
      });
      const list: ADRItem[] = res.items || [];
      setAdrs(list);
      if (res.summary) setSummary(res.summary);

      const targetId = preserveId || initialAdrId || selectedAdr?.id;
      if (targetId) {
        const found = list.find((a) => a.id === targetId);
        if (found) {
          setSelectedAdr(found);
          if (initialAdrId && onClearInitialAdr) onClearInitialAdr();
          return;
        }
      }
      setSelectedAdr(list.length > 0 ? list[0] : null);
    } catch (err) {
      console.error('Failed to load ADRs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogElements = async () => {
    if (!modelId) return;
    try {
      const els = await api.getElements(modelId);
      setCatalogElements(els || []);
    } catch (err) {
      console.error('Failed to load catalog elements for ADR linking:', err);
    }
  };

  useEffect(() => {
    loadADRs();
  }, [modelId, statusFilter, domainFilter, search]);

  useEffect(() => {
    loadCatalogElements();
  }, [modelId]);

  useEffect(() => {
    if (initialAdrId && adrs.length > 0) {
      const target = adrs.find((a) => a.id === initialAdrId);
      if (target) {
        setSelectedAdr(target);
        if (onClearInitialAdr) onClearInitialAdr();
      }
    }
  }, [initialAdrId, adrs]);

  const getStatusBadge = (status: ADRStatus) => {
    switch (status) {
      case 'Accepted':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Proposed':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Draft':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Deprecated':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Superseded':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: ADRStatus) => {
    if (!isIt) return status;
    const map: Record<ADRStatus, string> = {
      Draft: 'Bozza (Draft)',
      Proposed: 'In Proposta (Proposed)',
      Accepted: 'Approvato (Accepted)',
      Rejected: 'Rifiutato (Rejected)',
      Deprecated: 'Deprecato (Deprecated)',
      Superseded: 'Sostituito (Superseded)'
    };
    return map[status] || status;
  };

  const getImpactRoleBadge = (role: ADRImpactType) => {
    switch (role) {
      case 'driven_by':
        return {
          cls: 'bg-purple-50 text-purple-800 border-purple-200',
          label: isIt ? 'Guidato da (Driven By)' : 'Driven By'
        };
      case 'introduces':
        return {
          cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          label: isIt ? 'Introduce (Introduces)' : 'Introduces'
        };
      case 'governs':
        return {
          cls: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          label: isIt ? 'Governa (Governs)' : 'Governs'
        };
      case 'modifies':
        return {
          cls: 'bg-amber-50 text-amber-800 border-amber-200',
          label: isIt ? 'Modifica (Modifies)' : 'Modifies'
        };
      case 'retires':
        return {
          cls: 'bg-rose-50 text-rose-800 border-rose-200',
          label: isIt ? 'Dismette (Retires)' : 'Retires'
        };
      default:
        return { cls: 'bg-slate-100 text-slate-700 border-slate-200', label: role };
    }
  };

  const filteredCatalogElements = useMemo(() => {
    const linkedIds = new Set(formData.linked_elements.map((l) => l.element_id));
    return catalogElements
      .filter((e) => !linkedIds.has(e.id))
      .filter((e) => {
        if (!elementSearchQuery.trim()) return true;
        const q = elementSearchQuery.toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          e.layer.toLowerCase().includes(q)
        );
      })
      .slice(0, 60);
  }, [catalogElements, formData.linked_elements, elementSearchQuery]);

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setSupersedingSourceAdr(null);
    setModalError(null);
    setFormData({
      code: '',
      title: '',
      status: 'Draft',
      domain: 'Application',
      context_and_problem: '',
      decision_drivers: [''],
      considered_options: [{ title: '', description: '', pros: '', cons: '' }],
      decision_outcome: '',
      consequences: '',
      compliance_impact: '',
      deciders: user?.full_name ? `${user.full_name}, Architecture Board` : 'Enterprise Architecture Board',
      linked_elements: []
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (adr: ADRItem) => {
    setModalMode('edit');
    setSupersedingSourceAdr(null);
    setModalError(null);
    setFormData({
      id: adr.id,
      code: adr.code,
      title: adr.title,
      status: adr.status,
      domain: adr.domain,
      context_and_problem: adr.context_and_problem || '',
      decision_drivers: adr.decision_drivers?.length > 0 ? [...adr.decision_drivers] : [''],
      considered_options:
        adr.considered_options?.length > 0
          ? adr.considered_options.map((o) => ({ ...o }))
          : [{ title: '', description: '', pros: '', cons: '' }],
      decision_outcome: adr.decision_outcome || '',
      consequences: adr.consequences || '',
      compliance_impact: adr.compliance_impact || '',
      deciders: adr.deciders || 'Enterprise Architecture Board',
      linked_elements: (adr.linked_elements || []).map((l) => ({ ...l }))
    });
    setIsModalOpen(true);
  };

  const handleOpenSupersedeModal = (oldAdr: ADRItem) => {
    setModalMode('supersede');
    setSupersedingSourceAdr(oldAdr);
    setModalError(null);
    setFormData({
      code: '',
      title: isIt ? `Evoluzione di ${oldAdr.code}: ${oldAdr.title}` : `Superseding ${oldAdr.code}: ${oldAdr.title}`,
      status: 'Accepted',
      domain: oldAdr.domain,
      context_and_problem: isIt
        ? `Questa decisione aggiorna e sostituisce ${oldAdr.code} ("${oldAdr.title}").\n\nContesto precedente:\n${oldAdr.context_and_problem}`
        : `This decision supersedes ${oldAdr.code} ("${oldAdr.title}").\n\nPrevious context:\n${oldAdr.context_and_problem}`,
      decision_drivers: oldAdr.decision_drivers?.length > 0 ? [...oldAdr.decision_drivers] : [''],
      considered_options: [{ title: '', description: '', pros: '', cons: '' }],
      decision_outcome: '',
      consequences: '',
      compliance_impact: oldAdr.compliance_impact || '',
      deciders: oldAdr.deciders || 'Enterprise Architecture Board',
      linked_elements: (oldAdr.linked_elements || []).map((l) => ({ ...l }))
    });
    setIsModalOpen(true);
  };

  const handleAddLinkElement = () => {
    if (!selectedElementToLink) return;
    const foundEl = catalogElements.find((e) => e.id === selectedElementToLink);
    if (!foundEl) return;

    setFormData((prev) => ({
      ...prev,
      linked_elements: [
        ...prev.linked_elements,
        {
          element_id: foundEl.id,
          element_name: foundEl.name,
          element_type: foundEl.type,
          element_layer: foundEl.layer,
          impact_type: selectedImpactRole,
          notes: selectedImpactNote.trim()
        }
      ]
    }));
    setSelectedElementToLink('');
    setSelectedImpactNote('');
  };

  const handleRemoveLinkElement = (elementId: string) => {
    setFormData((prev) => ({
      ...prev,
      linked_elements: prev.linked_elements.filter((l) => l.element_id !== elementId)
    }));
  };

  const handleSaveADR = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    const cleanedDrivers = formData.decision_drivers.map((d) => d.trim()).filter(Boolean);
    const cleanedOptions = formData.considered_options.filter((o) => o.title.trim() !== '');

    const payload: Record<string, any> = {
      code: formData.code.trim() || undefined,
      title: formData.title.trim(),
      status: formData.status,
      domain: formData.domain,
      context_and_problem: formData.context_and_problem,
      decision_drivers: cleanedDrivers,
      considered_options: cleanedOptions,
      decision_outcome: formData.decision_outcome,
      consequences: formData.consequences,
      compliance_impact: formData.compliance_impact,
      deciders: formData.deciders,
      linked_elements: formData.linked_elements.map((l) => ({
        element_id: l.element_id,
        impact_type: l.impact_type,
        notes: l.notes || ''
      }))
    };

    try {
      let saved: ADRItem;
      if (modalMode === 'edit' && formData.id) {
        saved = await api.updateADR(formData.id, payload);
        showToast(isIt ? `Decisione ${saved.code} aggiornata.` : `Decision ${saved.code} updated.`);
      } else {
        if (modalMode === 'supersede' && supersedingSourceAdr) {
          payload.supersedes_adr_id = supersedingSourceAdr.id;
        }
        saved = await api.createADR(modelId, payload);
        showToast(
          modalMode === 'supersede'
            ? isIt
              ? `Creato ${saved.code} in sostituzione di ${supersedingSourceAdr?.code}.`
              : `Created ${saved.code} superseding ${supersedingSourceAdr?.code}.`
            : isIt
            ? `Decisione ${saved.code} registrata con successo.`
            : `Decision ${saved.code} created successfully.`
        );
      }
      setIsModalOpen(false);
      await loadADRs(saved.id);
    } catch (err: any) {
      setModalError(err.message || 'Errore durante il salvataggio ADR');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickTransition = async (adr: ADRItem, newStatus: ADRStatus) => {
    try {
      const updated = await api.transitionADR(adr.id, { status: newStatus });
      showToast(
        isIt
          ? `Stato di ${adr.code} aggiornato a ${newStatus}.`
          : `${adr.code} transitioned to ${newStatus}.`
      );
      await loadADRs(updated.id);
    } catch (err: any) {
      showToast(err.message || 'Errore cambio stato', 'error');
    }
  };

  const handleDeleteADR = async (adr: ADRItem) => {
    const confirmMsg = isIt
      ? `Sei sicuro di voler eliminare definitivamente ${adr.code} ("${adr.title}")?`
      : `Are you sure you want to permanently delete ${adr.code} ("${adr.title}")?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await api.deleteADR(adr.id);
      showToast(isIt ? `${adr.code} eliminato.` : `${adr.code} deleted.`);
      await loadADRs();
    } catch (err: any) {
      showToast(err.message || 'Errore eliminazione ADR', 'error');
    }
  };

  const handleOpenMarkdownPreview = async (adr: ADRItem) => {
    try {
      const res = await api.exportADRMarkdown(adr.id);
      setMdPreviewContent(res.markdown);
      setMdPreviewFilename(res.filename || `${adr.code}.md`);
      setCopiedMd(false);
      setMdPreviewOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Errore esportazione Markdown', 'error');
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(mdPreviewContent);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center space-x-2 animate-fadeIn ${
            notification.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
              <Scale className="w-3 h-3" />
              <span>MADR 3.0 • TOGAF Governance Log</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {isIt ? 'Architecture Decision Records (ADR)' : 'Architecture Decision Records (ADR)'}
          </h1>
          <p className="text-xs text-slate-500 max-w-3xl">
            {isIt
              ? 'Registro strutturato delle decisioni architetturali, opzioni tecnologiche valutate, catena di sostituzione (Supersede) e legami diretti di governance con gli elementi del catalogo ArchiMate.'
              : 'Structured registry of architectural decisions, considered options, superseding chains, and direct governance links with ArchiMate catalog elements.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={api.downloadAllADRsMarkdownUrl(modelId)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>{isIt ? 'Esporta Log MADR (.md)' : 'Export MADR Log (.md)'}</span>
          </a>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isIt ? 'Nuova Decisione (ADR)' : 'New Decision (ADR)'}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {isIt ? 'Totale Decisioni' : 'Total Decisions'}
            </span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{summary.total}</span>
            <span className="text-[11px] text-slate-500">
              {isIt ? `${summary.draft} in bozza` : `${summary.draft} drafts`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
              {isIt ? 'Approvate (Accepted)' : 'Accepted & Active'}
            </span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">{summary.accepted}</span>
            <span className="text-[11px] text-slate-500">
              {isIt ? 'Standard architetturali vigenti' : 'Enforced architecture standards'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
              {isIt ? 'In Proposta (Board)' : 'Proposed (Pending)'}
            </span>
            <span className="text-2xl font-black text-amber-700 mt-1 block">{summary.proposed}</span>
            <span className="text-[11px] text-slate-500">
              {isIt ? 'In attesa di Architecture Board' : 'Awaiting Architecture Board'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
              {isIt ? 'Sostituite / Deprecate' : 'Superseded / Deprecated'}
            </span>
            <span className="text-2xl font-black text-purple-700 mt-1 block">
              {summary.superseded + summary.deprecated}
            </span>
            <span className="text-[11px] text-slate-500">
              {isIt ? `${summary.rejected} rifiutate` : `${summary.rejected} rejected`}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <GitBranch className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              isIt
                ? 'Cerca per codice (es. ADR-0001), titolo, contesto, decisori o elemento ArchiMate...'
                : 'Search by code (e.g. ADR-0001), title, context, deciders, or ArchiMate element...'
            }
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="All">{isIt ? 'Tutti gli Stati' : 'All Statuses'}</option>
            {ADR_STATUSES.map((st) => (
              <option key={st} value={st}>
                {getStatusLabel(st)}
              </option>
            ))}
          </select>

          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="All">{isIt ? 'Tutti i Domini' : 'All Domains'}</option>
            {ADR_DOMAINS.map((dom) => (
              <option key={dom} value={dom}>
                {dom}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Master-Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              {isIt ? `Registro ADR (${adrs.length})` : `ADR Registry (${adrs.length})`}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {isIt ? 'Caricamento decisioni architetturali...' : 'Loading architectural decisions...'}
            </div>
          ) : adrs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Scale className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">
                {isIt ? 'Nessun ADR trovato con i filtri correnti.' : 'No ADRs found matching current filters.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {adrs.map((adr) => {
                const isSelected = selectedAdr?.id === adr.id;
                return (
                  <div
                    key={adr.id}
                    onClick={() => setSelectedAdr(adr)}
                    className={`p-4 transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs font-black text-indigo-950 bg-indigo-100/80 px-2 py-0.5 rounded-md border border-indigo-200">
                          {adr.code}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {adr.domain}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                          adr.status
                        )}`}
                      >
                        {adr.status}
                      </span>
                    </div>

                    <h3 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                      {adr.title}
                    </h3>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1 font-medium">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        <span>
                          {adr.linked_elements_count}{' '}
                          {isIt ? 'elementi ArchiMate' : 'ArchiMate elements'}
                        </span>
                      </span>

                      {adr.superseded_by && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                          ➔ {adr.superseded_by.code}
                        </span>
                      )}
                      {adr.supersedes && adr.supersedes.length > 0 && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                          {isIt ? 'Sostituisce' : 'Supersedes'} {adr.supersedes.map((s) => s.code).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Pane (7 cols) */}
        <div className="lg:col-span-7">
          {selectedAdr ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
              {/* Top Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black text-indigo-950 bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200">
                      {selectedAdr.code}
                    </span>
                    <span
                      className={`text-xs font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(
                        selectedAdr.status
                      )}`}
                    >
                      {getStatusLabel(selectedAdr.status)}
                    </span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedAdr.domain}
                    </span>
                  </div>

                  <h2 className="text-lg font-black text-slate-900 leading-snug">
                    {selectedAdr.title}
                  </h2>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                    {selectedAdr.deciders && (
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          <strong>{isIt ? 'Decisori:' : 'Deciders:'}</strong> {selectedAdr.deciders}
                        </span>
                      </span>
                    )}
                    {selectedAdr.decided_at && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedAdr.decided_at.slice(0, 10)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleOpenMarkdownPreview(selectedAdr)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="MADR Markdown"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>MADR .md</span>
                  </button>

                  {selectedAdr.status !== 'Superseded' && (
                    <button
                      onClick={() => handleOpenSupersedeModal(selectedAdr)}
                      className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title={isIt ? 'Sostituisci con un nuovo ADR' : 'Supersede with new ADR'}
                    >
                      <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                      <span>Supersede</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenEditModal(selectedAdr)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                    title={isIt ? 'Modifica ADR' : 'Edit ADR'}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteADR(selectedAdr)}
                    className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                    title={isIt ? 'Elimina ADR' : 'Delete ADR'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Governance Workflow Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>{isIt ? 'Workflow Governance:' : 'Governance Workflow:'}</span>
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedAdr.status === 'Draft' && (
                    <button
                      onClick={() => handleQuickTransition(selectedAdr, 'Proposed')}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      {isIt ? 'Invia in Proposta (Propose)' : 'Propose to Board'}
                    </button>
                  )}
                  {(selectedAdr.status === 'Draft' || selectedAdr.status === 'Proposed') && (
                    <>
                      <button
                        onClick={() => handleQuickTransition(selectedAdr, 'Accepted')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        {isIt ? 'Approva (Accept)' : 'Accept Decision'}
                      </button>
                      <button
                        onClick={() => handleQuickTransition(selectedAdr, 'Rejected')}
                        className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                      >
                        {isIt ? 'Rifiuta (Reject)' : 'Reject'}
                      </button>
                    </>
                  )}
                  {selectedAdr.status === 'Accepted' && (
                    <button
                      onClick={() => handleQuickTransition(selectedAdr, 'Deprecated')}
                      className="px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                    >
                      {isIt ? 'Segna come Deprecato' : 'Mark Deprecated'}
                    </button>
                  )}
                </div>
              </div>

              {/* Superseding / Superseded Chain Banners */}
              {selectedAdr.superseded_by && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between text-xs text-purple-900">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      {isIt ? 'Questa decisione è stata sostituita da ' : 'This decision has been superseded by '}
                      <strong>
                        {selectedAdr.superseded_by.code} ({selectedAdr.superseded_by.title})
                      </strong>
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const target = adrs.find((a) => a.id === selectedAdr.superseded_by?.id);
                      if (target) setSelectedAdr(target);
                    }}
                    className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[11px] font-bold hover:bg-purple-700 transition shrink-0 cursor-pointer"
                  >
                    {isIt ? 'Vai al nuovo ADR' : 'Open New ADR'}
                  </button>
                </div>
              )}

              {selectedAdr.supersedes && selectedAdr.supersedes.length > 0 && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-950">
                  <div className="flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>
                      {isIt ? 'Sostituisce: ' : 'Supersedes: '}
                      {selectedAdr.supersedes.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            const target = adrs.find((a) => a.id === s.id);
                            if (target) setSelectedAdr(target);
                          }}
                          className="font-mono font-bold underline hover:text-indigo-700 mr-2 cursor-pointer"
                        >
                          {s.code} ({s.title})
                        </button>
                      ))}
                    </span>
                  </div>
                </div>
              )}

              {/* 1. Context & Problem Statement */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {isIt ? '1. Contesto e Problema Architetturale' : '1. Context & Problem Statement'}
                </h4>
                <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {selectedAdr.context_and_problem || (isIt ? 'Nessun contesto specificato.' : 'No context provided.')}
                </div>
              </div>

              {/* Decision Drivers */}
              {selectedAdr.decision_drivers && selectedAdr.decision_drivers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    {isIt ? 'Driver Decisionali (Decision Drivers)' : 'Decision Drivers'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedAdr.decision_drivers.map((drv, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-indigo-50/80 text-indigo-900 border border-indigo-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{drv}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Considered Options */}
              {selectedAdr.considered_options && selectedAdr.considered_options.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    {isIt ? '2. Opzioni e Alternative Valutate' : '2. Considered Options'}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedAdr.considered_options.map((opt, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-2"
                      >
                        <div className="font-bold text-xs text-slate-900">
                          {idx + 1}. {opt.title}
                        </div>
                        {opt.description && (
                          <p className="text-xs text-slate-600">{opt.description}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {opt.pros && (
                            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-[11px] text-emerald-900">
                              <strong className="block text-emerald-700 mb-0.5">+ Pro / Vantaggi:</strong>
                              {opt.pros}
                            </div>
                          )}
                          {opt.cons && (
                            <div className="p-2.5 bg-rose-50/70 border border-rose-200/80 rounded-xl text-[11px] text-rose-900">
                              <strong className="block text-rose-700 mb-0.5">- Contro / Svantaggi:</strong>
                              {opt.cons}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Decision Outcome & Consequences */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  {isIt ? '3. Decisione Presa & Conseguenze' : '3. Decision Outcome & Consequences'}
                </h4>
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                    {isIt ? 'Esito Decisionale (Decision Outcome)' : 'Decision Outcome'}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 whitespace-pre-line leading-relaxed">
                    {selectedAdr.decision_outcome || (isIt ? 'Non ancora definito.' : 'Not recorded yet.')}
                  </p>
                </div>

                {(selectedAdr.consequences || selectedAdr.compliance_impact) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedAdr.consequences && (
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                          {isIt ? 'Conseguenze & Debito Tecnico' : 'Consequences & Tech Debt'}
                        </span>
                        <p className="text-slate-700 whitespace-pre-line">{selectedAdr.consequences}</p>
                      </div>
                    )}
                    {selectedAdr.compliance_impact && (
                      <div className="p-3.5 bg-indigo-50/40 border border-indigo-200/80 rounded-2xl text-xs space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">
                          {isIt ? 'Impatto Compliance & Sicurezza' : 'Compliance & Security Impact'}
                        </span>
                        <p className="text-slate-700 whitespace-pre-line">{selectedAdr.compliance_impact}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Linked ArchiMate Elements */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-indigo-600" />
                    <span>
                      {isIt
                        ? `4. Elementi ArchiMate Governati / Impattati (${selectedAdr.linked_elements?.length || 0})`
                        : `4. Governed / Impacted ArchiMate Elements (${selectedAdr.linked_elements?.length || 0})`}
                    </span>
                  </h4>
                </div>

                {selectedAdr.linked_elements && selectedAdr.linked_elements.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {selectedAdr.linked_elements.map((link) => {
                      const roleBadge = getImpactRoleBadge(link.impact_type);
                      return (
                        <div
                          key={link.id || link.element_id}
                          className="p-3 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900">{link.element_name}</span>
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                {link.element_type}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleBadge.cls}`}
                              >
                                {roleBadge.label}
                              </span>
                            </div>
                            {link.notes && (
                              <p className="text-[11px] text-slate-500 italic">{link.notes}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 italic">
                    {isIt
                      ? 'Nessun elemento ArchiMate collegato a questo ADR.'
                      : 'No ArchiMate elements linked to this ADR.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-3xl p-12 text-center text-slate-400 text-xs">
              {isIt
                ? 'Seleziona una decisione architetturale (ADR) dalla lista a sinistra o creane una nuova.'
                : 'Select an Architecture Decision Record (ADR) from the list or create a new one.'}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT / SUPERSEDE ADR                     */}
      {/* ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-indigo-600" />
                  <span>
                    {modalMode === 'edit'
                      ? isIt
                        ? `Modifica ${formData.code}`
                        : `Edit ${formData.code}`
                      : modalMode === 'supersede'
                      ? isIt
                        ? `Nuovo ADR in sostituzione di ${supersedingSourceAdr?.code}`
                        : `New ADR Superseding ${supersedingSourceAdr?.code}`
                      : isIt
                      ? 'Nuovo Architecture Decision Record (ADR)'
                      : 'New Architecture Decision Record (ADR)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isIt
                    ? 'Standard MADR 3.0 con tracciabilità diretta sugli elementi del repository ArchiMate.'
                    : 'MADR 3.0 standard with direct traceability to ArchiMate repository elements.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveADR} className="overflow-y-auto flex-1 pr-1 space-y-5 pt-4 text-xs">
              {/* Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isIt ? 'Codice ADR' : 'ADR Code'}
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (es. ADR-0005)"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isIt ? 'Stato' : 'Status'}
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ADRStatus })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                  >
                    {ADR_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {getStatusLabel(st)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isIt ? 'Dominio Architetturale' : 'Architectural Domain'}
                  </label>
                  <select
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value as ADRDomain })}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800"
                  >
                    {ADR_DOMAINS.map((dom) => (
                      <option key={dom} value={dom}>
                        {dom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {isIt ? 'Decisori / Board' : 'Deciders / Board'}
                  </label>
                  <input
                    type="text"
                    value={formData.deciders}
                    onChange={(e) => setFormData({ ...formData, deciders: e.target.value })}
                    placeholder="Enterprise Architecture Board"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="font-bold text-slate-700 block mb-1">
                    {isIt ? 'Titolo della Decisione *' : 'Decision Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={
                      isIt
                        ? 'es. Adozione Event-Driven Architecture con Apache Kafka per pagamenti istantanei'
                        : 'e.g. Adoption of Event-Driven Architecture with Apache Kafka for instant payments'
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Context & Problem */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block">
                  {isIt ? '1. Contesto e Problema Architetturale' : '1. Context and Problem Statement'}
                </label>
                <textarea
                  rows={3}
                  value={formData.context_and_problem}
                  onChange={(e) => setFormData({ ...formData, context_and_problem: e.target.value })}
                  placeholder={
                    isIt
                      ? 'Descrivi il problema architetturale, i vincoli tecnologici o di business che rendono necessaria questa decisione...'
                      : 'Describe the architectural problem, business or technical constraints requiring this decision...'
                  }
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-slate-900"
                />
              </div>

              {/* Decision Drivers */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    {isIt ? 'Driver Decisionali (Obiettivi / Vincoli)' : 'Decision Drivers'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        decision_drivers: [...prev.decision_drivers, '']
                      }))
                    }
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    + {isIt ? 'Aggiungi Driver' : 'Add Driver'}
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.decision_drivers.map((drv, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={drv}
                        onChange={(e) => {
                          const next = [...formData.decision_drivers];
                          next[idx] = e.target.value;
                          setFormData({ ...formData, decision_drivers: next });
                        }}
                        placeholder={isIt ? 'es. Riduzione TCO del 20% entro 18 mesi' : 'e.g. Reduce TCO by 20%'}
                        className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            decision_drivers: prev.decision_drivers.filter((_, i) => i !== idx)
                          }))
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Considered Options */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    {isIt ? '2. Opzioni Valutate (Pro & Contro)' : '2. Considered Options (Pros & Cons)'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        considered_options: [
                          ...prev.considered_options,
                          { title: '', description: '', pros: '', cons: '' }
                        ]
                      }))
                    }
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    + {isIt ? 'Aggiungi Opzione' : 'Add Option'}
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.considered_options.map((opt, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={opt.title}
                          onChange={(e) => {
                            const next = [...formData.considered_options];
                            next[idx] = { ...next[idx], title: e.target.value };
                            setFormData({ ...formData, considered_options: next });
                          }}
                          placeholder={`${isIt ? 'Titolo Opzione' : 'Option Title'} #${idx + 1}`}
                          className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              considered_options: prev.considered_options.filter((_, i) => i !== idx)
                            }))
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={opt.pros || ''}
                          onChange={(e) => {
                            const next = [...formData.considered_options];
                            next[idx] = { ...next[idx], pros: e.target.value };
                            setFormData({ ...formData, considered_options: next });
                          }}
                          placeholder="+ Pro / Vantaggi"
                          className="bg-emerald-50/40 border border-emerald-200 rounded-lg px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          value={opt.cons || ''}
                          onChange={(e) => {
                            const next = [...formData.considered_options];
                            next[idx] = { ...next[idx], cons: e.target.value };
                            setFormData({ ...formData, considered_options: next });
                          }}
                          placeholder="- Contro / Svantaggi"
                          className="bg-rose-50/40 border border-rose-200 rounded-lg px-2.5 py-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Outcome, Consequences & Compliance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-800 block">
                    {isIt ? '3. Decisione Presa (Decision Outcome)' : '3. Decision Outcome'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.decision_outcome}
                    onChange={(e) => setFormData({ ...formData, decision_outcome: e.target.value })}
                    placeholder={
                      isIt
                        ? 'Sintesi dell’opzione scelta e della giustificazione architetturale...'
                        : 'Summary of the chosen option and architectural justification...'
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl p-3"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">
                    {isIt ? 'Conseguenze & Debito Tecnico' : 'Consequences & Tech Debt'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.consequences}
                    onChange={(e) => setFormData({ ...formData, consequences: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 block">
                    {isIt ? 'Impatto Sicurezza & Compliance (DORA/GDPR/BIAN)' : 'Security & Compliance Impact'}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.compliance_impact}
                    onChange={(e) => setFormData({ ...formData, compliance_impact: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5"
                  />
                </div>
              </div>

              {/* Linked ArchiMate Elements Builder */}
              <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200/80">
                <label className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <span>
                    {isIt
                      ? '4. Collega Elementi del Catalogo ArchiMate'
                      : '4. Link ArchiMate Catalog Elements'}
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5 space-y-1">
                    <input
                      type="text"
                      value={elementSearchQuery}
                      onChange={(e) => setElementSearchQuery(e.target.value)}
                      placeholder={isIt ? 'Filtra catalogo elementi...' : 'Filter catalog elements...'}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[11px] mb-1"
                    />
                    <select
                      value={selectedElementToLink}
                      onChange={(e) => setSelectedElementToLink(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-semibold"
                    >
                      <option value="">
                        {isIt ? '-- Seleziona Elemento ArchiMate --' : '-- Select ArchiMate Element --'}
                      </option>
                      {filteredCatalogElements.map((el) => (
                        <option key={el.id} value={el.id}>
                          [{el.layer}] {el.name} ({el.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <select
                      value={selectedImpactRole}
                      onChange={(e) => setSelectedImpactRole(e.target.value as ADRImpactType)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 font-bold"
                    >
                      {IMPACT_TYPES.map((role) => (
                        <option key={role} value={role}>
                          {getImpactRoleBadge(role).label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={selectedImpactNote}
                      onChange={(e) => setSelectedImpactNote(e.target.value)}
                      placeholder={isIt ? 'Nota impatto (opzionale)' : 'Impact note (optional)'}
                      className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddLinkElement}
                      disabled={!selectedElementToLink}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Linked Elements Chips */}
                {formData.linked_elements.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {formData.linked_elements.map((link) => {
                      const badge = getImpactRoleBadge(link.impact_type);
                      return (
                        <div
                          key={link.element_id}
                          className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900">
                              {link.element_name || link.element_id}
                            </span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                              {link.element_type}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.cls}`}>
                              {badge.label}
                            </span>
                            {link.notes && <span className="text-[11px] text-slate-500 italic">({link.notes})</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLinkElement(link.element_id)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold cursor-pointer"
                >
                  {isIt ? 'Annulla' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {saving
                      ? isIt
                        ? 'Salvataggio...'
                        : 'Saving...'
                      : isIt
                      ? 'Salva Decisione (ADR)'
                      : 'Save Decision (ADR)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MADR MARKDOWN PREVIEW & EXPORT                    */}
      {/* ======================================================== */}
      {mdPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">{mdPreviewFilename}</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedMd ? (isIt ? 'Copiato!' : 'Copied!') : isIt ? 'Copia Markdown' : 'Copy Markdown'}</span>
                </button>
                {selectedAdr && (
                  <a
                    href={api.downloadSingleADRMarkdownUrl(selectedAdr.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isIt ? 'Scarica .md' : 'Download .md'}</span>
                  </a>
                )}
                <button
                  onClick={() => setMdPreviewOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <pre className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono overflow-y-auto flex-1 whitespace-pre-wrap leading-relaxed">
              {mdPreviewContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
