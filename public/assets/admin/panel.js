/* eslint-env browser */
'use strict';

/**
 * پنل مدیریت — منطق سمت کلاینت.
 *
 * نکات امنیتی:
 *  ۱. هیچ توکن یا کلیدی در این فایل نیست. احراز هویت با httpOnly cookie
 *     انجام می‌شود که JavaScript به آن دسترسی ندارد.
 *  ۲. تمام مقادیری که از سرور می‌آیند قبل از درج در DOM با escapeHtml
 *     پاک‌سازی می‌شوند — در غیر این صورت یک رکورد آلوده در دیتابیس
 *     تبدیل به XSS ذخیره‌شده می‌شد.
 *  ۳. هیچ inline event handler ای وجود ندارد تا CSP بتواند
 *     'unsafe-inline' را کامل ممنوع کند.
 */

let config = [];
let activeSectionIndex = null;
let currentPage = 1;
let limit = 10;
let search = '';
let searchTimeout = null;
let currentEditingId = null;
let deleteTargetId = null;
let lastTotalPages = 1;

// ── Security helpers ─────────────────────────────────────────────────────────

/** خنثی‌سازی HTML برای هر مقداری که از دیتابیس می‌آید. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * همه‌ی درخواست‌ها از این تابع عبور می‌کنند.
 *
 * X-Requested-With یک دفاع CSRF است: مرورگر اجازه نمی‌دهد سایت دیگری
 * این هدر سفارشی را بدون preflight و تأیید CORS ست کند، بنابراین
 * درخواست‌های cookie-based از دامنه‌ی مهاجم رد می‌شوند.
 */
async function api(url, options) {
  const opts = options || {};
  const res = await fetch(url, Object.assign({}, opts, {
    credentials: 'same-origin',
    headers: Object.assign({ 'X-Requested-With': 'XMLHttpRequest' }, opts.headers || {}),
  }));

  if (res.status === 401) {
    window.location.href = '/admin/login';
    throw new Error('نشست منقضی شده است');
  }
  return res;
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}

function filterSidebar() {
  const query = document.getElementById('sidebar-search').value.toLowerCase();
  document.querySelectorAll('#sidebar-menu button').forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-message');

  // textContent — نه innerHTML: پیام خطا می‌تواند از سرور بیاید
  msgEl.textContent = message;

  const styles = {
    success: { bg: 'bg-emerald-600', icon: 'fa-check-circle' },
    error:   { bg: 'bg-rose-600',    icon: 'fa-exclamation-circle' },
    warning: { bg: 'bg-amber-500',   icon: 'fa-triangle-exclamation' },
    info:    { bg: 'bg-indigo-600',  icon: 'fa-info-circle' },
  };
  const s = styles[type] || styles.success;

  toast.className = 'fixed bottom-5 left-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium transition-all duration-400 text-white ' + s.bg;
  icon.className = 'fas text-lg ' + s.icon;

  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
  }, 4000);
}

function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  const tbl = document.querySelector('#table-controls + .overflow-x-auto');
  if (tbl) tbl.classList.add('hidden');
}

function hideLoading() {
  document.getElementById('loading-state').classList.add('hidden');
  const tbl = document.querySelector('#table-controls + .overflow-x-auto');
  if (tbl) tbl.classList.remove('hidden');
}

// ── Config & navigation ──────────────────────────────────────────────────────

async function loadConfig() {
  try {
    const res = await api('/admin/config-json');
    if (!res.ok) throw new Error('خطای سرور: ' + res.status);
    config = await res.json();
    document.getElementById('total-sections-count').textContent = config.length;
    renderSidebar();
  } catch (err) {
    showToast('خطا در لود تنظیمات: ' + err.message, 'error');
  }
}

