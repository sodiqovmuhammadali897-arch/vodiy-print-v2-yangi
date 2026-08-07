import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import { insertOne, listWhere, updateOne } from "../../lib/firestoreDb";
import { computeOrderTotals } from "../../lib/orderCalculations";
import type { Order, OrderPayment, OrderProduct } from "../../lib/types";
import { PAYMENT_TYPES } from "../../lib/orderConstants";
import { useAuth } from "../../lib/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
  order: Order | null;
  onSaved: () => void;
};

export default function OrderPaymentModal({ open, onClose, order, onSaved }: Props) {
  const { staff, user } = useAuth();
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<string>(PAYMENT_TYPES[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setPaymentType(PAYMENT_TYPES[0]);
      setDate(new Date().toISOString().slice(0, 10));
      setNote("");
      setError(null);
    }
  }, [open, order?.id]);

  const submit = async () => {
    if (!order) return;
    const value = Number(amount);
    if (!value || value <= 0) return setError("To'g'ri summa kiriting");
    setSaving(true);
    setError(null);
    try {
      await insertOne<Omit<OrderPayment, "id" | "created_at">>("order_payments", {
        order_id: order.id,
        amount: value,
        payment_type: paymentType,
        payment_date: date,
        received_by: staff?.full_name || user?.email || "",
        note,
      });
      const [products, payments] = await Promise.all([
        listWhere<OrderProduct>("order_products", "order_id", order.id),
        listWhere<OrderPayment>("order_payments", "order_id", order.id),
      ]);
      const totals = computeOrderTotals(products, order.discount_amount, payments);
      await updateOne("orders", order.id, {
        paid_amount: totals.paid,
        remaining_amount: totals.remaining,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="To'lov qabul qilish"
      description={order?.order_number ? `Buyurtma: ${order.order_number}` : undefined}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Summa *</label>
          <input
            className="input"
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="label">To'lov turi</label>
          <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            {PAYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sana</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Izoh</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
