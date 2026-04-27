import { useState, useEffect } from 'react';

let toastCallback: ((message: string, type: 'success' | 'error') => void) | null = null;

export function setToastHandler(fn: (message: string, type: 'success' | 'error') => void) {
  toastCallback = fn;
}

export function showToast(message: string, type: 'success' | 'error') {
  if (toastCallback) {
    toastCallback(message, type);
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{id: number, message: string, type: 'success' | 'error'}>>([]);
  const [removing, setRemoving] = useState<Set<number>>(new Set());

  useEffect(() => {
    setToastHandler((message, type) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      
      setTimeout(() => {
        setRemoving(prev => new Set(prev).add(id));
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
          setRemoving(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }, 300);
      }, 3000);
    });

    return () => {
      setToastHandler(null as any);
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'} ${removing.has(toast.id) ? 'hiding' : ''}`}
        >
          {toast.type === 'success' ? (
            <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="toast-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="toast-message">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}