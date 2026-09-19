import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Accessibility, Command, Contrast, Copy, Eye, Hand, LogOut, Type, Volume2 } from 'lucide-react';
import AuthPage from './components/AuthPage';
import CodeRain from './components/CodeRain';
import CommandPalette from './components/CommandPalette';
import type { PaletteAction } from './components/CommandPalette';
import ScreenReader from './components/ScreenReader';
import SignTranslator from './components/SignTranslator';
import TextToSpeech from './components/TextToSpeech';
import { ToastProvider, useToast } from './components/Toasts';
import { fetchMetrics, API_BASE } from './lib/api';
import type { Metrics } from './lib/api';
import { clearToken, getMe, getToken, setToken } from './lib/auth';
import type { AuthResponse, User } from './lib/auth';
import './App.css';

type Tab = 'reader' | 'tts' | 'sign';
const FONT_STEPS = [1, 1.15, 1.3];
const TABS: { id: Tab; label: string; key: string }[] = [{ id: 'reader', label: 'Screen Reader', key: '1' }, { id: 'tts', label: 'Text to Speech', key: '2' }, { id: 'sign', label: 'Speech to Sign', key: '3' }];

function Shell() {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null); const [authLoading, setAuthLoading] = useState(true); const [tab, setTab] = useState<Tab>('reader'); const [highContrast, setHighContrast] = useState(false); const [fontStep, setFontStep] = useState(0); const [metrics, setMetrics] = useState<Metrics | null>(null); const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => { const checkAuth = async () => { const token = getToken(); if (token) { try { setUser(await getMe(token)); } catch { clearToken(); } } setAuthLoading(false); }; void checkAuth(); }, []);
  useEffect(() => { document.documentElement.classList.toggle('high-contrast', highContrast); document.documentElement.style.fontSize = `${FONT_STEPS[fontStep] * 100}%`; }, [highContrast, fontStep]);
  useEffect(() => { if (!user) return; const poll = async () => { try { setMetrics(await fetchMetrics()); } catch { setMetrics(null); } }; void poll(); const id = window.setInterval(() => void poll(), 5000); return () => window.clearInterval(id); }, [user]);
  useEffect(() => { const onMove = (event: MouseEvent) => { const element = (event.target as HTMLElement).closest('.feature-card-glass, .stat-mini'); if (!(element instanceof HTMLElement)) return; const rect = element.getBoundingClientRect(); element.style.setProperty('--mx', `${event.clientX - rect.left}px`); element.style.setProperty('--my', `${event.clientY - rect.top}px`); }; window.addEventListener('mousemove', onMove); return () => window.removeEventListener('mousemove', onMove); }, []);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPaletteOpen((value) => !value); return; } const target = event.target as HTMLElement; const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable; if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey) { const hit = TABS.find((item) => item.key === event.key); if (hit) setTab(hit.id); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  const handleAuth = (response: AuthResponse) => { setToken(response.token); setUser(response.user); };
  const handleLogout = () => { clearToken(); setUser(null); setMetrics(null); };
  const actions = useMemo<PaletteAction[]>(() => [...TABS.map((item) => ({ id: `goto-${item.id}`, label: `Go to ${item.label}`, hint: item.key, icon: item.id === 'reader' ? Eye : item.id === 'tts' ? Volume2 : Hand, run: () => setTab(item.id) })), { id: 'contrast', label: 'Toggle high contrast', icon: Contrast, run: () => setHighContrast((value) => !value) }, { id: 'textsize', label: 'Cycle text size', icon: Type, run: () => setFontStep((step) => (step + 1) % FONT_STEPS.length) }, { id: 'copy-metrics', label: 'Copy system metrics as JSON', icon: Copy, run: () => { if (!metrics) { toast('error', 'Metrics unavailable - backend offline'); return; } void navigator.clipboard.writeText(JSON.stringify(metrics, null, 2)); toast('success', 'Metrics copied to clipboard'); } }, { id: 'logout', label: 'Sign out', icon: LogOut, run: handleLogout }], [metrics, toast]);
  if (authLoading) return <div className="app-loading" role="status" aria-label="Loading Access AI"><div className="loading-spinner" /></div>;
  if (!user) return <AuthPage onAuth={handleAuth} />;
  return <div className="app-shell"><CodeRain /><header className="topbar"><div className="topbar-left"><span className="logo-mark"><Accessibility size={15} aria-hidden="true" /></span><span className="product-name">Access AI</span><span className="env-pill"><i className="dot dot-ok" />local · gpu</span></div><div className="topbar-right"><button className="kbd-button" onClick={() => setPaletteOpen(true)} aria-label="Open command palette"><Command size={13} aria-hidden="true" /> <kbd>ctrl</kbd><kbd>K</kbd></button><span className="user-chip">{user.display_name}{user.guest && <span className="guest-badge">GUEST</span>}</span><button className="icon-button" onClick={handleLogout} aria-label="Sign out"><LogOut size={14} aria-hidden="true" /></button></div></header>
    <div className="app"><div className="page-head"><div><h1>Accessibility Console</h1><p>See, speak, sign - on-device inference, no cloud, no quotas.</p></div><div className="head-stats"><span className="stat-mini">1.48s <em>image p50</em></span><span className="stat-mini">0 <em>cloud calls</em></span><span className="stat-mini">12 <em>ISL phrases</em></span></div></div>
      <nav className="tabs" role="tablist" aria-label="Features">{TABS.map((item) => <button key={item.id} role="tab" id={`tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`panel-${item.id}`} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{tab === item.id && <motion.span layoutId="tab-pill" className="tab-pill" />}<span className="tab-label">{item.label}</span><kbd className="tab-kbd">{item.key}</kbd></button>)}</nav>
      <main className="content"><AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: 'easeOut' }}>{tab === 'reader' && <ScreenReader />}{tab === 'tts' && <TextToSpeech />}{tab === 'sign' && <SignTranslator />}</motion.div></AnimatePresence></main>
    </div><footer className="statusbar" aria-label="System status"><span className="status-item"><i className={`dot ${metrics ? 'dot-ok' : 'dot-err'}`} />{metrics ? 'live' : 'offline'}</span><span className="status-item">{metrics?.device ?? '—'}</span><span className="status-item">whisper:{metrics?.whisper_model ?? '—'}</span><span className="status-item">{metrics?.requests_served ?? 0} req</span><span className="status-item">{metrics?.rss_mb ?? 0} MB</span><span className="status-item">{metrics ? `${Math.round(metrics.uptime_s)}s up` : '—'}</span><span className="status-item status-right">{API_BASE.replace(/^https?:\/\//, '')}</span></footer><CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} /></div>;
}
export default function App() { return <ToastProvider><Shell /></ToastProvider>; }
