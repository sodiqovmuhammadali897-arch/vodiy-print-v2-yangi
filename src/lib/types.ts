export type CustomerType = "new" | "regular" | "vip" | "inactive";

export type Customer = {
  id: string;
  customer_number: string | null;
  customer_type: CustomerType;
  source: string;
  industry: string;
  first_name: string;
  last_name: string;
  phone: string;
  extra_phone: string;
  telegram: string;
  company: string;
  position: string;
  region: string;
  address: string;
  note: string;
  manager_name: string;
  created_at: string;
};

// Chat-style comment thread on a customer — each entry is its own record
// (unlike Customer.note, a single free-text field) so who-said-what stays
// visible over time.
export type CustomerNote = {
  id: string;
  customer_id: string;
  author_email: string;
  author_name: string;
  text: string;
  created_at: string;
};

export type Brand = {
  id: string;
  customer_id: string;
  name: string;
  logo_url: string;
  note: string;
  created_at: string;
};

export type OrderStatus =
  | "new"
  | "accepted"
  | "calculating"
  | "awaiting_advance"
  | "design"
  | "approving"
  | "sent_to_production"
  | "production"
  | "quality_control"
  | "ready"
  | "ready_to_deliver"
  | "delivered"
  | "closed"
  | "cancelled";

export type Order = {
  id: string;
  order_number: string | null;
  brand_id: string | null;
  customer_id: string | null;
  manager_id: string | null;
  title: string;
  description: string;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: string;
  telegram_link: string;
  manager_name: string;
  customer_source: string;
  production_company: string;
  textile_company_id: string | null;
  textile_company_name: string;
  designer_name: string;
  designer_status: string;
  production_manager: string;
  logistics_manager: string;
  qc_manager: string;
  assigned_printer_email: string;
  assigned_printer_name: string;
  delivery_type: string;
  delivery_address: string;
  delivery_location_url: string;
  delivery_phone: string;
  courier: string;
  delivery_date: string | null;
  delivery_time: string;
  delivery_cost: number;
  customer_note: string;
  production_note: string;
  logistics_note: string;
  private_note: string;
  client_request_note: string;
  is_draft: boolean;
  order_date: string | null;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
  // Client confirmation of the Textil size/color breakdown across this
  // order's line items — a single yes/no per order, not per line, since the
  // client signs off on the whole distribution at once.
  textile_sizes_confirmed_at: string | null;
  textile_sizes_confirmed_by: string;
};

// One cell of a Textil size/color quantity breakdown for a single order
// line item (e.g. Qora/L -> 14 dona).
export type SizeBreakdownEntry = {
  color: string;
  size: string;
  qty: number;
};

// Each order line item moves through production independently of the
// others (and independently of the order's own customer-facing status) —
// only new/accepted/production/quality_control/ready are meaningful here,
// reusing OrderStatus purely so StatusBadge/orderStatusLabel work as-is.
export type OrderProduct = {
  id: string;
  order_id: string;
  position: number;
  category: string;
  product_name: string;
  variant: string;
  size: string;
  material: string;
  color: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  note: string;
  // Only used for Textil-category lines: a per color/size quantity
  // distribution. When non-empty, `quantity` is the sum of its entries.
  size_breakdown: SizeBreakdownEntry[];
  production_status: OrderStatus;
  production_company: string;
  assigned_printer_email: string;
  assigned_printer_name: string;
  production_accepted_at: string | null;
  production_completed_at: string | null;
};

// A saved color/size quantity distribution an employee can reuse on a
// future order for the same or a similar product (e.g. school uniforms
// ordered every term with the same breakdown).
export type TextileSizeTemplate = {
  id: string;
  name: string;
  product_name: string;
  client_name: string;
  size_breakdown: SizeBreakdownEntry[];
  created_by: string;
  created_at: string;
};

export type OrderPayment = {
  id: string;
  order_id: string;
  amount: number;
  payment_type: string;
  payment_date: string;
  received_by: string;
  note: string;
  created_at: string;
};

export type OrderFile = {
  id: string;
  order_id: string;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
  link_type: string;
  note: string;
  created_at: string;
};

export type PriceTier = {
  min_qty: number;
  price: number;
};

export type CostTier = {
  min_qty: number;
  cost_price: number;
};

export type Product = {
  id: string;
  name: string;
  unit: string;
  base_price: number;
  category: string;
  price_tiers: PriceTier[];
  sizes: string[];
  colors: string[];
  created_at: string;
};

