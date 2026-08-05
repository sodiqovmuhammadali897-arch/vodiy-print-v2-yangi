import { useEffect, useState } from "react";
import { Upload, Save, FolderDown } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import TextileMatrixEditor from "../../../components/textile/TextileMatrixEditor";
import { insertOne, listAll, listWhere } from "../../../lib/firestoreDb";
import type { Order, OrderProduct, SizeBreakdownEntry, TextileSizeTemplate } from "../../../lib/types";
import {
  breakdownToMatrixRows,
  matrixRowsToBreakdown,
  type SizeMatrixRow,
} from "../../../lib/textileMatrix";
import { useAuth } from "../../../lib/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
  productName: string;
  initialBreakdown: SizeBreakdownEntry[];
  onSave: (breakdown: SizeBreakdownEntry[]) => void;
};

export default function TextileSizeMatrixModal({
  open,
  onClose,
  productName,
  initialBreakdown,
  onSave,
}: Props) {
  const { user, staff } = useAuth();
  const [rows, setRows] = useState<SizeMatrixRow[]>([]);
  const [loadOrderNumber, setLoadOrderNumber] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [templates, setTemplates] = useState<TextileSizeTemplate[]>([]);
  const [templateChoice, setTemplateChoice] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(breakdownToMatrixRows(initialBreakdown));
    setLoadOrderNumber("");
    setLoadError(null);
    setTemplateChoice("");
    void listAll<TextileSizeTemplate>("textile_size_templates", {
      orderBy: ["created_at", "desc"],
    }).then(setTemplates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadByOrderId = async () => {
    const num = loadOrderNumber.trim();
    if (!num) return;
    setLoadingOrder(true);
    setLoadError(null);
    try {
      const orders = await listWhere<Order>("orders", "order_number", num);
      const order = orders[0];
      if (!order) {
        setLoadError("Bunday raqamli buyurtma topilmadi");
        return;
      }
      const products = await listWhere<OrderProduct>("order_products", "order_id", order.id);
      const withBreakdown = products.find(
        (p) => Array.isArray(p.size_breakdown) && p.size_breakdown.length > 0,
      );
      if (!withBreakdown) {
        setLoadError("Bu buyurtmada razmer/rang taqsimoti topilmadi");
        return;
      }
      setRows(breakdownToMatrixRows(withBreakdown.size_breakdown));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      setLoadingOrder(false);
    }
  };

  const saveAsTemplate = async () => {
    const name = prompt("Shablon nomi (masalan: Alpha School - Futbolka)");
    if (!name || !name.trim()) return;
    setSavingTemplate(true);
    try {
      await insertOne("textile_size_templates", {
        name: name.trim(),
        product_name: productName,
        client_name: "",
        size_breakdown: matrixRowsToBreakdown(rows),
        created_by: staff?.full_name || user?.email || "",
        created_at: new Date().toISOString(),
      });
      const fresh = await listAll<TextileSizeTemplate>("textile_size_templates", {
        orderBy: ["created_at", "desc"],
      });
      setTemplates(fresh);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Shablonni saqlab bo'lmadi");
    } finally {
      setSavingTemplate(false);
    }
  };

  const loadTemplate = (id: string) => {
    setTemplateChoice(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setRows(breakdownToMatrixRows(tpl.size_breakdown));
  };

  const save = () => {
    onSave(matrixRowsToBreakdown(rows));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Razmer va ranglar taqsimoti"
      description={productName || undefined}
      size="xl"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn-primary" onClick={save}>
            <Save className="h-4 w-4" /> Saqlash
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">ID orqali yuklash</label>
            <div className="flex gap-1">
              <input
                className="input w-36"
                placeholder="VP-00231"
                value={loadOrderNumber}
                onChange={(e) => setLoadOrderNumber(e.target.value)}
              />
              <button className="btn-secondary" onClick={loadByOrderId} disabled={loadingOrder}>
                <Upload className="h-4 w-4" /> Yuklash
              </button>
            </div>
          </div>
          <div>
            <label className="label">Shablondan yuklash</label>
            <select
              className="input w-56"
              value={templateChoice}
              onChange={(e) => loadTemplate(e.target.value)}
            >
              <option value="">-- shablon tanlang --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn-secondary"
            onClick={saveAsTemplate}
            disabled={savingTemplate || rows.length === 0}
          >
            <FolderDown className="h-4 w-4" /> Shablon sifatida saqlash
          </button>
        </div>
        {loadError && <p className="text-xs text-rose-600">{loadError}</p>}

        <TextileMatrixEditor rows={rows} onChange={setRows} />
      </div>
    </Modal>
  );
}
