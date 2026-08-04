export type ModuleKey =
  | "dashboard"
  | "orders"
  | "customers"
  | "products"
  | "proposals"
  | "production"
  | "textile"
  | "warehouse"
  | "finance"
  | "reports"
  | "attendance";

export type PermissionAction = "view" | "edit" | "delete";

export type ModulePermission = {
  view: boolean;
  edit: boolean;
  delete: boolean;
};

export type StaffPermissions = Record<ModuleKey, ModulePermission>;

export type StaffRole = "admin" | "staff";

export type Staff = {
  email: string;
  full_name: string;
  role: StaffRole;
  permissions: StaffPermissions;
  created_at?: string;
};

export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Bosh sahifa" },
  { key: "orders", label: "Buyurtmalar" },
  { key: "customers", label: "Mijozlar" },
  { key: "products", label: "Mahsulotlar" },
  { key: "proposals", label: "Tijorat taklifi" },
  { key: "production", label: "Ishlab chiqarish" },
  { key: "textile", label: "Textil" },
  { key: "warehouse", label: "Ombor" },
  { key: "finance", label: "Moliya" },
  { key: "reports", label: "Hisobot" },
  { key: "attendance", label: "Davomat va KPI" },
];

export const emptyPermissions = (): StaffPermissions => {
  const out = {} as StaffPermissions;
  for (const m of MODULES) {
    out[m.key] = { view: false, edit: false, delete: false };
  }
  return out;
};

export const fullPermissions = (): StaffPermissions => {
  const out = {} as StaffPermissions;
  for (const m of MODULES) {
    out[m.key] = { view: true, edit: true, delete: true };
  }
  return out;
};

// First login from this email auto-provisions an admin staff record so
// there's a way into the permissions panel before any staff docs exist.
export const BOOTSTRAP_ADMIN_EMAIL = "sodiqovmuhammadali897@gmail.com";
