import { useAuth } from "../../lib/AuthContext";
import AmoAnalyticsView from "./AmoAnalyticsView";
import SalesShell from "./SalesShell";
import { FonButton, useSalesFon } from "./SalesFon";
import { useCrmOpen } from "./crm/crmOpen";

// Sotuv bo'limi. Admins get the new five sections in a left menu
// (SalesShell.tsx — Bosh sahifa, Lidlar, Zadachalar, Qo'ng'iroqlar, Tahlil;
// 2026-11-25, moving off amoCRM within a month). Everyone else still sees
// their own amoCRM numbers until the section opens to managers.
export default function SalesPipeline() {
  const { isAdmin, user } = useAuth();

  const amo = (
    <AmoAnalyticsView
      isAdmin={isAdmin}
      email={user?.email?.toLowerCase() || ""}
    />
  );
  // Everyone may put their own picture behind the page (SalesFon.tsx).
  const { fon, setFon } = useSalesFon();
  const fonButton = <FonButton fon={fon} setFon={setFon} />;
  // The owner opens the new section to managers (step 4, crm_settings/main).
  const openToManagers = useCrmOpen();
  // «Lidlar (ERP)» — the ERP's own CRM (crm/*) — only the owner sees it
  // for now (the owner, 2026-11-12: «managerlarga ko'rinmay tursin»).
  if (!isAdmin && !openToManagers)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{fonButton}</div>
        {amo}
      </div>
    );
  // Admins, and managers once it is opened: the five sections (SalesShell.tsx).
  return <SalesShell amo={amo} fonButton={fonButton} />;
}
