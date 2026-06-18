/* inbox.js — يدعم: طلبات النماذج (form) + طلبات إجراءات العمل (outbox_request) */
var ITEMS_PER_PAGE = 10;
var allItems = [], currentPage = 1;
var userRole = window.__userRole || '';
var ibCurrentAssignment = null;

function ibEscAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function loadInbox() {
    var cat = document.getElementById('categoryFilter')?.value || '';
    var status = document.getElementById('statusFilter')?.value || '';
    var r = await apiFetch('/Inbox/GetItems?category=' + encodeURIComponent(cat) + '&status=' + encodeURIComponent(status));
    if (!r || !r.success) return;
    allItems = r.data || [];
    currentPage = 1;
    renderTable();
}

function ibCatBadge(cat) {
    if (cat === 'request_review') return '<span class="ib-req-chip"><i class="bi bi-send-fill"></i> طلب إجراء</span>';
    if (typeof catBadge === 'function') return catBadge(cat);
    return '<span class="badge bg-secondary-subtle">' + esc(cat || '—') + '</span>';
}

function ibStatusBadge(status, source) {
    if (source === 'outbox_request') {
        var v = (status || '').trim();
        if (v === 'قيد الانتظار') return '<span class="badge bg-warning-subtle text-warning">قيد الانتظار</span>';
        if (v === 'تم الاعتماد')   return '<span class="badge bg-success-subtle text-success">تم الاعتماد</span>';
        if (v === 'تم الرفض')      return '<span class="badge bg-danger-subtle text-danger">تم الرفض</span>';
        if (v === 'تم الإرجاع')    return '<span class="badge bg-primary-subtle text-primary">تم الإرجاع</span>';
        return '<span class="badge bg-secondary-subtle">' + esc(v) + '</span>';
    }
    if (typeof statusBadge === 'function') return statusBadge(status);
    return '<span class="badge bg-secondary-subtle">' + esc(status || '—') + '</span>';
}

function renderTable() {
    var body = document.getElementById('inboxBody');
    var count = document.getElementById('inbox-count');
    if (!body) return;
    if (count) count.textContent = '(' + allItems.length + ')';

    if (allItems.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' + emptyState('bi-inbox', 'صندوق الوارد فارغ', 'لا توجد عناصر واردة حتى الآن') + '</td></tr>';
        return;
    }

    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var page = allItems.slice(start, start + ITEMS_PER_PAGE);

    body.innerHTML = page.map(function(item) {
        if (item.source === 'outbox_request') return renderRequestRow(item);
        return renderFormRow(item);
    }).join('');

    renderPagination(
        document.getElementById('paginationContainer'),
        allItems.length, currentPage, ITEMS_PER_PAGE,
        'changePage'
    );
}

function renderFormRow(item) {
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
        '<td>' + esc(item.senderDepartment || '') + '</td>' +
        '<td>' + ibCatBadge(item.category) + '</td>' +
        '<td>' + fmtDate(item.sentDate) + '</td>' +
        '<td>' + ibStatusBadge(item.status, item.source) + '</td>' +
        '<td><div class="d-flex gap-1 flex-wrap">' + actions + '</div></td>' +
    '</tr>';
}

function renderRequestRow(item) {
    var assignmentId = item.assignmentId || item.id;
    var isPending = item.status === 'قيد الانتظار';

    var actions = '<button class="btn btn-sm btn-primary" onclick="ibOpenRequest(' + assignmentId + ')">' +
        '<i class="bi bi-' + (isPending ? 'check2-square' : 'eye') + '"></i> ' +
        (isPending ? 'مراجعة' : 'تفاصيل') + '</button>';

    var viaLabel = '';
    if (item.assignedVia === 'unit_manager') viaLabel = '<span class="ib-via"><i class="bi bi-person-badge"></i> مدير الوحدة</span>';
    else if (item.assignedVia === 'unit_representative') viaLabel = '<span class="ib-via"><i class="bi bi-person"></i> ممثل الوحدة</span>';
    else if (item.assignedVia === 'specific') viaLabel = '<span class="ib-via"><i class="bi bi-people"></i> منفِّذ معتمد</span>';

    var stepChip = item.stepLabel ? '<span class="ib-req-step">' + esc(item.stepLabel) + '</span>' : '';
    var typeIc = item.procedureTypeIcon ? (String(item.procedureTypeIcon).indexOf('bi-') === 0 ? item.procedureTypeIcon : 'bi-' + item.procedureTypeIcon) : 'bi-send';
    var typeColor = item.procedureTypeColor || '#25935F';

    return '<tr class="ib-req-row ' + (!item.isRead ? 'table-row-unread' : '') + '">' +
        '<td><div class="d-flex align-items-center gap-2">' +
            (!item.isRead ? '<span class="pulse-dot"></span>' : '') +
            '<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;background:' + ibEscAttr(typeColor) + '22;color:' + ibEscAttr(typeColor) + ';"><i class="' + ibEscAttr(typeIc) + '"></i></span>' +
            '<div>' +
                '<div style="font-weight:' + (!item.isRead ? '700' : '600') + '">' + esc(item.procedureName || '—') + stepChip + '</div>' +
                '<div style="font-size:11px;color:var(--gray-500);direction:ltr;text-align:right;">' + esc(item.requestNumber || '') + (viaLabel ? ' • ' + viaLabel : '') + '</div>' +
            '</div>' +
        '</div></td>' +
        '<td>' + esc(item.senderName) + '</td>' +
        '<td>' + esc(item.senderDepartment || '') + '</td>' +
        '<td>' + ibCatBadge(item.category) + '</td>' +
        '<td>' + fmtDate(item.sentDate) + '</td>' +
        '<td>' + ibStatusBadge(item.status, item.source) + '</td>' +
        '<td><div class="d-flex gap-1 flex-wrap">' + actions + '</div></td>' +
    '</tr>';
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
    if (r && r.success) { showToast(r.message || 'تم الاعتماد بنجاح'); loadInbox(); }
    else { showToast(r?.message || 'حدث خطأ', 'danger'); }
}

