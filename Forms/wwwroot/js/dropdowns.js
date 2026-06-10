var ddlAll = [];
var ddlFiltered = [];
var ddlOrgUnits = [];
var ddlIndependentLists = [];
var ddlParentListItemsCache = [];
var ddlItemsAllCache = [];
var ddlHierItemsAllCache = [];
var ddlCurrentUser = '';
var ddlIsAdmin = false;
var ddlCurrentOrgUnitId = 0;
var ddlFilterOuExpanded = {};

var DDL_LIST_NAME_DUP_MSG = 'اسم القائمة المنسدلة موجود مسبقًا، يرجى إدخال اسم مختلف.';
var DDL_ITEM_TEXT_DUP_MSG = 'اسم العنصر موجود مسبقًا، يرجى إدخال اسم مختلف.';

var ddlHierItems = [];
var ddlHierLevelNames = [];
var ddlHierLevelCount = 2;
/** الأدمن: الملكية «عام» إلزامية. ممثل الوحدة: يختار عام/خاص بحرية. */
function ddlApplyOwnershipUi() {
    var pubC = document.getElementById('ddlCreateOwnershipPublic');
    var privC = document.getElementById('ddlCreateOwnershipPrivate');
    var pubE = document.getElementById('ddlEditOwnershipPublic');
    var privE = document.getElementById('ddlEditOwnershipPrivate');
    if (ddlIsAdmin) {
        if (pubC) { pubC.checked = true; pubC.disabled = false; }
        if (privC) { privC.checked = false; privC.disabled = true; }
        if (pubE) { pubE.checked = true; pubE.disabled = false; }
        if (privE) { privE.checked = false; privE.disabled = true; }
    } else {
        if (pubC) pubC.disabled = false;
        if (privC) privC.disabled = false;
        if (pubE) pubE.disabled = false;
        if (privE) privE.disabled = false;
    }
}

/** مدير النظام لا يعدّل القوائم الخاصة؛ ممثل الوحدة يعدّل ما أنشأه أو الخاص بوحدته. */
function ddlCanModifyList(d) {
    if (!d) return false;
    if (ddlIsAdmin && d.ownership === 'خاص') return false;
    if (ddlIsAdmin) return true;
    var createdBy = (d.createdBy || '').trim();
    if (createdBy && ddlCurrentUser && createdBy === ddlCurrentUser) return true;
    if (d.ownership === 'خاص' && ddlCurrentOrgUnitId > 0 && d.organizationalUnitId === ddlCurrentOrgUnitId) return true;
    return false;
}

function ddlIsDuplicateListName(name, excludeId) {
    var norm = (name || '').trim();
    if (!norm) return false;
    return ddlAll.some(function (d) {
        if (excludeId && d.id === excludeId) return false;
        return (d.name || '').trim() === norm;
    });
}

function ddlIsDuplicateItemText(text, excludeId) {
    var norm = (text || '').trim();
    if (!norm) return false;
    var listType = document.getElementById('ddlItemsListType')?.value || '';
    var cache = listType === 'قائمة هرمية' ? ddlHierItemsAllCache : ddlItemsAllCache;
    return cache.some(function (i) {
        if (excludeId && i.id === excludeId) return false;
        return (i.itemText || '').trim() === norm;
    });
}

function ddlIsListLinkedToForm(listData) {
    return !!(listData && (listData.isLinkedToForm === true || listData.IsLinkedToForm === true));
}

/** تعطيل حقول نوع القائمة عند التحديث فقط */
function ddlSetEditListTypeLocked(locked) {
    document.querySelectorAll('input[name="ddlEditListType"]').forEach(function (el) {
        el.disabled = !!locked;
    });
    var pl = document.getElementById('ddlEditParentListId');
    var lc = document.getElementById('ddlEditLevelCount');
    if (pl) pl.disabled = !!locked;
    if (lc) lc.disabled = !!locked;
}

document.addEventListener('DOMContentLoaded', function () {
    ddlApplyOwnershipUi();
    ddlLoad();
    var em = document.getElementById('ddlEditModal');
    if (em) em.addEventListener('hidden.bs.modal', function () { ddlSetEditListTypeLocked(false); });

    var ddlFilterOuTrigger = document.getElementById('ddlFilterOuTrigger');
    var ddlFilterOuPanel = document.getElementById('ddlFilterOuPanel');
    if (ddlFilterOuTrigger && ddlFilterOuPanel) {
        ddlFilterOuTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            ddlFilterOuTogglePanel();
        });
        ddlFilterOuPanel.addEventListener('click', function (e) {
            var expBtn = e.target.closest('.bnf-ou-tree-exp');
            if (expBtn) {
                e.preventDefault();
                e.stopPropagation();
                var eid = expBtn.getAttribute('data-exp');
                if (eid) {
                    ddlFilterOuExpanded[eid] = !ddlFilterOuExpanded[eid];
                    ddlRenderFilterOrgUnitTreePanel();
                }
                return;
            }
            var row = e.target.closest('.bnf-ou-tree-row');
            if (!row || !row.hasAttribute('data-id')) return;
            var idAttr = row.getAttribute('data-id');
            var hid = document.getElementById('ddlFilterOrgUnit');
            var lab = document.getElementById('ddlFilterOuLabel');
            if (hid) hid.value = idAttr === null ? '' : String(idAttr);
            if (lab) {
                if (!idAttr) lab.textContent = 'قائمة بالوحدات التنظيمية';
                else {
                    var uid = parseInt(idAttr, 10);
                    var u = ddlOrgUnits.find(function (x) { return x.id === uid; });
                    lab.textContent = u ? u.name : 'قائمة بالوحدات التنظيمية';
                }
            }
            ddlFilterOuClosePanel();
            ddlRenderFilterOrgUnitTreePanel();
            ddlApplyFilters();
        });
        document.addEventListener('click', function (e) {
            var wrap = document.querySelector('.ddl-filter-ou-wrap');
            var panel = document.getElementById('ddlFilterOuPanel');
            if (!wrap || !panel || panel.classList.contains('d-none')) return;
            if (!wrap.contains(e.target)) ddlFilterOuClosePanel();
        });
    }
});

