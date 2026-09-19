import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import AuthPage from './components/AuthPage';
import CodeRain from './components/CodeRain';
import Hero from './components/Hero';
import ScreenReader from './components/ScreenReader';
import SignTranslator from './components/SignTranslator';
import TextToSpeech from './components/TextToSpeech';
import { fetchMetrics } from './lib/api';
import type { Metrics } from './lib/api';
import { clearToken, getMe, getToken, setToken } from './lib/auth';
import type { AuthResponse, User } from './lib/auth';
import './App.css';

type Tab = 'reader' | 'tts' | 'sign';
const FONT_STEPS = [1, 1.15, 1.3];
const TABS: { id: Tab; label: string }[] = [{ id: 'reader', label: 'Screen Reader' }, { id: 'tts', label: 'Text to Speech' }, { id: 'sign', label: 'Speech to Sign' }];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('reader');
  const [highContrast, setHighContrast] = useState(false);
  const [fontStep, setFontStep] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const checkAuth = async () => { const token = getToken(); if (token) { try { setUser(await getMe(token)); } catch { clearToken(); } } setAuthLoading(false); };
    void checkAuth();
  }, []);
  useEffect(() => { document.documentElement.classList.toggle('high-contrast', highContrast); document.documentElement.style.fontSize = `${FONT_STEPS[fontStep] * 100}%`; }, [highContrast, fontStep]);
  useEffect(() => { if (!user) return; const poll = async () => { try { setMetrics(await fetchMetrics()); } catch { setMetrics(null); } }; void poll(); const id = window.setInterval(() => void poll(), 5000); return () => window.clearInterval(id); }, [user]);

  const handleAuth = (response: AuthResponse) => { setToken(response.token); setUser(response.user); };
  const handleLogout = () => { clearToken(); setUser(null); setMetrics(null); };
  if (authLoading) return <div className="app-loading" role="status" aria-label="Loading Access AI"><div className="loading-spinner" /></div>;
  if (!user) return <AuthPage onAuth={handleAuth} />;

  return <div className="app-shell"><div className="app-glow" aria-hidden="true" /><CodeRain /><div className="app">
    <header className="header"><div className="header-top"><h1>Access AI</h1><div className="user-info"><span className="user-name">{user.display_name} {user.guest && <span className="guest-badge">GUEST</span>}</span><button className="btn-logout" onClick={handleLogout} aria-label="Sign out" title="Sign out"><LogOut size={16} aria-hidden="true" /></button></div></div><p className="tagline">See, speak, sign - accessibility that works with or without internet.</p><div className="a11y-controls" role="group" aria-label="Display settings"><button className="btn btn-small" aria-pressed={highContrast} onClick={() => setHighContrast((value) => !value)}>High contrast</button><button className="btn btn-small" onClick={() => setFontStep((step) => (step + 1) % FONT_STEPS.length)}>Text size: {['A', 'A+', 'A++'][fontStep]}</button></div></header>
    <Hero />
    <nav className="tabs" role="tablist" aria-label="Features">{TABS.map((item) => <button key={item.id} role="tab" id={`tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{tab === item.id && <motion.span layoutId="tab-pill" className="tab-pill" />}<span className="tab-label">{item.label}</span></button>)}</nav>
    <main className="content"><AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>{tab === 'reader' && <ScreenReader />}{tab === 'tts' && <TextToSpeech />}{tab === 'sign' && <SignTranslator />}</motion.div></AnimatePresence></main>
    <footer className="footer">{metrics ? <p className="metrics" aria-label="Live system metrics">{metrics.device} · {metrics.whisper_model} · {metrics.requests_served} requests · {metrics.rss_mb} MB · {Math.round(metrics.uptime_s)}s up</p> : <p className="metrics">backend offline</p>}<p>Built for HackSpora 2.0 · Access AI</p></footer>
  </div></div>;
}
