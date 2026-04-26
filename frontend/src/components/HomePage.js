import React, { Suspense, lazy, memo } from 'react';
import { Header, Footer } from './Layout';
import { RouteSkeleton } from './SkeletonLoaders';
import SeoHead from './SeoHead';
import JsonLd from './JsonLd';

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
    const orgSchema = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Gruvora Living",
        "url": "https://www.gruvora.com/",
        "logo": "https://gruvora.com/logo.png",
        "sameAs": [
            "https://www.facebook.com/gruvoraliving",
            "https://www.instagram.com/gruvoraliving",
            "https://twitter.com/gruvoraliving"
        ],
        "description": "Premium property rentals and stays marketplace in India. Trusted, verified listings for homes, stays, and services.",
        "contactPoint": [{
            "@type": "ContactPoint",
            "telephone": "+91-XXXXXXXXXX",
            "contactType": "customer service",
            "areaServed": "IN",
            "availableLanguage": ["English", "Hindi"]
        }]
    };
    return (
        <div className="min-h-screen bg-stone-50" data-testid="home-page">
            <SeoHead
                title="Gruvora Living – Premium Property Rentals & Stays"
                description="Discover, search, and book premium rental properties and stays across India with Gruvora Living. Trusted, verified listings."
                canonical="https://www.gruvora.com/"
                keywords={["Gruvora", "Gruvora Living", "property rental", "premium stays", "India", "real estate"]}
                og={[{
                    property: "og:title",
                    content: "Gruvora Living – Premium Property Rentals & Stays"
                }, {
                    property: "og:description",
                    content: "Discover, search, and book premium rental properties and stays across India with Gruvora Living. Trusted, verified listings."
                }, {
                    property: "og:url",
                    content: "https://www.gruvora.com/"
                }, {
                    property: "og:type",
                    content: "website"
                }]}
                twitter={[{
                    name: "twitter:card",
                    content: "summary_large_image"
                }, {
                    name: "twitter:title",
                    content: "Gruvora Living – Premium Property Rentals & Stays"
                }, {
                    name: "twitter:description",
                    content: "Discover, search, and book premium rental properties and stays across India with Gruvora Living. Trusted, verified listings."
                }]}
            />
            <JsonLd schema={orgSchema} />
            <Header />
            <main className="home-main">
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

const HomePage = () => {
  return (
    <div className="homepage">
      <SeoHead
        title="GharSetu - Premium Property Platform in Gujarat"
        description="Discover premium homes, business spaces, hotels, event venues, and professional services in Gujarat. Your trusted property platform."
        url="https://gharsetu.com"
        image="/og-image.jpg"
      />
      <JsonLd
        type="website"
        data={{
          name: 'GharSetu',
          description: 'Premium property platform for Gujarat - homes, business spaces, hotels, event venues, and services',
          url: 'https://gharsetu.com',
        }}
      />

      <Header />

      <main>
        <Suspense fallback={<RouteSkeleton />}>
          <HeroSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <CategoriesSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <TrendingSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <RecommendationsSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <FeaturesSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <ReelsPromoSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <TrustSection />
        </Suspense>

        <Suspense fallback={<RouteSkeleton />}>
          <CTASection />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
};

export default HomePage;
