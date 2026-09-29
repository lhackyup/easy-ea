import React, { useState } from 'react';
import { SchemaFolder, ArchiSchema } from '../../types';
import { api } from '../../lib/api';
import {
  Plus,
  Upload,
  Folder,
  Layers,
  X,
  RefreshCw,
  AlertTriangle,
  FileCode
} from 'lucide-react';

interface CreateSchemaModalProps {
  modelId: string;
  folders: SchemaFolder[];
  currentFolderId: string | null;
  onClose: () => void;
  onSuccess: (schema: ArchiSchema) => void;
}

const VIEWPOINTS = [
  'Total',
  'Application Cooperation',
  'Application Usage',
  'Business Process Cooperation',
  'Information Structure',
  'Infrastructure',
  'Infrastructure Usage',
  'Implementation and Deployment',
  'Layered',
  'Motivation',
  'Organization',
  'Service Realization',
  'Strategy'
];

export const CreateSchemaModal: React.FC<CreateSchemaModalProps> = ({
  modelId,
  folders,
  currentFolderId,
  onClose,
  onSuccess
}) => {
  const [tab, setTab] = useState<'empty' | 'import'>('empty');
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState<string>(currentFolderId || '__root__');
  const [viewpoint, setViewpoint] = useState('Total');
  const [documentation, setDocumentation] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let createdSchema: ArchiSchema;
      const targetFolder = folderId === '__root__' ? null : folderId;

      if (tab === 'empty') {
        if (!name.trim()) {
          throw new Error('Inserisci un nome per lo schema.');
        }
        createdSchema = await api.createSchema(modelId, {
          name: name.trim(),
          folder_id: targetFolder,
          viewpoint,
          documentation: documentation.trim(),
          view_data: { nodes: [], connections: [] }
        });
      } else {
        if (!file) {
          throw new Error('Seleziona un file .archimate o XML da importare.');
        }
        createdSchema = await api.importSchemaFile(
          modelId,
          file,
          targetFolder,
          name.trim() ? name.trim() : undefined
        );
      }

      onSuccess(createdSchema);
    } catch (err: any) {
      setError(err.message || 'Errore durante la creazione dello schema.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Nuovo Schema ArchiMate</h2>
              <p className="text-xs text-slate-500">Aggiungi o importa un disegno nel repository</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-4 flex space-x-2 border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setTab('empty')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
              tab === 'empty'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crea Schema Vuoto</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center space-x-1.5 ${
              tab === 'import'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importa File Archi (.archimate / XML)</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'import' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                File .archimate / Open Exchange XML *
              </label>
              <input
                type="file"
                accept=".archimate,.xml"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                    if (!name) {
                      setName(e.target.files[0].name.replace('.archimate', '').replace('.xml', ''));
                    }
                  }
                }}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl p-1.5"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nome Schema {tab === 'empty' && '*'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="es. Pagamenti Digitali & Gateway"
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Cartella di Destinazione
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="__root__">📁 Cartella Principale (Root)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Punto di Vista (Viewpoint)
              </label>
              <select
                value={viewpoint}
                onChange={(e) => setViewpoint(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                {VIEWPOINTS.map((vp) => (
                  <option key={vp} value={vp}>
                    {vp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Descrizione / Documentazione
            </label>
            <textarea
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              placeholder="Descrizione degli scopi o del contesto architetturale dello schema..."
              rows={3}
              className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition disabled:opacity-50 flex items-center space-x-1.5 shadow-sm shadow-indigo-200"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{tab === 'empty' ? 'Crea Schema' : 'Importa Schema'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
