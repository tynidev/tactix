import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Filter out YouTube analytics errors in development
if (import.meta.env.DEV)
{
  const originalError = console.error;
  console.error = (...args) =>
  {
    const message = args[0]?.toString() || '';
    // Filter out YouTube analytics blocked requests
    if (
      message.includes('net::ERR_BLOCKED_BY_CLIENT') &&
      (message.includes('youtube.com/api/stats') ||
        message.includes('youtubei/v1/log_event'))
    )
    {
      return; // Suppress these specific errors
    }
    originalError.apply(console, args);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
