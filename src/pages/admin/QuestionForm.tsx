import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Question, Item } from '../../types';
import QuestionPreview from './QuestionPreview';

const ITEM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const defaultItems = (): Item[] =>
  ['A', 'B', 'C', 'D', 'E'].map(label => ({ label, enonce: '', justification: '' }));

interface QuestionFormProps {
  initial?: Question;
  onSaved: (q: Question, addAnother: boolean) => void;
  onCancel: () => void;
}

export default function QuestionForm({ initial, onSaved, onCancel }: QuestionFormProps) {
  const [niveau, setNiveau] = useState<'P2' | 'D1'>(initial?.niveau ?? 'P2');
  const [matiere, setMatiere] = useState(initial?.matiere ?? '');
  const [cours, setCours] = useState(initial?.cours ?? '');
  const [annee, setAnnee] = useState(initial?.annee ? String(initial.annee) : '');
  const [type, setType] = useState<'QCM' | 'QRU'>(initial?.type ?? 'QCM');
  const [enonce, setEnonce] = useState(initial?.enonce ?? '');
  const [items, setItems] = useState<Item[]>(initial?.items ?? defaultItems());
  const [reponses, setReponses] = useState<string[]>(initial?.reponses ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const updateItem = (index: number, field: 'enonce' | 'justification', value: string) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    if (items.length >= ITEM_LABELS.length) return;
    const label = ITEM_LABELS[items.length];
    setItems(prev => [...prev, { label, enonce: '', justification: '' }]);
  };

  const removeItem = () => {
    if (items.length <= 2) return;
    const lastLabel = items[items.length - 1].label;
    setItems(prev => prev.slice(0, -1));
    setReponses(prev => prev.filter(r => r !== lastLabel));
  };

  const toggleReponse = (label: string) => {
    if (type === 'QRU') {
      setReponses(reponses.includes(label) ? [] : [label]);
    } else {
      setReponses(prev => prev.includes(label) ? prev.filter(r => r !== label) : [...prev, label]);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl;
    const ext = imageFile.name.split('.').pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('question-images').upload(path, imageFile);
    if (error) throw error;
    const { data } = supabase.storage.from('question-images').getPublicUrl(path);
    return data.publicUrl;
  };

  const buildQuestion = (uploadedImageUrl: string | null): Omit<Question, 'id' | 'created_at'> => ({
    niveau,
    matiere: matiere.trim(),
    cours: cours.trim() || null,
    annee: annee ? parseInt(annee) : null,
    type,
    enonce: enonce.trim(),
    image_url: uploadedImageUrl,
    items,
    reponses,
    statut: 'brouillon',
  });

  const validate = () => {
    if (!matiere.trim()) return 'La matière est requise.';
    if (!enonce.trim()) return "L'énoncé est requis.";
    if (items.some(i => !i.enonce.trim())) return 'Tous les items doivent avoir un énoncé.';
    if (reponses.length === 0) return 'Sélectionnez au moins une bonne réponse.';
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);
    try {
      const url = await uploadImage();
      const payload = buildQuestion(url);
      let saved: Question;
      if (initial) {
        const { data } = await supabase.from('questions').update(payload).eq('id', initial.id).select().single();
        saved = data as Question;
      } else {
        const { data } = await supabase.from('questions').insert(payload).select().single();
        saved = data as Question;
      }
      onSaved(saved, false);
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setSaving(true);
    try {
      const url = await uploadImage();
      const payload = { ...buildQuestion(url), statut: 'publiee' as const };
      let saved: Question;
      if (initial) {
        const { data } = await supabase.from('questions').update(payload).eq('id', initial.id).select().single();
        saved = data as Question;
      } else {
        const { data } = await supabase.from('questions').insert(payload).select().single();
        saved = data as Question;
      }
      setShowPreview(false);
      onSaved(saved, false);
    } catch {
      setError('Erreur lors de la publication.');
    } finally {
      setSaving(false);
    }
  };

  const previewQuestion: Question = {
    id: initial?.id ?? 'preview',
    created_at: '',
    niveau, matiere, cours: cours || null, annee: annee ? parseInt(annee) : null,
    type, enonce, image_url: imagePreview, items, reponses, statut: 'brouillon',
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Informations</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Niveau</label>
            <select
              value={niveau}
              onChange={e => setNiveau(e.target.value as 'P2' | 'D1')}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option value="P2">P2</option>
              <option value="D1">D1</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Matière *</label>
            <input
              type="text"
              value={matiere}
              onChange={e => setMatiere(e.target.value)}
              placeholder="ex: Biochimie"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Année</label>
            <input
              type="number"
              value={annee}
              onChange={e => setAnnee(e.target.value)}
              placeholder="ex: 2023"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div className="col-span-2 sm:col-span-4">
            <label className="block text-xs text-slate-500 mb-1">Cours (optionnel)</label>
            <input
              type="text"
              value={cours}
              onChange={e => setCours(e.target.value)}
              placeholder="ex: Métabolisme des lipides"
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Image (optionnel)</h3>
        {imagePreview ? (
          <div className="relative inline-block">
            <img src={imagePreview} alt="Aperçu" className="max-h-48 rounded-xl border border-slate-200 object-contain" />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Ajouter une image
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
      </div>

      {/* Énoncé + Type */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Énoncé *</h3>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {(['QCM', 'QRU'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setType(t); if (t === 'QRU' && reponses.length > 1) setReponses([reponses[0]]); }}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  type === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={enonce}
          onChange={e => setEnonce(e.target.value)}
          rows={4}
          placeholder="Saisissez l'énoncé de la question..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Items de réponse</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={removeItem}
              disabled={items.length <= 2}
              className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:border-red-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              − Supprimer
            </button>
            <button
              onClick={addItem}
              disabled={items.length >= ITEM_LABELS.length}
              className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              + Ajouter
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.label} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 bg-slate-100 rounded-md flex items-center justify-center text-xs font-bold text-slate-600 mt-2.5">
                {item.label}
              </span>
              <div className="flex-1 grid sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={item.enonce}
                  onChange={e => updateItem(i, 'enonce', e.target.value)}
                  placeholder={`Énoncé item ${item.label}`}
                  className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
                />
                <input
                  type="text"
                  value={item.justification}
                  onChange={e => updateItem(i, 'justification', e.target.value)}
                  placeholder="Justification (optionnel)"
                  className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400 text-slate-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Correct answers */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Réponses correctes *
          {type === 'QRU' && <span className="ml-1 font-normal text-slate-400">(une seule)</span>}
        </h3>
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => toggleReponse(item.label)}
              className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                reponses.includes(item.label)
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {showPreview && (
        <QuestionPreview
          question={previewQuestion}
          onPublish={handlePublish}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => setShowPreview(v => !v)}
          className="flex-1 py-2.5 rounded-xl border-2 border-blue-200 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors"
        >
          {showPreview ? 'Masquer la prévisualisation' : 'Prévisualiser'}
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Sauvegarde...' : 'Enregistrer brouillon'}
        </button>
        <button
          onClick={onCancel}
          className="py-2.5 px-4 rounded-xl text-slate-400 text-sm hover:text-slate-600 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
