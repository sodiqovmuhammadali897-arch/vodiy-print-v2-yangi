export type Customer = {
  id: string;
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
  | "design"
  | "approved"
  | "production"
  | "done"
  | "cancelled";

export type Order = {
  id: string;
  brand_id: string | null;
  customer_id: string | null;
  title: string;
  description: string;
  status: OrderStatus;
  total_amount: number;
  paid_amount: number;
  telegram_link: string;
  manager_name: string;
  deadline: string | null;
  completed_at: string | null;
  created_at: string;
};

export type OrderFile = {
  id: string;
  order_id: string;
  filename: string;
  url: string;
  mime_type: string;
  size: number;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  unit: string;
  base_price: number;
  category: string;
  created_at: string;
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
