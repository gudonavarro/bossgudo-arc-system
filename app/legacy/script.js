const app = document.getElementById("app");
let page = document.body.dataset.page || "home",
  wizardStep = 1,
  selectedPackageCode = "",
  selectedLayers = "2 layers",
  filtration = "Yes",
  pondWidth = 2,
  pondHeight = 3,
  extraNotes = "",
  selectedDate = "",
  calMonth = new Date().getMonth(),
  calYear = new Date().getFullYear(),
  loggedIn = false,
  userName = "Customer Account",
  adminTab = "overview";
let bFilter = "all",
  bSearch = "",
  cSearch = "",
  vFilter = "all",
  pkgSearch = "";
let bookingType = null,
  visitStep = 1,
  visitMode = "regular",
  visitDate = "",
  visitReason = "",
  visitDraft = {},
  policyAccepted = false,
  submitting = false,
  calKind = "service",
  successKind = "service";
function localIsoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
const TODAY = new Date(new Date().setHours(0, 0, 0, 0)),
  TODAY_ISO = localIsoDate(TODAY),
  TOMORROW_ISO = localIsoDate(new Date(TODAY.getTime() + 36 * 60 * 60 * 1000)),
  DAYNAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const blockedDates = {
  service: new Set(["2026-11-07", "2026-11-15", "2026-11-22"]),
  visit: new Set(["2026-11-14", "2026-11-28"]),
};
const NO_REFUND_POLICY =
  "Payments for a service booking, including the 50% down payment, are non-refundable once the booking is submitted.";

/* ---------- small helpers ---------- */
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const V = (id) => (document.getElementById(id)?.value || "").trim();
function ts() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function addUpdate(b, text, seen = false) {
  if (!b.timeline) b.timeline = [];
  b.timeline.push({ at: ts(), text, seen });
}
function nextRef(prefix, list) {
  let max = 0;
  list.forEach((x) => {
    const ref = String(x.ref);
    let suffixStart = ref.length;
    while (suffixStart > 0) {
      const code = ref.codePointAt(suffixStart - 1);
      if (code < 48 || code > 57) break;
      suffixStart--;
    }
    if (suffixStart < ref.length)
      max = Math.max(max, Number(ref.slice(suffixStart)));
  });
  return prefix + String(max + 1).padStart(3, "0");
}
function recalc(b) {
  b.total = r2(
    Number(b.servicePrice || 0) +
      Number(b.customizationFee || 0) +
      Number(b.deliveryFee || 0),
  );
  b.balance = Math.max(
    0,
    r2(b.total - (b.paidAmount > 0 ? b.paidAmount : b.deposit)),
  );
}
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("toast-success");
  t.classList.add("show");
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove("show"), 3400);
}
function openModal(title, sub, body, foot, wide) {
  const host = document.getElementById("modalHost");
  const subtitle = sub
    ? `<p class="text-xs font-medium text-base-content/60">${sub}</p>`
    : "";
  const footer = foot
    ? `<div class="modal-foot">${foot}</div>`
    : "";
  const sizeClass = wide ? "sm:max-w-3xl" : "sm:max-w-lg";
  if (!host.firstElementChild) modalReturnFocus = document.activeElement;
  host.innerHTML = `<div class="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-box flex max-h-[92dvh] flex-col p-0 ${sizeClass}"><div class="modal-head"><div class="min-w-0">${subtitle}<h3 id="modalTitle" class="text-lg font-semibold leading-snug">${title}</h3></div><button class="btn btn-ghost btn-sm btn-square" onclick="closeModal()" aria-label="Close">${icon("x", "size-5")}</button></div><div class="modal-body">${body}</div>${footer}</div><div class="modal-backdrop" onclick="closeModal()"></div></div>`;
  document.body.style.overflow = "hidden";
  const firstField = host.querySelector(".modal-body input:not([type=hidden]):not([hidden]), .modal-body textarea, .modal-body select");
  (firstField || host.querySelector(".modal-box button"))?.focus();
}
function closeModal() {
  document.getElementById("modalHost").innerHTML = "";
  document.body.style.overflow = "";
  releaseReceiptUrl();
  releasePackageFormPhoto();
  if (modalReturnFocus && document.contains(modalReturnFocus)) modalReturnFocus.focus();
  modalReturnFocus = null;
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
function fld(id, label, val, type = "text", attrs = "") {
  return `<div class="field"><label for="${id}">${label}</label><input class="input w-full" id="${id}" type="${type}" value="${safe(val ?? "")}" ${attrs}></div>`;
}
function sel(id, label, opts, val, attrs = "") {
  return `<div class="field"><label for="${id}">${label}</label><select class="select w-full" id="${id}" ${attrs}>${opts
    .map((o) => {
      const v = Array.isArray(o) ? o[0] : o,
        l = Array.isArray(o) ? o[1] : o;
      return `<option value="${safe(v)}" ${String(v) === String(val) ? "selected" : ""}>${safe(l)}</option>`;
    })
    .join("")}</select></div>`;
}

/* ---------- data ---------- */
let customers = [
  {
    id: "C-001",
    name: "Customer Account",
    email: "customer@example.com",
    phone: "09XX XXX XXXX",
    address: "General Trias, Cavite",
    notes: "",
  },
  {
    id: "C-002",
    name: "Alex Santos",
    email: "",
    phone: "09XX XXX XXXX",
    address: "General Trias, Cavite",
    notes: "",
  },
  {
    id: "C-003",
    name: "Jun Dela Cruz",
    email: "jun@example.com",
    phone: "09XX XXX XXXX",
    address: "",
    notes: "",
  },
];
function upsertCustomer(d) {
  const name = (d.name || "").trim();
  if (!name) return;
  let c = customers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!c) {
    customers.push({
      id:
        "C-" +
        String(customers.length + 1 + Math.floor(Math.random() * 900)).padStart(
          3,
          "0",
        ),
      name,
      email: d.email || "",
      phone: d.phone || "",
      address: d.location || d.address || "",
      notes: "",
    });
  } else {
    if (!c.email && d.email) c.email = d.email;
    if ((!c.phone || c.phone.includes("XXX")) && d.phone) c.phone = d.phone;
    if (!c.address && (d.location || d.address))
      c.address = d.location || d.address;
  }
}

let bookings = [
  {
    ref: "BG-2026-001",
    name: "Customer Account",
    pkg: "Pond Grower Package",
    freebie: "Free 500 g starter crayfish feed",
    packageLayers: "2 layers",
    packageDimensions: "2 m × 3 m",
    date: "Nov 14, 2026",
    isoDate: "2026-11-14",
    booking: "Pending",
    payment: "Pending Verification",
    servicePrice: 9500,
    customizationFee: 0,
    deliveryFee: null,
    total: 9500,
    deposit: 4750,
    balance: 4750,
    location: "General Trias, Cavite",
    phone: "09XX XXX XXXX",
    email: "customer@example.com",
    notes: "",
    layers: "2 layers",
    filtration: "Included in package / not applicable",
    proof: {
      reference: "GC-0001234567",
      fileName: "gcash-receipt.jpg",
      target: "deposit",
      amount: 4750,
      dataUrl: null,
      submittedAt: "Oct 19, 2026, 9:30 AM",
    },
    pendingPaymentTarget: "deposit",
    paidAmount: 0,
    paymentHistory: [],
    timeline: [
      {
        at: "Oct 19, 2026, 9:30 AM",
        text: "Booking submitted with a 50% down payment receipt (₱4,750.00).",
        seen: true,
      },
      {
        at: "Oct 19, 2026, 9:30 AM",
        text: "Waiting for the owner to verify your GCash payment. Your booking is confirmed once it is verified.",
        seen: true,
      },
    ],
  },
  {
    ref: "BG-2026-002",
    name: "Alex Santos",
    pkg: "Pond Starter Package",
    freebie: "Free starter water-test kit",
    packageLayers: "1 layer",
    packageDimensions: "2 m × 2 m",
    date: "Nov 21, 2026",
    isoDate: "2026-11-21",
    booking: "Confirmed",
    payment: "Partially Paid",
    servicePrice: 6500,
    customizationFee: 0,
    deliveryFee: null,
    total: 6500,
    deposit: 3250,
    balance: 3250,
    location: "General Trias, Cavite",
    phone: "09XX XXX XXXX",
    email: "",
    notes: "",
    layers: "1 layer",
    filtration: "Included in package / not applicable",
    proof: null,
    paidAmount: 3250,
    paymentHistory: [
      {
        target: "deposit",
        amount: 3250,
        reference: "GC-0007654321",
        fileName: "receipt.png",
        verifiedAt: "Oct 18, 2026, 2:10 PM",
        status: "Verified",
      },
    ],
    timeline: [
      {
        at: "Oct 18, 2026, 9:02 AM",
        text: "Booking submitted with a 50% down payment receipt (₱3,250.00).",
        seen: true,
      },
      {
        at: "Oct 18, 2026, 2:10 PM",
        text: "Your 50% down payment was verified. Your booking is now confirmed and your date is reserved.",
        seen: true,
      },
    ],
  },
  {
    ref: "BG-2026-003",
    name: "Customer Account",
    pkg: "Pond Starter Package",
    freebie: "Free starter water-test kit",
    packageLayers: "1 layer",
    packageDimensions: "2 m × 2 m",
    date: "Oct 17, 2026",
    isoDate: "2026-10-17",
    booking: "Completed",
    payment: "Partially Paid",
    servicePrice: 6500,
    customizationFee: 0,
    deliveryFee: null,
    total: 6500,
    deposit: 3250,
    balance: 3250,
    location: "Imus, Cavite",
    phone: "09XX XXX XXXX",
    email: "customer@example.com",
    notes: "",
    layers: "1 layer",
    filtration: "Included in package / not applicable",
    proof: null,
    paidAmount: 3250,
    paymentHistory: [
      {
        target: "deposit",
        amount: 3250,
        reference: "GC-0003334444",
        fileName: "receipt-oct.jpg",
        verifiedAt: "Oct 10, 2026, 11:00 AM",
        status: "Verified",
      },
    ],
    timeline: [
      {
        at: "Oct 9, 2026, 4:15 PM",
        text: "Booking submitted with a 50% down payment receipt (₱3,250.00).",
        seen: true,
      },
      {
        at: "Oct 10, 2026, 11:00 AM",
        text: "Your 50% down payment was verified. Your booking is now confirmed and your date is reserved.",
        seen: true,
      },
      {
        at: "Oct 17, 2026, 5:40 PM",
        text: "Your service is complete. The owner will confirm the delivery fee next, then you can pay your remaining balance here.",
        seen: false,
      },
    ],
  },
];
let paymentTargetRef = null;
let visits = [
  {
    ref: "VS-2026-001",
    name: "Customer Account",
    email: "customer@example.com",
    phone: "09XX XXX XXXX",
    farm: "Reyes Aqua Farm",
    visitors: 3,
    date: "2026-11-08",
    type: "Regular",
    status: "Booked",
    reason: "",
    submittedAt: "Oct 18, 2026",
  },
  {
    ref: "VS-2026-002",
    name: "Jun Dela Cruz",
    email: "jun@example.com",
    phone: "09XX XXX XXXX",
    farm: "",
    visitors: 2,
    date: "2026-11-18",
    type: "Special",
    status: "Pending Review",
    reason: "Only free on weekdays this month.",
    submittedAt: "Oct 19, 2026",
  },
];
let faqs = [];
let faqsLoaded = false;
let faqLoading = false;
let faqLoadError = "";
let faqSaving = false;

/* ---------- package catalog ----------
   Packages and custom pond rates come from GET /api/service-packages (active
   packages only). The server prices every booking from MongoDB; these values
   are for display and estimates. Packages are selected by their stable code. */
let pondPackageCatalog = [],
  packageCatalogState = "idle",
  packageCatalogError = "";
let pondRatePerSqmPerLayer = 0,
  filtrationEstimate = 0;
const CUSTOM_POND_CODE = "custom";
const CUSTOM_POND_NAME = "Custom Pond Design";
function toCatalogPackage(server) {
  return {
    id: server.code,
    name: server.name,
    description: server.description,
    price: server.price,
    layers: server.layers,
    dimensions: server.dimensions,
    inclusions: server.inclusions || [],
    freebie: (server.inclusions || []).map(cleanInclusion).join(" · "),
    featured: Boolean(server.featured),
    image: server.imageUrl || null,
    active: true,
  };
}
async function loadServicePackages() {
  if (packageCatalogState === "loading") return;
  packageCatalogState = "loading";
  packageCatalogError = "";
  try {
    const result = await bookingApiRequest("/api/service-packages");
    pondPackageCatalog = (result.packages || []).map(toCatalogPackage);
    pondRatePerSqmPerLayer = Number(result.customPondPricing?.ratePerSquareMetrePerLayer || 0);
    filtrationEstimate = Number(result.customPondPricing?.filtration || 0);
    packageCatalogState = "loaded";
  } catch (error) {
    packageCatalogState = "error";
    packageCatalogError = error instanceof Error ? error.message : "Packages could not be loaded.";
  }
  if (["home", "shop", "booking"].includes(page)) render();
}
/** Loading or error markup for package views; empty string once loaded. */
function packageCatalogStatusMarkup() {
  if (packageCatalogState === "error") {
    return `<div class="alert alert-error alert-soft mt-5" role="alert">${icon("circle-alert", "size-5")}<span>${safe(packageCatalogError)}</span><button class="btn btn-sm" onclick="packageCatalogState='idle';render()">${icon("refresh-cw")} Try again</button></div>`;
  }
  if (packageCatalogState !== "loaded") {
    return `<div class="pkg-grid mt-5" aria-busy="true"><span class="sr-only" role="status">Loading packages…</span>${skeletonCards(3)}</div>`;
  }
  return "";
}
function activePackages() {
  return pondPackageCatalog.filter((x) => x.active !== false);
}
function isCustomPond() {
  return selectedPackageCode === CUSTOM_POND_CODE;
}
function selectedPondPackage() {
  return activePackages().find((x) => x.id === selectedPackageCode) || null;
}
function selectedPackageName() {
  if (isCustomPond()) return CUSTOM_POND_NAME;
  return selectedPondPackage()?.name || "";
}
/** Placeholder shown wherever a package has no uploaded photo. */
function photoPlaceholder(cls, label, iconName = "shrimp") {
  return `<div class="pkg-placeholder ${cls}" role="img" aria-label="${safe(label)}">${icon(iconName, "size-14")}</div>`;
}
function packagePhoto(x, cls = "package-photo") {
  if (!x.image) return photoPlaceholder(cls, `${x.name} (no photo yet)`);
  return `<img class="${cls}" src="${safe(x.image)}" alt="${safe(x.name)} photo" onerror="this.onerror=null;this.style.display='none'">`;
}
function pkgImg(x) {
  if (!x.image) return `<span class="pkg-placeholder" role="img" aria-label="${safe(x.name)} (no photo yet)">${icon("shrimp", "size-14")}</span>`;
  return `<img src="${safe(x.image)}" alt="${safe(x.name)}" loading="lazy" onerror="this.style.display='none'">`;
}
function customPrice(layersStr, w, h, filt) {
  const layers = Math.min(3, Math.max(1, Number.parseInt(layersStr, 10) || 1));
  const area = Math.max(1, Number(w) || 1) * Math.max(1, Number(h) || 1);
  return r2(
    area * layers * pondRatePerSqmPerLayer +
      (filt === "Yes" ? filtrationEstimate : 0),
  );
}
function pondCustomizationEstimate() {
  return isCustomPond()
    ? customPrice(selectedLayers, pondWidth, pondHeight, filtration)
    : 0;
}
function updatePondEstimate() {
  const el = document.getElementById("pondEstimate");
  if (el) el.textContent = money(pondCustomizationEstimate());
  const a = document.getElementById("pondArea");
  if (a)
    a.textContent =
      (
        Math.max(1, Number(pondWidth) || 1) *
        Math.max(1, Number(pondHeight) || 1)
      ).toFixed(2) + " m²";
}
function currentPricing() {
  const pre = selectedPondPackage(),
    base = pre ? pre.price : 0,
    cust = isCustomPond() ? pondCustomizationEstimate() : 0,
    total = r2(base + cust),
    deposit = r2(total / 2);
  return { base, cust, total, deposit, balance: r2(total - deposit) };
}
function pickPkg(id) {
  if (id === CUSTOM_POND_CODE || pondPackageCatalog.some((x) => x.id === id)) {
    selectedPackageCode = id;
  }
  render();
}
function requireBookingLogin() {
  if (loggedIn) return false;
  const loginPath = `/customer-login?next=${encodeURIComponent("/booking")}`;
  if (typeof window.__bossGudoNavigate === "function") {
    void window.__bossGudoNavigate(loginPath);
  } else {
    window.location.assign(loginPath);
  }
  return true;
}
function choosePkgById(id) {
  pickPkg(id);
  bookingType = "service";
  wizardStep = 1;
  if (requireBookingLogin()) return;
  setPage("booking");
}

/* ---------- customer booking API ----------
   The backend is the source of truth for customer service bookings and
   visitations. The arrays below only cache the latest server response. */
let sessionCustomer = null,
  customerBookings = [],
  customerVisits = [],
  customerBookingsState = "idle",
  customerBookingsError = "",
  pendingServiceBooking = null,
  currentServerBooking = null,
  currentServerVisit = null;
const RECEIPT_TYPES_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

async function bookingApiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        ...(typeof options.body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Unable to reach the booking service. Check your connection and try again.");
  }
  let result = null;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your session has ended. Please log in again.");
    }
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "Unable to complete the booking request. Please try again.",
    );
  }
  return result ?? {};
}

function serverTime(value) {
  return value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
}

function serverDateIso(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

function bookingTimeline(server, payments) {
  const events = (server.statusHistory || []).map((entry) => ({
    time: new Date(entry.changedAt).getTime() || 0,
    at: serverTime(entry.changedAt),
    // changedBy is only populated in admin responses; customers never get it.
    text: `Booking ${String(entry.status).toLowerCase()}${entry.note ? ` · ${entry.note}` : ""}${staffName(entry.changedBy) ? ` · by ${staffName(entry.changedBy)}` : ""}`,
  }));
  payments.forEach((payment) => {
    const label =
      payment.paymentTarget === "deposit" ? "50% down payment" : "balance payment";
    events.push({
      time: new Date(payment.submittedAt).getTime() || 0,
      at: serverTime(payment.submittedAt),
      text: `Receipt submitted for your ${label} (${money(payment.amount)}). Waiting for owner verification.`,
    });
    if (payment.status !== "Pending" && payment.verifiedAt) {
      events.push({
        time: new Date(payment.verifiedAt).getTime() || 0,
        at: serverTime(payment.verifiedAt),
        text:
          payment.status === "Verified"
            ? `Your ${label} of ${money(payment.amount)} was verified.`
            : `Your ${label} receipt was not verified${payment.rejectionReason ? `: ${payment.rejectionReason}` : "."}`,
      });
    }
  });
  return events
    .sort((a, b) => a.time - b.time)
    .map(({ at, text }) => ({ at, text, seen: true }));
}

/** Maps a server booking onto the fields the existing booking views use. */
function toCustomerBooking(server) {
  const payments = server.payments || [];
  const latestPayment = payments[0] || null;
  const isoDate = serverDateIso(server.serviceDate);
  // Package details come from the booking's own snapshot, never the live
  // catalog, so later catalog edits cannot change past bookings.
  const preset = server.packageSnapshot || null;
  const custom = server.customConfiguration;
  return {
    server: true,
    id: server._id,
    ref: server.reference,
    name: server.customerName,
    email: server.customerEmail,
    phone: server.customerPhone,
    location: server.serviceLocation,
    notes: server.notes || "",
    pkg: server.packageName,
    freebie: (preset?.inclusions || []).map(cleanInclusion).join(" · "),
    packageLayers: preset && !custom ? preset.layers : "",
    packageDimensions: preset && !custom ? preset.dimensions : "",
    layers: custom ? `${custom.layers} ${custom.layers === 1 ? "layer" : "layers"}` : "",
    pondWidth: custom ? custom.width : null,
    pondHeight: custom ? custom.length : null,
    filtration: custom ? (custom.filtration ? "Yes" : "No") : "",
    date: isoDate ? fmtDate(isoDate) : "",
    isoDate,
    booking: server.bookingStatus,
    payment: server.paymentStatus,
    servicePrice: server.packagePrice,
    customizationFee: server.customizationFee,
    deliveryFee: server.deliveryFeeSetAt ? server.deliveryFee : null,
    total: server.totalAmount,
    deposit: server.depositAmount,
    paidAmount: server.paidAmount,
    balance: server.balanceAmount,
    proof: latestPayment
      ? {
          reference: latestPayment.gcashReference || "—",
          fileName: latestPayment.receiptFileName,
          target: latestPayment.paymentTarget,
          status: latestPayment.status,
          rejectionReason: latestPayment.rejectionReason,
        }
      : null,
    paymentHistory: payments
      .filter((payment) => payment.status === "Verified")
      .map((payment) => ({
        target: payment.paymentTarget,
        verifiedAt: serverTime(payment.verifiedAt),
        amount: payment.amount,
        reference: payment.gcashReference || "—",
      })),
    timeline: bookingTimeline(server, payments),
  };
}

function toCustomerVisit(server) {
  return {
    server: true,
    ref: server.reference,
    name: server.customerName,
    email: server.customerEmail,
    phone: server.customerPhone,
    farm: server.farmName || "",
    visitors: server.visitorCount,
    date: serverDateIso(server.visitDate),
    type: server.visitType,
    status: server.status,
    reason: server.specialRequestReason || "",
    submittedAt: server.createdAt ? fmtDate(serverDateIso(server.createdAt)) : "",
  };
}

async function loadCustomerBookings() {
  if (customerBookingsState === "loading") return;
  customerBookingsState = "loading";
  customerBookingsError = "";
  try {
    const [serviceResult, visitResult] = await Promise.all([
      bookingApiRequest("/api/service-bookings?limit=50"),
      bookingApiRequest("/api/visitation-bookings?limit=50"),
    ]);
    customerBookings = (serviceResult.bookings || []).map(toCustomerBooking);
    customerVisits = (visitResult.visits || []).map(toCustomerVisit);
    customerBookingsState = "loaded";
  } catch (error) {
    customerBookingsState = "error";
    customerBookingsError = error instanceof Error ? error.message : "Unable to load your bookings.";
  }
  if (page === "mybookings") render();
}

function customerBookingByRef(ref) {
  return customerBookings.find((x) => x.ref === ref) || null;
}

/* Customer-facing lifecycle for server bookings. Booking status: Approved
   (accepted on submission) -> Confirmed (50% deposit verified) -> Ongoing ->
   Completed. Payment status: Unpaid -> Verification Pending -> Partially Paid
   -> Paid, with Rejected when a receipt is not verified. */
function customerStage(b) {
  if (["Rejected", "Cancelled"].includes(b.booking)) return -1;
  if (["Confirmed", "Ongoing"].includes(b.booking)) return 1;
  if (b.booking === "Completed") {
    if (b.payment === "Paid") return 4;
    return b.deliveryFee == null ? 2 : 3;
  }
  return 0;
}
function customerCanPay(b) {
  if (b.payment === "Verification Pending") return null;
  if (["Pending", "Rejected", "Cancelled"].includes(b.booking)) return null;
  if (
    b.booking === "Approved" &&
    Number(b.paidAmount || 0) < Number(b.deposit) &&
    ["Unpaid", "Rejected"].includes(b.payment)
  )
    return "deposit";
  if (
    b.booking === "Completed" &&
    b.deliveryFee != null &&
    Number(b.balance) > 0 &&
    Number(b.paidAmount || 0) >= Number(b.deposit) &&
    ["Partially Paid", "Rejected"].includes(b.payment)
  )
    return "balance";
  return null;
}
function customerMessage(b) {
  if (b.booking === "Rejected")
    return "The owner could not accept this booking. Please contact the farm for details.";
  if (b.booking === "Cancelled")
    return "This booking was cancelled. The 50% down payment is non-refundable under the booking policy.";
  if (b.payment === "Verification Pending")
    return b.proof?.target === "balance"
      ? "Your balance receipt is being checked against the GCash transaction. You will get an update here once it is verified."
      : "Your 50% down payment receipt is being checked against the GCash transaction. Your booking is confirmed once the owner verifies it.";
  if (b.payment === "Rejected")
    return `The owner could not verify your last receipt${b.proof?.rejectionReason ? `: ${b.proof.rejectionReason}` : ""}. Please check the details and resubmit.`;
  if (b.booking === "Approved")
    return "Your booking has been accepted. Pay the 50% down payment to reserve your date.";
  if (b.booking === "Confirmed")
    return "Your booking is confirmed and your date is reserved. After the service is done, the owner will add any delivery fee and you can pay the remaining balance here.";
  if (b.booking === "Ongoing") return "Your service is in progress.";
  if (b.booking === "Completed" && b.payment === "Paid")
    return "Service completed and fully paid. Thank you!";
  if (b.booking === "Completed" && b.deliveryFee == null)
    return "Service completed. The owner will confirm the delivery fee next, then you can pay your remaining balance here.";
  if (b.booking === "Completed")
    return "The delivery fee has been added. Please pay your outstanding balance to finish.";
  return "";
}

function receiptContentType(file) {
  if (file.type && Object.values(RECEIPT_TYPES_BY_EXTENSION).includes(file.type)) {
    return file.type;
  }
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  return RECEIPT_TYPES_BY_EXTENSION[extension] || file.type || "";
}

/**
 * Uploads the receipt for a server booking and submits the GCash payment.
 * The amount comes from the server booking, not from client pricing.
 */
async function submitServerPayment(serverBooking, target, { reference, file }) {
  const contentType = receiptContentType(file);
  if (!contentType) {
    throw new Error("Upload the receipt as a JPG, PNG, WEBP, HEIC image or a PDF.");
  }
  const bookingPath = `/api/service-bookings/${encodeURIComponent(serverBooking.reference)}`;
  const { receipt } = await bookingApiRequest(`${bookingPath}/receipts`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "X-Receipt-File-Name": encodeURIComponent(file.name || "receipt"),
    },
    body: file,
  });
  const amount =
    target === "balance"
      ? serverBooking.balanceAmount
      : r2(serverBooking.depositAmount - serverBooking.paidAmount);
  return bookingApiRequest(`${bookingPath}/payments`, {
    method: "POST",
    body: JSON.stringify({
      paymentTarget: target,
      amount,
      gcashReference: reference,
      receiptFileName: receipt.receiptFileName,
      receiptStorageKey: receipt.receiptStorageKey,
    }),
  });
}

