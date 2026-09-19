import { useState } from 'react';
import { cancelSpeech, speakWithFallback } from '../lib/speak';
const MAX_CHARS = 2000;
const SAMPLES = ['Take one tablet after food, twice a day, for five days.', 'Question 4: Explain the working of a full adder with a truth table.'];
export default function TextToSpeech() {
  const [text, setText] = useState(''); const [speaking, setSpeaking] = useState(false); const [error, setError] = useState('');
  const speak = async () => { if (!text.trim()) { setError('Enter some text first.'); return; } setError(''); setSpeaking(true); await speakWithFallback(text); setSpeaking(false); };
  return <div className="feature-card" role="tabpanel" id="panel-tts" aria-labelledby="tab-tts"><h2>Text to Speech</h2><p>Any text becomes natural speech. Neural voice when online, device voice when offline.</p><label htmlFor="tts-input" className="visually-hidden">Text to convert to speech</label><textarea id="tts-input" rows={5} maxLength={MAX_CHARS} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type anything - a medicine label, a question paper, a message..." /><p className="meta">{text.length} / {MAX_CHARS} characters</p><div className="chips" aria-label="Sample texts">{SAMPLES.map((sample) => <button key={sample} className="chip" onClick={() => setText(sample)}>{sample.slice(0, 32)}...</button>)}</div>{error && <div className="error" role="alert">{error}</div>}<div className="btn-row"><button className="btn" onClick={() => void speak()} disabled={speaking}>Speak</button><button className="btn btn-secondary" onClick={cancelSpeech}>Stop</button></div></div>;
}
