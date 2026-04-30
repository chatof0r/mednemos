import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import AboutModal from './components/AboutModal';
import PinModal from './components/PinModal';
import Home from './pages/Home';
import Session from './pages/Session';
import Admin from './pages/Admin';

export default function App() {
  const [showAbout, setShowAbout] = useState(false);
  const [showPin, setShowPin] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
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
  );
}
