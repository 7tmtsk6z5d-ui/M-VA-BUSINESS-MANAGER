/*
 * MŌVA — FINAL WEB APP CORE
 * No ES modules. No service worker. Internet is required.
 * UI/navigation is completely independent from Supabase loading.
 * The app requires internet for cloud data mutations and reads.
 */
(function () {
  "use strict";

  const RUNTIME_CONFIG = window.MOVA_CONFIG || {};
  const CONFIG = Object.freeze({
    name: RUNTIME_CONFIG.name || "MŌVA",
    version: RUNTIME_CONFIG.version || "4.2.4-final",
    packageId: RUNTIME_CONFIG.packageId || "id.mova.business",
    supabaseUrl: RUNTIME_CONFIG.supabaseUrl || "https://wufjamnqlwrvbxsnvpsa.supabase.co",
    supabaseKey: RUNTIME_CONFIG.supabasePublishableKey || "sb_publishable_vVBwFpi7OC1uhkwWb-EPUw_4sDRSiU8",
    mission: RUNTIME_CONFIG.mission || "Kami hadir untuk membantu Anda mengontrol keuangan bisnis — transaksi, stok, dan arus uang dalam satu tempat.",
    proMonthly: RUNTIME_CONFIG.proMonthly || "mova_pro_monthly",
    proYearly: RUNTIME_CONFIG.proYearly || "mova_pro_yearly",
    supabaseJsVersion: RUNTIME_CONFIG.supabaseJsVersion || "2.117.2"
  });
  const SUPABASE_CLIENT_OPTIONS = Object.freeze({
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
    global: { headers: { "x-client-info": `mova/${CONFIG.version}` } }
  });

  const TABLES = ["brands", "categories", "products", "transactions", "transaction_items", "expenses", "customers", "business_settings", "daily_closings", "cash_reconciliations", "audit_logs", "stock_movements"];
  const PAGES = ["home", "kasir", "produk", "finance", "more"];
  const state = {
    page: "home",
    session: null,
    user: null,
    business: null,
    role: "owner",
    plan: "free",
    products: [],
    transactions: [],
    items: [],
    expenses: [],
    customers: [],
    settings: null,
    closings: [],
    reconciliations: [],
    cart: [],
    productQuery: "",
    cashierQuery: "",
    selectedDate: todayKey(),
    loading: false,
    online: navigator.onLine !== false,
    supabaseReady: false,
    refreshTimer: null,
    deviceKey: getDeviceKey()
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const root = $("#pageRoot");

  function todayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dateKey(value) {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : todayKey(d);
  }

  function n(value) {
    const x = Number(value);
    return Number.isFinite(x) ? x : 0;
  }

  function money(value) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n(value));
  }

  function qty(value) {
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(n(value));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[ch]));
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 3 | 8);
      return v.toString(16);
    });
  }

  function getDeviceKey() {
    const keyName = "mova.device.key";
    let value = localStorage.getItem(keyName);
    if (!value) {
      value = uuid();
      localStorage.setItem(keyName, value);
    }
    return value;
  }

  function showToast(message, type = "info") {
    const host = $("#toastContainer");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 220); }, 3400);
  }

  function setStatus(text, status = "loading") {
    const el = $("#connectionBadge");
    if (!el) return;
    el.dataset.status = status;
    el.textContent = text;
  }

  function isCloudReady() {
    return state.supabaseReady && !!window.movaSupabase;
  }

  function onlineRequired() {
    if (!state.online) {
      showToast("Internet diperlukan untuk menggunakan MŌVA.", "error");
      return false;
    }
    if (!isCloudReady()) {
      showToast("Layanan cloud belum siap. Coba lagi sebentar.", "error");
      return false;
    }
    return true;
  }

  function formatTime(value) {
    try { return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  }

  function setPage(page) {
    const next = PAGES.includes(page) ? page : "home";
    state.page = next;
    $$("[data-page]").forEach(btn => {
      const active = btn.dataset.page === next;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current");
    });
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (!root) return;
    const pageRenderer = { home: renderHome, kasir: renderKasir, produk: renderProduk, finance: renderFinance, more: renderMore }[state.page] || renderHome;
    try { pageRenderer(); }
    catch (error) {
      console.error(error);
      root.innerHTML = errorScreen("Halaman tidak dapat ditampilkan", "Terjadi kesalahan pada halaman ini. Navigasi MŌVA tetap aktif.");
    }
  }

  function heading(eyebrow, title, description, extra = "") {
    return `<div class="page-heading"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${extra}</div>`;
  }

  function stat(label, value, primary = false, extra = "") {
    return `<article class="stat-card${primary ? " primary" : ""}"><span class="stat-label">${esc(label)}</span><strong class="stat-value">${esc(value)}</strong>${extra}</article>`;
  }

  function accountGate() {
    return `<div class="form-card mova-gate"><span class="eyebrow">CLOUD</span><h2>Hubungkan akun MŌVA</h2><p>Data bisnis MŌVA tersimpan di cloud. Aplikasi memerlukan internet untuk membaca dan menyimpan perubahan.</p><div class="form-actions"><button class="primary-button" data-action="login">Masuk / Daftar</button></div></div>`;
  }

  function errorScreen(title, message) {
    return `<div class="form-card mova-error"><span class="eyebrow">MŌVA</span><h2>${esc(title)}</h2><p>${esc(message)}</p><button class="primary-button" data-action="refresh">Muat Ulang</button></div>`;
  }

  function summaryFor(date = state.selectedDate) {
    const tx = state.transactions.filter(t => t.status !== "cancelled" && dateKey(t.transaction_date || t.created_at) === date);
    const ex = state.expenses.filter(e => !e.deleted_at && dateKey(e.expense_date || e.created_at) === date);
    const omzet = tx.reduce((s, x) => s + n(x.total), 0);
    const hpp = tx.reduce((s, x) => s + n(x.total_hpp), 0);
    const expense = ex.reduce((s, x) => s + n(x.amount), 0);
    const cashSales = tx.filter(x => x.payment_method === "cash").reduce((s, x) => s + n(x.total), 0);
    const qrisSales = tx.filter(x => x.payment_method === "qris").reduce((s, x) => s + n(x.total), 0);
    const cashExpense = ex.filter(x => x.payment_source === "cash").reduce((s, x) => s + n(x.amount), 0);
    const qrisExpense = ex.filter(x => x.payment_source === "qris").reduce((s, x) => s + n(x.amount), 0);
    const ids = new Set(tx.map(x => String(x.id)));
    const itemsSold = state.items.filter(i => ids.has(String(i.transaction_id))).reduce((s, x) => s + n(x.quantity), 0);
    return { omzet, hpp, gross: omzet - hpp, expense, net: omzet - hpp - expense, cash: cashSales - cashExpense, qris: qrisSales - qrisExpense, transactions: tx.length, itemsSold };
  }

  function renderHome() {
    const s = summaryFor();
    const low = state.products.filter(p => n(p.stock) <= n(p.min_stock)).length;
    const recent = state.transactions.filter(t => dateKey(t.transaction_date || t.created_at) === state.selectedDate).sort((a,b) => new Date(b.transaction_date || b.created_at) - new Date(a.transaction_date || a.created_at)).slice(0, 8);
    root.innerHTML = heading("DASHBOARD", "Ringkasan Bisnis", "Kendali penjualan, stok, dan arus uang dari satu layar.", `<div class="date-control"><label for="homeDate">Tanggal</label><input id="homeDate" type="date" value="${esc(state.selectedDate)}"></div>`) +
      `<div class="stats-grid">${stat("Omzet", money(s.omzet), true)}${stat("Laba Bersih", money(s.net))}${stat("Transaksi", qty(s.transactions))}${stat("Produk", qty(state.products.length))}</div>` +
      `<div class="section-heading"><div><span class="eyebrow">PEMBAYARAN</span><h2>Posisi Dana</h2></div></div>` +
      `<div class="stats-grid two-columns">${stat("Kas", money(s.cash))}${stat("QRIS", money(s.qris))}</div>` +
      `<div class="section-heading"><div><span class="eyebrow">INVENTORI</span><h2>Kondisi Stok</h2></div><button class="text-button" data-page="produk">Kelola Produk</button></div>` +
      `<div class="stats-grid two-columns">${stat("Total Stok", qty(state.products.reduce((a,p)=>a+n(p.stock),0)))}${stat("Stok Rendah", qty(low))}</div>` +
      `<div class="section-heading"><div><span class="eyebrow">AKTIVITAS</span><h2>Transaksi Terbaru</h2></div><button class="text-button" data-page="kasir">Buka Kasir</button></div>` +
      `<div class="list-container">${recent.length ? recent.map(t => { const cancelled = t.status === "cancelled"; return `<div class="list-row"><div class="row-left"><strong>${esc(t.transaction_number)}</strong><div class="product-meta">${esc(t.payment_method)} · ${formatTime(t.transaction_date || t.created_at)}${cancelled ? " · DIBATALKAN" : ""}</div></div><div class="row-actions"><strong>${money(t.total)}</strong>${!cancelled && state.role !== "viewer" ? `<button class="text-button" data-cancel-tx="${esc(t.id)}">Batalkan</button>` : ""}</div></div>`; }).join("") : `<div class="empty-card">Belum ada transaksi untuk ${esc(state.selectedDate)}.</div>`}</div>`;
    if (!state.user) root.innerHTML += accountGate();
  }

  function renderKasir() {
    const products = state.products.filter(p => `${p.name} ${p.sku || ""}`.toLowerCase().includes(state.cashierQuery.toLowerCase()));
    const total = state.cart.reduce((s, x) => s + n(x.price) * n(x.quantity), 0);
    root.innerHTML = heading("POINT OF SALE", "Kasir", "Buat transaksi dengan alur sesingkat mungkin.") +
      (!state.user ? accountGate() : `<div class="search-box"><span class="search-icon">⌕</span><input id="cashierSearch" type="search" value="${esc(state.cashierQuery)}" placeholder="Cari produk atau SKU…" autocomplete="off"></div>
      <div class="section-heading compact"><div><span class="eyebrow">PRODUK</span><h2>Pilih Produk</h2></div></div>
      <div class="cashier-products">${products.map(p => `<button type="button" class="cashier-product" data-add="${esc(p.id)}" ${n(p.stock) <= 0 ? "disabled" : ""}><div class="product-thumb" ${p.image_url ? `style="background-image:url('${esc(p.image_url)}')"` : ""}></div><strong>${esc(p.name)}</strong><div class="product-meta">Stok ${qty(p.stock)} ${esc(p.unit || "pcs")}</div><div class="product-price">${money(p.price)}</div></button>`).join("")}</div>
      <div class="section-heading"><div><span class="eyebrow">PESANAN</span><h2>Keranjang <span class="count-badge">${qty(state.cart.reduce((s,x)=>s+x.quantity,0))}</span></h2></div><button class="text-button" data-action="clear-cart">Kosongkan</button></div>
      <div class="cart-list">${state.cart.length ? state.cart.map(item => `<div class="list-row"><div class="row-left"><strong>${esc(item.name)}</strong><div class="product-meta">${money(item.price)} × ${qty(item.quantity)}</div></div><div class="row-actions"><button class="mini-button" data-cart-dec="${esc(item.id)}">−</button><strong>${money(item.price * item.quantity)}</strong><button class="mini-button" data-cart-inc="${esc(item.id)}">+</button></div></div>`).join("") : `<div class="empty-card">Keranjang masih kosong.</div>`}</div>
      <div class="checkout-card"><div class="checkout-row"><span>Total</span><strong class="checkout-total">${money(total)}</strong></div><div class="form-grid"><div class="form-group"><label for="paymentMethod">Metode</label><select id="paymentMethod"><option value="cash">Tunai</option><option value="qris">QRIS</option></select></div><div class="form-group"><label for="paidAmount">Uang diterima</label><input id="paidAmount" type="number" min="0" inputmode="numeric" placeholder="${Math.round(total)}"></div></div><div id="changePreview" class="product-meta"></div><button class="primary-button full-width" data-action="checkout" ${state.cart.length ? "" : "disabled"}>Selesaikan Transaksi</button></div>`);
  }

  function renderProduk() {
    const products = state.products.filter(p => `${p.name} ${p.sku || ""}`.toLowerCase().includes(state.productQuery.toLowerCase()));
    root.innerHTML = heading("INVENTORI", "Produk", "Kelola harga, HPP, stok, SKU, dan foto produk.", `<button class="primary-button" data-action="new-product">+ Produk</button>`) +
      `<div class="search-box"><span class="search-icon">⌕</span><input id="productSearch" type="search" value="${esc(state.productQuery)}" placeholder="Cari nama atau SKU…"></div><div class="product-list">${products.length ? products.map(p => `<div class="product-row"><div class="product-row-main"><div class="product-row-thumb" ${p.image_url ? `style="background-image:url('${esc(p.image_url)}')"` : ""}></div><div><strong>${esc(p.name)}</strong><div class="product-meta">${esc(p.sku || "Tanpa SKU")} · ${qty(p.stock)} ${esc(p.unit || "pcs")}</div><div class="product-meta">Jual ${money(p.price)} · HPP ${money(p.hpp)}</div></div></div><div class="row-actions"><button class="secondary-button" data-edit="${esc(p.id)}">Edit</button><button class="text-button" data-delete="${esc(p.id)}">Arsipkan</button></div></div>`).join("") : `<div class="empty-card">Belum ada produk.</div>`}</div>`;
  }

  function renderFinance() {
    const s = summaryFor();
    const ex = state.expenses.filter(e => dateKey(e.expense_date || e.created_at) === state.selectedDate && !e.deleted_at).sort((a,b)=>new Date(b.expense_date||b.created_at)-new Date(a.expense_date||a.created_at));
    root.innerHTML = heading("FINANCE", "Keuangan", "Pantau omzet, HPP, pengeluaran, dan laba.", `<div class="date-control"><label for="financeDate">Tanggal</label><input id="financeDate" type="date" value="${esc(state.selectedDate)}"></div>`) +
      `<div class="stats-grid">${stat("Omzet", money(s.omzet), true)}${stat("HPP", money(s.hpp))}${stat("Laba Kotor", money(s.gross))}${stat("Laba Bersih", money(s.net))}</div>` +
      `<div class="stats-grid two-columns">${stat("Kas Bersih", money(s.cash))}${stat("QRIS Bersih", money(s.qris))}</div>` +
      `<div class="section-heading"><div><span class="eyebrow">PENGELUARAN</span><h2>Tambah Pengeluaran</h2></div></div>` +
      `<div class="form-card"><div class="form-grid"><div class="form-group"><label>Kategori</label><input id="expenseCategory" placeholder="Bahan baku"></div><div class="form-group"><label>Jumlah</label><input id="expenseAmount" type="number" min="1" inputmode="numeric" placeholder="0"></div><div class="form-group full"><label>Keterangan</label><input id="expenseDescription" placeholder="Contoh: beli gula"></div><div class="form-group"><label>Sumber</label><select id="expensePayment"><option value="cash">Kas</option><option value="qris">QRIS</option></select></div></div><div class="form-actions"><button class="primary-button" data-action="add-expense">Simpan Pengeluaran</button></div></div>` +
      `<div class="section-heading"><div><span class="eyebrow">RIWAYAT</span><h2>Pengeluaran ${esc(state.selectedDate)}</h2></div></div><div class="expense-list">${ex.length ? ex.map(e => `<div class="list-row"><div class="row-left"><strong>${esc(e.category)}</strong><div class="product-meta">${esc(e.payment_source)} · ${esc(e.description || "")}</div></div><strong>${money(e.amount)}</strong></div>`).join("") : `<div class="empty-card">Belum ada pengeluaran.</div>`}</div>` +
      `<div class="section-heading"><div><span class="eyebrow">PENUTUPAN</span><h2>Kontrol Hari</h2></div></div><div class="action-card"><div><strong>Penutupan harian</strong><p>Simpan ringkasan final tanggal yang dipilih.</p></div><button class="secondary-button" data-action="close-day">Tutup Hari</button></div><div class="action-card"><div><strong>Rekonsiliasi kas</strong><p>Cocokkan kas fisik dengan kas sistem.</p></div><button class="secondary-button" data-action="reconcile">Rekonsiliasi</button></div>`;
  }

  function renderMore() {
    const b = state.business;
    const plan = state.plan === "pro" ? "MŌVA Pro" : "MŌVA Free";
    root.innerHTML = heading("MŌVA", "Lainnya", "Pengaturan, akun cloud, keamanan, backup, dan terminal.") +
      `<div class="form-card mova-profile-card"><div class="mova-profile-logo"><img src="${esc(state.settings?.logo_url || "./logo-mark.svg")}" alt=""></div><div><span class="eyebrow">WORKSPACE</span><h2>${esc(b?.business_name || state.settings?.business_name || "Bisnis Saya")}</h2><p>${esc(state.user?.email || "Belum masuk")}</p><span class="mova-pill">${esc(plan)} · ${esc(state.role)}</span></div></div>` +
      `<div class="section-heading"><div><span class="eyebrow">AKUN</span><h2>Akun & Bisnis</h2></div></div><div class="action-card"><div><strong>${state.user ? esc(state.user.email) : "Belum masuk"}</strong><p>${state.user ? `${esc(b?.business_name || "Bisnis Saya")} · ${esc(state.role)}` : "Hubungkan akun untuk mulai bekerja."}</p></div><div class="row-actions">${state.user ? `<button class="secondary-button" data-action="switch-business">Ganti Bisnis</button><button class="text-button" data-action="sign-out">Keluar</button>` : `<button class="primary-button" data-action="login">Masuk / Daftar</button>`}</div></div>` +
      (state.user ? `<div class="section-heading"><div><span class="eyebrow">IDENTITAS</span><h2>Profil Bisnis</h2></div></div><div class="form-card"><div class="form-grid"><div class="form-group full"><label>Nama Bisnis</label><input id="businessName" value="${esc(state.settings?.business_name || b?.business_name || "")}"></div><div class="form-group full"><label>Tagline</label><input id="businessTagline" value="${esc(state.settings?.tagline || "")}"></div><div class="form-group full"><label>Alamat</label><textarea id="businessAddress" rows="3">${esc(state.settings?.address || "")}</textarea></div><div class="form-group"><label>Telepon</label><input id="businessPhone" value="${esc(state.settings?.phone || "")}"></div><div class="form-group"><label>Instagram</label><input id="businessInstagram" value="${esc(state.settings?.instagram || "")}"></div><div class="form-group"><label>Kasir Default</label><input id="defaultCashier" value="${esc(state.settings?.default_cashier || "")}"></div><div class="form-group"><label>Tema</label><select id="themeSelect"><option value="system">Sistem</option><option value="light">Terang</option><option value="dark">Gelap</option></select></div><div class="form-group full"><label>Logo Bisnis</label><input id="businessLogo" type="file" accept="image/png,image/jpeg,image/webp"><small class="field-help">Logo disimpan ke Supabase Storage.</small></div><div class="form-group full"><label>Footer Struk</label><textarea id="receiptFooter" rows="3">${esc(state.settings?.receipt_footer || "Terima kasih telah berbelanja.")}</textarea></div></div><div class="form-actions"><button class="primary-button" data-action="save-settings">Simpan Profil</button></div></div>` : "") +
      `<div class="section-heading"><div><span class="eyebrow">CLOUD</span><h2>Data & Sinkronisasi</h2></div></div><div class="action-card"><div><strong>Cloud ${isCloudReady() ? "terhubung" : "belum siap"}</strong><p>Semua data aktif dibaca langsung dari Supabase. Tidak ada mode offline.</p></div><div class="row-actions"><button class="secondary-button" data-action="cloud-diagnostics">Tes API</button><button class="primary-button" data-action="refresh">Refresh Cloud</button></div></div>` +
      `<div class="section-heading"><div><span class="eyebrow">BACKUP</span><h2>Cadangan Data</h2></div></div><div class="action-card"><div><strong>Backup bisnis</strong><p>Unduh snapshot data bisnis Anda.</p></div><button class="secondary-button" data-action="backup">Download Backup</button></div><div class="action-card"><div><strong>Restore / Merge</strong><p>Masukkan backup yang berasal dari bisnis yang sama.</p></div><button class="secondary-button" data-action="restore">Restore</button></div>` +
      `<div class="section-heading"><div><span class="eyebrow">MŌVA PRO</span><h2>${esc(plan)}</h2></div></div><div class="form-card mova-pro-card"><p>${state.plan === "pro" ? "Semua fitur Pro yang tersedia untuk workspace ini aktif." : "Multi-bisnis, terminal pembayaran, dan fitur lanjutan tersedia melalui MŌVA Pro."}</p><div class="row-actions"><button class="primary-button" data-action="buy-pro">Berlangganan MŌVA Pro</button></div></div>` +
      `<div class="section-heading"><div><span class="eyebrow">PAYMENT TERMINAL</span><h2>QRIS & Terminal</h2></div></div><div class="action-card"><div><strong>Terminal Pembayaran</strong><p>Jalur native Android untuk notifikasi pembayaran dan TTS. Web tetap aman tanpa mencoba membaca data privat aplikasi pembayaran.</p></div><button class="secondary-button" data-action="terminal">Siapkan Terminal</button></div>` +
      `<div class="section-heading"><div><span class="eyebrow">ABOUT</span><h2>Tentang MŌVA</h2></div></div><div class="form-card about-card"><div class="about-logo"><img src="./logo-mark.svg" alt="MŌVA"></div><div><h2>MŌVA</h2><p>${esc(CONFIG.mission)}</p><small>Release ${esc(CONFIG.version)} · ${esc(CONFIG.packageId)}</small></div></div>` +
      (state.user && state.role === "owner" ? `<div class="action-card danger-card"><div><strong>Hapus Akun</strong><p>Penghapusan akun membutuhkan Edge Function server-side agar aman.</p></div><button class="text-button" data-action="delete-account">Hapus Akun</button></div>` : "");
    applyTheme();
  }

  function openModal({ title, message = "", fields = [], confirmText = "Simpan", content = "" }) {
    return new Promise(resolve => {
      const modalRoot = $("#modalRoot");
      const wrap = document.createElement("div");
      wrap.className = "modal-backdrop foundation-modal-backdrop";
      wrap.innerHTML = `<div class="modal foundation-modal"><div class="form-card-header"><div><span class="eyebrow">MŌVA</span><h2>${esc(title)}</h2></div><button class="icon-button" data-cancel>×</button></div><p class="modal-message">${esc(message)}</p>${content}<div class="modal-fields">${fields.map(f => f.kind === "select" ? `<div class="form-group"><label>${esc(f.label)}</label><select id="${esc(f.id)}">${(f.options || []).map(o => `<option value="${esc(o.value)}" ${String(f.value ?? "") === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>` : `<div class="form-group"><label>${esc(f.label)}</label><input id="${esc(f.id)}" type="${esc(f.type || "text")}" inputmode="${esc(f.inputmode || "text")}" autocomplete="${esc(f.autocomplete || "off")}" placeholder="${esc(f.placeholder || "")}" value="${esc(f.value || "")}"></div>`).join("")}</div><div class="form-actions"><button class="secondary-button" data-cancel>Batal</button><button class="primary-button" data-confirm>${esc(confirmText)}</button></div></div>`;
      modalRoot.appendChild(wrap);
      const cleanup = value => { wrap.remove(); resolve(value); };
      wrap.addEventListener("click", e => {
        if (e.target.closest("[data-cancel]")) return cleanup(null);
        if (!e.target.closest("[data-confirm]")) return;
        const result = {};
        fields.forEach(f => result[f.id] = $(`#${CSS.escape(f.id)}`, wrap)?.value || "");
        cleanup(result);
      });
      const first = $("input", wrap); if (first) setTimeout(() => first.focus(), 30);
    });
  }

  function productModal(product = null) {
    if (!state.user) return showToast("Masuk ke akun terlebih dahulu.", "info");
    const content = `<div class="mova-modal-note">${product ? "Edit produk yang sudah tersimpan di cloud." : "Produk baru akan langsung tersimpan ke bisnis cloud aktif."}</div>`;
    openModal({
      title: product ? "Edit Produk" : "Produk Baru",
      message: "Harga dan HPP disimpan sebagai angka bisnis. SKU harus unik di dalam bisnis.",
      confirmText: "Simpan Produk",
      content,
      fields: [
        { id: "name", label: "Nama Produk", value: product?.name || "", placeholder: "Susu Murni" },
        { id: "sku", label: "SKU", value: product?.sku || "", placeholder: "MOVA-MURNI" },
        { id: "unit", label: "Satuan", value: product?.unit || "pcs", placeholder: "pcs" },
        { id: "price", label: "Harga Jual", value: product?.price ?? "", type: "number", inputmode: "numeric" },
        { id: "hpp", label: "HPP", value: product?.hpp ?? "", type: "number", inputmode: "numeric" },
        { id: "stock", label: "Stok", value: product?.stock ?? "", type: "number", inputmode: "decimal" },
        { id: "min_stock", label: "Minimum Stok", value: product?.min_stock ?? "0", type: "number", inputmode: "decimal" },
        { id: "image_url", label: "URL Foto (opsional)", value: product?.image_url || "", placeholder: "https://…" }
      ]
    }).then(async values => {
      if (!values) return;
      try { await saveProduct(values, product); } catch (e) { showToast(e.message || String(e), "error"); }
    });
  }

  function normalizeSupabaseError(error, fallback = "Operasi cloud gagal.") {
    const message = String(error?.message || error?.error_description || error || fallback).trim();
    const code = String(error?.status || error?.code || "");
    if (/invalid api key|invalid key|api key/i.test(message) || (code === "401" && /apikey|api key/i.test(message))) {
      return new Error("Supabase menolak Publishable Key. Pastikan config.js memakai sb_publishable_ dari project yang sama dengan Project URL.");
    }
    if (/failed to fetch|network|load failed|timeout/i.test(message)) {
      return new Error("MŌVA tidak dapat menghubungi Supabase. Periksa internet lalu coba lagi.");
    }
    return new Error(message || fallback);
  }

  function getSupabasePublishableKey() {
    const key = String(
      window.MOVA_CONFIG?.supabasePublishableKey ||
      window.MOVA_CONFIG?.supabaseKey ||
      CONFIG.supabaseKey ||
      ""
    ).trim();
    if (!key) throw new Error("Supabase Publishable Key belum diatur.");
    if (!key.startsWith("sb_publishable_")) {
      throw new Error("Supabase menolak API key. Gunakan Publishable Key yang diawali sb_publishable_.");
    }
    return key;
  }

  function validateClientConfig() {
    if (!/^https:\/\/[^\s]+\.supabase\.co$/.test(CONFIG.supabaseUrl)) {
      throw new Error("Supabase URL belum benar di config.js.");
    }
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(CONFIG.supabaseKey)) {
      throw new Error("Supabase Publishable Key belum benar di config.js.");
    }
  }

  function createSupabaseClient() {
    if (!window.supabase?.createClient) throw new Error("SDK Supabase belum tersedia.");
    validateClientConfig();
    const key = getSupabasePublishableKey();
    if (!window.movaSupabase) {
      window.movaSupabase = window.supabase.createClient(CONFIG.supabaseUrl, key, SUPABASE_CLIENT_OPTIONS);
    }
    state.supabaseReady = true;
    return window.movaSupabase;
  }

  async function probeSupabase() {
    validateClientConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(`${CONFIG.supabaseUrl}/auth/v1/settings`, {
        method: "GET",
        cache: "no-store",
        headers: {
          apikey: CONFIG.supabaseKey,
          "x-client-info": `mova/${CONFIG.version}`
        },
        signal: controller.signal
      });
      if (!response.ok) {
        let detail = "";
        try { detail = await response.text(); } catch (_) {}
        throw normalizeSupabaseError({ status: response.status, message: detail || response.statusText }, "Supabase tidak tersedia.");
      }
      return true;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Koneksi Supabase terlalu lama. Periksa internet lalu coba lagi.");
      throw normalizeSupabaseError(error, "Supabase tidak dapat dihubungi.");
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadSupabase() {
    if (isCloudReady()) return true;
    try {
      validateClientConfig();
    } catch (error) {
      console.error(error);
      return false;
    }
    if (window.supabase?.createClient) {
      try { createSupabaseClient(); return true; } catch (error) { console.error(error); return false; }
    }
    return new Promise(resolve => {
      const script = document.createElement("script");
      script.src = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${encodeURIComponent(CONFIG.supabaseJsVersion)}/dist/umd/supabase.min.js`;
      script.async = true;
      script.crossOrigin = "anonymous";
      let done = false;
      const finish = ok => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (ok) {
          try { createSupabaseClient(); resolve(true); return; } catch (error) { console.error(error); }
        }
        state.supabaseReady = false;
        resolve(false);
      };
      const timer = setTimeout(() => finish(false), 12000);
      script.onload = () => finish(true);
      script.onerror = () => finish(false);
      document.head.appendChild(script);
    });
  }

  async function ensureBusiness() {
    const { data, error } = await window.movaSupabase.rpc("ensure_my_business", { p_name: "MŌVA" });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.business_id) throw new Error("Workspace bisnis belum tersedia.");
    state.business = row;
    state.role = row.role || "owner";
    state.plan = row.plan || "free";
    await window.movaSupabase.rpc("register_my_device", {
      p_business_id: row.business_id,
      p_device_key: state.deviceKey,
      p_device_name: navigator.userAgent.slice(0, 80),
      p_role: state.role === "owner" ? "owner" : state.role,
      p_app_version: CONFIG.version
    }).catch(() => {});
  }

  async function loadData() {
    if (!state.user || !state.business) return;
    const b = state.business.business_id;
    const q = (table, fields = "*") => window.movaSupabase.from(table).select(fields).eq("business_id", b);
    const results = await Promise.all([
      q("products").eq("is_active", true).order("name"),
      q("transactions").order("created_at", { ascending: false }).limit(500),
      q("transaction_items").order("created_at", { ascending: false }).limit(1000),
      q("expenses").order("created_at", { ascending: false }).limit(500),
      q("customers").order("name").limit(500),
      q("business_settings").limit(1),
      q("daily_closings").order("closing_date", { ascending: false }).limit(120),
      q("cash_reconciliations").order("created_at", { ascending: false }).limit(120)
    ]);
    for (const r of results) if (r.error) throw r.error;
    state.products = results[0].data || [];
    state.transactions = results[1].data || [];
    state.items = results[2].data || [];
    state.expenses = results[3].data || [];
    state.customers = results[4].data || [];
    state.settings = results[5].data?.[0] || { business_id: b, business_name: state.business.business_name || "MŌVA", tagline: "", receipt_footer: "Terima kasih telah berbelanja." };
    state.closings = results[6].data || [];
    state.reconciliations = results[7].data || [];
    const theme = state.settings.theme || "system";
    localStorage.setItem("mova.theme", theme);
  }

  async function refreshCloud(showMessage = true) {
    if (!onlineRequired() || !state.user) { if (!state.user) render(); return; }
    try {
      state.loading = true;
      setStatus("Memuat cloud…", "loading");
      await ensureBusiness();
      await loadData();
      setStatus(`Online · ${state.business?.business_name || "Bisnis"}`, "online");
      render();
      if (showMessage) showToast("Data cloud diperbarui", "success");
    } catch (error) {
      console.error(error);
      setStatus("Cloud bermasalah", "error");
      showToast(normalizeSupabaseError(error, "Gagal memuat cloud.").message, "error");
      render();
    } finally { state.loading = false; }
  }

  async function diagnoseCloud() {
    if (!state.online) return showToast("Tidak ada koneksi internet.", "error");
    setStatus("Memeriksa API…", "loading");
    try {
      if (!isCloudReady()) {
        const ready = await loadSupabase();
        if (!ready) throw new Error("SDK Supabase tidak dapat dimuat.");
      }
      await probeSupabase();
      setStatus(state.user ? `Online · ${state.business?.business_name || "Bisnis"}` : "Online · belum masuk", state.user ? "online" : "loading");
      showToast("Koneksi Supabase valid dan API dapat dijangkau.", "success");
      return true;
    } catch (error) {
      console.error(error);
      setStatus("API ditolak / offline", "error");
      showToast(normalizeSupabaseError(error).message, "error");
      return false;
    }
  }

  function isAndroidNativeShell() {
    return !!(window.MovaNative?.isAndroidShell);
  }

  function authRedirectUrl() {
    if (isAndroidNativeShell() && window.location.protocol === "file:") return "mova://auth/callback";
    if (window.location.protocol === "https:") {
      return `${window.location.origin}${window.location.pathname || "/"}`;
    }
    return "";
  }

  function sanitizeCallbackUrl(url) {
    try { return new URL(url, window.location.href); }
    catch { return null; }
  }

  async function exchangeAuthCodeFromUrl(url = window.location.href) {
    const parsed = sanitizeCallbackUrl(url);
    if (!parsed) return false;
    const params = parsed.searchParams;
    const code = params.get("code");
    const error = params.get("error") || params.get("error_code");
    const description = params.get("error_description");
    if (error) {
      const message = description || error;
      showToast(`Login dibatalkan/gagal: ${message}`, "error");
      return false;
    }
    if (!code) return false;
    const { data, error: exchangeError } = await window.movaSupabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    if (window.location.protocol !== "file:") {
      try { window.history.replaceState({}, document.title, `${parsed.origin}${parsed.pathname}`); } catch (_) {}
    }
    state.session = data?.session || null;
    state.user = data?.user || data?.session?.user || null;
    if (state.user && state.online) await refreshCloud(false);
    showToast("Login berhasil. Selamat datang di MŌVA.", "success");
    return true;
  }

  async function startGoogleLogin() {
    if (!state.supabaseReady) return showToast("Supabase belum siap.", "error");
    try {
      const redirectTo = authRedirectUrl();
      if (!redirectTo) {
        throw new Error("Google Login di mode lokal/SPCK memerlukan alamat HTTPS atau APK native MŌVA. Gunakan APK atau buka versi HTTPS.");
      }
      const { data, error } = await window.movaSupabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true
        }
      });
      if (error) throw normalizeSupabaseError(error, "Google Login gagal dimulai.");
      if (!data?.url) throw new Error("URL login Google tidak tersedia.");

      // Android APK must leave the WebView for Google sign-in to avoid embedded-browser restrictions.
      if (window.MovaNative?.openAuthUrl && window.location.protocol === "file:") {
        const nativeResult = JSON.parse(window.MovaNative.openAuthUrl(JSON.stringify({ url: data.url })) || "{}");
        if (nativeResult?.ok === false) throw new Error(nativeResult.error || "Browser autentikasi tidak dapat dibuka.");
      } else {
        window.location.assign(data.url);
      }
    } catch (e) {
      console.error(e);
      showToast(e.message || "Login Google gagal dimulai.", "error");
    }
  }

  async function requestPasswordReset(email) {
    const clean = String(email || "").trim();
    if (!clean) return showToast("Masukkan email terlebih dahulu.", "error");
    try {
      const redirectTo = authRedirectUrl();
      if (!redirectTo) throw new Error("Reset password di mode lokal/SPCK memerlukan alamat HTTPS atau APK native MŌVA.");
      const { error } = await window.movaSupabase.auth.resetPasswordForEmail(clean, { redirectTo });
      if (error) throw normalizeSupabaseError(error, "Gagal mengirim link reset password.");
      showToast("Link reset password sudah dikirim. Periksa email Anda.", "success");
    } catch (e) {
      showToast(e.message || "Gagal mengirim link reset password.", "error");
    }
  }

  async function updateRecoveredPassword() {
    const values = await openModal({
      title: "Buat Password Baru",
      message: "Sesi pemulihan aktif. Buat password baru untuk akun MŌVA Anda.",
      confirmText: "Simpan Password",
      fields: [
        { id: "password", label: "Password Baru", type: "password", autocomplete: "new-password", placeholder: "Minimal 6 karakter" },
        { id: "confirm", label: "Ulangi Password", type: "password", autocomplete: "new-password", placeholder: "Ulangi password" }
      ]
    });
    if (!values) return;
    if (values.password.length < 6) return showToast("Password minimal 6 karakter.", "error");
    if (values.password !== values.confirm) return showToast("Konfirmasi password tidak sama.", "error");
    try {
      const { error } = await window.movaSupabase.auth.updateUser({ password: values.password });
      if (error) throw error;
      showToast("Password berhasil diperbarui.", "success");
    } catch (e) { showToast(e.message || "Gagal memperbarui password.", "error"); }
  }

  function handleAuth() {
    if (!state.supabaseReady) return showToast("Supabase belum siap.", "error");
    return new Promise(resolve => {
      const modalRoot = $("#modalRoot");
      const wrap = document.createElement("div");
      wrap.className = "modal-backdrop foundation-modal-backdrop auth-modal-backdrop";
      wrap.innerHTML = `
        <div class="modal foundation-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="movaAuthTitle">
          <div class="form-card-header">
            <div><span class="eyebrow">AKUN MŌVA</span><h2 id="movaAuthTitle">Masuk ke MŌVA</h2></div>
            <button class="icon-button" type="button" data-auth-close aria-label="Tutup">×</button>
          </div>
          <p class="modal-message">Gunakan Google atau email. Akun yang sama dapat dipakai di Android, iPhone, tablet, dan browser.</p>
          <button type="button" class="auth-google-button" data-auth-google><span class="auth-google-icon">G</span><span>Continue with Google</span></button>
          <div class="auth-divider"><span>atau</span></div>
          <div class="mova-auth-tabs" role="tablist" aria-label="Mode akun">
            <button type="button" class="secondary-button auth-tab active" data-auth-tab="login">Masuk</button>
            <button type="button" class="secondary-button auth-tab" data-auth-tab="signup">Daftar</button>
          </div>
          <div class="modal-fields auth-fields">
            <div class="form-group"><label for="authEmail">Email</label><input id="authEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="nama@email.com"></div>
            <div class="form-group"><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Password"></div>
          </div>
          <div class="auth-recovery-row"><button type="button" class="text-button" data-auth-reset>Lupa password?</button><span data-auth-status></span></div>
          <div class="form-actions auth-actions"><button class="secondary-button" type="button" data-auth-cancel>Batal</button><button class="primary-button" type="button" data-auth-submit>Masuk</button></div>
        </div>`;
      modalRoot.appendChild(wrap);
      let mode = "login";
      let busy = false;
      const close = () => { wrap.remove(); resolve(); };
      const email = () => $("#authEmail", wrap)?.value.trim() || "";
      const password = () => $("#authPassword", wrap)?.value || "";
      const setMode = next => {
        mode = next;
        $("#movaAuthTitle", wrap).textContent = next === "login" ? "Masuk ke MŌVA" : "Buat Akun MŌVA";
        $("[data-auth-submit]", wrap).textContent = next === "login" ? "Masuk" : "Daftar";
        $("#authPassword", wrap).setAttribute("autocomplete", next === "login" ? "current-password" : "new-password");
        $$('[data-auth-tab]', wrap).forEach(btn => btn.classList.toggle("active", btn.dataset.authTab === next));
        $("[data-auth-reset]", wrap).style.display = next === "login" ? "inline-flex" : "none";
        $("[data-auth-status]", wrap).textContent = "";
      };
      const setBusy = value => {
        busy = value;
        $$('button, input', wrap).forEach(el => el.disabled = value && !el.matches('[data-auth-close]'));
        $("[data-auth-status]", wrap).textContent = value ? "Memproses…" : "";
      };

      wrap.addEventListener("click", async e => {
        if (e.target.closest("[data-auth-close], [data-auth-cancel]")) return close();
        const tab = e.target.closest("[data-auth-tab]");
        if (tab) return setMode(tab.dataset.authTab);
        if (e.target.closest("[data-auth-google]")) { if (!busy) await startGoogleLogin(); return; }
        if (e.target.closest("[data-auth-reset]")) { if (!busy) await requestPasswordReset(email()); return; }
        if (!e.target.closest("[data-auth-submit]") || busy) return;
        const cleanEmail = email(), cleanPassword = password();
        if (!cleanEmail || !cleanPassword) return showToast("Email dan password wajib diisi.", "error");
        if (mode === "signup" && cleanPassword.length < 6) return showToast("Password minimal 6 karakter.", "error");
        setBusy(true);
        try {
          if (mode === "login") {
            const { data, error } = await window.movaSupabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
            if (error) throw normalizeSupabaseError(error, "Login gagal.");
            state.session = data?.session || null; state.user = data?.user || null;
            close();
            if (state.user) await refreshCloud(false);
            showToast("Selamat datang kembali di MŌVA.", "success");
          } else {
            const redirectTo = authRedirectUrl();
            const signupOptions = { data: { business_name: "MŌVA" } };
            if (redirectTo) signupOptions.emailRedirectTo = redirectTo;
            const { data, error } = await window.movaSupabase.auth.signUp({ email: cleanEmail, password: cleanPassword, options: signupOptions });
            if (error) throw normalizeSupabaseError(error, "Pendaftaran gagal.");
            if (data?.session) {
              state.session = data.session; state.user = data.user; close(); await refreshCloud(false); showToast("Akun MŌVA berhasil dibuat.", "success");
            } else {
              setBusy(false); showToast("Akun dibuat. Periksa email verifikasi lalu masuk kembali.", "info");
            }
          }
        } catch (e) {
          setBusy(false);
          showToast(e.message || "Autentikasi gagal.", "error");
        }
      });
      wrap.addEventListener("keydown", e => { if (e.key === "Escape" && !busy) close(); if (e.key === "Enter" && document.activeElement?.id !== "authEmail" && !busy) $("[data-auth-submit]", wrap).click(); });
      setMode("login");
      setTimeout(() => $("#authEmail", wrap)?.focus(), 60);
    });
  }

  window.MovaAuth = {
    async handleDeepLink(url) {
      if (!isCloudReady()) { window.movaAuthPendingUrl = String(url || ""); return; }
      try {
        await exchangeAuthCodeFromUrl(String(url || ""));
      } catch (e) {
        console.error(e);
        showToast(e.message || "Callback login tidak dapat diproses.", "error");
      }
    }
  };

  async function saveProduct(values, existing = null) {
    if (!onlineRequired() || !state.user || state.role === "viewer") return;
    const name = String(values.name || "").trim();
    const sku = String(values.sku || "").trim().toUpperCase();
    if (!name) throw new Error("Nama produk wajib diisi.");
    if (!sku) throw new Error("SKU wajib diisi.");
    const duplicate = state.products.find(p => String(p.sku || "").toUpperCase() === sku && String(p.id) !== String(existing?.id || ""));
    if (duplicate) throw new Error(`SKU ${sku} sudah digunakan oleh ${duplicate.name}.`);
    const payload = {
      ...(existing?.id ? { id: existing.id } : {}),
      business_id: state.business.business_id,
      name, sku,
      unit: String(values.unit || "pcs").trim() || "pcs",
      price: Math.max(0, n(values.price)),
      hpp: Math.max(0, n(values.hpp)),
      stock: Math.max(0, n(values.stock)),
      min_stock: Math.max(0, n(values.min_stock)),
      image_url: String(values.image_url || "").trim() || null,
      is_active: true,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await window.movaSupabase.from("products").upsert(payload, { onConflict: "id" }).select().single();
    if (error) throw error;
    state.products = existing ? state.products.map(p => p.id === data.id ? data : p) : [...state.products, data].sort((a,b)=>a.name.localeCompare(b.name));
    render(); showToast("Produk tersimpan di cloud.", "success");
  }

  async function archiveProduct(id) {
    if (!onlineRequired() || state.role !== "owner") return;
    if (!confirm("Arsipkan produk ini? Riwayat transaksi tidak akan dihapus.")) return;
    const { error } = await window.movaSupabase.from("products").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", id).eq("business_id", state.business.business_id);
    if (error) throw error;
    state.products = state.products.filter(p => p.id !== id);
    render(); showToast("Produk diarsipkan.", "success");
  }

  async function checkout() {
    if (!onlineRequired() || !state.user) return;
    if (!state.cart.length) return showToast("Keranjang masih kosong.", "error");
    const method = $("#paymentMethod")?.value || "cash";
    const total = state.cart.reduce((s, x) => s + n(x.price) * n(x.quantity), 0);
    const received = method === "qris" ? total : n($("#paidAmount")?.value);
    if (method === "cash" && received < total) return showToast("Uang diterima belum cukup.", "error");
    const transactionNumber = `MVA-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payload = {
      p_business_id: state.business.business_id,
      p_transaction_number: transactionNumber,
      p_payment_method: method,
      p_paid_amount: received,
      p_customer_id: null,
      p_cashier_name: state.settings?.default_cashier || state.user.email,
      p_device_id: state.deviceKey,
      p_note: null,
      p_items: state.cart.map(x => ({ product_id: x.id, quantity: x.quantity }))
    };
    try {
      const { data, error } = await window.movaSupabase.rpc("mova_create_transaction", payload);
      if (error) throw error;
      state.cart = [];
      await loadData(); render();
      showToast(`Transaksi ${data?.transaction_number || transactionNumber} berhasil.`, "success");
    } catch (error) {
      console.error(error); showToast(error.message || "Transaksi gagal.", "error");
    }
  }

  async function addExpense() {
    if (!onlineRequired() || !state.user) return;
    const amount = n($("#expenseAmount")?.value);
    if (amount <= 0) return showToast("Jumlah pengeluaran harus lebih dari 0.", "error");
    try {
      const { data, error } = await window.movaSupabase.rpc("mova_add_expense", {
        p_business_id: state.business.business_id,
        p_category: String($("#expenseCategory")?.value || "Lainnya").trim() || "Lainnya",
        p_description: String($("#expenseDescription")?.value || "").trim() || null,
        p_amount: amount,
        p_payment_source: $("#expensePayment")?.value || "cash",
        p_expense_date: state.selectedDate,
        p_device_id: state.deviceKey
      });
      if (error) throw error;
      state.expenses.unshift(data); render(); showToast("Pengeluaran tersimpan.", "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function closeDay() {
    if (!onlineRequired() || !state.user) return;
    const s = summaryFor();
    try {
      const { data, error } = await window.movaSupabase.rpc("mova_close_day", { p_business_id: state.business.business_id, p_closing_date: state.selectedDate, p_summary: s, p_device_id: state.deviceKey });
      if (error) throw error;
      state.closings.unshift(data); render(); showToast("Hari berhasil ditutup.", "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function reconcile() {
    if (!onlineRequired() || !state.user) return;
    const value = prompt("Masukkan kas fisik:");
    if (value === null) return;
    try {
      const s = summaryFor();
      const { data, error } = await window.movaSupabase.rpc("mova_reconcile_cash", { p_business_id: state.business.business_id, p_reconciliation_date: state.selectedDate, p_system_cash: s.cash, p_physical_cash: n(value), p_device_id: state.deviceKey });
      if (error) throw error;
      state.reconciliations.unshift(data); render(); showToast("Rekonsiliasi tersimpan.", "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function cancelTransaction(id) {
    if (!onlineRequired() || !state.user) return;
    if (!confirm("Batalkan transaksi ini? Stok akan dikembalikan dan riwayat tetap dipertahankan.")) return;
    try {
      const { error } = await window.movaSupabase.rpc("mova_cancel_transaction", { p_business_id: state.business.business_id, p_transaction_id: id, p_device_id: state.deviceKey });
      if (error) throw error;
      await loadData(); render(); showToast("Transaksi dibatalkan dengan aman.", "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function saveSettings() {
    if (!onlineRequired() || !state.user || state.role !== "owner") return;
    const payload = {
      business_id: state.business.business_id,
      business_name: String($("#businessName")?.value || "MŌVA").trim() || "MŌVA",
      tagline: String($("#businessTagline")?.value || "").trim(),
      address: String($("#businessAddress")?.value || "").trim() || null,
      phone: String($("#businessPhone")?.value || "").trim() || null,
      instagram: String($("#businessInstagram")?.value || "").trim() || null,
      default_cashier: String($("#defaultCashier")?.value || "").trim() || null,
      receipt_footer: String($("#receiptFooter")?.value || "").trim() || null,
      theme: $("#themeSelect")?.value || "system",
      updated_at: new Date().toISOString()
    };
    const file = $("#businessLogo")?.files?.[0];
    if (file) payload.logo_url = await uploadImage(file, "business");
    try {
      const { data, error } = await window.movaSupabase.from("business_settings").upsert(payload, { onConflict: "business_id" }).select().single();
      if (error) throw error;
      state.settings = data;
      state.business.business_name = data.business_name;
      localStorage.setItem("mova.theme", data.theme || "system");
      applyTheme(); render(); showToast("Profil bisnis tersimpan.", "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function uploadImage(file, kind) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${state.business.business_id}/${kind}/${uuid()}.${ext}`;
    const { error } = await window.movaSupabase.storage.from("mova-media").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (error) throw error;
    const { data } = window.movaSupabase.storage.from("mova-media").getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function backup() {
    if (!onlineRequired() || !state.user) return;
    try {
      const b = state.business.business_id;
      const datasets = {};
      const pageSize = 1000;
      for (const table of TABLES) {
        const rows = [];
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await window.movaSupabase.from(table).select("*").eq("business_id", b).range(from, from + pageSize - 1);
          if (error) throw error;
          const batch = data || [];
          rows.push(...batch);
          if (batch.length < pageSize) break;
        }
        datasets[table] = rows;
      }
      const backupApp = { name: CONFIG.name, version: CONFIG.version, packageId: CONFIG.packageId, exported_at: new Date().toISOString() };
      const blob = new Blob([JSON.stringify({ app: backupApp, business_id: b, business: state.business, data: datasets }, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = `mova-backup-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Backup siap disimpan.", "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function restore() {
    if (!onlineRequired() || !state.user || state.role !== "owner") return;
    const input = document.createElement("input"); input.type = "file"; input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || parsed.business_id !== state.business.business_id) throw new Error("Backup harus berasal dari bisnis yang sama.");
        if (!parsed.data || typeof parsed.data !== "object") throw new Error("Format backup MŌVA tidak valid.");
        if (!confirm("Restore akan memasukkan kembali data ke workspace ini. Data dengan ID yang sama akan diperbarui. Lanjutkan?")) return;
        const { data, error } = await window.movaSupabase.rpc("mova_restore_backup", {
          p_business_id: state.business.business_id,
          p_backup: parsed.data,
          p_device_id: state.deviceKey
        });
        if (error) throw normalizeSupabaseError(error, "Restore gagal.");
        await loadData(); render();
        showToast(`Restore selesai · ${Number(data?.restored || 0)} baris diproses.`, "success");
      } catch (e) { showToast(normalizeSupabaseError(e, "Restore gagal.").message, "error"); }
    };
    input.click();
  }

  async function switchBusiness() {
    if (!onlineRequired()) return;
    try {
      const { data, error } = await window.movaSupabase.rpc("list_my_businesses");
      if (error) throw error;
      const rows = data || [];
      if (rows.length <= 1) return showToast("Akun ini hanya memiliki satu bisnis.", "info");
      const val = await openModal({
        title: "Ganti Bisnis",
        message: "Pindah workspace cloud tanpa mencampur data.",
        confirmText: "Gunakan Bisnis",
        fields: [{ id: "business", label: "Bisnis", kind: "select", value: state.business?.business_id || rows[0]?.business_id, options: rows.map(r => ({ value: r.business_id, label: `${r.business_name} · ${r.role}` })) }]
      });
      if (!val) return;
      const id = val.business;
      const row = rows.find(x => x.business_id === id);
      if (!row) return;
      state.business = row; state.role = row.role; state.plan = row.plan; await loadData(); render(); showToast(`Workspace ${row.business_name} aktif.`, "success");
    } catch (e) { showToast(e.message || String(e), "error"); }
  }

  async function signOut() {
    if (!onlineRequired()) return;
    if (!confirm("Keluar dari akun MŌVA di perangkat ini?")) return;
    await window.movaSupabase.auth.signOut();
    state.session = null; state.user = null; state.business = null; state.products = []; state.transactions = []; state.items = []; state.expenses = []; state.customers = []; state.settings = null; state.cart = [];
    setStatus("Belum masuk", "error"); setPage("home"); showToast("Akun dilepas dari perangkat ini.", "info");
  }

  async function buyPro() {
    if (state.plan === "pro") return showToast("MŌVA Pro sudah aktif.", "success");
    if (window.MovaNative?.purchasePro) {
      try { const result = await window.MovaNative.purchasePro(JSON.stringify({ productId: CONFIG.proMonthly })); if (result?.error) throw new Error(result.error); showToast("Google Play membuka langganan MŌVA Pro.", "info"); }
      catch (e) { showToast(e.message || String(e), "error"); }
      return;
    }
    showToast("Langganan Pro dijalankan melalui aplikasi Android MŌVA.", "info");
  }

  async function terminal() {
    if (!state.user) return showToast("Masuk ke akun terlebih dahulu.", "info");
    if (state.plan !== "pro") return showToast("Payment Terminal tersedia di MŌVA Pro.", "info");
    if (window.MovaNative) {
      try {
        window.MovaNative.setDeviceRole(JSON.stringify({ role: "payment_terminal" }));
        await window.movaSupabase.rpc("register_my_device", {
          p_business_id: state.business.business_id,
          p_device_key: state.deviceKey,
          p_device_name: navigator.userAgent.slice(0, 80),
          p_role: "payment_terminal",
          p_app_version: CONFIG.version
        });
        window.MovaNative.openNotificationAccess("");
        showToast("Terminal disiapkan. Aktifkan akses notifikasi untuk MŌVA.", "success");
      } catch (e) { showToast(e.message || String(e), "error"); }
      return;
    }
    showToast("Terminal native aktif setelah aplikasi Android MŌVA digunakan.", "info");
  }

  async function deleteAccount() {
    if (!onlineRequired() || !state.user || state.role !== "owner") return;
    if (!confirm("Penghapusan akun bersifat permanen. Lanjutkan?")) return;
    const { data, error } = await window.movaSupabase.functions.invoke("delete-account", { body: { confirm: "DELETE_ACCOUNT" } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || "Penghapusan akun gagal.");
    await signOut();
  }

  function applyTheme() {
    const saved = state.settings?.theme || localStorage.getItem("mova.theme") || "system";
    const actual = saved === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : saved;
    document.documentElement.classList.toggle("light", actual === "light");
    document.documentElement.dataset.theme = actual;
    document.title = `${CONFIG.name} — Business Manager`;
  }

  function bindEvents() {
    document.addEventListener("click", async e => {
      const navBtn = e.target.closest("[data-page]");
      if (navBtn) { e.preventDefault(); setPage(navBtn.dataset.page); return; }

      const add = e.target.closest("[data-add]");
      if (add) { const p = state.products.find(x => x.id === add.dataset.add); if (!p) return; const existing = state.cart.find(x => x.id === p.id); const nextQty = existing ? existing.quantity + 1 : 1; if (nextQty > n(p.stock)) return showToast("Stok tidak cukup.", "error"); if (existing) existing.quantity = nextQty; else state.cart.push({ id:p.id, name:p.name, price:n(p.price), quantity:1 }); renderKasir(); return; }
      const inc = e.target.closest("[data-cart-inc]");
      if (inc) { const item = state.cart.find(x => x.id === inc.dataset.cartInc); const p = state.products.find(x => x.id === inc.dataset.cartInc); if (item && p && item.quantity < n(p.stock)) item.quantity++; else showToast("Stok tidak cukup.", "error"); renderKasir(); return; }
      const dec = e.target.closest("[data-cart-dec]");
      if (dec) { const item = state.cart.find(x => x.id === dec.dataset.cartDec); if (item) { item.quantity--; if (item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== item.id); } renderKasir(); return; }

      const edit = e.target.closest("[data-edit]");
      if (edit) return productModal(state.products.find(p => p.id === edit.dataset.edit));
      const del = e.target.closest("[data-delete]");
      if (del) return archiveProduct(del.dataset.delete);
      const cancelTx = e.target.closest("[data-cancel-tx]");
      if (cancelTx) return cancelTransaction(cancelTx.dataset.cancelTx);

      const action = e.target.closest("[data-action]")?.dataset.action;
      if (!action) return;
      try {
        if (action === "login") return handleAuth();
        if (action === "new-product") return productModal();
        if (action === "clear-cart") { state.cart = []; renderKasir(); return; }
        if (action === "checkout") return checkout();
        if (action === "add-expense") return addExpense();
        if (action === "close-day") return closeDay();
        if (action === "reconcile") return reconcile();
        if (action === "refresh") return refreshCloud(true);
        if (action === "cloud-diagnostics") return diagnoseCloud();
        if (action === "save-settings") return saveSettings();
        if (action === "backup") return backup();
        if (action === "restore") return restore();
        if (action === "switch-business") return switchBusiness();
        if (action === "sign-out") return signOut();
        if (action === "buy-pro") return buyPro();
        if (action === "terminal") return terminal();
        if (action === "delete-account") return deleteAccount();
      } catch (err) { console.error(err); showToast(err.message || String(err), "error"); }
    });

    document.addEventListener("input", e => {
      if (e.target.id === "cashierSearch") {
        const value = e.target.value; const caret = e.target.selectionStart ?? value.length;
        state.cashierQuery = value; renderKasir();
        const next = $("#cashierSearch"); if (next) { next.focus(); next.setSelectionRange(caret, caret); }
      }
      if (e.target.id === "productSearch") {
        const value = e.target.value; const caret = e.target.selectionStart ?? value.length;
        state.productQuery = value; renderProduk();
        const next = $("#productSearch"); if (next) { next.focus(); next.setSelectionRange(caret, caret); }
      }
      if (e.target.id === "paidAmount") { const total = state.cart.reduce((s,x)=>s+n(x.price)*n(x.quantity),0); const change = n(e.target.value)-total; const el = $("#changePreview"); if(el) el.textContent = change >= 0 ? `Kembalian ${money(change)}` : `Kurang ${money(Math.abs(change))}`; }
    });

    document.addEventListener("change", e => {
      if (e.target.id === "themeSelect") { localStorage.setItem("mova.theme", e.target.value); applyTheme(); }
      if (e.target.id === "homeDate" || e.target.id === "financeDate") { state.selectedDate = e.target.value || todayKey(); render(); }
    });
    $("#headerAccountButton")?.addEventListener("click", () => setPage("more"));
    window.addEventListener("online", () => { state.online = true; setStatus(state.user ? "Online" : "Online · belum masuk", state.user ? "online" : "loading"); });
    window.addEventListener("offline", () => { state.online = false; setStatus("Internet wajib", "error"); render(); });
    window.addEventListener("mova-pro-purchase", event => {
      const detail = event.detail || {};
      const productId = String(detail.productId || "");
      const purchaseToken = String(detail.purchaseToken || "");
      if (!productId || !purchaseToken) return;
      try { window.MovaNative?.acknowledgeProPurchase?.(JSON.stringify({ purchaseToken })); } catch (_) {}
      showToast("Pembelian MŌVA Pro diterima. Aktivasi paket harus diverifikasi oleh server.", "info");
    });
    matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", applyTheme);
  }

  async function boot() {
    // Critical: UI/navigation binds before network/client loading.
    bindEvents();
    applyTheme();
    setPage("home");
    setStatus(state.online ? "Menyiapkan cloud…" : "Internet wajib", state.online ? "loading" : "error");

    const ready = await loadSupabase();
    if (!ready) {
      setStatus("SDK cloud gagal", "error");
      render();
      showToast("SDK Supabase tidak dapat dimuat. Periksa internet.", "error");
      return;
    }
    try {
      if (window.movaAuthPendingUrl) {
        const pending = window.movaAuthPendingUrl;
        window.movaAuthPendingUrl = "";
        await exchangeAuthCodeFromUrl(pending);
      } else {
        await exchangeAuthCodeFromUrl(window.location.href);
      }
      const { data } = await window.movaSupabase.auth.getSession();
      state.session = data?.session || null;
      state.user = state.session?.user || null;
      if (state.user && state.online) {
        await refreshCloud(false);
      } else {
        setStatus(state.user ? "Internet wajib" : "Online · belum masuk", state.user ? "error" : "loading");
        render();
      }
      window.movaSupabase.auth.onAuthStateChange((event, session) => {
        state.session = session || null;
        state.user = session?.user || null;
        if (event === "PASSWORD_RECOVERY" && session) {
          setTimeout(() => updateRecoveredPassword(), 0);
          return;
        }
        if (state.user && state.online) {
          setTimeout(() => refreshCloud(false), 0);
        } else {
          state.business = null;
          render();
        }
      });
    } catch (error) {
      console.error(error); setStatus("Auth bermasalah", "error"); render();
    }
  }

  window.MovaApp = { config: CONFIG, state, setPage, refresh: refreshCloud };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
