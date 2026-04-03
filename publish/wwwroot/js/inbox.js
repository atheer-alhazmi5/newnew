/* inbox.js */
var ITEMS_PER_PAGE = 10;
var allItems = [], currentPage = 1;
var userRole = window.__userRole || '';

async function loadInbox() {
    var cat = document.getElementById('categoryFilter')?.value || '';
    var status = document.getElementById('statusFilter')?.value || '';
    var r = await apiFetch('/Inbox/GetItems?category=' + encodeURIComponent(cat) + '&status=' + encodeURIComponent(status));
    if (!r || !r.success) return;
    allItems = r.data || [];
    currentPage = 1;
    renderTable();
}

function renderTable() {
    var body = document.getElementById('inboxBody');
    var count = document.getElementById('inbox-count');
    if (!body) return;
    if (count) count.textContent = '(' + allItems.length + ')';

    if (allItems.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' + emptyState('bi-inbox', 'صندوق الوارد فارغ', 'لا توجد نماذج واردة حتى الآن') + '</td></tr>';
        return;
    }

    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var page = allItems.slice(start, start + ITEMS_PER_PAGE);

    body.innerHTML = page.map(function(item) {
        var actions = '';
        var isApproval = item.category === 'approval_request';
        var isPending = item.status === 'قيد الانتظار';
        var isFilled = item.status === 'تم الملء';

        if (isApproval && isPending && (userRole === 'Admin' || userRole === 'Manager')) {
            actions =
                '<button class="btn btn-sm btn-success" onclick="approveForm(' + item.id + ')" title="اعتماد">' +
                    '<i class="bi bi-check-lg"></i> اعتماد</button> ' +
                '<button class="btn btn-sm btn-danger" onclick="rejectForm(' + item.id + ')" title="رفض">' +
                    '<i class="bi bi-x-lg"></i> رفض</button> ' +
                '<button class="btn btn-sm btn-outline-primary" onclick="viewForm(' + item.formId + ',' + item.id + ')" title="معاينة">' +
                    '<i class="bi bi-eye"></i></button> ' +
                '<button class="btn btn-sm btn-outline-danger" onclick="downloadPdf(' + item.formId + ')" title="PDF">' +
                    '<i class="bi bi-file-earmark-pdf"></i></button>';
        } else if (!isApproval && isPending) {
            actions =
                '<button class="btn btn-sm btn-primary" onclick="fillForm(' + item.formId + ',' + item.id + ')">' +
                    '<i class="bi bi-pencil-fill"></i> تعبئة</button> ' +
                '<button class="btn btn-sm btn-outline-primary" onclick="viewForm(' + item.formId + ',' + item.id + ')" title="معاينة">' +
                    '<i class="bi bi-eye"></i></button>';
        } else {
            actions =
                '<button class="btn btn-sm btn-outline-primary" onclick="viewForm(' + item.formId + ',' + item.id + ')" title="معاينة">' +
                    '<i class="bi bi-eye"></i> عرض</button>';
            if (isApproval) {
                actions += ' <button class="btn btn-sm btn-outline-danger" onclick="downloadPdf(' + item.formId + ')" title="PDF">' +
                    '<i class="bi bi-file-earmark-pdf"></i></button>';
            }
        }

        return '<tr class="' + (!item.isRead ? 'table-row-unread' : '') + '">' +
            '<td><div class="d-flex align-items-center gap-2">' +
                (!item.isRead ? '<span class="pulse-dot"></span>' : '') +
                '<span style="font-weight:' + (!item.isRead ? '700' : '600') + '">' + esc(item.formName) + '</span>' +
            '</div></td>' +
            '<td>' + esc(item.senderName) + '</td>' +
            '<td>' + esc(item.senderDepartment) + '</td>' +
            '<td>' + catBadge(item.category) + '</td>' +
            '<td>' + fmtDate(item.sentDate) + '</td>' +
            '<td>' + statusBadge(item.status) + '</td>' +
            '<td><div class="d-flex gap-1 flex-wrap">' + actions + '</div></td>' +
        '</tr>';
    }).join('');

    renderPagination(
        document.getElementById('paginationContainer'),
        allItems.length, currentPage, ITEMS_PER_PAGE,
        'changePage'
    );
}

function changePage(p) { currentPage = p; renderTable(); }

function fillForm(formId, receivedFormId) {
    window.location.href = '/FormFill/Index?formId=' + formId + '&receivedFormId=' + receivedFormId + '&mode=fill';
}

function viewForm(formId, receivedFormId) {
    window.location.href = '/FormFill/Index?formId=' + formId + '&receivedFormId=' + receivedFormId + '&mode=view';
}

function downloadPdf(formId) {
    window.open('/FormFill/PrintView?formId=' + formId, '_blank');
}

async function approveForm(receivedFormId) {
    if (!confirm('هل تريد اعتماد هذا النموذج وإرساله للمستهدفين؟')) return;
    var r = await apiFetch('/Inbox/Approve', 'POST', { receivedFormId: receivedFormId });
    if (r && r.success) {
        showToast(r.message || 'تم الاعتماد بنجاح');
        loadInbox();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
}

async function rejectForm(receivedFormId) {
    if (!confirm('هل تريد رفض هذا النموذج؟')) return;
    var r = await apiFetch('/Inbox/Reject', 'POST', { receivedFormId: receivedFormId });
    if (r && r.success) {
        showToast(r.message || 'تم الرفض');
        loadInbox();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
}

window.changePage = changePage;
loadInbox();
