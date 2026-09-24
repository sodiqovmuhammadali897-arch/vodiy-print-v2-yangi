// Verifies the website caller from their Firebase ID token and loads their
// staff record, so VPS endpoints apply the same identity as the ERP.
const { getAuth } = require("firebase-admin/auth");

const staffFromRequest = async (db, req) => {
  const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
  if (!token) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const email = String(decoded.email || "").toLowerCase();
    const staff = (await db.collection("staff").doc(email).get()).data();
    if (!staff) return null;
    return { email, name: staff.full_name || email, role: staff.role, staff };
  } catch {
    return null;
  }
};

module.exports = { staffFromRequest };
