import { Plus, Trash2, ExternalLink, Paperclip } from "lucide-react";
import type { WizardFileLink } from "../../../lib/orderService";
import { FILE_LINK_TYPES } from "../../../lib/orderConstants";

type Props = {
  files: WizardFileLink[];
  setFiles: (updater: (prev: WizardFileLink[]) => WizardFileLink[]) => void;
};

export default function FilesStep({ files, setFiles }: Props) {
  const add = () =>
    setFiles((f) => [
      ...f,
      { filename: "", url: "", link_type: "Boshqa", note: "" },
    ]);
  const update = (i: number, patch: Partial<WizardFileLink>) =>
    setFiles((f) => f.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const remove = (i: number) =>
    setFiles((f) => f.filter((_, idx) => idx !== i));

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-ink-900">
            Fayl havolalari
          </h2>
          <p className="text-xs text-ink-500">
            Telegram, PDF, dizayn — cheklanmagan havola qo'shishingiz mumkin
          </p>
        </div>
        <button className="btn-primary" onClick={add}>
          <Plus className="h-4 w-4" /> Havola qo'shish
        </button>
      </div>

      {files.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          <Paperclip className="mx-auto mb-2 h-6 w-6 text-ink-400" />
          Fayl havolalari qo'shilmagan
        </div>
      )}

      <div className="space-y-2">
        {files.map((f, i) => (
          <div
            key={i}
            className="grid grid-cols-12 gap-2 rounded-xl border border-ink-100 p-3"
          >
            <div className="col-span-12 md:col-span-3">
              <label className="label">Fayl nomi</label>
              <input
                className="input"
                value={f.filename}
                onChange={(e) => update(i, { filename: e.target.value })}
              />
            </div>
            <div className="col-span-6 md:col-span-2">
              <label className="label">Turi</label>
              <select
                className="input"
                value={f.link_type}
                onChange={(e) => update(i, { link_type: e.target.value })}
              >
                {FILE_LINK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-12 md:col-span-4">
              <label className="label">Havola</label>
              <input
                className="input"
                placeholder="https://..."
                value={f.url}
                onChange={(e) => update(i, { url: e.target.value })}
              />
            </div>
            <div className="col-span-10 md:col-span-2">
              <label className="label">Izoh</label>
              <input
                className="input"
                value={f.note}
                onChange={(e) => update(i, { note: e.target.value })}
              />
            </div>
            <div className="col-span-2 md:col-span-1 flex items-end justify-end gap-1">
              {f.url && (
                <a
                  className="btn-ghost"
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <button
                className="btn-ghost text-rose-600 hover:bg-rose-50"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
