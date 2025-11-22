import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { NewsletterFormProps } from '../types';

export const Newsletter: React.FC<NewsletterFormProps> = ({ onSubmit }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const parseErrorResponse = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return res.json().catch(() => ({}));
    }

    return res.text();
  };

  const isHtmlLike = (value: unknown) =>
    typeof value === 'string' && /<!doctype html|<html[\s>]|<\/?[a-z][\s\S]*>/i.test(value.trim().slice(0, 240));

  const friendlyMessage = (value: string) => {
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower.includes('already in your audience') ||
      lower.includes('already subscribed') ||
      lower.includes('contact already exists')
    ) {
      return 'Email is already subscribed.';
    }

    if (lower === 'loops api error') return undefined;

    return undefined;
  };

  const formatError = (value: unknown, statusCode?: number) => {
    const fallback = statusCode === 404 ? 'Subscription service is unavailable.' : 'Subscription failed — please try again later.';

    if (statusCode === 404) return fallback;

    if (value && typeof value === 'object') {
      const detail = (value as { detail?: string; message?: string }).detail || (value as { message?: string }).message;
      if (detail) return formatError(detail, statusCode);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      if (isHtmlLike(trimmed)) return fallback;

      const friendly = friendlyMessage(trimmed);
      if (friendly) return friendly;

      const normalized = trimmed.replace(/\s+/g, ' ');
      return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
    }

    return fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    try {
      // Keep onSubmit for backward compatibility (e.g., analytics)
      try { onSubmit(email); } catch {}

      const res = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await parseErrorResponse(res);
        const formatted = formatError(body, res.status);
        const error = new Error(formatted);
        (error as Error & { statusCode?: number }).statusCode = res.status;
        throw error;
      }

      setError('');
      setIsSubmitted(true);
    } catch (err) {
      // For now, log the error and keep the form visible; we could surface the error in the UI
      console.error('Newsletter subscribe error', err);
      const formatted = err instanceof Error ? err.message : undefined;
      const statusCode = err instanceof Error ? (err as Error & { statusCode?: number }).statusCode : undefined;
      setError(formatError(formatted, statusCode));
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-end justify-between gap-6 md:gap-12 text-[#fdf9f1] px-4 sm:px-6">
      <div className="space-y-3 text-center md:text-left flex-1 w-full md:w-auto">
        <h2 className="text-xl md:text-2xl font-serif leading-tight">
          Get notified when Ahead launches
        </h2>
        <p className="text-sm font-sans font-light leading-snug max-w-md mx-auto md:mx-0 text-[#fdf9f1]">
          In the meantime, we'll send digestible AI news, written for humans.
        </p>
      </div>
        
  <div className="w-full md:w-1/2 lg:w-2/5">
        {isSubmitted ? (
           <div className="bg-white/10 border border-white/20 text-[#fdf9f1] p-3 rounded-lg flex items-center gap-3 animate-fade-in justify-center md:justify-start">
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
                  className="w-full bg-transparent border-b border-[#fdf9f1]/50 py-3 sm:py-4 text-sm sm:text-base placeholder:text-[#fdf9f1]/70 text-[#fdf9f1] focus:outline-none focus:border-[#fdf9f1] transition-all pr-12 font-sans"
                  required
                />
                <button
                  type="submit"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-3 sm:p-2 hover:opacity-70 transition-opacity text-[#fdf9f1]"
                  aria-label="Submit"
                >
                  <ArrowRight size={20} className="text-current" />
                </button>
            </div>
            {error && (
              <p className="mt-2 text-sm text-[#fdf9f1] text-left" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};