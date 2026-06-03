import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Block sandboxed-iframe or browser-extension issues with read-only window.fetch
if (typeof window !== 'undefined') {
  const originalOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msgStr = (message || '').toString();
    if (
      msgStr.includes('Cannot set property fetch') ||
      msgStr.includes('fetch of #<Window>') ||
      msgStr.includes('has only a getter')
    ) {
      console.warn('[WaveTune Safeguard] Blocked sandboxed-iframe or extension fetch-override error:', msgStr);
      return true; // Swallow and prevent the error from bubbling or crashing the preview
    }
    if (originalOnError) {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const reasonStr = reason && reason.message ? reason.message : String(reason || '');
    if (
      reasonStr.includes('Cannot set property fetch') ||
      reasonStr.includes('fetch of #<Window>') ||
      reasonStr.includes('has only a getter')
    ) {
      console.warn('[WaveTune Safeguard] Blocked sandboxed-iframe fetch promise rejection:', reasonStr);
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

