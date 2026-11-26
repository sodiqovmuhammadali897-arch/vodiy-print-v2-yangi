// The Telegram message for a Meta (Facebook/Instagram) form lead, the way
// the owner asked (2026-11-26, with an example): «formada qanday
// to'ldirilsa shunday jo'natishi kerak» — the form's name, every answer as
// the customer filled it, the source and the time:
//
//   🧾 Nomi: Vodiy print 9
//   📝 Ma'lumotlar:
//       Ismi: Mehrishoda
//       Telefon: 886525000
//       Nechta: 100 - 200 ta
//   ℹ️ Manba: Instagram
//   📆 Sana: 26-11-2026 14:55:30
//
// Question labels and choice texts come from the form itself when known
// (`questions`: [{key, label, options:[{key, value}]}]); otherwise the
// field's own name and value are shown as Meta sent them.

const TZ = 5 * 3600e3;
const pad = (n) => String(n).padStart(2, "0");

// "2026-11-26T09:55:30+0000" → "26-11-2026 14:55:30" (Tashkent).
function tashkentStamp(iso) {
  const ms = Date.parse(String(iso || "").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  const d = new Date((Number.isFinite(ms) ? ms : Date.now()) + TZ);
  return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Meta's standard keys get a plain label; custom ones keep the form's text.
const STANDARD = { full_name: "Ism", first_name: "Ism", last_name: "Familiya", phone_number: "Telefon", email: "Email", city: "Shahar", company_name: "Kompaniya", job_title: "Lavozim" };

function answers(fieldData = [], questions = []) {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  return fieldData.map((f) => {
    const q = byKey.get(f.name);
    const label = (q && q.label) || STANDARD[f.name] || f.name;
    const values = (f.values || []).map((v) => {
      const opt = q && (q.options || []).find((o) => o.key === v);
      return opt ? opt.value : v;
    });
    return { label: String(label).trim(), value: values.join(", ") };
  });
}

function metaLeadText({ formName = "", fieldData = [], questions = [], platform = "", createdTime = "", leadNumber = "", campaignName = "", adName = "", url = "" }) {
  const rows = answers(fieldData, questions).filter((a) => a.value !== "");
  const source = platform === "ig" ? "Instagram" : platform === "fb" ? "Facebook" : platform || "Facebook / Instagram";
  return [
    `🧾 Nomi: ${formName || "Meta forma"}`,
    "📝 Ma'lumotlar:",
    ...rows.map((a) => `    ${a.label}: ${a.value}`),
    `ℹ️ Manba: ${source}`,
    `📆 Sana: ${tashkentStamp(createdTime)}`,
    campaignName || adName ? `📣 Reklama: ${[campaignName, adName].filter(Boolean).join(" · ")}` : "",
    leadNumber ? `🆔 ${leadNumber}${url ? ` · ${url}` : ""}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = { metaLeadText, answers, tashkentStamp };
