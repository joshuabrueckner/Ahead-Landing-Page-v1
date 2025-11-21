import React from 'react';
import { Compass } from 'lucide-react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-brand-black text-brand-black">
        <Compass size={20} fill="currentColor" className="text-brand-black" />
      </div>
      <span className="text-2xl font-sans font-bold tracking-tighter text-brand-black">ahead</span>
    </div>
  );
};
