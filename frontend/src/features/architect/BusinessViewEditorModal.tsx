import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Table as TableIcon,
  Grid,
  BarChart3,
  LayoutGrid,
  ShieldAlert,
  Building2,
  Server,
  Cloud,
  Coins,
  Package,
  Tag,
  Workflow,
  Layers,
  CheckCircle2,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Info,
  Check,
  Globe,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Loader2,
  PieChart,
  Filter,
  Search
} from 'lucide-react';
import {
  CustomBusinessViewPayload,
  CustomBusinessViewItem,
  PackageViewColumn,
  PackageViewKPIMetric,
  PackageViewChart,
  PackageViewExecuteResponse,
  CustomAttributeDefinition
} from '../../types';
import { AttributeFilterRule } from './ArchitectRepository';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';

interface BusinessViewEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CustomBusinessViewPayload) => Promise<void>;
  initialView?: CustomBusinessViewItem | null;
  modelId: string;
}

const COMMON_ARCHIMATE_TYPES = [
  'ApplicationComponent',
  'ApplicationInterface',
  'ApplicationService',
  'DataObject',
  'BusinessProcess',
  'BusinessActor',
  'BusinessRole',
  'BusinessService',
  'BusinessFunction',
  'Capability',
  'ValueStream',
  'Resource',
  'Node',
  'Device',
  'SystemSoftware',
  'TechnologyService',
  'Artifact',
  'Requirement',
  'Principle',
  'Goal',
  'Constraint',
  'WorkPackage',
  'Deliverable'
];

const AVAILABLE_ICONS = [
  { name: 'Table', label: 'Table', icon: TableIcon },
  { name: 'Grid', label: 'Matrix Grid', icon: Grid },
  { name: 'BarChart3', label: 'Bar Chart', icon: BarChart3 },
  { name: 'PieChart', label: 'Pie Chart', icon: PieChart },
  { name: 'LayoutGrid', label: 'Dashboard Grid', icon: LayoutGrid },
  { name: 'ShieldAlert', label: 'Security & Risk', icon: ShieldAlert },
  { name: 'Sparkles', label: 'Strategic / Star', icon: Sparkles },
  { name: 'Building2', label: 'Enterprise / App', icon: Building2 },
  { name: 'Server', label: 'Infrastructure', icon: Server },
  { name: 'Cloud', label: 'Cloud Services', icon: Cloud },
  { name: 'Coins', label: 'Cost & Finance', icon: Coins },
  { name: 'Workflow', label: 'Process & Flow', icon: Workflow },
  { name: 'Layers', label: 'Layers & Stack', icon: Layers },
  { name: 'Package', label: 'Package & Assets', icon: Package }
];

interface FilterableAttributeOption {
  name: string;
  label: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'select';
  section?: string;
  options?: string[];
}

const STANDARD_ATTRIBUTES: FilterableAttributeOption[] = [
  { name: 'name', label: 'Name / Nome', data_type: 'string', section: 'Standard' },
  { name: 'type', label: 'ArchiMate Type', data_type: 'string', section: 'Standard' },
  { name: 'layer', label: 'Layer', data_type: 'string', section: 'Standard' },
  { name: 'documentation', label: 'Documentation', data_type: 'string', section: 'Standard' },
  { name: 'apm_app_code', label: 'App Code', data_type: 'string', section: 'APM' },
  { name: 'apm_lifecycle_status', label: 'Lifecycle Status', data_type: 'select', options: ['Plan', 'Active', 'PhaseOut', 'Retired', 'Sunset'], section: 'APM' },
  { name: 'apm_business_criticality', label: 'Business Criticality', data_type: 'select', options: ['Mission Critical', 'Business Critical', 'Business Operational', 'Administrative Service'], section: 'APM' },
  { name: 'apm_functional_fit', label: 'Functional Fit', data_type: 'select', options: ['1 - Poor', '2 - Fair', '3 - Good', '4 - Excellent'], section: 'APM' },
  { name: 'apm_technical_fit', label: 'Technical Fit', data_type: 'select', options: ['1 - Unacceptable', '2 - Trailing', '3 - Standard', '4 - Leading'], section: 'APM' },
  { name: 'apm_annual_cost', label: 'Annual Cost (€)', data_type: 'number', section: 'APM' },
  { name: 'apm_hosting_type', label: 'Hosting Model', data_type: 'select', options: ['On-Premise', 'Private Cloud', 'Public Cloud', 'SaaS', 'Hybrid'], section: 'APM' },
  { name: 'apm_vendor', label: 'Vendor', data_type: 'string', section: 'APM' },
];

const getOperatorsForDataType = (dataType: string = 'string') => {
  switch (dataType) {
    case 'number':
      return [
        { id: 'gt', label: '> (Maggiore di)' },
        { id: 'lt', label: '< (Minore di)' },
        { id: 'gte', label: '>= (Maggiore o uguale)' },
        { id: 'lte', label: '<= (Minore o uguale)' },
        { id: 'equals', label: '= (Uguale a)' },
        { id: 'between', label: 'Compreso tra (Min .. Max)' },
        { id: 'not_empty', label: 'Definito (Non vuoto)' },
        { id: 'empty', label: 'Non definito (Vuoto)' },
      ];
    case 'boolean':
      return [
        { id: 'is_true', label: 'È Vero (True / Sì)' },
        { id: 'is_false', label: 'È Falso (False / No)' },
        { id: 'not_empty', label: 'Definito (Impostato)' },
        { id: 'empty', label: 'Non impostato' },
      ];
    case 'select':
      return [
        { id: 'equals', label: 'Uguale a' },
        { id: 'not_equals', label: 'Diverso da' },
        { id: 'not_empty', label: 'Selezionato (Non vuoto)' },
        { id: 'empty', label: 'Nessuna selezione (Vuoto)' },
      ];
    case 'date':
      return [
        { id: 'equals', label: 'Data uguale a' },
        { id: 'before', label: 'Prima del (<)' },
        { id: 'after', label: 'Dopo il (>)' },
        { id: 'not_empty', label: 'Data definita' },
        { id: 'empty', label: 'Data non definita' },
      ];
    case 'string':
    default:
      return [
        { id: 'contains', label: 'Contiene testo' },
        { id: 'equals', label: 'Corrisponde esattamente' },
        { id: 'starts_with', label: 'Inizia con' },
        { id: 'not_empty', label: 'Definito (Non vuoto)' },
        { id: 'empty', label: 'Non definito (Vuoto)' },
      ];
  }
};

