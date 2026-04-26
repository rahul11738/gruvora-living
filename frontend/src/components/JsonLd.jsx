import React from "react";
/**
 * JsonLd - Outputs JSON-LD schema in a script tag for SEO
 * @param {object} props
 * @param {object} props.schema - The JSON-LD schema object
 */
export default function JsonLd({ schema }) {
    if (!schema || typeof schema !== 'object') return null;
    try {
        const jsonString = JSON.stringify(schema);
        if (!jsonString || jsonString === '{}') return null;
        return (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonString }} />
        );
    } catch (e) {
        console.warn('[JsonLd] Failed to stringify schema:', e);
        return null;
    }
}
