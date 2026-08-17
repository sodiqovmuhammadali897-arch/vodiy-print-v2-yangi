// Minimal RFC 2617 HTTP Digest client — Hikvision devices require Digest
// auth on ISAPI by default and reject plain Basic auth.
import crypto from "node:crypto";

const md5 = (str) => crypto.createHash("md5").update(str).digest("hex");

function parseDigestHeader(header) {
  const result = {};
  const regex = /(\w+)=("([^"]*)"|[^,]*)/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    result[match[1]] = match[3] !== undefined ? match[3] : match[2];
  }
  return result;
}

let nonceCount = 0;

export async function digestFetch(url, { method = "GET", username, password, body, headers = {} } = {}) {
  const initialRes = await fetch(url, { method, headers, body });
  if (initialRes.status !== 401) return initialRes;

  const authHeader = initialRes.headers.get("www-authenticate");
  if (!authHeader || !authHeader.toLowerCase().includes("digest")) {
    throw new Error(
      "Qurilma Digest autentifikatsiyani qaytarmadi — login/parol yoki manzilni tekshiring.",
    );
  }
  const { realm, nonce, qop, opaque } = parseDigestHeader(authHeader);
  const parsedUrl = new URL(url);
  const uri = parsedUrl.pathname + parsedUrl.search;

  nonceCount += 1;
  const nc = String(nonceCount).padStart(8, "0");
  const cnonce = crypto.randomBytes(8).toString("hex");

  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);

  let authValue = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) authValue += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  if (opaque) authValue += `, opaque="${opaque}"`;

  return fetch(url, {
    method,
    headers: { ...headers, Authorization: authValue },
    body,
  });
}
