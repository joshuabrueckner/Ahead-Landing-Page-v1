import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <img
      src="/ahead-logo.png"
      alt="Ahead logo"
      className={`h-10 md:h-12 w-auto ${className}`}
    />
  );
};
