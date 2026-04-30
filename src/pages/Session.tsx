import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Question, Item, SessionConfig } from '../types';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type ItemState = 'neutral' | 'correct-checked' | 'incorrect-checked' | 'correct-missed';

function getItemState(label: string, selected: string[], reponses: string[], validated: boolean): ItemState {
  if (!validated) return 'neutral';
  const isCorrect = reponses.includes(label);
  const isSelected = selected.includes(label);
  if (isCorrect && isSelected) return 'correct-checked';
  if (!isCorrect && isSelected) return 'incorrect-checked';
  if (isCorrect && !isSelected) return 'correct-missed';
  return 'neutral';
}

interface QuestionCardProps {
  question: Question;
  selected: string[];
  validated: boolean;
  onToggle: (label: string) => void;
  onValidate: () => void;
  onNext: () => void;
  isLast: boolean;
  index: number;
  total: number;
}

function QuestionCard({ question, selected, validated, onToggle, onValidate, onNext, isLast, index, total }: QuestionCardProps) {
  const [remarkText, setRemarkText] = useState('');
  const [remarkSent, setRemarkSent] = useState(false);
  const [showRemark, setShowRemark] = useState(false);

  const sendRemark = async () => {
    if (!remarkText.trim()) return;
    await supabase.from('suggestions').insert({
      message: `[Q ${question.id.slice(0, 8)} - ${question.matiere}] ${remarkText.trim()}`,
    });
    setRemarkSent(true);
    setRemarkText('');
    setTimeout(() => { setRemarkSent(false); setShowRemark(false); }, 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
      {/* Progress + badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-slate-400 font-medium">Question {index + 1} / {total}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
          question.type === 'QCM'
            ? 'bg-violet-100 text-violet-700'
            : 'bg-orange-100 text-orange-700'
        }`}>
          {question.type}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-100 rounded-full h-1 mb-6">
        <div
          className="bg-blue-500 h-1 rounded-full transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Image */}
      {question.image_url && (
        <img
          src={question.image_url}
          alt="Illustration"
          className="w-full max-h-64 object-contain rounded-xl mb-4 bg-slate-50"
        />
      )}

      {/* Énoncé */}
      <p className="text-slate-800 font-medium leading-relaxed mb-6 whitespace-pre-wrap">{question.enonce}</p>

      {/* Items */}
      <div className="space-y-2">
        {question.items.map((item: Item) => {
          const state = getItemState(item.label, selected, question.reponses, validated);
          const isSelected = selected.includes(item.label);

          return (
            <div key={item.label}>
              <button
                onClick={() => !validated && onToggle(item.label)}
                disabled={validated}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left
                  ${!validated
                    ? isSelected
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    : state === 'correct-checked'
                      ? 'border-green-400 bg-green-50'
                      : state === 'incorrect-checked'
                        ? 'border-red-400 bg-red-50'
                        : state === 'correct-missed'
                          ? 'border-green-700 bg-green-100'
                          : 'border-slate-200 bg-white'
                  }
                `}
              >
                {/* Checkbox / Radio */}
                <div className={`shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center border-2 transition-all
                  ${question.type === 'QRU' ? 'rounded-full' : 'rounded-md'}
                  ${!validated
                    ? isSelected
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-slate-300 bg-white'
                    : state === 'correct-checked'
                      ? 'border-green-500 bg-green-500'
                      : state === 'incorrect-checked'
                        ? 'border-red-500 bg-red-500'
                        : state === 'correct-missed'
                          ? 'border-green-700 bg-green-700'
                          : 'border-slate-300 bg-white'
                  }
                `}>
                  {(isSelected || state === 'correct-missed') && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium mr-1 ${
                    validated
                      ? state === 'correct-checked' ? 'text-green-700'
                        : state === 'incorrect-checked' ? 'text-red-700'
                          : state === 'correct-missed' ? 'text-green-900'
                            : 'text-slate-500'
                      : isSelected ? 'text-blue-700' : 'text-slate-700'
                  }`}>
                    {item.label}.
                  </span>
                  <span className={`text-sm ${
                    validated
                      ? state === 'correct-checked' ? 'text-green-700'
                        : state === 'incorrect-checked' ? 'text-red-700'
                          : state === 'correct-missed' ? 'text-green-900'
                            : 'text-slate-600'
                      : isSelected ? 'text-blue-800' : 'text-slate-700'
                  }`}>
                    {item.enonce}
                  </span>

                  {/* Justification */}
                  {validated && (state === 'correct-checked' || state === 'incorrect-checked' || state === 'correct-missed') && item.justification && (
                    <p className={`mt-1.5 text-xs leading-relaxed italic ${
                      state === 'correct-checked' ? 'text-green-600'
                        : state === 'incorrect-checked' ? 'text-red-600'
                          : 'text-green-800'
                    }`}>
                      {item.justification}
                    </p>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        {!validated ? (
          <button
            onClick={onValidate}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Valider
          </button>
        ) : (
          <button
            onClick={onNext}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            {isLast ? 'Voir les résultats' : 'Question suivante →'}
          </button>
        )}

        {/* Remark */}
        {!showRemark ? (
          <button
            onClick={() => setShowRemark(true)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors text-center"
          >
            Signaler une erreur ou faire une remarque
          </button>
        ) : (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Remarque sur cette question</p>
            <textarea
              value={remarkText}
              onChange={e => setRemarkText(e.target.value)}
              rows={2}
              placeholder="Décris l'erreur ou ta suggestion..."
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 resize-none bg-white"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={sendRemark}
                disabled={!remarkText.trim()}
                className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {remarkSent ? '✓ Envoyé' : 'Envoyer'}
              </button>
              <button
                onClick={() => setShowRemark(false)}
                className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ResultsProps {
  questions: Question[];
  answers: Record<string, string[]>;
  onRestart: () => void;
}

function Results({ questions, answers, onRestart }: ResultsProps) {
  const wrong = questions.filter(q => {
    const sel = answers[q.id] ?? [];
    const correct = [...q.reponses].sort().join(',');
    const given = [...sel].sort().join(',');
    return correct !== given;
  });

  const score = questions.length - wrong.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Score */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center mb-8">
        <div className={`text-6xl font-bold mb-2 ${
          score / questions.length >= 0.7 ? 'text-green-600' : score / questions.length >= 0.5 ? 'text-orange-500' : 'text-red-500'
        }`}>
          {score}/{questions.length}
        </div>
        <div className="text-slate-500 text-sm mb-4">
          {Math.round((score / questions.length) * 100)}% de bonnes réponses
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${
              score / questions.length >= 0.7 ? 'bg-green-500' : score / questions.length >= 0.5 ? 'bg-orange-400' : 'bg-red-400'
            }`}
            style={{ width: `${(score / questions.length) * 100}%` }}
          />
        </div>
        <button
          onClick={onRestart}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          Nouvelle session
        </button>
      </div>

      {/* Wrong questions recap */}
      {wrong.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            À revoir ({wrong.length} question{wrong.length > 1 ? 's' : ''})
          </h2>
          <div className="space-y-4">
            {wrong.map(q => {
              const sel = answers[q.id] ?? [];
              return (
                <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      q.type === 'QCM' ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
                    }`}>{q.type}</span>
                    {q.matiere && <span className="text-xs text-slate-400">{q.matiere}{q.annee ? ` · ${q.annee}` : ''}</span>}
                  </div>
                  {q.image_url && (
                    <img src={q.image_url} alt="" className="w-full max-h-48 object-contain rounded-lg mb-3 bg-slate-50" />
                  )}
                  <p className="text-sm font-medium text-slate-800 mb-3 whitespace-pre-wrap">{q.enonce}</p>
                  <div className="space-y-1.5">
                    {q.items.map(item => {
                      const state = getItemState(item.label, sel, q.reponses, true);
                      if (state === 'neutral') return null;
                      return (
                        <div key={item.label} className={`p-2.5 rounded-lg text-xs ${
                          state === 'correct-checked' ? 'bg-green-50 text-green-700'
                            : state === 'incorrect-checked' ? 'bg-red-50 text-red-700'
                              : 'bg-green-100 text-green-900'
                        }`}>
                          <span className="font-bold">{item.label}.</span> {item.enonce}
                          {item.justification && (
                            <p className="mt-1 italic opacity-80">{item.justification}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Session() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as SessionConfig | null;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [validated, setValidated] = useState<Set<string>>(new Set());
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }
    const qs = state.order === 'random' ? shuffle(state.questions) : state.questions;
    setQuestions(qs);
  }, []);

  if (!state) return null;

  if (showResults) {
    return <Results questions={questions} answers={answers} onRestart={() => navigate('/')} />;
  }

  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const currentSelected = answers[currentQuestion.id] ?? [];
  const isValidated = validated.has(currentQuestion.id);

  const handleToggle = (label: string) => {
    setAnswers(prev => {
      const sel = prev[currentQuestion.id] ?? [];
      if (currentQuestion.type === 'QRU') {
        return { ...prev, [currentQuestion.id]: sel.includes(label) ? [] : [label] };
      }
      return {
        ...prev,
        [currentQuestion.id]: sel.includes(label) ? sel.filter(l => l !== label) : [...sel, label],
      };
    });
  };

  const handleValidate = () => {
    setValidated(prev => new Set([...prev, currentQuestion.id]));
  };

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      setShowResults(true);
    } else {
      setCurrentIndex(i => i + 1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <QuestionCard
        question={currentQuestion}
        selected={currentSelected}
        validated={isValidated}
        onToggle={handleToggle}
        onValidate={handleValidate}
        onNext={handleNext}
        isLast={currentIndex + 1 >= questions.length}
        index={currentIndex}
        total={questions.length}
      />
    </div>
  );
}
