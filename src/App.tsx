import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./modules/dashboard/Dashboard";
import Orders from "./modules/orders/Orders";
import OrderDetail from "./modules/orders/OrderDetail";
import Customers from "./modules/customers/Customers";
import CustomerDetail from "./modules/customers/CustomerDetail";
import Brands from "./modules/brands/Brands";
import Proposals from "./modules/proposals/Proposals";
import ProposalEditor from "./modules/proposals/ProposalEditor";
import Textile from "./modules/textile/Textile";
import Warehouse from "./modules/warehouse/Warehouse";
import Finance from "./modules/finance/Finance";
import Reports from "./modules/reports/Reports";
import Design from "./modules/design/Design";
import Settings from "./modules/settings/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/brands" element={<Brands />} />
        <Route path="/proposals" element={<Proposals />} />
        <Route path="/proposals/new" element={<ProposalEditor />} />
        <Route path="/proposals/:id" element={<ProposalEditor />} />
        <Route path="/textile" element={<Textile />} />
        <Route path="/warehouse" element={<Warehouse />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/design" element={<Design />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
