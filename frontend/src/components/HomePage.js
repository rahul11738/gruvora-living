import React, { Suspense, lazy, memo } from 'react';
import { Header, Footer } from './Layout';
import { RouteSkeleton } from './SkeletonLoaders';

const HeroSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.HeroSection }))
);
const CategoriesSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.CategoriesSection }))
);
const RecommendationsSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.RecommendationsSection }))
);
const TrendingSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.TrendingSection }))
);
const FeaturesSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.FeaturesSection }))
);
const TrustSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.TrustSection }))
);
const ReelsPromoSection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.ReelsPromoSection }))
);
const CTASection = lazy(() =>
    import('./HomeComponents').then((m) => ({ default: m.CTASection }))
);

const HomePage = memo(function HomePage() {
    return (
        <div className="min-h-screen bg-stone-50" data-testid="home-page">
            <Header />
            <main>
                <Suspense fallback={<RouteSkeleton />}>
                    <HeroSection />
                    <CategoriesSection />
                    <RecommendationsSection />
                    <TrendingSection />
                    <FeaturesSection />
                    <TrustSection />
                    <ReelsPromoSection />
                    <CTASection />
                </Suspense>
            </main>
            <Footer />
        </div>
    );
});

export default HomePage;
