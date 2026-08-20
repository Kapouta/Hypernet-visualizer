const STORE_KEY = "hypernet-relays-v1";

/** @typedef {{
 *  id: string, name: string, totalTickets: number, ticketsSold: number,
 *  ticketPrice: number, prizeCost: number, creationTax: number,
 *  status: "active"|"done", winnerTicket: string, createdAt: number,
 *  notifiedDone: boolean, linkedTxnIds: number[], linkedCoreTxnIds: number[]
 * }} Relay
 *
 * creationTax = coût des HyperCores payés à la création de l'offre (non
 * remboursable). La taxe de 5% prélevée à la finalisation (flux_tax) est,
 * elle, déjà déduite automatiquement par CCP du payout — on la simule ici
 * en l'appliquant sur le produit des ventes de tickets dans marginOf().
 */

let relays = loadRelays();
let editingId = null;

function loadRelays() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRelays() {
  localStorage.setItem(STORE_KEY, JSON.stringify(relays));
}

function fmtIsk(n) {
  const abs = Math.abs(n);
  let out;
  if (abs >= 1e9) out = (n / 1e9).toFixed(2) + "b";
  else if (abs >= 1e6) out = (n / 1e6).toFixed(2) + "m";
  else if (abs >= 1e3) out = (n / 1e3).toFixed(1) + "k";
  else out = n.toFixed(0);
  return out + " ISK";
}

function pctOf(r) {
  if (r.totalTickets <= 0) return 0;
  return Math.min(100, Math.round((r.ticketsSold / r.totalTickets) * 100));
}

const COMPLETION_TAX_RATE = 0.05; // HyperNet Relay Fee, prélevé par CCP au payout final

function marginOf(r) {
  const grossRevenue = r.ticketsSold * r.ticketPrice;
  const completionTax = grossRevenue * COMPLETION_TAX_RATE;
  const creationTax = r.creationTax || 0;
  return grossRevenue - completionTax - creationTax - r.prizeCost;
}

function render() {
  renderSummary();
  renderLists();
}

function renderSummary() {
  const active = relays.filter((r) => r.status === "active");
  const totalMargin = relays.reduce((s, r) => s + marginOf(r), 0);
  const ticketsLeft = active.reduce(
    (s, r) => s + Math.max(0, r.totalTickets - r.ticketsSold),
    0
  );

  document.getElementById("chip-active").textContent = active.length;
  document.getElementById("chip-margin").textContent = fmtIsk(totalMargin);
  document.getElementById("chip-tickets-left").textContent = ticketsLeft;
}

function ringSvg(pct, complete) {
  const r = 27;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return `
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle class="ring-bg" cx="34" cy="34" r="${r}" fill="none" stroke-width="7"></circle>
      <circle class="ring-fg ${complete ? "complete" : ""}" cx="34" cy="34" r="${r}" fill="none"
        stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${offset}"></circle>
    </svg>`;
}

