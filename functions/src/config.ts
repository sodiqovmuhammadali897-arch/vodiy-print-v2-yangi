// A passkey is bound to one origin/RP ID for its lifetime — changing these
// after employees have already registered devices would silently break
// every enrolled passkey, so keep them in sync with the deployed domain.
export const RP_NAME = "Vodiy Print";
export const RP_ID = "printvodiy.uz";
export const ORIGIN = "https://printvodiy.uz";

export const CHALLENGE_TTL_MS = 2 * 60 * 1000;
