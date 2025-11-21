import React from 'react';

export const Letter: React.FC = () => {
  return (
    <div className="flex flex-col relative w-full items-center">
      {/* Letter Content */}
      <div className="flex flex-col w-full max-w-4xl items-center">
        <h1 className="text-2xl md:text-4xl font-serif mb-8 leading-tight text-brand-black text-center">
          To the 77% of you who feel lost with AI:
        </h1>

        <div className="font-sans text-base md:text-11px leading-relaxed text-brand-black/90 space-y-6 text-center">
          <p>
            The pressure to figure this stuff out is no longer subtle.
          </p>

          <p>
             You read daily headlines about widespread layoffs and you’re feeling the market pressure.
          </p>

          <p>
            You’re expected to revolutionize your workflows using new tools you don’t understand.
          </p>
          
          <p>
            <i>"It’s faster if I just do it myself,"</i> you say.
          </p>
          
          <p>
            But you know deep down there is potential here if you just knew what levers to pull.
          </p>

          <p className="font-medium">
            That’s why we’re building Ahead.
          </p>

          <p>
            We connect experts who are fluent in AI with people like you who are ready to level up.
          </p>

          <p>
            We believe human intelligence is the answer to mastering artificial intelligence.
          </p>

          <p>
            Imagine all you could do if you just had the right support.
          </p>

          <div className="mt-8 mb-4 flex flex-col items-center">
             {/* Signature Image Placeholder */}
             <img 
                src="https://placehold.co/250x80/ffffff/000000?text=Joshua+A.+Brueckner&font=playfair" 
                alt="Joshua A. Brueckner Signature" 
                className="h-16 w-auto object-contain"
             />
             <div className="mt-2 font-sans text-sm font-medium text-brand-gray tracking-wider">
                Joshua Brueckner
                <div className="mt-2 font-sans text-sm font-medium text-brand-gray tracking-wider">
                </div>Founder, Ahead
             </div>
          </div>

            PS: <a href="mailto:bruecknerjoshua@gmail.com" className="inline-block mt-2 md:mt-0 md:ml-1 underline decoration-1 underline-offset-4 hover:text-blue-600 transition-colors font-medium">
               Reach out
            </a> if you're an AI expert and want to get involved. We want to meet you. 
            <br className="md:hidden"/>
        </div>
      </div>
    </div>
  );
};