'use strict';

function delEsc(t) {
    if (typeof esc === 'function') return esc(t);
    var s = t == null ? '' : String(t);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function delNameRoleCell(name, role) {
    var r = (role || '').trim();
    var sub = r ? '<div class="small text-muted mt-1" style="font-size:11px;line-height:1.35;">' + delEsc(r) + '</div>' : '';
    return '<div class="fw-semibold">' + delEsc(name || '') + '</div>' + sub;
}

function delDetailRow(label, innerHtml) {
    return '<div class="d-flex flex-wrap py-2 border-bottom border-light" style="gap:8px;"><div class="text-muted fw-bold" style="min-width:170px;">' + delEsc(label) + '</div><div class="flex-grow-1">' + innerHtml + '</div></div>';
}

var delBeneficiaries = [];
var delOrgUnits = [];
var delRows = [];
var delEditingId = null;

function delBenId(b) {
    return b.id != null ? b.id : b.Id;
}

function delBenOu(b) {
    var v = b.organizationalUnitId != null ? b.organizationalUnitId : b.OrganizationalUnitId;
    return v != null ? parseInt(v, 10) : 0;
}

function delBenName(b) {
    return (b.fullName || b.FullName || '').trim();
}

function delBenRole(b) {
    return (b.roleDisplay || b.RoleDisplay || '').trim();
}

/** تسمية المستفيد في القائمة: الاسم أولاً ثم الصلاحية ضمن الوحدة المختارة */
function delBenOptionLabel(b) {
    var name = delBenName(b);
    var role = delBenRole(b);
    if (!role) return delEsc(name);
    return delEsc(name) + ' — ' + delEsc(role);
}

/** تعبئة قائمة المفوِّض: أسماء من يخصّون وحدة المفوض فقط بعد اختيار الوحدة من الشجرة */
function delRebuildDelegatorBenOptions() {
    var hid = document.getElementById('delDelegatorOuId');
    var sel = document.getElementById('delDelegatorBen');
    if (!hid || !sel) return;
    var ouId = parseInt(hid.value, 10) || 0;
    var keep = sel.value;
    if (!ouId) {
        sel.innerHTML = '<option value="">— اختر وحدة المفوض أولاً —</option>';
        sel.value = '';
        delRebuildDelegateeBenOptions();
        return;
    }
    sel.innerHTML = '<option value="">— اختر اسم المفوض من هذه الوحدة —</option>';
    delBeneficiaries.filter(function (b) {
        return b.isActive !== false && delBenOu(b) === ouId;
    }).sort(function (a, b) {
        return delBenName(a).localeCompare(delBenName(b), 'ar');
    }).forEach(function (b) {
        var id = delBenId(b);
        sel.innerHTML += '<option value="' + id + '">' + delBenOptionLabel(b) + '</option>';
    });
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; }))
        sel.value = keep;
    else sel.value = '';
    delRebuildDelegateeBenOptions();
}

/**
 * قائمة المفوَّض له: مستفيدو وحدة المفوض له فقط؛ بعد تحديد الوحدة؛ مع استثناء المفوِّض.
 */
function delRebuildDelegateeBenOptions() {
    var hid = document.getElementById('delDelegateeOuId');
    var sel = document.getElementById('delDelegateeBen');
    var delegatorSel = document.getElementById('delDelegatorBen');
    if (!hid || !sel || !delegatorSel) return;
    var ouId = parseInt(hid.value, 10) || 0;
    var delegatorId = parseInt(delegatorSel.value, 10) || 0;
    var keep = sel.value;
    if (!ouId) {
        sel.innerHTML = '<option value="">— اختر وحدة المفوض له أولاً —</option>';
        sel.value = '';
        return;
    }
    sel.innerHTML = '<option value="">— اختر اسم المفوض له من هذه الوحدة —</option>';
    delBeneficiaries.filter(function (b) {
        var bid = delBenId(b);
        if (delegatorId && bid === delegatorId) return false;
        return b.isActive !== false && delBenOu(b) === ouId;
    }).sort(function (a, b) {
        return delBenName(a).localeCompare(delBenName(b), 'ar');
    }).forEach(function (b) {
        var id = delBenId(b);
        sel.innerHTML += '<option value="' + id + '">' + delBenOptionLabel(b) + '</option>';
    });
    var keepNum = parseInt(keep, 10);
    if (delegatorId && keepNum === delegatorId) sel.value = '';
    else if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; }))
        sel.value = keep;
    else sel.value = '';
}

