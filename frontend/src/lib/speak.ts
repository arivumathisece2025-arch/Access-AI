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
export async function speakWithFallback(text: string, voice?: string, rate?: string): Promise<void> {
  cancelSpeech();
  try {
    const blob = await textToSpeechAudio(text, voice, rate); const url = URL.createObjectURL(blob);
    serverAudio = new Audio(url);
    serverAudio.onended = () => { URL.revokeObjectURL(url); serverAudio = null; };
    await serverAudio.play(); return;
  } catch { /* Browser speech is the offline fallback. */ }
  if (!('speechSynthesis' in window)) return;
  for (const chunk of chunkText(text)) {
    const utterance = new SpeechSynthesisUtterance(chunk); const voice = pickVoice();
    if (voice) utterance.voice = voice; utterance.rate = 0.95; window.speechSynthesis.speak(utterance);
  }
}