async function ddlLoad() {
    try {
        var r = await apiFetch('/Dropdowns/GetDropdownLists');
        if (r && r.success) {
            ddlAll = r.data || [];
            ddlOrgUnits = r.organizationalUnits || [];
            ddlCurrentUser = r.currentUser || '';
            ddlIsAdmin = r.isAdmin === true;
            ddlCurrentOrgUnitId = r.currentOrgUnitId || 0;
            ddlApplyFilters();
            ddlSyncFilterOuTreeLabel();
            ddlApplyOwnershipUi();
        } else {
            document.getElementById('ddlBody').innerHTML =
                '<tr><td colspan="8">' + emptyState('bi-ui-checks-grid', 'لا توجد قوائم منسدلة', 'أنشئ قائمة منسدلة للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('ddlBody').innerHTML =
            '<tr><td colspan="8" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function ddlOuBuildTreeMap() {
    var ids = {};
    ddlOrgUnits.forEach(function (u) { ids[u.id] = true; });
    var byParent = {};
    ddlOrgUnits.forEach(function (u) {
        var pk = (u.parentId != null && u.parentId !== '' && ids[u.parentId]) ? String(u.parentId) : '';
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(function (k) {
        byParent[k].sort(function (a, b) {
            var sa = a.sortOrder != null ? a.sortOrder : 0;
            var sb = b.sortOrder != null ? b.sortOrder : 0;
            return sa !== sb ? sa - sb : (a.name || '').localeCompare(b.name || '', 'ar');
        });
    });
    return byParent;
}

function ddlRenderOuFilterTreeRows(byParent, parentKey, depth, selectedId, expandedMap) {
    var rows = byParent[parentKey] || [];
    var sel = selectedId !== undefined && selectedId !== null ? String(selectedId) : '';
    var html = '';
    rows.forEach(function (u) {
        var idStr = String(u.id);
        var children = byParent[idStr] || [];
        var hasChildren = children.length > 0;
        var expanded = !!expandedMap[idStr];
        var indent = depth * 22;
        var rowSel = String(sel) === idStr ? ' is-selected' : '';
        html += '<div class="bnf-ou-tree-row d-flex align-items-center' + rowSel + '" data-id="' + u.id + '" role="option" dir="rtl" style="padding:8px 10px; padding-right:' + (12 + indent) + 'px;">';
        if (hasChildren) {
            html += '<button type="button" class="bnf-ou-tree-exp" data-exp="' + idStr + '" aria-expanded="' + expanded + '" title="' + (expanded ? 'طي' : 'توسيع') + '">' + (expanded ? '−' : '+') + '</button>';
        } else {
            html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += '<span class="bnf-ou-tree-name flex-grow-1">' + esc(u.name) + '</span></div>';
        if (hasChildren && expanded) {
            html += ddlRenderOuFilterTreeRows(byParent, idStr, depth + 1, sel, expandedMap);
        }
    });
    return html;
}

function ddlFilterOuExpandAncestorsForSelection(selectId) {
    if (!selectId || isNaN(selectId)) return;
    var map = {};
    ddlOrgUnits.forEach(function (u) { map[u.id] = u; });
    var u = map[selectId];
    while (u && u.parentId != null && u.parentId !== '') {
        ddlFilterOuExpanded[String(u.parentId)] = true;
        u = map[u.parentId];
    }
}

function ddlRenderFilterOrgUnitTreePanel() {
    var panel = document.getElementById('ddlFilterOuPanel');
    if (!panel) return;
    if (!ddlOrgUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    var byParent = ddlOuBuildTreeMap();
    var selectedId = document.getElementById('ddlFilterOrgUnit') ? document.getElementById('ddlFilterOrgUnit').value : '';
    var allSel = !selectedId ? ' is-selected' : '';
    var html = '<div class="bnf-ou-tree-row d-flex align-items-center' + allSel + '" data-id="" role="option" dir="rtl" style="padding:8px 10px;padding-right:12px;">' +
        '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>' +
        '<span class="bnf-ou-tree-name flex-grow-1" style="font-weight:700;color:var(--gray-700);">كل الوحدات</span></div>';
    html += ddlRenderOuFilterTreeRows(byParent, '', 0, selectedId, ddlFilterOuExpanded);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function ddlFilterOuTogglePanel() {
    var panel = document.getElementById('ddlFilterOuPanel');
    var trig = document.getElementById('ddlFilterOuTrigger');
    if (!panel) return;
    if (panel.classList.contains('d-none')) {
        var cur = document.getElementById('ddlFilterOrgUnit') ? document.getElementById('ddlFilterOrgUnit').value : '';
        if (cur) ddlFilterOuExpandAncestorsForSelection(parseInt(cur, 10));
        ddlRenderFilterOrgUnitTreePanel();
        panel.classList.remove('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'true');
    } else {
        panel.classList.add('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'false');
    }
}

function ddlFilterOuClosePanel() {
    var panel = document.getElementById('ddlFilterOuPanel');
    var trig = document.getElementById('ddlFilterOuTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function ddlSyncFilterOuTreeLabel() {
    var hid = document.getElementById('ddlFilterOrgUnit');
    var lab = document.getElementById('ddlFilterOuLabel');
    if (!hid || !lab) return;
    var defLabel = 'قائمة بالوحدات التنظيمية';
    if (hid.value) {
        var u = ddlOrgUnits.find(function (x) { return String(x.id) === String(hid.value); });
        lab.textContent = u ? u.name : defLabel;
    } else {
        lab.textContent = defLabel;
    }
    ddlRenderFilterOrgUnitTreePanel();
}

function ddlApplyFilters() {
    var search = (document.getElementById('ddlSearchInput')?.value || '').trim().toLowerCase();
    var listType = document.getElementById('ddlFilterListType')?.value || '';
    var selectionType = document.getElementById('ddlFilterSelectionType')?.value || '';
    var ownership = document.getElementById('ddlFilterOwnership')?.value || '';
    var orgUnitId = parseInt(document.getElementById('ddlFilterOrgUnit')?.value || '0');

    ddlFiltered = ddlAll.filter(function (d) {
        if (search && !(d.name || '').toLowerCase().includes(search) && !(d.description || '').toLowerCase().includes(search))
            return false;
        if (listType && d.listType !== listType) return false;
        if (selectionType && d.selectionType !== selectionType) return false;
        if (ownership && d.ownership !== ownership) return false;
        if (orgUnitId > 0 && d.organizationalUnitId !== orgUnitId) return false;
        return true;
    });
    ddlRenderTable();
}

function ddlClearFilters() {
    document.getElementById('ddlSearchInput').value = '';
    document.getElementById('ddlFilterListType').value = '';
    document.getElementById('ddlFilterSelectionType').value = '';
    document.getElementById('ddlFilterOwnership').value = '';
    var ouHid = document.getElementById('ddlFilterOrgUnit');
    if (ouHid) ouHid.value = '';
    var flab = document.getElementById('ddlFilterOuLabel');
    if (flab) flab.textContent = 'قائمة بالوحدات التنظيمية';
    ddlFilterOuExpanded = {};
    ddlFilterOuClosePanel();
    ddlApplyFilters();
}

function ddlRenderTable() {
    var body = document.getElementById('ddlBody');
    if (ddlFiltered.length === 0) {
        body.innerHTML = '<tr><td colspan="8">' +
            emptyState('bi-ui-checks-grid', 'لا توجد قوائم منسدلة', 'لم يتم العثور على نتائج أو اضغط إنشاء قائمة منسدلة') +
            '</td></tr>';
        return;
    }

    var html = '';
    ddlFiltered.forEach(function (d, idx) {
        var safeName = esc(d.name || '').replace(/'/g, "\\'");
        var ownershipClass = d.ownership === 'عام' ? 'ddl-badge-public' : 'ddl-badge-private';
        var statusClass = d.isActive ? 'ddl-badge-active' : 'ddl-badge-inactive';
        var statusText = d.isActive ? 'مفعل' : 'معطل';
        var canModify = ddlCanModifyList(d);

        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;">' + (idx + 1) + '</td>' +
            '<td style="font-weight:700;">' + esc(d.name) + '</td>' +
            '<td style="text-align:center;">' + esc(d.listType) + '</td>' +
            '<td style="text-align:center;">' + esc(d.selectionType) + '</td>' +
            '<td>' + esc(d.organizationalUnitName || '') + '</td>' +
            '<td style="text-align:center;"><span class="' + ownershipClass + '">' + esc(d.ownership) + '</span></td>' +
            '<td style="text-align:center;"><span class="' + statusClass + '">' + statusText + '</span></td>' +
            '<td style="text-align:center;">' +
                '<div style="display:flex;gap:4px;align-items:center;justify-content:center;flex-wrap:wrap;">' +
                    '<button class="ddl-action-btn ddl-action-btn-detail" onclick="ddlShowDetails(' + d.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="ddl-action-btn ddl-action-btn-edit" onclick="ddlShowItems(' + d.id + ',\'' + safeName + '\')"><i class="bi bi-list-check"></i> عناصر</button>';
        if (canModify) {
            if (!ddlIsListLinkedToForm(d)) {
                html += '<button class="ddl-action-btn ddl-action-btn-edit" onclick="ddlShowEditModal(' + d.id + ')"><i class="bi bi-pencil"></i> تحديث</button>';
            }
            html += '<button class="ddl-action-btn ddl-action-btn-delete" onclick="ddlShowDeleteModal(' + d.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>';
        }
        html += '</div>' +
            '</td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

// ─── Create Modal ────────────────────────────────────────────────────────────
function ddlShowCreateModal() {
    document.getElementById('ddlCreateName').value = '';
    document.getElementById('ddlCreateDescription').value = '';
    var pubC = document.getElementById('ddlCreateOwnershipPublic');
    if (pubC) pubC.checked = true;
    ddlApplyOwnershipUi();
    document.getElementById('ddlCreateListTypeIndependent').checked = true;
    document.getElementById('ddlCreateParentListId').value = '';
    document.getElementById('ddlCreateLevelCount').value = '2';
    document.querySelector('input[name="ddlCreateSelectionType"][value="خيار محدد"]').checked = true;
    document.querySelector('input[name="ddlCreateIsActive"][value="1"]').checked = true;
    document.getElementById('ddlCreateError').classList.add('d-none');
    ddlToggleCreateTypeFields();
    new bootstrap.Modal(document.getElementById('ddlCreateModal')).show();
}

async function ddlLoadIndependentListsForCreate() {
    try {
        var r = await apiFetch('/Dropdowns/GetIndependentLists');
        if (r && r.success) {
            ddlIndependentLists = r.data || [];
            var sel = document.getElementById('ddlCreateParentListId');
            var html = '<option value="">-- اختر --</option>';
            ddlIndependentLists.forEach(function (l) {
                html += '<option value="' + l.id + '">' + esc(l.name) + '</option>';
            });
            sel.innerHTML = html;
        }
    } catch (e) { }
}

function ddlToggleCreateTypeFields() {
    var type = document.querySelector('input[name="ddlCreateListType"]:checked')?.value || 'قائمة مستقلة';
    document.getElementById('ddlCreateParentListWrap').style.display = type === 'قائمة فرعية' ? 'block' : 'none';
    document.getElementById('ddlCreateLevelWrap').style.display = type === 'قائمة هرمية' ? 'block' : 'none';
    if (type === 'قائمة فرعية') ddlLoadIndependentListsForCreate();
}

async function ddlSubmitCreate() {
    var errEl = document.getElementById('ddlCreateError');
    errEl.classList.add('d-none');

    var name = document.getElementById('ddlCreateName').value.trim();
    if (!name) {
        errEl.textContent = 'اسم القائمة المنسدلة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (ddlIsDuplicateListName(name)) {
        errEl.textContent = DDL_LIST_NAME_DUP_MSG;
        errEl.classList.remove('d-none');
        return;
    }

    var listType = document.querySelector('input[name="ddlCreateListType"]:checked')?.value || 'قائمة مستقلة';

    if (listType === 'قائمة فرعية') {
        var parentVal = document.getElementById('ddlCreateParentListId').value;
        if (!parentVal || parentVal === '') {
            errEl.textContent = 'يجب اختيار القائمة المستقلة للقائمة الفرعية';
            errEl.classList.remove('d-none');
            return;
        }
    }

    var ownership = (document.querySelector('input[name="ddlCreateOwnership"]:checked')?.value) || 'عام';
    if (ddlIsAdmin) ownership = 'عام';
    var parentListId = listType === 'قائمة فرعية' ? parseInt(document.getElementById('ddlCreateParentListId').value || '0') : null;
    var levelCount = listType === 'قائمة هرمية' ? parseInt(document.getElementById('ddlCreateLevelCount').value || '2') : 2;
    if (listType === 'قائمة هرمية') levelCount = Math.min(4, Math.max(2, levelCount));

    var body = {
        name: name,
        description: document.getElementById('ddlCreateDescription').value.trim(),
        ownership: ownership,
        listType: listType,
        parentListId: parentListId,
        levelCount: levelCount,
        selectionType: document.querySelector('input[name="ddlCreateSelectionType"]:checked')?.value || 'خيار محدد',
        isActive: document.querySelector('input[name="ddlCreateIsActive"]:checked')?.value === '1'
    };

    var r = await apiFetch('/Dropdowns/AddDropdownList', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ddlCreateModal')).hide();
        showToast(r.message, 'success');
        await ddlLoad();
        if (r.id) ddlShowItems(r.id, name);
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

// ─── Items Modal ─────────────────────────────────────────────────────────────
function ddlShowItems(listId, listName) {
    document.getElementById('ddlItemsListId').value = listId;
    document.getElementById('ddlItemsListName').textContent = listName || '';
    document.getElementById('ddlAddItemForm').style.display = 'none';

    var listData = ddlAll.find(function (x) { return x.id === listId; });
    var listType = listData ? listData.listType : 'قائمة مستقلة';
    var levelCount = listData ? (listData.levelCount || 2) : 2;
    var parentListId = listData ? (listData.parentListId || '') : '';
    var createdBy = listData ? (listData.createdBy || '') : '';

    document.getElementById('ddlItemsListType').value = listType;
    document.getElementById('ddlItemsLevelCount').value = levelCount;
    document.getElementById('ddlItemsParentListId').value = parentListId;
    document.getElementById('ddlItemsCreatedBy').value = createdBy;

    if (listType === 'قائمة هرمية') {
        document.getElementById('ddlNonHierContent').style.display = 'none';
        document.getElementById('ddlHierContent').style.display = '';
        ddlInitHierarchy(listId);
    } else {
        document.getElementById('ddlNonHierContent').style.display = '';
        document.getElementById('ddlHierContent').style.display = 'none';
        ddlParentListItemsCache = [];
        if (listType === 'قائمة فرعية' && parentListId) {
            ddlLoadParentListItems(parentListId);
        }
        ddlLoadItems(listId);
    }

    new bootstrap.Modal(document.getElementById('ddlItemsModal')).show();
}

// ─── Non-Hierarchy Items (Independent + Sub) ────────────────────────────────
async function ddlLoadParentListItems(parentListId) {
    try {
        var r = await apiFetch('/Dropdowns/GetDropdownItems?listId=' + parentListId);
        if (r && r.success) {
            ddlParentListItemsCache = (r.data || []).filter(function (item) { return item.isActive; });
            var sel = document.getElementById('ddlItemParentItemId');
            var html = '<option value="">-- اختر عنصر القائمة المستقلة --</option>';
            ddlParentListItemsCache.forEach(function (item) {
                html += '<option value="' + item.id + '">' + esc(item.itemText) + '</option>';
            });
            sel.innerHTML = html;
        }
    } catch (e) { }
}

async function ddlLoadItems(listId) {
    try {
        var r = await apiFetch('/Dropdowns/GetDropdownItems?listId=' + listId);
        var body = document.getElementById('ddlItemsBody');
        var emptyEl = document.getElementById('ddlItemsEmpty');
        var tableWrap = document.getElementById('ddlItemsTableWrap');
        var listType = document.getElementById('ddlItemsListType').value;
        var isSubList = listType === 'قائمة فرعية';
        var listData = ddlAll.find(function (x) { return x.id === listId; });
        var canModify = ddlCanModifyList(listData);
        var canEditItems = canModify && !ddlIsListLinkedToForm(listData);

        var addBtn = document.getElementById('ddlAddItemBtn');
        if (addBtn) addBtn.style.display = canModify ? '' : 'none';

        var theadRow = tableWrap.querySelector('thead tr');
        if (isSubList) {
            theadRow.innerHTML = '<th>#</th><th>عنصر القائمة المستقلة</th><th>العنصر</th><th>الوصف</th><th>اللون</th><th>التفعيل</th>' + (canModify ? '<th>الإجراءات</th>' : '');
        } else {
            theadRow.innerHTML = '<th>#</th><th>العنصر</th><th>الوصف</th><th>اللون</th><th>التفعيل</th>' + (canModify ? '<th>الإجراءات</th>' : '');
        }

        ddlItemsAllCache = (r && r.success && r.data) ? (r.data || []) : [];
        var activeItems = ddlItemsAllCache.filter(function (item) { return item.isActive; });

        if (r && r.success && activeItems.length > 0) {
            var html = '';
            activeItems.forEach(function (item, idx) {
                var statusClass = item.isActive ? 'ddl-badge-active' : 'ddl-badge-inactive';
                html += '<tr>';
                html += '<td>' + (idx + 1) + '</td>';
                if (isSubList) {
                    html += '<td style="font-weight:700;color:var(--sa-700);">' + esc(item.parentItemText || '—') + '</td>';
                }
                html += '<td>' + esc(item.itemText) + '</td>' +
                    '<td>' + esc(item.description || '') + '</td>' +
                    '<td><span class="ddl-color-circle" style="background:' + esc(item.color || '#25935F') + ';"></span></td>' +
                    '<td><span class="' + statusClass + '">' + (item.isActive ? 'مفعل' : 'معطل') + '</span></td>';
                if (canModify) {
                    var safeItemName = esc(item.itemText || '').replace(/'/g, "\\'");
                    html += '<td>';
                    if (canEditItems) {
                        html += '<button class="ddl-action-btn ddl-action-btn-edit btn-sm" onclick="ddlEditItemInline(' + item.id + ')">تحديث</button> ';
                    }
                    html += '<button class="ddl-action-btn ddl-action-btn-delete btn-sm" onclick="ddlShowDeleteItemModal(' + item.id + ',\'' + safeItemName + '\')">حذف</button></td>';
                }
                html += '</tr>';
            });
            body.innerHTML = html;
            tableWrap.style.display = '';
            emptyEl.style.display = 'none';
        } else {
            body.innerHTML = '';
            tableWrap.style.display = 'none';
            emptyEl.style.display = 'block';
        }
    } catch (e) {
        document.getElementById('ddlItemsBody').innerHTML = '<tr><td colspan="7" class="text-danger">خطأ في تحميل العناصر</td></tr>';
    }
}

function ddlShowAddItemForm() {
    var listType = document.getElementById('ddlItemsListType').value;
    var isSubList = listType === 'قائمة فرعية';

    document.getElementById('ddlItemSubListFields').style.display = isSubList ? 'block' : 'none';
    if (isSubList) document.getElementById('ddlItemParentItemId').value = '';

    document.getElementById('ddlItemText').value = '';
    document.getElementById('ddlItemDescription').value = '';
    document.getElementById('ddlItemColor').value = '#25935F';
    document.querySelector('input[name="ddlItemIsActive"][value="1"]').checked = true;

    var btn = document.getElementById('ddlItemSubmitBtn');
    btn.textContent = 'إضافة';
    btn.onclick = ddlSubmitNormalItem;
    document.getElementById('ddlAddItemForm').style.display = 'block';
}

function ddlHideAddItemForm() {
    document.getElementById('ddlAddItemForm').style.display = 'none';
    var btn = document.getElementById('ddlItemSubmitBtn');
    if (btn) { btn.textContent = 'إضافة'; btn.onclick = ddlSubmitNormalItem; }
}

async function ddlSubmitNormalItem() {
    var listId = parseInt(document.getElementById('ddlItemsListId').value);
    var listType = document.getElementById('ddlItemsListType').value;
    var isSubList = listType === 'قائمة فرعية';
    var itemText = document.getElementById('ddlItemText').value.trim();
    var errEl = document.getElementById('ddlItemsError');
    errEl.classList.add('d-none');

    if (isSubList) {
        var parentItemId = document.getElementById('ddlItemParentItemId').value;
        if (!parentItemId || parentItemId === '') {
            errEl.textContent = 'يجب اختيار عنصر القائمة المستقلة';
            errEl.classList.remove('d-none');
            return;
        }
    }

    if (!itemText) {
        errEl.textContent = 'العنصر مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (ddlIsDuplicateItemText(itemText)) {
        errEl.textContent = DDL_ITEM_TEXT_DUP_MSG;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        dropdownListId: listId,
        itemText: itemText,
        description: document.getElementById('ddlItemDescription').value.trim(),
        color: document.getElementById('ddlItemColor').value || '#25935F',
        isActive: document.querySelector('input[name="ddlItemIsActive"]:checked')?.value === '1',
        parentItemId: isSubList ? parseInt(document.getElementById('ddlItemParentItemId').value) : null
    };

    var r = await apiFetch('/Dropdowns/AddDropdownItem', 'POST', body);
    if (r && r.success) {
        showToast(r.message, 'success');
        ddlHideAddItemForm();
        ddlLoadItems(listId);
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

async function ddlEditItemInline(id) {
    var listId = parseInt(document.getElementById('ddlItemsListId').value);
    var listType = document.getElementById('ddlItemsListType').value;
    var isSubList = listType === 'قائمة فرعية';

    try {
        var r = await apiFetch('/Dropdowns/GetDropdownItems?listId=' + listId);
        if (!r || !r.success) return;
        var item = r.data.find(function (i) { return i.id === id; });
        if (!item) return;

        document.getElementById('ddlItemSubListFields').style.display = isSubList ? 'block' : 'none';
        if (isSubList && item.parentItemId) {
            document.getElementById('ddlItemParentItemId').value = item.parentItemId;
        }

        document.getElementById('ddlItemText').value = item.itemText || '';
        document.getElementById('ddlItemDescription').value = item.description || '';
        document.getElementById('ddlItemColor').value = item.color || '#25935F';
        document.querySelector('input[name="ddlItemIsActive"][value="' + (item.isActive ? '1' : '0') + '"]').checked = true;

        var btn = document.getElementById('ddlItemSubmitBtn');
        btn.textContent = 'تحديث';
        btn.onclick = function () { ddlSubmitUpdateItem(id); };
        document.getElementById('ddlAddItemForm').style.display = 'block';
    } catch (e) {}
}

async function ddlSubmitUpdateItem(id) {
    var listId = parseInt(document.getElementById('ddlItemsListId').value);
    var listType = document.getElementById('ddlItemsListType').value;
    var isSubList = listType === 'قائمة فرعية';
    var errEl = document.getElementById('ddlItemsError');
    errEl.classList.add('d-none');

    if (isSubList) {
        var parentItemId = document.getElementById('ddlItemParentItemId').value;
        if (!parentItemId || parentItemId === '') {
            errEl.textContent = 'يجب اختيار عنصر القائمة المستقلة';
            errEl.classList.remove('d-none');
            return;
        }
    }
    var itemText = document.getElementById('ddlItemText').value.trim();
    if (!itemText) {
        errEl.textContent = 'العنصر مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (ddlIsDuplicateItemText(itemText, id)) {
        errEl.textContent = DDL_ITEM_TEXT_DUP_MSG;
        errEl.classList.remove('d-none');
        return;
    }
    var body = {
        id: id,
        itemText: itemText,
        description: document.getElementById('ddlItemDescription').value.trim(),
        color: document.getElementById('ddlItemColor').value || '#25935F',
        isActive: document.querySelector('input[name="ddlItemIsActive"]:checked')?.value === '1',
        parentItemId: isSubList ? parseInt(document.getElementById('ddlItemParentItemId').value) : null
    };

    var r = await apiFetch('/Dropdowns/UpdateDropdownItem', 'POST', body);
    if (r && r.success) {
        showToast(r.message, 'success');
        ddlHideAddItemForm();
        ddlLoadItems(listId);
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

async function ddlDeleteItem(id, name) {
    ddlShowDeleteItemModal(id, name);
}

function ddlShowDeleteItemModal(id, name) {
    document.getElementById('ddlDeleteItemId').value = id;
    document.getElementById('ddlDeleteItemNameLabel').textContent = name || '';
    document.getElementById('ddlDeleteItemError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('ddlDeleteItemModal')).show();
}

async function ddlSubmitDeleteItem() {
    var id = parseInt(document.getElementById('ddlDeleteItemId').value, 10);
    var errEl = document.getElementById('ddlDeleteItemError');
    errEl.classList.add('d-none');
    var listId = parseInt(document.getElementById('ddlItemsListId').value, 10);
    var listType = document.getElementById('ddlItemsListType').value || '';

    var r = await apiFetch('/Dropdowns/DeleteDropdownItem', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ddlDeleteItemModal')).hide();
        showToast(r.message, 'success');
        if (listType === 'قائمة هرمية') {
            await ddlLoadHierItems(listId);
        } else {
            ddlLoadItems(listId);
        }
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

// ─── Hierarchy Items ─────────────────────────────────────────────────────────
async function ddlInitHierarchy(listId) {
    ddlHierLevelCount = parseInt(document.getElementById('ddlItemsLevelCount').value || '2');
    var listData = ddlAll.find(function (x) { return x.id === listId; });

    ddlHierLevelNames = [];
    try { ddlHierLevelNames = JSON.parse(listData.levelNamesJson || '[]'); } catch (e) {}

    if (ddlHierLevelNames.length < ddlHierLevelCount) {
        ddlShowLevelNamesSetup();
    } else {
        document.getElementById('ddlHierLevelSetup').style.display = 'none';
        await ddlLoadHierItems(listId);
    }
}

function ddlShowLevelNamesSetup() {
    var html = '';
    for (var i = 0; i < ddlHierLevelCount; i++) {
        var existing = ddlHierLevelNames[i] || '';
        html += '<div class="mb-2">' +
            '<label class="form-label">اسم المستوى ' + (i + 1) + '<span class="required-star">*</span></label>' +
            '<input type="text" class="form-control" id="ddlLevelName' + (i + 1) + '" value="' + esc(existing) + '">' +
            '</div>';
    }
    document.getElementById('ddlHierLevelNameInputs').innerHTML = html;
    document.getElementById('ddlHierLevelSetup').style.display = '';
    document.getElementById('ddlHierItemsSection').style.display = 'none';
}

function ddlEditLevelNames() {
    ddlShowLevelNamesSetup();
}

async function ddlSaveLevelNames() {
    var names = [];
    for (var i = 0; i < ddlHierLevelCount; i++) {
        var val = (document.getElementById('ddlLevelName' + (i + 1))?.value || '').trim();
        if (!val) {
            showToast('يجب إدخال اسم لجميع المستويات', 'danger');
            return;
        }
        names.push(val);
    }

    var listId = parseInt(document.getElementById('ddlItemsListId').value);
    var r = await apiFetch('/Dropdowns/SaveHierarchyLevelNames', 'POST', {
        id: listId,
        levelNamesJson: JSON.stringify(names)
    });

    if (r && r.success) {
        ddlHierLevelNames = names;
        var listData = ddlAll.find(function (x) { return x.id === listId; });
        if (listData) listData.levelNamesJson = JSON.stringify(names);
        showToast(r.message, 'success');
        document.getElementById('ddlHierLevelSetup').style.display = 'none';
        await ddlLoadHierItems(listId);
    } else {
        showToast((r && r.message) || 'حدث خطأ', 'danger');
    }
}

async function ddlLoadHierItems(listId) {
    try {
        var r = await apiFetch('/Dropdowns/GetDropdownItems?listId=' + listId);
        ddlHierItemsAllCache = (r && r.success) ? (r.data || []) : [];
        ddlHierItems = ddlHierItemsAllCache.filter(function (item) { return item.isActive; });
    } catch (e) {
        ddlHierItemsAllCache = [];
        ddlHierItems = [];
    }

    document.getElementById('ddlHierItemsSection').style.display = '';
    document.getElementById('ddlHierAddForm').style.display = 'none';

    var listData = ddlAll.find(function (x) { return x.id === listId; });
    var canModify = ddlCanModifyList(listData);
    var canEditItems = canModify && !ddlIsListLinkedToForm(listData);
    var addBtn = document.getElementById('ddlHierAddBtn');
    if (addBtn) addBtn.style.display = canModify ? '' : 'none';
    var editNamesBtn = document.getElementById('ddlHierEditLevelNamesBtn');
    if (editNamesBtn) editNamesBtn.style.display = canModify ? '' : 'none';

    ddlRenderHierLevelBadges();
    ddlRenderHierLevelTabs();
    ddlRenderHierTree(canEditItems);
}

function ddlRenderHierLevelBadges() {
    var html = '';
    for (var i = 0; i < ddlHierLevelNames.length; i++) {
        if (i > 0) html += ' <i class="bi bi-arrow-left" style="font-size:12px;color:var(--gray-400);"></i> ';
        html += '<span class="ddl-tree-level-badge">' + esc(ddlHierLevelNames[i]) + '</span>';
    }
    document.getElementById('ddlHierLevelBadges').innerHTML = html;
}

function ddlGetLevelItemCount(levelNum) {
    return ddlHierItems.filter(function (i) {
        return (i.levelNumber === levelNum) || (levelNum === 1 && (i.levelNumber <= 1) && !i.parentItemId);
    }).length;
}

function ddlCanAddToLevel(levelNum) {
    if (levelNum <= 1) return true;
    return ddlGetLevelItemCount(levelNum - 1) > 0;
}

function ddlRenderHierLevelTabs() {
    var container = document.getElementById('ddlHierLevelTabs');
    var html = '';
    for (var i = 0; i < ddlHierLevelCount; i++) {
        var lev = i + 1;
        var levelName = ddlHierLevelNames[i] || ('المستوى ' + lev);
        var canAdd = ddlCanAddToLevel(lev);
        var count = ddlGetLevelItemCount(lev);
        var isActive = ddlHierCurrentLevel === lev;
        html += '<button type="button" class="ddl-level-tab' + (isActive ? ' active' : '') + (canAdd ? '' : ' disabled') + '" ' +
            'data-level="' + lev + '" onclick="ddlSelectHierLevel(' + lev + ')" title="' + (canAdd ? 'أضف عناصر ' + esc(levelName) : 'أضف عناصر للمستوى السابق أولاً') + '">' +
            esc(levelName) + (count > 0 ? ' (' + count + ')' : '') +
            '</button>';
    }
    container.innerHTML = html;
}

function ddlSelectHierLevel(levelNum) {
    if (!ddlCanAddToLevel(levelNum)) return;
    ddlHierCurrentLevel = levelNum;
    ddlRenderHierLevelTabs();
    ddlRefreshHierFormForLevel();
    var formEl = document.getElementById('ddlHierAddForm');
    if (formEl.style.display === 'none') {
        document.getElementById('ddlHierItemText').value = '';
        document.getElementById('ddlHierItemDesc').value = '';
        document.getElementById('ddlHierItemColor').value = '#25935F';
        document.querySelector('input[name="ddlHierItemActive"][value="1"]').checked = true;
        var levelName = ddlHierLevelNames[levelNum - 1] || ('المستوى ' + levelNum);
        document.getElementById('ddlHierFormTitle').textContent = 'إضافة عنصر جديد - ' + levelName;
        document.getElementById('ddlHierSubmitBtn').textContent = 'إضافة';
        document.getElementById('ddlHierSubmitBtn').onclick = ddlSubmitHierItem;
        formEl.style.display = 'block';
    }
}

function ddlRenderHierTree(canEditItems) {
    var treeWrap = document.getElementById('ddlHierTreeWrap');
    var emptyEl = document.getElementById('ddlHierEmpty');
    var listId = parseInt(document.getElementById('ddlItemsListId').value, 10);
    var listData = ddlAll.find(function (x) { return x.id === listId; });
    var canModify = ddlCanModifyList(listData);
    if (canEditItems === undefined) {
        canEditItems = canModify && !ddlIsListLinkedToForm(listData);
    }

    if (ddlHierItems.length === 0) {
        treeWrap.innerHTML = '';
        treeWrap.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
    }

    treeWrap.style.display = '';
    emptyEl.style.display = 'none';

    var tree = ddlBuildTree(ddlHierItems);
    var rows = ddlRenderTreeRows(tree, 0, canModify, canEditItems);

    var html = '<table class="ddl-tree-table"><thead><tr>' +
        '<th style="text-align:right;">العنصر</th><th>المستوى</th><th>الوصف</th><th>اللون</th><th>التفعيل</th>' +
        (canModify ? '<th>الإجراءات</th>' : '') +
        '</tr></thead><tbody>' + rows + '</tbody></table>';

    treeWrap.innerHTML = html;
}

function ddlBuildTree(items) {
    var roots = items.filter(function (i) {
        return (i.levelNumber <= 1 || i.levelNumber === 0) && !i.parentItemId;
    });

    function getChildren(parentId) {
        return items.filter(function (i) { return i.parentItemId === parentId; });
    }

    function buildNode(item) {
        return { item: item, children: getChildren(item.id).map(buildNode) };
    }

    return roots.map(buildNode);
}

function ddlRenderTreeRows(nodes, depth, canModify, canEditItems) {
    var html = '';
    nodes.forEach(function (node) {
        var item = node.item;
        var indent = depth * 24;
        var statusClass = item.isActive ? 'ddl-badge-active' : 'ddl-badge-inactive';
        var levelName = ddlHierLevelNames[item.levelNumber - 1] || ddlHierLevelNames[(depth < ddlHierLevelNames.length ? depth : ddlHierLevelNames.length - 1)] || '';
        var prefix = depth > 0 ? '└ ' : '';

        html += '<tr>' +
            '<td style="padding-right:' + (12 + indent) + 'px;font-weight:' + (depth === 0 ? '800' : '600') + ';">' +
                '<span style="color:var(--gray-400);font-family:monospace;">' + prefix + '</span>' + esc(item.itemText) +
            '</td>' +
            '<td><span class="ddl-tree-level-badge">' + esc(levelName) + '</span></td>' +
            '<td>' + esc(item.description || '') + '</td>' +
            '<td><span class="ddl-color-circle" style="background:' + esc(item.color || '#25935F') + ';"></span></td>' +
            '<td><span class="' + statusClass + '">' + (item.isActive ? 'مفعل' : 'معطل') + '</span></td>';

        if (canModify) {
            var safeHierItemName = esc(item.itemText || '').replace(/'/g, "\\'");
            html += '<td>';
            if (canEditItems) {
                html += '<button class="ddl-action-btn ddl-action-btn-edit btn-sm" onclick="ddlEditHierItem(' + item.id + ')">تحديث</button> ';
            }
            html += '<button class="ddl-action-btn ddl-action-btn-delete btn-sm" onclick="ddlShowDeleteItemModal(' + item.id + ',\'' + safeHierItemName + '\')">حذف</button>' +
                '</td>';
        }
        html += '</tr>';

        if (node.children.length > 0) {
            html += ddlRenderTreeRows(node.children, depth + 1, canModify, canEditItems);
        }
    });
    return html;
}

// ─── Hierarchy Add/Edit Form ─────────────────────────────────────────────────
function ddlGetSuggestedLevel() {
    for (var i = 1; i <= ddlHierLevelCount; i++) {
        if (ddlCanAddToLevel(i)) return i;
    }
    return 1;
}

function ddlShowHierAddForm() {
    ddlHierCurrentLevel = ddlGetSuggestedLevel();
    ddlRenderHierLevelTabs();
    ddlRefreshHierFormForLevel();
    document.getElementById('ddlHierItemText').value = '';
    document.getElementById('ddlHierItemDesc').value = '';
    document.getElementById('ddlHierItemColor').value = '#25935F';
    document.querySelector('input[name="ddlHierItemActive"][value="1"]').checked = true;

    var btn = document.getElementById('ddlHierSubmitBtn');
    btn.textContent = 'إضافة';
    btn.onclick = ddlSubmitHierItem;

    var levelName = ddlHierLevelNames[ddlHierCurrentLevel - 1] || ('المستوى ' + ddlHierCurrentLevel);
    document.getElementById('ddlHierFormTitle').textContent = 'إضافة عنصر جديد - ' + levelName;
    document.getElementById('ddlHierAddForm').style.display = 'block';
}

function ddlRefreshHierFormForLevel() {
    var level = ddlHierCurrentLevel;
    var container = document.getElementById('ddlHierParentSelectors');

    if (level <= 1) {
        container.innerHTML = '';
        return;
    }

    var html = '';
    for (var i = 1; i < level; i++) {
        html += '<div class="mb-3">' +
            '<label class="form-label">' + esc(ddlHierLevelNames[i - 1] || ('المستوى ' + i)) + '<span class="required-star">*</span></label>' +
            '<select class="form-select" id="ddlHierParent' + i + '" onchange="ddlOnHierParentChange(' + i + ')">' +
            '<option value="">-- اختر --</option>' +
            '</select>' +
            '</div>';
    }
    container.innerHTML = html;
    ddlPopulateHierParentDropdown(1);
}

function ddlHideHierAddForm() {
    document.getElementById('ddlHierAddForm').style.display = 'none';
    var btn = document.getElementById('ddlHierSubmitBtn');
    if (btn) { btn.textContent = 'إضافة'; btn.onclick = ddlSubmitHierItem; }
}

function ddlPopulateHierParentDropdown(level) {
    var sel = document.getElementById('ddlHierParent' + level);
    if (!sel) return;

    var items;
    if (level === 1) {
        items = ddlHierItems.filter(function (i) {
            return (i.levelNumber === 1 || (i.levelNumber <= 1 && !i.parentItemId));
        });
    } else {
        var parentId = parseInt(document.getElementById('ddlHierParent' + (level - 1))?.value || '0');
        if (!parentId) {
            sel.innerHTML = '<option value="">-- اختر --</option>';
            return;
        }
        items = ddlHierItems.filter(function (i) { return i.levelNumber === level && i.parentItemId === parentId; });
    }

    var html = '<option value="">-- اختر --</option>';
    items.forEach(function (item) {
        html += '<option value="' + item.id + '">' + esc(item.itemText) + '</option>';
    });
    sel.innerHTML = html;
}

function ddlOnHierParentChange(changedLevel) {
    var targetLevel = ddlHierCurrentLevel;
    for (var i = changedLevel + 1; i < targetLevel; i++) {
        var sel = document.getElementById('ddlHierParent' + i);
        if (sel) sel.innerHTML = '<option value="">-- اختر --</option>';
    }
    if (changedLevel + 1 < targetLevel) {
        ddlPopulateHierParentDropdown(changedLevel + 1);
    }
}

async function ddlSubmitHierItem() {
    var listId = parseInt(document.getElementById('ddlItemsListId').value);
    var level = ddlHierCurrentLevel;
    var errEl = document.getElementById('ddlItemsError');
    errEl.classList.add('d-none');

    var parentItemId = null;
    if (level > 1) {
        parentItemId = parseInt(document.getElementById('ddlHierParent' + (level - 1))?.value || '0');
        if (!parentItemId) {
            errEl.textContent = 'يجب اختيار عنصر ' + (ddlHierLevelNames[level - 2] || 'المستوى السابق');
            errEl.classList.remove('d-none');
            return;
        }
    }

    var itemText = document.getElementById('ddlHierItemText').value.trim();
    if (!itemText) {
        errEl.textContent = 'العنصر مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (ddlIsDuplicateItemText(itemText)) {
        errEl.textContent = DDL_ITEM_TEXT_DUP_MSG;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        dropdownListId: listId,
        itemText: itemText,
        description: document.getElementById('ddlHierItemDesc').value.trim(),
        color: document.getElementById('ddlHierItemColor').value || '#25935F',
        isActive: document.querySelector('input[name="ddlHierItemActive"]:checked')?.value === '1',
        parentItemId: parentItemId,
        levelNumber: level
    };

    var r = await apiFetch('/Dropdowns/AddDropdownItem', 'POST', body);
    if (r && r.success) {
        showToast(r.message, 'success');
        await ddlLoadHierItems(listId);
        document.getElementById('ddlHierItemText').value = '';
        document.getElementById('ddlHierItemDesc').value = '';
        ddlRenderHierLevelTabs();
        ddlRefreshHierFormForLevel();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

function ddlGetParentChain(item) {
    var chain = [];
    var current = item;
    while (current && current.parentItemId) {
        chain.unshift(current.parentItemId);
        current = ddlHierItems.find(function (i) { return i.id === current.parentItemId; });
    }
    return chain;
}

function ddlEditHierItem(id) {
    var item = ddlHierItems.find(function (i) { return i.id === id; });
    if (!item) return;

    ddlHierCurrentLevel = item.levelNumber || 1;
    ddlRenderHierLevelTabs();
    ddlRefreshHierFormForLevel();

    if (item.levelNumber > 1) {
        var chain = ddlGetParentChain(item);
        for (var i = 0; i < chain.length; i++) {
            var sel = document.getElementById('ddlHierParent' + (i + 1));
            if (sel) sel.value = chain[i];
            if (i + 2 < item.levelNumber) {
                ddlPopulateHierParentDropdown(i + 2);
            }
        }
    }

    document.getElementById('ddlHierItemText').value = item.itemText || '';
    document.getElementById('ddlHierItemDesc').value = item.description || '';
    document.getElementById('ddlHierItemColor').value = item.color || '#25935F';
    document.querySelector('input[name="ddlHierItemActive"][value="' + (item.isActive ? '1' : '0') + '"]').checked = true;

    var levelName = ddlHierLevelNames[ddlHierCurrentLevel - 1] || ('المستوى ' + ddlHierCurrentLevel);
    document.getElementById('ddlHierFormTitle').textContent = 'تحديث عنصر - ' + levelName;

    var btn = document.getElementById('ddlHierSubmitBtn');
    btn.textContent = 'تحديث';
    btn.onclick = function () { ddlSubmitUpdateHierItem(id); };

    document.getElementById('ddlHierAddForm').style.display = 'block';
}

async function ddlSubmitUpdateHierItem(id) {
    var listId = parseInt(document.getElementById('ddlItemsListId').value);
    var level = ddlHierCurrentLevel;
    var errEl = document.getElementById('ddlItemsError');
    errEl.classList.add('d-none');

    var parentItemId = null;
    if (level > 1) {
        parentItemId = parseInt(document.getElementById('ddlHierParent' + (level - 1))?.value || '0');
        if (!parentItemId) {
            errEl.textContent = 'يجب اختيار عنصر ' + (ddlHierLevelNames[level - 2] || 'المستوى السابق');
            errEl.classList.remove('d-none');
            return;
        }
    }

    var itemText = document.getElementById('ddlHierItemText').value.trim();
    if (!itemText) {
        errEl.textContent = 'العنصر مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (ddlIsDuplicateItemText(itemText, id)) {
        errEl.textContent = DDL_ITEM_TEXT_DUP_MSG;
        errEl.classList.remove('d-none');
        return;
    }

    var body = {
        id: id,
        itemText: itemText,
        description: document.getElementById('ddlHierItemDesc').value.trim(),
        color: document.getElementById('ddlHierItemColor').value || '#25935F',
        isActive: document.querySelector('input[name="ddlHierItemActive"]:checked')?.value === '1',
        parentItemId: parentItemId
    };

    var r = await apiFetch('/Dropdowns/UpdateDropdownItem', 'POST', body);
    if (r && r.success) {
        showToast(r.message, 'success');
        ddlHideHierAddForm();
        await ddlLoadHierItems(listId);
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

async function ddlDeleteHierItem(id, name) {
    ddlShowDeleteItemModal(id, name);
}

// ─── Details Modal ───────────────────────────────────────────────────────────
async function ddlShowDetails(id) {
    try {
        var r = await apiFetch('/Dropdowns/GetDropdownListDetails?id=' + id);
        if (r && r.success && r.data) {
            var d = r.data;
            var isSubList = d.listType === 'قائمة فرعية';
            var isHierarchy = d.listType === 'قائمة هرمية';

            var parentItems = [];
            if (isSubList && d.parentListId) {
                try {
                    var pr = await apiFetch('/Dropdowns/GetDropdownItems?listId=' + d.parentListId);
                    if (pr && pr.success) parentItems = pr.data || [];
                } catch (e) {}
            }

            var itemsHtml = '';
            if (d.items && d.items.length > 0) {
                if (isHierarchy) {
                    var hierLevelNames = [];
                    try { hierLevelNames = JSON.parse(d.levelNamesJson || '[]'); } catch (e) {}

                    if (hierLevelNames.length > 0) {
                        var badgesHtml = '<div class="ddl-hier-badges mb-3">';
                        for (var b = 0; b < hierLevelNames.length; b++) {
                            if (b > 0) badgesHtml += ' <i class="bi bi-arrow-left" style="font-size:12px;color:var(--gray-400);"></i> ';
                            badgesHtml += '<span class="ddl-tree-level-badge">' + esc(hierLevelNames[b]) + '</span>';
                        }
                        badgesHtml += '</div>';
                        itemsHtml += badgesHtml;
                    }

                    var tree = ddlBuildTreeFromItems(d.items);
                    var treeRows = ddlRenderDetailTreeRows(tree, 0, hierLevelNames);
                    itemsHtml += '<table class="ddl-tree-table"><thead><tr>' +
                        '<th style="text-align:right;">العنصر</th><th>المستوى</th><th>الوصف</th><th>اللون</th><th>التفعيل</th>' +
                        '</tr></thead><tbody>' + treeRows + '</tbody></table>';
                } else {
                    var thRow = '<th>#</th>';
                    if (isSubList) thRow += '<th>عنصر القائمة المستقلة</th>';
                    thRow += '<th>العنصر</th><th>الوصف</th><th>اللون</th><th>التفعيل</th>';

                    itemsHtml = '<table class="table table-sm"><thead><tr>' + thRow + '</tr></thead><tbody>';
                    d.items.forEach(function (item, i) {
                        var parentName = '';
                        if (isSubList && item.parentItemId) {
                            var pItem = parentItems.find(function (p) { return p.id === item.parentItemId; });
                            parentName = pItem ? pItem.itemText : '';
                        }
                        itemsHtml += '<tr><td>' + (i + 1) + '</td>';
                        if (isSubList) itemsHtml += '<td style="font-weight:700;color:var(--sa-700);">' + esc(parentName || '—') + '</td>';
                        itemsHtml += '<td>' + esc(item.itemText) + '</td><td>' + esc(item.description || '') + '</td>' +
                            '<td><span class="ddl-color-circle" style="background:' + esc(item.color || '#25935F') + ';"></span></td>' +
                            '<td>' + (item.isActive ? 'مفعل' : 'معطل') + '</td></tr>';
                    });
                    itemsHtml += '</tbody></table>';
                }
            } else {
                itemsHtml = '<p class="text-muted">لا توجد عناصر</p>';
            }

            var extraInfo = '';
            if (d.listType === 'قائمة هرمية') {
                extraInfo = '<div class="row mb-3"><div class="col-4"><strong>عدد المستويات:</strong></div><div class="col-8">' + d.levelCount + '</div></div>';
            }
            if (d.listType === 'قائمة فرعية' && d.parentListName) {
                extraInfo = '<div class="row mb-3"><div class="col-4"><strong>القائمة المستقلة:</strong></div><div class="col-8">' + esc(d.parentListName) + '</div></div>';
            }

            var html = '<div class="ddl-section"><div class="ddl-section-title">معلومات القائمة</div>' +
                '<div class="row mb-3"><div class="col-4"><strong>الاسم:</strong></div><div class="col-8">' + esc(d.name) + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>الوصف:</strong></div><div class="col-8">' + esc(d.description || '—') + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>نوع القائمة:</strong></div><div class="col-8">' + esc(d.listType) + '</div></div>' +
                extraInfo +
                '<div class="row mb-3"><div class="col-4"><strong>خاصية الاختيار:</strong></div><div class="col-8">' + esc(d.selectionType) + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>الملكية:</strong></div><div class="col-8">' + esc(d.ownership) + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>الوحدة التنظيمية المالكة:</strong></div><div class="col-8">' + esc(d.organizationalUnitName || '—') + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>التفعيل:</strong></div><div class="col-8">' + (d.isActive ? 'مفعل' : 'معطل') + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>أُنشئ بواسطة:</strong></div><div class="col-8">' + esc(d.createdBy || '—') + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>تاريخ الإنشاء:</strong></div><div class="col-8">' + esc(d.createdAt || '—') + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>التحديث بواسطة:</strong></div><div class="col-8">' + esc(d.updatedBy || '—') + '</div></div>' +
                '<div class="row mb-3"><div class="col-4"><strong>تاريخ التحديث:</strong></div><div class="col-8">' + esc(d.updatedAt || '—') + '</div></div></div>' +
                '<div class="ddl-section"><div class="ddl-section-title">العناصر</div>' + itemsHtml + '</div>';

            document.getElementById('ddlDetailsBody').innerHTML = html;
            new bootstrap.Modal(document.getElementById('ddlDetailsModal')).show();
        }
    } catch (e) {
        showToast('خطأ في تحميل التفاصيل', 'danger');
    }
}

function ddlBuildTreeFromItems(items) {
    var roots = items.filter(function (i) {
        return (i.levelNumber <= 1 || i.levelNumber === 0) && !i.parentItemId;
    });

    function getChildren(parentId) {
        return items.filter(function (i) { return i.parentItemId === parentId; });
    }

    function buildNode(item) {
        return { item: item, children: getChildren(item.id).map(buildNode) };
    }

    return roots.map(buildNode);
}

function ddlRenderDetailTreeRows(nodes, depth, levelNames) {
    var html = '';
    nodes.forEach(function (node) {
        var item = node.item;
        var indent = depth * 24;
        var statusClass = item.isActive ? 'ddl-badge-active' : 'ddl-badge-inactive';
        var levelName = levelNames[item.levelNumber - 1] || levelNames[(depth < levelNames.length ? depth : levelNames.length - 1)] || '';
        var prefix = depth > 0 ? '└ ' : '';

        html += '<tr>' +
            '<td style="padding-right:' + (12 + indent) + 'px;font-weight:' + (depth === 0 ? '800' : '600') + ';">' +
                '<span style="color:var(--gray-400);font-family:monospace;">' + prefix + '</span>' + esc(item.itemText) +
            '</td>' +
            '<td><span class="ddl-tree-level-badge">' + esc(levelName) + '</span></td>' +
            '<td>' + esc(item.description || '') + '</td>' +
            '<td><span class="ddl-color-circle" style="background:' + esc(item.color || '#25935F') + ';"></span></td>' +
            '<td><span class="' + statusClass + '">' + (item.isActive ? 'مفعل' : 'معطل') + '</span></td>' +
            '</tr>';

        if (node.children.length > 0) {
            html += ddlRenderDetailTreeRows(node.children, depth + 1, levelNames);
        }
    });
    return html;
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────
async function ddlShowEditModal(id) {
    var d = ddlAll.find(function (x) { return x.id === id; });
    if (!d) {
        var r = await apiFetch('/Dropdowns/GetDropdownListDetails?id=' + id);
        if (r && r.success) d = r.data;
    }
    if (!d) return;
    if (!ddlCanModifyList(d)) {
        showToast('لا يمكن لمدير النظام تعديل قائمة منسدلة خاصة', 'error');
        return;
    }
    if (ddlIsListLinkedToForm(d)) {
        showToast('لا يمكن تعديل قائمة منسدلة مرتبطة بنموذج', 'error');
        return;
    }

    document.getElementById('ddlEditId').value = d.id;
    document.getElementById('ddlEditName').value = d.name || '';
    document.getElementById('ddlEditDescription').value = d.description || '';
    var curOwnership = d.ownership || 'عام';
    var pubE = document.getElementById('ddlEditOwnershipPublic');
    var privE = document.getElementById('ddlEditOwnershipPrivate');
    if (pubE) pubE.checked = curOwnership === 'عام';
    if (privE) privE.checked = curOwnership === 'خاص';
    ddlApplyOwnershipUi();
    document.querySelector('input[name="ddlEditListType"][value="' + (d.listType || 'قائمة مستقلة') + '"]').checked = true;
    document.getElementById('ddlEditLevelCount').value = d.levelCount || 2;
    document.querySelector('input[name="ddlEditSelectionType"][value="' + (d.selectionType || 'خيار محدد') + '"]').checked = true;
    document.querySelector('input[name="ddlEditIsActive"][value="' + (d.isActive ? '1' : '0') + '"]').checked = true;
    document.getElementById('ddlEditError').classList.add('d-none');
    ddlToggleEditTypeFields();
    ddlLoadIndependentListsForEdit(d.parentListId);
    if (d.listType === 'قائمة فرعية') {
        setTimeout(function () {
            var sel = document.getElementById('ddlEditParentListId');
            if (sel) sel.value = d.parentListId || '';
            ddlSetEditListTypeLocked(true);
        }, 320);
    } else {
        ddlSetEditListTypeLocked(true);
    }
    new bootstrap.Modal(document.getElementById('ddlEditModal')).show();
}

async function ddlLoadIndependentListsForEdit(selectedId) {
    try {
        var r = await apiFetch('/Dropdowns/GetIndependentLists');
        if (r && r.success) {
            var sel = document.getElementById('ddlEditParentListId');
            var html = '<option value="">-- اختر --</option>';
            (r.data || []).forEach(function (l) {
                html += '<option value="' + l.id + '"' + (l.id === selectedId ? ' selected' : '') + '>' + esc(l.name) + '</option>';
            });
            sel.innerHTML = html;
        }
    } catch (e) { }
}

function ddlToggleEditTypeFields() {
    var type = document.querySelector('input[name="ddlEditListType"]:checked')?.value || 'قائمة مستقلة';
    document.getElementById('ddlEditParentListWrap').style.display = type === 'قائمة فرعية' ? 'block' : 'none';
    document.getElementById('ddlEditLevelWrap').style.display = type === 'قائمة هرمية' ? 'block' : 'none';
    if (type === 'قائمة فرعية') ddlLoadIndependentListsForEdit(null);
}

async function ddlSubmitEdit() {
    var errEl = document.getElementById('ddlEditError');
    errEl.classList.add('d-none');

    var id = parseInt(document.getElementById('ddlEditId').value);
    var name = document.getElementById('ddlEditName').value.trim();
    if (!name) {
        errEl.textContent = 'اسم القائمة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (ddlIsDuplicateListName(name, id)) {
        errEl.textContent = DDL_LIST_NAME_DUP_MSG;
        errEl.classList.remove('d-none');
        return;
    }

    var editOwnership = (document.querySelector('input[name="ddlEditOwnership"]:checked')?.value) || 'عام';
    if (ddlIsAdmin) editOwnership = 'عام';
    var body = {
        id: id,
        name: name,
        description: document.getElementById('ddlEditDescription').value.trim(),
        ownership: editOwnership,
        selectionType: document.querySelector('input[name="ddlEditSelectionType"]:checked')?.value || 'خيار محدد',
        isActive: document.querySelector('input[name="ddlEditIsActive"]:checked')?.value === '1'
    };

    var r = await apiFetch('/Dropdowns/UpdateDropdownList', 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ddlEditModal')).hide();
        showToast(r.message, 'success');
        await ddlLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

// ─── Delete Modal ────────────────────────────────────────────────────────────
function ddlShowDeleteModal(id, name) {
    var d = ddlAll.find(function (x) { return x.id === id; });
    if (!ddlCanModifyList(d)) {
        showToast('لا يمكن لمدير النظام تعديل قائمة منسدلة خاصة', 'error');
        return;
    }
    document.getElementById('ddlDeleteId').value = id;
    document.getElementById('ddlDeleteNameLabel').textContent = name || '';
    document.getElementById('ddlDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('ddlDeleteModal')).show();
}

async function ddlSubmitDelete() {
    var id = parseInt(document.getElementById('ddlDeleteId').value);
    var errEl = document.getElementById('ddlDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Dropdowns/DeleteDropdownList', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('ddlDeleteModal')).hide();
        showToast(r.message, 'success');
        await ddlLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
