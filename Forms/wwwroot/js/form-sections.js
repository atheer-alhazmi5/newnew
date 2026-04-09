let fmsAll = [];
let fmsFiltered = [];
let fmsCurrentPage = 1;
const fmsPerPage = 10;

const FMS_ICONS = [
    { key: 'bi-file-earmark-text-fill', label: 'مستند' },
    { key: 'bi-journal-text', label: 'دفتر' },
    { key: 'bi-clipboard2-check-fill', label: 'قائمة تحقق' },
    { key: 'bi-card-checklist', label: 'بطاقة' },
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

function fmsRenderIconPicker(containerId, selectedIcon, prefix) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = FMS_ICONS.map(function(ic) {
        return '<div class="fms-icon-picker-item' + (selectedIcon === ic.key ? ' selected' : '') +
            '" data-icon="' + ic.key + '" title="' + ic.label + '" onclick="fmsSelectIcon(\'' + prefix + '\',\'' + ic.key + '\',this)">' +
            '<i class="bi ' + ic.key + '"></i></div>';
    }).join('');
}

function fmsSelectIcon(prefix, key, el) {
    document.querySelectorAll('#fms' + prefix + 'IconPicker .fms-icon-picker-item').forEach(function(item) {
        item.classList.remove('selected');
    });
    el.classList.add('selected');
    document.getElementById('fms' + prefix + 'Icon').value = key;
}

