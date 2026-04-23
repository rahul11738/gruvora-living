import React from 'react';

/**
 * FIXED: Transparent passthrough - removes nested Helmet causing crash
 * Structure now: HelmetProvider (index.js) → HelmetManager (empty) → SeoHead (single Helmet)
 */
const HelmetManager = ({ children }) => children;

export default HelmetManager;

