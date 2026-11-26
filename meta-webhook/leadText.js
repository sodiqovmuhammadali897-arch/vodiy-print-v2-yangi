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

// The lead's portrait from the form (owner, 2026-11-26: «amoCRM'da mijoz
// portretida ismi, tanlagan soni, qayerdanligi turibdi, sandagida faqat
// nomeri — lid qoldirilgan formaga moslab portret shakllansin»). Every answer
// is kept as filled (`form_answers`), and the ones we recognise by their
// question also fill the lead card's own fields. Keys and labels may be
// Latin or Cyrillic.
const REGIONS = ["Andijon", "Buxoro", "Farg'ona", "Jizzax", "Xorazm", "Namangan", "Navoiy", "Qashqadaryo", "Samarqand", "Sirdaryo", "Surxondaryo", "Toshkent", "Qoraqalpog'iston"];
// Region names and the bigger towns as people type them → the region.
const PLACES = [
  [/farg.?ona|fergana|ферган|фаргона|марғилон|marg.?ilon|qo.?qon|kokand|қўқон|quva|rishton|oltiariq|beshariq|bog.?dod|buvayda|dang.?ara|furqat|uchko.?prik|yozyovon|toshloq|quvasoy|ферғона/i, "Farg'ona"],
  [/andijon|andijan|андижон|андижан|asaka|xonobod|shahrixon|marhamat|qo.?rg.?ontepa|paxtaobod|baliqchi|izboskan|buloqboshi/i, "Andijon"],
  [/namangan|наманган|chust|kosonsoy|pop\b|chortoq|uychi|to.?raqo.?rg.?on|uchqo.?rg.?on|yangiqo.?rg.?on|mingbuloq|norin/i, "Namangan"],
  [/toshkent|tashkent|тошкент|ташкент|chirchiq|olmaliq|angren|bekobod|nurafshon|yangiyo.?l/i, "Toshkent"],
  [/samarqand|samarkand|самарқанд|самарканд|kattaqo.?rg.?on|urgut/i, "Samarqand"],
  [/buxoro|bukhara|бухоро|бухара|kogon|g.?ijduvon/i, "Buxoro"],
  [/xorazm|khorezm|хоразм|urganch|urgench|xiva|khiva/i, "Xorazm"],
  [/qashqadaryo|кашкадар|қашқадарё|qarshi|karshi|shahrisabz|kitob/i, "Qashqadaryo"],
  [/surxondaryo|сурхондарё|termiz|termez|denov|sherobod/i, "Surxondaryo"],
  [/jizzax|jizzakh|жиззах/i, "Jizzax"],
  [/sirdaryo|сирдарё|guliston|yangiyer|shirin/i, "Sirdaryo"],
  [/navoiy|navoi|навоий|zarafshon|uchquduq/i, "Navoiy"],
  [/qoraqalpog|karakalpak|nukus|нукус/i, "Qoraqalpog'iston"],
];
const regionOf = (text) => {
  const t = String(text || "");
  for (const [re, name] of PLACES) if (re.test(t)) return name;
  return "";
};

// What a question is about, by its key or label.
const KINDS = [
  ["name", /^(full_name|first_name)$|\bism|исм|имя|^name$|fio|ф\.?и\.?о/i],
  ["phone", /^phone(_number)?$|telefon|телефон|raqam|nomer|номер|рақам/i],
  ["brand", /brend|brand|бренд|kompaniya|company|firma|фирма|компания|tashkilot/i],
  ["region", /viloyat|вилоят|область|region/i],
  ["address", /manzil|манзил|адрес|address|shahar|шаҳар|город|city|tuman|туман|qayerdan|қаердан|joylash/i],
  ["industry", /biznes|бизнес|faoliyat|фаолият|soha|соҳа|sohangiz|deyatel|деятельн/i],
  ["product", /mahsulot|махсулот|маҳсулот|product|продукт|nima kerak|нима керак|xizmat|хизмат|tovar|товар/i],
  ["quantity", /nechta|нечта|soni|сони|miqdor|миқдор|hajm|ҳажм|хажм|qancha|қанча|количеств|tiraj|тираж/i],
  ["telegram", /telegram|телеграм/i],
];
const kindOf = (key, label) => {
  for (const [kind, re] of KINDS) if (re.test(String(key || "")) || re.test(String(label || ""))) return kind;
  return "";
};

// "100_-_200_ta" → "100 - 200 ta" (Meta's choice keys, when the form's
// questions could not be read).
const tidy = (v) => String(v || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

function leadFields(fieldData = [], questions = [], productTypes = []) {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  const out = { form_answers: [] };
  for (const f of fieldData) {
    const q = byKey.get(f.name);
    const label = String((q && q.label) || STANDARD[f.name] || tidy(f.name)).trim();
    const value = (f.values || [])
      .map((v) => {
        const opt = q && (q.options || []).find((o) => o.key === v);
        return opt ? opt.value : q ? v : tidy(v);
      })
      .join(", ")
      .trim();
    if (!value) continue;
    out.form_answers.push({ label, value });
    const kind = kindOf(f.name, label);
    if (kind === "name" && !out.full_name) out.full_name = value;
    else if (kind === "phone" && !out.phone) out.phone = value;
    else if (kind === "brand" && !out.brand) out.brand = value;
    else if (kind === "telegram" && !out.telegram) out.telegram = value;
    else if (kind === "industry" && !out.industry) out.industry = value;
    else if (kind === "region" && !out.region) out.region = regionOf(value) || value;
    else if (kind === "address") {
      out.address = out.address ? `${out.address}, ${value}` : value;
      if (!out.region) out.region = regionOf(value);
    } else if (kind === "product") {
      out.interested_product_name = out.interested_product_name ? `${out.interested_product_name}, ${value}` : value;
      const low = value.toLowerCase();
      const hits = productTypes.filter((p) => low.includes(p.toLowerCase()));
      if (hits.length) out.product_types = [...new Set([...(out.product_types || []), ...hits])];
    } else if (kind === "quantity" && !out.quantity) out.quantity = value;
  }
  if (!out.region) delete out.region;
  return out;
}

module.exports = { metaLeadText, answers, tashkentStamp, leadFields, regionOf, kindOf };
