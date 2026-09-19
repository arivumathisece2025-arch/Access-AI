import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Hand, Mic, MicOff, Type } from 'lucide-react';
import { speechToSign } from '../lib/api';
import type { SignPhrasePayload } from '../lib/api';

const CHUNK_MS = 4000;
const SUPPORTED_PHRASES = ['I need help', 'I need water', 'Where is the hospital', 'My name is', 'Thank you', 'I am sorry', 'Yes', 'No', 'I have pain here', 'I need medicine', 'Call my family', 'I do not understand'];
function pickMimeType(): string { for (const candidate of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) if (MediaRecorder.isTypeSupported(candidate)) return candidate; return ''; }

export default function SignTranslator() {
  const [listening, setListening] = useState(false); const [transcript, setTranscript] = useState(''); const [current, setCurrent] = useState<SignPhrasePayload | null>(null); const [missed, setMissed] = useState(''); const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null); const queueRef = useRef<SignPhrasePayload[]>([]); const playingRef = useRef(false); const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { recorderRef.current?.stream.getTracks().forEach((track) => track.stop()); }, []);
  const playNext = () => { const next = queueRef.current.shift(); if (!next) { playingRef.current = false; setCurrent(null); return; } playingRef.current = true; setCurrent(next); };
  useEffect(() => { if (!current || !videoRef.current) return; videoRef.current.src = current.clip; videoRef.current.play().catch(() => setError('Clip not found.')); }, [current]);
  const sendChunk = async (blob: Blob) => { try { const result = await speechToSign(blob); if (result.transcript) { setTranscript((previous) => previous ? `${previous} ${result.transcript}` : result.transcript); setMissed(''); } if (result.phrase) { queueRef.current.push(result.phrase); if (!playingRef.current) playNext(); } else if (result.transcript) setMissed(`No sign match for "${result.transcript}"`); } catch { setError('Backend unreachable.'); } };
  const start = async () => { setError(''); setTranscript(''); setMissed(''); queueRef.current = []; try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mimeType = pickMimeType(); const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream); recorder.ondataavailable = (event) => { if (event.data.size > 0) void sendChunk(event.data); }; recorder.start(CHUNK_MS); recorderRef.current = recorder; setListening(true); } catch { setError('Mic permission denied.'); } };
  const stop = () => { recorderRef.current?.stop(); recorderRef.current?.stream.getTracks().forEach((track) => track.stop()); recorderRef.current = null; setListening(false); };
  return <motion.div className="feature-card-glass" role="tabpanel" id="panel-sign" aria-labelledby="tab-sign" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <div className="card-header"><div className="card-icon card-icon-sign"><Hand size={24} aria-hidden="true" /></div><div><h2>Speech to Sign Language</h2><p className="card-subtitle">Real-time Indian Sign Language translation for critical phrases.</p></div></div>
    <div className="chips-container" aria-label="Supported phrases">{SUPPORTED_PHRASES.map((phrase) => <span key={phrase} className="glass-chip static">{phrase}</span>)}</div>
    <div className="mic-container"><button className={`mic-orb ${listening ? 'active' : ''}`} onClick={() => listening ? stop() : void start()} aria-label={listening ? 'Stop listening' : 'Start listening'}><div className="mic-orb-pulse" aria-hidden="true" /><div className="mic-orb-pulse delay-1" aria-hidden="true" /><div className="mic-orb-inner">{listening ? <MicOff size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}</div></button><p className="mic-status">{listening ? 'Listening...' : 'Tap to speak'}</p></div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <AnimatePresence>{transcript && <motion.div className="transcript-box" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}><div className="result-label"><Type size={14} aria-hidden="true" /> Heard</div><p className="result-text">{transcript}</p>{missed && <p className="text-xs text-amber-400 mt-2">{missed}</p>}</motion.div>}</AnimatePresence>
    <AnimatePresence>{current && <motion.div className="sign-player" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}><video ref={videoRef} className="sign-video" playsInline onEnded={playNext} aria-label="Sign language interpretation" /><div className="gloss-bar"><span className="gloss-label">ISL:</span>{current.gloss.map((word, index) => <span key={`${word}-${index}`} className="gloss-word">{word}</span>)}</div></motion.div>}</AnimatePresence>
  </motion.div>;
}
