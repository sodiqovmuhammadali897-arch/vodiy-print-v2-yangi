// Animations on or off for this person (the owner, 2026-11-25: «hamma
// panelda raqamlar dinamika bo'yicha ishlasin, panellar yumshoq ishlasin»).
// Windows' «animation effects» switch (prefers-reduced-motion) used to turn
// every page slide and count-up off without anyone knowing; now the app
// decides: on by default, and each person can choose in Sozlamalar —
// «Yoqilgan», «Tizim bo'yicha» (follow the computer) or «O'chirilgan».
// Kept in this browser only (localStorage), nothing in the database.

export type MotionPref = "on" | "system" | "off";
const KEY = "vp_motion";

export const motionPref = (): MotionPref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "off" || v === "system" ? v : "on";
  } catch {
    return "on";
  }
};

const systemReduced = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

export const motionOn = (pref: MotionPref = motionPref()) => (pref === "on" ? true : pref === "off" ? false : !systemReduced());

// <html class="no-motion"> turns the CSS animations off (index.css).
export const applyMotion = () => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("no-motion", !motionOn());
};

export const setMotionPref = (pref: MotionPref) => {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private mode — the choice lasts this visit */
  }
  applyMotion();
};
