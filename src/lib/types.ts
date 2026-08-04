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
  address: string;
  note: string;
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
};

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

export type Product = {
  id: string;
  name: string;
  unit: string;
  base_price: number;
  category: string;
  price_tiers: PriceTier[];
  created_at: string;
};

// Kept in a separate collection with its own Firestore rules so cost price
// stays readable by admins only, even though the product itself is visible
// to anyone with products.view.
export type ProductCost = {
  id: string;
  cost_price: number;
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
