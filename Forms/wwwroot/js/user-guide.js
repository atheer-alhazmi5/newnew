'use strict';
/**
 * دليل المستخدم — إدارة قوائم/صفحات شجرية (جذر + أبناء).
 * يطابق أسلوب أنواع الإجراءات (pat-*) في الـ Saudi Enterprise Style.
 */

let ugAll = [];
let ugTree = [];
let ugFiltered = [];
let ugCurrentPage = 1;
let ugEditingId = null;
const ugPerPage = 10;

function ugEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ugIsIconImage(icon) {
    if (!icon) return false;
    var s = String(icon).trim();
    return s.indexOf('data:image') === 0 || s.indexOf('http://') === 0 || s.indexOf('https://') === 0 || s.indexOf('/') === 0;
}

function ugIconCellHtml(icon, color) {
    color = color || '#25935F';
    if (ugIsIconImage(icon)) {
        return '<span class="ug-icon-display" style="background:' + color + '11;"><img src="' + icon + '" alt="أيقونة"></span>';
    }
    if (!icon) {
        return '<span class="ug-icon-display" style="background:var(--gray-100);color:var(--gray-400);"><i class="bi bi-image"></i></span>';
    }
    var iconCls = icon || 'bi-journal-text';
    return '<span class="ug-icon-display" style="background:' + color + '22;color:' + color + ';"><i class="bi ' + iconCls + '"></i></span>';
}

function ugExcludedIdsForParentPicker(editItemId) {
    if (!editItemId) return {};
    var byParent = {};
    ugTree.forEach(function (item) {
        var pid = item.parentId != null ? item.parentId : item.ParentId;
        var key = (pid != null && pid !== '') ? String(pid) : '';
        if (!byParent[key]) byParent[key] = [];
        byParent[key].push(item.id != null ? item.id : item.Id);
    });
    var ex = {};
    function walk(id) {
        ex[id] = true;
        (byParent[String(id)] || []).forEach(walk);
    }
    walk(editItemId);
    return ex;
}

function ugFillParentSelect(selectId, currentValue, excludeId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var exclude = ugExcludedIdsForParentPicker(excludeId);
    var allowed = ugTree.filter(function (item) {
        var id = item.id != null ? item.id : item.Id;
        return !exclude[id];
    });
    var allowedIds = {};
    allowed.forEach(function (item) {
        allowedIds[item.id != null ? item.id : item.Id] = true;
    });

    var childrenOf = {};
    function addChild(key, node) {
        if (!childrenOf[key]) childrenOf[key] = [];
        childrenOf[key].push(node);
    }
    allowed.forEach(function (item) {
        var id = item.id != null ? item.id : item.Id;
        var pid = item.parentId != null ? item.parentId : item.ParentId;
        if (pid && allowedIds[pid]) addChild(String(pid), item);
        else addChild('__root__', item);
    });

    function sortItems(arr) {
        return arr.slice().sort(function (a, b) {
            var sa = a.sortOrder != null ? a.sortOrder : (a.SortOrder != null ? a.SortOrder : 0);
            var sb = b.sortOrder != null ? b.sortOrder : (b.SortOrder != null ? b.SortOrder : 0);
            if (sa !== sb) return sa - sb;
            return String(a.name || a.Name || '').localeCompare(String(b.name || b.Name || ''), 'ar');
        });
    }

    var prev = currentValue != null && currentValue !== '' ? String(currentValue) : sel.value;
    var parts = ['<option value="">— رئيسية (بدون أب في الشجرة) —</option>'];

    function walk(nodes, depth) {
        sortItems(nodes || []).forEach(function (item) {
            var id = item.id != null ? item.id : item.Id;
            var prefix = '';
            if (depth > 0) {
                prefix = '\u200f' + '\u00A0\u00A0'.repeat(depth) + '\u2514\u00A0';
            }
            parts.push('<option value="' + id + '"' + (String(prev) === String(id) ? ' selected' : '') + '>' + prefix + ugEsc(item.name || item.Name || '') + '</option>');
            walk(childrenOf[String(id)], depth + 1);
        });
    }

    walk(childrenOf['__root__'], 0);
    sel.innerHTML = parts.join('');
    if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === String(prev); }))
        sel.value = String(prev);
}