const SECTION_ICONS = [
  'fa-users', 'fa-gear', 'fa-file', 'fa-chart-simple', 'fa-truck',
  'fa-cart-shopping', 'fa-envelope', 'fa-calendar', 'fa-image', 'fa-video',
  'fa-music', 'fa-code', 'fa-database', 'fa-cloud', 'fa-lock',
  'fa-bell', 'fa-flag', 'fa-gift', 'fa-star', 'fa-heart',
];

function renderSidebar() {
  const menu = document.getElementById('sidebar-menu');

  if (config.length === 0) {
    menu.innerHTML =
      '<div class="flex flex-col items-center justify-center py-10 text-gray-400">' +
      '<i class="fas fa-inbox text-2xl mb-2 text-gray-300"></i>' +
      '<span class="text-xs">هیچ بخش فعالی یافت نشد</span></div>';
    return;
  }

  menu.innerHTML = config.map((sec, idx) => {
    const iconClass = SECTION_ICONS[idx % SECTION_ICONS.length];
    const actionCount = Object.keys(sec.actions).length;
    return '' +
      '<button data-section-index="' + idx + '" id="sec-btn-' + idx + '" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-right text-sm font-medium transition-all group hover:bg-indigo-50/60 text-gray-600 hover:text-indigo-700 border border-transparent hover:border-indigo-100/50">' +
        '<span class="flex items-center gap-2.5 min-w-0">' +
          '<span class="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center text-gray-400 group-hover:text-indigo-500 transition shrink-0">' +
            '<i class="fas ' + iconClass + ' text-[11px]"></i>' +
          '</span>' +
          '<span class="truncate">' + escapeHtml(sec.section) + '</span>' +
        '</span>' +
        '<span class="text-[10px] bg-gray-100 group-hover:bg-indigo-100 text-gray-400 group-hover:text-indigo-500 px-2 py-0.5 rounded-md font-bold shrink-0">' + actionCount + '</span>' +
      '</button>';
  }).join('');
}

function selectSection(idx) {
  if (window.innerWidth < 768) toggleSidebar();

  document.querySelectorAll('#sidebar-menu button').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('sec-btn-' + idx);
  if (btn) btn.classList.add('active');

  activeSectionIndex = idx;
  const section = config[idx];

  document.getElementById('section-title').textContent = section.section;
  document.getElementById('section-desc').textContent =
    'مدیریت و نظارت بر داده‌های بخش ' + section.section + ' به صورت زنده';

  currentPage = 1;
  search = '';
  document.getElementById('search-input').value = '';
  document.getElementById('table-controls').classList.remove('hidden');

  const actionsDiv = document.getElementById('section-actions');
  actionsDiv.innerHTML = section.actions.create
    ? '<button data-action="open-create" class="w-full md:w-auto bg-gradient-to-l from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 transition text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200/40 flex items-center justify-center gap-2">' +
        '<i class="fas fa-plus"></i><span>ثبت جدید</span></button>'
    : '';

  fetchData();
}

// ── Data ─────────────────────────────────────────────────────────────────────

async function fetchData() {
  if (activeSectionIndex === null) return;
  const section = config[activeSectionIndex];
  const listAction = section.actions.list;

  if (!listAction) {
    renderEmptyTable('عملیات دریافت لیست برای این بخش تعریف نشده است.');
    return;
  }

  showLoading();

  const params = new URLSearchParams({ page: currentPage, limit: limit, search: search });
  const url = section.prefix + listAction.path + '?' + params.toString();

  try {
    const res = await api(url, { method: listAction.method.toUpperCase() });
    if (!res.ok) throw new Error('خطای سرور: ' + res.status);
    const data = await res.json();

    let items = [];
    let total = 0;
    let totalPages = 1;

    if (Array.isArray(data)) {
      items = data;
      total = data.length;
    } else if (data) {
      const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
      if (arrayKey) {
        items = data[arrayKey];
        total = data.totalUsers || data.total || items.length;
        totalPages = data.totalPages || Math.ceil(total / limit);
      } else {
        items = [data];
        total = 1;
      }
    }

    hideLoading();
    renderTable(items, total, totalPages);
  } catch (err) {
    hideLoading();
    showToast('خطا در دریافت اطلاعات: ' + err.message, 'error');
    renderEmptyTable('خطا در برقراری ارتباط با سرور.');
  }
}

