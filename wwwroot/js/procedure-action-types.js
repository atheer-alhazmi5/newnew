/** أنواع الإجراءات — مطابقة كاملة لصفحة «أنواع النماذج» (form-sections.js) — IDs و كلاسات pat-* فقط. */
let patAll = [];
let patFiltered = [];
let patCurrentPage = 1;
const patPerPage = 10;

const PAT_ICONS = [
    { key: 'bi-diagram-3-fill', label: 'مخطط' },
    { key: 'bi-clipboard2-check-fill', label: 'قائمة تحقق' },
    { key: 'bi-card-checklist', label: 'بطاقة' },
    { key: 'bi-file-earmark-text-fill', label: 'مستند' },
    { key: 'bi-journal-text', label: 'دفتر' },
    { key: 'bi-envelope-fill', label: 'رسالة' },
    { key: 'bi-megaphone-fill', label: 'إعلان' },
    { key: 'bi-lightning-fill', label: 'سريع' },
    { key: 'bi-gear-fill', label: 'إعدادات' },
    { key: 'bi-shield-check', label: 'حماية' },
    { key: 'bi-person-badge-fill', label: 'بطاقة شخصية' },
    { key: 'bi-cash-stack', label: 'مالي' },
    { key: 'bi-truck', label: 'نقل' },
    { key: 'bi-tools', label: 'أدوات' },
    { key: 'bi-house-fill', label: 'مبنى' },
    { key: 'bi-hand-thumbs-up-fill', label: 'موافقة' }
];

function patRenderIconPicker(containerId, selectedIcon, prefix) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = PAT_ICONS.map(function(ic) {
        return '<div class="pat-icon-picker-item' + (selectedIcon === ic.key ? ' selected' : '') +
            '" data-icon="' + ic.key + '" title="' + ic.label + '" onclick="patSelectIcon(\'' + prefix + '\',\'' + ic.key + '\',this)">' +
            '<i class="bi ' + ic.key + '"></i></div>';
    }).join('');
}

function patSelectIcon(prefix, key, el) {
    document.querySelectorAll('#pat' + prefix + 'IconPicker .pat-icon-picker-item').forEach(function(item) {
        item.classList.remove('selected');
    });
    el.classList.add('selected');
    document.getElementById('pat' + prefix + 'Icon').value = key;
}

