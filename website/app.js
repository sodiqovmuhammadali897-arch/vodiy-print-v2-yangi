// Vodiy Print sayti: hero scaling and parallax, scroll reveals, the mobile
// menu and the coupon form (→ meta-webhook/siteLeads.js).
(() => {
  const API = /(^|\.)printvodiy\.uz$/.test(location.hostname) || location.hostname === "localhost" ? "/webhooks/site-lead" : "https://printvodiy.uz/webhooks/site-lead";

  // The hero artwork is drawn at 640×660 and scaled to its column.
  const box = document.getElementById("stageBox");
  const art = box && box.parentElement;
  const fit = () => {
    if (!art) return;
    const s = Math.min(1, art.clientWidth / 640);
    art.style.setProperty("--s", s.toFixed(3));
    box.style.setProperty("--s", s.toFixed(3));
  };
  fit();
  addEventListener("resize", fit);

  // Mouse parallax (not on touch screens).
  const stage = document.getElementById("stage");
  if (stage && matchMedia("(hover: hover)").matches) {
    addEventListener("mousemove", (e) => {
      stage.style.setProperty("--mx", (e.clientX / innerWidth - 0.5).toFixed(3));
      stage.style.setProperty("--my", (e.clientY / innerHeight - 0.5).toFixed(3));
    });
  }

  // Sections reveal as they come into view.
  const io = new IntersectionObserver((es) => es.forEach((x) => x.isIntersecting && x.target.classList.add("in")), { threshold: 0.15 });
  document.querySelectorAll(".obs").forEach((el) => io.observe(el));

  // Mobile menu.
  const menu = document.getElementById("menu");
  const burger = document.querySelector(".burger");
  const toggle = (open) => {
    menu.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => toggle(true));
  menu.querySelector(".close").addEventListener("click", () => toggle(false));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggle(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && toggle(false));

  // A coupon number per visit, for fun.
  const no = document.getElementById("couponNo");
  if (no) no.textContent = `№ ${String(Math.floor(1000 + Math.random() * 9000))}`;

  // Coupon form.
  const form = document.getElementById("coupon");
  const msg = document.getElementById("formMsg");
  const btn = document.getElementById("sendBtn");
  const fileInput = document.getElementById("f-file");
  const fileName = document.getElementById("f-file-name");
  const MAX = 8 * 1024 * 1024;

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    fileName.textContent = f ? `${f.name.slice(0, 28)} · ${(f.size / 1048576).toFixed(1)} MB` : "ixtiyoriy · 8 MB gacha";
  });

  const readFile = (f) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] || "");
      r.onerror = () => rej(new Error("Faylni o'qib bo'lmadi"));
      r.readAsDataURL(f);
    });

  const phoneOk = (v) => {
    const d = v.replace(/\D/g, "");
    return d.length === 9 || (d.length === 12 && d.startsWith("998"));
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.name || "").trim()) return (msg.textContent = "Ismingizni yozing"), form.name.focus();
    if (!phoneOk(String(data.phone || ""))) return (msg.textContent = "Telefon raqamini to'liq yozing, masalan +998 90 123 45 67"), form.phone.focus();
    const f = fileInput.files[0];
    if (f && f.size > MAX) return (msg.textContent = "Fayl 8 MB dan oshmasin");
    btn.disabled = true;
    btn.textContent = "Yuborilmoqda…";
    try {
      const body = { name: data.name, phone: data.phone, product: data.product, qty: data.qty, note: data.note, website: data.website };
      if (f) body.file = { name: f.name, type: f.type || "application/octet-stream", data: await readFile(f) };
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || "Yuborib bo'lmadi");
      form.classList.add("sent");
      btn.textContent = "Yuborildi ✓";
      msg.style.color = "var(--emerald)";
      msg.textContent = "Rahmat! Tez orada qo'ng'iroq qilamiz.";
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Kuponni yuborish →";
      msg.textContent = `${err.message}. Yoki qo'ng'iroq qiling: +998 77 200 88 55`;
    }
  });
})();
