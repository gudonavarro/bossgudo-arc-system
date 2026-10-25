const app = document.getElementById("app");
let page = document.body.dataset.page || "home",
  wizardStep = 1,
  selectedPackage = "Pond Grower Package",
  selectedLayers = "2 layers",
  filtration = "Yes",
  pondWidth = 2,
  pondHeight = 3,
  extraNotes = "",
  selectedDate = "",
  calMonth = 10,
  calYear = 2026,
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
  successKind = "service",
  currentVisitRef = null;
const TODAY = new Date(2026, 9, 21),
  TODAY_ISO = "2026-10-21",
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
  (b.timeline = b.timeline || []).push({ at: ts(), text, seen });
}
function nextRef(prefix, list) {
  let max = 0;
  list.forEach((x) => {
    const m = String(x.ref).match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
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
  t.classList.add("show");
  clearTimeout(window._tt);
  window._tt = setTimeout(() => t.classList.remove("show"), 3400);
}
function openModal(title, sub, body, foot, wide) {
  document.getElementById("modalHost").innerHTML =
    `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><div class="modal-head"><div>${sub ? `<div class="muted" style="font-size:12px;margin-bottom:3px">${sub}</div>` : ""}<h3>${title}</h3></div><button class="secondary small" onclick="closeModal()" aria-label="Close">✕</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ""}</div></div>`;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  document.getElementById("modalHost").innerHTML = "";
  document.body.style.overflow = "";
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
function fld(id, label, val, type = "text", attrs = "") {
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${safe(val ?? "")}" ${attrs}></div>`;
}
function sel(id, label, opts, val, attrs = "") {
  return `<div class="field"><label for="${id}">${label}</label><select id="${id}" ${attrs}>${opts
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
let currentRef = "BG-2026-001",
  paymentTargetRef = null;
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
let faqs = [
  {
    id: "f1",
    question: "How do payments, deposits and delivery work?",
    keywords: "pay,payment,gcash,deposit,delivery,balance,lalamove,refund",
    answer:
      "You pay a 50% down payment in GCash when you book and upload your receipt. Your booking is confirmed once the owner verifies it. After the service is done, the owner adds any Lalamove delivery fee and you pay the remaining balance in My Bookings. Down payments are non-refundable.",
  },
  {
    id: "f2",
    question: "How much does it cost?",
    keywords: "price,cost,how much",
    answer:
      "Package prices are shown on the Packages and Bookings pages. A service booking needs a 50% down payment, and any Lalamove delivery fee is quoted separately by the owner after the service is done.",
  },
  {
    id: "f3",
    question: "How do I book?",
    keywords: "book,schedule,date,appointment",
    answer:
      "Open the Bookings page and choose Book a Service or Book a Visitation. For a service, pick your package, then your date, then your details, and pay the 50% GCash down payment. Farm visits are for 1–5 visitors on available weekends, and special dates are reviewed by the admin.",
  },
  {
    id: "f4",
    question: "Is training available?",
    keywords: "training,train,learn",
    answer:
      "Training and support may be available. Please confirm the current training requirements with the owner before receiving crayfish.",
  },
  {
    id: "f5",
    question: "Where is the farm?",
    keywords: "location,address,where",
    answer:
      "BOSSGUDO A.R.C. AQUA FARM is located in Bacao II, General Trias, Cavite. Please contact the owner to confirm visit arrangements.",
  },
  {
    id: "f6",
    question: "What pond options are there?",
    keywords: "pond,setup,layer,filtration",
    answer:
      "Choose a predefined pond package, or design a custom pond with your own layers (up to 3), size and filtration. The price updates automatically from your pond size.",
  },
  {
    id: "f7",
    question: "What does the farm offer?",
    keywords: "crayfish,supply,arc",
    answer:
      "The farm offers Australian Red Claw crayfish-related services. Visit Packages to explore pond packages or design your own pond.",
  },
  {
    id: "f8",
    question: "How do I contact the owner?",
    keywords: "contact,phone,message",
    answer:
      "For questions not covered here, please contact the farm owner through the business’s official contact channel.",
  },
];

/* ---------- package catalog ---------- */
let pondPackageCatalog = [
  {
    id: "pk1",
    name: "Pond Starter Package",
    image:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
    description: "A compact starter pond setup for new growers.",
    price: 6500,
    layers: "1 layer",
    dimensions: "2 m × 2 m",
    freebie: "Free starter water-test kit",
    featured: false,
    active: true,
  },
  {
    id: "pk2",
    name: "Pond Grower Package",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80",
    description: "A larger pond setup for customers ready to expand.",
    price: 9500,
    layers: "2 layers",
    dimensions: "2 m × 3 m",
    freebie: "Free 500 g starter crayfish feed",
    featured: true,
    active: true,
  },
  {
    id: "pk3",
    name: "Pond Pro Package",
    image:
      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=900&q=80",
    description: "A larger three-layer setup for more advanced use.",
    price: 14500,
    layers: "3 layers",
    dimensions: "3 m × 3 m",
    freebie: "Free 10 juvenile crayfish",
    featured: false,
    active: true,
  },
];
let pondRatePerSqmPerLayer = 450,
  filtrationEstimate = 1500;
const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80";
function activePackages() {
  return pondPackageCatalog.filter((x) => x.active !== false);
}
function isCustomPond() {
  return selectedPackage === "Custom Pond Design";
}
function selectedPondPackage() {
  return activePackages().find((x) => x.name === selectedPackage) || null;
}
function packagePhoto(x, cls = "package-photo") {
  return `<img class="${cls}" src="${safe(x.image || FALLBACK_IMG)}" alt="${safe(x.name)} photo" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">`;
}
function pkgImg(x) {
  return `<img src="${safe(x.image || FALLBACK_IMG)}" alt="${safe(x.name)}" loading="lazy" onerror="this.style.display='none'">`;
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
  if (id === "custom") selectedPackage = "Custom Pond Design";
  else {
    const p = pondPackageCatalog.find((x) => x.id === id);
    if (p) selectedPackage = p.name;
  }
  render();
}
function choosePkgById(id) {
  pickPkg(id);
  bookingType = "service";
  wizardStep = 1;
  setPage("booking");
}

/* ---------- booking lifecycle helpers ---------- */
/* Booking status: Pending -> Confirmed (automatic when the 50% down payment is verified) -> Completed (service done).
   Payment status: Awaiting Deposit / Pending Verification -> Partially Paid -> (after delivery fee) Pending Verification -> Paid. */
function stageOf(b) {
  if (["Rejected", "Cancelled"].includes(b.booking)) return -1;
  if (b.booking === "Pending") return 0;
  if (b.booking === "Confirmed") return 1;
  if (b.booking === "Completed") {
    if (b.payment === "Paid") return 4;
    if (b.deliveryFee != null) return 3;
    return 2;
  }
  return 0;
}
function bookingClass(s) {
  return ["Confirmed", "Completed"].includes(s)
    ? "green"
    : ["Rejected", "Cancelled"].includes(s)
      ? "red"
      : "";
}
function payClass(p) {
  return p === "Paid"
    ? "green"
    : p === "Rejected"
      ? "red"
      : p === "Awaiting Deposit"
        ? "gray"
        : "";
}
function canPay(b) {
  if (b.payment === "Pending Verification") return null;
  if (["Rejected", "Cancelled"].includes(b.booking)) return null;
  if (
    b.booking === "Pending" &&
    !(b.paidAmount > 0) &&
    ["Awaiting Deposit", "Rejected"].includes(b.payment)
  )
    return "deposit";
  if (
    b.booking === "Completed" &&
    b.deliveryFee != null &&
    b.balance > 0 &&
    b.paidAmount > 0 &&
    ["Partially Paid", "Rejected"].includes(b.payment)
  )
    return "balance";
  return null;
}
function customerMsg(b) {
  if (b.booking === "Rejected")
    return "The owner could not accept this booking. Please contact the farm for details.";
  if (b.booking === "Cancelled")
    return "This booking was cancelled. The 50% down payment is non-refundable under the booking policy.";
  if (b.payment === "Pending Verification")
    return b.proof && b.proof.target === "balance"
      ? "Your balance receipt is being checked against the GCash transaction. You will get an update here once it is verified."
      : "Your 50% down payment receipt is being checked against the GCash transaction. Your booking is confirmed automatically once the owner verifies it.";
  if (b.payment === "Rejected")
    return "The owner could not verify your last receipt. Please check the details and resubmit.";
  if (b.payment === "Awaiting Deposit")
    return "Pay the 50% down payment to reserve your date.";
  if (b.booking === "Confirmed")
    return "Your booking is confirmed and your date is reserved. After the service is done, the owner will add any delivery fee and you can pay the remaining balance here.";
  if (b.booking === "Completed" && b.payment === "Paid")
    return "Service completed and fully paid. Thank you!";
  if (b.booking === "Completed" && b.deliveryFee == null)
    return "Service completed. The owner will confirm the delivery fee next, then you can pay your remaining balance here.";
  if (b.booking === "Completed")
    return "The delivery fee has been added. Please pay your outstanding balance to finish.";
  return "";
}
function nextAction(b) {
  if (["Rejected", "Cancelled"].includes(b.booking))
    return { done: true, label: "Closed" };
  if (b.payment === "Pending Verification")
    return {
      label:
        b.proof && b.proof.target === "balance"
          ? "Verify balance payment"
          : "Verify down payment",
      fn: `reviewPayment('${b.ref}')`,
      cls: "primary",
    };
  if (b.booking === "Confirmed")
    return {
      label: "Mark service completed",
      fn: `updateBooking('${b.ref}','Completed')`,
      cls: "primary",
    };
  if (
    b.booking === "Completed" &&
    b.payment !== "Paid" &&
    b.deliveryFee == null
  )
    return {
      label: "Set delivery fee",
      fn: `openPricing('${b.ref}')`,
      cls: "primary",
    };
  if (b.booking === "Completed" && b.payment !== "Paid")
    return {
      wait:
        b.payment === "Rejected"
          ? "Waiting for corrected balance receipt"
          : "Waiting for customer to pay balance",
    };
  if (b.booking === "Pending")
    return {
      wait:
        b.payment === "Rejected"
          ? "Waiting for corrected receipt"
          : "Waiting for down payment",
    };
  return { done: true, label: "All done" };
}
function tracker(b) {
  const s = stageOf(b);
  if (s < 0)
    return `<div class="notice">This booking is ${safe(b.booking.toLowerCase())}.</div>`;
  return `<div class="tracker">${[
    "Submitted",
    "Confirmed",
    "Service done",
    "Delivery & balance",
    "Fully paid",
  ]
    .map((l, i) => {
      const done = i < s || s === 4;
      return `<div class="t-step ${done ? "done" : i === s ? "current" : ""}"><div class="t-dot">${done ? "✓" : i + 1}</div>${l}</div>`;
    })
    .join("")}</div>`;
}
function timelineHtml(b, showNew) {
  const t = (b.timeline || []).slice().reverse();
  return t.length
    ? `<ul class="timeline">${t.map((e) => `<li>${safe(e.text)}${showNew && !e.seen ? '<span class="tag-new">NEW</span>' : ""}<span class="when">${safe(e.at)}</span></li>`).join("")}</ul>`
    : '<p class="muted">No updates yet.</p>';
}
function myBookingList() {
  return bookings.filter(
    (b) => b.name === userName || userName === "Customer Account",
  );
}
function myUnread() {
  return myBookingList().reduce(
    (s, b) => s + (b.timeline || []).filter((e) => !e.seen).length,
    0,
  );
}
function updateNavBadge() {
  const n = myUnread(),
    buttons = document.querySelectorAll('.nav a[data-page="mybookings"]');
  buttons.forEach((btn) => {
    btn.innerHTML =
      "My Bookings" + (n ? `<span class="badge">${n}</span>` : "");
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
const pageFiles = {
  home: "index.html",
  about: "about.html",
  packages: "packages.html",
  booking: "booking.html",
  mybookings: "mybookings.html",
  login: "login.html",
  admin: "admin.html",
};
const pageTitles = {
  home: "Home",
  about: "About",
  packages: "Packages",
  booking: "Bookings",
  mybookings: "My Bookings",
  login: "Log In",
  admin: "Admin Dashboard",
  register: "Create an Account",
  success: "Booking Submitted",
  customerpayment: "Payment",
};
function syncPageChrome(nextPage) {
  document.body.dataset.page = nextPage;
  document.title = `${pageTitles[nextPage] || "Home"} | BOSSGUDO A.R.C. AQUA FARM`;
}
function ensureNavigationShell() {
  let shell = document.querySelector("body > header.topbar");
  if (!shell) return;
  shell.hidden = page === "home";
}
function setPage(p) {
  const file = pageFiles[p];
  if (file && location.pathname.split("/").pop() !== file)
    history.pushState({ page: p }, "", file);
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
  return `<div class="wizard-steps" style="--n:${steps.length}">${steps.map((s, i) => `<div class="wizard-step ${cur === i + 1 ? "active" : cur > i + 1 ? "done" : ""}">${i + 1}. ${s}</div>`).join("")}</div>`;
}
function startBooking() {
  bookingType = null;
  setPage("booking");
}
function calendarHtml(kind = "service", mode = "select") {
  let first = new Date(calYear, calMonth, 1).getDay(),
    days = new Date(calYear, calMonth + 1, 0).getDate(),
    sel = kind === "visit" ? visitDate : selectedDate,
    blocked = blockedDates[kind],
    html = "";
  for (let i = 0; i < first; i++) html += '<div class="day"></div>';
  for (let d = 1; d <= days; d++) {
    let dt = new Date(calYear, calMonth, d),
      weekend = dt.getDay() === 0 || dt.getDay() === 6,
      past = dt < TODAY,
      val = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      open = weekend && !past,
      isBlocked = blocked.has(val),
      cls = "day",
      click = "",
      title = "Not selectable";
    if (open) cls += isBlocked ? " unavailable" : " available";
    if (mode === "admin") {
      if (open) {
        click = `onclick="toggleBlock('${kind}','${val}')"`;
        title = isBlocked ? "Closed. Click to reopen" : "Open. Click to close";
      }
    } else {
      if (open && !isBlocked) {
        click = `onclick="pickDate('${kind}','${val}')"`;
        title = "Available";
      } else if (open) title = "Unavailable";
      if (sel === val) cls += " selected";
    }
    html += `<div class="${cls}" ${click ? `${click} role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"` : ""} title="${title}">${d}</div>`;
  }
  return html;
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
  return `<div class="calendar"><div class="cal-head"><button onclick="changeMonth(-1)" aria-label="Previous month">←</button><strong>${new Date(calYear, calMonth, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}</strong><button onclick="changeMonth(1)" aria-label="Next month">→</button></div><div class="cal-grid">${DAYNAMES.map((x) => `<div class="cal-dayname">${x}</div>`).join("")}${calendarHtml(kind, mode)}</div><div class="legend">${mode === "admin" ? '<span><i class="dot" style="background:#8cc596"></i>Open</span><span><i class="dot" style="background:#df9696"></i>Closed</span><span><i class="dot" style="background:#d8ddd5"></i>Not adjustable</span>' : '<span><i class="dot" style="background:#8cc596"></i>Available</span><span><i class="dot" style="background:#df9696"></i>Unavailable</span><span><i class="dot" style="background:#d8ddd5"></i>Not selectable</span>'}</div></div>`;
}
function login() {
  return `<div class="panel auth-card"><div style="text-align:center"><div class="logo" style="margin:0 auto 15px">🦞</div><h1 class="page-title" style="font-size:27px">Welcome back</h1><p class="muted">Sign in to track your booking requests.</p></div><form id="loginForm"><div class="field"><label>Email address</label><input type="email" id="loginEmail" required placeholder="you@example.com" value="customer@example.com"></div><div class="field"><label>Password</label><input type="password" id="loginPassword" required placeholder="Enter password"></div><button class="primary">Log In</button></form><button class="secondary" style="width:100%;margin-top:12px" onclick="setPage('register')">Create an account</button></div>`;
}
function register() {
  return `<div class="panel auth-card"><div style="text-align:center"><h1 class="page-title">Create an account</h1><p class="muted">Register to submit and track bookings.</p></div><form id="registerForm"><div class="field"><label>Full name</label><input id="regName" required placeholder="Your full name"></div><div class="field"><label>Email address</label><input type="email" required placeholder="you@example.com"></div><div class="field"><label>Password</label><input type="password" required minlength="6" placeholder="At least 6 characters"></div><button class="primary">Create Account</button></form></div>`;
}
function about() {
  return `<div class="breadcrumbs">Home / About</div><h1 class="page-title">About BOSSGUDO A.R.C. AQUA FARM</h1><p class="muted">Learn about the business and its services.</p><div class="panel" style="display:grid;grid-template-columns:1fr 1fr;gap:25px;align-items:center"><div><div class="eyebrow" style="color:var(--green)">About the farm</div><h2>Supporting new and growing crayfish enthusiasts</h2><p class="muted" style="line-height:1.8">BOSSGUDO A.R.C. AQUA FARM provides Australian Red Claw crayfish supply, pond setup assistance, training, and after-sales support. The farm aims to help customers understand the basics of raising crayfish and setting up suitable ponds.</p><p class="muted" style="line-height:1.8">Use the booking page to book a pond service or schedule a farm visit.</p><button class="primary" onclick="startBooking()">Book Now</button></div><div style="border-radius:18px;background:linear-gradient(145deg,#e3eee2,#a9c9ad);padding:35px;text-align:center;font-size:95px">🦞<div style="font-size:14px;font-weight:800;color:var(--green)">Australian Red Claw (ARC)</div></div></div><div class="section-head"><div><h2>What you can ask about</h2><p>Use the assistant for predefined FAQs or contact the owner for special requests.</p></div></div><div class="grid3"><div class="card"><h3>Packages & services</h3><p>Ask about supply, pond setup, and combined options.</p></div><div class="card"><h3>Training & support</h3><p>Ask the owner about training requirements and available support.</p></div><div class="card"><h3>Bookings & visits</h3><p>Book a service or schedule a farm visit on an available weekend.</p></div></div>`;
}
function readReceiptAsDataURL(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Unable to read receipt file."));
    reader.readAsDataURL(file);
  });
}
function viewPaymentProof(ref) {
  let b = bookings.find((x) => x.ref === ref);
  if (!b || !b.proof || !b.proof.dataUrl) {
    alert(
      "No receipt file is available for this booking. Ask the customer to resubmit the proof.",
    );
    return;
  }
  let w = window.open();
  if (!w) {
    alert(
      "Your browser blocked the receipt preview. Allow pop-ups for this page and try again.",
    );
    return;
  }
  w.document.write(
    `<title>Payment receipt — ${safe(b.ref)}</title><body style="font-family:Arial,sans-serif;padding:20px;color:#243129"><h2>Payment receipt — ${safe(b.ref)}</h2><p>Customer: ${safe(b.name)}</p><p>GCash reference: ${safe(b.proof.reference)}</p><p>Submitted amount: ${money(b.proof.amount)}</p><p>File: ${safe(b.proof.fileName)}</p><hr>${b.proof.dataUrl.startsWith("data:application/pdf") ? `<iframe src="${b.proof.dataUrl}" style="width:100%;height:80vh;border:0"></iframe>` : `<img src="${b.proof.dataUrl}" alt="Uploaded payment receipt" style="max-width:100%;height:auto">`}</body>`,
  );
  w.document.close();
}
function bookingChooser() {
  return `<div class="breadcrumbs">Home / Bookings</div><h1 class="page-title">Booking</h1><h2 style="margin:6px 0 0;font-size:20px">What would you like to book today?</h2><div class="choice-grid"><div class="card choice"><div class="service-icon">🌊</div><h3>Book a Service</h3><p>Pond packages, manufacturing, installation, and custom pond design.</p><button class="primary" onclick="chooseBookingType('service')">Select Service</button></div><div class="card choice"><div class="service-icon">🏡</div><h3>Book a Visitation</h3><p>Schedule a farm visit for 1–5 visitors on available weekends.</p><button class="primary" onclick="chooseBookingType('visit')">Select Visitation</button></div></div>`;
}
function chooseBookingType(t) {
  bookingType = t;
  wizardStep = 1;
  visitStep = 1;
  setPage("booking");
}
function changeBookingType() {
  bookingType = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function qrPlaceholder() {
  return `<div style="width:220px;height:220px;margin:16px auto;background:#fff;border:1px solid #d7ded7;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:12px"><div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);gap:3px;opacity:.8">${Array.from(
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
  const g = (id) => (document.getElementById(id)?.value || "").trim();
  if (!document.getElementById("customerName")) return;
  window.bookingDraft = {
    ...(window.bookingDraft || {}),
    name: g("customerName"),
    phone: g("phone"),
    email: g("email"),
    location: g("location"),
    notes: extraNotes || window.bookingDraft?.notes || "",
  };
}
function servicePhoto() {
  let p = selectedPondPackage();
  return p
    ? packagePhoto(p)
    : `<img class="package-photo" src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=85" alt="Custom pond design">`;
}
function reviewStep() {
  let d = window.bookingDraft || {},
    p = currentPricing(),
    preset = selectedPondPackage();
  return `<h2>Review your booking</h2><p class="muted">Check the package, booking information, and price. Then continue to payment.</p><div class="review-grid"><div>${servicePhoto()}</div><div><h3 style="margin-top:0">${safe(selectedPackage)}</h3>${preset ? `<p class="muted" style="margin-top:0">${safe(preset.description)}</p><div class="summary-line"><span>Pond configuration</span><strong>${safe(preset.layers)} · ${safe(preset.dimensions)}</strong></div><div class="summary-line"><span>Included freebie</span><strong>${safe(preset.freebie)}</strong></div>` : `<div class="summary-line"><span>Pond size</span><strong>${Number(pondWidth).toFixed(1)} m × ${Number(pondHeight).toFixed(1)} m (${(pondWidth * pondHeight).toFixed(2)} m²)</strong></div><div class="summary-line"><span>Layers</span><strong>${safe(selectedLayers)}</strong></div><div class="summary-line"><span>Filtration</span><strong>${safe(filtration)}</strong></div>`}${d.notes ? `<div class="summary-line"><span>Notes for the owner</span><strong>${safe(d.notes)}</strong></div>` : ""}</div></div><div class="panel"><h3>Booking information</h3><div class="summary-line"><span>Preferred date</span><strong>${selectedDate ? fmtDate(selectedDate, true) : "Not selected"}</strong></div><div class="summary-line"><span>Name</span><strong>${safe(d.name || "")}</strong></div><div class="summary-line"><span>Contact number</span><strong>${safe(d.phone || "")}</strong></div><div class="summary-line"><span>Email</span><strong>${safe(d.email || "Not provided")}</strong></div><div class="summary-line"><span>Service location</span><strong>${safe(d.location || "")}</strong></div></div><div class="panel"><h3>Price</h3>${preset ? `<div class="summary-line"><span>Package price</span><strong>${money(p.base)}</strong></div>` : `<div class="summary-line"><span>Custom pond price (based on size, layers, filtration)</span><strong>${money(p.cust)}</strong></div>`}<div class="summary-line"><span>Total service price</span><strong>${money(p.total)}</strong></div><div class="summary-line"><span>50% down payment due now</span><strong style="color:var(--green)">${money(p.deposit)}</strong></div><div class="summary-line"><span>Remaining balance</span><strong>${money(p.balance)}</strong></div><p class="muted" style="font-size:12px;margin-bottom:0">After the service is done, the owner adds any Lalamove delivery fee and you pay the remaining balance in My Bookings.</p></div><div class="callout" style="margin-top:18px"><strong>No-refund policy.</strong> ${NO_REFUND_POLICY}<label class="check-row"><input type="checkbox" id="policyBox" ${policyAccepted ? "checked" : ""} onchange="policyAccepted=this.checked"><span>I understand and accept the no-refund policy.</span></label></div><div class="wizard-actions"><button class="secondary" onclick="wizardStep=3;render()">← Back</button><button class="primary" onclick="goPayment()">Continue to Payment →</button></div>`;
}
function paymentStep() {
  let p = currentPricing();
  return `<h2>Payment</h2><p class="muted">Pay the 50% down payment in GCash, then upload your receipt. Your booking and receipt are submitted together, and your booking is confirmed once the owner verifies your payment.</p><div class="pay-grid"><div class="card" style="text-align:center"><h3>Scan to pay with GCash</h3>${qrPlaceholder()}<p class="muted" style="font-size:12px">Scan the QR code or use the owner’s GCash account details.</p></div><div class="card"><h3>Owner's GCash details</h3><div class="summary-line"><span>Account name</span><strong>[Owner's GCash account name]</strong></div><div class="summary-line"><span>GCash number</span><strong>[Owner's GCash number]</strong></div><div class="summary-line"><span>Package</span><strong>${safe(selectedPackage)}</strong></div><div class="summary-line"><span>Total service price</span><strong>${money(p.total)}</strong></div><div class="summary-line"><span>50% down payment to pay now</span><strong style="font-size:23px;color:var(--green)">${money(p.deposit)}</strong></div><div class="notice" style="margin-top:15px">Open GCash, scan the QR or use the account details above, and pay the exact amount. After the transfer succeeds, upload your receipt below and submit.</div></div></div><div class="panel" style="margin-top:20px"><h3>Upload payment receipt</h3><p class="muted">Your booking is submitted together with this receipt. The owner checks the receipt against the actual GCash transaction.</p><div class="field"><label for="gcashReference">GCash transaction reference number *</label><input id="gcashReference" placeholder="Enter the transaction reference number" required></div><div class="field"><label for="gcashProof">Payment receipt / screenshot *</label><input id="gcashProof" type="file" accept="image/*,.pdf" required><p class="muted" style="font-size:12px;margin-top:6px">Accepted: image or PDF, up to 8 MB.</p></div><div class="wizard-actions"><button class="secondary" onclick="wizardStep=4;render()">← Back</button><button class="primary" onclick="submitBooking()">Submit Booking and Receipt</button></div></div>`;
}
function booking() {
  return bookingType === "service"
    ? serviceBooking()
    : bookingType === "visit"
      ? visitBooking()
      : bookingChooser();
}
function visitSuccess() {
  let v = visits.find((x) => x.ref === currentVisitRef);
  let sp = v.type === "Special";
  return `<div class="panel success"><div class="bigcheck">✓</div><h1>${sp ? "Special date request submitted" : "Visitation booked"}</h1><p class="muted">${sp ? "The admin will review your request. The visit is not confirmed until the request is approved." : "Your farm visit is booked. You can track it in My Bookings."}</p><div class="card" style="max-width:480px;margin:22px auto;text-align:left"><div class="summary-line"><span>Reference number</span><strong>${v.ref}</strong></div><div class="summary-line"><span>Status</span><span class="status ${visitStatusClass(v.status)}">${safe(v.status)}</span></div><div class="summary-line"><span>Visit date</span><strong>${fmtDate(v.date, true)}</strong></div><div class="summary-line"><span>Visitors</span><strong>${v.visitors}</strong></div></div><button class="primary" onclick="setPage('mybookings')">Track My Booking</button> <button class="secondary" onclick="setPage('home')">Back to Home</button></div>`;
}
function visitStatusClass(s) {
  return ["Booked", "Approved", "Completed"].includes(s)
    ? "green"
    : ["Declined", "Cancelled"].includes(s)
      ? "red"
      : "";
}
function visitBooking() {
  return `<div class="breadcrumbs">Home / Bookings / Book a Visitation</div><div class="admin-header"><div><h1 class="page-title">Book a Visitation</h1><p class="muted">Visit the farm with 1–5 visitors on an available Saturday or Sunday.</p></div><button class="secondary small" onclick="changeBookingType()">Change booking type</button></div>${wizardHeader(["Date", "Details", "Review"], visitStep)}<div class="panel">${visitStep === 1 ? visitDateStep() : visitStep === 2 ? visitDetailsStep() : visitReviewStep()}</div>`;
}
function visitDateStep() {
  if (visitMode === "special")
    return `<h2>Request a special date</h2><p class="muted">Use this for a date outside the regular weekend schedule, such as a weekday or a closed weekend. The admin reviews every request, and the visit is not confirmed until it is approved.</p><div class="field-grid"><div class="field"><label for="specialDate">Requested date</label><input id="specialDate" type="date" min="2026-10-22" value="${safe(visitDate)}" onchange="visitDate=this.value"></div><div class="field"><label for="specialReason">Reason for this date</label><input id="specialReason" maxlength="160" value="${safe(visitReason)}" placeholder="e.g. Only available on weekdays" oninput="visitReason=this.value"></div></div><div class="wizard-actions"><button class="secondary" onclick="setVisitMode('regular')">← Back to weekend calendar</button><button class="primary" onclick="visitToDetails()">Continue to Details →</button></div>`;
  return `<h2>Select a visit date</h2><p class="muted">Farm visits are open on available Saturdays and Sundays. Calendar availability is managed by the farm.</p><div class="calendar-wrap" style="margin-top:18px">${calendarBlock("visit")}<div><div class="card"><h3>Selected date</h3><p>${visitDate ? fmtDate(visitDate, true) : "Choose an available green date"}</p><div class="notice">Each visit is for 1–5 visitors.</div></div></div></div><div class="panel"><div class="admin-header"><div><h3 style="margin:0">Need a different date?</h3><p class="muted" style="margin:6px 0 0">Dates outside the regular weekend schedule need admin review.</p></div><button class="secondary" onclick="setVisitMode('special')">Request a special date</button></div></div><div class="wizard-actions"><button class="secondary" onclick="changeBookingType()">← Back</button><button class="primary" onclick="visitToDetails()">Continue to Details →</button></div>`;
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
  } else {
    if (!visitDate || blockedDates.visit.has(visitDate)) {
      visitDate = "";
      alert("Please choose an available Saturday or Sunday.");
      render();
      return;
    }
  }
  visitStep = 2;
  render();
}
function visitDetailsStep() {
  let d = visitDraft;
  return `<h2>Visitor details</h2><p class="muted">Visit date: <strong>${fmtDate(visitDate, true)}</strong>${visitMode === "special" ? " (special date request)" : ""}</p><div class="field-grid"><div class="field"><label for="vName">Full name</label><input id="vName" value="${safe(d.name || userName)}" placeholder="Full name"></div><div class="field"><label for="vEmail">Email</label><input id="vEmail" type="email" value="${safe(d.email || "")}" placeholder="you@example.com"></div><div class="field"><label for="vPhone">Contact number</label><input id="vPhone" value="${safe(d.phone || "")}" placeholder="09XX XXX XXXX"></div><div class="field"><label for="vFarm">Farm name (optional)</label><input id="vFarm" value="${safe(d.farm || "")}" placeholder="Your farm, if you have one"></div><div class="field"><label for="vVisitors">Number of visitors (maximum 5)</label><select id="vVisitors">${[1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${Number(d.visitors || 1) === n ? "selected" : ""}>${n}</option>`).join("")}</select></div></div><div class="wizard-actions"><button class="secondary" onclick="readVisit();visitStep=1;render()">← Back</button><button class="primary" onclick="visitToReview()">Continue to Review →</button></div>`;
}
function readVisit() {
  const g = (id) => (document.getElementById(id)?.value || "").trim();
  if (!document.getElementById("vName")) return;
  visitDraft = {
    name: g("vName"),
    email: g("vEmail"),
    phone: g("vPhone"),
    farm: g("vFarm"),
    visitors: Math.min(5, Math.max(1, Number(g("vVisitors")) || 1)),
  };
}
function visitToReview() {
  readVisit();
  let d = visitDraft;
  if (!d.name || !d.phone) {
    alert("Please enter your name and contact number.");
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(d.email)) {
    alert("Please enter a valid email address.");
    return;
  }
  visitStep = 3;
  render();
}
function visitReviewStep() {
  let d = visitDraft,
    sp = visitMode === "special";
  return `<h2>Review your ${sp ? "special date request" : "visitation"}</h2><p class="muted">Check the date and your information before submitting.</p><div class="panel"><div class="summary-line"><span>Visit date</span><strong>${fmtDate(visitDate, true)}</strong></div>${sp ? `<div class="summary-line"><span>Request type</span><strong>Special date (admin review)</strong></div><div class="summary-line"><span>Reason</span><strong>${safe(visitReason)}</strong></div>` : ""}<div class="summary-line"><span>Name</span><strong>${safe(d.name)}</strong></div><div class="summary-line"><span>Email</span><strong>${safe(d.email)}</strong></div><div class="summary-line"><span>Contact number</span><strong>${safe(d.phone)}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(d.farm || "Not provided")}</strong></div><div class="summary-line"><span>Number of visitors</span><strong>${d.visitors}</strong></div><div class="notice" style="margin-top:15px">${sp ? "This date is outside the regular schedule. The admin will review your request before the visit is confirmed." : "Your visit will be booked for this date when you submit."}</div></div><div class="wizard-actions"><button class="secondary" onclick="visitStep=2;render()">← Back</button><button class="primary" onclick="submitVisit()">${sp ? "Submit Special Date Request" : "Submit Visitation Booking"}</button></div>`;
}
function submitVisit() {
  let d = visitDraft,
    sp = visitMode === "special";
  if (!sp && blockedDates.visit.has(visitDate)) {
    alert("That date has just been closed. Please choose another date.");
    visitDate = "";
    visitStep = 1;
    render();
    return;
  }
  let ref = "VS-2026-" + String(visits.length + 1).padStart(3, "0");
  visits.unshift({
    ref,
    name: d.name,
    email: d.email,
    phone: d.phone,
    farm: d.farm || "",
    visitors: Number(d.visitors),
    date: visitDate,
    type: sp ? "Special" : "Regular",
    status: sp ? "Pending Review" : "Booked",
    reason: sp ? visitReason : "",
    submittedAt: fmtDate(TODAY_ISO),
  });
  upsertCustomer(d);
  userName = d.name;
  currentVisitRef = ref;
  successKind = "visit";
  bookingType = null;
  visitStep = 1;
  visitMode = "regular";
  visitDate = "";
  visitReason = "";
  visitDraft = {};
  setPage("success");
}
function updateVisit(ref, status) {
  let v = visits.find((x) => x.ref === ref);
  if (!v) return;
  if (status === "Approved") {
    if (v.status !== "Pending Review") return;
    v.status = "Approved";
    alert("Special date approved. The customer can see it in My Bookings.");
  } else if (status === "Declined") {
    if (v.status !== "Pending Review") return;
    if (!confirm("Decline this special date request?")) return;
    v.status = "Declined";
  } else if (status === "Completed") {
    if (!["Booked", "Approved"].includes(v.status)) return;
    v.status = "Completed";
  } else if (status === "Cancelled") {
    if (!["Booked", "Approved"].includes(v.status)) return;
    if (!confirm("Cancel this visitation?")) return;
    v.status = "Cancelled";
  }
  render();
}
function adminCalendar() {
  let k = calKind,
    closed = [...blockedDates[k]].sort();
  return `<div class="panel"><div class="admin-header"><div><h3>Calendar Controls</h3><p class="muted">Open or close weekend dates. Customers can select only open dates.</p></div><div class="pill-row"><button class="${k === "service" ? "primary" : "secondary"} small" onclick="setCalKind('service')">Package service calendar</button><button class="${k === "visit" ? "primary" : "secondary"} small" onclick="setCalKind('visit')">Visitation calendar</button></div></div><div class="calendar-wrap" style="margin-top:18px">${calendarBlock(k, "admin")}<div><div class="card"><h3>Closed dates</h3>${closed.length ? closed.map((d) => `<div class="summary-line"><span>${fmtDate(d)}</span><button class="secondary small" onclick="toggleBlock('${k}','${d}')">Reopen</button></div>`).join("") : '<p class="muted">No closed dates.</p>'}</div></div></div><div class="notice" style="margin-top:16px">Click a weekend date to close or reopen it. Past dates cannot be changed. Closing a date does not cancel existing bookings.</div></div>`;
}
function pkgCardPublic(x) {
  return `<article class="pkg-card"><div class="pkg-media">${pkgImg(x)}${x.featured ? '<span class="pkg-badge">★ MOST POPULAR</span>' : ""}</div><div class="pkg-body"><h3>${safe(x.name)}</h3><p>${safe(x.description)}</p><div class="chips"><span class="chip">${safe(x.layers)}</span><span class="chip">${safe(x.dimensions)}</span></div><div class="freebie"><span>🎁</span><span><strong>Free with this package</strong><br>${safe(x.freebie)}</span></div><div class="pkg-foot"><div class="price-big"><small>Package price</small>${money(x.price)}</div><button class="primary" onclick="choosePkgById('${x.id}')">Choose</button></div></div></article>`;
}
function pkgCardCustom() {
  return `<article class="pkg-card custom"><div class="pkg-media"><span>📐</span></div><div class="pkg-body"><h3>Custom Pond Design</h3><p>None of the packages fit? Choose 1–3 layers, enter your pond’s width and length, and decide on filtration.</p><div class="chips"><span class="chip">Up to 3 layers</span><span class="chip">Your own size</span></div><div class="pkg-foot"><div class="price-big"><small>Price from your size</small>${money(pondRatePerSqmPerLayer)}<small>per m² per layer</small></div><button class="primary" onclick="choosePkgById('custom')">Design</button></div></div></article>`;
}
function packages() {
  const act = activePackages();
  return `<div class="breadcrumbs">Home / Packages</div><h1 class="page-title">Pond Installation Packages</h1><p class="muted">Browse the owner’s predefined pond packages, each with one included freebie. Choose one option per booking, or design your own pond.</p><div class="pkg-grid" style="margin-top:24px">${act.map(pkgCardPublic).join("")}${pkgCardCustom()}</div><div class="notice" style="margin-top:22px"><strong>How pricing works.</strong> Custom pond price = width × length × ${money(pondRatePerSqmPerLayer)} per m² per layer, plus ${money(filtrationEstimate)} if filtration is selected. You pay 50% when you book; your booking is confirmed once the owner verifies that payment. After the service is done, the owner adds any Lalamove delivery fee and you pay the remaining balance.</div>`;
}

function pkgCardSelect(x, custom) {
  const sel = custom ? isCustomPond() : selectedPackage === x.name,
    id = custom ? "custom" : x.id,
    name = custom ? "Custom Pond Design" : x.name;
  return `<div class="pkg-card ${custom ? "custom" : ""} ${sel ? "selected" : ""}" role="button" tabindex="0" aria-pressed="${sel}" onclick="pickPkg('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pickPkg('${id}')}"><div class="pkg-media">${custom ? "<span>📐</span>" : pkgImg(x)}${!custom && x.featured ? '<span class="pkg-badge">★ MOST POPULAR</span>' : ""}${sel ? '<span class="pkg-tick">✓</span>' : ""}</div><div class="pkg-body"><h3>${safe(name)}</h3><p>${custom ? "Build your own pond: layers, size and filtration." : safe(x.description)}</p>${custom ? '<div class="chips"><span class="chip">Up to 3 layers</span><span class="chip">Your own size</span></div>' : `<div class="chips"><span class="chip">${safe(x.layers)}</span><span class="chip">${safe(x.dimensions)}</span></div><div class="freebie"><span>🎁</span><span><strong>Free:</strong> ${safe(x.freebie)}</span></div>`}<div class="pkg-foot"><div class="price-big"><small>${custom ? "Price from your size" : "Package price"}</small>${custom ? "Computed" : money(x.price)}</div>${sel ? '<span class="status green">Selected</span>' : '<span class="status gray">Tap to select</span>'}</div></div></div>`;
}
function packageStep() {
  const predefined = selectedPondPackage();
  return `<h2>Choose one service option</h2><p class="muted">Select one predefined package (each includes a freebie), or choose Custom Pond Design to set your own layers and dimensions.</p><div class="pkg-grid" style="margin-top:18px">${activePackages()
    .map((x) => pkgCardSelect(x, false))
    .join(
      "",
    )}${pkgCardSelect(null, true)}</div>${isCustomPond() ? `<div class="panel" style="margin-top:18px"><h3 style="margin-top:0">Customize your pond</h3><p class="muted">Choose 1 to 3 layers and enter your pond’s width and length in metres. The price updates automatically.</p><div class="field-grid"><div class="field"><label for="layers">Number of pond layers (maximum 3)</label><select id="layers" onchange="selectedLayers=this.value;render()"><option value="1 layer" ${selectedLayers === "1 layer" ? "selected" : ""}>1 layer</option><option value="2 layers" ${selectedLayers === "2 layers" ? "selected" : ""}>2 layers</option><option value="3 layers" ${selectedLayers === "3 layers" ? "selected" : ""}>3 layers</option></select></div><div class="field"><label for="filtration">Filtration system</label><select id="filtration" onchange="filtration=this.value;render()"><option value="Yes" ${filtration === "Yes" ? "selected" : ""}>Yes (+ ${money(filtrationEstimate)})</option><option value="No" ${filtration === "No" ? "selected" : ""}>No</option></select></div><div class="field"><label for="pondWidth">Width (metres)</label><input id="pondWidth" type="number" min="1" max="10" step="0.5" value="${pondWidth}" oninput="pondWidth=Math.min(10,Math.max(1,Number(this.value)||1));updatePondEstimate()" onchange="pondWidth=Math.min(10,Math.max(1,Number(this.value)||1));this.value=pondWidth;updatePondEstimate()"></div><div class="field"><label for="pondHeight">Length (metres)</label><input id="pondHeight" type="number" min="1" max="10" step="0.5" value="${pondHeight}" oninput="pondHeight=Math.min(10,Math.max(1,Number(this.value)||1));updatePondEstimate()" onchange="pondHeight=Math.min(10,Math.max(1,Number(this.value)||1));this.value=pondHeight;updatePondEstimate()"></div></div><div class="summary-line"><span>Pond area</span><strong id="pondArea">${(pondWidth * pondHeight).toFixed(2)} m²</strong></div><div class="summary-line"><span>Custom pond price</span><strong id="pondEstimate">${money(pondCustomizationEstimate())}</strong></div><p class="muted" style="font-size:12px;margin-bottom:0">Formula: width × length × ${money(pondRatePerSqmPerLayer)} per m² per layer, plus ${money(filtrationEstimate)} if filtration is selected.</p></div>` : predefined ? `<div class="panel" style="margin-top:18px"><h3 style="margin-top:0">${safe(predefined.name)} details</h3><div class="summary-line"><span>Included pond configuration</span><strong>${safe(predefined.layers)} · ${safe(predefined.dimensions)}</strong></div><div class="summary-line"><span>Predefined freebie</span><strong>${safe(predefined.freebie)}</strong></div><p class="muted" style="margin-bottom:0">The package uses the owner’s predefined setup. For different dimensions or layers, select Custom Pond Design instead.</p></div>` : ""}<div class="panel"><h3 style="margin-top:0">Additional request (optional)</h3><div class="field"><label for="notes">Notes for the owner</label><textarea id="notes" placeholder="Share any other requirements..." oninput="extraNotes=this.value">${safe(extraNotes || window.bookingDraft?.notes || "")}</textarea></div></div><div class="wizard-actions"><button class="secondary" onclick="changeBookingType()">← Back</button><button class="primary" onclick="continueToSchedule()">Continue to Date →</button></div>`;
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
  return `<h2>Choose your service date</h2><p class="muted">Pick your preferred date first, then enter your details. Service dates are open on weekends only. Calendar availability is managed by the farm.</p><div class="calendar-wrap" style="margin-top:14px">${calendarBlock("service")}<div><div class="card"><h3 style="margin-top:0">Selected date</h3><p>${selectedDate ? fmtDate(selectedDate, true) : "Choose an available green date"}</p><div class="notice">Choose any open weekend date. Closed dates cannot be selected. Your date is reserved once your 50% down payment is verified.</div></div><div class="card" style="margin-top:12px"><h3 style="margin-top:0">Your option</h3><p style="margin:0"><strong>${safe(selectedPackage)}</strong><br><span class="muted">${money(p.total)} · 50% down payment ${money(p.deposit)}</span></p></div></div></div><div class="wizard-actions"><button class="secondary" onclick="wizardStep=1;render()">← Back</button><button class="primary" onclick="goDetails()">Continue to Details →</button></div>`;
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
  return `<h2>Your details</h2><div class="notice" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><span>📅 Service date: <strong>${selectedDate ? fmtDate(selectedDate, true) : "Not selected"}</strong> · ${safe(selectedPackage)}</span><button class="secondary small" onclick="readDetails();wizardStep=2;render()">Change date</button></div><div class="panel"><h3 style="margin-top:0">Customer details</h3><div class="field-grid"><div class="field"><label for="customerName">Full name</label><input id="customerName" value="${safe(d.name || userName)}" placeholder="Full name"></div><div class="field"><label for="phone">Contact number</label><input id="phone" value="${safe(d.phone || "")}" placeholder="09XX XXX XXXX"></div><div class="field"><label for="email">Email (optional)</label><input id="email" type="email" value="${safe(d.email || "")}" placeholder="you@example.com"></div><div class="field"><label for="location">Service location</label><input id="location" value="${safe(d.location || "")}" placeholder="Complete service address"></div></div></div><div class="wizard-actions"><button class="secondary" onclick="readDetails();wizardStep=2;render()">← Back</button><button class="primary" onclick="goReview()">Continue to Review →</button></div>`;
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
async function submitBooking() {
  if (submitting) return;
  const d = window.bookingDraft || {};
  if (!selectedDate || !d.name || !d.phone || !d.location) {
    alert(
      "Some booking details are missing. Go back and complete the Date and Details steps.",
    );
    return;
  }
  if (!policyAccepted) {
    alert("Please accept the no-refund policy first.");
    return;
  }
  const reference = document.getElementById("gcashReference")?.value.trim(),
    file = document.getElementById("gcashProof")?.files?.[0];
  if (!reference) {
    alert("Enter the GCash transaction reference number.");
    return;
  }
  if (!file) {
    alert("Please upload your GCash receipt or payment screenshot.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("Please upload a receipt smaller than 8 MB.");
    return;
  }
  submitting = true;
  let dataUrl;
  try {
    dataUrl = await readReceiptAsDataURL(file);
  } catch (e) {
    submitting = false;
    alert("The receipt file could not be read. Please try again.");
    return;
  }
  const p = currentPricing(),
    preset = selectedPondPackage(),
    ref = nextRef("BG-2026-", bookings);
  const b = {
    ref,
    name: d.name,
    pkg: selectedPackage,
    freebie: preset ? preset.freebie : "",
    packageLayers: preset ? preset.layers : "",
    packageDimensions: preset ? preset.dimensions : "",
    date: fmtDate(selectedDate),
    isoDate: selectedDate,
    booking: "Pending",
    payment: "Pending Verification",
    servicePrice: p.base,
    customizationFee: p.cust,
    deliveryFee: null,
    total: p.total,
    deposit: p.deposit,
    balance: p.balance,
    location: d.location,
    phone: d.phone,
    email: d.email || "",
    notes: d.notes || "",
    layers: isCustomPond()
      ? selectedLayers
      : preset
        ? preset.layers
        : "Not applicable",
    pondWidth: isCustomPond() ? Number(pondWidth) : null,
    pondHeight: isCustomPond() ? Number(pondHeight) : null,
    pondArea: isCustomPond() ? Number(pondWidth) * Number(pondHeight) : null,
    filtration: isCustomPond()
      ? filtration
      : "Included in package / not applicable",
    proof: {
      reference,
      fileName: file.name,
      target: "deposit",
      amount: p.deposit,
      dataUrl,
      submittedAt: ts(),
    },
    pendingPaymentTarget: "deposit",
    paidAmount: 0,
    paymentHistory: [],
    timeline: [],
  };
  addUpdate(
    b,
    "Booking submitted with a 50% down payment receipt (" +
      money(p.deposit) +
      ").",
    true,
  );
  addUpdate(
    b,
    "Waiting for the owner to verify your GCash payment. Your booking is confirmed once it is verified.",
    true,
  );
  bookings.unshift(b);
  upsertCustomer(d);
  currentRef = ref;
  successKind = "service";
  userName = d.name;
  bookingType = null;
  wizardStep = 1;
  selectedDate = "";
  policyAccepted = false;
  extraNotes = "";
  window.bookingDraft = null;
  submitting = false;
  setPage("success");
}
function serviceBooking() {
  if (!isCustomPond() && !selectedPondPackage())
    selectedPackage = activePackages()[0]?.name || "Custom Pond Design";
  return `<div class="breadcrumbs">Home / Bookings / Book a Service</div><div class="admin-header"><div><h1 class="page-title">Book a Service</h1><p class="muted">Choose a package, pick your date, enter your details, review, then pay the 50% down payment.</p></div><button class="secondary small" onclick="changeBookingType()">Change booking type</button></div>${wizardHeader(["Package", "Date", "Details", "Review", "Payment"], wizardStep)}<div class="panel">${wizardStep === 1 ? packageStep() : wizardStep === 2 ? dateStep() : wizardStep === 3 ? detailsStep() : wizardStep === 4 ? reviewStep() : paymentStep()}</div>`;
}

function success() {
  if (successKind === "visit") return visitSuccess();
  const b = bookings.find((x) => x.ref === currentRef);
  return `<div class="panel success"><div class="bigcheck">✓</div><h1>Booking submitted</h1><p class="muted">Your receipt is now waiting for the owner to verify it against the actual GCash transaction. Your booking is <strong>confirmed automatically once your 50% down payment is verified</strong>, and you will see the update in My Bookings.</p><div class="card" style="max-width:480px;margin:22px auto;text-align:left"><div class="summary-line"><span>Reference number</span><strong>${b.ref}</strong></div><div class="summary-line"><span>Booking status</span><span class="status">Pending</span></div><div class="summary-line"><span>Payment status</span><span class="status">Pending Verification</span></div><div class="summary-line"><span>Package</span><strong>${safe(b.pkg)}</strong></div><div class="summary-line"><span>Service date</span><strong>${safe(b.date)}</strong></div><div class="summary-line"><span>50% down payment submitted</span><strong>${money(b.deposit)}</strong></div><div class="summary-line"><span>Remaining balance (due after service)</span><strong>${money(b.balance)}</strong></div></div><button class="primary" onclick="setPage('mybookings')">Track My Booking</button> <button class="secondary" onclick="setPage('home')">Back to Home</button></div>`;
}

function customerBookingCard(b) {
  const t = canPay(b),
    paidLbl =
      b.paidAmount > 0 ? "Outstanding balance" : "Balance after down payment";
  return `<div class="card" style="margin:14px 0"><div class="admin-header"><div><div class="muted" style="font-size:12px">${b.ref} · Service date ${safe(b.date)}</div><h3 style="margin:7px 0">${safe(b.pkg)}</h3></div><div style="display:flex;gap:6px;flex-wrap:wrap"><span class="status ${bookingClass(b.booking)}">Booking: ${safe(b.booking)}</span><span class="status ${payClass(b.payment)}">Payment: ${safe(b.payment)}</span></div></div>${tracker(b)}<div class="notice" style="margin:8px 0 12px">${safe(customerMsg(b))}</div><div class="summary-line"><span>Service location</span><strong>${safe(b.location || "Not specified")}</strong></div><div class="summary-line"><span>Package / customization</span><strong>${money(Number(b.servicePrice) + Number(b.customizationFee || 0))}</strong></div><div class="summary-line"><span>Delivery fee</span><strong>${b.deliveryFee != null ? money(b.deliveryFee) : "Added by owner after the service"}</strong></div><div class="summary-line"><span>Total</span><strong>${money(b.total)}${b.deliveryFee == null ? ' <span class="muted" style="font-weight:500">+ delivery</span>' : ""}</strong></div><div class="summary-line"><span>Verified amount paid</span><strong>${money(b.paidAmount || 0)}</strong></div><div class="summary-line"><span>${paidLbl}</span><strong>${money(b.balance)}</strong></div>${b.proof ? `<div class="summary-line"><span>Submitted reference · file</span><strong>${safe(b.proof.reference)} · ${safe(b.proof.fileName)}</strong></div>` : ""}<div style="margin-top:15px;display:flex;gap:8px;flex-wrap:wrap"><button class="secondary small" onclick="viewBooking('${b.ref}')">View details & updates</button>${t === "deposit" ? `<button class="primary small" onclick="openCustomerPayment('${b.ref}','deposit')">${b.payment === "Rejected" ? "Resubmit down payment receipt" : "Pay 50% down payment"}</button>` : ""}${t === "balance" ? `<button class="primary small" onclick="openCustomerPayment('${b.ref}','balance')">${b.payment === "Rejected" ? "Resubmit balance receipt" : "Pay outstanding balance · " + money(b.balance)}</button>` : ""}</div></div>`;
}
function mybookings() {
  const mine = myBookingList(),
    myVisits = visits.filter(
      (v) => v.name === userName || userName === "Customer Account",
    ),
    fresh = [];
  mine.forEach((b) =>
    (b.timeline || [])
      .filter((e) => !e.seen)
      .forEach((e) => fresh.push({ b, e })),
  );
  return `<div class="breadcrumbs">Customer Portal / My Bookings</div><div class="admin-header"><div><h1 class="page-title">My Bookings</h1><p class="muted">Follow each booking from submission to final payment. Booking status and payment status are tracked separately.</p></div><button class="primary" onclick="startBooking()">+ New Booking</button></div><div class="panel"><div class="pill-row"><span class="pill">Signed in as ${safe(userName)}</span></div></div>${fresh.length ? `<div class="callout" style="margin-top:16px"><strong>🔔 ${fresh.length} new update${fresh.length > 1 ? "s" : ""}</strong><ul class="timeline" style="margin-top:12px">${fresh.map((x) => `<li><strong>${safe(x.b.pkg)} (${x.b.ref}):</strong> ${safe(x.e.text)}<span class="when">${safe(x.e.at)}</span></li>`).join("")}</ul></div>` : ""}<h2 style="margin-top:28px">Service bookings</h2>${mine.map(customerBookingCard).join("") || '<div class="empty">No service bookings yet.</div>'}<h2 style="margin-top:28px">Farm visitations</h2>${myVisits.map((v) => `<div class="card" style="margin:12px 0"><div class="admin-header"><div><div class="muted" style="font-size:12px">${v.ref} · ${v.type === "Special" ? "Special date request" : "Regular schedule"}</div><h3 style="margin:7px 0">${fmtDate(v.date, true)}</h3></div><span class="status ${visitStatusClass(v.status)}">${safe(v.status)}</span></div><div class="summary-line"><span>Visitors</span><strong>${v.visitors}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(v.farm || "Not provided")}</strong></div><div class="summary-line"><span>Contact</span><strong>${safe(v.phone)} · ${safe(v.email)}</strong></div>${v.reason ? `<div class="summary-line"><span>Reason for special date</span><strong>${safe(v.reason)}</strong></div>` : ""}</div>`).join("") || '<div class="empty">No visitations yet.</div>'}<div class="notice" style="margin-top:16px">GCash transfers happen outside this website. The owner manually verifies each transaction before any amount is recorded as received.</div>`;
}

function viewBooking(ref, admin) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b) return;
  const pre = b.packageLayers
    ? `${safe(b.packageLayers)} · ${safe(b.packageDimensions)}`
    : b.pondWidth
      ? `${b.pondWidth} m × ${b.pondHeight} m · ${safe(b.layers)}`
      : safe(b.layers || "—");
  const body = `${tracker(b)}${admin ? "" : `<div class="notice" style="margin:8px 0 12px">${safe(customerMsg(b))}</div>`}<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0"><span class="status ${bookingClass(b.booking)}">Booking: ${safe(b.booking)}</span><span class="status ${payClass(b.payment)}">Payment: ${safe(b.payment)}</span></div><h4 style="margin:16px 0 4px">Booking</h4><div class="summary-line"><span>Customer</span><strong>${safe(b.name)}</strong></div><div class="summary-line"><span>Contact</span><strong>${safe(b.phone || "—")}${b.email ? " · " + safe(b.email) : ""}</strong></div><div class="summary-line"><span>Service location</span><strong>${safe(b.location || "—")}</strong></div><div class="summary-line"><span>Service date</span><strong>${safe(b.date)}</strong></div><div class="summary-line"><span>Pond</span><strong>${pre}${b.pondWidth ? " · Filtration: " + safe(b.filtration) : ""}</strong></div>${b.freebie ? `<div class="summary-line"><span>Freebie</span><strong>${safe(b.freebie)}</strong></div>` : ""}${b.notes ? `<div class="summary-line"><span>Notes</span><strong>${safe(b.notes)}</strong></div>` : ""}<h4 style="margin:18px 0 4px">Pricing</h4><div class="summary-line"><span>Package price</span><strong>${money(b.servicePrice)}</strong></div><div class="summary-line"><span>Customization</span><strong>${money(b.customizationFee || 0)}</strong></div><div class="summary-line"><span>Delivery fee</span><strong>${b.deliveryFee != null ? money(b.deliveryFee) : "Not set yet"}</strong></div><div class="summary-line"><span>Total</span><strong>${money(b.total)}</strong></div><div class="summary-line"><span>50% down payment</span><strong>${money(b.deposit)}</strong></div><div class="summary-line"><span>Verified paid</span><strong>${money(b.paidAmount || 0)}</strong></div><div class="summary-line"><span>Outstanding balance</span><strong>${money(b.balance)}</strong></div>${(b.paymentHistory || []).length ? `<h4 style="margin:18px 0 4px">Verified payments</h4>${b.paymentHistory.map((p) => `<div class="summary-line"><span>${p.target === "deposit" ? "50% down payment" : "Remaining balance"} · ${safe(p.verifiedAt)}</span><strong>${money(p.amount)} · ${safe(p.reference)}</strong></div>`).join("")}` : ""}<h4 style="margin:18px 0 0">Status updates</h4>${timelineHtml(b, !admin)}`;
  openModal(
    safe(b.pkg),
    `${b.ref}`,
    body,
    admin
      ? `<button class="secondary" onclick="closeModal()">Close</button><button class="primary" onclick="openBookingForm('${b.ref}')">Edit booking</button>`
      : `<button class="secondary" onclick="closeModal()">Close</button>`,
    true,
  );
  if (!admin) {
    (b.timeline || []).forEach((e) => (e.seen = true));
    updateNavBadge();
  }
}

function openCustomerPayment(ref, target) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b || canPay(b) !== target) {
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
  const b = bookings.find((x) => x.ref === paymentTargetRef),
    target = window.paymentTarget || "deposit";
  if (!b)
    return `<div class="panel"><h2>Payment details unavailable</h2><button class="primary" onclick="setPage('mybookings')">Return to My Bookings</button></div>`;
  const amount = target === "balance" ? b.balance : b.deposit;
  return `<div class="breadcrumbs">Customer Portal / My Bookings / GCash Payment</div><div class="panel" style="max-width:900px;margin:0 auto"><div class="admin-header"><div><h1 class="page-title">${target === "balance" ? "Pay Outstanding Balance" : "Pay 50% Down Payment"}</h1><p class="muted">Booking ${safe(b.ref)} · ${safe(b.pkg)}</p></div><span class="status green">${target === "balance" ? "Balance payment" : "Down payment"}</span></div><div class="pay-grid"><div class="card" style="text-align:center"><h3>Scan to pay with GCash</h3>${qrPlaceholder()}<p class="muted" style="font-size:12px">Scan the QR code or use the owner’s GCash account details.</p></div><div class="card"><h3>Owner’s GCash details</h3><div class="summary-line"><span>Account name</span><strong>[Owner’s GCash account name]</strong></div><div class="summary-line"><span>GCash number</span><strong>[Owner’s GCash number]</strong></div>${target === "balance" ? `<div class="summary-line"><span>Package / customization</span><strong>${money(Number(b.servicePrice) + Number(b.customizationFee || 0))}</strong></div><div class="summary-line"><span>Delivery fee</span><strong>${money(b.deliveryFee || 0)}</strong></div><div class="summary-line"><span>Already paid (verified)</span><strong>${money(b.paidAmount)}</strong></div>` : `<div class="summary-line"><span>Total service price</span><strong>${money(b.total)}</strong></div>`}<div class="summary-line"><span>Amount to pay now</span><strong style="font-size:23px;color:var(--green)">${money(amount)}</strong></div><div class="notice" style="margin-top:15px">Open GCash, scan the QR or use the details above, and pay the exact amount. After the transfer succeeds, upload your receipt below.</div></div></div><div class="panel" style="margin-top:20px"><h3 style="margin-top:0">Upload payment receipt</h3><p class="muted">The owner compares the reference, receipt and amount with the actual GCash transaction. You will see a status update here once it is verified.</p><div class="field"><label for="gcashReference">GCash transaction reference number *</label><input id="gcashReference" placeholder="Enter the transaction reference number" required></div><div class="field"><label for="gcashProof">Payment receipt / screenshot *</label><input id="gcashProof" type="file" accept="image/*,.pdf" required><p class="muted" style="font-size:12px;margin-top:6px">Accepted: image or PDF, up to 8 MB.</p></div><div class="wizard-actions"><button class="secondary" onclick="setPage('mybookings')">Cancel</button><button class="primary" onclick="submitPaymentProof('${b.ref}','${target}')">I’ve Paid — Submit Receipt</button></div></div></div>`;
}
async function submitPaymentProof(ref, target) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b) return;
  if (b.payment === "Pending Verification") {
    alert("A payment submission is already awaiting owner verification.");
    return;
  }
  if (canPay(b) !== target) {
    alert("This booking is not eligible for that payment right now.");
    return;
  }
  const reference = document.getElementById("gcashReference")?.value.trim(),
    file = document.getElementById("gcashProof")?.files?.[0];
  if (!reference) {
    alert("Enter the GCash transaction reference number.");
    return;
  }
  if (!file) {
    alert("Please upload your GCash receipt or payment screenshot.");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("Please upload a receipt smaller than 8 MB.");
    return;
  }
  const amount = target === "balance" ? b.balance : b.deposit;
  let dataUrl;
  try {
    dataUrl = await readReceiptAsDataURL(file);
  } catch (e) {
    alert("The receipt file could not be read. Please try again.");
    return;
  }
  b.proof = {
    reference,
    fileName: file.name,
    target,
    amount,
    dataUrl,
    submittedAt: ts(),
  };
  b.payment = "Pending Verification";
  b.pendingPaymentTarget = target;
  addUpdate(
    b,
    `You submitted a receipt for your ${target === "balance" ? "outstanding balance" : "50% down payment"} (${money(amount)}). Waiting for the owner to verify it.`,
    true,
  );
  alert(
    "Receipt submitted for verification. You will see a status update in My Bookings once the owner has checked it.",
  );
  setPage("mybookings");
}

