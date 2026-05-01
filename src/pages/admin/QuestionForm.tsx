import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Question, Item } from '../../types';
import { CURRICULUM, COURSES, ANNEES, getAllMatieres } from '../../lib/curriculum';
import QuestionPreview from './QuestionPreview';

const ITEM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const defaultItems = (): Item[] =>
  ['A', 'B', 'C', 'D', 'E'].map(label => ({ label, enonce: '', justification: '' }));

interface QuestionFormProps {
  initial?: Question;           // présent uniquement en mode édition (a un id)
  prefill?: Partial<Question>;  // pré-remplissage pour "ajouter à la suite"
  onSaved: (q: Question) => void;
  onCancel: () => void;
}

export default function QuestionForm({ initial, prefill, onSaved, onCancel }: QuestionFormProps) {
  const seed = initial ?? prefill;
  const [niveau, setNiveau] = useState<'P2' | 'D1'>(seed?.niveau ?? 'P2');
  const [matiere, setMatiere] = useState(seed?.matiere ?? '');
  const [cours, setCours] = useState<string[]>(seed?.cours ?? []);
  const [annee, setAnnee] = useState<number | ''>(seed?.annee ?? '');
  const [session, setSession] = useState<1 | 2 | null>(seed?.session ?? null);
  const [numeroOfficiel, setNumeroOfficiel] = useState<number | ''>(initial?.numero_officiel ?? '');
  const [type, setType] = useState<'QCM' | 'QRU'>(seed?.type ?? 'QCM');
  const [enonce, setEnonce] = useState(initial?.enonce ?? '');
  const [items, setItems] = useState<Item[]>(initial?.items ?? defaultItems());
  const [reponses, setReponses] = useState<string[]>(initial?.reponses ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null);
  const [importText, setImportText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const matieres = getAllMatieres(niveau);
  const coursOptions = matiere ? (COURSES[matiere] ?? []) : [];

  const handleNiveauChange = (n: 'P2' | 'D1') => {
    setNiveau(n);
    setMatiere('');
    setCours([]);
  };

  const handleMatiereChange = (m: string) => {
    setMatiere(m);
    setCours([]);
  };

  const toggleCours = (c: string) => {
    setCours(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const applyImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyImageFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.items)
      .find(item => item.type.startsWith('image/'))
      ?.getAsFile();
    if (file) applyImageFile(file);
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
    setItems(prev => [...prev, { label: ITEM_LABELS[prev.length], enonce: '', justification: '' }]);
  };

  const removeItem = () => {
    if (items.length <= 2) return;
    const lastLabel = items[items.length - 1].label;
    setItems(prev => prev.slice(0, -1));
    setReponses(prev => prev.filter(r => r !== lastLabel));
  };

  const parseAndImport = () => {
    const parts = importText.split(';').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return;

    const enoncePart = parts[0];
    const itemParts = parts.slice(1);

    const newItems: Item[] = itemParts
      .slice(0, ITEM_LABELS.length)
      .map((enonce, i) => ({ label: ITEM_LABELS[i], enonce, justification: '' }));

    if (newItems.length === 0) return;
    setEnonce(enoncePart);
    setItems(newItems);
    setReponses([]);
    setImportText('');
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
    return supabase.storage.from('question-images').getPublicUrl(path).data.publicUrl;
  };

  const buildPayload = (uploadedImageUrl: string | null, statut: 'brouillon' | 'publiee') => ({
    niveau,
    matiere,
    cours: cours.length > 0 ? cours : null,
    annee: annee !== '' ? annee : null,
    session: session,
    numero_officiel: numeroOfficiel !== '' ? numeroOfficiel : null,
    type,
    enonce: enonce.trim(),
    image_url: uploadedImageUrl,
    items,
    reponses,
    statut,
  });

  const validate = () => {
    if (!matiere) return 'Sélectionnez une matière.';
    if (cours.length === 0) return 'Sélectionnez au moins un cours.';
    if (!annee) return 'Sélectionnez une année.';
    if (!enonce.trim()) return "L'énoncé est requis.";
    if (items.some(i => !i.enonce.trim())) return 'Tous les items doivent avoir un énoncé.';
    if (reponses.length === 0) return 'Sélectionnez au moins une bonne réponse.';
    return null;
  };

  const save = async (statut: 'brouillon' | 'publiee') => {
    const err = validate();
    if (err) {
      setError(err);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const url = await uploadImage();
      const payload = buildPayload(url, statut);
      let saved: Question;
      if (initial?.id) {
        const { data, error } = await supabase.from('questions').update(payload).eq('id', initial.id).select().single();
        if (error) throw error;
        saved = data as Question;
      } else {
        const { data, error } = await supabase.from('questions').insert(payload).select().single();
        if (error) throw error;
        saved = data as Question;
      }
      setShowPreview(false);
      onSaved(saved);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      setError(msg ? `Erreur : ${msg}` : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const previewQuestion: Question = {
    id: initial?.id ?? 'preview',
    created_at: '',
    niveau, matiere,
    cours: cours.length > 0 ? cours : null,
    annee: annee !== '' ? annee : null,
    session,
    numero_officiel: numeroOfficiel !== '' ? numeroOfficiel : null,
    type, enonce, image_url: imagePreview, items, reponses, statut: 'brouillon',
  };

  const getSemLabel = (m: string): string => {
    if (CURRICULUM[niveau].S1.includes(m)) return 'S1';
    if (CURRICULUM[niveau].S2.includes(m)) return 'S2';
    return '';
  };

  const refLabel = annee !== '' && numeroOfficiel !== ''
    ? `Q${numeroOfficiel} / ${annee}${session ? `.${session}` : ''}`
    : null;

  return (
    <div className="space-y-5">
      {error && (
        <div ref={errorRef} className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Informations ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Informations</h3>
        <div className="space-y-4">

          {/* Niveau */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Niveau *</label>
            <div className="flex gap-2">
              {(['P2', 'D1'] as const).map(n => (
                <button
                  key={n}
                  onClick={() => handleNiveauChange(n)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    niveau === n
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Matière */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Matière *</label>
            <div className="flex flex-wrap gap-2">
              {matieres.map(m => (
                <button
                  key={m}
                  onClick={() => handleMatiereChange(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    matiere === m
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {m}
                  <span className="ml-1.5 text-slate-400 font-normal">{getSemLabel(m)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cours — multi-select */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">
              Cours *
              <span className="ml-1 font-normal text-slate-400">(plusieurs possibles)</span>
            </label>
            {!matiere ? (
              <p className="text-xs text-slate-400 italic">Sélectionnez d'abord une matière</p>
            ) : coursOptions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun cours défini pour cette matière</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {coursOptions.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCours(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-left ${
                      cours.includes(c)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Année */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Année *</label>
            <div className="flex flex-wrap gap-2">
              {ANNEES.map(a => (
                <button
                  key={a}
                  onClick={() => { setAnnee(a); setSession(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    annee === a
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Session — visible quand une année est sélectionnée */}
          {annee !== '' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                Session
                <span className="ml-1 font-normal text-slate-400">(optionnel)</span>
              </label>
              <div className="flex gap-2">
                {([1, 2] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSession(session === s ? null : s)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      session === s
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    Session {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Référencement officiel */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs text-slate-500 mb-1.5">
              Référencement officiel
              <span className="ml-1 text-slate-400 font-normal">(numéro dans le sujet d'origine)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 min-w-[80px] text-center">
                {annee !== '' ? `${annee}${session ? `.${session}` : ''}` : '—'}
              </div>
              <span className="text-slate-400">·</span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500 font-medium">Q</span>
                <input
                  type="number"
                  min={1}
                  value={numeroOfficiel}
                  onChange={e => setNumeroOfficiel(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="14"
                  className="w-20 border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              {refLabel && (
                <span className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg font-mono">
                  {refLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Image ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Image <span className="font-normal text-slate-400">(optionnel)</span></h3>
        {imagePreview ? (
          <div
            className="relative inline-block"
            onPaste={handlePaste}
            tabIndex={0}
          >
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
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragEnter={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onPaste={handlePaste}
            tabIndex={0}
            className={`flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors outline-none focus:ring-2 focus:ring-blue-300 ${
              isDragging
                ? 'border-blue-400 bg-blue-50 text-blue-500'
                : 'border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">
              {isDragging ? "Déposer l'image ici" : 'Cliquer, glisser ou coller (⌘V) une image'}
            </span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
      </div>

      {/* ── Import rapide + Type ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Import rapide</h3>
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
        <p className="text-xs text-slate-400 mb-2">
          Format : <span className="font-mono text-slate-500">Énoncé ; Item A ; Correction A ; ... ; ABD</span>
        </p>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          rows={4}
          placeholder="Énoncé de la question ; Item A ; Correction A ; Item B ; Correction B ; Item C ; Correction C ; Item D ; Correction D ; Item E ; Correction E ; ABCDE"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none mb-3"
        />
        <button
          onClick={parseAndImport}
          disabled={!importText.trim()}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Remplir automatiquement
        </button>
      </div>

      {/* ── Énoncé ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Énoncé *</h3>
        <textarea
          value={enonce}
          onChange={e => setEnonce(e.target.value)}
          rows={4}
          placeholder="Saisissez ou collez l'énoncé..."
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* ── Items ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">Items de réponse</h3>
          <div className="flex items-center gap-2">
            <button onClick={removeItem} disabled={items.length <= 2}
              className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:border-red-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              − Supprimer
            </button>
            <button onClick={addItem} disabled={items.length >= ITEM_LABELS.length}
              className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
                <input type="text" value={item.enonce} onChange={e => updateItem(i, 'enonce', e.target.value)}
                  placeholder={`Énoncé item ${item.label}`}
                  className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400" />
                <input type="text" value={item.justification} onChange={e => updateItem(i, 'justification', e.target.value)}
                  placeholder="Justification (optionnel)"
                  className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400 text-slate-500" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Réponses correctes ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Réponses correctes *
          {type === 'QRU' && <span className="ml-1 font-normal text-slate-400">(une seule)</span>}
        </h3>
        <div className="flex flex-wrap gap-2">
          {items.map(item => (
            <button key={item.label} onClick={() => toggleReponse(item.label)}
              className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                reponses.includes(item.label) ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Prévisualisation ── */}
      {showPreview && (
        <QuestionPreview
          question={previewQuestion}
          onPublish={() => save('publiee')}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => setShowPreview(v => !v)}
          className="py-2.5 px-4 rounded-xl border-2 border-blue-200 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors">
          {showPreview ? 'Masquer' : 'Aperçu'}
        </button>
        <button onClick={() => save('brouillon')} disabled={saving}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors">
          {saving ? 'Sauvegarde...' : 'Brouillon'}
        </button>
        <button onClick={() => save('publiee')} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
          {saving ? 'Publication...' : 'Publier'}
        </button>
        <button onClick={onCancel}
          className="py-2.5 px-4 rounded-xl text-slate-400 text-sm hover:text-slate-600 transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}
