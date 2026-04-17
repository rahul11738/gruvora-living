import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * App-launch splash screen.
 *
 * This is a lightweight in-app splash that appears while the React shell is
 * mounting, which makes the PWA feel more native on mobile and during cold starts.
 */
export default function PwaSplashScreen({ visible = false }) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black text-white"
                    aria-label="Gruvora Living is starting"
                    role="status"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_35%),linear-gradient(180deg,_#000000_0%,_#0f172a_100%)]" />
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 8 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="relative z-10 flex flex-col items-center gap-5 px-6 text-center"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 rounded-[2rem] bg-emerald-400/25 blur-3xl" />
                            <div className="relative grid h-28 w-28 place-items-center rounded-[2rem] border border-white/15 bg-white/5 shadow-2xl backdrop-blur-md">
                                <svg viewBox="0 0 512 512" className="h-16 w-16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                    <rect width="512" height="512" rx="120" fill="#000000" />
                                    <path d="M166 145C166 129.536 178.536 117 194 117H323C338.464 117 351 129.536 351 145V367C351 382.464 338.464 395 323 395H194C178.536 395 166 382.464 166 367V145Z" stroke="#F8FAFC" strokeWidth="18" />
                                    <path d="M210 196L210 316L316 256L210 196Z" fill="#10B981" />
                                    <circle cx="282" cy="176" r="14" fill="#F8FAFC" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-lg font-semibold tracking-[0.28em] text-white/70 uppercase">Gruvora Living</p>
                            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Homes, reels, and profiles in one fast shell.</h1>
                            <p className="mx-auto max-w-md text-sm leading-6 text-white/70 sm:text-base">
                                Loading your installable experience with offline-ready assets and reel-first navigation.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-white/45">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Starting app
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}