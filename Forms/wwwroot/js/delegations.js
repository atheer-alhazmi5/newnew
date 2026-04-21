
'use strict';

var dlgAll = [];
var dlgUnits = [];
var dlgBeneficiaries = [];
var dlgEditId = null;

// حالات توسيع الشجرة لكل منسدلة
var dlgOuExp = { filterDor: {}, filterDee: {}, formDor: {}, formDee: {} };

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function dlgEsc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dlgOuId(u) { return u.id != null ? u.id : u.Id; }
function dlgOuParentId(u) { return u.parentId != null ? u.parentId : u.ParentId; }
function dlgOuSort(u) { return u.sortOrder != null ? u.sortOrder : (u.SortOrder != null ? u.SortOrder : 0); }
function dlgOuName(u) { return u.name != null ? u.name : (u.Name || ''); }

function dlgUnitById(id) {
    var n = parseInt(id, 10);
    return dlgUnits.find(function (u) { return dlgOuId(u) === n; });
}

function dlgBuildOuByParent() {
    var ids = {};
    dlgUnits.forEach(function (u) { ids[dlgOuId(u)] = true; });
    var byParent = {};
    dlgUnits.forEach(function (u) {
        var p = dlgOuParentId(u);
        var pk = (p != null && p !== '' && ids[p]) ? String(p) : '';
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(function (k) {
        byParent[k].sort(function (a, b) {
            var sa = dlgOuSort(a), sb = dlgOuSort(b);
            if (sa !== sb) return sa - sb;
            return dlgOuName(a).localeCompare(dlgOuName(b), 'ar');
        });
    });
    return byParent;
}

/* ── OU tree dropdowns (trigger + panel) ────────────────────────────────── */
/** @param {{triggerId:string,panelId:string,hiddenId:string,labelId:string,expandedKey:string,allowClear:boolean,onSelect:(unit:object|null)=>void}} cfg */
function dlgBindOuDropdown(cfg) {
    var trigger = document.getElementById(cfg.triggerId);
    var panel = document.getElementById(cfg.panelId);
    if (!trigger || !panel) return;

    trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (panel.classList.contains('d-none')) {
            dlgRenderOuTreePanel(cfg);
            panel.classList.remove('d-none');
            trigger.setAttribute('aria-expanded', 'true');
        } else {
            panel.classList.add('d-none');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    panel.addEventListener('click', function (e) {
        var expBtn = e.target.closest('.dlg-ou-tree-exp');
        if (expBtn) {
            e.preventDefault();
            e.stopPropagation();
            var eid = expBtn.getAttribute('data-exp');
            if (eid) {
                dlgOuExp[cfg.expandedKey][eid] = !dlgOuExp[cfg.expandedKey][eid];
                dlgRenderOuTreePanel(cfg);
            }
            return;
        }
        var row = e.target.closest('.dlg-ou-tree-row');
        if (row && row.getAttribute('data-id') !== null) {
            var raw = row.getAttribute('data-id');
            if (raw === '') {
                document.getElementById(cfg.hiddenId).value = '';
                document.getElementById(cfg.labelId).textContent = trigger.getAttribute('data-default-label') || '-- اختر --';
                if (cfg.onSelect) cfg.onSelect(null);
            } else {
                var u = dlgUnitById(raw);
                if (u) {
                    document.getElementById(cfg.hiddenId).value = String(dlgOuId(u));
                    document.getElementById(cfg.labelId).textContent = dlgOuName(u);
                    if (cfg.onSelect) cfg.onSelect(u);
                }
            }
            panel.classList.add('d-none');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });

    // إغلاق عند النقر خارج الحقل
    document.addEventListener('click', function (e) {
        var wrap = trigger.closest('[data-wrap]') || trigger.parentElement;
        if (!wrap || panel.classList.contains('d-none')) return;
        if (!wrap.contains(e.target)) {
            panel.classList.add('d-none');
            trigger.setAttribute('aria-expanded', 'false');
        }
    });
}

function dlgRenderOuTreePanel(cfg) {
    var panel = document.getElementById(cfg.panelId);
    if (!panel) return;
    if (!dlgUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    var byParent = dlgBuildOuByParent();
    var selectedId = document.getElementById(cfg.hiddenId).value;
    var html = '';
    if (cfg.allowClear) {
        var allSel = !selectedId ? ' is-selected' : '';
        html += '<div class="dlg-ou-tree-row d-flex align-items-center' + allSel + '" data-id="" role="option" dir="rtl" style="padding:8px 10px;padding-right:12px;">' +
            '<span class="dlg-ou-tree-exp-spacer" aria-hidden="true"></span>' +
            '<span class="dlg-ou-tree-name flex-grow-1" style="font-weight:700;color:var(--gray-700);">كل الوحدات</span></div>';
    }
    html += dlgRenderOuTreeRows(byParent, '', 0, selectedId, dlgOuExp[cfg.expandedKey]);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function dlgRenderOuTreeRows(byParent, parentKey, depth, selectedId, expandedMap) {
    var rows = byParent[parentKey] || [];
    var sel = selectedId !== undefined && selectedId !== null ? String(selectedId) : '';
    var html = '';
    rows.forEach(function (u) {
        var uid = dlgOuId(u);
        var idStr = String(uid);
        var children = byParent[idStr] || [];
        var hasChildren = children.length > 0;
        var expanded = !!expandedMap[idStr];
        var indent = depth * 22;
        var rowSel = sel === idStr ? ' is-selected' : '';
        html += '<div class="dlg-ou-tree-row d-flex align-items-center' + rowSel + '" data-id="' + uid + '" role="option" dir="rtl" style="padding:8px 10px;padding-right:' + (12 + indent) + 'px;">';
        if (hasChildren) {
            html += '<button type="button" class="dlg-ou-tree-exp" data-exp="' + idStr + '" aria-expanded="' + expanded + '" title="' + (expanded ? 'طي' : 'توسيع') + '">' + (expanded ? '−' : '+') + '</button>';
        } else {
            html += '<span class="dlg-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += '<span class="dlg-ou-tree-name flex-grow-1">' + dlgEsc(dlgOuName(u)) + '</span></div>';
        if (hasChildren && expanded) {
            html += dlgRenderOuTreeRows(byParent, idStr, depth + 1, sel, expandedMap);
        }
    });
    return html;
}

/* ── Load + Render ──────────────────────────────────────────────────────── */
async function dlgLoad() {
    try {
        var r = await apiFetch('/Settings/GetDelegations');
        if (!r || !r.success) {
            document.getElementById('dlgBody').innerHTML =
                '<tr><td colspan="9" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
            return;
        }
        dlgAll = r.data || [];
        dlgUnits = r.organizationalUnits || [];
        dlgBeneficiaries = r.beneficiaries || [];
        dlgRenderTable();
    } catch (e) {
        console.error('dlgLoad', e);
        document.getElementById('dlgBody').innerHTML =
            '<tr><td colspan="9" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function dlgStatusPill(code) {
    var labels = { draft: 'مسودة', scheduled: 'مجدول', active: 'نشط', expired: 'منتهي', cancelled: 'ملغي' };
    var c = (code || 'draft').toLowerCase();
    var lbl = labels[c] || code;
    return '<span class="dlg-status-pill dlg-status-' + dlgEsc(c) + '"><span class="dlg-status-dot"></span>' + dlgEsc(lbl) + '</span>';
}

function dlgFilterList() {
    var q = (document.getElementById('dlgFilterSearch').value || '').trim().toLowerCase();
    var dorOu = parseInt(document.getElementById('dlgFilterDorUnit').value || '0', 10);
    var deeOu = parseInt(document.getElementById('dlgFilterDeeUnit').value || '0', 10);
    return dlgAll.filter(function (d) {
        if (q) {
            var hay = ((d.delegatorName || '') + ' ' + (d.delegateeName || '')).toLowerCase();
            if (!hay.includes(q)) return false;
        }
        if (dorOu > 0 && d.delegatorOrgUnitId !== dorOu) return false;
        if (deeOu > 0 && d.delegateeOrgUnitId !== deeOu) return false;
        return true;
    });
}

function dlgRenderTable() {
    var body = document.getElementById('dlgBody');
    var list = dlgFilterList();
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="9">' +
            (typeof emptyState === 'function'
                ? emptyState('bi-arrow-left-right', 'لا توجد تفويضات', 'أضف تفويض جديد للبدء')
                : '<div class="text-center py-4 text-muted">لا توجد تفويضات</div>') +
            '</td></tr>';
        return;
    }
    var html = '';
    list.forEach(function (d, i) {
        html += '<tr>' +
            '<td style="text-align:center;font-weight:700;color:var(--gray-500);">' + (i + 1) + '</td>' +
            '<td style="font-weight:700;">' + dlgEsc(d.delegatorName || '—') + '</td>' +
            '<td>' + dlgEsc(d.delegatorOrgUnitName || '—') + '</td>' +
            '<td style="font-weight:700;">' + dlgEsc(d.delegateeName || '—') + '</td>' +
            '<td>' + dlgEsc(d.delegateeOrgUnitName || '—') + '</td>' +
            '<td style="text-align:center;direction:ltr;">' + dlgEsc(d.startDate || '') + '</td>' +
            '<td style="text-align:center;direction:ltr;">' + dlgEsc(d.endDate || '') + '</td>' +
            '<td style="text-align:center;">' + dlgStatusPill(d.statusCode) + '</td>' +
            '<td style="text-align:center;">' +
                '<div style="display:inline-flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;">' +
                    '<button type="button" class="dlg-action-btn dlg-action-btn-detail" onclick="dlgShowDetails(' + d.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button type="button" class="dlg-action-btn dlg-action-btn-edit" onclick="dlgShowEditModal(' + d.id + ')"><i class="bi bi-pencil-fill"></i> تعديل</button>' +
                    '<button type="button" class="dlg-action-btn dlg-action-btn-delete" onclick="dlgShowDeleteModal(' + d.id + ')"><i class="bi bi-trash3-fill"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

/* ── Form: populate beneficiaries by OU ─────────────────────────────────── */
function dlgPopulateBeneficiariesForSelect(selectId, ouId, selectedBenId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '';
    var nId = parseInt(ouId, 10) || 0;
    if (!nId) {
        sel.innerHTML = '<option value="">-- اختر الوحدة أولاً --</option>';
        return;
    }
    var list = dlgBeneficiaries.filter(function (b) {
        return (b.organizationalUnitId || b.OrganizationalUnitId) === nId;
    });
    if (!list.length) {
        sel.innerHTML = '<option value="">لا يوجد موظفون في هذه الوحدة</option>';
        return;
    }
    var html = '<option value="">-- اختر --</option>';
    list.forEach(function (b) {
        var bid = b.id != null ? b.id : b.Id;
        var name = b.fullName || b.FullName || '';
        var sel2 = selectedBenId && selectedBenId === bid ? ' selected' : '';
        html += '<option value="' + bid + '"' + sel2 + '>' + dlgEsc(name) + '</option>';
    });
    sel.innerHTML = html;
}

/* ── Add / Edit Modal ───────────────────────────────────────────────────── */
function dlgResetForm() {
    dlgEditId = null;
    document.getElementById('dlgId').value = '';
    document.getElementById('dlgFormDorUnit').value = '';
    document.getElementById('dlgFormDorLabel').textContent = '-- اختر --';
    document.getElementById('dlgFormDeeUnit').value = '';
    document.getElementById('dlgFormDeeLabel').textContent = '-- اختر --';
    document.getElementById('dlgFormDor').innerHTML = '<option value="">-- اختر الوحدة أولاً --</option>';
    document.getElementById('dlgFormDee').innerHTML = '<option value="">-- اختر الوحدة أولاً --</option>';
    document.getElementById('dlgFormStart').value = '';
    document.getElementById('dlgFormEnd').value = '';
    document.getElementById('dlgFormError').classList.add('d-none');
    document.getElementById('dlgFormError').textContent = '';
    dlgOuExp.formDor = {};
    dlgOuExp.formDee = {};
    document.getElementById('dlgEditRevokeWrap').style.display = 'none';
}

function dlgShowAddModal() {
    dlgResetForm();
    document.getElementById('dlgModalHeader').className = 'dlg-modal-header';
    document.getElementById('dlgModalTitle').innerHTML = '<i class="bi bi-plus-circle" style="margin-left:8px;"></i>إضافة تفويض';
    document.getElementById('dlgModalSubtitle').textContent = 'أدخل بيانات التفويض';
    new bootstrap.Modal(document.getElementById('dlgFormModal')).show();
}

async function dlgShowEditModal(id) {
    dlgResetForm();
    try {
        var r = await apiFetch('/Settings/GetDelegation?id=' + encodeURIComponent(id));
        if (!r || !r.success) {
            if (typeof showToast === 'function') showToast((r && r.message) || 'خطأ في التحميل', 'error');
            return;
        }
        var d = r.data;
        dlgEditId = d.id;
        document.getElementById('dlgId').value = d.id;
        document.getElementById('dlgModalHeader').className = 'dlg-modal-header edit';
        document.getElementById('dlgModalTitle').innerHTML = '<i class="bi bi-pencil-square" style="margin-left:8px;"></i>تعديل التفويض';
        document.getElementById('dlgModalSubtitle').textContent = 'تحديث بيانات التفويض';

        // وحدة المفوِّض
        var dorU = dlgUnitById(d.delegatorOrgUnitId);
        if (dorU) {
            document.getElementById('dlgFormDorUnit').value = String(dlgOuId(dorU));
            document.getElementById('dlgFormDorLabel').textContent = dlgOuName(dorU);
            dlgPopulateBeneficiariesForSelect('dlgFormDor', d.delegatorOrgUnitId, d.delegatorBeneficiaryId);
        }
        // وحدة المفوَّض له
        var deeU = dlgUnitById(d.delegateeOrgUnitId);
        if (deeU) {
            document.getElementById('dlgFormDeeUnit').value = String(dlgOuId(deeU));
            document.getElementById('dlgFormDeeLabel').textContent = dlgOuName(deeU);
            dlgPopulateBeneficiariesForSelect('dlgFormDee', d.delegateeOrgUnitId, d.delegateeBeneficiaryId);
        }

        document.getElementById('dlgFormStart').value = d.startDate || '';
        document.getElementById('dlgFormEnd').value = d.endDate || '';

        // زر الإلغاء يظهر فقط لتفويض فعّال/مجدول (غير ملغي)
        var canRevoke = d.statusCode && d.statusCode !== 'cancelled' && d.statusCode !== 'expired';
        document.getElementById('dlgEditRevokeWrap').style.display = canRevoke ? '' : 'none';

        new bootstrap.Modal(document.getElementById('dlgFormModal')).show();
    } catch (e) {
        console.error('dlgShowEditModal', e);
        if (typeof showToast === 'function') showToast('خطأ في تحميل بيانات التفويض', 'error');
    }
}

async function dlgSubmit(asDraft) {
    var errEl = document.getElementById('dlgFormError');
    errEl.classList.add('d-none');
    errEl.textContent = '';

    var dorOu = parseInt(document.getElementById('dlgFormDorUnit').value || '0', 10);
    var dor = parseInt(document.getElementById('dlgFormDor').value || '0', 10);
    var deeOu = parseInt(document.getElementById('dlgFormDeeUnit').value || '0', 10);
    var dee = parseInt(document.getElementById('dlgFormDee').value || '0', 10);
    var s = document.getElementById('dlgFormStart').value;
    var e = document.getElementById('dlgFormEnd').value;

    if (!dorOu) return dlgShowErr('الوحدة التنظيمية للمفوض مطلوبة');
    if (!dor) return dlgShowErr('المفوض مطلوب');
    if (!deeOu) return dlgShowErr('الوحدة التنظيمية للمفوض له مطلوبة');
    if (!dee) return dlgShowErr('المفوض له مطلوب');
    if (dor === dee) return dlgShowErr('لا يمكن أن يكون المفوض والمفوض له نفس الشخص');
    if (!s) return dlgShowErr('تاريخ بداية التفويض مطلوب');
    if (!e) return dlgShowErr('تاريخ نهاية التفويض مطلوب');
    if (e <= s) return dlgShowErr('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');

    var body = {
        delegatorBeneficiaryId: dor,
        delegatorOrgUnitId: dorOu,
        delegateeBeneficiaryId: dee,
        delegateeOrgUnitId: deeOu,
        startDate: s,
        endDate: e,
        saveAsDraft: !!asDraft
    };
    var url;
    if (dlgEditId) {
        body.id = dlgEditId;
        body.cancel = false;
        url = '/Settings/UpdateDelegation';
    } else {
        url = '/Settings/AddDelegation';
    }

    var r = await apiFetch(url, 'POST', body);
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('dlgFormModal')).hide();
        if (typeof showToast === 'function') showToast(r.message || 'تم الحفظ', 'success');
        await dlgLoad();
    } else {
        dlgShowErr((r && r.message) || 'حدث خطأ');
    }
}

async function dlgRevoke() {
    if (!dlgEditId) return;
    if (!confirm('هل تريد إلغاء هذا التفويض؟ لا يمكن التراجع عن هذه العملية.')) return;
    var r = await apiFetch('/Settings/UpdateDelegation', 'POST', { id: dlgEditId, cancel: true });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('dlgFormModal')).hide();
        if (typeof showToast === 'function') showToast(r.message || 'تم إلغاء التفويض', 'success');
        await dlgLoad();
    } else {
        dlgShowErr((r && r.message) || 'حدث خطأ');
    }
}

function dlgShowErr(msg) {
    var el = document.getElementById('dlgFormError');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('d-none');
}

/* ── Details ────────────────────────────────────────────────────────────── */
function dlgShowDetails(id) {
    var d = dlgAll.find(function (x) { return x.id === id; });
    if (!d) return;
    var body = document.getElementById('dlgDetailsBody');
    body.innerHTML =
        '<div class="dlg-detail-row"><div class="dlg-detail-label">المفوض</div><div class="dlg-detail-value" style="font-weight:700;">' + dlgEsc(d.delegatorName || '—') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">وحدة المفوض</div><div class="dlg-detail-value">' + dlgEsc(d.delegatorOrgUnitName || '—') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">المفوض له</div><div class="dlg-detail-value" style="font-weight:700;">' + dlgEsc(d.delegateeName || '—') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">وحدة المفوض له</div><div class="dlg-detail-value">' + dlgEsc(d.delegateeOrgUnitName || '—') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">تاريخ البداية</div><div class="dlg-detail-value" style="direction:ltr;text-align:right;">' + dlgEsc(d.startDate || '') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">تاريخ النهاية</div><div class="dlg-detail-value" style="direction:ltr;text-align:right;">' + dlgEsc(d.endDate || '') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">الحالة</div><div class="dlg-detail-value">' + dlgStatusPill(d.statusCode) + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">أُنشئ بواسطة</div><div class="dlg-detail-value">' + dlgEsc(d.createdBy || '—') + '</div></div>' +
        '<div class="dlg-detail-row"><div class="dlg-detail-label">تاريخ الإنشاء</div><div class="dlg-detail-value" style="direction:ltr;text-align:right;">' + dlgEsc(d.createdAt || '—') + '</div></div>' +
        (d.updatedBy
            ? '<div class="dlg-detail-row"><div class="dlg-detail-label">آخر تعديل بواسطة</div><div class="dlg-detail-value">' + dlgEsc(d.updatedBy) + '</div></div>' +
              '<div class="dlg-detail-row"><div class="dlg-detail-label">تاريخ آخر تعديل</div><div class="dlg-detail-value" style="direction:ltr;text-align:right;">' + dlgEsc(d.updatedAt || '') + '</div></div>'
            : '');
    new bootstrap.Modal(document.getElementById('dlgDetailsModal')).show();
}

/* ── Delete ─────────────────────────────────────────────────────────────── */
function dlgShowDeleteModal(id) {
    var d = dlgAll.find(function (x) { return x.id === id; });
    document.getElementById('dlgDeleteId').value = id;
    document.getElementById('dlgDeleteLabel').textContent = d ? (d.delegatorName + ' ← ' + d.delegateeName) : '';
    document.getElementById('dlgDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('dlgDeleteModal')).show();
}

async function dlgSubmitDelete() {
    var id = parseInt(document.getElementById('dlgDeleteId').value, 10);
    var errEl = document.getElementById('dlgDeleteError');
    errEl.classList.add('d-none');
    var r = await apiFetch('/Settings/DeleteDelegation', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('dlgDeleteModal')).hide();
        if (typeof showToast === 'function') showToast(r.message || 'تم الحذف', 'success');
        await dlgLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

/* ── Init ───────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
    dlgLoad();

    // فلتر البحث
    var searchEl = document.getElementById('dlgFilterSearch');
    if (searchEl) searchEl.addEventListener('input', dlgRenderTable);

    // زر المسح
    document.getElementById('dlgFilterClear').addEventListener('click', function () {
        document.getElementById('dlgFilterSearch').value = '';
        document.getElementById('dlgFilterDorUnit').value = '';
        document.getElementById('dlgFilterDorLabel').textContent = 'وحدة المفوض';
        document.getElementById('dlgFilterDeeUnit').value = '';
        document.getElementById('dlgFilterDeeLabel').textContent = 'وحدة المفوض له';
        dlgOuExp.filterDor = {};
        dlgOuExp.filterDee = {};
        dlgRenderTable();
    });

    // فلاتر شجرة الوحدة (مفوِّض / مفوَّض له)
    dlgBindOuDropdown({
        triggerId: 'dlgFilterDorTrigger', panelId: 'dlgFilterDorPanel',
        hiddenId: 'dlgFilterDorUnit', labelId: 'dlgFilterDorLabel',
        expandedKey: 'filterDor', allowClear: true,
        onSelect: function () { dlgRenderTable(); }
    });
    document.getElementById('dlgFilterDorTrigger').setAttribute('data-default-label', 'وحدة المفوض');

    dlgBindOuDropdown({
        triggerId: 'dlgFilterDeeTrigger', panelId: 'dlgFilterDeePanel',
        hiddenId: 'dlgFilterDeeUnit', labelId: 'dlgFilterDeeLabel',
        expandedKey: 'filterDee', allowClear: true,
        onSelect: function () { dlgRenderTable(); }
    });
    document.getElementById('dlgFilterDeeTrigger').setAttribute('data-default-label', 'وحدة المفوض له');

    // شجرة وحدة داخل النموذج — تُعبّئ قائمة الموظفين بعد الاختيار
    dlgBindOuDropdown({
        triggerId: 'dlgFormDorTrigger', panelId: 'dlgFormDorPanel',
        hiddenId: 'dlgFormDorUnit', labelId: 'dlgFormDorLabel',
        expandedKey: 'formDor', allowClear: false,
        onSelect: function (u) {
            dlgPopulateBeneficiariesForSelect('dlgFormDor', u ? dlgOuId(u) : 0, null);
        }
    });
    dlgBindOuDropdown({
        triggerId: 'dlgFormDeeTrigger', panelId: 'dlgFormDeePanel',
        hiddenId: 'dlgFormDeeUnit', labelId: 'dlgFormDeeLabel',
        expandedKey: 'formDee', allowClear: false,
        onSelect: function (u) {
            dlgPopulateBeneficiariesForSelect('dlgFormDee', u ? dlgOuId(u) : 0, null);
        }
    });
});
