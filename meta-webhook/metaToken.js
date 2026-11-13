// One Meta key for everything (2026-11-13). The owner puts a System User
// token (Meta Business → System users, «never expires») into the
// META_PAGE_ACCESS_TOKEN secret; on every deploy this script, run on the
// server after .env is written, swaps it for the Page's own token (which
// then never expires either), uses the original token for the ads
// statistics when META_ADS_TOKEN is empty, and finds the ad account when
// META_AD_ACCOUNT_ID is empty. A Page token is left as it is.
//
//   node metaToken.js /opt/meta-webhook/.env
//
// It prints names and yes/no only — never a token.
const fs = require("fs");

const V = process.env.META_GRAPH_VERSION || "v19.0";

// The Page to use: META_PAGE_ID if set, else the one with an Instagram
// account, else the first.
function pickPage(pages, pageId = "") {
  const list = (pages || []).filter((p) => p && p.id && p.access_token);
  if (!list.length) return null;
  return (pageId && list.find((p) => String(p.id) === String(pageId))) || list.find((p) => p.instagram_business_account) || list[0];
}

// An active ad account (status 1) first.
function pickAdAccount(accounts) {
  const list = (accounts || []).filter((a) => a && a.id);
  return list.find((a) => Number(a.account_status) === 1) || list[0] || null;
}

// KEY=value lines → object, and back with some keys replaced.
const parseEnv = (text) => Object.fromEntries(String(text).split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
function setEnv(text, patch) {
  const lines = String(text).split("\n");
  for (const [k, v] of Object.entries(patch)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.splice(lines[lines.length - 1] === "" ? lines.length - 1 : lines.length, 0, `${k}=${v}`);
  }
  return lines.join("\n");
}

const graph = async (path, token) => {
  const r = await fetch(`https://graph.facebook.com/${V}/${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
  return r.json().catch(() => ({ error: { message: `HTTP ${r.status}` } }));
};

async function main(file) {
  const text = fs.readFileSync(file, "utf8");
  const env = parseEnv(text);
  const token = env.META_PAGE_ACCESS_TOKEN;
  if (!token) return console.log("Meta token: not set");
  const accounts = await graph("me/accounts?fields=id,name,access_token,instagram_business_account{username}&limit=50", token);
  if (accounts.error || !(accounts.data || []).length) {
    // A Page token can't list pages — it is used as it is.
    const me = await graph("me?fields=name", token);
    return console.log(me.error ? `Meta token: does not work (${String(me.error.message || "").replace(/\d{6,}/g, "#")})` : `Meta token: Page token («${me.name}»), used as it is`);
  }
  const page = pickPage(accounts.data, env.META_PAGE_ID);
  const patch = { META_PAGE_ACCESS_TOKEN: page.access_token };
  if (!env.META_ADS_TOKEN) patch.META_ADS_TOKEN = token;
  let adNote = env.META_AD_ACCOUNT_ID ? "ad account from the secret" : "";
  if (!env.META_AD_ACCOUNT_ID) {
    const ads = await graph("me/adaccounts?fields=id,name,account_status&limit=50", token);
    const acc = pickAdAccount(ads.data);
    if (acc) {
      patch.META_AD_ACCOUNT_ID = acc.id;
      adNote = `ad account «${acc.name}»`;
    } else adNote = `no ad account${ads.error ? " (no ads_read access)" : ""}`;
  }
  fs.writeFileSync(file, setEnv(text, patch));
  console.log(
    `Meta token: system/user token → Page «${page.name}»${page.instagram_business_account ? ` (Instagram @${page.instagram_business_account.username})` : " (no Instagram linked)"}; ${adNote}; ads token: ${env.META_ADS_TOKEN ? "own secret" : "same key"}`,
  );
}

if (require.main === module) {
  main(process.argv[2] || "/opt/meta-webhook/.env").catch((err) => console.log(`Meta token: check failed (${err.message})`));
}

module.exports = { pickPage, pickAdAccount, parseEnv, setEnv };
