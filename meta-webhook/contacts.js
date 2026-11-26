// Sotuv bo'limi → Kontaktlar (2026-11-26): numbers that are not leads —
// the office, staff, suppliers and couriers, personal ones. Added in the app
// (src/lib/contacts.ts, crm_contacts/{id}). A call to or from one opens no
// lead, gets no task, is not «not returned» and is not sales talk time.
// The list is read at most every 2 minutes.
const digits = (p) => String(p || "").replace(/\D/g, "").slice(-9);

const create = (db) => {
  let at = 0;
  let index = new Map();
  // digits → {id, name, type}
  const load = async () => {
    if (Date.now() - at < 120e3) return index;
    const snap = await db.collection("crm_contacts").get();
    index = new Map();
    for (const d of snap.docs) {
      const c = d.data();
      const k = c.digits || digits(c.phone);
      if (k.length === 9) index.set(k, { id: d.id, name: c.name || "", type: c.type || "" });
    }
    at = Date.now();
    return index;
  };
  const of = async (phone) => {
    const k = digits(phone);
    if (k.length !== 9) return null;
    return (await load()).get(k) || null;
  };
  return { load, of };
};

module.exports = { create, digits };
