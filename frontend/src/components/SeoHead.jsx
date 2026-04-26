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
 * @param {string} [props.image] - Social share image URL
 * @param {string} [props.url] - Full page URL for canonical/OG
 * @param {string} [props.type="website"] - OG type (website, article, etc.)
 * @param {string} [props.locale="en_IN"] - OG locale
 * @param {string[]} [props.alternateLocales] - Alternate locale codes for hreflang
 * @param {boolean} [props.noindex=false] - Set robots to noindex,nofollow
 * @param {React.ReactNode} [props.children] - Extra tags (e.g., JSON-LD)
 */
export default function SeoHead({
    title,
    description,
    canonical,
    keywords = [],
    meta = [],
    og = [],
    twitter = [],
    robots = "index, follow",
    twitter = [],
    robots = "index, follow",
    image,
    url,
    type = "website",
    locale = "en_IN",
    alternateLocales = [],
    noindex = false,
    children,
}) {
    const siteName = "GharSetu";
    const siteUrl = "https://gharsetu.com";

    // Build full title with site name suffix
    const fullTitle = useMemo(() => {
        if (!title) return siteName;
        const t = String(title).trim();
        return t.toLowerCase().includes(siteName.toLowerCase()) ? t : `${t} | ${siteName}`;
    }, [title]);

    // Build canonical URL
    const canonicalUrl = useMemo(() => {
        if (canonical) return canonical;
        if (url) return url;
        if (typeof window !== "undefined" && window.location) {
            return window.location.origin + window.location.pathname + window.location.search;
        }
        return siteUrl;
    }, [canonical, url]);

    // Build absolute image URL
    const absoluteImage = useMemo(() => {
        if (!image) return `${siteUrl}/og-image.jpg`;
        return image.startsWith("http") ? image : `${siteUrl}${image.startsWith("/") ? "" : "/"}${image}`;
    }, [image]);

    const effectiveRobots = useMemo(() => {
        if (noindex) return "noindex, nofollow";
        return robots;
    }, [noindex, robots]);

    // Standard OG tags
    const standardOgTags = useMemo(() => [
        { property: "og:type", content: type },
        { property: "og:locale", content: locale },
        { property: "og:site_name", content: siteName },
        { property: "og:url", content: canonicalUrl },
        { property: "og:title", content: fullTitle },
        { property: "og:image", content: absoluteImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: `${siteName} - ${fullTitle}` },
        ...(description ? [{ property: "og:description", content: description }] : []),
    ], [type, locale, siteName, canonicalUrl, fullTitle, absoluteImage, description]);

    // Standard Twitter Card tags
    const standardTwitterTags = useMemo(() => [
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@GharSetu" },
        { name: "twitter:creator", content: "@GharSetu" },
        { name: "twitter:title", content: fullTitle },
        { name: "twitter:image", content: absoluteImage },
        ...(description ? [{ name: "twitter:description", content: description }] : []),
    ], [fullTitle, absoluteImage, description]);

    // Build hreflang alternate links
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
            { name: "theme-color", content: "#10b981" },
            { name: "msapplication-TileColor", content: "#10b981" },
        ];
        if (keywords.length > 0) {
            base.push({ name: "keywords", content: keywords.join(", ") });
        }
        return base;
    }, [meta, keywords]);

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
