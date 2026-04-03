
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
        const res = await fetch(url, opts);
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
    toast.style.cssText = `background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 4px 16px rgba(0,0,0,.12);
        display:flex;align-items:center;gap:12px;min-width:280px;max-width:400px;
        border-right:4px solid ${colors[type] || colors.success};
        animation:slideInLeft .25s ease-out;font-family:'Cairo',sans-serif;`;
    toast.innerHTML = `
        <i class="bi ${icons[type] || icons.success}" style="font-size:18px;color:${colors[type]};flex-shrink:0;"></i>
        <span style="flex:1;font-size:14px;font-weight:600;color:#1F2A37;">${msg}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#6C737F;padding:0;line-height:1;">×</button>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut .25s ease-out'; setTimeout(() => toast.remove(), 250); }, 4000);
}

// ─── PAGINATION ──────────────────────────────────────────────────────────────
function renderPagination(container, total, page, perPage, callback) {
    if (!container) return;
    const pages = Math.ceil(total / perPage);
    if (pages <= 1) { container.innerHTML = ''; return; }

    let html = '<nav><ul class="pagination mb-0">';
    html += `<li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="event.preventDefault();(${callback})(${page - 1})">السابق</a></li>`;

    for (let i = 1; i <= pages; i++) {
        html += `<li class="page-item ${i === page ? 'active' : ''}">
            <a class="page-link" href="#" onclick="event.preventDefault();(${callback})(${i})">${i}</a></li>`;
    }

    html += `<li class="page-item ${page === pages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="event.preventDefault();(${callback})(${page + 1})">التالي</a></li>`;
    html += '</ul></nav>';
    container.innerHTML = html;
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
        folder: 'bi-folder-fill'
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
