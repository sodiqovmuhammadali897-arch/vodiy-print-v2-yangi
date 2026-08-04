import { HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";
import { CHALLENGE_TTL_MS } from "./config";
import type { ChallengePurpose, StoredChallenge } from "./types";

const challengeDoc = (email: string) => db.collection("webauthn_challenges").doc(email);

export const saveChallenge = async (
  email: string,
  challenge: string,
  purpose: ChallengePurpose,
): Promise<void> => {
  const now = Date.now();
  const record: StoredChallenge = {
    challenge,
    purpose,
    createdAtMs: now,
    expiresAtMs: now + CHALLENGE_TTL_MS,
  };
  await challengeDoc(email).set(record);
};

// Consuming deletes the challenge immediately so it can never be replayed,
// even if verification later fails for an unrelated reason.
export const consumeChallenge = async (
  email: string,
  purpose: ChallengePurpose,
): Promise<string> => {
  const ref = challengeDoc(email);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("failed-precondition", "So'rov muddati tugagan, qaytadan urinib ko'ring");
  }
  const data = snap.data() as StoredChallenge;
  await ref.delete();
  if (data.purpose !== purpose) {
    throw new HttpsError("failed-precondition", "So'rov turi mos kelmadi");
  }
  if (Date.now() > data.expiresAtMs) {
    throw new HttpsError("deadline-exceeded", "So'rov muddati tugagan, qaytadan urinib ko'ring");
  }
  return data.challenge;
};