async function rejectForm(receivedFormId) {
    if (!confirm('هل تريد رفض هذا النموذج؟')) return;
    var r = await apiFetch('/Inbox/Reject', 'POST', { receivedFormId: receivedFormId });
    if (r && r.success) { showToast(r.message || 'تم الرفض'); loadInbox(); }
    else { showToast(r?.message || 'حدث خطأ', 'danger'); }
}

// ─── OUTBOX REQUEST: عرض/اعتماد/رفض/إرجاع ─────────────────────────────────
async function ibOpenRequest(assignmentId) {
    ibCurrentAssignment = null;
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('ibReqModal'));
    var body = document.getElementById('ibReqBody');
    if (body) body.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    modal.show();

    var r = await apiFetch('/Inbox/GetRequestAssignment?id=' + encodeURIComponent(assignmentId));
    if (!r || !r.success) {
        body.innerHTML = '<div class="text-center text-muted py-4">تعذّر تحميل بيانات الطلب</div>';
        return;
    }
    var d = r.data || {};
    ibCurrentAssignment = d;

    document.getElementById('ibReqTitle').textContent = d.requestNumber || 'تفاصيل الطلب';
    document.getElementById('ibReqSubtitle').textContent = d.procedureName || '';

    var typeIc = d.procedureTypeIcon ? (String(d.procedureTypeIcon).indexOf('bi-') === 0 ? d.procedureTypeIcon : 'bi-' + d.procedureTypeIcon) : 'bi-send';
    var typeColor = d.procedureTypeColor || '#25935F';

    var formItems = '';
    try {
        var fd = JSON.parse(d.formDataJson || '{}');
        var fields = Array.isArray(fd.fields) ? fd.fields : [];
        if (fields.length) {
            formItems = '<div class="ib-form-summary"><div class="ttl"><i class="bi bi-file-earmark-text"></i> بيانات النموذج المُعبّأ</div>';
            fields.forEach(function (f) {
                var v = ibFormatValue(f);
                formItems += '<div class="it"><b>' + esc(f.fieldName || '—') + ':</b><span>' + v + '</span></div>';
            });
            formItems += '</div>';
        }
    } catch (e) {}

    var isPending = (d.status === 'قيد الانتظار');

    body.innerHTML =
        '<div class="d-flex align-items-center gap-3 mb-3">'
        + '<span style="width:42px;height:42px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;background:' + ibEscAttr(typeColor) + '22;color:' + ibEscAttr(typeColor) + ';"><i class="' + ibEscAttr(typeIc) + '" style="font-size:18px;"></i></span>'
        + '<div><div style="font-weight:800;font-size:15px;color:var(--gray-900);">' + esc(d.procedureName || '') + '</div>'
        +   '<div style="font-size:11.5px;color:var(--gray-500);direction:ltr;text-align:right;">' + esc(d.requestNumber || '') + ' • ' + esc(d.procedureCode || '') + '</div></div>'
        + '</div>'
        + '<div class="ib-detail-grid">'
        +   '<div class="lbl">المرسل</div><div class="val">' + esc(d.senderName || '—') + (d.senderDept ? ' <span class="text-muted">— ' + esc(d.senderDept) + '</span>' : '') + '</div>'
        +   '<div class="lbl">المرحلة الحالية</div><div class="val">' + esc(d.stepLabel || '—') + '</div>'
        +   '<div class="lbl">طريقة التسليم</div><div class="val">' + ibAssignedViaLabel(d.assignedVia) + '</div>'
        +   '<div class="lbl">الأولوية</div><div class="val">' + esc(d.priority || '—') + '</div>'
        +   '<div class="lbl">تاريخ التسليم</div><div class="val" style="direction:ltr;text-align:right;">' + esc(d.assignedAt || '—') + '</div>'
        +   '<div class="lbl">تاريخ التقديم</div><div class="val" style="direction:ltr;text-align:right;">' + esc(d.submittedAt || '—') + '</div>'
        +   '<div class="lbl">الحالة</div><div class="val">' + ibStatusBadge(d.status, 'outbox_request') + '</div>'
        + (d.actedAt ? '<div class="lbl">تاريخ الإجراء</div><div class="val" style="direction:ltr;text-align:right;">' + esc(d.actedAt) + '</div>' : '')
        + (d.responseNotes ? '<div class="lbl">ملاحظات المستلم</div><div class="val">' + esc(d.responseNotes) + '</div>' : '')
        + (d.requestNotes ? '<div class="lbl">ملاحظات الطلب</div><div class="val">' + esc(d.requestNotes) + '</div>' : '')
        + '</div>'
        + formItems
        + (isPending ? '<div class="ib-notes-area"><label>ملاحظات (مطلوبة للرفض/الإرجاع)</label><textarea id="ibReqNotes" placeholder="اكتب ملاحظاتك هنا..."></textarea></div>' : '');

    var foot = document.getElementById('ibReqFooter');
    if (isPending) {
        foot.innerHTML =
            '<button class="ib-btn ib-btn-close" data-bs-dismiss="modal">إغلاق</button>'
          + '<button class="ib-btn ib-btn-return" onclick="ibActAssignment(\'return\')"><i class="bi bi-arrow-counterclockwise"></i> إرجاع</button>'
          + '<button class="ib-btn ib-btn-reject" onclick="ibActAssignment(\'reject\')"><i class="bi bi-x-lg"></i> رفض</button>'
          + '<button class="ib-btn ib-btn-approve" onclick="ibActAssignment(\'approve\')"><i class="bi bi-check-lg"></i> اعتماد</button>';
    } else {
        foot.innerHTML = '<button class="ib-btn ib-btn-close" data-bs-dismiss="modal">إغلاق</button>';
    }

    loadInbox(); // تحديث حالة المقروء بصرياً
}

