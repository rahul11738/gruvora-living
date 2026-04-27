import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";

/**
 * SeoHead - SaaS-grade SEO meta/canonical/OG/Twitter manager with smart defaults
 * @param {object} props
 * @param {string} props.title - Page title (auto-appends site name)
 * @param {string} props.description - Meta description
 * @param {string} [props.canonical] - Canonical URL (auto-builds from window.location if omitted)
 * @param {string[]} [props.keywords] - Meta keywords
 * @param {object[]} [props.meta] - Additional meta tags
 * @param {object[]} [props.og] - Open Graph tags (auto-populates standard OG)
 * @param {object[]} [props.twitter] - Twitter Card tags (auto-populates standard Twitter)
 * @param {string} [props.robots] - Robots meta value
 */
export default function SeoHead({
    title,
    description,
    canonical,
    keywords = [],
    meta = [],
    og = [],
    twitter = [],
    image,
    url,
    type = "website",
    locale = "en_IN",
    alternateLocales = [],
    noindex = false,
    children,
    robots = "index, follow",
    siteName = "Gruvora Living",
    siteUrl = "https://www.gruvora.com/",
    twitterSite = "@gruvoraliving",
    twitterCreator = "@gruvoraliving",
    themeColor = "#10b981",
}) {
    // Advanced: Try to auto-detect tenant from context if available
    let tenantContext = {};
    try {
        // If you have a TenantContext, use it. Otherwise, fallback to props/defaults.
        // Example: const TenantContext = React.createContext();
        // tenantContext = useContext(TenantContext) || {};
    } catch { }

    const _siteName = siteName || tenantContext.siteName || "Gruvora Living";
    const _siteUrl = siteUrl || tenantContext.siteUrl || "https://www.gruvora.com/";
    const _twitterSite = twitterSite || tenantContext.twitterSite || "@gruvoraliving";
    const _twitterCreator = twitterCreator || tenantContext.twitterCreator || "@gruvoraliving";
    const _themeColor = themeColor || tenantContext.themeColor || "#10b981";

    // Advanced: Runtime prop validation and warnings
    if (process.env.NODE_ENV !== "production") {
        if (!title) console.warn("[SeoHead] Missing required prop: title");
        if (!description) console.warn("[SeoHead] Missing required prop: description");
        if (!_siteName) console.warn("[SeoHead] siteName is missing or empty");
        if (!_siteUrl) console.warn("[SeoHead] siteUrl is missing or empty");
    }

    const fullTitle = useMemo(() => {
        if (!title) return _siteName;
        const t = String(title).trim();
        return t.toLowerCase().includes(_siteName.toLowerCase()) ? t : `${t} | ${_siteName}`;
    }, [title, _siteName]);

    const canonicalUrl = useMemo(() => {
        if (canonical) return canonical;
        if (url) return url;
        if (typeof window !== "undefined" && window.location) {
            return window.location.origin + window.location.pathname + window.location.search;
        }
        return _siteUrl;
    }, [canonical, url, _siteUrl]);

    const absoluteImage = useMemo(() => {
        if (!image) return `${_siteUrl}/og-image.jpg`;
        return image.startsWith("http") ? image : `${_siteUrl}${image.startsWith("/") ? "" : "/"}${image}`;
    }, [image, _siteUrl]);

    const effectiveRobots = useMemo(() => {
        if (noindex) return "noindex, nofollow";
        return robots;
    }, [noindex, robots]);

    const standardOgTags = useMemo(() => [
        { property: "og:type", content: type },
        { property: "og:locale", content: locale },
        { property: "og:site_name", content: _siteName },
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: fullTitle },
        { property: "og:image", content: absoluteImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: `${_siteName} - ${fullTitle}` },
        ...(description ? [{ property: "og:description", content: description }] : []),
    ], [type, locale, _siteName, canonicalUrl, fullTitle, absoluteImage, description]);

    const standardTwitterTags = useMemo(() => [
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: _twitterSite },
        { name: "twitter:creator", content: _twitterCreator },
        { name: "twitter:title", content: fullTitle },
        { name: "twitter:image", content: absoluteImage },
        ...(description ? [{ name: "twitter:description", content: description }] : []),
    ], [fullTitle, absoluteImage, description, _twitterSite, _twitterCreator]);

    const hreflangLinks = useMemo(() => {
        const links = [{ rel: "alternate", hrefLang: "en", href: canonicalUrl }];
        if (alternateLocales.length > 0) {
            alternateLocales.forEach(loc => {
                links.push({ rel: "alternate", hrefLang: loc, href: canonicalUrl.replace(/\/$/, "") + `?lang=${loc}` });
            });
        }
        return links;
    }, [canonicalUrl, alternateLocales]);

    const allMeta = useMemo(() => {
        const base = [
            ...meta,
            { name: "viewport", content: "width=device-width, initial-scale=1.0" },
            { name: "theme-color", content: _themeColor },
            { name: "msapplication-TileColor", content: _themeColor },
        ];
        if (keywords.length > 0) {
            base.push({ name: "keywords", content: keywords.join(", ") });
        }
        return base;
    }, [meta, keywords, _themeColor]);

    const allOgTags = useMemo(() => [...standardOgTags, ...og], [standardOgTags, og]);
    const allTwitterTags = useMemo(() => [...standardTwitterTags, ...twitter], [standardTwitterTags, twitter]);

    return (
        <Helmet>
            {/* Title */}
            {fullTitle && <title>{fullTitle}</title>}

            {/* Meta tags */}
            {effectiveRobots && <meta name="robots" content={effectiveRobots} />}
            {description && <meta name="description" content={String(description)} />}
            {allMeta.map((m, i) => m && <meta key={"meta-" + i} {...m} />)}

            {/* Canonical */}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

            {/* Hreflang alternates */}
            {hreflangLinks.map((l, i) => <link key={"hreflang-" + i} {...l} />)}

            {/* Open Graph */}
            {allOgTags.map((o, i) => o && o.property && o.content && <meta key={"og-" + i} property={o.property} content={o.content} />)}

            {/* Twitter */}
            {allTwitterTags.map((t, i) => t && t.name && t.content && <meta key={"tw-" + i} name={t.name} content={t.content} />)}

            {/* JSON-LD / other children */}
            {children && React.Children.map(children, (child, i) => child ? React.cloneElement(child, { key: `child-${i}` }) : null)}
        </Helmet>
    );
}
