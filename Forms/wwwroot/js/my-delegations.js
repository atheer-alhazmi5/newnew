'use strict';

function myDelEsc(t) {
    if (typeof esc === 'function') return esc(t);
    var s = t == null ? '' : String(t);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function myDelStatusLabel(code) {
    switch ((code || '').toLowerCase()) {
        case 'active': return '<span class="badge bg-success">ساري</span>';
        case 'scheduled': return '<span class="badge bg-info text-dark">مجدول</span>';
        case 'expired': return '<span class="badge bg-secondary">منتهي</span>';
        case 'cancelled': return '<span class="badge bg-dark">ملغى</span>';
        case 'draft': return '<span class="badge bg-warning text-dark">مسودة</span>';
        default: return '<span class="badge bg-light text-dark">' + myDelEsc(code || '') + '</span>';
    }
}

function myDelNameRoleCell(name, role) {
    var r = (role || '').trim();
    var sub = r ? '<div class="small text-muted mt-1" style="font-size:11px;line-height:1.35;">' + myDelEsc(r) + '</div>' : '';
    return '<div class="fw-semibold">' + myDelEsc(name || '') + '</div>' + sub;
}

function myDelDetailRow(label, innerHtml) {
    return '<div class="d-flex flex-wrap py-2 border-bottom border-light" style="gap:8px;"><div class="text-muted fw-bold" style="min-width:170px;">' + myDelEsc(label) + '</div><div class="flex-grow-1">' + innerHtml + '</div></div>';
}

var myDelRows = [];

async function myDelLoad() {
    try {
        var r = await apiFetch('/Settings/GetMyDelegations');
        if (!r || !r.success) {
            document.getElementById('myDelBody').innerHTML =
                '<tr><td colspan="9" class="text-center py-4 text-danger">غير مصرح أو خطأ في التحميل</td></tr>';
            return;
        }
        myDelRows = r.data || [];
        myDelRenderTable();
    } catch (e) {
        document.getElementById('myDelBody').innerHTML =
            '<tr><td colspan="9" class="text-center py-4 text-danger">خطأ في الاتصال</td></tr>';
    }
}

function myDelRenderTable() {
    var body = document.getElementById('myDelBody');
    if (!body) return;
    if (!myDelRows.length) {
        body.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">لا توجد تفويضات مسجلة لك</td></tr>';
        return;
    }
    var html = '';
    myDelRows.forEach(function (d, idx) {
        html += '<tr>' +
            '<td style="text-align:center;">' + (idx + 1) + '</td>' +
            '<td>' + myDelNameRoleCell(d.delegatorName || d.DelegatorName, d.delegatorRoleDisplay || d.DelegatorRoleDisplay) + '</td>' +
            '<td style="font-size:12px;">' + myDelEsc(d.delegatorOrgUnitName || d.DelegatorOrgUnitName || '') + '</td>' +
            '<td>' + myDelNameRoleCell(d.delegateeName || d.DelegateeName, d.delegateeRoleDisplay || d.DelegateeRoleDisplay) + '</td>' +
            '<td style="font-size:12px;">' + myDelEsc(d.delegateeOrgUnitName || d.DelegateeOrgUnitName || '') + '</td>' +
            '<td dir="ltr" style="font-size:12px;">' + myDelEsc(d.startDate || d.StartDate || '') + '</td>' +
            '<td dir="ltr" style="font-size:12px;">' + myDelEsc(d.endDate || d.EndDate || '') + '</td>' +
            '<td style="text-align:center;">' + myDelStatusLabel(d.statusCode || d.StatusCode) + '</td>' +
            '<td style="text-align:center;"><button type="button" class="btn btn-sm btn-outline-info py-0 px-2" onclick="myDelShowDetails(' + d.id + ')"><i class="bi bi-eye"></i></button></td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

async function myDelShowDetails(id) {
    try {
        var r = await apiFetch('/Settings/GetDelegation?id=' + encodeURIComponent(id));
        if (!r || !r.success || !r.data) {
            if (typeof showToast === 'function') showToast('تعذر تحميل التفويض', 'error');
            return;
        }
        var x = r.data;
        var statusHtml = myDelStatusLabel(x.statusCode || x.StatusCode);
        var bodyHtml =
            myDelDetailRow('المفوض', myDelNameRoleCell(x.delegatorName || x.DelegatorName, x.delegatorRoleDisplay || x.DelegatorRoleDisplay)) +
            myDelDetailRow('وحدة المفوض', myDelEsc(x.delegatorOrgUnitName || x.DelegatorOrgUnitName || '—')) +
            myDelDetailRow('المفوض له', myDelNameRoleCell(x.delegateeName || x.DelegateeName, x.delegateeRoleDisplay || x.DelegateeRoleDisplay)) +
            myDelDetailRow('وحدة المفوض له', myDelEsc(x.delegateeOrgUnitName || x.DelegateeOrgUnitName || '—')) +
            myDelDetailRow('تاريخ البداية', '<span dir="ltr">' + myDelEsc(x.startDate || x.StartDate || '') + '</span>') +
            myDelDetailRow('تاريخ النهاية', '<span dir="ltr">' + myDelEsc(x.endDate || x.EndDate || '') + '</span>') +
            myDelDetailRow('الحالة', statusHtml) +
            myDelDetailRow('أنشئ بواسطة', myDelEsc(x.createdBy || x.CreatedBy || '—')) +
            myDelDetailRow('تاريخ الإنشاء', myDelEsc(x.createdAt || x.CreatedAt || '—'));

        document.getElementById('myDelDetailsBody').innerHTML = bodyHtml;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('myDelDetailsModal')).show();
    } catch (e) {
        if (typeof showToast === 'function') showToast('خطأ في الاتصال', 'error');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    myDelLoad();
});
