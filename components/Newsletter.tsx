import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { NewsletterFormProps } from '../types';

export const Newsletter: React.FC<NewsletterFormProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      // Keep onSubmit for backward compatibility (e.g., analytics)
      try { onSubmit(email); } catch {}

      const res = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Subscription failed');
      }

      setIsSubmitted(true);
    } catch (err) {
      // For now, log the error and keep the form visible; we could surface the error in the UI
      console.error('Newsletter subscribe error', err);
      alert('Subscription failed — please try again.');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-end justify-between gap-8 md:gap-12">
      <div className="space-y-3 text-center md:text-left flex-1 w-full md:w-auto">
        <h2 className="text-xl md:text-2xl font-serif text-[#fdf9f1] leading-tight">
          Get notified when Ahead launches
        </h2>
        <p className="text-sm text-[#fdf9f1] font-sans font-light leading-snug max-w-md mx-auto md:mx-0">
          In the meantime, we'll send digestible AI news, written for humans.
        </p>
      </div>
        
      <div className="w-full md:w-1/2 lg:w-2/5">
        {isSubmitted ? (
           <div className="bg-green-50 border border-green-100 text-[#fdf9f1] p-3 rounded-lg flex items-center gap-3 animate-fade-in justify-center md:justify-start">
             <Check size={18} />
             <span className="text-sm font-medium">You're on the list!</span>
           </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative w-full group">
            <div className="relative flex items-center">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b border-[#fdf9f1]/40 py-3 text-sm text-[#fdf9f1] placeholder:text-[#fdf9f1]/70 focus:outline-none focus:border-[#fdf9f1] transition-all pr-10 font-sans"
                  required
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 hover:opacity-70 transition-opacity"
                  aria-label="Submit"
                >
                  <ArrowRight size={20} className="text-[#fdf9f1]" />
                </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};