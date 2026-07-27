import { useState } from "react";
import { HOLATLAR, MAHSULOT_TURLARI, BAJARUVCHILAR, OLCHAMLAR } from "../utils/konstantalar";
import { sumFormat, qolganVaqtHisoblash, holatRangi } from "../utils/yordamchi";

export default function BuyurtmaKartasi({ b, onHolatOzgartir, onIzohQoshish, onTolovQoshish, onOchir, onTahrirlash, ochirishRuxsatBorMi }) {
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

