import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <UnsavedChangesProvider>
        <App />
      </UnsavedChangesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
