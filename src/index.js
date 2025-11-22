import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // ⚠️ 關鍵！這行就是讓 Tailwind CSS 生效的連結
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);