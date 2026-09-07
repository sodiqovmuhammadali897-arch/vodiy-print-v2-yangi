import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { insertOne, listAll, updateOne } from "../../lib/firestoreDb";
import { LEAD_SOURCES, INDUSTRIES, UZBEKISTAN_REGIONS } from "../../lib/orderConstants";
import { findLeadByPhone } from "../../lib/duplicateCheck";
import { ensureLeadSource, ensureLeadCampaign } from "../../lib/leadLookups";
import { logLeadActivity } from "../../lib/leadActivity";
import { nextLeadNumber } from "../../lib/numbering";
import type { Lead, Product } from "../../lib/types";
import type { Staff } from "../../lib/permissions";
import { useAuth } from "../../lib/AuthContext";
import Modal from "../../components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSaved: () => void;
};

export default function LeadFormModal({ open, onClose, lead, onSaved }: Props) {
  const { staff, user } = useAuth();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [fullName, setFullName] = useState("");
  const [brand, setBrand] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [productId, setProductId] = useState("");
  const [source, setSource] = useState("");
  const [region, setRegion] = useState("");
  const [industry, setIndustry] = useState("");
  const [assignedEmail, setAssignedEmail] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [note, setNote] = useState("");

  const [showMarketing, setShowMarketing] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [adSetName, setAdSetName] = useState("");
  const [adSetId, setAdSetId] = useState("");
  const [adName, setAdName] = useState("");
  const [adId, setAdId] = useState("");
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");

  const [duplicateLead, setDuplicateLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void listAll<Staff>("staff", { orderBy: ["full_name", "asc"] }).then(setStaffList);
    void listAll<Product>("products", { orderBy: ["name", "asc"] }).then(setProducts);
    setDuplicateLead(null);
    setShowMarketing(false);
    if (lead) {
      setFullName(lead.full_name);
      setBrand(lead.brand);
      setPhone(lead.phone);
      setTelegram(lead.telegram);
      setProductId(lead.interested_product_id);
      setSource(lead.source);
      setRegion(lead.region);
      setIndustry(lead.industry);
      setAssignedEmail(lead.assigned_to_email);
      setEstimatedAmount(lead.estimated_amount ? String(lead.estimated_amount) : "");
      setNextContact(lead.next_contact_at ? lead.next_contact_at.slice(0, 16) : "");
      setNote(lead.note);
      setCampaignName(lead.campaign_name);
      setCampaignId(lead.campaign_id);
      setAdSetName(lead.ad_set_name);
      setAdSetId(lead.ad_set_id);
      setAdName(lead.ad_name);
      setAdId(lead.ad_id);
      setFormName(lead.form_name);
      setFormId(lead.form_id);
    } else {
      setFullName("");
      setBrand("");
      setPhone("");
      setTelegram("");
      setProductId("");
      setSource("");
      setRegion("");
      setIndustry("");
      setAssignedEmail(user?.email?.toLowerCase() || "");
      setEstimatedAmount("");
      setNextContact("");
      setNote("");
      setCampaignName("");
      setCampaignId("");
      setAdSetName("");
      setAdSetId("");
      setAdName("");
      setAdId("");
      setFormName("");
      setFormId("");
    }
    setError(null);
  }, [open, lead, user]);

  useEffect(() => {
    if (!open || phone.trim().length < 7) {
      setDuplicateLead(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void findLeadByPhone(phone, lead?.id).then((found) => {
        if (!cancelled) setDuplicateLead(found);
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phone, open, lead]);

  const submit = async () => {
    if (!fullName.trim()) return setError("Ism yoki brend nomini kiriting");
    if (!phone.trim()) return setError("Telefon raqamini kiriting");
    setSaving(true);
    setError(null);
    try {
      const assignedStaff = staffList.find((s) => s.email === assignedEmail);
      const product = products.find((p) => p.id === productId);
      const actorEmail = user?.email?.toLowerCase() || "";
      const actorName = staff?.full_name || actorEmail;
      const payload = {
        full_name: fullName.trim(),
        brand: brand.trim(),
        phone: phone.trim(),
        telegram: telegram.trim(),
        interested_product_id: productId,
        interested_product_name: product?.name || "",
        source,
        campaign_name: campaignName.trim(),
        campaign_id: campaignId.trim(),
        ad_set_name: adSetName.trim(),
        ad_set_id: adSetId.trim(),
        ad_name: adName.trim(),
        ad_id: adId.trim(),
        form_name: formName.trim(),
        form_id: formId.trim(),
        assigned_to_email: assignedEmail,
        assigned_to_name: assignedStaff?.full_name || "",
        region,
        industry,
        estimated_amount: Number(estimatedAmount) || 0,
        next_contact_at: nextContact ? new Date(nextContact).toISOString() : null,
        note: note.trim(),
        updated_at: new Date().toISOString(),
      };

      if (source) await ensureLeadSource(source);
      if (campaignName) await ensureLeadCampaign(campaignName, campaignId);

      if (lead) {
        await updateOne("leads", lead.id, payload);
        await logLeadActivity(lead.id, "Ma'lumotlari tahrirlandi", actorEmail, actorName);
      } else {
        const lead_number = await nextLeadNumber();
        const created = await insertOne("leads", {
          ...payload,
          lead_number,
          status: "new",
          lost_reason: "",
          lost_comment: "",
          first_contact_at: null,
          last_contact_at: null,
          converted_customer_id: null,
          converted_order_id: null,
        });
        await logLeadActivity(created.id, "Lid yaratildi", actorEmail, actorName);
        if (assignedEmail) {
          await logLeadActivity(
            created.id,
            `Manager biriktirildi — ${assignedStaff?.full_name || assignedEmail}`,
            actorEmail,
            actorName,
          );
        }
      }
      setSaving(false);
      onSaved();
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Xatolik");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? "Lidni tahrirlash" : "Yangi lid qo'shish"}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}
      {duplicateLead && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Bu telefon raqami bilan allaqachon lid mavjud: <b>{duplicateLead.full_name}</b> (
            {duplicateLead.status === "lost" ? "yo'qotilgan" : "faol"}). Baribir davom etishingiz mumkin.
          </span>
        </div>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ism *</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="label">Brend</label>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Telefon *</label>
            <input
              className="input"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Telegram</label>
            <input className="input" placeholder="@username" value={telegram} onChange={(e) => setTelegram(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Qiziqqan mahsulot</label>
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">-- tanlang --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Manba</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">-- tanlang --</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Mas'ul menejer</label>
            <select className="input" value={assignedEmail} onChange={(e) => setAssignedEmail(e.target.value)}>
              <option value="">-- tanlanmagan --</option>
              {staffList.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.full_name} {s.email === staff?.email ? "(Men)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm font-semibold text-ink-600"
          onClick={() => setShowMarketing((v) => !v)}
        >
          Marketing ma'lumotlari (Target / Meta) — ixtiyoriy
          <ChevronDown className={`h-4 w-4 transition-transform ${showMarketing ? "rotate-180" : ""}`} />
        </button>
        {showMarketing && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3">
            <div>
              <label className="label">Kampaniya nomi</label>
              <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </div>
            <div>
              <label className="label">Kampaniya ID</label>
              <input className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />
            </div>
            <div>
              <label className="label">Ad Set nomi</label>
              <input className="input" value={adSetName} onChange={(e) => setAdSetName(e.target.value)} />
            </div>
            <div>
              <label className="label">Ad Set ID</label>
              <input className="input" value={adSetId} onChange={(e) => setAdSetId(e.target.value)} />
            </div>
            <div>
              <label className="label">E'lon nomi</label>
              <input className="input" value={adName} onChange={(e) => setAdName(e.target.value)} />
            </div>
            <div>
              <label className="label">E'lon ID</label>
              <input className="input" value={adId} onChange={(e) => setAdId(e.target.value)} />
            </div>
            <div>
              <label className="label">Forma nomi</label>
              <input className="input" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <label className="label">Forma ID</label>
              <input className="input" value={formId} onChange={(e) => setFormId(e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Viloyat</label>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">-- tanlang --</option>
              {UZBEKISTAN_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Soha</label>
            <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">-- tanlang --</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Taxminiy summa (so'm)</label>
            <input
              className="input"
              type="number"
              min="0"
              value={estimatedAmount}
              onChange={(e) => setEstimatedAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Keyingi aloqa</label>
            <input
              className="input"
              type="datetime-local"
              value={nextContact}
              onChange={(e) => setNextContact(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Izoh</label>
          <textarea
            className="input min-h-[70px]"
            placeholder="masalan: flayer haqida so'radi"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
