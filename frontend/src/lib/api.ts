import axios from 'axios';

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const http = axios.create({ baseURL: API_BASE, timeout: 120000 });

export interface DescribeResult { caption: string; extracted_text: string; full_description: string; cached: boolean; elapsed_s: number; inference_s?: number; }
export interface TranscribeResult { transcription: string; language: string; }
export interface SignPhrasePayload { phrase_id: string; text: string; gloss: string[]; clip: string; }
export interface SignResult { transcript: string; phrase: SignPhrasePayload | null; match_score: number; }
export interface Metrics { rss_mb: number; uptime_s: number; requests_served: number; cache_entries: number; device: string; whisper_model: string; }

export async function describeImage(blob: Blob, filename: string): Promise<DescribeResult> {
  const form = new FormData(); form.append('file', blob, filename);
  const { data } = await http.post<DescribeResult>('/describe-image', form); return data;
}
export async function speechToText(blob: Blob): Promise<TranscribeResult> {
  const form = new FormData(); form.append('file', blob, 'chunk.webm');
  const { data } = await http.post<TranscribeResult>('/speech-to-text', form); return data;
}
export async function speechToSign(blob: Blob): Promise<SignResult> {
  const form = new FormData(); form.append('file', blob, 'chunk.webm');
  const { data } = await http.post<SignResult>('/speech-to-sign', form); return data;
}
export async function textToSpeechAudio(text: string, voice?: string, rate?: string): Promise<Blob> {
  const form = new FormData(); form.append('text', text);
  if (voice) form.append('voice', voice);
  if (rate) form.append('rate', rate);
  const { data } = await http.post<Blob>('/text-to-speech', form, { responseType: 'blob' }); return data;
}
export async function fetchMetrics(): Promise<Metrics> {
  const { data } = await http.get<Metrics>('/metrics'); return data;
}