function relayCard(r) {
  const pct = pctOf(r);
  const margin = marginOf(r);
  const remaining = Math.max(0, r.totalTickets - r.ticketsSold);
  const isDone = r.status === "done";

  return `
  <div class="relay-card ${isDone ? "done" : ""}" data-id="${r.id}">
    <div class="ring-wrap">
      ${ringSvg(pct, isDone)}
      <div class="ring-pct">${pct}%</div>
    </div>
    <div class="relay-main">
      <div class="relay-name-row">
        <div class="relay-name">${escapeHtml(r.name)}</div>
        <div class="status-tag ${isDone ? "done" : "active"}">${isDone ? "Terminé" : "En cours"}</div>
      </div>
      <div class="relay-stats">
        <div class="stat">
          <div class="k">Tickets</div>
          <div class="v">${r.ticketsSold}/${r.totalTickets}</div>
        </div>
        <div class="stat">
          <div class="k">Restants</div>
          <div class="v">${remaining}</div>
        </div>
        <div class="stat">
          <div class="k">Marge</div>
          <div class="v ${margin >= 0 ? "gold" : "red"}">${fmtIsk(margin)}</div>
        </div>
      </div>
      ${
        r.creationTax
          ? `<div class="winner-line">Taxe création (HyperCores) : <b>${fmtIsk(r.creationTax)}</b></div>`
          : ""
      }
      ${
        isDone && r.winnerTicket
          ? `<div class="winner-line">Ticket gagnant : <b>#${escapeHtml(r.winnerTicket)}</b></div>`
          : ""
      }
      <div class="card-actions">
        ${
          !isDone
            ? `<button class="btn-mini" data-action="edit">Mettre à jour</button>
               <button class="btn-mini gold" data-action="complete">Marquer terminé</button>`
            : `<button class="btn-mini" data-action="edit">Détails</button>`
        }
        <button class="btn-mini danger" data-action="delete">Suppr.</button>
      </div>
    </div>
  </div>`;
}

function renderLists() {
  const active = relays
    .filter((r) => r.status === "active")
    .sort((a, b) => b.createdAt - a.createdAt);
  const done = relays
    .filter((r) => r.status === "done")
    .sort((a, b) => b.createdAt - a.createdAt);

  const activeEl = document.getElementById("list-active");
  const doneSection = document.getElementById("section-done");
  const doneEl = document.getElementById("list-done");
  const emptyEl = document.getElementById("empty-state");

  if (relays.length === 0) {
    emptyEl.style.display = "block";
  } else {
    emptyEl.style.display = "none";
  }

  activeEl.innerHTML = active.map(relayCard).join("");
  if (done.length > 0) {
    doneSection.style.display = "block";
    doneEl.innerHTML = done.map(relayCard).join("");
  } else {
    doneSection.style.display = "none";
    doneEl.innerHTML = "";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Sheet (add/edit) ----------

const sheet = document.getElementById("sheet");
const backdrop = document.getElementById("backdrop");

function openSheet(relay) {
  editingId = relay ? relay.id : null;
  document.getElementById("sheet-title").textContent = relay
    ? "Mettre à jour le relais"
    : "Nouveau relais";

  document.getElementById("f-name").value = relay ? relay.name : "";
  document.getElementById("f-total").value = relay ? relay.totalTickets : "";
  document.getElementById("f-sold").value = relay ? relay.ticketsSold : 0;
  document.getElementById("f-price").value = relay ? relay.ticketPrice : "";
  document.getElementById("f-prize").value = relay ? relay.prizeCost : "";
  document.getElementById("f-tax").value = relay ? relay.creationTax || "" : "";

  backdrop.classList.add("open");
  sheet.classList.add("open");
}

function closeSheet() {
  backdrop.classList.remove("open");
  sheet.classList.remove("open");
  editingId = null;
}

document.getElementById("fab-add").addEventListener("click", () => openSheet(null));
backdrop.addEventListener("click", closeSheet);
document.getElementById("sheet-cancel").addEventListener("click", closeSheet);

document.getElementById("sheet-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("f-name").value.trim();
  const totalTickets = Number(document.getElementById("f-total").value);
  const ticketsSold = Number(document.getElementById("f-sold").value);
  const ticketPrice = Number(document.getElementById("f-price").value);
  const prizeCost = Number(document.getElementById("f-prize").value || 0);
  const creationTax = Number(document.getElementById("f-tax").value || 0);

  if (!name || !totalTickets || ticketsSold < 0 || !ticketPrice) return;

  if (editingId) {
    const r = relays.find((x) => x.id === editingId);
    Object.assign(r, { name, totalTickets, ticketsSold, ticketPrice, prizeCost, creationTax });
    checkAutoComplete(r);
  } else {
    relays.push({
      id: crypto.randomUUID(),
      name,
      totalTickets,
      ticketsSold,
      ticketPrice,
      prizeCost,
      creationTax,
      status: "active",
      winnerTicket: "",
      createdAt: Date.now(),
      notifiedDone: false,
      linkedTxnIds: [],
      linkedCoreTxnIds: []
    });
  }

  saveRelays();
  render();
  closeSheet();
});

function checkAutoComplete(r) {
  if (r.status === "active" && r.ticketsSold >= r.totalTickets && r.totalTickets > 0) {
    notify(
      "Relais rempli",
      `${r.name} a atteint ${r.totalTickets} tickets vendus. Renseigne le gagnant.`
    );
  }
}

// ---------- List interactions ----------

document.getElementById("app-main").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = e.target.closest(".relay-card");
  const id = card.dataset.id;
  const r = relays.find((x) => x.id === id);
  const action = btn.dataset.action;

  if (action === "edit") {
    openSheet(r);
  } else if (action === "delete") {
    if (confirm(`Supprimer "${r.name}" ?`)) {
      relays = relays.filter((x) => x.id !== id);
      saveRelays();
      render();
    }
  } else if (action === "complete") {
    const winner = prompt("Numéro du ticket gagnant :", r.winnerTicket || "");
    if (winner === null) return;
    r.status = "done";
    r.winnerTicket = winner.trim();
    saveRelays();
    render();
    notify(
      "Relais terminé",
      `${r.name} est terminé. Gagnant : ticket #${r.winnerTicket || "?"}. Marge : ${fmtIsk(marginOf(r))}.`
    );
  }
});