/* =================== ADMIN =================== */
function adminCounts() {
  return {
    bookings: bookings.filter((b) => nextAction(b).fn).length,
    payments: bookings.filter(
      (b) => b.payment === "Pending Verification" && b.proof,
    ).length,
    special: visits.filter(
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
  return `<div class="breadcrumbs">Admin Portal / ${cur[1]}</div><div class="admin-header"><div><h1 class="page-title">Admin Dashboard</h1><p class="muted">Manage bookings, payments, visits, the calendar, packages, customers and assistant answers.</p></div></div><div class="layout" style="margin-top:20px"><aside class="sidebar">${tabs.map((t) => (t[0] === "g" ? `<div class="group">${t[1]}</div>` : `<button class="${adminTab === t[0] ? "active" : ""}" onclick="adminTab='${t[0]}';render()">${t[1]}${t[2] ? `<span class="count">${t[2]}</span>` : ""}</button>`)).join("")}</aside><section style="min-width:0">${views[adminTab]()}</section></div>`;
}

function adminOverview() {
  const live = bookings.filter(
      (b) => !["Rejected", "Cancelled"].includes(b.booking),
    ),
    received = bookings.reduce((s, b) => s + Number(b.paidAmount || 0), 0),
    toCollect = live.reduce(
      (s, b) =>
        s + Math.max(0, Number(b.total || 0) - Number(b.paidAmount || 0)),
      0,
    ),
    c = adminCounts(),
    todo = bookings.filter((b) => nextAction(b).fn),
    spec = visits.filter(
      (v) => v.type === "Special" && v.status === "Pending Review",
    ),
    upcomingV = visits.filter((v) => ["Booked", "Approved"].includes(v.status)),
    upcomingB = bookings.filter(
      (b) => b.booking === "Confirmed" && b.isoDate >= TODAY_ISO,
    );
  const coming = [
    ...upcomingB.map((b) => ({
      d: b.isoDate,
      t: "Service",
      l: `${b.ref} · ${b.name} · ${b.pkg}`,
    })),
    ...upcomingV.map((v) => ({
      d: v.date,
      t: "Visit",
      l: `${v.ref} · ${v.name} · ${v.visitors} visitor${v.visitors > 1 ? "s" : ""}`,
    })),
  ].sort((a, b) => a.d.localeCompare(b.d));
  return `<div class="stat-grid"><div class="stat"><div class="label">Needs your action</div><div class="value">${todo.length + spec.length}</div></div><div class="stat" role="button" style="cursor:pointer" onclick="adminTab='payments';render()"><div class="label">Payments to verify</div><div class="value">${c.payments}</div></div><div class="stat"><div class="label">Verified money received</div><div class="value" style="font-size:22px">${money(received)}</div></div></div><div class="stat-grid" style="margin-top:12px"><div class="stat"><div class="label">Active package bookings</div><div class="value">${live.length}</div></div><div class="stat"><div class="label">Upcoming visits</div><div class="value">${upcomingV.length}</div></div><div class="stat"><div class="label">Still to collect</div><div class="value" style="font-size:22px">${money(toCollect)}</div></div></div><div class="panel"><div class="admin-header"><h3 style="margin:0">Action needed</h3><span class="muted" style="font-size:12px">${todo.length + spec.length} item${todo.length + spec.length === 1 ? "" : "s"}</span></div>${todo
    .map((b) => {
      const na = nextAction(b);
      return `<div class="todo"><div><strong>${b.ref} · ${safe(b.name)}</strong><div class="muted">${safe(b.pkg)} · ${safe(b.date)} · ${safe(b.booking)} / ${safe(b.payment)}</div></div><button class="primary small" onclick="${na.fn}">${na.label}</button></div>`;
    })
    .join(
      "",
    )}${spec.map((v) => `<div class="todo"><div><strong>${v.ref} · ${safe(v.name)}</strong><div class="muted">Special-date visit request · ${fmtDate(v.date)}</div></div><button class="primary small" onclick="adminTab='special';render()">Review request</button></div>`).join("")}${todo.length + spec.length ? "" : '<div class="empty">🎉 Nothing needs your attention right now.</div>'}</div><div class="panel"><h3 style="margin-top:0">Coming up</h3>${coming.length ? coming.map((x) => `<div class="summary-line"><span><span class="status gray">${x.t}</span> &nbsp;${safe(x.l)}</span><strong>${fmtDate(x.d)}</strong></div>`).join("") : '<p class="muted">No confirmed services or visits scheduled.</p>'}</div><div class="notice" style="margin-top:15px"><strong>How a booking flows:</strong> customer pays the 50% down payment → you verify it in GCash → the booking is <strong>Confirmed</strong> automatically and the customer sees an update → after the service you mark it <strong>Completed</strong> and add the delivery fee → the customer pays the outstanding balance → you verify it → <strong>Paid</strong>.</div>`;
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
      return b.booking === "Pending";
    case "confirmed":
      return b.booking === "Confirmed";
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
  return `<tr><td><strong>${b.ref}</strong><br>${safe(b.pkg)}<br><span class="muted">${safe(b.layers || "—")}${b.pondWidth ? ` · ${b.pondWidth}×${b.pondHeight} m · Filtration ${safe(b.filtration)}` : ""}</span>${b.freebie ? `<br><span class="muted">🎁 ${safe(b.freebie)}</span>` : ""}</td><td>${safe(b.name)}<br><span class="muted">${safe(b.phone || "")}</span><br><span class="muted">${safe(b.location || "")}</span></td><td>${safe(b.date)}</td><td><span class="status ${bookingClass(b.booking)}">${safe(b.booking)}</span><br><span class="status ${payClass(b.payment)}" style="margin-top:5px">${safe(b.payment)}</span></td><td><strong>${money(b.total)}</strong><br><span class="muted">Paid ${money(b.paidAmount || 0)} · Left ${money(left)}</span><br><span class="muted">Delivery: ${b.deliveryFee == null ? "not set" : money(b.deliveryFee)}</span></td><td>${na.fn ? `<button class="${na.cls} small" onclick="${na.fn}">${na.label}</button>` : na.wait ? `<span class="muted">⏳ ${na.wait}</span>` : `<span class="muted">✓ ${na.label || "Closed"}</span>`}</td><td><div class="actions"><button class="secondary small" onclick="viewBooking('${b.ref}',true)">View</button><button class="secondary small" onclick="openBookingForm('${b.ref}')">Edit</button>${closed ? "" : `<button class="danger small" onclick="updateBooking('${b.ref}','Cancelled')">Cancel</button>`}<button class="danger small" onclick="deleteBooking('${b.ref}')">Delete</button></div></td></tr>`;
}
function bookingTableHtml() {
  const list = bookings.filter(bookingMatches);
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
    ["pending", "Pending"],
    ["confirmed", "Confirmed"],
    ["completed", "Completed"],
    ["closed", "Cancelled / Rejected"],
  ];
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Package Bookings</h3><span class="muted" style="font-size:12px">Pending → Confirmed (when the down payment is verified) → Completed (service done) → balance paid</span></div><button class="primary" onclick="openBookingForm()">＋ New booking</button></div><div class="toolbar"><input type="search" placeholder="Search ref, customer, package, location…" value="${safe(bSearch)}" oninput="bSearch=this.value;refreshBookingTable()" aria-label="Search bookings"><div class="filters">${F.map((f) => `<button class="${bFilter === f[0] ? "active" : ""}" onclick="setBFilter('${f[0]}')">${f[1]}</button>`).join("")}</div></div><div id="bkHost">${bookingTableHtml()}</div></div><div class="notice" style="margin-top:14px">The big buttons in <strong>Next step</strong> walk you through each booking. The customer sees a status update each time you verify a payment, complete the service or add a delivery fee.</div>`;
}
function bfToggleCustom() {
  const s = document.getElementById("m_pkg"),
    box = document.getElementById("m_customBox");
  if (s && box)
    box.classList.toggle("hidden", s.value !== "Custom Pond Design");
}
function openBookingForm(ref) {
  const b = ref ? bookings.find((x) => x.ref === ref) : null;
  if (ref && !b) return;
  const locked =
    !!b && (b.paidAmount > 0 || b.payment === "Pending Verification");
  const names = activePackages().map((x) => x.name);
  if (b && b.pkg !== "Custom Pond Design" && !names.includes(b.pkg))
    names.push(b.pkg);
  const opts = [...names, "Custom Pond Design"],
    cur = b ? b.pkg : opts[0],
    dis = locked ? "disabled" : "";
  const body = `<div class="field-grid">${fld("m_name", "Customer name", b?.name, "text", 'list="custList"')}${fld("m_phone", "Contact number", b?.phone)}${fld("m_email", "Email (optional)", b?.email, "email")}${fld("m_location", "Service location", b?.location)}${fld("m_date", "Service date", b?.isoDate || "", "date")}${sel("m_pkg", "Package / service", opts, cur, `onchange="bfToggleCustom()" ${dis}`)}</div><datalist id="custList">${customers.map((c) => `<option value="${safe(c.name)}">`).join("")}</datalist><div id="m_customBox" class="${cur === "Custom Pond Design" ? "" : "hidden"}"><div class="field-grid">${sel("m_layers", "Layers", ["1 layer", "2 layers", "3 layers"], b?.layers || "2 layers", dis)}${sel("m_filt", "Filtration", ["Yes", "No"], b?.filtration === "No" ? "No" : "Yes", dis)}${fld("m_w", "Width (m)", b?.pondWidth || 2, "number", 'min="1" max="10" step="0.5" ' + dis)}${fld("m_h", "Length (m)", b?.pondHeight || 3, "number", 'min="1" max="10" step="0.5" ' + dis)}</div></div>${locked ? '<div class="notice">Package and pricing are locked because a payment has been verified or is awaiting verification.</div>' : ""}<div class="field"><label for="m_notes">Notes</label><textarea id="m_notes">${safe(b?.notes || "")}</textarea></div>${b ? sel("m_status", "Booking status (owner override)", ["Pending", "Confirmed", "Completed", "Rejected", "Cancelled"], b.booking) + '<p class="muted" style="font-size:12px;margin:0">Normally the status updates by itself: a verified down payment confirms the booking, and “Mark service completed” completes it.</p>' : '<label class="check-row"><input type="checkbox" id="m_deposit"><span>Walk-in: 50% down payment already received and checked (booking becomes Confirmed)</span></label>'}`;
  openModal(
    b ? "Edit booking" : "New booking",
    b ? b.ref : "Create a booking for a walk-in or phone customer",
    body,
    `<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveBooking('${b ? b.ref : ""}')">${b ? "Save changes" : "Create booking"}</button>`,
    true,
  );
}
function saveBooking(ref) {
  const b = ref ? bookings.find((x) => x.ref === ref) : null;
  const name = V("m_name"),
    phone = V("m_phone"),
    email = V("m_email"),
    location = V("m_location"),
    iso = V("m_date"),
    notes = V("m_notes"),
    pkgName = document.getElementById("m_pkg").value;
  if (!name || !phone || !location || !iso) {
    toast("Please complete name, phone, location and date.");
    return;
  }
  const locked =
    !!b && (b.paidAmount > 0 || b.payment === "Pending Verification");
  const custom = pkgName === "Custom Pond Design",
    pre = pondPackageCatalog.find((x) => x.name === pkgName);
  const layers = document.getElementById("m_layers").value,
    filt = document.getElementById("m_filt").value,
    w = Number(V("m_w")) || 1,
    h = Number(V("m_h")) || 1;
  const apply = (o) => {
    if (locked) return;
    o.pkg = pkgName;
    o.freebie = pre ? pre.freebie : "";
    o.packageLayers = pre ? pre.layers : "";
    o.packageDimensions = pre ? pre.dimensions : "";
    o.servicePrice = pre ? pre.price : 0;
    o.customizationFee = custom ? customPrice(layers, w, h, filt) : 0;
    o.deposit = r2((o.servicePrice + o.customizationFee) / 2);
    o.layers = custom ? layers : pre ? pre.layers : "Not applicable";
    o.pondWidth = custom ? w : null;
    o.pondHeight = custom ? h : null;
    o.pondArea = custom ? w * h : null;
    o.filtration = custom ? filt : "Included in package / not applicable";
  };
  if (b) {
    Object.assign(b, {
      name,
      phone,
      email,
      location,
      notes,
      isoDate: iso,
      date: fmtDate(iso),
    });
    apply(b);
    recalc(b);
    const st = V("m_status");
    if (st && st !== b.booking) {
      b.booking = st;
      addUpdate(b, "Booking status updated to " + st + " by the owner.");
    }
    upsertCustomer({ name, phone, email, location });
    closeModal();
    toast("Booking updated.");
  } else {
    const o = {
      ref: nextRef("BG-2026-", bookings),
      name,
      phone,
      email,
      location,
      notes,
      isoDate: iso,
      date: fmtDate(iso),
      booking: "Pending",
      payment: "Awaiting Deposit",
      deliveryFee: null,
      proof: null,
      pendingPaymentTarget: null,
      paidAmount: 0,
      paymentHistory: [],
      timeline: [],
    };
    apply(o);
    o.total = r2(o.servicePrice + o.customizationFee);
    o.balance = r2(o.total - o.deposit);
    addUpdate(
      o,
      "Booking created by the owner. Pay the 50% down payment (" +
        money(o.deposit) +
        ") to reserve your date.",
    );
    if (document.getElementById("m_deposit")?.checked) {
      o.paidAmount = o.deposit;
      o.payment = "Partially Paid";
      o.booking = "Confirmed";
      o.paymentHistory.push({
        target: "deposit",
        amount: o.deposit,
        reference: "Walk-in / manual entry",
        fileName: "—",
        verifiedAt: ts(),
        status: "Verified",
      });
      addUpdate(
        o,
        "Your 50% down payment was recorded. Your booking is confirmed and your date is reserved.",
      );
    }
    recalc(o);
    bookings.unshift(o);
    upsertCustomer({ name, phone, email, location });
    closeModal();
    toast("Booking " + o.ref + " created.");
  }
  render();
}
function deleteBooking(ref) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b) return;
  if (
    !confirm(
      "Permanently delete booking " +
        ref +
        " (" +
        b.name +
        ")? Its payment records will be removed too. Use Cancel instead if you want to keep a record.",
    )
  )
    return;
  bookings = bookings.filter((x) => x.ref !== ref);
  toast("Booking " + ref + " deleted.");
  render();
}
function updateBooking(ref, status) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b) return;
  if (status === "Completed") {
    if (b.booking !== "Confirmed") {
      alert(
        "Only a confirmed booking can be marked completed. Verify the down payment first.",
      );
      return;
    }
    if (
      !confirm(
        "Mark this service as completed? The customer will be notified, then you can add the delivery fee.",
      )
    )
      return;
    b.booking = "Completed";
    addUpdate(
      b,
      "Your service is complete. The owner will confirm the delivery fee next, then you can pay your remaining balance here.",
    );
    render();
    toast("Service completed — customer notified. Next: set the delivery fee.");
    openPricing(ref);
    return;
  }
  if (status === "Cancelled") {
    if (!["Pending", "Confirmed"].includes(b.booking)) {
      alert("Only a pending or confirmed booking can be cancelled.");
      return;
    }
    if (
      !confirm(
        "Cancel booking " +
          ref +
          "? Any down payment already paid is non-refundable.",
      )
    )
      return;
    b.booking = "Cancelled";
    addUpdate(b, "Your booking was cancelled by the owner.");
    toast("Booking cancelled.");
  }
  render();
}
function openPricing(ref) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b) return;
  if (
    b.booking !== "Completed" ||
    b.payment === "Paid" ||
    b.payment === "Pending Verification"
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
    `<p class="muted" style="margin-top:0">The service is done. Enter the confirmed Lalamove quote (enter 0 if there is no delivery). It is added to the outstanding balance, and the customer can then pay the balance from My Bookings.</p><div class="summary-line"><span>Service location</span><strong>${safe(b.location || "Not provided")}</strong></div><div class="summary-line"><span>Package and customization</span><strong>${money(base)}</strong></div><div class="summary-line"><span>Already paid (verified)</span><strong>${money(b.paidAmount || 0)}</strong></div><div class="field"><label for="deliveryFeeInput">Lalamove delivery fee (₱)</label><input id="deliveryFeeInput" type="number" min="0" step="0.01" value="${b.deliveryFee ?? ""}" placeholder="Enter confirmed delivery quote" oninput="pricePreview('${b.ref}')"></div><div class="notice" id="pricePreview">Enter a non-negative delivery fee to preview the new balance.</div>`,
    `<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="savePricing('${b.ref}')">Save & notify customer</button>`,
  );
  pricePreview(ref);
}
function pricePreview(ref) {
  const b = bookings.find((x) => x.ref === ref),
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
function savePricing(ref) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b) return;
  const raw = document.getElementById("deliveryFeeInput")?.value;
  if (
    raw === undefined ||
    raw === "" ||
    !Number.isFinite(Number(raw)) ||
    Number(raw) < 0
  ) {
    alert("Enter the confirmed delivery fee (0 if none).");
    return;
  }
  b.deliveryFee = r2(Number(raw));
  recalc(b);
  if (b.balance <= 0) {
    b.payment = "Paid";
  }
  addUpdate(
    b,
    b.balance > 0
      ? `The delivery fee of ${money(b.deliveryFee)} was added. Your outstanding balance is ${money(b.balance)} — you can pay it now in My Bookings.`
      : "No further balance is due. Your payment is complete.",
  );
  closeModal();
  toast("Delivery fee saved — customer notified.");
  render();
}

