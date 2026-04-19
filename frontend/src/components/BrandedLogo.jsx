import React from 'react';

/**
 * Branded logo component combining icon + text (SaaS-level design).
 * Used throughout site for consistent branding.
 */
export default function BrandedLogo({ variant = 'compact', className = '', hideIcon = false }) {
    const iconSizes = {
        compact: 'h-8 w-8 md:h-9 md:w-9',
        normal: 'h-9 w-9 md:h-10 md:w-10',
        full: 'h-10 w-10 md:h-11 md:w-11',
    };

    const titleSizes = {
        compact: 'text-sm md:text-base',
        normal: 'text-base md:text-lg',
        full: 'text-lg md:text-xl',
    };

    const subtitleSizes = {
        compact: 'text-xs md:text-sm',
        normal: 'text-sm md:text-base',
        full: 'text-base md:text-lg',
    };

    // When hideIcon is true, show only text (for footer)
    if (hideIcon) {
        return (
            <div className={`inline-flex flex-col leading-none ${className}`}>
                <span
                    className="viga-regular font-black tracking-tight text-white leading-none drop-shadow-sm text-xs md:text-sm"
                    style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
                >
                    GRUVORA
                </span>
                <span
                    className="viga-regular font-black tracking-tight text-white leading-none drop-shadow-sm text-xs md:text-sm"
                    style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
                >
                    LIVING
                </span>
            </div>
        );
    }

    // Standard logo - icon with brand text (responsive, SaaS-style)
    return (
        <div className={`inline-flex items-center gap-2.5 md:gap-3 ${className}`} aria-label="Gruvora Living">
            <img
                src="/BrandedLogo.png"
                alt="Gruvora Living Icon"
                className={`${iconSizes[variant]} shrink-0 rounded-lg object-cover shadow-sm`}
            />

            <div className="inline-flex flex-col leading-none">
                <span
                    className={`viga-regular font-black tracking-tight text-emerald-900 ${titleSizes[variant]}`}
                    style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
                >
                    GRUVORA
                </span>
                <span
                    className={`viga-regular font-black tracking-tight text-emerald-900 ${subtitleSizes[variant]}`}
                    style={{ fontWeight: 900, letterSpacing: '-0.01em' }}
                >
                    LIVING
                </span>
            </div>
        </div>
    );
}
