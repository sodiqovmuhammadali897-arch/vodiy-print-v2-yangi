import { useRef, useState } from "react";
import { FileDown, Sheet, Printer, Share2 } from "lucide-react";
import Modal from "../../components/ui/Modal";
import TextileMatrixTable from "../../components/textile/TextileMatrixTable";
import type { CompanySettings } from "../../lib/types";
import type { TextileMatrix } from "../../lib/textileMatrix";
import { TEXTILE_SIZES } from "../../lib/orderConstants";
import { formatDate } from "../../lib/format";
import { exportCsv } from "../../lib/exportCsv";
import { exportTextileMatrixPdf, printTextileMatrix, shareTextileMatrix } from "./textileExport";

type Props = {
  open: boolean;
  onClose: () => void;
  company: CompanySettings | null;
  orderNumber: string;
  idLabel?: string;
  clientName: string;
  productName: string;
  orderDate: string | null;
  matrix: TextileMatrix;
};

export default function TextileMatrixExport({
  open,
  onClose,
  company,
  orderNumber,
  idLabel = "ID",
  clientName,
  productName,
  orderDate,
  matrix,
}: Props) {
  const docRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const fileBase = `${orderNumber || "buyurtma"}-razmerlar`.replace(/\s+/g, "-");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(null);
    }
  };

  const doExcel = () => {
    const headers = ["Rang", ...TEXTILE_SIZES, "Jami", "%"];
    const rows = matrix.rows.map((r) => [
      r.color,
      ...TEXTILE_SIZES.map((s) => r.qty[s] || 0),
      r.total,
      matrix.grandTotal > 0 ? `${Math.round((r.total / matrix.grandTotal) * 100)}%` : "0%",
    ]);
    rows.push([
      "JAMI",
      ...TEXTILE_SIZES.map((s) => matrix.sizeTotals[s]),
      matrix.grandTotal,
      "100%",
    ]);
    exportCsv(fileBase, headers, rows);
  };

  const summaryText = `${company?.name || "Vodiy Print"} — Buyurtma ${orderNumber}\nMijoz: ${clientName}\nMahsulot: ${productName}\nJami: ${matrix.grandTotal} dona`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Klentga tasdiqlatish uchun hujjat"
      size="xl"
      footer={
        <>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => run("pdf", () => exportTextileMatrixPdf(docRef.current!, fileBase))}
          >
            <FileDown className="h-4 w-4" /> PDF
          </button>
          <button className="btn-secondary" disabled={busy !== null} onClick={doExcel}>
            <Sheet className="h-4 w-4" /> Excel
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => run("print", () => printTextileMatrix(docRef.current!))}
          >
            <Printer className="h-4 w-4" /> Chop etish
          </button>
          <button
            className="btn-primary"
            disabled={busy !== null}
            onClick={() =>
              run("share", () => shareTextileMatrix(docRef.current!, fileBase, summaryText))
            }
          >
            <Share2 className="h-4 w-4" /> Ulashish
          </button>
        </>
      }
    >
      <div ref={docRef} className="force-light space-y-4 bg-white p-2">
        <div className="-mx-2 -mt-2 h-1.5 rounded-t bg-gradient-to-r from-emerald-600 to-emerald-400" />
        <div className="flex items-start justify-between gap-4 border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="" className="h-12 w-12 rounded object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-emerald-700 font-display text-lg font-bold text-white">
                {(company?.name || "VP").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="font-display text-lg font-bold text-emerald-800">
                {company?.name || "Vodiy Print"}
              </div>
              <div className="text-xs text-ink-500">Razmerlar taqsimoti</div>
            </div>
          </div>
          <div className="text-right text-sm text-ink-700">
            <div>
              Klent: <span className="font-semibold">{clientName || "-"}</span>
            </div>
            <div>
              {idLabel}: <span className="font-semibold">{orderNumber || "-"}</span>
            </div>
            <div>Sana: {formatDate(orderDate)}</div>
          </div>
        </div>

        {productName && (
          <div className="text-sm text-ink-700">
            Mahsulot: <span className="font-semibold">{productName}</span>
          </div>
        )}

        <TextileMatrixTable matrix={matrix} />

        <div className="mt-6 flex items-center justify-between text-sm text-ink-700">
          <div>Klent imzosi: ________________________</div>
          <div>Sana: ________________</div>
        </div>
      </div>
    </Modal>
  );
}
