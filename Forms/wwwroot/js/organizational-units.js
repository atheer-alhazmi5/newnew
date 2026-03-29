var ouAll = [];
var ouFiltered = [];
var ouClassifications = [];
var ouMainUnits = [];
var ouCurrentPage = 1;
var ouPerPage = 10;

document.addEventListener('DOMContentLoaded', function () {
    ouLoad();
    document.getElementById('ouAddIsActive').addEventListener('change', function () {
        document.getElementById('ouAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    document.getElementById('ouEditIsActive').addEventListener('change', function () {
        document.getElementById('ouEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function ouLoad() {
    try {
        var r = await apiFetch('/Settings/GetOrganizationalUnits');
        if (r && r.success) {
            ouAll = r.data;
            ouClassifications = r.classifications || [];
            ouMainUnits = r.mainUnits || [];
            ouFillClassificationFilter();
            ouFillClassificationDropdowns();
            ouFilter();
        } else {
            document.getElementById('ouBody').innerHTML =
                '<tr><td colspan="6">' + emptyState('bi-building', 'لا توجد وحدات', 'أضف وحدات تنظيمية للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('ouBody').innerHTML =
            '<tr><td colspan="6" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function ouFillClassificationFilter() {
    var sel = document.getElementById('ouFilterClassification');
    sel.innerHTML = '<option value="">التصنيف</option>';
    ouClassifications.forEach(function (c) {
        sel.innerHTML += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    });
}

function ouFillClassificationDropdowns() {
    var html = '';
    ouClassifications.forEach(function (c) {
        html += '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    });
    document.getElementById('ouAddClassificationId').innerHTML = html;
    document.getElementById('ouEditClassificationId').innerHTML = html;
}

function ouFillParentDropdowns(excludeId) {
    var html = '<option value="">بدون وحدة تنظيمية رئيسية</option>';
    ouMainUnits.forEach(function (u) {
        if (excludeId && u.id === excludeId) return;
        html += '<option value="' + u.id + '">' + esc(u.name) + '</option>';
    });
    document.getElementById('ouAddParentId').innerHTML = html;
    document.getElementById('ouEditParentId').innerHTML = html;
}

function ouFilter() {
    var q = (document.getElementById('ouSearchInput').value || '').trim().toLowerCase();
    var catId = document.getElementById('ouFilterClassification').value;
    var level = document.getElementById('ouFilterLevel').value;
    var status = document.getElementById('ouFilterStatus').value;

    ouFiltered = ouAll.filter(function (u) {
        if (q && !u.name.toLowerCase().includes(q)) return false;
        if (catId && String(u.classificationId) !== catId) return false;
        if (level && u.level !== level) return false;
        if (status !== '' && String(u.isActive ? 1 : 0) !== status) return false;
        return true;
    });
    ouCurrentPage = 1;
    ouRenderTable();
}

function ouRenderTable() {
    var body = document.getElementById('ouBody');
    if (ouFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="6">' +
            emptyState('bi-building', 'لا توجد وحدات', 'لم يتم العثور على نتائج') +
            '</td></tr>';
        document.getElementById('ouPaginationContainer').innerHTML = '';
        return;
    }

    var start = (ouCurrentPage - 1) * ouPerPage;
    var page = ouFiltered.slice(start, start + ouPerPage);
    var html = '';

    page.forEach(function (u, idx) {
        var statusClass = u.isActive ? 'active' : 'inactive';
        var statusText = u.isActive ? 'مفعل' : 'معطل';
        var levelColor = u.level === 'رئيسي' ? '#1570EF' : '#DC6803';
        var safeName = esc(u.name).replace(/'/g, "\\'");

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;font-size:15px;color:var(--gray-700);">' + (start + idx + 1) + '</td>' +
            '<td style="font-weight:700;font-size:14px;color:var(--gray-800);">' + esc(u.name) + '</td>' +
            '<td><span class="ou-badge" style="background:' + (u.classificationColor || '#25935F') + '22;color:' + (u.classificationColor || '#25935F') + ';"><span class="ou-badge-dot" style="background:' + (u.classificationColor || '#25935F') + ';"></span>' + esc(u.classificationName) + '</span></td>' +
            '<td><span class="ou-badge" style="background:' + levelColor + '22;color:' + levelColor + ';"><span class="ou-badge-dot" style="background:' + levelColor + ';"></span>' + esc(u.level) + '</span></td>' +
            '<td><span class="ou-status-pill ' + statusClass + '"><span class="ou-badge-dot" style="background:' + (u.isActive ? '#0f9f5c' : '#ef4444') + ';"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="ou-action-btn ou-action-btn-detail" onclick="ouShowDetails(' + u.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="ou-action-btn ou-action-btn-edit" onclick="ouShowEditModal(' + u.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="ou-action-btn ou-action-btn-delete" onclick="ouShowDeleteModal(' + u.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    body.innerHTML = html;
    renderPagination(document.getElementById('ouPaginationContainer'), ouFiltered.length, ouCurrentPage, ouPerPage, 'ouGoToPage');
}

function ouGoToPage(p) {
    ouCurrentPage = p;
    ouRenderTable();
}

function ouToggleParentField() {
    var level = document.getElementById('ouAddLevel').value;
    var wrap = document.getElementById('ouAddParentWrap');
    wrap.style.display = level === 'فرعي' ? 'block' : 'none';
    if (level === 'فرعي') ouFillParentDropdowns();
}

function ouToggleParentFieldEdit() {
    var level = document.getElementById('ouEditLevel').value;
    var wrap = document.getElementById('ouEditParentWrap');
    wrap.style.display = level === 'فرعي' ? 'block' : 'none';
    if (level === 'فرعي') ouFillParentDropdowns();
}

function ouShowAddModal() {
    document.getElementById('ouAddName').value = '';
    document.getElementById('ouAddClassificationId').selectedIndex = ouClassifications.length > 0 ? 0 : -1;
    document.getElementById('ouAddLevel').value = 'رئيسي';
    document.getElementById('ouAddParentWrap').style.display = 'none';
    document.getElementById('ouAddIsActive').checked = true;
    document.getElementById('ouAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('ouAddError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('ouAddModal')).show();
}

async function ouSubmitAdd() {
    var name = document.getElementById('ouAddName').value.trim();
    var errEl = document.getElementById('ouAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الوحدة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var dupAdd = ouAll.find(function (u) { return (u.name || '').trim() === name; });
    if (dupAdd) {
        errEl.textContent = 'اسم الوحدة موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var classificationId = parseInt(document.getElementById('ouAddClassificationId').value);
    if (!classificationId && ouClassifications.length > 0) {
        errEl.textContent = 'اختر التصنيف';
        errEl.classList.remove('d-none');
        return;
    }

    var level = document.getElementById('ouAddLevel').value;
    var parentId = level === 'فرعي' ? (parseInt(document.getElementById('ouAddParentId').value) || null) : null;

    var body = {
        name: name,
        classificationId: classificationId,
        level: level,
        parentId: parentId,
        isActive: document.getElementById('ouAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddOrganizationalUnit', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ouAddModal')).hide();
        showToast(r.message, 'success');
        await ouLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function ouShowEditModal(id) {
    var u = ouAll.find(function (x) { return x.id === id; });
    if (!u) return;

    document.getElementById('ouEditId').value = u.id;
    document.getElementById('ouEditName').value = u.name;
    document.getElementById('ouEditClassificationId').value = u.classificationId;
    document.getElementById('ouEditLevel').value = u.level;
    document.getElementById('ouEditParentWrap').style.display = u.level === 'فرعي' ? 'block' : 'none';
    if (u.level === 'فرعي') {
        ouFillParentDropdowns(u.id);
        document.getElementById('ouEditParentId').value = u.parentId || '';
    }
    document.getElementById('ouEditSortOrder').value = u.sortOrder;
    document.getElementById('ouEditSortOrder').setAttribute('max', ouAll.length);
    document.getElementById('ouEditIsActive').checked = u.isActive;
    document.getElementById('ouEditIsActiveLabel').textContent = u.isActive ? 'مفعل' : 'معطل';
    document.getElementById('ouEditError').classList.add('d-none');

    new bootstrap.Modal(document.getElementById('ouEditModal')).show();
}

async function ouSubmitEdit() {
    var id = parseInt(document.getElementById('ouEditId').value);
    var name = document.getElementById('ouEditName').value.trim();
    var errEl = document.getElementById('ouEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الوحدة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var dupEdit = ouAll.find(function (u) { return (u.name || '').trim() === name && u.id !== id; });
    if (dupEdit) {
        errEl.textContent = 'اسم الوحدة موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('ouEditSortOrder').value);
    if (isNaN(sortOrder) || sortOrder < 1) {
        errEl.textContent = 'الترتيب يجب أن يبدأ من 1';
        errEl.classList.remove('d-none');
        return;
    }

    var level = document.getElementById('ouEditLevel').value;
    var parentId = level === 'فرعي' ? (parseInt(document.getElementById('ouEditParentId').value) || null) : null;

    var body = {
        id: id,
        name: name,
        classificationId: parseInt(document.getElementById('ouEditClassificationId').value),
        level: level,
        parentId: parentId,
        isActive: document.getElementById('ouEditIsActive').checked,
        sortOrder: sortOrder
    };

    var r = await apiFetch('/Settings/UpdateOrganizationalUnit', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ouEditModal')).hide();
        showToast(r.message, 'success');
        await ouLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function ouShowDetails(id) {
    var u = ouAll.find(function (x) { return x.id === id; });
    if (!u) return;

    var statusClass = u.isActive ? 'active' : 'inactive';
    var statusText = u.isActive ? 'مفعل' : 'معطل';

    var html =
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">اسم الوحدة</div>' +
            '<div class="ou-detail-value" style="font-weight:700;">' + esc(u.name) + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">التصنيف</div>' +
            '<div class="ou-detail-value"><span class="ou-badge" style="background:' + (u.classificationColor || '#25935F') + '22;color:' + (u.classificationColor || '#25935F') + ';"><span class="ou-badge-dot" style="background:' + (u.classificationColor || '#25935F') + ';"></span>' + esc(u.classificationName) + '</span></div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">المستوى</div>' +
            '<div class="ou-detail-value">' + esc(u.level) + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">الوحدة التنظيمية الرئيسية</div>' +
            '<div class="ou-detail-value">' + (u.parentName ? esc(u.parentName) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">الحالة</div>' +
            '<div class="ou-detail-value"><span class="ou-status-pill ' + statusClass + '"><span class="ou-badge-dot" style="background:' + (u.isActive ? '#0f9f5c' : '#ef4444') + ';"></span>' + statusText + '</span></div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">الترتيب</div>' +
            '<div class="ou-detail-value">' + esc(String(u.sortOrder)) + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">أضيف بواسطة</div>' +
            '<div class="ou-detail-value">' + (u.createdBy ? esc(u.createdBy) : 'مدير النظام') + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">تاريخ الإنشاء</div>' +
            '<div class="ou-detail-value">' + esc(u.createdAt) + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">آخر تعديل بواسطة</div>' +
            '<div class="ou-detail-value">' + (u.updatedBy ? esc(u.updatedBy) : '<span style="color:var(--gray-400);">—</span>') + '</div>' +
        '</div>' +
        '<div class="ou-detail-row">' +
            '<div class="ou-detail-label">تاريخ التعديل</div>' +
            '<div class="ou-detail-value">' + (u.updatedAt ? esc(u.updatedAt) : '<span style="color:var(--gray-400);">لم يتم التعديل بعد</span>') + '</div>' +
        '</div>';

    document.getElementById('ouDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('ouDetailsModal')).show();
}

function ouShowDeleteModal(id, name) {
    document.getElementById('ouDeleteId').value = id;
    document.getElementById('ouDeleteNameLabel').textContent = name;
    document.getElementById('ouDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('ouDeleteModal')).show();
}

async function ouSubmitDelete() {
    var id = parseInt(document.getElementById('ouDeleteId').value);
    var errEl = document.getElementById('ouDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteOrganizationalUnit', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ouDeleteModal')).hide();
        showToast(r.message, 'success');
        await ouLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
