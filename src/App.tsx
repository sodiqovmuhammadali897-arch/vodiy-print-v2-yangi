import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PermissionRoute from "./components/auth/PermissionRoute";
import AdminRoute from "./components/auth/AdminRoute";
import Login from "./modules/auth/Login";
import Dashboard from "./modules/dashboard/Dashboard";
import { pages } from "./pages";

const { SalesPipeline, AdsPage, ContentPage, Orders, OrderDetail, OrderWizard, Customers, CustomerDetail, Products, Proposals, ProposalEditor, Textile, Warehouse, Finance, Reports, MarginPage, KpiBonusPage, AiOffice, Production, Pechatnik, AttendancePage, Tasks, Settings } = pages;

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

          <Route element={<PermissionRoute module="leads" />}>
            <Route path="/leads" element={<SalesPipeline />} />
          </Route>

          <Route element={<PermissionRoute module="ads" />}>
            <Route path="/ads" element={<AdsPage />} />
            <Route path="/content" element={<ContentPage />} />
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

          <Route element={<PermissionRoute module="pechatnik" />}>
            <Route path="/pechatnik" element={<Pechatnik />} />
          </Route>

          <Route element={<PermissionRoute module="attendance" kpi />}>
            <Route path="/attendance" element={<AttendancePage />} />
          </Route>

          {/* Every staff member has tasks (given to them or by them). */}
          <Route path="/tasks" element={<Tasks />} />

          <Route element={<AdminRoute />}>
            <Route path="/settings" element={<Settings />} />
            <Route path="/ai-office" element={<AiOffice />} />
            <Route path="/margin" element={<MarginPage />} />
            <Route path="/kpi" element={<KpiBonusPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
