import React, { useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileCode } from 'lucide-react';
import { api } from '../lib/api';
import { suggestLibraryCode, sanitizeLibraryCode } from '../lib/codeGenerator';
import { useLanguage } from '../context/LanguageContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newModelId: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t, interpolate } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [isCodeManual, setIsCodeManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const trimmedCode = modelCode.trim().toUpperCase();
    if (trimmedCode && trimmedCode.length !== 4) {
      setError(t.admin.codeErrorFormat);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.uploadArchiModel(
        file,
        modelName.trim() || undefined,
        trimmedCode || undefined
      );
      onSuccess(res.model_id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-600">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{t.uploadModal.title}</h3>
            <p className="text-xs text-slate-500">{t.uploadModal.subtitle}</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.uploadModal.labelLibraryName}
            </label>
            <input
              type="text"
              placeholder={t.uploadModal.placeholderLibraryName}
              value={modelName}
              onChange={(e) => {
                const val = e.target.value;
                setModelName(val);
                if (!isCodeManual) {
                  setModelCode(suggestLibraryCode(val || (file ? file.name : '')));
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {t.uploadModal.labelLibraryCode}
              </label>
              <span className="text-[10px] text-slate-400 font-mono">{t.admin.charLimitHelp}</span>
            </div>
            <input
              type="text"
              maxLength={4}
              placeholder={t.uploadModal.placeholderLibraryCode}
              value={modelCode}
              onChange={(e) => {
                setIsCodeManual(true);
                setModelCode(sanitizeLibraryCode(e.target.value));
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono font-bold uppercase tracking-widest"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {t.uploadModal.helpLibraryCode}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t.uploadModal.labelFile}
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50 hover:bg-indigo-50/30">
              <input
                type="file"
                accept=".archimate,.xml"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setFile(f);
                    if (!modelName && !isCodeManual) {
                      const cleanName = f.name.replace(/\.[^/.]+$/, '');
                      setModelName(cleanName);
                      setModelCode(suggestLibraryCode(cleanName));
                    }
                  }
                }}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center space-x-2 text-indigo-600">
                    <FileCode className="w-6 h-6" />
                    <span className="text-sm font-semibold text-slate-900">{file.name}</span>
                    <span className="text-xs text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-600">
                      {interpolate(t.uploadModal.dragDropText, { browse: '' })}
                      <span className="text-indigo-600 font-semibold underline">{t.uploadModal.browseLink}</span>
                    </p>
                    <p className="text-[11px] text-slate-400">{t.uploadModal.supportedFormats}</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
            >
              {t.uploadModal.cancel}
            </button>
            <button
              type="submit"
              disabled={!file || loading}
              className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 transition"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t.uploadModal.importing}</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>{t.uploadModal.importBtn}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