function renderEmptyTable(msg) {
  document.getElementById('table-head').innerHTML = '';
  document.getElementById('table-body').innerHTML =
    '<tr><td colspan="100" class="text-center py-16 text-gray-400">' +
    '<div class="flex flex-col items-center gap-3">' +
    '<div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">' +
    '<i class="fas fa-database text-xl text-gray-300"></i></div>' +
    '<span class="text-sm font-medium">' + escapeHtml(msg) + '</span>' +
    '</div></td></tr>';
  document.getElementById('pagination-container').classList.add('hidden');
}

function formatCell(value) {
  if (value === undefined || value === null) return '-';

  if (typeof value === 'boolean') {
    // مقدار ثابت و مورد اعتماد — escape لازم نیست
    return value
      ? '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200/60"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot"></span>فعال</span>'
      : '<span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-200/60"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>غیرفعال</span>';
  }

  let text;
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      text = json.length > 50 ? json.substring(0, 50) + '...' : json;
    } catch (e) {
      text = '-';
    }
  } else {
    text = String(value);
    if (text.length > 40) text = text.substring(0, 40) + '...';
  }

  // هر مقدار آمده از دیتابیس اینجا خنثی می‌شود
  return escapeHtml(text);
}

function renderTable(items, total, totalPages) {
  const section = config[activeSectionIndex];
  lastTotalPages = totalPages || 1;

  const fieldsToShow = section.fields.length > 0
    ? section.fields
    : (items.length > 0 ? Object.keys(items[0]).map(k => ({ name: k, type: 'String' })) : []);

  const head = document.getElementById('table-head');
  const headers = fieldsToShow.map(f =>
    '<th class="px-4 md:px-6 py-3.5 text-xs font-bold">' + escapeHtml(f.name) + '</th>');
  headers.push('<th class="px-4 md:px-6 py-3.5 text-center text-xs font-bold">عملیات</th>');
  head.innerHTML = '<tr>' + headers.join('') + '</tr>';

  const body = document.getElementById('table-body');

  if (items.length === 0) {
    body.innerHTML =
      '<tr><td colspan="100" class="text-center py-16 text-gray-400">' +
      '<div class="flex flex-col items-center gap-3">' +
      '<div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">' +
      '<i class="fas fa-inbox text-xl text-gray-300"></i></div>' +
      '<span class="text-sm font-medium">هیچ داده‌ای در این بخش ثبت نشده است</span>' +
      (section.actions.create
        ? '<span class="text-xs text-gray-400">برای افزودن داده جدید از دکمه «ثبت جدید» استفاده کنید</span>'
        : '') +
      '</div></td></tr>';
    document.getElementById('pagination-container').classList.add('hidden');
    document.getElementById('total-count').textContent = '0';
    document.getElementById('current-page-display').textContent = '1';
    return;
  }

  body.innerHTML = items.map(item => {
    const cells = fieldsToShow.map(f =>
      '<td class="px-4 md:px-6 py-3.5 whitespace-nowrap text-sm text-gray-700 font-medium">' +
      formatCell(item[f.name]) + '</td>');

    // شناسه در data-id می‌رود، نه داخل رشته‌ی JavaScript — بنابراین
    // نمی‌تواند از context رشته فرار کند
    const id = escapeHtml(item._id);
    const buttons = [];

    if (section.actions.update) {
      buttons.push(
        '<button data-row-action="edit" data-id="' + id + '" class="inline-flex items-center gap-1 text-indigo-600 hover:text-white font-bold bg-indigo-50 hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg text-xs transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm hover:shadow-md" title="ویرایش">' +
        '<i class="fas fa-pen text-[10px]"></i><span class="hidden md:inline">ویرایش</span></button>');
    }
    if (section.actions['toggle-status']) {
      buttons.push(
        '<button data-row-action="toggle" data-id="' + id + '" class="inline-flex items-center gap-1 text-amber-600 hover:text-white font-bold bg-amber-50 hover:bg-amber-600 px-2.5 py-1.5 rounded-lg text-xs transition-all border border-amber-100 hover:border-amber-600 shadow-sm hover:shadow-md" title="تغییر وضعیت">' +
        '<i class="fas fa-toggle-on text-[10px]"></i><span class="hidden md:inline">وضعیت</span></button>');
    }
    if (section.actions.delete) {
      buttons.push(
        '<button data-row-action="delete" data-id="' + id + '" class="inline-flex items-center gap-1 text-rose-600 hover:text-white font-bold bg-rose-50 hover:bg-rose-600 px-2.5 py-1.5 rounded-lg text-xs transition-all border border-rose-100 hover:border-rose-600 shadow-sm hover:shadow-md" title="حذف">' +
        '<i class="fas fa-trash-can text-[10px]"></i><span class="hidden md:inline">حذف</span></button>');
    }

    return '<tr class="hover:bg-indigo-50/30 transition even:bg-gray-50/40">' + cells.join('') +
      '<td class="px-4 md:px-6 py-3.5 text-center whitespace-nowrap flex justify-center gap-1.5">' +
      buttons.join('') + '</td></tr>';
  }).join('');

  document.getElementById('total-count').textContent = total;
  document.getElementById('current-page-display').textContent = currentPage;

  const pag = document.getElementById('pagination-container');
  if (lastTotalPages > 1) {
    pag.classList.remove('hidden');
    document.getElementById('page-num').textContent = currentPage;
    document.getElementById('total-pages-display').textContent = lastTotalPages;

    document.getElementById('first-btn').disabled = currentPage <= 1;
    document.getElementById('prev-btn').disabled  = currentPage <= 1;
    document.getElementById('next-btn').disabled  = currentPage >= lastTotalPages;
    document.getElementById('last-btn').disabled  = currentPage >= lastTotalPages;

    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, total);
    document.getElementById('showing-info').textContent = 'نمایش ' + start + ' تا ' + end + ' از ' + total;
  } else {
    pag.classList.add('hidden');
    document.getElementById('showing-info').textContent = 'نمایش ' + total + ' مورد';
  }
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    search = document.getElementById('search-input').value;
    currentPage = 1;
    fetchData();
  }, 400);
}