/* ----- payments ----- */
function adminPayments() {
  const waiting = bookings.filter(
      (b) => b.payment === "Pending Verification" && b.proof,
    ),
    owed = bookings.filter((b) => canPay(b));
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Needs verification</h3><p class="muted" style="margin:6px 0 0">Check each receipt against the actual GCash transaction before verifying.</p></div><span class="status ${waiting.length ? "" : "green"}">${waiting.length} waiting</span></div><div class="callout" style="margin-top:14px"><strong>Important:</strong> this website does not connect to GCash. Do not verify from the uploaded receipt alone — confirm the money arrived, the reference matches, and the amount is correct.</div>${waiting.length ? waiting.map((b) => `<div class="card" style="margin-top:15px"><div class="admin-header"><div><div class="muted" style="font-size:12px">${safe(b.ref)} · Submitted ${safe(b.proof.submittedAt || "")}</div><h3 style="margin:6px 0">${safe(b.name)} — ${safe(b.pkg)}</h3></div><span class="status">${b.proof.target === "balance" ? "Balance payment" : "50% down payment"}</span></div><div class="summary-line"><span>Transaction reference</span><strong>${safe(b.proof.reference)}</strong></div><div class="summary-line"><span>Submitted amount</span><strong>${money(b.proof.amount)}</strong></div><div class="summary-line"><span>Required amount</span><strong>${money(b.proof.target === "balance" ? b.balance : b.deposit)}</strong></div><div class="summary-line"><span>If verified</span><strong>${b.proof.target === "balance" ? "Payment becomes Paid" : "Booking becomes Confirmed"}</strong></div><div style="margin-top:14px"><button class="primary" onclick="reviewPayment('${b.ref}')">Review & verify</button></div></div>`).join("") : '<div class="empty"><h3>No payments awaiting verification</h3><p>New receipts appear here with their reference, amount and verification actions.</p></div>'}</div><div class="panel"><div class="admin-header"><h3 style="margin:0">Waiting on the customer</h3><span class="muted" style="font-size:12px">${owed.length}</span></div>${owed.length ? `<div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Payment due</th><th>Amount</th><th>Status</th></tr></thead><tbody>${owed.map((b) => `<tr><td><strong>${b.ref}</strong><br><span class="muted">${safe(b.pkg)}</span></td><td>${safe(b.name)}</td><td>${canPay(b) === "balance" ? "Outstanding balance" : "50% down payment"}</td><td>${money(canPay(b) === "balance" ? b.balance : b.deposit)}</td><td><span class="status ${payClass(b.payment)}">${safe(b.payment)}</span></td></tr>`).join("")}</tbody></table></div>` : '<p class="muted">No customer payments are currently due.</p>'}</div>`;
}
function reviewPayment(ref) {
  const b = bookings.find((x) => x.ref === ref);
  if (!b || b.payment !== "Pending Verification" || !b.proof) {
    toast("No receipt is waiting for this booking.");
    return;
  }
  const p = b.proof,
    exp = p.target === "balance" ? b.balance : b.deposit,
    ok = Math.abs(Number(p.amount) - Number(exp)) <= 0.01;
  openModal(
    "Verify GCash payment",
    `${b.ref} · ${safe(b.name)} · ${safe(b.pkg)}`,
    `<div class="callout">Open your GCash transaction history and confirm the money was actually received before verifying.</div><div class="summary-line"><span>Payment type</span><strong>${p.target === "balance" ? "Outstanding balance" : "50% down payment"}</strong></div><div class="summary-line"><span>Transaction reference</span><strong>${safe(p.reference)}</strong></div><div class="summary-line"><span>Submitted amount</span><strong>${money(p.amount)}</strong></div><div class="summary-line"><span>Required amount</span><strong>${money(exp)}</strong></div>${ok ? "" : '<div class="notice" style="background:#fde5e5;border-color:#f1d1d1;color:#a33d3d;margin-top:10px">The submitted amount does not match the required amount. Reject the proof or investigate before verifying.</div>'}<div class="summary-line"><span>Receipt file</span><strong>${safe(p.fileName)}</strong></div><div class="summary-line"><span>Result if verified</span><strong>${p.target === "balance" ? "Payment status becomes Paid" : "Booking becomes Confirmed and the customer is notified"}</strong></div><label class="check-row"><input type="checkbox" id="m_checked"><span>I checked the actual GCash transaction: the money arrived and the reference and amount match.</span></label><div class="field" style="margin-top:14px"><label for="m_reason">Reason (shown to the customer if you reject)</label><input id="m_reason" placeholder="e.g. Reference number not found in GCash"></div>`,
    `<button class="secondary" onclick="closeModal()">Close</button>${p.dataUrl ? `<button class="secondary" onclick="viewPaymentProof('${b.ref}')">View receipt</button>` : ""}<button class="danger" onclick="verifyPayment('${b.ref}',false)">Reject proof</button><button class="primary" onclick="verifyPayment('${b.ref}',true)">Verify payment</button>`,
  );
}
function verifyPayment(ref, valid) {
  try {
    const b = bookings.find((x) => x.ref === ref);
    if (!b || b.payment !== "Pending Verification" || !b.proof) {
      alert("This booking has no receipt awaiting verification.");
      return false;
    }
    const target = b.pendingPaymentTarget || b.proof.target,
      label = target === "balance" ? "outstanding balance" : "50% down payment";
    if (!valid) {
      const reason = V("m_reason");
      b.payment = "Rejected";
      b.lastRejectedProof = { ...b.proof };
      b.proof = null;
      b.pendingPaymentTarget = null;
      addUpdate(
        b,
        `Your ${label} receipt could not be verified${reason ? ": " + reason : ""}. Please check the details and resubmit.`,
      );
      closeModal();
      toast("Proof rejected — customer notified. No money recorded.");
      render();
      return false;
    }
    if (!document.getElementById("m_checked")?.checked) {
      alert(
        "Tick the box to confirm you checked the actual GCash transaction first.",
      );
      return false;
    }
    const amount = Number(b.proof.amount),
      expected = Number(target === "balance" ? b.balance : b.deposit);
    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(expected) ||
      expected <= 0
    ) {
      alert("The required payment amount is missing or invalid.");
      return false;
    }
    if (Math.abs(amount - expected) > 0.01) {
      alert(
        "The submitted amount (" +
          money(amount) +
          ") does not match the required amount (" +
          money(expected) +
          "). Nothing was recorded.",
      );
      return false;
    }
    b.paidAmount = Math.min(
      Number(b.paidAmount || 0) + amount,
      Number(b.total || 0),
    );
    recalc(b);
    b.payment = b.balance <= 0 ? "Paid" : "Partially Paid";
    b.paymentHistory = b.paymentHistory || [];
    b.paymentHistory.push({
      target,
      amount,
      reference: b.proof.reference,
      fileName: b.proof.fileName,
      verifiedAt: ts(),
      status: "Verified",
    });
    b.proof = null;
    b.pendingPaymentTarget = null;
    if (target === "deposit") {
      if (b.booking === "Pending") {
        b.booking = "Confirmed";
      }
      addUpdate(
        b,
        "Your 50% down payment was verified. Your booking is now confirmed and your date is reserved.",
      );
      toast("Down payment verified — booking confirmed and customer notified.");
    } else {
      addUpdate(
        b,
        "Your outstanding balance was verified. Your booking is fully paid. Thank you!",
      );
      toast("Balance verified — booking fully paid, customer notified.");
    }
    closeModal();
    render();
    return true;
  } catch (err) {
    console.error(err);
    alert(
      "The payment could not be verified: " +
        (err && err.message ? err.message : "Unknown error"),
    );
    return false;
  }
}
window.verifyPayment = verifyPayment;

/* ----- visitations ----- */
function setVFilter(f) {
  vFilter = f;
  render();
}
function adminVisits() {
  const base = visits.filter(
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
    list = base
      .filter((v) =>
        vFilter === "upcoming"
          ? ["Booked", "Approved"].includes(v.status)
          : vFilter === "completed"
            ? v.status === "Completed"
            : vFilter === "cancelled"
              ? v.status === "Cancelled"
              : true,
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Visitation Bookings</h3><p class="muted" style="margin:6px 0 0">Farm visits for 1–5 visitors on weekends, including approved special dates.</p></div><button class="primary" onclick="openVisitForm()">＋ Add visit</button></div><div class="toolbar"><div class="filters">${F.map((f) => `<button class="${vFilter === f[0] ? "active" : ""}" onclick="setVFilter('${f[0]}')">${f[1]}</button>`).join("")}</div></div><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Visitor</th><th>Farm</th><th>Visit date</th><th>Visitors</th><th>Type</th><th>Status</th><th>Manage</th></tr></thead><tbody>${list.length ? list.map((v) => `<tr><td><strong>${v.ref}</strong><br><span class="muted">Submitted ${safe(v.submittedAt)}</span></td><td>${safe(v.name)}<br><span class="muted">${safe(v.email)}</span><br><span class="muted">${safe(v.phone)}</span></td><td>${safe(v.farm || "—")}</td><td>${fmtDate(v.date, true)}</td><td>${v.visitors}</td><td>${v.type === "Special" ? "Special date" : "Regular"}</td><td><span class="status ${visitStatusClass(v.status)}">${safe(v.status)}</span></td><td><div class="actions">${["Booked", "Approved"].includes(v.status) ? `<button class="primary small" onclick="updateVisit('${v.ref}','Completed')">Mark completed</button><button class="danger small" onclick="updateVisit('${v.ref}','Cancelled')">Cancel</button>` : ""}<button class="secondary small" onclick="openVisitForm('${v.ref}')">Edit</button><button class="danger small" onclick="deleteVisit('${v.ref}')">Delete</button></div></td></tr>`).join("") : '<tr><td colspan="8" class="muted">No visitation bookings match.</td></tr>'}</tbody></table></div></div>`;
}
function adminSpecial() {
  const list = visits.filter((v) => v.type === "Special"),
    pend = list.filter((v) => v.status === "Pending Review").length;
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Special-Date Requests</h3><p class="muted" style="margin:6px 0 0">Visit requests for dates outside the regular weekend schedule. Approve or decline each one.</p></div><span class="status ${pend ? "" : "green"}">${pend} awaiting review</span></div>${list.length ? list.map((v) => `<div class="card" style="margin-top:15px"><div class="admin-header"><div><div class="muted" style="font-size:12px">${v.ref} · Submitted ${safe(v.submittedAt)}</div><h3 style="margin:6px 0">${fmtDate(v.date, true)}</h3></div><span class="status ${visitStatusClass(v.status)}">${safe(v.status)}</span></div><div class="summary-line"><span>Visitor</span><strong>${safe(v.name)} · ${safe(v.email)} · ${safe(v.phone)}</strong></div><div class="summary-line"><span>Farm name</span><strong>${safe(v.farm || "Not provided")}</strong></div><div class="summary-line"><span>Visitors</span><strong>${v.visitors}</strong></div><div class="summary-line"><span>Reason</span><strong>${safe(v.reason)}</strong></div><div class="actions" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">${v.status === "Pending Review" ? `<button class="primary" onclick="updateVisit('${v.ref}','Approved')">Approve special date</button><button class="danger" onclick="updateVisit('${v.ref}','Declined')">Decline request</button>` : ""}<button class="secondary" onclick="openVisitForm('${v.ref}')">Edit</button><button class="danger" onclick="deleteVisit('${v.ref}')">Delete</button></div></div>`).join("") : '<div class="empty"><h3>No special-date requests</h3><p>Requests for dates outside the regular schedule will appear here.</p></div>'}</div>`;
}
function openVisitForm(ref) {
  const v = ref ? visits.find((x) => x.ref === ref) : null;
  if (ref && !v) return;
  const body = `<div class="field-grid">${fld("m_vname", "Visitor name", v?.name, "text", 'list="custList"')}${fld("m_vphone", "Contact number", v?.phone)}${fld("m_vemail", "Email", v?.email, "email")}${fld("m_vfarm", "Farm name (optional)", v?.farm)}${fld("m_vdate", "Visit date", v?.date || "", "date")}${sel("m_vcount", "Number of visitors (max 5)", [1, 2, 3, 4, 5], v?.visitors || 1)}${sel("m_vtype", "Type", ["Regular", "Special"], v?.type || "Regular")}${sel("m_vstatus", "Status", ["Booked", "Approved", "Pending Review", "Declined", "Completed", "Cancelled"], v?.status || "Booked")}</div><datalist id="custList">${customers.map((c) => `<option value="${safe(c.name)}">`).join("")}</datalist><div class="field"><label for="m_vreason">Reason (for special dates)</label><input id="m_vreason" value="${safe(v?.reason || "")}" maxlength="160"></div>`;
  openModal(
    v ? "Edit visitation" : "Add visitation",
    v ? v.ref : "Create a visit for a walk-in or phone booking",
    body,
    `<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveVisit('${v ? v.ref : ""}')">${v ? "Save changes" : "Add visit"}</button>`,
  );
}
function saveVisit(ref) {
  const name = V("m_vname"),
    phone = V("m_vphone"),
    email = V("m_vemail"),
    date = V("m_vdate");
  if (!name || !phone || !date) {
    toast("Please enter name, contact number and date.");
    return;
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    toast("Please enter a valid email address.");
    return;
  }
  const o = {
    name,
    phone,
    email,
    farm: V("m_vfarm"),
    date,
    visitors: Math.min(5, Math.max(1, Number(V("m_vcount")) || 1)),
    type: V("m_vtype"),
    status: V("m_vstatus"),
    reason: V("m_vreason"),
  };
  if (ref) {
    Object.assign(
      visits.find((x) => x.ref === ref),
      o,
    );
    toast("Visit updated.");
  } else {
    o.ref = nextRef("VS-2026-", visits);
    o.submittedAt = fmtDate(TODAY_ISO);
    visits.unshift(o);
    toast("Visit " + o.ref + " added.");
  }
  upsertCustomer({ name, phone, email });
  closeModal();
  render();
}
function deleteVisit(ref) {
  const v = visits.find((x) => x.ref === ref);
  if (!v) return;
  if (!confirm("Permanently delete visit " + ref + " (" + v.name + ")?"))
    return;
  visits = visits.filter((x) => x.ref !== ref);
  toast("Visit " + ref + " deleted.");
  render();
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
            return `<tr><td><strong>${safe(c.name)}</strong><br><span class="muted">${c.id} · ${safe(c.address || "No address")}</span></td><td>${safe(c.phone || "—")}<br><span class="muted">${safe(c.email || "No email")}</span></td><td>${s.bs.length}</td><td>${s.vs.length}</td><td>${s.done}</td><td><span class="status ${s.done >= 2 ? "green" : "gray"}">${s.done >= 2 ? "Repeat customer" : "Regular / new"}</span></td><td><div class="actions"><button class="secondary small" onclick="viewCustomer('${c.id}')">View</button><button class="secondary small" onclick="openCustomerForm('${c.id}')">Edit</button><button class="danger small" onclick="deleteCustomer('${c.id}')">Delete</button></div></td></tr>`;
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
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Customers</h3><p class="muted" style="margin:6px 0 0">${customers.length} customers · repeat customer = at least two completed purchases.</p></div><button class="primary" onclick="openCustomerForm()">＋ Add customer</button></div><div class="toolbar"><input type="search" placeholder="Search name, phone, email, address…" value="${safe(cSearch)}" oninput="cSearch=this.value;refreshCustomers()" aria-label="Search customers"></div><div id="custHost">${customersTableHtml()}</div></div>`;
}
function openCustomerForm(id) {
  const c = id ? customers.find((x) => x.id === id) : null;
  if (id && !c) return;
  openModal(
    c ? "Edit customer" : "Add customer",
    c ? c.id : "",
    `<div class="field-grid">${fld("m_cname", "Full name", c?.name)}${fld("m_cphone", "Contact number", c?.phone)}${fld("m_cemail", "Email", c?.email, "email")}${fld("m_caddr", "Address", c?.address)}</div><div class="field"><label for="m_cnotes">Notes</label><textarea id="m_cnotes">${safe(c?.notes || "")}</textarea></div>${c ? '<p class="muted" style="font-size:12px;margin:0">Renaming a customer also updates their bookings and visits.</p>' : ""}`,
    `<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveCustomer('${c ? c.id : ""}')">${c ? "Save changes" : "Add customer"}</button>`,
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
  openModal(
    safe(c.name),
    c.id,
    `<div class="summary-line"><span>Contact</span><strong>${safe(c.phone || "—")}</strong></div><div class="summary-line"><span>Email</span><strong>${safe(c.email || "—")}</strong></div><div class="summary-line"><span>Address</span><strong>${safe(c.address || "—")}</strong></div>${c.notes ? `<div class="summary-line"><span>Notes</span><strong>${safe(c.notes)}</strong></div>` : ""}<h4 style="margin:18px 0 4px">Service bookings (${s.bs.length})</h4>${s.bs.map((b) => `<div class="summary-line"><span>${b.ref} · ${safe(b.pkg)} · ${safe(b.date)}</span><strong>${safe(b.booking)} / ${safe(b.payment)}</strong></div>`).join("") || '<p class="muted">None.</p>'}<h4 style="margin:18px 0 4px">Visits (${s.vs.length})</h4>${s.vs.map((v) => `<div class="summary-line"><span>${v.ref} · ${fmtDate(v.date)}</span><strong>${safe(v.status)}</strong></div>`).join("") || '<p class="muted">None.</p>'}`,
    `<button class="secondary" onclick="closeModal()">Close</button><button class="primary" onclick="openCustomerForm('${c.id}')">Edit</button>`,
  );
}

