import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ComparativoPage from './ComparativoPage.tsx';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ComparativoPage />
  </StrictMode>,
);
