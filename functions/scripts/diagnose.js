// Temporary diagnostic: impersonates a real staff member (via a custom
// token minted with the Admin SDK) and calls attendanceCheckIn directly
// over HTTP, bypassing the Firebase client SDK entirely -- that SDK
// normalizes any error it can't parse into a bare {code:'internal',
// message:'internal'}, which is exactly the symptom being chased. Talking
// to the callable HTTP endpoint raw exposes the real status/body.
const admin = require("firebase-admin");

const dateCodeOf = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

async function main() {
  admin.initializeApp({ projectId: "vodiy-print" });
  const db = admin.firestore();

  const staffSnap = await db.collection("staff").limit(1).get();
  if (staffSnap.empty) {
    console.log("NO_STAFF_DOCS_FOUND");
    return;
  }
  const email = staffSnap.docs[0].id;
  console.log("IMPERSONATING", email);

  const user = await admin.auth().getUserByEmail(email);
  const customToken = await admin.auth().createCustomToken(user.uid);

  const apiKey = process.env.WEB_API_KEY;
  const exchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const exchangeJson = await exchangeRes.json();
  if (!exchangeJson.idToken) {
    console.log("TOKEN_EXCHANGE_FAILED", JSON.stringify(exchangeJson));
    return;
  }

  const fnRes = await fetch(
    "https://us-central1-vodiy-print.cloudfunctions.net/attendanceCheckIn",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${exchangeJson.idToken}`,
      },
      body: JSON.stringify({
        data: { photoDataUrl: TINY_JPEG, deviceName: "ci-diagnostic" },
      }),
    },
  );
  console.log("STATUS", fnRes.status);
  console.log("BODY", await fnRes.text());

  const dateCode = dateCodeOf(new Date());
  const attendanceRef = db.collection("attendance").doc(`${email}_${dateCode}`);
  const attendanceSnap = await attendanceRef.get();
  if (attendanceSnap.exists && attendanceSnap.data()?.deviceName === "ci-diagnostic") {
    await attendanceRef.delete();
    console.log("CLEANED_UP_DIAGNOSTIC_RECORD");
  }
}

main().catch((err) => {
  console.error("SCRIPT_ERROR", err);
  process.exit(1);
});
