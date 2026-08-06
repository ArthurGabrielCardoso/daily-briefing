import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Marks that scripting is live, so reveal animations may start from hidden.
document.documentElement.classList.add('js');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
