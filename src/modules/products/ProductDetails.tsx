import { useState } from "react";
import type { Product, ProductVendor } from "../../lib/types";
import ProductHeader from "./ProductHeader";
import ProductSpecs from "./ProductSpecs";
import ProductPricingTable from "./ProductPricingTable";
import ProductSupplierCard from "./ProductSupplierCard";
import ProductDescription from "./ProductDescription";
import ProductSalesStats from "./ProductSalesStats";
import ProductRecentOrders from "./ProductRecentOrders";

type Props = {
  product: Product;
  allProducts: Product[];
  canEdit: boolean;
  isAdmin: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  onSelectUpsell: (p: Product) => void;
};

export default function ProductDetails({
  product,
  allProducts,
  canEdit,
  isAdmin,
  onEdit,
  onDuplicate,
  onToggleActive,
  onToggleArchive,
  onDelete,
  onSelectUpsell,
}: Props) {
  const [primaryVendor, setPrimaryVendor] = useState<ProductVendor | null>(null);

  return (
    <div className="space-y-4">
      <ProductHeader
        product={product}
        primaryVendor={primaryVendor}
        canEdit={canEdit}
        isAdmin={isAdmin}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onToggleActive={onToggleActive}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProductSpecs product={product} />
        <ProductSupplierCard productId={product.id} canEdit={canEdit} onPrimaryChange={setPrimaryVendor} />
      </div>

      <ProductPricingTable product={product} />

      <ProductDescription product={product} allProducts={allProducts} onSelectUpsell={onSelectUpsell} />

      <ProductSalesStats product={product} />
      <ProductRecentOrders product={product} />
    </div>
  );
}
