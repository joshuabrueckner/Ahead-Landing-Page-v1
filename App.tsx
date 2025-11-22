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
      
      {/* Header - Logo and Tagline */}
  <header className="flex-none w-full px-8 py-4 flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 bg-brand-offwhite z-20">
        <Logo className="scale-75 origin-center" />
      </header>

      {/* Main Content - Centered Letter */}
      <main className="flex-grow overflow-y-auto no-scrollbar w-full relative flex flex-col items-center">
  <div className="w-full max-w-5xl px-6 pt-2 pb-8 md:px-12 md:pt-6 md:pb-12 flex-grow flex flex-col justify-start">
           <Letter />
        </div>
      </main>

      {/* Footer - Newsletter */}
      <footer className="flex-none w-full bg-brand-offwhite border-t border-gray-100 py-8 px-6 md:px-12 z-20">
         <Newsletter onSubmit={handleNewsletterSubmit} />
      </footer>

    </div>
  );
};

export default App;