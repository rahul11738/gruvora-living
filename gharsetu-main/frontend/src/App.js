import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { InteractionProvider } from "./context/InteractionContext";
import { NotificationProvider } from "./components/Notifications";

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
import { CategoryPage } from "./components/CategoryPage";
import { ListingDetailPage } from "./components/ListingDetailPage";
import { ReelsPage } from "./components/ReelsPage";
import { UserDashboard, WishlistPage } from "./components/UserDashboard";
import { OwnerDashboard } from "./components/OwnerDashboard";
import { OwnerProfilePage } from "./components/OwnerProfilePage";
import { MapSearchPage } from "./components/MapSearchPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { ChatBot } from "./components/ChatBot";

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
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      
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
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <InteractionProvider>
          <NotificationProvider>
            <AppRoutes />
            <MobileBottomNav />
            <ChatBot />
            <Toaster position="top-right" richColors />
          </NotificationProvider>
        </InteractionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
