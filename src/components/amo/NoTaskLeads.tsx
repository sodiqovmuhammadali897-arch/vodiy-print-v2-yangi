import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import Modal from "../ui/Modal";
import { subscribeOne } from "../../lib/firestoreDb";
import type { AmoLeadBrief } from "../../lib/amoStats";

// «Zadachasiz lid: N» that opens the deals themselves (the owner,
// 2026-11-14: «qaysiligini ko'rsatib turadigan qilish kerak, amoda
// ko'rinmayapti»). The list comes with the amoCRM numbers
// (meta-webhook/amoTasks.js no_task_list: the 30 biggest by sum); each
// row opens the deal in amoCRM, where the manager puts the next task.
const mln = (n: number) => (n ? `${(n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} mln` : "summa yo'q");

export function useAmoHost(): string {
  const [host, setHost] = useState("");
  useEffect(() => subscribeOne<{ host?: string }>("amo_meta", "status", (s) => setHost((s && s.host) || "")), []);
  return host;
}

export function NoTaskLeadsModal({ name, count, list, onClose }: { name?: string; count: number; list: AmoLeadBrief[]; onClose: () => void }) {
  const host = useAmoHost();
  const url = (id: number) => (host ? `https://${host}/leads/detail/${id}` : null);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${name ? `${name} · ` : ""}zadachasiz bitimlar: ${count}`}
      description={`Har biriga amoCRM'da keyingi zadacha qo'ying — 2 daqiqada ro'yxatdan chiqadi.${count > list.length ? ` Summasi eng kattalari ${list.length} tasi ko'rsatilgan.` : ""}`}
      size="lg"
    >
      {list.length ? (
        <div className="divide-y divide-ink-100">
          {list.map((l) => {
            const href = url(l.id);
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink-900">{l.name}</div>
                  <div className="text-xs text-ink-500">{[mln(l.price), l.stage, l.updated && `oxirgi harakat ${l.updated}`].filter(Boolean).join(" · ")}</div>
                </div>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                    amoCRM'da ochish <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="text-xs text-ink-400">#{l.id}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-ink-500">Ro'yxat hali kelmagan — server amoCRM'dan 2 daqiqada yangilaydi.</p>
      )}
    </Modal>
  );
}

// The chip/number a person clicks.
export function NoTaskLeadsButton({ name, count, list, className, children }: { name?: string; count: number; list?: AmoLeadBrief[]; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!count) return <>{children}</>;
  return (
    <>
      <button type="button" className={`cursor-pointer underline decoration-dotted underline-offset-2 ${className || ""}`} title="Qaysi bitimlar — ro'yxatni ochish" onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <NoTaskLeadsModal name={name} count={count} list={list || []} onClose={() => setOpen(false)} />}
    </>
  );
}
