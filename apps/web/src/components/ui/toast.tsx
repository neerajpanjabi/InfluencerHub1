'use client';
import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const Ctx = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-md items-center gap-2 rounded-md bg-navy-900 px-4 py-3 text-sm text-ivory shadow-lift">
            {t.tone === 'success' ? <CheckCircle2 className="h-4 w-4 text-gold-400" /> : <AlertCircle className="h-4 w-4 text-red-300" />}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
