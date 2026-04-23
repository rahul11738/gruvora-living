/**
 * HelmetManager - Clean ESLint-compliant passthrough
 * No React import (not used) - fixes Vercel no-unused-vars error
 * Transparent wrapper for SEO structure
 */
const HelmetManager = ({ children }) => children;

export default HelmetManager;

