import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error';
interface Toast { id: number; type: ToastType; message: string; }
const ToastCtx = createContext<(type: ToastType, message: string) => void>(() => undefined);
export function useToast() { return useContext(ToastCtx); }
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random(); setToasts((items) => [...items, { id, type, message }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
  }, []);
  const value = useMemo(() => push, [push]);
  return <ToastCtx.Provider value={value}>{children}<div className="toast-viewport" role="status" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.type}`}>{toast.message}</div>)}</div></ToastCtx.Provider>;
}
