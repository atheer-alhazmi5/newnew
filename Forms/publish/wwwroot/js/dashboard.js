/* dashboard.js - لوحة القيادة */

async function initDashboard() {
    await loadKpis();
    await loadRecentInbox();
    initChart();
}

async function loadKpis() {
    const r = await apiFetch('/Dashboard/GetKpis');
    if (!r || !r.success) return;
    const d = r.data;
    setKpi('kpiApproved', d.approved, 'kpiApprovedBar', Math.min((d.approved / (d.sent || 1)) * 100, 100));
    setKpi('kpiSent', d.sent, 'kpiSentBar', 60);
    setKpi('kpiPending', d.pending, 'kpiPendingBar', d.pending > 0 ? 35 : 5);
    setKpi('kpiInbox', d.inbox, 'kpiInboxBar', 50);
}

function setKpi(valId, val, barId, pct) {
    const el = document.getElementById(valId);
    const bar = document.getElementById(barId);
    if (el) el.textContent = val ?? 0;
    if (bar) bar.style.width = (pct || 0) + '%';
}

async function loadRecentInbox() {
    const container = document.getElementById('recentInbox');
    if (!container) return;
    const r = await apiFetch('/Inbox/GetInbox?page=1&pageSize=5');
    if (!r || !r.success || !r.data?.length) {
        container.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="bi bi-inbox" style="font-size:32px;"></i><p>لا توجد واردات</p></div>';
        return;
    }
    container.innerHTML = r.data.map(item => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--gray-100);">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--sa-100);color:var(--sa-700);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">
                ${(item.senderName || '?').charAt(0)}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.formName)}</div>
                <div style="font-size:11px;color:var(--gray-500);">${esc(item.senderName)} • ${formatDateShort(item.sentDate)}</div>
            </div>
            ${getStatusBadge(item.status)}
        </div>
    `).join('');
}

function initChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                {
                    label: 'نماذج مرسلة',
                    data: [3, 7, 4, 8, 5, 2, 1],
                    backgroundColor: 'rgba(20,87,58,0.7)',
                    borderRadius: 6
                },
                {
                    label: 'ردود مستلمة',
                    data: [2, 5, 3, 6, 4, 1, 0],
                    backgroundColor: 'rgba(219,161,2,0.7)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { font: { family: 'Cairo' } } }
            },
            scales: {
                x: { ticks: { font: { family: 'Cairo' } } },
                y: { ticks: { font: { family: 'Cairo' } } }
            }
        }
    });
}

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDateShort(dt) { if (!dt) return ''; return dt.substring(0, 10); }
function getStatusBadge(status) {
    const map = {
        'قيد الانتظار': 'bg-warning-subtle text-warning',
        'تم الملء': 'bg-success-subtle text-success',
        'معتمد': 'bg-success-subtle text-success',
        'مرفوض': 'bg-danger-subtle text-danger',
        'طلب تعبئة': 'bg-primary-subtle text-primary',
        'طلب اعتماد': 'bg-gold-subtle text-gold'
    };
    const cls = map[status] || 'bg-secondary-subtle text-secondary';
    return `<span class="badge ${cls}">${esc(status || '-')}</span>`;
}

document.addEventListener('DOMContentLoaded', initDashboard);
