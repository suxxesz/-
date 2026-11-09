import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@/app/styles/style.css';
import { CityProvider } from '@/entities/city/model/store';
import App from '@/app/App';
import ErrorBoundary from '@/shared/ui/ErrorBoundary';
import { applyTheme } from '@/shared/lib/theme';
applyTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CityProvider>
        <App />
      </CityProvider>
    </ErrorBoundary>
  </StrictMode>,
);
