import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Eye, Sparkles, Square, Type, Upload, Volume2 } from 'lucide-react';
import { describeImage } from '../lib/api';
import type { DescribeResult } from '../lib/api';
import { cancelSpeech, speakWithFallback } from '../lib/speak';

export default function ScreenReader() {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [result, setResult] = useState<DescribeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); cancelSpeech(); }, []);
  useEffect(() => { if (mode === 'camera' && previewRef.current && streamRef.current) previewRef.current.srcObject = streamRef.current; }, [mode]);

  const runDescribe = async (blob: Blob, filename: string) => {
    setLoading(true); setError('');
    try { const described = await describeImage(blob, filename); setResult(described); void speakWithFallback(described.full_description); }
    catch (err: unknown) { setError(axiosError(err) ?? 'Could not reach the backend.'); }
    finally { setLoading(false); }
  };
  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void runDescribe(file, file.name); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); event.currentTarget.classList.remove('dragging'); const file = event.dataTransfer.files?.[0]; if (file && file.type.startsWith('image/')) void runDescribe(file, file.name); else setError('Dropped file is not an image.'); };
  const startCamera = async () => { setError(''); try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); streamRef.current = stream; setMode('camera'); } catch { setError('Camera unavailable or permission denied.'); } };
  const stopCamera = () => { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setMode('upload'); };
  const capture = async () => { const video = previewRef.current; if (!video || video.videoWidth === 0) { setError('Camera not ready.'); return; } const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight; const context = canvas.getContext('2d'); if (!context) return; context.drawImage(video, 0, 0); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9)); if (blob) await runDescribe(blob, 'frame.jpg'); };

  return <motion.div className="feature-card-glass" role="tabpanel" id="panel-reader" aria-labelledby="tab-reader" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
    <div className="card-header"><div className="card-icon card-icon-reader"><Eye size={24} aria-hidden="true" /></div><div><h2>AI Screen Reader</h2><p className="card-subtitle">Point, capture, and listen. Scene descriptions and text extraction in 1.5s.</p></div></div>
    <div className="mode-toggle" role="group" aria-label="Screen reader input mode"><button className={mode === 'upload' ? 'active' : ''} onClick={() => { if (mode === 'camera') stopCamera(); }}><Upload size={16} aria-hidden="true" /> Upload</button><button className={mode === 'camera' ? 'active' : ''} onClick={() => { if (mode === 'upload') void startCamera(); }}><Camera size={16} aria-hidden="true" /> Live Camera</button></div>
    <AnimatePresence mode="wait">{mode === 'upload' ? <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="dropzone" onDrop={onDrop} onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add('dragging'); }} onDragLeave={(event) => event.currentTarget.classList.remove('dragging')} onClick={() => fileInputRef.current?.click()} onKeyDown={(event) => event.key === 'Enter' && fileInputRef.current?.click()} role="button" tabIndex={0} aria-label="Upload an image to describe"><div className="dropzone-icon"><Upload size={32} aria-hidden="true" /></div><p className="dropzone-text">Drop an image here, or click to browse</p><input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} hidden /></motion.div> : <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="camera-box"><div className="camera-frame"><video ref={previewRef} autoPlay playsInline muted aria-label="Live camera preview" /><div className="camera-crosshair" aria-hidden="true" /></div><button className="btn-auth-primary" onClick={() => void capture()} disabled={loading}>{loading ? 'Analyzing...' : 'Capture and Describe'}</button></motion.div>}</AnimatePresence>
    {loading && !result && <div className="loading-state" role="status"><div className="loading-spinner" /><span>Analyzing scene...</span></div>}{error && <div className="auth-error" role="alert">{error}</div>}
    <AnimatePresence>{result && <motion.div className="result-card" aria-live="polite" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><div className="result-section"><div className="result-label"><Sparkles size={14} aria-hidden="true" /> Scene Description</div><p className="result-text">{result.caption}</p></div><div className="result-divider" /><div className="result-section"><div className="result-label"><Type size={14} aria-hidden="true" /> Extracted Text</div><p className="result-text">{result.extracted_text}</p></div><div className="result-meta"><span>{result.elapsed_s}s</span><span>·</span><span>{result.cached ? 'Cached' : 'Fresh'}</span></div><div className="result-actions"><button className="btn-action" onClick={() => void speakWithFallback(result.full_description)}><Volume2 size={16} aria-hidden="true" /> Read Aloud</button><button className="btn-action secondary" onClick={cancelSpeech}><Square size={16} aria-hidden="true" /> Stop</button></div></motion.div>}</AnimatePresence>
  </motion.div>;
}
function axiosError(err: unknown): string | null { if (typeof err === 'object' && err !== null && 'response' in err) { const response = (err as { response?: { data?: { error?: string } } }).response; if (response?.data?.error) return response.data.error; } return null; }
