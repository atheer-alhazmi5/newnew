let fmcAll = [];
let fmcFiltered = [];
let fmcCurrentPage = 1;
const fmcPerPage = 10;

document.addEventListener('DOMContentLoaded', function () {
    fmcLoad();

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
                '<tr><td colspan="6">' + emptyState('bi-folder2-open', 'لا توجد أصناف', 'أضف أصنافاً جديدة للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('fmcBody').innerHTML =
            '<tr><td colspan="6" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
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
        body.innerHTML = '<tr><td colspan="6">' +
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

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;font-size:15px;color:var(--gray-700);">' + esc(String(c.sortOrder)) + '</td>' +
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
    document.getElementById('fmcAddIsActive').checked = true;
    document.getElementById('fmcAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('fmcAddError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('fmcAddModal')).show();
}

async function fmcSubmitAdd() {
    var name = document.getElementById('fmcAddName').value.trim();
    var errEl = document.getElementById('fmcAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الصنف مطلوب';
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
    document.getElementById('fmcEditIsActive').checked = row.isActive;
    document.getElementById('fmcEditIsActiveLabel').textContent = row.isActive ? 'مفعل' : 'معطل';
    document.getElementById('fmcEditError').classList.add('d-none');

    document.getElementById('fmcEditSortOrder').setAttribute('max', fmcAll.length);

    new bootstrap.Modal(document.getElementById('fmcEditModal')).show();
}

async function fmcSubmitEdit() {
    var id = parseInt(document.getElementById('fmcEditId').value);
    var name = document.getElementById('fmcEditName').value.trim();
    var errEl = document.getElementById('fmcEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الصنف مطلوب';
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

    var html =
        '<div class="fmc-detail-row">' +
            '<div class="fmc-detail-label">الترتيب</div>' +
            '<div class="fmc-detail-value" style="font-weight:700;">' + esc(String(row.sortOrder)) + '</div>' +
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
