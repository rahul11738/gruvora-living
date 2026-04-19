import React from 'react';

/**
 * Branded logo component combining icon + text.
 * Used throughout site for consistent branding.
 */
export default function BrandedLogo({ variant = 'compact', className = '', hideIcon = false }) {
    // Variants: 'compact' (mobile), 'normal' (tablet), 'full' (desktop)

    const iconSizes = {
        compact: 'h-7 w-7 md:h-8 md:w-8',
        normal: 'h-8 w-8 md:h-9 md:w-9',
        full: 'h-9 w-9 md:h-10 md:w-10',
    };

    const textSizes = {
        compact: 'text-xs md:text-sm',
        normal: 'text-sm md:text-base',
        full: 'text-base md:text-lg',
    };

    return (
        <div
            className={`inline-flex items-end gap-1.5 md:gap-2 ${className}`}
            aria-label="Gruvora Living"
        >
            {/* Icon - Only show when not hideIcon */}
            {!hideIcon && (
                <div className={`flex shrink-0 items-center justify-center rounded-lg border border-emerald-200/70 bg-gradient-to-b from-white to-stone-50 p-1 shadow-[0_4px_12px_rgba(5,150,105,0.15)] ${iconSizes[variant]}`}>
                    <img
                        src="/icons/APP_ICON.png"
                        alt="Gruvora Living Logo"
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            {/* Text - Vertical Stack with LIVING under R */}
            <div className={`flex flex-col leading-none justify-end ${textSizes[variant]}`}>
                <span className="font-bold tracking-tight text-emerald-700 leading-tight">
                    GRUVORA
                </span>
                <span className="font-bold tracking-tight text-emerald-700 leading-tight">
                    LIVING
                </span>
            </div>
        </div>
    );
}
