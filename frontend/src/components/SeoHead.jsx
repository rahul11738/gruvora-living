import React from "react";
import { Helmet } from "react-helmet-async";


/**
 * SeoHead - Central SEO meta/canonical/OG manager
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {string} props.description - Meta description
 * @param {string} [props.canonical] - Canonical URL
 * @param {string[]} [props.keywords] - Meta keywords
 * @param {object[]} [props.meta] - Additional meta tags
 * @param {object[]} [props.og] - Open Graph tags
 * @param {object[]} [props.twitter] - Twitter Card tags
 * @param {string} [props.robots] - Robots meta value
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
}) {
    const canonicalUrl = canonical || (typeof window !== "undefined" && window.location ? window.location.origin + window.location.pathname : undefined);
    
    return (
        <Helmet>
            {title && <title>{String(title)}</title>}
            {description && <meta name="description" content={String(description)} />}
            {Array.isArray(keywords) && keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
            {robots && <meta name="robots" content={String(robots)} />}
            {Array.isArray(meta) && meta.map((m, i) => m && <meta key={"meta-" + i} {...m} />)}
            {Array.isArray(og) && og.map((o, i) => o && o.property && o.content && <meta key={"og-" + i} property={o.property} content={o.content} />)}
            {Array.isArray(twitter) && twitter.map((t, i) => t && t.name && t.content && <meta key={"tw-" + i} name={t.name} content={t.content} />)}
            {children && React.Children.map(children, (child, i) => child ? React.cloneElement(child, { key: `child-${i}` }) : null)}
        </Helmet>
    );
}
