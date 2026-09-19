import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Eye, Sparkles, Square, Type, Upload, Volume2 } from 'lucide-react';
import { describeImage } from '../lib/api';
import type { DescribeResult } from '../lib/api';
import { cancelSpeech, speakWithFallback } from '../lib/speak';

export default function ScreenReader() {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [cameraReady, setCameraReady] = useState(false);
  const [result, setResult] = useState<DescribeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); cancelSpeech(); }, []);

  const bindVideo = (element: HTMLVideoElement | null) => {
    previewRef.current = element;
    if (element && streamRef.current) { element.srcObject = streamRef.current; element.play().catch(() => undefined); }
  };

  const runDescribe = async (blob: Blob, filename: string) => {
    setLoading(true); setError('');
    try { const described = await describeImage(blob, filename); setResult(described); void speakWithFallback(described.full_description); }
    catch (err: unknown) { setError(axiosError(err) ?? 'Could not reach the backend. Is FastAPI running on port 8000?'); }
    finally { setLoading(false); }
  };
  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void runDescribe(file, file.name); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); event.currentTarget.classList.remove('dragging'); const file = event.dataTransfer.files?.[0]; if (file && file.type.startsWith('image/')) void runDescribe(file, file.name); else setError('Dropped file is not an image.'); };
  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); setMode('upload'); };
  const startCamera = async () => {
    setError(''); setCameraReady(false);
    const attempts: MediaStreamConstraints[] = [{ video: { facingMode: 'environment' }, audio: false }, { video: { width: { ideal: 1280 } }, audio: false }, { video: true, audio: false }];
    let stream: MediaStream | null = null;
    for (const constraints of attempts) { try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; } catch { stream = null; } }
    if (!stream) { setError('Camera blocked. Check Windows camera privacy, browser site permission, other apps using the camera, and any physical shutter key.'); return; }
    streamRef.current = stream; setMode('camera');
  };
  const capture = async () => {
    const video = previewRef.current;
    if (!video || video.videoWidth === 0) { setError('Camera still starting - wait one second and tap again.'); return; }
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d'); if (!context) { setError('Canvas unsupported in this browser.'); return; }
    context.drawImage(video, 0, 0); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) { setError('Failed to capture frame.'); return; } await runDescribe(blob, 'camera-frame.jpg');
  };

  return <motion.div className="feature-card-glass" role="tabpanel" id="panel-reader" aria-labelledby="tab-reader" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <div className="card-header"><div className="card-icon card-icon-reader"><Eye size={24} aria-hidden="true" /></div><div><h2>AI Screen Reader</h2><p className="card-subtitle">Point, capture, and listen. Scene descriptions and text extraction in 1.5s.</p></div></div>
    <div className="mode-toggle" role="group" aria-label="Screen reader input mode"><button className={mode === 'upload' ? 'active' : ''} onClick={() => { if (mode === 'camera') stopCamera(); }}><Upload size={16} aria-hidden="true" /> Upload</button><button className={mode === 'camera' ? 'active' : ''} onClick={() => { if (mode === 'upload') void startCamera(); }}><Camera size={16} aria-hidden="true" /> Live Camera</button></div>
    <AnimatePresence mode="wait">{mode === 'upload' ? <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="dropzone" onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add('dragging'); }} onDragLeave={(event) => event.currentTarget.classList.remove('dragging')} onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => event.key === 'Enter' && fileInputRef.current?.click()} role="button" tabIndex={0} aria-label="Upload an image to describe"><div className="dropzone-icon"><Upload size={32} aria-hidden="true" /></div><p className="dropzone-text">Drop an image here, or click to browse</p><input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} hidden /></motion.div> : <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="camera-box"><div className="camera-frame"><video ref={bindVideo} autoPlay playsInline muted onLoadedMetadata={() => setCameraReady(true)} aria-label="Live camera preview" /><div className="camera-crosshair" aria-hidden="true" /></div><button className="btn-auth-primary" onClick={() => void capture()} disabled={loading || !cameraReady}>{loading ? 'Analyzing...' : cameraReady ? 'Capture and Describe' : 'Starting camera...'}</button></motion.div>}</AnimatePresence>
    {loading && !result && <div className="loading-state" role="status"><div className="loading-spinner" /><span>analyzing scene...</span></div>}{error && <div className="auth-error" role="alert">{error}</div>}
    <AnimatePresence>{result && <motion.div className="result-card" aria-live="polite" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><div className="result-section"><div className="result-label"><Sparkles size={14} aria-hidden="true" /> Scene Description</div><p className="result-text">{result.caption}</p></div><div className="result-divider" /><div className="result-section"><div className="result-label"><Type size={14} aria-hidden="true" /> Extracted Text</div><p className="result-text text-slate-300">{result.extracted_text}</p></div><div className="result-meta"><span>{result.elapsed_s}s</span><span>·</span><span>{result.cached ? 'cached' : 'fresh'}</span></div><div className="result-actions"><button className="btn-action" onClick={() => void speakWithFallback(result.full_description)}><Volume2 size={16} aria-hidden="true" /> Read Aloud</button><button className="btn-action secondary" onClick={cancelSpeech}><Square size={16} aria-hidden="true" /> Stop</button></div></motion.div>}</AnimatePresence>
  </motion.div>;
}
function axiosError(err: unknown): string | null { if (typeof err === 'object' && err !== null && 'response' in err) { const response = (err as { response?: { data?: { error?: string } } }).response; if (response?.data?.error) return response.data.error; } return null; }
