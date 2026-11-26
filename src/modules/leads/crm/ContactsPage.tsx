import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import { deleteOne, insertOne, updateOne } from "../../../lib/firestoreDb";
import { CONTACT_TYPES, contactProblem, contactType, phoneDigits, type ContactType, type CrmContact } from "../../../lib/contacts";
import { markCrmLost, type Actor } from "../../../lib/crmService";
import type { CrmData } from "./useCrm";
import { useContacts } from "./useContacts";
import { sectionLabel } from "../../../lib/crmSettings";

// Sotuv bo'limi → Kontaktlar (2026-11-26; the owner: «ishxona nomerlari,
// shaxsiy kontaktlarni kirgizib qo'ysak, u nomerlar zadacha yoki yangi
// lidlarga tushmasin»; «manager ham qo'shsa bo'lsin»). See src/lib/contacts.ts.
const LOST_REASON = "Kontakt (lid emas)";

// Saves a contact; an open lead with the same number is closed as «not a lead».
export async function saveContact(
  form: { name: string; phone: string; type: ContactType; note: string },
  actor: Actor,
  crm: Pick<CrmData, "leads" | "tasks">,
  editing: CrmContact | null,
): Promise<number> {
  const digits = phoneDigits(form.phone);
  const fields = { name: form.name.trim(), phone: form.phone.trim(), digits, type: form.type, note: form.note.trim() };
  if (editing) await updateOne("crm_contacts", editing.id, fields);
  else await insertOne("crm_contacts", { ...fields, added_by_email: actor.email, added_by_name: actor.name, calls_count: 0 });
  let closed = 0;
  for (const l of crm.leads || []) {
    if (l.status === "lost" || l.converted_order_id || phoneDigits(l.phone) !== digits) continue;
    try {
      await markCrmLost(l, LOST_REASON, `Kontaktlarga qo'shildi: «${fields.name}»`, crm.tasks.filter((t) => t.lead_id === l.id && t.status === "open"), actor);
      closed++;
    } catch {
      // another manager's lead: the rules keep it; the owner can close it
    }
  }
  return closed;
}