export const BusinessViewEditorModal: React.FC<BusinessViewEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialView,
  modelId,
}) => {
  const { t, interpolate } = useLanguage();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [viewKey, setViewKey] = useState('');
  const [category, setCategory] = useState('Portfolio Governance');
  const [description, setDescription] = useState('');
  const [viewType, setViewType] = useState<'table' | 'matrix' | 'kpi_dashboard' | 'adr_manager' | 'resilience_dashboard' | 'gap_matrix'>('table');
  const [icon, setIcon] = useState('Table');
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [isGlobal, setIsGlobal] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [targetHub, setTargetHub] = useState<'business' | 'architecture' | 'both'>('business');
  const [targetStereotypes, setTargetStereotypes] = useState<string[]>([]);
  const [targetTypes, setTargetTypes] = useState<string[]>([]);

  // Package Association
  const [packageId, setPackageId] = useState<string | null>(null);
  const [availablePackages, setAvailablePackages] = useState<any[]>([]);
  const [metamodelLayers, setMetamodelLayers] = useState<any[]>([]);

  // Filter Config State
  const [filterLayer, setFilterLayer] = useState<string>('All');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterSearchInProps, setFilterSearchInProps] = useState<boolean>(false);
  const [filterRelationship, setFilterRelationship] = useState<'all' | 'orphan' | 'connected'>('all');
  const [filterDocumentation, setFilterDocumentation] = useState<'all' | 'with_doc' | 'no_doc'>('all');
  const [filterMatchLogic, setFilterMatchLogic] = useState<'AND' | 'OR'>('AND');
  const [attributeRules, setAttributeRules] = useState<AttributeFilterRule[]>([]);
  const [filterSortBy, setFilterSortBy] = useState<string>('name_asc');

  // Metamodel & Standard Attributes for Rules
  const allAvailableAttributes = useMemo(() => {
    const map = new Map<string, FilterableAttributeOption>();
    STANDARD_ATTRIBUTES.forEach((attr) => map.set(attr.name, attr));

    metamodelLayers.forEach((layer: any) => {
      (layer.element_types || []).forEach((et: any) => {
        if (et.custom_attributes) {
          et.custom_attributes.forEach((ca: any) => {
            if (!map.has(ca.name)) {
              map.set(ca.name, ca);
            }
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const secCompare = (a.section || 'Custom').localeCompare(b.section || 'Custom');
      if (secCompare !== 0) return secCompare;
      return (a.label || a.name).localeCompare(b.label || b.name);
    });
  }, [metamodelLayers]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterLayer && filterLayer !== 'All') count++;
    if (filterSearch.trim()) count++;
    if (filterRelationship !== 'all') count++;
    if (filterDocumentation !== 'all') count++;
    if (targetTypes.length > 0 && !(targetTypes.length === 1 && targetTypes[0] === 'All')) count++;
    if (targetStereotypes.length > 0) count++;
    count += attributeRules.length;
    return count;
  }, [filterLayer, filterSearch, filterRelationship, filterDocumentation, targetTypes, targetStereotypes, attributeRules]);

  // Stereotypes options
  const [availableStereotypes, setAvailableStereotypes] = useState<any[]>([]);
  const [loadingStereos, setLoadingStereos] = useState(false);

  // View Specific Configurations
  // 1. Table Columns
  const [columns, setColumns] = useState<PackageViewColumn[]>([
    { field: 'name', label: 'Element Name', type: 'string', sortable: true, filterable: true },
    { field: 'type', label: 'ArchiMate Type', type: 'badge', sortable: true, filterable: true },
    { field: 'layer', label: 'Layer', type: 'badge', sortable: true, filterable: true },
    { field: 'documentation', label: 'Documentation', type: 'string', sortable: false, filterable: false }
  ]);

  // 2. Matrix Config
  const [matrixXField, setMatrixXField] = useState('layer');
  const [matrixXLabel, setMatrixXLabel] = useState('Layer');
  const [matrixYField, setMatrixYField] = useState('type');
  const [matrixYLabel, setMatrixYLabel] = useState('ArchiMate Type');

  // 3. KPI Config
  const [metrics, setMetrics] = useState<PackageViewKPIMetric[]>([
    { id: 'total_count', label: 'Total Elements', value: 0, type: 'count' }
  ]);
  const [charts, setCharts] = useState<PackageViewChart[]>([
    { id: 'by_type', title: 'Elements by Type', type: 'bar', group_by: 'type', data: [] },
    { id: 'by_layer', title: 'Distribution by Layer', type: 'pie', group_by: 'layer', data: [] }
  ]);

  // Preview State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PackageViewExecuteResponse | null>(null);

  // Initialize or reset when modal opens or initialView changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setActiveStep(1);

      if (initialView) {
        setName(initialView.name || '');
        setViewKey(initialView.view_key || '');
        setCategory(initialView.category || 'Portfolio Governance');
        setDescription(initialView.description || '');
        setViewType(initialView.view_type || 'table');
        setIcon(initialView.icon || 'Table');
        setSortOrder(initialView.sort_order ?? 10);
        setIsGlobal(!!initialView.is_global);
        setIsActive(!!initialView.is_active);
        setTargetHub(initialView.target_hub || 'business');
        setPackageId(initialView.package_id || null);
        setTargetStereotypes(initialView.target_stereotypes || []);
        setTargetTypes(initialView.target_types || []);

        const cfg = initialView.config || {};
        if (cfg.columns && Array.isArray(cfg.columns)) {
          setColumns(cfg.columns);
        }
        if (cfg.matrix) {
          setMatrixXField(cfg.matrix.x_axis?.field || 'layer');
          setMatrixXLabel(cfg.matrix.x_axis?.label || 'Layer');
          setMatrixYField(cfg.matrix.y_axis?.field || 'type');
          setMatrixYLabel(cfg.matrix.y_axis?.label || 'Type');
        }
        if (cfg.metrics && Array.isArray(cfg.metrics)) {
          setMetrics(cfg.metrics);
        }
        if (cfg.charts && Array.isArray(cfg.charts)) {
          setCharts(cfg.charts);
        }

        const fCfg = cfg.filter_config || (initialView as any).filter_config || {};
        setFilterLayer(fCfg.selectedLayer || 'All');
        setFilterSearch(fCfg.search || '');
        setFilterSearchInProps(fCfg.searchInProps ?? false);
        setFilterRelationship(fCfg.relationshipFilter || 'all');
        setFilterDocumentation(fCfg.documentationFilter || 'all');
        setFilterMatchLogic(fCfg.matchLogic || 'AND');
        setAttributeRules(fCfg.attributeFilterRules || []);
        setFilterSortBy(fCfg.sortBy || 'name_asc');
      } else {
        setName('');
        setViewKey('');
        setCategory('Portfolio Governance');
        setDescription('');
        setViewType('table');
        setIcon('Table');
        setSortOrder(10);
        setIsGlobal(false);
        setIsActive(false); // Inactive (Draft) by default
        setTargetHub('business');
        setPackageId(null);
        setTargetStereotypes([]);
        setTargetTypes(['ApplicationComponent']);
        setColumns([
          { field: 'name', label: 'Element Name', type: 'string', sortable: true, filterable: true },
          { field: 'type', label: 'ArchiMate Type', type: 'badge', sortable: true, filterable: true },
          { field: 'layer', label: 'Layer', type: 'badge', sortable: true, filterable: true },
          { field: 'documentation', label: 'Documentation', type: 'string', sortable: false, filterable: false }
        ]);
        setMatrixXField('layer');
        setMatrixXLabel('Layer');
        setMatrixYField('type');
        setMatrixYLabel('ArchiMate Type');
        setMetrics([
          { id: 'total_count', label: 'Total Elements', value: 0, type: 'count' }
        ]);
        setCharts([
          { id: 'by_type', title: 'Elements by Type', type: 'bar', group_by: 'type', data: [] },
          { id: 'by_layer', title: 'Distribution by Layer', type: 'pie', group_by: 'layer', data: [] }
        ]);
        setFilterLayer('All');
        setFilterSearch('');
        setFilterSearchInProps(false);
        setFilterRelationship('all');
        setFilterDocumentation('all');
        setFilterMatchLogic('AND');
        setAttributeRules([]);
        setFilterSortBy('name_asc');
      }

      loadStereotypes();
      loadPackages();
      loadMetamodel();
    }
  }, [isOpen, initialView, modelId]);

  const loadStereotypes = async () => {
    setLoadingStereos(true);
    try {
      const res = await api.getStereotypes(undefined, modelId);
      setAvailableStereotypes(res || []);
    } catch (err) {
      console.warn('Could not load stereotypes:', err);
    } finally {
      setLoadingStereos(false);
    }
  };

  const loadPackages = async () => {
    try {
      const res = await api.getAttributePackages(modelId);
      setAvailablePackages(res || []);
    } catch (err) {
      console.warn('Could not load packages:', err);
    }
  };

  const loadMetamodel = async () => {
    try {
      const res = await api.getMetamodelTypes(modelId);
      setMetamodelLayers(res || []);
    } catch (err) {
      console.warn('Could not load metamodel:', err);
    }
  };

  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!initialView) {
      setViewKey(generateSlug(val));
    }
  };

  const handleAddColumn = () => {
    setColumns([
      ...columns,
      { field: 'new_attribute', label: 'New Attribute', type: 'string', sortable: true, filterable: true }
    ]);
  };

  const handleRemoveColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const handleMoveColumn = (idx: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= columns.length) return;
    const updated = [...columns];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setColumns(updated);
  };

  const handleAddMetric = () => {
    setMetrics([
      ...metrics,
      { id: `metric_${Date.now()}`, label: 'Metric Name', value: 0, type: 'count' }
    ]);
  };

  const handleRemoveMetric = (idx: number) => {
    setMetrics(metrics.filter((_, i) => i !== idx));
  };

  const handleAddChart = () => {
    setCharts([
      ...charts,
      { id: `chart_${Date.now()}`, title: 'Chart Title', type: 'bar', group_by: 'type', data: [] }
    ]);
  };

  const handleRemoveChart = (idx: number) => {
    setCharts(charts.filter((_, i) => i !== idx));
  };

  const handleAddAttributeRule = () => {
    if (allAvailableAttributes.length === 0) return;
    const defaultAttr = allAvailableAttributes[0];
    const ops = getOperatorsForDataType(defaultAttr.data_type);
    const newRule: AttributeFilterRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      attributeName: defaultAttr.name,
      operator: ops[0].id,
      value: defaultAttr.data_type === 'boolean' ? true : defaultAttr.data_type === 'select' ? (defaultAttr.options?.[0] || '') : '',
      secondValue: ''
    };
    setAttributeRules((prev) => [...prev, newRule]);
  };

  const handleUpdateAttributeRule = (ruleId: string, updates: Partial<AttributeFilterRule>) => {
    setAttributeRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        const updated = { ...r, ...updates };
        if (updates.attributeName && updates.attributeName !== r.attributeName) {
          const attrDef = allAvailableAttributes.find((a) => a.name === updates.attributeName);
          const ops = getOperatorsForDataType(attrDef?.data_type);
          updated.operator = ops[0].id;
          updated.value = attrDef?.data_type === 'boolean' ? true : attrDef?.data_type === 'select' ? (attrDef.options?.[0] || '') : '';
          updated.secondValue = '';
        }
        return updated;
      })
    );
  };

  const handleRemoveAttributeRule = (ruleId: string) => {
    setAttributeRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  // Compile final config dictionary
  const buildConfig = () => {
    const filter_config = {
      selectedLayer: filterLayer,
      selectedType: targetTypes.length === 1 ? targetTypes[0] : (targetTypes.length > 0 ? targetTypes[0] : 'All'),
      search: filterSearch,
      searchInProps: filterSearchInProps,
      relationshipFilter: filterRelationship,
      documentationFilter: filterDocumentation,
      selectedStereotypeFilter: targetStereotypes.length === 1 ? targetStereotypes[0] : 'all',
      matchLogic: filterMatchLogic,
      attributeFilterRules: attributeRules,
      sortBy: filterSortBy
    };

    let baseConfig: any = {};
    if (viewType === 'table') {
      baseConfig = { columns };
    } else if (viewType === 'matrix') {
      baseConfig = {
        matrix: {
          x_axis: { field: matrixXField, label: matrixXLabel },
          y_axis: { field: matrixYField, label: matrixYLabel }
        }
      };
    } else {
      baseConfig = { metrics, charts };
    }

    return {
      ...baseConfig,
      filter_config
    };
  };

  // Live preview execution
  const runPreview = async () => {
    if (!modelId) return;
    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const payload: CustomBusinessViewPayload = {
        name: name.trim() || 'Preview View',
        view_key: viewKey.trim() || generateSlug(name) || 'preview',
        description: description.trim() || undefined,
        category: category.trim() || 'Portfolio Governance',
        view_type: viewType,
        icon,
        sort_order: Number(sortOrder) || 0,
        target_hub: targetHub,
        is_global: isGlobal,
        is_active: isActive,
        package_id: packageId || undefined,
        target_stereotypes: targetStereotypes,
        target_types: targetTypes,
        config: buildConfig()
      };
      const res = await api.previewCustomBusinessView(modelId, payload);
      setPreviewData(res);
    } catch (err: any) {
      console.error('Preview error:', err);
      setErrorMsg(err.message || 'Errore durante la generazione dell\'anteprima.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStepChange = (step: 1 | 2 | 3) => {
    if (step === 3) {
      runPreview();
    }
    setActiveStep(step);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg('Il titolo della vista è obbligatorio.');
      setActiveStep(1);
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const payload: CustomBusinessViewPayload = {
        name: name.trim(),
        view_key: viewKey.trim() || generateSlug(name),
        description: description.trim() || undefined,
        category: category.trim() || 'Portfolio Governance',
        view_type: viewType,
        icon,
        sort_order: Number(sortOrder) || 0,
        target_hub: targetHub,
        is_global: isGlobal,
        is_active: isActive,
        package_id: packageId || undefined,
        target_stereotypes: targetStereotypes,
        target_types: targetTypes,
        config: buildConfig()
      };
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore nel salvataggio della vista.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                {initialView
                  ? interpolate(t.businessViews.modalTitleEdit, { name: initialView.name })
                  : t.businessViews.modalTitleCreate}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {t.businessViews.managerSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEPPER TABS */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-100 bg-white flex items-center space-x-2">
          <button
            onClick={() => handleStepChange(1)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeStep === 1
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{t.businessViews.tabMetadata}</span>
          </button>

          <ChevronRight className="w-4 h-4 text-slate-300" />

          <button
            onClick={() => handleStepChange(2)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeStep === 2
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{t.businessViews.tabConfig}</span>
          </button>

          <ChevronRight className="w-4 h-4 text-slate-300" />

          <button
            onClick={() => handleStepChange(3)}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeStep === 3
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.businessViews.tabPreview}</span>
          </button>
        </div>

        {/* ERROR NOTIFICATION */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ======================================================== */}
          {/* STEP 1: METADATA & TARGET SCOPE                          */}
          {/* ======================================================== */}
          {activeStep === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.businessViews.fieldTitle} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    placeholder={t.businessViews.fieldTitlePlaceholder}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.businessViews.fieldCategory}
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={t.businessViews.fieldCategoryPlaceholder}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.businessViews.fieldDescription}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.businessViews.fieldDescriptionPlaceholder}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Associated Package */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Pacchetto / Framework Associato (Opzionale)</span>
                </label>
                <select
                  value={packageId || ''}
                  onChange={(e) => setPackageId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white cursor-pointer font-medium text-slate-800"
                >
                  <option value="">Nessun pacchetto (Vista Indipendente / Standalone)</option>
                  {availablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.id})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Se associata a un pacchetto attivo, la vista apparirà sotto il sottomenù del pacchetto nell'hub selezionato.
                </p>
              </div>

              {/* Target Hub Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destinazione Hub *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetHub('business')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      targetHub === 'business'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>💼 Business Hub</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetHub('architecture')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      targetHub === 'architecture'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>🏛️ Architecture Hub</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetHub('both')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 ${
                      targetHub === 'both'
                        ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>🌐 Entrambi gli Hub</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Stabilisce se la vista compare nella barra laterale del Business Hub, dell'Architecture Hub o di entrambi.
                </p>
              </div>

              {/* View Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  {t.businessViews.fieldViewType}
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => {
                      setViewType('table');
                      if (icon === 'Grid' || icon === 'BarChart3') setIcon('Table');
                    }}
                    className={`cursor-pointer p-3.5 rounded-xl border-2 transition flex items-start space-x-3 ${
                      viewType === 'table'
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <TableIcon className={`w-5 h-5 shrink-0 mt-0.5 ${viewType === 'table' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{t.businessViews.viewTypeTable}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Interactive tabular list with custom columns, sorting, filtering, and detail drawers.
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setViewType('matrix');
                      if (icon === 'Table' || icon === 'BarChart3') setIcon('Grid');
                    }}
                    className={`cursor-pointer p-3.5 rounded-xl border-2 transition flex items-start space-x-3 ${
                      viewType === 'matrix'
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <Grid className={`w-5 h-5 shrink-0 mt-0.5 ${viewType === 'matrix' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{t.businessViews.viewTypeMatrix}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        2D Pivot grid analyzing relationships or attributes across two orthogonal dimensions.
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setViewType('kpi_dashboard');
                      if (icon === 'Table' || icon === 'Grid') setIcon('BarChart3');
                    }}
                    className={`cursor-pointer p-3.5 rounded-xl border-2 transition flex items-start space-x-3 ${
                      viewType === 'kpi_dashboard'
                        ? 'border-indigo-600 bg-indigo-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-indigo-300 bg-white'
                    }`}
                  >
                    <BarChart3 className={`w-5 h-5 shrink-0 mt-0.5 ${viewType === 'kpi_dashboard' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold text-slate-800">{t.businessViews.viewTypeKpi}</div>
                      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        Executive dashboard combining KPI metric cards and aggregated breakdown charts.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Icon & Sort Order & Global Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.businessViews.fieldIcon}
                  </label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {AVAILABLE_ICONS.map((ic) => (
                      <option key={ic.name} value={ic.name}>
                        {ic.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.businessViews.sortOrderLabel}
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isGlobal}
                      onChange={(e) => setIsGlobal(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t.businessViews.fieldGlobal}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.businessViews.fieldGlobalHint}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Publication Status Toggle (Active in Business section) */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-300'}`} />
                    <span>{t.businessViews.fieldActive}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider ${
                      isActive ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isActive ? t.businessViews.statusActive : t.businessViews.statusInactive}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {t.businessViews.fieldActiveHint}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Target Scope: Stereotypes and Types */}
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      {t.businessViews.targetScope}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Define which elements in the enterprise model are queried and processed by this view.
                    </p>
                  </div>
                </div>

                {/* ArchiMate Types Multi-select Chips */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.businessViews.fieldTypes}
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {COMMON_ARCHIMATE_TYPES.map((typeName) => {
                      const isSelected = targetTypes.includes(typeName);
                      return (
                        <button
                          key={typeName}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setTargetTypes(targetTypes.filter((t) => t !== typeName));
                            } else {
                              setTargetTypes([...targetTypes, typeName]);
                            }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{typeName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Stereotypes Multi-select Chips */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t.businessViews.fieldStereotypes}
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                    {availableStereotypes.length === 0 ? (
                      <span className="text-xs text-slate-400 italic p-1">
                        {loadingStereos ? 'Caricamento stereotipi...' : 'Nessuno stereotipo definito nel workspace.'}
                      </span>
                    ) : (
                      availableStereotypes.map((st) => {
                        const isSelected = targetStereotypes.includes(st.id) || targetStereotypes.includes(st.name);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setTargetStereotypes(
                                  targetStereotypes.filter((id) => id !== st.id && id !== st.name)
                                );
                              } else {
                                setTargetStereotypes([...targetStereotypes, st.id]);
                              }
                            }}
                            className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition flex items-center space-x-1 ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{st.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: CONFIGURATION BUILDER                            */}
          {/* ======================================================== */}
          {activeStep === 2 && (
            <div className="space-y-6">

              {/* TABLE COLUMNS BUILDER */}
              {viewType === 'table' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        {t.businessViews.columnsConfigTitle}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Choose the properties, custom attributes, or metadata displayed as columns in the table.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddColumn}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.businessViews.addColumn}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {columns.map((col, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3"
                      >
                        <div className="flex flex-col space-y-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveColumn(idx, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === columns.length - 1}
                            onClick={() => handleMoveColumn(idx, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">
                              {t.businessViews.columnField}
                            </label>
                            <input
                              type="text"
                              value={col.field}
                              onChange={(e) => {
                                const updated = [...columns];
                                updated[idx].field = e.target.value;
                                setColumns(updated);
                              }}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">
                              {t.businessViews.columnLabel}
                            </label>
                            <input
                              type="text"
                              value={col.label}
                              onChange={(e) => {
                                const updated = [...columns];
                                updated[idx].label = e.target.value;
                                setColumns(updated);
                              }}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">
                              {t.businessViews.columnType}
                            </label>
                            <select
                              value={col.type}
                              onChange={(e) => {
                                const updated = [...columns];
                                updated[idx].type = e.target.value as any;
                                setColumns(updated);
                              }}
                              className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="string">Text (String)</option>
                              <option value="badge">Badge / Tag</option>
                              <option value="enum">Enum</option>
                              <option value="number">Number</option>
                              <option value="currency">Currency (€)</option>
                              <option value="date">Date</option>
                            </select>
                          </div>

                          <div className="flex items-center space-x-3 pt-3">
                            <label className="flex items-center space-x-1 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!col.sortable}
                                onChange={(e) => {
                                  const updated = [...columns];
                                  updated[idx].sortable = e.target.checked;
                                  setColumns(updated);
                                }}
                                className="w-3.5 h-3.5 rounded text-indigo-600"
                              />
                              <span className="text-[11px] font-medium">{t.businessViews.columnSortable}</span>
                            </label>

                            <label className="flex items-center space-x-1 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!col.filterable}
                                onChange={(e) => {
                                  const updated = [...columns];
                                  updated[idx].filterable = e.target.checked;
                                  setColumns(updated);
                                }}
                                className="w-3.5 h-3.5 rounded text-indigo-600"
                              />
                              <span className="text-[11px] font-medium">{t.businessViews.columnFilterable}</span>
                            </label>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveColumn(idx)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Rimuovi colonna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MATRIX CONFIG BUILDER */}
              {viewType === 'matrix' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      {t.businessViews.matrixConfigTitle}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Configure the dimensions that form the rows and columns of the 2D Pivot Matrix.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <h5 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Grid className="w-4 h-4 text-indigo-600" />
                        <span>{t.businessViews.matrixAxisX}</span>
                      </h5>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          {t.businessViews.matrixAxisField}
                        </label>
                        <input
                          type="text"
                          value={matrixXField}
                          onChange={(e) => setMatrixXField(e.target.value)}
                          placeholder="e.g. layer, apm_business_criticality"
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Header Label
                        </label>
                        <input
                          type="text"
                          value={matrixXLabel}
                          onChange={(e) => setMatrixXLabel(e.target.value)}
                          placeholder="e.g. Layer, Criticality"
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <h5 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                        <Grid className="w-4 h-4 text-indigo-600" />
                        <span>{t.businessViews.matrixAxisY}</span>
                      </h5>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          {t.businessViews.matrixAxisField}
                        </label>
                        <input
                          type="text"
                          value={matrixYField}
                          onChange={(e) => setMatrixYField(e.target.value)}
                          placeholder="e.g. type, apm_technical_fit"
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                          Header Label
                        </label>
                        <input
                          type="text"
                          value={matrixYLabel}
                          onChange={(e) => setMatrixYLabel(e.target.value)}
                          placeholder="e.g. Element Type, Tech Fit"
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* KPI DASHBOARD CONFIG BUILDER */}
              {viewType === 'kpi_dashboard' && (
                <div className="space-y-6">
                  {/* Metrics */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        {t.businessViews.kpiMetricsTitle}
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddMetric}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t.businessViews.addMetric}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {metrics.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                {t.businessViews.metricLabel}
                              </label>
                              <input
                                type="text"
                                value={m.label}
                                onChange={(e) => {
                                  const updated = [...metrics];
                                  updated[idx].label = e.target.value;
                                  setMetrics(updated);
                                }}
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                {t.businessViews.metricType}
                              </label>
                              <select
                                value={m.type}
                                onChange={(e) => {
                                  const updated = [...metrics];
                                  updated[idx].type = e.target.value;
                                  setMetrics(updated);
                                }}
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="count">{t.businessViews.metricTypeCount}</option>
                                <option value="sum">{t.businessViews.metricTypeSum}</option>
                                <option value="average">{t.businessViews.metricTypeAverage}</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                {t.businessViews.metricField}
                              </label>
                              <input
                                type="text"
                                value={(m as any).field || ''}
                                placeholder="e.g. apm_annual_cost_eur"
                                onChange={(e) => {
                                  const updated = [...metrics];
                                  (updated[idx] as any).field = e.target.value;
                                  setMetrics(updated);
                                }}
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveMetric(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        {t.businessViews.kpiChartsTitle}
                      </h4>
                      <button
                        type="button"
                        onClick={handleAddChart}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold transition flex items-center space-x-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t.businessViews.addChart}</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {charts.map((c, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3"
                        >
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                {t.businessViews.chartTitle}
                              </label>
                              <input
                                type="text"
                                value={c.title}
                                onChange={(e) => {
                                  const updated = [...charts];
                                  updated[idx].title = e.target.value;
                                  setCharts(updated);
                                }}
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-semibold"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                {t.businessViews.chartType}
                              </label>
                              <select
                                value={c.type}
                                onChange={(e) => {
                                  const updated = [...charts];
                                  updated[idx].type = e.target.value as any;
                                  setCharts(updated);
                                }}
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                              >
                                <option value="bar">Bar Chart</option>
                                <option value="pie">Pie Chart</option>
                                <option value="donut">Donut Chart</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase block">
                                {t.businessViews.chartGroupBy}
                              </label>
                              <input
                                type="text"
                                value={c.group_by}
                                onChange={(e) => {
                                  const updated = [...charts];
                                  updated[idx].group_by = e.target.value;
                                  setCharts(updated);
                                }}
                                placeholder="e.g. type, layer, apm_lifecycle_status"
                                className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveChart(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* FILTER CONFIGURATION & ATTRIBUTE RULES */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                      <Filter className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <span>Criteri di Filtraggio & Regole di Selezione (filter_config)</span>
                        {activeFiltersCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {activeFiltersCount} filtri attivi
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Imposta i criteri per restringere gli elementi inclusi nella vista (layer, ricerca testuale, connettività, documentazione e regole multi-attributo).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  {/* Row 1: Layer, Search & SearchInProps, SortBy */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Layer */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Layer ArchiMate
                      </label>
                      <select
                        value={filterLayer}
                        onChange={(e) => setFilterLayer(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                      >
                        <option value="All">Tutti i Layer (All)</option>
                        <option value="Strategy">Strategy</option>
                        <option value="Business">Business</option>
                        <option value="Application">Application</option>
                        <option value="Technology">Technology</option>
                        <option value="Motivation">Motivation</option>
                        <option value="Implementation">Implementation</option>
                      </select>
                    </div>

                    {/* Search */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Ricerca Testuale
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          placeholder="Cerca per nome, ID o testo..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                      </div>
                      <label className="flex items-center space-x-1.5 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterSearchInProps}
                          onChange={(e) => setFilterSearchInProps(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300"
                        />
                        <span className="text-[10px] text-slate-600 font-medium">Cerca anche nei valori delle proprietà</span>
                      </label>
                    </div>

                    {/* Sort By */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Ordinamento Predefinito
                      </label>
                      <select
                        value={filterSortBy}
                        onChange={(e) => setFilterSortBy(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="name_asc">Nome (A - Z)</option>
                        <option value="name_desc">Nome (Z - A)</option>
                        <option value="type_asc">Tipo Elemento (A - Z)</option>
                        <option value="type_desc">Tipo Elemento (Z - A)</option>
                        <option value="layer_asc">Layer (A - Z)</option>
                        <option value="layer_desc">Layer (Z - A)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Connectivity & Documentation Pills */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                    {/* Connectivity */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Connettività / Relazioni
                      </label>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setFilterRelationship('all')}
                          className={`px-3 py-1 rounded-md transition ${filterRelationship === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Tutti
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterRelationship('orphan')}
                          className={`px-3 py-1 rounded-md transition ${filterRelationship === 'orphan' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Solo Orfani (Isolati)
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterRelationship('connected')}
                          className={`px-3 py-1 rounded-md transition ${filterRelationship === 'connected' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Solo Connessi
                        </button>
                      </div>
                    </div>

                    {/* Documentation */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                        Documentazione
                      </label>
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setFilterDocumentation('all')}
                          className={`px-3 py-1 rounded-md transition ${filterDocumentation === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Tutti
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterDocumentation('with_doc')}
                          className={`px-3 py-1 rounded-md transition ${filterDocumentation === 'with_doc' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Con Documentazione
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterDocumentation('no_doc')}
                          className={`px-3 py-1 rounded-md transition ${filterDocumentation === 'no_doc' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Senza Documentazione
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Multi-attribute Filter Rules */}
                  <div className="pt-3 border-t border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider">
                          Regole Avanzate Attributi
                        </span>
                        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => setFilterMatchLogic('AND')}
                            className={`px-2 py-0.5 rounded transition ${filterMatchLogic === 'AND' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            AND (Tutte)
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterMatchLogic('OR')}
                            className={`px-2 py-0.5 rounded transition ${filterMatchLogic === 'OR' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            OR (Almeno una)
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddAttributeRule}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Aggiungi Regola Attributo</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {attributeRules.map((rule) => {
                        const attrDef = allAvailableAttributes.find((a) => a.name === rule.attributeName);
                        const ops = getOperatorsForDataType(attrDef?.data_type);

                        return (
                          <div
                            key={rule.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center gap-2"
                          >
                            {/* Attribute Select */}
                            <div className="w-full sm:w-52">
                              <select
                                value={rule.attributeName}
                                onChange={(e) => handleUpdateAttributeRule(rule.id, { attributeName: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                {allAvailableAttributes.map((attr) => (
                                  <option key={attr.name} value={attr.name}>
                                    [{attr.section || 'General'}] {attr.label || attr.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Operator Select */}
                            <div className="w-full sm:w-44">
                              <select
                                value={rule.operator}
                                onChange={(e) => handleUpdateAttributeRule(rule.id, { operator: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                              >
                                {ops.map((op) => (
                                  <option key={op.id} value={op.id}>
                                    {op.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Value Input */}
                            <div className="flex-1">
                              {rule.operator === 'empty' || rule.operator === 'not_empty' ? (
                                <span className="text-[11px] text-slate-400 italic px-2">
                                  (Verifica presenza valore)
                                </span>
                              ) : rule.operator === 'is_true' || rule.operator === 'is_false' ? (
                                <span className="text-[11px] font-bold text-emerald-700 px-2">
                                  {rule.operator === 'is_true' ? 'Vero (True)' : 'Falso (False)'}
                                </span>
                              ) : rule.operator === 'between' ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    placeholder="Min"
                                    value={rule.value}
                                    onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-slate-400 text-xs">-</span>
                                  <input
                                    type="number"
                                    placeholder="Max"
                                    value={rule.secondValue || ''}
                                    onChange={(e) => handleUpdateAttributeRule(rule.id, { secondValue: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                              ) : attrDef?.data_type === 'select' && attrDef.options && attrDef.options.length > 0 ? (
                                <select
                                  value={rule.value}
                                  onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                  <option value="">-- Seleziona opzione --</option>
                                  {attrDef.options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : attrDef?.data_type === 'date' ? (
                                <input
                                  type="date"
                                  value={rule.value || ''}
                                  onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                              ) : attrDef?.data_type === 'number' ? (
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  value={rule.value}
                                  onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Valore filtro..."
                                  value={rule.value || ''}
                                  onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                                />
                              )}
                            </div>

                            {/* Remove Rule Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveAttributeRule(rule.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition self-end sm:self-center cursor-pointer"
                              title="Rimuovi regola"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}

                      {attributeRules.length === 0 && (
                        <div className="p-3 text-center text-slate-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-slate-200">
                          Nessuna regola attributo avanzata impostata.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: LIVE PREVIEW                                     */}
          {/* ======================================================== */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <Eye className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950">
                      Live Preview & Model Validation
                    </h4>
                    <p className="text-[11px] text-indigo-700">
                      Simulation of how this view will be presented to business stakeholders in the Business section.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={runPreview}
                  disabled={previewLoading}
                  className="px-3 py-1.5 rounded-lg bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                >
                  {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>Aggiorna Anteprima</span>
                </button>
              </div>

              {previewLoading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                  <span className="text-xs text-slate-500 font-semibold">
                    Interrogazione del modello e rendering dell'anteprima...
                  </span>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                        {name || 'Titolo Vista'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Categoria: {category} • Tipo: {viewType}
                      </span>
                    </div>
                    {isGlobal && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {t.businessViews.scopeGlobalBadge}
                      </span>
                    )}
                  </div>

                  {/* Table View Preview */}
                  {viewType === 'table' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>
                          Mostrati i primi {Math.min(15, previewData?.rows?.length || 0)} di {previewData?.total ?? 0} elementi corrispondenti
                        </span>
                        {previewData?.total === 0 && (
                          <span className="text-amber-600 font-bold">
                            Nessun elemento corrisponde ai filtri selezionati (stereotipi/tipi).
                          </span>
                        )}
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] sticky top-0 z-10 shadow-2xs">
                            <tr>
                              {columns.map((c, i) => (
                                <th key={i} className="px-3 py-2.5">
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {previewData?.rows && previewData.rows.length > 0 ? (
                              previewData.rows.slice(0, 15).map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                                  {columns.map((c, cIdx) => {
                                    const val = row[c.field];
                                    return (
                                      <td key={cIdx} className="px-3 py-2 text-slate-700">
                                        {c.type === 'badge' && val ? (
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block">
                                            {String(val)}
                                          </span>
                                        ) : c.type === 'currency' && val != null && !isNaN(Number(val)) ? (
                                          <span className="font-mono font-semibold text-emerald-700">
                                            € {Number(val).toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="truncate max-w-xs block">
                                            {val != null && String(val).trim() !== '' ? String(val) : '—'}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-400 italic">
                                  {t.businessViews.previewNoData}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Matrix Preview */}
                  {viewType === 'matrix' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>
                          Matrice 2D: {matrixYLabel} (Righe) × {matrixXLabel} (Colonne) • {previewData?.total ?? 0} elementi analizzati
                        </span>
                      </div>

                      {(previewData as any)?.matrix_summary?.grid && Object.keys((previewData as any).matrix_summary.grid).length > 0 ? (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                          {(() => {
                            const grid = (previewData as any).matrix_summary.grid as Record<string, Record<string, number>>;
                            const rowKeys = Object.keys(grid);
                            const colKeys = Array.from(new Set(rowKeys.flatMap(rk => Object.keys(grid[rk])))).sort();
                            return (
                              <table className="w-full text-xs text-left border-collapse bg-white rounded-lg overflow-hidden border border-slate-200">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="p-2 font-black text-slate-700 bg-slate-100">
                                      {matrixYLabel} \ {matrixXLabel}
                                    </th>
                                    {colKeys.map((ck, i) => (
                                      <th key={i} className="p-2 font-bold text-indigo-800 bg-indigo-50/60 border-l border-slate-200 text-center">
                                        {ck}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {rowKeys.map((rk, ri) => (
                                    <tr key={ri} className="hover:bg-slate-50 transition">
                                      <td className="p-2 font-bold text-slate-800 bg-slate-50/70 border-r border-slate-200">
                                        {rk}
                                      </td>
                                      {colKeys.map((ck, ci) => {
                                        const cnt = grid[rk]?.[ck] || 0;
                                        return (
                                          <td key={ci} className="p-2 text-center border-l border-slate-200 font-semibold">
                                            {cnt > 0 ? (
                                              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-600 text-white shadow-2xs">
                                                {cnt}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300 font-mono">—</span>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                          <Grid className="w-8 h-8 text-indigo-400 mx-auto" />
                          <div className="text-xs font-bold text-slate-700">
                            Matrice 2D: {matrixYLabel} (Righe) × {matrixXLabel} (Colonne)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Nessun dato corrispondente trovato nel modello per incrociare {matrixYField} e {matrixXField}.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KPI Preview */}
                  {viewType === 'kpi_dashboard' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {(previewData?.metrics || metrics).map((m, i) => (
                          <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block tracking-wider truncate">
                              {m.label}
                            </span>
                            <span className="text-xl font-black text-indigo-600">
                              {typeof m.value === 'number' ? m.value.toLocaleString() : (m.value ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(previewData?.charts || charts).map((c, i) => (
                          <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">{c.title}</span>
                              <span className="text-[10px] font-semibold text-indigo-600 uppercase">
                                {c.type}
                              </span>
                            </div>
                            {c.data && c.data.length > 0 ? (
                              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                {c.data.map((item, dIdx) => (
                                  <div key={dIdx} className="space-y-0.5">
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-600 font-medium truncate">{item.label}</span>
                                      <span className="font-bold text-slate-800">{item.count}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className="bg-indigo-600 h-full rounded-full"
                                        style={{
                                          width: `${Math.min(100, Math.round((item.count / Math.max(1, (previewData?.total || 1))) * 100))}%`
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="h-20 flex items-center justify-center text-[11px] text-slate-400 italic">
                                Nessun dato raggruppabile per {c.group_by}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => handleStepChange((activeStep - 1) as any)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center space-x-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Indietro</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition"
            >
              {t.businessViews.cancel}
            </button>

            {activeStep < 3 ? (
              <button
                type="button"
                onClick={() => handleStepChange((activeStep + 1) as any)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm text-xs font-bold transition flex items-center space-x-1.5"
              >
                <span>Avanti</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.businessViews.saveView}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
