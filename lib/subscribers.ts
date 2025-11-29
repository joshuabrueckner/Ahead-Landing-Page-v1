import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFirestoreClient } from './firebaseClient';

type SubscriberSource =
  | 'letter-inline'
  | 'newsletter-footer'
  | 'contact-form'
  | 'unknown';

export interface SubscriberRecord {
  email: string;
  name?: string;
  source?: SubscriberSource;
  metadata?: Record<string, unknown>;
}

export const addSubscriberToFirestore = async ({
  email,
  name,
  source = 'unknown',
  metadata,
}: SubscriberRecord): Promise<boolean> => {
  const db = getFirestoreClient();
  if (!db) {
    console.warn('[subscribers] Firestore is not configured. Skipping write.');
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    console.warn('[subscribers] No email provided; skipping write.');
    return false;
  }

  const docData: Record<string, unknown> = {
    email: normalizedEmail,
    isSubscribed: true,
    source,
    subscribedAt: serverTimestamp(),
  };

  if (name?.trim()) {
    docData.name = name.trim();
  }

  if (metadata && Object.keys(metadata).length > 0) {
    docData.metadata = metadata;
  }

  try {
    await addDoc(collection(db, 'newsletterSubscribers'), docData);
    return true;
  } catch (error) {
    console.error('[subscribers] Failed to record subscriber:', error);
    return false;
  }
};
