import { useEffect, useMemo, useState } from 'react';

const getStandaloneMode = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    return (
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
        window.navigator?.standalone === true
    );
};

/**
 * Track the browser install prompt and expose a single async action for the UI.
 * Unsupported browsers simply remain in a graceful no-prompt state.
 */
export function usePwaInstallPrompt() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(getStandaloneMode());
    const [canPrompt, setCanPrompt] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();
            setInstallPrompt(event);
            setCanPrompt(true);
        };

        const handleAppInstalled = () => {
            setInstallPrompt(null);
            setCanPrompt(false);
            setIsInstalled(true);
        };

        const handleStandaloneChange = () => {
            setIsInstalled(getStandaloneMode());
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        const standaloneQuery = window.matchMedia?.('(display-mode: standalone)');
        standaloneQuery?.addEventListener?.('change', handleStandaloneChange);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            standaloneQuery?.removeEventListener?.('change', handleStandaloneChange);
        };
    }, []);

    const promptInstall = useMemo(() => async () => {
        if (!installPrompt) {
            return { outcome: 'unsupported', accepted: false };
        }

        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        setInstallPrompt(null);
        setCanPrompt(false);
        return {
            outcome: choice?.outcome || 'dismissed',
            accepted: choice?.outcome === 'accepted',
        };
    }, [installPrompt]);

    return {
        canPrompt,
        isInstalled,
        isStandalone: isInstalled,
        promptInstall,
        // Do not rely on `'beforeinstallprompt' in window` because many browsers
        // still fire the event without exposing the property on window.
        isSupported: canPrompt,
    };
}
