import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eraser, Play, Square, Volume2 } from 'lucide-react';
import { cancelSpeech, speakWithFallback } from '../lib/speak';
import { useToast } from './Toasts';

const MAX_CHARS = 2000;
const VOICES = [
  { id: 'en-IN-NeerjaNeural', label: 'Neerja · IN' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat · IN' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia · UK' },
  { id: 'en-US-AriaNeural', label: 'Aria · US' },
];
const RATES = [0.75, 1, 1.25, 1.5];
const SAMPLES = [
  'Take one tablet after food, twice a day, for five days.',
  'Question 4: Explain the working of a full adder with a truth table.',
];

export default function TextToSpeech() {
  const toast = useToast();
  const [text, setText] = useState('');
  const [voice, setVoice] = useState(VOICES[0].id);
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');

  const speak = async () => {
    if (!text.trim()) { setError('Enter some text first.'); return; }
    setError(''); setSpeaking(true);
    await speakWithFallback(text, voice, rate);
    setSpeaking(false);
  };

  const clear = () => { setText(''); cancelSpeech(); setSpeaking(false); toast('info', 'Text cleared'); };

  return (
    <motion.section className="ws ws-tts" role="tabpanel" id="panel-tts" aria-labelledby="tab-tts"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="ws-head">
        <span className="ws-icon tone-coral"><Volume2 size={20} aria-hidden="true" /></span>
        <div>
          <h2>Text to Speech</h2>
          <p className="ws-sub">Audio console — neural voices online, device voices offline. Never silent.</p>
        </div>
        <span className={`state-pill ${speaking ? 'busy' : 'idle'}`}>{speaking ? 'on air' : 'ready'}</span>
      </div>

      <label htmlFor="tts-input" className="sr-only">Text to convert to speech</label>
      <textarea id="tts-input" className="paper" rows={6} maxLength={MAX_CHARS} value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a medicine label, an exam question, a message…" />
      <div className="console-meta">
        <span className="mono-meta">{text.length} / {MAX_CHARS}</span>
        <span className={`vu ${speaking ? 'live' : ''}`} aria-hidden="true">
          {[...Array(7)].map((_, i) => <i key={i} />)}
        </span>
      </div>

      <div className="voice-rail" role="group" aria-label="Voice">
        {VOICES.map((v) => (
          <button key={v.id} className={voice === v.id ? 'vchip active' : 'vchip'} onClick={() => setVoice(v.id)} aria-pressed={voice === v.id}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="transport">
        <button className="play-btn" onClick={() => void speak()} disabled={speaking} aria-label="Speak text">
          <Play size={22} fill="currentColor" aria-hidden="true" />
        </button>
        <button className="stop-btn" onClick={() => { cancelSpeech(); setSpeaking(false); }} aria-label="Stop speech">
          <Square size={16} fill="currentColor" aria-hidden="true" />
        </button>
        <div className="rate-group" role="group" aria-label="Speech speed">
          <span className="mono-meta">speed</span>
          {RATES.map((r) => (
            <button key={r} className={rate === r ? 'rchip active' : 'rchip'} onClick={() => setRate(r)} aria-pressed={rate === r}>
              ×{r}
            </button>
          ))}
        </div>
        <button className="btn-ghost clear-btn" onClick={clear}><Eraser size={14} aria-hidden="true" /> Clear</button>
      </div>

      <div className="sample-rail" aria-label="Sample texts">
        {SAMPLES.map((s) => (
          <button key={s} className="schip" onClick={() => setText(s)}>{s.slice(0, 40)}…</button>
        ))}
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
    </motion.section>
  );
}
