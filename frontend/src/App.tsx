import { useEffect, useState } from 'react';
import ScreenReader from './components/ScreenReader';
import TextToSpeech from './components/TextToSpeech';
import SignTranslator from './components/SignTranslator';
import { fetchMetrics } from './lib/api';
import type { Metrics } from './lib/api';
import './App.css';

type Tab = 'reader' | 'tts' | 'sign';
const FONT_STEPS = [1, 1.15, 1.3];

export default function App() {
  const [tab, setTab] = useState<Tab>('reader');
  const [highContrast, setHighContrast] = useState(false);
  const [fontStep, setFontStep] = useState(0);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.style.fontSize = `${FONT_STEPS[fontStep] * 100}%`;
  }, [highContrast, fontStep]);

  useEffect(() => {
    const poll = async () => {
      try { setMetrics(await fetchMetrics()); } catch { setMetrics(null); }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Access AI</h1>
        <p className="tagline">See, speak, sign — accessibility that works with or without internet.</p>
        <div className="a11y-controls" role="group" aria-label="Display settings">
          <button className="btn btn-small" aria-pressed={highContrast} onClick={() => setHighContrast((v) => !v)}>High contrast</button>
          <button className="btn btn-small" onClick={() => setFontStep((s) => (s + 1) % FONT_STEPS.length)}>Text size: {['A', 'A+', 'A++'][fontStep]}</button>
        </div>
      </header>
      <nav className="tabs" role="tablist" aria-label="Features">
        <button role="tab" id="tab-reader" aria-selected={tab === 'reader'} aria-controls="panel-reader" className={tab === 'reader' ? 'active' : ''} onClick={() => setTab('reader')}>Screen Reader</button>
        <button role="tab" id="tab-tts" aria-selected={tab === 'tts'} aria-controls="panel-tts" className={tab === 'tts' ? 'active' : ''} onClick={() => setTab('tts')}>Text to Speech</button>
        <button role="tab" id="tab-sign" aria-selected={tab === 'sign'} aria-controls="panel-sign" className={tab === 'sign' ? 'active' : ''} onClick={() => setTab('sign')}>Speech to Sign</button>
      </nav>
      <main className="content">
        {tab === 'reader' && <ScreenReader />}
        {tab === 'tts' && <TextToSpeech />}
        {tab === 'sign' && <SignTranslator />}
      </main>
      <footer className="footer">
        {metrics ? <p className="metrics" aria-label="Live system metrics">{metrics.device} · {metrics.whisper_model} · {metrics.requests_served} requests · {metrics.rss_mb} MB · {Math.round(metrics.uptime_s)}s up</p> : <p className="metrics">backend offline</p>}
        <p>Built for HackSpora 2.0 · Access AI</p>
      </footer>
    </div>
  );
}
