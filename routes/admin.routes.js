const express = require('express');
const router = express.Router();
const { parseAdminRoutes } = require('../utils/adminParser');

// Configuration endpoint for the Admin panel to load sections, routes, and fields
router.get('/config-json', (req, res) => {
  try {
    const config = parseAdminRoutes();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// HTML Page for Admin Panel
router.get('/', (req, res) => {
  const apiKey = process.env.ADMIN_KEY || 'super-secret-admin';
  
  res.send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>پنل مدیریت هوشمند</title>
    <!-- Tailwind CSS (Local) -->
    <script src="/assets/js/tailwind.js"></script>
    <!-- Vazirmatn Font for beautiful Farsi typography -->
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <!-- Font Awesome 6 (Local) -->
    <link rel="stylesheet" href="/assets/css/fontawesome.css" />
    <style>
        * { font-family: 'Vazirmatn', sans-serif; }
        
        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* Sidebar scrollbar */
        #sidebar-menu::-webkit-scrollbar { width: 4px; }
        #sidebar-menu::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

        /* Modal animation */
        #modal {
            transition: opacity 0.25s ease, visibility 0.25s ease;
        }
        #modal.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        #modal:not(.hidden) {
            opacity: 1;
            visibility: visible;
        }
        #modal > div {
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        #modal.hidden > div {
            transform: scale(0.9) translateY(20px);
        }
        #modal:not(.hidden) > div {
            transform: scale(1) translateY(0);
        }

        /* Toast animation */
        #toast {
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Table row hover effect */
        #table-body tr {
            transition: background-color 0.15s ease;
        }

        /* Sidebar button active indicator */
        #sidebar-menu button.active {
            background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
            border-right: 3px solid #6366f1;
            color: #4f46e5;
        }

        /* Loading skeleton animation */
        @keyframes shimmer {
            0% { background-position: -200px 0; }
            100% { background-position: calc(200px + 100%) 0; }
        }
        .skeleton {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200px 100%;
            animation: shimmer 1.5s ease-in-out infinite;
            border-radius: 8px;
        }

        /* Badge pulse for active status */
        @keyframes pulse-dot {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }
        .status-dot {
            animation: pulse-dot 2s ease-in-out infinite;
        }

        /* Input focus glow */
        input:focus, select:focus, textarea:focus {
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }

        /* Custom checkbox */
        input[type="checkbox"] {
            accent-color: #6366f1;
        }

        /* Responsive sidebar */
        @media (max-width: 768px) {
            #sidebar {
                position: fixed;
                right: -280px;
                top: 0;
                bottom: 0;
                z-index: 40;
                transition: right 0.3s ease;
                box-shadow: 4px 0 20px rgba(0,0,0,0.1);
            }
            #sidebar.open {
                right: 0;
            }
            #sidebar-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.3);
                z-index: 39;
            }
            #sidebar-overlay.show {
                display: block;
            }
        }
    </style>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: { vazir: ['Vazirmatn', 'sans-serif'] },
                    colors: {
                        primary: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' }
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gradient-to-br from-slate-50 to-blue-50/30 text-gray-800 min-h-screen flex flex-col font-vazir">

    <!-- Mobile Sidebar Overlay -->
    <div id="sidebar-overlay" onclick="toggleSidebar()"></div>

    <!-- Top Navbar -->
    <header class="bg-gradient-to-l from-indigo-900 via-indigo-800 to-indigo-900 text-white shadow-lg shadow-indigo-200/30 py-3 px-4 md:px-6 flex justify-between items-center sticky top-0 z-30 backdrop-blur-sm">
        <div class="flex items-center gap-3">
            <button onclick="toggleSidebar()" class="md:hidden text-white/80 hover:text-white text-xl p-1.5 rounded-lg hover:bg-white/10 transition">
                <i class="fas fa-bars"></i>
            </button>
            <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                    <i class="fas fa-crown text-amber-300 text-sm"></i>
                </div>
                <div>
                    <h1 class="text-base md:text-lg font-bold tracking-tight">پنل مدیریت هوشمند</h1>
                    <p class="text-[10px] md:text-xs text-indigo-200/70 -mt-0.5">سیستم مدیریت پویای داده‌ها</p>
                </div>
            </div>
        </div>
        <div class="flex items-center gap-2 md:gap-3">
            <div class="hidden md:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                <i class="fas fa-key text-amber-300/70 text-xs"></i>
                <span class="text-[11px] text-indigo-200 font-medium">دسترسی ادمین</span>
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot"></span>
            </div>
            <button onclick="logout()" class="flex items-center gap-1.5 bg-white/10 hover:bg-rose-500/30 transition px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:border-rose-400/30">
                <i class="fas fa-sign-out-alt text-xs"></i>
                <span class="hidden md:inline">خروج</span>
            </button>
        </div>
    </header>

    <div class="flex flex-1 overflow-hidden relative">
        <!-- Sidebar -->
        <aside id="sidebar" class="w-64 bg-white/90 backdrop-blur-xl border-l border-gray-200/60 flex flex-col shadow-sm shrink-0">
            <!-- Sidebar Header -->
            <div class="p-4 border-b border-gray-100/80">
                <div class="flex items-center gap-2 text-gray-400 mb-2">
                    <i class="fas fa-layer-group text-[10px]"></i>
                    <p class="text-[10px] font-bold uppercase tracking-widest">بخش‌های مدیریت</p>
                </div>
                <div class="relative">
                    <input type="text" id="sidebar-search" oninput="filterSidebar()" placeholder="جستجوی بخش..." class="w-full pr-8 pl-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200/60 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-600 placeholder:text-gray-400">
                    <i class="fas fa-search absolute right-2.5 top-2 text-gray-400 text-[10px]"></i>
                </div>
            </div>
            <nav id="sidebar-menu" class="flex-1 p-3 space-y-0.5 overflow-y-auto">
                <!-- Sidebar links will be dynamically populated -->
                <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                    <i class="fas fa-spinner fa-spin text-lg mb-2"></i>
                    <span class="text-xs">در حال بارگذاری...</span>
                </div>
            </nav>
            <!-- Sidebar Footer -->
            <div class="p-3 border-t border-gray-100/80 text-center">
                <p class="text-[10px] text-gray-400">
                    <i class="fas fa-database ml-1"></i>
                    <span id="total-sections-count">0</span> بخش فعال
                </p>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col gap-4 md:gap-6 bg-transparent">
            <!-- Header of Section -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100/80 transition-all hover:shadow-md">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-100/50 hidden md:flex">
                        <i class="fas fa-table-cells-large"></i>
                    </div>
                    <div>
                        <h2 id="section-title" class="text-xl md:text-2xl font-black text-gray-900">انتخاب بخش</h2>
                        <p id="section-desc" class="text-xs md:text-sm text-gray-500 mt-0.5">یک بخش را از منوی سمت راست برای مدیریت انتخاب کنید.</p>
                    </div>
                </div>
                <div id="section-actions" class="flex gap-2 w-full md:w-auto">
                    <!-- Action buttons like Create will appear here -->
                </div>
            </div>

            <!-- Loading State -->
            <div id="loading-state" class="hidden bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-100/80 p-8">
                <div class="flex flex-col items-center gap-4">
                    <div class="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin"></div>
                    <p class="text-sm text-gray-500 font-medium">در حال بارگذاری اطلاعات...</p>
                </div>
            </div>

            <!-- List Content Table -->
            <div class="bg-white/90 backdrop-blur-xl rounded-2xl shadow-sm border border-gray-100/80 overflow-hidden flex flex-col transition-all hover:shadow-md">
                <!-- Search and Stats -->
                <div id="table-controls" class="p-4 md:p-5 border-b border-gray-100/80 flex flex-col md:flex-row gap-3 justify-between items-center hidden">
                    <div class="relative w-full md:w-72">
                        <i class="fas fa-search absolute right-3.5 top-3 text-gray-400 text-sm"></i>
                        <input type="text" id="search-input" oninput="debounceSearch()" placeholder="جستجو در این بخش..." class="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition">
                    </div>
                    <div class="flex items-center gap-4 text-xs text-gray-500">
                        <div class="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <i class="fas fa-database text-indigo-400"></i>
                            <span>تعداد کل:</span>
                            <span id="total-count" class="font-bold text-indigo-600">-</span>
                        </div>
                        <div class="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <i class="fas fa-list text-indigo-400"></i>
                            <span>صفحه:</span>
                            <span id="current-page-display" class="font-bold text-indigo-600">1</span>
                        </div>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-right border-collapse">
                        <thead id="table-head" class="bg-gradient-to-r from-gray-50 to-indigo-50/30 text-gray-500 text-xs font-bold uppercase border-b border-gray-100/80">
                            <!-- Headers populated dynamically -->
                        </thead>
                        <tbody id="table-body" class="divide-y divide-gray-100/60 text-sm">
                            <tr>
                                <td colspan="100" class="text-center py-20 text-gray-400">
                                    <div class="flex flex-col items-center gap-3">
                                        <div class="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                                            <i class="fas fa-folder-open text-2xl text-indigo-300"></i>
                                        </div>
                                        <span class="text-sm font-medium">لطفاً ابتدا یک بخش را انتخاب کنید</span>
                                        <span class="text-xs text-gray-400">از منوی سمت راست یک بخش را انتخاب نمایید</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Footer -->
                <div id="pagination-container" class="p-4 border-t border-gray-100/80 flex flex-col md:flex-row justify-between items-center gap-3 hidden">
                    <div class="text-xs text-gray-400">
                        <span id="showing-info">نمایش ۰ تا ۰ از ۰</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="first-btn" onclick="goToPage(1)" class="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition" disabled>
                            <i class="fas fa-chevron-right"></i><i class="fas fa-chevron-right -mr-1.5"></i>
                        </button>
                        <button id="prev-btn" onclick="prevPage()" class="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1" disabled>
                            <i class="fas fa-chevron-right text-[10px]"></i> قبلی
                        </button>
                        <div class="flex items-center gap-1 px-3">
                            <span id="page-num" class="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">۱</span>
                            <span class="text-xs text-gray-400">از</span>
                            <span id="total-pages-display" class="text-xs font-bold text-gray-600">۱</span>
                        </div>
                        <button id="next-btn" onclick="nextPage()" class="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1" disabled>
                            بعدی <i class="fas fa-chevron-left text-[10px]"></i>
                        </button>
                        <button id="last-btn" onclick="goToPage(Infinity)" class="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition" disabled>
                            <i class="fas fa-chevron-left"></i><i class="fas fa-chevron-left -mr-1.5"></i>
                        </button>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Create/Edit Modal -->
    <div id="modal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-2xl max-w-xl w-full mx-4 overflow-hidden shadow-2xl shadow-indigo-500/10 border border-gray-100/80 flex flex-col max-h-[85vh]">
            <!-- Modal Header -->
            <div class="p-5 border-b border-gray-100/80 flex justify-between items-center bg-gradient-to-l from-gray-50 to-white">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center text-indigo-500">
                        <i class="fas fa-pen-to-square text-xs"></i>
                    </div>
                    <h3 id="modal-title" class="text-base font-bold text-gray-900">ایجاد مورد جدید</h3>
                </div>
                <button onclick="closeModal()" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition text-lg">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <!-- Modal Body -->
            <form id="modal-form" onsubmit="handleFormSubmit(event)" class="p-5 md:p-6 space-y-4 overflow-y-auto flex-1 text-right">
                <!-- Fields populated dynamically -->
            </form>
            <!-- Modal Footer -->
            <div class="p-4 border-t border-gray-100/80 bg-gradient-to-r from-gray-50 to-white flex justify-between items-center">
                <div class="text-[10px] text-gray-400">
                    <i class="fas fa-info-circle ml-1"></i>
                    فیلدهای دارای <span class="text-rose-500">*</span> اجباری هستند
                </div>
                <div class="flex gap-2">
                    <button onclick="closeModal()" class="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-1.5 text-gray-600">
                        <i class="fas fa-times text-[10px]"></i> انصراف
                    </button>
                    <button id="modal-submit-btn" form="modal-form" type="submit" class="px-5 py-2 text-xs font-bold text-white bg-gradient-to-l from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 rounded-xl shadow-md shadow-indigo-200/50 transition flex items-center gap-1.5">
                        <i class="fas fa-check"></i> ذخیره تغییرات
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="delete-modal" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center hidden">
        <div class="bg-white rounded-2xl max-w-sm w-full mx-4 overflow-hidden shadow-2xl shadow-rose-500/10 border border-gray-100/80">
            <div class="p-6 text-center">
                <div class="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                    <i class="fas fa-trash-can text-rose-500 text-xl"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-900 mb-2">تأیید حذف</h3>
                <p class="text-sm text-gray-500 mb-1">آیا از حذف این آیتم اطمینان دارید؟</p>
                <p class="text-xs text-gray-400">این عملیات قابل بازگشت نیست</p>
            </div>
            <div class="p-4 border-t border-gray-100/80 flex justify-center gap-3">
                <button onclick="closeDeleteModal()" class="px-5 py-2 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition text-gray-600">انصراف</button>
                <button id="confirm-delete-btn" onclick="confirmDelete()" class="px-5 py-2 text-xs font-bold text-white bg-gradient-to-l from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 rounded-xl shadow-md shadow-rose-200/50 transition flex items-center gap-1.5">
                    <i class="fas fa-trash-can"></i> بله، حذف شود
                </button>
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="fixed bottom-5 left-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium transition-all duration-400 translate-y-20 opacity-0 pointer-events-none">
        <i id="toast-icon" class="fas fa-check-circle text-lg"></i>
        <span id="toast-message">پیام سیستم</span>
    </div>

    <!-- JS Logic -->
    <script>
        const apiKey = '${apiKey}';
        let config = [];
        let activeSectionIndex = null;
        let currentPage = 1;
        let limit = 10;
        let search = '';
        let searchTimeout = null;
        let currentEditingId = null;
        let deleteTargetId = null;
        let isLoading = false;

        // Toggle sidebar on mobile
        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar-overlay').classList.toggle('show');
        }

        // Filter sidebar sections
        function filterSidebar() {
            const query = document.getElementById('sidebar-search').value.toLowerCase();
            document.querySelectorAll('#sidebar-menu button').forEach(btn => {
                const text = btn.textContent.toLowerCase();
                btn.style.display = text.includes(query) ? 'flex' : 'none';
            });
        }

        // Fetch dynamic configuration
        async function loadConfig() {
            try {
                const res = await fetch('/' + apiKey + '/config-json', {
                    headers: { 'x-api-key': apiKey }
                });
                console.log('res', res)
                config = await res.json();
                document.getElementById('total-sections-count').textContent = config.length;
                renderSidebar();
            } catch (err) {
                showToast('خطا در لود تنظیمات: ' + err.message, 'error');
            }
        }

        // Display beautiful toast notifications
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const icon = document.getElementById('toast-icon');
            const msgEl = document.getElementById('toast-message');
            
            msgEl.textContent = message;
            
            const styles = {
                success: { bg: 'bg-emerald-600', icon: 'fa-check-circle', color: 'text-white' },
                error: { bg: 'bg-rose-600', icon: 'fa-exclamation-circle', color: 'text-white' },
                warning: { bg: 'bg-amber-500', icon: 'fa-triangle-exclamation', color: 'text-white' },
                info: { bg: 'bg-indigo-600', icon: 'fa-info-circle', color: 'text-white' }
            };
            
            const s = styles[type] || styles.success;
            toast.className = \`fixed bottom-5 left-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-medium transition-all duration-400 \${s.bg} \${s.color}\`;
            icon.className = \`fas \${s.icon} text-lg\`;
            
            toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
            toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
            
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => {
                toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
                toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
            }, 4000);
        }

        function renderSidebar() {
            const menu = document.getElementById('sidebar-menu');
            if (config.length === 0) {
                menu.innerHTML = \`
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <i class="fas fa-inbox text-2xl mb-2 text-gray-300"></i>
                        <span class="text-xs">هیچ بخش فعالی یافت نشد</span>
                    </div>
                \`;
                return;
            }

            const sectionIcons = ['fa-users', 'fa-gear', 'fa-file', 'fa-chart-simple', 'fa-truck', 'fa-cart-shopping', 'fa-envelope', 'fa-calendar', 'fa-image', 'fa-video', 'fa-music', 'fa-code', 'fa-database', 'fa-cloud', 'fa-lock', 'fa-bell', 'fa-flag', 'fa-gift', 'fa-star', 'fa-heart'];
            
            menu.innerHTML = config.map((sec, idx) => {
                const iconClass = sectionIcons[idx % sectionIcons.length];
                const actionCount = Object.keys(sec.actions).length;
                return \`
                    <button onclick="selectSection(\${idx})" id="sec-btn-\${idx}" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-right text-sm font-medium transition-all group hover:bg-indigo-50/60 text-gray-600 hover:text-indigo-700 border border-transparent hover:border-indigo-100/50">
                        <span class="flex items-center gap-2.5 min-w-0">
                            <span class="w-7 h-7 rounded-lg bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center text-gray-400 group-hover:text-indigo-500 transition shrink-0">
                                <i class="fas \${iconClass} text-[11px]"></i>
                            </span>
                            <span class="truncate">\${sec.section}</span>
                        </span>
                        <span class="text-[10px] bg-gray-100 group-hover:bg-indigo-100 text-gray-400 group-hover:text-indigo-500 px-2 py-0.5 rounded-md font-bold shrink-0">\${actionCount}</span>
                    </button>
                \`;
            }).join('');
        }

        function selectSection(idx) {
            // Close sidebar on mobile
            if (window.innerWidth < 768) {
                toggleSidebar();
            }
            
            // Update active state
            document.querySelectorAll('#sidebar-menu button').forEach(b => b.classList.remove('active'));
            const btn = document.getElementById(\`sec-btn-\${idx}\`);
            if (btn) btn.classList.add('active');

            activeSectionIndex = idx;
            const section = config[idx];
            
            document.getElementById('section-title').textContent = section.section;
            document.getElementById('section-desc').textContent = \`مدیریت و نظارت بر داده‌های بخش \${section.section} به صورت زنده\`;

            // Reset pagination and search
            currentPage = 1;
            search = '';
            document.getElementById('search-input').value = '';

            // Setup Search/Table controls visibility
            document.getElementById('table-controls').classList.remove('hidden');

            // Render top bar action buttons
            const actionsDiv = document.getElementById('section-actions');
            actionsDiv.innerHTML = '';
            if (section.actions.create) {
                actionsDiv.innerHTML += \`
                    <button onclick="openCreateModal()" class="w-full md:w-auto bg-gradient-to-l from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 transition text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-200/40 flex items-center justify-center gap-2">
                        <i class="fas fa-plus"></i>
                        <span>ثبت جدید</span>
                    </button>
                \`;
            }

            fetchData();
        }

        function showLoading() {
            isLoading = true;
            document.getElementById('loading-state').classList.remove('hidden');
            document.querySelector('#table-controls + .overflow-x-auto')?.classList.add('hidden');
        }

        function hideLoading() {
            isLoading = false;
            document.getElementById('loading-state').classList.add('hidden');
            document.querySelector('#table-controls + .overflow-x-auto')?.classList.remove('hidden');
        }

        async function fetchData() {
            const section = config[activeSectionIndex];
            if (!section) return;

            const listAction = section.actions.list;
            if (!listAction) {
                renderEmptyTable('عملیات دریافت لیست برای این بخش تعریف نشده است.');
                return;
            }

            showLoading();

            let url = \`\${section.prefix}\${listAction.path}\`;
            const params = new URLSearchParams({
                page: currentPage,
                limit: limit,
                search: search
            });
            url += '?' + params.toString();

            try {
                const res = await fetch(url, {
                    method: listAction.method.toUpperCase(),
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json'
                    }
                });

                if (!res.ok) throw new Error(\`خطای سرور: \${res.status}\`);
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
            document.getElementById('table-body').innerHTML = \`
                <tr>
                    <td colspan="100" class="text-center py-16 text-gray-400">
                        <div class="flex flex-col items-center gap-3">
                            <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                                <i class="fas fa-database text-xl text-gray-300"></i>
                            </div>
                            <span class="text-sm font-medium">\${msg}</span>
                        </div>
                    </td>
                </tr>
            \`;
            document.getElementById('pagination-container').classList.add('hidden');
        }

        function renderTable(items, total, totalPages) {
            const section = config[activeSectionIndex];
            
            const fieldsToShow = section.fields.length > 0 ? section.fields : 
                (items.length > 0 ? Object.keys(items[0]).map(k => ({ name: k, type: 'String' })) : []);

            // 1. Render Headers
            const head = document.getElementById('table-head');
            const headers = fieldsToShow.map(f => \`<th class="px-4 md:px-6 py-3.5 text-xs font-bold">\${f.name}</th>\`);
            headers.push(\`<th class="px-4 md:px-6 py-3.5 text-center text-xs font-bold">عملیات</th>\`);
            head.innerHTML = \`<tr>\` + headers.join('') + \`</tr>\`;

            // 2. Render Rows
            const body = document.getElementById('table-body');
            if (items.length === 0) {
                body.innerHTML = \`
                    <tr>
                        <td colspan="100" class="text-center py-16 text-gray-400">
                            <div class="flex flex-col items-center gap-3">
                                <div class="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                                    <i class="fas fa-inbox text-xl text-gray-300"></i>
                                </div>
                                <span class="text-sm font-medium">هیچ داده‌ای در این بخش ثبت نشده است</span>
                                \${section.actions.create ? '<span class="text-xs text-gray-400">برای افزودن داده جدید از دکمه "ثبت جدید" استفاده کنید</span>' : ''}
                            </div>
                        </td>
                    </tr>
                \`;
                document.getElementById('pagination-container').classList.add('hidden');
                document.getElementById('total-count').textContent = '0';
                document.getElementById('current-page-display').textContent = '1';
                return;
            }

            body.innerHTML = items.map((item, rowIdx) => {
                const cells = fieldsToShow.map(f => {
                    let val = item[f.name];
                    if (val === undefined || val === null) val = '-';
                    if (typeof val === 'boolean') {
                        val = val ? 
                            '<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200/60"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 status-dot"></span>فعال</span>' : 
                            '<span class="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-200/60"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>غیرفعال</span>';
                    }
                    if (typeof val === 'object' && val !== '-') {
                        try { val = JSON.stringify(val).substring(0, 50) + (JSON.stringify(val).length > 50 ? '...' : ''); } catch(e) { val = '-'; }
                    }
                    if (typeof val === 'string' && val.length > 40) val = val.substring(0, 40) + '...';
                    return \`<td class="px-4 md:px-6 py-3.5 whitespace-nowrap text-sm text-gray-700 font-medium">\${val}</td>\`;
                });

                const actionButtons = [];
                if (section.actions.update) {
                    actionButtons.push(\`
                        <button onclick="openEditModal('\${item._id}')" class="inline-flex items-center gap-1 text-indigo-600 hover:text-white font-bold bg-indigo-50 hover:bg-indigo-600 px-2.5 py-1.5 rounded-lg text-xs transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm hover:shadow-md" title="ویرایش">
                            <i class="fas fa-pen text-[10px]"></i>
                            <span class="hidden md:inline">ویرایش</span>
                        </button>
                    \`);
                }
                if (section.actions['toggle-status']) {
                    actionButtons.push(\`
                        <button onclick="toggleStatus('\${item._id}')" class="inline-flex items-center gap-1 text-amber-600 hover:text-white font-bold bg-amber-50 hover:bg-amber-600 px-2.5 py-1.5 rounded-lg text-xs transition-all border border-amber-100 hover:border-amber-600 shadow-sm hover:shadow-md" title="تغییر وضعیت">
                            <i class="fas fa-toggle-on text-[10px]"></i>
                            <span class="hidden md:inline">وضعیت</span>
                        </button>
                    \`);
                }
                if (section.actions.delete) {
                    actionButtons.push(\`
                        <button onclick="openDeleteModal('\${item._id}')" class="inline-flex items-center gap-1 text-rose-600 hover:text-white font-bold bg-rose-50 hover:bg-rose-600 px-2.5 py-1.5 rounded-lg text-xs transition-all border border-rose-100 hover:border-rose-600 shadow-sm hover:shadow-md" title="حذف">
                            <i class="fas fa-trash-can text-[10px]"></i>
                            <span class="hidden md:inline">حذف</span>
                        </button>
                    \`);
                }

                const actionsCell = \`<td class="px-4 md:px-6 py-3.5 text-center whitespace-nowrap flex justify-center gap-1.5">\` + actionButtons.join('') + \`</td>\`;
                return \`<tr class="hover:bg-indigo-50/30 transition even:bg-gray-50/40">\` + cells.join('') + actionsCell + \`</tr>\`;
            }).join('');

            // 3. Render Pagination
            document.getElementById('total-count').textContent = total;
            document.getElementById('current-page-display').textContent = currentPage;
            
            const pag = document.getElementById('pagination-container');
            if (totalPages > 1) {
                pag.classList.remove('hidden');
                document.getElementById('page-num').textContent = currentPage;
                document.getElementById('total-pages-display').textContent = totalPages;
                document.getElementById('prev-btn').disabled = currentPage === 1;
                document.getElementById('next-btn').disabled = currentPage === totalPages;
                document.getElementById('first-btn').disabled = currentPage === 1;
                document.getElementById('last-btn').disabled = currentPage === totalPages;
                
                const start = (currentPage - 1) * limit + 1;
                const end = Math.min(currentPage * limit, total);
                document.getElementById('showing-info').textContent = \`نمایش \${start} تا \${end} از \${total}\`;
            } else {
                pag.classList.add('hidden');
                document.getElementById('showing-info').textContent = \`نمایش \${total} مورد\`;
            }
        }

        // Action Handlers
        function debounceSearch() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                search = document.getElementById('search-input').value;
                currentPage = 1;
                fetchData();
            }, 600);
        }

        function prevPage() {
            if (currentPage > 1) { currentPage--; fetchData(); }
        }

        function nextPage() {
            currentPage++;
            fetchData();
        }

        function goToPage(page) {
            const section = config[activeSectionIndex];
            if (!section) return;
            const listAction = section.actions.list;
            if (!listAction) return;
            
            // Fetch total pages from last fetch or estimate
            if (page === Infinity) {
                // Go to last page - we need to figure out total pages
                // For now, just use a large number and let the server handle it
                currentPage = 9999;
            } else {
                currentPage = page;
            }
            fetchData();
        }

        async function toggleStatus(id) {
            const section = config[activeSectionIndex];
            const action = section.actions['toggle-status'];
            const url = \`\${section.prefix}\${action.path.replace(':id', id)}\`;

            try {
                const res = await fetch(url, {
                    method: action.method.toUpperCase(),
                    headers: { 'x-api-key': apiKey }
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'وضعیت با موفقیت تغییر کرد.', 'success');
                    fetchData();
                } else {
                    throw new Error(data.message || 'ناموفق');
                }
            } catch (err) {
                showToast('خطا در تغییر وضعیت: ' + err.message, 'error');
            }
        }

        // Delete with custom modal
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
            const url = \`\${section.prefix}\${action.path.replace(':id', id)}\`;

            try {
                const res = await fetch(url, {
                    method: action.method.toUpperCase(),
                    headers: { 'x-api-key': apiKey }
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'آیتم با موفقیت حذف شد.', 'success');
                    fetchData();
                } else {
                    throw new Error(data.message || 'ناموفق');
                }
            } catch (err) {
                showToast('خطا در حذف آیتم: ' + err.message, 'error');
            }
        }

        // Modal Form Management
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
            const url = \`\${section.prefix}\${readAction.path.replace(':id', id)}\`;

            try {
                const res = await fetch(url, {
                    method: readAction.method.toUpperCase(),
                    headers: { 'x-api-key': apiKey }
                });
                if (!res.ok) throw new Error('یافت نشد');
                const itemData = await res.json();

                section.fields.forEach(f => {
                    const el = document.getElementById(\`form-input-\${f.name}\`);
                    if (el) {
                        if (f.type === 'Boolean') {
                            el.checked = !!itemData[f.name];
                        } else {
                            el.value = itemData[f.name] !== undefined ? itemData[f.name] : '';
                        }
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

        function renderModalForm() {
            const form = document.getElementById('modal-form');
            const section = config[activeSectionIndex];
            
            if (section.fields.length === 0) {
                form.innerHTML = \`
                    <div class="flex flex-col items-center gap-3 py-8 text-gray-400">
                        <i class="fas fa-list text-2xl text-gray-300"></i>
                        <p class="text-sm">فیلدی برای این مدل یافت نشد.</p>
                    </div>
                \`;
                return;
            }

            form.innerHTML = section.fields.map(f => {
                const isRequired = f.required ? 'required' : '';
                const star = f.required ? '<span class="text-rose-500 mr-1">*</span>' : '';
                
                let inputHtml = '';
                if (f.enumValues && f.enumValues.length > 0) {
                    inputHtml = \`
                        <div class="relative">
                            <select id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 appearance-none cursor-pointer transition">
                                <option value="">انتخاب کنید...</option>
                                \${f.enumValues.map(v => \`<option value="\${v}">\${v}</option>\`).join('')}
                            </select>
                            <i class="fas fa-chevron-down absolute left-3 top-3.5 text-gray-400 text-xs pointer-events-none"></i>
                        </div>
                    \`;
                } else if (f.type === 'Boolean') {
                    inputHtml = \`
                        <label class="relative inline-flex items-center cursor-pointer gap-3 mt-1">
                            <input type="checkbox" id="form-input-\${f.name}" name="\${f.name}" class="sr-only peer">
                            <div class="w-10 h-5.5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span class="text-xs text-gray-500 font-medium">فعال باشد</span>
                        </label>
                    \`;
                } else if (f.name.toLowerCase().includes('password')) {
                    const isPassReq = currentEditingId ? '' : 'required';
                    inputHtml = \`
                        <div class="relative">
                            <input type="password" id="form-input-\${f.name}" name="\${f.name}" \${isPassReq} placeholder="\${currentEditingId ? 'برای عدم تغییر خالی بگذارید' : '••••••••'}" class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition">
                            <i class="fas fa-lock absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                } else if (f.type === 'Number') {
                    inputHtml = \`
                        <div class="relative">
                            <input type="number" id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition" placeholder="\${f.name}">
                            <i class="fas fa-hashtag absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                } else if (f.type === 'Date') {
                    inputHtml = \`
                        <div class="relative">
                            <input type="date" id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 transition">
                            <i class="fas fa-calendar absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                } else if (f.type === 'String' && (f.name.toLowerCase().includes('email') || f.name.toLowerCase().includes('ایمیل'))) {
                    inputHtml = \`
                        <div class="relative">
                            <input type="email" id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition" placeholder="example@domain.com">
                            <i class="fas fa-envelope absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                } else if (f.type === 'String' && (f.name.toLowerCase().includes('phone') || f.name.toLowerCase().includes('mobile') || f.name.toLowerCase().includes('tel'))) {
                    inputHtml = \`
                        <div class="relative">
                            <input type="tel" id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition" placeholder="09123456789">
                            <i class="fas fa-phone absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                } else if (f.type === 'String' && (f.name.toLowerCase().includes('url') || f.name.toLowerCase().includes('link') || f.name.toLowerCase().includes('website'))) {
                    inputHtml = \`
                        <div class="relative">
                            <input type="url" id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition" placeholder="https://">
                            <i class="fas fa-link absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                } else {
                    inputHtml = \`
                        <div class="relative">
                            <input type="text" id="form-input-\${f.name}" name="\${f.name}" \${isRequired} class="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-sm text-gray-700 placeholder:text-gray-400 transition" placeholder="\${f.name}">
                            <i class="fas fa-pencil absolute left-3 top-3.5 text-gray-400 text-xs"></i>
                        </div>
                    \`;
                }

                return \`
                    <div class="flex flex-col gap-1.5 bg-gray-50/50 p-3.5 rounded-xl border border-gray-100/50">
                        <label class="text-xs font-bold text-gray-600 flex items-center gap-1">
                            \${star}\${f.name}
                            <span class="text-[10px] text-gray-400 font-normal">(\${f.type})</span>
                        </label>
                        \${inputHtml}
                    </div>
                \`;
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
            
            const formData = new FormData(e.target);
            const payload = {};
            
            section.fields.forEach(f => {
                const el = document.getElementById(\`form-input-\${f.name}\`);
                if (el) {
                    if (f.type === 'Boolean') {
                        payload[f.name] = el.checked;
                    } else if (f.type === 'Number') {
                        payload[f.name] = el.value !== '' ? Number(el.value) : undefined;
                    } else {
                        if (f.name.toLowerCase().includes('password') && isEdit && !el.value) {
                            return;
                        }
                        payload[f.name] = el.value;
                    }
                }
            });

            const url = isEdit ? 
                \`\${section.prefix}\${action.path.replace(':id', currentEditingId)}\` : 
                \`\${section.prefix}\${action.path}\`;

            try {
                const res = await fetch(url, {
                    method: action.method.toUpperCase(),
                    headers: {
                        'x-api-key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (res.ok) {
                    showToast(data.message || 'عملیات با موفقیت انجام شد.', 'success');
                    closeModal();
                    fetchData();
                } else {
                    throw new Error(data.message || 'ناموفق');
                }
            } catch (err) {
                showToast('خطا در ارسال داده‌ها: ' + err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check"></i> ذخیره تغییرات';
            }
        }

        function logout() {
            showToast('خروج با موفقیت انجام شد.', 'info');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }

        // Close modals on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                closeDeleteModal();
            }
        });

        // Close modals on backdrop click
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
        document.getElementById('delete-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
        });

        // Initialize Page
        loadConfig();
    </script>
</body>
</html>
  `);
});

module.exports = router;
