import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { db } from "./admin";
import { requireStaffEmail, staffFullName } from "./authGuard";
import { verifyAssertion } from "./webauthnAuthenticate";
import { getWorkSchedule } from "./workSchedule";
import { distanceMeters } from "./lib/geo";
import { uploadAttendancePhoto } from "./lib/attendancePhoto";
import {
  computeCheckInStatus,
  computeCheckOutStats,
  dateCodeOf,
  hmOf,
} from "./lib/attendanceCalculations";
import type { AttendanceRecord } from "./types";

type CheckPayload = {
  response: AuthenticationResponseJSON;
  latitude?: number;
  longitude?: number;
  deviceName?: string;
  photoDataUrl: string;
};

const assertWithinOffice = async (latitude?: number, longitude?: number): Promise<void> => {
  const schedule = await getWorkSchedule();
  if (!schedule.gpsCheckEnabled) return;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new HttpsError(
      "failed-precondition",
      "GPS joylashuv aniqlanmadi. Iltimos joylashuvga ruxsat bering.",
    );
  }
  const distance = distanceMeters(latitude, longitude, schedule.officeLat, schedule.officeLng);
  if (distance > schedule.officeRadiusMeters) {
    throw new HttpsError(
      "permission-denied",
      "Siz ofis hududida emassiz. Davomat belgilab bo'lmaydi.",
    );
  }
};

export const attendanceCheckIn = onCall(async (request) => {
  let email = "unknown";
  try {
    email = await requireStaffEmail(request);
    const { response, latitude, longitude, deviceName, photoDataUrl } = (request.data || {}) as CheckPayload;
    if (!photoDataUrl) {
      throw new HttpsError("invalid-argument", "Selfie rasm talab qilinadi.");
    }

    await assertWithinOffice(latitude, longitude);
    await verifyAssertion(email, response);

    const now = new Date();
    const dateCode = dateCodeOf(now);
    const ref = db.collection("attendance").doc(`${email}_${dateCode}`);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.checkInTime) {
      throw new HttpsError("already-exists", "Siz bugun allaqachon ishni boshlagansiz.");
    }

    const photoUrl = await uploadAttendancePhoto(email, dateCode, "checkin", photoDataUrl);
    const schedule = await getWorkSchedule();
    const { status, lateMinutes } = computeCheckInStatus(now, schedule);
    const fullName = await staffFullName(email);
    const nowIso = now.toISOString();

    const record: AttendanceRecord = {
      employeeId: email,
      employeeName: fullName,
      dateCode,
      checkInTime: hmOf(now),
      checkOutTime: null,
      checkInTimestamp: nowIso,
      checkOutTimestamp: null,
      workedMinutes: 0,
      breakMinutes: schedule.breakMinutes,
      lateMinutes,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      status,
      authenticationMethod: "webauthn",
      checkInLocation:
        typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : null,
      checkOutLocation: null,
      checkInPhotoUrl: photoUrl,
      checkOutPhotoUrl: null,
      deviceName: deviceName?.trim() || null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await ref.set(record, { merge: true });
    return { ok: true, record };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("attendanceCheckIn failed", { email, error: err });
    throw new HttpsError(
      "internal",
      `Kutilmagan xatolik: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});

export const attendanceCheckOut = onCall(async (request) => {
  let email = "unknown";
  try {
    email = await requireStaffEmail(request);
    const { response, latitude, longitude, photoDataUrl } = (request.data || {}) as CheckPayload;
    if (!photoDataUrl) {
      throw new HttpsError("invalid-argument", "Selfie rasm talab qilinadi.");
    }

    await assertWithinOffice(latitude, longitude);
    await verifyAssertion(email, response);

    const now = new Date();
    const dateCode = dateCodeOf(now);
    const ref = db.collection("attendance").doc(`${email}_${dateCode}`);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || !data?.checkInTimestamp) {
      throw new HttpsError("failed-precondition", "Avval ishni boshlashingiz kerak.");
    }
    if (data.checkOutTime) {
      throw new HttpsError("already-exists", "Siz bugun allaqachon ishni tugatgansiz.");
    }

    const photoUrl = await uploadAttendancePhoto(email, dateCode, "checkout", photoDataUrl);
    const schedule = await getWorkSchedule();
    const checkIn = new Date(data.checkInTimestamp as string);
    const { workedMinutes, earlyLeaveMinutes, overtimeMinutes, status } = computeCheckOutStats(
      checkIn,
      now,
      schedule,
    );
    const nowIso = now.toISOString();

    await ref.update({
      checkOutTime: hmOf(now),
      checkOutTimestamp: nowIso,
      workedMinutes,
      earlyLeaveMinutes,
      overtimeMinutes,
      status,
      checkOutLocation:
        typeof latitude === "number" && typeof longitude === "number" ? { latitude, longitude } : null,
      checkOutPhotoUrl: photoUrl,
      updatedAt: nowIso,
    });

    return { ok: true, workedMinutes, earlyLeaveMinutes, overtimeMinutes, status };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error("attendanceCheckOut failed", { email, error: err });
    throw new HttpsError(
      "internal",
      `Kutilmagan xatolik: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});
