import { useEffect, useState } from "react";
import { Eye, Boxes } from "lucide-react";
import { listAll, updateOne, deleteOne, deleteWhere } from "../../lib/firestoreDb";
import type { Product } from "../../lib/types";
import { useAuth } from "../../lib/AuthContext";
import { canExportCustomerPrice } from "../../lib/rolePermissions";
import AsyncState from "../../components/ui/AsyncState";
import ProductList from "./ProductList";
import ProductDetails from "./ProductDetails";
import ProductFormModal from "./ProductFormModal";
import ProductCustomerView from "./ProductCustomerView";
import ProductSheet from "./ProductSheet";

const DESKTOP = "(min-width: 1024px)";
const isDesktop = () => typeof window !== "undefined" && window.matchMedia(DESKTOP).matches;

export default function ProductsPage() {
  const auth = useAuth();
  const canEdit = auth.can("products", "edit");
  // A linked manager profile always sees the customer-facing price view
  // — never the admin view with cost price/margin — regardless of role,
  // same reasoning as canViewCostPrice/canEditCostPrice.
  const forcedCustomerView = auth.isManagerAccount;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<Product | null>(null);
  const [customerView, setCustomerView] = useState(false);
  const showCustomerView = forcedCustomerView || customerView;
  // Phones: the chosen product opens in a bottom sheet over the list.
  const [desktop, setDesktop] = useState(isDesktop);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  // The phone's back button closes the sheet instead of leaving the page.
  useEffect(() => {
    if (!sheetOpen) return;
    const onPop = () => setSheetOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [sheetOpen]);

  const openSheet = () => {
    if (isDesktop()) return;
    if (!sheetOpen) window.history.pushState({ ...(window.history.state || {}), productSheet: true }, "");
    setSheetOpen(true);
  };
  const closeSheet = () => {
    if (window.history.state?.productSheet) window.history.back();
    else setSheetOpen(false);
  };

  // The spinner is only for the very first load; a reload after saving
  // keeps the list on screen.
  const load = async (keepSelection = true) => {
    const data = await listAll<Product>("products", { orderBy: ["name", "asc"] });
    setProducts(data);
    setLoading(false);
    // /products?id=… (e.g. from Darslik) opens that product.
    const wanted = new URLSearchParams(window.location.search).get("id");
    if (!keepSelection && wanted && data.some((p) => p.id === wanted)) {
      setSelectedId(wanted);
      openSheet();
    } else if (!keepSelection || (!selectedId && data.length > 0)) {
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
  const deleteProduct = async () => {
    if (!selected) return;
    if (!confirm(`"${selected.name}" mahsuloti butunlay o'chirilsinmi? Bu amalni ortga qaytarib bo'lmaydi.`)) return;
    await deleteWhere("product_vendors", "product_id", selected.id);
    await deleteOne("product_costs", selected.id);
    await deleteOne("products", selected.id);
    setSelectedId(null);
    await load(false);
  };

  const details = selected &&
              (showCustomerView ? (
                <ProductCustomerView
                  product={selected}
                  onClose={forcedCustomerView ? undefined : () => setCustomerView(false)}
                />
              ) : (
                <ProductDetails
                  product={selected}
                  allProducts={products}
                  canEdit={canEdit}
                  isAdmin={auth.isAdmin}
                  onEdit={openEdit}
                  onDuplicate={openDuplicate}
                  onToggleActive={toggleActive}
                  onToggleArchive={toggleArchive}
                  onDelete={deleteProduct}
                  onSelectUpsell={(p) => {
                    setSelectedId(p.id);
                    setCustomerView(false);
                  }}
                  onSaved={() => void load()}
                />
              ));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Mahsulotlar</h1>
          <p className="text-sm text-ink-500">Barcha mahsulotlar ro'yxati va narxlari</p>
        </div>
        {selected && !forcedCustomerView && canExportCustomerPrice(auth) && (
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
              openSheet();
            }}
            canEdit={canEdit}
            onNew={openNew}
          />
        </div>

        {/* On phones the details live in the bottom sheet below. */}
        <div className="hidden lg:block">
          <AsyncState
            loading={loading}
            empty={!loading && !selected}
            emptyLabel="Mahsulot tanlanmagan"
            emptyDescription="Chapdagi ro'yxatdan mahsulot tanlang yoki yangisini qo'shing"
            emptyIcon={<Boxes className="h-5 w-5" />}
          >
            {desktop && details}
          </AsyncState>
        </div>
      </div>

      {!desktop && sheetOpen && selected && (
        <ProductSheet
          product={selected}
          onClose={closeSheet}
          canShowLesson={auth.isAdmin || auth.can("leads", "view")}
          customerView={customerView}
          onCustomerView={!forcedCustomerView && canExportCustomerPrice(auth) ? () => setCustomerView((v) => !v) : undefined}
        >
          {details}
        </ProductSheet>
      )}

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
