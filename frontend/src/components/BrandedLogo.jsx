import React from 'react';

/**
 * Branded logo component combining icon + text (SaaS-level design).
 * Used throughout site for consistent branding.
 */
export default function BrandedLogo({ variant = 'compact', className = '', hideIcon = false }) {
    // Variants: 'compact' (mobile), 'normal' (tablet), 'full' (desktop)

    const iconSizes = {
        compact: 'h-9 w-9 md:h-10 md:w-10',
        normal: 'h-10 w-10 md:h-11 md:w-11',
        full: 'h-11 w-11 md:h-12 md:w-12',
    };

    const textSizes = {
        compact: 'text-xs md:text-sm',
        normal: 'text-sm md:text-base',
        full: 'text-base md:text-lg',
    };

    const gapSizes = {
        compact: 'gap-2 md:gap-2.5',
        normal: 'gap-2.5 md:gap-3',
        full: 'gap-3 md:gap-3.5',
    };

    return (
        <div
            className={`inline-flex items-end ${gapSizes[variant]} ${className}`}
            aria-label="Gruvora Living"
        >
            {/* Icon Container - Increased visibility & contrast */}
            {!hideIcon && (
                <div className={`flex shrink-0 items-center justify-center rounded-xl border-2 border-emerald-300/60 bg-gradient-to-br from-emerald-50 via-white to-stone-50 p-1.5 shadow-[0_8px_16px_rgba(5,150,105,0.18)] hover:shadow-[0_10px_20px_rgba(5,150,105,0.22)] transition-shadow ${iconSizes[variant]}`}>
                    <img
                        src="/icons/APP_ICON.png"
                        alt="Gruvora Living Logo"
                        className="w-5/6 h-5/6 object-contain filter drop-shadow-sm"
                    />
                </div>
            )}

            {/* Text - Stylish vertical stack with LIVING aligned under R */}
            <div className="flex flex-col leading-none">
                <span
                    className={`font-black tracking-tighter text-emerald-900 leading-none [font-family:'Plus_Jakarta_Sans',sans-serif] drop-shadow-sm ${textSizes[variant]}`}
                    style={{ fontWeight: 900, letterSpacing: '-0.02em' }}
                >
                    GRUVORA
                </span>
                <span
                    className={`font-black tracking-tighter text-emerald-800 leading-none [font-family:'Plus_Jakarta_Sans',sans-serif] drop-shadow-sm`}
                    style={{ fontWeight: 900, letterSpacing: '-0.02em', marginLeft: 'calc(0.15em * var(--text-size, 1))' }}
                >
                    LIVING
                </span>
            </div>
        </div>
    );
}
