import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Square, Volume2 } from 'lucide-react';
import { cancelSpeech, speakWithFallback } from '../lib/speak';

const MAX_CHARS = 2000;
const SAMPLES = ['Take one tablet after food, twice a day.', 'Question 4: Explain the full adder circuit.'];

export default function TextToSpeech() {
  const [text, setText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const speak = async () => { if (!text.trim()) { setError('Enter some text first.'); return; } setError(''); setSpeaking(true); await speakWithFallback(text); setSpeaking(false); };
  return <motion.div className="feature-card-glass" role="tabpanel" id="panel-tts" aria-labelledby="tab-tts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <div className="card-header"><div className="card-icon card-icon-tts"><Volume2 size={24} aria-hidden="true" /></div><div><h2>Text to Speech</h2><p className="card-subtitle">Neural voices online, device voices offline. Never silent.</p></div></div>
    <label htmlFor="tts-input" className="sr-only">Text to convert</label><textarea id="tts-input" rows={5} maxLength={MAX_CHARS} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a medicine label, an exam question, or a message..." className="glass-textarea" />
    <div className="flex-between"><span className="text-xs text-slate-400">{text.length} / {MAX_CHARS}</span>{speaking && <div className="waveform" aria-label="Speech playing">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="wave-bar" />)}</div>}</div>
    <div className="chips-container" aria-label="Sample texts">{SAMPLES.map((sample) => <button key={sample} className="glass-chip" onClick={() => setText(sample)}><Sparkles size={12} aria-hidden="true" /> {sample.slice(0, 30)}...</button>)}</div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <div className="result-actions mt-6"><button className="btn-auth-primary flex-1" onClick={() => void speak()} disabled={speaking}>{speaking ? 'Speaking...' : 'Speak'} <Volume2 size={16} aria-hidden="true" /></button><button className="btn-action secondary" onClick={cancelSpeech}><Square size={16} aria-hidden="true" /> Stop</button></div>
  </motion.div>;
}
