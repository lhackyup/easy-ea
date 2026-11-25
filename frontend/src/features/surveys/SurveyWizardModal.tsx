import React, { useState, useEffect } from 'react';
import { SurveyScopeDetail } from '../../types';
import { api } from '../../lib/api';
import { UserAutocomplete } from '../../components/common/UserAutocomplete';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  DollarSign,
  Layers,
  Cloud,
  FileText,
  Clock,
  Activity
} from 'lucide-react';

interface SurveyWizardModalProps {
  scopeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const SurveyWizardModal: React.FC<SurveyWizardModalProps> = ({
  scopeId,
  onClose,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scopeDetail, setScopeDetail] = useState<SurveyScopeDetail | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    loadScopeData();
  }, [scopeId]);

  const loadScopeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSurveyScope(scopeId);
      setScopeDetail(data);
      const initial = data.response?.answers || data.response?.initial_values || {};
      setFormAnswers({ ...initial });
      setNotes(data.response?.notes || '');
    } catch (err: any) {
      setError(err.message || 'Errore nel caricamento del questionario');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormAnswers((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await api.submitSurveyScope(scopeId, formAnswers, notes);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'invio della survey');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!scopeDetail) return null;

  const isProcess = scopeDetail.element_category === 'process' || scopeDetail.element_type === 'BusinessProcess';
  const initialVals = scopeDetail.response?.initial_values || {};

  // Compute live diff
  const modifiedFields: Array<{ field: string; label: string; oldVal: any; newVal: any }> = [];
  Object.keys(formAnswers).forEach((key) => {
    const oldV = initialVals[key];
    const newV = formAnswers[key];
    if (String(oldV ?? '') !== String(newV ?? '')) {
      modifiedFields.push({
        field: key,
        label: key,
        oldVal: oldV,
        newVal: newV
      });
    }
  });

  const steps = isProcess
    ? [
        { step: 1, label: t.surveys.stepProcessGeneral, icon: FileText },
        { step: 2, label: t.surveys.stepProcessPerformance, icon: Clock },
        { step: 3, label: t.surveys.stepProcessAutomation, icon: Layers },
        { step: 4, label: t.surveys.stepProcessGovernance, icon: ShieldCheck },
        { step: 5, label: t.surveys.stepSummary, icon: CheckCircle2 }
      ]
    : [
        { step: 1, label: t.surveys.stepGeneral, icon: FileText },
        { step: 2, label: t.surveys.stepFit, icon: Layers },
        { step: 3, label: t.surveys.stepHosting, icon: Cloud },
        { step: 4, label: t.surveys.stepCosts, icon: DollarSign },
        { step: 5, label: t.surveys.stepSummary, icon: CheckCircle2 }
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isProcess ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-700'}`}>
                {scopeDetail.campaign_title}
              </span>
              <span className="text-xs text-slate-500">
                {scopeDetail.campaign_mode === 'direct_apply'
                  ? t.surveys.modeDirect
                  : t.surveys.modeApproval}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isProcess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                {isProcess ? '⚙️ Process' : '📦 App'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {isProcess ? t.surveys.wizardProcessTitle : t.surveys.wizardTitle}:{' '}
              <span className={isProcess ? 'text-teal-600' : 'text-blue-600'}>{scopeDetail.application_name}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Navigation */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-1 overflow-x-auto text-xs font-medium">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCurrent = activeStep === s.step;
            const isDone = activeStep > s.step;
            return (
              <button
                key={s.step}
                onClick={() => setActiveStep(s.step)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  isCurrent
                    ? `${isProcess ? 'bg-teal-600' : 'bg-blue-600'} text-white font-semibold shadow-sm`
                    : isDone
                    ? `${isProcess ? 'bg-teal-50 text-teal-700 hover:bg-teal-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Contents */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* PROCESS QUESTIONNAIRE */}
          {isProcess ? (
            <>
              {/* STEP 1: Process General Info */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processName}
                    </label>
                    <input
                      type="text"
                      value={formAnswers.name || ''}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processDescription}
                    </label>
                    <textarea
                      rows={4}
                      value={formAnswers.documentation || ''}
                      onChange={(e) => handleChange('documentation', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processCriticality}
                    </label>
                    <select
                      value={formAnswers.process_criticality || 'Operational'}
                      onChange={(e) => handleChange('process_criticality', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="Mission Critical">Mission Critical (Zero Downtime / Core Banking)</option>
                      <option value="Business Critical">Business Critical (DORA High Impact)</option>
                      <option value="Operational">Operational (Standard Business Activity)</option>
                      <option value="Non-Critical">Non-Critical (Internal Support)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 2: Process Performance */}
              {activeStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processCycleTime}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formAnswers.bpmn_cycle_time_minutes ?? 0}
                      onChange={(e) => handleChange('bpmn_cycle_time_minutes', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processVolume}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={formAnswers.bpmn_execution_volume_month ?? 0}
                      onChange={(e) => handleChange('bpmn_execution_volume_month', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processReworkRate}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formAnswers.bpmn_error_rework_rate_pct ?? 0}
                      onChange={(e) => handleChange('bpmn_error_rework_rate_pct', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Process Automation & SLA */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processAutomationLevel}
                    </label>
                    <select
                      value={formAnswers.bpmn_automation_level || 'Semi-Automated'}
                      onChange={(e) => handleChange('bpmn_automation_level', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="Full Automated">Full Automated (End-to-End STP - Straight Through Processing)</option>
                      <option value="Semi-Automated">Semi-Automated (BPMN / Workflow Orchestration con Intervento Umano)</option>
                      <option value="AI-Assisted">AI-Assisted (Elaborazione Assistita da Modelli LLM / ML)</option>
                      <option value="Manual">Manual (Processo Interamente Manuale / Cartaceo)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processSlaTarget}
                    </label>
                    <input
                      type="text"
                      value={formAnswers.sla_target || ''}
                      onChange={(e) => handleChange('sla_target', e.target.value)}
                      placeholder="Es. RTO: 2 ore, SLA completamento: 24 ore"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Process Governance & DORA */}
              {activeStep === 4 && (
                <div className="space-y-4 min-h-[300px] pb-36">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processCompliance}
                    </label>
                    <select
                      value={formAnswers.regulatory_compliance || 'Standard Operational'}
                      onChange={(e) => handleChange('regulatory_compliance', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    >
                      <option value="DORA Core ICT Service">DORA Core ICT Service (Funzione Critica / Importante)</option>
                      <option value="GDPR High Risk">GDPR High Risk (Trattamento Dati Sensibili / DPIA)</option>
                      <option value="Anti-Money Laundering (AML)">Anti-Money Laundering (AML / Antiriciclaggio)</option>
                      <option value="Standard Operational">Standard Operational (Normativa Ordinaria)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.processOwnerField}
                    </label>
                    <UserAutocomplete
                      mode="string"
                      placement="auto"
                      value={formAnswers.process_owner || ''}
                      onChange={(u, str) => handleChange('process_owner', u ? (u.full_name ? `${u.full_name} (${u.email})` : u.email) : (str || ''))}
                      placeholder={t.surveys.processOwnerField}
                      minChars={3}
                      allowCustomValue={true}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* APPLICATION QUESTIONNAIRE */
            <>
              {/* STEP 1: General Info */}
              {activeStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Nome Applicazione
                    </label>
                    <input
                      type="text"
                      value={formAnswers.name || ''}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Descrizione Funzionale & Note Architetturali
                    </label>
                    <textarea
                      rows={4}
                      value={formAnswers.documentation || ''}
                      onChange={(e) => handleChange('documentation', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Fornitore / Vendor Software
                    </label>
                    <input
                      type="text"
                      value={formAnswers.vendor || ''}
                      onChange={(e) => handleChange('vendor', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Fit & TIME */}
              {activeStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-semibold text-slate-700">
                        {t.surveys.businessFitScore} (1 = Scarso, 5 = Eccellente)
                      </label>
                      <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {formAnswers.business_fit || 3} / 5
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={formAnswers.business_fit || 3}
                      onChange={(e) => handleChange('business_fit', parseInt(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-semibold text-slate-700">
                        {t.surveys.technicalFitScore} (1 = Obsoleto/Fragile, 5 = Moderno/Resiliente)
                      </label>
                      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {formAnswers.technical_fit || 3} / 5
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={formAnswers.technical_fit || 3}
                      onChange={(e) => handleChange('technical_fit', parseInt(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.timeQuadrant}
                    </label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { key: 'Invest', label: 'Invest (Forte Fit)', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                        { key: 'Tolerate', label: 'Tolerate (Buon Fit Tecnico)', color: 'border-blue-500 bg-blue-50 text-blue-800' },
                        { key: 'Migrate', label: 'Migrate (Da Modernizzare)', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                        { key: 'Eliminate', label: 'Eliminate (Dismissione/Sunset)', color: 'border-rose-500 bg-rose-50 text-rose-800' }
                      ].map((q) => (
                        <button
                          type="button"
                          key={q.key}
                          onClick={() => handleChange('time_quadrant', q.key)}
                          className={`p-3 text-left rounded-xl border-2 transition-all font-medium text-sm ${
                            formAnswers.time_quadrant === q.key ? q.color + ' shadow-sm' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Lifecycle & Hosting */}
              {activeStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        {t.surveys.hostingType}
                      </label>
                      <select
                        value={formAnswers.hosting_type || 'Cloud'}
                        onChange={(e) => handleChange('hosting_type', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="SaaS">SaaS (Software as a Service)</option>
                        <option value="Public Cloud">Public Cloud (AWS / Azure / GCP)</option>
                        <option value="Private Cloud">Private Cloud</option>
                        <option value="On-Premise">On-Premise (Data Center Locale)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Stato Ciclo di Vita
                      </label>
                      <select
                        value={formAnswers.lifecycle_status || 'Live'}
                        onChange={(e) => handleChange('lifecycle_status', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Plan">Plan (Pianificazione)</option>
                        <option value="Phase In">Phase In (In Rollout)</option>
                        <option value="Live">Live (In Produzione)</option>
                        <option value="Phase Out">Phase Out (In Dismissione)</option>
                        <option value="Retired">Retired (Dismessa)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        {t.surveys.slaLevel}
                      </label>
                      <select
                        value={formAnswers.sla_level || 'Silver (99.0%)'}
                        onChange={(e) => handleChange('sla_level', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Platinum (99.99%)">Platinum (99.99%)</option>
                        <option value="Gold (99.9%)">Gold (99.9%)</option>
                        <option value="Silver (99.0%)">Silver (99.0%)</option>
                        <option value="Bronze (95.0%)">Bronze (95.0%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        {t.surveys.businessCriticality}
                      </label>
                      <select
                        value={formAnswers.business_criticality || 'Business Operational'}
                        onChange={(e) => handleChange('business_criticality', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="Mission Critical">Mission Critical (Zero Downtime)</option>
                        <option value="Business Critical">Business Critical (DORA Core)</option>
                        <option value="Business Operational">Business Operational</option>
                        <option value="Administrative">Administrative / Support</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      {t.surveys.dataClassification}
                    </label>
                    <select
                      value={formAnswers.data_classification || 'Internal'}
                      onChange={(e) => handleChange('data_classification', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="Public">Pubblico</option>
                      <option value="Internal">Uso Interno</option>
                      <option value="Confidential">Confidenziale</option>
                      <option value="Restricted/GDPR">Riservato / Dati Sensibili GDPR</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 4: Costs & Budget */}
              {activeStep === 4 && (
                <div className="space-y-4">
                  {formAnswers.annual_cost === null ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        {t.surveys.financialsRedactedBadge}
                      </span>
                      <p className="text-sm text-slate-600 mt-2">
                        {t.surveys.financialsRedactedTooltip}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            {t.surveys.annualCost}
                          </label>
                          <input
                            type="number"
                            step="500"
                            value={formAnswers.annual_cost || 0}
                            onChange={(e) => handleChange('annual_cost', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            {t.surveys.activeUsers}
                          </label>
                          <input
                            type="number"
                            value={formAnswers.active_users || 0}
                            onChange={(e) => handleChange('active_users', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            {t.surveys.softwareLicenses}
                          </label>
                          <input
                            type="number"
                            step="500"
                            value={formAnswers.cost_software_licenses || 0}
                            onChange={(e) => handleChange('cost_software_licenses', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-1">
                            {t.surveys.cloudInfra}
                          </label>
                          <input
                            type="number"
                            step="500"
                            value={formAnswers.cost_cloud_infrastructure || 0}
                            onChange={(e) => handleChange('cost_cloud_infrastructure', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* STEP 5: Summary & Diff (Shared) */}
          {activeStep === 5 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">
                  {t.surveys.diffDetectedTitle} ({modifiedFields.length})
                </h4>
                {modifiedFields.length === 0 ? (
                  <p className="text-sm text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {t.surveys.diffNoChanges}
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {modifiedFields.map((m) => (
                      <div key={m.field} className="p-3 text-xs flex items-center justify-between bg-slate-50/50">
                        <span className="font-semibold text-slate-700 w-1/3">{m.label}</span>
                        <span className="text-slate-400 line-through w-1/3 text-right pr-4">
                          {String(m.oldVal ?? 'n/d')}
                        </span>
                        <span className={`font-bold ${isProcess ? 'text-teal-600' : 'text-blue-600'} w-1/3 text-right`}>
                          {String(m.newVal ?? 'n/d')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {t.surveys.notesToArchitect}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.surveys.notesPlaceholder}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 ${isProcess ? 'focus:ring-teal-500' : 'focus:ring-blue-500'} focus:outline-none`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            disabled={activeStep === 1}
            onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
            {t.surveys.btnBack}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              {t.common.cancel}
            </button>

            {activeStep < 5 ? (
              <button
                type="button"
                onClick={() => setActiveStep((prev) => Math.min(5, prev + 1))}
                className={`flex items-center gap-1.5 px-5 py-2 ${isProcess ? 'bg-teal-600 hover:bg-teal-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-xl text-sm font-semibold shadow-sm transition`}
              >
                {t.surveys.btnNext}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? t.common.loading : t.surveys.submitSurveyBtn}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
