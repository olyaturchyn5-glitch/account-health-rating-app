// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Створюємо root елемент для React 18
const root = ReactDOM.createRoot(document.getElementById('root'));

// Рендеримо додаток
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);