function ugBindIconInput(prefix) {
    var input = document.getElementById('ug' + prefix + 'IconInput');
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 4 * 1024 * 1024) {
            showToast('حجم صورة الأيقونة يجب ألا يتجاوز 4 ميغابايت', 'danger');
            input.value = '';
            return;
        }
        var r = new FileReader();
        r.onload = function () {
            document.getElementById('ug' + prefix + 'Icon').value = r.result;
            ugRenderIconPreview(prefix, r.result);
        };
        r.readAsDataURL(f);
    });
}

function ugRenderIconPreview(prefix, dataUrl) {
    var prev = document.getElementById('ug' + prefix + 'IconPreview');
    var clr = document.getElementById('ug' + prefix + 'IconClear');
    if (!prev) return;
    if (dataUrl && dataUrl.length > 8) {
        prev.innerHTML = '<img src="' + dataUrl + '" alt="أيقونة">';
        if (clr) clr.classList.remove('d-none');
    } else {
        prev.innerHTML = '<i class="bi bi-image" style="font-size:28px;"></i>';
        if (clr) clr.classList.add('d-none');
    }
}

function ugClearIcon(prefix) {
    document.getElementById('ug' + prefix + 'Icon').value = '';
    document.getElementById('ug' + prefix + 'IconInput').value = '';
    ugRenderIconPreview(prefix, '');
}

function ugBindAttachInput(prefix) {
    var input = document.getElementById('ug' + prefix + 'AttachInput');
    if (!input || input._bound) return;
    input._bound = true;
    input.addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        if (f.size > 4 * 1024 * 1024) {
            showToast('حجم الصورة يجب ألا يتجاوز 4 ميغابايت', 'danger');
            input.value = '';
            return;
        }
        var r = new FileReader();
        r.onload = function () {
            document.getElementById('ug' + prefix + 'AttachData').value = r.result;
            ugRenderAttachPreview(prefix, r.result);
        };
        r.readAsDataURL(f);
    });
}

function ugRenderAttachPreview(prefix, dataUrl) {
    var prev = document.getElementById('ug' + prefix + 'AttachPreview');
    var clr = document.getElementById('ug' + prefix + 'AttachClear');
    if (!prev) return;
    if (dataUrl && dataUrl.length > 8) {
        prev.innerHTML = '<img src="' + dataUrl + '" alt="مرفق">';
        if (clr) clr.classList.remove('d-none');
    } else {
        prev.innerHTML = '<i class="bi bi-image" style="font-size:28px;"></i>';
        if (clr) clr.classList.add('d-none');
    }
}

function ugClearAttach(prefix) {
    document.getElementById('ug' + prefix + 'AttachData').value = '';
    document.getElementById('ug' + prefix + 'AttachInput').value = '';
    ugRenderAttachPreview(prefix, '');
}