document.addEventListener('DOMContentLoaded', function () {
    patLoad();
    patRenderIconPicker('patAddIconPicker', '', 'Add');
    patRenderIconPicker('patEditIconPicker', '', 'Edit');

    var addCb = document.getElementById('patAddIsActive');
    if (addCb) addCb.addEventListener('change', function () {
        document.getElementById('patAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    var editCb = document.getElementById('patEditIsActive');
    if (editCb) editCb.addEventListener('change', function () {
        document.getElementById('patEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function patLoad() {
    try {
        var r = await apiFetch('/Settings/GetProcedureActionTypes');
        if (r && r.success) {
            patAll = r.data || [];
            patFilter();
        } else {
            document.getElementById('patBody').innerHTML =
                '<tr><td colspan="7">' + (typeof emptyState === 'function' ? emptyState('bi-diagram-3', 'لا توجد أنواع', 'أضف أنواعاً جديدة للبدء') : '<div class="text-center text-muted py-4">لا توجد بيانات</div>') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('patBody').innerHTML =
            '<tr><td colspan="7" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function patFilter() {
    var input = document.getElementById('patSearchInput');
    var q = (input && input.value || '').trim().toLowerCase();
    patFiltered = q
        ? patAll.filter(function (c) { return (c.name || '').toLowerCase().includes(q); })
        : [].concat(patAll);
    patCurrentPage = 1;
    patRenderTable();
}

function patClear() {
    var input = document.getElementById('patSearchInput');
    if (input) input.value = '';
    patFilter();
}

function patEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function patRenderTable() {
    var body = document.getElementById('patBody');
    if (!body) return;
    if (patFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' +
            (typeof emptyState === 'function' ? emptyState('bi-diagram-3', 'لا توجد أنواع', 'لم يتم العثور على نتائج') : '<div class="text-center text-muted py-4">لا توجد نتائج</div>') +
            '</td></tr>';
        var pg = document.getElementById('patPaginationContainer');
        if (pg) pg.innerHTML = '';
        return;
    }

    var start = (patCurrentPage - 1) * patPerPage;
    var page = patFiltered.slice(start, start + patPerPage);
    var html = '';

    page.forEach(function (c) {
        var statusClass = c.isActive ? 'active' : 'inactive';
        var statusText = c.isActive ? 'مفعل' : 'معطل';
        var safeName = patEsc(c.name).replace(/'/g, "\\'");
        var iconClass = c.icon || 'bi-diagram-3-fill';
        var color = c.color || '#25935F';

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;font-size:15px;color:var(--gray-700);">' + patEsc(String(c.sortOrder)) + '</td>' +
            '<td style="text-align:center;"><div class="pat-icon-display"><i class="bi ' + patEsc(iconClass) + '"></i></div></td>' +
            '<td style="text-align:right;font-weight:700;font-size:14px;color:var(--gray-800);padding-right:16px;">' + patEsc(c.name) + '</td>' +
            '<td style="text-align:right;color:var(--gray-500);font-size:13px;max-width:220px;padding-right:16px;">' + (c.description ? patEsc(c.description) : '<span style="color:var(--gray-300);">—</span>') + '</td>' +
            '<td style="text-align:center;">' +
                '<div style="display:inline-flex;align-items:center;gap:8px;">' +
                    '<span class="pat-color-circle" style="background:' + patEsc(color) + ';"></span>' +
                    '<span style="direction:ltr;font-size:12px;color:var(--gray-500);font-weight:600;">' + patEsc(color) + '</span>' +
                '</div>' +
            '</td>' +
            '<td style="text-align:center;"><span class="pat-status-pill ' + statusClass + '"><span class="pat-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="pat-action-btn pat-action-btn-detail" onclick="patShowDetails(' + c.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="pat-action-btn pat-action-btn-edit" onclick="patShowEditModal(' + c.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="pat-action-btn pat-action-btn-delete" onclick="patShowDeleteModal(' + c.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    body.innerHTML = html;
    if (typeof renderPagination === 'function') {
        renderPagination(
            document.getElementById('patPaginationContainer'),
            patFiltered.length, patCurrentPage, patPerPage, 'patGoToPage'
        );
    }
}

function patGoToPage(p) {
    patCurrentPage = p;
    patRenderTable();
}

function patShowAddModal() {
    document.getElementById('patAddName').value = '';
    document.getElementById('patAddDescription').value = '';
    document.getElementById('patAddColor').value = '#25935F';
    document.getElementById('patAddColorHex').textContent = '#25935F';
    document.getElementById('patAddIcon').value = '';
    document.getElementById('patAddIsActive').checked = true;
    document.getElementById('patAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('patAddError').classList.add('d-none');
    patRenderIconPicker('patAddIconPicker', '', 'Add');
    new bootstrap.Modal(document.getElementById('patAddModal')).show();
}

async function patSubmitAdd() {
    var name = document.getElementById('patAddName').value.trim();
    var icon = document.getElementById('patAddIcon').value;
    var errEl = document.getElementById('patAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم النوع مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (!icon) {
        errEl.textContent = 'اختيار الأيقونة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    var duplicate = patAll.find(function (c) { return (c.name || '').trim() === name; });
    if (duplicate) {
        errEl.textContent = 'اسم النوع موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        name: name,
        description: document.getElementById('patAddDescription').value.trim(),
        color: document.getElementById('patAddColor').value,
        icon: icon,
        isActive: document.getElementById('patAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddProcedureActionType', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('patAddModal')).hide();
        if (typeof showToast === 'function') showToast(r.message || 'تم الحفظ', 'success');
        await patLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function patShowEditModal(id) {
    var row = patAll.find(function (c) { return c.id === id; });
    if (!row) return;

    document.getElementById('patEditId').value = row.id;
    document.getElementById('patEditName').value = row.name;
    document.getElementById('patEditDescription').value = row.description || '';
    document.getElementById('patEditSortOrder').value = row.sortOrder;
    document.getElementById('patEditColor').value = row.color || '#25935F';
    document.getElementById('patEditColorHex').textContent = row.color || '#25935F';
    document.getElementById('patEditIcon').value = row.icon || '';
    document.getElementById('patEditIsActive').checked = !!row.isActive;
    document.getElementById('patEditIsActiveLabel').textContent = row.isActive ? 'مفعل' : 'معطل';
    document.getElementById('patEditError').classList.add('d-none');

    document.getElementById('patEditSortOrder').setAttribute('max', patAll.length);
    patRenderIconPicker('patEditIconPicker', row.icon || '', 'Edit');

    new bootstrap.Modal(document.getElementById('patEditModal')).show();
}

async function patSubmitEdit() {
    var id = parseInt(document.getElementById('patEditId').value);
    var name = document.getElementById('patEditName').value.trim();
    var icon = document.getElementById('patEditIcon').value;
    var errEl = document.getElementById('patEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم النوع مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (!icon) {
        errEl.textContent = 'اختيار الأيقونة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    var duplicate = patAll.find(function (c) { return (c.name || '').trim() === name && c.id !== id; });
    if (duplicate) {
        errEl.textContent = 'اسم النوع موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('patEditSortOrder').value);
    if (isNaN(sortOrder) || sortOrder < 1) {
        errEl.textContent = 'الترتيب يجب أن يبدأ من 1';
        errEl.classList.remove('d-none');
        return;
    }
    if (sortOrder > patAll.length) {
        errEl.textContent = 'الترتيب لا يمكن أن يتجاوز ' + patAll.length;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        id: id,
        name: name,
        description: document.getElementById('patEditDescription').value.trim(),
        color: document.getElementById('patEditColor').value,
        icon: icon,
        sortOrder: sortOrder,
        isActive: document.getElementById('patEditIsActive').checked
    };

    var r = await apiFetch('/Settings/UpdateProcedureActionType', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('patEditModal')).hide();
        if (typeof showToast === 'function') showToast(r.message || 'تم التحديث', 'success');
        await patLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function patShowDetails(id) {
    var row = patAll.find(function (c) { return c.id === id; });
    if (!row) return;

    var statusClass = row.isActive ? 'active' : 'inactive';
    var statusText = row.isActive ? 'مفعل' : 'معطل';
    var iconClass = row.icon || 'bi-diagram-3-fill';
    var color = row.color || '#25935F';

    var html =
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">الترتيب</div>' +
            '<div class="pat-detail-value" style="font-weight:700;">' + patEsc(String(row.sortOrder)) + '</div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">الأيقونة</div>' +
            '<div class="pat-detail-value"><div class="pat-icon-display"><i class="bi ' + patEsc(iconClass) + '"></i></div></div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">اسم النوع</div>' +
            '<div class="pat-detail-value" style="font-weight:700;">' + patEsc(row.name) + '</div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">الوصف</div>' +
            '<div class="pat-detail-value">' + (row.description ? patEsc(row.description) : '<span style="color:var(--gray-400);">لا يوجد وصف</span>') + '</div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">اللون</div>' +
            '<div class="pat-detail-value"><span class="pat-color-circle" style="background:' + patEsc(color) + ';margin-left:10px;"></span><span style="direction:ltr;font-size:13px;color:var(--gray-500);">' + patEsc(color) + '</span></div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">التفعيل</div>' +
            '<div class="pat-detail-value"><span class="pat-status-pill ' + statusClass + '"><span class="pat-status-dot"></span>' + statusText + '</span></div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">أضيف بواسطة</div>' +
            '<div class="pat-detail-value" style="font-weight:700;">' + (row.createdBy && String(row.createdBy).trim() ? patEsc(String(row.createdBy).trim()) : '<span style="color:var(--gray-400);font-weight:400;">—</span>') + '</div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">تاريخ الإنشاء</div>' +
            '<div class="pat-detail-value">' + patEsc(row.createdAt || '—') + '</div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">آخر تعديل بواسطة</div>' +
            '<div class="pat-detail-value">' + (row.updatedBy ? patEsc(row.updatedBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="pat-detail-row">' +
            '<div class="pat-detail-label">تاريخ التعديل</div>' +
            '<div class="pat-detail-value">' + (row.updatedAt ? patEsc(row.updatedAt) : '<span style="color:var(--gray-400);">لم يتم التعديل بعد</span>') + '</div>' +
        '</div>';

    document.getElementById('patDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('patDetailsModal')).show();
}

function patShowDeleteModal(id, name) {
    document.getElementById('patDeleteId').value = id;
    document.getElementById('patDeleteNameLabel').textContent = name;
    document.getElementById('patDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('patDeleteModal')).show();
}

async function patSubmitDelete() {
    var id = parseInt(document.getElementById('patDeleteId').value);
    var errEl = document.getElementById('patDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteProcedureActionType', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('patDeleteModal')).hide();
        if (typeof showToast === 'function') showToast(r.message || 'تم الحذف', 'success');
        await patLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
