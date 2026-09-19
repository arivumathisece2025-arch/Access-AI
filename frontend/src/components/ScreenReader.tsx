import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Copy, Eye, ScanLine, Square, Upload, Volume2 } from 'lucide-react';
import { describeImage } from '../lib/api';
import type { DescribeResult } from '../lib/api';
import { cancelSpeech, speakWithFallback } from '../lib/speak';
import { useToast } from './Toasts';

export default function ScreenReader() {
  const toast = useToast();
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [cameraReady, setCameraReady] = useState(false);
  const [result, setResult] = useState<DescribeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); cancelSpeech(); }, []);

  // Callback ref binds the stream the instant <video> mounts (AnimatePresence delays mount).
  const bindVideo = (el: HTMLVideoElement | null) => {
    previewRef.current = el;
    if (el && streamRef.current) { el.srcObject = streamRef.current; el.play().catch(() => undefined); }
  };

  const runDescribe = async (blob: Blob, filename: string) => {
    setLoading(true); setError('');
    try {
      const d = await describeImage(blob, filename);
      setResult(d);
      void speakWithFallback(d.full_description);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(detail ?? 'Could not reach the backend. Is FastAPI running on port 8000?');
    } finally { setLoading(false); }
  };

  const onFilePicked = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void runDescribe(f, f.name); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.currentTarget.classList.remove('dragging');
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) void runDescribe(f, f.name);
    else setError('Dropped file is not an image.');
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; setCameraReady(false); setMode('upload');
  };

  const startCamera = async () => {
    setError(''); setCameraReady(false);
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: 'environment' }, audio: false },
      { video: { width: { ideal: 1280 } }, audio: false },
      { video: true, audio: false },
    ];
    let stream: MediaStream | null = null;
    for (const c of attempts) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch { stream = null; }
    }
    if (!stream) {
      setError('Camera blocked. Check: Windows Settings > Privacy & security > Camera > allow desktop apps; browser site permission; close Teams/Zoom; physical shutter key.');
      return;
    }
    streamRef.current = stream;
    setMode('camera');
  };

  const capture = async () => {
    const v = previewRef.current;
    if (!v || v.videoWidth === 0) { setError('Camera still starting - wait one second and tap again.'); return; }
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) { setError('Canvas unsupported in this browser.'); return; }
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) { setError('Failed to capture frame.'); return; }
    await runDescribe(blob, 'camera-frame.jpg');
  };

  const copyReport = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(`${result.caption}\n\n${result.extracted_text}`);
    toast('success', 'Description copied to clipboard');
  };

  return (
    <motion.section className="ws ws-reader" role="tabpanel" id="panel-reader" aria-labelledby="tab-reader"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <div className="ws-head">
        <span className="ws-icon tone-indigo"><Eye size={20} aria-hidden="true" /></span>
        <div>
          <h2>Screen Reader</h2>
          <p className="ws-sub">Scanner studio — point, capture, listen. Vision + OCR in one pass.</p>
        </div>
        <span className={`state-pill ${loading ? 'busy' : 'idle'}`}>{loading ? 'scanning' : 'ready'}</span>
      </div>

      <div className="seg reader-seg" role="group" aria-label="Input source">
        <button className={mode === 'upload' ? 'seg-btn active' : 'seg-btn'} onClick={() => { if (mode === 'camera') stopCamera(); }}>
          <Upload size={14} aria-hidden="true" /> Upload image
        </button>
        <button className={mode === 'camera' ? 'seg-btn active' : 'seg-btn'} onClick={() => { if (mode === 'upload') void startCamera(); }}>
          <Camera size={14} aria-hidden="true" /> Live camera
        </button>
      </div>

      <div className="viewfinder">
        <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
        {loading && <span className="scanline" aria-hidden="true" />}
        <AnimatePresence mode="wait">
          {mode === 'upload' ? (
            <motion.div key="upload" className="scanbed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragging'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('dragging')}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              role="button" tabIndex={0} aria-label="Upload an image to describe">
              <ScanLine size={30} aria-hidden="true" />
              <p>Drop an image here, or click to browse</p>
              <span className="mono-meta">JPG · PNG · WEBP — processed on-device</span>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} hidden />
            </motion.div>
          ) : (
            <motion.div key="camera" className="camwrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <video ref={bindVideo} autoPlay playsInline muted onLoadedMetadata={() => setCameraReady(true)} aria-label="Live camera preview" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {mode === 'camera' && (
        <div className="reader-actions">
          <button className="btn-primary" onClick={() => void capture()} disabled={loading || !cameraReady}>
            <Camera size={15} aria-hidden="true" /> {cameraReady ? 'Capture and describe' : 'Starting camera…'}
          </button>
          <button className="btn-ghost" onClick={stopCamera}>Close camera</button>
        </div>
      )}

      {error && <div className="error-box" role="alert">{error}</div>}

      <AnimatePresence>
        {result && (
          <motion.div className="report" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="report-head">
              <span className="stamp">analysis report</span>
              <span className="mono-meta">{result.elapsed_s}s total · {result.inference_s ?? '—'}s inference · {result.cached ? 'cached' : 'fresh'}</span>
            </div>
            <div className="report-grid">
              <div className="report-col">
                <p className="col-label">Scene</p>
                <p className="col-body">{result.caption}</p>
              </div>
              <div className="report-col">
                <p className="col-label">Extracted text</p>
                <p className="col-body mono-body">{result.extracted_text}</p>
              </div>
            </div>
            <div className="reader-actions">
              <button className="btn-primary" onClick={() => void speakWithFallback(result.full_description)}>
                <Volume2 size={15} aria-hidden="true" /> Read aloud
              </button>
              <button className="btn-ghost" onClick={() => void copyReport()}><Copy size={14} aria-hidden="true" /> Copy</button>
              <button className="btn-ghost danger" onClick={cancelSpeech}><Square size={14} aria-hidden="true" /> Stop</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