document.addEventListener('DOMContentLoaded', function () {
    ugLoad();
    ugBindIconInput('Add');
    ugBindIconInput('Edit');
    ugBindAttachInput('Add');
    ugBindAttachInput('Edit');

    var addCb = document.getElementById('ugAddIsActive');
    if (addCb) addCb.addEventListener('change', function () {
        document.getElementById('ugAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
    var editCb = document.getElementById('ugEditIsActive');
    if (editCb) editCb.addEventListener('change', function () {
        document.getElementById('ugEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'معطل';
    });
});

async function ugLoad() {
    try {
        var r = await apiFetch('/Settings/GetUserGuideItems');
        if (r && r.success) {
            ugAll = r.data || [];
            ugTree = r.tree || ugAll.map(function (x) {
                return { id: x.id, parentId: x.parentId, name: x.name, sortOrder: x.sortOrder };
            });
            ugApplyFilter();
        } else {
            document.getElementById('ugBody').innerHTML =
                '<tr><td colspan="7">' + (typeof emptyState === 'function' ? emptyState('bi-journal-text', 'لا توجد عناصر', 'أضف قائمة أو صفحة للبدء') : '<div class="text-center text-muted py-4">لا توجد بيانات</div>') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('ugBody').innerHTML =
            '<tr><td colspan="7" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function ugApplyFilter() {
    var input = document.getElementById('ugSearchInput');
    var actSel = document.getElementById('ugActiveFilter');
    var q = (input && input.value || '').trim().toLowerCase();
    var act = actSel ? actSel.value : '';

    ugFiltered = ugAll.filter(function (c) {
        if (q && (c.name || '').toLowerCase().indexOf(q) === -1) return false;
        if (act === '1' && !c.isActive) return false;
        if (act === '0' && c.isActive) return false;
        return true;
    });
    ugCurrentPage = 1;
    ugRenderTable();
}

function ugClearFilters() {
    var inp = document.getElementById('ugSearchInput'); if (inp) inp.value = '';
    var sel = document.getElementById('ugActiveFilter'); if (sel) sel.value = '';
    ugApplyFilter();
}

function ugRenderTable() {
    var body = document.getElementById('ugBody');
    if (!body) return;
    if (ugFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="7">' +
            (typeof emptyState === 'function' ? emptyState('bi-journal-text', 'لا توجد عناصر', 'لم يتم العثور على نتائج') : '<div class="text-center text-muted py-4">لا توجد نتائج</div>') +
            '</td></tr>';
        var pg = document.getElementById('ugPaginationContainer');
        if (pg) pg.innerHTML = '';
        return;
    }

    var start = (ugCurrentPage - 1) * ugPerPage;
    var page = ugFiltered.slice(start, start + ugPerPage);
    var html = '';

    page.forEach(function (c) {
        var statusClass = c.isActive ? 'active' : 'inactive';
        var statusText = c.isActive ? 'مفعل' : 'معطل';
        var color = c.color || '#25935F';
        var orderPillCls = 'ug-order-pill' + (c.isRoot ? ' is-root' : '');
        var depth = c.depth != null ? c.depth : (c.Depth != null ? c.Depth : 0);
        var indent = depth > 0
            ? '<span class="child-indent">' + '\u00A0\u00A0'.repeat(Math.min(depth, 6)) + '<i class="bi bi-arrow-return-left"></i></span>'
            : '';
        var branchTag = c.isRoot
            ? '<span class="branch-tag" style="background:var(--sa-50);color:var(--sa-700);border-color:var(--sa-100);">جذر</span>'
            : '<span class="branch-tag">مستوى ' + (depth + 1) + '</span>';
        var parentCell = c.isRoot
            ? '<span class="ug-parent-cell"><span class="root-tag"><i class="bi bi-bookmark-star-fill"></i> رئيسية</span></span>'
            : '<span class="ug-parent-cell">' + ugEsc(c.parentPath || c.parentName || '—') + '</span>';

        html += '<tr>'
            + '<td class="text-center"><span class="' + orderPillCls + '">' + ugEsc(c.displayOrder || String(c.sortOrder)) + '</span></td>'
            + '<td class="text-center">' + ugIconCellHtml(c.icon, color) + '</td>'
            + '<td><span class="ug-row-name">' + indent + '<span style="font-weight:700;color:var(--gray-900);">' + ugEsc(c.name) + '</span>' + branchTag + '</span></td>'
            + '<td>' + parentCell + '</td>'
            + '<td class="text-center"><span class="ug-color-circle" style="background:' + color + '"></span></td>'
            + '<td class="text-center">'
            +   '<span class="ug-status-pill ' + statusClass + '" onclick="ugToggle(' + c.id + ')" style="cursor:pointer;">'
            +     '<span class="ug-status-dot"></span>' + statusText + '</span>'
            + '</td>'
            + '<td class="text-center">'
            +   '<button class="ug-action-btn ug-action-btn-detail" onclick="ugShowDetails(' + c.id + ')"><i class="bi bi-eye"></i> تفاصيل</button> '
            +   '<button class="ug-action-btn ug-action-btn-edit" onclick="ugShowEdit(' + c.id + ')"><i class="bi bi-pencil"></i> تحديث</button> '
            +   '<button class="ug-action-btn ug-action-btn-delete" onclick="ugAskDelete(' + c.id + ')"><i class="bi bi-trash3"></i> حذف</button>'
            + '</td>'
            + '</tr>';
    });

    body.innerHTML = html;

    if (typeof renderPagination === 'function') {
        renderPagination(document.getElementById('ugPaginationContainer'), ugFiltered.length, ugCurrentPage, ugPerPage, 'ugChangePage');
    }
}

function ugChangePage(p) { ugCurrentPage = p; ugRenderTable(); }

// ─── ADD ────────────────────────────────────────────────────────────────────
function ugShowAddModal() {
    ugEditingId = null;
    document.getElementById('ugAddName').value = '';
    document.getElementById('ugAddContent').value = '';
    document.getElementById('ugAddNotes').value = '';
    ugClearIcon('Add');
    document.getElementById('ugAddColor').value = '#25935F';
    document.getElementById('ugAddColorHex').textContent = '#25935F';
    document.getElementById('ugAddIsActive').checked = true;
    document.getElementById('ugAddIsActiveLabel').textContent = 'مفعل';
    ugClearAttach('Add');
    ugFillParentSelect('ugAddParent', '', null);
    document.getElementById('ugAddError').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ugAddModal')).show();
}

async function ugSubmitAdd() {
    var name = (document.getElementById('ugAddName').value || '').trim();
    if (!name) { ugShowError('Add', 'اسم القائمة/الصفحة مطلوب'); return; }
    var content = (document.getElementById('ugAddContent').value || '').trim();
    if (!content) { ugShowError('Add', 'المحتوى مطلوب'); return; }
    var icon = (document.getElementById('ugAddIcon').value || '').trim();
    var parentRaw = document.getElementById('ugAddParent').value;
    var parentId = parentRaw ? parseInt(parentRaw, 10) : null;

    var payload = {
        parentId: parentId,
        name: name,
        content: content,
        attachmentUrl: document.getElementById('ugAddAttachData').value || '',
        icon: icon,
        color: document.getElementById('ugAddColor').value || '#25935F',
        notes: document.getElementById('ugAddNotes').value || '',
        isActive: !!document.getElementById('ugAddIsActive').checked
    };

    var r = await apiFetch('/Settings/AddUserGuideItem', 'POST', payload);
    if (!r || !r.success) { ugShowError('Add', (r && r.message) || 'تعذّر الحفظ'); return; }
    showToast(r.message || 'تمت الإضافة', 'success');
    bootstrap.Modal.getInstance(document.getElementById('ugAddModal')).hide();
    ugLoad();
}

// ─── EDIT ───────────────────────────────────────────────────────────────────
async function ugShowEdit(id) {
    ugEditingId = id;
    var r = await apiFetch('/Settings/GetUserGuideItemDetails?id=' + encodeURIComponent(id));
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر التحميل', 'danger'); return; }
    var d = r.data || {};
    document.getElementById('ugEditId').value = d.id;
    document.getElementById('ugEditName').value = d.name || '';
    document.getElementById('ugEditContent').value = d.content || '';
    document.getElementById('ugEditNotes').value = d.notes || '';
    document.getElementById('ugEditIcon').value = d.icon || '';
    ugRenderIconPreview('Edit', d.icon || '');
    var color = d.color || '#25935F';
    document.getElementById('ugEditColor').value = color;
    document.getElementById('ugEditColorHex').textContent = color;
    document.getElementById('ugEditIsActive').checked = !!d.isActive;
    document.getElementById('ugEditIsActiveLabel').textContent = d.isActive ? 'مفعل' : 'معطل';
    document.getElementById('ugEditAttachData').value = d.attachmentUrl || '';
    ugRenderAttachPreview('Edit', d.attachmentUrl || '');
    ugFillParentSelect('ugEditParent', d.parentId || '', d.id);
    document.getElementById('ugEditError').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ugEditModal')).show();
}

async function ugSubmitEdit() {
    var id = parseInt(document.getElementById('ugEditId').value, 10);
    var name = (document.getElementById('ugEditName').value || '').trim();
    if (!name) { ugShowError('Edit', 'اسم القائمة/الصفحة مطلوب'); return; }
    var content = (document.getElementById('ugEditContent').value || '').trim();
    if (!content) { ugShowError('Edit', 'المحتوى مطلوب'); return; }
    var icon = (document.getElementById('ugEditIcon').value || '').trim();
    var parentRaw = document.getElementById('ugEditParent').value;
    var parentId = parentRaw ? parseInt(parentRaw, 10) : null;

    var payload = {
        id: id,
        parentId: parentId,
        name: name,
        content: content,
        attachmentUrl: document.getElementById('ugEditAttachData').value || '',
        icon: icon,
        color: document.getElementById('ugEditColor').value || '#25935F',
        notes: document.getElementById('ugEditNotes').value || '',
        isActive: !!document.getElementById('ugEditIsActive').checked
    };

    var r = await apiFetch('/Settings/UpdateUserGuideItem', 'POST', payload);
    if (!r || !r.success) { ugShowError('Edit', (r && r.message) || 'تعذّر التحديث'); return; }
    showToast(r.message || 'تم التحديث', 'success');
    bootstrap.Modal.getInstance(document.getElementById('ugEditModal')).hide();
    ugLoad();
}

// ─── DETAILS ────────────────────────────────────────────────────────────────
async function ugShowDetails(id) {
    var r = await apiFetch('/Settings/GetUserGuideItemDetails?id=' + encodeURIComponent(id));
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر التحميل', 'danger'); return; }
    var d = r.data || {};
    var color = d.color || '#25935F';
    var iconHeader = ugIsIconImage(d.icon)
        ? '<span class="ug-icon-display" style="width:48px;height:48px;border-radius:12px;background:' + color + '11;"><img src="' + d.icon + '" alt="أيقونة"></span>'
        : (d.icon
            ? '<span class="ug-icon-display" style="width:48px;height:48px;border-radius:12px;background:' + color + '22;color:' + color + ';font-size:22px;"><i class="bi ' + d.icon + '"></i></span>'
            : '<span class="ug-icon-display" style="width:48px;height:48px;border-radius:12px;background:var(--gray-100);color:var(--gray-400);font-size:22px;"><i class="bi bi-image"></i></span>');
    var statusBadge = d.isActive
        ? '<span class="ug-status-pill active"><span class="ug-status-dot"></span>مفعل</span>'
        : '<span class="ug-status-pill inactive"><span class="ug-status-dot"></span>معطل</span>';
    var attach = d.attachmentUrl
        ? '<div style="margin-top:6px;"><img src="' + d.attachmentUrl + '" alt="مرفق" style="max-width:240px;max-height:160px;border-radius:10px;border:1px solid var(--gray-200);"></div>'
        : '<span style="color:var(--gray-400);">لا يوجد</span>';

    document.getElementById('ugDetailsBody').innerHTML =
        '<div class="d-flex align-items-center gap-3 mb-3" style="padding:12px 14px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:12px;">'
        + iconHeader
        + '<div><div style="font-weight:800;font-size:16px;color:var(--gray-900);">' + ugEsc(d.name || '') + '</div>'
        +   '<div style="font-size:12px;color:var(--gray-500);">' + (d.isRoot ? 'قائمة رئيسية (جذر)' : 'تابع لـ: <strong>' + ugEsc(d.parentPath || d.parentName || '—') + '</strong>') + '</div></div>'
        + '<div style="margin-inline-start:auto;">' + statusBadge + '</div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:160px 1fr;gap:10px 14px;font-size:13.5px;">'
        +   '<div style="font-weight:700;color:var(--gray-500);">الترتيب</div><div>' + ugEsc(String(d.sortOrder || 1)) + '</div>'
        +   '<div style="font-weight:700;color:var(--gray-500);">الأيقونة</div><div>' + (ugIsIconImage(d.icon) ? '<img src="' + d.icon + '" alt="أيقونة" style="max-width:80px;max-height:80px;border-radius:10px;border:1px solid var(--gray-200);">' : '<span style="color:var(--gray-400);">—</span>') + '</div>'
        +   '<div style="font-weight:700;color:var(--gray-500);">اللون</div><div><span class="ug-color-circle" style="background:' + color + '"></span> <span style="font-family:monospace;direction:ltr;display:inline-block;margin-inline-start:6px;">' + ugEsc(color) + '</span></div>'
        +   '<div style="font-weight:700;color:var(--gray-500);">المرفق</div><div>' + attach + '</div>'
        +   '<div style="font-weight:700;color:var(--gray-500);">المحتوى</div><div>' + (d.content ? ugEsc(d.content) : '<span style="color:var(--gray-400);">—</span>') + '</div>'
        +   '<div style="font-weight:700;color:var(--gray-500);">الملاحظات</div><div>' + (d.notes ? '<div class="ug-content-pre" style="background:var(--info-50);border-color:var(--info-100);">' + ugEsc(d.notes) + '</div>' : '<span style="color:var(--gray-400);">—</span>') + '</div>'
        +   '<div style="font-weight:700;color:var(--gray-500);">أنشئ بواسطة</div><div>' + ugEsc(d.createdBy || '—') + ' <span style="color:var(--gray-400);font-size:11.5px;">— ' + ugEsc(d.createdAt || '') + '</span></div>'
        + (d.updatedAt ? '<div style="font-weight:700;color:var(--gray-500);">آخر تعديل</div><div>' + ugEsc(d.updatedBy || '—') + ' <span style="color:var(--gray-400);font-size:11.5px;">— ' + ugEsc(d.updatedAt || '') + '</span></div>' : '')
        + '</div>';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ugDetailsModal')).show();
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
function ugAskDelete(id) {
    var item = ugAll.find(function (x) { return Number(x.id) === Number(id); });
    document.getElementById('ugDeleteId').value = id;
    document.getElementById('ugDeleteNameLabel').textContent = item ? (item.name || '') : '';
    document.getElementById('ugDeleteError').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ugDeleteModal')).show();
}

async function ugSubmitDelete() {
    var id = parseInt(document.getElementById('ugDeleteId').value, 10);
    if (!id) return;
    var r = await apiFetch('/Settings/DeleteUserGuideItem', 'POST', { id: id });
    if (!r || !r.success) {
        var err = document.getElementById('ugDeleteError');
        err.textContent = (r && r.message) || 'تعذّر الحذف';
        err.classList.remove('d-none');
        return;
    }
    showToast(r.message || 'تم الحذف', 'success');
    bootstrap.Modal.getInstance(document.getElementById('ugDeleteModal')).hide();
    ugLoad();
}

// ─── TOGGLE ─────────────────────────────────────────────────────────────────
async function ugToggle(id) {
    var r = await apiFetch('/Settings/ToggleUserGuideItem', 'POST', { id: id });
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر التبديل', 'danger'); return; }
    ugLoad();
}

function ugShowError(prefix, msg) {
    var el = document.getElementById('ug' + prefix + 'Error');
    if (!el) return;
    el.textContent = msg || 'حدث خطأ';
    el.classList.remove('d-none');
}

window.ugLoad = ugLoad;
window.ugApplyFilter = ugApplyFilter;
window.ugClearFilters = ugClearFilters;
window.ugChangePage = ugChangePage;
window.ugShowAddModal = ugShowAddModal;
window.ugSubmitAdd = ugSubmitAdd;
window.ugShowEdit = ugShowEdit;
window.ugSubmitEdit = ugSubmitEdit;
window.ugShowDetails = ugShowDetails;
window.ugAskDelete = ugAskDelete;
window.ugSubmitDelete = ugSubmitDelete;
window.ugToggle = ugToggle;
window.ugClearIcon = ugClearIcon;
window.ugClearAttach = ugClearAttach;
