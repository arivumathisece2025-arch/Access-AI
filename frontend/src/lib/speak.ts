import { textToSpeechAudio } from './api';

const MAX_CHUNK = 180;
let serverAudio: HTMLAudioElement | null = null;
let voiceCache: SpeechSynthesisVoice[] = [];
if ('speechSynthesis' in window) {
  voiceCache = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => { voiceCache = window.speechSynthesis.getVoices(); };
}
function pickVoice(): SpeechSynthesisVoice | null {
  for (const prefix of ['en-IN', 'en-GB', 'en-US']) {
    const voice = voiceCache.find((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase()));
    if (voice) return voice;
  }
  return voiceCache[0] ?? null;
}
function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const chunks: string[] = []; let current = '';
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > MAX_CHUNK) {
      if (current) { chunks.push(current.trim()); current = ''; }
      chunks.push(rest.slice(0, MAX_CHUNK).trim()); rest = rest.slice(MAX_CHUNK);
    }
    if ((current + rest).length > MAX_CHUNK && current) { chunks.push(current.trim()); current = rest; } else current += rest;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
export function cancelSpeech(): void {
  if (serverAudio) { serverAudio.pause(); serverAudio = null; }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
/* edge-tts wants "+25%"/"-25%"; the Audio Console sends multipliers (0.75, 1, 1.25, 1.5). */
export type SpeechRate = string | number;
function toServerRate(rate?: SpeechRate): string | undefined {
  if (rate === undefined) return undefined;
  if (typeof rate === 'string') return rate;
  if (!Number.isFinite(rate)) return undefined;
  /* Keep the result inside the backend contract: ^[+-]\d{1,2}%$ */
  const percent = Math.round((Math.min(2, Math.max(0.5, rate)) - 1) * 100);
  const bounded = Math.min(99, Math.max(-99, percent));
  return `${bounded >= 0 ? '+' : ''}${bounded}%`;
}
/* Device voices take the multiplier directly; legacy string callers keep the 0.95 cadence. */
function toDeviceRate(rate?: SpeechRate): number {
  return typeof rate === 'number' ? Math.min(2, Math.max(0.5, rate)) : 0.95;
}
export async function speakWithFallback(text: string, voice?: string, rate?: SpeechRate): Promise<void> {
  cancelSpeech();
  try {
    const blob = await textToSpeechAudio(text, voice, toServerRate(rate));
    const url = URL.createObjectURL(blob); const audio = new Audio(url); serverAudio = audio;
    /* Resolve only when playback really ends so callers can drive live state (VU bars, "on air"). */
    await new Promise<void>((resolve, reject) => {
      const settle = () => { URL.revokeObjectURL(url); if (serverAudio === audio) serverAudio = null; resolve(); };
      audio.onended = settle; audio.onerror = settle; audio.onpause = settle;
      audio.play().catch((error: unknown) => {
        URL.revokeObjectURL(url); if (serverAudio === audio) serverAudio = null; reject(error);
      });
    });
    return;
  } catch { /* Browser speech is the offline fallback. */ }
  if (!('speechSynthesis' in window)) return;
  for (const chunk of chunkText(text)) {
    const utterance = new SpeechSynthesisUtterance(chunk); const voice = pickVoice();
    if (voice) utterance.voice = voice; utterance.rate = toDeviceRate(rate); window.speechSynthesis.speak(utterance);
  }
  const startedAt = Date.now();
  await new Promise<void>((resolve) => {
    const id = window.setInterval(() => {
      const done = !window.speechSynthesis.speaking && !window.speechSynthesis.pending;
      if (done || Date.now() - startedAt > 120000) { window.clearInterval(id); resolve(); }
    }, 200);
  });
}
