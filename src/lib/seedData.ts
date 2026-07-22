import type { CompanySettings, Manager } from "./types";

export const seedManagers: Omit<Manager, "id">[] = [
  {
    name: "Muhammadiyor",
    monthly_plan: 80000000,
    avatar_url: "",
    created_at: "2026-07-21T21:59:46.800Z",
  },
  {
    name: "Moxlaroy",
    monthly_plan: 35000000,
    avatar_url: "",
    created_at: "2026-07-21T22:00:11.992Z",
  },
  {
    name: "Maryam",
    monthly_plan: 35000000,
    avatar_url: "",
    created_at: "2026-07-21T22:00:48.052Z",
  },
];

export const seedCompanySettings: Omit<CompanySettings, "id"> = {
  singleton: true,
  name: "Poligrafiya",
  logo_url: "",
  director_name: "Muhammadali Sodiqov",
  phone: "+998772008855",
  extra_phone: "+998997233377",
  email: "Vodiyprintuz@gmail.com",
  telegram: "Vodiyprintuz",
  website: "",
  address: "Farg'ona shahar, Universitet ko'chasi 22/4",
  stir: "51409016970040",
  mfo: "",
  bank_account: "",
  bank_name: "Hamkorbank",
  qr_url: "",
  work_hours: "9:30dan 18:30gacha",
  google_maps: "",
  instagram: "Vodiyprintuz",
  facebook: "",
  youtube: "",
  requisites: "",
  stamp_url: "",
  signature_url: "",
  updated_at: "2026-07-21T22:03:53.620Z",
};
