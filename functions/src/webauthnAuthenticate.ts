import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/types";
import { db } from "./admin";
import { RP_ID, ORIGIN } from "./config";
import { requireStaffEmail } from "./authGuard";
import { saveChallenge, consumeChallenge } from "./challengeStore";
import { base64urlToUint8Array } from "./lib/base64url";
import type { StoredCredential } from "./types";

export const webauthnAuthOptions = onCall(async (request) => {
  const email = await requireStaffEmail(request);

  const creds = await db
    .collection("webauthn_credentials")
    .where("employeeEmail", "==", email)
    .get();
  if (creds.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Sizda ulangan Face ID/Passkey qurilma yo'q. Avval profilingizda ulang.",
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: creds.docs.map((d) => ({
      id: base64urlToUint8Array(d.data().credentialId as string),
      type: "public-key" as const,
      transports: d.data().transports as AuthenticatorTransportFuture[] | undefined,
    })),
    userVerification: "required",
  });

  await saveChallenge(email, options.challenge, "authenticate");
  return options;
});

// Shared by attendanceCheckIn/attendanceCheckOut — verifies the biometric
// assertion server-side against the stored public key and bumps the sign
// counter, which is the only real defense against a cloned authenticator.
export const verifyAssertion = async (
  email: string,
  response: AuthenticationResponseJSON,
): Promise<void> => {
  if (!response) {
    throw new HttpsError("invalid-argument", "Tasdiqlash ma'lumoti yetishmayapti");
  }

  const expectedChallenge = await consumeChallenge(email, "authenticate");

  const credRef = db.collection("webauthn_credentials").doc(response.id);
  const credSnap = await credRef.get();
  if (!credSnap.exists || credSnap.data()?.employeeEmail !== email) {
    throw new HttpsError("permission-denied", "Qurilma tanilmadi");
  }
  const stored = credSnap.data() as StoredCredential;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    authenticator: {
      credentialID: base64urlToUint8Array(stored.credentialId),
      credentialPublicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64")),
      counter: stored.counter,
      transports: stored.transports as AuthenticatorTransportFuture[],
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new HttpsError("permission-denied", "Tasdiqlash muvaffaqiyatsiz bo'ldi");
  }

  await credRef.update({
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: new Date().toISOString(),
  });
};
