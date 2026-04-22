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
 * @param {string} [props.children] - Extra tags (e.g., JSON-LD)
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
    children,
}) {
    const canonicalUrl = canonical || (typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined);
    return (
        <Helmet>
            {title && <title>{title}</title>}
            {description && <meta name="description" content={description} />}
            {keywords.length > 0 && <meta name="keywords" content={keywords.join(", ")} />}
            {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
            {robots && <meta name="robots" content={robots} />}
            {meta.map((m, i) => <meta key={i} {...m} />)}
            {og.map((o, i) => <meta key={"og" + i} property={o.property} content={o.content} />)}
            {twitter.map((t, i) => <meta key={"tw" + i} name={t.name} content={t.content} />)}
            {children}
        </Helmet>
    );
}
