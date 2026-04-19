import React, { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import AppErrorBoundary from "./components/ui/AppErrorBoundary.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { InteractionProvider } from "./context/InteractionContext";
import { NotificationProvider } from "./components/Notifications.jsx";
import { RouteSkeleton } from "./components/SkeletonLoaders";
import { prefetchDiscoverRoute, prefetchReelsRoute } from "./lib/routePrefetch";
import PwaStatusBar from "./components/pwa/PwaStatusBar";
import PwaSplashScreen from "./components/pwa/PwaSplashScreen";
import { registerServiceWorker } from "./serviceWorker";
import { usePwaInstallPrompt } from "./pwaInstall";

// Pages
import { MobileBottomNav } from "./components/Layout";
import { LoginPage, RegisterPage, VerifyEmailPage } from "./components/AuthPages";

const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.localStorage.getItem("page-has-been-force-refreshed") || "false",
    );

    try {
      const component = await componentImport();
      window.localStorage.setItem("page-has-been-force-refreshed", "false");
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.localStorage.setItem("page-has-been-force-refreshed", "true");
        return window.location.reload();
      }
      throw error;
    }
  });

const CategoryPage = lazyWithRetry(() => import("./components/CategoryPage").then((m) => ({ default: m.CategoryPage })));
const ListingDetailPage = lazyWithRetry(() => import("./components/ListingDetailPage").then((m) => ({ default: m.ListingDetailPage })));
const HomePage = lazyWithRetry(() => import("./components/HomePage"));
const ReelsPage = lazyWithRetry(() => import("./components/ReelsPage").then((m) => ({ default: m.ReelsPage })));
const UserDashboard = lazyWithRetry(() => import("./components/UserDashboard").then((m) => ({ default: m.UserDashboard })));
const WishlistPage = lazyWithRetry(() => import("./components/UserDashboard").then((m) => ({ default: m.WishlistPage })));
const OwnerDashboard = lazyWithRetry(() => import("./components/OwnerDashboard").then((m) => ({ default: m.OwnerDashboard })));
const OwnerProfilePage = lazyWithRetry(() => import("./components/OwnerProfilePage").then((m) => ({ default: m.OwnerProfilePage })));
const DiscoverSearchPage = lazyWithRetry(() => import("./components/DiscoverSearchPage").then((m) => ({ default: m.DiscoverSearchPage })));
const SettingsPage = lazyWithRetry(() => import("./components/SettingsPage"));
const ChatPage = lazyWithRetry(() => import("./components/ChatPage.jsx"));
const NotificationsPage = lazyWithRetry(() => import("./components/NotificationsPage.jsx"));
const AdminDashboard = lazyWithRetry(() => import("./components/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const TermsConditionsPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.TermsConditionsPage })));
const PrivacyPolicyPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.PrivacyPolicyPage })));
const RefundCancellationPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.RefundCancellationPage })));
const DisclaimerPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.DisclaimerPage })));
const AboutUsPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.AboutUsPage })));
const UserVerificationPolicyPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.UserVerificationPolicyPage })));
const CommunityGuidelinesPage = lazyWithRetry(() => import("./components/PolicyPages").then((m) => ({ default: m.CommunityGuidelinesPage })));

const RouteLoader = () => (
  <RouteSkeleton />
);

// Protected Route Component
const ProtectedRoute = ({ children, requireOwner = false, requireAdmin = false }) => {
  const { isAuthenticated, isOwner, isAdmin, loading } = useAuth();

  if (loading) {
    return <RouteSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireOwner && !isOwner && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Search Page - Uses CategoryPage without category filter
const SearchPage = () => {
  return <CategoryPage />;
};

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/terms-conditions" element={<TermsConditionsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/refund-cancellation-policy" element={<RefundCancellationPage />} />
        <Route path="/disclaimer" element={<DisclaimerPage />} />
        <Route path="/about-us" element={<AboutUsPage />} />
        <Route path="/user-verification-policy" element={<UserVerificationPolicyPage />} />
        <Route path="/community-guidelines" element={<CommunityGuidelinesPage />} />
        <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
        <Route path="/terms" element={<Navigate to="/terms-conditions" replace />} />
        <Route path="/about" element={<Navigate to="/about-us" replace />} />

        {/* Category & Search */}
        <Route path="/category/:category" element={<CategoryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/discover" element={<DiscoverSearchPage />} />

        {/* Listing Detail */}
        <Route path="/listing/:id" element={<ListingDetailPage />} />

        {/* Reels */}
        <Route path="/reels" element={<ReelsPage />} />

        {/* Owner Public Profile */}
        <Route path="/owner/:ownerId" element={<OwnerProfilePage />} />

        {/* Protected User Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wishlist"
          element={
            <ProtectedRoute>
              <WishlistPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Protected Owner Routes */}
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedRoute requireOwner>
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/owner/register" element={<RegisterPage />} />

        {/* Protected Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  const launchedInStandalone = typeof window !== 'undefined' && (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    window.navigator?.standalone === true
  );
  const { canPrompt, isInstalled, promptInstall } = usePwaInstallPrompt();
  const [installPending, setInstallPending] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  // Splash screen disabled
  // Splash screen disabled

  useEffect(() => {
    const warmRoutes = () => {
      prefetchDiscoverRoute();
      prefetchReelsRoute();
    };

    if (typeof window === "undefined") {
      return undefined;
    }

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(warmRoutes, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = window.setTimeout(warmRoutes, 1500);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // Splash screen auto-hide logic removed

  useEffect(() => {
    const cleanup = registerServiceWorker({
      onReady: () => {
        // The service worker is active and the shell can cache repeat visits.
      },
      onUpdate: ({ registration, applyUpdate }) => {
        setUpdateRegistration({ registration, applyUpdate });
      },
      onError: (error) => {
        console.warn('Service worker registration failed:', error);
      },
    });

    return cleanup;
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    setInstallPending(true);
    try {
      await promptInstall();
    } finally {
      setInstallPending(false);
    }
  };

  const handleApplyUpdate = () => {
    updateRegistration?.applyUpdate?.();
  };

  return (
    <BrowserRouter>
      <AuthProvider>
        <SubscriptionProvider>
          <InteractionProvider>
            <AppErrorBoundary>
              <NotificationProvider>
                <AppRoutes />
                <MobileBottomNav />
                <Toaster position="top-right" richColors />
                <PwaStatusBar
                  isInstallable={canPrompt}
                  isInstalled={isInstalled}
                  onInstall={handleInstall}
                  installPending={installPending}
                  updateAvailable={Boolean(updateRegistration)}
                  onApplyUpdate={handleApplyUpdate}
                  onDismissUpdate={() => setUpdateRegistration(null)}
                  isOffline={isOffline}
                  installHint={!canPrompt && !isInstalled ? 'Use your browser menu to add Gruvora Living to the home screen.' : ''}
                />
                {/* Splash screen removed */}
              </NotificationProvider>
            </AppErrorBoundary>
          </InteractionProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
