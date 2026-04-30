import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface PinModalProps {
  onClose: () => void;
}

export default function PinModal({ onClose }: PinModalProps) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(false);
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === 3) {
      const pin = [...next].join('');
      if (pin.length === 4) checkPin(pin);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const checkPin = (pin: string) => {
    const correct = import.meta.env.VITE_ADMIN_PIN;
    if (pin === correct) {
      sessionStorage.setItem('admin_auth', 'true');
      onClose();
      navigate('/admin');
    } else {
      setError(true);
      setDigits(['', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Espace administrateur</h2>
          <p className="text-sm text-slate-500 mt-1">Entrez votre code PIN à 4 chiffres</p>
        </div>

        <div className="flex gap-3 justify-center mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-colors
                ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500 bg-white'}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-red-500 mb-4">Code incorrect, réessayez</p>
        )}

        <button
          onClick={onClose}
          className="w-full mt-2 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
