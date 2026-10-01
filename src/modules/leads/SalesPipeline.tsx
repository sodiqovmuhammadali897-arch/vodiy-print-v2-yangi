import { useAuth } from "../../lib/AuthContext";
import AmoAnalyticsView from "./AmoAnalyticsView";

// Sotuv bo'limi is the amoCRM analysis only: leads are worked in amoCRM,
// the ERP shows the numbers (see AmoAnalyticsView, meta-webhook/amocrm.js).
export default function SalesPipeline() {
  const { isAdmin, user } = useAuth();
  return <AmoAnalyticsView isAdmin={isAdmin} email={user?.email?.toLowerCase() || ""} />;
}
