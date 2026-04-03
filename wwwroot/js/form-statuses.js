let fstAll = [];
let fstFiltered = [];
let fstCurrentPage = 1;
const fstPerPage = 10;

function fstGetCategory(s) {
    if (!s) return 'مفتوح';
    return s.statusCategory || s.StatusCategory || 'مفتوح';
}

function fstCategoryHtml(category) {
    if ((category || '') === 'مغلق') {
        return '<span style="color:#b91c1c;font-weight:800;">مغلق</span>';
    }
    return '<span style="color:#15803d;font-weight:800;">مفتوح</span>';
}

document.addEventListener('DOMContentLoaded', function () {
    fstLoad();

    document.getElementById('fstAddIsActive').addEventListener('change', function () {
        document.getElementById('fstAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    document.getElementById('fstEditIsActive').addEventListener('change', function () {
        document.getElementById('fstEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function fstLoad() {
    try {
        var r = await apiFetch('/Settings/GetFormStatuses');
        if (r && r.success) {
            fstAll = r.data;
            fstFilter();
        } else {
            document.getElementById('fstBody').innerHTML =
                '<tr><td colspan="7">' + emptyState('bi-flag', 'لا توجد حالات', 'أضف حالات جديدة للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('fstBody').innerHTML =
            '<tr><td colspan="7" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function fstFilter() {
    var q = (document.getElementById('fstSearchInput').value || '').trim().toLowerCase();
    fstFiltered = q
        ? fstAll.filter(function (s) { return ((s.name || s.Name || '')).toLowerCase().includes(q); })
        : [].concat(fstAll);
    fstCurrentPage = 1;
    fstRenderTable();
}

function fstRenderTable() {
    var body = document.getElementById('fstBody');
    if (fstFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' +
            emptyState('bi-flag', 'لا توجد حالات', 'لم يتم العثور على نتائج') +
            '</td></tr>';
        document.getElementById('fstPaginationContainer').innerHTML = '';
        return;
    }

    var start = (fstCurrentPage - 1) * fstPerPage;
    var page = fstFiltered.slice(start, start + fstPerPage);
    var html = '';

    page.forEach(function (s) {
        var sid = s.id != null ? s.id : s.Id;
        var nm = s.name || s.Name || '';
        var desc = s.description || s.Description || '';
        var col = s.color || s.Color || '#25935F';
        var ord = s.sortOrder != null ? s.sortOrder : s.SortOrder;
        var active = s.isActive !== undefined ? s.isActive : s.IsActive;
        statusClass = active ? 'active' : 'inactive';
        statusText = active ? 'مفعل' : 'معطل';
        var safeName = esc(nm).replace(/'/g, "\\'");

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;font-size:15px;color:var(--gray-700);">' + esc(String(ord)) + '</td>' +
            '<td style="text-align:center;">' + fstCategoryHtml(fstGetCategory(s)) + '</td>' +
            '<td style="font-weight:700;font-size:14px;color:var(--gray-800);">' + esc(nm) + '</td>' +
            '<td style="text-align:center;">' +
                '<div style="display:inline-flex;align-items:center;gap:8px;">' +
                    '<span class="fst-color-circle" style="background:' + esc(col) + ';"></span>' +
                    '<span style="direction:ltr;font-size:12px;color:var(--gray-500);font-weight:600;">' + esc(col) + '</span>' +
                '</div>' +
            '</td>' +
            '<td style="color:var(--gray-500);font-size:13px;max-width:220px;">' + (desc ? esc(desc) : '<span style="color:var(--gray-300);">—</span>') + '</td>' +
            '<td style="text-align:center;"><span class="fst-status-pill ' + statusClass + '"><span class="fst-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;">' +
                    '<button type="button" class="fst-btn-table-update" onclick="fstShowEditModal(' + sid + ')">تحديث</button>' +
                    '<button type="button" class="fst-btn-table-delete" onclick="fstShowDeleteModal(' + sid + ',\'' + safeName + '\')">حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    body.innerHTML = html;
    renderPagination(
        document.getElementById('fstPaginationContainer'),
        fstFiltered.length, fstCurrentPage, fstPerPage, 'fstGoToPage'
    );
}

function fstGoToPage(p) {
    fstCurrentPage = p;
    fstRenderTable();
}

function fstShowAddModal() {
    document.getElementById('fstAddCatOpen').checked = true;
    document.getElementById('fstAddName').value = '';
    document.getElementById('fstAddDescription').value = '';
    document.getElementById('fstAddColor').value = '#25935F';
    document.getElementById('fstAddColorHex').textContent = '#25935F';
    document.getElementById('fstAddIsActive').checked = true;
    document.getElementById('fstAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('fstAddError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('fstAddModal')).show();
}

async function fstSubmitAdd() {
    var name = document.getElementById('fstAddName').value.trim();
    var errEl = document.getElementById('fstAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الحالة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var catRadio = document.querySelector('input[name="fstAddCategory"]:checked');
    var statusCategory = catRadio ? catRadio.value : 'مفتوح';

    var duplicate = fstAll.find(function (s) { return ((s.name || s.Name || '')).trim() === name; });
    if (duplicate) {
        errEl.textContent = 'اسم الحالة موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        statusCategory: statusCategory,
        name: name,
        description: document.getElementById('fstAddDescription').value.trim(),
        color: document.getElementById('fstAddColor').value,
        isActive: document.getElementById('fstAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddFormStatus', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fstAddModal')).hide();
        showToast(r.message, 'success');
        await fstLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function fstShowEditModal(id) {
    var row = fstAll.find(function (s) { return (s.id === id || s.Id === id); });
    if (!row) return;

    document.getElementById('fstEditId').value = row.id != null ? row.id : row.Id;
    if ((fstGetCategory(row) || '') === 'مغلق') {
        document.getElementById('fstEditCatClosed').checked = true;
    } else {
        document.getElementById('fstEditCatOpen').checked = true;
    }
    document.getElementById('fstEditName').value = row.name || row.Name || '';
    document.getElementById('fstEditDescription').value = row.description || row.Description || '';
    document.getElementById('fstEditSortOrder').value = row.sortOrder != null ? row.sortOrder : row.SortOrder;
    var ecol = row.color || row.Color || '#25935F';
    document.getElementById('fstEditColor').value = ecol;
    document.getElementById('fstEditColorHex').textContent = ecol;
    var eactive = row.isActive !== undefined ? row.isActive : row.IsActive;
    document.getElementById('fstEditIsActive').checked = !!eactive;
    document.getElementById('fstEditIsActiveLabel').textContent = eactive ? 'مفعل' : 'معطل';
    document.getElementById('fstEditError').classList.add('d-none');
    document.getElementById('fstEditSortOrder').setAttribute('max', fstAll.length);

    new bootstrap.Modal(document.getElementById('fstEditModal')).show();
}

async function fstSubmitEdit() {
    var id = parseInt(document.getElementById('fstEditId').value);
    var name = document.getElementById('fstEditName').value.trim();
    var errEl = document.getElementById('fstEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم الحالة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var catRadio = document.querySelector('input[name="fstEditCategory"]:checked');
    var statusCategory = catRadio ? catRadio.value : 'مفتوح';

    var duplicate = fstAll.find(function (s) {
        var sid = s.id != null ? s.id : s.Id;
        return ((s.name || s.Name || '')).trim() === name && sid !== id;
    });
    if (duplicate) {
        errEl.textContent = 'اسم الحالة موجود مسبقاً، لا يمكن تكرار الاسم';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('fstEditSortOrder').value);
    if (isNaN(sortOrder) || sortOrder < 1) {
        errEl.textContent = 'الترتيب يجب أن يبدأ من 1';
        errEl.classList.remove('d-none');
        return;
    }
    if (sortOrder > fstAll.length) {
        errEl.textContent = 'الترتيب لا يمكن أن يتجاوز ' + fstAll.length;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        id: id,
        statusCategory: statusCategory,
        name: name,
        description: document.getElementById('fstEditDescription').value.trim(),
        color: document.getElementById('fstEditColor').value,
        sortOrder: sortOrder,
        isActive: document.getElementById('fstEditIsActive').checked
    };

    var r = await apiFetch('/Settings/UpdateFormStatus', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fstEditModal')).hide();
        showToast(r.message, 'success');
        await fstLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function fstShowDeleteModal(id, name) {
    document.getElementById('fstDeleteId').value = id;
    document.getElementById('fstDeleteNameLabel').textContent = name;
    document.getElementById('fstDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('fstDeleteModal')).show();
}

async function fstSubmitDelete() {
    var id = parseInt(document.getElementById('fstDeleteId').value);
    var errEl = document.getElementById('fstDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteFormStatus', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('fstDeleteModal')).hide();
        showToast(r.message, 'success');
        await fstLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
