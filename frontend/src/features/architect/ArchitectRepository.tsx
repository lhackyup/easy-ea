import React, { useState, useEffect, useMemo } from 'react';
import {
  ArchimateElementItem,
  MetamodelLayer,
  MetamodelElementType,
  CustomAttributeDefinition,
  ArchiMateRelationshipType,
  SavedFilterView,
  SavedViewCreatePayload,
  SavedViewUpdatePayload
} from '../../types';
import { api } from '../../lib/api';
import {
  Database,
  Filter,
  Search,
  Plus,
  Box,
  Layers,
  ArrowRight,
  ArrowLeftRight,
  BookOpen,
  Check,
  Edit3,
  Pencil,
  Trash2,
  X,
  Folder,
  Tag,
  AlertCircle,
  CheckCircle2,
  Sliders,
  SlidersHorizontal,
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  ListFilter,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Link2,
  GitCommit,
  GitBranch,
  ArrowUpDown,
  RotateCcw,
  BookmarkPlus,
  BookmarkCheck,
  Bookmark,
  Users,
  User,
  ExternalLink,
  FileSpreadsheet,
  FileArchive,
  Download
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export interface AttributeFilterRule {
  id: string;
  attributeName: string;
  operator: string;
  value: any;
  secondValue?: any;
}

interface ArchitectRepositoryProps {
  modelId: string;
  initialSavedView?: SavedFilterView | null;
  onClearInitialView?: () => void;
}

const LAYERS = ['All', 'Strategy', 'Business', 'Application', 'Technology', 'Motivation', 'Implementation'];

export const ArchitectRepository: React.FC<ArchitectRepositoryProps> = ({
  modelId,
  initialSavedView,
  onClearInitialView,
}) => {
  const { t, interpolate } = useLanguage();
  const { user } = useAuth();
  const currentAuthor = user?.full_name || user?.username || user?.email || 'Architetto';
  const [elements, setElements] = useState<ArchimateElementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedElement, setSelectedElement] = useState<any | null>(null);

  // Advanced Multi-Filter & Search State
  const [selectedType, setSelectedType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('name_asc');
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | 'orphan' | 'connected'>('all');
  const [documentationFilter, setDocumentationFilter] = useState<'all' | 'with_doc' | 'no_doc'>('all');
  const [searchInProps, setSearchInProps] = useState<boolean>(false);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState<boolean>(false);
  const [matchLogic, setMatchLogic] = useState<'AND' | 'OR'>('AND');
  const [attributeFilterRules, setAttributeFilterRules] = useState<AttributeFilterRule[]>([]);

  // Saved Views & Export State
  const [savedViews, setSavedViews] = useState<SavedFilterView[]>([]);
  const [activeSavedView, setActiveSavedView] = useState<SavedFilterView | null>(null);
  const [isSaveViewModalOpen, setIsSaveViewModalOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [saveViewDesc, setSaveViewDesc] = useState('');
  const [saveViewAuthor, setSaveViewAuthor] = useState('Enterprise Architect');
  const [saveViewTags, setSaveViewTags] = useState('');
  const [saveViewIsShared, setSaveViewIsShared] = useState(true);
  const [savingView, setSavingView] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Metamodel Layers & Types structure
  const [metamodelLayers, setMetamodelLayers] = useState<MetamodelLayer[]>([]);
  const [loadingMetamodel, setLoadingMetamodel] = useState(false);

  // Element Create & Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Relationship Create & Edit Modal State
  const [isAddRelationModalOpen, setIsAddRelationModalOpen] = useState(false);
  const [isEditRelationModalOpen, setIsEditRelationModalOpen] = useState(false);
  const [isDeleteRelationModalOpen, setIsDeleteRelationModalOpen] = useState(false);
  const [relationToDelete, setRelationToDelete] = useState<any | null>(null);
  const [allowedRelTypes, setAllowedRelTypes] = useState<ArchiMateRelationshipType[]>([]);
  const [loadingAllowedRels, setLoadingAllowedRels] = useState(false);

  // Global Saving & Notifications
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State for Element Create / Edit
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    type: string;
    layer: string;
    documentation: string;
    properties: Record<string, any>;
  }>({
    name: '',
    type: 'ApplicationComponent',
    layer: 'Application',
    documentation: '',
    properties: {}
  });

  // Form State for Relationship Create / Edit
  const [relationFormData, setRelationFormData] = useState<{
    id?: string;
    direction: 'outgoing' | 'incoming';
    source_id: string;
    target_id: string;
    type: string;
    name: string;
    documentation: string;
  }>({
    direction: 'outgoing',
    source_id: '',
    target_id: '',
    type: 'ServingRelationship',
    name: '',
    documentation: ''
  });

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const loadElements = async (preserveSelectedId?: string) => {
    setLoading(true);
    try {
      const res = await api.getElements(modelId, selectedLayer === 'All' ? undefined : selectedLayer);
      setElements(res);
      
      const targetId = preserveSelectedId || selectedElement?.id || (res.length > 0 ? res[0].id : null);
      if (targetId) {
        try {
          const elRes = await api.getElementDetail(targetId);
          setSelectedElement(elRes);
        } catch {
          if (res.length > 0) {
            const first = await api.getElementDetail(res[0].id);
            setSelectedElement(first);
          } else {
            setSelectedElement(null);
          }
        }
      } else {
        setSelectedElement(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMetamodel = async () => {
    setLoadingMetamodel(true);
    try {
      const data = await api.getMetamodelTypes(modelId);
      setMetamodelLayers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMetamodel(false);
    }
  };

  useEffect(() => {
    loadElements();
  }, [modelId, selectedLayer]);

  useEffect(() => {
    loadMetamodel();
  }, [modelId]);

  const allAvailableTypes = useMemo(() => {
    return metamodelLayers.flatMap((layer) =>
      layer.element_types.map((et) => ({
        ...et,
        layer: layer.layer,
        layerColor: layer.color,
        layerBg: layer.bg_color,
        layerText: layer.text_color,
        layerBorder: layer.border_color
      }))
    );
  }, [metamodelLayers]);

  // Lookup metamodel definition for a given type name
  const getMetamodelTypeInfo = (typeName: string): (MetamodelElementType & { layer?: string }) | undefined => {
    return allAvailableTypes.find((tItem) => tItem.type === typeName);
  };

  const handleSelectElement = async (elemId: string) => {
    try {
      const elRes = await api.getElementDetail(elemId);
      setSelectedElement(elRes);
    } catch (err) {
      console.error(err);
    }
  };

  // Open Element Create Modal
  const handleOpenCreateModal = () => {
    const defaultType = allAvailableTypes.find((tItem) => selectedLayer !== 'All' ? tItem.layer === selectedLayer : true) || allAvailableTypes[0];
    const initialType = defaultType ? defaultType.type : 'ApplicationComponent';
    const initialLayer = defaultType ? defaultType.layer : 'Application';

    const initialProperties: Record<string, any> = {};
    if (defaultType && defaultType.custom_attributes) {
      defaultType.custom_attributes.forEach((ca) => {
        if (ca.default_value !== undefined && ca.default_value !== null && ca.default_value !== '') {
          if (ca.data_type === 'number') {
            initialProperties[ca.name] = Number(ca.default_value);
          } else if (ca.data_type === 'boolean') {
            initialProperties[ca.name] = ca.default_value === 'true' || ca.default_value === '1';
          } else {
            initialProperties[ca.name] = ca.default_value;
          }
        }
      });
    }

    setFormData({
      name: '',
      type: initialType,
      layer: initialLayer,
      documentation: '',
      properties: initialProperties
    });
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  // Change Type in Create Modal
  const handleTypeChange = (newType: string) => {
    const typeInfo = getMetamodelTypeInfo(newType);
    const newLayer = typeInfo?.layer || 'Application';

    const newProperties: Record<string, any> = { ...formData.properties };
    if (typeInfo && typeInfo.custom_attributes) {
      typeInfo.custom_attributes.forEach((ca) => {
        if (!(ca.name in newProperties) && ca.default_value !== undefined && ca.default_value !== null && ca.default_value !== '') {
          if (ca.data_type === 'number') {
            newProperties[ca.name] = Number(ca.default_value);
          } else if (ca.data_type === 'boolean') {
            newProperties[ca.name] = ca.default_value === 'true' || ca.default_value === '1';
          } else {
            newProperties[ca.name] = ca.default_value;
          }
        }
      });
    }

    setFormData((prev) => ({
      ...prev,
      type: newType,
      layer: newLayer,
      properties: newProperties
    }));
  };

  // Open Element Edit Modal
  const handleOpenEditModal = () => {
    if (!selectedElement) return;
    const typeInfo = getMetamodelTypeInfo(selectedElement.type);
    const mergedProps: Record<string, any> = { ...(selectedElement.properties || {}) };

    if (typeInfo && typeInfo.custom_attributes) {
      typeInfo.custom_attributes.forEach((ca) => {
        if (!(ca.name in mergedProps) && ca.default_value !== undefined && ca.default_value !== null && ca.default_value !== '') {
          if (ca.data_type === 'number') {
            mergedProps[ca.name] = Number(ca.default_value);
          } else if (ca.data_type === 'boolean') {
            mergedProps[ca.name] = ca.default_value === 'true' || ca.default_value === '1';
          } else {
            mergedProps[ca.name] = ca.default_value;
          }
        }
      });
    }

    setFormData({
      id: selectedElement.id,
      name: selectedElement.name || '',
      type: selectedElement.type || 'ApplicationComponent',
      layer: selectedElement.layer || (typeInfo?.layer || 'Application'),
      documentation: selectedElement.documentation || '',
      properties: mergedProps
    });
    setModalError(null);
    setIsEditModalOpen(true);
  };

  // Handle Property Change in Element Forms
  const handlePropertyChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      properties: {
        ...prev.properties,
        [key]: value
      }
    }));
  };

  // Save Element Create
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setModalError(t.architect.requiredField + ': ' + t.architect.labelElementName);
      return;
    }

    const currentTypeInfo = getMetamodelTypeInfo(formData.type);
    if (currentTypeInfo && currentTypeInfo.custom_attributes) {
      for (const attr of currentTypeInfo.custom_attributes) {
        if (attr.is_required) {
          const val = formData.properties[attr.name];
          if (val === undefined || val === null || val === '') {
            setModalError(`${t.architect.requiredField}: ${attr.label}`);
            return;
          }
        }
      }
    }

    setSaving(true);
    setModalError(null);
    try {
      const res = await api.createElement(modelId, {
        name: formData.name.trim(),
        type: formData.type,
        layer: formData.layer,
        documentation: formData.documentation.trim(),
        properties: formData.properties
      });
      setIsCreateModalOpen(false);
      showNotification(t.architect.elementCreatedSuccess, 'success');
      await loadElements(res.id);
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Error creating element');
    } finally {
      setSaving(false);
    }
  };

  // Save Element Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name.trim()) {
      setModalError(t.architect.requiredField + ': ' + t.architect.labelElementName);
      return;
    }

    const currentTypeInfo = getMetamodelTypeInfo(formData.type);
    if (currentTypeInfo && currentTypeInfo.custom_attributes) {
      for (const attr of currentTypeInfo.custom_attributes) {
        if (attr.is_required) {
          const val = formData.properties[attr.name];
          if (val === undefined || val === null || val === '') {
            setModalError(`${t.architect.requiredField}: ${attr.label}`);
            return;
          }
        }
      }
    }

    setSaving(true);
    setModalError(null);
    try {
      await api.updateElement(formData.id, {
        name: formData.name.trim(),
        type: formData.type,
        layer: formData.layer,
        documentation: formData.documentation.trim(),
        properties: formData.properties
      });
      setIsEditModalOpen(false);
      showNotification(t.architect.elementUpdatedSuccess, 'success');
      await loadElements(formData.id);
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Error updating element');
    } finally {
      setSaving(false);
    }
  };

  // Delete Element
  const handleDeleteElement = async () => {
    if (!selectedElement) return;
    setSaving(true);
    try {
      await api.deleteElement(selectedElement.id);
      setIsDeleteModalOpen(false);
      showNotification(t.architect.elementDeletedSuccess, 'success');
      setSelectedElement(null);
      await loadElements();
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'Error deleting element', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // RELATIONSHIP MANAGEMENT & ARCHIMATE VALIDATION
  // ==========================================================

  // Fetch allowed relationship types between two elements based on ArchiMate rules
  const fetchAllowedRels = async (sourceId: string, targetId: string) => {
    const srcElem = elements.find((e) => e.id === sourceId) || (selectedElement?.id === sourceId ? selectedElement : null);
    const tgtElem = elements.find((e) => e.id === targetId) || (selectedElement?.id === targetId ? selectedElement : null);
    if (!srcElem || !tgtElem) return;

    setLoadingAllowedRels(true);
    try {
      const allowed = await api.getAllowedRelationshipTypes(srcElem.type, tgtElem.type);
      setAllowedRelTypes(allowed);
      if (allowed.length > 0) {
        setRelationFormData((prev) => ({
          ...prev,
          type: allowed[0].type
        }));
      }
    } catch (err) {
      console.error('Error fetching allowed relationship types:', err);
    } finally {
      setLoadingAllowedRels(false);
    }
  };

  // Open Add Relationship Modal
  const handleOpenAddRelationModal = async (initialDirection: 'outgoing' | 'incoming' = 'outgoing') => {
    if (!selectedElement) return;
    const otherElements = elements.filter((e) => e.id !== selectedElement.id);
    if (otherElements.length === 0) {
      showNotification('Nessun altro elemento disponibile nella libreria con cui creare una relazione.', 'error');
      return;
    }

    const defaultOther = otherElements[0];
    const srcId = initialDirection === 'outgoing' ? selectedElement.id : defaultOther.id;
    const tgtId = initialDirection === 'outgoing' ? defaultOther.id : selectedElement.id;

    setRelationFormData({
      direction: initialDirection,
      source_id: srcId,
      target_id: tgtId,
      type: 'ServingRelationship',
      name: '',
      documentation: ''
    });
    setModalError(null);
    setIsAddRelationModalOpen(true);

    await fetchAllowedRels(srcId, tgtId);
  };

  // Change Direction / Target in Add Relation Modal
  const handleRelationEndpointChange = async (newOtherId: string, direction: 'outgoing' | 'incoming') => {
    if (!selectedElement) return;
    const srcId = direction === 'outgoing' ? selectedElement.id : newOtherId;
    const tgtId = direction === 'outgoing' ? newOtherId : selectedElement.id;

    setRelationFormData((prev) => ({
      ...prev,
      direction,
      source_id: srcId,
      target_id: tgtId
    }));

    await fetchAllowedRels(srcId, tgtId);
  };

  // Open Edit Relationship Modal
  const handleOpenEditRelationModal = async (rel: any) => {
    const srcElem = elements.find((e) => e.id === rel.source_id) || { type: rel.source_type || 'ApplicationComponent' };
    const tgtElem = elements.find((e) => e.id === rel.target_id) || { type: rel.target_type || 'BusinessProcess' };

    setRelationFormData({
      id: rel.id,
      direction: rel.source_id === selectedElement?.id ? 'outgoing' : 'incoming',
      source_id: rel.source_id,
      target_id: rel.target_id,
      type: rel.type,
      name: rel.name || '',
      documentation: rel.documentation || ''
    });
    setModalError(null);
    setIsEditRelationModalOpen(true);

    setLoadingAllowedRels(true);
    try {
      const allowed = await api.getAllowedRelationshipTypes(srcElem.type, tgtElem.type);
      setAllowedRelTypes(allowed);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAllowedRels(false);
    }
  };

  // Save Create Relationship
  const handleSaveCreateRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationFormData.source_id || !relationFormData.target_id) {
      setModalError('Seleziona entrambi gli elementi per la relazione.');
      return;
    }
    if (!relationFormData.type) {
      setModalError('Seleziona un tipo di relazione conforme ad ArchiMate.');
      return;
    }

    setSaving(true);
    setModalError(null);
    try {
      await api.createRelationship(modelId, {
        source_id: relationFormData.source_id,
        target_id: relationFormData.target_id,
        type: relationFormData.type,
        name: relationFormData.name.trim(),
        documentation: relationFormData.documentation.trim()
      });
      setIsAddRelationModalOpen(false);
      showNotification(t.architect.relationCreatedSuccess, 'success');
      if (selectedElement) {
        await handleSelectElement(selectedElement.id);
      }
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Errore nella creazione della relazione');
    } finally {
      setSaving(false);
    }
  };

  // Save Edit Relationship
  const handleSaveEditRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relationFormData.id) return;

    setSaving(true);
    setModalError(null);
    try {
      await api.updateRelationship(relationFormData.id, {
        type: relationFormData.type,
        name: relationFormData.name.trim(),
        documentation: relationFormData.documentation.trim()
      });
      setIsEditRelationModalOpen(false);
      showNotification(t.architect.relationUpdatedSuccess, 'success');
      if (selectedElement) {
        await handleSelectElement(selectedElement.id);
      }
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Errore nell\'aggiornamento della relazione');
    } finally {
      setSaving(false);
    }
  };

  // Open Delete Relationship Confirmation
  const handleOpenDeleteRelationModal = (rel: any) => {
    setRelationToDelete(rel);
    setIsDeleteRelationModalOpen(true);
  };

  // Confirm Delete Relationship
  const handleConfirmDeleteRelation = async () => {
    if (!relationToDelete) return;
    setSaving(true);
    try {
      await api.deleteRelationship(relationToDelete.id);
      setIsDeleteRelationModalOpen(false);
      setRelationToDelete(null);
      showNotification(t.architect.relationDeletedSuccess, 'success');
      if (selectedElement) {
        await handleSelectElement(selectedElement.id);
      }
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || 'Errore nell\'eliminazione della relazione', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Extract all unique custom and extended attributes configured across the metamodel
  const allAvailableAttributes = useMemo(() => {
    const map = new Map<string, CustomAttributeDefinition>();
    metamodelLayers.forEach((layer) => {
      layer.element_types.forEach((et) => {
        if (et.custom_attributes) {
          et.custom_attributes.forEach((ca) => {
            if (!map.has(ca.name)) {
              map.set(ca.name, ca);
            }
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      const secCompare = (a.section || 'Custom Attributes').localeCompare(b.section || 'Custom Attributes');
      if (secCompare !== 0) return secCompare;
      return (a.label || a.name).localeCompare(b.label || b.name);
    });
  }, [metamodelLayers]);

  // Dynamic operators supported per attribute data type
  const getOperatorsForDataType = (dataType: string = 'string') => {
    switch (dataType) {
      case 'number':
        return [
          { id: 'gt', label: t.architect.operatorGt },
          { id: 'lt', label: t.architect.operatorLt },
          { id: 'gte', label: t.architect.operatorGte },
          { id: 'lte', label: t.architect.operatorLte },
          { id: 'equals', label: t.architect.operatorEquals },
          { id: 'between', label: t.architect.operatorBetween },
          { id: 'not_empty', label: t.architect.operatorNotEmpty },
          { id: 'empty', label: t.architect.operatorEmpty },
        ];
      case 'select':
        return [
          { id: 'equals', label: t.architect.operatorEquals },
          { id: 'not_equals', label: t.architect.operatorNotEquals },
          { id: 'not_empty', label: t.architect.operatorNotEmpty },
          { id: 'empty', label: t.architect.operatorEmpty },
        ];
      case 'boolean':
        return [
          { id: 'is_true', label: t.architect.operatorIsTrue },
          { id: 'is_false', label: t.architect.operatorIsFalse },
          { id: 'not_empty', label: t.architect.operatorNotEmpty },
        ];
      case 'date':
        return [
          { id: 'equals', label: t.architect.operatorEquals },
          { id: 'after', label: t.architect.operatorAfter },
          { id: 'before', label: t.architect.operatorBefore },
          { id: 'not_empty', label: t.architect.operatorNotEmpty },
          { id: 'empty', label: t.architect.operatorEmpty },
        ];
      case 'string':
      case 'text':
      default:
        return [
          { id: 'contains', label: t.architect.operatorContains },
          { id: 'equals', label: t.architect.operatorEquals },
          { id: 'not_equals', label: t.architect.operatorNotEquals },
          { id: 'starts_with', label: t.architect.operatorStartsWith },
          { id: 'not_empty', label: t.architect.operatorNotEmpty },
          { id: 'empty', label: t.architect.operatorEmpty },
        ];
    }
  };

  const handleAddAttributeRule = () => {
    if (allAvailableAttributes.length === 0) return;
    const defaultAttr = allAvailableAttributes[0];
    const defaultOps = getOperatorsForDataType(defaultAttr.data_type);
    const newRule: AttributeFilterRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      attributeName: defaultAttr.name,
      operator: defaultOps[0].id,
      value: defaultAttr.data_type === 'boolean' ? true : defaultAttr.data_type === 'select' ? (defaultAttr.options?.[0] || '') : '',
      secondValue: ''
    };
    setAttributeFilterRules((prev) => [...prev, newRule]);
    setIsAdvancedFilterOpen(true);
  };

  const handleUpdateAttributeRule = (ruleId: string, updates: Partial<AttributeFilterRule>) => {
    setAttributeFilterRules((prev) =>
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
    setAttributeFilterRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedLayer !== 'All') count++;
    if (selectedType !== 'All') count++;
    if (search.trim()) count++;
    if (relationshipFilter !== 'all') count++;
    if (documentationFilter !== 'all') count++;
    count += attributeFilterRules.length;
    return count;
  }, [selectedLayer, selectedType, search, relationshipFilter, documentationFilter, attributeFilterRules]);

  const fetchSavedViews = async () => {
    try {
      const res = await fetch(`/api/saved-views?model_id=${modelId}`);
      if (res.ok) {
        const data = await res.json();
        setSavedViews(data);
      }
    } catch (err) {
      console.error('Error fetching saved views:', err);
    }
  };

  useEffect(() => {
    if (modelId) {
      fetchSavedViews();
    }
  }, [modelId]);

  const applySavedView = (view: SavedFilterView) => {
    setActiveSavedView(view);
    const cfg = view.filter_config || {};
    setSelectedLayer(cfg.selectedLayer || 'All');
    setSelectedType(cfg.selectedType || 'All');
    setSearch(cfg.search || '');
    setSearchInProps(cfg.searchInProps ?? false);
    setRelationshipFilter(cfg.relationshipFilter || 'all');
    setDocumentationFilter(cfg.documentationFilter || 'all');
    setMatchLogic(cfg.matchLogic || 'AND');
    setAttributeFilterRules(cfg.attributeFilterRules || []);
    setSortBy(cfg.sortBy || 'name_asc');
  };

  useEffect(() => {
    if (initialSavedView) {
      applySavedView(initialSavedView);
    }
  }, [initialSavedView]);

  const handleOpenSaveViewModal = () => {
    setSaveViewName(activeSavedView ? `${activeSavedView.name} (Nuova)` : '');
    setSaveViewDesc(activeSavedView?.description || '');
    setSaveViewAuthor(currentAuthor);
    setSaveViewTags(activeSavedView?.tags?.join(', ') || '');
    setSaveViewIsShared(activeSavedView?.is_shared ?? true);
    setIsSaveViewModalOpen(true);
  };

  const handleSaveViewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveViewName.trim()) return;

    try {
      setSavingView(true);
      const parsedTags = saveViewTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const filterConfig = {
        selectedLayer,
        selectedType,
        search,
        searchInProps,
        relationshipFilter,
        documentationFilter,
        matchLogic,
        attributeFilterRules,
        sortBy
      };

      const payload: SavedViewCreatePayload = {
        model_id: modelId,
        name: saveViewName.trim(),
        description: saveViewDesc.trim() || undefined,
        author: currentAuthor,
        is_shared: saveViewIsShared,
        tags: parsedTags,
        filter_config: filterConfig
      };

      const res = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const created = await res.json();
        setSavedViews((prev) => [created, ...prev]);
        setActiveSavedView(created);
        setIsSaveViewModalOpen(false);
        showNotification(t.architect.saveViewSuccess, 'success');
      } else {
        showNotification('Errore durante il salvataggio della vista', 'error');
      }
    } catch (err) {
      showNotification('Errore di connessione', 'error');
    } finally {
      setSavingView(false);
    }
  };

  const handleUpdateCurrentView = async () => {
    if (!activeSavedView) return;

    try {
      setSavingView(true);
      const filterConfig = {
        selectedLayer,
        selectedType,
        search,
        searchInProps,
        relationshipFilter,
        documentationFilter,
        matchLogic,
        attributeFilterRules,
        sortBy
      };

      const payload: SavedViewUpdatePayload = {
        filter_config: filterConfig
      };

      const res = await fetch(`/api/saved-views/${activeSavedView.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setSavedViews((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
        setActiveSavedView(updated);
        showNotification(t.architect.updateViewSuccess, 'success');
      } else {
        showNotification('Errore durante l\'aggiornamento della vista', 'error');
      }
    } catch (err) {
      showNotification('Errore di connessione', 'error');
    } finally {
      setSavingView(false);
    }
  };

  const handleResetAllFilters = () => {
    setSelectedLayer('All');
    setSelectedType('All');
    setSearch('');
    setSearchInProps(false);
    setRelationshipFilter('all');
    setDocumentationFilter('all');
    setAttributeFilterRules([]);
    setSortBy('name_asc');
    setActiveSavedView(null);
    if (onClearInitialView) onClearInitialView();
  };

  const evaluateAttributeRule = (el: ArchimateElementItem, rule: AttributeFilterRule, attrDef?: CustomAttributeDefinition): boolean => {
    if (!rule.attributeName) return true;

    // Extract value from properties or apm
    let rawVal = el.properties ? el.properties[rule.attributeName] : undefined;
    if (rawVal === undefined && el.apm) {
      const apmKey = rule.attributeName.replace(/^eea_/, '');
      rawVal = (el.apm as any)[apmKey];
    }
    if (rawVal === undefined && el.properties) {
      const eeaKey = `eea_${rule.attributeName}`;
      rawVal = el.properties[eeaKey];
    }

    const dataType = attrDef?.data_type || (typeof rawVal === 'number' ? 'number' : typeof rawVal === 'boolean' ? 'boolean' : 'string');

    switch (rule.operator) {
      case 'not_empty':
        return rawVal !== undefined && rawVal !== null && rawVal !== '';
      case 'empty':
        return rawVal === undefined || rawVal === null || rawVal === '';
      case 'contains': {
        if (rawVal === undefined || rawVal === null) return false;
        const searchStr = String(rule.value || '').toLowerCase();
        return String(rawVal).toLowerCase().includes(searchStr);
      }
      case 'equals': {
        if (rawVal === undefined || rawVal === null) return false;
        if (dataType === 'number') return Number(rawVal) === Number(rule.value);
        return String(rawVal).toLowerCase() === String(rule.value || '').toLowerCase();
      }
      case 'not_equals': {
        if (rawVal === undefined || rawVal === null) return true;
        if (dataType === 'number') return Number(rawVal) !== Number(rule.value);
        return String(rawVal).toLowerCase() !== String(rule.value || '').toLowerCase();
      }
      case 'starts_with': {
        if (rawVal === undefined || rawVal === null) return false;
        return String(rawVal).toLowerCase().startsWith(String(rule.value || '').toLowerCase());
      }
      case 'gt': {
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        return Number(rawVal) > Number(rule.value);
      }
      case 'lt': {
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        return Number(rawVal) < Number(rule.value);
      }
      case 'gte': {
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        return Number(rawVal) >= Number(rule.value);
      }
      case 'lte': {
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        return Number(rawVal) <= Number(rule.value);
      }
      case 'between': {
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        const num = Number(rawVal);
        const min = rule.value !== '' && rule.value !== undefined ? Number(rule.value) : -Infinity;
        const max = rule.secondValue !== '' && rule.secondValue !== undefined ? Number(rule.secondValue) : Infinity;
        return num >= min && num <= max;
      }
      case 'is_true':
        return rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1';
      case 'is_false':
        return rawVal === false || rawVal === 'false' || rawVal === 0 || rawVal === '0';
      case 'after': {
        if (!rawVal || !rule.value) return false;
        return new Date(rawVal).getTime() > new Date(rule.value).getTime();
      }
      case 'before': {
        if (!rawVal || !rule.value) return false;
        return new Date(rawVal).getTime() < new Date(rule.value).getTime();
      }
      default:
        return true;
    }
  };

  const filteredElements = useMemo(() => {
    return elements.filter((el) => {
      // 1. Layer filter
      if (selectedLayer !== 'All' && el.layer !== selectedLayer) {
        return false;
      }

      // 2. Type filter
      if (selectedType !== 'All' && el.type !== selectedType) {
        return false;
      }

      // 3. Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const nameMatch = el.name.toLowerCase().includes(q);
        const idMatch = el.id.toLowerCase().includes(q);
        const docMatch = el.documentation?.toLowerCase().includes(q) || false;
        let propsMatch = false;
        if (searchInProps && el.properties) {
          propsMatch = Object.values(el.properties).some((v) =>
            v !== null && v !== undefined && String(v).toLowerCase().includes(q)
          );
        }
        if (!nameMatch && !idMatch && !docMatch && !propsMatch) {
          return false;
        }
      }

      // 4. Connectivity / Relationship filter
      const totalRelations = (el.incoming_count || 0) + (el.outgoing_count || 0);
      if (relationshipFilter === 'orphan' && totalRelations > 0) {
        return false;
      }
      if (relationshipFilter === 'connected' && totalRelations === 0) {
        return false;
      }

      // 5. Documentation filter
      if (documentationFilter === 'with_doc' && !el.documentation?.trim()) {
        return false;
      }
      if (documentationFilter === 'no_doc' && el.documentation?.trim()) {
        return false;
      }

      // 6. Multi-Attribute Filter Rules
      if (attributeFilterRules.length > 0) {
        const results = attributeFilterRules.map((rule) => {
          const attrDef = allAvailableAttributes.find((a) => a.name === rule.attributeName);
          return evaluateAttributeRule(el, rule, attrDef);
        });

        if (matchLogic === 'AND') {
          if (!results.every(Boolean)) return false;
        } else {
          if (!results.some(Boolean)) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'type_asc': {
          const typeComp = a.type.localeCompare(b.type);
          return typeComp !== 0 ? typeComp : a.name.localeCompare(b.name);
        }
        case 'layer_asc': {
          const layerComp = a.layer.localeCompare(b.layer);
          return layerComp !== 0 ? layerComp : a.name.localeCompare(b.name);
        }
        case 'cost_desc': {
          const costA = Number(a.properties?.annual_cost || a.apm?.annual_cost || 0);
          const costB = Number(b.properties?.annual_cost || b.apm?.annual_cost || 0);
          return costB - costA;
        }
        case 'cost_asc': {
          const costA = Number(a.properties?.annual_cost || a.apm?.annual_cost || 0);
          const costB = Number(b.properties?.annual_cost || b.apm?.annual_cost || 0);
          return costA - costB;
        }
        case 'fit_desc': {
          const fitA = Number(a.properties?.business_fit || a.apm?.business_fit || 0);
          const fitB = Number(b.properties?.business_fit || b.apm?.business_fit || 0);
          return fitB - fitA;
        }
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [
    elements,
    selectedLayer,
    selectedType,
    search,
    searchInProps,
    relationshipFilter,
    documentationFilter,
    attributeFilterRules,
    matchLogic,
    sortBy,
    allAvailableAttributes
  ]);

  const handleExportRepository = async (format: 'xlsx' | 'csv') => {
    try {
      setExporting(true);
      setExportDropdownOpen(false);
      showNotification(t.architect.exportingData, 'success');

      const viewName =
        activeSavedView?.name ||
        (selectedLayer !== 'All' ? `${selectedLayer}_Layer` : 'Repository_Export');

      const payload = {
        model_id: modelId,
        view_name: viewName,
        format: format,
        element_ids: filteredElements.map((e) => e.id),
        include_relationships: true
      };

      const res = await fetch('/api/saved-views/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = format === 'xlsx' ? 'xlsx' : 'zip';
        const cleanName = viewName.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'repository_export';
        a.download = `EasyEA_${cleanName}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showNotification(t.architect.exportDataSuccess, 'success');
      } else {
        showNotification('Errore durante l\'esportazione dei dati', 'error');
      }
    } catch (err) {
      showNotification('Errore di connessione durante l\'export', 'error');
    } finally {
      setExporting(false);
    }
  };

  const getLayerColor = (layer: string) => {
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

  // Group attributes by section for a given MetamodelElementType
  const getGroupedAttributes = (typeInfo?: MetamodelElementType) => {
    if (!typeInfo || !typeInfo.custom_attributes) return {};
    return typeInfo.custom_attributes.reduce((acc, attr) => {
      const sec = (attr.section || 'Custom Attributes').trim() || 'Custom Attributes';
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(attr);
      return acc;
    }, {} as Record<string, CustomAttributeDefinition[]>);
  };

  // Render input field based on data_type
  const renderFieldInput = (attr: CustomAttributeDefinition, value: any, onChange: (val: any) => void) => {
    const rawVal = value !== undefined && value !== null ? value : (attr.default_value || '');

    switch (attr.data_type) {
      case 'number':
        return (
          <input
            type="number"
            step="any"
            value={rawVal === '' ? '' : Number(rawVal)}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={attr.default_value || '0'}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        );

      case 'boolean': {
        const boolVal = rawVal === true || rawVal === 'true' || rawVal === 1 || rawVal === '1';
        return (
          <div className="flex items-center space-x-3 pt-1">
            <button
              type="button"
              onClick={() => onChange(!boolVal)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                boolVal ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  boolVal ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-semibold text-slate-700">
              {boolVal ? t.architect.booleanTrue : t.architect.booleanFalse}
            </span>
          </div>
        );
      }

      case 'date':
        return (
          <input
            type="date"
            value={typeof rawVal === 'string' ? rawVal.substring(0, 10) : ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        );

      case 'select': {
        const optionsList = attr.options && attr.options.length > 0 ? attr.options : [];
        return (
          <select
            value={rawVal}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
          >
            <option value="">-- {t.architect.selectOptionPrompt} --</option>
            {optionsList.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      }

      case 'text':
        return (
          <textarea
            rows={3}
            value={rawVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder={attr.default_value || ''}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
          />
        );

      case 'string':
      default:
        return (
          <input
            type="text"
            value={rawVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder={attr.default_value || ''}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        );
    }
  };

  // Selected element metadata
  const selectedTypeInfo = selectedElement ? getMetamodelTypeInfo(selectedElement.type) : undefined;
  const selectedGroupedAttrs = getGroupedAttributes(selectedTypeInfo);

  // Other elements for relationship destination
  const otherElementsList = useMemo(() => {
    if (!selectedElement) return [];
    return elements.filter((e) => e.id !== selectedElement.id);
  }, [elements, selectedElement]);

  const currentOtherId = relationFormData.direction === 'outgoing' ? relationFormData.target_id : relationFormData.source_id;
  const currentOtherElement = elements.find((e) => e.id === currentOtherId);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-xl border transition-all animate-bounce duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span className="text-xs font-bold">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-lg">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      )}

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Box className="w-7 h-7 text-emerald-600" />
            <span>{t.architect.repoTitle}</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            {t.architect.repoSubtitle}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.architect.createObjectBtn}</span>
          </button>
        </div>
      </div>

      {/* Full-Width Top Filter & Search Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        {/* Layer Filter Pills & Advanced Filters Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {LAYERS.map((layer) => (
              <button
                key={layer}
                onClick={() => setSelectedLayer(layer)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  selectedLayer === layer
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {layer === 'All' ? t.architect.allLayers : layer}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Load Saved View Dropdown */}
            {savedViews.length > 0 && (
              <div className="relative">
                <select
                  value={activeSavedView?.id || ''}
                  onChange={(e) => {
                    const found = savedViews.find((v) => v.id === e.target.value);
                    if (found) {
                      applySavedView(found);
                    } else {
                      setActiveSavedView(null);
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
                >
                  <option value="">-- {t.architect.selectSavedView} ({savedViews.length}) --</option>
                  {savedViews.map((sv) => (
                    <option key={sv.id} value={sv.id}>
                      {sv.name} {sv.is_shared ? '(Condivisa)' : '(Personale)'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Save As View Button */}
            <button
              onClick={handleOpenSaveViewModal}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              title={t.architect.saveViewBtn}
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.architect.saveViewBtn}</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                disabled={exporting || filteredElements.length === 0}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border shadow-2xs cursor-pointer ${
                  exportDropdownOpen
                    ? 'bg-slate-200 text-slate-900 border-slate-300 ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={t.architect.exportResultsBtn}
              >
                <Download className={`w-3.5 h-3.5 text-emerald-600 ${exporting ? 'animate-bounce' : ''}`} />
                <span>{exporting ? t.architect.exportingData : t.architect.exportResultsBtn}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {exportDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setExportDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 animate-fadeIn">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      {t.architect.exportResultsBtn} ({filteredElements.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportRepository('xlsx')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center space-x-2 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold">{t.architect.exportExcel}</span>
                        <span className="text-[10px] text-slate-400">Cartella Excel con relazioni (.xlsx)</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportRepository('csv')}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-900 flex items-center space-x-2 transition cursor-pointer"
                    >
                      <FileArchive className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold">{t.architect.exportCsv}</span>
                        <span className="text-[10px] text-slate-400">Archivio ZIP con CSV UTF-8 (.zip)</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Advanced Filter Toggle Button */}
            <button
              onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border cursor-pointer ${
                isAdvancedFilterOpen || activeFiltersCount > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-500/20 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title={t.architect.advancedFiltersBtn}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t.architect.advancedFiltersBtn}</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold">
                  {activeFiltersCount}
                </span>
              )}
              {isAdvancedFilterOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Active Saved View Banner */}
        {activeSavedView && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/90 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-950 animate-fadeIn">
            <div className="flex items-center space-x-2">
              <BookmarkCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-500">{t.architect.activeSavedView}:</span>
              <span className="font-extrabold text-emerald-900">{activeSavedView.name}</span>
              {activeSavedView.is_shared ? (
                <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md font-bold">
                  Condivisa
                </span>
              ) : (
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md font-bold">
                  Personale
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center gap-1 border-r border-emerald-200 pr-2 mr-1">
                <button
                  type="button"
                  onClick={() => handleExportRepository('xlsx')}
                  disabled={exporting}
                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-white hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-300 shadow-2xs cursor-pointer transition"
                  title="Esporta questa vista in Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span>XLSX</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportRepository('csv')}
                  disabled={exporting}
                  className="text-[11px] font-bold text-blue-800 hover:text-blue-950 flex items-center gap-1 bg-white hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 shadow-2xs cursor-pointer transition"
                  title="Esporta questa vista in CSV (.zip)"
                >
                  <FileArchive className="w-3 h-3 text-blue-600" />
                  <span>CSV</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleUpdateCurrentView}
                disabled={savingView}
                className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 bg-white hover:bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-300 shadow-2xs cursor-pointer transition"
                title={t.architect.updateSavedView}
              >
                <RotateCcw className="w-3 h-3 text-emerald-600" />
                <span>{savingView ? 'Salvataggio...' : t.architect.updateSavedView}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenSaveViewModal}
                className="text-[11px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition"
                title={t.architect.saveAsNewView}
              >
                <Plus className="w-3 h-3 text-slate-500" />
                <span>{t.architect.saveAsNewView}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSavedView(null);
                  if (onClearInitialView) onClearInitialView();
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-emerald-100/50 cursor-pointer transition"
                title="Scollega vista"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search, Metamodel Type & Sort Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          {/* Main Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={t.architect.filterPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Type Selector */}
          <div className="md:col-span-4">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
            >
              <option value="All">{t.architect.allTypes} ({elements.length})</option>
              {metamodelLayers.map((layer) => (
                <optgroup key={layer.layer} label={`-- ${layer.layer} Layer --`}>
                  {layer.element_types.map((et) => {
                    const count = elements.filter((el) => el.type === et.type).length;
                    return (
                      <option key={et.type} value={et.type}>
                        {et.name || et.type} ({count})
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
            >
              <option value="name_asc">{t.architect.sortNameAsc}</option>
              <option value="name_desc">{t.architect.sortNameDesc}</option>
              <option value="type_asc">{t.architect.sortTypeAsc}</option>
              <option value="layer_asc">{t.architect.sortLayerAsc}</option>
              <option value="cost_desc">{t.architect.sortCostDesc}</option>
              <option value="cost_asc">{t.architect.sortCostAsc}</option>
              <option value="fit_desc">{t.architect.sortFitDesc}</option>
            </select>
          </div>
        </div>

        {/* ACTIVE FILTER CHIPS */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-1 border-t border-slate-100">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
              {t.architect.activeFiltersLabel}
            </span>

            {selectedLayer !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-[10px] font-bold">
                Layer: {selectedLayer}
                <button onClick={() => setSelectedLayer('All')} className="hover:text-emerald-700 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedType !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-[10px] font-bold">
                Tipo: {selectedType}
                <button onClick={() => setSelectedType('All')} className="hover:text-blue-700 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {search.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-[10px] font-bold">
                "{search}"
                <button onClick={() => setSearch('')} className="hover:text-slate-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {relationshipFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-bold">
                {relationshipFilter === 'orphan' ? t.architect.connectivityOrphans : t.architect.connectivityConnected}
                <button onClick={() => setRelationshipFilter('all')} className="hover:text-purple-700 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {documentationFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold">
                {documentationFilter === 'with_doc' ? t.architect.docFilterWith : t.architect.docFilterWithout}
                <button onClick={() => setDocumentationFilter('all')} className="hover:text-amber-700 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {attributeFilterRules.map((rule) => {
              const attrDef = allAvailableAttributes.find((a) => a.name === rule.attributeName);
              const attrLabel = attrDef?.label || rule.attributeName;
              const opLabel = getOperatorsForDataType(attrDef?.data_type).find((o) => o.id === rule.operator)?.label || rule.operator;
              const valDisplay = rule.operator === 'between'
                ? `${rule.value || '0'} .. ${rule.secondValue || '∞'}`
                : rule.operator === 'is_true'
                ? t.architect.booleanTrue
                : rule.operator === 'is_false'
                ? t.architect.booleanFalse
                : rule.operator === 'not_empty' || rule.operator === 'empty'
                ? ''
                : String(rule.value || '');

              return (
                <span
                  key={rule.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-100 text-teal-900 border border-teal-200 rounded-lg text-[10px] font-bold"
                >
                  {attrLabel} {opLabel} {valDisplay}
                  <button onClick={() => handleRemoveAttributeRule(rule.id)} className="hover:text-teal-700 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            <button
              onClick={handleResetAllFilters}
              className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline ml-auto flex items-center gap-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              {t.architect.resetAllFilters}
            </button>
          </div>
        )}

        {/* COLLAPSIBLE ADVANCED FILTER PANEL */}
        {isAdvancedFilterOpen && (
          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 space-y-4 shadow-sm animate-fadeIn text-xs">
            
            {/* 1. Multi-Attribute Filter Builder */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-extrabold text-slate-900 text-xs">{t.architect.attributeFilterBuilderTitle}</span>
                </div>

                {/* Match Logic: AND vs OR */}
                <div className="flex items-center space-x-2 text-[11px] font-bold">
                  <span className="text-slate-500">{t.architect.matchLogicLabel}</span>
                  <div className="inline-flex bg-white rounded-lg p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMatchLogic('AND')}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        matchLogic === 'AND'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchLogic('OR')}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        matchLogic === 'OR'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      OR
                    </button>
                  </div>
                </div>
              </div>

              {/* Attribute Rules List */}
              <div className="space-y-2">
                {attributeFilterRules.map((rule) => {
                  const attrDef = allAvailableAttributes.find((a) => a.name === rule.attributeName);
                  const ops = getOperatorsForDataType(attrDef?.data_type);

                  return (
                    <div
                      key={rule.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center gap-2"
                    >
                      {/* Attribute Select */}
                      <div className="w-full sm:w-52">
                        <select
                          value={rule.attributeName}
                          onChange={(e) => handleUpdateAttributeRule(rule.id, { attributeName: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          {allAvailableAttributes.map((attr) => (
                            <option key={attr.name} value={attr.name}>
                              [{attr.section || 'General'}] {attr.label || attr.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Operator Select */}
                      <div className="w-full sm:w-40">
                        <select
                          value={rule.operator}
                          onChange={(e) => handleUpdateAttributeRule(rule.id, { operator: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
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
                            {rule.operator === 'is_true' ? t.architect.booleanTrue : t.architect.booleanFalse}
                          </span>
                        ) : rule.operator === 'between' ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              placeholder={t.architect.valBetweenMin}
                              value={rule.value}
                              onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                            <span className="text-slate-400 text-xs">-</span>
                            <input
                              type="number"
                              placeholder={t.architect.valBetweenMax}
                              value={rule.secondValue || ''}
                              onChange={(e) => handleUpdateAttributeRule(rule.id, { secondValue: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        ) : attrDef?.data_type === 'select' && attrDef.options && attrDef.options.length > 0 ? (
                          <select
                            value={rule.value}
                            onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                          >
                            <option value="">-- {t.architect.selectOptionPrompt} --</option>
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
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        ) : attrDef?.data_type === 'number' ? (
                          <input
                            type="number"
                            step="any"
                            placeholder="0"
                            value={rule.value}
                            onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder="Valore filtro..."
                            value={rule.value || ''}
                            onChange={(e) => handleUpdateAttributeRule(rule.id, { value: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                          />
                        )}
                      </div>

                      {/* Remove Rule Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttributeRule(rule.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition self-end sm:self-center cursor-pointer"
                        title="Rimuovi regola"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                {attributeFilterRules.length === 0 && (
                  <div className="p-3 text-center text-slate-400 text-xs italic bg-white/60 rounded-xl border border-dashed border-slate-200">
                    {t.architect.noFilterRulesAdded}
                  </div>
                )}
              </div>

              {/* Add Rule Button */}
              <button
                type="button"
                onClick={handleAddAttributeRule}
                className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.architect.addAttributeRuleBtn}</span>
              </button>
            </div>

            {/* 2. Extra Architectural Filters */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Connectivity Filter */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 text-[11px] block">{t.architect.connectivityFilterTitle}</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setRelationshipFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      relationshipFilter === 'all'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.architect.connectivityAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRelationshipFilter('orphan')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      relationshipFilter === 'orphan'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.architect.connectivityOrphans}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRelationshipFilter('connected')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      relationshipFilter === 'connected'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.architect.connectivityConnected}
                  </button>
                </div>
              </div>

              {/* Documentation Filter */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 text-[11px] block">{t.architect.docFilterTitle}</span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setDocumentationFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      documentationFilter === 'all'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.architect.docFilterAll}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentationFilter('with_doc')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      documentationFilter === 'with_doc'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.architect.docFilterWith}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentationFilter('no_doc')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      documentationFilter === 'no_doc'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t.architect.docFilterWithout}
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Deep search in properties checkbox */}
            <div className="pt-2 border-t border-slate-200/80">
              <label className="flex items-center space-x-2 cursor-pointer text-slate-700 font-semibold text-[11px]">
                <input
                  type="checkbox"
                  checked={searchInProps}
                  onChange={(e) => setSearchInProps(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span>{t.architect.searchInPropsLabel}</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 2-Column Split: Element List (Left) + Element Detail & Sections (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Element List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          
          {/* Results Count Summary */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
            <span className="flex items-center gap-2">
              <Box className="w-4 h-4 text-emerald-600" />
              <span>{filteredElements.length} {t.common.elements}</span>
            </span>
            {activeFiltersCount > 0 && (
              <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {interpolate(t.architect.filterRuleCount, { count: activeFiltersCount })}
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredElements.length > 0 ? (
              filteredElements.map((el) => {
                const isSelected = selectedElement?.id === el.id;
                return (
                  <div
                    key={el.id}
                    onClick={() => handleSelectElement(el.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500/40 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Box className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{el.name}</h4>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{el.type}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getLayerColor(el.layer)}`}>
                      {el.layer}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                {t.architect.noElementsFound}
              </div>
            )}
          </div>
        </div>

        {/* Right: Selected Element Inspector & Sections */}
        <div className="lg:col-span-7">
          {selectedElement ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              
              {/* Header Card with Edit & Delete Actions */}
              <div className="border-b border-slate-100 pb-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getLayerColor(selectedElement.layer)}`}>
                      {selectedElement.layer} Layer • {selectedElement.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">ID: {selectedElement.id}</span>
                  </div>

                  <div className="flex items-center space-x-2 self-start sm:self-auto">
                    <button
                      onClick={handleOpenEditModal}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                      title={t.architect.editObjectBtn}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{t.architect.editObjectBtn}</span>
                    </button>
                    <button
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl transition cursor-pointer"
                      title={t.architect.deleteObjectBtn}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">{selectedElement.name}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {selectedElement.documentation || t.architect.noDocAssociated}
                  </p>
                </div>
              </div>

              {/* Attributes Organized by Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>{t.architect.definedSectionsTitle}</span>
                  </h4>
                </div>

                {Object.keys(selectedGroupedAttrs).length > 0 ? (
                  Object.keys(selectedGroupedAttrs).map((secName) => {
                    const attrs = selectedGroupedAttrs[secName];
                    const hasEeaAttrs = attrs.some((a) => a.is_system || a.name.startsWith('eea_'));
                    return (
                      <div key={secName} className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
                        {/* Section Title */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                          <div className="flex items-center space-x-2">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                              hasEeaAttrs ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              <Folder className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-bold text-slate-900">{secName}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                            {interpolate(t.architect.attributesCount, { count: attrs.length })}
                          </span>
                        </div>

                        {/* Attribute Values Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          {attrs.map((attr) => {
                            const val = selectedElement.properties ? selectedElement.properties[attr.name] : undefined;
                            const isSet = val !== undefined && val !== null && val !== '';
                            const displayVal = isSet
                              ? typeof val === 'boolean'
                                ? val ? t.architect.booleanTrue : t.architect.booleanFalse
                                : typeof val === 'number'
                                ? val.toLocaleString()
                                : String(val)
                              : '—';

                            return (
                              <div
                                key={attr.id}
                                className="bg-white border border-slate-200/80 rounded-xl p-3 text-xs space-y-1 shadow-2xs flex flex-col justify-between"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-semibold text-slate-700 text-[11px]">{attr.label}</span>
                                  <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                    {attr.data_type}
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-slate-900 break-words">
                                  {isSet ? (
                                    <span className={typeof val === 'boolean' ? (val ? 'text-emerald-700 font-semibold' : 'text-slate-500') : 'text-slate-900'}>
                                      {displayVal}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-normal italic">—</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                    {t.architect.emptyCustomProperties}
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* RELATIONSHIPS SECTION WITH ADD / EDIT / DELETE ACTIONS  */}
              {/* ======================================================== */}
              <div className="pt-2 border-t border-slate-100 space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Link2 className="w-4 h-4 text-indigo-600" />
                    <span>Relazioni ArchiMate</span>
                  </h4>

                  <button
                    onClick={() => handleOpenAddRelationModal('outgoing')}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.architect.addRelationBtn}</span>
                  </button>
                </div>

                {/* Outgoing Relations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                      {interpolate(t.architect.outgoingRelations, { count: selectedElement.outgoing_relations?.length || 0 })}
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedElement.outgoing_relations?.length > 0 ? (
                      selectedElement.outgoing_relations.map((rel: any) => (
                        <div
                          key={rel.id}
                          className="p-3 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                {rel.type.replace('Relationship', '')}
                              </span>
                              <div className="flex items-center space-x-1.5">
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-bold text-slate-900">{rel.target_name || rel.target_id}</span>
                              </div>
                            </div>
                            {rel.name && (
                              <p className="text-[11px] text-slate-500 italic pl-1">{rel.name}</p>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 self-end sm:self-auto">
                            <button
                              onClick={() => handleOpenEditRelationModal(rel)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title={t.architect.editRelationBtn}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteRelationModal(rel)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title={t.architect.deleteRelationBtn}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                        {t.architect.noOutgoingRelations}
                      </div>
                    )}
                  </div>
                </div>

                {/* Incoming Relations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                      {interpolate(t.architect.incomingRelations, { count: selectedElement.incoming_relations?.length || 0 })}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedElement.incoming_relations?.length > 0 ? (
                      selectedElement.incoming_relations.map((rel: any) => (
                        <div
                          key={rel.id}
                          className="p-3 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{rel.source_name || rel.source_id}</span>
                              <div className="flex items-center space-x-1.5">
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-mono text-[10px] text-indigo-800 bg-indigo-100/70 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
                                  {rel.type.replace('Relationship', '')}
                                </span>
                              </div>
                            </div>
                            {rel.name && (
                              <p className="text-[11px] text-slate-500 italic pl-1">{rel.name}</p>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 self-end sm:self-auto">
                            <button
                              onClick={() => handleOpenEditRelationModal(rel)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title={t.architect.editRelationBtn}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteRelationModal(rel)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title={t.architect.deleteRelationBtn}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 italic">
                        {t.architect.noIncomingRelations}
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-400 text-xs">
              {t.architect.selectElementHint}
            </div>
          )}
        </div>

      </div>

      {/* ======================================================== */}
      {/* MODAL: CREATE NEW ARCHIMATE ELEMENT                     */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Box className="w-5 h-5 text-emerald-600" />
                  <span>{t.architect.modalCreateTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.architect.modalCreateSubtitle}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleSaveCreate} className="overflow-y-auto flex-1 pr-1 space-y-6 pt-4">
              
              {/* Section 1: Core Attributes */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200/80 text-xs font-bold text-slate-800">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>{t.architect.sectionGeneralCore}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Element Type Selector */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.architect.labelElementType} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleTypeChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                    >
                      {metamodelLayers.map((layer) => (
                        <optgroup key={layer.layer} label={`Layer ${layer.layer}`}>
                          {layer.element_types.map((et) => (
                            <option key={et.type} value={et.type}>
                              {et.name} ({et.type})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {/* Layer Badge (Derived) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Layer</label>
                    <div className="pt-1">
                      <span className={`inline-block text-xs font-bold px-3 py-1.5 rounded-xl border ${getLayerColor(formData.layer)}`}>
                        {formData.layer} Layer
                      </span>
                    </div>
                  </div>

                  {/* Element Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.architect.labelElementName} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t.architect.placeholderElementName}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* Documentation */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.architect.labelElementDoc}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={t.architect.placeholderElementDoc}
                      value={formData.documentation}
                      onChange={(e) => setFormData({ ...formData, documentation: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Attribute Sections Defined by Admin */}
              {(() => {
                const currentTypeInfo = getMetamodelTypeInfo(formData.type);
                const grouped = getGroupedAttributes(currentTypeInfo);
                const sectionNames = Object.keys(grouped);

                if (sectionNames.length === 0) return null;

                return (
                  <div className="space-y-4">
                    {sectionNames.map((secName) => {
                      const attrs = grouped[secName];
                      const hasEea = attrs.some((a) => a.is_system || a.name.startsWith('eea_'));
                      return (
                        <div key={secName} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
                          {/* Section Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                            <div className="flex items-center space-x-2">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                                hasEea ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                <Folder className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-bold text-slate-900">{secName}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                              {interpolate(t.architect.attributesCount, { count: attrs.length })}
                            </span>
                          </div>

                          {/* Fields Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {attrs.map((attr) => (
                              <div key={attr.id} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                    <span>{attr.label}</span>
                                    {attr.is_required && <span className="text-rose-500">*</span>}
                                  </label>
                                  <span className="text-[9px] font-mono text-slate-400">
                                    {attr.data_type}
                                  </span>
                                </div>
                                {attr.description && (
                                  <p className="text-[10px] text-slate-500 leading-tight pb-0.5">{attr.description}</p>
                                )}
                                {renderFieldInput(
                                  attr,
                                  formData.properties[attr.name],
                                  (val) => handlePropertyChange(attr.name, val)
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {saving ? (
                    <span>{t.architect.savingElement}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.architect.createElementBtn}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ARCHIMATE ELEMENT & ATTRIBUTES               */}
      {/* ======================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  <span>{t.architect.modalEditTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.architect.modalEditSubtitle}
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleSaveEdit} className="overflow-y-auto flex-1 pr-1 space-y-6 pt-4">
              
              {/* Section 1: Core Attributes */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200/80 text-xs font-bold text-slate-800">
                  <Tag className="w-4 h-4 text-indigo-600" />
                  <span>{t.architect.sectionGeneralCore}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Element Type Badge */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">{t.architect.labelElementType}</label>
                    <div className="pt-1">
                      <span className={`inline-block text-xs font-bold px-3 py-1.5 rounded-xl border ${getLayerColor(formData.layer)}`}>
                        {formData.layer} Layer • {formData.type}
                      </span>
                    </div>
                  </div>

                  {/* ID */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Element ID</label>
                    <div className="pt-1 text-xs font-mono text-slate-500">{formData.id}</div>
                  </div>

                  {/* Element Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.architect.labelElementName} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t.architect.placeholderElementName}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  {/* Documentation */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.architect.labelElementDoc}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={t.architect.placeholderElementDoc}
                      value={formData.documentation}
                      onChange={(e) => setFormData({ ...formData, documentation: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Attribute Sections Defined by Admin */}
              {(() => {
                const currentTypeInfo = getMetamodelTypeInfo(formData.type);
                const grouped = getGroupedAttributes(currentTypeInfo);
                const sectionNames = Object.keys(grouped);

                if (sectionNames.length === 0) return null;

                return (
                  <div className="space-y-4">
                    {sectionNames.map((secName) => {
                      const attrs = grouped[secName];
                      const hasEea = attrs.some((a) => a.is_system || a.name.startsWith('eea_'));
                      return (
                        <div key={secName} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 space-y-4 shadow-2xs">
                          {/* Section Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                            <div className="flex items-center space-x-2">
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                                hasEea ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                <Folder className="w-3 h-3" />
                              </div>
                              <span className="text-xs font-bold text-slate-900">{secName}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                              {interpolate(t.architect.attributesCount, { count: attrs.length })}
                            </span>
                          </div>

                          {/* Fields Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {attrs.map((attr) => (
                              <div key={attr.id} className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                    <span>{attr.label}</span>
                                    {attr.is_required && <span className="text-rose-500">*</span>}
                                  </label>
                                  <span className="text-[9px] font-mono text-slate-400">
                                    {attr.data_type}
                                  </span>
                                </div>
                                {attr.description && (
                                  <p className="text-[10px] text-slate-500 leading-tight pb-0.5">{attr.description}</p>
                                )}
                                {renderFieldInput(
                                  attr,
                                  formData.properties[attr.name],
                                  (val) => handlePropertyChange(attr.name, val)
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  {saving ? (
                    <span>{t.architect.savingElement}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.architect.saveElementBtn}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW ARCHIMATE RELATIONSHIP                   */}
      {/* ======================================================== */}
      {isAddRelationModalOpen && selectedElement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-emerald-600" />
                  <span>{t.architect.modalCreateRelationTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.architect.modalCreateRelationSubtitle}
                </p>
              </div>
              <button
                onClick={() => setIsAddRelationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form Body */}
            <form onSubmit={handleSaveCreateRelation} className="overflow-y-auto flex-1 pr-1 space-y-5 pt-4">
              
              {/* Direction Switcher */}
              <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleRelationEndpointChange(currentOtherId || otherElementsList[0]?.id, 'outgoing')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                    relationFormData.direction === 'outgoing'
                      ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Relazione in Uscita (Outgoing)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRelationEndpointChange(currentOtherId || otherElementsList[0]?.id, 'incoming')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                    relationFormData.direction === 'incoming'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ArrowRight className="w-3.5 h-3.5 transform rotate-180" />
                  <span>Relazione in Entrata (Incoming)</span>
                </button>
              </div>

              {/* Endpoints Summary Box */}
              <div className="p-3.5 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Source Box */}
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t.architect.labelSourceElement}
                    </span>
                    {relationFormData.direction === 'outgoing' ? (
                      <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                        <span>{selectedElement.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${getLayerColor(selectedElement.layer)}`}>
                          {selectedElement.type}
                        </span>
                      </div>
                    ) : (
                      <select
                        value={relationFormData.source_id}
                        onChange={(e) => handleRelationEndpointChange(e.target.value, 'incoming')}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {otherElementsList.map((el) => (
                          <option key={el.id} value={el.id}>
                            {el.name} ({el.type})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Target Box */}
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t.architect.labelTargetElement}
                    </span>
                    {relationFormData.direction === 'outgoing' ? (
                      <select
                        value={relationFormData.target_id}
                        onChange={(e) => handleRelationEndpointChange(e.target.value, 'outgoing')}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {otherElementsList.map((el) => (
                          <option key={el.id} value={el.id}>
                            {el.name} ({el.type})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="font-bold text-xs text-slate-900 flex items-center justify-between">
                        <span>{selectedElement.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${getLayerColor(selectedElement.layer)}`}>
                          {selectedElement.type}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ArchiMate Constraint Explanation Badge */}
                <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-start space-x-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>
                    {interpolate(t.architect.archimateRuleInfo, {
                      sourceType: relationFormData.direction === 'outgoing' ? selectedElement.type : (currentOtherElement?.type || ''),
                      targetType: relationFormData.direction === 'outgoing' ? (currentOtherElement?.type || '') : selectedElement.type
                    })}
                  </span>
                </div>
              </div>

              {/* Allowed ArchiMate Relationship Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{t.architect.labelRelationType} <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {allowedRelTypes.length} tipi ammessi dallo standard
                  </span>
                </label>

                {loadingAllowedRels ? (
                  <div className="p-4 text-center text-xs text-slate-400">Caricamento tipi di relazione consentiti...</div>
                ) : allowedRelTypes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {allowedRelTypes.map((relType) => {
                      const isSelected = relationFormData.type === relType.type;
                      return (
                        <div
                          key={relType.type}
                          onClick={() => setRelationFormData({ ...relationFormData, type: relType.type })}
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500 shadow-2xs font-bold text-emerald-900'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-400">{relType.symbol}</span>
                            <div>
                              <div className="font-bold">{relType.name}</div>
                              <div className="text-[9px] text-slate-400 font-mono">{relType.nature}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    {t.architect.noAllowedRelTypesFound}
                  </div>
                )}
              </div>

              {/* Relation Name / Description (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {t.architect.labelRelationName}
                </label>
                <input
                  type="text"
                  placeholder={t.architect.placeholderRelationName}
                  value={relationFormData.name}
                  onChange={(e) => setRelationFormData({ ...relationFormData, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              {/* Documentation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {t.architect.labelRelationDoc}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.architect.placeholderRelationDoc}
                  value={relationFormData.documentation}
                  onChange={(e) => setRelationFormData({ ...relationFormData, documentation: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs resize-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddRelationModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving || allowedRelTypes.length === 0}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {saving ? (
                    <span>{t.architect.savingRelation}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.architect.createRelationBtn}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDIT ARCHIMATE RELATIONSHIP                      */}
      {/* ======================================================== */}
      {isEditRelationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-indigo-600" />
                  <span>{t.architect.modalEditRelationTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.architect.modalEditRelationSubtitle}
                </p>
              </div>
              <button
                onClick={() => setIsEditRelationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2 flex-shrink-0">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Modal Form Body */}
            <form onSubmit={handleSaveEditRelation} className="overflow-y-auto flex-1 pr-1 space-y-5 pt-4">
              
              {/* Allowed Relationship Types */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>{t.architect.labelRelationType} <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {allowedRelTypes.length} tipi ammessi dallo standard
                  </span>
                </label>

                {loadingAllowedRels ? (
                  <div className="p-4 text-center text-xs text-slate-400">Caricamento tipi di relazione consentiti...</div>
                ) : allowedRelTypes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {allowedRelTypes.map((relType) => {
                      const isSelected = relationFormData.type === relType.type || relationFormData.type === relType.type.replace('Relationship', '');
                      return (
                        <div
                          key={relType.type}
                          onClick={() => setRelationFormData({ ...relationFormData, type: relType.type })}
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between text-xs ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 shadow-2xs font-bold text-indigo-900'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-400">{relType.symbol}</span>
                            <div>
                              <div className="font-bold">{relType.name}</div>
                              <div className="text-[9px] text-slate-400 font-mono">{relType.nature}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    {t.architect.noAllowedRelTypesFound}
                  </div>
                )}
              </div>

              {/* Relation Name / Description (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {t.architect.labelRelationName}
                </label>
                <input
                  type="text"
                  placeholder={t.architect.placeholderRelationName}
                  value={relationFormData.name}
                  onChange={(e) => setRelationFormData({ ...relationFormData, name: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Documentation */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">
                  {t.architect.labelRelationDoc}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.architect.placeholderRelationDoc}
                  value={relationFormData.documentation}
                  onChange={(e) => setRelationFormData({ ...relationFormData, documentation: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 shadow-2xs resize-none"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditRelationModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  {saving ? (
                    <span>{t.architect.savingRelation}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.architect.saveRelationBtn}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE RELATIONSHIP CONFIRMATION                 */}
      {/* ======================================================== */}
      {isDeleteRelationModalOpen && relationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.architect.deleteRelationConfirmTitle}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t.architect.deleteRelationConfirmDesc}
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>{relationToDelete.type?.replace('Relationship', '')}</span>
              <span className="text-slate-500 font-normal">
                {relationToDelete.target_name || relationToDelete.source_name || relationToDelete.id}
              </span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteRelationModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDeleteRelation}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                {saving ? t.architect.savingRelation : t.architect.deleteRelationBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DELETE ELEMENT CONFIRMATION                      */}
      {/* ======================================================== */}
      {isDeleteModalOpen && selectedElement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t.architect.deleteConfirmTitle}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t.architect.deleteConfirmDesc}
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900">
              {selectedElement.name} <span className="text-[10px] text-slate-500 font-mono">({selectedElement.type})</span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteElement}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                {saving ? t.architect.savingElement : t.architect.deleteObjectBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: SAVE REPOSITORY VIEW                             */}
      {/* ======================================================== */}
      {isSaveViewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700 border border-emerald-200">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{t.architect.saveViewModalTitle}</h3>
                  <p className="text-[11px] text-slate-500">Salva la configurazione di filtri attuale</p>
                </div>
              </div>
              <button
                onClick={() => setIsSaveViewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveViewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.architect.viewNameLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t.architect.viewNamePlaceholder}
                  value={saveViewName}
                  onChange={(e) => setSaveViewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.architect.viewDescLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.architect.viewDescPlaceholder}
                  value={saveViewDesc}
                  onChange={(e) => setSaveViewDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>{t.architect.viewAuthorLabel}</span>
                    <span className="text-[10px] font-medium text-slate-400">Utente loggato</span>
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-3.5 h-3.5 text-emerald-600 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={currentAuthor}
                      readOnly
                      disabled
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-700 cursor-not-allowed select-none focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.architect.viewTagsLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={t.architect.viewTagsPlaceholder}
                    value={saveViewTags}
                    onChange={(e) => setSaveViewTags(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Included Filters Summary Box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <span className="text-[11px] font-extrabold text-slate-700 block">
                  {t.architect.viewIncludedFiltersTitle} ({activeFiltersCount} filtri)
                </span>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {selectedLayer !== 'All' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">
                      Layer: {selectedLayer}
                    </span>
                  )}
                  {selectedType !== 'All' && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold">
                      Tipo: {selectedType}
                    </span>
                  )}
                  {search.trim() && (
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-bold">
                      "{search}"
                    </span>
                  )}
                  {relationshipFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold">
                      {relationshipFilter === 'orphan' ? 'Orfani' : 'Connessi'}
                    </span>
                  )}
                  {documentationFilter !== 'all' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">
                      {documentationFilter === 'with_doc' ? 'Con desc.' : 'Senza desc.'}
                    </span>
                  )}
                  {attributeFilterRules.map((r) => (
                    <span key={r.id} className="px-2 py-0.5 bg-teal-100 text-teal-900 rounded font-bold">
                      {r.attributeName} {r.operator} {String(r.value || '')}
                    </span>
                  ))}
                  {activeFiltersCount === 0 && (
                    <span className="text-slate-400 italic">Tutti gli elementi del modello (Nessun filtro)</span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveViewIsShared}
                    onChange={(e) => setSaveViewIsShared(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      {t.architect.viewSharedLabel}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {t.architect.viewSharedHelp}
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaveViewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingView || !saveViewName.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {savingView ? 'Salvataggio...' : t.architect.saveViewBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

