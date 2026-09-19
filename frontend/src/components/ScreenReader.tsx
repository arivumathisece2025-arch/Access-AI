import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { describeImage } from '../lib/api';
import type { DescribeResult } from '../lib/api';
import { cancelSpeech, speakWithFallback } from '../lib/speak';

export default function ScreenReader() {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload');
  const [result, setResult] = useState<DescribeResult | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null); const previewRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); cancelSpeech(); }, []);
  useEffect(() => { if (mode === 'camera' && previewRef.current && streamRef.current) previewRef.current.srcObject = streamRef.current; }, [mode]);
  const runDescribe = async (blob: Blob, filename: string) => {
    setLoading(true); setError('');
    try { const described = await describeImage(blob, filename); setResult(described); void speakWithFallback(described.full_description); }
    catch (err: unknown) { setError(axiosError(err) ?? 'Could not reach the backend. Is FastAPI running on port 8000?'); }
    finally { setLoading(false); }
  };
  const onFilePicked = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) void runDescribe(file, file.name); };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file && file.type.startsWith('image/')) void runDescribe(file, file.name); else setError('Dropped file is not an image.'); };
  const startCamera = async () => { setError(''); try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); streamRef.current = stream; setMode('camera'); } catch { setError('Camera unavailable or permission denied.'); } };
  const stopCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setMode('upload'); };
  const capture = async () => {
    const video = previewRef.current; if (!video || video.videoWidth === 0) { setError('Camera not ready yet - wait a second and try again.'); return; }
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) { setError('Canvas unsupported in this browser.'); return; }
    ctx.drawImage(video, 0, 0); const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) { setError('Failed to capture frame.'); return; } await runDescribe(blob, 'camera-frame.jpg');
  };
  return <div className="feature-card" role="tabpanel" id="panel-reader" aria-labelledby="tab-reader">
    <h2>AI Screen Reader</h2><p>Upload an image or use the live camera. The scene is described and printed text is read aloud.</p>
    <div className="btn-row">{mode === 'upload' ? <button className="btn" onClick={() => void startCamera()}>Use live camera</button> : <button className="btn btn-secondary" onClick={stopCamera}>Back to upload</button>}</div>
    {mode === 'upload' ? <div className="dropzone" onDrop={onDrop} onDragOver={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()} role="button" tabIndex={0} aria-label="Upload an image to describe"><p>Drop an image here, or click / press Enter to browse</p><input ref={fileInputRef} type="file" accept="image/*" onChange={onFilePicked} hidden /></div> : <div className="camera-box"><video ref={previewRef} autoPlay playsInline muted aria-label="Live camera preview" /><button className="btn" onClick={() => void capture()} disabled={loading}>Capture and describe</button></div>}
    {loading && <p className="status" role="status">Describing scene and reading text...</p>}{error && <div className="error" role="alert">{error}</div>}
    {result && <div className="result" aria-live="polite"><h3>Description</h3><p>{result.caption}</p><h3>Extracted text</h3><p>{result.extracted_text}</p><p className="meta">{result.elapsed_s}s · {result.cached ? 'cached' : 'fresh'}</p><div className="btn-row"><button className="btn btn-secondary" onClick={() => void speakWithFallback(result.full_description)}>Read aloud</button><button className="btn btn-secondary" onClick={cancelSpeech}>Stop</button></div></div>}
  </div>;
}
function axiosError(err: unknown): string | null { if (typeof err === 'object' && err !== null && 'response' in err) { const response = (err as { response?: { data?: { error?: string } } }).response; if (response?.data?.error) return response.data.error; } return null; }
