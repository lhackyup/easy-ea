import React from 'react';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Download,
  Terminal,
  Lock,
  Workflow,
  CheckCircle2,
  ExternalLink,
  Layers,
  Sparkles,
  Search,
  GitCommit
} from 'lucide-react';

interface CamundaPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CamundaPluginModal: React.FC<CamundaPluginModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const isIt = language === 'it';
  if (!isOpen) return null;

  const downloadUrl = api.downloadCamundaPluginUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-orange-950 via-orange-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center">
              <Workflow className="w-5 h-5 text-orange-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{isIt ? 'Plugin EasyEA per Camunda Modeler' : 'EasyEA Plugin for Camunda Modeler'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/30 text-orange-200 border border-orange-400/30">
                  BPMN 2.0
                </span>
              </h2>
              <p className="text-xs text-orange-200/80">
                {isIt ? 'Integrazione bidirezionale per Camunda Modeler 5.x Desktop & Mapping ArchiMate 3.x' : 'Bidirectional integration for Camunda Modeler 5.x Desktop & ArchiMate 3.x Mapping'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-xs">
          {/* Hero Download Card */}
          <div className="p-4 bg-gradient-to-br from-orange-50 via-white to-slate-50 rounded-2xl border border-orange-200 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isIt ? 'Pacchetto Plugin Camunda Modeler' : 'Camunda Modeler Plugin Package'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isIt ? 'Include il client script, il menu EasyEA e i moduli di Check-out/in e Diff semantico.' : 'Includes client script, EasyEA menu and Check-out/in & semantic Diff modules.'}
              </p>
            </div>
            <a
              href={downloadUrl}
              download="EasyEA-Camunda-Plugin.zip"
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition flex items-center space-x-2 shadow-sm shadow-orange-200 text-xs shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isIt ? 'Scarica Plugin (.zip)' : 'Download Plugin (.zip)'}</span>
            </a>
          </div>

          {/* Step by Step Guide */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              {isIt ? 'Guida Rapida all\'Installazione (2 Passaggi)' : 'Quick Installation Guide (2 Steps)'}
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">{isIt ? 'Prerequisito: Camunda Modeler' : 'Prerequisite: Camunda Modeler'}</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {isIt ? (
                      <>
                        Installa il client desktop gratuito <strong>Camunda Modeler (v5.x+)</strong> disponibile su{' '}
                        <a
                          href="https://camunda.com/download/modeler/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-orange-600 underline hover:text-orange-800 inline-flex items-center space-x-0.5"
                        >
                          <span>camunda.com/download/modeler</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>.
                      </>
                    ) : (
                      <>
                        Install the free desktop client <strong>Camunda Modeler (v5.x+)</strong> available at{' '}
                        <a
                          href="https://camunda.com/download/modeler/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-orange-600 underline hover:text-orange-800 inline-flex items-center space-x-0.5"
                        >
                          <span>camunda.com/download/modeler</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">{isIt ? 'Estrai il Plugin nella cartella di Camunda' : 'Extract Plugin to Camunda Folder'}</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {isIt ? 'Estrai la cartella camunda-easyea contenuta nel file .zip scaricato nella directory dei plugin:' : 'Extract the camunda-easyea folder from the downloaded .zip into your plugins directory:'}
                  </p>
                  <div className="mt-2 space-y-1.5 font-mono text-[11px] bg-slate-900 text-slate-200 p-2.5 rounded-lg">
                    <div><span className="text-orange-400 font-bold">Linux:</span> ~/.config/camunda-modeler/resources/plugins/</div>
                    <div><span className="text-orange-400 font-bold">macOS:</span> ~/Library/Application Support/camunda-modeler/resources/plugins/</div>
                    <div><span className="text-orange-400 font-bold">Windows:</span> %APPDATA%\camunda-modeler\resources\plugins\</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Workflow Highlights */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              {isIt ? 'Funzionalità Integrate in Camunda Modeler' : 'Features Integrated in Camunda Modeler'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2 font-bold text-slate-800 mb-1">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>{isIt ? 'Check-out & Blocco' : 'Check-out & Lock'}</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  {isIt ? 'Blocco esclusivo collaborativo sul server durante la modifica del diagramma BPMN.' : 'Collaborative exclusive server lock while editing BPMN diagram.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2 font-bold text-slate-800 mb-1">
                  <Search className="w-4 h-4 text-indigo-600" />
                  <span>{isIt ? 'Catalogo EA' : 'EA Catalog'}</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  {isIt ? 'Ricerca e riutilizzo di Ruoli, Applicazioni e Oggetti Dati con iniezione metadati.' : 'Search and reuse Roles, Applications, and Data Objects with metadata injection.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2 font-bold text-slate-800 mb-1">
                  <GitCommit className="w-4 h-4 text-orange-600" />
                  <span>{isIt ? 'Diff Semantico' : 'Semantic Diff'}</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  {isIt ? 'Calcolo differenze tra BPMN e database EasyEA con commit descrittivo.' : 'Differences computation between BPMN and EasyEA database with descriptive commit.'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-2 font-bold text-slate-800 mb-1">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>{isIt ? 'Auto-Mapping ArchiMate' : 'ArchiMate Auto-Mapping'}</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  {isIt ? 'Conversione trasparente dei task BPMN in Business Processes ed Application Services.' : 'Transparent conversion of BPMN tasks into Business Processes and Application Services.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-1 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{isIt ? 'Compatibile con Camunda Modeler 5.x Desktop' : 'Compatible with Camunda Modeler 5.x Desktop'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition"
          >
            {isIt ? 'Chiudi' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
