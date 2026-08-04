import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { db } from "./admin";

// Always derive the acting employee from the verified Firebase Auth ID
// token — never from client-supplied data — so one signed-in user can
// never register a passkey or check in on another employee's behalf.
export const requireStaffEmail = async (request: CallableRequest): Promise<string> => {
  const email = request.auth?.token?.email;
  if (!email) {
    throw new HttpsError("unauthenticated", "Tizimga kirish talab qilinadi");
  }
  const normalized = String(email).toLowerCase();
  const staffSnap = await db.collection("staff").doc(normalized).get();
  if (!staffSnap.exists) {
    throw new HttpsError("permission-denied", "Sizga tizimga kirish ruxsati berilmagan");
  }
  return normalized;
};

export const staffFullName = async (email: string): Promise<string> => {
  const snap = await db.collection("staff").doc(email).get();
  return (snap.data()?.full_name as string) || email;
};
