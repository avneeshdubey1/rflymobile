import { useEffect, useState, useCallback } from 'react';
import { CheckmarkCircle01Icon, CancelCircleIcon, Alert01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../Icon';

type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: string; message: string; type: ToastType; }

let addToastGlobal: ((message: string, type: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'success') {
  addToastGlobal?.(message, type);
}

const icons = { success: CheckmarkCircle01Icon, error: CancelCircleIcon, info: Alert01Icon };
const colors = { success: 'bg-green-500 text-white', error: 'bg-red-500 text-white', info: 'bg-blue-500 text-white' };

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((message: string, type: ToastType) => {
    const id = crypto.randomUUID();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => { addToastGlobal = add; return () => { addToastGlobal = null; }; }, [add]);

  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id} className={`animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${colors[t.type]}`}>
          <Icon icon={icons[t.type]} size={18} /> {t.message}
        </div>
      ))}
    </div>
  );
}
