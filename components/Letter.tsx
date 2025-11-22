import React, { useState } from 'react';

export const Letter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Subscription failed');
      }
      setStatus('success');
      setEmail('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong');
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-col relative w-full items-center">
      {/* Letter Content */}
      <div className="flex flex-col w-full max-w-4xl items-center">
        <h1 className="text-2xl md:text-4xl font-serif mb-8 leading-tight text-brand-black text-center">
          An open letter to the{' '}
          <a
            href="https://www.forbes.com/sites/bryanrobinson/2024/09/09/77-of-employees-lost-on-how-to-use-ai-in-their-careers-new-study-shows/"
            className="text-inherit border-b border-current/30 pb-0.5"
          >
            77%
          </a>{' '}
          who feel lost with AI:
        </h1>

        <div className="font-sans text-[11px] md:text-sm leading-relaxed text-brand-black/90 space-y-6 text-center">
          <p>
            The pressure to figure this stuff out is no longer subtle.
          </p>

          <p>
            You read daily headlines about widespread layoffs and market volatility.
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

          <p className="mb-12">
            Imagine all you could do if you just had the right support.
          </p>

<br></br>
          <div className="mb-4 flex flex-col items-center">
            <img
              src="/joshua-signature.png"
              alt="Joshua A. Brueckner Signature"
              className="w-[150px] h-auto object-contain"
            />
            <div className="mt-2 font-sans text-sm font-medium text-brand-gray tracking-wider text-center">
              Joshua Brueckner
            </div>
            <div className="font-sans text-xs font-medium text-brand-gray tracking-wide text-center">
              Founder, Ahead
            </div>
          </div>

          <p>
            PS:{' '}
            <a
              href="mailto:bruecknerjoshua@gmail.com"
              className="inline-block mt-2 md:mt-0 md:ml-1 underline decoration-1 underline-offset-4 hover:text-blue-600 transition-colors font-medium"
            >
              Reach out
            </a>{' '}
            if you're an AI expert and want to get involved. We want to meet you.
          </p>
        </div>
      </div>
    </div>
  );
};