/* ----- package catalog ----- */
window.pendingPkgImage = null;
function pkgCardAdmin(x, i) {
  const hid = x.active === false;
  return `<article class="pkg-card ${hid ? "is-hidden" : ""}"><div class="pkg-media">${pkgImg(x)}${x.featured ? '<span class="pkg-badge">★ FEATURED</span>' : ""}${hid ? '<span class="pkg-badge hidden-b" style="left:auto;right:12px">HIDDEN</span>' : ""}</div><div class="pkg-body"><h3>${safe(x.name)}</h3><p>${safe(x.description)}</p><div class="chips"><span class="chip">${safe(x.layers)}</span><span class="chip">${safe(x.dimensions)}</span></div><div class="freebie"><span>🎁</span><span>${safe(x.freebie)}</span></div><div class="pkg-foot"><div class="price-big"><small>Package price</small>${money(x.price)}</div><div class="mini-actions"><button class="secondary small" onclick="movePackage(${i},-1)" aria-label="Move earlier" title="Move earlier">←</button><button class="secondary small" onclick="movePackage(${i},1)" aria-label="Move later" title="Move later">→</button></div></div><div class="pkg-actions"><button class="primary small" onclick="openPackageForm(${i})">Edit</button><button class="secondary small" onclick="togglePackage(${i})">${hid ? "Show" : "Hide"}</button><button class="secondary small" onclick="duplicatePackage(${i})">Duplicate</button><button class="danger small" onclick="deletePackage(${i})">Delete</button></div></div></article>`;
}
function adminCatalog() {
  const act = activePackages(),
    avg = act.length ? act.reduce((s, x) => s + x.price, 0) / act.length : 0,
    q = pkgSearch.toLowerCase(),
    items = pondPackageCatalog
      .map((x, i) => [x, i])
      .filter(
        ([x]) =>
          !q ||
          (x.name + " " + x.description + " " + x.freebie)
            .toLowerCase()
            .includes(q),
      );
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Package Catalog</h3><p class="muted" style="margin:6px 0 0">Add, edit, hide, reorder and delete pond packages. Visible packages appear on the Packages page and in the booking selector.</p></div><button class="primary" onclick="openPackageForm(-1)">＋ Add package</button></div><div class="stat-grid" style="margin-top:16px"><div class="stat"><div class="label">Visible packages</div><div class="value">${act.length}</div></div><div class="stat"><div class="label">Hidden</div><div class="value">${pondPackageCatalog.length - act.length}</div></div><div class="stat"><div class="label">Average visible price</div><div class="value" style="font-size:22px">${money(avg)}</div></div></div></div><div class="panel"><h3 style="margin-top:0">Custom pond pricing</h3><p class="muted" style="margin-top:0">Used by Custom Pond Design: width × length × rate per m² per layer, plus the filtration fee when selected.</p><div class="field-grid">${fld("set_rate", "Rate per m² per layer (₱)", pondRatePerSqmPerLayer, "number", 'min="0" step="1"')}${fld("set_filt", "Filtration fee (₱)", filtrationEstimate, "number", 'min="0" step="1"')}</div><button class="primary" onclick="savePricingSettings()">Save pricing settings</button></div><div class="panel"><div class="toolbar" style="margin-top:0"><h3 style="margin:0">Packages (${pondPackageCatalog.length})</h3><input type="search" placeholder="Search packages…" value="${safe(pkgSearch)}" oninput="pkgSearch=this.value;refreshCatalogGrid()" aria-label="Search packages"></div><div id="pkgHost" class="pkg-grid">${items.map(([x, i]) => pkgCardAdmin(x, i)).join("") || '<div class="empty">No packages yet. Add your first package.</div>'}</div></div>`;
}
function refreshCatalogGrid() {
  const h = document.getElementById("pkgHost");
  if (!h) return;
  const q = pkgSearch.toLowerCase();
  h.innerHTML =
    pondPackageCatalog
      .map((x, i) => [x, i])
      .filter(
        ([x]) =>
          !q ||
          (x.name + " " + x.description + " " + x.freebie)
            .toLowerCase()
            .includes(q),
      )
      .map(([x, i]) => pkgCardAdmin(x, i))
      .join("") || '<div class="empty">No packages match.</div>';
}
function savePricingSettings() {
  const r = Number(V("set_rate")),
    f = Number(V("set_filt"));
  if (
    !Number.isFinite(r) ||
    r < 0 ||
    !Number.isFinite(f) ||
    f < 0 ||
    V("set_rate") === "" ||
    V("set_filt") === ""
  ) {
    toast("Enter valid non-negative amounts.");
    return;
  }
  pondRatePerSqmPerLayer = r;
  filtrationEstimate = f;
  toast("Custom pond pricing updated.");
  render();
}
function openPackageForm(i) {
  const x = i >= 0 ? pondPackageCatalog[i] : null;
  window.pendingPkgImage = null;
  const body = `<div class="field-grid">${fld("m_pname", "Package name", x?.name, "text", 'maxlength="70"')}${fld("m_pprice", "Package price (₱)", x?.price ?? "", "number", 'min="0" step="0.01"')}${fld("m_players", "Included layers", x?.layers, "text", 'maxlength="30" placeholder="e.g. 2 layers"')}${fld("m_pdim", "Standard dimensions", x?.dimensions, "text", 'maxlength="40" placeholder="e.g. 2 m × 3 m"')}</div>${fld("m_pfree", "Included freebie", x?.freebie, "text", 'maxlength="120"')}<div class="field"><label for="m_pdesc">Description</label><textarea id="m_pdesc" maxlength="180">${safe(x?.description || "")}</textarea></div><div class="field"><label for="m_pimg">Package photo</label><input id="m_pimg" type="file" accept="image/*" onchange="uploadPackageImage(this)"><small class="muted">JPG, PNG or WebP, up to 8 MB. Leave empty to keep the current photo.</small><div class="pkg-media" style="height:160px;border-radius:12px;overflow:hidden;margin-top:8px"><img id="m_pprev" src="${safe(x?.image || "")}" alt="Photo preview" style="${x?.image ? "" : "display:none"}"></div></div><label class="check-row"><input type="checkbox" id="m_pfeat" ${x?.featured ? "checked" : ""}><span>Feature this package (shows a “Most popular” badge)</span></label><label class="check-row"><input type="checkbox" id="m_pact" ${x && x.active === false ? "" : "checked"}><span>Visible to customers</span></label>`;
  openModal(
    x ? "Edit package" : "Add package",
    x ? safe(x.name) : "",
    body,
    `<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="savePackage(${i})">${x ? "Save package" : "Add package"}</button>`,
    true,
  );
}
function uploadPackageImage(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    input.value = "";
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    alert("Please choose an image smaller than 8 MB.");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1200,
        scale = Math.min(1, max / Math.max(img.width, img.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.84);
      window.pendingPkgImage = data;
      const p = document.getElementById("m_pprev");
      if (p) {
        p.src = data;
        p.style.display = "block";
      }
    };
    img.onerror = () =>
      alert("That image could not be opened. Please choose another.");
    img.src = reader.result;
  };
  reader.onerror = () => alert("Could not read the selected image.");
  reader.readAsDataURL(file);
}
function savePackage(i) {
  const old = i >= 0 ? pondPackageCatalog[i] : null,
    name = V("m_pname"),
    description = V("m_pdesc"),
    priceRaw = V("m_pprice"),
    price = Number(priceRaw),
    layers = V("m_players"),
    dimensions = V("m_pdim"),
    freebie = V("m_pfree");
  if (
    !name ||
    !description ||
    priceRaw === "" ||
    !Number.isFinite(price) ||
    price < 0 ||
    !layers ||
    !dimensions ||
    !freebie
  ) {
    toast("Complete every field and enter a valid non-negative price.");
    return;
  }
  if (
    pondPackageCatalog.some(
      (x, j) => j !== i && x.name.toLowerCase() === name.toLowerCase(),
    ) ||
    name.toLowerCase() === "custom pond design"
  ) {
    toast("That package name is already in use.");
    return;
  }
  const o = {
    name,
    description,
    price,
    layers,
    dimensions,
    freebie,
    image: window.pendingPkgImage || old?.image || FALLBACK_IMG,
    featured: document.getElementById("m_pfeat").checked,
    active: document.getElementById("m_pact").checked,
  };
  if (old) {
    if (selectedPackage === old.name) selectedPackage = name;
    Object.assign(old, o);
    toast("Package updated.");
  } else {
    o.id = "pk" + Date.now();
    pondPackageCatalog.push(o);
    toast("Package added.");
  }
  window.pendingPkgImage = null;
  closeModal();
  render();
}
function togglePackage(i) {
  const x = pondPackageCatalog[i];
  if (!x) return;
  x.active = x.active === false;
  toast(
    x.active
      ? "Package is now visible to customers."
      : "Package hidden from customers.",
  );
  render();
}
function duplicatePackage(i) {
  const x = pondPackageCatalog[i];
  if (!x) return;
  let n = x.name + " (Copy)",
    k = 2;
  while (pondPackageCatalog.some((y) => y.name === n))
    n = x.name + " (Copy " + k++ + ")";
  pondPackageCatalog.splice(i + 1, 0, {
    ...x,
    id: "pk" + Date.now(),
    name: n,
    active: false,
    featured: false,
  });
  toast("Duplicated as hidden. Edit it, then show it.");
  render();
}
function movePackage(i, d) {
  const j = i + d;
  if (j < 0 || j >= pondPackageCatalog.length) return;
  const t = pondPackageCatalog[i];
  pondPackageCatalog[i] = pondPackageCatalog[j];
  pondPackageCatalog[j] = t;
  render();
}
function deletePackage(i) {
  const x = pondPackageCatalog[i];
  if (!x) return;
  if (
    !confirm(
      'Delete "' +
        x.name +
        '"? It disappears from the Packages page and booking choices. Existing bookings keep their details.',
    )
  )
    return;
  pondPackageCatalog.splice(i, 1);
  if (selectedPackage === x.name) selectedPackage = "Custom Pond Design";
  toast("Package deleted.");
  render();
}

/* ----- assistant FAQs ----- */
function adminFaqs() {
  return `<div class="panel"><div class="admin-header"><div><h3 style="margin:0">Assistant FAQs</h3><p class="muted" style="margin:6px 0 0">The ARC Inquiry Assistant answers with the first FAQ whose keywords appear in the customer’s question.</p></div><button class="primary" onclick="openFaqForm()">＋ Add FAQ</button></div><div class="card" style="margin-top:16px"><h3 style="margin-top:0">Test the assistant</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="faqTestInput" placeholder="Type a customer question…" style="flex:1;min-width:200px;padding:10px;border:1px solid #cfd9d0;border-radius:9px" onkeydown="if(event.key==='Enter')testFaq()"><button class="secondary" onclick="testFaq()">Test</button></div><div id="faqTest" class="notice" style="margin-top:10px">The answer will appear here.</div></div>${
    faqs
      .map(
        (f, i) =>
          `<div class="card" style="margin-top:14px"><div class="admin-header"><div><h3 style="margin:0">${safe(f.question)}</h3><div class="chips" style="margin-top:8px">${f.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
            .map((k) => `<span class="chip">${safe(k)}</span>`)
            .join(
              "",
            )}</div></div><div class="mini-actions"><button class="secondary small" onclick="openFaqForm('${f.id}')">Edit</button><button class="danger small" onclick="deleteFaq('${f.id}')">Delete</button></div></div><p class="muted" style="margin-bottom:0">${safe(f.answer)}</p></div>`,
      )
      .join("") || '<div class="empty">No FAQs yet.</div>'
  }</div>`;
}
function testFaq() {
  const q = V("faqTestInput"),
    el = document.getElementById("faqTest");
  if (el) el.textContent = q ? botAnswer(q) : "Type a question first.";
}
function openFaqForm(id) {
  const f = id ? faqs.find((x) => x.id === id) : null;
  openModal(
    f ? "Edit FAQ" : "Add FAQ",
    "",
    `${fld("m_fq", "Question (for your reference)", f?.question)}${fld("m_fk", "Keywords (comma-separated)", f?.keywords, "text", 'placeholder="e.g. price, cost, how much"')}<div class="field"><label for="m_fa">Answer shown to the customer</label><textarea id="m_fa" style="min-height:120px">${safe(f?.answer || "")}</textarea></div>`,
    `<button class="secondary" onclick="closeModal()">Cancel</button><button class="primary" onclick="saveFaq('${f ? f.id : ""}')">${f ? "Save FAQ" : "Add FAQ"}</button>`,
  );
}
function saveFaq(id) {
  const question = V("m_fq"),
    keywords = V("m_fk"),
    answer = V("m_fa");
  if (!question || !keywords || !answer) {
    toast("Question, keywords and answer are all required.");
    return;
  }
  if (id) {
    Object.assign(
      faqs.find((x) => x.id === id),
      { question, keywords, answer },
    );
    toast("FAQ updated.");
  } else {
    faqs.push({ id: "f" + Date.now(), question, keywords, answer });
    toast("FAQ added.");
  }
  closeModal();
  render();
}
function deleteFaq(id) {
  const f = faqs.find((x) => x.id === id);
  if (!f) return;
  if (!confirm("Delete this FAQ?")) return;
  faqs = faqs.filter((x) => x.id !== id);
  toast("FAQ deleted.");
  render();
}
function botAnswer(q) {
  q = q.toLowerCase();
  for (const f of faqs) {
    if (
      f.keywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
        .some((k) => q.includes(k))
    )
      return f.answer;
  }
  return "Sorry, I do not have a predefined answer for that question yet. Please contact the farm owner for assistance.";
}

/* ----- sales ----- */
function adminSales() {
  const history = bookings.flatMap((b) =>
      (b.paymentHistory || []).map((p) => ({ ...p, ref: b.ref, name: b.name })),
    ),
    received = bookings.reduce((s, b) => s + Number(b.paidAmount || 0), 0),
    live = bookings.filter(
      (b) => !["Rejected", "Cancelled"].includes(b.booking),
    ),
    booked = live.reduce((s, b) => s + Number(b.total || 0), 0);
  return `<div class="stat-grid"><div class="stat"><div class="label">Verified money received</div><div class="value" style="font-size:22px">${money(received)}</div></div><div class="stat"><div class="label">Booked value (active)</div><div class="value" style="font-size:22px">${money(booked)}</div></div><div class="stat"><div class="label">Still to collect</div><div class="value" style="font-size:22px">${money(Math.max(0, booked - live.reduce((s, b) => s + Number(b.paidAmount || 0), 0)))}</div></div></div><div class="panel"><div class="admin-header"><h3 style="margin:0">Sales & transaction records</h3><span class="muted" style="font-size:12px">Verified transactions only</span></div><div class="notice" style="margin-top:12px">A submitted receipt is not counted as a sale until you verify the actual GCash transaction.</div><div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Booking status</th><th>Total (with delivery)</th><th>Payment status</th><th>Verified received</th><th>Still to collect</th></tr></thead><tbody>${bookings.map((b) => `<tr><td>${b.ref}</td><td>${safe(b.name)}</td><td>${safe(b.booking)}</td><td>${money(b.total)}</td><td>${safe(b.payment)}</td><td>${money(b.paidAmount || 0)}</td><td>${["Rejected", "Cancelled"].includes(b.booking) ? "—" : money(Math.max(0, b.total - (b.paidAmount || 0)))}</td></tr>`).join("")}</tbody></table></div><h3 style="margin-top:24px">Verified payment history</h3><div class="table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Payment type</th><th>Amount</th><th>GCash reference</th><th>Receipt file</th><th>Verified</th><th>Status</th></tr></thead><tbody>${history.length ? history.map((p) => `<tr><td>${safe(p.ref)}</td><td>${safe(p.name)}</td><td>${p.target === "deposit" ? "50% down payment" : "Remaining balance"}</td><td>${money(p.amount)}</td><td>${safe(p.reference)}</td><td>${safe(p.fileName)}</td><td>${safe(p.verifiedAt)}</td><td><span class="status green">${safe(p.status)}</span></td></tr>`).join("") : '<tr><td colspan="8" class="muted">No verified transactions yet.</td></tr>'}</tbody></table></div></div>`;
}

