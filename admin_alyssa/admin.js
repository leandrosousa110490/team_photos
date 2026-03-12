(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const section = String(document.body?.dataset?.adminSection || "home");
  const viewMode = String(document.body?.dataset?.adminView || section);

  const OWNER_USERNAME = "alyssa";
  const OWNER_EMAIL = "leoisdabest@yahoo.com";
  const LAST_USERNAME_KEY = "edgeframe-admin-last-username";
  const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDA1soYGzIFjntBuv08hA9NXoSDNZ5pUrk",
    authDomain: "alyssa-c95c3.firebaseapp.com",
    projectId: "alyssa-c95c3",
    storageBucket: "alyssa-c95c3.firebasestorage.app",
    messagingSenderId: "659097207470",
    appId: "1:659097207470:web:5f3f64c86e49d55b8ce33f",
    measurementId: "G-ZYPQ6C3VTL"
  };

  const state = {
    section,
    firebaseConfig: null,
    auth: null,
    db: null,
    currentUser: null,
    currentAdmin: null,
    unsubscribes: [],
    quoteDocs: [],
    questionDocs: [],
    calendarDocs: [],
    pageViewDocs: [],
    adminUsersDocs: [],
    requestDetailDoc: null,
    calendarCursor: startOfMonth(new Date()),
    selectedCalendarDate: toDateKey(new Date()),
    isBound: {
      common: false,
      requests: false,
      calendar: false,
      users: false
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeUsername(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "");
  }

  function usernameToManagedEmail(username) {
    const clean = normalizeUsername(username);
    return `${clean}@edgeframe.local`;
  }

  function usernameToEmailCandidates(username) {
    const raw = String(username || "").trim();
    const clean = normalizeUsername(raw);
    const list = [];
    const seen = new Set();
    const add = (value) => {
      const v = String(value || "").trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(v);
    };

    if (raw.includes("@")) add(raw);
    if (clean === OWNER_USERNAME) add(OWNER_EMAIL);
    add(usernameToManagedEmail(clean));
    add(`${clean}@${String(DEFAULT_FIREBASE_CONFIG.authDomain || "").replace(/^https?:\/\//i, "")}`);
    return list;
  }

  function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === "function") {
      try {
        return value.toDate();
      } catch {
        return null;
      }
    }
    const parsed = Date.parse(String(value));
    if (Number.isNaN(parsed)) return null;
    return new Date(parsed);
  }

  function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateKey(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return null;
    const [y, m, d] = String(dateKey).split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function formatDateTime(value) {
    const date = toDate(value);
    if (!date) return "Unknown date";
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  function formatDate(value) {
    const date = toDate(value) || parseDateKey(String(value || ""));
    if (!date) return "Unknown date";
    try {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(date);
    } catch {
      return date.toDateString();
    }
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value);
  }

  function setAuthStatus(label, tone = "") {
    const chip = byId("authStatusChip");
    if (!chip) return;
    chip.textContent = label;
    chip.className = "status-chip";
    if (tone) chip.classList.add(tone);
  }

  function showAlert(message, tone = "info", sticky = false) {
    const alertBox = byId("adminAlert");
    if (!alertBox) return;
    alertBox.className = "admin-card is-open";
    alertBox.id = "adminAlert";
    alertBox.classList.add("is-open", tone);
    alertBox.textContent = message;
    if (!sticky) {
      window.clearTimeout(showAlert.timer);
      showAlert.timer = window.setTimeout(() => {
        alertBox.className = "admin-card";
        alertBox.id = "adminAlert";
      }, 4200);
    }
  }
  showAlert.timer = 0;

  function clearAlert() {
    const alertBox = byId("adminAlert");
    if (!alertBox) return;
    alertBox.className = "admin-card";
    alertBox.id = "adminAlert";
    alertBox.textContent = "";
  }

  function setAuthedUi(isAuthed) {
    const loginCard = byId("loginCard");
    const dashboard = byId("dashboard");
    const logoutBtn = byId("logoutBtn");
    if (loginCard) loginCard.hidden = isAuthed;
    if (dashboard) dashboard.hidden = !isAuthed;
    if (logoutBtn) logoutBtn.hidden = !isAuthed;
  }

  function setAuthPending(isPending) {
    document.body.classList.toggle("admin-auth-pending", isPending);
  }

  function dispatchAdminAuthEvent(isAuthed) {
    document.dispatchEvent(new CustomEvent("edgeframe-admin-auth", {
      detail: {
        isAuthed,
        section,
        viewMode,
        user: state.currentUser,
        admin: state.currentAdmin
      }
    }));
  }

  function serverTimestamp() {
    return window.firebase?.firestore?.FieldValue?.serverTimestamp
      ? window.firebase.firestore.FieldValue.serverTimestamp()
      : null;
  }

  function readFirebaseConfig() {
    const parseIfObject = (value) => {
      if (!value) return null;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === "object" ? value : null;
    };
    const candidates = [
      window.EDGEFRAME_FIREBASE_CONFIG,
      window.FIREBASE_WEB_CONFIG,
      window.FIREBASE_CONFIG,
      DEFAULT_FIREBASE_CONFIG
    ].map(parseIfObject).filter(Boolean);

    const config = candidates[0] || null;
    if (config && !window.EDGEFRAME_FIREBASE_CONFIG) {
      window.EDGEFRAME_FIREBASE_CONFIG = config;
    }
    return config;
  }

  function initFirebase() {
    const config = readFirebaseConfig();
    if (!config) {
      setAuthStatus("Config Missing", "error");
      showAlert("Missing Firebase config object. Add window.EDGEFRAME_FIREBASE_CONFIG in firebase/firebase-web-config.js.", "error", true);
      return false;
    }
    const invalidKey = (value) => !String(value || "").trim() || /REPLACE|YOUR_|<|>/i.test(String(value));
    const missing = [];
    if (invalidKey(config.apiKey)) missing.push("apiKey");
    if (invalidKey(config.authDomain)) missing.push("authDomain");
    if (invalidKey(config.projectId)) missing.push("projectId");
    if (missing.length) {
      setAuthStatus("Config Error", "error");
      showAlert(`Firebase web config is incomplete: ${missing.join(", ")}.`, "error", true);
      return false;
    }
    if (!window.firebase || typeof window.firebase.initializeApp !== "function") {
      setAuthStatus("SDK Missing", "error");
      showAlert("Firebase SDK did not load on this page.", "error", true);
      return false;
    }
    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(config);
      }
      state.firebaseConfig = config;
      state.auth = window.firebase.auth();
      state.db = window.firebase.firestore();
      setAuthStatus("Ready", "warn");
      return true;
    } catch (error) {
      setAuthStatus("Firebase Error", "error");
      showAlert(error?.message || "Firebase failed to initialize.", "error", true);
      return false;
    }
  }

  async function enableLocalPersistence() {
    if (!state.auth || !window.firebase?.auth?.Auth?.Persistence?.LOCAL) return;
    try {
      await state.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
    } catch {
      // Keep default persistence when browser blocks persistence changes.
    }
  }

  function clearWatchers() {
    while (state.unsubscribes.length) {
      const unsub = state.unsubscribes.pop();
      try {
        unsub?.();
      } catch {
        // no-op
      }
    }
  }

  function bindNavActive() {
    document.querySelectorAll("[data-admin-nav]").forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      if (String(link.dataset.adminNav || "") === section) {
        link.classList.add("is-active");
      } else {
        link.classList.remove("is-active");
      }
    });
  }

  function getFriendlyAuthError(error) {
    const code = String(error?.code || "").toLowerCase();
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
      return "Sign in failed. Check username and password, then try again.";
    }
    if (code.includes("too-many-requests")) {
      return "Too many failed attempts. Wait a moment and try again.";
    }
    return error?.message || "Unable to sign in right now.";
  }

  function getFriendlyFirestoreError(error) {
    const code = String(error?.code || "").toLowerCase();
    if (code.includes("permission-denied")) {
      return "Permission denied. Confirm this account is listed in admin users.";
    }
    if (code.includes("unauthenticated")) {
      return "Session expired. Please sign in again.";
    }
    return error?.message || "Database operation failed.";
  }

  async function signInWithUsername(username, password) {
    const candidates = usernameToEmailCandidates(username);
    let lastError = null;
    for (const email of candidates) {
      try {
        const credential = await state.auth.signInWithEmailAndPassword(email, password);
        return credential;
      } catch (error) {
        const code = String(error?.code || "").toLowerCase();
        const mayTryNext = code.includes("invalid-credential")
          || code.includes("wrong-password")
          || code.includes("user-not-found");
        if (!mayTryNext) {
          throw error;
        }
        lastError = error;
      }
    }
    throw lastError || new Error("auth/invalid-credential");
  }

  async function ensureAdminAccess(user) {
    const adminRef = state.db.collection("admin_users").doc(user.uid);
    const snapshot = await adminRef.get();
    if (snapshot.exists) {
      return snapshot.data() || {};
    }

    const email = String(user.email || "").toLowerCase();
    if (email !== OWNER_EMAIL) {
      throw new Error("This account does not have admin panel access.");
    }

    const rawUsername = localStorage.getItem(LAST_USERNAME_KEY) || OWNER_USERNAME;
    const profile = {
      uid: user.uid,
      email: String(user.email || OWNER_EMAIL),
      name: "Alyssa Sousa",
      username: normalizeUsername(rawUsername) || OWNER_USERNAME,
      role: "owner",
      createdAtClient: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
      lastLoginAtClient: new Date().toISOString(),
      lastLoginAtServer: serverTimestamp()
    };
    await adminRef.set(profile, { merge: true });
    return profile;
  }

  async function handleAuthStateChanged(user) {
    clearWatchers();

    if (!user) {
      state.currentUser = null;
      state.currentAdmin = null;
      setAuthedUi(false);
      setAuthStatus("Logged Out", "");
      setAuthPending(false);
      dispatchAdminAuthEvent(false);
      return;
    }

    try {
      const profile = await ensureAdminAccess(user);
      state.currentUser = user;
      state.currentAdmin = profile;
      setAuthedUi(true);
      setAuthStatus("Logged In", "ok");
      clearAlert();
      setAuthPending(false);
      dispatchAdminAuthEvent(true);
      initSection();
    } catch (error) {
      showAlert(getFriendlyFirestoreError(error), "error", true);
      setAuthStatus("Access Denied", "error");
      setAuthPending(false);
      dispatchAdminAuthEvent(false);
      await state.auth.signOut();
    }
  }

  function bindCommonUi() {
    if (state.isBound.common) return;
    state.isBound.common = true;

    const loginForm = byId("loginForm");
    const logoutBtn = byId("logoutBtn");
    const usernameInput = byId("loginUsername");
    const passwordInput = byId("loginPassword");
    const loginButton = byId("loginButton");

    if (usernameInput) {
      const saved = localStorage.getItem(LAST_USERNAME_KEY);
      if (saved) usernameInput.value = saved;
    }

    if (loginForm && usernameInput && passwordInput && loginButton) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!state.auth) {
          showAlert("Firebase Auth is not ready on this page.", "error", true);
          return;
        }

        const username = String(usernameInput.value || "").trim();
        const password = String(passwordInput.value || "");
        if (!username || !password) {
          showAlert("Enter username and password.", "warning");
          return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Signing In...";
        setAuthStatus("Authenticating", "warn");
        try {
          await enableLocalPersistence();
          localStorage.setItem(LAST_USERNAME_KEY, username);
          await signInWithUsername(username, password);
          passwordInput.value = "";
          showAlert("Login successful.", "success");
        } catch (error) {
          showAlert(getFriendlyAuthError(error), "error", true);
          setAuthStatus("Login Failed", "error");
        } finally {
          loginButton.disabled = false;
          loginButton.textContent = "Sign In";
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        if (!state.auth) return;
        try {
          await state.auth.signOut();
          showAlert("Logged out.", "info");
        } catch (error) {
          showAlert(getFriendlyAuthError(error), "error");
        }
      });
    }
  }

  function watchQuery(query, onData, onErrorMessage) {
    const unsub = query.onSnapshot(
      (snapshot) => onData(snapshot),
      (error) => {
        showAlert(`${onErrorMessage} ${getFriendlyFirestoreError(error)}`, "error", true);
      }
    );
    state.unsubscribes.push(unsub);
  }

  function row(label, value) {
    const text = Array.isArray(value)
      ? value.join(", ")
      : String(value ?? "").trim();
    if (!text) return "";
    return `
      <div class="admin-row">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(text)}</span>
      </div>
    `;
  }
  function renderRequestList(container, docs, collection) {
    if (!container) return;
    if (!docs.length) {
      container.innerHTML = `<div class="admin-empty">No requests yet.</div>`;
      return;
    }

    const html = docs.map((doc) => {
      const viewed = Boolean(doc.viewedAtServer || doc.viewedAtClient);
      const created = formatDateTime(doc.createdAtServer || doc.createdAtClient);
      const requestLabel = doc.requestType === "questions" ? "Question" : "Quote";
      const headline = doc.fullName || "Unnamed contact";
      const subline = `${requestLabel} request - ${created}`;

      return `
        <article class="admin-item" data-kind="request" data-collection="${escapeHtml(collection)}" data-id="${escapeHtml(doc.id)}">
          <div class="admin-item-head">
            <div class="admin-item-title">
              <strong>${escapeHtml(headline)}</strong>
              <span>${escapeHtml(subline)}</span>
            </div>
            <div class="admin-item-actions">
              <span class="view-chip ${viewed ? "viewed" : ""}">${viewed ? "Viewed" : "New"}</span>
              <button class="admin-mini-btn" data-action="view-request" type="button">View</button>
              <button class="admin-mini-btn delete" data-action="delete-request" type="button">Delete</button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    container.innerHTML = html;
  }

  async function markRequestViewed(collection, docId, sourceDoc = null) {
    const list = collection === "question_requests" ? state.questionDocs : state.quoteDocs;
    const target = sourceDoc || list.find((item) => item.id === docId) || null;
    if (target && (target.viewedAtServer || target.viewedAtClient)) return;
    const viewedAtClient = new Date().toISOString();
    if (target) {
      target.viewedAtClient = viewedAtClient;
    }
    try {
      await state.db.collection(collection).doc(docId).update({
        viewedAtClient,
        viewedAtServer: serverTimestamp(),
        viewedBy: state.currentUser?.uid || ""
      });
    } catch (error) {
      showAlert(getFriendlyFirestoreError(error), "warning");
    }
  }

  function bindRequestActions() {
    if (state.isBound.requests) return;
    state.isBound.requests = true;
    const dashboard = byId("dashboard");
    if (!dashboard) return;

    dashboard.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!(button instanceof HTMLButtonElement)) return;
      const item = button.closest(".admin-item[data-kind='request']");
      if (!(item instanceof HTMLElement)) return;
      const collection = String(item.dataset.collection || "");
      const docId = String(item.dataset.id || "");
      if (!collection || !docId) return;

      if (button.dataset.action === "view-request") {
        await markRequestViewed(collection, docId);
        const nextUrl = `./request-detail.html?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(docId)}`;
        window.location.href = nextUrl;
        return;
      }

      if (button.dataset.action === "delete-request") {
        const confirmed = window.confirm("Delete this request?");
        if (!confirmed) return;
        try {
          await state.db.collection(collection).doc(docId).delete();
          showAlert("Request deleted.", "success");
        } catch (error) {
          showAlert(getFriendlyFirestoreError(error), "error");
        }
      }
    });
  }

  function initRequestsSection() {
    bindRequestActions();
    const quoteList = byId("quoteRequestsList");
    const questionList = byId("questionRequestsList");

    watchQuery(
      state.db.collection("quote_requests").orderBy("createdAtServer", "desc").limit(300),
      (snapshot) => {
        state.quoteDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderRequestList(quoteList, state.quoteDocs, "quote_requests");
      },
      "Could not load quote requests."
    );

    watchQuery(
      state.db.collection("question_requests").orderBy("createdAtServer", "desc").limit(300),
      (snapshot) => {
        state.questionDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderRequestList(questionList, state.questionDocs, "question_requests");
      },
      "Could not load question requests."
    );
  }

  function resolveRequestCollection(rawCollection) {
    const key = String(rawCollection || "").trim().toLowerCase();
    if (key === "quote_requests" || key === "quote") return "quote_requests";
    if (key === "question_requests" || key === "question" || key === "questions") return "question_requests";
    return "";
  }

  function normalizeCalendarDate(value) {
    const raw = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      return "";
    }
    return toDateKey(new Date(parsed));
  }

  function buildCalendarPayloadFromRequest(doc) {
    const eventDate = normalizeCalendarDate(doc?.eventDate);
    const sessionLabel = String(doc?.eventType || "").trim() || "Photo Session";
    const contactName = String(doc?.fullName || "").trim() || "Client";
    const title = `${sessionLabel} - ${contactName}`;
    const phone = String(doc?.phone || "").trim();
    const email = String(doc?.email || "").trim();
    const venue = String(doc?.venue || "").trim();
    const message = String(doc?.message || "").trim();
    const notesLines = [
      `Request Type: ${doc?.requestType === "questions" ? "Question" : "Quote"}`,
      phone ? `Phone: ${phone}` : "",
      email ? `Email: ${email}` : "",
      message ? `Message: ${message}` : "",
      doc?.budgetRange ? `Budget: ${doc.budgetRange}` : "",
      Array.isArray(doc?.needs) && doc.needs.length ? `Needs: ${doc.needs.join(", ")}` : ""
    ].filter(Boolean);

    return {
      title,
      date: eventDate,
      startTime: "",
      endTime: "",
      location: venue,
      notes: notesLines.join("\n"),
      provider: "manual",
      createdBy: state.currentAdmin?.username || state.currentUser?.email || "admin",
      createdAtClient: new Date().toISOString(),
      createdAtServer: serverTimestamp()
    };
  }

  function renderRequestDetail(doc, collection) {
    const title = byId("requestDetailTitle");
    const meta = byId("requestDetailMeta");
    const content = byId("requestDetailContent");
    const deleteBtn = byId("requestDetailDeleteBtn");

    if (!title || !meta || !content || !deleteBtn) return;

    const viewed = Boolean(doc.viewedAtServer || doc.viewedAtClient);
    const requestLabel = collection === "question_requests" ? "Question Request" : "Quote Request";
    const created = formatDateTime(doc.createdAtServer || doc.createdAtClient);
    const needs = Array.isArray(doc.needs) ? doc.needs : [];
    const hours = Number(doc.coverageHours || 0) > 0 ? String(doc.coverageHours) : "";
    const message = String(doc.message || "").trim() || "No message provided.";
    const needsText = needs.length ? needs.join(", ") : "None selected";
    const preferredContact = String(doc.preferredContact || "").trim() || "Not specified";
    const typeText = doc.requestType === "questions" ? "Question" : "Quote";
    const emptyText = "Not provided";
    const iconSvg = (kind) => {
      const icons = {
        user: "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='8' r='4' fill='none' stroke='currentColor' stroke-width='2'/><path d='M4 20c1.8-3.5 4.5-5 8-5s6.2 1.5 8 5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg>",
        event: "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='3' y='5' width='18' height='16' rx='2' fill='none' stroke='currentColor' stroke-width='2'/><path d='M8 3v4M16 3v4M3 10h18' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'/></svg>",
        pref: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 7h16M4 12h10M4 17h13' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'/><circle cx='15' cy='12' r='2' fill='currentColor'/></svg>",
        message: "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M4 5h16v10H9l-5 4z' fill='none' stroke='currentColor' stroke-width='2' stroke-linejoin='round'/></svg>"
      };
      return icons[kind] || icons.message;
    };
    const field = (label, value) => `
      <div class="request-detail-field">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(String(value || emptyText))}</span>
      </div>
    `;

    title.textContent = `${doc.fullName || "Unnamed Contact"} - ${requestLabel}`;
    meta.textContent = `${created} | Source: ${String(doc.page || "website")}`;
    deleteBtn.dataset.collection = collection;
    deleteBtn.dataset.id = doc.id;

    content.innerHTML = `
      <div class="request-detail-banner">
        <span class="request-type-pill">${escapeHtml(requestLabel)}</span>
        <span class="request-status-pill ${viewed ? "is-viewed" : ""}">${viewed ? "Viewed" : "New"}</span>
      </div>
      <div class="request-detail-cards">
        <article class="request-detail-card">
          <div class="request-detail-card-head">
            <span class="request-detail-icon">${iconSvg("user")}</span>
            <h3>Client Snapshot</h3>
          </div>
          ${field("Full Name", doc.fullName)}
          ${field("Email", doc.email)}
          ${field("Phone", doc.phone)}
          ${field("Type", typeText)}
        </article>
        <article class="request-detail-card">
          <div class="request-detail-card-head">
            <span class="request-detail-icon">${iconSvg("event")}</span>
            <h3>Event Details</h3>
          </div>
          ${field("Event Type", doc.eventType)}
          ${field("Event Date", doc.eventDate)}
          ${field("Venue", doc.venue)}
          ${field("Coverage Hours", hours)}
        </article>
        <article class="request-detail-card">
          <div class="request-detail-card-head">
            <span class="request-detail-icon">${iconSvg("pref")}</span>
            <h3>Preferences</h3>
          </div>
          ${field("Budget Range", doc.budgetRange)}
          ${field("Preferred Contact", preferredContact)}
          ${field("Add-On Needs", needsText)}
        </article>
        <article class="request-detail-card">
          <div class="request-detail-card-head">
            <span class="request-detail-icon">${iconSvg("message")}</span>
            <h3>Message</h3>
          </div>
          <div class="request-detail-message">${escapeHtml(message)}</div>
        </article>
      </div>
    `;
  }

  function initRequestDetailSection() {
    const params = new URLSearchParams(window.location.search);
    const collection = resolveRequestCollection(params.get("collection"));
    const requestId = String(params.get("id") || "").trim();
    const content = byId("requestDetailContent");
    const deleteBtn = byId("requestDetailDeleteBtn");
    const addCalendarBtn = byId("requestDetailAddCalendarBtn");

    if (!collection || !requestId) {
      if (content) {
        content.innerHTML = `<div class="admin-empty">Invalid request link. Go back to Requests and open an item again.</div>`;
      }
      return;
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        const confirmed = window.confirm("Delete this request?");
        if (!confirmed) return;
        try {
          await state.db.collection(collection).doc(requestId).delete();
          showAlert("Request deleted.", "success");
          window.location.href = "./requests.html";
        } catch (error) {
          showAlert(getFriendlyFirestoreError(error), "error");
        }
      });
    }

    if (addCalendarBtn) {
      addCalendarBtn.addEventListener("click", async () => {
        const request = state.requestDetailDoc;
        if (!request) {
          showAlert("Request details are still loading. Try again in a second.", "warning");
          return;
        }

        const payload = buildCalendarPayloadFromRequest(request);
        if (!payload.date) {
          const picked = window.prompt("This request does not have a valid date. Enter event date (YYYY-MM-DD):", toDateKey(new Date()));
          const normalized = normalizeCalendarDate(picked);
          if (!normalized) {
            showAlert("Calendar event not created. Please enter a valid date in YYYY-MM-DD format.", "warning");
            return;
          }
          payload.date = normalized;
        }

        addCalendarBtn.disabled = true;
        const originalTitle = addCalendarBtn.getAttribute("title") || "Add to calendar";
        addCalendarBtn.classList.add("is-loading");
        addCalendarBtn.setAttribute("aria-busy", "true");
        addCalendarBtn.setAttribute("title", "Adding to calendar...");
        try {
          await state.db.collection("calendar_events").add(payload);
          showAlert("Added to Admin Calendar.", "success");
          window.setTimeout(() => {
            window.location.href = `./calendar.html?highlight=${encodeURIComponent(payload.date)}`;
          }, 260);
        } catch (error) {
          showAlert(getFriendlyFirestoreError(error), "error", true);
        } finally {
          addCalendarBtn.disabled = false;
          addCalendarBtn.classList.remove("is-loading");
          addCalendarBtn.removeAttribute("aria-busy");
          addCalendarBtn.setAttribute("title", originalTitle);
        }
      });
    }

    const ref = state.db.collection(collection).doc(requestId);
    const unsub = ref.onSnapshot(async (snapshot) => {
      if (!snapshot.exists) {
        if (content) {
          content.innerHTML = `<div class="admin-empty">This request no longer exists.</div>`;
        }
        const title = byId("requestDetailTitle");
        if (title) title.textContent = "Request Not Found";
        return;
      }
      const doc = { id: snapshot.id, ...snapshot.data() };
      state.requestDetailDoc = doc;
      renderRequestDetail(doc, collection);
      await markRequestViewed(collection, requestId, doc);
    }, (error) => {
      showAlert(getFriendlyFirestoreError(error), "error", true);
    });

    state.unsubscribes.push(unsub);
  }

  function renderCalendarEventsList() {
    const list = byId("calendarEventsList");
    if (!list) return;
    if (!state.calendarDocs.length) {
      list.innerHTML = `<div class="admin-empty">No calendar events yet.</div>`;
      return;
    }

    list.innerHTML = state.calendarDocs.map((doc) => {
      const timeBlock = doc.startTime
        ? `${doc.startTime}${doc.endTime ? ` - ${doc.endTime}` : ""}`
        : "Time not set";
      return `
        <article class="admin-item" data-kind="calendar" data-id="${escapeHtml(doc.id)}">
          <div class="admin-item-head">
            <div class="admin-item-title">
              <strong>${escapeHtml(doc.title || "Untitled Event")}</strong>
              <span>${escapeHtml(formatDate(doc.date))} - ${escapeHtml(timeBlock)}</span>
            </div>
            <div class="admin-item-actions">
              <button class="admin-mini-btn" data-action="toggle-calendar-open" type="button">Open</button>
              <button class="admin-mini-btn delete" data-action="delete-calendar-event" type="button">Delete</button>
            </div>
          </div>
          <div class="admin-item-body">
            ${row("Date", doc.date)}
            ${row("Time", timeBlock)}
            ${row("Location", doc.location)}
            ${row("Provider", doc.provider)}
            ${row("Notes", doc.notes)}
          </div>
        </article>
      `;
    }).join("");
  }

  function renderCalendarDayDetails() {
    const details = byId("calendarDayDetails");
    if (!details) return;

    const selected = state.selectedCalendarDate;
    const list = state.calendarDocs.filter((item) => String(item.date || "") === selected);
    if (!list.length) {
      details.innerHTML = `
        <strong>${escapeHtml(formatDate(selected))}</strong>
        <span>No sessions on this date.</span>
      `;
      return;
    }

    const entries = list.map((item) => {
      const time = item.startTime
        ? `${item.startTime}${item.endTime ? ` - ${item.endTime}` : ""}`
        : "Time not set";
      return `
        <div class="admin-row">
          <strong>${escapeHtml(item.title || "Session")}</strong>
          <span>${escapeHtml(time)}${item.location ? ` | ${escapeHtml(item.location)}` : ""}</span>
        </div>
      `;
    }).join("");

    details.innerHTML = `
      <strong>${escapeHtml(formatDate(selected))}</strong>
      ${entries}
    `;
  }

  function renderPhysicalCalendar() {
    const grid = byId("physicalCalendarGrid");
    const label = byId("calendarMonthLabel");
    if (!grid || !label) return;

    const cursor = state.calendarCursor;
    label.textContent = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const eventCountByDate = {};
    state.calendarDocs.forEach((item) => {
      const key = String(item.date || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      eventCountByDate[key] = (eventCountByDate[key] || 0) + 1;
    });

    const firstOfMonth = startOfMonth(cursor);
    const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
    const todayKey = toDateKey(new Date());
    const currentMonth = cursor.getMonth();

    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const day = addDays(gridStart, i);
      const key = toDateKey(day);
      const count = eventCountByDate[key] || 0;
      const outside = day.getMonth() !== currentMonth;
      const isToday = key === todayKey;
      const isSelected = key === state.selectedCalendarDate;
      const dots = new Array(Math.min(count, 4)).fill("<span class=\"calendar-dot\"></span>").join("");

      cells.push(`
        <button class="calendar-cell ${outside ? "is-outside" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}"
          type="button"
          data-calendar-date="${escapeHtml(key)}"
          aria-label="${escapeHtml(formatDate(key))}">
          <span class="calendar-day-number">${day.getDate()}</span>
          <span class="calendar-dot-row">${dots}</span>
          ${count ? `<span class="calendar-count">${count} event${count === 1 ? "" : "s"}</span>` : ""}
        </button>
      `);
    }

    grid.innerHTML = cells.join("");
    renderCalendarDayDetails();
  }

  function formatDateForGoogle(dateKey, timeValue, addOneDayForAllDay = false) {
    const day = parseDateKey(dateKey);
    if (!day) return "";

    if (!timeValue) {
      const d = addDays(day, addOneDayForAllDay ? 1 : 0);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dayOfMonth = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${dayOfMonth}`;
    }

    const [hRaw, mRaw] = String(timeValue).split(":");
    const h = Number(hRaw || 0);
    const min = Number(mRaw || 0);
    const local = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, min, 0);
    const yyyy = local.getUTCFullYear();
    const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(local.getUTCDate()).padStart(2, "0");
    const hh = String(local.getUTCHours()).padStart(2, "0");
    const ii = String(local.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}${mm}${dd}T${hh}${ii}00Z`;
  }

  function openGoogleCalendar(eventData) {
    const start = eventData.startTime
      ? formatDateForGoogle(eventData.date, eventData.startTime)
      : formatDateForGoogle(eventData.date, "", false);
    const end = eventData.startTime
      ? formatDateForGoogle(eventData.date, eventData.endTime || eventData.startTime)
      : formatDateForGoogle(eventData.date, "", true);

    const params = new URLSearchParams();
    params.set("action", "TEMPLATE");
    params.set("text", eventData.title);
    params.set("dates", `${start}/${end}`);
    if (eventData.location) params.set("location", eventData.location);
    if (eventData.notes) params.set("details", eventData.notes);
    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener");
  }

  function downloadIcs(eventData) {
    const dtStamp = formatDateForGoogle(toDateKey(new Date()), "00:00") || "";
    const uid = `${Date.now()}-${Math.random().toString(16).slice(2)}@edgeframe`;
    const escapeIcs = (value) => String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;")
      .replace(/\r?\n/g, "\\n");
    const day = String(eventData.date || "").replace(/-/g, "");

    let lines = [];
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//EdgeFrame//Admin Calendar//EN");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`SUMMARY:${escapeIcs(eventData.title)}`);
    if (eventData.startTime) {
      const start = formatDateForGoogle(eventData.date, eventData.startTime).replace("Z", "");
      const end = formatDateForGoogle(eventData.date, eventData.endTime || eventData.startTime).replace("Z", "");
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
    } else {
      const next = formatDateForGoogle(eventData.date, "", true);
      lines.push(`DTSTART;VALUE=DATE:${day}`);
      lines.push(`DTEND;VALUE=DATE:${next}`);
    }
    if (eventData.location) lines.push(`LOCATION:${escapeIcs(eventData.location)}`);
    if (eventData.notes) lines.push(`DESCRIPTION:${escapeIcs(eventData.notes)}`);
    lines.push("END:VEVENT");
    lines.push("END:VCALENDAR");

    const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${String(eventData.title || "edgeframe-event").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  function bindCalendarActions() {
    if (state.isBound.calendar) return;
    state.isBound.calendar = true;

    const form = byId("calendarForm");
    const prev = byId("calendarPrevMonth");
    const next = byId("calendarNextMonth");
    const grid = byId("physicalCalendarGrid");
    const eventList = byId("calendarEventsList");

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
          title: String(formData.get("title") || "").trim(),
          date: String(formData.get("date") || "").trim(),
          startTime: String(formData.get("startTime") || "").trim(),
          endTime: String(formData.get("endTime") || "").trim(),
          location: String(formData.get("location") || "").trim(),
          notes: String(formData.get("notes") || "").trim(),
          provider: String(formData.get("provider") || "manual").trim(),
          createdBy: state.currentAdmin?.username || state.currentUser?.email || "admin",
          createdAtClient: new Date().toISOString(),
          createdAtServer: serverTimestamp()
        };

        if (!payload.title || !payload.date) {
          showAlert("Title and date are required.", "warning");
          return;
        }

        try {
          await state.db.collection("calendar_events").add(payload);
          showAlert("Calendar event saved.", "success");
          state.selectedCalendarDate = payload.date;
          const eventDate = parseDateKey(payload.date);
          if (eventDate) state.calendarCursor = startOfMonth(eventDate);
          renderPhysicalCalendar();
          form.reset();

          if (payload.provider === "google") {
            openGoogleCalendar(payload);
          } else if (payload.provider === "ics") {
            downloadIcs(payload);
          }
        } catch (error) {
          showAlert(getFriendlyFirestoreError(error), "error");
        }
      });
    }

    if (prev) {
      prev.addEventListener("click", () => {
        state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
        renderPhysicalCalendar();
      });
    }

    if (next) {
      next.addEventListener("click", () => {
        state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
        renderPhysicalCalendar();
      });
    }

    if (grid) {
      grid.addEventListener("click", (event) => {
        const target = event.target.closest("[data-calendar-date]");
        if (!(target instanceof HTMLElement)) return;
        const selected = String(target.dataset.calendarDate || "");
        if (!selected) return;
        state.selectedCalendarDate = selected;
        const selectedDate = parseDateKey(selected);
        if (selectedDate && selectedDate.getMonth() !== state.calendarCursor.getMonth()) {
          state.calendarCursor = startOfMonth(selectedDate);
        }
        renderPhysicalCalendar();
      });
    }

    if (eventList) {
      eventList.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!(button instanceof HTMLButtonElement)) return;
        const item = button.closest(".admin-item[data-kind='calendar']");
        if (!(item instanceof HTMLElement)) return;
        const docId = String(item.dataset.id || "");
        if (!docId) return;

        if (button.dataset.action === "toggle-calendar-open") {
          const open = item.classList.toggle("is-open");
          button.textContent = open ? "Hide" : "Open";
          return;
        }

        if (button.dataset.action === "delete-calendar-event") {
          const confirmed = window.confirm("Delete this calendar event?");
          if (!confirmed) return;
          try {
            await state.db.collection("calendar_events").doc(docId).delete();
            showAlert("Calendar event deleted.", "success");
          } catch (error) {
            showAlert(getFriendlyFirestoreError(error), "error");
          }
        }
      });
    }
  }

  function initCalendarSection() {
    bindCalendarActions();
    const params = new URLSearchParams(window.location.search);
    const highlighted = normalizeCalendarDate(params.get("highlight"));
    if (highlighted) {
      state.selectedCalendarDate = highlighted;
      const highlightedDate = parseDateKey(highlighted);
      if (highlightedDate) {
        state.calendarCursor = startOfMonth(highlightedDate);
      }
    }
    watchQuery(
      state.db.collection("calendar_events").orderBy("date", "asc").limit(1500),
      (snapshot) => {
        state.calendarDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderCalendarEventsList();
        renderPhysicalCalendar();
      },
      "Could not load calendar events."
    );
  }

  function renderTraffic() {
    const total = state.pageViewDocs.length;
    const unique = new Set(state.pageViewDocs.map((doc) => String(doc.visitorId || `${doc.path}-${doc.userAgent}`))).size;
    const todayKey = toDateKey(new Date());

    const todayViews = state.pageViewDocs.filter((doc) => {
      const serverDate = toDate(doc.createdAtServer);
      if (serverDate) return toDateKey(serverDate) === todayKey;
      const clientDate = toDate(doc.createdAtClient);
      return clientDate ? toDateKey(clientDate) === todayKey : false;
    }).length;

    setText("trafficTotal", total);
    setText("trafficUnique", unique);
    setText("trafficToday", todayViews);

    const breakdownRoot = byId("trafficBreakdown");
    if (!breakdownRoot) return;

    const counts = {};
    state.pageViewDocs.forEach((doc) => {
      const key = String(doc.page || "unknown");
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) {
      breakdownRoot.innerHTML = `<div class="admin-empty">No traffic data yet.</div>`;
      return;
    }

    breakdownRoot.innerHTML = entries.map(([pageName, count]) => {
      const percent = total ? Math.round((count / total) * 100) : 0;
      return `
        <article class="admin-item">
          <div class="admin-item-head">
            <div class="admin-item-title">
              <strong>${escapeHtml(pageName)}</strong>
              <span>${count} views (${percent}%)</span>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function initTrafficSection() {
    watchQuery(
      state.db.collection("page_views").orderBy("createdAtServer", "desc").limit(2500),
      (snapshot) => {
        state.pageViewDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderTraffic();
      },
      "Could not load traffic metrics."
    );
  }

  function renderUsers() {
    const list = byId("adminUsersList");
    if (!list) return;
    if (!state.adminUsersDocs.length) {
      list.innerHTML = `<div class="admin-empty">No admin users found.</div>`;
      return;
    }

    const sorted = [...state.adminUsersDocs].sort((a, b) => {
      const nameA = String(a.name || a.username || "").toLowerCase();
      const nameB = String(b.name || b.username || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    list.innerHTML = sorted.map((item) => {
      const isCurrent = item.id === state.currentUser?.uid;
      return `
        <article class="admin-item" data-kind="admin-user" data-id="${escapeHtml(item.id)}">
          <div class="admin-item-head">
            <div class="admin-item-title">
              <strong>${escapeHtml(item.name || item.username || "Admin User")}</strong>
              <span>@${escapeHtml(item.username || "unknown")} | ${escapeHtml(item.email || "no-email")} ${isCurrent ? "| You" : ""}</span>
            </div>
            <div class="admin-item-actions">
              ${isCurrent ? `<span class="view-chip viewed">Current</span>` : `<button class="admin-mini-btn delete" data-action="delete-admin-user" type="button">Delete</button>`}
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  async function createAuthUser(email, password) {
    const appName = `edgeframe-admin-create-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const secondaryApp = window.firebase.initializeApp(state.firebaseConfig, appName);
    try {
      const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
      return cred.user;
    } finally {
      try {
        await secondaryApp.auth().signOut();
      } catch {
        // no-op
      }
      try {
        await secondaryApp.delete();
      } catch {
        // no-op
      }
    }
  }

  function bindUsersActions() {
    if (state.isBound.users) return;
    state.isBound.users = true;

    const addForm = byId("addUserForm");
    const passwordForm = byId("passwordForm");
    const usersList = byId("adminUsersList");

    if (addForm) {
      addForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(addForm);
        const name = String(formData.get("name") || "").trim();
        const usernameRaw = String(formData.get("username") || "").trim();
        const password = String(formData.get("password") || "");
        const username = normalizeUsername(usernameRaw);

        if (!name || !username || !password) {
          showAlert("Name, username, and password are required.", "warning");
          return;
        }
        if (password.length < 6) {
          showAlert("Password must be at least 6 characters.", "warning");
          return;
        }
        if (username === OWNER_USERNAME) {
          showAlert("That username is reserved.", "warning");
          return;
        }
        if (state.adminUsersDocs.some((user) => normalizeUsername(user.username) === username)) {
          showAlert("That username already exists.", "warning");
          return;
        }

        const managedEmail = usernameToManagedEmail(username);
        try {
          const authUser = await createAuthUser(managedEmail, password);
          await state.db.collection("admin_users").doc(authUser.uid).set({
            uid: authUser.uid,
            email: managedEmail,
            username,
            name,
            role: "admin",
            createdBy: state.currentUser?.uid || "",
            createdAtClient: new Date().toISOString(),
            createdAtServer: serverTimestamp()
          }, { merge: true });
          addForm.reset();
          showAlert(`Admin user @${username} added.`, "success");
        } catch (error) {
          showAlert(getFriendlyAuthError(error), "error", true);
        }
      });
    }

    if (usersList) {
      usersList.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action='delete-admin-user']");
        if (!(button instanceof HTMLButtonElement)) return;
        const card = button.closest(".admin-item[data-kind='admin-user']");
        if (!(card instanceof HTMLElement)) return;
        const docId = String(card.dataset.id || "");
        if (!docId) return;
        if (docId === state.currentUser?.uid) {
          showAlert("You cannot delete the currently signed-in user.", "warning");
          return;
        }
        const confirmed = window.confirm("Delete this admin user? This removes admin dashboard access.");
        if (!confirmed) return;
        try {
          await state.db.collection("admin_users").doc(docId).delete();
          showAlert("Admin user deleted.", "success");
        } catch (error) {
          showAlert(getFriendlyFirestoreError(error), "error");
        }
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(passwordForm);
        const currentPassword = String(formData.get("currentPassword") || "");
        const newPassword = String(formData.get("newPassword") || "");
        const confirmPassword = String(formData.get("confirmPassword") || "");

        if (!currentPassword || !newPassword || !confirmPassword) {
          showAlert("Fill all password fields.", "warning");
          return;
        }
        if (newPassword.length < 6) {
          showAlert("New password must be at least 6 characters.", "warning");
          return;
        }
        if (newPassword !== confirmPassword) {
          showAlert("New password and confirm password do not match.", "warning");
          return;
        }
        const user = state.auth?.currentUser;
        if (!user || !user.email) {
          showAlert("Could not identify current user email for reauthentication.", "error");
          return;
        }

        try {
          const credential = window.firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
          await user.reauthenticateWithCredential(credential);
          await user.updatePassword(newPassword);
          passwordForm.reset();
          showAlert("Password updated.", "success");
        } catch (error) {
          showAlert(getFriendlyAuthError(error), "error", true);
        }
      });
    }
  }

  function initUsersSection() {
    bindUsersActions();
    watchQuery(
      state.db.collection("admin_users"),
      (snapshot) => {
        state.adminUsersDocs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderUsers();
      },
      "Could not load admin users."
    );
  }

  function initHomeSection() {
    const bindCount = (collection, elementId) => {
      watchQuery(
        state.db.collection(collection),
        (snapshot) => {
          setText(elementId, snapshot.size);
        },
        `Could not load ${collection} count.`
      );
    };
    bindCount("quote_requests", "homeQuoteCount");
    bindCount("question_requests", "homeQuestionCount");
    bindCount("calendar_events", "homeEventCount");
  }

  function initSection() {
    if (viewMode === "request-detail") {
      initRequestDetailSection();
      return;
    }

    switch (section) {
      case "requests":
        initRequestsSection();
        break;
      case "editor":
        break;
      case "calendar":
        initCalendarSection();
        break;
      case "traffic":
        initTrafficSection();
        break;
      case "users":
        initUsersSection();
        break;
      default:
        initHomeSection();
        break;
    }
  }

  function bootstrap() {
    bindNavActive();
    bindCommonUi();
    setAuthPending(true);
    setAuthedUi(false);

    if (!initFirebase()) {
      setAuthPending(false);
      return;
    }

    void enableLocalPersistence();
    state.auth.onAuthStateChanged((user) => {
      void handleAuthStateChanged(user);
    });
  }

  bootstrap();
})();
