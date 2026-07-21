import { useEffect, useMemo, useState } from "react";
import { supabase, type BuyurtmaDb, type SavdoRejaDb } from "./supabaseClient";

const MENEJERLAR = ["Muhammadali", "Muhammadiyor", "Maryam", "Moxlaroy"];

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px",
  border: "1px solid #d8d5ce", borderRadius: 7, fontSize: 14, outline: "none", background: "#fff",
};
const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontSize: 12, color: "#4c4741" };
const buttonStyle: React.CSSProperties = { border: "none", borderRadius: 7, cursor: "pointer", fontWeight: 600 };

const OY_NOMLARI = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

function oyNomi(oyKod: string) {
  if (!oyKod) return "—";
  const [yil, oy] = oyKod.split("-");
  return `${OY_NOMLARI[Number(oy) - 1]} ${yil}`;
}

function pulFormat(son: number) { return `${Number(son || 0).toLocaleString("uz-UZ")} so'm`; }

function boshForma(oy: string) { return { oy: oy || "", menejer: "", summa: "" }; }

function progresRang(foiz: number) {
  if (foiz >= 100) return "#1e7a34";
  if (foiz >= 70) return "#0089bd";
  if (foiz >= 40) return "#8a6d00";
  return "#b3261e";
}

function hisoblanganAsl(buyurtmalar: BuyurtmaDb[], oy: string, menejer: string) {
  return buyurtmalar
    .filter((b) => {
      const bOy = (b.qabul_kuni || "").slice(0, 7);
      if (bOy !== oy) return false;
      if (menejer) return b.masul_menejer === menejer;
      return true;
    })
    .reduce((acc, b) => acc + (Number(b.umumiy_summa) || 0), 0);
}