/* ----- render ----- */
function render() {
  ensureNavigationShell();
  if (page === "home") {
    const template = document.getElementById("homeTemplate");
    if (template) app.replaceChildren(template.content.cloneNode(true));
    const packages = activePackages();
    const price = document.getElementById("homePackagePrice");
    if (price)
      price.textContent = packages.length
        ? `From ${money(Math.min(...packages.map((item) => item.price)))}`
        : "Packages coming soon";
  }
  const views = {
    about,
    packages,
    booking,
    success,
    mybookings,
    customerpayment: customerPaymentPage,
    login,
    register,
    admin,
  };
  if (page !== "home") app.innerHTML = (views[page] || about)();
  document
    .querySelectorAll(".nav a[data-page]")
    .forEach((link) =>
      link.classList.toggle("active", link.dataset.page === page),
    );
  if (page === "login") {
    document.getElementById("loginForm").onsubmit = (e) => {
      e.preventDefault();
      loggedIn = true;
      userName = userName || "Customer Account";
      setPage("mybookings");
    };
  }
  if (page === "register") {
    document.getElementById("registerForm").onsubmit = (e) => {
      e.preventDefault();
      userName = document.getElementById("regName").value.trim();
      upsertCustomer({ name: userName });
      loggedIn = true;
      alert("Account created for this session.");
      setPage("mybookings");
    };
  }
  if (page === "mybookings")
    myBookingList().forEach((b) =>
      (b.timeline || []).forEach((e) => (e.seen = true)),
    );
  updateNavBadge();
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
  };
}
if (chatClose && chatBox) {
  chatClose.onclick = () => {
    chatBox.style.display = "none";
    chatLaunch?.setAttribute("aria-expanded", "false");
  };
}
if (chatForm) {
  chatForm.onsubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById("chatText"),
      body = document.getElementById("chatBody"),
      q = input?.value.trim();
    if (!input || !body || !q) return;
    body.innerHTML += `<div class="bubble user">${safe(q)}</div><div class="bubble">${safe(botAnswer(q))}</div>`;
    input.value = "";
    body.scrollTop = body.scrollHeight;
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
  if (action === "show-packages") setPage("packages");
  if (action === "show-about") setPage("about");
  if (action === "custom-pond") choosePkgById("custom");
  if (action === "show-visit") chooseBookingType("visit");
});
window.addEventListener("popstate", () => {
  const currentFile = location.pathname.split("/").pop() || "index.html",
    route = Object.keys(pageFiles).find(
      (key) => pageFiles[key] === currentFile,
    );
  if (route) {
    page = route;
    syncPageChrome(route);
    render();
  }
});
render();
