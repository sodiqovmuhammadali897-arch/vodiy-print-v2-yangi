import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, query, runTransaction, where, getDocs } from "firebase/firestore";
import SavdoRejasiPaneli from "./components/SavdoRejasiPaneli";

import { IKONALAR, IKONA_CHIQISH, IKONA_QIDIRUV } from "./utils/ikonalar";
import {
  BO_SH_FORMA, BO_SH_MATERIAL_FORMA, BO_SH_MOLIYA_FORMA, BO_SH_MIJOZ_FORMA, BO_SH_KOMPANIYA, BO_SH_ELON_FORMA,
  ROLLAR_STANDART, BARCHA_BOLIMLAR, TAB_NOMLARI, BUGUN, JORIY_OY,
  inputStyle,
} from "./utils/konstantalar";
import { sumFormat, qolganVaqtHisoblash, oxirgi7KunHisoblash, guruhlaHisobot, mahsulotHisobotiHisobla, oyNomiKorsat } from "./utils/yordamchi";
import { useFirebaseCollection } from "./utils/useFirebaseCollection";

import ToastKonteyner from "./components/ToastKonteyner";
import KirishOynasi from "./components/KirishOynasi";

import BoshSahifa from "./panels/BoshSahifa";
import YangiBuyurtma from "./panels/YangiBuyurtma";
import BuyurtmalarRoyxati from "./panels/BuyurtmalarRoyxati";
import Mijozlar from "./panels/Mijozlar";
import Ombor from "./panels/Ombor";
import Moliya from "./panels/Moliya";
import Hisobotlar from "./panels/Hisobotlar";
import Yangiliklar from "./panels/Yangiliklar";
import Sozlamalar from "./panels/Sozlamalar";

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
          <BoshSahifa
            songgiElon={songgiElon} jamiBuyurtmalar={jamiBuyurtmalar} bugunTopshiriladigan={bugunTopshiriladigan}
            jamiQarzdorlik={jamiQarzdorlik} kamQolganMateriallar={kamQolganMateriallar} grafikMalumoti={grafikMalumoti}
            muddatiYaqinBuyurtmalar={muddatiYaqinBuyurtmalar} songgiBuyurtmalar={songgiBuyurtmalar} sumFormat={sumFormat}
          />
        )}

        {korinadiganOyna === "kiritish" && (
          <YangiBuyurtma
            forma={forma} maydonOzgartir={maydonOzgartir} faylOzgartir={faylOzgartir}
            buyurtmaVariantQoshish={buyurtmaVariantQoshish} buyurtmaVariantOzgartir={buyurtmaVariantOzgartir} buyurtmaVariantOchir={buyurtmaVariantOchir}
            jamiSoniHozir={jamiSoniHozir} umumiySummaHozir={umumiySummaHozir} qoldiqHozir={qoldiqHozir} qoshish={qoshish}
          />
        )}

        {korinadiganOyna === "royxat" && (
          <BuyurtmalarRoyxati
            buyurtmalar={buyurtmalar} holatTanlandi={holatTanlandi} izohQoshish={izohQoshish} tolovQoshish={tolovQoshish}
            buyurtmaniOchir={buyurtmaniOchir} buyurtmaTahrirlash={buyurtmaTahrirlash} ochirishRuxsatBorMi={ochirishRuxsatBorMi}
          />
        )}

        {korinadiganOyna === "mijozlar" && (
          <Mijozlar
            mijozForma={mijozForma} setMijozForma={setMijozForma} mijozQoshish={mijozQoshish}
            mijozQidiruv={mijozQidiruv} setMijozQidiruv={setMijozQidiruv} mijozlarFiltrlangan={mijozlarFiltrlangan} mijozniOchir={mijozniOchir}
          />
        )}

        {korinadiganOyna === "ombor" && (
          <Ombor
            materialForma={materialForma} setMaterialForma={setMaterialForma}
            variantQoshish={variantQoshish} variantOzgartir={variantOzgartir} variantOchir={variantOchir}
            materialQoshish={materialQoshish} ombor={ombor} materialniOchir={materialniOchir}
          />
        )}

        {korinadiganOyna === "moliya" && (
          <Moliya
            tanlanganOy={tanlanganOy} setTanlanganOy={setTanlanganOy} oylarRoyxati={oylarRoyxati}
            joriyOyYopilganYozuvi={joriyOyYopilganYozuvi} foydalanuvchi={foydalanuvchi} oyniYopish={oyniYopish}
            oylikJamiKirim={oylikJamiKirim} oylikJamiChiqim={oylikJamiChiqim} oylikSofFoyda={oylikSofFoyda}
            jamiQarzdorlik={jamiQarzdorlik} qarzdorBuyurtmalar={qarzdorBuyurtmalar}
            moliyaForma={moliyaForma} setMoliyaForma={setMoliyaForma} moliyaQoshish={moliyaQoshish}
            moliyaFiltr={moliyaFiltr} setMoliyaFiltr={setMoliyaFiltr} sanaDan={sanaDan} setSanaDan={setSanaDan}
            sanaGacha={sanaGacha} setSanaGacha={setSanaGacha} moliyaQidiruv={moliyaQidiruv} setMoliyaQidiruv={setMoliyaQidiruv}
            moliyaFiltrlangan={moliyaFiltrlangan} moliyaOchir={moliyaOchir} moliyaTahrirlash={moliyaTahrirlash}
          />
        )}

        {korinadiganOyna === "hisobot" && (
          <Hisobotlar
            jamiBuyurtmalar={jamiBuyurtmalar} ortachaBuyurtmaQiymati={ortachaBuyurtmaQiymati} kechikishFoizi={kechikishFoizi}
            shaharHisoboti={shaharHisoboti} bajaruvchiHisoboti={bajaruvchiHisoboti} kiritganHisoboti={kiritganHisoboti}
            mahsulotTuriHisoboti={mahsulotTuriHisoboti} mahsulotHisoboti={mahsulotHisoboti} holatHisoboti={holatHisoboti}
          />
        )}

        {korinadiganOyna === "reja" && (
          <SavdoRejasiPaneli buyurtmalar={buyurtmalar} adminMi={foydalanuvchi.nomi === "Admin"} />
        )}

        {korinadiganOyna === "elonlar" && (
          <Yangiliklar
            foydalanuvchi={foydalanuvchi} elonForma={elonForma} setElonForma={setElonForma}
            elonQoshish={elonQoshish} elonlar={elonlar} elonOchir={elonOchir}
          />
        )}

        {korinadiganOyna === "sozlamalar" && (
          <Sozlamalar
            kompaniyaForma={kompaniyaForma} setKompaniyaForma={setKompaniyaForma} kompaniyaSaqlash={kompaniyaSaqlash}
            rollar={rollar} pinSaqlash={pinSaqlash} ruxsatOzgartir={ruxsatOzgartir} rolniOchir={rolniOchir}
            yangiRolForma={yangiRolForma} setYangiRolForma={setYangiRolForma} yangiRolQoshish={yangiRolQoshish}
            yangiRolRuxsatOzgartir={yangiRolRuxsatOzgartir} zaxiraYuklabOlish={zaxiraYuklabOlish}
          />
        )}
      </main>
    </div>
  );
}

