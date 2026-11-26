// Sotuv bo'limi → Sozlamalar (2026-11-26; the owner: «etablarni almashtira
// olishim kerak, nomlarini; qo'ng'iroqlar, zadachalar nomini ham; kontaktlardagi
// turlarni ham nomini o'zgartirish, qo'shish»). Saved in crm_settings/main
// (staff read, admin write) and applied to the lists everybody uses.
import { applyStages, applyTaskTypes } from "./crm";
import { applyContactTypes } from "./contacts";

export type StageSetting = { key: string; label: string; color: string };
export type TypeSetting = { key: string; label: string; icon: string };
export type SectionKey = "lidlar" | "zadachalar" | "qongiroqlar" | "tahlil" | "kontaktlar" | "baza" | "sozlamalar";
export type CrmSettingsDoc = {
  stages?: StageSetting[];
  sections?: Partial<Record<SectionKey, string>>;
  task_types?: TypeSetting[];
  contact_types?: TypeSetting[];
  open_to_managers?: boolean;
  task_source?: string;
  amo_sync?: boolean;
  talk_target_min?: number;
};

export const DEFAULT_SECTIONS: Record<SectionKey, string> = {
  lidlar: "Lidlar",
  zadachalar: "Zadachalar",
  qongiroqlar: "Qo'ng'iroqlar",
  tahlil: "Tahlil",
  kontaktlar: "Kontaktlar",
  baza: "Mijozlar bazasi",
  sozlamalar: "Sozlamalar",
};
const sections: Record<SectionKey, string> = { ...DEFAULT_SECTIONS };
export const sectionLabel = (k: SectionKey) => sections[k] || DEFAULT_SECTIONS[k];

export function applyCrmSettings(doc: CrmSettingsDoc | null | undefined) {
  applyStages(doc?.stages);
  applyTaskTypes(doc?.task_types);
  applyContactTypes(doc?.contact_types);
  for (const k of Object.keys(DEFAULT_SECTIONS) as SectionKey[]) {
    const v = doc?.sections?.[k];
    sections[k] = v && String(v).trim() ? String(v).trim() : DEFAULT_SECTIONS[k];
  }
}

// A new key for an added stage or type.
export const newKey = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
