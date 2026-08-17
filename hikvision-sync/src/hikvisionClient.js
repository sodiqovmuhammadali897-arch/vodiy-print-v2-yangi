// Talks to the device's ISAPI AccessControl event log. Field names below
// (employeeNoString, name, time, attendanceStatus) match the common
// Hikvision DS-K1T firmware response shape — if your firmware differs,
// adjust fetchAcsEvents' parsing (or log a raw event once to check).
import { digestFetch } from "./digestAuth.js";

export async function fetchAcsEvents({
  host,
  username,
  password,
  startTime,
  endTime,
  searchResultPosition = 0,
  maxResults = 30,
}) {
  const url = `http://${host}/ISAPI/AccessControl/AcsEvent?format=json`;
  const body = JSON.stringify({
    AcsEventCond: {
      searchID: crypto.randomUUID(),
      searchResultPosition,
      maxResults,
      major: 0,
      minor: 0,
      startTime,
      endTime,
    },
  });

  const res = await digestFetch(url, {
    method: "POST",
    username,
    password,
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Qurilmadan xato javob: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data?.AcsEvent?.InfoList || [];
}
