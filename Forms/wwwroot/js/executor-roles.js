/*  Executor Roles – Client Logic  */
var erRoles = [], erOrgUnits = [], erBeneficiaries = [];
var erOuExpandedC = {}, erOuExpandedE = {};
var erSelectedOuIdsC = [], erSelectedOuIdsE = [];
var erSelectedExecIdsC = [], erSelectedExecIdsE = [];

function erEsc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

function erBenIsUnitManager(b) {
    if (!b) return false;
    if (b.isUnitManager === true || b.IsUnitManager === true) return true;
    var rd = String(b.roleDisplay || b.RoleDisplay || '');
    if (rd.indexOf('مدير وحدة') >= 0 || rd.indexOf('مدير الوحدة') >= 0) return true;
    return false;
}

/* ─── Data Loading ──────────────────────────────────────────── */
async function erLoad() {
    var res = await apiFetch('/ExecutorRoles/GetExecutorRoles');
    if (!res || !res.success) { document.getElementById('erBody').innerHTML = '<tr><td colspan="9" class="er-empty-state"><i class="bi bi-exclamation-circle"></i><p>خطأ في تحميل البيانات</p></td></tr>'; return; }
    erRoles = res.data || [];
    erOrgUnits = res.organizationalUnits || [];
    erBeneficiaries = res.beneficiaries || [];
    erPopulateFilterOrgUnits();
    erRenderTable(erRoles);
}

function erPopulateFilterOrgUnits() {
    var sel = document.getElementById('erFilterOrgUnit');
    var val = sel.value;
    sel.innerHTML = '<option value="">الوحدة التنظيمية</option>';
    erOrgUnits.forEach(function(u) {
        var indent = '';
        for (var i = 0; i < (u.level || 0); i++) indent += '\u00A0\u00A0';
        sel.innerHTML += '<option value="' + u.id + '">' + indent + erEsc(u.name) + '</option>';
    });
    sel.value = val;
}

