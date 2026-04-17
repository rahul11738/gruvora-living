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
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,_rgba(16,185,129,0.22),_transparent_34%),radial-gradient(circle_at_80%_80%,_rgba(6,182,212,0.16),_transparent_38%),linear-gradient(180deg,_#020617_0%,_#0b1120_58%,_#020617_100%)]" />
                    <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:34px_34px]" />
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.98, opacity: 0, y: 8 }}
                        transition={{ duration: 0.4, ease: 'easeOut' }}
                        className="relative z-10 flex w-full max-w-md flex-col items-center gap-5 px-6 text-center"
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
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                                Gruvora Living Platform
                            </div>
                            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-[2.25rem]">
                                Everything You Need
                                <span className="block text-emerald-200">In One Smart Platform</span>
                            </h1>
                            <p className="mx-auto max-w-sm text-sm leading-6 text-slate-300 sm:text-base">
                                Real estate discovery, business growth, stays, services, and reel-first engagement in one secure ecosystem.
                            </p>
                            <div className="grid w-full grid-cols-3 gap-2 text-left">
                                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Network</p>
                                    <p className="mt-1 text-xs font-semibold text-white">Homes + Services</p>
                                </div>
                                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Experience</p>
                                    <p className="mt-1 text-xs font-semibold text-white">Reel-first UX</p>
                                </div>
                                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Trust</p>
                                    <p className="mt-1 text-xs font-semibold text-white">Verified + Secure</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/45">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Launching your workspace
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}