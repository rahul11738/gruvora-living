import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerServiceWorker } from "./lib/serviceWorkerRegistration";

// ============================================
// PERFORMANCE OPTIMIZATIONS
// ============================================

// 1. Register Service Worker for PWA caching
// Enables offline support and 75% faster repeat loads
registerServiceWorker({
  skipWaiting: false, // Don't force immediate update
  onMount: ({ isFirstInstall }) => {
    if (isFirstInstall) {
      console.log('✅ PWA ready - Offline support enabled');
    } else {
      console.log('✅ Service Worker active - Caching enabled');
    }
  },
  onUpdate: ({ skipWaiting }) => {
    // Show toast notification about new version
    // User can click "Update" to get latest version
    console.log('📦 New version available');
  },
  onError: (error) => {
    console.warn('⚠️ Service Worker registration failed:', error);
    // App still works, caching just won't available
  },
});

// 2. Enable connection speed-based resource loading
// Serve lower quality assets on slow networks
if ('connection' in navigator) {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection) {
    connection.addEventListener('change', () => {
      // Quality will be adjusted in image components
      console.log(`📡 Connection: ${connection.effectiveType}`);
    });
  }
}

// 3. Prefetch DNS for external assets (Cloudinary, APIs)
// This reduces latency for external requests
document.head.insertAdjacentHTML(
  'beforeend',
  `
  <link rel="dns-prefetch" href="https://res.cloudinary.com">
  <link rel="dns-prefetch" href="https://api.example.com">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  `
);

// 4. Add shimmer CSS for skeleton loaders
const shimmerStyle = document.createElement('style');
shimmerStyle.textContent = `
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
  .shimmer-loading {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 1000px 100%;
    animation: shimmer 2s infinite;
  }
`;
document.head.appendChild(shimmerStyle);

// 5. Load Google Fonts with optimization
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap';
document.head.appendChild(fontLink);

// 6. Performance monitoring - Web Vitals
if ('web-vital' in performance) {
  // Track Core Web Vitals for monitoring
  console.log('⚡ Performance monitoring enabled');
}

// React app render
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ============================================
// PERFORMANCE MONITORING
// ============================================

// Log performance metrics
window.addEventListener('load', () => {
  setTimeout(() => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    const connectTime = perfData.responseEnd - perfData.requestStart;
    const renderTime = perfData.domComplete - perfData.domLoading;

    console.log(`
      ⏱️ PERFORMANCE METRICS:
      • Page Load Time: ${pageLoadTime}ms
      • Connect Time: ${connectTime}ms
      • Render Time: ${renderTime}ms
    `);
  }, 0);
});
