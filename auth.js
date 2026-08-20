const SSO_AUTH_URL = "https://login.eveonline.com/v2/oauth/authorize";
const SSO_TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";

const LS_TOKEN = "eve-sso-tokens";
const LS_VERIFIER = "eve-sso-verifier";

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(str) {
  const enc = new TextEncoder().encode(str);
  return await crypto.subtle.digest("SHA-256", enc);
}

function randomVerifier(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return b64url(arr);
}

async function startLogin() {
  const verifier = randomVerifier();
  const challenge = b64url(await sha256(verifier));
  sessionStorage.setItem(LS_VERIFIER, verifier);

  const state = randomVerifier(16);
  sessionStorage.setItem("eve-sso-state", state);

  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: window.EVE_SSO_CONFIG.CALLBACK_URL,
    client_id: window.EVE_SSO_CONFIG.CLIENT_ID,
    scope: window.EVE_SSO_CONFIG.SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state
  });

  window.location.href = `${SSO_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code) {
  const verifier = sessionStorage.getItem(LS_VERIFIER);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: window.EVE_SSO_CONFIG.CLIENT_ID,
    code_verifier: verifier
  });

  const res = await fetch(SSO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) throw new Error("Échec de l'échange du code SSO");
  const tokens = await res.json();
  tokens.obtained_at = Date.now();
  localStorage.setItem(LS_TOKEN, JSON.stringify(tokens));
  return tokens;
}

async function refreshToken() {
  const stored = getStoredTokens();
  if (!stored?.refresh_token) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
    client_id: window.EVE_SSO_CONFIG.CLIENT_ID
  });

  const res = await fetch(SSO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    logout();
    return null;
  }
  const tokens = await res.json();
  tokens.obtained_at = Date.now();
  localStorage.setItem(LS_TOKEN, JSON.stringify(tokens));
  return tokens;
}

function getStoredTokens() {
  try {
    return JSON.parse(localStorage.getItem(LS_TOKEN));
  } catch {
    return null;
  }
}

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

async function getValidAccessToken() {
  let tokens = getStoredTokens();
  if (!tokens) return null;

  const ageSec = (Date.now() - tokens.obtained_at) / 1000;
  if (ageSec > tokens.expires_in - 60) {
    tokens = await refreshToken();
    if (!tokens) return null;
  }
  return tokens.access_token;
}

function getCharacterInfo() {
  const tokens = getStoredTokens();
  if (!tokens) return null;
  const claims = decodeJwt(tokens.access_token);
  // "sub" looks like "CHARACTER:EVE:123456789"
  const characterId = claims.sub?.split(":").pop();
  return { characterId, characterName: claims.name };
}

function logout() {
  localStorage.removeItem(LS_TOKEN);
  sessionStorage.removeItem(LS_VERIFIER);
}

// ---- Wallet journal: exact ESI ref_types used internally by CCP for the
// HyperNet Relay (code name "flux"). Confirmed via the esi/eve-glue
// reference project (JournalRefTypeEnumV4), not a guess.
//   flux_ticket_sale      -> someone buys one of your HyperNodes (ticket)
//   flux_payout           -> final payout to you when an offer completes
//   flux_tax              -> the 5% completion tax taken out of the payout
//   flux_ticket_repayment -> refund issued to buyers if an offer expires unsold
const HYPERNET_REF_TYPES = new Set([
  "flux_ticket_sale",
  "flux_payout",
  "flux_tax",
  "flux_ticket_repayment"
]);

// Fallback in case CCP ever renames/adds a variant not yet in the enum above.
const HYPERNET_KEYWORDS = ["hypernet", "hypernode", "hyper node", "hyper-net"];

function looksLikeHypernet(entry) {
  if (HYPERNET_REF_TYPES.has(entry.ref_type)) return true;
  const haystack = `${entry.description || ""} ${entry.reason || ""}`.toLowerCase();
  return HYPERNET_KEYWORDS.some((k) => haystack.includes(k));
}

async function fetchHypernetJournalEntries() {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Non connecté");
  const { characterId } = getCharacterInfo();

  let all = [];
  let page = 1;
  // ESI paginates the wallet journal; walk pages until empty.
  while (page <= 20) {
    const res = await fetch(
      `https://esi.evetech.net/latest/characters/${characterId}/wallet/journal/?page=${page}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 404 || res.status === 400) break;
    if (!res.ok) throw new Error(`ESI wallet journal: ${res.status}`);
    const batch = await res.json();
    if (!batch.length) break;
    all = all.concat(batch);
    page += 1;
  }

  return all.filter(looksLikeHypernet).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ---- Wallet transactions: detect HyperCore purchases (the creation cost /
// "broker fee" paid up front when you set up an offer). HyperCore is a
// regular market item, typeID 52568 (confirmed via EVE Ref), so it shows up
// in /wallet/transactions/ as a normal buy, not a special ref_type.
const HYPERCORE_TYPE_ID = 52568;

async function fetchHyperCorePurchases() {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Non connecté");
  const { characterId } = getCharacterInfo();

  const res = await fetch(
    `https://esi.evetech.net/latest/characters/${characterId}/wallet/transactions/`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`ESI wallet transactions: ${res.status}`);
  const batch = await res.json();

  return batch
    .filter((t) => t.type_id === HYPERCORE_TYPE_ID && t.is_buy)
    .map((t) => ({
      id: t.transaction_id,
      date: t.date,
      quantity: t.quantity,
      cost: t.unit_price * t.quantity
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}
