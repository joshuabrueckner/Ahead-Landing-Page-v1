import 'server-only';

import admin from 'firebase-admin';

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  return value.replace(/\\n/g, '\n');
}

function getServiceAccountFromEnv(): ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed === 'object') {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: normalizePrivateKey(typeof parsed.private_key === 'string' ? parsed.private_key : undefined),
        };
      }
    } catch {
      // ignore
    }
  }

  const project_id = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const client_email = process.env.FIREBASE_CLIENT_EMAIL || process.env.GA4_CLIENT_EMAIL;
  const private_key =
    normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY) ||
    normalizePrivateKey(process.env.GA4_PRIVATE_KEY);

  if (project_id && client_email && private_key) {
    return { project_id, client_email, private_key };
  }

  return null;
}

let cachedApp: admin.app.App | null = null;
let cachedDb: admin.firestore.Firestore | null = null;

function getAdminApp(): admin.app.App {
  if (cachedApp) return cachedApp;
  if (admin.apps.length) {
    cachedApp = admin.app();
    return cachedApp;
  }

  const serviceAccount = getServiceAccountFromEnv();
  if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error(
      'Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/NEXT_PUBLIC_FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL (or GA4_CLIENT_EMAIL) + FIREBASE_PRIVATE_KEY (or GA4_PRIVATE_KEY).'
    );
  }

  cachedApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: serviceAccount.project_id,
  });

  return cachedApp;
}

export function getAdminFirestore() {
  if (cachedDb) return cachedDb;

  const app = getAdminApp();
  const db = app.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  cachedDb = db;
  return db;
}
