import { Routes, Route, Navigate } from "react-router-dom";
import { lazy } from "react";
import Layout from "./components/layout/Layout";
import Dashboard from "./modules/dashboard/Dashboard";

const Orders = lazy(() => import("./modules/orders/Orders"));
const OrderDetail = lazy(() => import("./modules/orders/OrderDetail"));
const OrderWizard = lazy(() => import("./modules/orders/wizard/OrderWizard"));
const Customers = lazy(() => import("./modules/customers/Customers"));
const CustomerDetail = lazy(() => import("./modules/customers/CustomerDetail"));
const Brands = lazy(() => import("./modules/brands/Brands"));
const Proposals = lazy(() => import("./modules/proposals/Proposals"));
const ProposalEditor = lazy(() => import("./modules/proposals/ProposalEditor"));
const Textile = lazy(() => import("./modules/textile/Textile"));
const Warehouse = lazy(() => import("./modules/warehouse/Warehouse"));
const Finance = lazy(() => import("./modules/finance/Finance"));
const Reports = lazy(() => import("./modules/reports/Reports"));
const Design = lazy(() => import("./modules/design/Design"));
const Settings = lazy(() => import("./modules/settings/Settings"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/new" element={<OrderWizard />} />
        <Route path="/orders/:id/edit" element={<OrderWizard />} />
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
