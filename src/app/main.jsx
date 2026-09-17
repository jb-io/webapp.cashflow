import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import { StateProvider } from './state/StateProvider.jsx';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <StateProvider>
        <App />
      </StateProvider>
    </HashRouter>
  </StrictMode>,
);