document.addEventListener('DOMContentLoaded', function () {
    fmsLoad();
    fmsRenderIconPicker('fmsAddIconPicker', '', 'Add');
    fmsRenderIconPicker('fmsEditIconPicker', '', 'Edit');

    document.getElementById('fmsAddIsActive').addEventListener('change', function () {
        document.getElementById('fmsAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    document.getElementById('fmsEditIsActive').addEventListener('change', function () {
        document.getElementById('fmsEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function fmsLoad() {
    try {
        var r = await apiFetch('/Settings/GetFormSections');
        if (r && r.success) {
            fmsAll = r.data;
            fmsFilter();
        } else {
            document.getElementById('fmsBody').innerHTML =
                '<tr><td colspan="7">' + emptyState('bi-layout-text-sidebar-reverse', 'لا توجد أنواع', 'أضف أنواعاً جديدة للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('fmsBody').innerHTML =
            '<tr><td colspan="7" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function fmsFilter() {
    var q = (document.getElementById('fmsSearchInput').value || '').trim().toLowerCase();
    fmsFiltered = q
        ? fmsAll.filter(function (c) { return c.name.toLowerCase().includes(q); })
        : [].concat(fmsAll);
    fmsCurrentPage = 1;
    fmsRenderTable();
}

function fmsClear() {
    var input = document.getElementById('fmsSearchInput');
    if (input) input.value = '';
    fmsFilter();
}

function fmsRenderTable() {
    var body = document.getElementById('fmsBody');
    if (fmsFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' +
            emptyState('bi-layout-text-sidebar-reverse', 'لا توجد أنواع', 'لم يتم العثور على نتائج') +
            '</td></tr>';
        document.getElementById('fmsPaginationContainer').innerHTML = '';
        return;
    }

    var start = (fmsCurrentPage - 1) * fmsPerPage;
    var page = fmsFiltered.slice(start, start + fmsPerPage);
    var html = '';

    page.forEach(function (c) {
        var statusClass = c.isActive ? 'active' : 'inactive';
        var statusText = c.isActive ? 'مفعل' : 'معطل';
        var safeName = esc(c.name).replace(/'/g, "\\'");
        var iconClass = c.icon || 'bi-layout-text-sidebar-reverse';

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;font-size:15px;color:var(--gray-700);">' + esc(String(c.sortOrder)) + '</td>' +
            '<td style="text-align:center;"><div class="fms-icon-display"><i class="bi ' + esc(iconClass) + '"></i></div></td>' +
            '<td style="text-align:right;font-weight:700;font-size:14px;color:var(--gray-800);padding-right:16px;">' + esc(c.name) + '</td>' +
            '<td style="text-align:right;color:var(--gray-500);font-size:13px;max-width:220px;padding-right:16px;">' + (c.description ? esc(c.description) : '<span style="color:var(--gray-300);">—</span>') + '</td>' +
            '<td style="text-align:center;">' +
                '<div style="display:inline-flex;align-items:center;gap:8px;">' +
                    '<span class="fms-color-circle" style="background:' + esc(c.color) + ';"></span>' +
                    '<span style="direction:ltr;font-size:12px;color:var(--gray-500);font-weight:600;">' + esc(c.color) + '</span>' +
                '</div>' +
            '</td>' +
            '<td style="text-align:center;"><span class="fms-status-pill ' + statusClass + '"><span class="fms-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="fms-action-btn fms-action-btn-detail" onclick="fmsShowDetails(' + c.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="fms-action-btn fms-action-btn-edit" onclick="fmsShowEditModal(' + c.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="fms-action-btn fms-action-btn-delete" onclick="fmsShowDeleteModal(' + c.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    body.innerHTML = html;
    renderPagination(
        document.getElementById('fmsPaginationContainer'),
        fmsFiltered.length, fmsCurrentPage, fmsPerPage, 'fmsGoToPage'
    );
}

function fmsGoToPage(p) {
    fmsCurrentPage = p;
    fmsRenderTable();
}

function fmsShowAddModal() {
    document.getElementById('fmsAddName').value = '';
    document.getElementById('fmsAddDescription').value = '';
    document.getElementById('fmsAddColor').value = '#25935F';
    document.getElementById('fmsAddColorHex').textContent = '#25935F';
    document.getElementById('fmsAddIcon').value = '';
    document.getElementById('fmsAddIsActive').checked = true;
    document.getElementById('fmsAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('fmsAddError').classList.add('d-none');
    fmsRenderIconPicker('fmsAddIconPicker', '', 'Add');
    new bootstrap.Modal(document.getElementById('fmsAddModal')).show();
}

async function fmsSubmitAdd() {
    var name = document.getElementById('fmsAddName').value.trim();
    var icon = document.getElementById('fmsAddIcon').value;
    var errEl = document.getElementById('fmsAddError');
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

    var duplicate = fmsAll.find(function (c) { return (c.name || '').trim() === name; });
    if (duplicate) {
        errEl.textContent = 'اسم النوع موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        name: name,
        description: document.getElementById('fmsAddDescription').value.trim(),
        color: document.getElementById('fmsAddColor').value,
        icon: icon,
        isActive: document.getElementById('fmsAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddFormSection', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fmsAddModal')).hide();
        showToast(r.message, 'success');
        await fmsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function fmsShowEditModal(id) {
    var row = fmsAll.find(function (c) { return c.id === id; });
    if (!row) return;

    document.getElementById('fmsEditId').value = row.id;
    document.getElementById('fmsEditName').value = row.name;
    document.getElementById('fmsEditDescription').value = row.description || '';
    document.getElementById('fmsEditSortOrder').value = row.sortOrder;
    document.getElementById('fmsEditColor').value = row.color;
    document.getElementById('fmsEditColorHex').textContent = row.color;
    document.getElementById('fmsEditIcon').value = row.icon || '';
    document.getElementById('fmsEditIsActive').checked = row.isActive;
    document.getElementById('fmsEditIsActiveLabel').textContent = row.isActive ? 'مفعل' : 'معطل';
    document.getElementById('fmsEditError').classList.add('d-none');

    document.getElementById('fmsEditSortOrder').setAttribute('max', fmsAll.length);
    fmsRenderIconPicker('fmsEditIconPicker', row.icon || '', 'Edit');

    new bootstrap.Modal(document.getElementById('fmsEditModal')).show();
}

async function fmsSubmitEdit() {
    var id = parseInt(document.getElementById('fmsEditId').value);
    var name = document.getElementById('fmsEditName').value.trim();
    var icon = document.getElementById('fmsEditIcon').value;
    var errEl = document.getElementById('fmsEditError');
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

    var duplicate = fmsAll.find(function (c) { return (c.name || '').trim() === name && c.id !== id; });
    if (duplicate) {
        errEl.textContent = 'اسم النوع موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('fmsEditSortOrder').value);
    if (isNaN(sortOrder) || sortOrder < 1) {
        errEl.textContent = 'الترتيب يجب أن يبدأ من 1';
        errEl.classList.remove('d-none');
        return;
    }
    if (sortOrder > fmsAll.length) {
        errEl.textContent = 'الترتيب لا يمكن أن يتجاوز ' + fmsAll.length;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        id: id,
        name: name,
        description: document.getElementById('fmsEditDescription').value.trim(),
        color: document.getElementById('fmsEditColor').value,
        icon: icon,
        sortOrder: sortOrder,
        isActive: document.getElementById('fmsEditIsActive').checked
    };

    var r = await apiFetch('/Settings/UpdateFormSection', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fmsEditModal')).hide();
        showToast(r.message, 'success');
        await fmsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function fmsShowDetails(id) {
    var row = fmsAll.find(function (c) { return c.id === id; });
    if (!row) return;

    var statusClass = row.isActive ? 'active' : 'inactive';
    var statusText = row.isActive ? 'مفعل' : 'معطل';
    var iconClass = row.icon || 'bi-layout-text-sidebar-reverse';

    var html =
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">الترتيب</div>' +
            '<div class="fms-detail-value" style="font-weight:700;">' + esc(String(row.sortOrder)) + '</div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">الأيقونة</div>' +
            '<div class="fms-detail-value"><div class="fms-icon-display"><i class="bi ' + esc(iconClass) + '"></i></div></div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">اسم النوع</div>' +
            '<div class="fms-detail-value" style="font-weight:700;">' + esc(row.name) + '</div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">الوصف</div>' +
            '<div class="fms-detail-value">' + (row.description ? esc(row.description) : '<span style="color:var(--gray-400);">لا يوجد وصف</span>') + '</div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">اللون</div>' +
            '<div class="fms-detail-value"><span class="fms-color-circle" style="background:' + esc(row.color) + ';margin-left:10px;"></span><span style="direction:ltr;font-size:13px;color:var(--gray-500);">' + esc(row.color) + '</span></div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">التفعيل</div>' +
            '<div class="fms-detail-value"><span class="fms-status-pill ' + statusClass + '"><span class="fms-status-dot"></span>' + statusText + '</span></div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">أضيف بواسطة</div>' +
            '<div class="fms-detail-value">' + (row.createdBy ? esc(row.createdBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">تاريخ الإنشاء</div>' +
            '<div class="fms-detail-value">' + esc(row.createdAt) + '</div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">آخر تعديل بواسطة</div>' +
            '<div class="fms-detail-value">' + (row.updatedBy ? esc(row.updatedBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="fms-detail-row">' +
            '<div class="fms-detail-label">تاريخ التعديل</div>' +
            '<div class="fms-detail-value">' + (row.updatedAt ? esc(row.updatedAt) : '<span style="color:var(--gray-400);">لم يتم التعديل بعد</span>') + '</div>' +
        '</div>';

    document.getElementById('fmsDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('fmsDetailsModal')).show();
}

function fmsShowDeleteModal(id, name) {
    document.getElementById('fmsDeleteId').value = id;
    document.getElementById('fmsDeleteNameLabel').textContent = name;
    document.getElementById('fmsDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('fmsDeleteModal')).show();
}

async function fmsSubmitDelete() {
    var id = parseInt(document.getElementById('fmsDeleteId').value);
    var errEl = document.getElementById('fmsDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteFormSection', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fmsDeleteModal')).hide();
        showToast(r.message, 'success');
        await fmsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
