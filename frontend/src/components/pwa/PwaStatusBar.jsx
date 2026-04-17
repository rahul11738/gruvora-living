import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
                        <BaseCard>
                            <div className="flex items-center gap-3 p-4">
                                <div className="rounded-xl bg-white/10 p-2 text-white">
                                    <Download className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold tracking-wide">Install Gruvora Living</p>
                                    <p className="mt-1 text-sm text-white/70">Add the app to your home screen for a faster, full-screen experience.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onInstall}
                                    disabled={installPending || !onInstall}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    {installPending ? 'Opening' : 'Install'}
                                </button>
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
