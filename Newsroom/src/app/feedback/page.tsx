'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { logNewsletterFeedbackAction, saveNewsletterFeedbackCommentAction } from '@/app/actions';

const VALID_SCORES = new Set([1, 3, 5]);

function normalizeEmail(value: string) {
  return (value || '').trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function FeedbackPage() {
  const params = useSearchParams();

  const email = useMemo(() => normalizeEmail(params.get('email') ?? ''), [params]);
  const score = useMemo(() => Number(params.get('score') ?? ''), [params]);
  const date = useMemo(() => params.get('date') ?? undefined, [params]);

  const [logError, setLogError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);

  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const didLogRef = useRef(false);

  useEffect(() => {
    if (didLogRef.current) return;
    didLogRef.current = true;

    setLogError(null);
    setLogged(false);

    if (!isValidEmail(email)) {
      setLogError('Invalid feedback link (missing email).');
      return;
    }

    if (!VALID_SCORES.has(score)) {
      setLogError('Invalid feedback link (missing score).');
      return;
    }

    (async () => {
      const res = await logNewsletterFeedbackAction({ email, score, date });
      if (!res.success) {
        setLogError(res.error ?? 'Failed to save response.');
        return;
      }
      setLogged(true);
    })();
  }, [email, score, date]);

  async function onSubmit() {
    setSaving(true);
    setSaved(false);
    const res = await saveNewsletterFeedbackCommentAction({ email, date, comment });
    setSaving(false);
    if (res.success) setSaved(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Thanks! Your response was saved.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We’d love to hear more if you have a second.
          </p>

          {logError ? <p className="text-sm text-destructive">{logError}</p> : null}

          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: tell us what you thought…"
            disabled={!logged || !!logError || saving}
          />

          <Button onClick={onSubmit} disabled={!logged || !!logError || saving}>
            {saving ? 'Saving…' : 'Submit'}
          </Button>

          {saved ? <p className="text-sm text-muted-foreground">Saved—thank you.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