function RejaQatori({ reja, asl, onTahrirlash, onOchir, adminMi }: {
  reja: SavdoRejaDb;
  asl: number;
  onTahrirlash: (id: string, summa: number) => Promise<void>;
  onOchir: (r: SavdoRejaDb) => void;
  adminMi: boolean;
}) {
  const [tahrir, setTahrir] = useState(false);
  const [summa, setSumma] = useState(String(reja.summa || ""));

  const foiz = reja.summa > 0 ? Math.min(100, Math.round((asl / reja.summa) * 100)) : 0;
  const rang = progresRang(foiz);
  const qoldiq = reja.summa - asl;

  async function saqlash() {
    const son = Number(summa);
    if (!Number.isFinite(son) || son <= 0) { alert("Summa noto'g'ri kiritilgan."); return; }
    await onTahrirlash(reja.id, son);
    setTahrir(false);
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #ece9e3", borderRadius: 11, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 9, background: "#f1efeb", fontSize: 15, fontWeight: 700, color: "#555" }}>
            {(reja.menejer || "U").slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1e7a34" }}>{reja.menejer || "Umumiy (kompaniya)"}</div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{oyNomi(reja.oy)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {adminMi && !tahrir && (
            <button type="button" onClick={() => setTahrir(true)} style={{ ...buttonStyle, padding: "8px 13px", background: "#e6f7fd", color: "#0089bd" }}>Tahrirlash</button>
          )}
          {adminMi && (
            <button type="button" onClick={() => onOchir(reja)} style={{ ...buttonStyle, padding: "8px 13px", background: "#fdecec", color: "#b3261e" }}>O'chirish</button>
          )}
        </div>
      </div>

      {tahrir ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Reja summasi (so'm)</label>
            <input type="number" min={0} style={inputStyle} value={summa} onChange={(e) => setSumma(e.target.value)} placeholder="50000000" />
          </div>
          <button type="button" onClick={saqlash} style={{ ...buttonStyle, padding: "10px 18px", background: "#0F9D58", color: "#fff" }}>Saqlash</button>
          <button type="button" onClick={() => setTahrir(false)} style={{ ...buttonStyle, padding: "10px 18px", background: "#e8e5de", color: "#4c4741" }}>Bekor</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: "#555" }}>Bajarilgan: <b style={{ color: rang }}>{pulFormat(asl)}</b> / {pulFormat(reja.summa)}</span>
            <span style={{ fontWeight: 800, color: rang }}>{foiz}%</span>
          </div>
          <div style={{ background: "#f2f0ea", borderRadius: 999, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${foiz}%`, background: rang, height: "100%", borderRadius: 999, transition: "width .3s ease" }} />
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "#777" }}>
            <span><b style={{ color: qoldiq > 0 ? "#b3261e" : "#1e7a34" }}>{pulFormat(Math.abs(qoldiq))}</b> {qoldiq > 0 ? "qoldi" : "ortig'i bilan bajarildi"}</span>
            {foiz >= 100 && <span style={{ color: "#1e7a34", fontWeight: 700 }}>Maqsadga erishildi</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function SavdoRejasiPaneli({ buyurtmalar, adminMi = true }: { buyurtmalar: BuyurtmaDb[]; adminMi?: boolean }) {
  const [rejalar, setRejalar] = useState<SavdoRejaDb[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(true);
  const [xato, setXato] = useState("");
  const [oy, setOy] = useState(new Date().toISOString().slice(0, 7));
  const [forma, setForma] = useState(() => boshForma(new Date().toISOString().slice(0, 7)));
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  async function yuklash() {
    setYuklanmoqda(true);
    const { data, error } = await supabase.from("savdo_rejalari").select("*").order("yaratilgan_vaqt", { ascending: false });
    if (error) { setXato(error.message); setYuklanmoqda(false); return; }
    setRejalar((data ?? []) as SavdoRejaDb[]);
    setXato("");
    setYuklanmoqda(false);
  }

  useEffect(() => { yuklash(); }, []);

  const oydagiRejalar = useMemo(() => rejalar.filter((r) => r.oy === oy), [rejalar, oy]);
  const umumiyBolimi = useMemo(() => oydagiRejalar.filter((r) => !r.menejer), [oydagiRejalar]);
  const menejerRejalari = useMemo(() => oydagiRejalar.filter((r) => r.menejer), [oydagiRejalar]);

  const umumiyReja = useMemo(() => {
    if (umumiyBolimi.length > 0) return umumiyBolimi.reduce((a, r) => a + (Number(r.summa) || 0), 0);
    return menejerRejalari.reduce((a, r) => a + (Number(r.summa) || 0), 0);
  }, [umumiyBolimi, menejerRejalari]);
  const umumiyAsl = useMemo(() => hisoblanganAsl(buyurtmalar, oy, ""), [buyurtmalar, oy]);
  const umumiyFoiz = umumiyReja > 0 ? Math.min(100, Math.round((umumiyAsl / umumiyReja) * 100)) : 0;

  const menejerlarBolimi = useMemo(() => {
    return MENEJERLAR.map((m) => {
      const reja = oydagiRejalar.find((r) => r.menejer === m);
      const asl = hisoblanganAsl(buyurtmalar, oy, m);
      return { menejer: m, reja: reja || null, asl };
    }).filter((x) => x.reja) as { menejer: string; reja: SavdoRejaDb; asl: number }[];
  }, [oydagiRejalar, buyurtmalar, oy]);

  async function qoshish() {
    const son = Number(forma.summa);
    if (!forma.oy) { alert("Oyni tanlang."); return; }
    if (!Number.isFinite(son) || son <= 0) { alert("Summa noto'g'ri."); return; }
    const mavjud = rejalar.find((r) => r.oy === forma.oy && r.menejer === (forma.menejer || ""));
    if (mavjud) {
      if (!window.confirm(`${forma.menejer || "Umumiy"} uchun ${oyNomi(forma.oy)} rejasi allaqachon mavjud. Mavjud rejani yangilaysizmi?`)) return;
      setSaqlanmoqda(true);
      const { error } = await supabase.from("savdo_rejalari").update({ summa: son, yangilangan_vaqt: new Date().toISOString() }).eq("id", mavjud.id);
      setSaqlanmoqda(false);
      if (error) { alert("Xato: " + error.message); return; }
      setForma(boshForma(oy));
      yuklash();
      return;
    }
    setSaqlanmoqda(true);
    const { error } = await supabase.from("savdo_rejalari").insert({
      oy: forma.oy, menejer: forma.menejer || "", summa: son,
    });
    setSaqlanmoqda(false);
    if (error) { alert("Xato: " + error.message); return; }
    setForma(boshForma(oy));
    yuklash();
  }

  async function tahrirlash(id: string, summa: number) {
    const { error } = await supabase.from("savdo_rejalari").update({ summa, yangilangan_vaqt: new Date().toISOString() }).eq("id", id);
    if (error) { alert("Xato: " + error.message); return; }
    yuklash();
  }

  async function ochir(reja: SavdoRejaDb) {
    if (!window.confirm(`${reja.menejer || "Umumiy"} — ${oyNomi(reja.oy)} rejasini o'chirasizmi?`)) return;
    const { error } = await supabase.from("savdo_rejalari").delete().eq("id", reja.id);
    if (error) { alert("Xato: " + error.message); return; }
    yuklash();
  }

  const statKarta: React.CSSProperties = { background: "#fff", border: "1px solid #ece9e3", borderRadius: 12, padding: "16px 18px" };
  const statLabel: React.CSSProperties = { fontSize: 12, color: "#777", marginBottom: 6 };
  const statVal: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: "#1e7a34" };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: "#1e7a34" }}>Savdo rejasi</h1>
          <p style={{ margin: "5px 0 0", color: "#777", fontSize: 13 }}>Oylik savdo maqsadlarini belgilang va bajarilishini kuzating</p>
        </div>
        <div>
          <label style={labelStyle}>Oy</label>
          <input type="month" style={{ ...inputStyle, width: 180 }} value={oy} onChange={(e) => setOy(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
        <div style={statKarta}>
          <div style={statLabel}>Jami reja — {oyNomi(oy)}</div>
          <div style={{ ...statVal, color: "#0089bd" }}>{pulFormat(umumiyReja)}</div>
        </div>
        <div style={statKarta}>
          <div style={statLabel}>Bajarilgan savdo</div>
          <div style={{ ...statVal, color: "#1e7a34" }}>{pulFormat(umumiyAsl)}</div>
        </div>
        <div style={statKarta}>
          <div style={statLabel}>Bajarish foizi</div>
          <div style={{ ...statVal, color: progresRang(umumiyFoiz) }}>{umumiyFoiz}%</div>
        </div>
        <div style={statKarta}>
          <div style={statLabel}>{umumiyReja - umumiyAsl > 0 ? "Qolgan" : "Ortig'i"}</div>
          <div style={{ ...statVal, color: umumiyReja - umumiyAsl > 0 ? "#b3261e" : "#1e7a34" }}>
            {pulFormat(Math.abs(umumiyReja - umumiyAsl))}
          </div>
        </div>
      </div>

      <div style={{ background: "#f2f0ea", borderRadius: 14, padding: 16, marginBottom: 24 }}>
        <div style={{ height: 12, borderRadius: 999, background: "#e5e2da", overflow: "hidden" }}>
          <div style={{ width: `${umumiyFoiz}%`, background: progresRang(umumiyFoiz), height: "100%", borderRadius: 999, transition: "width .4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#777", marginTop: 8 }}>
          <span>Boshlangan</span>
          <span>{umumiyFoiz}% bajarildi</span>
          <span>Maqsad: {pulFormat(umumiyReja)}</span>
        </div>
      </div>

      {adminMi && (
        <div style={{ background: "#fff", border: "1px solid #ece9e3", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 17, color: "#1e7a34" }}>Yangi reja qo'shish</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <div>
              <label style={labelStyle}>Oy</label>
              <input type="month" style={inputStyle} value={forma.oy} onChange={(e) => setForma({ ...forma, oy: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Menejer (bo'sh = umumiy)</label>
              <select style={inputStyle} value={forma.menejer} onChange={(e) => setForma({ ...forma, menejer: e.target.value })}>
                <option value="">Umumiy (kompaniya)</option>
                {MENEJERLAR.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reja summasi (so'm)</label>
              <input type="number" min={0} style={inputStyle} value={forma.summa} onChange={(e) => setForma({ ...forma, summa: e.target.value })} placeholder="50000000" />
            </div>
          </div>
          <button type="button" disabled={saqlanmoqda} onClick={qoshish}
            style={{ ...buttonStyle, marginTop: 16, padding: "11px 24px", background: "#0F9D58", color: "#fff", opacity: saqlanmoqda ? 0.6 : 1 }}>
            {saqlanmoqda ? "Saqlanmoqda..." : "Rejani qo'shish"}
          </button>
        </div>
      )}

      {xato && <div style={{ padding: 14, borderRadius: 8, background: "#fdecec", color: "#b3261e", marginBottom: 18 }}>Xato: {xato}</div>}
      {yuklanmoqda && <div style={{ color: "#777", marginBottom: 18 }}>Rejalar yuklanmoqda...</div>}

      {!yuklanmoqda && !xato && oydagiRejalar.length === 0 && (
        <div style={{ background: "#fff", border: "1px dashed #d8d5ce", borderRadius: 12, padding: 32, textAlign: "center", color: "#777" }}>
          {oyNomi(oy)} uchun reja hali qo'shilmagan.
        </div>
      )}

      {umumiyBolimi.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#1e7a34" }}>Kompaniya bo'yicha</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {umumiyBolimi.map((r) => (
              <RejaQatori key={r.id} reja={r} asl={hisoblanganAsl(buyurtmalar, oy, "")} onTahrirlash={tahrirlash} onOchir={ochir} adminMi={adminMi} />
            ))}
          </div>
        </div>
      )}

      {menejerlarBolimi.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#1e7a34" }}>Menejerlar bo'yicha</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {menejerlarBolimi.map(({ menejer, reja, asl }) => (
              <RejaQatori key={reja.id} reja={reja} asl={asl} onTahrirlash={tahrirlash} onOchir={ochir} adminMi={adminMi} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
