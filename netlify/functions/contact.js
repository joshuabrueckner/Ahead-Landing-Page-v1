const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { message: 'Method not allowed' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (err) {
    return jsonResponse(400, { message: 'Invalid JSON' });
  }

  const { firstName, lastName, email, subject, message } = body || {};
  if (!firstName || !lastName || !email || !subject || !message) {
    return jsonResponse(400, { message: 'Missing required fields' });
  }

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY?.trim();
  const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL?.trim() || 'noreply@jumpahead.ai';
  const TO_EMAIL = 'joshua@jumpahead.ai';

  const textBody = `${message}\n\n---\nFrom: ${firstName} ${lastName} <${email}>`;

  if (SENDGRID_API_KEY) {
    try {
      const payload = {
        personalizations: [
          {
            to: [{ email: TO_EMAIL }],
            subject: `[Ahead] ${subject}`,
          },
        ],
        from: { email: FROM_EMAIL, name: `${firstName} ${lastName}` },
        content: [{ type: 'text/plain', value: textBody }],
      };

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return jsonResponse(res.status >= 400 && res.status < 500 ? res.status : 502, {
          message: 'SendGrid error',
          detail: text || res.statusText,
        });
      }

      return jsonResponse(200, { ok: true });
    } catch (err) {
      return jsonResponse(500, { message: err?.message || 'Failed to send' });
    }
  }

  // No provider configured — log and return success for now (useful for local/dev)
  console.log('Contact form submission (no SENDGRID_API_KEY):', { firstName, lastName, email, subject, message });
  return jsonResponse(200, { ok: true, note: 'No email provider configured; payload logged.' });
};
