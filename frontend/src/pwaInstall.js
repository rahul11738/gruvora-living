import { useEffect, useMemo, useState, useRef } from 'react';

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
    const eventHandledRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const handleBeforeInstallPrompt = (event) => {
            // Prevent the default mini-infobar/prompt from appearing
            // Store the event for later programmatic use
            event.preventDefault();
            // Only handle once per page session
            if (!eventHandledRef.current) {
                eventHandledRef.current = true;
                setInstallPrompt(event);
                setCanPrompt(true);
            }
        };

        const handleAppInstalled = () => {
            setInstallPrompt(null);
            setCanPrompt(false);
            setIsInstalled(true);
            eventHandledRef.current = false;
        };

        const handleStandaloneChange = () => {
            setIsInstalled(getStandaloneMode());
        };

        // Add listeners for PWA install events
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

        try {
            // Show the install prompt
            installPrompt.prompt();
            // Wait for the user to respond
            const choice = await installPrompt.userChoice;
            // Clear the saved prompt (can only be used once)
            setInstallPrompt(null);
            setCanPrompt(false);
            eventHandledRef.current = false;
            return {
                outcome: choice?.outcome || 'dismissed',
                accepted: choice?.outcome === 'accepted',
            };
        } catch (error) {
            console.warn('[PWA Install] Prompt failed:', error);
            setInstallPrompt(null);
            setCanPrompt(false);
            eventHandledRef.current = false;
            return { outcome: 'error', accepted: false };
        }
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
