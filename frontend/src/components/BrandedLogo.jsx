import React from 'react';

/**
 * Branded logo component combining icon + text (SaaS-level design).
 * Used throughout site for consistent branding.
 */
export default function BrandedLogo({ variant = 'compact', className = '', hideIcon = false }) {
    const logoHeights = {
        compact: 'h-8 md:h-9',
        normal: 'h-9 md:h-10',
        full: 'h-10 md:h-11',
    };

    // When hideIcon is true, show only text (for footer)
    if (hideIcon) {
        return (
            <div className={`inline-flex flex-col leading-none ${className}`}>
                <span
                    className="font-black tracking-tighter text-white leading-none [font-family:'Plus_Jakarta_Sans',sans-serif] drop-shadow-sm text-xs md:text-sm"
                    style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
                >
                    GRUVORA
                </span>
                <span
                    className="font-black tracking-tighter text-white leading-none [font-family:'Plus_Jakarta_Sans',sans-serif] drop-shadow-sm text-xs md:text-sm"
                    style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
                >
                    LIVING
                </span>
            </div>
        );
    }

    // Standard logo - Clean image without green container
    return (
        <img
            src="/BrandedLogo.png"
            alt="Gruvora Living"
            className={`${logoHeights[variant]} w-auto object-contain drop-shadow-sm hover:drop-shadow-md transition-shadow ${className}`}
            aria-label="Gruvora Living"
        />
    );
}
