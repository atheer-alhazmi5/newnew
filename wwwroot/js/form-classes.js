let fmcAll = [];
let fmcFiltered = [];
let fmcCurrentPage = 1;
const fmcPerPage = 10;

const FMC_ICONS = [
    { key: 'bi-folder2-open', label: 'مجلد' },
    { key: 'bi-archive-fill', label: 'أرشيف' },
    { key: 'bi-collection-fill', label: 'مجموعة' },
    { key: 'bi-box-fill', label: 'صندوق' },
    { key: 'bi-layers-fill', label: 'طبقات' },
    { key: 'bi-grid-fill', label: 'شبكة' },
    { key: 'bi-bookmark-fill', label: 'علامة' },
    { key: 'bi-tag-fill', label: 'وسم' },
    { key: 'bi-diagram-3-fill', label: 'مخطط' },
    { key: 'bi-pie-chart-fill', label: 'دائري' },
    { key: 'bi-palette-fill', label: 'ألوان' },
    { key: 'bi-puzzle-fill', label: 'لغز' },
    { key: 'bi-trophy-fill', label: 'كأس' },
    { key: 'bi-gem', label: 'جوهرة' },

];

function fmcRenderIconPicker(containerId, selectedIcon, prefix) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = FMC_ICONS.map(function(ic) {
        return '<div class="fmc-icon-picker-item' + (selectedIcon === ic.key ? ' selected' : '') +
            '" data-icon="' + ic.key + '" title="' + ic.label + '" onclick="fmcSelectIcon(\'' + prefix + '\',\'' + ic.key + '\',this)">' +
            '<i class="bi ' + ic.key + '"></i></div>';
    }).join('');
}

function fmcSelectIcon(prefix, key, el) {
    document.querySelectorAll('#fmc' + prefix + 'IconPicker .fmc-icon-picker-item').forEach(function(item) {
        item.classList.remove('selected');
    });
    el.classList.add('selected');
    document.getElementById('fmc' + prefix + 'Icon').value = key;
}

