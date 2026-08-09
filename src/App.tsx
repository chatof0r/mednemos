import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeContext } from './lib/theme';
import { AuthProvider } from './lib/auth';
import Navbar from './components/Navbar';
import AboutModal from './components/AboutModal';
import AdminLoginModal from './components/AdminLoginModal';
import Home from './pages/Home';
import Session from './pages/Session';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

export default function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
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
      <AuthProvider>
        <div className="min-h-screen bg-brand dark:bg-charcoal text-ink transition-colors duration-200">
          <Navbar onLogoClick={() => setShowAbout(true)} />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/session" element={<Session />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/profil" element={<Profile />} />
            </Routes>
          </main>
          {showAbout && (
            <AboutModal
              onClose={() => setShowAbout(false)}
              onAdminClick={() => setShowLogin(true)}
            />
          )}
          {showLogin && (
            <AdminLoginModal onClose={() => setShowLogin(false)} />
          )}
        </div>
      </AuthProvider>
    </ThemeContext.Provider>
  );
}
