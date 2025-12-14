"use server";

import admin from "firebase-admin";
import { cookies } from "next/headers";

import { getAdminFirestore } from "@/firebase/admin";
import { DEFAULT_PROMPTS } from "@/lib/prompt-defaults";

const AUTH_COOKIE_NAME = "newsroom_auth";

async function assertAuthed() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (authCookie !== "granted") {
    throw new Error("Unauthorized");
  }
}

function assertKnownPromptId(promptId: string) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_PROMPTS, promptId)) {
    throw new Error(`Unknown prompt id: ${promptId}`);
  }
}

export async function savePromptAction(input: { id: string; template: string; system?: string }) {
  await assertAuthed();

  const id = String(input?.id || "").trim();
  assertKnownPromptId(id);

  const template = String(input?.template ?? "");
  const system = typeof input?.system === "string" ? input.system : undefined;
  const systemTrimmed = system?.trim() ? system : undefined;

  const db = getAdminFirestore();
  await db
    .collection("Prompts")
    .doc(id)
    .set(
      {
        template,
        system: systemTrimmed ?? admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true };
}

export async function resetPromptAction(id: string) {
  await assertAuthed();

  const promptId = String(id || "").trim();
  assertKnownPromptId(promptId);

  const db = getAdminFirestore();
  await db.collection("Prompts").doc(promptId).delete();

  return { ok: true };
}
