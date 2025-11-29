const isHtmlLike = (value) =>
  typeof value === 'string' && /<!doctype html|<html[\s>]|<\/?[a-z][\s\S]*>/i.test(value.trim().slice(0, 240));

const friendlyMessage = (value) => {
  const trimmed = (value || '').trim();
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

const safeMessage = (value, fallback = 'Loops API error') => {
  if (value && typeof value === 'object') {
    const detail = value.detail || value.message || value.error;
    if (detail) return safeMessage(detail, fallback);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (isHtmlLike(trimmed)) return fallback;

    const friendly = friendlyMessage(trimmed);
    if (friendly) return friendly;

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

const normalizeApiVersion = (value) => {
  if (!value) return 'v1';
  const trimmed = value.trim();
  if (!trimmed) return 'v1';
  if (/^v\d+$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^\d+$/.test(trimmed)) return `v${trimmed}`;
  return trimmed.replace(/\/+$/g, '').replace(/^\/+/, '');
};

const normalizeApiUrl = (value, apiVersion = 'v1') => {
  if (!value) return '';

  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const baseWithApi = /\/api(\/v\d+)?$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
  const version = normalizeApiVersion(apiVersion);

  if (!version) return baseWithApi;
  if (new RegExp(`/api/${version}$`, 'i').test(baseWithApi)) return baseWithApi;
  return `${baseWithApi}/${version}`.replace(/\/+$/, '');
};

const normalizeSubscriberPath = (value) => {
  const cleaned = (value || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return cleaned || 'contacts/create';
};

const DEFAULT_LOOPS_MAILING_LIST_ID = (process.env.LOOPS_PRIMARY_LIST_ID || 'cmigcnppr0kdk0i0h7gmd8ir5').trim();

const assignMailingList = (target, id, state = true) => {
  const trimmedId = (id || '').trim();
  if (!trimmedId) return;
  if (state === null) {
    target[trimmedId] = null;
    return;
  }

  target[trimmedId] = state === false ? false : true;
};

const resolveMailingLists = (value) => {
  const lists = {};

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === 'object' && entry && !Array.isArray(entry)) {
        Object.entries(entry).forEach(([id, state]) => assignMailingList(lists, id, state));
        return;
      }
      assignMailingList(lists, entry, true);
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([id, state]) => assignMailingList(lists, id, state));
  } else if (typeof value === 'string') {
    value.split(',').forEach((id) => assignMailingList(lists, id, true));
  } else if (value != null) {
    assignMailingList(lists, String(value), true);
  }

  if (DEFAULT_LOOPS_MAILING_LIST_ID && !(DEFAULT_LOOPS_MAILING_LIST_ID in lists)) {
    assignMailingList(lists, DEFAULT_LOOPS_MAILING_LIST_ID, true);
  }

  return lists;
};

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, addDoc, collection, serverTimestamp } = require('firebase/firestore');

let firestoreInstance;

const readEnv = (key) =>
  process.env[`FIREBASE_${key}`] || process.env[`NEXT_PUBLIC_FIREBASE_${key}`] || process.env[key];

const getFirebaseConfig = () => ({
  apiKey: readEnv('API_KEY'),
  authDomain: readEnv('AUTH_DOMAIN'),
  projectId: readEnv('PROJECT_ID'),
  storageBucket: readEnv('STORAGE_BUCKET'),
  messagingSenderId: readEnv('MESSAGING_SENDER_ID'),
  appId: readEnv('APP_ID'),
});

const getFirestoreInstance = () => {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const config = getFirebaseConfig();
  const missingKeys = Object.entries({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    console.warn('Firebase configuration is incomplete. Skipping Firestore write. Missing:', missingKeys);
    return null;
  }

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  firestoreInstance = getFirestore(app);
  return firestoreInstance;
};

const recordSubscriber = async ({ email, name, source, metadata }) => {
  const db = getFirestoreInstance();
  if (!db) return false;

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;

  const docData = {
    email: normalizedEmail,
    isSubscribed: true,
    source: source || 'landing-page',
    subscribedAt: serverTimestamp(),
  };

  const trimmedName = (name || '').trim();
  if (trimmedName) {
    docData.name = trimmedName;
  }

  if (metadata && Object.keys(metadata).length > 0) {
    docData.metadata = metadata;
  }

  try {
    await addDoc(collection(db, 'newsletterSubscribers'), docData);
    console.log('Firestore: recorded subscriber', normalizedEmail, 'from', docData.source);
    return true;
  } catch (error) {
    console.error('Failed to record subscriber in Firestore:', error);
    return false;
  }
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
  const firstName = body?.firstName || body?.first_name || body?.firstname;
  const lastName = body?.lastName || body?.last_name || body?.lastname;
  const source = body?.source || 'landing-page';
  const metadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata : undefined;
  const mailingLists = resolveMailingLists(body?.mailingLists);
  if (!email || typeof email !== 'string') {
    return jsonResponse(400, { message: 'Missing email' });
  }

  const LOOPS_API_URL = normalizeApiUrl(
    process.env.LOOPS_API_URL,
    process.env.LOOPS_API_VERSION || 'v1'
  );
  const LOOPS_API_KEY = process.env.LOOPS_API_KEY?.trim();
  const LOOPS_SUBSCRIBER_PATH = normalizeSubscriberPath(process.env.LOOPS_SUBSCRIBER_PATH);

  if (!LOOPS_API_URL || !LOOPS_API_KEY) {
    return jsonResponse(500, { message: 'Server not configured' });
  }

  try {
    const endpoint = `${LOOPS_API_URL}/${LOOPS_SUBSCRIBER_PATH}`;
    const payload = { email };
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
    if (Object.keys(mailingLists).length) payload.mailingLists = mailingLists;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    if (!res.ok) {
      let detail = safeMessage(json, res.statusText);

      const hint =
        res.status === 404
          ? 'Verify LOOPS_API_URL includes the /api base (e.g., https://app.loops.so/api) and that LOOPS_SUBSCRIBER_PATH matches the Loops contacts endpoint (e.g., contacts/create).'
          : undefined;

      return {
        statusCode: res.status >= 400 && res.status < 500 ? res.status : 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Loops API error', detail, hint, endpoint }),
      };
    }

    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    const firestoreRecorded = await recordSubscriber({ email, name, source, metadata });

    return jsonResponse(200, { ok: true, loops: json, firestoreRecorded });
  } catch (err) {
    return jsonResponse(500, { message: err?.message || 'Internal error' });
  }
};

exports.handler = handler;
