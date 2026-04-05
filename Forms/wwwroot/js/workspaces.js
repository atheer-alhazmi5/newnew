var wsAll = [];
var wsFiltered = [];
var wsOrgUnits = [];
var wsCurrentPage = 1;
var wsPerPage = 10;
var wsOuExpandedAdd = {}, wsOuExpandedEdit = {};
var wsSelectedOuIdAdd = 0, wsSelectedOuIdEdit = 0;

document.addEventListener('DOMContentLoaded', function () {
    wsLoad();
    var fs = document.getElementById('wsFilterSearch');
    var fst = document.getElementById('wsFilterStatus');
    var clr = document.getElementById('wsFilterClear');
    if (fs) fs.addEventListener('input', function () { wsFilter(); });
    if (fst) fst.addEventListener('change', function () { wsFilter(); });
    if (clr) clr.addEventListener('click', function () { wsClearFilters(); });

    var addSw = document.getElementById('wsAddIsActive');
    if (addSw) addSw.addEventListener('change', function () {
        document.getElementById('wsAddIsActiveLabel').textContent = this.checked ? 'مفعل' : 'غير مفعل';
    });
    var edSw = document.getElementById('wsEditIsActive');
    if (edSw) edSw.addEventListener('change', function () {
        document.getElementById('wsEditIsActiveLabel').textContent = this.checked ? 'مفعل' : 'غير مفعل';
    });
});

function wsDetailRow(label, valueHtml) {
    return '<div class="ws-detail-row"><div class="ws-detail-label">' + label + '</div><div class="ws-detail-value">' + valueHtml + '</div></div>';
}

