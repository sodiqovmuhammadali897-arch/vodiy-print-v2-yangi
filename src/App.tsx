import { Routes, Route, Navigate } from "react-router-dom";
import { lazy } from "react";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PermissionRoute from "./components/auth/PermissionRoute";
import AdminRoute from "./components/auth/AdminRoute";
import Login from "./modules/auth/Login";
import Dashboard from "./modules/dashboard/Dashboard";

const Orders = lazy(() => import("./modules/orders/Orders"));
const OrderDetail = lazy(() => import("./modules/orders/OrderDetail"));
const OrderWizard = lazy(() => import("./modules/orders/wizard/OrderWizard"));
const Customers = lazy(() => import("./modules/customers/Customers"));
const CustomerDetail = lazy(() => import("./modules/customers/CustomerDetail"));
const Products = lazy(() => import("./modules/products/Products"));
const Proposals = lazy(() => import("./modules/proposals/Proposals"));
const ProposalEditor = lazy(() => import("./modules/proposals/ProposalEditor"));
const Textile = lazy(() => import("./modules/textile/Textile"));
const Warehouse = lazy(() => import("./modules/warehouse/Warehouse"));
const Finance = lazy(() => import("./modules/finance/Finance"));
const Reports = lazy(() => import("./modules/reports/Reports"));
const Production = lazy(() => import("./modules/production/Production"));
const AttendancePage = lazy(() => import("./modules/attendance/AttendancePage"));
const Tasks = lazy(() => import("./modules/tasks/Tasks"));
const Settings = lazy(() => import("./modules/settings/Settings"));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route element={<PermissionRoute module="dashboard" />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<PermissionRoute module="orders" />}>
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<OrderWizard />} />
            <Route path="/orders/:id/edit" element={<OrderWizard />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
          </Route>

          <Route element={<PermissionRoute module="customers" />}>
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
          </Route>

          <Route element={<PermissionRoute module="products" />}>
            <Route path="/products" element={<Products />} />
          </Route>

          <Route element={<PermissionRoute module="proposals" />}>
            <Route path="/proposals" element={<Proposals />} />
            <Route path="/proposals/new" element={<ProposalEditor />} />
            <Route path="/proposals/:id" element={<ProposalEditor />} />
          </Route>

          <Route element={<PermissionRoute module="textile" />}>
            <Route path="/textile" element={<Textile />} />
          </Route>

          <Route element={<PermissionRoute module="warehouse" />}>
            <Route path="/warehouse" element={<Warehouse />} />
          </Route>

          <Route element={<PermissionRoute module="finance" />}>
            <Route path="/finance" element={<Finance />} />
          </Route>

          <Route element={<PermissionRoute module="reports" />}>
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route element={<PermissionRoute module="production" />}>
            <Route path="/production" element={<Production />} />
          </Route>

          <Route element={<PermissionRoute module="attendance" />}>
            <Route path="/attendance" element={<AttendancePage />} />
          </Route>

          <Route element={<PermissionRoute module="tasks" />}>
            <Route path="/tasks" element={<Tasks />} />
          </Route>

          <Route element={<AdminRoute />}>
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
