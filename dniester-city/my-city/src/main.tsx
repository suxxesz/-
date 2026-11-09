import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/cyrillic-400.css';
import '@fontsource/manrope/cyrillic-600.css';
import '@fontsource/manrope/cyrillic-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import './style.css';
import { CityProvider } from './store/CityProvider';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { applyTheme } from './lib/theme';
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
