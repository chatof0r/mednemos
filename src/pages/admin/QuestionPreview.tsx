import { useState } from 'react';
import { Question, Item } from '../../types';

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

interface QuestionPreviewProps {
  question: Question;
  onPublish: () => void;
  onClose: () => void;
}

export default function QuestionPreview({ question, onPublish, onClose }: QuestionPreviewProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [validated, setValidated] = useState(false);

  const handleToggle = (label: string) => {
    if (validated) return;
    if (question.type === 'QRU') {
      setSelected(s => s.includes(label) ? [] : [label]);
    } else {
      setSelected(s => s.includes(label) ? s.filter(l => l !== label) : [...s, label]);
    }
  };

  return (
    <div className="border-2 border-blue-200 rounded-2xl bg-blue-50/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-blue-700">Prévisualisation</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-white rounded-xl p-5">
        <div className="flex justify-end mb-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            question.type === 'QCM' ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
          }`}>
            {question.type}
          </span>
        </div>

        {question.image_url && (
          <img
            src={question.image_url}
            alt="Illustration"
            className="w-full max-h-56 object-contain rounded-lg mb-4 bg-slate-50"
          />
        )}

        <p className="text-slate-800 font-medium leading-relaxed mb-4 whitespace-pre-wrap">{question.enonce || '(énoncé vide)'}</p>

        <div className="space-y-2">
          {question.items.map((item: Item) => {
            const state = getItemState(item.label, selected, question.reponses, validated);
            const isSelected = selected.includes(item.label);

            return (
              <button
                key={item.label}
                onClick={() => handleToggle(item.label)}
                disabled={validated}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left
                  ${!validated
                    ? isSelected ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    : state === 'correct-checked' ? 'border-green-400 bg-green-50'
                      : state === 'incorrect-checked' ? 'border-red-400 bg-red-50'
                        : state === 'correct-missed' ? 'border-green-700 bg-green-100'
                          : 'border-slate-200 bg-white'
                  }`}
              >
                <div className={`shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center border-2 transition-all
                  ${question.type === 'QRU' ? 'rounded-full' : 'rounded-md'}
                  ${!validated
                    ? isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 bg-white'
                    : state === 'correct-checked' ? 'border-green-500 bg-green-500'
                      : state === 'incorrect-checked' ? 'border-red-500 bg-red-500'
                        : state === 'correct-missed' ? 'border-green-700 bg-green-700'
                          : 'border-slate-300 bg-white'
                  }`}>
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
                  }`}>{item.label}.</span>
                  <span className={`text-sm ${isSelected && !validated ? 'text-blue-800' : 'text-slate-700'}`}>{item.enonce}</span>
                  {validated && (state === 'correct-checked' || state === 'incorrect-checked' || state === 'correct-missed') && item.justification && (
                    <p className={`mt-1 text-xs italic ${
                      state === 'correct-checked' ? 'text-green-600'
                        : state === 'incorrect-checked' ? 'text-red-600'
                          : 'text-green-800'
                    }`}>{item.justification}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {!validated ? (
            <button
              onClick={() => setValidated(true)}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              Valider
            </button>
          ) : (
            <button
              onClick={onPublish}
              className="w-full py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors"
            >
              Publier la question
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