/* ─── Table Rendering ───────────────────────────────────────── */
function erRenderTable(data) {
    var badge = document.getElementById('erCountBadge');
    if (badge) badge.textContent = '(' + data.length + ')';
    var body = document.getElementById('erBody');
    if (!data.length) {
        body.innerHTML = '<tr><td colspan="9" class="er-empty-state"><i class="bi bi-person-badge"></i><p>لا توجد أدوار منفذين</p></td></tr>';
        return;
    }
    var html = '';
    data.forEach(function(r) {
        var ownerBadge = r.ownership === 'حصري'
            ? '<span class="er-badge-ownership er-badge-exclusive"><i class="bi bi-lock-fill"></i> حصري</span>'
            : '<span class="er-badge-ownership er-badge-nonexclusive"><i class="bi bi-unlock-fill"></i> غير حصري</span>';
        var execDisplay = r.executorCount > 0
            ? '<span title="' + erEsc(r.executorNames) + '" style="cursor:help;">' + r.executorCount + ' منفذ</span>'
            : '<span class="text-muted">—</span>';
        html += '<tr>'
            + '<td style="text-align:center;font-weight:700;">' + r.id + '</td>'
            + '<td style="text-align:right;font-weight:600;">' + erEsc(r.name) + '</td>'
            + '<td style="text-align:right;font-size:12px;color:var(--gray-500);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + erEsc(r.description) + '">' + (r.description || '—') + '</td>'
            + '<td style="text-align:center;">' + ownerBadge + '</td>'
            + '<td style="text-align:center;">' + execDisplay + '</td>'
            + '<td style="text-align:center;">' + r.sortOrder + '</td>'
            + '<td style="text-align:center;"><span class="er-color-swatch" style="background:' + erEsc(r.color) + ';"></span></td>'
            + '<td style="text-align:center;"><label class="er-toggle"><input type="checkbox" ' + (r.isActive ? 'checked' : '') + ' onchange="erToggleActive(' + r.id + ')"><span class="er-slider"></span></label></td>'
            + '<td style="text-align:center;">'
            + '<button class="er-action-btn er-action-btn-detail" onclick="erShowDetails(' + r.id + ')" title="تفاصيل"><i class="bi bi-eye-fill"></i></button> '
            + '<button class="er-action-btn er-action-btn-edit" onclick="erShowEditModal(' + r.id + ')" title="تعديل"><i class="bi bi-pencil-fill"></i></button> '
            + '<button class="er-action-btn er-action-btn-delete" onclick="erShowDeleteModal(' + r.id + ',\'' + erEsc(r.name).replace(/'/g,"\\'") + '\')" title="حذف"><i class="bi bi-trash3-fill"></i></button>'
            + '</td></tr>';
    });
    body.innerHTML = html;
}

/* ─── Filters ───────────────────────────────────────────────── */
function erApplyFilters() {
    var search = (document.getElementById('erSearchInput').value || '').trim().toLowerCase();
    var ownership = document.getElementById('erFilterOwnership').value;
    var orgUnit = document.getElementById('erFilterOrgUnit').value;
    var active = document.getElementById('erFilterActive').value;
    var filtered = erRoles.filter(function(r) {
        if (search && !(r.name || '').toLowerCase().includes(search) && !(r.description || '').toLowerCase().includes(search)) return false;
        if (ownership && r.ownership !== ownership) return false;
        if (orgUnit && !(r.orgUnitIds || '').split(',').map(function(x){return x.trim();}).includes(orgUnit)) return false;
        if (active === '1' && !r.isActive) return false;
        if (active === '0' && r.isActive) return false;
        return true;
    });
    erRenderTable(filtered);
}

function erClearFilters() {
    document.getElementById('erSearchInput').value = '';
    document.getElementById('erFilterOwnership').value = '';
    document.getElementById('erFilterOrgUnit').value = '';
    document.getElementById('erFilterActive').value = '';
    erRenderTable(erRoles);
}

/* ─── Toggle Active ─────────────────────────────────────────── */
async function erToggleActive(id) {
    var res = await apiFetch('/ExecutorRoles/ToggleExecutorRole', 'POST', { id: id });
    if (res && res.success) { await erLoad(); erApplyFilters(); }
    else alert((res && res.message) || 'خطأ');
}

/* ─── Org Unit Tree ─────────────────────────────────────────── */
function erOuBuildTreeMap() {
    var ids = {};
    erOrgUnits.forEach(function(u) { ids[u.id] = true; });
    var byParent = {};
    erOrgUnits.forEach(function(u) {
        var pk = (u.parentId && ids[u.parentId]) ? String(u.parentId) : '';
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(function(k) {
        byParent[k].sort(function(a,b) { return (a.sortOrder||0) - (b.sortOrder||0); });
    });
    return byParent;
}

function erOuRenderRows(byParent, parentKey, depth, selectedIds, expandedMap, multiSelect) {
    var rows = byParent[parentKey] || [];
    var html = '';
    rows.forEach(function(u) {
        var idStr = String(u.id);
        var hasChildren = !!byParent[idStr];
        var expanded = !!expandedMap[idStr];
        var isSelected = selectedIds.indexOf(u.id) >= 0;
        var selClass = isSelected ? ' selected' : '';
        html += '<div class="er-ou-tree-row' + selClass + '" data-ou-id="' + u.id + '" style="padding-right:' + (10 + depth * 18) + 'px;">';
        if (hasChildren) {
            html += '<span class="er-ou-tree-exp" data-exp="' + idStr + '"><i class="bi bi-' + (expanded ? 'dash' : 'plus') + '-lg" style="font-size:.7rem;"></i></span>';
        } else {
            html += '<span class="er-ou-tree-exp-spacer"></span>';
        }
        if (multiSelect) {
            html += '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' style="accent-color:var(--sa-600);width:15px;height:15px;cursor:pointer;" data-ou-check="' + u.id + '">';
        }
        html += '<span class="er-ou-tree-name">' + erEsc(u.name) + '</span></div>';
        if (hasChildren && expanded) {
            html += erOuRenderRows(byParent, idStr, depth + 1, selectedIds, expandedMap, multiSelect);
        }
    });
    return html;
}

function erOuRenderPanel(mode) {
    var panelId = mode === 'c' ? 'ercOuPanel' : 'ereOuPanel';
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var isMulti = erGetOwnership(mode) === 'غير حصري';
    var selectedIds = mode === 'c' ? erSelectedOuIdsC : erSelectedOuIdsE;
    var expandedMap = mode === 'c' ? erOuExpandedC : erOuExpandedE;
    if (!erOrgUnits.length) { panel.innerHTML = '<div class="text-muted text-center py-3" style="font-size:13px;">لا توجد وحدات تنظيمية</div>'; return; }
    var byParent = erOuBuildTreeMap();
    var html = erOuRenderRows(byParent, '', 0, selectedIds, expandedMap, isMulti);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function erToggleOuPanel(mode) {
    var panel = document.getElementById(mode === 'c' ? 'ercOuPanel' : 'ereOuPanel');
    if (!panel) return;
    if (panel.classList.contains('show')) {
        panel.classList.remove('show');
    } else {
        erOuRenderPanel(mode);
        panel.classList.add('show');
    }
}

function erGetOwnership(mode) {
    return document.getElementById(mode === 'c' ? 'ercOwnership' : 'ereOwnership').value;
}

function erUpdateOuLabel(mode) {
    var labelEl = document.getElementById(mode === 'c' ? 'ercOuLabel' : 'ereOuLabel');
    var selectedIds = mode === 'c' ? erSelectedOuIdsC : erSelectedOuIdsE;
    if (!selectedIds.length) {
        labelEl.textContent = 'اختر الوحدة التنظيمية...';
        labelEl.style.color = 'var(--gray-400)';
        return;
    }
    var names = [];
    erOrgUnits.forEach(function(u) { if (selectedIds.indexOf(u.id) >= 0) names.push(u.name); });
    labelEl.textContent = names.join('، ');
    labelEl.style.color = 'var(--gray-800)';
}

function erOuPanelClick(mode, e) {
    var expBtn = e.target.closest('.er-ou-tree-exp');
    var expandedMap = mode === 'c' ? erOuExpandedC : erOuExpandedE;
    if (expBtn) {
        e.stopPropagation();
        var eid = expBtn.getAttribute('data-exp');
        expandedMap[eid] = !expandedMap[eid];
        erOuRenderPanel(mode);
        return;
    }
    var checkbox = e.target.closest('[data-ou-check]');
    var row = e.target.closest('.er-ou-tree-row');
    if (!row) return;
    var ouId = parseInt(row.getAttribute('data-ou-id'));
    if (isNaN(ouId)) return;
    var isMulti = erGetOwnership(mode) === 'غير حصري';
    if (mode === 'c') {
        if (isMulti) {
            var idx = erSelectedOuIdsC.indexOf(ouId);
            if (idx >= 0) erSelectedOuIdsC.splice(idx, 1); else erSelectedOuIdsC.push(ouId);
        } else {
            erSelectedOuIdsC = [ouId];
            document.getElementById('ercOuPanel').classList.remove('show');
        }
    } else {
        if (isMulti) {
            var idx2 = erSelectedOuIdsE.indexOf(ouId);
            if (idx2 >= 0) erSelectedOuIdsE.splice(idx2, 1); else erSelectedOuIdsE.push(ouId);
        } else {
            erSelectedOuIdsE = [ouId];
            document.getElementById('ereOuPanel').classList.remove('show');
        }
    }
    erUpdateOuLabel(mode);
    erOuRenderPanel(mode);
    erRenderExecutors(mode);
}

/* ─── Ownership Change ──────────────────────────────────────── */
function erOnOwnershipChange(mode) {
    if (mode === 'c') { erSelectedOuIdsC = []; erSelectedExecIdsC = []; }
    else { erSelectedOuIdsE = []; erSelectedExecIdsE = []; }
    erUpdateOuLabel(mode);
    erOuRenderPanel(mode);
    erRenderExecutors(mode);
}

/* ─── Executors List ────────────────────────────────────────── */
function erRenderExecutors(mode) {
    var listEl = document.getElementById(mode === 'c' ? 'ercExecList' : 'ereExecList');
    var countEl = document.getElementById(mode === 'c' ? 'ercExecCount' : 'ereExecCount');
    var selectedOuIds = mode === 'c' ? erSelectedOuIdsC : erSelectedOuIdsE;
    var selectedExecIds = mode === 'c' ? erSelectedExecIdsC : erSelectedExecIdsE;
    var isExclusive = erGetOwnership(mode) === 'حصري';
    var inputType = isExclusive ? 'radio' : 'checkbox';
    var inputName = mode === 'c' ? 'ercExec' : 'ereExec';

    if (!selectedOuIds.length) {
        listEl.innerHTML = '<div class="text-center text-muted py-3" style="font-size:13px;">اختر الوحدة التنظيمية أولاً</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    var ouMap = {};
    erOrgUnits.forEach(function(u) { ouMap[u.id] = u.name; });

    var grouped = {};
    erBeneficiaries.forEach(function(b) {
        var ouId = b.organizationalUnitId != null ? b.organizationalUnitId : b.OrganizationalUnitId;
        if (selectedOuIds.indexOf(ouId) < 0) return;
        var dept = ouMap[ouId] || 'أخرى';
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(b);
    });

    var keys = Object.keys(grouped);
    if (!keys.length) {
        listEl.innerHTML = '<div class="text-center text-muted py-3" style="font-size:13px;">لا يوجد منفذين في الوحدات المحددة</div>';
        if (countEl) countEl.textContent = '';
        return;
    }

    var cleanedExecIds = [];
    var allBenIds = [];
    keys.forEach(function(k) { grouped[k].forEach(function(b) { allBenIds.push(b.id != null ? b.id : b.Id); }); });
    selectedExecIds.forEach(function(id) { if (allBenIds.indexOf(id) >= 0) cleanedExecIds.push(id); });
    if (mode === 'c') erSelectedExecIdsC = cleanedExecIds; else erSelectedExecIdsE = cleanedExecIds;

    var html = '';
    keys.forEach(function(dept) {
        html += '<div class="er-exec-dept-head"><i class="bi bi-building"></i> ' + erEsc(dept) + ' (' + grouped[dept].length + ')</div>';
        html += '<div class="er-exec-dept-items">';
        grouped[dept].forEach(function(b) {
            var bid = b.id != null ? b.id : b.Id;
            var checked = cleanedExecIds.indexOf(bid) >= 0 ? ' checked' : '';
            var isMgr = erBenIsUnitManager(b);
            var mgrCls = isMgr ? ' er-exec-item-manager' : '';
            var badge = isMgr ? '<span class="er-exec-mgr-badge">مدير وحده تنظيمية</span>' : '';
            var fn = b.fullName || b.FullName || '';
            html += '<label class="er-exec-item' + mgrCls + '"><input type="' + inputType + '" name="' + inputName + '" value="' + bid + '"' + checked + ' onchange="erExecChanged(\'' + mode + '\',' + bid + ',this)"> <span>' + erEsc(fn) + '</span>' + badge + '</label>';
        });
        html += '</div>';
    });

    listEl.innerHTML = html;
    if (countEl) countEl.textContent = cleanedExecIds.length > 0 ? '(تم تحديد ' + cleanedExecIds.length + ')' : '';
}

function erExecChanged(mode, id, el) {
    var isExclusive = erGetOwnership(mode) === 'حصري';
    if (mode === 'c') {
        if (isExclusive) {
            erSelectedExecIdsC = el.checked ? [id] : [];
        } else {
            if (el.checked) { if (erSelectedExecIdsC.indexOf(id) < 0) erSelectedExecIdsC.push(id); }
            else { erSelectedExecIdsC = erSelectedExecIdsC.filter(function(x){return x!==id;}); }
        }
    } else {
        if (isExclusive) {
            erSelectedExecIdsE = el.checked ? [id] : [];
        } else {
            if (el.checked) { if (erSelectedExecIdsE.indexOf(id) < 0) erSelectedExecIdsE.push(id); }
            else { erSelectedExecIdsE = erSelectedExecIdsE.filter(function(x){return x!==id;}); }
        }
    }
    var countEl = document.getElementById(mode === 'c' ? 'ercExecCount' : 'ereExecCount');
    var ids = mode === 'c' ? erSelectedExecIdsC : erSelectedExecIdsE;
    if (countEl) countEl.textContent = ids.length > 0 ? '(تم تحديد ' + ids.length + ')' : '';
}

/* ─── Create Modal ──────────────────────────────────────────── */
function erShowCreateModal() {
    document.getElementById('ercName').value = '';
    document.getElementById('ercOwnership').value = 'حصري';
    document.getElementById('ercColor').value = '#25935F';
    document.getElementById('ercColorHex').textContent = '#25935F';
    document.getElementById('ercIsActive').checked = true;
    document.getElementById('ercDescription').value = '';
    erSelectedOuIdsC = [];
    erSelectedExecIdsC = [];
    erOuExpandedC = {};
    erUpdateOuLabel('c');
    document.getElementById('ercOuPanel').classList.remove('show');
    document.getElementById('ercOuPanel').innerHTML = '';
    document.getElementById('ercExecList').innerHTML = '<div class="text-center text-muted py-3" style="font-size:13px;">اختر الوحدة التنظيمية أولاً</div>';
    document.getElementById('ercExecCount').textContent = '';
    new bootstrap.Modal(document.getElementById('erCreateModal')).show();
}

async function erSubmitCreate() {
    var name = document.getElementById('ercName').value.trim();
    if (!name) { alert('اسم الدور مطلوب'); return; }
    if (!erSelectedOuIdsC.length) { alert('يجب اختيار الوحدة التنظيمية'); return; }

    var res = await apiFetch('/ExecutorRoles/AddExecutorRole', 'POST', {
        name: name,
        description: document.getElementById('ercDescription').value.trim(),
        ownership: document.getElementById('ercOwnership').value,
        orgUnitIds: erSelectedOuIdsC.join(','),
        executorIds: erSelectedExecIdsC.join(','),
        color: document.getElementById('ercColor').value,
        isActive: document.getElementById('ercIsActive').checked
    });

    if (res && res.success) {
        bootstrap.Modal.getInstance(document.getElementById('erCreateModal'))?.hide();
        await erLoad();
        erApplyFilters();
    } else {
        alert((res && res.message) || 'خطأ في الحفظ');
    }
}

/* ─── Edit Modal ────────────────────────────────────────────── */
async function erShowEditModal(id) {
    var res = await apiFetch('/ExecutorRoles/GetExecutorRoleDetails?id=' + id);
    if (!res || !res.success || !res.data) { alert('خطأ في تحميل بيانات الدور'); return; }
    var r = res.data;

    document.getElementById('ereId').value = r.id;
    document.getElementById('ereName').value = r.name;
    document.getElementById('ereOwnership').value = r.ownership;
    document.getElementById('ereColor').value = r.color;
    document.getElementById('ereColorHex').textContent = r.color;
    document.getElementById('ereIsActive').checked = r.isActive;
    document.getElementById('ereSortOrder').value = r.sortOrder;
    document.getElementById('ereDescription').value = r.description || '';

    erSelectedOuIdsE = (r.orgUnitIds || '').split(',').filter(function(x){return x.trim();}).map(Number).filter(function(x){return !isNaN(x);});
    erSelectedExecIdsE = (r.executorIds || '').split(',').filter(function(x){return x.trim();}).map(Number).filter(function(x){return !isNaN(x);});
    erOuExpandedE = {};
    erUpdateOuLabel('e');
    document.getElementById('ereOuPanel').classList.remove('show');
    erRenderExecutors('e');

    new bootstrap.Modal(document.getElementById('erEditModal')).show();
}

async function erSubmitEdit() {
    var id = parseInt(document.getElementById('ereId').value);
    var name = document.getElementById('ereName').value.trim();
    if (!name) { alert('اسم الدور مطلوب'); return; }
    if (!erSelectedOuIdsE.length) { alert('يجب اختيار الوحدة التنظيمية'); return; }

    var res = await apiFetch('/ExecutorRoles/UpdateExecutorRole', 'POST', {
        id: id,
        name: name,
        description: document.getElementById('ereDescription').value.trim(),
        ownership: document.getElementById('ereOwnership').value,
        orgUnitIds: erSelectedOuIdsE.join(','),
        executorIds: erSelectedExecIdsE.join(','),
        color: document.getElementById('ereColor').value,
        sortOrder: parseInt(document.getElementById('ereSortOrder').value) || 1,
        isActive: document.getElementById('ereIsActive').checked
    });

    if (res && res.success) {
        bootstrap.Modal.getInstance(document.getElementById('erEditModal'))?.hide();
        await erLoad();
        erApplyFilters();
    } else {
        alert((res && res.message) || 'خطأ في التحديث');
    }
}

/* ─── Details Modal ─────────────────────────────────────────── */
async function erShowDetails(id) {
    var res = await apiFetch('/ExecutorRoles/GetExecutorRoleDetails?id=' + id);
    if (!res || !res.success || !res.data) { alert('خطأ في تحميل البيانات'); return; }
    var r = res.data;
    var statusBadge = r.isActive
        ? '<span style="color:#16a34a;font-weight:700;"><i class="bi bi-check-circle-fill"></i> مفعل</span>'
        : '<span style="color:#dc2626;font-weight:700;"><i class="bi bi-x-circle-fill"></i> معطل</span>';
    var ownerBadge = r.ownership === 'حصري'
        ? '<span class="er-badge-ownership er-badge-exclusive"><i class="bi bi-lock-fill"></i> حصري</span>'
        : '<span class="er-badge-ownership er-badge-nonexclusive"><i class="bi bi-unlock-fill"></i> غير حصري</span>';

    document.getElementById('erDetailsBody').innerHTML =
        '<div class="er-detail-grid">'
        + '<div class="er-detail-label">رقم الدور</div><div class="er-detail-value">' + r.id + '</div>'
        + '<div class="er-detail-label">اسم الدور</div><div class="er-detail-value" style="font-weight:700;">' + erEsc(r.name) + '</div>'
        + '<div class="er-detail-label">الملكية</div><div class="er-detail-value">' + ownerBadge + '</div>'
        + '<div class="er-detail-label">الوصف</div><div class="er-detail-value">' + (erEsc(r.description) || '—') + '</div>'
        + '<div class="er-detail-label">الوحدات التنظيمية</div><div class="er-detail-value">' + (erEsc(r.orgUnitNames) || '—') + '</div>'
        + '<div class="er-detail-label">المنفذين</div><div class="er-detail-value">' + (erEsc(r.executorNames) || '—') + '</div>'
        + '<div class="er-detail-label">الترتيب</div><div class="er-detail-value">' + r.sortOrder + '</div>'
        + '<div class="er-detail-label">اللون</div><div class="er-detail-value"><span class="er-color-swatch" style="background:' + erEsc(r.color) + ';"></span> ' + erEsc(r.color) + '</div>'
        + '<div class="er-detail-label">الحالة</div><div class="er-detail-value">' + statusBadge + '</div>'
        + '<div class="er-detail-label">أنشئ بواسطة</div><div class="er-detail-value">' + (erEsc(r.createdBy) || '—') + '</div>'
        + '<div class="er-detail-label">تاريخ الإنشاء</div><div class="er-detail-value">' + (r.createdAt || '—') + '</div>'
        + '<div class="er-detail-label">آخر تعديل بواسطة</div><div class="er-detail-value">' + (erEsc(r.updatedBy) || '—') + '</div>'
        + '<div class="er-detail-label">تاريخ التعديل</div><div class="er-detail-value">' + (r.updatedAt || '—') + '</div>'
        + '</div>';

    new bootstrap.Modal(document.getElementById('erDetailsModal')).show();
}

/* ─── Delete Modal ──────────────────────────────────────────── */
function erShowDeleteModal(id, name) {
    document.getElementById('erDeleteId').value = id;
    document.getElementById('erDeleteName').textContent = name;
    new bootstrap.Modal(document.getElementById('erDeleteModal')).show();
}

async function erSubmitDelete() {
    var id = parseInt(document.getElementById('erDeleteId').value);
    var res = await apiFetch('/ExecutorRoles/DeleteExecutorRole', 'POST', { id: id });
    if (res && res.success) {
        bootstrap.Modal.getInstance(document.getElementById('erDeleteModal'))?.hide();
        await erLoad();
        erApplyFilters();
    } else {
        alert((res && res.message) || 'خطأ في الحذف');
    }
}

/* ─── Close panel ──────────────────────────── */
document.addEventListener('click', function(e) {
    ['c', 'e'].forEach(function(m) {
        var wrap = document.getElementById(m === 'c' ? 'ercOuWrap' : 'ereOuWrap');
        var panel = document.getElementById(m === 'c' ? 'ercOuPanel' : 'ereOuPanel');
        if (wrap && panel && !wrap.contains(e.target)) panel.classList.remove('show');
    });
});

/* ─── Panel delegated────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
    ['c', 'e'].forEach(function(mode) {
        var panel = document.getElementById(mode === 'c' ? 'ercOuPanel' : 'ereOuPanel');
        if (panel) panel.addEventListener('click', function(ev) { erOuPanelClick(mode, ev); });
    });
    erLoad();
});
