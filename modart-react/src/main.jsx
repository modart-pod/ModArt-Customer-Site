import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Import all existing CSS from ModArt
import '../src/styles/style.css';
import '../src/styles/layout.css';
import '../src/styles/components.css';
import '../src/styles/responsive.css';
import '../src/styles/fixes.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
