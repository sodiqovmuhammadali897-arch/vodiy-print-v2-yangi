import { useEffect, useState } from "react";
import { Eye, Boxes } from "lucide-react";
import { listAll, updateOne } from "../../lib/firestoreDb";
import type { Product } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import { canExportCustomerPrice } from "../../lib/rolePermissions";
import AsyncState from "../../components/ui/AsyncState";
import ProductList from "./ProductList";
import ProductDetails from "./ProductDetails";
import ProductFormModal from "./ProductFormModal";
import ProductCustomerView from "./ProductCustomerView";

export default function ProductsPage() {
  const auth = useAuth();
  const canEdit = auth.can("products", "edit");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<Product | null>(null);
  const [customerView, setCustomerView] = useState(false);

  const load = async (keepSelection = true) => {
    setLoading(true);
    const data = await listAll<Product>("products", { orderBy: ["name", "asc"] });
    setProducts(data);
    setLoading(false);
    if (!keepSelection || (!selectedId && data.length > 0)) {
      setSelectedId(data[0]?.id ?? null);
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = products.find((p) => p.id === selectedId) || null;

  const openNew = () => {
    setEditing(null);
    setDuplicateFrom(null);
    setModalOpen(true);
  };
  const openEdit = () => {
    if (!selected) return;
    setEditing(selected);
    setDuplicateFrom(null);
    setModalOpen(true);
  };
  const openDuplicate = () => {
    if (!selected) return;
    setEditing(null);
    setDuplicateFrom(selected);
    setModalOpen(true);
  };

  const toggleActive = async () => {
    if (!selected) return;
    await updateOne("products", selected.id, { is_active: selected.is_active === false });
    await load();
  };
  const toggleArchive = async () => {
    if (!selected) return;
    await updateOne("products", selected.id, {
      archived_at: selected.archived_at ? null : new Date().toISOString(),
    });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Mahsulotlar</h1>
          <p className="text-sm text-ink-500">Barcha mahsulotlar ro'yxati va narxlari</p>
        </div>
        {selected && canExportCustomerPrice(auth) && (
          <button
            className={`btn-secondary ${customerView ? "!bg-brand-600 !text-white" : ""}`}
            onClick={() => setCustomerView((v) => !v)}
          >
            <Eye className="h-4 w-4" /> Mijozga ko'rsatish rejimi
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-160px)]">
          <ProductList
            products={products}
            loading={loading}
            selectedId={selectedId}
            onSelect={(p) => {
              setSelectedId(p.id);
              setCustomerView(false);
            }}
            canEdit={canEdit}
            onNew={openNew}
          />
        </div>

        <div>
          <AsyncState
            loading={loading}
            empty={!loading && !selected}
            emptyLabel="Mahsulot tanlanmagan"
            emptyDescription="Chapdagi ro'yxatdan mahsulot tanlang yoki yangisini qo'shing"
            emptyIcon={<Boxes className="h-5 w-5" />}
          >
            {selected &&
              (customerView ? (
                <ProductCustomerView product={selected} onClose={() => setCustomerView(false)} />
              ) : (
                <ProductDetails
                  product={selected}
                  allProducts={products}
                  canEdit={canEdit}
                  onEdit={openEdit}
                  onDuplicate={openDuplicate}
                  onToggleActive={toggleActive}
                  onToggleArchive={toggleArchive}
                  onSelectUpsell={(p) => {
                    setSelectedId(p.id);
                    setCustomerView(false);
                  }}
                />
              ))}
          </AsyncState>
        </div>
      </div>

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        product={editing}
        duplicateFrom={duplicateFrom}
        allProducts={products}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />
    </div>
  );
}
