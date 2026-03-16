let clsAll = [];
let clsFiltered = [];
let clsCurrentPage = 1;
const clsPerPage = 10;

document.addEventListener('DOMContentLoaded', function () {
    clsLoad();

    document.getElementById('clsAddIsActive').addEventListener('change', function () {
        document.getElementById('clsAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    document.getElementById('clsEditIsActive').addEventListener('change', function () {
        document.getElementById('clsEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function clsLoad() {
    try {
        var r = await apiFetch('/Settings/GetClassifications');
        if (r && r.success) {
            clsAll = r.data;
            clsFilter();
        } else {
            document.getElementById('clsBody').innerHTML =
                '<tr><td colspan="6">' + emptyState('bi-tags', 'لا توجد تصنيفات', 'أضف تصنيفات جديدة للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('clsBody').innerHTML =
            '<tr><td colspan="6" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function clsFilter() {
    var q = (document.getElementById('clsSearchInput').value || '').trim().toLowerCase();
    clsFiltered = q
        ? clsAll.filter(function (c) { return c.name.toLowerCase().includes(q); })
        : [].concat(clsAll);
    clsCurrentPage = 1;
    clsRenderTable();
}

function clsRenderTable() {
    var body = document.getElementById('clsBody');
    if (clsFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="6">' +
            emptyState('bi-tags', 'لا توجد تصنيفات', 'لم يتم العثور على نتائج') +
            '</td></tr>';
        document.getElementById('clsPaginationContainer').innerHTML = '';
        return;
    }

    var start = (clsCurrentPage - 1) * clsPerPage;
    var page = clsFiltered.slice(start, start + clsPerPage);
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
                    '<span class="cls-color-circle" style="background:' + esc(c.color) + ';"></span>' +
                    '<span style="direction:ltr;font-size:12px;color:var(--gray-500);font-weight:600;">' + esc(c.color) + '</span>' +
                '</div>' +
            '</td>' +
            '<td style="color:var(--gray-500);font-size:13px;max-width:220px;">' + (c.description ? esc(c.description) : '<span style="color:var(--gray-300);">—</span>') + '</td>' +
            '<td style="text-align:center;"><span class="cls-status-pill ' + statusClass + '"><span class="cls-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="cls-action-btn cls-action-btn-detail" onclick="clsShowDetails(' + c.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="cls-action-btn cls-action-btn-edit" onclick="clsShowEditModal(' + c.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="cls-action-btn cls-action-btn-delete" onclick="clsShowDeleteModal(' + c.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
            
    });

    body.innerHTML = html;
    renderPagination(
        document.getElementById('clsPaginationContainer'),
        clsFiltered.length, clsCurrentPage, clsPerPage, 'clsGoToPage'
    );
}

function clsGoToPage(p) {
    clsCurrentPage = p;
    clsRenderTable();
}

// ─── ADD ──────────────────────────────────────────────────────────────────────
function clsShowAddModal() {
    document.getElementById('clsAddName').value = '';
    document.getElementById('clsAddDescription').value = '';
    document.getElementById('clsAddColor').value = '#25935F';
    document.getElementById('clsAddColorHex').textContent = '#25935F';
    document.getElementById('clsAddIsActive').checked = true;
    document.getElementById('clsAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('clsAddError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('clsAddModal')).show();
}

async function clsSubmitAdd() {
    var name = document.getElementById('clsAddName').value.trim();
    var errEl = document.getElementById('clsAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم التصنيف مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var duplicate = clsAll.find(function (c) { return c.name === name; });
    if (duplicate) {
        errEl.textContent = 'اسم التصنيف موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        name: name,
        description: document.getElementById('clsAddDescription').value.trim(),
        color: document.getElementById('clsAddColor').value,
        isActive: document.getElementById('clsAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddClassification', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('clsAddModal')).hide();
        showToast(r.message, 'success');
        await clsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

// ─── EDIT ─────────────────────────────────────────────────────────────────────
function clsShowEditModal(id) {
    var cls = clsAll.find(function (c) { return c.id === id; });
    if (!cls) return;

    document.getElementById('clsEditId').value = cls.id;
    document.getElementById('clsEditName').value = cls.name;
    document.getElementById('clsEditDescription').value = cls.description || '';
    document.getElementById('clsEditSortOrder').value = cls.sortOrder;
    document.getElementById('clsEditColor').value = cls.color;
    document.getElementById('clsEditColorHex').textContent = cls.color;
    document.getElementById('clsEditIsActive').checked = cls.isActive;
    document.getElementById('clsEditIsActiveLabel').textContent = cls.isActive ? 'مفعل' : 'معطل';
    document.getElementById('clsEditError').classList.add('d-none');

    var maxOrder = clsAll.length;
    document.getElementById('clsEditSortOrder').setAttribute('max', maxOrder);

    new bootstrap.Modal(document.getElementById('clsEditModal')).show();
}

async function clsSubmitEdit() {
    var id = parseInt(document.getElementById('clsEditId').value);
    var name = document.getElementById('clsEditName').value.trim();
    var errEl = document.getElementById('clsEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم التصنيف مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var duplicate = clsAll.find(function (c) { return c.name === name && c.id !== id; });
    if (duplicate) {
        errEl.textContent = 'اسم التصنيف موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('clsEditSortOrder').value);
    if (isNaN(sortOrder) || sortOrder < 1) {
        errEl.textContent = 'الترتيب يجب أن يبدأ من 1';
        errEl.classList.remove('d-none');
        return;
    }
    if (sortOrder > clsAll.length) {
        errEl.textContent = 'الترتيب لا يمكن أن يتجاوز ' + clsAll.length;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        id: id,
        name: name,
        description: document.getElementById('clsEditDescription').value.trim(),
        color: document.getElementById('clsEditColor').value,
        sortOrder: sortOrder,
        isActive: document.getElementById('clsEditIsActive').checked
    };

    var r = await apiFetch('/Settings/UpdateClassification', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('clsEditModal')).hide();
        showToast(r.message, 'success');
        await clsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

// ─── DETAILS ──────────────────────────────────────────────────────────────────
function clsShowDetails(id) {
    var cls = clsAll.find(function (c) { return c.id === id; });
    if (!cls) return;

    var statusClass = cls.isActive ? 'active' : 'inactive';
    var statusText = cls.isActive ? 'مفعل' : 'معطل';

    var html =
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">الترتيب</div>' +
            '<div class="cls-detail-value" style="font-weight:700;">' + esc(String(cls.sortOrder)) + '</div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">اسم التصنيف</div>' +
            '<div class="cls-detail-value" style="font-weight:700;">' + esc(cls.name) + '</div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">الوصف</div>' +
            '<div class="cls-detail-value">' + (cls.description ? esc(cls.description) : '<span style="color:var(--gray-400);">لا يوجد وصف</span>') + '</div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">اللون</div>' +
            '<div class="cls-detail-value"><span class="cls-color-circle" style="background:' + esc(cls.color) + ';margin-left:10px;"></span><span style="direction:ltr;font-size:13px;color:var(--gray-500);">' + esc(cls.color) + '</span></div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">التفعيل</div>' +
            '<div class="cls-detail-value"><span class="cls-status-pill ' + statusClass + '"><span class="cls-status-dot"></span>' + statusText + '</span></div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">أضيف بواسطة</div>' +
            '<div class="cls-detail-value">' + (cls.createdBy ? esc(cls.createdBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">تاريخ الإنشاء</div>' +
            '<div class="cls-detail-value">' + esc(cls.createdAt) + '</div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">آخر تعديل بواسطة</div>' +
            '<div class="cls-detail-value">' + (cls.updatedBy ? esc(cls.updatedBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="cls-detail-row">' +
            '<div class="cls-detail-label">تاريخ التعديل</div>' +
            '<div class="cls-detail-value">' + (cls.updatedAt ? esc(cls.updatedAt) : '<span style="color:var(--gray-400);">لم يتم التعديل بعد</span>') + '</div>' +
        '</div>';

    document.getElementById('clsDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('clsDetailsModal')).show();
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
function clsShowDeleteModal(id, name) {
    document.getElementById('clsDeleteId').value = id;
    document.getElementById('clsDeleteNameLabel').textContent = name;
    document.getElementById('clsDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('clsDeleteModal')).show();
}

async function clsSubmitDelete() {
    var id = parseInt(document.getElementById('clsDeleteId').value);
    var errEl = document.getElementById('clsDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteClassification', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('clsDeleteModal')).hide();
        showToast(r.message, 'success');
        await clsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
