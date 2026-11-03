import React from 'react';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Download,
  ExternalLink,
  Palette,
  CheckCircle2,
  FileCode2,
  Lock,
  UploadCloud,
  Layers,
  Sparkles
} from 'lucide-react';

interface DrawioPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DrawioPaletteModal: React.FC<DrawioPaletteModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const isIt = language === 'it';
  if (!isOpen) return null;

  const downloadUrl = api.downloadDrawioPaletteUrl();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
              <Palette className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{isIt ? 'Palette ArchiMate 3.x & Draw.io Desktop' : 'ArchiMate 3.x & Draw.io Desktop Palette'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  ArchiMate 3.2
                </span>
              </h2>
              <p className="text-xs text-amber-200/80">
                {isIt ? 'Libreria di forme e stencil nativi per il client desktop Draw.io' : 'Native shapes and stencil library for Draw.io desktop client'}
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
          <div className="p-4 bg-gradient-to-br from-amber-50 via-white to-slate-50 rounded-2xl border border-amber-200 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isIt ? 'Libreria Forme EasyEA (.xml)' : 'EasyEA Shape Library (.xml)'}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isIt ? 'Include tutti i componenti dei layer Business, Application, Technology, Strategy, Motivation e Implementation.' : 'Includes all components across Business, Application, Technology, Strategy, Motivation, and Implementation layers.'}
              </p>
            </div>
            <a
              href={downloadUrl}
              download="EasyEA_ArchiMate3_Palette.xml"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex items-center space-x-2 shadow-sm shadow-amber-200 text-xs shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isIt ? 'Scarica Palette (.xml)' : 'Download Palette (.xml)'}</span>
            </a>
          </div>

          {/* Step by Step Guide */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              {isIt ? 'Guida Rapida all\'Uso con Draw.io Desktop' : 'Quick Guide for Draw.io Desktop'}
            </h4>
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">{isIt ? 'Installa Draw.io Desktop' : 'Install Draw.io Desktop'}</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {isIt ? (
                      <>
                        Installa il client desktop ufficiale gratuito per Windows, macOS o Linux disponibile su{' '}
                        <a
                          href="https://www.drawio.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-700 underline hover:text-amber-900 inline-flex items-center space-x-0.5 font-semibold"
                        >
                          <span>drawio.com</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>.
                      </>
                    ) : (
                      <>
                        Install the official free desktop client for Windows, macOS, or Linux available at{' '}
                        <a
                          href="https://www.drawio.com/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-700 underline hover:text-amber-900 inline-flex items-center space-x-0.5 font-semibold"
                        >
                          <span>drawio.com</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">{isIt ? 'Carica la Palette ArchiMate 3.x' : 'Load ArchiMate 3.x Palette'}</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {isIt ? (
                      <>
                        In Draw.io Desktop, vai nel menu <strong>File &rarr; Open Library from &rarr; Device</strong> (o <em>Apri libreria da &rarr; Dispositivo</em>) e seleziona il file <code>EasyEA_ArchiMate3_Palette.xml</code> appena scaricato. La palette comparirà nella barra laterale sinistra tra le librerie personalizzate.
                      </>
                    ) : (
                      <>
                        In Draw.io Desktop, go to <strong>File &rarr; Open Library from &rarr; Device</strong> and select the downloaded <code>EasyEA_ArchiMate3_Palette.xml</code> file. The palette will appear in the left sidebar among custom libraries.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start space-x-3">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <h5 className="font-bold text-slate-800">{isIt ? 'Ciclo di Check-out e Check-in' : 'Check-out & Check-in Cycle'}</h5>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {isIt ? 'Dallo Schema Repository di EasyEA:' : 'From the EasyEA Schema Repository:'}
                  </p>
                  <ul className="mt-2 space-y-1.5 list-disc list-inside text-slate-600 pl-1">
                    {isIt ? (
                      <>
                        <li><strong className="text-slate-700">Check-out:</strong> blocca lo schema e scarica il file <code>.drawio</code>.</li>
                        <li><strong className="text-slate-700">Modifica locale:</strong> apri il file con Draw.io Desktop, trascina i componenti ArchiMate dalla palette e salva.</li>
                        <li><strong className="text-slate-700">Check-in:</strong> carica il file modificato in EasyEA, rivedi le differenze (Diff Engine) e conferma il salvataggio con versioning automatico!</li>
                      </>
                    ) : (
                      <>
                        <li><strong className="text-slate-700">Check-out:</strong> lock schema and download the <code>.drawio</code> file.</li>
                        <li><strong className="text-slate-700">Local editing:</strong> open file in Draw.io Desktop, drag ArchiMate components from the palette, and save.</li>
                        <li><strong className="text-slate-700">Check-in:</strong> upload the modified file to EasyEA, review differences with Diff Engine, and confirm save with automatic versioning!</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Palette Features Summary */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>{isIt ? 'Vantaggi della Palette EasyEA per Draw.io' : 'Benefits of EasyEA Palette for Draw.io'}</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isIt ? 'Colori standard ArchiMate 3.x' : 'Standard ArchiMate 3.x colors'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isIt ? 'Icone angolari di layer e tipo' : 'Corner layer & type icons'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isIt ? 'Connettori e relazioni tipizzate' : 'Typed connectors & relations'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isIt ? 'Diff engine & sincronizzazione catalogo' : 'Diff engine & catalog sync'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition text-xs"
          >
            {isIt ? 'Chiudi' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
