

/**
 * JsonLd - Outputs JSON-LD schema in a script tag for SEO
 * @param {object} props
 * @param {object} props.schema - The JSON-LD schema object
 */
export default function JsonLd({ schema }) {
    if (!schema) return null;
    return (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    );
}
