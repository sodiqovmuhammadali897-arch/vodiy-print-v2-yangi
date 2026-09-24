export type ModuleKey =
  | "dashboard"
  | "leads"
  | "orders"
  | "customers"
  | "products"
  | "proposals"
  | "production"
  | "pechatnik"
  | "textile"
  | "warehouse"
  | "finance"
  | "reports"
  | "attendance"
  | "tasks";

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
  // Explicit link to a managers/{id} record, set by an admin in the Xodim
  // form. When present, Hisobot shows this staff member only their own
  // sales/debt numbers ("Mening hisobotim") regardless of role — this is
  // deliberately NOT inferred from full_name-vs-manager-name matching,
  // which broke in practice (accounts are often created with role
  // "admin" for convenience, and names can be entered inconsistently).
  report_manager_id?: string | null;
  // HR agent (meta-webhook/hr.js): where attendance reminders and late
  // notices go. Telegram when linked (free), otherwise SMS to `phone`.
  phone?: string;
  attendance_notify?: boolean;
  telegram_chat_id?: number | null;
  telegram_linked_at?: string | null;
};

export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Bosh sahifa" },
  { key: "leads", label: "Sotuv bo'limi" },
  { key: "orders", label: "Buyurtmalar" },
  { key: "customers", label: "Mijozlar" },
  { key: "products", label: "Mahsulotlar" },
  { key: "proposals", label: "Tijorat taklifi" },
  { key: "production", label: "Ishlab chiqarish" },
  { key: "pechatnik", label: "Pechatnik" },
  { key: "textile", label: "Textil" },
  { key: "warehouse", label: "Ombor" },
  { key: "finance", label: "Moliya" },
  { key: "reports", label: "Hisobot" },
  { key: "attendance", label: "Davomat va KPI" },
  { key: "tasks", label: "Vazifalar" },
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
