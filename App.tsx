import React from 'react';
import { Letter } from './components/Letter';
import { Newsletter } from './components/Newsletter';
import { Logo } from './components/Logo';

const App: React.FC = () => {
  const handleNewsletterSubmit = (email: string) => {
    console.log('Newsletter submission:', email);
    // Here you would typically connect to a backend service or API
  };

  return (
    <div className="h-screen w-full flex flex-col bg-brand-offwhite font-sans overflow-hidden">
      
      {/* Header - spacer / simple header */}
      <header className="flex-none w-full bg-brand-offwhite z-20">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-12 py-4">
          {/* kept intentionally minimal; logo and tagline moved to footer */}
        </div>
      </header>

      {/* Main Content - Centered Letter */}
      <main className="flex-grow overflow-y-auto no-scrollbar w-full relative flex flex-col items-center">
        <div className="w-full max-w-5xl px-6 pt-4 pb-8 md:px-12 md:pt-8 md:pb-12 flex-grow flex flex-col justify-start">
           <Letter />
        </div>
      </main>

      {/* Footer - Newsletter */}
      <footer className="flex-none w-full bg-brand-offwhite border-t border-gray-100 py-8 px-6 md:px-12 z-20">
        <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Left: Logo + Tagline */}
          <div className="flex items-start md:items-center gap-4">
            <Logo className="h-8 md:h-10" />
            <div className="flex flex-col">
              <span className="text-sm md:text-base text-brand-gray font-semibold tracking-tight font-serif">
                The Human Interface for Navigating AI
              </span>
              <span className="text-xs text-brand-gray/70 mt-1">Ahead</span>
            </div>
          </div>

          {/* Right: Newsletter */}
          <div className="w-full md:w-1/2 lg:w-2/5">
            <Newsletter onSubmit={handleNewsletterSubmit} />
          </div>
        </div>
      </footer>

    </div>
  );
};

export default App;