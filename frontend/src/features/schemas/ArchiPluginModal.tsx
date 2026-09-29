import React from 'react';
import { api } from '../../lib/api';
import {
  X,
  Download,
  Terminal,
  Key,
  Lock,
  UploadCloud,
  Unlock,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';

interface ArchiPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchiPluginModal: React.FC<ArchiPluginModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const downloadUrl = api.downloadArchiPluginUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Plugin EasyEA per Archi</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  v1.0.0
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                Integrazione bidirezionale nativa per Architool 5.x tramite jArchi
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
          <div className="p-4 bg-gradient-to-br from-indigo-50 via-white to-slate-50 rounded-2xl border border-indigo-100 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pacchetto Script jArchi</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Include tutti gli script per il ciclo di Check-out, Diff e Check-in da Archi.
              </p>
            </div>
            <a
              href={downloadUrl}
              download="EasyEA-Archi-Plugin.zip"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition flex items-center space-x-2 shadow-sm shadow-indigo-200 text-xs shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Scarica Plugin (.zip)</span>
            </a>
          </div>

          {/* Step by Step Guide */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Guida Rapida all'Installazione (2 Passaggi)
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Prerequisito: jArchi</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    Assicurati che il plugin <strong>jArchi (Archi Scripting Plugin)</strong> sia installato nel tuo Architool. Se non lo hai, è disponibile per i supporter di Archi su{' '}
                    <a
                      href="https://www.archimatetool.com/plugins/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 underline hover:text-indigo-800 inline-flex items-center space-x-0.5"
                    >
                      <span>archimatetool.com/plugins</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">Copia nella Cartella Script di Archi</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    In Archi, apri la vista Script da <strong>Window &rarr; Show View &rarr; Scripts</strong>. Clicca sull'icona della cartella <em>Open Scripts Folder</em> ed estrai la cartella <code>EasyEA/</code> contenuta nello zip scaricato. Infine, clicca sul pulsante <strong>Refresh Scripts</strong> in Archi.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Scripts Reference */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Funzionalità e Script Disponibili in Archi
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white transition space-y-1">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold">
                  <Key className="w-4 h-4" />
                  <span>1. EasyEA_Settings.ajs</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Configura l'URL del server EasyEA (es. <code>http://localhost:8000</code>) e salva il token di autenticazione in modo sicuro.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white transition space-y-1">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold">
                  <Lock className="w-4 h-4" />
                  <span>2. EasyEA_Checkout.ajs</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Mostra l'elenco degli schemi EasyEA, blocca lo schema selezionato per la tua modifica e lo apre istantaneamente nell'editor di Archi.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white transition space-y-1">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold">
                  <UploadCloud className="w-4 h-4" />
                  <span>3. EasyEA_Checkin.ajs</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Esegue il diff in tempo reale tra lo schema Archi e il catalogo EasyEA, mostra il riepilogo con gli elementi nuovi/modificati, richiede il messaggio di versione e fa il commit.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 hover:border-indigo-200 bg-white transition space-y-1">
                <div className="flex items-center space-x-2 text-indigo-600 font-bold">
                  <Unlock className="w-4 h-4" />
                  <span>4. EasyEA_DiscardCheckout.ajs</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Rilascia il blocco su EasyEA se decidi di annullare le modifiche senza salvare.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition text-xs"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