function setButtonBusy(buttonId, busy, busyLabel) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  if (busy) {
    button.dataset.idleLabel = button.innerHTML;
    button.innerHTML = `<span class="loading loading-spinner loading-sm" aria-hidden="true"></span>${safe(busyLabel)}`;
  } else if (button.dataset.idleLabel) {
    button.innerHTML = button.dataset.idleLabel;
  }
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
}
function showFormError(message) {
  const element = document.getElementById("formError");
  if (!element) {
    alert(message);
    return;
  }
  element.textContent = message;
  element.hidden = false;
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function clearFormError() {
  const element = document.getElementById("formError");
  if (element) element.hidden = true;
}
const FORM_ERROR_MARKUP =
  '<p class="alert alert-error alert-soft mt-4 text-sm" id="formError" role="alert" hidden></p>';
function sessionCustomerName() {
  return sessionCustomer
    ? `${sessionCustomer.firstName || ""} ${sessionCustomer.lastName || ""}`.trim()
    : userName;
}

/* ---------- booking lifecycle helpers ---------- */
/* Booking status: Pending -> Confirmed (automatic when the 50% down payment is verified) -> Completed (service done).
   Payment status: Awaiting Deposit / Pending Verification -> Partially Paid -> (after delivery fee) Pending Verification -> Paid. */
function bookingClass(s) {
  if (["Confirmed", "Completed"].includes(s)) return "badge-success";
  if (["Rejected", "Cancelled"].includes(s)) return "badge-error";
  if (s === "Ongoing") return "badge-info";
  return "badge-warning";
}
function payClass(p) {
  if (p === "Paid") return "badge-success";
  if (p === "Rejected") return "badge-error";
  if (p === "Awaiting Deposit" || p === "Unpaid") return "badge-neutral";
  if (p === "Partially Paid") return "badge-info";
  return "badge-warning";
}
/**
 * The owner's next step for a server booking. Actions map to backend
 * transitions: Approved -> Confirmed happens when the deposit is verified,
 * Confirmed -> Ongoing -> Completed are owner steps, then the delivery fee.
 */
function nextAction(b) {
  if (["Rejected", "Cancelled"].includes(b.booking))
    return { done: true, label: "Closed" };
  if (b.payment === "Verification Pending")
    return {
      label:
        b.pendingPayment?.paymentTarget === "balance" || b.proof?.target === "balance"
          ? "Verify balance payment"
          : "Verify down payment",
      fn: `reviewPayment('${b.ref}')`,
      cls: "btn-primary",
    };
  if (b.booking === "Confirmed")
    return {
      label: "Start service",
      fn: `updateBooking('${b.ref}','Ongoing')`,
      cls: "btn-primary",
    };
  if (b.booking === "Ongoing")
    return {
      label: "Mark service completed",
      fn: `updateBooking('${b.ref}','Completed')`,
      cls: "btn-primary",
    };
  if (
    b.booking === "Completed" &&
    b.payment !== "Paid" &&
    b.deliveryFee == null
  )
    return {
      label: "Set delivery fee",
      fn: `openPricing('${b.ref}')`,
      cls: "btn-primary",
    };
  if (b.booking === "Completed" && b.payment !== "Paid")
    return {
      wait:
        b.payment === "Rejected"
          ? "Waiting for corrected balance receipt"
          : "Waiting for customer to pay balance",
    };
  if (["Pending", "Approved"].includes(b.booking))
    return {
      wait:
        b.payment === "Rejected"
          ? "Waiting for corrected receipt"
          : "Waiting for down payment",
    };
  return { done: true, label: "All done" };
}
function tracker(b, s) {
  if (s < 0)
    return `<div class="alert alert-soft alert-error my-3 text-sm">${icon("circle-x", "size-5")}<span>This booking is ${safe(b.booking.toLowerCase())}.</span></div>`;
  const steps = ["Submitted", "Confirmed", "Service done", "Delivery & balance", "Fully paid"]
    .map((label, i) => {
      const done = i < s || s === 4;
      const current = i === s && s !== 4;
      const cls = done || current ? "step step-primary" : "step";
      const content = done ? ' data-content="✓"' : "";
      const aria = current ? ' aria-current="step"' : "";
      return `<li class="${cls}"${content}${aria}>${label}</li>`;
    })
    .join("");
  return `<ul class="steps tracker my-4 w-full text-xs" aria-label="Booking progress">${steps}</ul>`;
}
function timelineHtml(b, showNew) {
  const t = (b.timeline || []).slice().reverse();
  const items = t.map((e) => {
    const newTag = showNew && !e.seen ? '<span class="badge badge-secondary badge-xs ml-2">NEW</span>' : "";
    return `<li><p>${safe(e.text)}${newTag}</p><time>${safe(e.at)}</time></li>`;
  }).join("");
  return items ? `<ul class="updates">${items}</ul>` : '<p class="muted text-sm">No updates yet.</p>';
}
function myBookingList() {
  return customerBookings;
}
function myUnread() {
  return myBookingList().reduce(
    (s, b) => s + (b.timeline || []).filter((e) => !e.seen).length,
    0,
  );
}
function updateNavBadge() {
  const n = myUnread();
  document.querySelectorAll("[data-nav-badge]").forEach((badge) => {
    badge.textContent = n ? String(n) : "";
    badge.hidden = !n;
    badge.setAttribute("aria-label", n ? `${n} new update${n === 1 ? "" : "s"}` : "");
  });
}

function fmtDate(iso, long = false) {
  return new Date(iso + "T12:00:00").toLocaleDateString(
    "en-US",
    long
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}
function safe(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function money(n) {
  return (
    "₱" +
    Number(n || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/* ---------- UI helpers (DaisyUI markup) ---------- */
/** Decorative Lucide icon supplied by the legacy-ui plugin. */
function icon(name, cls = "size-4") {
  return typeof window.__bossGudoIcon === "function"
    ? window.__bossGudoIcon(name, cls)
    : "";
}
function crumbs(trail) {
  const items = trail.map((item) => `<li>${safe(item)}</li>`).join("");
  return `<nav class="breadcrumbs py-0 text-sm text-base-content/60" aria-label="Breadcrumb"><ul>${items}</ul></nav>`;
}
function pageHead(trail, title, sub = "", actions = "") {
  const subtitle = sub ? `<p class="page-sub">${sub}</p>` : "";
  const actionMarkup = actions
    ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>`
    : "";
  return `${crumbs(trail)}<div class="page-head"><div class="min-w-0"><h1 class="page-title">${title}</h1>${subtitle}</div>${actionMarkup}</div>`;
}
/** Inclusions are entered as free text; drop leading list markers. */
function cleanInclusion(text) {
  return String(text).replace(/^\s*[-•*]\s*/, "");
}
function inclusionList(x) {
  const items = (x.inclusions || [])
    .map((item) => `<li>${icon("gift", "size-4 text-secondary")}<span>${safe(cleanInclusion(item))}</span></li>`)
    .join("");
  return items ? `<ul class="freebie" aria-label="Included with this package">${items}</ul>` : "";
}
function skeletonCards(count) {
  return Array.from(
    { length: count },
    () => '<div class="pkg-card" aria-hidden="true"><div class="skeleton h-44 rounded-none"></div><div class="space-y-3 p-5"><div class="skeleton h-5 w-2/3"></div><div class="skeleton h-4 w-full"></div><div class="skeleton h-4 w-4/5"></div></div></div>',
  ).join("");
}
let modalReturnFocus = null;
// Keep keyboard focus inside an open modal dialog.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const box = document.querySelector("#modalHost .modal-box");
  if (!box) return;
  const focusable = [...box.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]):not([hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])")]
    .filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
});
function pkgChips(layers, dimensions) {
  return `<div class="chips"><span class="badge badge-soft badge-primary gap-1">${icon("layers", "size-3")}${layers}</span><span class="badge badge-soft badge-primary gap-1">${icon("ruler", "size-3")}${dimensions}</span></div>`;
}
function gcashDetailsMarkup(rows, amount, note) {
  return `<div class="pay-grid"><div class="tile text-center"><h3 class="tile-title justify-center">${icon("qr-code", "size-4 text-primary")}Scan to pay with GCash</h3>${qrPlaceholder()}<p class="muted text-xs">Scan the QR code or use the owner’s GCash account details.</p></div><div class="tile"><h3 class="tile-title">${icon("smartphone", "size-4 text-primary")}Owner’s GCash details</h3><div class="summary-line"><span>Account name</span><strong>[Owner’s GCash account name]</strong></div><div class="summary-line"><span>GCash number</span><strong>[Owner’s GCash number]</strong></div>${rows}<div class="amount-due"><span>Amount to pay now</span><strong>${money(amount)}</strong></div><div class="notice mt-4">${note}</div></div></div>`;
}
function receiptUploadMarkup(intro) {
  return `<h3 class="tile-title">${icon("receipt", "size-4 text-primary")}Upload payment receipt</h3><p class="muted text-sm">${intro}</p><div class="field-grid"><div class="field"><label for="gcashReference">GCash transaction reference number <span class="text-error">*</span></label><input class="input w-full" id="gcashReference" placeholder="Enter the transaction reference number" autocomplete="off" required></div><div class="field"><label for="gcashProof">Payment receipt / screenshot <span class="text-error">*</span></label><input class="file-input w-full" id="gcashProof" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif" required aria-describedby="gcashProofHint"><p class="muted mt-1.5 text-xs" id="gcashProofHint">Accepted: JPG, PNG, WEBP, HEIC image or PDF, up to 8 MB.</p></div></div>`;
}
function resultPanel(iconName, title, text, details, actions) {
  return `<div class="panel result-panel"><span class="result-icon">${icon(iconName, "size-8")}</span><h1 class="page-title mt-4">${title}</h1><p class="muted mx-auto mt-3 max-w-xl">${text}</p><div class="tile mx-auto my-6 max-w-lg text-left">${details}</div><div class="flex flex-wrap justify-center gap-3">${actions}</div></div>`;
}
const pageFiles = {
  home: "/",
  about: "/about",
  shop: "/shop",
  booking: "/booking",
  mybookings: "/mybookings",
  "customer-login": "/customer-login",
  register: "/register",
  admin: "/admin",
};
const pageTitles = {
  home: "Home",
  about: "About",
  shop: "Shop",
  booking: "Bookings",
  mybookings: "My Bookings",
  "customer-login": "Customer Login",
  admin: "Admin Dashboard",
  register: "Create an Account",
  success: "Booking Submitted",
  customerpayment: "Payment",
};
function syncPageChrome(nextPage) {
  // Opening My Bookings always refreshes the records from the server.
  if (nextPage === "mybookings" && customerBookingsState !== "loading") {
    customerBookingsState = "idle";
  }
  if (nextPage === "admin" && adminDataState !== "loading") {
    adminDataState = "idle";
  }
  if (nextPage === "admin" && adminPackagesState !== "loading") {
    adminPackagesState = "idle";
  }
  // Opening a storefront page refreshes packages and prices from the server.
  if (["home", "shop", "booking"].includes(nextPage) && packageCatalogState !== "loading") {
    packageCatalogState = "idle";
  }
  document.body.dataset.page = nextPage;
  document.title = nextPage === "shop"
    ? "Shop | Boss Gudo A.R.C. Aqua Farm"
    : `${pageTitles[nextPage] || "Home"} | BOSSGUDO A.R.C. AQUA FARM`;
}
function ensureNavigationShell() {
  const shell = document.querySelector("header.topbar:not(.home-navbar)");
  if (!shell) return;
  shell.hidden = page === "home";
}
function setPage(p) {
  const path = pageFiles[p];
  if (path && location.pathname !== path) {
    if (typeof window.__bossGudoNavigate === "function") {
      void window.__bossGudoNavigate(path);
    } else {
      history.pushState({ page: p }, "", path);
    }
  }
  page = p;
  syncPageChrome(p);
  document
    .querySelectorAll(".nav a[data-page]")
    .forEach((link) =>
      link.classList.toggle("active", link.dataset.page === p),
    );
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function wizardHeader(steps, cur) {
  const stepMarkup = steps.map((step, index) => {
    const n = index + 1;
    const cls = cur >= n ? "step step-primary" : "step";
    const content = cur > n ? ' data-content="✓"' : "";
    const aria = cur === n ? ' aria-current="step"' : "";
    return `<li class="${cls}"${content}${aria}>${step}</li>`;
  }).join("");
  return `<ul class="steps wizard-steps mb-6 w-full text-xs sm:text-sm" aria-label="Booking steps">${stepMarkup}</ul>`;
}
function startBooking() {
  bookingType = null;
  pendingServiceBooking = null;
  setPage("booking");
}
function calendarHtml(kind = "service", mode = "select") {
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const dayCount = new Date(calYear, calMonth + 1, 0).getDate();
  const selectedDateForKind = kind === "visit" ? visitDate : selectedDate;
  const blankDays = new Array(firstDay).fill('<div class="cal-day is-blank" aria-hidden="true"></div>').join("");
  const dayMarkup = Array.from({ length: dayCount }, (_, index) =>
    calendarDayHtml(index + 1, kind, mode, selectedDateForKind),
  ).join("");
  return blankDays + dayMarkup;
}
function calendarDayHtml(day, kind, mode, selectedDateForKind) {
  const date = new Date(calYear, calMonth, day);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const value = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Bookings must be for a future date; the server applies the same rule.
  const isOpen = isWeekend && value > TODAY_ISO;
  const isBlocked = blockedDates[kind].has(value);
  let className = "cal-day";
  let attributes = "";
  let title = "Not selectable";

  if (isOpen) className += isBlocked ? " is-unavailable" : " is-available";
  if (mode === "admin" && isOpen) {
    title = isBlocked ? "Closed. Click to reopen" : "Open. Click to close";
    attributes = `onclick="toggleBlock('${kind}','${value}')"`;
  } else if (mode !== "admin" && isOpen && !isBlocked) {
    title = "Available";
    attributes = `onclick="pickDate('${kind}','${value}')"`;
  } else if (mode !== "admin" && isOpen) {
    title = "Unavailable";
  }
  const isSelected = mode !== "admin" && selectedDateForKind === value;
  if (isSelected) className += " is-selected";
  if (attributes)
    attributes +=
      ` role="button" tabindex="0" aria-pressed="${isSelected}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"`;
  const label = `${fmtDate(value, true)}: ${title}`;
  return `<div class="${className}" ${attributes} title="${title}" aria-label="${safe(label)}">${day}</div>`;
}
function changeMonth(n) {
  readDetails();
  calMonth += n;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  render();
}
function pickDate(kind, val) {
  if (kind === "visit") visitDate = val;
  else {
    readDetails();
    selectedDate = val;
  }
  render();
}
function toggleBlock(kind, val) {
  let s = blockedDates[kind];
  if (s.has(val)) s.delete(val);
  else s.add(val);
  render();
}
function setCalKind(k) {
  calKind = k;
  render();
}
function calendarBlock(kind, mode = "select") {
  const monthLabel = new Date(calYear, calMonth, 1).toLocaleString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const legend = mode === "admin"
    ? '<span><i class="cal-dot is-available"></i>Open</span><span><i class="cal-dot is-unavailable"></i>Closed</span><span><i class="cal-dot"></i>Not adjustable</span>'
    : '<span><i class="cal-dot is-available"></i>Available</span><span><i class="cal-dot is-unavailable"></i>Unavailable</span><span><i class="cal-dot"></i>Not selectable</span>';
  const dayNames = DAYNAMES.map((name) =>
    `<div class="cal-dayname">${name}</div>`,
  ).join("");
  const calendarDays = calendarHtml(kind, mode);
  return `<div class="cal"><div class="cal-head"><button type="button" class="btn btn-ghost btn-sm btn-square" onclick="changeMonth(-1)" aria-label="Previous month">${icon("chevron-left", "size-5")}</button><strong aria-live="polite">${monthLabel}</strong><button type="button" class="btn btn-ghost btn-sm btn-square" onclick="changeMonth(1)" aria-label="Next month">${icon("chevron-right", "size-5")}</button></div><div class="cal-grid">${dayNames}${calendarDays}</div><div class="cal-legend">${legend}</div></div>`;
}
function register() {
  return `<div class="panel auth-card"><div style="text-align:center"><h1 class="page-title">Create an account</h1><p class="muted">Register to submit and track bookings.</p></div><form id="registerForm"><div class="field"><label>Full name</label><input class="input w-full" id="regName" required placeholder="Your full name"></div><div class="field"><label>Email address</label><input class="input w-full" type="email" required placeholder="you@example.com"></div><div class="field"><label>Password</label><input class="input w-full" type="password" required minlength="6" placeholder="At least 6 characters"></div><button class="btn btn-primary">Create Account</button></form></div>`;
}
function about() {
  const offers = [
    ["shrimp", "Crayfish supply", "Australian Red Claw stock for new and growing crayfish farms."],
    ["wrench", "Pond setup assistance", "Pond packages, manufacturing, installation and custom pond design."],
    ["graduation-cap", "Training", "Learn the basics of raising crayfish and setting up suitable ponds."],
    ["handshake", "After-sales support", "Practical help from the farm after your setup is done."],
  ];
  const asks = [
    ["package", "Packages & services", "Ask about supply, pond setup, and combined options."],
    ["graduation-cap", "Training & support", "Ask the owner about training requirements and available support."],
    ["calendar-check", "Bookings & visits", "Book a service or schedule a farm visit on an available weekend."],
  ];
  const offerMarkup = offers
    .map(([name, title, text]) => `<div class="tile"><span class="icon-chip">${icon(name, "size-5")}</span><h3 class="mt-4">${title}</h3><p class="muted mt-1 text-sm leading-relaxed">${text}</p></div>`)
    .join("");
  const askMarkup = asks
    .map(([name, title, text]) => `<div class="tile flex gap-4"><span class="icon-chip shrink-0">${icon(name, "size-5")}</span><div><h3>${title}</h3><p class="muted mt-1 text-sm leading-relaxed">${text}</p></div></div>`)
    .join("");
  return `${pageHead(["Home", "About"], "About BOSSGUDO A.R.C. AQUA FARM", "Learn about the business and its services.")}<section class="grid overflow-hidden rounded-box border border-base-300 bg-base-100 lg:grid-cols-2"><img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&amp;fit=crop&amp;w=1100&amp;q=80" alt="Open farmland under a clear sky" class="h-60 w-full object-cover lg:h-full"><div class="p-6 sm:p-10"><p class="eyebrow">About the farm</p><h2 class="section-title">Supporting new and growing crayfish enthusiasts</h2><p class="mt-4 leading-relaxed text-base-content/75">BOSSGUDO A.R.C. AQUA FARM provides Australian Red Claw crayfish supply, pond setup assistance, training, and after-sales support. The farm aims to help customers understand the basics of raising crayfish and setting up suitable ponds.</p><p class="mt-3 leading-relaxed text-base-content/75">Use the booking page to book a pond service or schedule a farm visit.</p><div class="mt-6 flex flex-wrap gap-3"><button class="btn btn-primary" onclick="startBooking()">${icon("calendar-plus")}Book Now</button><button class="btn" onclick="setPage('shop')">${icon("store")}View packages</button></div></div></section><h2 class="section-title mt-12">What the farm offers</h2><div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">${offerMarkup}</div><div class="mt-12 flex flex-wrap items-end justify-between gap-4"><div><h2 class="section-title">What you can ask about</h2><p class="muted mt-2">Use the assistant for predefined FAQs or contact the owner for special requests.</p></div><button class="btn btn-outline btn-primary" onclick="document.getElementById('chatLaunch')?.click()">${icon("message-circle")}Ask the ARC Assistant</button></div><div class="mt-5 grid gap-4 md:grid-cols-3">${askMarkup}</div>`;
}
/* Receipt preview for admins. The file is fetched from the admin-protected
   receipt endpoint with the session cookie and shown through a temporary
   object URL, which is released when the preview closes or is replaced. */
const PREVIEWABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
let activeReceiptUrl = null,
  receiptRequestId = 0;
function releaseReceiptUrl() {
  if (activeReceiptUrl) URL.revokeObjectURL(activeReceiptUrl);
  activeReceiptUrl = null;
}
function receiptFileNameFrom(response, fallback) {
  const match = /filename\*=UTF-8''([^;]+)/i.exec(response.headers.get("content-disposition") || "");
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
async function viewPaymentReceipt(ref, paymentId) {
  const requestId = ++receiptRequestId;
  const title = "Payment receipt";
  const close = '<button class="btn" onclick="closeModal()">Close</button>';
  releaseReceiptUrl();
  openModal(title, safe(ref), '<p class="muted" aria-busy="true">Loading receipt…</p>', close, true);
  let response;
  try {
    response = await fetch(
      `${adminBookingPath(ref)}/payments/${encodeURIComponent(paymentId)}/receipt`,
      { credentials: "same-origin", cache: "no-store" },
    );
  } catch {
    response = null;
  }
  // Ignore a response that arrives after the preview was closed or replaced.
  if (requestId !== receiptRequestId || !document.querySelector("#modalHost .modal")) return;
  if (!response?.ok) {
    let message = "The receipt could not be loaded. Please try again.";
    if (response?.status === 401) message = "Your session has ended. Please log in again.";
    else if (response?.status === 404) message = "No receipt file was found for this payment.";
    else if (response) {
      const result = await response.json().catch(() => null);
      if (typeof result?.error === "string") message = result.error;
    }
    openModal(title, safe(ref), `<p role="alert">${safe(message)}</p>`, close);
    return;
  }
  const blob = await response.blob();
  if (requestId !== receiptRequestId) return;
  const contentType = (response.headers.get("content-type") || blob.type || "").split(";")[0].trim();
  const fileName = receiptFileNameFrom(response, "receipt");
  activeReceiptUrl = URL.createObjectURL(blob);
  const url = activeReceiptUrl;
  let preview;
  if (PREVIEWABLE_IMAGE_TYPES.has(contentType)) {
    preview = `<img id="receiptPreview" src="${url}" alt="Uploaded payment receipt" style="max-width:100%;height:auto;display:block;margin:0 auto">`;
  } else if (contentType === "application/pdf") {
    preview = `<iframe id="receiptPreview" src="${url}" title="Payment receipt PDF for ${safe(ref)}" style="width:100%;height:70vh;border:0"></iframe>`;
  } else {
    preview = `<div class="notice" id="receiptPreview">This file type (${safe(contentType || "unknown")}) can't be previewed in the browser. Download it to view the receipt.</div><p style="margin-top:12px"><a class="btn btn-primary" href="${url}" download="${safe(fileName)}">Download receipt</a></p>`;
  }
  const body = `<div class="summary-line"><span>File</span><strong>${safe(fileName)}</strong></div><div class="summary-line"><span>Size</span><strong>${(blob.size / 1024).toFixed(1)} KB</strong></div><div style="margin-top:12px">${preview}</div>`;
  const actions = `${close}<a class="btn" href="${url}" target="_blank" rel="noopener">Open in new tab</a>`;
  openModal(title, safe(ref), body, actions, true);
}
function bookingChooser() {
  const loginHint = loggedIn
    ? ""
    : `<div class="notice mt-6 flex items-center gap-3">${icon("lock", "size-5 text-primary")}<span>You’ll be asked to log in or create an account before completing a booking.</span></div>`;
  const choice = (iconName, title, text, points, action, label) =>
    `<article class="tile choice"><span class="service-icon">${icon(iconName, "size-7")}</span><h2>${title}</h2><p class="muted">${text}</p><ul class="choice-points">${points.map((p) => `<li>${icon("check", "size-4 text-primary")}<span>${p}</span></li>`).join("")}</ul><button class="btn btn-primary btn-block mt-auto" onclick="chooseBookingType('${action}')">${label}${icon("arrow-right")}</button></article>`;
  return `${pageHead(["Home", "Bookings"], "Booking", "What would you like to book today?")}<div class="choice-grid">${choice("waves", "Book a Service", "Pond packages, manufacturing, installation, and custom pond design.", ["Choose a package or design a custom pond", "Pick an open weekend service date", "Pay a 50% down payment through GCash"], "service", "Select Service")}${choice("trees", "Book a Visitation", "Schedule a farm visit for 1–5 visitors on available weekends.", ["1–5 visitors per visit", "Available Saturdays and Sundays", "Special dates can be requested for review"], "visit", "Select Visitation")}</div>${loginHint}`;
}
function chooseBookingType(t) {
  bookingType = t;
  wizardStep = 1;
  visitStep = 1;
  pendingServiceBooking = null;
  if (requireBookingLogin()) return;
  setPage("booking");
}
function changeBookingType() {
  bookingType = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function qrPlaceholder() {
  return `<div class="mx-auto my-4 grid size-52 place-items-center rounded-box border border-base-300 bg-white p-3" role="img" aria-label="GCash QR code placeholder"><div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);gap:3px;opacity:.85">${Array.from(
    { length: 121 },
    (_, i) => {
      let x = i % 11,
        y = Math.floor(i / 11);
      let on =
        (x * 7 + y * 3 + x * y) % 5 < 2 ||
        (x < 3 && y < 3) ||
        (x > 7 && y < 3) ||
        (x < 3 && y > 7);
      return `<span style="background:${on ? "#15231b" : "#fff"};border-radius:1px"></span>`;
    },
  ).join("")}</div></div>`;
}
function readDetails() {
  if (!document.getElementById("customerName")) return;
  window.bookingDraft = {
    ...window.bookingDraft,
    name: V("customerName"),
    phone: V("phone"),
    email: V("email"),
    location: V("location"),
    notes: extraNotes || window.bookingDraft?.notes || "",
  };
}
function servicePhoto() {
  const p = selectedPondPackage();
  return p ? packagePhoto(p, "package-photo") : photoPlaceholder("package-photo", "Custom pond design", "ruler");
}
function reviewStep() {
  let d = window.bookingDraft || {},
    p = currentPricing(),
    preset = selectedPondPackage();
  const packageDetails = preset
    ? `<p class="muted mt-1">${safe(preset.description)}</p><div class="summary-line"><span>Pond configuration</span><strong>${safe(preset.layers)} · ${safe(preset.dimensions)}</strong></div><div class="summary-line"><span>Included freebie</span><strong>${safe(preset.freebie)}</strong></div>`
    : `<div class="summary-line"><span>Pond size</span><strong>${Number(pondWidth).toFixed(1)} m × ${Number(pondHeight).toFixed(1)} m (${(pondWidth * pondHeight).toFixed(2)} m²)</strong></div><div class="summary-line"><span>Layers</span><strong>${safe(selectedLayers)}</strong></div><div class="summary-line"><span>Filtration</span><strong>${safe(filtration)}</strong></div>`;
  const notes = d.notes
    ? `<div class="summary-line"><span>Notes for the owner</span><strong>${safe(d.notes)}</strong></div>`
    : "";
  const priceDetails = preset
    ? `<div class="summary-line"><span>Package price</span><strong>${money(p.base)}</strong></div>`
    : `<div class="summary-line"><span>Custom pond price (based on size, layers, filtration)</span><strong>${money(p.cust)}</strong></div>`;
  const preferredDate = selectedDate
    ? fmtDate(selectedDate, true)
    : "Not selected";
  return `<h2 class="step-title">Review your booking</h2><p class="muted">Check the package, booking information, and price. Then continue to payment.</p><div class="review-grid mt-5"><div class="overflow-hidden rounded-box">${servicePhoto()}</div><div><h3 class="text-lg font-semibold">${safe(selectedPackageName())}</h3>${packageDetails}${notes}</div></div><div class="mt-5 grid gap-5 md:grid-cols-2"><div class="tile"><h3 class="tile-title">${icon("user", "size-4 text-primary")}Booking information</h3><div class="summary-line"><span>Preferred date</span><strong>${preferredDate}</strong></div><div class="summary-line"><span>Name</span><strong>${safe(d.name || "")}</strong></div><div class="summary-line"><span>Contact number</span><strong>${safe(d.phone || "")}</strong></div><div class="summary-line"><span>Email</span><strong>${safe(d.email || "Not provided")}</strong></div><div class="summary-line"><span>Service location</span><strong>${safe(d.location || "")}</strong></div></div><div class="tile"><h3 class="tile-title">${icon("wallet", "size-4 text-primary")}Price</h3>${priceDetails}<div class="summary-line"><span>Total service price</span><strong>${money(p.total)}</strong></div><div class="summary-line is-highlight"><span>50% down payment due now</span><strong>${money(p.deposit)}</strong></div><div class="summary-line"><span>Remaining balance</span><strong>${money(p.balance)}</strong></div><p class="muted mt-2 text-xs">After the service is done, the owner adds any Lalamove delivery fee and you pay the remaining balance in My Bookings.</p></div></div><div class="callout mt-5"><p class="flex items-start gap-2"><span class="text-warning">${icon("triangle-alert", "size-5")}</span><span><strong>No-refund policy.</strong> ${NO_REFUND_POLICY}</span></p><label class="check-row"><input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" id="policyBox" ${policyAccepted ? "checked" : ""} onchange="policyAccepted=this.checked"><span>I understand and accept the no-refund policy.</span></label></div><div class="wizard-actions"><button class="btn" onclick="wizardStep=3;render()">${icon("arrow-left")}Back</button><button class="btn btn-primary" onclick="goPayment()">Continue to Payment${icon("arrow-right")}</button></div>`;
}
function paymentStep() {
  let p = currentPricing();
  const rows = `<div class="summary-line"><span>Package</span><strong>${safe(selectedPackageName())}</strong></div><div class="summary-line"><span>Total service price</span><strong>${money(p.total)}</strong></div>`;
  return `<h2 class="step-title">Payment</h2><p class="muted">Pay the 50% down payment in GCash, then upload your receipt. Your booking and receipt are submitted together, and your booking is confirmed once the owner verifies your payment.</p><div class="mt-5">${gcashDetailsMarkup(rows, p.deposit, "Open GCash, scan the QR or use the account details above, and pay the exact amount. After the transfer succeeds, upload your receipt below and submit.")}</div><div class="tile mt-5">${receiptUploadMarkup("Your booking is submitted together with this receipt. The owner checks the receipt against the actual GCash transaction.")}${pendingBookingNotice()}${FORM_ERROR_MARKUP}<div class="wizard-actions"><button class="btn" onclick="wizardStep=4;render()">${icon("arrow-left")}Back</button><button class="btn btn-primary" id="submitBookingButton" onclick="submitBooking()">${icon("upload")}Submit Booking and Receipt</button></div></div>`;
}
function booking() {
  if (!loggedIn) {
    bookingType = null;
    return bookingChooser();
  }
  if (bookingType === "service") return serviceBooking();
  if (bookingType === "visit") return visitBooking();
  return bookingChooser();
}
function visitSuccess() {
  const v = currentServerVisit;
  if (!v)
    return `<div class="panel"><h2 class="step-title">Visitation details unavailable</h2><button class="btn btn-primary mt-4" onclick="setPage('mybookings')">Go to My Bookings</button></div>`;
  const sp = v.type === "Special";
  const details = `<div class="summary-line"><span>Reference number</span><strong>${safe(v.ref)}</strong></div><div class="summary-line"><span>Status</span><span class="badge badge-soft ${visitStatusClass(v.status)}">${safe(v.status)}</span></div><div class="summary-line"><span>Visit date</span><strong>${fmtDate(v.date, true)}</strong></div><div class="summary-line"><span>Visitors</span><strong>${v.visitors}</strong></div>`;
  const actions = `<button class="btn btn-primary" onclick="setPage('mybookings')">${icon("clipboard-list")}Track My Booking</button><button class="btn" onclick="setPage('home')">Back to Home</button>`;
  return resultPanel(
    sp ? "hourglass" : "circle-check",
    sp ? "Special date request submitted" : "Visitation booked",
    sp ? "The admin will review your request. The visit is not confirmed until the request is approved." : "Your farm visit is booked. You can track it in My Bookings.",
    details,
    actions,
  );
}
function visitStatusClass(s) {
  if (["Booked", "Approved", "Completed"].includes(s)) return "badge-success";
  if (["Declined", "Cancelled"].includes(s)) return "badge-error";
  return "badge-warning";
}
function visitBooking() {
  let stepContent = visitReviewStep();
  if (visitStep === 1) stepContent = visitDateStep();
  else if (visitStep === 2) stepContent = visitDetailsStep();
  return `${pageHead(["Home", "Bookings", "Book a Visitation"], "Book a Visitation", "Visit the farm with 1–5 visitors on an available Saturday or Sunday.", `<button class="btn btn-ghost btn-sm" onclick="changeBookingType()">${icon("arrow-left")}Change booking type</button>`)}${wizardHeader(["Date", "Details", "Review"], visitStep)}<div class="panel mt-0">${stepContent}</div>`;
}
function visitDateStep() {
  if (visitMode === "special")
    return `<h2 class="step-title">Request a special date</h2><p class="muted">Use this for a date outside the regular weekend schedule, such as a weekday or a closed weekend. The admin reviews every request, and the visit is not confirmed until it is approved.</p><div class="field-grid"><div class="field"><label for="specialDate">Requested date</label><input class="input w-full" id="specialDate" type="date" min="${TOMORROW_ISO}" value="${safe(visitDate)}" onchange="visitDate=this.value"></div><div class="field"><label for="specialReason">Reason for this date</label><input class="input w-full" id="specialReason" maxlength="160" value="${safe(visitReason)}" placeholder="e.g. Only available on weekdays" oninput="visitReason=this.value"></div></div><div class="wizard-actions"><button class="btn" onclick="setVisitMode('regular')">${icon("arrow-left")}Back to weekend calendar</button><button class="btn btn-primary" onclick="visitToDetails()">Continue to Details${icon("arrow-right")}</button></div>`;
  return `<h2 class="step-title">Select a visit date</h2><p class="muted">Farm visits are open on available Saturdays and Sundays. Calendar availability is managed by the farm.</p><div class="cal-wrap mt-5">${calendarBlock("visit")}<div class="space-y-4"><div class="tile"><h3 class="tile-title">${icon("calendar-check", "size-4 text-primary")}Selected date</h3><p class="text-lg font-semibold">${visitDate ? fmtDate(visitDate, true) : '<span class="muted text-base font-normal">Choose an available green date</span>'}</p></div><div class="notice flex items-center gap-2">${icon("users", "size-4 text-primary")}Each visit is for 1–5 visitors.</div><div class="tile"><h3 class="tile-title">Need a different date?</h3><p class="muted text-sm">Dates outside the regular weekend schedule need admin review.</p><button class="btn btn-sm mt-3" onclick="setVisitMode('special')">${icon("calendar-plus")}Request a special date</button></div></div></div><div class="wizard-actions"><button class="btn" onclick="changeBookingType()">${icon("arrow-left")}Back</button><button class="btn btn-primary" onclick="visitToDetails()">Continue to Details${icon("arrow-right")}</button></div>`;
}
function setVisitMode(m) {
  visitMode = m;
  visitDate = "";
  render();
}
function isRegularOpen(iso) {
  let dt = new Date(iso + "T12:00:00"),
    w = dt.getDay() === 0 || dt.getDay() === 6;
  return w && iso > TODAY_ISO && !blockedDates.visit.has(iso);
}
function visitToDetails() {
  if (visitMode === "special") {
    let v = document.getElementById("specialDate")?.value || visitDate,
      r = (
        document.getElementById("specialReason")?.value || visitReason
      ).trim();
    if (!v) {
      alert("Choose the date you want to request.");
      return;
    }
    if (v <= TODAY_ISO) {
      alert("Choose a future date.");
      return;
    }
    if (isRegularOpen(v)) {
      alert(
        "That date is on the regular schedule. Pick it from the weekend calendar instead.",
      );
      return;
    }
    if (!r) {
      alert("Tell us why you need a special date.");
      return;
    }
    visitDate = v;
    visitReason = r;
  } else if (!visitDate || blockedDates.visit.has(visitDate)) {
    visitDate = "";
    alert("Please choose an available Saturday or Sunday.");
    render();
    return;
  }
  visitStep = 2;
  render();
}
function visitDetailsStep() {
  let d = visitDraft;
  const specialRequest = visitMode === "special" ? " (special date request)" : "";
  const visitorOptions = [1, 2, 3, 4, 5].map((count) => {
    const selected = Number(d.visitors || 1) === count ? "selected" : "";
    return `<option value="${count}" ${selected}>${count}</option>`;
  }).join("");
  return `<h2 class="step-title">Visitor details</h2><div class="notice mt-3 flex items-center gap-2">${icon("calendar", "size-4 text-primary")}<span>Visit date: <strong>${fmtDate(visitDate, true)}</strong>${specialRequest}</span></div><div class="field-grid"><div class="field"><label for="vName">Full name</label><input class="input w-full" id="vName" value="${safe(d.name || sessionCustomerName())}" placeholder="Full name" autocomplete="name"></div><div class="field"><label for="vEmail">Email</label><input class="input w-full" id="vEmail" type="email" value="${safe(d.email || sessionCustomer?.email || "")}" placeholder="you@example.com" autocomplete="email"></div><div class="field"><label for="vPhone">Contact number</label><input class="input w-full" id="vPhone" type="tel" value="${safe(d.phone || sessionCustomer?.phoneNumber || "")}" placeholder="09XX XXX XXXX" autocomplete="tel"></div><div class="field"><label for="vFarm">Farm name (optional)</label><input class="input w-full" id="vFarm" value="${safe(d.farm || "")}" placeholder="Your farm, if you have one"></div><div class="field"><label for="vVisitors">Number of visitors (maximum 5)</label><select class="select w-full" id="vVisitors">${visitorOptions}</select></div></div><div class="wizard-actions"><button class="btn" onclick="readVisit();visitStep=1;render()">${icon("arrow-left")}Back</button><button class="btn btn-primary" onclick="visitToReview()">Continue to Review${icon("arrow-right")}</button></div>`;
}
function readVisit() {
  if (!document.getElementById("vName")) return;
  visitDraft = {
    name: V("vName"),
    email: V("vEmail"),
    phone: V("vPhone"),
    farm: V("vFarm"),
    visitors: Math.min(5, Math.max(1, Number(V("vVisitors")) || 1)),
  };
}
function visitToReview() {
  readVisit();
  let d = visitDraft;
  if (!d.name || !d.phone) {
    alert("Please enter your name and contact number.");
    return;
  }
  const emailField = document.getElementById("vEmail");
  if (!emailField?.validity.valid) {
    alert("Please enter a valid email address.");
    return;
  }
  visitStep = 3;
  render();
}
function visitReviewStep() {
  let d = visitDraft,
    sp = visitMode === "special";
  const heading = sp ? "special date request" : "visitation";
  const requestDetails = sp
    ? `<div class="summary-line"><span>Request type</span><strong>Special date (admin review)</strong></div><div class="summary-line"><span>Reason</span><strong>${safe(visitReason)}</strong></div>`
    : "";
  const notice = sp
    ? "This date is outside the regular schedule. The admin will review your request before the visit is confirmed."
    : "Your visit will be booked for this date when you submit.";
  const submitLabel = sp
    ? "Submit Special Date Request"
    : "Submit Visitation Booking";
  return `<h2 class="step-title">Review your ${heading}</h2><p class="muted">Check the date and your information before submitting.</p><div class="tile mt-5"><div class="summary-line"><span>Visit date</span><strong>${fmtDate(visitDate, true)}</strong></div>${requestDetails}<div class="summary-line"><span>Name</span><strong>${safe(d.name)}</strong></div><div class="summary-line"><span>Email</span><strong>${safe(d.email)}</strong></div><div class="summary-line"><span>Contact number</span><strong>${safe(d.phone)}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(d.farm || "Not provided")}</strong></div><div class="summary-line"><span>Number of visitors</span><strong>${d.visitors}</strong></div><div class="notice mt-4">${notice}</div></div>${FORM_ERROR_MARKUP}<div class="wizard-actions"><button class="btn" onclick="visitStep=2;render()">${icon("arrow-left")}Back</button><button class="btn btn-primary" id="submitVisitButton" onclick="submitVisit()">${icon("send")}${submitLabel}</button></div>`;
}
async function submitVisit() {
  if (submitting) return;
  const d = visitDraft,
    sp = visitMode === "special";
  if (!sp && blockedDates.visit.has(visitDate)) {
    alert("That date has just been closed. Please choose another date.");
    visitDate = "";
    visitStep = 1;
    render();
    return;
  }
  submitting = true;
  clearFormError();
  setButtonBusy("submitVisitButton", true, "Submitting…");
  try {
    const { visit } = await bookingApiRequest("/api/visitation-bookings", {
      method: "POST",
      body: JSON.stringify({
        visitType: sp ? "Special" : "Regular",
        visitDate,
        specialRequestReason: sp ? visitReason : undefined,
        visitorCount: Number(d.visitors),
        farmName: d.farm || "",
        customerName: d.name,
        customerEmail: d.email,
        customerPhone: d.phone,
      }),
    });
    currentServerVisit = toCustomerVisit(visit);
    customerBookingsState = "idle";
    successKind = "visit";
    bookingType = null;
    visitStep = 1;
    visitMode = "regular";
    visitDate = "";
    visitReason = "";
    visitDraft = {};
    submitting = false;
    setPage("success");
  } catch (error) {
    // Keep the review step and entered details so the customer can retry.
    submitting = false;
    setButtonBusy("submitVisitButton", false);
    showFormError(error instanceof Error ? error.message : "Unable to submit your visitation.");
  }
}
function adminCalendar() {
  const kind = calKind;
  const closedDates = [...blockedDates[kind]].sort((a, b) =>
    a.localeCompare(b),
  );
  const serviceClass = kind === "service" ? "btn-active btn-primary" : "btn-ghost";
  const visitClass = kind === "visit" ? "btn-active btn-primary" : "btn-ghost";
  const closedMarkup = closedDates.length
    ? closedDates.map((date) =>
      `<div class="summary-line"><span>${fmtDate(date)}</span><button class="btn btn-sm" onclick="toggleBlock('${kind}','${date}')">Reopen</button></div>`,
    ).join("")
    : '<p class="muted">No closed dates.</p>';
  return `${sampleDataNotice("Closing or reopening dates here only changes this browser's view. It is not saved and does not change which dates the server accepts for bookings.")}<div class="panel"><div class="admin-header"><div><h3>Calendar Controls</h3><p class="muted">Open or close weekend dates. Customers can select only open dates.</p></div><div class="pill-row"><button class="btn ${serviceClass} btn-sm" onclick="setCalKind('service')">Package service calendar</button><button class="btn ${visitClass} btn-sm" onclick="setCalKind('visit')">Visitation calendar</button></div></div><div class="cal-wrap mt-5">${calendarBlock(kind, "admin")}<div><div class="tile"><h3>Closed dates</h3>${closedMarkup}</div></div></div><div class="notice" style="margin-top:16px">Click a weekend date to close or reopen it. Past dates cannot be changed. Closing a date does not cancel existing bookings.</div></div>`;
}
function pkgCardPublic(x) {
  const featured = x.featured ? `<span class="pkg-badge badge badge-secondary gap-1">${icon("star", "size-3")}Most popular</span>` : "";
  return `<article class="pkg-card"><div class="pkg-media">${pkgImg(x)}${featured}</div><div class="pkg-body"><h3>${safe(x.name)}</h3><p class="pkg-desc">${safe(x.description)}</p>${pkgChips(safe(x.layers), safe(x.dimensions))}${inclusionList(x)}<div class="pkg-foot"><div class="price-big"><small>Package price</small>${money(x.price)}</div><button class="btn btn-primary" onclick="choosePkgById('${x.id}')">Choose${icon("arrow-right")}</button></div></div></article>`;
}
function pkgCardCustom() {
  return `<article class="pkg-card custom"><div class="pkg-media"><span class="pkg-placeholder">${icon("ruler", "size-14")}</span></div><div class="pkg-body"><h3>Custom Pond Design</h3><p class="pkg-desc">None of the packages fit? Choose 1–3 layers, enter your pond’s width and length, and decide on filtration.</p>${pkgChips("Up to 3 layers", "Your own size")}<div class="pkg-foot"><div class="price-big"><small>Price from your size</small>${money(pondRatePerSqmPerLayer)}<small>per m² per layer</small></div><button class="btn btn-primary" onclick="choosePkgById('custom')">Design${icon("arrow-right")}</button></div></div></article>`;
}
function shop() {
  const act = activePackages();
  const status = packageCatalogStatusMarkup();
  const empty =
    !status && !act.length
      ? `<div class="notice mt-5">No predefined packages are available right now. You can still book a Custom Pond Design.</div>`
      : "";
  const cards = status ? "" : act.map(pkgCardPublic).join("") + pkgCardCustom();
  const pricing = [
    ["ruler", "Custom pond price", `Width × length × ${money(pondRatePerSqmPerLayer)} per m² per layer, plus ${money(filtrationEstimate)} if filtration is selected.`],
    ["smartphone", "50% down payment", "You pay 50% when you book. Your booking is confirmed once the owner verifies that payment."],
    ["truck", "Delivery & balance", "After the service is done, the owner adds any Lalamove delivery fee and you pay the remaining balance."],
  ];
  const pricingMarkup = pricing
    .map(([name, title, text]) => `<div class="flex gap-3"><span class="icon-chip shrink-0">${icon(name, "size-5")}</span><div><h3 class="font-semibold">${title}</h3><p class="muted mt-1 text-sm leading-relaxed">${text}</p></div></div>`)
    .join("");
  return `${pageHead(["Home", "Shop"], "Shop", "Browse the owner’s predefined pond packages, each with one included freebie. Choose one option per booking, or design your own pond.")}${status}${empty}<div class="pkg-grid">${cards}</div><section class="panel mt-8" aria-labelledby="pricingTitle"><h2 id="pricingTitle" class="section-title text-2xl">How pricing works</h2><div class="mt-5 grid gap-6 md:grid-cols-3">${pricingMarkup}</div></section>`;
}

function pkgCardSelect(x, custom) {
  const selected = custom ? isCustomPond() : selectedPackageCode === x.id;
  const id = custom ? "custom" : x.id;
  const name = custom ? "Custom Pond Design" : x.name;
  const cardClass = custom ? "pkg-card is-selectable custom" : "pkg-card is-selectable";
  const selectedClass = selected ? " selected" : "";
  const media = custom ? `<span class="pkg-placeholder">${icon("ruler", "size-14")}</span>` : pkgImg(x);
  const featuredBadge =
    !custom && x.featured
      ? `<span class="pkg-badge badge badge-secondary gap-1">${icon("star", "size-3")}Most popular</span>`
      : "";
  const selectedBadge = selected ? `<span class="pkg-tick">${icon("check", "size-4")}</span>` : "";
  const description = custom
    ? "Build your own pond: layers, size and filtration."
    : safe(x.description);
  let packageDetails = pkgChips("Up to 3 layers", "Your own size");
  if (!custom) {
    packageDetails = `${pkgChips(safe(x.layers), safe(x.dimensions))}${inclusionList(x)}`;
  }
  const priceLabel = custom ? "Price from your size" : "Package price";
  const price = custom ? "Computed" : money(x.price);
  const selectionLabel = selected
    ? '<span class="badge badge-success">Selected</span>'
    : '<span class="badge badge-ghost">Tap to select</span>';
  return `<div class="${cardClass}${selectedClass}" role="button" tabindex="0" aria-pressed="${selected}" onclick="pickPkg('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pickPkg('${id}')}"><div class="pkg-media">${media}${featuredBadge}${selectedBadge}</div><div class="pkg-body"><h3>${safe(name)}</h3><p class="pkg-desc">${description}</p>${packageDetails}<div class="pkg-foot"><div class="price-big"><small>${priceLabel}</small>${price}</div>${selectionLabel}</div></div></div>`;
}
function packageStep() {
  const status = packageCatalogStatusMarkup();
  if (status) {
    return `<h2 class="step-title">Choose one service option</h2>${status}<div class="wizard-actions"><button class="btn" onclick="changeBookingType()">${icon("arrow-left")}Back</button></div>`;
  }
  const predefined = selectedPondPackage();
  const packageCards = activePackages()
    .map((item) => pkgCardSelect(item, false))
    .join("") + pkgCardSelect(null, true);
  let pondOptions = "";
  if (isCustomPond()) pondOptions = customPondPanel();
  else if (predefined) pondOptions = predefinedPondPanel(predefined);
  const notes = safe(extraNotes || window.bookingDraft?.notes || "");
  return `<h2 class="step-title">Choose one service option</h2><p class="muted">Select one predefined package (each includes a freebie), or choose Custom Pond Design to set your own layers and dimensions.</p><div class="pkg-grid mt-5">${packageCards}</div>${pondOptions}<div class="field mt-6"><label for="notes">Notes for the owner (optional)</label><textarea class="textarea w-full" id="notes" placeholder="Share any other requirements..." oninput="extraNotes=this.value">${notes}</textarea></div><div class="wizard-actions"><button class="btn" onclick="changeBookingType()">${icon("arrow-left")}Back</button><button class="btn btn-primary" onclick="continueToSchedule()">Continue to Date${icon("arrow-right")}</button></div>`;
}
function customPondPanel() {
  const layerOptions = ["1 layer", "2 layers", "3 layers"].map((layer) => {
    const selected = selectedLayers === layer ? "selected" : "";
    return `<option value="${layer}" ${selected}>${layer}</option>`;
  }).join("");
  const filtrationOptions = ["Yes", "No"].map((value) => {
    const selected = filtration === value ? "selected" : "";
    const price = value === "Yes" ? ` (+ ${money(filtrationEstimate)})` : "";
    return `<option value="${value}" ${selected}>${value}${price}</option>`;
  }).join("");
  const area = (pondWidth * pondHeight).toFixed(2);
  const estimate = money(pondCustomizationEstimate());
  const rate = money(pondRatePerSqmPerLayer);
  const filtrationFee = money(filtrationEstimate);
  return `<div class="tile mt-6"><h3 class="tile-title">${icon("ruler", "size-4 text-primary")}Customize your pond</h3><p class="muted text-sm">Choose 1 to 3 layers and enter your pond’s width and length in metres. The price updates automatically.</p><div class="field-grid"><div class="field"><label for="layers">Number of pond layers (maximum 3)</label><select class="select w-full" id="layers" onchange="selectedLayers=this.value;render()">${layerOptions}</select></div><div class="field"><label for="filtration">Filtration system</label><select class="select w-full" id="filtration" onchange="filtration=this.value;render()">${filtrationOptions}</select></div><div class="field"><label for="pondWidth">Width (metres)</label><input class="input w-full" id="pondWidth" type="number" min="1" max="10" step="0.5" value="${pondWidth}" oninput="pondWidth=Math.min(10,Math.max(1,Number(this.value)||1));updatePondEstimate()" onchange="pondWidth=Math.min(10,Math.max(1,Number(this.value)||1));this.value=pondWidth;updatePondEstimate()"></div><div class="field"><label for="pondHeight">Length (metres)</label><input class="input w-full" id="pondHeight" type="number" min="1" max="10" step="0.5" value="${pondHeight}" oninput="pondHeight=Math.min(10,Math.max(1,Number(this.value)||1));updatePondEstimate()" onchange="pondHeight=Math.min(10,Math.max(1,Number(this.value)||1));this.value=pondHeight;updatePondEstimate()"></div></div><div class="mt-4 grid gap-3 sm:grid-cols-2"><div class="rounded-field bg-base-200 px-4 py-3"><p class="muted text-xs">Pond area</p><p class="text-lg font-semibold" id="pondArea">${area} m²</p></div><div class="rounded-field bg-primary/10 px-4 py-3"><p class="muted text-xs">Custom pond price</p><p class="text-lg font-bold text-primary" id="pondEstimate" aria-live="polite">${estimate}</p></div></div><p class="muted mt-3 text-xs">Formula: width × length × ${rate} per m² per layer, plus ${filtrationFee} if filtration is selected.</p></div>`;
}
function predefinedPondPanel(predefined) {
  const name = safe(predefined.name);
  const layers = safe(predefined.layers);
  const dimensions = safe(predefined.dimensions);
  const freebie = safe(predefined.freebie);
  return `<div class="tile mt-6"><h3 class="tile-title">${icon("package", "size-4 text-primary")}${name} details</h3><div class="summary-line"><span>Included pond configuration</span><strong>${layers} · ${dimensions}</strong></div><div class="summary-line"><span>Predefined freebie</span><strong>${freebie}</strong></div><p class="muted mt-2 text-sm">The package uses the owner’s predefined setup. For different dimensions or layers, select Custom Pond Design instead.</p></div>`;
}

function continueToSchedule() {
  if (!isCustomPond() && !selectedPondPackage()) {
    alert("Please select one service option before continuing.");
    return;
  }
  wizardStep = 2;
  render();
}
function dateStep() {
  const p = currentPricing();
  return `<h2 class="step-title">Choose your service date</h2><p class="muted">Pick your preferred date first, then enter your details. Service dates are open on weekends only. Calendar availability is managed by the farm.</p><div class="cal-wrap mt-5">${calendarBlock("service")}<div class="space-y-4"><div class="tile"><h3 class="tile-title">${icon("calendar-check", "size-4 text-primary")}Selected date</h3><p class="text-lg font-semibold">${selectedDate ? fmtDate(selectedDate, true) : '<span class="muted text-base font-normal">Choose an available green date</span>'}</p></div><div class="notice">Choose any open weekend date. Closed dates cannot be selected. Your date is reserved once your 50% down payment is verified.</div><div class="tile"><h3 class="tile-title">${icon("package", "size-4 text-primary")}Your option</h3><p class="font-semibold">${safe(selectedPackageName())}</p><p class="muted text-sm">${money(p.total)} · 50% down payment ${money(p.deposit)}</p></div></div></div><div class="wizard-actions"><button class="btn" onclick="wizardStep=1;render()">${icon("arrow-left")}Back</button><button class="btn btn-primary" onclick="goDetails()">Continue to Details${icon("arrow-right")}</button></div>`;
}
function goDetails() {
  if (!selectedDate || blockedDates.service.has(selectedDate)) {
    selectedDate = "";
    alert("Please choose an available weekend date.");
    render();
    return;
  }
  wizardStep = 3;
  render();
}
function detailsStep() {
  const d = window.bookingDraft || {};
  return `<h2 class="step-title">Your details</h2><div class="notice mt-3 flex flex-wrap items-center justify-between gap-3"><span class="flex items-center gap-2">${icon("calendar", "size-4 text-primary")}<span>Service date: <strong>${selectedDate ? fmtDate(selectedDate, true) : "Not selected"}</strong> · ${safe(selectedPackageName())}</span></span><button class="btn btn-sm" onclick="readDetails();wizardStep=2;render()">Change date</button></div><div class="field-grid"><div class="field"><label for="customerName">Full name</label><input class="input w-full" id="customerName" value="${safe(d.name || sessionCustomerName())}" placeholder="Full name" autocomplete="name"></div><div class="field"><label for="phone">Contact number</label><input class="input w-full" id="phone" type="tel" value="${safe(d.phone || sessionCustomer?.phoneNumber || "")}" placeholder="09XX XXX XXXX" autocomplete="tel"></div><div class="field"><label for="email">Email (optional)</label><input class="input w-full" id="email" type="email" value="${safe(d.email || sessionCustomer?.email || "")}" placeholder="you@example.com" autocomplete="email"></div><div class="field"><label for="location">Service location</label><input class="input w-full" id="location" value="${safe(d.location || "")}" placeholder="Complete service address" autocomplete="street-address"></div></div><div class="wizard-actions"><button class="btn" onclick="readDetails();wizardStep=2;render()">${icon("arrow-left")}Back</button><button class="btn btn-primary" onclick="goReview()">Continue to Review${icon("arrow-right")}</button></div>`;
}
function goReview() {
  readDetails();
  const d = window.bookingDraft || {};
  if (!selectedDate || blockedDates.service.has(selectedDate)) {
    selectedDate = "";
    alert("Please choose an available weekend date.");
    wizardStep = 2;
    render();
    return;
  }
  if (!d.name || !d.phone || !d.location) {
    alert("Please enter your name, contact number, and service location.");
    return;
  }
  userName = d.name;
  wizardStep = 4;
  render();
}
function goPayment() {
  if (!policyAccepted) {
    alert("Please accept the no-refund policy to continue.");
    return;
  }
  wizardStep = 5;
  render();
}
function readBookingPayment() {
  const reference = document.getElementById("gcashReference")?.value.trim();
  const file = document.getElementById("gcashProof")?.files?.[0];
  if (!reference) {
    alert("Enter the GCash transaction reference number.");
    return null;
  }
  if (!file) {
    alert("Please upload your GCash receipt or payment screenshot.");
    return null;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("Please upload a receipt smaller than 8 MB.");
    return null;
  }
  return { reference, file };
}
function bookingDetailsAreComplete(details) {
  if (!selectedDate || !details.name || !details.phone || !details.location) {
    alert(
      "Some booking details are missing. Go back and complete the Date and Details steps.",
    );
    return false;
  }
  if (!policyAccepted) {
    alert("Please accept the no-refund policy first.");
    return false;
  }
  return true;
}
function serviceBookingPayload(details) {
  const preset = selectedPondPackage();
  const custom = isCustomPond();
  return {
    serviceType: custom ? "Custom Pond Design" : "Pond Package",
    packageId: custom ? undefined : preset?.id,
    customConfiguration: custom
      ? {
          layers: Number.parseInt(selectedLayers, 10) || 1,
          width: Number(pondWidth),
          length: Number(pondHeight),
          filtration: filtration === "Yes",
        }
      : undefined,
    serviceDate: selectedDate,
    serviceLocation: details.location,
    notes: details.notes || "",
    customerName: details.name,
    customerPhone: details.phone,
    customerEmail: details.email || "",
  };
}
function pendingBookingNotice() {
  if (!pendingServiceBooking) return "";
  return `<div class="notice mt-4">Booking <strong>${safe(pendingServiceBooking.reference)}</strong> has been saved and accepted. Submit your receipt below to finish. Your 50% down payment is <strong>${money(r2(pendingServiceBooking.depositAmount - pendingServiceBooking.paidAmount))}</strong>.</div>`;
}
function resetServiceWizard() {
  pendingServiceBooking = null;
  bookingType = null;
  wizardStep = 1;
  selectedDate = "";
  policyAccepted = false;
  extraNotes = "";
  window.bookingDraft = null;
}
/**
 * Creates the booking, uploads the receipt, and submits the 50% deposit.
 * If the receipt step fails after the booking was saved, a retry reuses that
 * booking instead of creating a duplicate.
 */
async function submitBooking() {
  if (submitting) return;
  const details = window.bookingDraft || {};
  if (!bookingDetailsAreComplete(details)) return;
  const payment = readBookingPayment();
  if (!payment) return;
  submitting = true;
  clearFormError();
  setButtonBusy("submitBookingButton", true, "Submitting…");
  try {
    if (!pendingServiceBooking) {
      const created = await bookingApiRequest("/api/service-bookings", {
        method: "POST",
        body: JSON.stringify(serviceBookingPayload(details)),
      });
      pendingServiceBooking = created.booking;
    }
    let result;
    try {
      result = await submitServerPayment(pendingServiceBooking, "deposit", payment);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The receipt could not be submitted.";
      throw new Error(
        `Your booking ${pendingServiceBooking.reference} was saved, but the receipt was not submitted: ${message} You can try again here or from My Bookings.`,
      );
    }
    currentServerBooking = toCustomerBooking({
      ...result.booking,
      payments: [result.payment],
    });
    customerBookingsState = "idle";
    successKind = "service";
    resetServiceWizard();
    submitting = false;
    setPage("success");
  } catch (error) {
    submitting = false;
    setButtonBusy("submitBookingButton", false);
    // Re-render only to show the saved-booking notice when one was created;
    // otherwise keep the page so the entered reference and file remain.
    showFormError(error instanceof Error ? error.message : "Unable to submit your booking.");
    const notice = document.getElementById("formError");
    if (pendingServiceBooking && notice && !document.querySelector("[data-pending-booking]")) {
      notice.insertAdjacentHTML(
        "beforebegin",
        `<div data-pending-booking>${pendingBookingNotice()}</div>`,
      );
    }
  }
}
function serviceBooking() {
  if (!isCustomPond() && !selectedPondPackage())
    selectedPackageCode = activePackages()[0]?.id || CUSTOM_POND_CODE;
  let stepContent = paymentStep();
  if (wizardStep === 1) stepContent = packageStep();
  else if (wizardStep === 2) stepContent = dateStep();
  else if (wizardStep === 3) stepContent = detailsStep();
  else if (wizardStep === 4) stepContent = reviewStep();
  return `${pageHead(["Home", "Bookings", "Book a Service"], "Book a Service", "Choose a package, pick your date, enter your details, review, then pay the 50% down payment.", `<button class="btn btn-ghost btn-sm" onclick="changeBookingType()">${icon("arrow-left")}Change booking type</button>`)}${wizardHeader(["Package", "Date", "Details", "Review", "Payment"], wizardStep)}<div class="panel mt-0">${stepContent}</div>`;
}

function success() {
  if (successKind === "visit") return visitSuccess();
  const b = currentServerBooking;
  if (!b)
    return `<div class="panel"><h2 class="step-title">Booking details unavailable</h2><button class="btn btn-primary mt-4" onclick="setPage('mybookings')">Go to My Bookings</button></div>`;
  const details = `<div class="summary-line"><span>Reference number</span><strong>${safe(b.ref)}</strong></div><div class="summary-line"><span>Booking status</span><span class="badge badge-soft ${bookingClass(b.booking)}">${safe(b.booking)}</span></div><div class="summary-line"><span>Payment status</span><span class="badge badge-soft ${payClass(b.payment)}">${safe(b.payment)}</span></div><div class="summary-line"><span>Package</span><strong>${safe(b.pkg)}</strong></div><div class="summary-line"><span>Service date</span><strong>${safe(b.date)}</strong></div><div class="summary-line"><span>50% down payment submitted</span><strong>${money(b.proof ? b.deposit : 0)}</strong></div><div class="summary-line"><span>Remaining balance (due after service)</span><strong>${money(r2(b.total - b.deposit))}</strong></div>`;
  const actions = `<button class="btn btn-primary" onclick="setPage('mybookings')">${icon("clipboard-list")}Track My Booking</button><button class="btn" onclick="setPage('home')">Back to Home</button>`;
  return resultPanel(
    "circle-check",
    "Booking submitted",
    "Your booking has been accepted. Your receipt is now waiting for the owner to verify it against the actual GCash transaction. Your booking is <strong>confirmed once your 50% down payment is verified</strong>, and you will see the update in My Bookings.",
    details,
    actions,
  );
}

function customerBookingCard(b) {
  const t = customerCanPay(b),
    paidLbl =
      b.paidAmount > 0 ? "Outstanding balance" : "Balance after down payment";
  const deliveryFee =
    b.deliveryFee != null
      ? money(b.deliveryFee)
      : "Added by owner after the service";
  const deliveryNote =
    b.deliveryFee == null
      ? ' <span class="muted font-normal">+ delivery</span>'
      : "";
  const proofMarkup = b.proof
    ? `<div class="summary-line"><span>Submitted reference · file</span><strong>${safe(b.proof.reference)} · ${safe(b.proof.fileName)}</strong></div>`
    : "";
  let depositLabel = "Pay 50% down payment";
  if (b.payment === "Rejected") {
    depositLabel = "Resubmit down payment receipt";
  }
  let balanceLabel = "Pay outstanding balance · " + money(b.balance);
  if (b.payment === "Rejected") {
    balanceLabel = "Resubmit balance receipt";
  }
  const depositButton =
    t === "deposit"
      ? `<button class="btn btn-primary btn-sm" onclick="openCustomerPayment('${b.ref}','deposit')">${icon("wallet")}${depositLabel}</button>`
      : "";
  const balanceButton =
    t === "balance"
      ? `<button class="btn btn-primary btn-sm" onclick="openCustomerPayment('${b.ref}','balance')">${icon("wallet")}${balanceLabel}</button>`
      : "";
  return `<article class="tile booking-card"><div class="admin-header"><div class="min-w-0"><p class="muted text-xs font-medium">${b.ref} · Service date ${safe(b.date)}</p><h3 class="mt-1 text-lg font-semibold">${safe(b.pkg)}</h3></div><div class="flex flex-wrap gap-1.5"><span class="badge badge-soft ${bookingClass(b.booking)}">Booking: ${safe(b.booking)}</span><span class="badge badge-soft ${payClass(b.payment)}">Payment: ${safe(b.payment)}</span></div></div>${tracker(b, customerStage(b))}<div class="notice">${safe(customerMessage(b))}</div><div class="mt-3 grid gap-x-8 md:grid-cols-2"><div><div class="summary-line"><span>Service location</span><strong>${safe(b.location || "Not specified")}</strong></div><div class="summary-line"><span>Package / customization</span><strong>${money(Number(b.servicePrice) + Number(b.customizationFee || 0))}</strong></div><div class="summary-line"><span>Delivery fee</span><strong>${deliveryFee}</strong></div></div><div><div class="summary-line"><span>Total</span><strong>${money(b.total)}${deliveryNote}</strong></div><div class="summary-line"><span>Verified amount paid</span><strong>${money(b.paidAmount || 0)}</strong></div><div class="summary-line is-highlight"><span>${paidLbl}</span><strong>${money(b.balance)}</strong></div></div></div>${proofMarkup}<div class="mt-4 flex flex-wrap gap-2"><button class="btn btn-sm" onclick="viewBooking('${b.ref}')">${icon("eye")}View details & updates</button>${depositButton}${balanceButton}</div></article>`;
}
function freshUpdatesMarkup(fresh) {
  if (!fresh.length) return "";
  const items = fresh
    .map(
      (update) =>
        `<li><p><strong>${safe(update.b.pkg)} (${update.b.ref}):</strong> ${safe(update.e.text)}</p><time>${safe(update.e.at)}</time></li>`,
    )
    .join("");
  const updateLabel = fresh.length === 1 ? "update" : "updates";
  return `<div class="callout mt-5"><p class="flex items-center gap-2 font-semibold">${icon("bell", "size-5 text-warning")}${fresh.length} new ${updateLabel}</p><ul class="updates mt-3">${items}</ul></div>`;
}
function visitCard(v) {
  const typeLabel =
    v.type === "Special" ? "Special date request" : "Regular schedule";
  const reasonMarkup = v.reason
    ? `<div class="summary-line"><span>Reason for special date</span><strong>${safe(v.reason)}</strong></div>`
    : "";
  return `<article class="tile booking-card"><div class="admin-header"><div class="min-w-0"><p class="muted text-xs font-medium">${v.ref} · ${typeLabel}</p><h3 class="mt-1 text-lg font-semibold">${fmtDate(v.date, true)}</h3></div><span class="badge badge-soft ${visitStatusClass(v.status)}">${safe(v.status)}</span></div><div class="mt-3"><div class="summary-line"><span>Visitors</span><strong>${v.visitors}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(v.farm || "Not provided")}</strong></div><div class="summary-line"><span>Contact</span><strong>${safe(v.phone)} · ${safe(v.email)}</strong></div>${reasonMarkup}</div></article>`;
}
function mybookings() {
  const header = pageHead(["Customer Portal", "My Bookings"], "My Bookings", "Follow each booking from submission to final payment. Booking status and payment status are tracked separately.", `<button class="btn btn-primary" onclick="startBooking()">${icon("plus")}New Booking</button>`);
  if (customerBookingsState === "loading" || customerBookingsState === "idle") {
    return `${header}<div class="space-y-4" aria-busy="true"><span class="sr-only" role="status">Loading your bookings…</span><div class="skeleton h-48 w-full"></div><div class="skeleton h-48 w-full"></div></div>`;
  }
  if (customerBookingsState === "error") {
    return `${header}<div class="alert alert-error alert-soft" role="alert">${icon("circle-alert", "size-5")}<span>${safe(customerBookingsError)}</span><button class="btn btn-sm" onclick="customerBookingsState='idle';render()">${icon("refresh-cw")}Try again</button></div>`;
  }
  const mine = myBookingList(),
    myVisits = customerVisits,
    fresh = [];
  mine.forEach((b) =>
    (b.timeline || [])
      .filter((e) => !e.seen)
      .forEach((e) => fresh.push({ b, e })),
  );
  const bookingMarkup =
    mine.map(customerBookingCard).join("") ||
    `<div class="empty">${icon("inbox", "size-8 mx-auto mb-2 text-base-content/40")}<p>No service bookings yet.</p><button class="btn btn-primary btn-sm mt-4" onclick="chooseBookingType('service')">Book a service</button></div>`;
  const visitMarkup =
    myVisits.map(visitCard).join("") ||
    `<div class="empty">${icon("trees", "size-8 mx-auto mb-2 text-base-content/40")}<p>No visitations yet.</p><button class="btn btn-sm mt-4" onclick="chooseBookingType('visit')">Plan a farm visit</button></div>`;
  return `${header}<div class="flex flex-wrap items-center gap-2"><span class="badge badge-ghost gap-1.5 py-3">${icon("user", "size-3.5")}Signed in as ${safe(sessionCustomerName())}</span><span class="badge badge-ghost py-3">${mine.length} service booking${mine.length === 1 ? "" : "s"}</span><span class="badge badge-ghost py-3">${myVisits.length} visitation${myVisits.length === 1 ? "" : "s"}</span></div>${freshUpdatesMarkup(fresh)}<section aria-labelledby="serviceBookingsTitle"><h2 id="serviceBookingsTitle" class="section-title mt-10 mb-4 text-2xl">Service bookings</h2><div class="space-y-4">${bookingMarkup}</div></section><section aria-labelledby="visitsTitle"><h2 id="visitsTitle" class="section-title mt-10 mb-4 text-2xl">Farm visitations</h2><div class="space-y-4">${visitMarkup}</div></section><div class="notice mt-8 flex items-start gap-2">${icon("shield-check", "size-4 mt-0.5 text-primary")}<span>GCash transfers happen outside this website. The owner manually verifies each transaction before any amount is recorded as received.</span></div>`;
}

function viewBooking(ref, admin, record = null) {
  const b = record || (admin ? adminBookingByRef(ref) : customerBookingByRef(ref));
  if (!b) return;
  let pondDetails = safe(b.layers || "—");
  if (b.packageLayers) {
    pondDetails = `${safe(b.packageLayers)} · ${safe(b.packageDimensions)}`;
  } else if (b.pondWidth) {
    pondDetails = `${b.pondWidth} m × ${b.pondHeight} m · ${safe(b.layers)}`;
  }
  const noticeMarkup = admin
    ? ""
    : `<div class="notice">${safe(customerMessage(b))}</div>`;
  const trackerMarkup = tracker(b, customerStage(b));
  const contactEmail = b.email ? " · " + safe(b.email) : "";
  const filtrationMarkup = b.pondWidth
    ? " · Filtration: " + safe(b.filtration)
    : "";
  const freebieMarkup = b.freebie
    ? `<div class="summary-line"><span>Freebie</span><strong>${safe(b.freebie)}</strong></div>`
    : "";
  const notesMarkup = b.notes
    ? `<div class="summary-line"><span>Notes</span><strong>${safe(b.notes)}</strong></div>`
    : "";
  const deliveryFee =
    b.deliveryFee != null ? money(b.deliveryFee) : "Not set yet";
  const payments = (b.paymentHistory || [])
    .map((payment) => {
      const targetLabel =
        payment.target === "deposit" ? "50% down payment" : "Remaining balance";
      return `<div class="summary-line"><span>${targetLabel} · ${safe(payment.verifiedAt)}</span><strong>${money(payment.amount)} · ${safe(payment.reference)}</strong></div>`;
    })
    .join("");
  let paymentHistoryMarkup = payments
    ? `<h4 class="modal-section">Verified payments</h4>${payments}`
    : "";
  if (admin) {
    const account = b.account
      ? `<div class="summary-line"><span>Customer account</span><strong>${safe(b.account.name)} · ${safe(b.account.email || "—")}${b.account.active ? "" : " (inactive)"}</strong></div>`
      : "";
    paymentHistoryMarkup = `${account}<h4 class="modal-section">Payment records</h4>${adminPaymentRecordsMarkup(b)}`;
  }
  const body = `<div class="flex flex-wrap gap-1.5"><span class="badge badge-soft ${bookingClass(b.booking)}">Booking: ${safe(b.booking)}</span><span class="badge badge-soft ${payClass(b.payment)}">Payment: ${safe(b.payment)}</span></div>${trackerMarkup}${noticeMarkup}<h4 class="modal-section">Booking</h4><div class="summary-line"><span>Customer</span><strong>${safe(b.name)}</strong></div><div class="summary-line"><span>Contact</span><strong>${safe(b.phone || "—")}${contactEmail}</strong></div><div class="summary-line"><span>Service location</span><strong>${safe(b.location || "—")}</strong></div><div class="summary-line"><span>Service date</span><strong>${safe(b.date)}</strong></div><div class="summary-line"><span>Pond</span><strong>${pondDetails}${filtrationMarkup}</strong></div>${freebieMarkup}${notesMarkup}<h4 class="modal-section">Pricing</h4><div class="summary-line"><span>Package price</span><strong>${money(b.servicePrice)}</strong></div><div class="summary-line"><span>Customization</span><strong>${money(b.customizationFee || 0)}</strong></div><div class="summary-line"><span>Delivery fee</span><strong>${deliveryFee}</strong></div><div class="summary-line"><span>Total</span><strong>${money(b.total)}</strong></div><div class="summary-line"><span>50% down payment</span><strong>${money(b.deposit)}</strong></div><div class="summary-line"><span>Verified paid</span><strong>${money(b.paidAmount || 0)}</strong></div><div class="summary-line is-highlight"><span>Outstanding balance</span><strong>${money(b.balance)}</strong></div>${paymentHistoryMarkup}<h4 class="modal-section">Status updates</h4>${timelineHtml(b, !admin)}`;
  const actions = `<button class="btn" onclick="closeModal()">Close</button>`;
  openModal(
    safe(b.pkg),
    `${b.ref}`,
    body,
    actions,
    true,
  );
  if (!admin) {
    (b.timeline || []).forEach((e) => (e.seen = true));
    updateNavBadge();
  }
}

function openCustomerPayment(ref, target) {
  const b = customerBookingByRef(ref);
  if (!b || customerCanPay(b) !== target) {
    alert(
      target === "balance"
        ? "The balance can be paid only after the service is completed and the owner has added the delivery fee."
        : "A down payment cannot be submitted for this booking right now.",
    );
    return;
  }
  paymentTargetRef = ref;
  window.paymentTarget = target;
  setPage("customerpayment");
}
function customerPaymentPage() {
  const b = customerBookingByRef(paymentTargetRef),
    target = window.paymentTarget || "deposit";
  if (!b)
    return `<div class="panel"><h2 class="step-title">Payment details unavailable</h2><button class="btn btn-primary mt-4" onclick="setPage('mybookings')">Return to My Bookings</button></div>`;
  const amount =
    target === "balance" ? b.balance : r2(b.deposit - Number(b.paidAmount || 0));
  const isBalancePayment = target === "balance";
  const pageTitle = isBalancePayment
    ? "Pay Outstanding Balance"
    : "Pay 50% Down Payment";
  const paymentType = isBalancePayment ? "Balance payment" : "Down payment";
  const paymentDetails = isBalancePayment
    ? `<div class="summary-line"><span>Package / customization</span><strong>${money(Number(b.servicePrice) + Number(b.customizationFee || 0))}</strong></div><div class="summary-line"><span>Delivery fee</span><strong>${money(b.deliveryFee || 0)}</strong></div><div class="summary-line"><span>Already paid (verified)</span><strong>${money(b.paidAmount)}</strong></div>`
    : `<div class="summary-line"><span>Total service price</span><strong>${money(b.total)}</strong></div>`;
  return `<div class="mx-auto max-w-4xl">${pageHead(["Customer Portal", "My Bookings", "GCash Payment"], pageTitle, `Booking ${safe(b.ref)} · ${safe(b.pkg)}`, `<span class="badge badge-soft badge-success">${paymentType}</span>`)}${gcashDetailsMarkup(paymentDetails, amount, "Open GCash, scan the QR or use the details above, and pay the exact amount. After the transfer succeeds, upload your receipt below.")}<div class="panel">${receiptUploadMarkup("The owner compares the reference, receipt and amount with the actual GCash transaction. You will see a status update here once it is verified.")}${FORM_ERROR_MARKUP}<div class="wizard-actions"><button class="btn" onclick="setPage('mybookings')">Cancel</button><button class="btn btn-primary" id="submitPaymentButton" onclick="submitPaymentProof('${b.ref}','${target}')">${icon("upload")}I’ve Paid — Submit Receipt</button></div></div></div>`;
}
async function submitPaymentProof(ref, target) {
  if (submitting) return;
  const b = customerBookingByRef(ref);
  if (!b) return;
  if (b.payment === "Verification Pending") {
    showFormError("A payment submission is already awaiting owner verification.");
    return;
  }
  if (customerCanPay(b) !== target) {
    showFormError("This booking is not eligible for that payment right now.");
    return;
  }
  const reference = document.getElementById("gcashReference")?.value.trim(),
    file = document.getElementById("gcashProof")?.files?.[0];
  if (!reference) {
    showFormError("Enter the GCash transaction reference number.");
    return;
  }
  if (!file) {
    showFormError("Please upload your GCash receipt or payment screenshot.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showFormError("Please upload a receipt smaller than 8 MB.");
    return;
  }
  submitting = true;
  clearFormError();
  setButtonBusy("submitPaymentButton", true, "Submitting…");
  try {
    // Use the latest server amounts rather than the cached card values.
    const { booking } = await bookingApiRequest(
      `/api/service-bookings/${encodeURIComponent(ref)}`,
    );
    await submitServerPayment(booking, target, { reference, file });
    customerBookingsState = "idle";
    submitting = false;
    toast("Receipt submitted for verification. You will see an update here once the owner has checked it.");
    setPage("mybookings");
  } catch (error) {
    submitting = false;
    setButtonBusy("submitPaymentButton", false);
    showFormError(error instanceof Error ? error.message : "Unable to submit your receipt.");
  }
}

/* =================== ADMIN =================== */
/* ---------- admin booking API ----------
   Booking, payment and visitation tabs read real records from the admin
   endpoints. Every change goes through the backend, then the data reloads. */
let adminServiceBookings = [],
  adminVisitations = [],
  adminDataState = "idle",
  adminDataError = "",
  adminActionPending = false;
const ADMIN_DATA_TABS = new Set(["overview", "bookings", "payments", "visits", "special", "sales"]);

async function fetchAllPages(path, key) {
  const items = [];
  for (let pageNumber = 1; ; pageNumber += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await bookingApiRequest(
      `${path}${separator}limit=50&page=${pageNumber}`,
    );
    items.push(...(result[key] || []));
    if (pageNumber >= (result.pagination?.totalPages || 1)) return items;
  }
}
function staffName(user) {
  return user && typeof user === "object"
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
    : "";
}
/** Maps an admin API booking onto the fields the dashboard views use. */
function toAdminBooking(server) {
  const summary =
    server.payments && !Array.isArray(server.payments) ? server.payments : null;
  let records = [];
  if (Array.isArray(server.paymentRecords)) records = server.paymentRecords;
  else if (summary?.latestPayment) records = [summary.latestPayment];
  const booking = toCustomerBooking({ ...server, payments: records });
  const account =
    server.customer_id && typeof server.customer_id === "object"
      ? server.customer_id
      : null;
  booking.account = account
    ? {
        name: staffName(account),
        email: account.email,
        phone: account.phoneNumber,
        active: account.isActive !== false,
      }
    : null;
  booking.payments = records;
  booking.pendingPayment = records.find((p) => p.status === "Pending") || null;
  return booking;
}
async function loadAdminData() {
  if (adminDataState === "loading") return;
  adminDataState = "loading";
  adminDataError = "";
  try {
    const [bookingRecords, visitRecords] = await Promise.all([
      fetchAllPages("/api/admin/service-bookings", "bookings"),
      fetchAllPages("/api/admin/visitation-bookings", "visits"),
    ]);
    adminServiceBookings = bookingRecords.map(toAdminBooking);
    adminVisitations = visitRecords.map(toAdminVisit);
    adminDataState = "loaded";
  } catch (error) {
    adminDataState = "error";
    adminDataError =
      error instanceof Error ? error.message : "Unable to load booking records.";
  }
  if (page === "admin") render();
}
function reloadAdminData() {
  adminDataState = "idle";
  return loadAdminData();
}
function adminBookingByRef(ref) {
  return adminServiceBookings.find((x) => x.ref === ref) || null;
}
/** Maps an admin API visitation onto the fields the dashboard views use. */
function toAdminVisit(server) {
  const visit = toCustomerVisit(server);
  const account =
    server.customer_id && typeof server.customer_id === "object"
      ? server.customer_id
      : null;
  visit.account = account
    ? {
        name: staffName(account),
        email: account.email,
        active: account.isActive !== false,
      }
    : null;
  visit.reviewedAt = server.reviewedAt || null;
  visit.reviewerName = staffName(server.reviewedBy);
  return visit;
}
function adminVisitByRef(ref) {
  return adminVisitations.find((x) => x.ref === ref) || null;
}
/** Loading or error panel for tabs that depend on booking records. */
function adminDataStatusPanel() {
  if (adminDataState === "error") {
    return `<div class="panel" role="alert"><h3 style="margin-top:0">Booking records could not be loaded</h3><p class="muted">${safe(adminDataError)}</p><button class="btn" onclick="reloadAdminData()">Try again</button></div>`;
  }
  if (adminDataState !== "loaded") {
    return '<div class="panel" aria-busy="true"><p class="muted" style="margin:0">Loading booking records…</p></div>';
  }
  return "";
}
async function runAdminAction(action, successMessage) {
  if (adminActionPending) return false;
  adminActionPending = true;
  try {
    await action();
    if (successMessage) toast(successMessage);
    return true;
  } catch (error) {
    alert(error instanceof Error ? error.message : "The request could not be completed.");
    return false;
  } finally {
    adminActionPending = false;
    await reloadAdminData();
  }
}
function adminBookingPath(ref) {
  return `/api/admin/service-bookings/${encodeURIComponent(ref)}`;
}
async function adminViewBooking(ref) {
  openModal("Booking details", safe(ref), '<p class="muted" aria-busy="true">Loading booking…</p>', '<button class="btn" onclick="closeModal()">Close</button>', true);
  try {
    const { booking, payments } = await bookingApiRequest(adminBookingPath(ref));
    viewBooking(ref, true, toAdminBooking({ ...booking, paymentRecords: payments }));
  } catch (error) {
    openModal("Booking details", safe(ref), `<p role="alert">${safe(error instanceof Error ? error.message : "Unable to load this booking.")}</p>`, '<button class="btn" onclick="closeModal()">Close</button>');
  }
}
function adminPaymentRecordsMarkup(b) {
  if (!b.payments?.length) return '<p class="muted">No payments submitted yet.</p>';
  return b.payments
    .map((payment) => {
      const label = payment.paymentTarget === "deposit" ? "50% down payment" : "Balance payment";
      let statusClass = "badge-warning";
      if (payment.status === "Verified") statusClass = "badge-success";
      else if (payment.status === "Rejected") statusClass = "badge-error";
      const reviewer = staffName(payment.verifiedBy);
      const reviewed = payment.verifiedAt
        ? `<div class="summary-line"><span>${payment.status === "Verified" ? "Verified" : "Reviewed"}</span><strong>${safe(serverTime(payment.verifiedAt))}${reviewer ? ` · ${safe(reviewer)}` : ""}</strong></div>`
        : "";
      const reason = payment.rejectionReason
        ? `<div class="summary-line"><span>Rejection reason</span><strong>${safe(payment.rejectionReason)}</strong></div>`
        : "";
      return `<div class="tile" style="margin:10px 0"><div class="admin-header"><strong>${label}</strong><span class="badge badge-soft ${statusClass}">${safe(payment.status)}</span></div><div class="summary-line"><span>Submitted amount · required</span><strong>${money(payment.amount)} · ${money(payment.expectedAmount)}</strong></div><div class="summary-line"><span>GCash reference</span><strong>${safe(payment.gcashReference || "—")}</strong></div><div class="summary-line"><span>Receipt file</span><strong>${safe(payment.receiptFileName)}</strong></div><div class="summary-line"><span>Submitted</span><strong>${safe(serverTime(payment.submittedAt))}</strong></div>${reviewed}${reason}<div style="margin-top:10px"><button class="btn btn-sm" onclick="viewPaymentReceipt('${b.ref}','${payment._id}')">View receipt</button></div></div>`;
    })
    .join("");
}
function adminCounts() {
  return {
    bookings: adminServiceBookings.filter((b) => nextAction(b).fn).length,
    payments: adminServiceBookings.filter(
      (b) => b.payment === "Verification Pending" && b.pendingPayment,
    ).length,
    special: adminVisitations.filter(
      (v) => v.type === "Special" && v.status === "Pending Review",
    ).length,
  };
}
function admin() {
  const c = adminCounts();
  const tabs = [
    ["g", "Overview"],
    ["overview", "Dashboard"],
    ["g", "Operations"],
    ["bookings", "Package Bookings", c.bookings],
    ["payments", "Payments", c.payments],
    ["visits", "Visitations"],
    ["special", "Special-Date Requests", c.special],
    ["g", "Schedule"],
    ["calendar", "Calendar Controls"],
    ["g", "Catalog & Content"],
    ["catalog", "Package Catalog"],
    ["faqs", "Assistant FAQs"],
    ["g", "People & Money"],
    ["customers", "Customers"],
    ["sales", "Sales Records"],
  ];
  const views = {
    overview: adminOverview,
    bookings: adminBookings,
    payments: adminPayments,
    catalog: adminCatalog,
    visits: adminVisits,
    special: adminSpecial,
    calendar: adminCalendar,
    customers: adminCustomers,
    sales: adminSales,
    faqs: adminFaqs,
  };
  const cur = tabs.find((t) => t[0] === adminTab) || ["", "Dashboard"];
  const tabMarkup = tabs.map(adminTabMarkup).join("");
  const content =
    (ADMIN_DATA_TABS.has(adminTab) && adminDataStatusPanel()) || views[adminTab]();
  return `<div class="breadcrumbs">Admin Portal / ${cur[1]}</div><div class="admin-header"><div><h1 class="page-title">Admin Dashboard</h1><p class="muted">Manage bookings, payments, visits, the calendar, packages, customers and assistant answers.</p></div></div><div class="layout" style="margin-top:20px"><aside class="sidebar">${tabMarkup}</aside><section style="min-width:0">${content}</section></div>`;
}
/** Banner for admin sections that are not connected to the database yet. */
function sampleDataNotice(detail) {
  return `<div class="notice" role="note" style="margin-bottom:14px;background:#fff6db;border-color:#ecd38a;color:#6b4e00"><strong>Sample data — not connected to the database.</strong> ${safe(detail)}</div>`;
}
function adminTabMarkup(tab) {
  if (tab[0] === "g") return `<div class="group">${tab[1]}</div>`;
  const activeClass = adminTab === tab[0] ? "active" : "";
  const countMarkup = tab[2] ? `<span class="count">${tab[2]}</span>` : "";
  return `<button class="${activeClass}" onclick="adminTab='${tab[0]}';render()">${tab[1]}${countMarkup}</button>`;
}

/* Dashboard figures from the real records. Definitions:
   - received: sum of Verified payments only (pending/rejected never count);
   - committed: bookings Confirmed or later (deposit verified);
   - still to collect: outstanding balance of committed bookings;
   - awaiting deposit: unpaid Approved bookings, reported separately;
   - active: not Rejected/Cancelled and not both Completed and fully paid. */
const COMMITTED_BOOKING_STATUSES = new Set(["Confirmed", "Ongoing", "Completed"]);
function verifiedPaymentRows() {
  return adminServiceBookings.flatMap((b) =>
    (b.payments || [])
      .filter((p) => p.status === "Verified")
      .map((p) => ({ booking: b, payment: p })),
  );
}
function sumMoney(values) {
  return r2(values.reduce((sum, value) => sum + Number(value || 0), 0));
}
function adminMoneyFigures() {
  const committed = adminServiceBookings.filter((b) => COMMITTED_BOOKING_STATUSES.has(b.booking));
  const awaitingDeposit = adminServiceBookings.filter(
    (b) => ["Pending", "Approved"].includes(b.booking) && Number(b.paidAmount || 0) < Number(b.deposit),
  );
  return {
    received: sumMoney(verifiedPaymentRows().map((row) => row.payment.amount)),
    committed,
    bookedValue: sumMoney(committed.map((b) => b.total)),
    toCollect: sumMoney(committed.map((b) => b.balance)),
    awaitingDeposit,
    awaitingDepositValue: sumMoney(awaitingDeposit.map((b) => r2(b.deposit - Number(b.paidAmount || 0)))),
  };
}
function isActiveBooking(b) {
  if (["Rejected", "Cancelled"].includes(b.booking)) return false;
  return !(b.booking === "Completed" && b.payment === "Paid");
}
function awaitingDepositNote(figures) {
  const count = figures.awaitingDeposit.length;
  if (!count) return "";
  return `<div class="muted" style="font-size:12px;margin-top:4px">Excludes ${count} awaiting deposit (${money(figures.awaitingDepositValue)} due)</div>`;
}
function adminOverview() {
  const figures = adminMoneyFigures(),
    live = adminServiceBookings.filter(isActiveBooking),
    c = adminCounts(),
    todo = adminServiceBookings.filter((b) => nextAction(b).fn),
    spec = adminVisitations.filter(
      (v) => v.type === "Special" && v.status === "Pending Review",
    ),
    upcomingV = adminVisitations.filter(
      (v) => ["Booked", "Approved"].includes(v.status) && v.date >= TODAY_ISO,
    ),
    // Confirmed services from today on, plus services already in progress.
    upcomingB = adminServiceBookings.filter(
      (b) =>
        (b.booking === "Confirmed" && b.isoDate >= TODAY_ISO) || b.booking === "Ongoing",
    );
  const coming = [
    ...upcomingB.map((b) => ({
      d: b.isoDate,
      t: b.booking === "Ongoing" ? "Service · ongoing" : "Service",
      l: `${b.ref} · ${b.name} · ${b.pkg}`,
    })),
    ...upcomingV.map((v) => ({
      d: v.date,
      t: "Visit",
      l: `${v.ref} · ${v.name} · ${v.visitors} visitor${v.visitors > 1 ? "s" : ""}`,
    })),
  ].sort((a, b) => a.d.localeCompare(b.d));
  const actionCount = todo.length + spec.length;
  const actionMarkup = adminActionMarkup(todo, spec);
  const comingMarkup = comingUpMarkup(coming);
  const actionLabel = actionCount === 1 ? "item" : "items";
  return `<div class="stat-grid"><div class="stat"><div class="label">Needs your action</div><div class="value">${actionCount}</div></div><div class="stat" role="button" style="cursor:pointer" onclick="adminTab='payments';render()"><div class="label">Payments to verify</div><div class="value">${c.payments}</div></div><div class="stat"><div class="label">Verified money received</div><div class="value" style="font-size:22px">${money(figures.received)}</div></div></div><div class="stat-grid" style="margin-top:12px"><div class="stat"><div class="label">Active package bookings</div><div class="value">${live.length}</div></div><div class="stat"><div class="label">Upcoming visits</div><div class="value">${upcomingV.length}</div></div><div class="stat"><div class="label">Still to collect (confirmed bookings)</div><div class="value" style="font-size:22px">${money(figures.toCollect)}</div>${awaitingDepositNote(figures)}</div></div><div class="panel"><div class="admin-header"><h3 style="margin:0">Action needed</h3><span class="muted" style="font-size:12px">${actionCount} ${actionLabel}</span></div>${actionMarkup}</div><div class="panel"><h3 style="margin-top:0">Coming up</h3>${comingMarkup}</div><div class="notice" style="margin-top:15px"><strong>How a booking flows:</strong> the customer books and pays the 50% down payment → you verify it in GCash → the booking is <strong>Confirmed</strong> automatically and the customer sees an update → on the day you <strong>Start service</strong>, then mark it <strong>Completed</strong> and add the delivery fee → the customer pays the outstanding balance → you verify it → <strong>Paid</strong>.</div>`;
}
function adminActionMarkup(todo, specialVisits) {
  const bookingItems = todo
    .map((booking) => {
      const action = nextAction(booking);
      return `<div class="todo"><div><strong>${booking.ref} · ${safe(booking.name)}</strong><div class="muted">${safe(booking.pkg)} · ${safe(booking.date)} · ${safe(booking.booking)} / ${safe(booking.payment)}</div></div><button class="btn btn-primary btn-sm" onclick="${action.fn}">${action.label}</button></div>`;
    })
    .join("");
  const visitItems = specialVisits
    .map(
      (visit) =>
        `<div class="todo"><div><strong>${visit.ref} · ${safe(visit.name)}</strong><div class="muted">Special-date visit request · ${fmtDate(visit.date)}</div></div><button class="btn btn-primary btn-sm" onclick="adminTab='special';render()">Review request</button></div>`,
    )
    .join("");
  if (!bookingItems && !visitItems) {
    return '<div class="empty">🎉 Nothing needs your attention right now.</div>';
  }
  return bookingItems + visitItems;
}
function comingUpMarkup(items) {
  if (!items.length) {
    return '<p class="muted">No confirmed services or visits scheduled.</p>';
  }
  return items
    .map(
      (item) =>
        `<div class="summary-line"><span><span class="badge badge-soft badge-neutral">${item.t}</span> &nbsp;${safe(item.l)}</span><strong>${fmtDate(item.d)}</strong></div>`,
    )
    .join("");
}

/* ----- bookings ----- */
function bookingMatches(b) {
  const q = bSearch.toLowerCase();
  if (
    q &&
    !(
      b.ref +
      " " +
      b.name +
      " " +
      b.pkg +
      " " +
      (b.phone || "") +
      " " +
      (b.location || "")
    )
      .toLowerCase()
      .includes(q)
  )
    return false;
  const closed = ["Rejected", "Cancelled"].includes(b.booking);
  switch (bFilter) {
    case "action":
      return !!nextAction(b).fn;
    case "pending":
      return ["Pending", "Approved"].includes(b.booking);
    case "confirmed":
      return ["Confirmed", "Ongoing"].includes(b.booking);
    case "completed":
      return b.booking === "Completed";
    case "closed":
      return closed;
    default:
      return true;
  }
}
function bookingRow(b) {
  const na = nextAction(b),
    closed = ["Rejected", "Cancelled"].includes(b.booking),
    left = Math.max(0, Number(b.total || 0) - Number(b.paidAmount || 0));
  let actionMarkup;
  if (na.fn) {
    actionMarkup = `<button class="btn ${na.cls} btn-sm" onclick="${na.fn}">${na.label}</button>`;
  } else if (na.wait) {
    actionMarkup = `<span class="muted">⏳ ${na.wait}</span>`;
  } else {
    actionMarkup = `<span class="muted">✓ ${na.label || "Closed"}</span>`;
  }
  const pondMarkup = b.pondWidth
    ? ` · ${b.pondWidth}×${b.pondHeight} m · Filtration ${safe(b.filtration)}`
    : "";
  const freebieMarkup = b.freebie
    ? `<br><span class="muted">🎁 ${safe(b.freebie)}</span>`
    : "";
  const deliveryLabel =
    b.deliveryFee == null ? "not set" : money(b.deliveryFee);
  // Only offer the transitions the backend allows; a booking with a receipt
  // awaiting verification must have that payment reviewed first.
  const awaitingReview = b.payment === "Verification Pending";
  const rejectMarkup =
    !awaitingReview && ["Pending", "Approved"].includes(b.booking)
      ? `<button class="btn btn-soft btn-error btn-sm" onclick="updateBooking('${b.ref}','Rejected')">Reject</button>`
      : "";
  const cancelMarkup =
    !closed && !awaitingReview && ["Pending", "Approved", "Confirmed"].includes(b.booking)
      ? `<button class="btn btn-soft btn-error btn-sm" onclick="updateBooking('${b.ref}','Cancelled')">Cancel</button>`
      : "";
  return `<tr><td><strong>${b.ref}</strong><br>${safe(b.pkg)}<br><span class="muted">${safe(b.layers || "—")}${pondMarkup}</span>${freebieMarkup}</td><td>${safe(b.name)}<br><span class="muted">${safe(b.phone || "")}</span><br><span class="muted">${safe(b.location || "")}</span></td><td>${safe(b.date)}</td><td><span class="badge badge-soft ${bookingClass(b.booking)}">${safe(b.booking)}</span><br><span class="badge badge-soft ${payClass(b.payment)}" style="margin-top:5px">${safe(b.payment)}</span></td><td><strong>${money(b.total)}</strong><br><span class="muted">Paid ${money(b.paidAmount || 0)} · Left ${money(left)}</span><br><span class="muted">Delivery: ${deliveryLabel}</span></td><td>${actionMarkup}</td><td><div class="actions"><button class="btn btn-sm" onclick="adminViewBooking('${b.ref}')">View</button>${rejectMarkup}${cancelMarkup}</div></td></tr>`;
}
function bookingTableHtml() {
  const list = adminServiceBookings.filter(bookingMatches);
  return `<div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Service date</th><th>Status</th><th>Amounts</th><th>Next step</th><th>Manage</th></tr></thead><tbody>${list.length ? list.map(bookingRow).join("") : '<tr><td colspan="7" class="muted">No bookings match your filter.</td></tr>'}</tbody></table></div>`;
}
function refreshBookingTable() {
  const h = document.getElementById("bkHost");
  if (h) h.innerHTML = bookingTableHtml();
}
function setBFilter(f) {
  bFilter = f;
  render();
}
function adminBookings() {
  const F = [
    ["all", "All"],
    ["action", "Needs action"],
    ["pending", "Awaiting deposit"],
    ["confirmed", "Confirmed / Ongoing"],
    ["completed", "Completed"],
    ["closed", "Cancelled / Rejected"],
  ];
  const filters = F.map(bookingFilterButton).join("");
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Package Bookings</h3><span class="muted" style="font-size:12px">Approved → Confirmed (when the down payment is verified) → Ongoing → Completed (service done) → balance paid</span></div></div><div class="toolbar"><input class="input w-full" type="search" placeholder="Search ref, customer, package, location…" value="${safe(bSearch)}" oninput="bSearch=this.value;refreshBookingTable()" aria-label="Search bookings"><div class="filters">${filters}</div></div><div id="bkHost">${bookingTableHtml()}</div></div><div class="notice" style="margin-top:14px">The big buttons in <strong>Next step</strong> walk you through each booking. The customer sees a status update each time you verify a payment, complete the service or add a delivery fee.</div>`;
}
function bookingFilterButton(filter) {
  const activeClass = bFilter === filter[0] ? "active" : "";
  return `<button class="${activeClass}" onclick="setBFilter('${filter[0]}')">${filter[1]}</button>`;
}
const BOOKING_STATUS_PROMPTS = {
  Ongoing: (ref) => `Start the service for booking ${ref}?`,
  Completed: (ref) =>
    `Mark booking ${ref} as completed? The customer will be notified, then you can add the delivery fee.`,
  Rejected: (ref) =>
    `Reject booking ${ref}? The customer will see that the booking could not be accepted.`,
  Cancelled: (ref) =>
    `Cancel booking ${ref}? Any down payment already paid is non-refundable.`,
};
/** Changes a booking status through the backend's allowed transitions. */
async function updateBooking(ref, status) {
  const b = adminBookingByRef(ref);
  const prompt = BOOKING_STATUS_PROMPTS[status];
  if (!b || !prompt || adminActionPending) return;
  if (!confirm(prompt(ref))) return;
  const done = await runAdminAction(
    () =>
      bookingApiRequest(`${adminBookingPath(ref)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    `Booking ${ref} is now ${status}.`,
  );
  if (done && status === "Completed") openPricing(ref);
}
function openPricing(ref) {
  const b = adminBookingByRef(ref);
  if (!b) return;
  if (
    b.booking !== "Completed" ||
    b.payment === "Paid" ||
    b.payment === "Verification Pending"
  ) {
    alert(
      "The delivery fee can be set once the service is completed, before the balance is paid, and while no receipt is waiting for verification.",
    );
    return;
  }
  const base = Number(b.servicePrice) + Number(b.customizationFee || 0);
  openModal(
    "Delivery fee",
    `${b.ref} · ${safe(b.name)}`,
    `<p class="muted" style="margin-top:0">The service is done. Enter the confirmed Lalamove quote (enter 0 if there is no delivery). It is added to the outstanding balance, and the customer can then pay the balance from My Bookings.</p><div class="summary-line"><span>Service location</span><strong>${safe(b.location || "Not provided")}</strong></div><div class="summary-line"><span>Package and customization</span><strong>${money(base)}</strong></div><div class="summary-line"><span>Already paid (verified)</span><strong>${money(b.paidAmount || 0)}</strong></div><div class="field"><label for="deliveryFeeInput">Lalamove delivery fee (₱)</label><input class="input w-full" id="deliveryFeeInput" type="number" min="0" step="0.01" value="${b.deliveryFee ?? ""}" placeholder="Enter confirmed delivery quote" oninput="pricePreview('${b.ref}')"></div><div class="notice" id="pricePreview">Enter a non-negative delivery fee to preview the new balance.</div>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="savePricingButton" onclick="savePricing('${b.ref}')">Save & notify customer</button>`,
  );
  pricePreview(ref);
}
function pricePreview(ref) {
  const b = adminBookingByRef(ref),
    el = document.getElementById("pricePreview"),
    raw = document.getElementById("deliveryFeeInput")?.value;
  if (!b || !el) return;
  const d = Number(raw),
    base = Number(b.servicePrice) + Number(b.customizationFee || 0);
  el.innerHTML =
    raw !== "" && d >= 0
      ? `New total: <strong>${money(base + d)}</strong><br>Outstanding balance the customer pays: <strong>${money(Math.max(0, r2(base + d - (b.paidAmount || 0))))}</strong>`
      : "Enter a non-negative delivery fee to preview the new balance.";
}
/** Saves the delivery fee; the backend recalculates total and balance. */
async function savePricing(ref) {
  const b = adminBookingByRef(ref);
  if (!b) return;
  const raw = document.getElementById("deliveryFeeInput")?.value?.trim();
  if (!raw || !/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    alert("Enter the confirmed delivery fee (0 if none), with at most two decimals.");
    return;
  }
  setButtonBusy("savePricingButton", true, "Saving…");
  const done = await runAdminAction(
    () =>
      bookingApiRequest(`${adminBookingPath(ref)}/delivery-fee`, {
        method: "PATCH",
        body: JSON.stringify({ deliveryFee: raw }),
      }),
    "Delivery fee saved — customer notified.",
  );
  if (done) closeModal();
  else setButtonBusy("savePricingButton", false);
}

/* ----- payments ----- */
function adminPayments() {
  const waiting = adminServiceBookings.filter(
      (b) => b.payment === "Verification Pending" && b.pendingPayment,
    ),
    owed = adminServiceBookings.filter((b) => customerCanPay(b));
  const waitingMarkup = waiting.length
    ? waiting.map(pendingPaymentCard).join("")
    : '<div class="empty"><h3>No payments awaiting verification</h3><p>New receipts appear here with their reference, amount and verification actions.</p></div>';
  const owedMarkup = owed.length
    ? owedPaymentTable(owed)
    : '<p class="muted">No customer payments are currently due.</p>';
  const waitingClass = waiting.length ? "badge-warning" : "badge-success";
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Needs verification</h3><p class="muted" style="margin:6px 0 0">Check each receipt against the actual GCash transaction before verifying.</p></div><span class="badge badge-soft ${waitingClass}">${waiting.length} waiting</span></div><div class="callout" style="margin-top:14px"><strong>Important:</strong> this website does not connect to GCash. Do not verify from the uploaded receipt alone — confirm the money arrived, the reference matches, and the amount is correct.</div>${waitingMarkup}</div><div class="panel"><div class="admin-header"><h3 style="margin:0">Waiting on the customer</h3><span class="muted" style="font-size:12px">${owed.length}</span></div>${owedMarkup}</div>`;
}
/** What verifying this payment would do, per the backend's rules. */
function paymentReviewOutcome(b, payment) {
  if (payment.paymentTarget !== "balance") return "Booking becomes Confirmed";
  return Number(payment.amount) >= Number(b.balance)
    ? "Payment becomes Paid"
    : "Payment stays Partially Paid";
}
function paymentMismatchMarkup(payment) {
  return !paymentAmountsDiffer(payment)
    ? ""
    : '<div class="notice" style="background:#fde5e5;border-color:#f1d1d1;color:#a33d3d;margin-top:10px">The submitted amount does not match the required amount. Reject the proof or investigate before verifying.</div>';
}
function pendingPaymentCard(b) {
  const p = b.pendingPayment;
  const paymentType = p.paymentTarget === "balance" ? "Balance payment" : "50% down payment";
  return `<div class="tile" style="margin-top:15px"><div class="admin-header"><div><div class="muted" style="font-size:12px">${safe(b.ref)} · Submitted ${safe(serverTime(p.submittedAt))}</div><h3 style="margin:6px 0">${safe(b.name)} — ${safe(b.pkg)}</h3></div><span class="badge badge-soft badge-warning">${paymentType}</span></div><div class="summary-line"><span>Transaction reference</span><strong>${safe(p.gcashReference || "—")}</strong></div><div class="summary-line"><span>Submitted amount</span><strong>${money(p.amount)}</strong></div><div class="summary-line"><span>Required amount</span><strong>${money(p.expectedAmount)}</strong></div>${paymentMismatchMarkup(p)}<div class="summary-line"><span>Receipt file</span><strong>${safe(p.receiptFileName)}</strong></div><div class="summary-line"><span>If verified</span><strong>${paymentReviewOutcome(b, p)}</strong></div><div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="reviewPayment('${b.ref}')">Review payment</button><button class="btn" onclick="viewPaymentReceipt('${b.ref}','${p._id}')">View receipt</button></div></div>`;
}
function owedPaymentTable(owed) {
  const rows = owed.map(owedPaymentRow).join("");
  return `<div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Payment due</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function owedPaymentRow(b) {
  const isBalance = customerCanPay(b) === "balance";
  const paymentDue = isBalance ? "Outstanding balance" : "50% down payment";
  const amount = isBalance ? b.balance : r2(b.deposit - Number(b.paidAmount || 0));
  return `<tr><td><strong>${b.ref}</strong><br><span class="muted">${safe(b.pkg)}</span></td><td>${safe(b.name)}</td><td>${paymentDue}</td><td>${money(amount)}</td><td><span class="badge badge-soft ${payClass(b.payment)}">${safe(b.payment)}</span></td></tr>`;
}
function paymentAmountsDiffer(payment) {
  return Math.abs(Number(payment.amount) - Number(payment.expectedAmount)) > 0.001;
}
function reviewPayment(ref) {
  const b = adminBookingByRef(ref);
  const p = b?.pendingPayment;
  if (!p || b.payment !== "Verification Pending") {
    toast("No receipt is waiting for this booking.");
    return;
  }
  const paymentType = p.paymentTarget === "balance" ? "Outstanding balance" : "50% down payment";
  const body = paymentReviewBody(b, p, paymentType);
  openModal(
    "Verify GCash payment",
    `${safe(b.ref)} · ${safe(b.name)} · ${safe(b.pkg)}`,
    body,
    `<button class="btn" onclick="closeModal()">Close</button><button class="btn" onclick="viewPaymentReceipt('${b.ref}','${p._id}')">View receipt</button><button class="btn btn-soft btn-error" id="rejectPaymentButton" onclick="verifyPayment('${b.ref}','${p._id}',false)">Reject proof</button><button class="btn btn-primary" id="verifyPaymentButton" onclick="verifyPayment('${b.ref}','${p._id}',true)">Verify payment</button>`,
  );
}
function paymentReviewBody(b, payment, paymentType) {
  const mismatchConfirmation = paymentAmountsDiffer(payment)
    ? `<label class="check-row"><input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" id="m_mismatch"><span>The submitted amount (${money(payment.amount)}) differs from the required amount (${money(payment.expectedAmount)}). I confirm this is the amount actually received.</span></label>`
    : "";
  return `<div class="callout">Open your GCash transaction history and confirm the money was actually received before verifying.</div><div class="summary-line"><span>Payment type</span><strong>${paymentType}</strong></div><div class="summary-line"><span>Transaction reference</span><strong>${safe(payment.gcashReference || "—")}</strong></div><div class="summary-line"><span>Submitted amount</span><strong>${money(payment.amount)}</strong></div><div class="summary-line"><span>Required amount</span><strong>${money(payment.expectedAmount)}</strong></div>${paymentMismatchMarkup(payment)}<div class="summary-line"><span>Receipt file</span><strong>${safe(payment.receiptFileName)}</strong></div><div class="summary-line"><span>Submitted</span><strong>${safe(serverTime(payment.submittedAt))}</strong></div><div class="summary-line"><span>Result if verified</span><strong>${paymentReviewOutcome(b, payment)}</strong></div><label class="check-row"><input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" id="m_checked"><span>I checked the actual GCash transaction: the money arrived and the reference and amount match.</span></label>${mismatchConfirmation}<div class="field" style="margin-top:14px"><label for="m_reason">Reason (required to reject; shown to the customer)</label><input class="input w-full" id="m_reason" maxlength="500" placeholder="e.g. Reference number not found in GCash"></div>${FORM_ERROR_MARKUP}`;
}
/**
 * Verifies or rejects a submitted payment through the backend, which applies
 * the amount, deposit and status rules and is the final authority.
 */
async function verifyPayment(ref, paymentId, valid) {
  if (adminActionPending) return;
  const b = adminBookingByRef(ref);
  const p = b?.pendingPayment;
  if (!p || p._id !== paymentId) {
    showFormError("This payment is no longer awaiting verification. Close and refresh.");
    return;
  }
  clearFormError();
  let body;
  if (valid) {
    if (!document.getElementById("m_checked")?.checked) {
      showFormError("Tick the box to confirm you checked the actual GCash transaction first.");
      return;
    }
    if (paymentAmountsDiffer(p) && !document.getElementById("m_mismatch")?.checked) {
      showFormError("Confirm the amount difference before verifying this payment.");
      return;
    }
    body = { decision: "approve" };
  } else {
    const reason = (document.getElementById("m_reason")?.value || "").trim();
    if (!reason || reason.length > 500) {
      showFormError("Enter a rejection reason (up to 500 characters). The customer will see it.");
      return;
    }
    body = { decision: "reject", rejectionReason: reason };
  }

  const activeId = valid ? "verifyPaymentButton" : "rejectPaymentButton";
  const otherButton = document.getElementById(valid ? "rejectPaymentButton" : "verifyPaymentButton");
  setButtonBusy(activeId, true, valid ? "Verifying…" : "Rejecting…");
  if (otherButton) otherButton.disabled = true;
  adminActionPending = true;
  try {
    const result = await bookingApiRequest(
      `${adminBookingPath(ref)}/payments/${encodeURIComponent(paymentId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    );
    closeModal();
    toast(
      valid
        ? `Payment verified — booking ${result.booking.bookingStatus}, payment ${result.booking.paymentStatus}.`
        : "Proof rejected — customer notified. No money recorded.",
    );
  } catch (error) {
    setButtonBusy(activeId, false);
    if (otherButton) otherButton.disabled = false;
    showFormError(error instanceof Error ? error.message : "The payment could not be updated.");
  } finally {
    adminActionPending = false;
    await reloadAdminData();
  }
}

/* ----- visitations ----- */
function setVFilter(f) {
  vFilter = f;
  render();
}
function adminVisits() {
  const base = adminVisitations.filter(
      (v) =>
        !(
          v.type === "Special" &&
          ["Pending Review", "Declined"].includes(v.status)
        ),
    ),
    F = [
      ["all", "All"],
      ["upcoming", "Upcoming"],
      ["completed", "Completed"],
      ["cancelled", "Cancelled"],
    ],
    list = base.filter(matchesVisitFilter).sort((a, b) => a.date.localeCompare(b.date));
  const filters = F.map(visitFilterButton).join("");
  const rows = list.length
    ? list.map(visitTableRow).join("")
    : '<tr><td colspan="8" class="muted">No visitation bookings match.</td></tr>';
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Visitation Bookings</h3><p class="muted" style="margin:6px 0 0">Farm visits for 1–5 visitors on weekends, including approved special dates.</p></div></div><div class="toolbar"><div class="filters">${filters}</div></div><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Visitor</th><th>Farm</th><th>Visit date</th><th>Visitors</th><th>Type</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function matchesVisitFilter(visit) {
  if (vFilter === "upcoming") {
    return ["Booked", "Approved"].includes(visit.status);
  }
  if (vFilter === "completed") return visit.status === "Completed";
  if (vFilter === "cancelled") return visit.status === "Cancelled";
  return true;
}
function visitFilterButton(filter) {
  const activeClass = vFilter === filter[0] ? "active" : "";
  return `<button class="${activeClass}" onclick="setVFilter('${filter[0]}')">${filter[1]}</button>`;
}
function visitTableRow(visit) {
  const typeLabel = visit.type === "Special" ? "Special date" : "Regular";
  return `<tr><td><strong>${visit.ref}</strong><br><span class="muted">Submitted ${safe(visit.submittedAt)}</span></td><td>${safe(visit.name)}<br><span class="muted">${safe(visit.email)}</span><br><span class="muted">${safe(visit.phone)}</span></td><td>${safe(visit.farm || "—")}</td><td>${fmtDate(visit.date, true)}</td><td>${visit.visitors}</td><td>${typeLabel}</td><td><span class="badge badge-soft ${visitStatusClass(visit.status)}">${safe(visit.status)}</span></td><td><div class="actions">${visitManageButtons(visit)}</div></td></tr>`;
}
function visitManageButtons(visit) {
  const statusActions = ["Booked", "Approved"].includes(visit.status)
    ? `<button class="btn btn-primary btn-sm" onclick="updateVisit('${visit.ref}','Completed')">Mark completed</button><button class="btn btn-soft btn-error btn-sm" onclick="updateVisit('${visit.ref}','Cancelled')">Cancel</button>`
    : "";
  return `<button class="btn btn-sm" onclick="adminViewVisit('${visit.ref}')">View</button>${statusActions}`;
}
function adminSpecial() {
  const list = adminVisitations.filter((v) => v.type === "Special"),
    pend = list.filter((v) => v.status === "Pending Review").length;
  const statusClass = pend ? "badge-warning" : "badge-success";
  const requests = list.length
    ? list.map(specialVisitCard).join("")
    : '<div class="empty"><h3>No special-date requests</h3><p>Requests for dates outside the regular schedule will appear here.</p></div>';
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Special-Date Requests</h3><p class="muted" style="margin:6px 0 0">Visit requests for dates outside the regular weekend schedule. Approve or decline each one.</p></div><span class="badge badge-soft ${statusClass}">${pend} awaiting review</span></div>${requests}</div>`;
}
function specialVisitCard(visit) {
  const reviewActions =
    visit.status === "Pending Review"
      ? `<button class="btn btn-primary" onclick="updateVisit('${visit.ref}','Approved')">Approve special date</button><button class="btn btn-soft btn-error" onclick="updateVisit('${visit.ref}','Declined')">Decline request</button>`
      : "";
  const reviewed = visit.reviewedAt
    ? `<div class="summary-line"><span>Reviewed</span><strong>${safe(serverTime(visit.reviewedAt))}${visit.reviewerName ? ` · ${safe(visit.reviewerName)}` : ""}</strong></div>`
    : "";
  return `<div class="tile" style="margin-top:15px"><div class="admin-header"><div><div class="muted" style="font-size:12px">${visit.ref} · Submitted ${safe(visit.submittedAt)}</div><h3 style="margin:6px 0">${fmtDate(visit.date, true)}</h3></div><span class="badge badge-soft ${visitStatusClass(visit.status)}">${safe(visit.status)}</span></div><div class="summary-line"><span>Visitor</span><strong>${safe(visit.name)} · ${safe(visit.email)} · ${safe(visit.phone)}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(visit.farm || "Not provided")}</strong></div><div class="summary-line"><span>Visitors</span><strong>${visit.visitors}</strong></div><div class="summary-line"><span>Reason</span><strong>${safe(visit.reason)}</strong></div>${reviewed}<div class="actions" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${reviewActions}<button class="btn" onclick="adminViewVisit('${visit.ref}')">View</button></div></div>`;
}
const VISIT_STATUS_PROMPTS = {
  Approved: (ref) => `Approve special-date request ${ref}? The customer will see it as approved.`,
  Declined: (ref) => `Decline special-date request ${ref}?`,
  Completed: (ref) => `Mark visit ${ref} as completed?`,
  Cancelled: (ref) => `Cancel visit ${ref}?`,
};
/** Changes a visitation status through the backend's allowed transitions. */
async function updateVisit(ref, status) {
  const visit = adminVisitByRef(ref);
  const prompt = VISIT_STATUS_PROMPTS[status];
  if (!visit || !prompt || adminActionPending) return;
  if (!confirm(prompt(ref))) return;
  await runAdminAction(
    () =>
      bookingApiRequest(`/api/admin/visitation-bookings/${encodeURIComponent(ref)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    `Visit ${ref} is now ${status}.`,
  );
}
async function adminViewVisit(ref) {
  const close = '<button class="btn" onclick="closeModal()">Close</button>';
  openModal("Visitation details", safe(ref), '<p class="muted" aria-busy="true">Loading visitation…</p>', close);
  try {
    const { visit: server } = await bookingApiRequest(
      `/api/admin/visitation-bookings/${encodeURIComponent(ref)}`,
    );
    const v = toAdminVisit(server);
    const account = v.account
      ? `<div class="summary-line"><span>Customer account</span><strong>${safe(v.account.name)} · ${safe(v.account.email || "—")}${v.account.active ? "" : " (inactive)"}</strong></div>`
      : "";
    const reason = v.reason
      ? `<div class="summary-line"><span>Reason for special date</span><strong>${safe(v.reason)}</strong></div>`
      : "";
    const reviewed = v.reviewedAt
      ? `<div class="summary-line"><span>Reviewed</span><strong>${safe(serverTime(v.reviewedAt))}${v.reviewerName ? ` · ${safe(v.reviewerName)}` : ""}</strong></div>`
      : "";
    const history = (server.statusHistory || [])
      .slice()
      .reverse()
      .map((entry) => {
        const by = staffName(entry.changedBy);
        return `<li>${safe(entry.status)}${entry.note ? ` · ${safe(entry.note)}` : ""}${by ? ` · by ${safe(by)}` : ""}<span class="when">${safe(serverTime(entry.changedAt))}</span></li>`;
      })
      .join("");
    const body = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px"><span class="badge badge-soft ${visitStatusClass(v.status)}">${safe(v.status)}</span><span class="badge badge-soft badge-neutral">${v.type === "Special" ? "Special date request" : "Regular schedule"}</span></div><div class="summary-line"><span>Visit date</span><strong>${fmtDate(v.date, true)}</strong></div><div class="summary-line"><span>Visitors</span><strong>${v.visitors}</strong></div><div class="summary-line"><span>Visitor</span><strong>${safe(v.name)}</strong></div><div class="summary-line"><span>Contact</span><strong>${safe(v.phone)} · ${safe(v.email)}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(v.farm || "Not provided")}</strong></div>${account}${reason}<div class="summary-line"><span>Submitted</span><strong>${safe(v.submittedAt)}</strong></div>${reviewed}<h4 style="margin:18px 0 0">Status updates</h4>${history ? `<ul class="updates">${history}</ul>` : '<p class="muted">No updates yet.</p>'}`;
    openModal("Visitation details", safe(ref), body, close);
  } catch (error) {
    openModal("Visitation details", safe(ref), `<p role="alert">${safe(error instanceof Error ? error.message : "Unable to load this visitation.")}</p>`, close);
  }
}

/* ----- customers ----- */
function custStats(c) {
  const bs = bookings.filter((b) => b.name === c.name),
    vs = visits.filter((v) => v.name === c.name);
  return { bs, vs, done: bs.filter((b) => b.booking === "Completed").length };
}
function customersTableHtml() {
  const q = cSearch.toLowerCase(),
    list = customers.filter(
      (c) =>
        !q ||
        (c.name + " " + c.email + " " + c.phone + " " + c.address)
          .toLowerCase()
          .includes(q),
    );
  return `<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Contact</th><th>Service bookings</th><th>Visits</th><th>Completed</th><th>Type</th><th>Manage</th></tr></thead><tbody>${
    list.length
      ? list
          .map((c) => {
            const s = custStats(c);
            return `<tr><td><strong>${safe(c.name)}</strong><br><span class="muted">${c.id} · ${safe(c.address || "No address")}</span></td><td>${safe(c.phone || "—")}<br><span class="muted">${safe(c.email || "No email")}</span></td><td>${s.bs.length}</td><td>${s.vs.length}</td><td>${s.done}</td><td><span class="badge badge-soft ${s.done >= 2 ? "badge-success" : "badge-neutral"}">${s.done >= 2 ? "Repeat customer" : "Regular / new"}</span></td><td><div class="actions"><button class="btn btn-sm" onclick="viewCustomer('${c.id}')">View</button><button class="btn btn-sm" onclick="openCustomerForm('${c.id}')">Edit</button><button class="btn btn-soft btn-error btn-sm" onclick="deleteCustomer('${c.id}')">Delete</button></div></td></tr>`;
          })
          .join("")
      : '<tr><td colspan="7" class="muted">No customers match.</td></tr>'
  }</tbody></table></div>`;
}
function refreshCustomers() {
  const h = document.getElementById("custHost");
  if (h) h.innerHTML = customersTableHtml();
}
function adminCustomers() {
  return `${sampleDataNotice("These customers and their booking counts are example records kept in this browser. Real customer accounts and bookings are in Package Bookings, Payments and Visitations.")}<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Customers</h3><p class="muted" style="margin:6px 0 0">${customers.length} customers · repeat customer = at least two completed purchases.</p></div><button class="btn btn-primary" onclick="openCustomerForm()">＋ Add customer</button></div><div class="toolbar"><input class="input w-full" type="search" placeholder="Search name, phone, email, address…" value="${safe(cSearch)}" oninput="cSearch=this.value;refreshCustomers()" aria-label="Search customers"></div><div id="custHost">${customersTableHtml()}</div></div>`;
}
function openCustomerForm(id) {
  const c = id ? customers.find((x) => x.id === id) : null;
  if (id && !c) return;
  openModal(
    c ? "Edit customer" : "Add customer",
    c ? c.id : "",
    `<div class="field-grid">${fld("m_cname", "Full name", c?.name)}${fld("m_cphone", "Contact number", c?.phone)}${fld("m_cemail", "Email", c?.email, "email")}${fld("m_caddr", "Address", c?.address)}</div><div class="field"><label for="m_cnotes">Notes</label><textarea class="textarea w-full" id="m_cnotes">${safe(c?.notes || "")}</textarea></div>${c ? '<p class="muted" style="font-size:12px;margin:0">Renaming a customer also updates their bookings and visits.</p>' : ""}`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveCustomer('${c ? c.id : ""}')">${c ? "Save changes" : "Add customer"}</button>`,
  );
}
function saveCustomer(id) {
  const name = V("m_cname");
  if (!name) {
    toast("Customer name is required.");
    return;
  }
  if (
    customers.some(
      (c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    toast("A customer with that name already exists.");
    return;
  }
  const o = {
    name,
    phone: V("m_cphone"),
    email: V("m_cemail"),
    address: V("m_caddr"),
    notes: V("m_cnotes"),
  };
  if (id) {
    const c = customers.find((x) => x.id === id),
      old = c.name;
    Object.assign(c, o);
    if (old !== name) {
      bookings.forEach((b) => {
        if (b.name === old) b.name = name;
      });
      visits.forEach((v) => {
        if (v.name === old) v.name = name;
      });
      if (userName === old) userName = name;
    }
    toast("Customer updated.");
  } else {
    o.id =
      "C-" +
      String(customers.length + 1 + Math.floor(Math.random() * 900)).padStart(
        3,
        "0",
      );
    customers.push(o);
    toast("Customer added.");
  }
  closeModal();
  render();
}
function deleteCustomer(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  const s = custStats(c);
  if (s.bs.length || s.vs.length) {
    alert(
      c.name +
        " has " +
        s.bs.length +
        " booking(s) and " +
        s.vs.length +
        " visit(s). Delete or reassign those records first.",
    );
    return;
  }
  if (!confirm("Delete customer " + c.name + "?")) return;
  customers = customers.filter((x) => x.id !== id);
  toast("Customer deleted.");
  render();
}
function viewCustomer(id) {
  const c = customers.find((x) => x.id === id);
  if (!c) return;
  const s = custStats(c);
  const notesMarkup = c.notes
    ? `<div class="summary-line"><span>Notes</span><strong>${safe(c.notes)}</strong></div>`
    : "";
  const bookingMarkup = s.bs.length
    ? s.bs.map(customerBookingSummary).join("")
    : '<p class="muted">None.</p>';
  const visitMarkup = s.vs.length
    ? s.vs.map(customerVisitSummary).join("")
    : '<p class="muted">None.</p>';
  const body = `<div class="summary-line"><span>Contact</span><strong>${safe(c.phone || "—")}</strong></div><div class="summary-line"><span>Email</span><strong>${safe(c.email || "—")}</strong></div><div class="summary-line"><span>Address</span><strong>${safe(c.address || "—")}</strong></div>${notesMarkup}<h4 style="margin:18px 0 4px">Service bookings (${s.bs.length})</h4>${bookingMarkup}<h4 style="margin:18px 0 4px">Visits (${s.vs.length})</h4>${visitMarkup}`;
  openModal(
    safe(c.name),
    c.id,
    body,
    `<button class="btn" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="openCustomerForm('${c.id}')">Edit</button>`,
  );
}
function customerBookingSummary(booking) {
  return `<div class="summary-line"><span>${booking.ref} · ${safe(booking.pkg)} · ${safe(booking.date)}</span><strong>${safe(booking.booking)} / ${safe(booking.payment)}</strong></div>`;
}
function customerVisitSummary(visit) {
  return `<div class="summary-line"><span>${visit.ref} · ${fmtDate(visit.date)}</span><strong>${safe(visit.status)}</strong></div>`;
}

/* ----- package catalog ----- */
window.pendingPkgImage = null;
/* ----- package catalog (admin) -----
   Packages are managed through /api/admin/service-packages. Photos are
   uploaded to the server; custom pond pricing is fixed on the server. */
let adminPackages = [],
  adminPackagesState = "idle",
  adminPackagesError = "",
  adminCustomPondPricing = null,
  pkgStatusFilter = "all",
  packageFormPhoto = null;
const PACKAGE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PACKAGE_PHOTO_ORIGINAL = 8 * 1024 * 1024;
const MAX_PACKAGE_PHOTO_UPLOAD = 5 * 1024 * 1024;
const MAX_PACKAGE_PHOTO_DIMENSION = 1200;
function adminPackagePath(code) {
  return `/api/admin/service-packages/${encodeURIComponent(code)}`;
}
function toAdminCatalogPackage(server) {
  return {
    ...toCatalogPackage(server),
    status: server.status,
    active: server.status === "Active",
    sortOrder: server.sortOrder,
    imageMeta: server.image,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    createdBy: staffName(server.createdBy),
    updatedBy: staffName(server.updatedBy),
  };
}
async function loadAdminPackages() {
  if (adminPackagesState === "loading") return;
  adminPackagesState = "loading";
  adminPackagesError = "";
  try {
    const result = await bookingApiRequest("/api/admin/service-packages");
    adminPackages = (result.packages || []).map(toAdminCatalogPackage);
    adminCustomPondPricing = result.customPondPricing || null;
    adminPackagesState = "loaded";
  } catch (error) {
    adminPackagesState = "error";
    adminPackagesError = error instanceof Error ? error.message : "Packages could not be loaded.";
  }
  if (page === "admin" && adminTab === "catalog") render();
}
function reloadAdminPackages() {
  adminPackagesState = "idle";
  return loadAdminPackages();
}
function adminPackageByCode(code) {
  return adminPackages.find((x) => x.id === code) || null;
}
async function runPackageAction(action, successMessage) {
  if (adminActionPending) return false;
  adminActionPending = true;
  try {
    await action();
    if (successMessage) toast(successMessage);
    return true;
  } catch (error) {
    alert(error instanceof Error ? error.message : "The request could not be completed.");
    return false;
  } finally {
    adminActionPending = false;
    await reloadAdminPackages();
  }
}
function packageMatchesFilters(x) {
  if (pkgStatusFilter === "active" && !x.active) return false;
  if (pkgStatusFilter === "inactive" && x.active) return false;
  const q = pkgSearch.trim().toLowerCase();
  return !q || `${x.name} ${x.description} ${x.freebie} ${x.id}`.toLowerCase().includes(q);
}
function pkgCardAdmin(x) {
  const inactive = !x.active;
  const code = safe(x.id);
  return `<article class="pkg-card ${inactive ? "is-hidden" : ""}"><div class="pkg-media">${pkgImg(x)}${x.featured ? '<span class="pkg-badge">★ FEATURED</span>' : ""}${inactive ? '<span class="pkg-badge hidden-b" style="left:auto;right:12px">INACTIVE</span>' : ""}</div><div class="pkg-body"><h3>${safe(x.name)}</h3><p>${safe(x.description)}</p><div class="chips"><span class="badge badge-soft badge-primary">${safe(x.layers)}</span><span class="badge badge-soft badge-primary">${safe(x.dimensions)}</span></div><div class="freebie"><span>🎁</span><span>${safe(x.freebie)}</span></div><div class="pkg-foot"><div class="price-big"><small>Package price</small>${money(x.price)}</div><div class="mini-actions"><button class="btn btn-sm" onclick="movePackage('${code}','up')" aria-label="Move earlier" title="Move earlier">←</button><button class="btn btn-sm" onclick="movePackage('${code}','down')" aria-label="Move later" title="Move later">→</button></div></div><div class="pkg-actions"><button class="btn btn-sm" onclick="viewPackage('${code}')">Details</button><button class="btn btn-primary btn-sm" onclick="openPackageForm('${code}')">Edit</button><button class="btn btn-sm" onclick="togglePackage('${code}')">${inactive ? "Activate" : "Deactivate"}</button><button class="btn btn-sm" onclick="duplicatePackage('${code}')">Duplicate</button></div></div></article>`;
}
function catalogGridMarkup() {
  if (!adminPackages.length) return '<div class="empty">No packages yet. Add your first package.</div>';
  return adminPackages.filter(packageMatchesFilters).map(pkgCardAdmin).join("") || '<div class="empty">No packages match.</div>';
}
function pkgFilterButton([value, label]) {
  return `<button class="${pkgStatusFilter === value ? "active" : ""}" onclick="pkgStatusFilter='${value}';render()">${label}</button>`;
}
function customPondPricingPanel() {
  const p = adminCustomPondPricing;
  if (!p) return "";
  return `<div class="panel"><h3 style="margin-top:0">Custom pond pricing</h3><p class="muted" style="margin-top:0">Used by Custom Pond Design: width × length × rate per m² per layer, plus the filtration fee when selected. These rates are fixed on the server.</p><div class="summary-line"><span>Rate per m² per layer</span><strong>${money(p.ratePerSquareMetrePerLayer)}</strong></div><div class="summary-line"><span>Filtration fee</span><strong>${money(p.filtration)}</strong></div><div class="summary-line"><span>Layers · size per side</span><strong>${p.minLayers}–${p.maxLayers} layers · ${p.minDimensionMetres}–${p.maxDimensionMetres} m</strong></div></div>`;
}
function adminCatalog() {
  if (adminPackagesState === "error") {
    return `<div class="panel" role="alert"><h3 style="margin-top:0">Packages could not be loaded</h3><p class="muted">${safe(adminPackagesError)}</p><button class="btn" onclick="reloadAdminPackages()">Try again</button></div>`;
  }
  if (adminPackagesState !== "loaded") {
    return '<div class="panel" aria-busy="true"><p class="muted" style="margin:0">Loading packages…</p></div>';
  }
  const act = adminPackages.filter((x) => x.active);
  const avg = act.length ? act.reduce((s, x) => s + Number(x.price), 0) / act.length : 0;
  const filters = [["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(pkgFilterButton).join("");
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Package Catalog</h3><p class="muted" style="margin:6px 0 0">Add, edit, activate, deactivate, duplicate and reorder pond packages. Active packages appear on the Shop page and in the booking selector.</p></div><button class="btn btn-primary" onclick="openPackageForm()">＋ Add package</button></div><div class="stat-grid" style="margin-top:16px"><div class="stat"><div class="label">Active packages</div><div class="value">${act.length}</div></div><div class="stat"><div class="label">Inactive</div><div class="value">${adminPackages.length - act.length}</div></div><div class="stat"><div class="label">Average active price</div><div class="value" style="font-size:22px">${money(r2(avg))}</div></div></div></div>${customPondPricingPanel()}<div class="panel"><div class="toolbar" style="margin-top:0"><h3 style="margin:0">Packages (${adminPackages.length})</h3><input class="input w-full" type="search" placeholder="Search packages…" value="${safe(pkgSearch)}" oninput="pkgSearch=this.value;refreshCatalogGrid()" aria-label="Search packages"><div class="filters">${filters}</div></div><div id="pkgHost" class="pkg-grid">${catalogGridMarkup()}</div></div>`;
}
function refreshCatalogGrid() {
  const host = document.getElementById("pkgHost");
  if (host) host.innerHTML = catalogGridMarkup();
}
function viewPackage(code) {
  const x = adminPackageByCode(code);
  if (!x) return;
  const line = (label, value) => `<div class="summary-line"><span>${label}</span><strong>${value}</strong></div>`;
  const inclusions = x.inclusions.map((item) => `<li>${safe(item)}</li>`).join("");
  const body = `${packagePhoto(x)}<div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0"><span class="badge badge-soft ${x.active ? "badge-success" : "badge-neutral"}">${safe(x.status)}</span>${x.featured ? '<span class="badge badge-soft badge-warning">Featured</span>' : ""}</div>${line("Code", safe(x.id))}${line("Price", money(x.price))}${line("Layers", safe(x.layers))}${line("Dimensions", safe(x.dimensions))}<p>${safe(x.description)}</p><h4 style="margin:12px 0 4px">Inclusions</h4><ul>${inclusions}</ul>${line("Created", `${safe(serverTime(x.createdAt))}${x.createdBy ? ` · ${safe(x.createdBy)}` : ""}`)}${line("Last updated", `${safe(serverTime(x.updatedAt))}${x.updatedBy ? ` · ${safe(x.updatedBy)}` : ""}`)}`;
  openModal("Package details", safe(x.name), body, `<button class="btn" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="openPackageForm('${safe(x.id)}')">Edit</button>`, true);
}
function releasePackageFormPhoto() {
  if (packageFormPhoto?.url) URL.revokeObjectURL(packageFormPhoto.url);
  packageFormPhoto = null;
}
function packagePhotoPreview(x) {
  const pending = packageFormPhoto;
  let src = x?.image || "";
  if (pending === "remove") src = "";
  else if (pending?.url) src = pending.url;
  const hasPhoto = Boolean(src);
  const preview = hasPhoto
    ? `<img id="m_pprev" src="${safe(src)}" alt="Photo preview" style="width:100%;height:100%;object-fit:cover">`
    : photoPlaceholder("", "No photo yet");
  const remove = hasPhoto ? '<button type="button" class="btn btn-soft btn-error btn-sm" onclick="removePackagePhoto()">Remove photo</button>' : "";
  return `<div class="pkg-media" id="m_pphoto" style="height:160px;border-radius:12px;overflow:hidden;margin-top:8px">${preview}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><label class="btn btn-sm" style="cursor:pointer">${hasPhoto ? "Replace photo" : "Upload photo"}<input class="file-input w-full" id="m_pimg" type="file" accept="image/jpeg,image/png,image/webp" onchange="choosePackagePhoto(this)" hidden></label>${remove}</div>`;
}
function refreshPackagePhoto(code) {
  const host = document.getElementById("m_pphotoHost");
  if (host) host.innerHTML = packagePhotoPreview(code ? adminPackageByCode(code) : null);
}
function openPackageForm(code) {
  const x = code ? adminPackageByCode(code) : null;
  if (code && !x) return;
  releasePackageFormPhoto();
  const inclusions = safe((x?.inclusions || []).join("\n"));
  const statusField = x
    ? `<p class="muted">Status: <strong>${safe(x.status)}</strong> — use Activate / Deactivate on the package card to change it.</p>`
    : '<label class="check-row"><input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" id="m_pact" checked><span>Active (available to customers)</span></label>';
  const body = `<div class="field-grid">${fld("m_pname", "Package name", x?.name, "text", 'maxlength="70"')}${fld("m_pprice", "Package price (₱)", x?.price ?? "", "number", 'min="0.01" step="0.01"')}${fld("m_players", "Included layers", x?.layers, "text", 'maxlength="40" placeholder="e.g. 2 layers"')}${fld("m_pdim", "Standard dimensions", x?.dimensions, "text", 'maxlength="40" placeholder="e.g. 2 m × 3 m"')}</div><div class="field"><label for="m_pincl">Inclusions (one per line, up to 10)</label><textarea class="textarea w-full" id="m_pincl" maxlength="1300" placeholder="e.g. Free starter water-test kit">${inclusions}</textarea></div><div class="field"><label for="m_pdesc">Description</label><textarea class="textarea w-full" id="m_pdesc" maxlength="500">${safe(x?.description || "")}</textarea></div><div class="field"><label>Package photo</label><small class="muted">JPG, PNG or WEBP, up to 8 MB. Large photos are resized to 1,200 px.</small><div id="m_pphotoHost">${packagePhotoPreview(x)}</div></div><label class="check-row"><input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" id="m_pfeat" ${x?.featured ? "checked" : ""}><span>Feature this package (shows a “Most popular” badge)</span></label>${statusField}${FORM_ERROR_MARKUP}`;
  openModal(
    x ? "Edit package" : "Add package",
    x ? safe(x.name) : "",
    body,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="savePackageButton" onclick="savePackage('${x ? safe(x.id) : ""}')">${x ? "Save package" : "Add package"}</button>`,
    true,
  );
  document.getElementById("modalHost").dataset.packageCode = x ? x.id : "";
}
function resizePackagePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_PACKAGE_PHOTO_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be processed."))),
        file.type,
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be opened. Please choose another."));
    };
    img.src = url;
  });
}
/** Validates, resizes (max 1,200 px) and previews a chosen photo. */
async function choosePackagePhoto(input) {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  clearFormError();
  if (!PACKAGE_PHOTO_TYPES.has(file.type)) {
    showFormError("Choose a JPG, PNG or WEBP photo.");
    return;
  }
  if (file.size > MAX_PACKAGE_PHOTO_ORIGINAL) {
    showFormError("Choose a photo smaller than 8 MB.");
    return;
  }
  try {
    const blob = await resizePackagePhoto(file);
    if (blob.size > MAX_PACKAGE_PHOTO_UPLOAD) {
      showFormError("This photo is still larger than 5 MB after resizing. Choose a smaller photo.");
      return;
    }
    releasePackageFormPhoto();
    packageFormPhoto = { blob, type: blob.type || file.type, url: URL.createObjectURL(blob) };
    refreshPackagePhoto(document.getElementById("modalHost").dataset.packageCode);
  } catch (error) {
    showFormError(error instanceof Error ? error.message : "The photo could not be processed.");
  }
}
function removePackagePhoto() {
  if (!confirm("Remove this photo? Customers will see the default placeholder.")) return;
  const code = document.getElementById("modalHost").dataset.packageCode;
  const hadSaved = Boolean(code && adminPackageByCode(code)?.image);
  releasePackageFormPhoto();
  packageFormPhoto = hadSaved ? "remove" : null;
  refreshPackagePhoto(code);
}
function readPackageForm(isNew) {
  const priceRaw = V("m_pprice");
  const values = {
    name: V("m_pname"),
    price: priceRaw,
    layers: V("m_players"),
    dimensions: V("m_pdim"),
    description: V("m_pdesc"),
    inclusions: (document.getElementById("m_pincl")?.value || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    featured: Boolean(document.getElementById("m_pfeat")?.checked),
  };
  if (isNew) values.status = document.getElementById("m_pact")?.checked ? "Active" : "Inactive";
  if (!values.name || !values.layers || !values.dimensions || !values.description) {
    return { error: "Complete the name, layers, dimensions and description." };
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceRaw) || Number(priceRaw) <= 0) {
    return { error: "Enter a price greater than zero with at most two decimals." };
  }
  if (!values.inclusions.length || values.inclusions.length > 10) {
    return { error: "Enter between 1 and 10 inclusions, one per line." };
  }
  return { value: values };
}
/** Uploads or removes the package photo when the form changed it. */
async function applyPackagePhotoChange(code) {
  try {
    if (packageFormPhoto && packageFormPhoto !== "remove") {
      await bookingApiRequest(`${adminPackagePath(code)}/image`, {
        method: "PUT",
        headers: { "Content-Type": packageFormPhoto.type },
        body: packageFormPhoto.blob,
      });
    } else if (packageFormPhoto === "remove") {
      await bookingApiRequest(`${adminPackagePath(code)}/image`, { method: "DELETE" });
    }
  } catch (photoError) {
    throw new Error(`The package was saved, but the photo was not updated: ${photoError.message} Edit the package to try again.`);
  }
}
function continueAsEdit(savedCode) {
  const button = document.getElementById("savePackageButton");
  if (button) button.setAttribute("onclick", `savePackage('${safe(savedCode)}')`);
  document.getElementById("modalHost").dataset.packageCode = savedCode;
}
/** Saves package details, then uploads or removes the photo if changed. */
async function savePackage(code) {
  if (adminActionPending) return;
  clearFormError();
  const form = readPackageForm(!code);
  if (form.error) {
    showFormError(form.error);
    return;
  }
  adminActionPending = true;
  setButtonBusy("savePackageButton", true, "Saving…");
  let savedCode = code;
  try {
    const saved = await bookingApiRequest(code ? adminPackagePath(code) : "/api/admin/service-packages", {
      method: code ? "PATCH" : "POST",
      body: JSON.stringify(form.value),
    });
    savedCode = saved.package.code;
    await applyPackagePhotoChange(savedCode);
    closeModal();
    toast(code ? "Package updated." : "Package added.");
  } catch (error) {
    setButtonBusy("savePackageButton", false);
    showFormError(error instanceof Error ? error.message : "The package could not be saved.");
    // A new package that saved before a photo failure continues as an edit.
    if (!code && savedCode) continueAsEdit(savedCode);
  } finally {
    adminActionPending = false;
    await reloadAdminPackages();
  }
}
async function togglePackage(code) {
  const x = adminPackageByCode(code);
  if (!x || adminActionPending) return;
  const next = x.active ? "Inactive" : "Active";
  const prompt = x.active
    ? `Deactivate "${x.name}"? Customers will no longer be able to choose it. Existing bookings keep their package details and price.`
    : `Activate "${x.name}"? Customers will be able to choose it for new bookings.`;
  if (!confirm(prompt)) return;
  await runPackageAction(
    () => bookingApiRequest(`${adminPackagePath(code)}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }),
    next === "Active" ? "Package is now available to customers." : "Package is now inactive.",
  );
}
async function duplicatePackage(code) {
  if (!adminPackageByCode(code)) return;
  await runPackageAction(
    () => bookingApiRequest(`${adminPackagePath(code)}/duplicate`, { method: "POST" }),
    "Duplicated as inactive. Edit it, then activate it.",
  );
}
async function movePackage(code, direction) {
  if (!adminPackageByCode(code)) return;
  await runPackageAction(
    () => bookingApiRequest(`${adminPackagePath(code)}/order`, { method: "PATCH", body: JSON.stringify({ direction }) }),
  );
}

/* ----- assistant FAQs ----- */
async function faqApiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Unable to reach the FAQ service.");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new SyntaxError("The FAQ service returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "Unable to complete the FAQ request.",
    );
  }
  return result;
}

async function loadFaqs(force = false) {
  if (faqLoading || (faqsLoaded && !force)) return;
  faqLoading = true;
  faqLoadError = "";
  try {
    const result = await faqApiRequest("/api/admin/faqs");
    if (!Array.isArray(result.faqs)) {
      throw new TypeError("The FAQ service returned invalid FAQ data.");
    }
    faqs = result.faqs;
    faqsLoaded = true;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("FAQ loading failed:", errorName);
    faqLoadError =
      error instanceof Error ? error.message : "Unable to load FAQs.";
  } finally {
    faqLoading = false;
    if (page === "admin" && adminTab === "faqs") render();
  }
}

function faqCardMarkup(faq) {
  const active = faq.active !== false;
  const faqId = safe(faq._id);
  const keywords = Array.isArray(faq.keywords) ? faq.keywords : [];
  const statusClass = active ? "badge-success" : "badge-neutral";
  const statusLabel = active ? "Active" : "Inactive";
  const actionLabel = active ? "Deactivate" : "Activate";
  return `<div class="tile" style="margin-top:14px"><div class="admin-header"><div><h3 style="margin:0">${safe(faq.question)}</h3><span class="badge badge-soft ${statusClass}">${statusLabel}</span><div class="chips" style="margin-top:8px">${keywords
    .map((keyword) => `<span class="badge badge-soft badge-primary">${safe(keyword)}</span>`)
    .join("")}</div></div><div class="mini-actions"><button class="btn btn-sm" onclick="openFaqForm('${faqId}')">Edit</button><button class="btn btn-sm" onclick="toggleFaq('${faqId}',${!active})" ${faqSaving ? "disabled" : ""}>${actionLabel}</button><button class="btn btn-soft btn-error btn-sm" onclick="deleteFaq('${faqId}')" ${faqSaving ? "disabled" : ""}>Delete</button></div></div><p class="muted" style="margin-bottom:0;white-space:pre-wrap">${safe(faq.answer)}</p></div>`;
}

function faqContentMarkup() {
  if (faqLoading) return '<div class="notice">Loading FAQs...</div>';
  if (faqLoadError) {
    return `<div class="notice">${safe(faqLoadError)} <button class="btn btn-sm" onclick="loadFaqs(true)">Retry</button></div>`;
  }
  const cards = faqs.map(faqCardMarkup).join("");
  return cards || '<div class="empty">No FAQs yet.</div>';
}

function adminFaqs() {
  if (!faqsLoaded && !faqLoading && !faqLoadError) void loadFaqs();
  const faqContent = faqContentMarkup();
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Assistant FAQs</h3><p class="muted" style="margin:6px 0 0">The assistant matches customer questions to active, administrator-maintained FAQ answers.</p></div><div class="mini-actions"><button class="btn" onclick="loadFaqs(true)" ${faqLoading ? "disabled" : ""}>Refresh</button><button class="btn btn-primary" onclick="openFaqForm()">＋ Add FAQ</button></div></div><div class="tile" style="margin-top:16px"><h3 style="margin-top:0">Test the assistant</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input w-full" id="faqTestInput" placeholder="Type a customer question…" style="flex:1;min-width:200px;padding:10px;border:1px solid #cfd9d0;border-radius:9px" onkeydown="if(event.key==='Enter')testFaq()"><button class="btn" onclick="testFaq()">Test</button></div><div id="faqTest" class="notice" style="margin-top:10px">The answer will appear here.</div></div>${faqContent}</div>`;
}

async function testFaq() {
  const message = V("faqTestInput");
  const resultElement = document.getElementById("faqTest");
  if (!resultElement) return;
  if (!message) {
    resultElement.textContent = "Type a question first.";
    return;
  }
  resultElement.textContent = "Checking active FAQ answers...";
  try {
    const result = await faqApiRequest("/api/chatbot/message", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    resultElement.textContent = result.answer;
  } catch (error) {
    resultElement.textContent =
      error instanceof Error ? error.message : "Unable to test the assistant.";
  }
}

function openFaqForm(id) {
  const faq = id ? faqs.find((item) => item._id === id) : null;
  const keywords = Array.isArray(faq?.keywords) ? faq.keywords.join(", ") : "";
  openModal(
    faq ? "Edit FAQ" : "Add FAQ",
    "",
    `${fld("m_fq", "Question", faq?.question, "text", 'maxlength="300"')}${fld("m_fk", "Keywords (comma-separated)", keywords, "text", 'maxlength="1000" placeholder="e.g. crayfish, craylings"')}<div class="field"><label for="m_fa">Predefined answer shown to the customer</label><textarea class="textarea w-full" id="m_fa" maxlength="5000" style="min-height:120px">${safe(faq?.answer || "")}</textarea></div><label class="check-row"><input class="checkbox checkbox-primary checkbox-sm mt-0.5" type="checkbox" id="m_factive" ${faq?.active === false ? "" : "checked"}><span>Active and available to customers</span></label>`,
    `<button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveFaq('${faq ? safe(faq._id) : ""}')">${faq ? "Save FAQ" : "Add FAQ"}</button>`,
  );
}

async function saveFaq(id) {
  if (faqSaving) return;
  const question = V("m_fq");
  const keywords = V("m_fk")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const answer = V("m_fa");
  const active = document.getElementById("m_factive")?.checked ?? true;
  if (!question || !keywords.length || !answer) {
    toast("Question, keywords and answer are all required.");
    return;
  }

  faqSaving = true;
  try {
    const result = await faqApiRequest(
      id ? `/api/admin/faqs/${encodeURIComponent(id)}` : "/api/admin/faqs",
      {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ question, keywords, answer, active }),
      },
    );
    if (id) {
      faqs = faqs.map((faq) => (faq._id === id ? result.faq : faq));
    } else {
      faqs.unshift(result.faq);
    }
    faqsLoaded = true;
    faqLoadError = "";
    closeModal();
    toast(id ? "FAQ updated." : "FAQ added.");
    faqSaving = false;
    render();
  } catch (error) {
    toast(error instanceof Error ? error.message : "Unable to save FAQ.");
  } finally {
    faqSaving = false;
  }
}

async function toggleFaq(id, active) {
  if (faqSaving) return;
  faqSaving = true;
  try {
    const result = await faqApiRequest(
      `/api/admin/faqs/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ active }),
      },
    );
    faqs = faqs.map((faq) => (faq._id === id ? result.faq : faq));
    toast(active ? "FAQ activated." : "FAQ deactivated.");
    faqSaving = false;
    render();
  } catch (error) {
    toast(error instanceof Error ? error.message : "Unable to update FAQ.");
  } finally {
    faqSaving = false;
  }
}

async function deleteFaq(id) {
  if (faqSaving || !faqs.some((faq) => faq._id === id)) return;
  if (!confirm("Delete this FAQ?")) return;
  faqSaving = true;
  try {
    await faqApiRequest(`/api/admin/faqs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    faqs = faqs.filter((faq) => faq._id !== id);
    toast("FAQ deleted.");
    faqSaving = false;
    render();
  } catch (error) {
    toast(error instanceof Error ? error.message : "Unable to delete FAQ.");
  } finally {
    faqSaving = false;
  }
}

/* ----- sales ----- */
/** Sales come only from Verified payments; booking value is reported separately. */
function adminSales() {
  const figures = adminMoneyFigures();
  const paidOnBookings = sumMoney(adminServiceBookings.map((b) => b.paidAmount));
  const history = verifiedPaymentRows().sort(
    (a, b) => new Date(b.payment.verifiedAt) - new Date(a.payment.verifiedAt),
  );
  // Both totals come from the backend and must agree; flag it if they ever do not.
  const integrityNotice =
    Math.abs(paidOnBookings - figures.received) > 0.001
      ? `<div class="notice" role="alert" style="background:#fde5e5;border-color:#f1d1d1;color:#a33d3d;margin-top:12px">Verified payments (${money(figures.received)}) do not match the paid amounts recorded on bookings (${money(paidOnBookings)}). Review the payment records before relying on these totals.</div>`
      : "";
  const bookingRows = adminServiceBookings.length
    ? adminServiceBookings.map(salesBookingRow).join("")
    : '<tr><td colspan="7" class="muted">No bookings yet.</td></tr>';
  const paymentRows = history.length
    ? history.map(salesPaymentRow).join("")
    : '<tr><td colspan="8" class="muted">No verified transactions yet.</td></tr>';
  return `<div class="stat-grid"><div class="stat"><div class="label">Verified money received</div><div class="value" style="font-size:22px">${money(figures.received)}</div></div><div class="stat"><div class="label">Booked value (confirmed bookings)</div><div class="value" style="font-size:22px">${money(figures.bookedValue)}</div></div><div class="stat"><div class="label">Still to collect (confirmed bookings)</div><div class="value" style="font-size:22px">${money(figures.toCollect)}</div>${awaitingDepositNote(figures)}</div></div><div class="panel"><div class="admin-header"><h3 style="margin:0">Sales & transaction records</h3><span class="muted" style="font-size:12px">Verified transactions only</span></div><div class="notice" style="margin-top:12px">A submitted receipt is not counted as a sale until you verify the actual GCash transaction. Pending and rejected payments are never included.</div>${integrityNotice}<div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Booking status</th><th>Total (with delivery)</th><th>Payment status</th><th>Verified received</th><th>Still to collect</th></tr></thead><tbody>${bookingRows}</tbody></table></div><h3 style="margin-top:24px">Verified payment history</h3><div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Payment type</th><th>Amount</th><th>GCash reference</th><th>Receipt file</th><th>Verified</th><th>Status</th></tr></thead><tbody>${paymentRows}</tbody></table></div></div>`;
}
function salesBookingRow(booking) {
  let outstanding = money(booking.balance);
  if (["Rejected", "Cancelled"].includes(booking.booking)) outstanding = "—";
  else if (!COMMITTED_BOOKING_STATUSES.has(booking.booking)) {
    outstanding = '<span class="muted">Awaiting deposit</span>';
  }
  return `<tr><td>${safe(booking.ref)}</td><td>${safe(booking.name)}</td><td>${safe(booking.booking)}</td><td>${money(booking.total)}</td><td>${safe(booking.payment)}</td><td>${money(booking.paidAmount || 0)}</td><td>${outstanding}</td></tr>`;
}
function salesPaymentRow({ booking, payment }) {
  const paymentType =
    payment.paymentTarget === "deposit" ? "50% down payment" : "Remaining balance";
  const verifier = staffName(payment.verifiedBy);
  return `<tr><td>${safe(booking.ref)}</td><td>${safe(booking.name)}</td><td>${paymentType}</td><td>${money(payment.amount)}</td><td>${safe(payment.gcashReference || "—")}</td><td>${safe(payment.receiptFileName)}</td><td>${safe(serverTime(payment.verifiedAt))}${verifier ? `<br><span class="muted">by ${safe(verifier)}</span>` : ""}<br><span class="muted">Submitted ${safe(serverTime(payment.submittedAt))}</span></td><td><span class="badge badge-soft badge-success">${safe(payment.status)}</span></td></tr>`;
}

/* ----- render ----- */
function render() {
  ensureNavigationShell();
  if (["home", "shop", "booking"].includes(page) && packageCatalogState === "idle") {
    void loadServicePackages();
  }
  if (page === "home") {
    renderHomePage();
  }
  if (page === "mybookings" && customerBookingsState === "idle") {
    void loadCustomerBookings();
  }
  if (page === "admin" && adminDataState === "idle") {
    void loadAdminData();
  }
  if (page === "admin" && adminTab === "catalog" && adminPackagesState === "idle") {
    void loadAdminPackages();
  }
  renderCurrentPage();
  syncNavigationLinks();
  bindCurrentPageForms();
  if (page === "mybookings") markBookingsSeen();
  updateNavBadge();
  window.dispatchEvent(new Event("app:render"));
}
function renderHomePage() {
  const template = document.getElementById("homeTemplate");
  if (template) app.replaceChildren(template.content.cloneNode(true));
  const packages = activePackages();
  const price = document.getElementById("homePackagePrice");
  if (!price) return;
  if (packages.length) {
    price.textContent = `From ${money(Math.min(...packages.map((item) => item.price)))}`;
  } else {
    price.textContent = packageCatalogState === "loaded" ? "Packages coming soon" : "";
  }
}
function renderCurrentPage() {
  if (page === "home") return;
  if (page === "customer-login") {
    app.replaceChildren();
    return;
  }
  const views = {
    about,
    shop,
    booking,
    success,
    mybookings,
    customerpayment: customerPaymentPage,
    register,
    admin,
  };
  app.innerHTML = (views[page] || about)();
}
function syncNavigationLinks() {
  document
    .querySelectorAll(".nav a[data-page]")
    .forEach((link) => {
      link.classList.toggle("active", link.dataset.page === page);
    });
}
function bindCurrentPageForms() {
  if (page === "register") {
    bindRegisterForm();
  }
}
function bindRegisterForm() {
  const registerForm = document.getElementById("registerForm");
  if (!registerForm) return;
  registerForm.onsubmit = (event) => {
    event.preventDefault();
    userName = document.getElementById("regName").value.trim();
    upsertCustomer({ name: userName });
    loggedIn = true;
    alert("Account created for this session.");
    setPage("mybookings");
  };
}

window.addEventListener("app:session-change", (event) => {
  loggedIn = event.detail === true || Boolean(event.detail?.id);
  if (event.detail?.firstName) userName = event.detail.firstName;
  const nextCustomer = event.detail?.id ? event.detail : null;
  if (nextCustomer?.id !== sessionCustomer?.id) {
    // Never show one account's cached bookings to another account.
    customerBookings = [];
    customerVisits = [];
    customerBookingsState = "idle";
    pendingServiceBooking = null;
  }
  sessionCustomer = nextCustomer;
  syncNavigationLinks();
  if (page === "mybookings") render();
});
window.addEventListener("app:navigate", (event) => {
  const targetPage = event.detail;
  if (typeof targetPage === "string" && Object.hasOwn(pageFiles, targetPage))
    setPage(targetPage);
});

function markBookingsSeen() {
  myBookingList().forEach((booking) =>
    (booking.timeline || []).forEach((event) => {
      event.seen = true;
    }),
  );
}

document.querySelectorAll("#footerYear, .footer-year").forEach((year) => {
  year.textContent = new Date().getFullYear();
});

const chatLaunch = document.getElementById("chatLaunch");
const chatBox = document.getElementById("chatBox");
const chatClose = document.getElementById("chatClose");
const chatForm = document.getElementById("chatForm");

if (chatLaunch && chatBox) {
  chatLaunch.onclick = () => {
    chatBox.style.display = "block";
    chatLaunch.setAttribute("aria-expanded", "true");
    document.getElementById("chatText")?.focus();
  };
}
if (chatClose && chatBox) {
  chatClose.onclick = () => {
    chatBox.style.display = "none";
    chatLaunch?.setAttribute("aria-expanded", "false");
    chatLaunch?.focus();
  };
  chatBox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") chatClose.click();
  });
}
function appendChatBubble(container, message, isUser = false, link = null) {
  const row = document.createElement("div");
  row.className = isUser ? "chat chat-end" : "chat chat-start";
  const bubble = document.createElement("div");
  bubble.className = isUser
    ? "chat-bubble chat-bubble-primary text-sm whitespace-pre-line"
    : "chat-bubble bg-base-100 text-base-content text-sm whitespace-pre-line";
  bubble.textContent = message;
  row.append(bubble);
  if (!isUser && link) {
    const safeLink =
      typeof link.label === "string" &&
      Boolean(link.label.trim()) &&
      typeof link.href === "string" &&
      link.href.startsWith("/") &&
      !link.href.startsWith("//") &&
      !link.href.includes("\\") &&
      !/[\u0000-\u0020]/.test(link.href) &&
      new URL(link.href, window.location.origin).origin ===
        window.location.origin;
    if (safeLink) {
      const linkElement = document.createElement("a");
      linkElement.className = "chat-link btn btn-primary btn-xs mt-2";
      linkElement.href = link.href;
      linkElement.textContent = link.label;
      bubble.append(document.createElement("br"), linkElement);
    } else {
      console.error("ARC Assistant returned an invalid link.");
    }
  }
  container.append(row);
}
if (chatForm) {
  chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById("chatText"),
      body = document.getElementById("chatBody"),
      submitButton = chatForm.querySelector('button[type="submit"]'),
      q = input?.value.trim();
    if (!input || !body || !q) return;
    appendChatBubble(body, q, true);
    input.value = "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.setAttribute("aria-label", "Sending…");
    }
    try {
      const response = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const result = await response.json();
      if (
        !response.ok ||
        result?.success !== true ||
        typeof result.answer !== "string"
      ) {
        throw new Error("Chatbot request failed.");
      }
      appendChatBubble(body, result.answer, false, result.link);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("ARC Assistant request failed:", errorName);
      appendChatBubble(
        body,
        "The assistant is temporarily unavailable. Please try again or contact the farm directly.",
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.setAttribute("aria-busy", "false");
        submitButton.setAttribute("aria-label", "Send message");
      }
      body.scrollTop = body.scrollHeight;
    }
  };
}

// Delegation keeps navigation working when the homepage renders its navbar inside the hero.
document.addEventListener("click", (e) => {
  const link = e.target.closest(".nav a[data-page]");
  if (link) {
    e.preventDefault();
    if (link.dataset.page === "booking") bookingType = null;
    setPage(link.dataset.page);
    return;
  }

  const actionButton = e.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "start-booking") startBooking();
  if (action === "show-packages") setPage("shop");
  if (action === "show-about") setPage("about");
  if (action === "custom-pond") choosePkgById("custom");
  if (action === "show-visit") chooseBookingType("visit");
});
window.addEventListener("popstate", () => {
  const pathname = location.pathname;
  let end = pathname.length;
  while (end > 1 && pathname.charAt(end - 1) === "/") end -= 1;
  const currentPath = pathname.slice(0, end) || "/";
  const route = Object.keys(pageFiles).find((key) => pageFiles[key] === currentPath);
  if (route) {
    page = route;
    syncPageChrome(route);
    document
      .querySelectorAll(".nav a[data-page]")
      .forEach((link) =>
        link.classList.toggle("active", link.dataset.page === route),
      );
    render();
  }
});
window.addEventListener("app:route-change", (event) => {
  const targetPage = event.detail;
  if (typeof targetPage !== "string" || !Object.hasOwn(pageFiles, targetPage)) return;
  page = targetPage;
  syncPageChrome(targetPage);
  render();
});
render();
