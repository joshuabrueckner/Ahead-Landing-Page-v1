const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) };
  }

  const email = body?.email;
  if (!email || typeof email !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing email' }) };
  }

  const LOOPS_API_URL = process.env.LOOPS_API_URL?.trim();
  const LOOPS_API_KEY = process.env.LOOPS_API_KEY?.trim();

  if (!LOOPS_API_URL || !LOOPS_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Server not configured' }) };
  }

  try {
    const endpoint = `${LOOPS_API_URL.replace(/\/$/, '')}/subscribers`;
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
      const errorMessage =
        json?.message ||
        json?.error ||
        (typeof json === 'string' && json.trim()) ||
        res.statusText ||
        'Loops API error';

      return {
        statusCode: res.status >= 400 && res.status < 500 ? res.status : 502,
        body: JSON.stringify({ message: 'Loops API error', detail: errorMessage }),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, loops: json }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err?.message || 'Internal error' }) };
  }
};

exports.handler = handler;
