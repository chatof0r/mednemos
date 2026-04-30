import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeContext } from './lib/theme';
import Navbar from './components/Navbar';
import AboutModal from './components/AboutModal';
import PinModal from './components/PinModal';
import Home from './pages/Home';
import Session from './pages/Session';
import Admin from './pages/Admin';

export default function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');

  const toggle = () => {
    setIsDark(d => {
      const next = !d;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] transition-colors duration-200">
        <Navbar onLogoClick={() => setShowAbout(true)} />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session" element={<Session />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        {showAbout && (
          <AboutModal
            onClose={() => setShowAbout(false)}
            onAdminClick={() => setShowPin(true)}
          />
        )}
        {showPin && (
          <PinModal onClose={() => setShowPin(false)} />
        )}
      </div>
    </ThemeContext.Provider>
  );
}