async function wsLoad() {
    try {
        var r = await apiFetch('/Workspaces/GetWorkspaces');
        if (r && r.success) {
            wsAll = r.data || [];
            wsOrgUnits = r.organizationalUnits || [];
            wsFilter();
        } else {
            document.getElementById('wsBody').innerHTML =
                '<tr><td colspan="7">' + emptyState('bi-grid-1x2', 'لا توجد مساحات عمل', 'أنشئ مساحة من الزر أعلاه') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('wsBody').innerHTML =
            '<tr><td colspan="7" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function wsFilter() {
    var q = (document.getElementById('wsFilterSearch') && document.getElementById('wsFilterSearch').value || '').trim().toLowerCase();
    var st = document.getElementById('wsFilterStatus') ? document.getElementById('wsFilterStatus').value : '';
    wsFiltered = wsAll.filter(function (w) {
        if (q) {
            var nm = (w.name || '').toLowerCase();
            var ds = (w.description || '').toLowerCase();
            if (!nm.includes(q) && !ds.includes(q)) return false;
        }
        if (st === '1' && !w.isActive) return false;
        if (st === '0' && w.isActive) return false;
        return true;
    });
    wsCurrentPage = 1;
    wsRenderTable();
}

function wsClearFilters() {
    var fs = document.getElementById('wsFilterSearch');
    var fst = document.getElementById('wsFilterStatus');
    if (fs) fs.value = '';
    if (fst) fst.value = '';
    wsFilter();
}

function wsRenderTable() {
    var body = document.getElementById('wsBody');
    if (wsFiltered.length === 0) {
        var hasFilters = (document.getElementById('wsFilterSearch') && document.getElementById('wsFilterSearch').value.trim()) ||
            (document.getElementById('wsFilterStatus') && document.getElementById('wsFilterStatus').value !== '');
        var sub = hasFilters ? 'عدّل الفلاتر أو اضغط مسح' : 'أنشئ مساحة من الزر أعلاه';
        body.innerHTML = '<tr><td colspan="7">' +
            emptyState('bi-funnel', 'لا توجد نتائج', sub) +
            '</td></tr>';
        document.getElementById('wsPaginationContainer').innerHTML = '';
        return;
    }

    var start = (wsCurrentPage - 1) * wsPerPage;
    var page = wsFiltered.slice(start, start + wsPerPage);
    var html = '';

    page.forEach(function (w) {
        var id = w.id;
        var nm = w.name || '';
        var desc = (w.description || '').trim();
        var col = w.color || '#25935F';
        var ord = w.sortOrder != null ? w.sortOrder : '';
        var active = !!w.isActive;
        var statusClass = active ? 'on' : 'off';
        var statusText = active ? 'مفعل' : 'غير مفعل';
        var safeName = esc(nm).replace(/'/g, "\\'");

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;">' + esc(String(ord)) + '</td>' +
            '<td style="font-weight:700;">' + esc(nm) + '</td>' +
            '<td>' + (desc ? esc(desc) : '<span class="text-muted">—</span>') + '</td>' +
            '<td>' + (w.organizationalUnitName ? esc(w.organizationalUnitName) : '<span class="text-muted">—</span>') + '</td>' +
            '<td style="text-align:center;">' +
                '<span class="ws-color-circle" style="background:' + esc(col) + ';"></span>' +
                ' <span style="direction:ltr;font-size:12px;color:var(--gray-500);">' + esc(col) + '</span>' +
            '</td>' +
            '<td style="text-align:center;"><span class="ws-status-pill ' + statusClass + '"><span class="ws-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="cls-action-btn cls-action-btn-detail" onclick="wsShowDetails(' + id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="cls-action-btn cls-action-btn-edit" onclick="wsShowEditModal(' + id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="cls-action-btn cls-action-btn-delete" onclick="wsShowDelete(' + id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });

    body.innerHTML = html;
    renderPagination(
        document.getElementById('wsPaginationContainer'),
        wsFiltered.length, wsCurrentPage, wsPerPage, 'wsGoToPage'
    );
}

function wsGoToPage(p) {
    wsCurrentPage = p;
    wsRenderTable();
}

function wsShowAddModal() {
    document.getElementById('wsAddName').value = '';
    document.getElementById('wsAddDescription').value = '';
    document.getElementById('wsAddColor').value = '#25935F';
    document.getElementById('wsAddColorHex').textContent = '#25935F';
    document.getElementById('wsAddIsActive').checked = true;
    document.getElementById('wsAddIsActiveLabel').textContent = 'مفعل';
    document.getElementById('wsAddError').classList.add('d-none');
    wsSelectedOuIdAdd = 0;
    wsOuExpandedAdd = {};
    wsUpdateOuLabel('add');
    document.getElementById('wsAddOuPanel').classList.remove('show');
    new bootstrap.Modal(document.getElementById('wsAddModal')).show();
}

async function wsSubmitAdd() {
    var name = document.getElementById('wsAddName').value.trim();
    var errEl = document.getElementById('wsAddError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم مساحة العمل مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var dup = wsAll.find(function (w) { return (w.name || '').trim() === name; });
    if (dup) {
        errEl.textContent = 'اسم مساحة العمل موجود مسبقاً';
        errEl.classList.remove('d-none');
        return;
    }

    var payload = {
        name: name,
        description: document.getElementById('wsAddDescription').value.trim(),
        color: document.getElementById('wsAddColor').value,
        organizationalUnitId: wsSelectedOuIdAdd || null,
        isActive: document.getElementById('wsAddIsActive').checked
    };

    var r = await apiFetch('/Workspaces/AddWorkspace', 'POST', payload);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('wsAddModal')).hide();
        showToast(r.message, 'success');
        await wsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function wsShowEditModal(id) {
    var w = wsAll.find(function (x) { return x.id === id; });
    if (!w) return;

    document.getElementById('wsEditId').value = id;
    document.getElementById('wsEditName').value = w.name || '';
    document.getElementById('wsEditDescription').value = w.description || '';
    document.getElementById('wsEditSortOrder').value = w.sortOrder != null ? w.sortOrder : 1;
    var col = w.color || '#25935F';
    document.getElementById('wsEditColor').value = col;
    document.getElementById('wsEditColorHex').textContent = col;
    var act = !!w.isActive;
    document.getElementById('wsEditIsActive').checked = act;
    document.getElementById('wsEditIsActiveLabel').textContent = act ? 'مفعل' : 'غير مفعل';
    document.getElementById('wsEditError').classList.add('d-none');
    wsSelectedOuIdEdit = w.organizationalUnitId || 0;
    wsOuExpandedEdit = {};
    wsUpdateOuLabel('edit');
    document.getElementById('wsEditOuPanel').classList.remove('show');
    new bootstrap.Modal(document.getElementById('wsEditModal')).show();
}

async function wsSubmitEdit() {
    var id = parseInt(document.getElementById('wsEditId').value, 10);
    var name = document.getElementById('wsEditName').value.trim();
    var errEl = document.getElementById('wsEditError');
    errEl.classList.add('d-none');

    if (!name) {
        errEl.textContent = 'اسم مساحة العمل مطلوب';
        errEl.classList.remove('d-none');
        return;
    }

    var dup = wsAll.find(function (w) { return w.id !== id && (w.name || '').trim() === name; });
    if (dup) {
        errEl.textContent = 'اسم مساحة العمل موجود مسبقاً';
        errEl.classList.remove('d-none');
        return;
    }

    var sortOrder = parseInt(document.getElementById('wsEditSortOrder').value, 10);
    if (isNaN(sortOrder) || sortOrder < 1) sortOrder = 1;

    var payload = {
        id: id,
        name: name,
        description: document.getElementById('wsEditDescription').value.trim(),
        color: document.getElementById('wsEditColor').value,
        organizationalUnitId: wsSelectedOuIdEdit || null,
        isActive: document.getElementById('wsEditIsActive').checked,
        sortOrder: sortOrder
    };

    var r = await apiFetch('/Workspaces/UpdateWorkspace', 'POST', payload);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('wsEditModal')).hide();
        showToast(r.message, 'success');
        await wsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function wsShowDetails(id) {
    var w = wsAll.find(function (x) { return x.id === id; });
    if (!w) return;

    var active = !!w.isActive;
    var statusText = active ? 'مفعل' : 'غير مفعل';
    var col = w.color || '#25935F';
    var colorHtml = '<span class="ws-color-circle" style="background:' + esc(col) + ';"></span> <span style="direction:ltr;">' + esc(col) + '</span>';

    var html =
        wsDetailRow('الترتيب', esc(String(w.sortOrder))) +
        wsDetailRow('الحالة', statusText) +
        wsDetailRow('اسم مساحة العمل', esc(w.name || '')) +
        wsDetailRow('الوحدة التنظيمية', w.organizationalUnitName ? esc(w.organizationalUnitName) : '—') +
        wsDetailRow('الوصف', w.description ? esc(w.description) : '—') +
        wsDetailRow('اللون', colorHtml) +
        wsDetailRow('أُنشئت في', esc(w.createdAt || '—')) +
        wsDetailRow('آخر تحديث', esc(w.updatedAt || '—')) +
        wsDetailRow('أنشأ بواسطة', esc(w.createdBy || '—')) +
        wsDetailRow('حدّث بواسطة', esc(w.updatedBy || '—'));

    document.getElementById('wsDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('wsDetailsModal')).show();
}

function wsShowDelete(id, name) {
    document.getElementById('wsDeleteId').value = id;
    document.getElementById('wsDeleteNameLabel').textContent = name;
    document.getElementById('wsDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('wsDeleteModal')).show();
}

async function wsSubmitDelete() {
    var id = parseInt(document.getElementById('wsDeleteId').value, 10);
    var errEl = document.getElementById('wsDeleteError');
    errEl.classList.add('d-none');
    var r = await apiFetch('/Workspaces/DeleteWorkspace', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('wsDeleteModal')).hide();
        showToast(r.message, 'success');
        await wsLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

/*  Org Unit  Dropdown  */
function wsOuBuildTreeMap() {
    var ids = {};
    wsOrgUnits.forEach(function(u) { ids[u.id] = true; });
    var byParent = {};
    wsOrgUnits.forEach(function(u) {
        var pk = (u.parentId != null && u.parentId !== '' && ids[u.parentId]) ? String(u.parentId) : '';
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(function(k) {
        byParent[k].sort(function(a,b) {
            var sa = a.sortOrder != null ? a.sortOrder : 0;
            var sb = b.sortOrder != null ? b.sortOrder : 0;
            return sa !== sb ? sa - sb : (a.name||'').localeCompare(b.name||'','ar');
        });
    });
    return byParent;
}

function wsOuRenderRows(byParent, parentKey, depth, selectedId, expandedMap) {
    var rows = byParent[parentKey] || [];
    var html = '';
    rows.forEach(function(u) {
        var idStr = String(u.id);
        var hasChildren = !!byParent[idStr];
        var expanded = !!expandedMap[idStr];
        var indent = depth * 22;
        var sel = String(selectedId) === idStr ? ' is-selected' : '';
        html += '<div class="ws-ou-tree-row' + sel + '" data-id="' + u.id + '" style="padding-right:' + (12 + indent) + 'px;">';
        if (hasChildren) {
            html += '<button type="button" class="ws-ou-tree-exp" data-exp="' + idStr + '">' + (expanded ? '−' : '+') + '</button>';
        } else {
            html += '<span class="ws-ou-tree-exp-spacer"></span>';
        }
        html += '<span class="ws-ou-tree-name">' + esc(u.name) + '</span></div>';
        if (hasChildren && expanded) {
            html += wsOuRenderRows(byParent, idStr, depth + 1, selectedId, expandedMap);
        }
    });
    return html;
}

function wsOuRenderPanel(mode) {
    var panelId = mode === 'add' ? 'wsAddOuPanel' : 'wsEditOuPanel';
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var selectedId = mode === 'add' ? wsSelectedOuIdAdd : wsSelectedOuIdEdit;
    var expandedMap = mode === 'add' ? wsOuExpandedAdd : wsOuExpandedEdit;
    if (!wsOrgUnits.length) { panel.innerHTML = '<div class="text-muted text-center py-3" style="font-size:13px;">لا توجد وحدات تنظيمية</div>'; return; }
    var byParent = wsOuBuildTreeMap();
    var html = wsOuRenderRows(byParent, '', 0, selectedId, expandedMap);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function wsToggleOuPanel(mode) {
    var panel = document.getElementById(mode === 'add' ? 'wsAddOuPanel' : 'wsEditOuPanel');
    if (!panel) return;
    if (panel.classList.contains('show')) {
        panel.classList.remove('show');
    } else {
        wsOuRenderPanel(mode);
        panel.classList.add('show');
    }
}

function wsUpdateOuLabel(mode) {
    var labelEl = document.getElementById(mode === 'add' ? 'wsAddOuLabel' : 'wsEditOuLabel');
    var selectedId = mode === 'add' ? wsSelectedOuIdAdd : wsSelectedOuIdEdit;
    if (!selectedId) {
        labelEl.textContent = 'اختر الوحدة التنظيمية...';
        labelEl.style.color = 'var(--gray-400)';
        return;
    }
    var found = wsOrgUnits.find(function(u) { return u.id === selectedId; });
    labelEl.textContent = found ? found.name : 'اختر الوحدة التنظيمية...';
    labelEl.style.color = found ? 'var(--gray-800)' : 'var(--gray-400)';
}

function wsOuPanelClick(mode, e) {
    var expBtn = e.target.closest('.ws-ou-tree-exp');
    var expandedMap = mode === 'add' ? wsOuExpandedAdd : wsOuExpandedEdit;
    if (expBtn) {
        e.stopPropagation();
        var eid = expBtn.getAttribute('data-exp');
        expandedMap[eid] = !expandedMap[eid];
        wsOuRenderPanel(mode);
        return;
    }
    var row = e.target.closest('.ws-ou-tree-row');
    if (!row) return;
    var ouId = parseInt(row.getAttribute('data-id'));
    if (isNaN(ouId)) return;
    if (mode === 'add') wsSelectedOuIdAdd = ouId;
    else wsSelectedOuIdEdit = ouId;
    wsUpdateOuLabel(mode);
    var panel = document.getElementById(mode === 'add' ? 'wsAddOuPanel' : 'wsEditOuPanel');
    panel.classList.remove('show');
}

document.addEventListener('click', function(e) {
    ['add', 'edit'].forEach(function(m) {
        var wrap = document.getElementById(m === 'add' ? 'wsAddOuWrap' : 'wsEditOuWrap');
        var panel = document.getElementById(m === 'add' ? 'wsAddOuPanel' : 'wsEditOuPanel');
        if (wrap && panel && !wrap.contains(e.target)) panel.classList.remove('show');
    });
});

document.addEventListener('DOMContentLoaded', function() {
    ['add', 'edit'].forEach(function(mode) {
        var panel = document.getElementById(mode === 'add' ? 'wsAddOuPanel' : 'wsEditOuPanel');
        if (panel) panel.addEventListener('click', function(ev) { wsOuPanelClick(mode, ev); });
    });
});
