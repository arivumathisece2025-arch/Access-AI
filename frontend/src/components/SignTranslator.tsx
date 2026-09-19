import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Mic, MicOff, Radio } from 'lucide-react';
import { speechToSign } from '../lib/api';
import type { SignPhrasePayload } from '../lib/api';

const CHUNK_MS = 4000;
const PHRASES = [
  'I need help', 'I need water', 'Where is the hospital', 'My name is',
  'Thank you', 'I am sorry', 'Yes', 'No', 'I have pain here',
  'I need medicine', 'Call my family', 'I do not understand',
];

function pickMimeType(): string {
  for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export default function SignTranslator() {
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [current, setCurrent] = useState<SignPhrasePayload | null>(null);
  const [missed, setMissed] = useState('');
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const queueRef = useRef<SignPhrasePayload[]>([]);
  const playingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => () => { recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [listening]);

  const playNext = () => {
    const n = queueRef.current.shift();
    if (!n) { playingRef.current = false; setCurrent(null); return; }
    playingRef.current = true; setCurrent(n);
  };

  useEffect(() => {
    if (!current || !videoRef.current) return;
    videoRef.current.src = current.clip;
    videoRef.current.play().catch(() => setError('Sign clip not found - record the 12 clips into frontend/public/signs/.'));
  }, [current]);

  const sendChunk = async (blob: Blob) => {
    try {
      const r = await speechToSign(blob);
      if (r.transcript) { setTranscript((p) => (p ? `${p} ${r.transcript}` : r.transcript)); setMissed(''); }
      if (r.phrase) { queueRef.current.push(r.phrase); if (!playingRef.current) playNext(); }
      else if (r.transcript) setMissed(`No sign phrase matched "${r.transcript}" (score ${r.match_score}).`);
    } catch { setError('Backend unreachable - is FastAPI running on port 8000?'); }
  };

  const start = async () => {
    setError(''); setTranscript(''); setMissed(''); setSeconds(0); queueRef.current = [];
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = pickMimeType();
      const rec = m ? new MediaRecorder(s, { mimeType: m }) : new MediaRecorder(s);
      rec.ondataavailable = (e) => { if (e.data.size > 0) void sendChunk(e.data); };
      rec.start(CHUNK_MS);
      recorderRef.current = rec;
      setListening(true);
    } catch { setError('Microphone permission denied.'); }
  };

  const stop = () => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    setListening(false);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <motion.section className="ws ws-sign" role="tabpanel" id="panel-sign" aria-labelledby="tab-sign"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="ws-head">
        <span className="ws-icon tone-teal"><Hand size={20} aria-hidden="true" /></span>
        <div>
          <h2>Speech to Sign</h2>
          <p className="ws-sub">Broadcast stage — speak a critical phrase, watch it signed in ISL.</p>
        </div>
        <span className={`state-pill ${listening ? 'busy' : 'idle'}`}>
          {listening ? <><i className="rec-dot" />rec {mm}:{ss}</> : 'standby'}
        </span>
      </div>

      <div className="phrase-rail" aria-label="Supported phrases">
        {PHRASES.map((p) => <span key={p} className="pchip">{p}</span>)}
      </div>

      <div className="mic-deck">
        <button className={listening ? 'mic-orb on' : 'mic-orb'} onClick={() => (listening ? stop() : void start())}
          aria-label={listening ? 'Stop listening' : 'Start listening'}>
          <span className="ring r1" /><span className="ring r2" />
          <span className="orb-core">{listening ? <MicOff size={22} aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}</span>
        </button>
        <p className="mono-meta mic-hint">{listening ? 'listening — speak clearly' : 'tap the mic to go on air'}</p>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}

      <AnimatePresence>
        {transcript && (
          <motion.div className="lower-third" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="lt-tag"><Radio size={12} aria-hidden="true" /> live captions</span>
            <p className="lt-text" aria-live="polite">{transcript}</p>
            {missed && <p className="mono-meta lt-miss">{missed}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {current && (
          <motion.div className="stage" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
            <video ref={videoRef} className="stage-video" playsInline onEnded={playNext} aria-label="Sign language interpretation" />
            <div className="gloss-row">
              <span className="mono-meta gloss-tag">ISL gloss</span>
              {current.gloss.map((g, i) => <span key={`${g}-${i}`} className="gchip">{g}</span>)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
