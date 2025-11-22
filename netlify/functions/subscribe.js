const isHtmlLike = (value) =>
  typeof value === 'string' && /<!doctype html|<html[\s>]|<\/?[a-z][\s\S]*>/i.test(value.trim().slice(0, 240));

const safeMessage = (value, fallback = 'Loops API error') => {
  if (value && typeof value === 'object') {
    const detail = value.detail || value.message || value.error;
    if (detail) return safeMessage(detail, fallback);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (isHtmlLike(trimmed)) return fallback;

    const normalized = trimmed.replace(/\s+/g, ' ');
    return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
  }

  return fallback;
};

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const normalizeApiUrl = (value) => {
  if (!value) return '';

  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return '';

  // Ensure the base URL points to the Loops API instead of the app root (appending /api when missing).
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
};

const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { message: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { message: 'Invalid JSON' });
  }

  const email = body?.email;
  if (!email || typeof email !== 'string') {
    return jsonResponse(400, { message: 'Missing email' });
  }

  const LOOPS_API_URL = normalizeApiUrl(process.env.LOOPS_API_URL);
  const LOOPS_API_KEY = process.env.LOOPS_API_KEY?.trim();

  if (!LOOPS_API_URL || !LOOPS_API_KEY) {
    return jsonResponse(500, { message: 'Server not configured' });
  }

  try {
    const endpoint = `${LOOPS_API_URL}/subscribers`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify({ email }),
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    if (!res.ok) {
      let detail = safeMessage(json, res.statusText);

      if (res.status === 404) {
        detail = `${detail}. Verify LOOPS_API_URL points to the /api base (e.g., https://app.loops.so/api).`;
      }

      return {
        statusCode: res.status >= 400 && res.status < 500 ? res.status : 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Loops API error', detail }),
      };
    }

    return jsonResponse(200, { ok: true, loops: json });
  } catch (err) {
    return jsonResponse(500, { message: err?.message || 'Internal error' });
  }
};

exports.handler = handler;
