import React, { useState } from 'react';

const LOOPS_MAILING_LIST_ID = 'cmigcnppr0kdk0i0h7gmd8ir5';

export const Letter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/.netlify/functions/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          source: 'letter-inline',
          mailingLists: [LOOPS_MAILING_LIST_ID],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Subscription failed');
      }
      const result = await res.json().catch(() => ({}));
      if (!result?.firestoreRecorded) {
        console.warn('Newsletter subscribe succeeded but Firestore write missing.', result);
      }
      setStatus('success');
      setEmail('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong');
      setStatus('error');
    }
  };

  // Contact modal state & form
  const [showContact, setShowContact] = useState(false);
  const [contact, setContact] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [contactError, setContactError] = useState('');

  const openContact = () => {
    setShowContact(true);
    setContactStatus('idle');
    setContactError('');
  };
  const closeContact = () => setShowContact(false);

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContact(prev => ({ ...prev, [name]: value }));
  };

  const validateContact = () => {
    if (!contact.firstName.trim()) return 'First name is required';
    if (!contact.lastName.trim()) return 'Last name is required';
    if (!contact.email.trim()) return 'Email is required';
    if (!contact.subject.trim()) return 'Subject is required';
    if (!contact.message.trim()) return 'Message is required';
    return '';
  };

  const submitContact = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setContactError('');
    const v = validateContact();
    if (v) {
      setContactError(v);
      return;
    }
    try {
      setContactStatus('submitting');
      // Submit to Netlify Forms (static form in index.html)
      const encode = (data: Record<string, string>) =>
        Object.keys(data)
          .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
          .join('&');

      const payload: Record<string, string> = {
        'form-name': 'contact',
        'bot-field': '',
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        subject: contact.subject,
        message: contact.message,
      };

      const res = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Submission failed');
      }

      setContactStatus('success');
      // clear form
      // attempt to add to Loops (subscribe) but don't fail the primary flow if this errors
      try {
        const resp = await fetch('/.netlify/functions/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: contact.email,
            firstName: contact.firstName,
            lastName: contact.lastName,
            source: 'contact-form',
            metadata: {
              subject: contact.subject,
              message: contact.message,
            },
            mailingLists: [LOOPS_MAILING_LIST_ID],
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!data?.firestoreRecorded) {
          console.warn('Contact form recorded in Loops but not Firestore.', data);
        }
      } catch (err) {
        console.error('Loops subscribe failed', err);
      }

      setContact({ firstName: '', lastName: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setContactStatus('error');
      setContactError(err?.message || 'Failed to send');
    }
  };

  return (
    <div className="flex flex-col relative w-full items-center px-4 sm:px-6">
      {/* Letter Content */}
      <div className="flex flex-col w-full max-w-4xl items-center">
  <h1 className="text-xl sm:text-2xl md:text-4xl font-serif mb-6 md:mb-8 leading-tight text-brand-black text-center">
          An open letter to the{' '}
          <a
            href="https://www.forbes.com/sites/bryanrobinson/2024/09/09/77-of-employees-lost-on-how-to-use-ai-in-their-careers-new-study-shows/"
            className="text-inherit border-b border-current/30 pb-0.5"
            target="_blank"
            rel="noopener noreferrer"
          >
            77%
          </a>{' '}
          who feel lost with AI:
        </h1>

  <div className="font-sans text-[13px] sm:text-[11px] md:text-sm leading-relaxed text-brand-black/90 space-y-6 text-center">
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
            <i>“It’s faster if I just do it myself,”</i> you say.
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
          <div className="mb-4 flex flex-col items-center w-full">
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
            {showContact && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={closeContact} />
                <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 p-4 sm:p-6 max-h-[90vh] overflow-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Get in touch</h3>
                    <button onClick={closeContact} aria-label="Close" className="text-gray-500 hover:text-gray-700">✕</button>
                  </div>
                  <form onSubmit={submitContact} className="space-y-3">
                    {contactError && <div className="text-sm text-red-600">{contactError}</div>}
                    {contactStatus === 'success' && <div className="text-sm text-green-600">Message sent — thank you!</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input name="firstName" placeholder="First Name" value={contact.firstName} onChange={handleContactChange} className="px-3 py-3 sm:py-2 border rounded" />
                      <input name="lastName" placeholder="Last Name" value={contact.lastName} onChange={handleContactChange} className="px-3 py-3 sm:py-2 border rounded" />
                    </div>
                    <input name="email" type="email" placeholder="Email" value={contact.email} onChange={handleContactChange} className="w-full px-3 py-2 border rounded" />
                    <input name="subject" placeholder="Subject" value={contact.subject} onChange={handleContactChange} className="w-full px-3 py-2 border rounded" />
                    <textarea name="message" placeholder="Message" value={contact.message} onChange={handleContactChange} className="w-full px-3 py-2 border rounded h-28" />
                    <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
                      <button type="button" onClick={closeContact} className="w-full sm:w-auto px-4 py-3 sm:py-2 border rounded">Cancel</button>
                      <button type="submit" disabled={contactStatus === 'submitting'} className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-brand-black text-white rounded">
                        {contactStatus === 'submitting' ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>

          <p>
            PS:{' '}
            <button
              type="button"
              onClick={openContact}
              className="inline-block mt-2 md:mt-0 md:ml-1 underline decoration-1 underline-offset-4 font-medium"
            >
              Reach out
            </button>{' '}
            if you're an AI or automation expert and want to get involved. We want to meet you.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Letter;