// Kept in a separate collection with its own Firestore rules so cost price
// stays readable by admins only, even though the product itself is visible
// to anyone with products.view. Cost tiers mirror price_tiers by min_qty,
// since the supplier's unit cost usually drops with volume too.
export type ProductCost = {
  id: string;
  cost_tiers: CostTier[];
};

export type ProposalItem = {
  product_id?: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
};

export type Proposal = {
  id: string;
  number: string;
  customer_id: string | null;
  recipient_name: string;
  brand_id: string | null;
  title: string;
  items: ProposalItem[];
  subtotal: number;
  discount: number;
  total: number;
  valid_until: string | null;
  note: string;
  created_at: string;
};

export type CompanySettings = {
  id: string;
  singleton: boolean;
  name: string;
  logo_url: string;
  director_name: string;
  phone: string;
  extra_phone: string;
  email: string;
  telegram: string;
  website: string;
  address: string;
  stir: string;
  mfo: string;
  bank_account: string;
  bank_name: string;
  qr_url: string;
  work_hours: string;
  google_maps: string;
  instagram: string;
  facebook: string;
  youtube: string;
  requisites: string;
  stamp_url: string;
  signature_url: string;
  updated_at: string;
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
};

export type MonthlyPlan = {
  id: string;
  year: number;
  month: number;
  plan_amount: number;
};

export type Manager = {
  id: string;
  name: string;
  monthly_plan: number;
  avatar_url: string;
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string;
  created_by: string;
  created_at: string;
};

export type StatusHistoryEntry = {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by_email: string;
  changed_by_name: string;
  changed_at: string;
};

export type TextileCompany = {
  id: string;
  company_number: string | null;
  name: string;
  contact_person: string;
  phone: string;
  telegram: string;
  address: string;
  note: string;
  is_active: boolean;
  created_at: string;
};

// ── Davomat va KPI ──────────────────────────────────────────────────

export type GeoPoint = { latitude: number; longitude: number };

export type WebAuthnCredential = {
  id: string; // credentialId (base64url) — also the Firestore doc id
  employeeEmail: string;
  employeeName: string;
  credentialId: string;
  deviceName: string | null;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

export type AttendanceStatus =
  | "Kelmagan"
  | "Vaqtida keldi"
  | "Kechikdi"
  | "Ishda"
  | "Tanaffusda"
  | "Ishni tugatdi"
  | "Erta ketdi"
  | "Qo'shimcha ishladi"
  | "Ta'tilda"
  | "Kasallik"
  | "Ruxsat bilan yo'q"
  | "Sababsiz yo'q";

export type AttendanceRecord = {
  id: string;
  employeeId: string; // staff email
  employeeName: string;
  dateCode: string; // "YYYY-MM-DD"
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInTimestamp: string | null;
  checkOutTimestamp: string | null;
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: string;
  authenticationMethod: "webauthn";
  checkInLocation: GeoPoint | null;
  checkOutLocation: GeoPoint | null;
  deviceName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkSchedule = {
  id: string;
  workStart: string; // "HH:MM"
  workEnd: string;
  breakStart: string;
  breakEnd: string;
  breakMinutes: number;
  weeklyOffDay: number; // 0 = Sunday
  officeLat: number;
  officeLng: number;
  officeRadiusMeters: number;
  gpsCheckEnabled: boolean;
  updatedAt?: string;
};

export type LeaveType = "vacation" | "sick" | "excused" | "unexcused";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
};

export type KpiWeights = {
  attendance: number;
  punctuality: number;
  hoursWorked: number;
  tasksCompleted: number;
  onTimeOrders: number;
  reworkRate: number;
  managerScore: number;
};

export const DEFAULT_KPI_WEIGHTS: KpiWeights = {
  attendance: 20,
  punctuality: 15,
  hoursWorked: 10,
  tasksCompleted: 20,
  onTimeOrders: 20,
  reworkRate: 10,
  managerScore: 5,
};

export type KpiSettings = {
  id: string;
  weights: KpiWeights;
  updatedAt?: string;
};

export type EmployeeKpi = {
  id: string;
  employeeId: string;
  employeeName: string;
  periodCode: string; // "YYYY-MM"
  totalScore: number;
  breakdown: Record<string, number>;
  computedAt: string;
};

export type AttendanceAuditEntry = {
  id: string;
  attendanceId: string;
  employeeId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  changedBy: string;
  changedAt: string;
};

// ── Vazifalar (Tasks) ───────────────────────────────────────────────

export type TaskStatus = "new" | "done";

export type Task = {
  id: string;
  title: string;
  description: string;
  assigned_to_email: string;
  assigned_to_name: string;
  assigned_by_email: string;
  assigned_by_name: string;
  due_date: string | null;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
};