function goToPage(page) {
  currentPage = Math.max(1, Math.min(page, lastTotalPages));
  fetchData();
}

// ── Row actions ──────────────────────────────────────────────────────────────

async function toggleStatus(id) {
  const section = config[activeSectionIndex];
  const action = section.actions['toggle-status'];
  const url = section.prefix + action.path.replace(':id', encodeURIComponent(id));

  try {
    const res = await api(url, { method: action.method.toUpperCase() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'ناموفق');
    showToast(data.message || 'وضعیت با موفقیت تغییر کرد.', 'success');
    fetchData();
  } catch (err) {
    showToast('خطا در تغییر وضعیت: ' + err.message, 'error');
  }
}

function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  const id = deleteTargetId;
  closeDeleteModal();

  const section = config[activeSectionIndex];
  const action = section.actions.delete;
  const url = section.prefix + action.path.replace(':id', encodeURIComponent(id));

  try {
    const res = await api(url, { method: action.method.toUpperCase() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'ناموفق');
    showToast(data.message || 'آیتم با موفقیت حذف شد.', 'success');
    fetchData();
  } catch (err) {
    showToast('خطا در حذف آیتم: ' + err.message, 'error');
  }
}

// ── Modal form ───────────────────────────────────────────────────────────────

function openCreateModal() {
  currentEditingId = null;
  document.getElementById('modal-title').textContent = 'ثبت مورد جدید';
  renderModalForm();
  document.getElementById('modal').classList.remove('hidden');
}

async function openEditModal(id) {
  currentEditingId = id;
  document.getElementById('modal-title').textContent = 'ویرایش اطلاعات';
  renderModalForm();

  const section = config[activeSectionIndex];
  const readAction = section.actions.read || { method: 'get', path: '/:id' };
  const url = section.prefix + readAction.path.replace(':id', encodeURIComponent(id));

  try {
    const res = await api(url, { method: readAction.method.toUpperCase() });
    if (!res.ok) throw new Error('یافت نشد');
    const itemData = await res.json();

    section.fields.forEach(f => {
      const el = document.getElementById('form-input-' + f.name);
      if (!el) return;
      if (f.type === 'Boolean') {
        el.checked = Boolean(itemData[f.name]);
      } else {
        // .value — نه innerHTML: مقدار به عنوان متن ست می‌شود
        el.value = itemData[f.name] !== undefined && itemData[f.name] !== null ? itemData[f.name] : '';
      }
    });

    document.getElementById('modal').classList.remove('hidden');
  } catch (err) {
    showToast('خطا در بازیابی اطلاعات مورد: ' + err.message, 'error');
  }
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

const INPUT_BASE = 'w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition';
const ICON_BASE  = 'absolute left-3 top-3.5 text-gray-400 text-xs';

function buildInput(f) {
  const name = escapeHtml(f.name);
  const id = 'form-input-' + name;
  const req = f.required ? 'required' : '';

  if (f.enumValues && f.enumValues.length > 0) {
    const options = f.enumValues
      .map(v => '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>')
      .join('');
    return '<div class="relative">' +
      '<select id="' + id + '" name="' + name + '" ' + req + ' class="' + INPUT_BASE + ' appearance-none cursor-pointer">' +
      '<option value="">انتخاب کنید...</option>' + options + '</select>' +
      '<i class="fas fa-chevron-down ' + ICON_BASE + ' pointer-events-none"></i></div>';
  }

  if (f.type === 'Boolean') {
    return '<label class="relative inline-flex items-center cursor-pointer gap-3 mt-1">' +
      '<input type="checkbox" id="' + id + '" name="' + name + '" class="sr-only peer">' +
      '<div class="w-10 h-5.5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>' +
      '<span class="text-xs text-gray-500 font-medium">فعال باشد</span></label>';
  }

  const lower = f.name.toLowerCase();
  let type = 'text';
  let icon = 'fa-pencil';
  let placeholder = name;

  if (lower.includes('password')) {
    type = 'password';
    icon = 'fa-lock';
    placeholder = currentEditingId ? 'برای عدم تغییر خالی بگذارید' : '••••••••';
  } else if (f.type === 'Number') {
    type = 'number'; icon = 'fa-hashtag';
  } else if (f.type === 'Date') {
    type = 'date'; icon = 'fa-calendar'; placeholder = '';
  } else if (lower.includes('email')) {
    type = 'email'; icon = 'fa-envelope'; placeholder = 'example@domain.com';
  } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('tel')) {
    type = 'tel'; icon = 'fa-phone'; placeholder = '09123456789';
  } else if (lower.includes('url') || lower.includes('link') || lower.includes('website')) {
    type = 'url'; icon = 'fa-link'; placeholder = 'https://';
  }

  // رمز عبور در حالت ویرایش اختیاری است
  const required = (type === 'password' && currentEditingId) ? '' : req;

  return '<div class="relative">' +
    '<input type="' + type + '" id="' + id + '" name="' + name + '" ' + required +
    ' placeholder="' + escapeHtml(placeholder) + '" class="' + INPUT_BASE + '">' +
    '<i class="fas ' + icon + ' ' + ICON_BASE + '"></i></div>';
}

function renderModalForm() {
  const form = document.getElementById('modal-form');
  const section = config[activeSectionIndex];

  if (section.fields.length === 0) {
    form.innerHTML = '<div class="flex flex-col items-center gap-3 py-8 text-gray-400">' +
      '<i class="fas fa-list text-2xl text-gray-300"></i>' +
      '<p class="text-sm">فیلدی برای این مدل یافت نشد.</p></div>';
    return;
  }

  form.innerHTML = section.fields.map(f => {
    const star = f.required ? '<span class="text-rose-500 mr-1">*</span>' : '';
    return '<div class="flex flex-col gap-1.5 bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/50">' +
      '<label class="text-xs font-bold text-gray-600 flex items-center gap-1">' +
      star + escapeHtml(f.name) +
      '<span class="text-[10px] text-gray-400 font-normal">(' + escapeHtml(f.type) + ')</span>' +
      '</label>' + buildInput(f) + '</div>';
  }).join('');
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('modal-submit-btn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';

  const section = config[activeSectionIndex];
  const isEdit = currentEditingId !== null;
  const action = isEdit ? section.actions.update : section.actions.create;

  const payload = {};
  section.fields.forEach(f => {
    const el = document.getElementById('form-input-' + f.name);
    if (!el) return;

    if (f.type === 'Boolean') {
      payload[f.name] = el.checked;
    } else if (f.type === 'Number') {
      if (el.value !== '') payload[f.name] = Number(el.value);
    } else {
      // در ویرایش، رمز خالی یعنی «تغییر نده»
      if (f.name.toLowerCase().includes('password') && isEdit && !el.value) return;
      payload[f.name] = el.value;
    }
  });

  const url = isEdit
    ? section.prefix + action.path.replace(':id', encodeURIComponent(currentEditingId))
    : section.prefix + action.path;

  try {
    const res = await api(url, {
      method: action.method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const detail = Array.isArray(data.details) ? data.details.join(' — ') : '';
      throw new Error(detail || data.message || 'ناموفق');
    }

    showToast(data.message || 'عملیات با موفقیت انجام شد.', 'success');
    closeModal();
    fetchData();
  } catch (err) {
    showToast('خطا در ارسال داده‌ها: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-check"></i> ذخیره تغییرات';
  }
}

async function logout() {
  try {
    await api('/admin/logout', { method: 'POST' });
  } catch (e) {
    // حتی اگر درخواست شکست خورد، کاربر را به صفحه لاگین ببر
  }
  window.location.href = '/admin/login';
}

// ── Event wiring (بدون هیچ inline handler ای) ────────────────────────────────

const ACTIONS = {
  'toggle-sidebar':    toggleSidebar,
  'logout':            logout,
  'first-page':        () => goToPage(1),
  'prev-page':         () => goToPage(currentPage - 1),
  'next-page':         () => goToPage(currentPage + 1),
  'last-page':         () => goToPage(lastTotalPages),
  'close-modal':       closeModal,
  'close-delete-modal': closeDeleteModal,
  'confirm-delete':    confirmDelete,
  'open-create':       openCreateModal,
};

document.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    e.preventDefault();
    const fn = ACTIONS[actionEl.dataset.action];
    if (fn) fn();
    return;
  }

  const sectionEl = e.target.closest('[data-section-index]');
  if (sectionEl) {
    selectSection(Number(sectionEl.dataset.sectionIndex));
    return;
  }

  const rowEl = e.target.closest('[data-row-action]');
  if (rowEl) {
    const id = rowEl.dataset.id;
    if (rowEl.dataset.rowAction === 'edit')   openEditModal(id);
    if (rowEl.dataset.rowAction === 'toggle') toggleStatus(id);
    if (rowEl.dataset.rowAction === 'delete') openDeleteModal(id);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-oninput]');
  if (!el) return;
  if (el.dataset.oninput === 'filter-sidebar')  filterSidebar();
  if (el.dataset.oninput === 'debounce-search') debounceSearch();
});

document.getElementById('modal-form').addEventListener('submit', handleFormSubmit);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDeleteModal();
  }
});

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('delete-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

loadConfig();
