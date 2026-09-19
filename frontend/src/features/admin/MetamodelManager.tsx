import React, { useState, useEffect } from 'react';
import {
  MetamodelLayer,
  MetamodelElementType,
  CustomAttributeDefinition,
  CustomAttributeCreatePayload,
  MetamodelRelationshipsMatrixData,
  ArchiMateRelationshipType,
  MetamodelRelationshipElement,
  ModelWorkspace
} from '../../types';
import { api } from '../../lib/api';
import {
  Boxes,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Sparkles,
  Tag,
  Sliders,
  X,
  Check,
  Info,
  HelpCircle,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  ListFilter,
  GitCommit,
  ArrowRight,
  GitBranch,
  Grid,
  Maximize2,
  Folder,
  FolderPlus,
  Edit3,
  Pencil
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const LAYERS = ['All', 'Strategy', 'Business', 'Application', 'Technology', 'Motivation', 'Implementation'];

interface MetamodelManagerProps {
  models?: ModelWorkspace[];
  activeModelId?: string;
}

export const MetamodelManager: React.FC<MetamodelManagerProps> = ({
  models = [],
  activeModelId
}) => {
  const { t, interpolate } = useLanguage();
  const [activeTab, setActiveTab] = useState<'types' | 'matrix'>('types');

  // Active Scope for Metamodel view: 'global' or specific model_id
  const [selectedScope, setSelectedScope] = useState<string>(activeModelId || 'global');

  // Object Types Data
  const [layersData, setLayersData] = useState<MetamodelLayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<MetamodelElementType | null>(null);
  const [search, setSearch] = useState('');

  // Relationships Matrix Data
  const [matrixData, setMatrixData] = useState<MetamodelRelationshipsMatrixData | null>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [sourceLayerFilter, setSourceLayerFilter] = useState<string>('All');
  const [targetLayerFilter, setTargetLayerFilter] = useState<string>('All');
  const [matrixSearch, setMatrixSearch] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('ApplicationComponent');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('BusinessProcess');
  const [inspectedCell, setInspectedCell] = useState<{ source: string; target: string; relations: string[] } | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttr, setEditingAttr] = useState<CustomAttributeDefinition | null>(null);
  const [savingAttr, setSavingAttr] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Rename Section Modal State
  const [renameSectionModal, setRenameSectionModal] = useState<{
    isOpen: boolean;
    oldSection: string;
    newSection: string;
    error: string | null;
    saving: boolean;
  }>({
    isOpen: false,
    oldSection: '',
    newSection: '',
    error: null,
    saving: false,
  });

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    label: string;
    section: string;
    model_id: string | null;
    description: string;
    element_type: string;
    layer: string;
    data_type: string;
    options_text: string;
    default_value: string;
    is_required: boolean;
  }>({
    name: '',
    label: '',
    section: 'Custom Attributes',
    model_id: activeModelId || null,
    description: '',
    element_type: '*',
    layer: 'All',
    data_type: 'string',
    options_text: '',
    default_value: '',
    is_required: false
  });

  const loadMetamodel = async (scopeId?: string) => {
    setLoading(true);
    try {
      const scopeToQuery = scopeId === undefined ? (selectedScope === 'global' ? undefined : selectedScope) : (scopeId === 'global' ? undefined : scopeId);
      const data = await api.getMetamodelTypes(scopeToQuery);
      setLayersData(data);

      const allTypes = data.flatMap((l: MetamodelLayer) => l.element_types);
      if (allTypes.length > 0) {
        if (selectedType) {
          const found = allTypes.find((tItem: MetamodelElementType) => tItem.type === selectedType.type);
          setSelectedType(found || allTypes[0]);
        } else {
          setSelectedType(allTypes[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRelationshipsMatrix = async () => {
    if (matrixData) return;
    setLoadingMatrix(true);
    try {
      const data = await api.getMetamodelRelationshipsMatrix();
      setMatrixData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatrix(false);
    }
  };

  useEffect(() => {
    loadMetamodel(selectedScope);
  }, [selectedScope]);

  useEffect(() => {
    if (activeTab === 'matrix') {
      loadRelationshipsMatrix();
    }
  }, [activeTab]);

  const handleOpenAddModal = (presetType?: string, presetLayer?: string, presetSection?: string) => {
    setEditingAttr(null);
    setModalError(null);
    setFormData({
      name: '',
      label: '',
      section: presetSection || 'Custom Attributes',
      model_id: selectedScope === 'global' ? null : selectedScope,
      description: '',
      element_type: presetType || (selectedType ? selectedType.type : '*'),
      layer: presetLayer || (selectedType ? selectedType.layer : 'All'),
      data_type: 'string',
      options_text: '',
      default_value: '',
      is_required: false
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (attr: CustomAttributeDefinition) => {
    setEditingAttr(attr);
    setModalError(null);
    setFormData({
      name: attr.name,
      label: attr.label,
      section: attr.section || 'Custom Attributes',
      model_id: attr.model_id || null,
      description: attr.description || '',
      element_type: attr.element_type,
      layer: attr.layer,
      data_type: attr.data_type,
      options_text: (attr.options || []).join(', '),
      default_value: attr.default_value || '',
      is_required: attr.is_required
    });
    setIsModalOpen(true);
  };

  const handleOpenRenameSection = (sectionName: string) => {
    setRenameSectionModal({
      isOpen: true,
      oldSection: sectionName,
      newSection: sectionName,
      error: null,
      saving: false,
    });
  };

  const handleSaveRenameSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameSectionModal.newSection.trim()) return;

    setRenameSectionModal((prev) => ({ ...prev, saving: true, error: null }));
    try {
      await api.renameCustomAttributeSection({
        old_section: renameSectionModal.oldSection,
        new_section: renameSectionModal.newSection.trim(),
        model_id: selectedScope === 'global' ? undefined : selectedScope,
        element_type: selectedType ? selectedType.type : undefined
      });
      await loadMetamodel(selectedScope);
      setRenameSectionModal({
        isOpen: false,
        oldSection: '',
        newSection: '',
        error: null,
        saving: false
      });
    } catch (err: any) {
      console.error(err);
      setRenameSectionModal((prev) => ({
        ...prev,
        saving: false,
        error: err.message || 'Error renaming section'
      }));
    }
  };

  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.label.trim()) return;

    setSavingAttr(true);
    setModalError(null);
    try {
      const optionsArray = formData.data_type === 'select'
        ? formData.options_text.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      if (editingAttr) {
        // Edit Mode
        await api.updateCustomAttribute(editingAttr.id, {
          label: formData.label.trim(),
          section: formData.section.trim() || 'Custom Attributes',
          description: formData.description.trim() || undefined,
          data_type: formData.data_type,
          options: optionsArray,
          default_value: formData.default_value.trim() || undefined,
          is_required: formData.is_required
        });
      } else {
        // Create Mode
        const payload: CustomAttributeCreatePayload = {
          name: formData.name.trim(),
          label: formData.label.trim(),
          section: formData.section.trim() || 'Custom Attributes',
          model_id: formData.model_id,
          description: formData.description.trim() || undefined,
          element_type: formData.element_type,
          layer: formData.layer,
          data_type: formData.data_type,
          options: optionsArray,
          default_value: formData.default_value.trim() || undefined,
          is_required: formData.is_required
        };
        await api.createCustomAttribute(payload);
      }

      await loadMetamodel(selectedScope);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Error saving custom attribute');
    } finally {
      setSavingAttr(false);
    }
  };

  const handleDeleteAttribute = async (attrId: string) => {
    try {
      await api.deleteCustomAttribute(attrId);
      setDeleteConfirmId(null);
      await loadMetamodel(selectedScope);
    } catch (err) {
      console.error(err);
    }
  };

  const getDataTypeIcon = (dt: string) => {
    switch (dt) {
      case 'number':
        return <Hash className="w-3.5 h-3.5 text-blue-600" />;
      case 'boolean':
        return <ToggleLeft className="w-3.5 h-3.5 text-emerald-600" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-amber-600" />;
      case 'select':
        return <ListFilter className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <Type className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">{t.metamodel.loadingMetamodel}</p>
        </div>
      </div>
    );
  }

  // Filtered types for Tab 1
  const filteredLayers = layersData.filter((l) =>
    selectedLayer === 'All' ? true : l.layer === selectedLayer
  );

  const allAvailableTypes = layersData.flatMap((l) => l.element_types);

  const allKnownSections = Array.from(
    new Set([
      'APM & Business Portfolio',
      'Custom Attributes',
      'Security & Compliance',
      'Disaster Recovery & SLAs',
      'Financial Governance',
      'Technical Architecture',
      'Data Privacy & GDPR',
      ...allAvailableTypes.flatMap((tItem) => (tItem.custom_attributes || []).map((a) => (a.section || 'Custom Attributes').trim()))
    ])
  ).filter(Boolean);

  const filteredTypes = filteredLayers.flatMap((layer) =>
    layer.element_types
      .filter((tItem) =>
        tItem.name.toLowerCase().includes(search.toLowerCase()) ||
        tItem.type.toLowerCase().includes(search.toLowerCase()) ||
        tItem.description.toLowerCase().includes(search.toLowerCase())
      )
      .map((tItem) => ({ ...tItem, layerMeta: layer }))
  );

  // Helper for Relationship Matrix
  const getRelationMeta = (relName: string): ArchiMateRelationshipType | undefined => {
    if (!matrixData) return undefined;
    return matrixData.relationship_types.find((r) => r.name.toLowerCase().includes(relName.toLowerCase()) || r.type.toLowerCase().includes(relName.toLowerCase()));
  };

  const getAllowedRelations = (src: string, tgt: string): string[] => {
    if (!matrixData || !matrixData.rules[src]) return [];
    return matrixData.rules[src][tgt] || [];
  };

  // Matrix Filtered Elements
  const matrixSourceElements = matrixData?.elements.filter((e) => {
    const matchLayer = sourceLayerFilter === 'All' || e.layer === sourceLayerFilter;
    const matchSearch = !matrixSearch || e.type.toLowerCase().includes(matrixSearch.toLowerCase()) || e.name.toLowerCase().includes(matrixSearch.toLowerCase());
    return matchLayer && matchSearch;
  }) || [];

  const matrixTargetElements = matrixData?.elements.filter((e) => {
    const matchLayer = targetLayerFilter === 'All' || e.layer === targetLayerFilter;
    return matchLayer;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-rose-600" />
            <span>{t.metamodel.title}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.metamodel.subtitle}
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('types')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'types'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{t.metamodel.tabObjectTypes}</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'matrix'
                ? 'bg-white text-rose-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>{t.metamodel.tabRelationshipsMatrix}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OBJECT TYPES & ATTRIBUTES                         */}
      {/* ======================================================== */}
      {activeTab === 'types' && (
        <div className="space-y-6">
          {/* Scope Selector Bar (Global vs Library) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-inner">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 pl-1">
                <Layers className="w-3.5 h-3.5 text-rose-600" />
                {t.metamodel.scopeFilterTitle}
              </span>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500 cursor-pointer shadow-sm"
              >
                <option value="global">{t.metamodel.scopeGlobalOption}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {interpolate(t.metamodel.scopeLibraryPrefix, { code: m.code || '----', name: m.name })}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-slate-500 pr-1">
              {selectedScope === 'global' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  🌐 {t.metamodel.scopeBadgeGlobal}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold font-mono">
                  📚 {interpolate(t.metamodel.scopeBadgeLibrary, { code: models.find(m => m.id === selectedScope)?.code || '----' })}
                </span>
              )}
            </div>
          </div>

          {/* Layer Filter Pills & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {LAYERS.map((layer) => (
                <button
                  key={layer}
                  onClick={() => setSelectedLayer(layer)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    selectedLayer === layer
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {layer === 'All' ? t.metamodel.allLayersFilter : layer}
                </button>
              ))}
            </div>

            <button
              onClick={() => handleOpenAddModal()}
              className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t.metamodel.addAttributeBtn}</span>
            </button>
          </div>

          {/* Main 2-Column Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Object Types List */}
            <div className="lg:col-span-5 space-y-3">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={t.metamodel.filterTypesPlaceholder}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>

                <div className="text-[11px] font-bold text-slate-500 px-1">
                  {interpolate(t.metamodel.totalObjectTypes, { count: filteredTypes.length })}
                </div>

                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                  {filteredTypes.map((item) => {
                    const isSelected = selectedType?.type === item.type;
                    const totalAttrs =
                      (item.standard_attributes?.length || 0) +
                      (item.custom_attributes?.length || 0);

                    return (
                      <div
                        key={item.type}
                        onClick={() => setSelectedType(item)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-rose-50/70 border-rose-500 ring-1 ring-rose-500/40 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900">{item.type}</span>
                            <h4 className="text-xs text-slate-600 mt-0.5">{item.name}</h4>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.layerMeta.bg_color} ${item.layerMeta.text_color} ${item.layerMeta.border_color}`}>
                            {item.layer}
                          </span>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                          <span>{totalAttrs} {t.metamodel.totalAttributes}</span>
                          {item.custom_attributes && item.custom_attributes.length > 0 && (
                            <span className="font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                              +{item.custom_attributes.length} custom
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Object Type Attributes Inspector */}
            <div className="lg:col-span-7 space-y-6">
              {selectedType ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                  
                  {/* Type Detail Header */}
                  <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                          {selectedType.layer} Layer
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500">{selectedType.type}</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedType.name}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {selectedType.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenAddModal(selectedType.type, selectedType.layer)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition self-start"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.metamodel.addAttributeBtn}</span>
                    </button>
                  </div>

                  {/* Section 1: Standard ArchiMate Attributes (Core) */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Tag className="w-4 h-4 text-slate-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        {t.metamodel.standardCoreSection}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {selectedType.standard_attributes?.map((attr) => (
                        <div key={attr.name} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{attr.label}</span>
                              <span className="font-mono text-[10px] text-slate-500">({attr.name})</span>
                              {attr.is_required && (
                                <span className="text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">
                                  {t.metamodel.required}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500">{attr.description}</p>
                          </div>

                          <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700">
                            {getDataTypeIcon(attr.data_type)}
                            <span>{attr.data_type}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section 2: Custom & Extension Attributes */}
                  <div className="space-y-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-rose-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                          {interpolate(t.metamodel.customAttributesSection, { count: selectedType.custom_attributes?.length || 0 })}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleOpenAddModal(selectedType.type, selectedType.layer)}
                        className="flex items-center space-x-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.metamodel.addAttributeBtn}</span>
                      </button>
                    </div>

                    {selectedType.custom_attributes && selectedType.custom_attributes.length > 0 ? (
                      (() => {
                        const groupedCustom = selectedType.custom_attributes.reduce((acc, attr) => {
                          const sec = (attr.section || 'Custom Attributes').trim() || 'Custom Attributes';
                          if (!acc[sec]) acc[sec] = [];
                          acc[sec].push(attr);
                          return acc;
                        }, {} as Record<string, CustomAttributeDefinition[]>);

                        const sectionNames = Object.keys(groupedCustom);

                        return (
                          <div className="space-y-4">
                            {sectionNames.map((secName) => {
                              const attrs = groupedCustom[secName];
                              const hasEeaAttrs = attrs.some((a) => a.is_system || a.name.startsWith('eea_'));
                              return (
                                <div key={secName} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                                  {/* Section Header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-200/80 gap-2">
                                    <div className="flex items-center space-x-2">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-2xs ${
                                        hasEeaAttrs ? 'bg-purple-100 text-purple-700' : 'bg-rose-100 text-rose-600'
                                      }`}>
                                        <Folder className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-bold text-slate-900">{secName}</span>
                                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.2 rounded-full">
                                          {interpolate(t.metamodel.sectionAttributesCount, { count: attrs.length })}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-2 self-end sm:self-auto">
                                      <button
                                        onClick={() => handleOpenRenameSection(secName)}
                                        className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
                                        title={t.metamodel.renameSectionBtn}
                                      >
                                        <Edit3 className="w-3 h-3 text-slate-500" />
                                        <span>{t.metamodel.renameSectionBtn}</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenAddModal(selectedType.type, selectedType.layer, secName)}
                                        className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition shadow-2xs cursor-pointer"
                                        title={t.metamodel.addToSectionBtn}
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>{t.metamodel.addToSectionBtn}</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Attributes within section */}
                                  <div className="grid grid-cols-1 gap-2.5">
                                    {attrs.map((attr) => {
                                      const isEeaAttr = attr.is_system || attr.name.startsWith('eea_');
                                      return (
                                        <div
                                          key={attr.id}
                                          className={`p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs shadow-2xs transition ${
                                            isEeaAttr
                                              ? 'bg-purple-50/40 border border-purple-200 hover:border-purple-300'
                                              : 'bg-white border border-slate-200/90 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="space-y-1.5 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <span className="font-bold text-slate-900 text-sm">{attr.label}</span>
                                              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                                isEeaAttr
                                                  ? 'text-purple-700 bg-purple-100 border border-purple-200'
                                                  : 'text-rose-700 bg-rose-50 border border-rose-100'
                                              }`}>
                                                {attr.name}
                                              </span>
                                              {isEeaAttr ? (
                                                <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                  ⚡ {t.metamodel.easyEaExtensionBadge}
                                                </span>
                                              ) : attr.library_code ? (
                                                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                  📚 [{attr.library_code}]
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full">
                                                  🌐 {t.metamodel.scopeBadgeGlobal}
                                                </span>
                                              )}
                                              {attr.is_required && (
                                                <span className="text-[9px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">
                                                  {t.metamodel.required}
                                                </span>
                                              )}
                                            </div>

                                            {attr.description && (
                                              <p className="text-xs text-slate-600">{attr.description}</p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-slate-500">
                                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                                {t.metamodel.targetScope}{' '}
                                                <strong className={isEeaAttr ? 'text-purple-800' : 'text-rose-800'}>
                                                  {attr.element_type === '*'
                                                    ? t.metamodel.scopeGlobal
                                                    : attr.element_type.startsWith('layer:')
                                                    ? interpolate(t.metamodel.scopeLayer, { layer: attr.layer })
                                                    : interpolate(t.metamodel.scopeSpecific, { type: attr.element_type })}
                                                </strong>
                                              </span>
                                              <span>•</span>
                                              <span className="flex items-center gap-1">
                                                {getDataTypeIcon(attr.data_type)}
                                                <strong>{attr.data_type}</strong>
                                              </span>
                                              {attr.default_value && (
                                                <>
                                                  <span>•</span>
                                                  <span>{t.metamodel.defaultValue} <code className="bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{attr.default_value}</code></span>
                                                </>
                                              )}
                                            </div>

                                            {attr.options && attr.options.length > 0 && (
                                              <div className={`mt-1 text-[11px] rounded-lg p-2 ${
                                                isEeaAttr
                                                  ? 'text-purple-900 bg-purple-100/50 border border-purple-200'
                                                  : 'text-rose-900 bg-rose-50/50 border border-rose-100'
                                              }`}>
                                                <span className="font-bold">{t.metamodel.optionsList}</span> {attr.options.join(' • ')}
                                              </div>
                                            )}
                                          </div>

                                          {/* Actions: Edit & Delete */}
                                          <div className="flex items-center space-x-1 self-end sm:self-start">
                                            <button
                                              onClick={() => handleOpenEditModal(attr)}
                                              className={`p-1.5 rounded-lg transition ${
                                                isEeaAttr
                                                  ? 'text-purple-600 hover:text-purple-800 hover:bg-purple-100'
                                                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                              }`}
                                              title={t.metamodel.editAttributeBtn}
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>

                                            {isEeaAttr ? (
                                              <span
                                                className="p-1.5 text-slate-300 cursor-not-allowed"
                                                title={t.metamodel.systemAttributeCannotDelete}
                                              >
                                                <Trash2 className="w-3.5 h-3.5 opacity-40" />
                                              </span>
                                            ) : deleteConfirmId === attr.id ? (
                                              <div className="flex items-center space-x-1.5 bg-rose-100 p-1 rounded-lg border border-rose-200">
                                                <button
                                                  onClick={() => handleDeleteAttribute(attr.id)}
                                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                                                >
                                                  {t.metamodel.confirm}
                                                </button>
                                                <button
                                                  onClick={() => setDeleteConfirmId(null)}
                                                  className="px-1.5 py-0.5 text-slate-600 hover:text-slate-900 text-[10px]"
                                                >
                                                  {t.common.cancel}
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => setDeleteConfirmId(attr.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                title={t.metamodel.deleteAttributeTitle}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                        <p className="text-xs text-slate-500">{t.metamodel.noCustomAttributes}</p>
                        <button
                          onClick={() => handleOpenAddModal(selectedType.type, selectedType.layer)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800"
                        >
                          {t.metamodel.addFirstAttribute}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              ) : (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center text-slate-400 text-xs">
                  {t.metamodel.selectObjectTypeHint}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ARCHIMATE RELATIONSHIPS MATRIX                    */}
      {/* ======================================================== */}
      {activeTab === 'matrix' && (
        <div className="space-y-6">
          {loadingMatrix || !matrixData ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500 font-medium">{t.metamodel.loadingMatrix}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Section: Quick Relationship Explorer & Validator */}
              <div className="bg-gradient-to-r from-rose-50/70 via-white to-indigo-50/50 border border-rose-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-5 h-5 text-rose-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{t.metamodel.quickExplorerTitle}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{t.metamodel.quickExplorerDesc}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-2">
                  {/* Source Dropdown */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">{t.metamodel.sourceTypeLabel}</label>
                    <select
                      value={selectedSourceType}
                      onChange={(e) => setSelectedSourceType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500 shadow-sm"
                    >
                      {matrixData.elements.map((el) => (
                        <option key={`src-${el.type}`} value={el.type}>
                          [{el.layer}] {el.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Arrow Icon */}
                  <div className="sm:col-span-2 flex justify-center pt-4">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shadow-sm">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Target Dropdown */}
                  <div className="sm:col-span-5 space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">{t.metamodel.targetTypeLabel}</label>
                    <select
                      value={selectedTargetType}
                      onChange={(e) => setSelectedTargetType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-rose-500 shadow-sm"
                    >
                      {matrixData.elements.map((el) => (
                        <option key={`tgt-${el.type}`} value={el.type}>
                          [{el.layer}] {el.type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick Result Preview */}
                {(() => {
                  const allowed = getAllowedRelations(selectedSourceType, selectedTargetType);
                  return (
                    <div className="mt-3 pt-3 border-t border-rose-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-700">
                          {interpolate(t.metamodel.allowedRelationshipsCount, { count: allowed.length })}:
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {allowed.length > 0 ? (
                          allowed.map((relName) => {
                            const meta = getRelationMeta(relName);
                            return (
                              <div
                                key={relName}
                                className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl border text-xs font-bold shadow-sm ${
                                  meta?.badge_bg || 'bg-slate-100'
                                } ${meta?.badge_text || 'text-slate-800'} ${meta?.border_color || 'border-slate-200'}`}
                                title={meta?.description}
                              >
                                <span className="font-mono text-[10px]">{meta?.symbol || '—'}</span>
                                <span>{meta?.name || relName}</span>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-white/60 font-medium">
                                  {meta?.nature || 'Structural'}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            {t.metamodel.noAllowedRelationships}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Filters Bar for 2D Matrix */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Source Layer Filter */}
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-bold text-slate-600">{t.metamodel.filterSourceLayer}</span>
                      <select
                        value={sourceLayerFilter}
                        onChange={(e) => setSourceLayerFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500"
                      >
                        {LAYERS.map((l) => (
                          <option key={`src-l-${l}`} value={l}>{l === 'All' ? t.metamodel.allLayersFilter : l}</option>
                        ))}
                      </select>
                    </div>

                    {/* Target Layer Filter */}
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-bold text-slate-600">{t.metamodel.filterTargetLayer}</span>
                      <select
                        value={targetLayerFilter}
                        onChange={(e) => setTargetLayerFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-rose-500"
                      >
                        {LAYERS.map((l) => (
                          <option key={`tgt-l-${l}`} value={l}>{l === 'All' ? t.metamodel.allLayersFilter : l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Search Source Elements */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder={t.metamodel.searchSourceElementPlaceholder}
                      value={matrixSearch}
                      onChange={(e) => setMatrixSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2D Interactive Table Matrix */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold">{t.metamodel.matrixViewHint}</span>
                  <span className="text-[11px] text-slate-500">
                    {interpolate(t.metamodel.sourcesDestinationsCount, { sources: matrixSourceElements.length, targets: matrixTargetElements.length })}
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                        <th className="p-3 font-bold text-slate-700 bg-slate-100 sticky left-0 z-30 border-r border-slate-200 min-w-[200px]">
                          {t.metamodel.sourceTypeLabel} ➔ / {t.metamodel.targetTypeLabel} ↓
                        </th>
                        {matrixTargetElements.map((tgt) => (
                          <th key={`th-${tgt.type}`} className="p-2.5 font-mono text-[11px] font-bold text-slate-700 whitespace-nowrap min-w-[130px] border-r border-slate-200">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded mr-1 font-sans border ${tgt.bg_color} ${tgt.text_color} ${tgt.border_color}`}>
                              {tgt.layer[0]}
                            </span>
                            {tgt.type}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matrixSourceElements.map((src) => (
                        <tr key={`row-${src.type}`} className="hover:bg-rose-50/30 transition">
                          {/* Row Header (Source Element) */}
                          <td className="p-3 font-bold text-slate-900 bg-white sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center space-x-2">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-sans border ${src.bg_color} ${src.text_color} ${src.border_color}`}>
                                {src.layer}
                              </span>
                              <span className="font-mono text-xs">{src.type}</span>
                            </div>
                          </td>

                          {/* Matrix Cells */}
                          {matrixTargetElements.map((tgt) => {
                            const allowed = getAllowedRelations(src.type, tgt.type);
                            const hasRelations = allowed.length > 0;

                            return (
                              <td
                                key={`cell-${src.type}-${tgt.type}`}
                                onClick={() => {
                                  if (hasRelations) {
                                    setInspectedCell({
                                      source: src.type,
                                      target: tgt.type,
                                      relations: allowed
                                    });
                                  }
                                }}
                                className={`p-2 border-r border-slate-100 text-center align-middle transition ${
                                  hasRelations
                                    ? 'bg-rose-50/20 hover:bg-rose-100/60 cursor-pointer'
                                    : 'bg-slate-50/40 text-slate-300'
                                }`}
                              >
                                {hasRelations ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {allowed.map((rel) => {
                                      const meta = getRelationMeta(rel);
                                      const shortName = rel.slice(0, 4);
                                      return (
                                        <span
                                          key={rel}
                                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                            meta?.badge_bg || 'bg-slate-100'
                                          } ${meta?.badge_text || 'text-slate-800'} ${meta?.border_color || 'border-slate-200'}`}
                                          title={`${rel}: ${meta?.description || ''}`}
                                        >
                                          {meta?.symbol || ''} {shortName}
                                        </span>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ArchiMate Relationship Natures & Symbols Legend */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <Info className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {t.metamodel.relationshipsLegend}
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {matrixData.relationship_types.map((rel) => (
                    <div
                      key={rel.type}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-sm font-bold text-slate-900">{rel.symbol}</span>
                          <span className="font-bold text-slate-900">{rel.name}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${rel.badge_bg} ${rel.badge_text} ${rel.border_color}`}>
                          {rel.nature}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {rel.description}
                      </p>
                      <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-200/60">
                        <span>{rel.is_directed ? t.metamodel.directedRelation : t.metamodel.undirectedRelation}</span>
                        <span className="font-mono text-[9px]">Type: {rel.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </>
          )}
        </div>
      )}

      {/* Modal: Cell Relationship Inspector */}
      {inspectedCell && matrixData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setInspectedCell(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                ArchiMate Specification
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-2 flex items-center gap-2">
                <span className="font-mono">{inspectedCell.source}</span>
                <ArrowRight className="w-4 h-4 text-rose-600" />
                <span className="font-mono">{inspectedCell.target}</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {interpolate(t.metamodel.allowedRelationshipsCount, { count: inspectedCell.relations.length })}
              </p>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {inspectedCell.relations.map((relName) => {
                const meta = getRelationMeta(relName);
                return (
                  <div
                    key={relName}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{meta?.symbol || '—'}</span>
                        <span className="font-bold text-slate-900">{meta?.name || relName}</span>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${meta?.badge_bg || 'bg-slate-100'} ${meta?.badge_text || 'text-slate-800'} ${meta?.border_color || 'border-slate-200'}`}>
                        {meta?.nature || 'Structural'}
                      </span>
                    </div>
                    {meta?.description && (
                      <p className="text-[11px] text-slate-600">{meta.description}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setInspectedCell(null)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {t.processes.closeBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Custom Attribute */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingAttr ? t.metamodel.modalEditTitle : t.metamodel.modalTitle}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              {editingAttr ? t.metamodel.modalEditSubtitle : t.metamodel.modalSubtitle}
            </p>

            {editingAttr && (editingAttr.is_system || editingAttr.name.startsWith('eea_')) && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 text-xs flex items-center space-x-2">
                <Info className="w-4 h-4 flex-shrink-0 text-purple-600" />
                <span>{t.metamodel.systemAttributeLockedHint}</span>
              </div>
            )}

            {modalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAttribute} className="space-y-4">
              
              {/* Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.metamodel.labelAttributeScope}
                </label>
                {editingAttr ? (
                  <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                    {editingAttr.model_id ? (
                      <span className="font-mono text-indigo-700">
                        📚 {interpolate(t.metamodel.scopeOptionLibrary, { code: editingAttr.library_code || '----', name: models.find(m => m.id === editingAttr.model_id)?.name || '' })}
                      </span>
                    ) : (
                      <span>🌐 {t.metamodel.scopeOptionGlobal}</span>
                    )}
                  </div>
                ) : (
                  <select
                    value={formData.model_id || 'global'}
                    onChange={(e) => {
                      const val = e.target.value === 'global' ? null : e.target.value;
                      setFormData({ ...formData, model_id: val });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer font-semibold"
                  >
                    <option value="global">{t.metamodel.scopeOptionGlobal}</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {interpolate(t.metamodel.scopeOptionLibrary, { code: m.code || '----', name: m.name })}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Section / Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.metamodel.labelSection} *
                </label>
                <input
                  type="text"
                  required
                  list="section-suggestions-list"
                  placeholder={t.metamodel.placeholderSection}
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white font-medium"
                />
                <datalist id="section-suggestions-list">
                  {allKnownSections.map((sec) => (
                    <option key={sec} value={sec} />
                  ))}
                </datalist>

                {/* Quick suggestion chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 font-semibold">{t.metamodel.sectionSuggestions}</span>
                  {allKnownSections.slice(0, 5).map((sec) => (
                    <button
                      key={`chip-${sec}`}
                      type="button"
                      onClick={() => setFormData({ ...formData, section: sec })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition cursor-pointer ${
                        formData.section === sec
                          ? 'bg-rose-100 text-rose-800 border-rose-300 font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.metamodel.labelFieldName} *
                  </label>
                  {editingAttr ? (
                    <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700">
                      {editingAttr.name}
                    </div>
                  ) : formData.model_id ? (
                    <div>
                      {(() => {
                        const targetLib = models.find((m) => m.id === formData.model_id);
                        const libPrefix = (targetLib?.code || 'LIB').toLowerCase() + '_';
                        return (
                          <div>
                            <div className="flex items-center">
                              <span className="px-3 py-2 bg-slate-200 text-slate-800 font-mono font-bold text-xs rounded-l-xl border border-r-0 border-slate-300 select-none">
                                {libPrefix}
                              </span>
                              <input
                                type="text"
                                required
                                placeholder={t.metamodel.placeholderFieldName}
                                value={formData.name}
                                onChange={(e) => {
                                  let val = e.target.value.toLowerCase().replace(/\s+/g, '_');
                                  if (val.startsWith(libPrefix)) val = val.slice(libPrefix.length);
                                  setFormData({ ...formData, name: val });
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-r-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                              />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                              {interpolate(t.metamodel.prefixExplanation, { prefix: libPrefix })}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder={t.metamodel.placeholderFieldName}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.metamodel.labelFieldLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.metamodel.placeholderFieldLabel}
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.metamodel.labelFieldDescription}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.metamodel.placeholderFieldDescription}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.metamodel.labelTargetType}
                  </label>
                  <select
                    disabled={!!editingAttr}
                    value={formData.element_type}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = allAvailableTypes.find((tItem) => tItem.type === val);
                      setFormData({
                        ...formData,
                        element_type: val,
                        layer: matched ? matched.layer : 'All'
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="*">{t.metamodel.targetAllGlobal}</option>
                    {allAvailableTypes.map((tItem) => (
                      <option key={tItem.type} value={tItem.type}>
                        [{tItem.layer}] {tItem.type} ({tItem.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.metamodel.labelDataType}
                  </label>
                  <select
                    disabled={!!editingAttr && (editingAttr.is_system || editingAttr.name.startsWith('eea_'))}
                    value={formData.data_type}
                    onChange={(e) => setFormData({ ...formData, data_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white cursor-pointer disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="string">{t.metamodel.typeString}</option>
                    <option value="number">{t.metamodel.typeNumber}</option>
                    <option value="boolean">{t.metamodel.typeBoolean}</option>
                    <option value="date">{t.metamodel.typeDate}</option>
                    <option value="select">{t.metamodel.typeSelect}</option>
                  </select>
                </div>
              </div>

              {formData.data_type === 'select' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.metamodel.labelOptions} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t.metamodel.placeholderOptions}
                    value={formData.options_text}
                    onChange={(e) => setFormData({ ...formData, options_text: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.metamodel.labelDefaultValue}
                  </label>
                  <input
                    type="text"
                    placeholder={t.metamodel.placeholderDefaultValue}
                    value={formData.default_value}
                    onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className={`flex items-center space-x-2 text-xs font-semibold text-slate-700 ${
                    editingAttr && (editingAttr.is_system || editingAttr.name.startsWith('eea_')) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}>
                    <input
                      type="checkbox"
                      disabled={!!editingAttr && (editingAttr.is_system || editingAttr.name.startsWith('eea_'))}
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                    />
                    <span>{t.metamodel.labelIsRequired}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingAttr}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingAttr ? t.metamodel.saveChangesBtn : t.metamodel.saveAttributeBtn}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Rename Section */}
      {renameSectionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setRenameSectionModal((prev) => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <Edit3 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {t.metamodel.renameSectionModalTitle}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {t.metamodel.renameSectionModalSubtitle}
            </p>

            {renameSectionModal.error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{renameSectionModal.error}</span>
              </div>
            )}

            <form onSubmit={handleSaveRenameSection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.metamodel.labelOldSection}
                </label>
                <input
                  type="text"
                  disabled
                  value={renameSectionModal.oldSection}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 select-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.metamodel.labelNewSection} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.metamodel.placeholderNewSection}
                  value={renameSectionModal.newSection}
                  onChange={(e) => setRenameSectionModal((prev) => ({ ...prev, newSection: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white font-medium"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRenameSectionModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={renameSectionModal.saving}
                  className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{t.metamodel.renameBtn}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

