import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, query, orderBy, runTransaction, where, getDocs } from "firebase/firestore";
import SavdoRejasiPaneli from "./components/SavdoRejasiPaneli";

/* ================= IKONKALAR ================= */
const ik = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

const IKONALAR = {
  bosh: <svg {...ik}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" /></svg>,
  kiritish: <svg {...ik}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>,
  royxat: <svg {...ik}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>,
  mijozlar: <svg {...ik}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.3" /><path d="M15.3 14.2c2.5.4 4.3 2.6 4.3 5.2" /></svg>,
  ombor: <svg {...ik}><path d="M3 8l9-5 9 5-9 5-9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>,
  moliya: <svg {...ik}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16" cy="14.5" r="1.1" /></svg>,
  hisobot: <svg {...ik}><path d="M4 19V11" /><path d="M10 19V5" /><path d="M16 19v-8" /><path d="M3 19h18" /></svg>,
  reja: <svg {...ik}><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" /></svg>,
  elonlar: <svg {...ik}><path d="M3 10v4h3l5 4V6l-5 4H3z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18.3 6.2a8 8 0 0 1 0 11.6" /></svg>,
  sozlamalar: <svg {...ik}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l1.9-1.5-1.9-3.3-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-.9-1.9 3.3 1.9 1.5c-.1.4-.1.8-.1 1.2s0 .8.1 1.2L3.2 15l1.9 3.3 2.3-.9c.6.5 1.3.9 2 1.2l.4 2.7h4.4l.4-2.7c.7-.3 1.4-.7 2-1.2l2.3.9 1.9-3.3-1.9-1.5c.1-.4.1-.8.1-1.2z" /></svg>,
};

const IKONA_CHIQISH = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17l5-5-5-5" /><path d="M20 12H9" /><path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" /></svg>;
const IKONA_QIDIRUV = <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;

/* ================= STANDART ROLLAR ================= */
const ROLLAR_STANDART = [
  { nomi: "Admin", pin: "1111", ruxsatlar: ["bosh", "kiritish", "royxat", "mijozlar", "ombor", "moliya", "hisobot", "reja", "elonlar", "sozlamalar"] },
  { nomi: "Menejer", pin: "2222", ruxsatlar: ["bosh", "kiritish", "royxat", "mijozlar", "moliya", "hisobot", "reja", "elonlar"] },
  { nomi: "Ta'minot", pin: "3333", ruxsatlar: ["bosh", "ombor", "elonlar"] },
  { nomi: "Pechatnik", pin: "4444", ruxsatlar: ["bosh", "royxat", "elonlar"] },
];

const BARCHA_BOLIMLAR = ["bosh", "kiritish", "royxat", "mijozlar", "ombor", "moliya", "hisobot", "reja", "elonlar", "sozlamalar"];

const TAB_NOMLARI = {
  bosh: "Bosh sahifa", kiritish: "Yangi buyurtma", royxat: "Buyurtmalar",
  mijozlar: "Mijozlar", ombor: "Ombor", moliya: "Moliya", hisobot: "Hisobotlar", reja: "Savdo rejasi", elonlar: "Yangiliklar", sozlamalar: "Sozlamalar",
};

const SHAHARLAR = ["Farg'ona", "Namangan", "Andijon", "Qo'qon", "Marg'ilon", "Boshqa"];
const OY_NOMLARI = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const MAHSULOT_TURLARI = ["Tipografiya", "Poligrafiya", "Tashqi reklama"];
const BAJARUVCHILAR = ["Kansprint", "Alfa print", "Primepress", "Boshqa"];

function oyNomiKorsat(oyKod) {
  if (!oyKod) return "—";
  const [yil, oy] = oyKod.split("-");
  return `${OY_NOMLARI[Number(oy) - 1]} ${yil}`;
}

/* ================= YORDAMCHI FUNKSIYALAR ================= */
const HOLATLAR = ["Yangi", "Ishlab chiqarilmoqda", "Tayyor", "Topshirildi"];

function holatRangi(holat) {
  if (holat === "Yangi") return { bg: "#E6F7FD", text: "#0089BD" };
  if (holat === "Ishlab chiqarilmoqda") return { bg: "#FFF7DE", text: "#8A6D00" };
  if (holat === "Tayyor") return { bg: "#FDE7F3", text: "#B00074" };
  return { bg: "#E6FCEB", text: "#1E7A34" };
}

function sumFormat(n) {
  const son = Number(n) || 0;
  return son.toLocaleString("uz-UZ") + " so'm";
}

function qolganVaqtHisoblash(topshiriladiganKun) {
  if (!topshiriladiganKun) return null;
  const maqsad = new Date(topshiriladiganKun + "T23:59:59");
  const farq = maqsad.getTime() - Date.now();
  const kechikkan = farq < 0;
  const abs = Math.abs(farq);
  const kun = Math.floor(abs / (1000 * 60 * 60 * 24));
  const soat = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const matn = kun > 0 ? `${kun} kun ${soat} soat` : `${soat} soat`;
  return { matn, kechikkan, kunSoni: kun };
}

function oxirgi7KunHisoblash(buyurtmalar) {
  const natija = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const sanaStr = d.toISOString().slice(0, 10);
    const soni = buyurtmalar.filter((b) => b.qabulKuni === sanaStr).length;
    natija.push({ sana: sanaStr, kun: d.getDate(), soni });
  }
  return natija;
}

function guruhlaHisobot(buyurtmalar, kalitFn, boshqaYorliq = "Belgilanmagan") {
  const xarita = new Map();
  buyurtmalar.forEach((b) => {
    let kalit = kalitFn(b);
    if (!kalit || String(kalit).trim() === "") kalit = boshqaYorliq;
    const mavjud = xarita.get(kalit) || { nom: kalit, soni: 0, summa: 0 };
    mavjud.soni += 1;
    mavjud.summa += b.umumiySumma || 0;
    xarita.set(kalit, mavjud);
  });
  return Array.from(xarita.values()).sort((a, b) => b.soni - a.soni);
}

function mahsulotHisobotiHisobla(buyurtmalar) {
  const xarita = new Map();
  buyurtmalar.forEach((b) => {
    const kalit = (b.mahsulotNomi || "Nomsiz").trim().toLowerCase();
    const korsatishNomi = (b.mahsulotNomi || "Nomsiz").trim();
    const mavjud = xarita.get(kalit) || { nom: korsatishNomi, buyurtmaSoni: 0, jamiDona: 0, summa: 0 };
    mavjud.buyurtmaSoni += 1;
    mavjud.jamiDona += b.jamiSoni || 0;
    mavjud.summa += b.umumiySumma || 0;
    xarita.set(kalit, mavjud);
  });
  return Array.from(xarita.values()).sort((a, b) => b.jamiDona - a.jamiDona);
}

const BUGUN = new Date().toISOString().slice(0, 10);
const JORIY_OY = BUGUN.slice(0, 7);

const BO_SH_FORMA = {
  mijozIsmi: "", telefon: "", telegramUser: "", shahar: "", shaharBoshqa: "",
  brendNomi: "", mahsulotNomi: "", mahsulotTuri: "", bajaruvchi: "", bajaruvchiBoshqa: "",
  variantliMi: false, soni: "", variantlar: [],
  donaNarxi: "", avans: "",
  qabulKuni: BUGUN, topshiriladiganKun: "",
  fayleHavolasi: "", rasm: null, fayl: null,
  izoh: "",
};

const OLCHAM_BIRLIKLARI = ["dona", "kg", "m", "rulon", "varaq"];
const OLCHAMLAR = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];

const BO_SH_MATERIAL_FORMA = {
  nomi: "", birlik: "dona", variantliMi: false, soni: "",
  minimalZaxira: "", yetkazibBeruvchi: "", narxi: "", variantlar: [], xaridMi: true,
};

const CHIQIM_KATEGORIYALARI = ["Material xaridi", "Ijara", "Ish haqi", "Transport", "Kommunal", "Boshqa"];
const TOLOV_TURLARI = ["Naqt", "Karta", "O'tkazma"];

const BO_SH_MOLIYA_FORMA = { turi: "Chiqim", summa: "", kategoriya: "", kimga: "", tolovTuri: "Naqt", izoh: "", sana: BUGUN };

const BO_SH_MIJOZ_FORMA = { ism: "", telefon: "", telegramUser: "", manzil: "", izoh: "" };

const BO_SH_KOMPANIYA = { nomi: "Vodiy Print", telefon: "", manzil: "" };

const BO_SH_ELON_FORMA = { sarlavha: "", matn: "" };

/* ================= FIREBASE'GA ULANGAN UMUMIY HOOK ================= */
function useFirebaseCollection(nomi) {
  const [royxat, setRoyxat] = useState([]);
  const [yuklandi, setYuklandi] = useState(false);
  const [xato, setXato] = useState("");

  useEffect(() => {
    const q = query(collection(db, nomi), orderBy("yaratilganVaqt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRoyxat(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setYuklandi(true);
      },
      (e) => {
        setXato(e.code + ": " + e.message);
        setYuklandi(true);
      }
    );
    return () => unsubscribe();
  }, [nomi]);

  return { royxat, yuklandi, xato };
}

/* ================= TOAST ================= */
function ToastKonteyner({ toastlar }) {
  return (
    <div style={{ position: "fixed", top: "18px", right: "18px", zIndex: 999, display: "flex", flexDirection: "column", gap: "8px" }}>
      {toastlar.map((t) => (
        <div key={t.id} style={{ padding: "12px 18px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", minWidth: "220px", background: t.turi === "xato" ? "#FDECEC" : "#E6FCEB", color: t.turi === "xato" ? "#B3261E" : "#1E7A34", boxShadow: "0 4px 14px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.05)" }}>
          {t.matn}
        </div>
      ))}
    </div>
  );
}

/* ================= KICHIK GRAFIK ================= */
function MiniGrafik({ malumot }) {
  const max = Math.max(1, ...malumot.map((m) => m.soni));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "110px", padding: "8px 4px 0" }}>
      {malumot.map((m) => (
        <div key={m.sana} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
          <div style={{ fontSize: "11px", color: "#555", marginBottom: "4px" }}>{m.soni}</div>
          <div style={{ width: "100%", maxWidth: "26px", height: `${(m.soni / max) * 70 + 4}px`, background: "#15120F", borderRadius: "4px 4px 0 0" }} />
          <div style={{ fontSize: "11px", color: "#999", marginTop: "6px" }}>{m.kun}</div>
        </div>
      ))}
    </div>
  );
}

