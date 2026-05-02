import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Dossier, Item } from '../../types';
import { CURRICULUM, COURSES, ANNEES, getAllMatieres } from '../../lib/curriculum';

// ─── Types ────────────────────────────────────────────────────────────────────

const ITEM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const defaultItems = (): Item[] =>
  ['A', 'B', 'C', 'D', 'E'].map(label => ({ label, enonce: '', justification: '' }));

let _k = 0;
const nextKey = () => `k${++_k}`;

interface QuestionSlot {
  _key: string;
  dbId?: string;
  type: 'QCM' | 'QRU';
  enonce: string;
  items: Item[];
  reponses: string[];
  noteCorrection: string;
  imageFile: File | null;
  imagePreview: string | null;
  imageUrl: string | null;
}

function emptySlot(): QuestionSlot {
  return { _key: nextKey(), type: 'QCM', enonce: '', items: defaultItems(), reponses: [], noteCorrection: '', imageFile: null, imagePreview: null, imageUrl: null };
}

interface DossierFormProps {
  initial?: Dossier;
  onSaved: (d: Dossier) => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DossierForm({ initial, onSaved, onCancel }: DossierFormProps) {
  // Métadonnées dossier
  const [source, setSource] = useState<'annale' | 'ronéo'>(initial?.source ?? 'annale');
  const [niveau, setNiveau] = useState<'P2' | 'D1'>(initial?.niveau ?? 'P2');
  const [matiere, setMatiere] = useState(initial?.matiere ?? '');
  const [cours, setCours] = useState<string[]>(initial?.cours ?? []);
  const [annee, setAnnee] = useState<number | ''>(initial?.annee ?? '');
  const [session, setSession] = useState<1 | 2 | null>(initial?.session ?? null);
  const [titre, setTitre] = useState(initial?.titre ?? '');
  const [enonce, setEnonce] = useState(initial?.enonce ?? '');
  const [numeroOfficiel, setNumeroOfficiel] = useState<number | ''>(initial?.numero_officiel ?? '');

  // Image dossier
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null);
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);

  // Questions
  const [slots, setSlots] = useState<QuestionSlot[]>([emptySlot(), emptySlot()]);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());
  const [removedDbIds, setRemovedDbIds] = useState<string[]>([]);

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(!!initial?.id);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const matieres = getAllMatieres(niveau);
  const coursOptions = matiere ? (COURSES[matiere] ?? []) : [];

  // ── Charger les questions existantes en mode édition ─────────────────────
  useEffect(() => {
    if (!initial?.id) return;
    supabase
      .from('questions')
      .select('*')
      .eq('dossier_id', initial.id)
      .order('ordre_dossier', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          const loaded: QuestionSlot[] = data.map(q => ({
            _key: nextKey(),
            dbId: q.id,
            type: q.type as 'QCM' | 'QRU',
            enonce: q.enonce ?? '',
            items: q.items ?? defaultItems(),
            reponses: q.reponses ?? [],
            noteCorrection: q.note_correction ?? '',
            imageFile: null,
            imagePreview: q.image_url ?? null,
            imageUrl: q.image_url ?? null,
          }));
          setSlots(loaded);
          setExpandedSlots(new Set(loaded.map(s => s._key)));
        }
        setLoadingQuestions(false);
      });
  }, [initial?.id]);

  // ── Handlers niveau/matière ───────────────────────────────────────────────
  const handleNiveauChange = (n: 'P2' | 'D1') => { setNiveau(n); setMatiere(''); setCours([]); };
  const handleMatiereChange = (m: string) => { setMatiere(m); setCours([]); };
  const toggleCours = (c: string) => setCours(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  // ── Handlers image dossier ────────────────────────────────────────────────
  const applyImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  const removeImage = () => { setImageFile(null); setImagePreview(null); setImageUrl(null); if (imageFileRef.current) imageFileRef.current.value = ''; };

  // ── Handlers slots ────────────────────────────────────────────────────────
  const addSlot = () => {
    const s = emptySlot();
    setSlots(prev => [...prev, s]);
    setExpandedSlots(prev => new Set([...prev, s._key]));
  };

  const removeSlot = (key: string) => {
    const slot = slots.find(s => s._key === key);
    if (slot?.dbId) setRemovedDbIds(prev => [...prev, slot.dbId!]);
    setSlots(prev => prev.filter(s => s._key !== key));
    setExpandedSlots(prev => { const n = new Set(prev); n.delete(key); return n; });
  };

  const moveSlot = (key: string, dir: -1 | 1) => {
    setSlots(prev => {
      const idx = prev.findIndex(s => s._key === key);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const a = [...prev];
      [a[idx], a[next]] = [a[next], a[idx]];
      return a;
    });
  };

  const toggleSlot = (key: string) => {
    setExpandedSlots(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const updateSlot = (key: string, patch: Partial<QuestionSlot>) => {
    setSlots(prev => prev.map(s => s._key === key ? { ...s, ...patch } : s));
  };

  const updateSlotItem = (key: string, itemIdx: number, field: 'enonce' | 'justification', value: string) => {
    setSlots(prev => prev.map(s => {
      if (s._key !== key) return s;
      const items = s.items.map((it, i) => i === itemIdx ? { ...it, [field]: value } : it);
      return { ...s, items };
    }));
  };

  const addSlotItem = (key: string) => {
    setSlots(prev => prev.map(s => {
      if (s._key !== key || s.items.length >= ITEM_LABELS.length) return s;
      return { ...s, items: [...s.items, { label: ITEM_LABELS[s.items.length], enonce: '', justification: '' }] };
    }));
  };

  const removeSlotItem = (key: string) => {
    setSlots(prev => prev.map(s => {
      if (s._key !== key || s.items.length <= 2) return s;
      const lastLabel = s.items[s.items.length - 1].label;
      return { ...s, items: s.items.slice(0, -1), reponses: s.reponses.filter(r => r !== lastLabel) };
    }));
  };

  const toggleSlotReponse = (key: string, label: string, type: 'QCM' | 'QRU') => {
    setSlots(prev => prev.map(s => {
      if (s._key !== key) return s;
      if (type === 'QRU') return { ...s, reponses: s.reponses.includes(label) ? [] : [label] };
      return { ...s, reponses: s.reponses.includes(label) ? s.reponses.filter(r => r !== label) : [...s.reponses, label] };
    }));
  };

  const applySlotImage = (key: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    updateSlot(key, { imageFile: file, imagePreview: URL.createObjectURL(file) });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (statut: 'brouillon' | 'publiee') => {
    if (!matiere) return 'Sélectionnez une matière.';
    if (!titre.trim()) return 'Saisissez un titre pour le dossier.';
    if (slots.length < 2) return 'Un dossier progressif doit contenir au moins 2 questions.';
    if (statut === 'publiee') {
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i];
        if (!s.enonce.trim()) return `Q${i + 1} : l'énoncé est requis.`;
        if (s.items.some(it => !it.enonce.trim())) return `Q${i + 1} : tous les items doivent avoir un énoncé.`;
        if (s.reponses.length === 0) return `Q${i + 1} : sélectionnez au moins une bonne réponse.`;
      }
    }
    return null;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async (statut: 'brouillon' | 'publiee') => {
    const err = validate(statut);
    if (err) {
      setError(err);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      // 1. Upload image dossier
      let finalImageUrl = imageUrl;
      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `dossiers/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('question-images').upload(path, imageFile);
        if (upErr) throw upErr;
        finalImageUrl = supabase.storage.from('question-images').getPublicUrl(path).data.publicUrl;
      }

      // 2. Sauvegarder le dossier
      const dossierPayload = {
        titre: titre.trim(),
        enonce: enonce.trim() || null,
        image_url: finalImageUrl,
        niveau,
        matiere,
        cours: cours.length > 0 ? cours : null,
        annee: source === 'ronéo' ? null : (annee !== '' ? annee : null),
        session: source === 'ronéo' ? null : session,
        source,
        statut,
        numero_officiel: numeroOfficiel !== '' ? numeroOfficiel : null,
      };

      let savedDossier: Dossier;
      if (initial?.id) {
        const { data, error } = await supabase.from('dossiers').update(dossierPayload).eq('id', initial.id).select().single();
        if (error) throw error;
        savedDossier = data as Dossier;
      } else {
        const { data, error } = await supabase.from('dossiers').insert(dossierPayload).select().single();
        if (error) throw error;
        savedDossier = data as Dossier;
      }

      // 3. Supprimer les questions retirées
      if (removedDbIds.length > 0) {
        await supabase.from('questions').delete().in('id', removedDbIds);
      }

      // 4. Sauvegarder chaque question (ordre = index du slot)
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];

        let qImageUrl = slot.imageUrl;
        if (slot.imageFile) {
          const ext = slot.imageFile.name.split('.').pop();
          const path = `questions/${Date.now()}_${i}.${ext}`;
          const { error: upErr } = await supabase.storage.from('question-images').upload(path, slot.imageFile);
          if (!upErr) qImageUrl = supabase.storage.from('question-images').getPublicUrl(path).data.publicUrl;
        }

        const qPayload = {
          dossier_id: savedDossier.id,
          ordre_dossier: i + 1,
          niveau,
          matiere,
          cours: cours.length > 0 ? cours : null,
          annee: source === 'ronéo' ? null : (annee !== '' ? annee : null),
          session: source === 'ronéo' ? null : session,
          source,
          type: slot.type,
          enonce: slot.enonce.trim(),
          image_url: qImageUrl,
          items: slot.items,
          reponses: slot.reponses,
          hotspot: null,
          note_correction: slot.noteCorrection.trim() || null,
          statut,
          numero_officiel: null,
        };

        if (slot.dbId) {
          await supabase.from('questions').update(qPayload).eq('id', slot.dbId);
        } else {
          await supabase.from('questions').insert(qPayload);
        }
      }

      onSaved(savedDossier);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      setError(msg ? `Erreur : ${msg}` : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingQuestions) {
    return <div className="text-center py-16 text-slate-400 text-sm">Chargement du dossier…</div>;
  }

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

          {/* Source */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Source</label>
            <div className="flex gap-2">
              {([{ v: 'annale', label: 'Annale' }, { v: 'ronéo', label: 'Entraînement Ronéo' }] as { v: 'annale' | 'ronéo'; label: string }[]).map(s => (
                <button key={s.v} onClick={() => setSource(s.v)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    source === s.v
                      ? s.v === 'ronéo' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Niveau */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Niveau *</label>
            <div className="flex gap-2">
              {(['P2', 'D1'] as const).map(n => (
                <button key={n} onClick={() => handleNiveauChange(n)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                    niveau === n ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{n}</button>
              ))}
            </div>
          </div>

          {/* Matière */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Matière *</label>
            <div className="flex flex-wrap gap-2">
              {matieres.map(m => (
                <button key={m} onClick={() => handleMatiereChange(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    matiere === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{m}
                  <span className="ml-1.5 text-slate-400 font-normal">
                    {CURRICULUM[niveau].S1.includes(m) ? 'S1' : CURRICULUM[niveau].S2.includes(m) ? 'S2' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Cours */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Cours</label>
            {!matiere ? (
              <p className="text-xs text-slate-400 italic">Sélectionnez d'abord une matière</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {coursOptions.map(c => (
                  <button key={c} onClick={() => toggleCours(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all text-left ${
                      cours.includes(c) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{c}</button>
                ))}
              </div>
            )}
          </div>

          {/* Année */}
          {source !== 'ronéo' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Année</label>
              <div className="flex flex-wrap gap-2">
                {ANNEES.map(a => (
                  <button key={a} onClick={() => { setAnnee(a); setSession(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      annee === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>{a}</button>
                ))}
              </div>
            </div>
          )}

          {/* Session */}
          {source !== 'ronéo' && annee !== '' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Session</label>
              <div className="flex gap-2">
                {([1, 2] as const).map(s => (
                  <button key={s} onClick={() => setSession(session === s ? null : s)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      session === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    Session {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Titre + Numéro */}
          <div className="border-t border-slate-100 pt-4 grid sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500 mb-1.5">Titre du dossier *</label>
              <input
                type="text"
                value={titre}
                onChange={e => setTitre(e.target.value)}
                placeholder="Ex : Dossier de cardiologie — Infarctus du myocarde"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Numéro DP</label>
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500 font-medium">DP</span>
                <input
                  type="number" min={1}
                  value={numeroOfficiel}
                  onChange={e => setNumeroOfficiel(e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="1"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contexte et image ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Contexte clinique
          <span className="ml-1 font-normal text-slate-400">(optionnel)</span>
        </h3>
        <textarea
          value={enonce}
          onChange={e => setEnonce(e.target.value)}
          rows={4}
          placeholder="Texte introductif du cas clinique, visible par les étudiants avant les questions…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none mb-4"
        />
        <h4 className="text-xs font-semibold text-slate-500 mb-2">Image du dossier <span className="font-normal text-slate-400">(optionnel)</span></h4>
        {imagePreview ? (
          <div className="space-y-2">
            <img src={imagePreview} alt="Aperçu" className="w-full max-h-48 object-contain rounded-xl border border-slate-200 bg-slate-50" />
            <button onClick={removeImage} className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Supprimer l'image
            </button>
          </div>
        ) : (
          <div
            onClick={() => imageFileRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Cliquer pour ajouter une image
          </div>
        )}
        <input ref={imageFileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) applyImage(f); }} className="hidden" />
      </div>

      {/* ── Questions ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">
            Questions
            <span className="ml-2 text-xs font-normal text-slate-400">{slots.length} question{slots.length > 1 ? 's' : ''}</span>
          </h3>
          <button
            onClick={addSlot}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Ajouter une question
          </button>
        </div>

        <div className="space-y-3">
          {slots.map((slot, idx) => {
            const isOpen = expandedSlots.has(slot._key);
            return (
              <div key={slot._key} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Header du slot */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50">
                  <button onClick={() => toggleSlot(slot._key)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                    <span className="text-xs font-bold text-slate-500 shrink-0">Q{idx + 1}</span>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md ${
                      slot.type === 'QCM' ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'}`}>{slot.type}</span>
                    <span className="text-xs text-slate-500 truncate">{slot.enonce || <span className="italic text-slate-400">Énoncé vide</span>}</span>
                    <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ml-auto shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => moveSlot(slot._key, -1)} disabled={idx === 0}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-25 transition-colors" title="Monter">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveSlot(slot._key, 1)} disabled={idx === slots.length - 1}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-25 transition-colors" title="Descendre">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => removeSlot(slot._key)} disabled={slots.length <= 2}
                      className="p-1 rounded text-slate-400 hover:text-red-500 disabled:opacity-25 transition-colors" title="Supprimer">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                {/* Corps du slot */}
                {isOpen && (
                  <div className="p-4 space-y-4">
                    {/* Type */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-500">Type</label>
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                        {(['QCM', 'QRU'] as const).map(t => (
                          <button key={t} onClick={() => {
                            updateSlot(slot._key, { type: t, reponses: t === 'QRU' && slot.reponses.length > 1 ? [slot.reponses[0]] : slot.reponses });
                          }} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                            slot.type === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
                        ))}
                      </div>
                    </div>

                    {/* Image question */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">Image <span className="text-slate-400 font-normal">(optionnel)</span></label>
                      {slot.imagePreview ? (
                        <div className="space-y-1.5">
                          <img src={slot.imagePreview} alt="" className="w-full max-h-40 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                          <button onClick={() => updateSlot(slot._key, { imageFile: null, imagePreview: null, imageUrl: null })}
                            className="text-xs text-slate-400 hover:text-red-500 transition-colors">Supprimer</button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-blue-500 transition-colors">
                          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) applySlotImage(slot._key, f); }} />
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Ajouter une image
                        </label>
                      )}
                    </div>

                    {/* Énoncé */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">Énoncé *</label>
                      <textarea
                        value={slot.enonce}
                        onChange={e => updateSlot(slot._key, { enonce: e.target.value })}
                        rows={3}
                        placeholder="Énoncé de la question…"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none"
                      />
                    </div>

                    {/* Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-slate-500">Items de réponse *</label>
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeSlotItem(slot._key)} disabled={slot.items.length <= 2}
                            className="text-xs px-2 py-0.5 border border-slate-200 rounded text-slate-500 hover:border-red-300 hover:text-red-500 disabled:opacity-30 transition-colors">− Supprimer</button>
                          <button onClick={() => addSlotItem(slot._key)} disabled={slot.items.length >= ITEM_LABELS.length}
                            className="text-xs px-2 py-0.5 border border-slate-200 rounded text-slate-500 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 transition-colors">+ Ajouter</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {slot.items.map((item, iIdx) => (
                          <div key={item.label} className="flex items-start gap-2">
                            <span className="shrink-0 w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-xs font-bold text-slate-600 mt-2">
                              {item.label}
                            </span>
                            <div className="flex-1 grid sm:grid-cols-2 gap-1.5">
                              <input type="text" value={item.enonce} onChange={e => updateSlotItem(slot._key, iIdx, 'enonce', e.target.value)}
                                placeholder={`Énoncé item ${item.label}`}
                                className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400" />
                              <input type="text" value={item.justification} onChange={e => updateSlotItem(slot._key, iIdx, 'justification', e.target.value)}
                                placeholder="Justification (optionnel)"
                                className="border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:border-blue-400 text-slate-500" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Réponses correctes */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-2">
                        Réponses correctes *
                        {slot.type === 'QRU' && <span className="ml-1 font-normal text-slate-400">(une seule)</span>}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {slot.items.map(item => (
                          <button key={item.label} onClick={() => toggleSlotReponse(slot._key, item.label, slot.type)}
                            className={`w-9 h-9 rounded-xl font-bold text-sm transition-all ${
                              slot.reponses.includes(item.label) ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note de correction */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">
                        Note de correction <span className="font-normal text-slate-400">(optionnel)</span>
                      </label>
                      <textarea
                        value={slot.noteCorrection}
                        onChange={e => updateSlot(slot._key, { noteCorrection: e.target.value })}
                        rows={2}
                        placeholder="Note visible après correction du dossier complet…"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-3">
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
