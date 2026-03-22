import React from 'react';
import { Loader2 } from 'lucide-react';

export const FollowButton = ({
  following,
  pending,
  onClick,
  compact = false,
  className = '',
  'data-testid': dataTestId,
}) => {
  const base = compact
    ? 'px-2.5 py-1 text-[11px]'
    : 'px-3 py-1.5 text-xs';

  const stateClasses = following
    ? 'bg-black/60 text-white border-white/60 backdrop-blur-sm hover:bg-black/75 active:bg-black/85'
    : 'bg-emerald-500 text-white border-emerald-300 hover:bg-emerald-400 active:bg-emerald-600';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      data-testid={dataTestId}
      className={[
        'inline-flex items-center justify-center rounded-full font-semibold transition-colors duration-150 border shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1 focus-visible:ring-offset-black',
        'active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed',
        base,
        stateClasses,
        className,
      ].join(' ')}
    >
      {pending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : following ? (
        'Following'
      ) : (
        'Follow'
      )}
    </button>
  );
};

export default FollowButton;
