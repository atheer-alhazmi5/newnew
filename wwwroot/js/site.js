
function appResolveUrl(url) {
    if (!url || url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (typeof window.APP_PATH_BASE === 'string' ? window.APP_PATH_BASE : '').replace(/\/$/, '');
    return base + (url.startsWith('/') ? url : '/' + url);
}

function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

// ─── FETCH WRAPPER ───────────────────────────────────────────────────────────
async function apiFetch(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': getCsrfToken()
        }
    };
    if (body && method !== 'GET') opts.body = JSON.stringify(body);
    try {
        const res = await fetch(appResolveUrl(url), opts);
        if (res.redirected) { window.location.href = res.url; return null; }
        var text = await res.text();
        try {
            return text ? JSON.parse(text) : { success: false, message: 'استجابة فارغة' };
        } catch (parseErr) {
            if (!res.ok) return { success: false, message: 'خطأ في الخادم (' + res.status + ')' };
            console.error('apiFetch parse error:', parseErr);
            return { success: false, message: 'خطأ في قراءة الاستجابة' };
        }
    } catch (e) {
        console.error('apiFetch error:', e);
        return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'bi-check-circle-fill', danger: 'bi-x-circle-fill', warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' };
    const colors = { success: '#079455', danger: '#D92D20', warning: '#DC6803', info: '#1570EF' };

    const toast = document.createElement('div');
    toast.style.cssText = `background:var(--surface-0);border-radius: 8px;padding:14px 18px;box-shadow:0 4px 16px rgba(0,0,0,.12);
        display:flex;align-items:center;gap:12px;min-width:280px;max-width:400px;
        border-right:4px solid ${colors[type] || colors.success};
        animation:slideInLeft .25s ease-out;font-family:'Cairo',sans-serif;`;
    toast.innerHTML = `
        <i class="bi ${icons[type] || icons.success}" style="font-size:18px;color:${colors[type]};flex-shrink:0;"></i>
        <span style="flex:1;font-size:14px;font-weight:600;color:var(--gray-800);">${msg}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--gray-500);padding:0;line-height:1;">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut .25s ease-out'; setTimeout(() => toast.remove(), 250); }, 4000);
}

// ─── PAGINATION (مكوّن موحّد — المرجع: صفحة سجل العمليات) ────────────────────
// container: عنصر DOM أو معرّف العنصر · callback: اسم دالة الانتقال إلى صفحة
function renderPagination(container, total, page, perPage, callback) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    el.classList.add('app-pagination');

    const pages = Math.ceil(total / perPage);
    if (pages <= 1) { el.innerHTML = ''; return; }

    let html = `<span class="app-pagination-info">صفحة ${page} من ${pages}</span>`;
    html += `<button onclick="(${callback})(${page - 1})" ${page <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-right"></i></button>`;

    const maxVisible = 7;
    let startP = Math.max(1, page - Math.floor(maxVisible / 2));
    let endP = Math.min(pages, startP + maxVisible - 1);
    if (endP - startP + 1 < maxVisible) startP = Math.max(1, endP - maxVisible + 1);

    if (startP > 1) {
        html += `<button onclick="(${callback})(1)">1</button>`;
        if (startP > 2) html += `<button disabled>…</button>`;
    }
    for (let p = startP; p <= endP; p++) {
        html += `<button onclick="(${callback})(${p})" class="${p === page ? 'active' : ''}">${p}</button>`;
    }
    if (endP < pages) {
        if (endP < pages - 1) html += `<button disabled>…</button>`;
        html += `<button onclick="(${callback})(${pages})">${pages}</button>`;
    }

    html += `<button onclick="(${callback})(${page + 1})" ${page >= pages ? 'disabled' : ''}><i class="bi bi-chevron-left"></i></button>`;
    el.innerHTML = html;
}

// تمرير الصفحة إلى أعلى الجدول بعد الانتقال — نفس سلوك صفحة سجل العمليات
function appPaginationScrollTop() {
    document.querySelector('.table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── HTML ESCAPE ─────────────────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── DATE FORMAT ─────────────────────────────────────────────────────────────
function fmtDate(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── STATUS BADGE ────────────────────────────────────────────────────────────
function statusBadge(status) {
    const map = {
        'published': ['منشور', 'success'],
        'pending_approval': ['قيد الاعتماد', 'warning'],
        'قيد الانتظار': ['قيد الانتظار', 'warning'],
        'تم الملء': ['تم الملء', 'success'],
        'معتمد': ['معتمد', 'success'],
        'مرفوض': ['مرفوض', 'danger'],
        'rejected': ['مرفوض', 'danger'],
        'active': ['نشط', 'success'],
        'موقوف': ['موقوف', 'danger']
    };
    const [label, color] = map[status] || [status, 'secondary'];
    return `<span class="badge bg-${color}-subtle text-${color}">${label}</span>`;
}

// ─── FORM ICON ───────────────────────────────────────────────────────────────
function getFormIcon(icon, size = 20) {
    const icons = {
        document: 'bi-file-earmark-text',
        clipboard: 'bi-clipboard',
        chart: 'bi-bar-chart-fill',
        calendar: 'bi-calendar3',
        users: 'bi-people-fill',
        building: 'bi-building',
        briefcase: 'bi-briefcase-fill',
        plane: 'bi-airplane-fill',
        clock: 'bi-clock-fill',
        shield: 'bi-shield-fill',
        star: 'bi-star-fill',
        folder: 'bi-folder-fill',
        heart: 'bi-heart-fill',
        globe: 'bi-globe2',
        key: 'bi-key-fill',
        megaphone: 'bi-megaphone-fill',
        award: 'bi-award-fill',
        lightning: 'bi-lightning-fill',
        camera: 'bi-camera-fill',
        gift: 'bi-gift-fill',
        compass: 'bi-compass-fill',
        truck: 'bi-truck',
        tools: 'bi-tools'
    };
    const cls = icons[icon] || 'bi-file-earmark';
    return `<i class="bi ${cls}" style="font-size:${size}px;"></i>`;
}

// ─── CATEGORY BADGE ──────────────────────────────────────────────────────────
function catBadge(cat) {
    const map = {
        'fill_request': ['طلب تعبئة', 'primary'],
        'approval_request': ['طلب اعتماد', 'warning'],
        'reply': ['رد', 'info']
    };
    const [label, color] = map[cat] || [cat, 'secondary'];
    return `<span class="badge bg-${color}-subtle text-${color}">${label}</span>`;
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
function emptyState(icon, title, desc = '') {
    return `<div class="empty-state">
        <i class="bi ${icon}"></i>
        <h5>${title}</h5>
        ${desc ? `<p>${desc}</p>` : ''}
    </div>`;
}

// CSS for animations
const style = document.createElement('style');
style.textContent = `
@keyframes slideInLeft { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
@keyframes fadeOut { from { opacity:1; } to { opacity:0; } }
`;
document.head.appendChild(style);

// ─── THEME (LIGHT / DARK) ────────────────────────────────────────────────────
function appGetTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

// لون سطح البطاقات في الوضع الحالي — للعناصر المرسومة على Canvas
function appSurfaceColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--surface-0').trim() || '#fff';
}

function appApplyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');

    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.className = isDark ? 'bi bi-moon-stars-fill' : 'bi bi-brightness-high';

    const btn = document.getElementById('theme-toggle');
    if (btn) btn.title = isDark ? 'الوضع النهاري' : 'الوضع الليلي';

    appApplyChartTheme();
}

function appToggleTheme() {
    appApplyTheme(appGetTheme() === 'dark' ? 'light' : 'dark');
}

// مزامنة ألوان الرسوم البيانية مع الوضع الحالي دون إعادة تحميل الصفحة
function appApplyChartTheme() {
    if (typeof Chart === 'undefined') return;

    const css = getComputedStyle(document.documentElement);
    const textColor = css.getPropertyValue('--gray-600').trim();
    const gridColor = css.getPropertyValue('--gray-200').trim();
    const surface = css.getPropertyValue('--surface-0').trim();

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    const charts = Chart.instances ? Object.values(Chart.instances) : [];
    charts.forEach(function (chart) {
        if (!chart || !chart.options) return;

        // الفواصل بين قطاعات الرسوم الدائرية تأخذ لون سطح البطاقة
        (chart.data?.datasets || []).forEach(function (ds) {
            if (chart.config?.type === 'pie' || chart.config?.type === 'doughnut') ds.borderColor = surface;
        });

        Object.values(chart.options.scales || {}).forEach(function (scale) {
            if (scale.ticks) scale.ticks.color = textColor;
            if (scale.grid) scale.grid.color = gridColor;
            if (scale.title) scale.title.color = textColor;
        });

        chart.update('none');
    });
}

document.addEventListener('DOMContentLoaded', function () {
    appApplyTheme(appGetTheme());
});

// ─── SIDEBAR CLICK HIGHLIGHT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('#sidebar .sidebar-item:not(.sidebar-parent)').forEach(function (item) {
        item.addEventListener('click', function () {
            document.querySelectorAll('#sidebar .sidebar-item').forEach(function (el) {
                el.classList.remove('active');
            });
            document.querySelectorAll('#sidebar .sidebar-icon').forEach(function (icon) {
                icon.style.background = '';
                icon.style.color = '';
            });
            this.classList.add('active');
        });
    });
});