// ---------- EVE SSO character link ----------

let hypernetTxns = [];
let hyperCoreTxns = [];

function updateAuthBanner() {
  const statusEl = document.getElementById("auth-status");
  const btn = document.getElementById("auth-btn");
  const info = getCharacterInfo();

  if (info) {
    statusEl.textContent = `Connecté : ${info.characterName}`;
    btn.textContent = "Déconnecter";
  } else {
    statusEl.textContent = "Personnage non connecté.";
    btn.textContent = "Connecter";
  }
}

document.getElementById("auth-btn").addEventListener("click", async () => {
  const info = getCharacterInfo();
  if (info) {
    logout();
    hypernetTxns = [];
    hyperCoreTxns = [];
    updateAuthBanner();
    renderTxns();
    renderCoreTxns();
  } else {
    startLogin();
  }
});

async function loadHypernetTxns() {
  const info = getCharacterInfo();
  if (!info) return;
  const statusEl = document.getElementById("auth-status");
  try {
    statusEl.textContent = `${info.characterName} — lecture du wallet…`;
    [hypernetTxns, hyperCoreTxns] = await Promise.all([
      fetchHypernetJournalEntries(),
      fetchHyperCorePurchases()
    ]);
    updateAuthBanner();
    renderTxns();
    renderCoreTxns();
  } catch (e) {
    statusEl.textContent = `Erreur wallet : ${e.message}`;
  }
}

function allLinkedTxnIds() {
  const set = new Set();
  relays.forEach((r) => (r.linkedTxnIds || []).forEach((id) => set.add(id)));
  return set;
}