function ibAssignedViaLabel(v) {
    if (v === 'unit_manager') return '<i class="bi bi-person-badge"></i> مدير الوحدة التنظيمية';
    if (v === 'unit_representative') return '<i class="bi bi-person"></i> ممثل الوحدة التنظيمية';
    if (v === 'specific') return '<i class="bi bi-people"></i> منفِّذ معتمد';
    return esc(v || '—');
}

function ibFormatValue(f) {
    var v = f.value;
    if (v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim())) return '<span class="text-muted">—</span>';
    if (Array.isArray(v)) {
        if (f.fieldType === 'رفع ملف') return v.map(function (x) { return '<span class="badge bg-light text-dark border me-1"><i class="bi bi-paperclip"></i> ' + esc(x.name || '') + '</span>'; }).join('');
        return v.map(function (x) {
            if (x && typeof x === 'object' && 'label' in x) return esc(x.label + ': ' + (Array.isArray(x.value) ? x.value.join(' • ') : (x.value || '—')));
            return esc(String(x));
        }).join(' • ');
    }
    if (typeof v === 'boolean') return v ? '<span class="text-success fw-bold"><i class="bi bi-check-circle-fill"></i> مفعّل</span>' : '<span class="text-muted">غير مفعّل</span>';
    return esc(String(v));
}

async function ibActAssignment(action) {
    if (!ibCurrentAssignment) return;
    var notes = (document.getElementById('ibReqNotes')?.value || '').trim();
    if ((action === 'reject' || action === 'return') && !notes) {
        showToast('يرجى إدخال السبب قبل الرفض/الإرجاع', 'warning');
        return;
    }
    var confirmMsg = action === 'approve' ? 'اعتماد هذا الطلب؟' : (action === 'reject' ? 'رفض هذا الطلب؟' : 'إرجاع هذا الطلب؟');
    if (!confirm(confirmMsg)) return;

    var r = await apiFetch('/Inbox/ActOnAssignment', 'POST', {
        assignmentId: ibCurrentAssignment.id,
        action: action,
        notes: notes
    });
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر التنفيذ', 'danger'); return; }
    showToast(r.message || 'تم', 'success');
    bootstrap.Modal.getInstance(document.getElementById('ibReqModal')).hide();
    ibCurrentAssignment = null;
    loadInbox();
}

window.changePage = changePage;
window.ibOpenRequest = ibOpenRequest;
window.ibActAssignment = ibActAssignment;
loadInbox();