document.addEventListener('DOMContentLoaded', function () {
    fmcLoad();
    fmcRenderIconPicker('fmcAddIconPicker', '', 'Add');
    fmcRenderIconPicker('fmcEditIconPicker', '', 'Edit');

    document.getElementById('fmcAddIsActive').addEventListener('change', function () {
        document.getElementById('fmcAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    document.getElementById('fmcEditIsActive').addEventListener('change', function () {
        document.getElementById('fmcEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function fmcLoad() {
    try {
        var r = await apiFetch('/Settings/GetFormClasses');
        if (r && r.success) {
            fmcAll = r.data;
            fmcFilter();
        } else {
            document.getElementById('fmcBody').innerHTML =
                '<tr><td colspan="7">' + emptyState('bi-folder2-open', 'لا توجد أصناف', 'أضف أصنافاً جديدة للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('fmcBody').innerHTML =
            '<tr><td colspan="7" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function fmcFilter() {
    var q = (document.getElementById('fmcSearchInput').value || '').trim().toLowerCase();
    fmcFiltered = q
        ? fmcAll.filter(function (c) { return c.name.toLowerCase().includes(q); })
        : [].concat(fmcAll);
    fmcCurrentPage = 1;
    fmcRenderTable();
}

function fmcRenderTable() {
    var body = document.getElementById('fmcBody');
    if (fmcFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' +
            emptyState('bi-folder2-open', 'لا توجد أصناف', 'لم يتم العثور على نتائج') +
            '</td></tr>';
        document.getElementById('fmcPaginationContainer').innerHTML = '';
        return;
    }

    var start = (fmcCurrentPage - 1) * fmcPerPage;
    var page = fmcFiltered.slice(start, start + fmcPerPage);
    var html = '';

    page.forEach(function (c) {
        var statusClass = c.isActive ? 'active' : 'inactive';
        var statusText = c.isActive ? 'مفعل' : 'معطل';
        var safeName = esc(c.name).replace(/'/g, "\\'");
        var iconClass = c.icon || 'bi-folder2-open';

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;font-size:15px;color:var(--gray-700);">' + esc(String(c.sortOrder)) + '</td>' +
            '<td style="text-align:center;"><div class="fmc-icon-display"><i class="bi ' + esc(iconClass) + '"></i></div></td>' +
            '<td style="font-weight:700;font-size:14px;color:var(--gray-800);">' + esc(c.name) + '</td>' +
            '<td style="text-align:center;">' +
                '<div style="display:inline-flex;align-items:center;gap:8px;">' +
                    '<span class="fmc-color-circle" style="background:' + esc(c.color) + ';"></span>' +
                    '<span style="direction:ltr;font-size:12px;color:var(--gray-500);font-weight:600;">' + esc(c.color) + '</span>' +
                '</div>' +
            '</td>' +
            '<td style="color:var(--gray-500);font-size:13px;max-width:220px;">' + (c.description ? esc(c.description) : '<span style="color:var(--gray-300);">—</span>') + '</td>' +
            '<td style="text-align:center;"><span class="fmc-status-pill ' + statusClass + '"><span class="fmc-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="fmc-action-btn fmc-action-btn-detail" onclick="fmcShowDetails(' + c.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="fmc-action-btn fmc-action-btn-edit" onclick="fmcShowEditModal(' + c.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="fmc-action-btn fmc-action-btn-delete" onclick="fmcShowDeleteModal(' + c.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    body.innerHTML = html;
    renderPagination(
        document.getElementById('fmcPaginationContainer'),
        fmcFiltered.length, fmcCurrentPage, fmcPerPage, 'fmcGoToPage'
    );
}

function fmcGoToPage(p) {
    fmcCurrentPage = p;
    fmcRenderTable();
}

function fmcShowAddModal() {
    document.getElementById('fmcAddName').value = '';
    document.getElementById('fmcAddDescription').value = '';
    document.getElementById('fmcAddColor').value = '#25935F';
    document.getElementById('fmcAddColorHex').textContent = '#25935F';
    document.getElementById('fmcAddIcon').value = '';
    document.getElementById('fmcAddIsActive').checked = true;
    document.getElementById('fmcAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('fmcAddError').classList.add('d-none');
    fmcRenderIconPicker('fmcAddIconPicker', '', 'Add');
    new bootstrap.Modal(document.getElementById('fmcAddModal')).show();
}

async function fmcSubmitAdd() {
    var name = document.getElementById('fmcAddName').value.trim();
    var icon = document.getElementById('fmcAddIcon').value;
    var errEl = document.getElementById('fmcAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الصنف مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    if (!icon) {
        errEl.textContent = 'اختيار الأيقونة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var duplicate = fmcAll.find(function (c) { return c.name === name; });
    if (duplicate) {
        errEl.textContent = 'اسم الصنف موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        name: name,
        description: document.getElementById('fmcAddDescription').value.trim(),
        color: document.getElementById('fmcAddColor').value,
        icon: icon,
        isActive: document.getElementById('fmcAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddFormClass', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fmcAddModal')).hide();
        showToast(r.message, 'success');
        await fmcLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function fmcShowEditModal(id) {
    var row = fmcAll.find(function (c) { return c.id === id; });
    if (!row) return;

    document.getElementById('fmcEditId').value = row.id;
    document.getElementById('fmcEditName').value = row.name;
    document.getElementById('fmcEditDescription').value = row.description || '';
    document.getElementById('fmcEditSortOrder').value = row.sortOrder;
    document.getElementById('fmcEditColor').value = row.color;
    document.getElementById('fmcEditColorHex').textContent = row.color;
    document.getElementById('fmcEditIcon').value = row.icon || '';
    document.getElementById('fmcEditIsActive').checked = row.isActive;
    document.getElementById('fmcEditIsActiveLabel').textContent = row.isActive ? 'مفعل' : 'معطل';
    document.getElementById('fmcEditError').classList.add('d-none');

    document.getElementById('fmcEditSortOrder').setAttribute('max', fmcAll.length);
    fmcRenderIconPicker('fmcEditIconPicker', row.icon || '', 'Edit');

    new bootstrap.Modal(document.getElementById('fmcEditModal')).show();
}

async function fmcSubmitEdit() {
    var id = parseInt(document.getElementById('fmcEditId').value);
    var name = document.getElementById('fmcEditName').value.trim();
    var icon = document.getElementById('fmcEditIcon').value;
    var errEl = document.getElementById('fmcEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الصنف مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    if (!icon) {
        errEl.textContent = 'اختيار الأيقونة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var duplicate = fmcAll.find(function (c) { return c.name === name && c.id !== id; });
    if (duplicate) {
        errEl.textContent = 'اسم الصنف موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('fmcEditSortOrder').value);
    if (isNaN(sortOrder) || sortOrder < 1) {
        errEl.textContent = 'الترتيب يجب أن يبدأ من 1';
        errEl.classList.remove('d-none');
        return;
    }
    if (sortOrder > fmcAll.length) {
        errEl.textContent = 'الترتيب لا يمكن أن يتجاوز ' + fmcAll.length;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        id: id,
        name: name,
        description: document.getElementById('fmcEditDescription').value.trim(),
        color: document.getElementById('fmcEditColor').value,
        icon: icon,
        sortOrder: sortOrder,
        isActive: document.getElementById('fmcEditIsActive').checked
    };

    var r = await apiFetch('/Settings/UpdateFormClass', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fmcEditModal')).hide();
        showToast(r.message, 'success');
        await fmcLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function fmcShowDetails(id) {
    var row = fmcAll.find(function (c) { return c.id === id; });
    if (!row) return;

    var statusClass = row.isActive ? 'active' : 'inactive';
    var statusText = row.isActive ? 'مفعل' : 'معطل';
    var iconClass = row.icon || 'bi-folder2-open';

    var html =
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">الترتيب</div>' +
            '<div class="fmc-detail-value" style="font-weight:700;">' + esc(String(row.sortOrder)) + '</div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">الأيقونة</div>' +
            '<div class="fmc-detail-value"><div class="fmc-icon-display"><i class="bi ' + esc(iconClass) + '"></i></div></div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">اسم الصنف</div>' +
            '<div class="fmc-detail-value" style="font-weight:700;">' + esc(row.name) + '</div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">الوصف</div>' +
            '<div class="fmc-detail-value">' + (row.description ? esc(row.description) : '<span style="color:var(--gray-400);">لا يوجد وصف</span>') + '</div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">اللون</div>' +
            '<div class="fmc-detail-value"><span class="fmc-color-circle" style="background:' + esc(row.color) + ';margin-left:10px;"></span><span style="direction:ltr;font-size:13px;color:var(--gray-500);">' + esc(row.color) + '</span></div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">التفعيل</div>' +
            '<div class="fmc-detail-value"><span class="fmc-status-pill ' + statusClass + '"><span class="fmc-status-dot"></span>' + statusText + '</span></div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">أضيف بواسطة</div>' +
            '<div class="fmc-detail-value">' + (row.createdBy ? esc(row.createdBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">تاريخ الإنشاء</div>' +
            '<div class="fmc-detail-value">' + esc(row.createdAt) + '</div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">آخر تعديل بواسطة</div>' +
            '<div class="fmc-detail-value">' + (row.updatedBy ? esc(row.updatedBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">تاريخ التعديل</div>' +
            '<div class="fmc-detail-value">' + (row.updatedAt ? esc(row.updatedAt) : '<span style="color:var(--gray-400);">لم يتم التعديل بعد</span>') + '</div>' +
        '</div>';

    document.getElementById('fmcDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('fmcDetailsModal')).show();
}

function fmcShowDeleteModal(id, name) {
    document.getElementById('fmcDeleteId').value = id;
    document.getElementById('fmcDeleteNameLabel').textContent = name;
    document.getElementById('fmcDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('fmcDeleteModal')).show();
}

async function fmcSubmitDelete() {
    var id = parseInt(document.getElementById('fmcDeleteId').value);
    var errEl = document.getElementById('fmcDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteFormClass', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fmcDeleteModal')).hide();
        showToast(r.message, 'success');
        await fmcLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