/* ================= TAQSIMOT (HORIZONTAL BAR) RO'YXATI ================= */
function TaqsimotRoyxati({ malumot, birlik = "ta" }) {
  if (malumot.length === 0) return <p style={{ color: "#777", fontSize: "13px" }}>Ma'lumot yo'q.</p>;
  const max = Math.max(1, ...malumot.map((m) => m.soni));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {malumot.map((m) => (
        <div key={m.nom}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
            <span style={{ fontWeight: "600", color: "#15120F" }}>{m.nom}</span>
            <span style={{ color: "#777" }}>{m.soni} {birlik} · {sumFormat(m.summa)}</span>
          </div>
          <div style={{ background: "#f2f2f2", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div style={{ width: `${(m.soni / max) * 100}%`, background: "#15120F", height: "100%", borderRadius: "999px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= MAHSULOT RO'YXATI ================= */
function MahsulotRoyxati({ malumot }) {
  if (malumot.length === 0) return <p style={{ color: "#777", fontSize: "13px" }}>Ma'lumot yo'q.</p>;
  const top = malumot.slice(0, 10);
  const max = Math.max(1, ...top.map((m) => m.jamiDona));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {top.map((m) => (
        <div key={m.nom}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
            <span style={{ fontWeight: "600", color: "#15120F" }}>{m.nom}</span>
            <span style={{ color: "#777" }}>{m.jamiDona} dona · {m.buyurtmaSoni} buyurtma · {sumFormat(m.summa)}</span>
          </div>
          <div style={{ background: "#f2f2f2", borderRadius: "999px", height: "8px", overflow: "hidden" }}>
            <div style={{ width: `${(m.jamiDona / max) * 100}%`, background: "#0089BD", height: "100%", borderRadius: "999px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================= KIRISH (LOGIN) OYNASI ================= */
function KirishOynasi({ rollar, onKirish }) {
  const [pin, setPin] = useState("");
  const [xato, setXato] = useState(false);

  function raqamBosildi(raqam) {
    if (pin.length >= 4) return;
    const yangiPin = pin + raqam;
    setXato(false);
    setPin(yangiPin);
    if (yangiPin.length === 4) {
      const topilgan = rollar.find((r) => r.pin === yangiPin);
      setTimeout(() => {
        if (topilgan) { onKirish(topilgan); } else { setXato(true); setPin(""); }
      }, 150);
    }
  }

  function ochirish() { setPin(pin.slice(0, -1)); setXato(false); }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "#fff", padding: "40px", borderRadius: "14px", border: "1px solid #eee", width: "320px", textAlign: "center" }}>
        <h1 style={{ color: "#15120F", fontSize: "22px", marginBottom: "6px" }}>Vodiy Print</h1>
        <p style={{ color: "#777", fontSize: "14px", marginBottom: "24px" }}>Kirish uchun PIN-kodni kiriting</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "20px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: "44px", height: "44px", borderRadius: "8px", border: xato ? "2px solid #B3261E" : "1px solid #ccc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "bold", color: "#15120F" }}>
              {pin[i] ? "•" : ""}
            </div>
          ))}
        </div>
        {xato && <p style={{ color: "#B3261E", fontSize: "13px", marginBottom: "16px" }}>Noto'g'ri PIN-kod, qayta urinib ko'ring</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((raqam) => (
            <button key={raqam} onClick={() => raqamBosildi(raqam)} style={{ padding: "16px 0", fontSize: "18px", fontWeight: "600", border: "1px solid #eee", borderRadius: "8px", background: "#F7F5F0", cursor: "pointer", color: "#15120F" }}>{raqam}</button>
          ))}
          <div />
          <button onClick={() => raqamBosildi("0")} style={{ padding: "16px 0", fontSize: "18px", fontWeight: "600", border: "1px solid #eee", borderRadius: "8px", background: "#F7F5F0", cursor: "pointer", color: "#15120F" }}>0</button>
          <button onClick={ochirish} style={{ padding: "16px 0", fontSize: "14px", fontWeight: "600", border: "1px solid #eee", borderRadius: "8px", background: "#F7F5F0", cursor: "pointer", color: "#B3261E" }}>⌫</button>
        </div>
      </div>
    </div>
  );
}

/* ================= BITTA ROL QATORI ================= */
function RolQatori({ rol, inputStyle, onPinSaqlash, onRuxsatOzgartir, onOchir }) {
  const [pinInput, setPinInput] = useState(rol.pin);
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "16px 20px", marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <span style={{ fontWeight: "bold", fontSize: "16px" }}>{rol.nomi}</span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input style={{ ...inputStyle, width: "90px" }} maxLength={4} value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))} />
          <button onClick={() => onPinSaqlash(rol.nomi, pinInput)} style={{ padding: "8px 14px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>PIN saqlash</button>
          <button onClick={() => onOchir(rol.nomi)} style={{ padding: "8px 14px", background: "#FDECEC", color: "#B3261E", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>O'chirish</button>
        </div>
      </div>
      <div style={{ marginTop: "12px", display: "flex", flexWrap: "wrap", gap: "14px" }}>
        {BARCHA_BOLIMLAR.map((tab) => (
          <label key={tab} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
            <input type="checkbox" checked={rol.ruxsatlar.includes(tab)} onChange={(e) => onRuxsatOzgartir(rol.nomi, tab, e.target.checked)} />
            {TAB_NOMLARI[tab]}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ================= BUYURTMA KARTASI ================= */
function BuyurtmaKartasi({ b, onHolatOzgartir, onIzohQoshish, onTolovQoshish, onOchir, onTahrirlash, ochirishRuxsatBorMi }) {
  const [izohMatni, setIzohMatni] = useState("");
  const [tolovSummasi, setTolovSummasi] = useState("");
  const [izohOchiqMi, setIzohOchiqMi] = useState(false);
  const [tolovOchiqMi, setTolovOchiqMi] = useState(false);
  const [tahrirOchiqMi, setTahrirOchiqMi] = useState(false);
  const [tf, setTf] = useState(() => ({
    mahsulotNomi: b.mahsulotNomi, mahsulotTuri: b.mahsulotTuri || "", bajaruvchi: b.bajaruvchi || "", bajaruvchiBoshqa: b.bajaruvchi && !BAJARUVCHILAR.includes(b.bajaruvchi) ? b.bajaruvchi : "",
    donaNarxi: b.donaNarxi, avans: b.avans, variantliMi: !!b.variantliMi, soni: b.variantliMi ? "" : b.jamiSoni,
    variantlar: (b.variantlar || []).map((v) => ({ ...v })),
  }));

  const rang = holatRangi(b.holat);
  const qolgan = qolganVaqtHisoblash(b.topshiriladiganKun);
  const kicikInput = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "13px" };

  function izohYubor() {
    if (izohMatni.trim() === "") return;
    onIzohQoshish(b.id, izohMatni.trim());
    setIzohMatni("");
  }

  function tolovYubor() {
    const summa = Number(tolovSummasi) || 0;
    if (summa <= 0) return;
    onTolovQoshish(b.id, summa);
    setTolovSummasi("");
    setTolovOchiqMi(false);
  }

  function tfVariantQoshish() { setTf({ ...tf, variantlar: [...tf.variantlar, { id: Date.now(), olcham: "M", rang: "", soni: "" }] }); }
  function tfVariantOzgartir(id, maydon, qiymat) { setTf({ ...tf, variantlar: tf.variantlar.map((v) => (v.id === id ? { ...v, [maydon]: qiymat } : v)) }); }
  function tfVariantOchir(id) { setTf({ ...tf, variantlar: tf.variantlar.filter((v) => v.id !== id) }); }

  const tfJamiSoni = tf.variantliMi ? tf.variantlar.reduce((y, v) => y + (Number(v.soni) || 0), 0) : Number(tf.soni) || 0;
  const tfUmumiySumma = tfJamiSoni * (Number(tf.donaNarxi) || 0);
  const tfQoldiq = tfUmumiySumma - (Number(tf.avans) || 0);

  function tahrirSaqlash() {
    const bajaruvchiYakuniy = tf.bajaruvchi === "Boshqa" ? tf.bajaruvchiBoshqa : tf.bajaruvchi;
    const variantlar = tf.variantliMi ? tf.variantlar.map((v) => ({ ...v, soni: Number(v.soni) || 0 })) : [];
    onTahrirlash(b.id, {
      mahsulotNomi: tf.mahsulotNomi, mahsulotTuri: tf.mahsulotTuri, bajaruvchi: bajaruvchiYakuniy,
      donaNarxi: Number(tf.donaNarxi) || 0, avans: Number(tf.avans) || 0,
      variantliMi: tf.variantliMi, variantlar, jamiSoni: tfJamiSoni, umumiySumma: tfUmumiySumma, qoldiq: tfQoldiq,
    });
    setTahrirOchiqMi(false);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
          {b.raqam && <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#fff", background: "#15120F", padding: "3px 9px", borderRadius: "5px", fontWeight: "700" }}>{b.raqam}</span>}
          <span style={{ fontWeight: "bold", fontSize: "16px" }}>{b.mijozIsmi}</span>
          <span style={{ color: "#777", fontSize: "13px" }}>{b.telefon}</span>
          {b.telegramUser && <span style={{ color: "#0089BD", fontSize: "13px" }}>{b.telegramUser}</span>}
          {b.shahar && <span style={{ fontSize: "12px", color: "#555", border: "1px solid #ddd", borderRadius: "999px", padding: "2px 10px" }}>{b.shahar}</span>}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={b.holat} onChange={(e) => onHolatOzgartir(b.id, e.target.value)} style={{ padding: "5px 14px", borderRadius: "999px", border: "none", background: rang.bg, color: rang.text, fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>
            {HOLATLAR.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          {ochirishRuxsatBorMi && (
            <>
              <button onClick={() => setTahrirOchiqMi(!tahrirOchiqMi)} style={{ padding: "5px 12px", background: "#E6F7FD", color: "#0089BD", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                ✏️ Tahrirlash
              </button>
              <button onClick={() => onOchir(b.id)} style={{ padding: "5px 12px", background: "#FDECEC", color: "#B3261E", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                🗑 O'chirish
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: "10px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", fontSize: "13px", color: "#333" }}>
        <div><b>Brend:</b> {b.brendNomi || "—"}</div>
        <div><b>Mahsulot:</b> {b.mahsulotNomi}</div>
        <div><b>Turi:</b> {b.mahsulotTuri || "—"}</div>
        <div><b>Bajaruvchi:</b> {b.bajaruvchi || "—"}</div>
        <div><b>Jami soni:</b> {b.jamiSoni} dona</div>
        <div><b>Dona narxi:</b> {sumFormat(b.donaNarxi)}</div>
        <div><b>Umumiy summa:</b> {sumFormat(b.umumiySumma)}</div>
        <div><b>Avans:</b> {sumFormat(b.avans)}</div>
        <div><b>Qoldiq:</b> <span style={{ color: b.qoldiq > 0 ? "#B3261E" : "#1E7A34" }}>{sumFormat(b.qoldiq)}</span></div>
        <div><b>Qabul kuni:</b> {b.qabulKuni}</div>
        <div><b>Topshirish kuni:</b> {b.topshiriladiganKun || "—"}</div>
        <div><b>Qolgan vaqt:</b> {qolgan ? <span style={{ color: qolgan.kechikkan ? "#B3261E" : "#1E7A34" }}>{qolgan.kechikkan ? "Kechikkan: " : ""}{qolgan.matn}</span> : "—"}</div>
        {b.fayleHavolasi && <div><b>Fayl havolasi:</b> <a href={b.fayleHavolasi} target="_blank" rel="noreferrer">Havola</a></div>}
      </div>

      {b.variantliMi && b.variantlar && b.variantlar.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {b.variantlar.map((v) => (<span key={v.id} style={{ background: "#f2f2f2", padding: "5px 12px", borderRadius: "6px", fontSize: "13px" }}>{v.olcham} — {v.rang || "rangsiz"}: <b>{v.soni}</b> dona</span>))}
        </div>
      )}

      <div style={{ marginTop: "10px", display: "flex", gap: "16px", alignItems: "center" }}>
        {b.rasm && <img src={b.rasm.data} alt="dizayn" style={{ height: "60px", borderRadius: "6px", border: "1px solid #ddd" }} />}
        {b.fayl && <span style={{ fontSize: "12px", color: "#555" }}>📎 {b.fayl.nomi}</span>}
      </div>

      <div style={{ marginTop: "12px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        {b.qoldiq > 0 && (
          <button onClick={() => setTolovOchiqMi(!tolovOchiqMi)} style={{ padding: "6px 14px", background: "#E6FCEB", color: "#1E7A34", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
            💰 To'lov qo'shish
          </button>
        )}
        <button onClick={() => setIzohOchiqMi(!izohOchiqMi)} style={{ padding: "6px 14px", background: "#f2f2f2", color: "#555", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
          💬 Izohlar ({(b.izohlar || []).length})
        </button>
      </div>

      {tolovOchiqMi && (
        <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
          <input type="number" style={{ ...kicikInput, width: "160px" }} value={tolovSummasi} onChange={(e) => setTolovSummasi(e.target.value)} placeholder="Summa" />
          <button onClick={tolovYubor} style={{ padding: "8px 14px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>Saqlash</button>
        </div>
      )}

      {izohOchiqMi && (
        <div style={{ marginTop: "10px", borderTop: "1px solid #f2f2f2", paddingTop: "10px" }}>
          {(b.izohlar || []).map((iz, i) => (
            <div key={i} style={{ fontSize: "13px", padding: "6px 0", borderBottom: "1px solid #f7f7f7" }}>
              <b>{iz.muallif}</b> <span style={{ color: "#999", fontSize: "11px" }}>{new Date(iz.vaqt).toLocaleString("uz-UZ")}</span>
              <div style={{ color: "#333", marginTop: "2px" }}>{iz.matn}</div>
            </div>
          ))}
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <input style={{ ...kicikInput, flex: 1 }} value={izohMatni} onChange={(e) => setIzohMatni(e.target.value)} placeholder="Izoh yozing..." onKeyDown={(e) => e.key === "Enter" && izohYubor()} />
            <button onClick={izohYubor} style={{ padding: "8px 14px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>Yuborish</button>
          </div>
        </div>
      )}

      {tahrirOchiqMi && (
        <div style={{ marginTop: "14px", borderTop: "1px solid #eee", paddingTop: "14px" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#15120F", marginBottom: "10px" }}>Buyurtmani tahrirlash</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Mahsulot nomi</label>
              <input style={kicikInput} value={tf.mahsulotNomi} onChange={(e) => setTf({ ...tf, mahsulotNomi: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Mahsulot turi</label>
              <select style={kicikInput} value={tf.mahsulotTuri} onChange={(e) => setTf({ ...tf, mahsulotTuri: e.target.value })}>
                <option value="">— tanlanmagan —</option>
                {MAHSULOT_TURLARI.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Bajaruvchi</label>
              <select style={kicikInput} value={tf.bajaruvchi} onChange={(e) => setTf({ ...tf, bajaruvchi: e.target.value })}>
                <option value="">— tanlanmagan —</option>
                {BAJARUVCHILAR.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {tf.bajaruvchi === "Boshqa" && (
              <div>
                <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Bajaruvchi nomi</label>
                <input style={kicikInput} value={tf.bajaruvchiBoshqa} onChange={(e) => setTf({ ...tf, bajaruvchiBoshqa: e.target.value })} />
              </div>
            )}
            <div>
              <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Dona narxi</label>
              <input type="number" style={kicikInput} value={tf.donaNarxi} onChange={(e) => setTf({ ...tf, donaNarxi: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Avans</label>
              <input type="number" style={kicikInput} value={tf.avans} onChange={(e) => setTf({ ...tf, avans: e.target.value })} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "12px", fontSize: "13px", cursor: "pointer" }}>
            <input type="checkbox" checked={tf.variantliMi} onChange={(e) => setTf({ ...tf, variantliMi: e.target.checked })} />
            O'lcham/rang variantlari bor
          </label>

          {!tf.variantliMi && (
            <div style={{ marginTop: "8px", maxWidth: "160px" }}>
              <label style={{ fontSize: "11px", color: "#777", display: "block", marginBottom: "3px" }}>Soni</label>
              <input type="number" style={kicikInput} value={tf.soni} onChange={(e) => setTf({ ...tf, soni: e.target.value })} />
            </div>
          )}

          {tf.variantliMi && (
            <div style={{ marginTop: "10px" }}>
              {tf.variantlar.map((v) => (
                <div key={v.id} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                  <select style={{ ...kicikInput, width: "90px" }} value={v.olcham} onChange={(e) => tfVariantOzgartir(v.id, "olcham", e.target.value)}>{OLCHAMLAR.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  <input style={{ ...kicikInput, width: "130px" }} placeholder="Rang" value={v.rang} onChange={(e) => tfVariantOzgartir(v.id, "rang", e.target.value)} />
                  <input type="number" style={{ ...kicikInput, width: "90px" }} placeholder="Soni" value={v.soni} onChange={(e) => tfVariantOzgartir(v.id, "soni", e.target.value)} />
                  <button onClick={() => tfVariantOchir(v.id)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "6px 10px", cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <button onClick={tfVariantQoshish} style={{ padding: "6px 12px", background: "#e5e2da", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>+ Variant qo'shish</button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "12px" }}>
            <div style={{ background: "#f2f2f2", borderRadius: "5px", padding: "8px 10px", fontSize: "12px" }}><b>Jami soni:</b> {tfJamiSoni} dona</div>
            <div style={{ background: "#f2f2f2", borderRadius: "5px", padding: "8px 10px", fontSize: "12px" }}><b>Umumiy summa:</b> {sumFormat(tfUmumiySumma)}</div>
            <div style={{ background: "#f2f2f2", borderRadius: "5px", padding: "8px 10px", fontSize: "12px", color: tfQoldiq > 0 ? "#B3261E" : "#1E7A34" }}><b>Qoldiq:</b> {sumFormat(tfQoldiq)}</div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button onClick={tahrirSaqlash} style={{ padding: "8px 18px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>Saqlash</button>
            <button onClick={() => setTahrirOchiqMi(false)} style={{ padding: "8px 18px", background: "#e5e2da", color: "#333", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>Bekor qilish</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= MOLIYA QATORI ================= */
function MoliyaQatori({ f, onOchir, onTahrirlash }) {
  const [tahrirOchiqMi, setTahrirOchiqMi] = useState(false);
  const [tf, setTf] = useState({ turi: f.turi, kimga: f.kimga || "", tolovTuri: f.tolovTuri || "Naqt", kategoriya: f.kategoriya || "", summa: f.summa, izoh: f.izoh || "", sana: f.sana });
  const kicikInput = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "13px" };

  function saqlash() {
    onTahrirlash(f.id, { ...tf, summa: Number(tf.summa) || 0 });
    setTahrirOchiqMi(false);
  }

  if (tahrirOchiqMi) {
    return (
      <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "8px", padding: "14px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          <div><label style={{ fontSize: "11px", color: "#777" }}>Turi</label><select style={kicikInput} value={tf.turi} onChange={(e) => setTf({ ...tf, turi: e.target.value })}><option value="Kirim">Kirim</option><option value="Chiqim">Chiqim</option></select></div>
          <div><label style={{ fontSize: "11px", color: "#777" }}>Kimga/kimdan</label><input style={kicikInput} value={tf.kimga} onChange={(e) => setTf({ ...tf, kimga: e.target.value })} /></div>
          <div><label style={{ fontSize: "11px", color: "#777" }}>To'lov turi</label><select style={kicikInput} value={tf.tolovTuri} onChange={(e) => setTf({ ...tf, tolovTuri: e.target.value })}>{TOLOV_TURLARI.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={{ fontSize: "11px", color: "#777" }}>Summa</label><input type="number" style={kicikInput} value={tf.summa} onChange={(e) => setTf({ ...tf, summa: e.target.value })} /></div>
          <div><label style={{ fontSize: "11px", color: "#777" }}>Sana</label><input type="date" style={kicikInput} value={tf.sana} onChange={(e) => setTf({ ...tf, sana: e.target.value })} /></div>
          <div><label style={{ fontSize: "11px", color: "#777" }}>Izoh</label><input style={kicikInput} value={tf.izoh} onChange={(e) => setTf({ ...tf, izoh: e.target.value })} /></div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <button onClick={saqlash} style={{ padding: "7px 16px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>Saqlash</button>
          <button onClick={() => setTahrirOchiqMi(false)} style={{ padding: "7px 16px", background: "#e5e2da", color: "#333", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px" }}>Bekor qilish</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", fontSize: "13px", flexWrap: "wrap" }}>
      <span style={{ padding: "4px 12px", borderRadius: "999px", fontWeight: "600", background: f.turi === "Kirim" ? "#E6F7FD" : "#FDE7F3", color: f.turi === "Kirim" ? "#0089BD" : "#B00074" }}>{f.turi}</span>
      {f.kimga && <span style={{ fontWeight: "600", color: "#15120F" }}>{f.kimga}</span>}
      {f.tolovTuri && <span style={{ fontSize: "11px", color: "#777", border: "1px solid #ddd", borderRadius: "999px", padding: "2px 8px" }}>{f.tolovTuri}</span>}
      {f.kategoriya && <span style={{ padding: "3px 10px", borderRadius: "999px", background: "#f2f2f2", color: "#555" }}>{f.kategoriya}</span>}
      <span style={{ flex: 1, color: "#333" }}>{f.izoh || "—"}</span>
      <span style={{ fontWeight: "600" }}>{sumFormat(f.summa)}</span>
      <span style={{ color: "#999" }}>{f.sana}</span>
      {f.manba === "qolda" ? (
        <>
          <button onClick={() => setTahrirOchiqMi(true)} style={{ border: "none", background: "#E6F7FD", color: "#0089BD", borderRadius: "5px", padding: "4px 10px", cursor: "pointer" }}>✏️</button>
          <button onClick={() => onOchir(f.id)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "4px 10px", cursor: "pointer" }}>✕</button>
        </>
      ) : (
        <span style={{ fontSize: "11px", color: "#aaa", fontStyle: "italic" }}>avtomatik</span>
      )}
    </div>
  );
}

export default function App() {
  const [rollar, setRollar] = useState([]);
  const [rollarYuklandi, setRollarYuklandi] = useState(false);

  useEffect(() => {
    const rollarRef = doc(db, "sozlamalar", "rollar");
    const unsubscribe = onSnapshot(rollarRef, (snap) => {
      if (snap.exists()) { setRollar(snap.data().lista || []); } else { setDoc(rollarRef, { lista: ROLLAR_STANDART }); setRollar(ROLLAR_STANDART); }
      setRollarYuklandi(true);
    });
    return () => unsubscribe();
  }, []);

  const [kompaniya, setKompaniya] = useState(BO_SH_KOMPANIYA);
  const [kompaniyaYuklandi, setKompaniyaYuklandi] = useState(false);
  const [kompaniyaForma, setKompaniyaForma] = useState(BO_SH_KOMPANIYA);

  useEffect(() => {
    const kompRef = doc(db, "sozlamalar", "kompaniya");
    const unsubscribe = onSnapshot(kompRef, (snap) => {
      if (snap.exists()) { setKompaniya(snap.data()); setKompaniyaForma(snap.data()); } else { setDoc(kompRef, BO_SH_KOMPANIYA); setKompaniya(BO_SH_KOMPANIYA); setKompaniyaForma(BO_SH_KOMPANIYA); }
      setKompaniyaYuklandi(true);
    });
    return () => unsubscribe();
  }, []);

  const [toastlar, setToastlar] = useState([]);
  function toastKorsat(matn, turi = "muvaffaqiyat") {
    const id = Date.now() + Math.random();
    setToastlar((old) => [...old, { id, matn, turi }]);
    setTimeout(() => setToastlar((old) => old.filter((t) => t.id !== id)), 3000);
  }

  const [foydalanuvchi, setFoydalanuvchi] = useState(null);

  useEffect(() => {
    const saqlangan = sessionStorage.getItem("vodiyPrintFoydalanuvchi");
    if (saqlangan) { try { setFoydalanuvchi(JSON.parse(saqlangan)); } catch (e) {} }
  }, []);

  function kirish(rol) {
    setFoydalanuvchi(rol);
    sessionStorage.setItem("vodiyPrintFoydalanuvchi", JSON.stringify(rol));
    setOyna(rol.ruxsatlar[0]);
  }

  function chiqish() { setFoydalanuvchi(null); sessionStorage.removeItem("vodiyPrintFoydalanuvchi"); }

  const [oyna, setOyna] = useState("bosh");

  const buyurtmaHook = useFirebaseCollection("buyurtmalar");
  const omborHook = useFirebaseCollection("ombor");
  const moliyaHook = useFirebaseCollection("moliya");
  const mijozHook = useFirebaseCollection("mijozlar");
  const elonlarHook = useFirebaseCollection("elonlar");
  const oyliklarHook = useFirebaseCollection("oyliklar");

  const buyurtmalar = buyurtmaHook.royxat;
  const ombor = omborHook.royxat;
  const moliya = moliyaHook.royxat;
  const mijozlar = mijozHook.royxat;
  const elonlar = elonlarHook.royxat;
  const oyliklar = oyliklarHook.royxat;

  const hammasiYuklandi = buyurtmaHook.yuklandi && omborHook.yuklandi && moliyaHook.yuklandi && mijozHook.yuklandi && elonlarHook.yuklandi && oyliklarHook.yuklandi;
  const birortaXato = buyurtmaHook.xato || omborHook.xato || moliyaHook.xato || mijozHook.xato || elonlarHook.xato || oyliklarHook.xato;

  const [forma, setForma] = useState(BO_SH_FORMA);
  const [materialForma, setMaterialForma] = useState(BO_SH_MATERIAL_FORMA);
  const [moliyaForma, setMoliyaForma] = useState(BO_SH_MOLIYA_FORMA);
  const [moliyaFiltr, setMoliyaFiltr] = useState("Hammasi");
  const [moliyaQidiruv, setMoliyaQidiruv] = useState("");
  const [sanaDan, setSanaDan] = useState("");
  const [sanaGacha, setSanaGacha] = useState("");
  const [mijozForma, setMijozForma] = useState(BO_SH_MIJOZ_FORMA);
  const [mijozQidiruv, setMijozQidiruv] = useState("");
  const [yangiRolForma, setYangiRolForma] = useState({ nomi: "", pin: "", ruxsatlar: ["bosh"] });
  const [elonForma, setElonForma] = useState(BO_SH_ELON_FORMA);
  const [globalQidiruv, setGlobalQidiruv] = useState("");
  const [tanlanganOy, setTanlanganOy] = useState(JORIY_OY);

  function maydonOzgartir(nom, qiymat) { setForma({ ...forma, [nom]: qiymat }); }

  function faylOzgartir(nom, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setForma((old) => ({ ...old, [nom]: { nomi: file.name, data: e.target.result } })); };
    reader.readAsDataURL(file);
  }

  function buyurtmaVariantQoshish() { setForma({ ...forma, variantlar: [...forma.variantlar, { id: Date.now(), olcham: "M", rang: "", soni: "" }] }); }
  function buyurtmaVariantOzgartir(id, maydon, qiymat) { setForma({ ...forma, variantlar: forma.variantlar.map((v) => (v.id === id ? { ...v, [maydon]: qiymat } : v)) }); }
  function buyurtmaVariantOchir(id) { setForma({ ...forma, variantlar: forma.variantlar.filter((v) => v.id !== id) }); }

  const jamiSoniHozir = forma.variantliMi
    ? forma.variantlar.reduce((y, v) => y + (Number(v.soni) || 0), 0)
    : Number(forma.soni) || 0;
  const umumiySummaHozir = jamiSoniHozir * (Number(forma.donaNarxi) || 0);
  const qoldiqHozir = umumiySummaHozir - (Number(forma.avans) || 0);

  async function keyingiBuyurtmaRaqami() {
    const hisRef = doc(db, "sozlamalar", "hisoblagich");
    const joriy = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(hisRef);
      const hozirgi = snap.exists() ? snap.data().keyingiRaqam || 1 : 1;
      transaction.set(hisRef, { keyingiRaqam: hozirgi + 1 }, { merge: true });
      return hozirgi;
    });
    return "VP-" + String(joriy).padStart(3, "0");
  }

  async function qoshish() {
    if (forma.mijozIsmi.trim() === "" || forma.mahsulotNomi.trim() === "") { toastKorsat("Mijoz ismi va mahsulot nomini kiriting!", "xato"); return; }
    if (forma.izoh.trim() === "") { toastKorsat("Izoh maydonini to'ldiring!", "xato"); return; }

    let variantlar = [];
    let jamiSoni = 0;

    if (forma.variantliMi) {
      if (forma.variantlar.length === 0) { toastKorsat("Kamida bitta o'lcham/rang qatorini qo'shing!", "xato"); return; }
      variantlar = forma.variantlar.map((v) => ({ ...v, soni: Number(v.soni) || 0 }));
      jamiSoni = variantlar.reduce((y, v) => y + v.soni, 0);
      if (jamiSoni <= 0) { toastKorsat("Kamida bitta variantga son kiriting!", "xato"); return; }
    } else {
      jamiSoni = Number(forma.soni) || 0;
      if (jamiSoni <= 0) { toastKorsat("Sonini kiriting!", "xato"); return; }
    }

    const narx = Number(forma.donaNarxi) || 0;
    const avans = Number(forma.avans) || 0;
    const umumiySumma = jamiSoni * narx;
    const qoldiq = umumiySumma - avans;
    const shaharYakuniy = forma.shahar === "Boshqa" ? forma.shaharBoshqa : forma.shahar;
    const bajaruvchiYakuniy = forma.bajaruvchi === "Boshqa" ? forma.bajaruvchiBoshqa : forma.bajaruvchi;

    try {
      const raqam = await keyingiBuyurtmaRaqami();

      const buyurtmaRef = await addDoc(collection(db, "buyurtmalar"), {
        raqam,
        mijozIsmi: forma.mijozIsmi, telefon: forma.telefon, telegramUser: forma.telegramUser,
        shahar: shaharYakuniy, brendNomi: forma.brendNomi, mahsulotNomi: forma.mahsulotNomi,
        mahsulotTuri: forma.mahsulotTuri, bajaruvchi: bajaruvchiYakuniy,
        variantliMi: forma.variantliMi, variantlar, jamiSoni, donaNarxi: narx, avans, umumiySumma, qoldiq,
        qabulKuni: forma.qabulKuni, topshiriladiganKun: forma.topshiriladiganKun,
        fayleHavolasi: forma.fayleHavolasi, rasm: forma.rasm, fayl: forma.fayl,
        holat: "Yangi", kiritganKishi: foydalanuvchi.nomi,
        izohlar: [{ matn: forma.izoh.trim(), muallif: foydalanuvchi.nomi, vaqt: Date.now() }],
        yaratilganVaqt: Date.now(),
      });

      if (avans > 0) {
        await addDoc(collection(db, "moliya"), {
          turi: "Kirim", summa: avans, kategoriya: "", kimga: forma.mijozIsmi, tolovTuri: "Naqt",
          izoh: `Avans (${forma.mahsulotNomi}) — ${raqam}`, sana: forma.qabulKuni, manba: "buyurtma-avans",
          buyurtmaId: buyurtmaRef.id, yaratilganVaqt: Date.now(),
        });
      }

      setForma(BO_SH_FORMA);
      setOyna("royxat");
      toastKorsat(`Buyurtma qo'shildi! (${raqam})`);
    } catch (xato) {
      toastKorsat("Saqlashda xato: " + xato.message, "xato");
    }
  }

  async function holatTanlandi(id, yangiHolat) {
    try { await updateDoc(doc(db, "buyurtmalar", id), { holat: yangiHolat }); toastKorsat("Holat yangilandi"); } catch (xato) { toastKorsat("Yangilashda xato: " + xato.message, "xato"); }
  }

  async function izohQoshish(id, matn) {
    const buyurtma = buyurtmalar.find((b) => b.id === id);
    if (!buyurtma) return;
    const yangiIzohlar = [...(buyurtma.izohlar || []), { matn, muallif: foydalanuvchi.nomi, vaqt: Date.now() }];
    try { await updateDoc(doc(db, "buyurtmalar", id), { izohlar: yangiIzohlar }); toastKorsat("Izoh qo'shildi"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); }
  }

  async function tolovQoshish(id, summa) {
    const buyurtma = buyurtmalar.find((b) => b.id === id);
    if (!buyurtma) return;
    const yangiAvans = (buyurtma.avans || 0) + summa;
    const yangiQoldiq = buyurtma.umumiySumma - yangiAvans;
    try {
      await updateDoc(doc(db, "buyurtmalar", id), { avans: yangiAvans, qoldiq: yangiQoldiq });
      await addDoc(collection(db, "moliya"), {
        turi: "Kirim", summa, kategoriya: "", kimga: buyurtma.mijozIsmi, tolovTuri: "Naqt",
        izoh: `Qo'shimcha to'lov (${buyurtma.mahsulotNomi}) — ${buyurtma.raqam || ""}`, sana: BUGUN, manba: "buyurtma-tolov",
        buyurtmaId: id, yaratilganVaqt: Date.now(),
      });
      toastKorsat("To'lov qo'shildi!");
    } catch (xato) {
      toastKorsat("Xato: " + xato.message, "xato");
    }
  }

  async function buyurtmaTahrirlash(id, yangiMalumot) {
    try {
      await updateDoc(doc(db, "buyurtmalar", id), yangiMalumot);
      toastKorsat("Buyurtma yangilandi!");
    } catch (xato) {
      toastKorsat("Xato: " + xato.message, "xato");
    }
  }

  async function buyurtmaniOchir(id) {
    if (!window.confirm("Bu buyurtmani butunlay o'chirishga ishonchingiz komilmi? Bunga bog'liq moliyaviy yozuvlar ham o'chadi. Bu amalni qaytarib bo'lmaydi!")) return;
    try {
      const moliyaQuery = query(collection(db, "moliya"), where("buyurtmaId", "==", id));
      const moliyaSnap = await getDocs(moliyaQuery);
      await Promise.all(moliyaSnap.docs.map((d) => deleteDoc(doc(db, "moliya", d.id))));

      await deleteDoc(doc(db, "buyurtmalar", id));
      toastKorsat("Buyurtma va unga bog'liq moliyaviy yozuvlar o'chirildi");
    } catch (xato) {
      toastKorsat("Xato: " + xato.message, "xato");
    }
  }

  function variantQoshish() { setMaterialForma({ ...materialForma, variantlar: [...materialForma.variantlar, { id: Date.now(), olcham: "M", rang: "", soni: "" }] }); }
  function variantOzgartir(id, maydon, qiymat) { setMaterialForma({ ...materialForma, variantlar: materialForma.variantlar.map((v) => (v.id === id ? { ...v, [maydon]: qiymat } : v)) }); }
  function variantOchir(id) { setMaterialForma({ ...materialForma, variantlar: materialForma.variantlar.filter((v) => v.id !== id) }); }

  async function materialQoshish() {
    if (materialForma.nomi.trim() === "") { toastKorsat("Material nomini kiriting!", "xato"); return; }
    let jamiSoni = 0;
    let variantlar = [];
    if (materialForma.variantliMi) {
      if (materialForma.variantlar.length === 0) { toastKorsat("Kamida bitta variant qo'shing!", "xato"); return; }
      variantlar = materialForma.variantlar.map((v) => ({ ...v, soni: Number(v.soni) || 0 }));
      jamiSoni = variantlar.reduce((yigindi, v) => yigindi + v.soni, 0);
    } else {
      jamiSoni = Number(materialForma.soni) || 0;
    }
    const narxi = Number(materialForma.narxi) || 0;
    try {
      await addDoc(collection(db, "ombor"), {
        nomi: materialForma.nomi, birlik: materialForma.birlik, variantliMi: materialForma.variantliMi, variantlar, jamiSoni,
        minimalZaxira: Number(materialForma.minimalZaxira) || 0, yetkazibBeruvchi: materialForma.yetkazibBeruvchi, narxi, yaratilganVaqt: Date.now(),
      });
      if (narxi > 0 && jamiSoni > 0 && materialForma.xaridMi) {
        await addDoc(collection(db, "moliya"), {
          turi: "Chiqim", summa: narxi * jamiSoni, kategoriya: "Material xaridi",
          kimga: materialForma.yetkazibBeruvchi || materialForma.nomi, tolovTuri: "Naqt",
          izoh: `${materialForma.nomi} xaridi (${jamiSoni} ${materialForma.birlik})`, sana: BUGUN, manba: "material-xarid", yaratilganVaqt: Date.now(),
        });
      }
      setMaterialForma(BO_SH_MATERIAL_FORMA);
      toastKorsat("Material qo'shildi!");
    } catch (xato) {
      toastKorsat("Saqlashda xato: " + xato.message, "xato");
    }
  }

  async function materialniOchir(id) { try { await deleteDoc(doc(db, "ombor", id)); toastKorsat("Material o'chirildi"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); } }

  async function moliyaQoshish() {
    const summa = Number(moliyaForma.summa) || 0;
    if (summa <= 0) { toastKorsat("Summani kiriting!", "xato"); return; }
    if (moliyaForma.kimga.trim() === "") { toastKorsat("Kimga / kimdan maydonini kiriting!", "xato"); return; }
    try {
      await addDoc(collection(db, "moliya"), { ...moliyaForma, summa, manba: "qolda", yaratilganVaqt: Date.now() });
      setMoliyaForma(BO_SH_MOLIYA_FORMA);
      toastKorsat("Moliyaviy yozuv saqlandi!");
    } catch (xato) {
      toastKorsat("Saqlashda xato: " + xato.message, "xato");
    }
  }

  async function moliyaOchir(id) { try { await deleteDoc(doc(db, "moliya", id)); toastKorsat("Yozuv o'chirildi"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); } }

  async function moliyaTahrirlash(id, yangiMalumot) {
    try { await updateDoc(doc(db, "moliya", id), yangiMalumot); toastKorsat("Yozuv yangilandi!"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); }
  }

  async function mijozQoshish() {
    if (mijozForma.ism.trim() === "") { toastKorsat("Mijoz ismini kiriting!", "xato"); return; }
    try {
      await addDoc(collection(db, "mijozlar"), { ...mijozForma, yaratilganVaqt: Date.now() });
      setMijozForma(BO_SH_MIJOZ_FORMA);
      toastKorsat("Mijoz qo'shildi!");
    } catch (xato) {
      toastKorsat("Saqlashda xato: " + xato.message, "xato");
    }
  }

  async function mijozniOchir(id) { try { await deleteDoc(doc(db, "mijozlar", id)); toastKorsat("Mijoz o'chirildi"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); } }

  async function elonQoshish() {
    if (elonForma.sarlavha.trim() === "" || elonForma.matn.trim() === "") { toastKorsat("Sarlavha va matnni kiriting!", "xato"); return; }
    try {
      await addDoc(collection(db, "elonlar"), { ...elonForma, muallif: foydalanuvchi.nomi, yaratilganVaqt: Date.now() });
      setElonForma(BO_SH_ELON_FORMA);
      toastKorsat("E'lon joylandi!");
    } catch (xato) {
      toastKorsat("Saqlashda xato: " + xato.message, "xato");
    }
  }

  async function elonOchir(id) { try { await deleteDoc(doc(db, "elonlar", id)); toastKorsat("E'lon o'chirildi"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); } }

  async function kompaniyaSaqlash() { try { await setDoc(doc(db, "sozlamalar", "kompaniya"), kompaniyaForma); toastKorsat("Kompaniya ma'lumotlari saqlandi!"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); } }

  async function pinSaqlash(nomi, yangiPin) {
    if (yangiPin.length !== 4) { toastKorsat("PIN-kod aynan 4 ta raqamdan iborat bo'lishi kerak!", "xato"); return; }
    const yangiRollar = rollar.map((r) => (r.nomi === nomi ? { ...r, pin: yangiPin } : r));
    try { await setDoc(doc(db, "sozlamalar", "rollar"), { lista: yangiRollar }); toastKorsat(`${nomi} uchun yangi PIN saqlandi!`); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); }
  }

  async function ruxsatOzgartir(nomi, tab, yoqilganMi) {
    const yangiRollar = rollar.map((r) => {
      if (r.nomi !== nomi) return r;
      const yangiRuxsatlar = yoqilganMi ? [...r.ruxsatlar, tab] : r.ruxsatlar.filter((t) => t !== tab);
      return { ...r, ruxsatlar: yangiRuxsatlar };
    });
    try { await setDoc(doc(db, "sozlamalar", "rollar"), { lista: yangiRollar }); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); }
  }

  async function rolniOchir(nomi) {
    if (rollar.length <= 1) { toastKorsat("Kamida bitta rol qolishi kerak!", "xato"); return; }
    if (!window.confirm(`"${nomi}" rolini o'chirishga ishonchingiz komilmi?`)) return;
    try { await setDoc(doc(db, "sozlamalar", "rollar"), { lista: rollar.filter((r) => r.nomi !== nomi) }); toastKorsat("Rol o'chirildi"); } catch (xato) { toastKorsat("Xato: " + xato.message, "xato"); }
  }

  async function yangiRolQoshish() {
    if (yangiRolForma.nomi.trim() === "") { toastKorsat("Rol nomini kiriting!", "xato"); return; }
    if (yangiRolForma.pin.length !== 4) { toastKorsat("PIN-kod 4 ta raqamdan iborat bo'lishi kerak!", "xato"); return; }
    if (rollar.some((r) => r.nomi.toLowerCase() === yangiRolForma.nomi.trim().toLowerCase())) { toastKorsat("Bu nomdagi rol allaqachon mavjud!", "xato"); return; }
    if (rollar.some((r) => r.pin === yangiRolForma.pin)) { toastKorsat("Bu PIN-kod allaqachon band!", "xato"); return; }
    try {
      await setDoc(doc(db, "sozlamalar", "rollar"), { lista: [...rollar, { nomi: yangiRolForma.nomi.trim(), pin: yangiRolForma.pin, ruxsatlar: yangiRolForma.ruxsatlar }] });
      setYangiRolForma({ nomi: "", pin: "", ruxsatlar: ["bosh"] });
      toastKorsat("Yangi rol qo'shildi!");
    } catch (xato) {
      toastKorsat("Xato: " + xato.message, "xato");
    }
  }

  function yangiRolRuxsatOzgartir(tab, yoqilganMi) {
    setYangiRolForma((old) => ({ ...old, ruxsatlar: yoqilganMi ? [...old.ruxsatlar, tab] : old.ruxsatlar.filter((t) => t !== tab) }));
  }

  function zaxiraYuklabOlish() {
    const malumot = { sana: new Date().toISOString(), kompaniya, buyurtmalar, ombor, moliya, mijozlar, elonlar };
    const blob = new Blob([JSON.stringify(malumot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vodiy-print-zaxira-${BUGUN}.json`; a.click();
    URL.revokeObjectURL(url);
    toastKorsat("Zaxira nusxa yuklandi!");
  }

  const oylarRoyxati = (() => {
    const toplam = new Set();
    toplam.add(JORIY_OY);
    moliya.forEach((f) => f.sana && toplam.add(f.sana.slice(0, 7)));
    buyurtmalar.forEach((b) => b.qabulKuni && toplam.add(b.qabulKuni.slice(0, 7)));
    return Array.from(toplam).sort().reverse();
  })();

  const oylikMoliya = moliya.filter((f) => f.sana && f.sana.slice(0, 7) === tanlanganOy);
  const oylikJamiKirim = oylikMoliya.filter((f) => f.turi === "Kirim").reduce((y, f) => y + f.summa, 0);
  const oylikJamiChiqim = oylikMoliya.filter((f) => f.turi === "Chiqim").reduce((y, f) => y + f.summa, 0);
  const oylikSofFoyda = oylikJamiKirim - oylikJamiChiqim;

  const joriyOyYopilganYozuvi = oyliklar.find((o) => o.id === tanlanganOy);

  async function oyniYopish() {
    if (foydalanuvchi.nomi !== "Admin") { toastKorsat("Faqat Admin oyni yopa oladi!", "xato"); return; }
    if (!window.confirm(`${oyNomiKorsat(tanlanganOy)} oyini yopishga ishonchingiz komilmi? Bu hisobot doimiy saqlanadi.`)) return;
    try {
      await setDoc(doc(db, "oyliklar", tanlanganOy), {
        oy: tanlanganOy, jamiKirim: oylikJamiKirim, jamiChiqim: oylikJamiChiqim, sofFoyda: oylikSofFoyda,
        jamiQarzdorlik, yopganKishi: foydalanuvchi.nomi, yaratilganVaqt: Date.now(),
      });
      toastKorsat(`${oyNomiKorsat(tanlanganOy)} yopildi!`);
    } catch (xato) {
      toastKorsat("Xato: " + xato.message, "xato");
    }
  }

  const jamiBuyurtmalar = buyurtmalar.length;
  const bugunTopshiriladigan = buyurtmalar.filter((b) => b.topshiriladiganKun === BUGUN && b.holat !== "Topshirildi").length;
  const jamiQarzdorlik = buyurtmalar.reduce((yigindi, b) => yigindi + (b.qoldiq > 0 ? b.qoldiq : 0), 0);
  const kamQolganMateriallar = ombor.filter((m) => m.minimalZaxira > 0 && m.jamiSoni <= m.minimalZaxira);

  const muddatiYaqinBuyurtmalar = buyurtmalar
    .filter((b) => b.topshiriladiganKun && b.holat !== "Topshirildi")
    .map((b) => ({ ...b, qolgan: qolganVaqtHisoblash(b.topshiriladiganKun) }))
    .filter((b) => b.qolgan.kechikkan || b.qolgan.kunSoni <= 2)
    .sort((a, b) => new Date(a.topshiriladiganKun) - new Date(b.topshiriladiganKun));

  const songgiBuyurtmalar = buyurtmalar.slice(0, 5);
  const grafikMalumoti = oxirgi7KunHisoblash(buyurtmalar);
  const songgiElon = elonlar[0];

  const qarzdorBuyurtmalar = buyurtmalar.filter((b) => b.qoldiq > 0);

  const moliyaFiltrlangan = moliya.filter((f) => {
    if (moliyaFiltr !== "Hammasi" && f.turi !== moliyaFiltr) return false;
    if (sanaDan && f.sana < sanaDan) return false;
    if (sanaGacha && f.sana > sanaGacha) return false;
    if (moliyaQidiruv.trim() !== "") {
      const q = moliyaQidiruv.toLowerCase();
      const matn = `${f.kimga} ${f.izoh}`.toLowerCase();
      if (!matn.includes(q)) return false;
    }
    return true;
  });

  const mijozlarRoyxati = (() => {
    const xarita = new Map();
    mijozlar.forEach((m) => {
      xarita.set(m.ism.trim().toLowerCase(), {
        ism: m.ism, telefon: m.telefon, telegramUser: m.telegramUser, manzil: m.manzil, izoh: m.izoh,
        buyurtmaSoni: 0, jamiXarid: 0, jamiQarz: 0, qoldaQoshilganMi: true, mijozId: m.id,
      });
    });
    buyurtmalar.forEach((b) => {
      const kalit = (b.mijozIsmi || "").trim().toLowerCase();
      if (!kalit) return;
      const mavjud = xarita.get(kalit);
      if (mavjud) {
        mavjud.buyurtmaSoni += 1;
        mavjud.jamiXarid += b.umumiySumma;
        mavjud.jamiQarz += b.qoldiq > 0 ? b.qoldiq : 0;
        if (!mavjud.telefon) mavjud.telefon = b.telefon;
        if (!mavjud.telegramUser) mavjud.telegramUser = b.telegramUser;
      } else {
        xarita.set(kalit, {
          ism: b.mijozIsmi, telefon: b.telefon, telegramUser: b.telegramUser, manzil: "", izoh: "",
          buyurtmaSoni: 1, jamiXarid: b.umumiySumma, jamiQarz: b.qoldiq > 0 ? b.qoldiq : 0, qoldaQoshilganMi: false, mijozId: null,
        });
      }
    });
    return Array.from(xarita.values()).sort((a, b) => b.jamiXarid - a.jamiXarid);
  })();

  const mijozlarFiltrlangan = mijozlarRoyxati.filter((m) => {
    if (mijozQidiruv.trim() === "") return true;
    const q = mijozQidiruv.toLowerCase();
    return `${m.ism} ${m.telefon}`.toLowerCase().includes(q);
  });

  const globalNatijalar = (() => {
    if (globalQidiruv.trim().length < 2) return [];
    const q = globalQidiruv.toLowerCase();
    const natija = [];
    buyurtmalar.forEach((b) => { if (`${b.raqam} ${b.mijozIsmi} ${b.mahsulotNomi}`.toLowerCase().includes(q)) natija.push({ tur: "Buyurtma", matn: `${b.raqam || ""} — ${b.mijozIsmi} — ${b.mahsulotNomi}`, tab: "royxat" }); });
    mijozlarRoyxati.forEach((m) => { if (m.ism.toLowerCase().includes(q)) natija.push({ tur: "Mijoz", matn: m.ism, tab: "mijozlar" }); });
    ombor.forEach((m) => { if (m.nomi.toLowerCase().includes(q)) natija.push({ tur: "Material", matn: m.nomi, tab: "ombor" }); });
    return natija.slice(0, 6);
  })();

  const shaharHisoboti = guruhlaHisobot(buyurtmalar, (b) => b.shahar);
  const bajaruvchiHisoboti = guruhlaHisobot(buyurtmalar, (b) => b.bajaruvchi);
  const kiritganHisoboti = guruhlaHisobot(buyurtmalar, (b) => b.kiritganKishi, "Noma'lum (eski yozuv)");
  const mahsulotTuriHisoboti = guruhlaHisobot(buyurtmalar, (b) => b.mahsulotTuri);
  const holatHisoboti = guruhlaHisobot(buyurtmalar, (b) => b.holat);
  const mahsulotHisoboti = mahsulotHisobotiHisobla(buyurtmalar);
  const ortachaBuyurtmaQiymati = jamiBuyurtmalar > 0 ? buyurtmalar.reduce((y, b) => y + (b.umumiySumma || 0), 0) / jamiBuyurtmalar : 0;
  const ochiqMuddatliBuyurtmalar = buyurtmalar.filter((b) => b.holat !== "Topshirildi" && b.topshiriladiganKun);
  const kechikkanSoni = ochiqMuddatliBuyurtmalar.filter((b) => qolganVaqtHisoblash(b.topshiriladiganKun)?.kechikkan).length;
  const kechikishFoizi = ochiqMuddatliBuyurtmalar.length > 0 ? Math.round((kechikkanSoni / ochiqMuddatliBuyurtmalar.length) * 100) : 0;

  const inputStyle = { padding: "9px 10px", border: "1px solid #ccc", borderRadius: "5px", fontSize: "14px", width: "100%", boxSizing: "border-box" };
  const labelStyle = { fontSize: "12px", color: "#555", marginBottom: "4px", display: "block" };
  const fieldWrap = { display: "flex", flexDirection: "column" };
  const statCard = { background: "#fff", border: "1px solid #eee", borderRadius: "10px", padding: "18px 20px" };
  const statLabel = { fontSize: "13px", color: "#777", marginBottom: "6px" };
  const statVal = { fontSize: "24px", fontWeight: "bold", color: "#15120F" };
  const filtrBtn = (aktivMi) => ({ padding: "6px 16px", borderRadius: "999px", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "13px", background: aktivMi ? "#15120F" : "#e5e2da", color: aktivMi ? "#fff" : "#333" });

  if (!rollarYuklandi || !kompaniyaYuklandi) return <div style={{ padding: "60px", fontFamily: "sans-serif", textAlign: "center", color: "#777" }}>Yuklanmoqda...</div>;
  if (!foydalanuvchi) return <KirishOynasi rollar={rollar} onKirish={kirish} />;
  if (birortaXato) return <div style={{ padding: "60px", fontFamily: "sans-serif" }}><h2 style={{ color: "#B3261E" }}>Xato yuz berdi</h2><p style={{ background: "#FDECEC", padding: "16px", borderRadius: "8px", color: "#B3261E", fontFamily: "monospace" }}>{birortaXato}</p></div>;
  if (!hammasiYuklandi) return <div style={{ padding: "60px", fontFamily: "sans-serif", textAlign: "center", color: "#777" }}>Yuklanmoqda...</div>;

  const ruxsatBorMi = foydalanuvchi.ruxsatlar.includes(oyna);
  const korinadiganOyna = ruxsatBorMi ? oyna : foydalanuvchi.ruxsatlar[0];
  const ochirishRuxsatBorMi = foydalanuvchi.nomi === "Admin" || foydalanuvchi.nomi === "Menejer";

  return (
    <div className="ilova-konteyner" style={{ display: "flex", minHeight: "100vh", background: "#F7F5F0", fontFamily: "sans-serif" }}>
      <style>{`
        .yon-panel { width: 230px; flex-shrink: 0; background: #fff; border-right: 1px solid #eee; display: flex; flex-direction: column; padding: 20px 14px; }
        .menyu-tugma { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; border: none; background: transparent; cursor: pointer; font-size: 14px; font-weight: 600; color: #333; width: 100%; text-align: left; }
        .menyu-tugma.aktiv { background: #15120F; color: #fff; }
        .menyu-matn { white-space: nowrap; }
        @media (max-width: 820px) {
          .ilova-konteyner { flex-direction: column; }
          .yon-panel { width: 100%; flex-direction: row; overflow-x: auto; padding: 10px; align-items: center; }
          .brend-blok, .qidiruv-blok, .pastki-blok { display: none !important; }
          .menyu { flex-direction: row !important; flex: 1; }
          .menyu-matn { display: none; }
          .menyu-tugma { width: auto; flex-direction: column; gap: 3px; padding: 8px 10px; font-size: 10px; }
        }
      `}</style>

      <ToastKonteyner toastlar={toastlar} />

      <nav className="yon-panel">
        <div className="brend-blok" style={{ marginBottom: "18px" }}>
          <div style={{ fontWeight: "bold", fontSize: "18px", color: "#15120F" }}>{kompaniya.nomi || "Vodiy Print"}</div>
          <div style={{ fontSize: "12px", color: "#999" }}>Boshqaruv tizimi</div>
        </div>

        <div className="qidiruv-blok" style={{ position: "relative", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", border: "1px solid #ddd", borderRadius: "6px", padding: "7px 10px" }}>
            <span style={{ color: "#999" }}>{IKONA_QIDIRUV}</span>
            <input value={globalQidiruv} onChange={(e) => setGlobalQidiruv(e.target.value)} placeholder="Qidirish (VP-001)..." style={{ border: "none", outline: "none", fontSize: "13px", width: "100%" }} />
          </div>
          {globalNatijalar.length > 0 && (
            <div style={{ position: "absolute", top: "40px", left: 0, right: 0, background: "#fff", border: "1px solid #eee", borderRadius: "8px", boxShadow: "0 6px 18px rgba(0,0,0,0.1)", zIndex: 50, overflow: "hidden" }}>
              {globalNatijalar.map((n, i) => (
                <div key={i} onClick={() => { setOyna(n.tab); setGlobalQidiruv(""); }} style={{ padding: "10px 12px", fontSize: "13px", cursor: "pointer", borderBottom: "1px solid #f2f2f2" }}>
                  <span style={{ color: "#999", fontSize: "11px", marginRight: "6px" }}>{n.tur}</span>{n.matn}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="menyu" style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          {foydalanuvchi.ruxsatlar.map((tab) => (
            <button key={tab} onClick={() => setOyna(tab)} className={"menyu-tugma" + (korinadiganOyna === tab ? " aktiv" : "")}>
              {IKONALAR[tab]}
              <span className="menyu-matn">
                {TAB_NOMLARI[tab]}
                {tab === "royxat" && ` (${buyurtmalar.length})`}
                {tab === "mijozlar" && ` (${mijozlarRoyxati.length})`}
                {tab === "ombor" && ` (${ombor.length})`}
              </span>
            </button>
          ))}
        </div>

        <div className="pastki-blok" style={{ borderTop: "1px solid #eee", paddingTop: "14px", marginTop: "10px" }}>
          <div style={{ fontSize: "13px", color: "#555", marginBottom: "10px" }}><b style={{ color: "#15120F" }}>{foydalanuvchi.nomi}</b> sifatida</div>
          <button onClick={chiqish} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "9px 12px", background: "#FDECEC", color: "#B3261E", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>{IKONA_CHIQISH} Chiqish</button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: "26px 32px", overflowY: "auto" }}>
        {korinadiganOyna === "bosh" && (
          <div>
            {songgiElon && (
              <div style={{ background: "#FFF7DE", border: "1px solid #f0e2b0", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", color: "#8A6D00", fontWeight: "600", marginBottom: "4px" }}>📢 So'nggi e'lon — {songgiElon.muallif}</div>
                <div style={{ fontWeight: "bold", fontSize: "15px", color: "#15120F" }}>{songgiElon.sarlavha}</div>
                <div style={{ fontSize: "13px", color: "#555", marginTop: "4px" }}>{songgiElon.matn}</div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
              <div style={statCard}><div style={statLabel}>Jami buyurtmalar</div><div style={statVal}>{jamiBuyurtmalar}</div></div>
              <div style={statCard}><div style={statLabel}>Bugun topshiriladigan</div><div style={{ ...statVal, color: bugunTopshiriladigan > 0 ? "#B3261E" : "#15120F" }}>{bugunTopshiriladigan}</div></div>
              <div style={statCard}><div style={statLabel}>Jami qarzdorlik</div><div style={{ ...statVal, color: jamiQarzdorlik > 0 ? "#B3261E" : "#1E7A34" }}>{sumFormat(jamiQarzdorlik)}</div></div>
              <div style={statCard}><div style={statLabel}>Kam qolgan materiallar</div><div style={{ ...statVal, color: kamQolganMateriallar.length > 0 ? "#B3261E" : "#15120F" }}>{kamQolganMateriallar.length}</div></div>
            </div>
            <div style={{ ...statCard, marginBottom: "24px" }}>
              <div style={statLabel}>Oxirgi 7 kunlik buyurtmalar</div>
              <MiniGrafik malumot={grafikMalumoti} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "10px" }}>⏰ Muddati yaqin / o'tgan buyurtmalar</h2>
                {muddatiYaqinBuyurtmalar.length === 0 && <p style={{ color: "#777", fontSize: "14px" }}>Hozircha shoshilinch buyurtma yo'q.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {muddatiYaqinBuyurtmalar.map((b) => (
                    <div key={b.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><div style={{ fontWeight: "bold", fontSize: "14px" }}>{b.raqam} — {b.mijozIsmi}</div><div style={{ fontSize: "12px", color: "#777" }}>{b.mahsulotNomi}</div></div>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: b.qolgan.kechikkan ? "#B3261E" : "#8A6D00" }}>{b.qolgan.kechikkan ? "Kechikkan: " : ""}{b.qolgan.matn}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "10px" }}>📦 Kam qolgan materiallar</h2>
                {kamQolganMateriallar.length === 0 && <p style={{ color: "#777", fontSize: "14px" }}>Hozircha kam qolgan material yo'q.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {kamQolganMateriallar.map((m) => (
                    <div key={m.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "bold", fontSize: "14px" }}>{m.nomi}</span>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#B3261E" }}>{m.jamiSoni} {m.birlik} qoldi</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <h2 style={{ fontSize: "16px", color: "#15120F", marginTop: "24px", marginBottom: "10px" }}>🕓 So'nggi buyurtmalar</h2>
            {songgiBuyurtmalar.length === 0 && <p style={{ color: "#777", fontSize: "14px" }}>Hozircha buyurtma yo'q.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {songgiBuyurtmalar.map((b) => {
                const rang = holatRangi(b.holat);
                return (
                  <div key={b.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "14px", alignItems: "center" }}><span style={{ fontWeight: "bold", fontSize: "14px" }}>{b.raqam} — {b.mijozIsmi}</span><span style={{ fontSize: "13px", color: "#777" }}>{b.mahsulotNomi}</span></div>
                    <span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: rang.bg, color: rang.text }}>{b.holat}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {korinadiganOyna === "kiritish" && (
          <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee" }}>
            <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Yangi buyurtma kiritish</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
              <div style={fieldWrap}><label style={labelStyle}>Mijoz ismi</label><input style={inputStyle} value={forma.mijozIsmi} onChange={(e) => maydonOzgartir("mijozIsmi", e.target.value)} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Telefon raqami</label><input style={inputStyle} value={forma.telefon} onChange={(e) => maydonOzgartir("telefon", e.target.value)} placeholder="+998 90 123 45 67" /></div>
              <div style={fieldWrap}><label style={labelStyle}>Telegram useri</label><input style={inputStyle} value={forma.telegramUser} onChange={(e) => maydonOzgartir("telegramUser", e.target.value)} placeholder="@username" /></div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Shahar</label>
                <select style={inputStyle} value={forma.shahar} onChange={(e) => maydonOzgartir("shahar", e.target.value)}>
                  <option value="">— tanlang —</option>
                  {SHAHARLAR.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {forma.shahar === "Boshqa" && (
                <div style={fieldWrap}><label style={labelStyle}>Shahar nomi</label><input style={inputStyle} value={forma.shaharBoshqa} onChange={(e) => maydonOzgartir("shaharBoshqa", e.target.value)} /></div>
              )}
              <div style={fieldWrap}><label style={labelStyle}>Brend nomi</label><input style={inputStyle} value={forma.brendNomi} onChange={(e) => maydonOzgartir("brendNomi", e.target.value)} /></div>

              <div style={fieldWrap}><label style={labelStyle}>Mahsulot nomi/turi</label><input style={inputStyle} value={forma.mahsulotNomi} onChange={(e) => maydonOzgartir("mahsulotNomi", e.target.value)} placeholder="Masalan: Futbolka, Flayer, Ruchka" /></div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Mahsulot turi</label>
                <select style={inputStyle} value={forma.mahsulotTuri} onChange={(e) => maydonOzgartir("mahsulotTuri", e.target.value)}>
                  <option value="">— tanlang —</option>
                  {MAHSULOT_TURLARI.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>Bajaruvchi</label>
                <select style={inputStyle} value={forma.bajaruvchi} onChange={(e) => maydonOzgartir("bajaruvchi", e.target.value)}>
                  <option value="">— tanlang —</option>
                  {BAJARUVCHILAR.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {forma.bajaruvchi === "Boshqa" && (
                <div style={fieldWrap}><label style={labelStyle}>Bajaruvchi nomi</label><input style={inputStyle} value={forma.bajaruvchiBoshqa} onChange={(e) => maydonOzgartir("bajaruvchiBoshqa", e.target.value)} /></div>
              )}

              <div style={fieldWrap}><label style={labelStyle}>Bitta dona narxi</label><input type="number" style={inputStyle} value={forma.donaNarxi} onChange={(e) => maydonOzgartir("donaNarxi", e.target.value)} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Avans</label><input type="number" style={inputStyle} value={forma.avans} onChange={(e) => maydonOzgartir("avans", e.target.value)} /></div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "20px", fontSize: "14px", cursor: "pointer" }}>
              <input type="checkbox" checked={forma.variantliMi} onChange={(e) => maydonOzgartir("variantliMi", e.target.checked)} />
              Bu mahsulotda o'lcham / rang variantlari bor (masalan futbolka, svitshot)
            </label>

            {!forma.variantliMi && (
              <div style={{ marginTop: "12px", maxWidth: "200px" }}>
                <label style={labelStyle}>Soni (dona)</label>
                <input type="number" style={inputStyle} value={forma.soni} onChange={(e) => maydonOzgartir("soni", e.target.value)} placeholder="Masalan: 3000 yoki 10" />
              </div>
            )}

            {forma.variantliMi && (
              <div style={{ marginTop: "16px" }}>
                <label style={{ ...labelStyle, fontSize: "13px", fontWeight: 600, color: "#15120F" }}>O'lcham / rang / soni</label>
                {forma.variantlar.map((v) => (
                  <div key={v.id} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px", marginTop: "6px" }}>
                    <select style={{ ...inputStyle, width: "100px" }} value={v.olcham} onChange={(e) => buyurtmaVariantOzgartir(v.id, "olcham", e.target.value)}>{OLCHAMLAR.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <input style={{ ...inputStyle, width: "160px" }} placeholder="Rang (masalan: Oq)" value={v.rang} onChange={(e) => buyurtmaVariantOzgartir(v.id, "rang", e.target.value)} />
                    <input type="number" style={{ ...inputStyle, width: "100px" }} placeholder="Soni" value={v.soni} onChange={(e) => buyurtmaVariantOzgartir(v.id, "soni", e.target.value)} />
                    <button onClick={() => buyurtmaVariantOchir(v.id)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "8px 12px", cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                <button onClick={buyurtmaVariantQoshish} style={{ marginTop: "4px", padding: "8px 16px", background: "#e5e2da", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>+ O'lcham/rang qo'shish</button>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginTop: "20px" }}>
              <div style={fieldWrap}><label style={labelStyle}>Jami soni (avtomatik)</label><input style={{ ...inputStyle, background: "#f2f2f2" }} readOnly value={`${jamiSoniHozir} dona`} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Umumiy summa (avtomatik)</label><input style={{ ...inputStyle, background: "#f2f2f2" }} readOnly value={sumFormat(umumiySummaHozir)} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Qoldiq (avtomatik)</label><input style={{ ...inputStyle, background: "#f2f2f2", color: qoldiqHozir > 0 ? "#B3261E" : "#1E7A34", fontWeight: 600 }} readOnly value={sumFormat(qoldiqHozir)} /></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginTop: "14px" }}>
              <div style={fieldWrap}><label style={labelStyle}>Qabul qilingan kun</label><input type="date" style={inputStyle} value={forma.qabulKuni} onChange={(e) => maydonOzgartir("qabulKuni", e.target.value)} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Topshiriladigan kun</label><input type="date" style={inputStyle} value={forma.topshiriladiganKun} onChange={(e) => maydonOzgartir("topshiriladiganKun", e.target.value)} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Fayl havolasi</label><input style={inputStyle} value={forma.fayleHavolasi} onChange={(e) => maydonOzgartir("fayleHavolasi", e.target.value)} placeholder="https://t.me/... yoki Drive link" /></div>
              <div style={fieldWrap}><label style={labelStyle}>Dizayn rasmi</label><input type="file" accept="image/*" style={inputStyle} onChange={(e) => faylOzgartir("rasm", e.target.files[0])} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Qo'shimcha fayl</label><input type="file" style={inputStyle} onChange={(e) => faylOzgartir("fayl", e.target.files[0])} /></div>
            </div>

            <div style={{ marginTop: "14px" }}>
              <label style={labelStyle}>Izoh (majburiy)</label>
              <textarea style={{ ...inputStyle, minHeight: "80px" }} value={forma.izoh} onChange={(e) => maydonOzgartir("izoh", e.target.value)} placeholder="Buyurtma haqida izoh (masalan: mijozning maxsus talabi, yetkazib berish tafsiloti va h.k.)" />
            </div>

            <button onClick={qoshish} style={{ marginTop: "20px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Buyurtmani qo'shish</button>
          </div>
        )}

        {korinadiganOyna === "royxat" && (
          <div>
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "12px" }}>Buyurtmalar ({buyurtmalar.length})</h2>
            {buyurtmalar.length === 0 && <p style={{ color: "#777" }}>Hozircha buyurtma yo'q.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {buyurtmalar.map((b) => (
                <BuyurtmaKartasi
                  key={b.id}
                  b={b}
                  onHolatOzgartir={holatTanlandi}
                  onIzohQoshish={izohQoshish}
                  onTolovQoshish={tolovQoshish}
                  onOchir={buyurtmaniOchir}
                  onTahrirlash={buyurtmaTahrirlash}
                  ochirishRuxsatBorMi={ochirishRuxsatBorMi}
                />
              ))}
            </div>
          </div>
        )}

        {korinadiganOyna === "mijozlar" && (
          <div>
            <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Yangi mijoz qo'shish</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                <div style={fieldWrap}><label style={labelStyle}>Ism</label><input style={inputStyle} value={mijozForma.ism} onChange={(e) => setMijozForma({ ...mijozForma, ism: e.target.value })} /></div>
                <div style={fieldWrap}><label style={labelStyle}>Telefon</label><input style={inputStyle} value={mijozForma.telefon} onChange={(e) => setMijozForma({ ...mijozForma, telefon: e.target.value })} placeholder="+998 90 123 45 67" /></div>
                <div style={fieldWrap}><label style={labelStyle}>Telegram useri</label><input style={inputStyle} value={mijozForma.telegramUser} onChange={(e) => setMijozForma({ ...mijozForma, telegramUser: e.target.value })} placeholder="@username" /></div>
                <div style={fieldWrap}><label style={labelStyle}>Manzil</label><input style={inputStyle} value={mijozForma.manzil} onChange={(e) => setMijozForma({ ...mijozForma, manzil: e.target.value })} /></div>
                <div style={{ ...fieldWrap, gridColumn: "span 2" }}><label style={labelStyle}>Izoh</label><input style={inputStyle} value={mijozForma.izoh} onChange={(e) => setMijozForma({ ...mijozForma, izoh: e.target.value })} /></div>
              </div>
              <button onClick={mijozQoshish} style={{ marginTop: "20px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Mijozni saqlash</button>
            </div>
            <div style={{ marginBottom: "14px", maxWidth: "320px" }}><input style={inputStyle} value={mijozQidiruv} onChange={(e) => setMijozQidiruv(e.target.value)} placeholder="Ism yoki telefon bo'yicha qidirish..." /></div>
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "12px" }}>Barcha mijozlar ({mijozlarFiltrlangan.length})</h2>
            {mijozlarFiltrlangan.length === 0 && <p style={{ color: "#777" }}>Mijoz topilmadi.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {mijozlarFiltrlangan.map((m) => (
                <div key={m.mijozId || m.ism} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div><span style={{ fontWeight: "bold", fontSize: "16px" }}>{m.ism}</span>{m.telefon && <span style={{ marginLeft: "12px", fontSize: "13px", color: "#777" }}>{m.telefon}</span>}{m.telegramUser && <span style={{ marginLeft: "12px", fontSize: "13px", color: "#0089BD" }}>{m.telegramUser}</span>}</div>
                    {m.qoldaQoshilganMi && <button onClick={() => mijozniOchir(m.mijozId)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "5px 12px", cursor: "pointer", fontSize: "12px" }}>O'chirish</button>}
                  </div>
                  <div style={{ marginTop: "8px", display: "flex", gap: "24px", fontSize: "13px", color: "#333", flexWrap: "wrap" }}>
                    <span><b>Buyurtmalar:</b> {m.buyurtmaSoni} ta</span>
                    <span><b>Jami xarid:</b> {sumFormat(m.jamiXarid)}</span>
                    <span style={{ color: m.jamiQarz > 0 ? "#B3261E" : "#1E7A34" }}><b>Qarzi:</b> {sumFormat(m.jamiQarz)}</span>
                    {m.manzil && <span><b>Manzil:</b> {m.manzil}</span>}
                  </div>
                  {m.izoh && <div style={{ marginTop: "6px", fontSize: "13px", color: "#777", fontStyle: "italic" }}>{m.izoh}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {korinadiganOyna === "ombor" && (
          <div>
            <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Yangi material qo'shish</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                <div style={fieldWrap}><label style={labelStyle}>Material nomi</label><input style={inputStyle} value={materialForma.nomi} onChange={(e) => setMaterialForma({ ...materialForma, nomi: e.target.value })} placeholder="Masalan: Oq futbolka" /></div>
                <div style={fieldWrap}><label style={labelStyle}>O'lchov birligi</label><select style={inputStyle} value={materialForma.birlik} onChange={(e) => setMaterialForma({ ...materialForma, birlik: e.target.value })}>{OLCHAM_BIRLIKLARI.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
                <div style={fieldWrap}><label style={labelStyle}>Yetkazib beruvchi</label><input style={inputStyle} value={materialForma.yetkazibBeruvchi} onChange={(e) => setMaterialForma({ ...materialForma, yetkazibBeruvchi: e.target.value })} /></div>
                <div style={fieldWrap}><label style={labelStyle}>So'nggi narxi (birlik uchun)</label><input type="number" style={inputStyle} value={materialForma.narxi} onChange={(e) => setMaterialForma({ ...materialForma, narxi: e.target.value })} /></div>
                <div style={fieldWrap}><label style={labelStyle}>Minimal zaxira</label><input type="number" style={inputStyle} value={materialForma.minimalZaxira} onChange={(e) => setMaterialForma({ ...materialForma, minimalZaxira: e.target.value })} /></div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", fontSize: "14px", cursor: "pointer" }}>
                <input type="checkbox" checked={materialForma.variantliMi} onChange={(e) => setMaterialForma({ ...materialForma, variantliMi: e.target.checked, variantlar: [] })} />
                Bu mahsulotda o'lcham / rang variantlari bor
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", fontSize: "14px", cursor: "pointer" }}>
                <input type="checkbox" checked={materialForma.xaridMi} onChange={(e) => setMaterialForma({ ...materialForma, xaridMi: e.target.checked })} />
                Bu xarid, Moliyaga chiqim sifatida yozilsin
              </label>
              {!materialForma.variantliMi && (
                <div style={{ marginTop: "12px", maxWidth: "200px" }}><label style={labelStyle}>Miqdor</label><input type="number" style={inputStyle} value={materialForma.soni} onChange={(e) => setMaterialForma({ ...materialForma, soni: e.target.value })} /></div>
              )}
              {materialForma.variantliMi && (
                <div style={{ marginTop: "16px" }}>
                  {materialForma.variantlar.map((v) => (
                    <div key={v.id} style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                      <select style={{ ...inputStyle, width: "100px" }} value={v.olcham} onChange={(e) => variantOzgartir(v.id, "olcham", e.target.value)}>{OLCHAMLAR.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                      <input style={{ ...inputStyle, width: "160px" }} placeholder="Rang" value={v.rang} onChange={(e) => variantOzgartir(v.id, "rang", e.target.value)} />
                      <input type="number" style={{ ...inputStyle, width: "100px" }} placeholder="Soni" value={v.soni} onChange={(e) => variantOzgartir(v.id, "soni", e.target.value)} />
                      <button onClick={() => variantOchir(v.id)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "8px 12px", cursor: "pointer" }}>✕</button>
                    </div>
                  ))}
                  <button onClick={variantQoshish} style={{ marginTop: "4px", padding: "8px 16px", background: "#e5e2da", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>+ Variant qo'shish</button>
                </div>
              )}
              <button onClick={materialQoshish} style={{ marginTop: "20px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600", display: "block" }}>Materialni saqlash</button>
            </div>
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "12px" }}>Ombordagi materiallar ({ombor.length})</h2>
            {ombor.length === 0 && <p style={{ color: "#777" }}>Hozircha material yo'q.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {ombor.map((m) => {
                const kamQoldiMi = m.jamiSoni <= m.minimalZaxira && m.minimalZaxira > 0;
                return (
                  <div key={m.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "14px", alignItems: "center" }}><span style={{ fontWeight: "bold", fontSize: "16px" }}>{m.nomi}</span><span style={{ padding: "4px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: "600", background: kamQoldiMi ? "#FDECEC" : "#E6FCEB", color: kamQoldiMi ? "#B3261E" : "#1E7A34" }}>Jami: {m.jamiSoni} {m.birlik} {kamQoldiMi ? "— kam qoldi!" : ""}</span></div>
                      <button onClick={() => materialniOchir(m.id)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "6px 12px", cursor: "pointer" }}>O'chirish</button>
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "13px", color: "#555" }}>
                      {m.yetkazibBeruvchi && <span style={{ marginRight: "16px" }}><b>Yetkazib beruvchi:</b> {m.yetkazibBeruvchi}</span>}
                      {m.narxi > 0 && <span><b>Narxi:</b> {sumFormat(m.narxi)} / {m.birlik}</span>}
                    </div>
                    {m.variantliMi && m.variantlar.length > 0 && (
                      <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {m.variantlar.map((v) => (<span key={v.id} style={{ background: "#f2f2f2", padding: "5px 12px", borderRadius: "6px", fontSize: "13px" }}>{v.olcham} — {v.rang || "rangsiz"}: <b>{v.soni}</b> {m.birlik}</span>))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {korinadiganOyna === "moliya" && (
          <div>
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "16px" }}>{oyNomiKorsat(tanlanganOy)} — Umumiy hisobot</h2>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Oy:</label>
                <select style={{ ...inputStyle, width: "auto" }} value={tanlanganOy} onChange={(e) => setTanlanganOy(e.target.value)}>
                  {oylarRoyxati.map((oy) => <option key={oy} value={oy}>{oyNomiKorsat(oy)}</option>)}
                </select>
                {joriyOyYopilganYozuvi && (
                  <span style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "999px", background: "#E6FCEB", color: "#1E7A34", fontWeight: "600" }}>
                    ✅ Yopilgan ({new Date(joriyOyYopilganYozuvi.yaratilganVaqt).toLocaleDateString("uz-UZ")})
                  </span>
                )}
              </div>
              {foydalanuvchi.nomi === "Admin" && (
                <button onClick={oyniYopish} style={{ padding: "8px 18px", background: joriyOyYopilganYozuvi ? "#e5e2da" : "#15120F", color: joriyOyYopilganYozuvi ? "#333" : "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                  {joriyOyYopilganYozuvi ? "Qayta hisoblash" : "Oyni yopish"}
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
              <div style={statCard}><div style={statLabel}>{oyNomiKorsat(tanlanganOy)} — Kirim</div><div style={{ ...statVal, color: "#0089BD" }}>{sumFormat(oylikJamiKirim)}</div></div>
              <div style={statCard}><div style={statLabel}>{oyNomiKorsat(tanlanganOy)} — Chiqim</div><div style={{ ...statVal, color: "#B00074" }}>{sumFormat(oylikJamiChiqim)}</div></div>
              <div style={statCard}><div style={statLabel}>{oyNomiKorsat(tanlanganOy)} — Sof foyda</div><div style={{ ...statVal, color: oylikSofFoyda >= 0 ? "#1E7A34" : "#B3261E" }}>{sumFormat(oylikSofFoyda)}</div></div>
              <div style={statCard}><div style={statLabel}>Jami qarzdorlik (barcha vaqt)</div><div style={{ ...statVal, color: jamiQarzdorlik > 0 ? "#B3261E" : "#1E7A34" }}>{sumFormat(jamiQarzdorlik)}</div></div>
            </div>

            {qarzdorBuyurtmalar.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "10px" }}>Qoldiq to'lovi bor buyurtmalar</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {qarzdorBuyurtmalar.map((b) => (
                    <div key={b.id} style={{ background: "#FDECEC", borderRadius: "8px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", flexWrap: "wrap", gap: "6px" }}>
                      <span><b>{b.raqam} — {b.mijozIsmi}</b> — {b.mahsulotNomi} <span style={{ color: "#999", fontSize: "12px" }}>({oyNomiKorsat((b.qabulKuni || "").slice(0, 7))}dan qolgan)</span></span>
                      <span style={{ fontWeight: "600", color: "#B3261E" }}>{sumFormat(b.qoldiq)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Yangi moliyaviy yozuv</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                <div style={fieldWrap}><label style={labelStyle}>Turi</label><select style={inputStyle} value={moliyaForma.turi} onChange={(e) => setMoliyaForma({ ...moliyaForma, turi: e.target.value, kategoriya: "" })}><option value="Kirim">Kirim</option><option value="Chiqim">Chiqim</option></select></div>
                <div style={fieldWrap}><label style={labelStyle}>Kimga / kimdan</label><input style={inputStyle} value={moliyaForma.kimga} onChange={(e) => setMoliyaForma({ ...moliyaForma, kimga: e.target.value })} placeholder="Masalan: Kansprint, Taxi" /></div>
                <div style={fieldWrap}><label style={labelStyle}>To'lov turi</label><select style={inputStyle} value={moliyaForma.tolovTuri} onChange={(e) => setMoliyaForma({ ...moliyaForma, tolovTuri: e.target.value })}>{TOLOV_TURLARI.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                {moliyaForma.turi === "Chiqim" && (<div style={fieldWrap}><label style={labelStyle}>Chiqim kategoriyasi</label><select style={inputStyle} value={moliyaForma.kategoriya} onChange={(e) => setMoliyaForma({ ...moliyaForma, kategoriya: e.target.value })}><option value="">— tanlanmagan —</option>{CHIQIM_KATEGORIYALARI.map((k) => <option key={k} value={k}>{k}</option>)}</select></div>)}
                <div style={fieldWrap}><label style={labelStyle}>Summa (so'm)</label><input type="number" style={inputStyle} value={moliyaForma.summa} onChange={(e) => setMoliyaForma({ ...moliyaForma, summa: e.target.value })} /></div>
                <div style={fieldWrap}><label style={labelStyle}>Sana</label><input type="date" style={inputStyle} value={moliyaForma.sana} onChange={(e) => setMoliyaForma({ ...moliyaForma, sana: e.target.value })} /></div>
                <div style={fieldWrap}><label style={labelStyle}>Izoh</label><input style={inputStyle} value={moliyaForma.izoh} onChange={(e) => setMoliyaForma({ ...moliyaForma, izoh: e.target.value })} placeholder="Masalan: karta qilindi" /></div>
              </div>
              <button onClick={moliyaQoshish} style={{ marginTop: "20px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Saqlash</button>
            </div>

            <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "14px" }}>
              <div style={{ display: "flex", gap: "6px" }}>{["Hammasi", "Kirim", "Chiqim"].map((f) => (<button key={f} onClick={() => setMoliyaFiltr(f)} style={filtrBtn(moliyaFiltr === f)}>{f}</button>))}</div>
              <div style={fieldWrap}><label style={labelStyle}>Sanadan</label><input type="date" style={inputStyle} value={sanaDan} onChange={(e) => setSanaDan(e.target.value)} /></div>
              <div style={fieldWrap}><label style={labelStyle}>Sanagacha</label><input type="date" style={inputStyle} value={sanaGacha} onChange={(e) => setSanaGacha(e.target.value)} /></div>
              <div style={{ ...fieldWrap, flex: 1, minWidth: "200px" }}><label style={labelStyle}>Qidirish</label><input style={inputStyle} value={moliyaQidiruv} onChange={(e) => setMoliyaQidiruv(e.target.value)} placeholder="Kimga yoki izoh bo'yicha..." /></div>
            </div>
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "12px" }}>Moliyaviy yozuvlar ({moliyaFiltrlangan.length})</h2>
            {moliyaFiltrlangan.length === 0 && <p style={{ color: "#777" }}>Bu filtrga mos yozuv yo'q.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {moliyaFiltrlangan.map((f) => (
                <MoliyaQatori key={f.id} f={f} onOchir={moliyaOchir} onTahrirlash={moliyaTahrirlash} />
              ))}
            </div>
          </div>
        )}

        {korinadiganOyna === "hisobot" && (
          <div>
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "16px" }}>Umumiy ko'rsatkichlar</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "28px" }}>
              <div style={statCard}><div style={statLabel}>Jami buyurtmalar</div><div style={statVal}>{jamiBuyurtmalar}</div></div>
              <div style={statCard}><div style={statLabel}>O'rtacha buyurtma qiymati</div><div style={statVal}>{sumFormat(ortachaBuyurtmaQiymati)}</div></div>
              <div style={statCard}><div style={statLabel}>Hozirgi kechikish darajasi</div><div style={{ ...statVal, color: kechikishFoizi > 20 ? "#B3261E" : "#1E7A34" }}>{kechikishFoizi}%</div></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }}>
              <div style={statCard}>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "14px" }}>📍 Shahar bo'yicha</h2>
                <TaqsimotRoyxati malumot={shaharHisoboti} birlik="buyurtma" />
              </div>
              <div style={statCard}>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "14px" }}>🏭 Bajaruvchi bo'yicha</h2>
                <TaqsimotRoyxati malumot={bajaruvchiHisoboti} birlik="buyurtma" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "28px" }}>
              <div style={statCard}>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "6px" }}>👤 Kim kiritdi</h2>
                <p style={{ fontSize: "11px", color: "#999", marginBottom: "12px" }}>Faqat shu funksiya qo'shilgandan keyingi buyurtmalar hisoblanadi.</p>
                <TaqsimotRoyxati malumot={kiritganHisoboti} birlik="buyurtma" />
              </div>
              <div style={statCard}>
                <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "14px" }}>🏷 Mahsulot turi bo'yicha</h2>
                <TaqsimotRoyxati malumot={mahsulotTuriHisoboti} birlik="buyurtma" />
              </div>
            </div>

            <div style={{ ...statCard, marginBottom: "28px" }}>
              <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "14px" }}>🏆 Eng ko'p sotilgan mahsulotlar</h2>
              <MahsulotRoyxati malumot={mahsulotHisoboti} />
            </div>

            <div style={statCard}>
              <h2 style={{ fontSize: "16px", color: "#15120F", marginBottom: "14px" }}>📊 Holat bo'yicha taqsimot</h2>
              <TaqsimotRoyxati malumot={holatHisoboti} birlik="buyurtma" />
            </div>
          </div>
        )}

        {korinadiganOyna === "reja" && (
          <SavdoRejasiPaneli buyurtmalar={buyurtmalar} adminMi={foydalanuvchi.nomi === "Admin"} />
        )}

        {korinadiganOyna === "elonlar" && (
          <div>
            {(foydalanuvchi.nomi === "Admin" || foydalanuvchi.nomi === "Menejer") && (
              <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Yangi e'lon joylash</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input style={inputStyle} value={elonForma.sarlavha} onChange={(e) => setElonForma({ ...elonForma, sarlavha: e.target.value })} placeholder="Sarlavha" />
                  <textarea style={{ ...inputStyle, minHeight: "80px" }} value={elonForma.matn} onChange={(e) => setElonForma({ ...elonForma, matn: e.target.value })} placeholder="E'lon matni" />
                </div>
                <button onClick={elonQoshish} style={{ marginTop: "16px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Joylash</button>
              </div>
            )}
            <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "12px" }}>Barcha yangiliklar ({elonlar.length})</h2>
            {elonlar.length === 0 && <p style={{ color: "#777" }}>Hozircha e'lon yo'q.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {elonlar.map((e) => (
                <div key={e.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "8px", padding: "16px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div><div style={{ fontWeight: "bold", fontSize: "16px", color: "#15120F" }}>{e.sarlavha}</div><div style={{ fontSize: "12px", color: "#999", marginTop: "2px" }}>{e.muallif} • {new Date(e.yaratilganVaqt).toLocaleDateString("uz-UZ")}</div></div>
                    {(foydalanuvchi.nomi === "Admin" || e.muallif === foydalanuvchi.nomi) && (<button onClick={() => elonOchir(e.id)} style={{ border: "none", background: "#FDECEC", color: "#B3261E", borderRadius: "5px", padding: "5px 12px", cursor: "pointer", fontSize: "12px" }}>O'chirish</button>)}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "14px", color: "#333" }}>{e.matn}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {korinadiganOyna === "sozlamalar" && (
          <div>
            <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Kompaniya ma'lumotlari</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                <div style={fieldWrap}><label style={labelStyle}>Kompaniya nomi</label><input style={inputStyle} value={kompaniyaForma.nomi} onChange={(e) => setKompaniyaForma({ ...kompaniyaForma, nomi: e.target.value })} /></div>
                <div style={fieldWrap}><label style={labelStyle}>Telefon</label><input style={inputStyle} value={kompaniyaForma.telefon} onChange={(e) => setKompaniyaForma({ ...kompaniyaForma, telefon: e.target.value })} placeholder="+998 90 123 45 67" /></div>
                <div style={fieldWrap}><label style={labelStyle}>Manzil</label><input style={inputStyle} value={kompaniyaForma.manzil} onChange={(e) => setKompaniyaForma({ ...kompaniyaForma, manzil: e.target.value })} /></div>
              </div>
              <button onClick={kompaniyaSaqlash} style={{ marginTop: "16px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Saqlash</button>
            </div>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", color: "#15120F", marginBottom: "12px" }}>Xodimlar va PIN-kodlar</h2>
              {rollar.map((rol) => (<RolQatori key={rol.nomi} rol={rol} inputStyle={inputStyle} onPinSaqlash={pinSaqlash} onRuxsatOzgartir={ruxsatOzgartir} onOchir={rolniOchir} />))}
            </div>
            <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "16px", color: "#15120F" }}>Yangi xodim (rol) qo'shish</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                <div style={fieldWrap}><label style={labelStyle}>Rol nomi</label><input style={inputStyle} value={yangiRolForma.nomi} onChange={(e) => setYangiRolForma({ ...yangiRolForma, nomi: e.target.value })} placeholder="Masalan: Haydovchi" /></div>
                <div style={fieldWrap}><label style={labelStyle}>PIN-kod (4 raqam)</label><input style={inputStyle} maxLength={4} value={yangiRolForma.pin} onChange={(e) => setYangiRolForma({ ...yangiRolForma, pin: e.target.value.replace(/\D/g, "") })} /></div>
              </div>
              <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "14px" }}>
                {BARCHA_BOLIMLAR.map((tab) => (<label key={tab} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}><input type="checkbox" checked={yangiRolForma.ruxsatlar.includes(tab)} onChange={(e) => yangiRolRuxsatOzgartir(tab, e.target.checked)} />{TAB_NOMLARI[tab]}</label>))}
              </div>
              <button onClick={yangiRolQoshish} style={{ marginTop: "16px", padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Rolni qo'shish</button>
            </div>
            <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", border: "1px solid #eee" }}>
              <h2 style={{ fontSize: "18px", marginBottom: "10px", color: "#15120F" }}>Zaxira nusxa</h2>
              <p style={{ fontSize: "13px", color: "#777", marginBottom: "16px" }}>Barcha ma'lumotlarni fayl sifatida yuklab oling.</p>
              <button onClick={zaxiraYuklabOlish} style={{ padding: "10px 24px", background: "#15120F", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "600" }}>Zaxira nusxani yuklab olish</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
