import React from 'react';

/**
 * Branded logo component combining icon + text.
 * Used throughout site for consistent branding.
 */
export default function BrandedLogo({ variant = 'compact', className = '' }) {
    // Variants: 'compact' (mobile), 'normal' (tablet), 'full' (desktop)

    const iconSizes = {
        compact: 'h-8 w-8 md:h-9 md:w-9',
        normal: 'h-9 w-9 md:h-10 md:w-10',
        full: 'h-10 w-10 md:h-11 md:w-11',
    };

    const textSizes = {
        compact: 'text-xs md:text-sm',
        normal: 'text-sm md:text-base',
        full: 'text-base md:text-lg',
    };

    const containerSizes = {
        compact: 'gap-2',
        normal: 'gap-2.5',
        full: 'gap-3',
    };

    return (
        <div
            className={`inline-flex items-center ${containerSizes[variant]} ${className}`}
            aria-label="Gruvora Living"
        >
            {/* Icon */}
            <div className={`flex shrink-0 items-center justify-center rounded-lg border border-emerald-200/70 bg-gradient-to-b from-white to-stone-50 p-1.5 shadow-[0_6px_14px_rgba(5,150,105,0.12)] ${iconSizes[variant]}`}>
                <img
                    src="/icons/APP_ICON.png"
                    alt="Gruvora Living Logo"
                />
            </div>

            {/* Text */}
            <div className={`flex flex-col justify-center ${textSizes[variant]}`}>
                <span className="font-bold tracking-tight text-emerald-600">
                    GRUVORA
                </span>
                <span className="font-semibold tracking-tight text-emerald-500">
                    LIVING
                </span>
            </div>
        </div>
    );
}
