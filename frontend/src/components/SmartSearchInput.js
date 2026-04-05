import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from './ui/input';

export const SmartSearchInput = ({
  value,
  onChange,
  placeholder,
  suggestions = [],
  onSuggestionSelect,
  inputTestId,
  className = '',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10 h-12"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 120)}
        data-testid={inputTestId}
      />

      {isFocused && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-lg z-40 overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, idx) => (
            <button
              key={`${suggestion}-${idx}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSuggestionSelect(suggestion)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 text-stone-700"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartSearchInput;
