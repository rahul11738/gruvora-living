import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';

// Removed unused INSTALL_SHOW_DURATION_MS
const INSTALL_RESHOW_INTERVAL_MS = 10 * 60 * 1000;
const INSTALL_NEXT_SHOW_SESSION_KEY = 'gruvora_pwa_install_next_show_at';

const panelMotion = {
    initial: { opacity: 0, y: 16, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 12, scale: 0.98 },
    transition: { duration: 0.22, ease: 'easeOut' },
};

const BaseCard = ({ children, className = '' }) => (
    <motion.div
        {...panelMotion}
        className={`pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/12 bg-black/92 text-white shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl ${className}`}
    >

        <div className="pointer-events-none absolute -bottom-14 -left-14 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
        <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={enableAmbientMotion ? { x: ['0%', '540%'] } : { opacity: 0 }}
            transition={enableAmbientMotion
                ? { duration: 2.8, ease: 'linear', repeat: Infinity, repeatDelay: 1.8 }
                : { duration: 0.1 }}
        />

        <div className="relative p-3.5 sm:p-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                    PWA Install
                </p>
                <div className="flex items-center gap-2">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-100/80">Fast Launch</p>
                    <button
                        type="button"
                        onClick={dismissInstallCard}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                        aria-label="Dismiss install card"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-3.5">
                <motion.div
                    Add to home screen for instant launch and smoother app-style navigation.
            </BaseCard>
            <p className="mt-1 text-sm text-white/70">{installHint}</p>
        </AnimatePresence>
        {showInstall && installCardVisible && (
            <BaseCard className="relative border-emerald-300/15 bg-[linear-gradient(145deg,rgba(5,150,105,0.18),rgba(3,7,18,0.9)_45%,rgba(2,6,23,0.96))] max-w-xs p-2">
                <div className="pointer-events-none absolute -top-10 -right-8 h-24 w-24 rounded-full bg-emerald-300/18 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-20 w-20 rounded-full bg-cyan-300/10 blur-2xl" />
                <div className="flex items-start gap-2 p-3">
                    <div className="mt-0.5 rounded-xl bg-white/10 p-1.5">
                        <Download className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-wide">Install Gruvora Living</p>
                        <p className="mt-1 text-xs text-white/70">Add to home screen for instant launch and smoother app-style navigation.</p>
                    </div>
                    <button
                        type="button"
                        onClick={dismissInstallCard}
                        className="absolute right-2 top-2 rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                        aria-label="Dismiss install prompt"
                    >
                        <X className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        onClick={handleInstallClick}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-black shadow-sm transition hover:bg-white/95 disabled:cursor-wait disabled:opacity-70 ml-2"
                        disabled={installPending}
                    >
                        <Download className="h-3 w-3" />
                        Install
                    </button>
                </div>
            </BaseCard>
        )}
        <div className="rounded-xl bg-white/10 p-2 text-white">