export function ContactModal({ open, onClose, crm, editing = null, phone = "", existing }: { open: boolean; onClose: (msg?: string) => void; crm: CrmData; editing?: CrmContact | null; phone?: string; existing: CrmContact[] }) {
  const [form, setForm] = useState({ name: editing?.name || "", phone: editing?.phone || phone, type: (editing?.type || "office") as ContactType, note: editing?.note || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const p = contactProblem(form.name, form.phone, existing, editing?.id);
    if (p) return setError(p);
    setBusy(true);
    setError(null);
    try {
      const closed = await saveContact(form, crm.actor, crm, editing);
      onClose(closed ? `Saqlandi. Shu raqamdagi ${closed} ta lid «${LOST_REASON}» deb yopildi.` : "Saqlandi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={() => onClose()}
      title={editing ? "Kontaktni tahrirlash" : "Yangi kontakt"}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={() => onClose()}>
            Bekor
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>
            Saqlash
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-500">Bu raqamdan qo'ng'iroq kelsa yoki unga qilinsa — lid ochilmaydi, zadacha qo'yilmaydi, gaplashgan vaqtga qo'shilmaydi.</p>
        <div>
          <label className="label">Ism</label>
          <input className="input" autoFocus placeholder="Masalan: Kuryer Anvar" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input className="input" inputMode="tel" placeholder="+998 90 123 45 67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Turi</label>
          <div className="flex flex-wrap gap-1.5">
            {CONTACT_TYPES.map((t) => (
              <button key={t.key} type="button" onClick={() => setForm({ ...form, type: t.key })} className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${form.type === t.key ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200" : "border-ink-200 text-ink-600 hover:bg-ink-50"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Izoh (ixtiyoriy)</label>
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>
    </Modal>
  );
}

export default function ContactsPage({ crm }: { crm: CrmData }) {
  const { contacts } = useContacts();
  const [q, setQ] = useState("");
  const [type, setType] = useState<ContactType | "">("");
  const [modal, setModal] = useState<{ editing: CrmContact | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const d = phoneDigits(q);
    return (contacts || [])
      .filter((c) => (!type || c.type === type) && (!s || c.name.toLowerCase().includes(s) || (d.length >= 3 && c.digits.includes(d))))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, q, type]);
  const count = (t: ContactType) => (contacts || []).filter((c) => c.type === t).length;
  const mayEdit = (c: CrmContact) => crm.isAdmin || c.added_by_email === crm.email;
  const remove = async (c: CrmContact) => {
    if (!window.confirm(`«${c.name}» kontaktlardan o'chirilsinmi? Keyingi qo'ng'iroqlari yana lid bo'lishi mumkin.`)) return;
    await deleteOne("crm_contacts", c.id).catch((e) => setMsg(e instanceof Error ? e.message : "O'chirib bo'lmadi"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">{sectionLabel("kontaktlar")}</h1>
          <p className="max-w-3xl text-sm text-ink-500">Bu raqamlar lid emas: qo'ng'iroq kelsa ham yangi lid ochilmaydi, zadacha qo'yilmaydi, «qaytarilmagan» ro'yxatiga va gaplashgan vaqtga qo'shilmaydi.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal({ editing: null })}>
          + Yangi kontakt
        </button>
      </div>
      {msg && <div className="rounded-xl border border-ink-200 bg-surface px-4 py-2.5 text-sm text-ink-700">{msg}</div>}

      <div className="rounded-2xl border border-ink-100 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="input w-auto min-w-[220px] py-1.5" placeholder="Ism yoki raqam" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" onClick={() => setType("")} className={`rounded-full px-3 py-1 text-xs font-semibold ${!type ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"}`}>
            Hammasi {contacts?.length || 0}
          </button>
          {CONTACT_TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setType(t.key)} className={`rounded-full px-3 py-1 text-xs font-semibold ${type === t.key ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"}`}>
              {t.icon} {t.label.split(" /")[0]} {count(t.key)}
            </button>
          ))}
        </div>
        {contacts === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-ink-100/70" />
        ) : !list.length ? (
          <p className="py-8 text-center text-sm text-ink-500">{contacts.length ? "Topilmadi" : "Hali kontakt yo'q. Ishxona, xodimlar, kuryer raqamlarini qo'shing."}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-ink-500">
                  <th className="px-2 py-1.5 font-semibold">Kontakt</th>
                  <th className="px-2 py-1.5 font-semibold">Telefon</th>
                  <th className="px-2 py-1.5 font-semibold">Turi</th>
                  <th className="px-2 py-1.5 font-semibold">Qo'shgan</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Qo'ng'iroqlar</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {list.map((c) => {
                  const t = contactType(c.type);
                  return (
                    <tr key={c.id}>
                      <td className="px-2 py-2">
                        <div className="font-semibold text-ink-900">{c.name}</div>
                        {c.note && <div className="text-xs text-ink-500">{c.note}</div>}
                      </td>
                      <td className="px-2 py-2 tabular-nums text-ink-700">{c.phone}</td>
                      <td className="px-2 py-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.cls}`}>
                          {t.icon} {t.label.split(" /")[0]}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-ink-500">{c.added_by_name}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-ink-700">{c.calls_count || 0}</td>
                      <td className="px-2 py-2 text-right">
                        {mayEdit(c) && (
                          <span className="inline-flex gap-1">
                            <button type="button" aria-label="Tahrirlash" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900" onClick={() => setModal({ editing: c })}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" aria-label="O'chirish" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" onClick={() => void remove(c)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-ink-400">Qo'ng'iroqlar soni — kontaktga qo'shilgandan beri. Kontaktni qo'shgan odam yoki rahbar o'zgartira oladi.</p>
      </div>

      {modal && (
        <ContactModal
          open
          crm={crm}
          editing={modal.editing}
          existing={contacts || []}
          onClose={(m) => {
            setModal(null);
            if (m) setMsg(m);
          }}
        />
      )}
    </div>
  );
}
