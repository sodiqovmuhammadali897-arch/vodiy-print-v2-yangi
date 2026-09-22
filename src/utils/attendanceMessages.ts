// Short, varied check-in/check-out messages shown briefly after a
// successful selfie, personalized with the employee's first name so the
// same line doesn't repeat every single day.
const CHECK_IN_MESSAGES: Array<(name: string) => string> = [
  (name) => `${name}, qani olg'a — bugun katta sotuvlar sizni kutmoqda!`,
  (name) => `Xayrli kun, ${name}! Bugun ham ajoyib natijalar kutamiz.`,
  (name) => `${name}, ishga xush kelibsiz — bugungi kun g'alabalar uchun!`,
  (name) => `Zo'r kayfiyat bilan boshladingiz, ${name}! Omad hamrohingiz bo'lsin.`,
  (name) => `${name}, jamoa sizga tayanadi — kuchli kun bo'lsin!`,
  (name) => `Bugun rekordlar kuni bo'lsin, ${name}!`,
];

const CHECK_OUT_MESSAGES: Array<(name: string, worked: string) => string> = [
  (name, worked) => `Rahmat, ${name}! Bugungi mehnatingiz uchun — ${worked} ishladingiz.`,
  (name) => `${name}, bugungi kun uchun katta rahmat! Yaxshi dam oling.`,
  (name) => `Ish kuni yakunlandi — rahmat, ${name}! Ertaga yana kutamiz.`,
  (name) => `${name}, bugun jamoaga qo'shgan hissangiz uchun rahmat!`,
  (name) => `Zo'r ish kuni bo'ldi, ${name}! Rahmat va yaxshi dam oling.`,
];

const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] || fullName;

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

export const randomCheckInMessage = (fullName: string): string => pick(CHECK_IN_MESSAGES)(firstName(fullName));

export const randomCheckOutMessage = (fullName: string, workedLabel: string): string =>
  pick(CHECK_OUT_MESSAGES)(firstName(fullName), workedLabel);
