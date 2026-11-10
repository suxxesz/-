import { StrictMode } from 'react';
import { MotionConfig } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/cyrillic-400.css';
import '@fontsource/inter/cyrillic-500.css';
import '@fontsource/inter/cyrillic-600.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/montserrat/cyrillic-700.css';
import '@fontsource/montserrat/cyrillic-800.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@/app/styles/style.css';
import '@/app/styles/dw.css';
import '@/app/styles/map.css';
import { CityProvider } from '@/entities/city/model/store';
import App from '@/app/App';
import ErrorBoundary from '@/shared/ui/ErrorBoundary';
import { applyTheme } from '@/shared/lib/theme';
applyTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
    <ErrorBoundary>
      <CityProvider>
        <App />
      </CityProvider>
    </ErrorBoundary>
    </MotionConfig>
  </StrictMode>,
);
