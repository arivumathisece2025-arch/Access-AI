import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eraser, Sparkles, Square, Volume2 } from 'lucide-react';
import { cancelSpeech, speakWithFallback } from '../lib/speak';

const MAX_CHARS = 2000;
const VOICES = [
  { id: 'en-IN-NeerjaNeural', label: 'Neerja - English (India)' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat - English (India)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia - English (UK)' },
  { id: 'en-US-AriaNeural', label: 'Aria - English (US)' },
];
const SAMPLES = ['Take one tablet after food, twice a day, for five days.', 'Question 4: Explain the working of a full adder with a truth table.'];

export default function TextToSpeech() {
  const [text, setText] = useState(''); const [voice, setVoice] = useState(VOICES[0].id); const [rate, setRate] = useState(0); const [speaking, setSpeaking] = useState(false); const [error, setError] = useState('');
  const rateString = `${rate >= 0 ? '+' : ''}${rate}%`;
  const speak = async () => { if (!text.trim()) { setError('Enter some text first.'); return; } setError(''); setSpeaking(true); await speakWithFallback(text, voice, rateString); setSpeaking(false); };
  return <motion.div className="feature-card-glass" role="tabpanel" id="panel-tts" aria-labelledby="tab-tts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <div className="card-header"><div className="card-icon card-icon-tts"><Volume2 size={24} aria-hidden="true" /></div><div><h2>Text to Speech</h2><p className="card-subtitle">Neural voices online, device voices offline. Never silent.</p></div></div>
    <label htmlFor="tts-input" className="sr-only">Text to convert to speech</label><textarea id="tts-input" rows={5} maxLength={MAX_CHARS} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a medicine label, an exam question, or a message..." className="glass-textarea" />
    <div className="flex-between"><span>{text.length} / {MAX_CHARS} characters</span>{speaking && <span className="waveform" aria-label="Speech playing">{[0, 1, 2, 3, 4].map((index) => <span key={index} className="wave-bar" />)}</span>}</div>
    <div className="tts-controls"><div className="ctl-group"><label className="ctl-label" htmlFor="voice-select">Voice</label><select id="voice-select" className="select" value={voice} onChange={(event) => setVoice(event.target.value)}>{VOICES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="ctl-group"><label className="ctl-label" htmlFor="rate-slider">Speed</label><input id="rate-slider" className="slider" type="range" min={-50} max={50} step={10} value={rate} onChange={(event) => setRate(Number(event.target.value))} /><span className="rate-val">{rateString}</span></div></div>
    <div className="chips-container" aria-label="Sample texts">{SAMPLES.map((sample) => <button key={sample} className="glass-chip" onClick={() => setText(sample)}><Sparkles size={12} aria-hidden="true" /> {sample.slice(0, 34)}...</button>)}<button className="glass-chip" onClick={() => setText('')}><Eraser size={12} aria-hidden="true" /> Clear</button></div>
    {error && <div className="auth-error" role="alert">{error}</div>}<div className="result-actions"><button className="btn-auth-primary flex-1" onClick={() => void speak()} disabled={speaking}>{speaking ? 'Speaking...' : 'Speak'} <Volume2 size={16} aria-hidden="true" /></button><button className="btn-action secondary" onClick={cancelSpeech}><Square size={16} aria-hidden="true" /> Stop</button></div>
  </motion.div>;
}
