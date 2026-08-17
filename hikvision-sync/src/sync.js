import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { fetchAcsEvents } from "./hikvisionClient.js";
import {
  dateCodeOf,
  hmOf,
  computeCheckInStatus,
  computeCheckOutStats,
} from "./attendanceCalculations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "..", "config.json");
const STATE_PATH = join(__dirname, "..", "state.json");

if (!existsSync(CONFIG_PATH)) {
  console.error(
    "config.json topilmadi. config.example.json'dan nusxa oling (cp config.example.json config.json) va to'ldiring.",
  );
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

let state = { lastEventTime: null };
if (existsSync(STATE_PATH)) {
  state = JSON.parse(readFileSync(STATE_PATH, "utf-8"));
}
function saveState() {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

const app = initializeApp(config.firebase);
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_SCHEDULE = {
  workStart: "09:00",
  workEnd: "18:00",
  breakStart: "13:00",
  breakEnd: "14:00",
  breakMinutes: 60,
  weeklyOffDay: 0,
};

async function getWorkSchedule() {
  const snap = await getDoc(doc(db, "work_schedules", "default"));
  return snap.exists() ? { ...DEFAULT_SCHEDULE, ...snap.data() } : DEFAULT_SCHEDULE;
}

function resolveEmail(employeeNoString, name) {
  const byNo = config.employeeMap || {};
  if (employeeNoString && byNo[employeeNoString]) return byNo[employeeNoString];
  const byName = config.employeeMapByName || {};
  const match = Object.keys(byName).find(
    (key) => key.toLowerCase() === (name || "").trim().toLowerCase(),
  );
  return match ? byName[match] : null;
}

async function processEvent(event, schedule) {
  const employeeNo = event.employeeNoString;
  const name = event.name || employeeNo;
  if (!employeeNo) return; // door/alarm events with no person attached

  const email = resolveEmail(employeeNo, name);
  if (!email) {
    console.warn(
      `[?] Xaritalanmagan xodim: ${employeeNo} (${name}) — config.json'dagi "employeeMap" ga qo'shing.`,
    );
    return;
  }

  const time = new Date(event.time);
  const dateCode = dateCodeOf(time);
  const ref = doc(db, "attendance", `${email}_${dateCode}`);
  const existingSnap = await getDoc(ref);
  const existing = existingSnap.exists() ? existingSnap.data() : null;

  // Device can be configured with on-screen attendance-status buttons
  // (Check In / Check Out); if it wasn't, infer from state: first scan of
  // the day is a check-in, the next one closes it out.
  const deviceStatus = event.attendanceStatus;
  const isCheckOut =
    deviceStatus === "checkOut" ||
    (!deviceStatus && !!existing?.checkInTimestamp && !existing?.checkOutTimestamp);

  if (!isCheckOut) {
    if (existing?.checkInTimestamp) return; // already checked in today
    const { status, lateMinutes } = computeCheckInStatus(time, schedule);
    const nowIso = time.toISOString();
    await setDoc(
      ref,
      {
        employeeId: email,
        employeeName: name,
        dateCode,
        checkInTime: hmOf(time),
        checkOutTime: null,
        checkInTimestamp: nowIso,
        checkOutTimestamp: null,
        workedMinutes: 0,
        breakMinutes: schedule.breakMinutes,
        lateMinutes,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        status,
        authenticationMethod: "hikvision",
        checkInLocation: null,
        checkOutLocation: null,
        deviceName: config.deviceName || "Hikvision terminal",
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      { merge: true },
    );
    console.log(`[+] ${name} (${email}) keldi — ${hmOf(time)}`);
  } else {
    if (!existing?.checkInTimestamp || existing?.checkOutTimestamp) return;
    const checkIn = new Date(existing.checkInTimestamp);
    const { workedMinutes, earlyLeaveMinutes, overtimeMinutes, status } = computeCheckOutStats(
      checkIn,
      time,
      schedule,
    );
    const nowIso = time.toISOString();
    await setDoc(
      ref,
      {
        checkOutTime: hmOf(time),
        checkOutTimestamp: nowIso,
        workedMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        status,
        updatedAt: nowIso,
      },
      { merge: true },
    );
    console.log(`[-] ${name} (${email}) ketdi — ${hmOf(time)}`);
  }
}

async function pollOnce() {
  const now = new Date();
  const startTime = state.lastEventTime || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const schedule = await getWorkSchedule();

  let position = 0;
  let latestTime = state.lastEventTime;
  for (;;) {
    const events = await fetchAcsEvents({
      host: config.deviceHost,
      username: config.deviceUsername,
      password: config.devicePassword,
      startTime,
      endTime: now.toISOString(),
      searchResultPosition: position,
      maxResults: 30,
    });
    if (events.length === 0) break;
    for (const event of events) {
      await processEvent(event, schedule);
      if (!latestTime || event.time > latestTime) latestTime = event.time;
    }
    if (events.length < 30) break;
    position += 30;
  }
  if (latestTime) {
    state.lastEventTime = latestTime;
    saveState();
  }
}

async function main() {
  await signInWithEmailAndPassword(auth, config.adminEmail, config.adminPassword);
  console.log("Vodiy Print'ga ulandik. Hikvision terminalni kuzatish boshlandi...");

  const intervalMs = (config.pollIntervalSeconds || 20) * 1000;
  for (;;) {
    try {
      await pollOnce();
    } catch (err) {
      console.error("Xatolik:", err instanceof Error ? err.message : err);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main();
