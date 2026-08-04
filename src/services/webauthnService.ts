import { httpsCallable } from "firebase/functions";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
} from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";
import { functions } from "../lib/firebase";

export const isPasskeySupported = (): boolean => browserSupportsWebAuthn();

export const isPlatformAuthenticatorAvailable = (): Promise<boolean> =>
  browserSupportsWebAuthn() ? platformAuthenticatorIsAvailable() : Promise.resolve(false);

const friendlyError = (err: unknown): Error => {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError") {
      return new Error("Tasdiqlash bekor qilindi yoki vaqt tugadi");
    }
    if (err.name === "InvalidStateError") {
      return new Error("Bu qurilma allaqachon ulangan");
    }
    return err;
  }
  return new Error("Noma'lum xatolik");
};

// Registers a new Face ID/Touch ID/Windows Hello passkey for the signed-in
// employee. All cryptographic verification happens in Cloud Functions —
// this just relays the browser ceremony.
export const registerPasskey = async (deviceName: string): Promise<void> => {
  const optionsFn = httpsCallable<Record<string, never>, PublicKeyCredentialCreationOptionsJSON>(
    functions,
    "webauthnRegisterOptions",
  );
  const { data: options } = await optionsFn({});

  let response;
  try {
    response = await startRegistration(options);
  } catch (err) {
    throw friendlyError(err);
  }

  const verifyFn = httpsCallable(functions, "webauthnRegisterVerify");
  await verifyFn({ response, deviceName });
};

// Runs the assertion ceremony and returns the raw response — used as the
// biometric proof passed into attendanceCheckIn/attendanceCheckOut.
export const getAuthenticationResponse = async (): Promise<AuthenticationResponseJSON> => {
  const optionsFn = httpsCallable<Record<string, never>, PublicKeyCredentialRequestOptionsJSON>(
    functions,
    "webauthnAuthOptions",
  );
  const { data: options } = await optionsFn({});

  try {
    return await startAuthentication(options);
  } catch (err) {
    throw friendlyError(err);
  }
};