var delOuExpandedDelegator = {};
var delOuExpandedDelegatee = {};

function delNormalizeOrgUnits(raw) {
    return (raw || []).map(function (u) {
        var id = u.id != null ? u.id : u.Id;
        var pid = u.parentId != null ? u.parentId : u.ParentId;
        return {
            id: parseInt(id, 10),
            name: (u.name || u.Name || '').trim(),
            parentId: pid != null && pid !== '' ? parseInt(pid, 10) : null,
            sortOrder: u.sortOrder != null ? parseInt(u.sortOrder, 10) : (u.SortOrder != null ? parseInt(u.SortOrder, 10) : 0)
        };
    }).filter(function (u) { return !isNaN(u.id); });
}

function delOuLookupName(unitId) {
    var n = parseInt(unitId, 10);
    if (!n) return '';
    var u = delOrgUnits.find(function (x) { return x.id === n; });
    return u ? u.name : '';
}

function delOrgUnitByParent() {
    var ids = {};
    delOrgUnits.forEach(function (u) { ids[u.id] = true; });
    var byParent = {};
    delOrgUnits.forEach(function (u) {
        var pk = '';
        if (u.parentId != null && u.parentId !== '' && !isNaN(u.parentId) && ids[u.parentId]) {
            pk = String(u.parentId);
        }
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(function (k) {
        byParent[k].sort(function (a, b) {
            var sa = a.sortOrder != null ? a.sortOrder : 0;
            var sb = b.sortOrder != null ? b.sortOrder : 0;
            if (sa !== sb) return sa - sb;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
        });
    });
    return byParent;
}

function delRenderOuTreeRows(byParent, parentKey, depth, selectedIdStr, expandedMap) {
    var rows = byParent[parentKey] || [];
    var sel = selectedIdStr !== undefined && selectedIdStr !== null ? String(selectedIdStr) : '';
    var html = '';
    rows.forEach(function (u) {
        var idStr = String(u.id);
        var children = byParent[idStr] || [];
        var hasChildren = children.length > 0;
        var expanded = !!expandedMap[idStr];
        var indent = depth * 22;
        var rowSel = sel === idStr ? ' is-selected' : '';
        html += '<div class="bnf-ou-tree-row d-flex align-items-center' + rowSel + '" data-id="' + u.id + '" role="option" dir="rtl" style="padding:8px 10px; padding-right:' + (12 + indent) + 'px;">';
        if (hasChildren) {
            html += '<button type="button" class="bnf-ou-tree-exp" data-exp="' + idStr + '" aria-expanded="' + expanded + '" title="' + (expanded ? 'طي' : 'توسيع') + '">' + (expanded ? '−' : '+') + '</button>';
        } else {
            html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += '<span class="bnf-ou-tree-name flex-grow-1">' + delEsc(u.name) + '</span></div>';
        if (hasChildren && expanded) {
            html += delRenderOuTreeRows(byParent, idStr, depth + 1, sel, expandedMap);
        }
    });
    return html;
}

function delRenderDelegatorOuPanel() {
    var panel = document.getElementById('delDelegatorOuPanel');
    if (!panel) return;
    if (!delOrgUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    var byParent = delOrgUnitByParent();
    var selectedId = document.getElementById('delDelegatorOuId').value;
    panel.innerHTML = delRenderOuTreeRows(byParent, '', 0, selectedId, delOuExpandedDelegator) || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function delRenderDelegateeOuPanel() {
    var panel = document.getElementById('delDelegateeOuPanel');
    if (!panel) return;
    if (!delOrgUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    var byParent = delOrgUnitByParent();
    var selectedId = document.getElementById('delDelegateeOuId').value;
    panel.innerHTML = delRenderOuTreeRows(byParent, '', 0, selectedId, delOuExpandedDelegatee) || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function delDelegatorOuClose() {
    var panel = document.getElementById('delDelegatorOuPanel');
    var trig = document.getElementById('delDelegatorOuTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function delDelegateeOuClose() {
    var panel = document.getElementById('delDelegateeOuPanel');
    var trig = document.getElementById('delDelegateeOuTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function delDelegatorOuToggle(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var panel = document.getElementById('delDelegatorOuPanel');
    var trig = document.getElementById('delDelegatorOuTrigger');
    if (!panel || !trig) return;
    delDelegateeOuClose();
    if (panel.classList.contains('d-none')) {
        var cur = parseInt(document.getElementById('delDelegatorOuId').value, 10);
        if (cur) delOuExpandAncestors(delOuExpandedDelegator, cur);
        delRenderDelegatorOuPanel();
        panel.classList.remove('d-none');
        trig.setAttribute('aria-expanded', 'true');
    } else delDelegatorOuClose();
}

function delDelegateeOuToggle(ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    var panel = document.getElementById('delDelegateeOuPanel');
    var trig = document.getElementById('delDelegateeOuTrigger');
    if (!panel || !trig) return;
    delDelegatorOuClose();
    if (panel.classList.contains('d-none')) {
        var cur = parseInt(document.getElementById('delDelegateeOuId').value, 10);
        if (cur) delOuExpandAncestors(delOuExpandedDelegatee, cur);
        delRenderDelegateeOuPanel();
        panel.classList.remove('d-none');
        trig.setAttribute('aria-expanded', 'true');
    } else delDelegateeOuClose();
}

function delOuExpandAncestors(expMap, selectId) {
    if (!selectId || isNaN(selectId)) return;
    var map = {};
    delOrgUnits.forEach(function (u) { map[u.id] = u; });
    var u = map[selectId];
    while (u && u.parentId != null && u.parentId !== '' && !isNaN(u.parentId)) {
        expMap[String(u.parentId)] = true;
        u = map[u.parentId];
    }
}

function delDelegatorOuSetSelection(id, nameOpt) {
    var hid = document.getElementById('delDelegatorOuId');
    var lab = document.getElementById('delDelegatorOuLabel');
    var num = id != null && id !== '' ? parseInt(id, 10) : 0;
    if (hid) hid.value = num > 0 && !isNaN(num) ? String(num) : '';
    var disp = nameOpt != null && String(nameOpt).trim() !== '' ? String(nameOpt).trim() : (num > 0 ? delOuLookupName(num) : '');
    if (lab) {
        lab.textContent = disp || '-- اختر --';
    }
    delRenderDelegatorOuPanel();
    delRebuildDelegatorBenOptions();
}

function delDelegateeOuSetSelection(id, nameOpt) {
    var hid = document.getElementById('delDelegateeOuId');
    var lab = document.getElementById('delDelegateeOuLabel');
    var num = id != null && id !== '' ? parseInt(id, 10) : 0;
    if (hid) hid.value = num > 0 && !isNaN(num) ? String(num) : '';
    var disp = nameOpt != null && String(nameOpt).trim() !== '' ? String(nameOpt).trim() : (num > 0 ? delOuLookupName(num) : '');
    if (lab) {
        lab.textContent = disp || '-- اختر --';
    }
    delRenderDelegateeOuPanel();
    delRebuildDelegateeBenOptions();
}

function delInitOuTreePanels() {
    var dgTrig = document.getElementById('delDelegatorOuTrigger');
    var dgPanel = document.getElementById('delDelegatorOuPanel');
    if (dgTrig && dgPanel) {
        dgTrig.addEventListener('click', delDelegatorOuToggle);
        dgPanel.addEventListener('click', function (e) {
            var expBtn = e.target.closest('.bnf-ou-tree-exp');
            if (expBtn) {
                e.preventDefault();
                e.stopPropagation();
                var eid = expBtn.getAttribute('data-exp');
                if (eid) {
                    delOuExpandedDelegator[eid] = !delOuExpandedDelegator[eid];
                    delRenderDelegatorOuPanel();
                }
                return;
            }
            var row = e.target.closest('.bnf-ou-tree-row');
            if (row && row.getAttribute('data-id') !== null && row.getAttribute('data-id') !== '') {
                var uid = parseInt(row.getAttribute('data-id'), 10);
                var u = delOrgUnits.find(function (x) { return x.id === uid; });
                if (u) {
                    delDelegatorOuSetSelection(u.id, u.name);
                    delDelegatorOuClose();
                }
            }
        });
    }
    var deTrig = document.getElementById('delDelegateeOuTrigger');
    var dePanel = document.getElementById('delDelegateeOuPanel');
    if (deTrig && dePanel) {
        deTrig.addEventListener('click', delDelegateeOuToggle);
        dePanel.addEventListener('click', function (e) {
            var expBtn = e.target.closest('.bnf-ou-tree-exp');
            if (expBtn) {
                e.preventDefault();
                e.stopPropagation();
                var eid = expBtn.getAttribute('data-exp');
                if (eid) {
                    delOuExpandedDelegatee[eid] = !delOuExpandedDelegatee[eid];
                    delRenderDelegateeOuPanel();
                }
                return;
            }
            var row = e.target.closest('.bnf-ou-tree-row');
            if (row && row.getAttribute('data-id') !== null && row.getAttribute('data-id') !== '') {
                var uid = parseInt(row.getAttribute('data-id'), 10);
                var u = delOrgUnits.find(function (x) { return x.id === uid; });
                if (u) {
                    delDelegateeOuSetSelection(u.id, u.name);
                    delDelegateeOuClose();
                }
            }
        });
    }
    document.addEventListener('click', function (e) {
        var w1 = document.querySelector('.del-delegator-ou-wrap');
        var w2 = document.querySelector('.del-delegatee-ou-wrap');
        var p1 = document.getElementById('delDelegatorOuPanel');
        var p2 = document.getElementById('delDelegateeOuPanel');
        if (p1 && !p1.classList.contains('d-none') && w1 && !w1.contains(e.target)) delDelegatorOuClose();
        if (p2 && !p2.classList.contains('d-none') && w2 && !w2.contains(e.target)) delDelegateeOuClose();
    });
}

function delStatusLabel(code) {
    switch ((code || '').toLowerCase()) {
        case 'active': return '<span class="badge bg-success">ساري</span>';
        case 'scheduled': return '<span class="badge bg-info text-dark">مجدول</span>';
        case 'expired': return '<span class="badge bg-secondary">منتهي</span>';
        case 'cancelled': return '<span class="badge bg-dark">ملغى</span>';
        case 'draft': return '<span class="badge bg-warning text-dark">مسودة</span>';
        default: return '<span class="badge bg-light text-dark">' + delEsc(code || '') + '</span>';
    }
}

async function delLoad() {
    try {
        var r = await apiFetch('/Settings/GetDelegations');
        if (!r || !r.success) {
            document.getElementById('delBody').innerHTML =
                '<tr><td colspan="9" class="text-center py-4 text-danger">غير مصرح أو خطأ في التحميل</td></tr>';
            return;
        }
        delRows = r.data || [];
        delBeneficiaries = r.beneficiaries || [];
        delOrgUnits = delNormalizeOrgUnits(r.organizationalUnits || []);
        delRenderTable();
    } catch (e) {
        document.getElementById('delBody').innerHTML =
            '<tr><td colspan="9" class="text-center py-4 text-danger">خطأ في الاتصال</td></tr>';
    }
}

function delRenderTable() {
    var body = document.getElementById('delBody');
    if (!body) return;
    if (!delRows.length) {
        body.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">لا توجد تفويضات</td></tr>';
        return;
    }
    var html = '';
    delRows.forEach(function (d, idx) {
        var rawCode = d.statusCode != null ? d.statusCode : d.StatusCode;
        var sc = String(rawCode || '').toLowerCase();
        var locked = sc === 'cancelled' || sc === 'expired';
        /** الحذف مسموح من الواجهة للمسودة فقط (يتوافق مع DeleteDelegation في الخادم). */
        var showDelete = sc === 'draft';
        var rowId = d.id != null ? d.id : d.Id;
        html += '<tr>' +
            '<td style="text-align:center;">' + (idx + 1) + '</td>' +
            '<td>' + delNameRoleCell(d.delegatorName, d.delegatorRoleDisplay) + '</td>' +
            '<td style="font-size:12px;">' + delEsc(d.delegatorOrgUnitName || '') + '</td>' +
            '<td>' + delNameRoleCell(d.delegateeName, d.delegateeRoleDisplay) + '</td>' +
            '<td style="font-size:12px;">' + delEsc(d.delegateeOrgUnitName || '') + '</td>' +
            '<td dir="ltr" style="font-size:12px;">' + delEsc(d.startDate || '') + '</td>' +
            '<td dir="ltr" style="font-size:12px;">' + delEsc(d.endDate || '') + '</td>' +
            '<td style="text-align:center;">' + delStatusLabel(d.statusCode) + '</td>' +
            '<td>' +
            '<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;">' +
            '<button type="button" class="del-action-btn del-action-btn-detail" onclick="delShowDetails(' + rowId + ')" title="تفاصيل"><i class="bi bi-eye"></i> تفاصيل</button>' +
            (!locked
                ? '<button type="button" class="del-action-btn del-action-btn-edit" onclick="delEdit(' + rowId + ')" title="تحديث"><i class="bi bi-pencil"></i> تحديث</button>'
                : '') +
            (showDelete
                ? '<button type="button" class="del-action-btn del-action-btn-delete" onclick="delConfirmDelete(' + rowId + ')" title="حذف"><i class="bi bi-trash3"></i> حذف</button>'
                : '') +
            '</div></td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

async function delShowDetails(id) {
    try {
        var r = await apiFetch('/Settings/GetDelegation?id=' + encodeURIComponent(id));
        if (!r || !r.success || !r.data) {
            showToast('تعذر تحميل التفويض', 'error');
            return;
        }
        var x = r.data;
        var statusHtml = delStatusLabel(x.statusCode);
        document.getElementById('delDetailsBody').innerHTML =
            delDetailRow('المفوض', delNameRoleCell(x.delegatorName, x.delegatorRoleDisplay)) +
            delDetailRow('وحدة المفوض', delEsc(x.delegatorOrgUnitName || '—')) +
            delDetailRow('المفوض له', delNameRoleCell(x.delegateeName, x.delegateeRoleDisplay)) +
            delDetailRow('وحدة المفوض له', delEsc(x.delegateeOrgUnitName || '—')) +
            delDetailRow('تاريخ البداية', '<span dir="ltr">' + delEsc(x.startDate || '') + '</span>') +
            delDetailRow('تاريخ النهاية', '<span dir="ltr">' + delEsc(x.endDate || '') + '</span>') +
            delDetailRow('الحالة', statusHtml) +
            delDetailRow('أنشئ بواسطة', delEsc(x.createdBy || '—')) +
            delDetailRow('تاريخ الإنشاء', delEsc(x.createdAt || '—')) +
            delDetailRow('آخر تحديث', delEsc(x.updatedAt || '—'));
        bootstrap.Modal.getOrCreateInstance(document.getElementById('delDetailsModal')).show();
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

function delShowAddModal() {
    delEditingId = null;
    var titleText = document.getElementById('delModalTitleText');
    if (titleText) titleText.textContent = 'إضافة تفويض';
    delOuExpandedDelegator = {};
    delOuExpandedDelegatee = {};
    var h1 = document.getElementById('delDelegatorOuId');
    var l1 = document.getElementById('delDelegatorOuLabel');
    var h2 = document.getElementById('delDelegateeOuId');
    var l2 = document.getElementById('delDelegateeOuLabel');
    if (h1) h1.value = '';
    if (l1) {
        l1.textContent = '-- اختر --';
    }
    if (h2) h2.value = '';
    if (l2) {
        l2.textContent = '-- اختر --';
    }
    delDelegatorOuClose();
    delDelegateeOuClose();
    delRebuildDelegatorBenOptions();
    document.getElementById('delStartDate').value = '';
    document.getElementById('delEndDate').value = '';
    document.getElementById('delDraft').checked = false;
    var draftWrap = document.getElementById('delDraftWrap');
    if (draftWrap) draftWrap.classList.remove('d-none');
    document.getElementById('delErr').classList.add('d-none');
    var btnCancelDel = document.getElementById('delBtnCancelDelegation');
    if (btnCancelDel) btnCancelDel.classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('delModal')).show();
}

async function delEdit(id) {
    try {
        var r = await apiFetch('/Settings/GetDelegation?id=' + encodeURIComponent(id));
        if (!r || !r.success || !r.data) {
            showToast('تعذر تحميل التفويض', 'error');
            return;
        }
        var d = r.data;
        var sc = String(d.statusCode || '').toLowerCase();
        if (sc === 'cancelled' || sc === 'expired') {
            showToast('لا يمكن تعديل تفويض منتهي أو ملغى', 'error');
            return;
        }
        delEditingId = id;
        var mt = document.getElementById('delModalTitleText');
        if (mt) mt.textContent = 'تعديل تفويض';
        var dorId = parseInt(d.delegatorOrgUnitId, 10) || 0;
        var deeId = parseInt(d.delegateeOrgUnitId, 10) || 0;
        delOuExpandedDelegator = {};
        if (dorId) delOuExpandAncestors(delOuExpandedDelegator, dorId);
        delDelegatorOuSetSelection(d.delegatorOrgUnitId, delOuLookupName(dorId));
        document.getElementById('delDelegatorBen').value = String(d.delegatorBeneficiaryId || '');
        delOuExpandedDelegatee = {};
        if (deeId) delOuExpandAncestors(delOuExpandedDelegatee, deeId);
        delDelegateeOuSetSelection(d.delegateeOrgUnitId, delOuLookupName(deeId));
        document.getElementById('delDelegateeBen').value = String(d.delegateeBeneficiaryId || '');
        document.getElementById('delStartDate').value = d.startDate || '';
        document.getElementById('delEndDate').value = d.endDate || '';
        document.getElementById('delDraft').checked = false;
        var draftWrap = document.getElementById('delDraftWrap');
        if (draftWrap) draftWrap.classList.add('d-none');
        document.getElementById('delErr').classList.add('d-none');
        var btnCancelDel = document.getElementById('delBtnCancelDelegation');
        if (btnCancelDel) btnCancelDel.classList.remove('d-none');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('delModal')).show();
    } catch (e) {
        showToast('خطأ في الاتصال', 'error');
    }
}

async function delSave() {
    var errEl = document.getElementById('delErr');
    errEl.classList.add('d-none');

    var delegatorBeneficiaryId = parseInt(document.getElementById('delDelegatorBen').value, 10);
    var delegatorOrgUnitId = parseInt(document.getElementById('delDelegatorOuId').value, 10);
    var delegateeBeneficiaryId = parseInt(document.getElementById('delDelegateeBen').value, 10);
    var delegateeOrgUnitId = parseInt(document.getElementById('delDelegateeOuId').value, 10);
    var startDate = (document.getElementById('delStartDate').value || '').trim();
    var endDate = (document.getElementById('delEndDate').value || '').trim();
    var saveAsDraft = document.getElementById('delDraft').checked;

    if (!delegatorOrgUnitId || !delegateeOrgUnitId) {
        errEl.textContent = 'اختر وحدة المفوض ووحدة المفوض له من القائمة الشجرية';
        errEl.classList.remove('d-none');
        return;
    }
    if (!delegatorBeneficiaryId || !delegateeBeneficiaryId) {
        errEl.textContent = 'اختر المفوض والمفوض له من أسماء المستفيدين في كل وحدة';
        errEl.classList.remove('d-none');
        return;
    }

    try {
        if (delEditingId) {
            var r = await apiFetch('/Settings/UpdateDelegation', 'POST', {
                id: delEditingId,
                delegatorBeneficiaryId: delegatorBeneficiaryId,
                delegatorOrgUnitId: delegatorOrgUnitId,
                delegateeBeneficiaryId: delegateeBeneficiaryId,
                delegateeOrgUnitId: delegateeOrgUnitId,
                startDate: startDate,
                endDate: endDate,
                saveAsDraft: false,
                cancel: false
            });
            if (r.success) {
                bootstrap.Modal.getInstance(document.getElementById('delModal')).hide();
                showToast(r.message || 'تم التحديث', 'success');
                delLoad();
            } else {
                errEl.textContent = r.message || 'خطأ';
                errEl.classList.remove('d-none');
            }
        } else {
            var r2 = await apiFetch('/Settings/AddDelegation', 'POST', {
                delegatorBeneficiaryId: delegatorBeneficiaryId,
                delegatorOrgUnitId: delegatorOrgUnitId,
                delegateeBeneficiaryId: delegateeBeneficiaryId,
                delegateeOrgUnitId: delegateeOrgUnitId,
                startDate: startDate,
                endDate: endDate,
                saveAsDraft: saveAsDraft
            });
            if (r2.success) {
                bootstrap.Modal.getInstance(document.getElementById('delModal')).hide();
                showToast(r2.message || 'تم الحفظ', 'success');
                delLoad();
            } else {
                errEl.textContent = r2.message || 'خطأ';
                errEl.classList.remove('d-none');
            }
        }
    } catch (e) {
        errEl.textContent = 'خطأ في الاتصال';
        errEl.classList.remove('d-none');
    }
}

function delOpenCancelDelegationConfirm() {
    if (!delEditingId) return;
    var err = document.getElementById('delCancelDelegationErr');
    if (err) err.classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('delCancelDelegationModal')).show();
}

async function delSubmitCancelDelegation() {
    if (!delEditingId) return;
    var err = document.getElementById('delCancelDelegationErr');
    if (err) err.classList.add('d-none');
    try {
        var r = await apiFetch('/Settings/UpdateDelegation', 'POST', {
            id: delEditingId,
            cancel: true,
            delegatorBeneficiaryId: parseInt(document.getElementById('delDelegatorBen').value, 10) || 0,
            delegatorOrgUnitId: parseInt(document.getElementById('delDelegatorOuId').value, 10) || 0,
            delegateeBeneficiaryId: parseInt(document.getElementById('delDelegateeBen').value, 10) || 0,
            delegateeOrgUnitId: parseInt(document.getElementById('delDelegateeOuId').value, 10) || 0,
            startDate: (document.getElementById('delStartDate').value || '').trim(),
            endDate: (document.getElementById('delEndDate').value || '').trim(),
            saveAsDraft: false
        });
        if (r.success) {
            bootstrap.Modal.getInstance(document.getElementById('delCancelDelegationModal')).hide();
            bootstrap.Modal.getInstance(document.getElementById('delModal')).hide();
            delEditingId = null;
            var btnCancelDel = document.getElementById('delBtnCancelDelegation');
            if (btnCancelDel) btnCancelDel.classList.add('d-none');
            showToast(r.message || 'تم إلغاء التفويض', 'success');
            delLoad();
        } else if (err) {
            err.textContent = r.message || 'تعذر إلغاء التفويض';
            err.classList.remove('d-none');
        }
    } catch (e) {
        if (err) {
            err.textContent = 'خطأ في الاتصال';
            err.classList.remove('d-none');
        }
    }
}

var delDeleteId = null;
function delConfirmDelete(id) {
    delDeleteId = id;
    document.getElementById('delDeleteErr').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('delDeleteModal')).show();
}

async function delSubmitDelete() {
    var err = document.getElementById('delDeleteErr');
    err.classList.add('d-none');
    try {
        var r = await apiFetch('/Settings/DeleteDelegation', 'POST', { id: delDeleteId });
        if (r.success) {
            bootstrap.Modal.getInstance(document.getElementById('delDeleteModal')).hide();
            showToast(r.message || 'تم الحذف', 'success');
            delLoad();
        } else {
            err.textContent = r.message || 'فشل الحذف';
            err.classList.remove('d-none');
        }
    } catch (e) {
        err.textContent = 'خطأ في الاتصال';
        err.classList.remove('d-none');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    delInitOuTreePanels();
    var dBen = document.getElementById('delDelegatorBen');
    if (dBen) dBen.addEventListener('change', delRebuildDelegateeBenOptions);
    var delModalEl = document.getElementById('delModal');
    if (delModalEl) {
        delModalEl.addEventListener('hidden.bs.modal', function () {
            delDelegatorOuClose();
            delDelegateeOuClose();
        });
    }
    var cancelModalEl = document.getElementById('delCancelDelegationModal');
    if (cancelModalEl) {
        cancelModalEl.addEventListener('hidden.bs.modal', function () {
            var er = document.getElementById('delCancelDelegationErr');
            if (er) er.classList.add('d-none');
        });
    }
    delLoad();
});

/** لصفحات تستخدم نفس المعرّفات: إعادة بناء قائمة المفوض له بعد تغيير المفوِّض */
window.delRebuildDelegatorBenOptions = delRebuildDelegatorBenOptions;
window.delRebuildDelegateeBenOptions = delRebuildDelegateeBenOptions;