function renderTxns() {
  const section = document.getElementById("section-txns");
  const list = document.getElementById("list-txns");
  const linked = allLinkedTxnIds();

  if (!hypernetTxns.length) {
    section.style.display = "none";
    list.innerHTML = "";
    return;
  }
  section.style.display = "block";

  const activeRelays = relays.filter((r) => r.status === "active");
  const options = activeRelays
    .map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`)
    .join("");

  list.innerHTML = hypernetTxns
    .map((t) => {
      const isLinked = linked.has(t.id);
      return `
      <div class="txn-card" data-txn-id="${t.id}">
        <div class="txn-info">
          <div class="txn-desc">${escapeHtml(t.description || t.reason || "Transaction Hypernet")}</div>
          <div class="txn-amount">${fmtIsk(t.amount)}</div>
          <div class="txn-date">${new Date(t.date).toLocaleDateString("fr-FR")}</div>
          ${isLinked ? `<div class="txn-linked">✓ Liée à un relais</div>` : ""}
        </div>
        ${
          !isLinked && activeRelays.length
            ? `<select class="relay-picker" data-action="link-txn">
                 <option value="">Lier à…</option>
                 ${options}
               </select>`
            : ""
        }
      </div>`;
    })
    .join("");
}

function allLinkedCoreTxnIds() {
  const set = new Set();
  relays.forEach((r) => (r.linkedCoreTxnIds || []).forEach((id) => set.add(id)));
  return set;
}

function renderCoreTxns() {
  const section = document.getElementById("section-core-txns");
  const list = document.getElementById("list-core-txns");
  const linked = allLinkedCoreTxnIds();

  if (!hyperCoreTxns.length) {
    section.style.display = "none";
    list.innerHTML = "";
    return;
  }
  section.style.display = "block";

  // On propose de lier un achat de HyperCores à N'IMPORTE quel relais (actif
  // ou pas encore créé dans l'app) car l'achat a lieu AVANT la mise en vente.
  const options = relays
    .map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`)
    .join("");

  list.innerHTML = hyperCoreTxns
    .map((t) => {
      const isLinked = linked.has(t.id);
      return `
      <div class="txn-card" data-core-txn-id="${t.id}">
        <div class="txn-info">
          <div class="txn-desc">${t.quantity}× HyperCore</div>
          <div class="txn-amount">${fmtIsk(t.cost)}</div>
          <div class="txn-date">${new Date(t.date).toLocaleDateString("fr-FR")}</div>
          ${isLinked ? `<div class="txn-linked">✓ Liée à un relais</div>` : ""}
        </div>
        ${
          !isLinked && relays.length
            ? `<select class="relay-picker" data-action="link-core-txn">
                 <option value="">Lier à…</option>
                 ${options}
               </select>`
            : ""
        }
      </div>`;
    })
    .join("");
}

document.getElementById("list-core-txns").addEventListener("change", (e) => {
  const select = e.target.closest("select[data-action='link-core-txn']");
  if (!select || !select.value) return;
  const card = e.target.closest(".txn-card");
  const txnId = Number(card.dataset.coreTxnId);
  const txn = hyperCoreTxns.find((t) => t.id === txnId);
  const relay = relays.find((r) => r.id === select.value);
  if (!txn || !relay) return;

  relay.linkedCoreTxnIds = relay.linkedCoreTxnIds || [];
  if (relay.linkedCoreTxnIds.includes(txnId)) return;
  relay.linkedCoreTxnIds.push(txnId);
  relay.creationTax = (relay.creationTax || 0) + txn.cost;

  saveRelays();
  render();
  renderCoreTxns();
});

document.getElementById("list-txns").addEventListener("change", (e) => {
  const select = e.target.closest("select[data-action='link-txn']");
  if (!select || !select.value) return;
  const card = e.target.closest(".txn-card");
  const txnId = Number(card.dataset.txnId);
  const txn = hypernetTxns.find((t) => t.id === txnId);
  const relay = relays.find((r) => r.id === select.value);
  if (!txn || !relay) return;

  relay.linkedTxnIds = relay.linkedTxnIds || [];
  if (relay.linkedTxnIds.includes(txnId)) return;
  relay.linkedTxnIds.push(txnId);
  relay.ticketsSold += 1; // une transaction Hypernode = un ticket acheté

  saveRelays();
  checkAutoComplete(relay);
  render();
  renderTxns();
});

// ---------- Notifications ----------

let swReg = null;

async function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register("sw.js");
  } catch (err) {
    console.warn("SW registration failed", err);
  }
}

function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (swReg) {
    swReg.active?.postMessage({
      type: "SHOW_NOTIFICATION",
      payload: { title, body, tag: "hypernet-relay" }
    });
  } else {
    new Notification(title, { body, icon: "icons/icon-192.png" });
  }
}

function updatePermBanner() {
  const banner = document.getElementById("perm-banner");
  if (!("Notification" in window)) {
    banner.style.display = "none";
    return;
  }
  if (Notification.permission === "granted") {
    banner.style.display = "none";
  } else {
    banner.style.display = "flex";
  }
}

document.getElementById("perm-btn").addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  await Notification.requestPermission();
  updatePermBanner();
});

// ---------- Init ----------

initServiceWorker();
updatePermBanner();
updateAuthBanner();
render();
loadHypernetTxns();
