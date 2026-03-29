/* approvals.js */
const ITEMS_PER_PAGE = 5;
let allItems = [], currentPage = 1, rejectId = null;

async function loadApprovals() {
    const r = await apiFetch('/Approvals/GetPending');
    if (!r?.success) return;
    allItems = r.data || [];
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const body = document.getElementById('approvalsBody');
    if (!body) return;

    if (allItems.length === 0) {
        body.innerHTML = `<tr><td colspan="6">${emptyState('bi-check-circle', 'لا توجد طلبات اعتماد', 'جميع الطلبات تمت معالجتها')}</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = allItems.slice(start, start + ITEMS_PER_PAGE);

    body.innerHTML = page.map(item => `
        <tr class="${!item.isRead ? 'table-row-unread' : ''}">
            <td><span style="font-weight:600">${esc(item.formName)}</span></td>
            <td>${esc(item.senderName)}</td>
            <td>${esc(item.senderDepartment)}</td>
            <td>${fmtDate(item.sentDate)}</td>
            <td>${statusBadge(item.status)}</td>
            <td>
                <div class="d-flex gap-2">
                    ${item.status === 'قيد الانتظار' ? `
                    <button class="btn btn-sm btn-success" onclick="approve(${item.id})">
                        <i class="bi bi-check-lg" style="margin-left:4px;"></i>اعتماد
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="showReject(${item.id})">
                        <i class="bi bi-x-lg" style="margin-left:4px;"></i>رفض
                    </button>` : '—'}
                </div>
            </td>
        </tr>`).join('');

    renderPagination(
        document.getElementById('paginationContainer'),
        allItems.length, currentPage, ITEMS_PER_PAGE,
        'changePage'
    );
}

function changePage(p) { currentPage = p; renderTable(); }

async function approve(id) {
    if (!confirm('هل تريد اعتماد هذا الطلب؟')) return;
    const r = await apiFetch(`/Approvals/Approve?receivedFormId=${id}`, 'POST');
    if (r?.success) { showToast('تم الاعتماد بنجاح'); loadApprovals(); }
    else showToast(r?.message || 'حدث خطأ', 'danger');
}

function showReject(id) {
    rejectId = id;
    document.getElementById('rejectReason').value = '';
    new bootstrap.Modal(document.getElementById('rejectModal')).show();
}

async function confirmReject() {
    if (!rejectId) return;
    const reason = document.getElementById('rejectReason').value;
    const r = await apiFetch(`/Approvals/Reject?receivedFormId=${rejectId}`, 'POST', { reason });
    bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
    if (r?.success) { showToast('تم الرفض'); loadApprovals(); }
    else showToast(r?.message || 'حدث خطأ', 'danger');
}

window.changePage = changePage;
window.approve = approve;
window.showReject = showReject;
window.confirmReject = confirmReject;
loadApprovals();
