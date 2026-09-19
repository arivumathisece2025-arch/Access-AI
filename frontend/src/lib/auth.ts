import axios from 'axios';

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const http = axios.create({ baseURL: API_BASE, timeout: 10000 });

export interface User {
  id: number | null;
  email: string;
  display_name: string;
  guest: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

const TOKEN_KEY = 'access_ai_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function register(email: string, display_name: string, password: string): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/register', { email, display_name, password });
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function guest(): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/guest');
  return data;
}

export async function getMe(token: string): Promise<User> {
  const { data } = await http.get<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
