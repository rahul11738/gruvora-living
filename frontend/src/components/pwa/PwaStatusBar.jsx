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
        {children}
    </motion.div>
);

export default function PwaStatusBar({
    isInstallable,
    isInstalled,
    onInstall,
    installPending,
    updateAvailable,
    onApplyUpdate,
    onDismissUpdate,
    isOffline,
    installHint = '',
}) {
    const prefersReducedMotion = useReducedMotion();
    const [isLowPowerMode, setIsLowPowerMode] = useState(false);
    const [installCardVisible, setInstallCardVisible] = useState(false);
    const [nextInstallShowAt, setNextInstallShowAt] = useState(0);

    const scheduleInstallReshow = () => {
        const nextAt = Date.now() + INSTALL_RESHOW_INTERVAL_MS;
        setNextInstallShowAt(nextAt);
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(INSTALL_NEXT_SHOW_SESSION_KEY, String(nextAt));
        }
    };

    useEffect(() => {
        if (typeof navigator === 'undefined') {
            return undefined;
        }

        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        const computeLowPowerMode = () => {
            const saveData = Boolean(connection?.saveData);
            const networkType = String(connection?.effectiveType || '').toLowerCase();
            const isSlowNetwork = networkType.includes('2g') || networkType.includes('3g');
            const lowDeviceMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;

            setIsLowPowerMode(saveData || isSlowNetwork || lowDeviceMemory);
        };

        computeLowPowerMode();

        connection?.addEventListener?.('change', computeLowPowerMode);
        return () => {
            connection?.removeEventListener?.('change', computeLowPowerMode);
        };
    }, []);

    const enableAmbientMotion = useMemo(
        () => !prefersReducedMotion && !isLowPowerMode,
        [isLowPowerMode, prefersReducedMotion],
    );

    const showInstall = isInstallable && !isInstalled;
    const showHint = Boolean(installHint) && !isInstallable && !isInstalled;

    useEffect(() => {
        if (!showInstall) {
            setInstallCardVisible(false);
            return;
        }

        if (typeof window === 'undefined') {
            setInstallCardVisible(true);
            return;
        }

        const storedNextAtRaw = window.sessionStorage.getItem(INSTALL_NEXT_SHOW_SESSION_KEY);
        const storedNextAt = Number(storedNextAtRaw || 0);
        const now = Date.now();

        if (Number.isFinite(storedNextAt) && storedNextAt > now) {
            setNextInstallShowAt(storedNextAt);
            setInstallCardVisible(false);
            return;
        }

        setNextInstallShowAt(0);
        setInstallCardVisible(true);
    }, [showInstall]);

    useEffect(() => {
        if (!showInstall || installCardVisible) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            if (nextInstallShowAt > 0 && Date.now() >= nextInstallShowAt) {
                setInstallCardVisible(true);
                setNextInstallShowAt(0);
            }
        }, 15000);

        return () => window.clearInterval(intervalId);
    }, [installCardVisible, nextInstallShowAt, showInstall]);

    // Remove auto-dismiss timer for install prompt. Only dismiss on user action.

    const dismissInstallCard = () => {
        setInstallCardVisible(false);
        scheduleInstallReshow();
    };

    const handleInstallClick = () => {
        onInstall?.();
        setInstallCardVisible(false);
        scheduleInstallReshow();
    };

    return (
        <AnimatePresence>
            {(showInstall || showHint || updateAvailable || isOffline) && (
                <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto flex max-w-xl flex-col gap-3 sm:left-auto sm:right-4 sm:w-[420px]">
                    {isOffline && (
                        <BaseCard>
                            <div className="flex items-start gap-3 p-4">
                                <div className="mt-0.5 rounded-xl bg-white/10 p-2">
                                    <WifiOff className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-wide">Offline mode</p>
                                    <p className="mt-1 text-sm text-white/70">Cached pages remain available. Reconnect to refresh reels, profiles, and admin data.</p>
                                </div>
                            </div>
                        </BaseCard>
                    )}

                    {updateAvailable && (
                        <BaseCard>
                            <div className="flex items-center gap-3 p-4">
                                <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300">
                                    <RefreshCw className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-wide">New update available</p>
                                    <p className="mt-1 text-sm text-white/70">Refresh now to load the latest PWA shell and cached assets.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={onDismissUpdate}
                                        className="rounded-full px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
                                    >
                                        Later
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onApplyUpdate}
                                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/95 disabled:cursor-wait disabled:opacity-70"
                                        disabled={!onApplyUpdate}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Update
                                    </button>
                                </div>
                            </div>
                        </BaseCard>
                    )}

                    {showInstall && installCardVisible && (
                        <BaseCard className="relative border-emerald-300/20 bg-gradient-to-br from-[#101828] via-[#0b1120] to-[#101828] shadow-2xl">
                            <div className="pointer-events-none absolute -top-16 -right-12 h-36 w-36 rounded-full bg-emerald-300/18 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-14 -left-14 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
                            <motion.div
                                aria-hidden="true"
                                className="pointer-events-none absolute -left-24 top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                animate={enableAmbientMotion ? { x: ['0%', '540%'] } : { opacity: 0 }}
                                transition={enableAmbientMotion
                                    ? { duration: 2.8, ease: 'linear', repeat: Infinity, repeatDelay: 1.8 }
                                    : { duration: 0.1 }}
                            />

                            <div className="relative p-5 sm:p-6">
                                <button
                                    type="button"
                                    onClick={dismissInstallCard}
                                    className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                                    aria-label="Dismiss install card"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                                    <motion.div
                                        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
                                        animate={enableAmbientMotion ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                                        transition={enableAmbientMotion
                                            ? { duration: 2.2, ease: 'easeInOut', repeat: Infinity }
                                            : { duration: 0.1 }}
                                    >
                                        <Download className="h-5 w-5" />
                                    </motion.div>
                                    <div className="min-w-0 flex-1 text-center sm:text-left">
                                        <p className="text-base font-extrabold tracking-tight text-white">Install Gruvora Living</p>
                                        <p className="mt-1 text-sm leading-relaxed text-white/80">
                                            Add to home screen for instant launch and smoother app-style navigation.
                                        </p>
                                    </div>
                                    <motion.button
                                        type="button"
                                        onClick={handleInstallClick}
                                        disabled={installPending || !onInstall}
                                        className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 px-6 py-2 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                                        whileTap={{ scale: 0.96 }}
                                        animate={installPending && enableAmbientMotion ? { opacity: [0.7, 1, 0.7] } : undefined}
                                        transition={installPending && enableAmbientMotion ? { duration: 1.1, repeat: Infinity } : undefined}
                                    >
                                        <Download className="h-5 w-5" />
                                        {installPending ? 'Opening' : 'Install'}
                                    </motion.button>
                                </div>
                            </div>
                        </BaseCard>
                    )}

                    {showHint && (
                        <BaseCard>
                            <div className="flex items-start gap-3 p-4">
                                <div className="rounded-xl bg-white/10 p-2 text-white">
                                    <Download className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-wide">Install available from browser menu</p>
                                    <p className="mt-1 text-sm text-white/70">{installHint}</p>
                                </div>
                            </div>
                        </BaseCard>
                    )}
                </div>
            )}
        </AnimatePresence>
    );
}
