import React, { lazy, Suspense } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import AppErrorBoundary from "./components/ui/AppErrorBoundary.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { InteractionProvider } from "./context/InteractionContext";
import { NotificationProvider } from "./components/Notifications.jsx";

// Pages
import { Header, Footer, MobileBottomNav } from "./components/Layout";
import {
  HeroSection,
  CategoriesSection,
  TrendingSection,
  FeaturesSection,
  TrustSection,
  ReelsPromoSection,
  CTASection,
  RecommendationsSection,
} from "./components/HomeComponents";
import { LoginPage, RegisterPage, VerifyEmailPage } from "./components/AuthPages";

const CategoryPage = lazy(() => import("./components/CategoryPage").then((m) => ({ default: m.CategoryPage })));
const ListingDetailPage = lazy(() => import("./components/ListingDetailPage").then((m) => ({ default: m.ListingDetailPage })));
const ReelsPage = lazy(() => import("./components/ReelsPage").then((m) => ({ default: m.ReelsPage })));
const UserDashboard = lazy(() => import("./components/UserDashboard").then((m) => ({ default: m.UserDashboard })));
const WishlistPage = lazy(() => import("./components/UserDashboard").then((m) => ({ default: m.WishlistPage })));
const OwnerDashboard = lazy(() => import("./components/OwnerDashboard").then((m) => ({ default: m.OwnerDashboard })));
const OwnerProfilePage = lazy(() => import("./components/OwnerProfilePage").then((m) => ({ default: m.OwnerProfilePage })));
const MapSearchPage = lazy(() => import("./components/MapSearchPage").then((m) => ({ default: m.MapSearchPage })));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const ChatPage = lazy(() => import("./components/ChatPage.jsx"));
const NotificationsPage = lazy(() => import("./components/NotificationsPage.jsx"));
const AdminDashboard = lazy(() => import("./components/AdminDashboard").then((m) => ({ default: m.AdminDashboard })));
const TermsConditionsPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.TermsConditionsPage })));
const PrivacyPolicyPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.PrivacyPolicyPage })));
const RefundCancellationPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.RefundCancellationPage })));
const DisclaimerPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.DisclaimerPage })));
const AboutUsPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.AboutUsPage })));
const UserVerificationPolicyPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.UserVerificationPolicyPage })));
const CommunityGuidelinesPage = lazy(() => import("./components/PolicyPages").then((m) => ({ default: m.CommunityGuidelinesPage })));

const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-stone-50">
    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children, requireOwner = false, requireAdmin = false }) => {
  const { isAuthenticated, isOwner, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
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

// Home Page
const HomePage = () => {
  return (
    <div className="min-h-screen bg-stone-50" data-testid="home-page">
      <Header />
      <main>
        <HeroSection />
        <CategoriesSection />
        <RecommendationsSection />
        <TrendingSection />
        <FeaturesSection />
        <TrustSection />
        <ReelsPromoSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
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
        <Route path="/map" element={<MapSearchPage />} />

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
              </NotificationProvider>
            </AppErrorBoundary>
          </InteractionProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
