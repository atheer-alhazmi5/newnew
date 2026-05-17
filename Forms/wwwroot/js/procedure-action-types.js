/** أنواع الإجراءات — نفس أسلوب عرض/فلترة/مودالات صفحات الإعدادات */
var patAll = [];
var patFiltered = [];
var patCurrentPage = 1;
var patPerPage = 10;

document.addEventListener('DOMContentLoaded', function () {
    patLoad();
    var qs = document.getElementById('patSearchInput');
    var st = document.getElementById('patFilterStatus');
    var clr = document.getElementById('patFilterClear');
    if (qs) qs.addEventListener('input', patFilter);
    if (st) st.addEventListener('change', patFilter);
    if (clr) clr.addEventListener('click', patClearFilters);
});

async function patLoad() {
    var body = document.getElementById('patBody');
    try {
        var res = await apiFetch('/Settings/GetProcedureActionTypes');
        if (res && res.success) {
            patAll = res.data || [];
            patFilter();
        } else {
            patAll = [];
            body.innerHTML = '<tr><td colspan="5">' +
                (typeof emptyState === 'function'
                    ? emptyState('bi-diagram-3', 'لا توجد بيانات', 'أضف نوع إجراء من الزر أعلاه')
                    : '<div class="text-center text-muted py-4">لا توجد بيانات</div>') +
                '</td></tr>';
        }
    } catch (e) {
        body.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function patFilter() {
    var q = (document.getElementById('patSearchInput') && document.getElementById('patSearchInput').value || '').trim().toLowerCase();
    var st = document.getElementById('patFilterStatus') ? document.getElementById('patFilterStatus').value : '';
    patFiltered = patAll.filter(function (r) {
        if (q) {
            var nm = (r.name || '').toLowerCase();
            var ds = (r.description || '').toLowerCase();
            if (!nm.includes(q) && !ds.includes(q)) return false;
        }
        if (st === '1' && !r.isActive) return false;
        if (st === '0' && r.isActive) return false;
        return true;
    });
    patCurrentPage = 1;
    patRenderTable();
}

function patClearFilters() {
    var qs = document.getElementById('patSearchInput');
    var st = document.getElementById('patFilterStatus');
    if (qs) qs.value = '';
    if (st) st.value = '';
    patFilter();
}

function patEsc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function patRenderTable() {
    var body = document.getElementById('patBody');
    var pag = document.getElementById('patPaginationContainer');
    if (!body) return;

    if (patFiltered.length === 0) {
        var hasF = (document.getElementById('patSearchInput') && document.getElementById('patSearchInput').value.trim()) ||
            (document.getElementById('patFilterStatus') && document.getElementById('patFilterStatus').value !== '');
        var sub = hasF ? 'عدّل الفلاتر أو اضغط مسح' : 'أضف نوع إجراء من الزر أعلاه';
        body.innerHTML = '<tr><td colspan="5">' +
            (typeof emptyState === 'function'
                ? emptyState('bi-funnel', 'لا توجد نتائج', sub)
                : '<div class="text-center text-muted py-4">لا توجد نتائج</div>') +
            '</td></tr>';
        if (pag) pag.innerHTML = '';
        return;
    }

    var start = (patCurrentPage - 1) * patPerPage;
    var page = patFiltered.slice(start, start + patPerPage);
    var html = '';
    page.forEach(function (r) {
        var id = r.id;
        var nm = r.name || '';
        var desc = (r.description || '').trim();
        var ord = r.sortOrder != null ? r.sortOrder : '';
        var active = !!r.isActive;
        var badgeClass = active ? 'ddl-badge-active' : 'ddl-badge-inactive';
        var badgeText = active ? 'مفعل' : 'معطل';
        var safeName = patEsc(nm).replace(/'/g, '\\\'');

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;">' + patEsc(String(ord)) + '</td>' +
            '<td style="font-weight:700;">' + patEsc(nm) + '</td>' +
            '<td>' + (desc ? patEsc(desc) : '<span class="text-muted">—</span>') + '</td>' +
            '<td style="text-align:center;">' +
                '<div class="d-flex flex-column align-items-center gap-1">' +
                    '<span class="' + badgeClass + '">' + badgeText + '</span>' +
                    '<label class="pat-toggle" title="تفعيل / تعطيل">' +
                        '<input type="checkbox" ' + (active ? 'checked' : '') + ' onchange="patToggleActive(' + id + ')">' +
                        '<span class="pat-slider"></span>' +
                    '</label>' +
                '</div>' +
            '</td>' +
            '<td style="text-align:center;">' +
                '<div class="d-flex gap-1 flex-wrap justify-content-center">' +
                    '<button type="button" class="ddl-action-btn ddl-action-btn-detail" onclick="patShowDetails(' + id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button type="button" class="ddl-action-btn ddl-action-btn-edit" onclick="patShowEdit(' + id + ')"><i class="bi bi-pencil"></i> تعديل</button>' +
                    '<button type="button" class="ddl-action-btn ddl-action-btn-delete" onclick="patShowDelete(' + id + ', \'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });
    body.innerHTML = html;
    if (pag && typeof renderPagination === 'function') {
        renderPagination(pag, patFiltered.length, patCurrentPage, patPerPage, 'patGoToPage');
    }
}

function patGoToPage(p) {
    patCurrentPage = p;
    patRenderTable();
}

function patShowCreateModal() {
    document.getElementById('patCreateName').value = '';
    document.getElementById('patCreateDescription').value = '';
    var on = document.getElementById('patCreateIsActiveOn');
    if (on) on.checked = true;
    document.getElementById('patCreateError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('patCreateModal')).show();
}

async function patSubmitCreate() {
    var err = document.getElementById('patCreateError');
    err.classList.add('d-none');
    var name = document.getElementById('patCreateName').value.trim();
    if (!name) {
        err.textContent = 'اسم نوع الإجراء مطلوب';
        err.classList.remove('d-none');
        return;
    }
    var body = {
        name: name,
        description: document.getElementById('patCreateDescription').value.trim(),
        isActive: document.querySelector('input[name="patCreateIsActive"]:checked')?.value === '1'
    };
    try {
        var res = await apiFetch('/Settings/AddProcedureActionType', 'POST', body);
        if (res && res.success) {
            if (typeof showToast === 'function') showToast(res.message || 'تم الحفظ', 'success');
            bootstrap.Modal.getInstance(document.getElementById('patCreateModal')).hide();
            patLoad();
        } else {
            err.textContent = (res && res.message) || 'تعذر الحفظ';
            err.classList.remove('d-none');
        }
    } catch (e) {
        err.textContent = 'خطأ في الاتصال';
        err.classList.remove('d-none');
    }
}

async function patShowEdit(id) {
    var err = document.getElementById('patEditError');
    err.classList.add('d-none');
    try {
        var res = await apiFetch('/Settings/GetProcedureActionTypeDetails?id=' + id);
        if (!res || !res.success || !res.data) {
            if (typeof showToast === 'function') showToast((res && res.message) || 'غير موجود', 'error');
            return;
        }
        var d = res.data;
        document.getElementById('patEditId').value = d.id;
        document.getElementById('patEditName').value = d.name || '';
        document.getElementById('patEditDescription').value = d.description || '';
        document.getElementById('patEditSortOrder').value = d.sortOrder || 1;
        var soEl = document.getElementById('patEditSortOriginal');
        if (soEl) soEl.value = String(d.sortOrder || 1);
        var on = d.isActive ? '1' : '0';
        var rOn = document.getElementById('patEditIsActiveOn');
        var rOff = document.getElementById('patEditIsActiveOff');
        if (rOn) rOn.checked = on === '1';
        if (rOff) rOff.checked = on === '0';
        new bootstrap.Modal(document.getElementById('patEditModal')).show();
    } catch (e) {
        if (typeof showToast === 'function') showToast('خطأ', 'error');
    }
}

async function patSubmitEdit() {
    var err = document.getElementById('patEditError');
    err.classList.add('d-none');
    var id = parseInt(document.getElementById('patEditId').value, 10);
    var name = document.getElementById('patEditName').value.trim();
    if (!id || !name) {
        err.textContent = 'البيانات غير مكتملة';
        err.classList.remove('d-none');
        return;
    }
    var sortOrder = parseInt(document.getElementById('patEditSortOrder').value, 10) || 1;
    var body = {
        id: id,
        name: name,
        description: document.getElementById('patEditDescription').value.trim(),
        isActive: document.querySelector('input[name="patEditIsActive"]:checked')?.value === '1'
    };
    try {
        var res = await apiFetch('/Settings/UpdateProcedureActionType', 'POST', body);
        if (res && res.success) {
            var prevSo = parseInt(document.getElementById('patEditSortOriginal')?.value || '0', 10);
            if (sortOrder !== prevSo) {
                await apiFetch('/Settings/ReorderProcedureActionType', 'POST', { id: id, newOrder: sortOrder });
            }
            if (typeof showToast === 'function') showToast(res.message || 'تم التحديث', 'success');
            bootstrap.Modal.getInstance(document.getElementById('patEditModal')).hide();
            patLoad();
        } else {
            err.textContent = (res && res.message) || 'تعذر التحديث';
            err.classList.remove('d-none');
        }
    } catch (e) {
        err.textContent = 'خطأ في الاتصال';
        err.classList.remove('d-none');
    }
}

async function patShowDetails(id) {
    try {
        var res = await apiFetch('/Settings/GetProcedureActionTypeDetails?id=' + id);
        if (!res || !res.success || !res.data) {
            if (typeof showToast === 'function') showToast((res && res.message) || 'غير موجود', 'error');
            return;
        }
        var d = res.data;
        var stClass = d.isActive ? 'ddl-badge-active' : 'ddl-badge-inactive';
        var stText = d.isActive ? 'مفعل' : 'معطل';
        var h = '<div class="ddl-section"><div class="row g-3">' +
            '<div class="col-md-6"><strong>الترتيب:</strong> ' + patEsc(String(d.sortOrder)) + '</div>' +
            '<div class="col-md-6"><strong>التفعيل:</strong> <span class="' + stClass + '">' + stText + '</span></div>' +
            '<div class="col-12"><strong>الاسم:</strong> ' + patEsc(d.name) + '</div>' +
            '<div class="col-12"><strong>الوصف:</strong> ' + (d.description ? patEsc(d.description) : '<span class="text-muted">—</span>') + '</div>' +
            '<div class="col-md-6"><strong>أنشئ بواسطة:</strong> ' + patEsc(d.createdBy || '—') + '</div>' +
            '<div class="col-md-6"><strong>تاريخ الإنشاء:</strong> ' + patEsc(d.createdAt || '—') + '</div>' +
            '<div class="col-md-6"><strong>آخر تحديث بواسطة:</strong> ' + patEsc(d.updatedBy || '—') + '</div>' +
            '<div class="col-md-6"><strong>تاريخ التحديث:</strong> ' + patEsc(d.updatedAt || '—') + '</div>' +
            '</div></div>';
        document.getElementById('patDetailBody').innerHTML = h;
        new bootstrap.Modal(document.getElementById('patDetailModal')).show();
    } catch (e) {
        if (typeof showToast === 'function') showToast('خطأ', 'error');
    }
}

function patShowDelete(id, name) {
    document.getElementById('patDeleteId').value = id;
    document.getElementById('patDeleteNameLabel').textContent = name || '';
    document.getElementById('patDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('patDeleteModal')).show();
}

async function patSubmitDelete() {
    var err = document.getElementById('patDeleteError');
    err.classList.add('d-none');
    var id = parseInt(document.getElementById('patDeleteId').value, 10);
    try {
        var res = await apiFetch('/Settings/DeleteProcedureActionType', 'POST', { id: id });
        if (res && res.success) {
            if (typeof showToast === 'function') showToast(res.message || 'تم الحذف', 'success');
            bootstrap.Modal.getInstance(document.getElementById('patDeleteModal')).hide();
            patLoad();
        } else {
            err.textContent = (res && res.message) || 'تعذر الحذف';
            err.classList.remove('d-none');
        }
    } catch (e) {
        err.textContent = 'خطأ في الاتصال';
        err.classList.remove('d-none');
    }
}

async function patToggleActive(id) {
    try {
        var res = await apiFetch('/Settings/ToggleProcedureActionType', 'POST', { id: id });
        if (res && res.success) {
            if (typeof showToast === 'function') showToast(res.message || 'تم', 'success');
            patLoad();
        } else {
            if (typeof showToast === 'function') showToast((res && res.message) || 'تعذر التغيير', 'error');
            patLoad();
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('خطأ', 'error');
        patLoad();
    }
}
