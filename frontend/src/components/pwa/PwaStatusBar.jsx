import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Download, RefreshCw, WifiOff } from 'lucide-react';

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

                    {showInstall && (
                        <BaseCard className="relative border-emerald-300/15 bg-[linear-gradient(145deg,rgba(5,150,105,0.18),rgba(3,7,18,0.88)_45%,rgba(2,6,23,0.95))]">
                            <div className="pointer-events-none absolute -top-16 -right-12 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-3xl" />
                            <motion.div
                                aria-hidden="true"
                                className="pointer-events-none absolute -left-24 top-0 h-full w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                animate={enableAmbientMotion ? { x: ['0%', '540%'] } : { opacity: 0 }}
                                transition={enableAmbientMotion
                                    ? { duration: 2.8, ease: 'linear', repeat: Infinity, repeatDelay: 1.8 }
                                    : { duration: 0.1 }}
                            />

                            <div className="relative p-4 sm:p-5">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
                                        PWA Install
                                    </p>
                                    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-100/80">Fast Launch</p>
                                </div>

                                <div className="flex items-center gap-3 sm:gap-4">
                                    <motion.div
                                        className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-[0_12px_30px_rgba(0,0,0,0.25)] sm:h-13 sm:w-13"
                                        animate={enableAmbientMotion ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                                        transition={enableAmbientMotion
                                            ? { duration: 2.2, ease: 'easeInOut', repeat: Infinity }
                                            : { duration: 0.1 }}
                                    >
                                        <Download className="h-5 w-5" />
                                    </motion.div>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-base font-bold tracking-tight text-white sm:text-lg">Install Gruvora Living</p>
                                        <p className="mt-1 text-sm leading-relaxed text-white/75">
                                            Add to home screen for instant launch, smoother reels, and app-like navigation.
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/65">Offline Ready</span>
                                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/65">Faster Open</span>
                                            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/65">Secure Session</span>
                                        </div>
                                    </div>

                                    <motion.button
                                        type="button"
                                        onClick={onInstall}
                                        disabled={installPending || !onInstall}
                                        className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-black shadow-[0_10px_26px_rgba(255,255,255,0.28)] transition hover:-translate-y-0.5 hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-70 sm:px-5 sm:py-2.5 sm:text-sm"
                                        whileTap={{ scale: 0.96 }}
                                        animate={installPending && enableAmbientMotion ? { opacity: [0.7, 1, 0.7] } : undefined}
                                        transition={installPending && enableAmbientMotion ? { duration: 1.1, repeat: Infinity } : undefined}
                                    >
                                        <Download className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
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
