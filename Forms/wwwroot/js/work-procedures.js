'use strict';

let wpData = [];
let wpLookups = {
    workspaces: [],
    formDefinitions: [],
    executorBeneficiaries: [],
    executorRoles: [],
    organizationalUnits: [],
    procedureActionTypes: [],
    formTemplates: [],
    myOrgUnitId: 0,
    myOrgUnitName: ''
};
/** عند التعديل: نوع/قالب محفوظان لكنهما غير مفعّلين — يُعرضان في القائمة للاحتفاظ بالقيمة. */
let wpEditActionTypeExtra = null;
let wpEditTemplateExtra = null;
let wpIsAdmin = false;
let wpEditId = null;
let wpRejectId = null;
let wpDeleteId = null;
let wpRelated = [];
/** نمط النموذج: 'create' | 'edit' | 'version' */
let wpModeKind = 'create';
/** قائمة الإجراءات الكاملة (للاستخدام كمصدر في وضع «إصدار نسخة»). */
let wpAllProceduresList = [];
/** بيانات الإجراء المختار حالياً كمصدر للإصدار. */
let wpVersionSourceId = 0;
let wpVersionSourceData = null;
let wpVersionNextLabel = 'V2.0';
/** عند التعديل: نماذج مرتبطة بالإجراء لكنها غير ضمن قائمة النماذج المعتمدة المفعّلة (للعرض والاحتفاظ بالاختيار) */
let wpUsedFormPickerExtras = [];
let wpWfProcedureId = null;
let wpWfCtx = null;
let wpWfSteps = [];

let wpOuExpandedOwner = {};
let wpOuExpandedTarget = {};
let wpFilterOuExpanded = {};

function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wpOuUnitId(u) { return u.id != null ? u.id : u.Id; }
function wpOuParentId(u) { return u.parentId != null ? u.parentId : u.ParentId; }
function wpOuSortOrder(u) { return u.sortOrder != null ? u.sortOrder : (u.SortOrder != null ? u.SortOrder : 0); }
function wpOuName(u) { return u.name != null ? u.name : (u.Name || ''); }

function wpOuBuildTreeMap() {
    const units = wpLookups.organizationalUnits || [];
    const ids = {};
    units.forEach((u) => { ids[wpOuUnitId(u)] = true; });
    const byParent = {};
    units.forEach((u) => {
        const p = wpOuParentId(u);
        const pk = (p != null && p !== '' && ids[p]) ? String(p) : '';
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach((k) => {
        byParent[k].sort((a, b) => {
            const sa = wpOuSortOrder(a);
            const sb = wpOuSortOrder(b);
            if (sa !== sb) return sa - sb;
            return wpOuName(a).localeCompare(wpOuName(b), 'ar');
        });
    });
    return byParent;
}

function wpOuExpandAncestors(mapName, selectId) {
    if (!selectId) return;
    let expanded;
    if (mapName === 'owner') expanded = wpOuExpandedOwner;
    else if (mapName === 'target') expanded = wpOuExpandedTarget;
    else expanded = wpFilterOuExpanded;
    const units = wpLookups.organizationalUnits || [];
    const byParent = wpOuBuildTreeMap();
    let cur = units.find((x) => wpOuUnitId(x) === selectId);
    while (cur) {
        const pid = wpOuParentId(cur);
        if (pid == null || pid === '' || !byParent[String(pid)]) break;
        expanded[String(pid)] = true;
        cur = units.find((x) => wpOuUnitId(x) === pid);
    }
}

function wpOuRenderOwnerRows(byParent, parentKey, depth, selectedId) {
    const rows = byParent[parentKey] || [];
    let html = '';
    rows.forEach((u) => {
        const uid = wpOuUnitId(u);
        const idStr = String(uid);
        const children = byParent[idStr] || [];
        const hasChildren = children.length > 0;
        const expanded = !!wpOuExpandedOwner[idStr];
        const pr = 10 + depth * 18;
        const checked = uid === selectedId ? 'checked' : '';
        const eid = `wpown_${uid}`;
        html += `<div class="wp-dd-check-row wp-ou-tree-dd-row" style="padding-right:${pr}px;">`;
        if (hasChildren) {
            html += `<button type="button" class="wp-ou-tree-exp" aria-expanded="${expanded}" onclick="event.preventDefault();event.stopPropagation();wpOwnerOuToggleExp('${idStr}')">${expanded ? '−' : '+'}</button>`;
        } else {
            html += '<span class="wp-ou-tree-exp-spacer"></span>';
        }
        html += `<input type="radio" class="wp-dd-check-row-cb" name="wpOwnerOuRadio" value="${uid}" id="${eid}" ${checked} onclick="event.stopPropagation()">`;
        html += `<label class="wp-dd-check-row-label" for="${eid}">${esc(wpOuName(u))}</label></div>`;
        if (hasChildren && expanded) {
            html += wpOuRenderOwnerRows(byParent, idStr, depth + 1, selectedId);
        }
    });
    return html;
}

function wpOwnerOuToggleExp(idStr) {
    wpOuExpandedOwner[idStr] = !wpOuExpandedOwner[idStr];
    const hid = document.getElementById('wpOrganizationalUnitId');
    wpRenderOwnerOrgDd(hid ? parseInt(hid.value, 10) || 0 : 0);
}

function wpOuRenderTargetRows(byParent, parentKey, depth, selSet) {
    const rows = byParent[parentKey] || [];
    let html = '';
    rows.forEach((u) => {
        const uid = wpOuUnitId(u);
        const idStr = String(uid);
        const children = byParent[idStr] || [];
        const hasChildren = children.length > 0;
        const expanded = !!wpOuExpandedTarget[idStr];
        const pr = 10 + depth * 18;
        const checked = selSet.has(uid);
        const eid = `wptg_${uid}`;
        html += `<div class="wp-dd-check-row wp-ou-tree-dd-row" style="padding-right:${pr}px;">`;
        if (hasChildren) {
            html += `<button type="button" class="wp-ou-tree-exp" onclick="event.preventDefault();event.stopPropagation();wpTargetOuToggleExp('${idStr}')">${expanded ? '−' : '+'}</button>`;
        } else {
            html += '<span class="wp-ou-tree-exp-spacer"></span>';
        }
        html += `<input type="checkbox" class="wp-dd-check-row-cb wp-target-ou-cb" value="${uid}" id="${eid}" ${checked ? 'checked' : ''} onclick="event.stopPropagation()">`;
        html += `<label class="wp-dd-check-row-label" for="${eid}">${esc(wpOuName(u))}</label></div>`;
        if (hasChildren && expanded) {
            html += wpOuRenderTargetRows(byParent, idStr, depth + 1, selSet);
        }
    });
    return html;
}

function wpTargetOuToggleExp(idStr) {
    wpOuExpandedTarget[idStr] = !wpOuExpandedTarget[idStr];
    const sel = wpCollectCheckedIds('wpTargetOrgCbHost', 'wp-target-ou-cb');
    wpRenderTargetOrgCb(sel);
}

function wpExpandAllTargetOuBranches() {
    const byParent = wpOuBuildTreeMap();
    Object.keys(byParent).forEach((pk) => {
        if (!pk) return;
        if ((byParent[pk] || []).length) wpOuExpandedTarget[pk] = true;
    });
}

function wpAllTargetOuIdsSelected() {
    const units = wpLookups.organizationalUnits || [];
    if (!units.length) return false;
    const allIds = units.map((u) => wpOuUnitId(u));
    const sel = wpCollectCheckedIds('wpTargetOrgCbHost', 'wp-target-ou-cb');
    if (allIds.length !== sel.length) return false;
    const set = new Set(sel);
    return allIds.every((id) => set.has(id));
}

function wpUpdateTargetOuAllLabel() {
    const span = document.getElementById('wpTargetOuAllLabel');
    if (!span) return;
    span.textContent = wpAllTargetOuIdsSelected() ? 'إلغاء الكل' : 'تحديد الكل';
}

function wpToggleAllTargetOrgs() {
    const units = wpLookups.organizationalUnits || [];
    if (!units.length) return;
    const allIds = units.map((u) => wpOuUnitId(u));
    if (wpAllTargetOuIdsSelected()) {
        wpOuExpandedTarget = {};
        wpRenderTargetOrgCb([]);
    } else {
        wpExpandAllTargetOuBranches();
        wpRenderTargetOrgCb(allIds);
    }
}

function wpFilterOuClosePanel() {
    const panel = document.getElementById('wpFilterOuPanel');
    const trig = document.getElementById('wpFilterOuTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function wpFilterOuTogglePanel() {
    const panel = document.getElementById('wpFilterOuPanel');
    const trig = document.getElementById('wpFilterOuTrigger');
    if (!panel) return;
    if (panel.classList.contains('d-none')) {
        const cur = (document.getElementById('wpFilterTargetOrg') || {}).value;
        if (cur) {
            const n = parseInt(cur, 10);
            if (n) wpOuExpandAncestors('filter', n);
        }
        wpRenderFilterOuTreePanel();
        panel.classList.remove('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'true');
    } else {
        wpFilterOuClosePanel();
    }
}

function wpRenderFilterOuTreeRows(byParent, parentKey, depth, selectedId) {
    const rows = byParent[parentKey] || [];
    let html = '';
    const sel = selectedId !== undefined && selectedId !== null ? String(selectedId) : '';
    rows.forEach((u) => {
        const uid = wpOuUnitId(u);
        const idStr = String(uid);
        const children = byParent[idStr] || [];
        const hasChildren = children.length > 0;
        const expanded = !!wpFilterOuExpanded[idStr];
        const indent = depth * 22;
        const rowSel = sel === idStr ? ' is-selected' : '';
        html += `<div class="wp-filt-ou-tree-row d-flex align-items-center${rowSel}" data-id="${uid}" role="option" dir="rtl" style="padding:8px 10px;padding-right:${12 + indent}px;">`;
        if (hasChildren) {
            html += `<button type="button" class="wp-filt-ou-tree-exp" data-exp="${idStr}" aria-expanded="${expanded}">${expanded ? '−' : '+'}</button>`;
        } else {
            html += '<span class="wp-filt-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += `<span class="wp-filt-ou-tree-name flex-grow-1">${esc(wpOuName(u))}</span></div>`;
        if (hasChildren && expanded) {
            html += wpRenderFilterOuTreeRows(byParent, idStr, depth + 1, selectedId);
        }
    });
    return html;
}

function wpRenderFilterOuTreePanel() {
    const panel = document.getElementById('wpFilterOuPanel');
    if (!panel) return;
    const units = wpLookups.organizationalUnits || [];
    if (!units.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    const byParent = wpOuBuildTreeMap();
    const selectedId = (document.getElementById('wpFilterTargetOrg') || {}).value;
    const allSel = !selectedId ? ' is-selected' : '';
    let html = `<div class="wp-filt-ou-tree-row d-flex align-items-center${allSel}" data-id="" role="option" dir="rtl" style="padding:8px 10px;padding-right:12px;">`;
    html += '<span class="wp-filt-ou-tree-exp-spacer" aria-hidden="true"></span>';
    html += '<span class="wp-filt-ou-tree-name flex-grow-1" style="font-weight:700;color:var(--gray-700);">كل الوحدات</span></div>';
    html += wpRenderFilterOuTreeRows(byParent, '', 0, selectedId);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

const wpWizModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpEditModal'));
const wpDetModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpDetailsModal'));
const wpRejModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpRejectModal'));
const wpDelModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpDeleteModal'));
const wpWfDetModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpWorkflowStepDetailModal'));
const wpWfStepFormModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpWorkflowStepModal'));

async function wpLoad() {
    const search = document.getElementById('wpSearch')?.value || '';
    const status = document.getElementById('wpFilterStatus')?.value || '';
    const validity = document.getElementById('wpFilterValidity')?.value || '';
    const workspaceId = document.getElementById('wpFilterWorkspace')?.value || '';
    const formDefinitionId = document.getElementById('wpFilterFormDef')?.value || '';
    const targetOrgUnitId = document.getElementById('wpFilterTargetOrg')?.value || '';
    const executorRoleId = document.getElementById('wpFilterExecutor')?.value || '';
    const isActive = document.getElementById('wpFilterActive')?.value || '';
    const p = new URLSearchParams({ search, status, validity, isActive });
    if (workspaceId) p.set('workspaceId', workspaceId);
    if (formDefinitionId) p.set('formDefinitionId', formDefinitionId);
    if (targetOrgUnitId) p.set('targetOrgUnitId', targetOrgUnitId);
    if (executorRoleId) p.set('executorRoleId', executorRoleId);
    try {
        const [lu, res] = await Promise.all([
            apiFetch('/WorkProcedures/GetLookups'),
            apiFetch(`/WorkProcedures/GetWorkProcedures?${p}`)
        ]);
        if (lu.success) {
            wpLookups = {
                workspaces: lu.workspaces || [],
                formDefinitions: lu.formDefinitions || [],
                executorBeneficiaries: lu.executorBeneficiaries || [],
                executorRoles: lu.executorRoles || [],
                organizationalUnits: lu.organizationalUnits || [],
                procedureActionTypes: lu.procedureActionTypes || [],
                formTemplates: lu.formTemplates || [],
                myOrgUnitId: lu.myOrgUnitId != null ? lu.myOrgUnitId : 0,
                myOrgUnitName: lu.myOrgUnitName || ''
            };
            wpIsAdmin = lu.isAdmin;
        }
        if (!res.success) return;
        wpData = res.data || [];
        wpIsAdmin = res.isAdmin;
        wpFillFilters(res);
        wpRenderTable();
    } catch (e) { console.error('wpLoad', e); }
}

function wpFillFilters(res) {
    const wsList = res.workspaces || [];
    const fdList = res.formDefinitions || [];
    const orgList = res.organizationalUnits || wpLookups.organizationalUnits || [];
    const refill = (sel, placeholder, items, getLabel, getVal) => {
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '';
        sel.add(new Option(placeholder, ''));
        items.forEach((item) => {
            const v = getVal(item);
            const lbl = getLabel(item);
            if (v == null || v === '') return;
            sel.add(new Option(lbl, String(v)));
        });
        if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
    };

    refill(
        document.getElementById('wpFilterWorkspace'),
        'مساحة العمل',
        wsList,
        (w) => w.name ?? w.Name ?? '',
        (w) => w.id ?? w.Id
    );
    refill(
        document.getElementById('wpFilterFormDef'),
        'النماذج المستخدمة',
        fdList,
        (f) => f.name ?? f.Name ?? '',
        (f) => f.id ?? f.Id
    );
    const filHid = document.getElementById('wpFilterTargetOrg');
    const filLab = document.getElementById('wpFilterOuLabel');
    if (filHid && filLab && filHid.value) {
        const uid = parseInt(filHid.value, 10);
        const u = orgList.find((x) => (x.id ?? x.Id) === uid);
        if (u) filLab.textContent = u.name ?? u.Name ?? filLab.textContent;
        else {
            filHid.value = '';
            filLab.textContent = 'الوحدات التنظيمية المستهدفة';
        }
    }

    refill(
        document.getElementById('wpFilterExecutor'),
        'المنفذ للإجراء',
        wpLookups.executorRoles || [],
        (r) => r.name ?? r.Name ?? '',
        (r) => r.id ?? r.Id
    );

    const th = document.getElementById('wpThActive');
    if (th) th.style.display = wpIsAdmin ? '' : 'none';
}

function wpClear() {
    ['wpSearch', 'wpFilterWorkspace', 'wpFilterFormDef', 'wpFilterValidity', 'wpFilterExecutor', 'wpFilterStatus', 'wpFilterActive'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const fo = document.getElementById('wpFilterTargetOrg');
    if (fo) fo.value = '';
    const fl = document.getElementById('wpFilterOuLabel');
    if (fl) fl.textContent = 'الوحدات التنظيمية المستهدفة';
    wpFilterOuExpanded = {};
    wpLoad();
}

function wpStatusBadge(status) {
    const map = {
        draft: ['fd-badge-draft', 'bi-pencil-fill', 'مسودة'],
        pending: ['fd-badge-pending', 'bi-clock-fill', 'بانتظار الاعتماد'],
        approved: ['fd-badge-approved', 'bi-check-circle-fill', 'معتمد'],
        rejected: ['fd-badge-rejected', 'bi-x-circle-fill', 'مرفوض']
    };
    const [cls, icon, lbl] = map[status] || map.draft;
    return `<span class="fd-badge ${cls}"><i class="bi ${icon}"></i>${lbl}</span>`;
}

function wpRenderTable() {
    const tbody = document.getElementById('wpBody');
    if (!tbody) return;
    if (!wpData.length) {
        tbody.innerHTML = `<tr><td colspan="13"><div class="fd-empty-state"><i class="bi bi-diagram-3"></i><p>لا توجد إجراءات بعد</p></div></td></tr>`;
        return;
    }
    const disp = wpIsAdmin ? '' : 'display:none;';
    tbody.innerHTML = wpData.map((f, i) => {
        const toggle = wpIsAdmin
            ? `<label class="fd-toggle" title="${f.status !== 'approved' ? 'يمكن التفعيل للإجراءات المعتمدة فقط' : ''}"><input type="checkbox" ${f.isActive ? 'checked' : ''} ${f.status !== 'approved' ? 'disabled' : ''} onchange="wpToggle(${f.id},this)"><span class="fd-slider"></span></label>`
            : '';
        const patName = f.procedureActionTypeName || f.ProcedureActionTypeName || '—';
        const tplName = f.formTemplateName || f.FormTemplateName || '—';
        const verLbl = f.versionLabel || f.VersionLabel || 'V1.0';
        return `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${i + 1}</td>
            <td style="font-weight:600;">${esc(f.code)}</td>
            <td>${esc(f.name)}</td>
            <td style="font-size:13px;">${patName === '—' ? '<span class="text-muted">—</span>' : esc(patName)}</td>
            <td>${esc(f.workspaceName)}</td>
            <td>${esc(f.procedureClassification)}</td>
            <td style="font-size:13px;">${esc(f.orgUnitName)}</td>
            <td style="text-align:center;">${esc(f.validityType)}</td>
            <td style="font-size:13px;">${tplName === '—' ? '<span class="text-muted">—</span>' : esc(tplName)}</td>
            <td style="text-align:center;font-weight:700;color:var(--sa-700);">${esc(verLbl)}</td>
            <td style="text-align:center;">${wpStatusBadge(f.status)}</td>
            <td style="text-align:center;${disp}">${toggle}</td>
            <td style="text-align:center;">${wpActions(f)}</td>
        </tr>`;
    }).join('');
}

function wpActions(f) {
    const parts = [];
    parts.push(`<button type="button" class="fd-action-btn fd-action-btn-detail" onclick="wpShowDetails(${f.id})"><i class="bi bi-eye"></i> تفاصيل</button>`);
    parts.push(`<button type="button" class="fd-action-btn fd-action-btn-flow" onclick="wpShowWorkflow(${f.id})"><i class="bi bi-diagram-3"></i> سير العمل</button>`);
    parts.push(`<button type="button" class="fd-action-btn fd-action-btn-edit" style="border-color:var(--info-600);color:var(--info-700);" onclick="wpShowCreateNewVersion(${f.id})"><i class="bi bi-layers"></i> إصدار جديد</button>`);
    if (wpIsAdmin || f.status === 'draft' || f.status === 'rejected')
        parts.push(`<button type="button" class="fd-action-btn fd-action-btn-edit" onclick="wpShowEdit(${f.id})"><i class="bi bi-pencil-square"></i> تعديل</button>`);
    if (!wpIsAdmin && (f.status === 'draft' || f.status === 'rejected'))
        parts.push(`<button type="button" class="fd-action-btn fd-action-btn-send" onclick="wpSendApproval(${f.id})"><i class="bi bi-send-fill"></i> إرسال</button>`);
    if (wpIsAdmin && f.status === 'pending') {
        parts.push(`<button type="button" class="fd-action-btn fd-action-btn-approve" onclick="wpApprove(${f.id})"><i class="bi bi-check-lg"></i> اعتماد</button>`);
        parts.push(`<button type="button" class="fd-action-btn fd-action-btn-reject" onclick="wpShowReject(${f.id},'${esc(f.name)}')"><i class="bi bi-x-lg"></i> رفض</button>`);
    }
    if (wpIsAdmin || f.status === 'draft' || f.status === 'rejected')
        parts.push(`<button type="button" class="fd-action-btn fd-action-btn-delete" onclick="wpShowDelete(${f.id},'${esc(f.name)}')"><i class="bi bi-trash3"></i> حذف</button>`);
    return `<div class="wp-action-grid">${parts.join('')}</div>`;
}

async function wpToggle(id, el) {
    try {
        const res = await apiFetch('/WorkProcedures/ToggleWorkProcedure', 'POST', { id });
        if (res.success) {
            showToast(res.isActive ? 'تم تفعيل الإجراء' : 'تم تعطيل الإجراء', 'success');
            wpLoad();
        } else {
            showToast(res.message || 'خطأ', 'error');
            el.checked = !el.checked;
        }
    } catch { el.checked = !el.checked; }
}

function wpOwnerOrgFieldHtml(d) {
    d = d || {};
    const owner = d.organizationalUnitId || d.OrganizationalUnitId || 0;
    const ownerName = d.orgUnitName || d.OrgUnitName || '';
    if (wpIsAdmin) {
        return `<input type="hidden" id="wpOrganizationalUnitId" value="${owner}">
        <div class="dropdown wp-dd w-100">
            <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                <span id="wpOwnerOrgDdLbl">اختر الوحدة التنظيمية المالكة...</span>
            </button>
            <div class="dropdown-menu wp-dd-menu w-100 p-0">
                <div id="wpOwnerOrgDdHost"></div>
            </div>
        </div>`;
    }
    const lockedId = wpEditId ? owner : (wpLookups.myOrgUnitId || 0);
    const lockedName = wpEditId
        ? (ownerName || (wpLookups.organizationalUnits || []).find(u => u.id === owner)?.name || '—')
        : (wpLookups.myOrgUnitName || (wpLookups.organizationalUnits || []).find(u => u.id === lockedId)?.name || '—');
    return `<input type="hidden" id="wpOrganizationalUnitId" value="${lockedId}">
        <div class="form-control w-100" style="background:var(--gray-50);cursor:default;border:2px solid var(--gray-200);border-radius:10px;">${esc(lockedName)}</div>
        <span class="text-muted small">${wpEditId ? 'لا يمكن تغيير الوحدة المالكة.' : 'تُسجَّل الوحدة المالكة تلقائياً بوحدة عملك التنظيمية.'}</span>`;
}

function wpCollectCheckedIds(hostId, cbClass) {
    const host = document.getElementById(hostId);
    if (!host) return [];
    const seen = new Set();
    const out = [];
    host.querySelectorAll('.' + cbClass).forEach(cb => {
        if (!cb.checked) return;
        const v = parseInt(cb.value || '0', 10);
        if (v > 0 && !seen.has(v)) { seen.add(v); out.push(v); }
    });
    return out;
}

function wpDdCheckboxRow(cbClass, htmlId, value, labelText, checked, extraAttrs) {
    const ex = extraAttrs || '';
    const chk = checked ? 'checked' : '';
    const eid = esc(htmlId);
    return `<div class="wp-dd-check-row">
  <input type="checkbox" class="wp-dd-check-row-cb ${cbClass}" value="${value}" id="${eid}" ${chk} onclick="event.stopPropagation()"${ex}>
  <label class="wp-dd-check-row-label" for="${eid}">${esc(labelText)}</label>
</div>`;
}

const WP_USAGE_OPTS = ['يومي', 'أسبوعي', 'شهري', 'ربع سنوي', 'نصف سنوي', 'سنوي'];
const WP_CLASS_OPTS = ['رئيسي', 'ثانوي', 'مساند'];
const WP_CONF_OPTS = ['منخفض', 'متوسط', 'مرتفع'];
const WP_VAL_OPTS = ['دائم', 'مؤقت'];

function wpDdRadioRow(htmlId, groupName, value, labelText, checked) {
    const chk = checked ? 'checked' : '';
    const eid = esc(htmlId);
    const valEsc = esc(String(value));
    return `<div class="wp-dd-check-row">
  <input type="radio" class="wp-dd-check-row-cb" name="${esc(groupName)}" value="${valEsc}" id="${eid}" ${chk} onclick="event.stopPropagation()">
  <label class="wp-dd-check-row-label" for="${eid}">${esc(labelText)}</label>
</div>`;
}

/** قوائم اختيار واحد — نفس بنية صفوف النماذج المستخدمة (wp-dd-check-row) */
function wpWireStaticRadioDd(hiddenId, hostId, lblId, groupName, options, selectedVal, onPick) {
    const hid = document.getElementById(hiddenId);
    const host = document.getElementById(hostId);
    const lbl = document.getElementById(lblId);
    if (!hid || !host || !lbl) return;
    const sel = String(selectedVal ?? '');
    hid.value = sel;
    host.innerHTML = options.map((opt, idx) => {
        const rid = `${hostId}_opt_${idx}`;
        const checked = String(opt) === sel;
        return wpDdRadioRow(rid, groupName, opt, opt, checked);
    }).join('');
    const syncLbl = () => {
        lbl.textContent = hid.value || '—';
    };
    syncLbl();
    host.querySelectorAll(`input[name="${groupName}"]`).forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            hid.value = r.value;
            syncLbl();
            if (onPick) onPick(r.value);
        });
    });
}

function wpInitFormStaticDds(d) {
    d = d || {};
    const usage = d.usageFrequency || d.UsageFrequency || 'شهري';
    const procClass = d.procedureClassification || d.ProcedureClassification || 'رئيسي';
    const conf = d.confidentialityLevel || d.ConfidentialityLevel || 'متوسط';
    const valType = d.validityType || d.ValidityType || 'دائم';
    wpWireStaticRadioDd('wpUsageFrequency', 'wpUsageDdHost', 'wpUsageDdLbl', 'wpUsageRadio', WP_USAGE_OPTS, usage, null);
    wpWireStaticRadioDd('wpProcedureClassification', 'wpProcedureClassDdHost', 'wpProcedureClassDdLbl', 'wpProcClassRadio', WP_CLASS_OPTS, procClass, null);
    wpWireStaticRadioDd('wpConfidentialityLevel', 'wpConfDdHost', 'wpConfDdLbl', 'wpConfRadio', WP_CONF_OPTS, conf, null);
    wpWireStaticRadioDd('wpValidityType', 'wpValidityDdHost', 'wpValidityDdLbl', 'wpValidityRadio', WP_VAL_OPTS, valType, () => wpOnValidityChange());
}

function wpRenderWorkspaceDd(selectedId) {
    const hid = document.getElementById('wpWorkspaceId');
    const host = document.getElementById('wpWorkspaceDdHost');
    const lbl = document.getElementById('wpWorkspaceDdLbl');
    if (!hid || !host || !lbl) return;
    const items = wpLookups.workspaces || [];
    if (!items.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد مساحات عمل متاحة.</div>';
        lbl.textContent = '—';
        hid.value = 0;
        return;
    }
    const sid = parseInt(selectedId, 10) || 0;
    hid.value = sid;
    host.innerHTML = items
        .map((w) => {
            const id = w.id;
            const checked = id === sid ? 'checked' : '';
            const eid = `wpws_${id}`;
            return `<div class="wp-dd-check-row">
  <input type="radio" class="wp-dd-check-row-cb" name="wpWsRadio" value="${id}" id="${eid}" ${checked} onclick="event.stopPropagation()">
  <label class="wp-dd-check-row-label" for="${eid}">${esc(w.name)}</label>
</div>`;
        })
        .join('');
    const syncLbl = () => {
        const v = parseInt(hid.value, 10) || 0;
        const w = items.find((x) => x.id === v);
        lbl.textContent = w ? w.name : 'اختر مساحة العمل...';
    };
    syncLbl();
    host.querySelectorAll('input[name="wpWsRadio"]').forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            hid.value = r.value;
            syncLbl();
            wpOnWorkspaceChange();
        });
    });
}

function wpProcedureActionTypeItemsAll() {
    let items = (wpLookups.procedureActionTypes || []).map((x) => ({
        id: x.id != null ? x.id : x.Id,
        name: x.name != null ? x.name : (x.Name || '')
    }));
    if (wpEditActionTypeExtra) {
        const ex = wpEditActionTypeExtra;
        if (!items.some((x) => x.id === ex.id)) items = [{ id: ex.id, name: ex.name || '' }, ...items];
    }
    return items;
}

function wpFormTemplateItemsAll() {
    let items = (wpLookups.formTemplates || []).map((x) => ({
        id: x.id != null ? x.id : x.Id,
        name: x.name != null ? x.name : (x.Name || '')
    }));
    if (wpEditTemplateExtra) {
        const ex = wpEditTemplateExtra;
        if (!items.some((x) => x.id === ex.id)) items = [{ id: ex.id, name: ex.name || '' }, ...items];
    }
    return items;
}

function wpRenderProcedureActionTypeDd() {
    const hid = document.getElementById('wpProcedureActionTypeId');
    const host = document.getElementById('wpActionTypeDdHost');
    const lbl = document.getElementById('wpActionTypeDdLbl');
    const searchEl = document.getElementById('wpActionTypeSearch');
    if (!hid || !host || !lbl) return;
    let items = wpProcedureActionTypeItemsAll();
    const q = (searchEl && searchEl.value) ? searchEl.value.trim().toLowerCase() : '';
    if (q) items = items.filter((x) => (x.name || '').toLowerCase().includes(q));
    const sid = parseInt(hid.value, 10) || 0;
    const syncLbl = () => {
        const v = parseInt(hid.value, 10) || 0;
        const row = wpProcedureActionTypeItemsAll().find((x) => x.id === v);
        lbl.textContent = row ? row.name : (v ? (`نوع #${v}`) : 'اختر نوع الإجراء...');
    };
    if (!items.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد نتائج</div>';
        syncLbl();
        return;
    }
    host.innerHTML = items
        .map((t) => {
            const id = t.id;
            const checked = id === sid ? 'checked' : '';
            const eid = `wp_pat_${id}`;
            return `<div class="wp-dd-check-row">
  <input type="radio" class="wp-dd-check-row-cb" name="wpPatRadio" value="${id}" id="${eid}" ${checked} onclick="event.stopPropagation()">
  <label class="wp-dd-check-row-label" for="${eid}">${esc(t.name)}</label>
</div>`;
        })
        .join('');
    syncLbl();
    host.querySelectorAll('input[name="wpPatRadio"]').forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            hid.value = r.value;
            syncLbl();
        });
    });
}

function wpRenderFormTemplateDd() {
    const hid = document.getElementById('wpFormTemplateId');
    const host = document.getElementById('wpFormTemplateDdHost');
    const lbl = document.getElementById('wpTemplateDdLbl');
    const searchEl = document.getElementById('wpFormTemplateSearch');
    if (!hid || !host || !lbl) return;
    let items = wpFormTemplateItemsAll();
    const q = (searchEl && searchEl.value) ? searchEl.value.trim().toLowerCase() : '';
    if (q) items = items.filter((x) => (x.name || '').toLowerCase().includes(q));
    const sid = parseInt(hid.value, 10) || 0;
    const syncLbl = () => {
        const v = parseInt(hid.value, 10) || 0;
        const row = wpFormTemplateItemsAll().find((x) => x.id === v);
        lbl.textContent = row ? row.name : (v ? (`قالب #${v}`) : 'اختر القالب...');
    };
    if (!items.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد نتائج</div>';
        syncLbl();
        return;
    }
    host.innerHTML = items
        .map((t) => {
            const id = t.id;
            const checked = id === sid ? 'checked' : '';
            const eid = `wp_tpl_${id}`;
            return `<div class="wp-dd-check-row">
  <input type="radio" class="wp-dd-check-row-cb" name="wpTplRadio" value="${id}" id="${eid}" ${checked} onclick="event.stopPropagation()">
  <label class="wp-dd-check-row-label" for="${eid}">${esc(t.name)}</label>
</div>`;
        })
        .join('');
    syncLbl();
    host.querySelectorAll('input[name="wpTplRadio"]').forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            hid.value = r.value;
            syncLbl();
        });
    });
}

function wpWireProcedureActionTemplatePickers(d) {
    d = d || {};
    wpEditActionTypeExtra = null;
    wpEditTemplateExtra = null;
    const patIdInit = d.procedureActionTypeId || d.ProcedureActionTypeId || 0;
    const tplIdInit = d.formTemplateId || d.FormTemplateId || 0;
    if (wpEditId && patIdInit > 0) {
        const list = wpLookups.procedureActionTypes || [];
        if (!list.some((x) => (x.id != null ? x.id : x.Id) === patIdInit)) {
            const nm = d.procedureActionTypeName || d.ProcedureActionTypeName || '';
            wpEditActionTypeExtra = { id: patIdInit, name: nm || (`نوع #${patIdInit}`) };
        }
    }
    if (wpEditId && tplIdInit > 0) {
        const list = wpLookups.formTemplates || [];
        if (!list.some((x) => (x.id != null ? x.id : x.Id) === tplIdInit)) {
            const nm = d.formTemplateName || d.FormTemplateName || '';
            wpEditTemplateExtra = { id: tplIdInit, name: nm || (`قالب #${tplIdInit}`) };
        }
    }
    const hidPat = document.getElementById('wpProcedureActionTypeId');
    const hidTpl = document.getElementById('wpFormTemplateId');
    if (hidPat) hidPat.value = patIdInit || 0;
    if (hidTpl) hidTpl.value = tplIdInit || 0;
    const sPat = document.getElementById('wpActionTypeSearch');
    if (sPat) sPat.value = '';
    const sTpl = document.getElementById('wpFormTemplateSearch');
    if (sTpl) sTpl.value = '';
    wpRenderProcedureActionTypeDd();
    wpRenderFormTemplateDd();
    if (sPat) {
        sPat.oninput = function () { wpRenderProcedureActionTypeDd(); };
    }
    if (sTpl) {
        sTpl.oninput = function () { wpRenderFormTemplateDd(); };
    }
}

function wpRenderOwnerOrgDd(selectedId) {
    const host = document.getElementById('wpOwnerOrgDdHost');
    if (!host) return;
    const hid = document.getElementById('wpOrganizationalUnitId');
    const lbl = document.getElementById('wpOwnerOrgDdLbl');
    const units = wpLookups.organizationalUnits || [];
    if (!hid || !lbl) return;
    if (!units.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد وحدات تنظيمية.</div>';
        lbl.textContent = '—';
        hid.value = 0;
        return;
    }
    const sid = parseInt(selectedId, 10) || 0;
    hid.value = sid;
    if (sid) wpOuExpandAncestors('owner', sid);
    const byParent = wpOuBuildTreeMap();
    host.innerHTML = wpOuRenderOwnerRows(byParent, '', 0, sid);
    const syncLbl = () => {
        const v = parseInt(hid.value, 10) || 0;
        const u = units.find((x) => wpOuUnitId(x) === v);
        lbl.textContent = u ? wpOuName(u) : 'اختر الوحدة التنظيمية المالكة...';
    };
    syncLbl();
    host.querySelectorAll('input[name="wpOwnerOuRadio"]').forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            hid.value = r.value;
            syncLbl();
        });
    });
}

function wpWireCbLabel(hostId, cbClass, lblId, emptyText, filledPrefix) {
    const host = document.getElementById(hostId);
    const lbl = document.getElementById(lblId);
    if (!host || !lbl) return;
    const upd = () => {
        const n = host.querySelectorAll('.' + cbClass + ':checked').length;
        lbl.textContent = n ? `${filledPrefix} ${n}` : emptyText;
    };
    host.querySelectorAll('.' + cbClass).forEach(cb => cb.addEventListener('change', upd));
    upd();
}

function wpFormsForCurrentWorkspace() {
    const ws = parseInt(document.getElementById('wpWorkspaceId')?.value || '0', 10);
    const all = wpLookups.formDefinitions || [];
    if (!ws) return [];
    return all.filter((f) => (f.workspaceId ?? f.WorkspaceId) === ws);
}

function wpRenderExecutorCb(selectedIds) {
    const host = document.getElementById('wpExecCbHost');
    if (!host) return;
    const sel = new Set(selectedIds || []);
    const roles = wpLookups.executorRoles || [];
    const roleFullySelected = (r) => {
        const bids = r.beneficiaryIds || [];
        return bids.length > 0 && bids.every((id) => sel.has(id));
    };
    if (!roles.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد أدوار منفذين بمنفذين معرّفين — عرّف <strong>أدوار المنفذين</strong> والموظفين ضمنها أولاً.</div>';
        const lbl = document.getElementById('wpExecDdLbl');
        if (lbl) lbl.textContent = 'لا توجد أدوار';
        return;
    }
    host.innerHTML = roles.map((r) => {
        const rid = r.id ?? r.Id;
        const name = r.name ?? r.Name ?? '';
        const bids = r.beneficiaryIds || [];
        const idsAttr = bids.join(',');
        const checked = roleFullySelected(r);
        return wpDdCheckboxRow('wp-exec-role-cb', `wper_${rid}`, rid, name, checked, ` data-ben-ids="${idsAttr}"`);
    }).join('');
    wpWireCbLabel('wpExecCbHost', 'wp-exec-role-cb', 'wpExecDdLbl', 'اختر المنفذين...', 'محدد:');
}

function wpCollectExecutorBeneficiaryIdsFromRoles() {
    const host = document.getElementById('wpExecCbHost');
    if (!host) return [];
    const seen = new Set();
    const out = [];
    host.querySelectorAll('.wp-exec-role-cb:checked').forEach((cb) => {
        const raw = cb.getAttribute('data-ben-ids') || '';
        raw.split(',').forEach((part) => {
            const v = parseInt(part.trim(), 10);
            if (v > 0 && !seen.has(v)) {
                seen.add(v);
                out.push(v);
            }
        });
    });
    out.sort((a, b) => a - b);
    return out;
}

function wpRenderUsedFormsCb(selectedNorm) {
    const host = document.getElementById('wpUsedFormsCbHost');
    if (!host) return;
    const sel = new Set(
        (selectedNorm || []).map(x => {
            const raw = x.formDefinitionId != null ? x.formDefinitionId : x;
            const id = typeof raw === 'number' ? raw : parseInt(raw, 10);
            return id > 0 ? id : null;
        }).filter(v => v != null)
    );
    const ws = parseInt(document.getElementById('wpWorkspaceId')?.value || '0', 10);
    const lbl = document.getElementById('wpUsedDdLbl');
    if (!ws) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">اختر <strong>مساحة العمل</strong> أولاً لعرض النماذج المرتبطة بها.</div>';
        if (lbl) lbl.textContent = 'اختر المساحة أولاً...';
        return;
    }
    const formsBase = wpFormsForCurrentWorkspace();
    const byFid = new Map();
    formsBase.forEach((f) => {
        const fid = f.id ?? f.Id;
        if (fid > 0) byFid.set(fid, f);
    });
    const extras = wpUsedFormPickerExtras || [];
    const synthetic = [];
    sel.forEach((fid) => {
        if (byFid.has(fid)) return;
        const ex = extras.find((e) => (e.id ?? e.Id) === fid);
        const name = ex ? (ex.name ?? ex.Name ?? '') : '';
        synthetic.push({ id: fid, name: name || `نموذج #${fid}`, _extra: true });
    });
    const forms = formsBase.concat(synthetic);
    if (!forms.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد نماذج معتمدة ومفعّلة في هذه المساحة ضمن صلاحيتك.</div>';
        if (lbl) lbl.textContent = 'لا توجد نماذج';
        return;
    }
    host.innerHTML = forms.map(f => {
        const fid = f.id ?? f.Id;
        const fname = f.name ?? f.Name ?? '';
        const checked = sel.has(fid);
        const cbCls = f._extra ? 'wp-form-cb wp-used-form-extra' : 'wp-form-cb';
        return wpDdCheckboxRow(cbCls, `wpu_${fid}`, fid, fname, checked, ` data-fid="${fid}"`);
    }).join('');
    wpWireCbLabel('wpUsedFormsCbHost', 'wp-form-cb', 'wpUsedDdLbl', 'اختر النماذج...', 'محدد:');
}

function wpCollectUsedFormsFromCb() {
    const host = document.getElementById('wpUsedFormsCbHost');
    if (!host) return [];
    const out = [];
    host.querySelectorAll('.wp-form-cb:checked').forEach(cb => {
        const fid = parseInt(cb.dataset.fid || cb.value || '0', 10);
        if (fid > 0) out.push({ formDefinitionId: fid, visibility: 'عام' });
    });
    return out;
}

function wpRenderTargetOrgCb(selectedIds) {
    const host = document.getElementById('wpTargetOrgCbHost');
    if (!host) return;
    const sel = new Set(
        (selectedIds || [])
            .map((x) => (typeof x === 'number' ? x : parseInt(x, 10)))
            .filter((n) => n > 0)
    );
    const units = wpLookups.organizationalUnits || [];
    if (!units.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد وحدات تنظيمية.</div>';
        wpUpdateTargetOuAllLabel();
        return;
    }
    sel.forEach((id) => wpOuExpandAncestors('target', id));
    const byParent = wpOuBuildTreeMap();
    host.innerHTML = wpOuRenderTargetRows(byParent, '', 0, sel);
    wpWireCbLabel('wpTargetOrgCbHost', 'wp-target-ou-cb', 'wpTargetDdLbl', 'اختر الوحدات المستهدفة...', 'محدد:');
    host.querySelectorAll('.wp-target-ou-cb').forEach((cb) => {
        cb.addEventListener('change', () => wpUpdateTargetOuAllLabel());
    });
    wpUpdateTargetOuAllLabel();
}

/** الإجراءات السابقة / اللاحقة / الضمنية: لا يُختار نفس الإجراء في أكثر من قائمة (معطّل في القوائم الأخرى). */
function wpRenderAllRelCbs(prevIds, nextIds, impIds) {
    const pSet = new Set(prevIds || []);
    const nSet = new Set(nextIds || []);
    const iSet = new Set(impIds || []);
    const list = wpRelated || [];
    const emptyMap = { wpPrevDdLbl: 'الإجراءات السابقة...', wpNextDdLbl: 'الإجراءات اللاحقة...', wpImplicitDdLbl: 'الإجراءات الضمنية...' };
    const renderHost = (hostId, cbClass, lblId, selSet, other1, other2) => {
        const host = document.getElementById(hostId);
        if (!host) return;
        if (!list.length) {
            host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد إجراءات عمل أخرى للربط ضمن صلاحيتك.</div>';
            const lbl = document.getElementById(lblId);
            if (lbl) lbl.textContent = '—';
            return;
        }
        host.innerHTML = list.map((p) => {
            const checked = selSet.has(p.id);
            const inOther = !checked && (other1.has(p.id) || other2.has(p.id));
            const uid = hostId + '_p_' + p.id;
            const rowLbl = `${p.code} — ${p.name}`;
            const extra = inOther ? ' disabled' : '';
            return wpDdCheckboxRow(cbClass, uid, p.id, rowLbl, checked, extra);
        }).join('');
        const lbl = document.getElementById(lblId);
        if (lbl) {
            const n = host.querySelectorAll('.' + cbClass + ':checked').length;
            lbl.textContent = n ? `محدد: ${n}` : (emptyMap[lblId] || 'اختر...');
        }
    };
    renderHost('wpPrevCbHost', 'wp-rel-prev-cb', 'wpPrevDdLbl', pSet, nSet, iSet);
    renderHost('wpNextCbHost', 'wp-rel-next-cb', 'wpNextDdLbl', nSet, pSet, iSet);
    renderHost('wpImplicitCbHost', 'wp-rel-imp-cb', 'wpImplicitDdLbl', iSet, pSet, nSet);
}

function wpInitRelCbDelegation() {
    const body = document.getElementById('wpEditBody');
    if (!body || body._wpRelDel) return;
    body._wpRelDel = true;
    body.addEventListener('change', (e) => {
        const t = e.target;
        if (!t.matches('input.wp-rel-prev-cb, input.wp-rel-next-cb, input.wp-rel-imp-cb')) return;
        const prevIds = wpCollectCheckedIds('wpPrevCbHost', 'wp-rel-prev-cb');
        const nextIds = wpCollectCheckedIds('wpNextCbHost', 'wp-rel-next-cb');
        const impIds = wpCollectCheckedIds('wpImplicitCbHost', 'wp-rel-imp-cb');
        wpRenderAllRelCbs(prevIds, nextIds, impIds);
    });
}

async function wpLoadRelated(excludeId) {
    const q = excludeId ? `excludeId=${excludeId}` : '';
    try {
        const r = await apiFetch(`/WorkProcedures/ListRelatedProcedures${q ? `?${q}` : ''}`);
        wpRelated = r.success ? (r.data || []) : [];
    } catch { wpRelated = []; }
}

function wpOnValidityChange() {
    const v = document.getElementById('wpValidityType')?.value || 'دائم';
    const row = document.getElementById('wpValidityDatesRow');
    if (row) row.style.display = v === 'مؤقت' ? '' : 'none';
}

async function wpOnWorkspaceChange() {
    const ws = parseInt(document.getElementById('wpWorkspaceId')?.value || '0', 10);
    const prevIds = wpCollectCheckedIds('wpPrevCbHost', 'wp-rel-prev-cb');
    const nextIds = wpCollectCheckedIds('wpNextCbHost', 'wp-rel-next-cb');
    const impIds = wpCollectCheckedIds('wpImplicitCbHost', 'wp-rel-imp-cb');
    const usedPrev = wpCollectUsedFormsFromCb();
    const allowedFormIds = new Set(wpFormsForCurrentWorkspace().map((f) => f.id ?? f.Id));
    const extras = wpUsedFormPickerExtras || [];
    const usedFiltered = usedPrev.filter((u) => {
        if (allowedFormIds.has(u.formDefinitionId)) return true;
        const ex = extras.find((e) => (e.id ?? e.Id) === u.formDefinitionId);
        const exWs = ex ? (ex.workspaceId ?? ex.WorkspaceId ?? 0) : 0;
        return ex && exWs === ws;
    });
    wpRenderUsedFormsCb(usedFiltered);
    wpRenderAllRelCbs(prevIds, nextIds, impIds);
}

function wpBuildFormHtml(d, mode) {
    d = d || {};
    mode = mode || 'create';
    const code = d.code || '';
    const name = d.name || '';
    const objectives = d.objectives || '';
    const ws = d.workspaceId || d.WorkspaceId || 0;
    const usage = d.usageFrequency || d.UsageFrequency || 'شهري';
    const procClass = d.procedureClassification || d.ProcedureClassification || 'رئيسي';
    const conf = d.confidentialityLevel || d.ConfidentialityLevel || 'متوسط';
    const valType = d.validityType || d.ValidityType || 'دائم';
    const vs = d.validityStartDate || '';
    const ve = d.validityEndDate || '';
    const addIn = d.additionalInputs || '';
    const addOut = d.additionalOutputs || '';
    const patId = d.procedureActionTypeId || d.ProcedureActionTypeId || 0;
    const tplId = d.formTemplateId || d.FormTemplateId || 0;
    const isVersion = mode === 'version';

    const codeAttrs = isVersion ? 'readonly disabled' : '';
    const codeStyle = isVersion ? 'style="background:var(--gray-50);cursor:not-allowed;"' : '';
    const nameFieldHtml = isVersion
        ? `<div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpVersionSourceDdLbl">اختر الإجراء الذي تريد إصدار نسخة منه...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div class="wp-dd-search">
                        <input type="text" class="form-control form-control-sm" id="wpVersionSourceSearch" placeholder="بحث في الإجراءات..." autocomplete="off" dir="rtl">
                    </div>
                    <div id="wpVersionSourceDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpName" value="${esc(name)}">
            <input type="hidden" id="wpVersionSourceId" value="${d._versionSourceId || 0}">`
        : `<input type="text" class="form-control" id="wpName" value="${esc(name)}">`;

    return `
<input type="hidden" id="wpBaseProcedureId" value="${isVersion && d._versionSourceId ? d._versionSourceId : 0}">
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> البيانات الأساسية</div>
    <div class="fd-form-row">
        <div class="fd-form-group"><label><span class="required-star">*</span> ترميز الإجراء${isVersion ? ' <span class="text-muted small" style="font-weight:500;">(ثابت)</span>' : ''}</label><input type="text" class="form-control" id="wpCode" value="${esc(code)}" ${codeAttrs} ${codeStyle}></div>
        <div class="fd-form-group"><label><span class="required-star">*</span> اسم الإجراء</label>${nameFieldHtml}</div>
    </div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group"><label>أهداف الإجراء</label><textarea class="form-control" id="wpObjectives" rows="3">${esc(objectives)}</textarea></div>
    </div>
    <div class="fd-form-row cols-3">
        <div class="fd-form-group fd-form-group--wp-dd"><label><span class="required-star">*</span> معدل الاستخدام</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpUsageDdLbl">${esc(usage)}</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpUsageDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpUsageFrequency" value="${esc(usage)}"></div>
        <div class="fd-form-group fd-form-group--wp-dd"><label><span class="required-star">*</span> التصنيف</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpProcedureClassDdLbl">${esc(procClass)}</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpProcedureClassDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpProcedureClassification" value="${esc(procClass)}"></div>
        <div class="fd-form-group fd-form-group--wp-dd"><label><span class="required-star">*</span> مستوى السرية</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpConfDdLbl">${esc(conf)}</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpConfDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpConfidentialityLevel" value="${esc(conf)}"></div>
    </div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group"><label>الأنظمة واللوائح والتعليمات المنظمة لعمل الإجراء </label>
            <input type="file" class="form-control" id="wpRegFiles" multiple onchange="wpSyncFileJson('wpRegFiles','wpRegulationsAttachmentsJson')">
            <input type="hidden" id="wpRegulationsAttachmentsJson" value="${esc(d.regulationsAttachmentsJson || '[]')}">
           
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-bookmark-star"></i> نوع الإجراء والقالب المستخدم</div>
    <div class="fd-form-row">
        <div class="fd-form-group fd-form-group--wp-dd">
            <label><span class="required-star">*</span> نوع الإجراء</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpActionTypeDdLbl">اختر نوع الإجراء...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div class="wp-dd-search">
                        <input type="text" class="form-control form-control-sm" id="wpActionTypeSearch" placeholder="بحث في الأنواع..." autocomplete="off" dir="rtl">
                    </div>
                    <div id="wpActionTypeDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpProcedureActionTypeId" value="${patId || 0}">
        </div>
        <div class="fd-form-group fd-form-group--wp-dd">
            <label><span class="required-star">*</span> القالب المستخدم</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpTemplateDdLbl">اختر القالب...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div class="wp-dd-search">
                        <input type="text" class="form-control form-control-sm" id="wpFormTemplateSearch" placeholder="بحث في القوالب..." autocomplete="off" dir="rtl">
                    </div>
                    <div id="wpFormTemplateDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpFormTemplateId" value="${tplId || 0}">
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-grid-3x3-gap"></i> مساحة العمل والنماذج المستخدمة</div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group fd-form-group--wp-dd"><label><span class="required-star">*</span> مساحة العمل</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpWorkspaceDdLbl">اختر مساحة العمل...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpWorkspaceDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpWorkspaceId" value="${ws || 0}">
        </div>
    </div>

    <div class="fd-form-group fd-form-group--wp-dd">
        <label><span class="required-star">*</span> النماذج المستخدمة</label>
        <div class="dropdown wp-dd w-100">
            <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                <span id="wpUsedDdLbl">اختر النماذج...</span>
            </button>
            <div class="dropdown-menu wp-dd-menu w-100 p-0">
                <div id="wpUsedFormsCbHost"></div>
            </div>
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-person-badge"></i> المنفذين للإجراء</div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group fd-form-group--wp-dd">
            <label><span class="required-star">*</span> المنفذين للإجراء</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpExecDdLbl">اختر المنفذين...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpExecCbHost"></div>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-calendar-range"></i> صلاحية الإجراء</div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group fd-form-group--wp-dd"><label><span class="required-star">*</span> الصلاحية</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpValidityDdLbl">${esc(valType)}</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpValidityDdHost"></div>
                </div>
            </div>
            <input type="hidden" id="wpValidityType" value="${esc(valType)}"></div>
    </div>
    <div class="fd-form-row" id="wpValidityDatesRow" style="display:${valType === 'مؤقت' ? '' : 'none'};">
        <div class="fd-form-group"><label><span class="required-star">*</span> تاريخ بداية الصلاحية</label><input type="date" class="form-control" id="wpValidityStart" value="${esc(vs)}"></div>
        <div class="fd-form-group"><label><span class="required-star">*</span> تاريخ نهاية الصلاحية</label><input type="date" class="form-control" id="wpValidityEnd" value="${esc(ve)}"></div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-building"></i> الوحدات التنظيمية</div>
    <div class="fd-form-row fd-form-row--wp-org-pair">
        <div class="fd-form-group fd-form-group--wp-dd"><label><span class="required-star">*</span> الوحدة التنظيمية المالكة للإجراء</label>
            ${wpOwnerOrgFieldHtml(d)}</div>
        <div class="fd-form-group fd-form-group--wp-dd">
            <label><span class="required-star">*</span> الوحدات التنظيمية المستهدفة</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpTargetDdLbl">اختر الوحدات المستهدفة...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div class="wp-target-ou-toolbar d-flex align-items-center justify-content-between gap-2 px-2 py-2 border-bottom" style="border-color:var(--gray-200)!important;background:var(--gray-50);">
                        <span class="text-muted mb-0" style="font-size:11px;font-weight:700;">اختيار سريع</span>
                        <button type="button" class="wp-select-all-btn" id="wpTargetOuSelectAllBtn" onclick="event.preventDefault();event.stopPropagation();wpToggleAllTargetOrgs();">
                            <i class="bi bi-check2-all"></i> <span id="wpTargetOuAllLabel">تحديد الكل</span>
                        </button>
                    </div>
                    <div id="wpTargetOrgCbHost"></div>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-link-45deg"></i> الإجراءات المرتبطة</div>
    
    <div class="fd-form-row cols-3">
        <div class="fd-form-group">
            <label>الإجراءات السابقة</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpPrevDdLbl">الإجراءات السابقة...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpPrevCbHost"></div>
                </div>
            </div>
        </div>
        <div class="fd-form-group">
            <label>الإجراءات اللاحقة</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpNextDdLbl">الإجراءات اللاحقة...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpNextCbHost"></div>
                </div>
            </div>
        </div>
        <div class="fd-form-group">
            <label>الإجراءات الضمنية</label>
            <div class="dropdown wp-dd w-100">
                <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
                    <span id="wpImplicitDdLbl">الإجراءات الضمنية...</span>
                </button>
                <div class="dropdown-menu wp-dd-menu w-100 p-0">
                    <div id="wpImplicitCbHost"></div>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-input-cursor-text"></i> البيانات الإضافية</div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group"><label>المدخلات</label><textarea class="form-control" id="wpAdditionalInputs" rows="2">${esc(addIn)}</textarea></div>
    </div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group"><label>المخرجات</label><textarea class="form-control" id="wpAdditionalOutputs" rows="2">${esc(addOut)}</textarea></div>
    </div>
</div>`;
}

function wpSyncFileJson(inputId, hiddenId) {
    const inp = document.getElementById(inputId);
    const hid = document.getElementById(hiddenId);
    if (!inp || !hid) return;
    const arr = [];
    if (inp.files && inp.files.length) {
        for (let i = 0; i < inp.files.length; i++) arr.push({ name: inp.files[i].name, path: '' });
    }
    hid.value = JSON.stringify(arr);
}

function wpCollectPayload() {
    const regulationsAttachmentsJson = document.getElementById('wpRegulationsAttachmentsJson')?.value || '[]';
    const payload = {
        code: (document.getElementById('wpCode')?.value || '').trim(),
        name: (document.getElementById('wpName')?.value || '').trim(),
        objectives: document.getElementById('wpObjectives')?.value || '',
        regulationsAttachmentsJson,
        workspaceId: parseInt(document.getElementById('wpWorkspaceId')?.value || '0', 10),
        usedForms: wpCollectUsedFormsFromCb(),
        executorBeneficiaryIds: wpCollectExecutorBeneficiaryIdsFromRoles(),
        usageFrequency: document.getElementById('wpUsageFrequency')?.value || 'شهري',
        procedureClassification: document.getElementById('wpProcedureClassification')?.value || 'رئيسي',
        confidentialityLevel: document.getElementById('wpConfidentialityLevel')?.value || 'متوسط',
        validityType: document.getElementById('wpValidityType')?.value || 'دائم',
        validityStartDate: document.getElementById('wpValidityStart')?.value || '',
        validityEndDate: document.getElementById('wpValidityEnd')?.value || '',
        organizationalUnitId: parseInt(document.getElementById('wpOrganizationalUnitId')?.value || '0', 10),
        targetOrganizationalUnitIds: wpCollectCheckedIds('wpTargetOrgCbHost', 'wp-target-ou-cb'),
        procedureActionTypeId: parseInt(document.getElementById('wpProcedureActionTypeId')?.value || '0', 10),
        formTemplateId: parseInt(document.getElementById('wpFormTemplateId')?.value || '0', 10),
        previousProcedureIds: wpCollectCheckedIds('wpPrevCbHost', 'wp-rel-prev-cb'),
        nextProcedureIds: wpCollectCheckedIds('wpNextCbHost', 'wp-rel-next-cb'),
        implicitProcedureIds: wpCollectCheckedIds('wpImplicitCbHost', 'wp-rel-imp-cb'),
        additionalInputs: document.getElementById('wpAdditionalInputs')?.value || '',
        additionalOutputs: document.getElementById('wpAdditionalOutputs')?.value || ''
    };
    const baseEl = document.getElementById('wpBaseProcedureId');
    const baseId = baseEl ? parseInt(baseEl.value, 10) || 0 : 0;
    if (baseId > 0) payload.baseProcedureId = baseId;
    return payload;
}

function wpParseExecutorBeneficiaryIds(d) {
    let ex = [];
    try {
        const raw = d.executorBeneficiaryIdsJson || d.ExecutorBeneficiaryIdsJson;
        if (raw) ex = JSON.parse(raw);
    } catch { ex = []; }
    if (ex.length) return ex;
    return [];
}

function wpResolveExecutorRoleNames(beneficiaryIds) {
    const ids = new Set(beneficiaryIds || []);
    const roles = wpLookups.executorRoles || [];
    if (!ids.size) return '—';
    const names = [];
    const seen = new Set();
    for (const r of roles) {
        const bids = r.beneficiaryIds || [];
        if (!bids.some((bid) => ids.has(bid))) continue;
        const n = r.name ?? r.Name ?? '';
        if (n && !seen.has(n)) {
            seen.add(n);
            names.push(n);
        }
    }
    if (names.length) return names.map(esc).join('، ');
    return (beneficiaryIds || []).map((bid) => {
        const b = (wpLookups.executorBeneficiaries || []).find((x) => x.id === bid);
        return b ? esc(b.fullName) : esc(String(bid));
    }).join('، ') || '—';
}

async function wpShowCreate() {
    wpModeKind = 'create';
    wpEditId = null;
    wpUsedFormPickerExtras = [];
    wpEditActionTypeExtra = null;
    wpEditTemplateExtra = null;
    wpVersionSourceId = 0;
    wpVersionSourceData = null;
    wpOuExpandedOwner = {};
    wpOuExpandedTarget = {};
    await wpLoad();
    document.getElementById('wpEditTitle').textContent = 'إضافة إجراء عمل جديد';
    document.getElementById('wpEditSub').textContent = 'أدخل بيانات الإجراء';
    document.getElementById('wpEditHead').className = 'fd-modal-header create';
    document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml({}, 'create');
    wpInitFormStaticDds({});
    wpWireProcedureActionTemplatePickers({});
    wpRenderWorkspaceDd(0);
    if (wpIsAdmin) wpRenderOwnerOrgDd(0);
    wpOnValidityChange();
    wpRenderUsedFormsCb([]);
    wpRenderExecutorCb([]);
    wpRenderTargetOrgCb([]);
    await wpLoadRelated(null);
    wpInitRelCbDelegation();
    wpRenderAllRelCbs([], [], []);
    const primaryLabel = wpIsAdmin ? 'نشر الإجراء' : 'إرسال للاعتماد';
    document.getElementById('wpEditFoot').innerHTML = `<div></div><div class="d-flex gap-2 flex-wrap">
        <button type="button" class="fd-save-btn draft" onclick="wpSave(false)"><i class="bi bi-floppy2-fill"></i> حفظ كمسودة</button>
        <button type="button" class="fd-save-btn send" onclick="wpSave(true)"><i class="bi bi-send-fill"></i> ${primaryLabel}</button>
    </div>`;
    wpWizModal().show();
}

/** يفتح نافذة الإنشاء في وضع «إصدار نسخة» — مع قائمة منسدلة لاختيار الإجراء المصدر. */
async function wpShowVersionMode(sourceId) {
    wpModeKind = 'version';
    wpEditId = null;
    wpUsedFormPickerExtras = [];
    wpEditActionTypeExtra = null;
    wpEditTemplateExtra = null;
    wpVersionSourceId = 0;
    wpVersionSourceData = null;
    wpVersionNextLabel = 'V2.0';
    wpOuExpandedOwner = {};
    wpOuExpandedTarget = {};
    await wpLoad();
    try {
        const r = await apiFetch('/WorkProcedures/ListRelatedProcedures');
        wpAllProceduresList = (r && r.success) ? (r.data || []) : [];
    } catch { wpAllProceduresList = []; }

    document.getElementById('wpEditTitle').textContent = 'إنشاء إصدار جديد';
    document.getElementById('wpEditSub').textContent = 'اختر الإجراء المصدر — يُسجَّل تلقائياً برقم إصدار جديد';
    document.getElementById('wpEditHead').className = 'fd-modal-header create';
    document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml({ _versionSourceId: 0 }, 'version');
    wpInitFormStaticDds({});
    wpWireProcedureActionTemplatePickers({});
    wpRenderWorkspaceDd(0);
    if (wpIsAdmin) wpRenderOwnerOrgDd(0);
    wpOnValidityChange();
    wpRenderUsedFormsCb([]);
    wpRenderExecutorCb([]);
    wpRenderTargetOrgCb([]);
    await wpLoadRelated(null);
    wpInitRelCbDelegation();
    wpRenderAllRelCbs([], [], []);
    wpWireVersionSourcePicker();
    wpUpdateVersionSaveButtons();

    const primaryLabel = wpIsAdmin ? 'نشر الإصدار' : 'إرسال للاعتماد';
    document.getElementById('wpEditFoot').innerHTML = `<div></div><div class="d-flex gap-2 flex-wrap">
        <button type="button" class="fd-save-btn draft" id="wpVerSaveDraft" onclick="wpSave(false)" disabled><i class="bi bi-floppy2-fill"></i> حفظ كمسودة</button>
        <button type="button" class="fd-save-btn send" id="wpVerSaveSend" onclick="wpSave(true)" disabled><i class="bi bi-send-fill"></i> ${primaryLabel}</button>
    </div>`;
    wpWizModal().show();

    if (sourceId && sourceId > 0) {
        await wpOnVersionSourcePicked(sourceId, true);
    }
}

/** يُحدِّث حالة أزرار الحفظ في وضع الإصدار حسب اختيار المصدر. */
function wpUpdateVersionSaveButtons() {
    const btnDraft = document.getElementById('wpVerSaveDraft');
    const btnSend = document.getElementById('wpVerSaveSend');
    const ok = wpModeKind === 'version' && wpVersionSourceId > 0;
    if (btnDraft) btnDraft.disabled = !ok;
    if (btnSend) btnSend.disabled = !ok;
}

function wpVersionSourceItemsAll() {
    return (wpAllProceduresList || []).map((p) => ({
        id: p.id != null ? p.id : p.Id,
        name: p.name != null ? p.name : (p.Name || ''),
        code: p.code != null ? p.code : (p.Code || '')
    })).filter((x) => x.id > 0);
}

function wpRenderVersionSourceDd() {
    const hid = document.getElementById('wpVersionSourceId');
    const host = document.getElementById('wpVersionSourceDdHost');
    const lbl = document.getElementById('wpVersionSourceDdLbl');
    const searchEl = document.getElementById('wpVersionSourceSearch');
    if (!hid || !host || !lbl) return;
    let items = wpVersionSourceItemsAll();
    const q = (searchEl && searchEl.value) ? searchEl.value.trim().toLowerCase() : '';
    if (q) {
        items = items.filter((x) =>
            (x.name || '').toLowerCase().includes(q) ||
            (x.code || '').toLowerCase().includes(q));
    }
    const sid = parseInt(hid.value, 10) || 0;
    const syncLbl = () => {
        const v = parseInt(hid.value, 10) || 0;
        const row = wpVersionSourceItemsAll().find((x) => x.id === v);
        lbl.textContent = row ? `${row.name} — ${row.code}` : 'اختر الإجراء الذي تريد إصدار نسخة منه...';
    };
    if (!items.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد إجراءات مسجلة</div>';
        syncLbl();
        return;
    }
    host.innerHTML = items.map((p) => {
        const id = p.id;
        const checked = id === sid ? 'checked' : '';
        const eid = `wp_versrc_${id}`;
        const rowLbl = `${p.name} — ${p.code}`;
        return `<div class="wp-dd-check-row">
  <input type="radio" class="wp-dd-check-row-cb wp-version-source-radio" name="wpVerSrcRadio" value="${id}" id="${eid}" ${checked} onclick="event.stopPropagation()">
  <label class="wp-dd-check-row-label" for="${eid}">${esc(rowLbl)}</label>
</div>`;
    }).join('');
    syncLbl();
    host.querySelectorAll('input.wp-version-source-radio').forEach((r) => {
        r.addEventListener('change', async () => {
            if (!r.checked) return;
            const pickedId = parseInt(r.value, 10) || 0;
            if (pickedId > 0) await wpOnVersionSourcePicked(pickedId, false);
        });
    });
}

function wpWireVersionSourcePicker() {
    wpRenderVersionSourceDd();
    const sEl = document.getElementById('wpVersionSourceSearch');
    if (sEl) sEl.oninput = function () { wpRenderVersionSourceDd(); };
}

/** يحمّل بيانات الإجراء المختار ويعيد بناء النموذج بأكمله بنفس وضع الإصدار. */
async function wpOnVersionSourcePicked(sourceId, isInitial) {
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkProcedure?id=${sourceId}`);
        if (!res.success) return showToast(res.message || 'خطأ في تحميل الإجراء', 'error');
        const d = res.data || {};
        wpVersionSourceId = sourceId;
        wpVersionSourceData = d;
        wpUsedFormPickerExtras = res.usedFormPickerExtras || [];

        try {
            const peek = await apiFetch(`/WorkProcedures/PeekNextVersionLabel?sourceId=${sourceId}`);
            wpVersionNextLabel = (peek && peek.success && peek.nextVersionLabel) ? peek.nextVersionLabel : 'V2.0';
        } catch { wpVersionNextLabel = 'V2.0'; }

        if (res.workspaces && res.workspaces.length) {
            wpLookups.workspaces = res.workspaces.map((x) => ({ id: x.id, name: x.name }));
        }

        document.getElementById('wpEditSub').textContent = `سيُسجَّل الإصدار الجديد كـ ${wpVersionNextLabel} — جميع الحقول قابلة للتعديل ما عدا «ترميز الإجراء»`;
        const dForForm = Object.assign({}, d, { _versionSourceId: sourceId });
        document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml(dForForm, 'version');

        wpInitFormStaticDds(d);
        wpWireProcedureActionTemplatePickers(d);
        wpRenderWorkspaceDd(d.workspaceId || d.WorkspaceId || 0);
        if (wpIsAdmin) wpRenderOwnerOrgDd(d.organizationalUnitId || d.OrganizationalUnitId || 0);
        wpOnValidityChange();

        let used = [];
        try { used = JSON.parse(d.usedFormDefinitionsJson || d.UsedFormDefinitionsJson || '[]'); } catch { used = []; }
        const usedNorm = used.map((x) => ({
            formDefinitionId: x.formDefinitionId != null ? x.formDefinitionId : x.formdefinitionId
        })).filter((x) => x.formDefinitionId > 0);
        wpRenderUsedFormsCb(usedNorm);
        wpRenderExecutorCb(wpParseExecutorBeneficiaryIds(d));

        let tgt = [], prev = [], next = [], imp = [];
        try { tgt = JSON.parse(d.targetOrganizationalUnitIdsJson || d.TargetOrganizationalUnitIdsJson || '[]'); } catch {}
        try { prev = JSON.parse(d.previousProcedureIdsJson || '[]'); } catch {}
        try { next = JSON.parse(d.nextProcedureIdsJson || '[]'); } catch {}
        try { imp = JSON.parse(d.implicitProcedureIdsJson || '[]'); } catch {}
        wpRenderTargetOrgCb(tgt);
        await wpLoadRelated(sourceId);
        wpInitRelCbDelegation();
        wpRenderAllRelCbs(prev, next, imp);

        wpWireVersionSourcePicker();
        wpUpdateVersionSaveButtons();

        if (!isInitial) showToast(`تم جلب بيانات الإجراء المختار — الإصدار الجديد ${wpVersionNextLabel}`, 'success');
    } catch (e) {
        console.error(e);
        showToast('خطأ في تحميل بيانات الإجراء', 'error');
    }
}

async function wpShowEdit(id) {
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkProcedure?id=${id}`);
        if (!res.success) return showToast(res.message || 'خطأ', 'error');
        const d = res.data;
        wpModeKind = 'edit';
        wpEditId = id;
        wpVersionSourceId = 0;
        wpVersionSourceData = null;
        wpUsedFormPickerExtras = res.usedFormPickerExtras || [];
        wpOuExpandedOwner = {};
        wpOuExpandedTarget = {};
        await wpLoad();
        if (res.workspaces && res.workspaces.length) {
            wpLookups.workspaces = res.workspaces.map(x => ({ id: x.id, name: x.name }));
        }
        document.getElementById('wpEditTitle').textContent = 'تعديل إجراء العمل';
        document.getElementById('wpEditSub').textContent = d.name || '';
        document.getElementById('wpEditHead').className = 'fd-modal-header edit';
        document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml(d, 'edit');
        wpInitFormStaticDds(d);
        wpWireProcedureActionTemplatePickers(d);
        wpRenderWorkspaceDd(d.workspaceId || d.WorkspaceId || 0);
        if (wpIsAdmin) wpRenderOwnerOrgDd(d.organizationalUnitId || d.OrganizationalUnitId || 0);
        wpOnValidityChange();
        let used = [];
        try { used = JSON.parse(d.usedFormDefinitionsJson || d.UsedFormDefinitionsJson || '[]'); } catch { used = []; }
        const usedNorm = used.map(x => ({
            formDefinitionId: x.formDefinitionId != null ? x.formDefinitionId : x.formdefinitionId
        })).filter(x => x.formDefinitionId > 0);
        wpRenderUsedFormsCb(usedNorm);
        wpRenderExecutorCb(wpParseExecutorBeneficiaryIds(d));
        let tgt = [], prev = [], next = [], imp = [];
        try { tgt = JSON.parse(d.targetOrganizationalUnitIdsJson || d.TargetOrganizationalUnitIdsJson || '[]'); } catch {}
        try { prev = JSON.parse(d.previousProcedureIdsJson || '[]'); } catch {}
        try { next = JSON.parse(d.nextProcedureIdsJson || '[]'); } catch {}
        try { imp = JSON.parse(d.implicitProcedureIdsJson || '[]'); } catch {}
        wpRenderTargetOrgCb(tgt);
        await wpLoadRelated(id);
        wpInitRelCbDelegation();
        wpRenderAllRelCbs(prev, next, imp);
        const primaryLabel = wpIsAdmin ? 'نشر الإجراء' : 'إرسال للاعتماد';
        document.getElementById('wpEditFoot').innerHTML = `<div></div><div class="d-flex gap-2 flex-wrap">
            <button type="button" class="fd-save-btn draft" onclick="wpSave(false)"><i class="bi bi-floppy2-fill"></i> حفظ كمسودة</button>
            <button type="button" class="fd-save-btn send" onclick="wpSave(true)"><i class="bi bi-send-fill"></i> ${primaryLabel}</button>
        </div>`;
        wpWizModal().show();
    } catch {
        showToast('خطأ في تحميل البيانات', 'error');
    }
}

/** زر «إصدار جديد» في صف الجدول — يفتح نفس وضع «إصدار نسخة» مع تحديد المصدر مسبقاً. */
async function wpShowCreateNewVersion(sourceId) {
    await wpShowVersionMode(sourceId);
}

// eslint-disable-next-line no-unused-vars
async function _wpShowCreateNewVersion_UNUSED(sourceId) {
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkProcedure?id=${sourceId}`);
        if (!res.success) return showToast(res.message || 'خطأ', 'error');
        const d = res.data;
        const peek = await apiFetch(`/WorkProcedures/PeekNextVersionLabel?sourceId=${sourceId}`);
        const nextVer = peek.success ? (peek.nextVersionLabel || 'V2.0') : 'V2.0';

        wpEditId = null;
        wpUsedFormPickerExtras = res.usedFormPickerExtras || [];
        wpEditActionTypeExtra = null;
        wpEditTemplateExtra = null;
        wpOuExpandedOwner = {};
        wpOuExpandedTarget = {};
        await wpLoad();
        if (res.workspaces && res.workspaces.length) {
            wpLookups.workspaces = res.workspaces.map((x) => ({ id: x.id, name: x.name }));
        }
        document.getElementById('wpEditTitle').textContent = 'إصدار جديد من إجراء العمل';
        document.getElementById('wpEditSub').textContent = `يُسجَّل تلقائياً كـ ${nextVer} — راجع الترميز والاسم (يجب ألا يتكررا)`;
        document.getElementById('wpEditHead').className = 'fd-modal-header create';
        document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml(d);
        const baseEl = document.getElementById('wpBaseProcedureId');
        if (baseEl) baseEl.value = String(sourceId);

        const codeEl = document.getElementById('wpCode');
        if (codeEl) {
            const base = (d.code || '').trim();
            const suf = nextVer.replace(/^V/i, '').replace('.', '_');
            codeEl.value = base ? `${base}-${suf}` : '';
        }
        const nameEl = document.getElementById('wpName');
        if (nameEl) {
            const base = (d.name || '').trim();
            nameEl.value = base ? `${base} (${nextVer})` : '';
        }

        wpInitFormStaticDds(d);
        wpWireProcedureActionTemplatePickers(d);
        wpRenderWorkspaceDd(d.workspaceId || d.WorkspaceId || 0);
        if (wpIsAdmin) wpRenderOwnerOrgDd(d.organizationalUnitId || d.OrganizationalUnitId || 0);
        wpOnValidityChange();
        let used = [];
        try { used = JSON.parse(d.usedFormDefinitionsJson || d.UsedFormDefinitionsJson || '[]'); } catch { used = []; }
        const usedNorm = used.map((x) => ({
            formDefinitionId: x.formDefinitionId != null ? x.formDefinitionId : x.formdefinitionId
        })).filter((x) => x.formDefinitionId > 0);
        wpRenderUsedFormsCb(usedNorm);
        wpRenderExecutorCb(wpParseExecutorBeneficiaryIds(d));
        let tgt = [];
        try { tgt = JSON.parse(d.targetOrganizationalUnitIdsJson || d.TargetOrganizationalUnitIdsJson || '[]'); } catch { tgt = []; }
        wpRenderTargetOrgCb(tgt);
        await wpLoadRelated(null);
        wpInitRelCbDelegation();
        wpRenderAllRelCbs([], [], []);

        const primaryLabel = wpIsAdmin ? 'نشر الإصدار' : 'إرسال للاعتماد';
        document.getElementById('wpEditFoot').innerHTML = `<div></div><div class="d-flex gap-2 flex-wrap">
            <button type="button" class="fd-save-btn draft" onclick="wpSave(false)"><i class="bi bi-floppy2-fill"></i> حفظ كمسودة</button>
            <button type="button" class="fd-save-btn send" onclick="wpSave(true)"><i class="bi bi-send-fill"></i> ${primaryLabel}</button>
        </div>`;
        wpWizModal().show();
    } catch (e) {
        console.error(e);
        showToast('خطأ في تحميل بيانات الإصدار', 'error');
    }
}

function wpValidateCodeNameUnique() {
    if (wpModeKind === 'version') return true;
    const code = (document.getElementById('wpCode')?.value || '').trim();
    const name = (document.getElementById('wpName')?.value || '').trim();
    const excludeId = wpEditId || null;
    const normEq = (a, b) =>
        (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
    for (const r of wpData) {
        const rid = r.id ?? r.Id;
        if (excludeId != null && rid === excludeId) continue;
        if (normEq(r.code ?? r.Code, code)) {
            showToast('ترميز الإجراء مستخدم مسبقاً — لا يُسمح بالتكرار', 'error');
            return false;
        }
        if (normEq(r.name ?? r.Name, name)) {
            showToast('اسم الإجراء مستخدم مسبقاً — لا يُسمح بالتكرار', 'error');
            return false;
        }
    }
    return true;
}

async function wpSave(sendForApproval) {
    if (wpModeKind === 'version' && !wpVersionSourceId) {
        showToast('اختر إجراءً من القائمة قبل الحفظ', 'error');
        return;
    }
    if (!wpValidateCodeNameUnique()) return;
    const payload = wpCollectPayload();
    if (!payload.procedureActionTypeId) {
        showToast('نوع الإجراء مطلوب', 'error');
        return;
    }
    if (!payload.formTemplateId) {
        showToast('القالب المستخدم مطلوب', 'error');
        return;
    }
    payload.sendForApproval = sendForApproval;
    if (wpEditId) payload.id = wpEditId;
    try {
        let res;
        if (wpEditId) res = await apiFetch('/WorkProcedures/UpdateWorkProcedure', 'POST', payload);
        else res = await apiFetch('/WorkProcedures/AddWorkProcedure', 'POST', payload);
        if (res.success) {
            let msg = 'تم حفظ المسودة';
            if (wpModeKind === 'version') {
                msg = sendForApproval
                    ? (wpIsAdmin ? 'تم نشر الإصدار الجديد وتعطيل الإصدار السابق' : 'تم إرسال الإصدار للاعتماد')
                    : 'تم حفظ مسودة الإصدار';
            } else if (sendForApproval) {
                msg = wpIsAdmin ? 'تم نشر الإجراء بنجاح' : 'تم إرسال الإجراء للاعتماد';
            }
            showToast(msg, 'success');
            wpWizModal().hide();
            wpLoad();
        } else showToast(res.message || 'خطأ في الحفظ', 'error');
    } catch {
        showToast('خطأ في الاتصال بالخادم', 'error');
    }
}

async function wpSendApproval(id) {
    if (!confirm('إرسال للاعتماد؟')) return;
    try {
        const r = await apiFetch('/WorkProcedures/SubmitForApproval', 'POST', { id });
        if (r.success) { showToast('تم الإرسال', 'success'); wpLoad(); }
        else showToast(r.message, 'error');
    } catch { showToast('خطأ', 'error'); }
}

async function wpApprove(id) {
    if (!confirm('اعتماد الإجراء؟')) return;
    try {
        const r = await apiFetch('/WorkProcedures/ApproveWorkProcedure', 'POST', { id });
        if (r.success) {
            showToast('تم اعتماد الإجراء. يمكنك التحكم بالتفعيل من عمود التفعيل.', 'success');
            wpLoad();
        } else showToast(r.message, 'error');
    } catch { showToast('خطأ', 'error'); }
}

function wpShowReject(id, name) {
    wpRejectId = id;
    document.getElementById('wpRejectSub').textContent = `الإجراء: ${name}`;
    document.getElementById('wpRejectReason').value = '';
    wpRejModal().show();
}

async function wpSubmitReject() {
    const reason = document.getElementById('wpRejectReason')?.value?.trim();
    if (!reason) return showToast('سبب الرفض مطلوب', 'error');
    try {
        const r = await apiFetch('/WorkProcedures/RejectWorkProcedure', 'POST', { id: wpRejectId, reason });
        if (r.success) { showToast('تم الرفض', 'success'); wpRejModal().hide(); wpLoad(); }
        else showToast(r.message, 'error');
    } catch { showToast('خطأ', 'error'); }
}

function wpShowDelete(id, name) {
    wpDeleteId = id;
    document.getElementById('wpDeleteName').textContent = name;
    wpDelModal().show();
}

async function wpSubmitDelete() {
    try {
        const r = await apiFetch('/WorkProcedures/DeleteWorkProcedure', 'POST', { id: wpDeleteId });
        if (r.success) { showToast('تم الحذف', 'success'); wpDelModal().hide(); wpLoad(); }
        else showToast(r.message, 'error');
    } catch { showToast('خطأ', 'error'); }
}

async function wpShowDetails(id) {
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkProcedure?id=${id}`);
        if (!res.success) return showToast(res.message, 'error');
        const d = res.data;
        await wpLoad();
        await wpLoadRelated(id);
        const activeBadge = d.isActive
            ? '<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle-fill"></i> مفعّل</span>'
            : '<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-dash-circle"></i> غير مفعل</span>';

        let used = [];
        try { used = JSON.parse(d.usedFormDefinitionsJson || '[]'); } catch { used = []; }
        const usedLines = used.map(u => {
            const fid = u.formDefinitionId != null ? u.formDefinitionId : u.formdefinitionId;
            const fd = wpLookups.formDefinitions.find(x => (x.id ?? x.Id) === fid);
            return fd ? esc(fd.name ?? fd.Name) : String(fid);
        }).join('، ') || '—';

        const exBen = wpParseExecutorBeneficiaryIds(d);
        const exNames = wpResolveExecutorRoleNames(exBen);

        let tgt = [], prev = [], next = [], imp = [];
        try { tgt = JSON.parse(d.targetOrganizationalUnitIdsJson || '[]'); } catch { tgt = []; }
        try { prev = JSON.parse(d.previousProcedureIdsJson || '[]'); } catch {}
        try { next = JSON.parse(d.nextProcedureIdsJson || '[]'); } catch {}
        try { imp = JSON.parse(d.implicitProcedureIdsJson || '[]'); } catch {}

        const tgtNames = tgt.map(oid => {
            const u = wpLookups.organizationalUnits.find(x => x.id === oid);
            return u ? esc(u.name) : oid;
        }).join('، ') || '—';

        const rel = (ids) => ids.map(rid => {
            const pr = wpRelated.find(x => x.id === rid) || wpData.find(x => x.id === rid);
            return pr ? esc(pr.code) : rid;
        }).join('، ') || '—';

        let html = `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> المعلومات الأساسية</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">الترميز</span><span class="fd-detail-val" style="font-weight:700;">${esc(d.code)}</span>
                <span class="fd-detail-lbl">الاسم</span><span class="fd-detail-val">${esc(d.name)}</span>
                <span class="fd-detail-lbl">الحالة</span><span class="fd-detail-val">${wpStatusBadge(d.status)}</span>
                <span class="fd-detail-lbl">التفعيل</span><span class="fd-detail-val">${activeBadge}</span>
                <span class="fd-detail-lbl">مساحة العمل</span><span class="fd-detail-val">${esc(d.workspaceName)}</span>
                <span class="fd-detail-lbl">معدل الاستخدام</span><span class="fd-detail-val">${esc(d.usageFrequency)}</span>
                <span class="fd-detail-lbl">التصنيف</span><span class="fd-detail-val">${esc(d.procedureClassification)}</span>
                <span class="fd-detail-lbl">مستوى السرية</span><span class="fd-detail-val">${esc(d.confidentialityLevel)}</span>
                <span class="fd-detail-lbl">نوع الإجراء</span><span class="fd-detail-val">${esc(d.procedureActionTypeName || d.ProcedureActionTypeName) || '—'}</span>
                <span class="fd-detail-lbl">القالب المستخدم</span><span class="fd-detail-val">${esc(d.formTemplateName || d.FormTemplateName) || '—'}</span>
                <span class="fd-detail-lbl">رقم الإصدار</span><span class="fd-detail-val" style="font-weight:700;color:var(--sa-700);">${esc(d.versionLabel || d.VersionLabel || 'V1.0')}</span>
                <span class="fd-detail-lbl">صلاحية الإجراء</span><span class="fd-detail-val">${esc(d.validityType)}</span>
                ${d.validityType === 'مؤقت' ? `<span class="fd-detail-lbl">الفترة</span><span class="fd-detail-val">${esc(d.validityStartDate)} → ${esc(d.validityEndDate)}</span>` : ''}
                <span class="fd-detail-lbl">الوحدة المالكة</span><span class="fd-detail-val">${esc(d.orgUnitName)}</span>
                <span class="fd-detail-lbl">الهدف من الاجراء</span><span class="fd-detail-val">${esc(d.objectives) || '—'}</span>
            </div></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-file-earmark-check"></i> النماذج المستخدمة</div>
            <p class="fd-detail-val">${usedLines}</p></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-person-badge"></i> المنفذون والوحدات</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">أدوار المنفذين</span><span class="fd-detail-val">${exNames}</span>
                <span class="fd-detail-lbl">المستهدفون</span><span class="fd-detail-val">${tgtNames}</span>
            </div></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-link-45deg"></i> العلاقات</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">سابقة</span><span class="fd-detail-val">${rel(prev)}</span>
                <span class="fd-detail-lbl">لاحقة</span><span class="fd-detail-val">${rel(next)}</span>
                <span class="fd-detail-lbl">ضمنية</span><span class="fd-detail-val">${rel(imp)}</span>
            </div></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-input-cursor-text"></i> إضافي</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">المدخلات</span><span class="fd-detail-val">${esc(d.additionalInputs) || '—'}</span>
                <span class="fd-detail-lbl">المخرجات</span><span class="fd-detail-val">${esc(d.additionalOutputs) || '—'}</span>
            </div></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-clock-history"></i> التدقيق</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">أنشأه</span><span class="fd-detail-val">${esc(d.createdBy)}</span>
                <span class="fd-detail-lbl">تاريخ الإنشاء</span><span class="fd-detail-val">${esc(d.createdAt)}</span>
                ${d.approvedBy ? `<span class="fd-detail-lbl">اعتمده</span><span class="fd-detail-val">${esc(d.approvedBy)}</span><span class="fd-detail-lbl">التاريخ</span><span class="fd-detail-val">${esc(d.approvedAt || '')}</span>` : ''}
                ${d.rejectionReason ? `<span class="fd-detail-lbl" style="color:var(--error-600);">سبب الرفض</span><span class="fd-detail-val" style="color:var(--error-700);">${esc(d.rejectionReason)}</span>` : ''}
            </div></div>`;

        document.getElementById('wpDetailsBody').innerHTML = html;
        wpDetModal().show();
    } catch {
        showToast('خطأ في تحميل التفاصيل', 'error');
    }
}

function wpWorkflowPageUrl(id) {
    const b = typeof window !== 'undefined' && window.APP_PATH_BASE ? window.APP_PATH_BASE : '';
    return b + '/WorkProcedures/Workflow/' + encodeURIComponent(id);
}

function wpShowWorkflow(id) {
    window.location.href = wpWorkflowPageUrl(id);
}

function wpWfInitStandalonePage() {
    const id = typeof window.WP_WORKFLOW_PAGE_ID === 'number' ? window.WP_WORKFLOW_PAGE_ID : parseInt(String(window.WP_WORKFLOW_PAGE_ID || '0'), 10);
    if (!id || id <= 0) {
        if (typeof showToast === 'function') showToast('معرّف الإجراء غير صالح', 'error');
        return;
    }
    wpWfProcedureId = id;
    wpWfLoad();
}

function wpWfCloseSection() {
    const b = typeof window !== 'undefined' && window.APP_PATH_BASE ? window.APP_PATH_BASE : '';
    if (window.WP_WORKFLOW_STANDALONE) {
        window.location.href = b + '/WorkProcedures/Index';
        return;
    }
    wpWfProcedureId = null;
    wpWfCtx = null;
    wpWfSteps = [];
    const sec = document.getElementById('wpWorkflowSection');
    if (sec) sec.style.display = 'none';
    try {
        wpWfStepFormModal().hide();
    } catch (e) { /* ignore */ }
    wpWfHideForm();
}

async function wpWfLoad() {
    const id = wpWfProcedureId;
    if (!id) return;
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkflowContext?workProcedureId=${id}`);
        if (!res.success) {
            showToast(res.message || 'تعذر تحميل سير العمل', 'error');
            wpWfCtx = null;
            return;
        }
        wpWfCtx = res;
        wpWfSteps = (res.steps || []).map(wpWfNormalizeStep);
        const sub = document.getElementById('wpWfSub');
        if (sub) sub.textContent = `${res.procedureCode || ''} — ${res.procedureName || ''}`;
        wpWfRenderTable();
        wpWfHideForm();
    } catch (e) {
        console.error('wpWfLoad', e);
        showToast('خطأ في تحميل سير العمل', 'error');
        wpWfCtx = null;
    }
}

function wpWfNormalizeStep(s) {
    const channelsRaw = s.notificationChannels != null ? s.notificationChannels : s.NotificationChannels;
    const channelsList = Array.isArray(channelsRaw) ? channelsRaw.filter((x) => !!x) : null;
    const actionsRaw = s.allowedActions != null ? s.allowedActions : s.AllowedActions;
    const actionsList = Array.isArray(actionsRaw) ? actionsRaw.filter((x) => !!x) : null;
    const assigneeMode = (s.assigneeMode != null ? s.assigneeMode : (s.AssigneeMode || 'specific')) || 'specific';
    return {
        id: s.id != null ? s.id : s.Id,
        sortOrder: s.sortOrder != null ? s.sortOrder : (s.SortOrder ?? 0),
        isDecision: !!(s.isDecision != null ? s.isDecision : s.IsDecision),
        stepLabel: s.stepLabel != null ? s.stepLabel : (s.StepLabel || ''),
        executorRoleId: s.executorRoleId != null ? s.executorRoleId : (s.ExecutorRoleId || 0),
        expectedDurationDays: s.expectedDurationDays != null ? s.expectedDurationDays : (s.ExpectedDurationDays || ''),
        expectedDurationHours: s.expectedDurationHours != null ? s.expectedDurationHours : (s.ExpectedDurationHours || ''),
        isConcurrentStep: !!(s.isConcurrentStep != null ? s.isConcurrentStep : s.IsConcurrentStep),
        escalationSyncFlags: s.escalationSyncFlags != null ? s.escalationSyncFlags : (s.EscalationSyncFlags || null),
        returnStepId: s.returnStepId != null ? s.returnStepId : s.ReturnStepId,
        progressStepId: s.progressStepId != null ? s.progressStepId : s.ProgressStepId,
        formDefinitionId: (() => {
            const v = s.formDefinitionId != null ? s.formDefinitionId : s.FormDefinitionId;
            const n = typeof v === 'number' ? v : parseInt(String(v || '0'), 10);
            return n > 0 ? n : null;
        })(),
        formStatusId: s.formStatusId != null ? s.formStatusId : s.FormStatusId,
        notificationChannel: s.notificationChannel != null ? s.notificationChannel : (s.NotificationChannel || 'in_app'),
        notificationChannels: channelsList,
        overdueNotificationText: s.overdueNotificationText != null ? s.overdueNotificationText : (s.OverdueNotificationText || ''),
        executionNotificationText: s.executionNotificationText != null ? s.executionNotificationText : (s.ExecutionNotificationText || ''),
        notes: s.notes != null ? s.notes : s.Notes,
        assigneeMode: assigneeMode === 'fixed' ? 'fixed' : 'specific',
        assigneeFixedType: s.assigneeFixedType != null ? s.assigneeFixedType : (s.AssigneeFixedType || ''),
        assigneeOrgUnitId: (() => {
            const v = s.assigneeOrgUnitId != null ? s.assigneeOrgUnitId : s.AssigneeOrgUnitId;
            const n = typeof v === 'number' ? v : parseInt(String(v || '0'), 10);
            return n > 0 ? n : null;
        })(),
        allowedActions: actionsList,
        concurrentStepId: (() => {
            const v = s.concurrentStepId != null ? s.concurrentStepId : s.ConcurrentStepId;
            const n = typeof v === 'number' ? v : parseInt(String(v || '0'), 10);
            return n > 0 ? n : null;
        })()
    };
}

function wpWfNextStepId() {
    const ids = wpWfSteps.map((x) => x.id).filter((x) => x > 0);
    if (!ids.length) return 1;
    return Math.max.apply(null, ids) + 1;
}

function wpWfRoleName(roleId) {
    const roles = (wpWfCtx && wpWfCtx.allowedExecutorRoles) || [];
    const r = roles.find((x) => (x.id || x.Id) === roleId);
    return r ? (r.name || r.Name || '') : '—';
}

function wpWfFdName(fdId) {
    if (fdId == null || fdId === '' || fdId === 0) return '—';
    const fds = (wpWfCtx && wpWfCtx.formDefinitions) || [];
    const f = fds.find((x) => (x.id || x.Id) === fdId);
    return f ? (f.name || f.Name || '') : '—';
}

function wpWfFormatDuration(daysRaw, hoursRaw) {
    let d = parseInt(String(daysRaw ?? '').trim(), 10);
    let h = parseInt(String(hoursRaw ?? '').trim(), 10);
    if (isNaN(d)) d = 0;
    if (isNaN(h)) h = 0;
    return `<span class="wp-wf-dur-display"><span class="wp-wf-dur-part"><b>${d}</b> يوم</span><span class="wp-wf-dur-dot">·</span><span class="wp-wf-dur-part"><b>${h}</b> ساعة</span></span>`;
}

function wpWfFsName(fsId) {
    const sts = (wpWfCtx && wpWfCtx.formStatuses) || [];
    const t = sts.find((x) => (x.id || x.Id) === fsId);
    return t ? (t.name || t.Name || '') : '—';
}

function wpWfStepNameById(sid) {
    if (!sid) return '—';
    const st = wpWfSteps.find((x) => x.id === sid);
    return st ? esc(st.stepLabel || '') : '—';
}

function wpWfChannelLabel(ch) {
    const c = (ch || 'in_app').toString().toLowerCase();
    if (c === 'email') return 'البريد الإلكتروني';
    if (c === 'sms') return 'SMS';
    return 'الإشعارات';
}

function wpWfRenderTable() {
    const tbody = document.getElementById('wpWfBody');
    if (!tbody) return;
    const sorted = [].concat(wpWfSteps).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    if (!sorted.length) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4 text-muted">لا توجد خطوات مسجّلة بعد</td></tr>';
        return;
    }
    tbody.innerHTML = sorted.map((s, i) => {
        const dec = !!s.isDecision;
        const mu = () => (dec ? ' class="wp-wf-muted"' : '');
        const na = dec ? '<span class="wp-wf-na">—</span>' : '';
        const dur = dec ? na : wpWfFormatDuration(s.expectedDurationDays, s.expectedDurationHours);
        const fd = dec ? na : esc(wpWfFdName(s.formDefinitionId));
        const fs = dec ? na : esc(wpWfFsName(s.formStatusId));
        const ch = dec ? na : esc(wpWfChannelsLabel(s));
        const allowed = Array.isArray(s.allowedActions) ? s.allowedActions : [];
        const hasReturn = allowed.includes('return');
        const hasConc = allowed.includes('concurrent_approvals');
        const assigneeMode = s.assigneeMode === 'fixed' ? 'ثابت' : 'محدد';
        const returnYesNo = dec ? na : (hasReturn ? 'نعم' : 'لا');
        const concYesNo = dec ? na : (hasConc ? 'نعم' : 'لا');
        const returnStepCell = hasReturn ? wpWfStepNameById(s.returnStepId) : '—';
        return `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${i + 1}</td>
            <td${mu()}>${esc(s.stepLabel || '')}${dec ? ' <span class="badge bg-secondary">قرار</span>' : ''}</td>
            <td style="text-align:center;">${assigneeMode}</td>
            <td>${wpWfAssigneeLabel(s)}</td>
            <td${mu()}>${dur}</td>
            <td class="${dec ? 'wp-wf-muted' : ''}" style="text-align:center;">${returnYesNo}</td>
            <td>${returnStepCell}</td>
            <td class="${dec ? 'wp-wf-muted' : ''}" style="text-align:center;">${concYesNo}</td>
            <td${mu()}>${fd}</td>
            <td${mu()}>${fs}</td>
            <td${mu()}>${ch}</td>
            <td style="text-align:center;white-space:nowrap;">
                <button type="button" class="fd-action-btn fd-action-btn-detail" onclick="wpWfShowDetails(${s.id})"><i class="bi bi-eye"></i></button>
                <button type="button" class="fd-action-btn fd-action-btn-edit" onclick="wpWfShowEditForm(${s.id})"><i class="bi bi-pencil-square"></i></button>
                <button type="button" class="fd-action-btn fd-action-btn-delete" onclick="wpWfDeleteStep(${s.id})"><i class="bi bi-trash3"></i></button>
            </td>
        </tr>`;
    }).join('');
}

/** عرض اسم المنفذ (محدد=دور، أو ثابت=نوع + وحدة عند اللزوم). */
function wpWfAssigneeLabel(s) {
    if (!s) return '—';
    if (s.assigneeMode === 'fixed') {
        const code = s.assigneeFixedType || '';
        const list = (wpWfCtx && wpWfCtx.fixedAssigneeTypes) || [];
        const t = list.find((x) => (x.code != null ? x.code : x.Code) === code);
        const tn = t ? esc(t.name != null ? t.name : t.Name) : esc(code || '—');
        if (s.assigneeOrgUnitId) {
            const ou = ((wpWfCtx && wpWfCtx.organizationalUnits) || []).find((u) => (u.id != null ? u.id : u.Id) === s.assigneeOrgUnitId);
            const oun = ou ? esc(ou.name != null ? ou.name : ou.Name) : '';
            return oun ? `${tn} <span class="text-muted">— ${oun}</span>` : tn;
        }
        return tn;
    }
    return esc(wpWfRoleName(s.executorRoleId));
}

/** عرض قنوات الإشعار كنص متعدد إن وُجدت. */
function wpWfChannelsLabel(s) {
    let arr = [];
    if (s && Array.isArray(s.notificationChannels) && s.notificationChannels.length) arr = s.notificationChannels.slice();
    else if (s && s.notificationChannel) arr = [s.notificationChannel];
    if (!arr.length) return '—';
    return arr.map(wpWfChannelLabel).join('، ');
}

function wpWfHideForm() {
    const w = document.getElementById('wpWfFormWrap');
    if (w) w.innerHTML = '';
    try {
        wpWfStepFormModal().hide();
    } catch (e) { /* ignore */ }
}

function wpWfIsManagerRole(roleId) {
    const roles = (wpWfCtx && wpWfCtx.allowedExecutorRoles) || [];
    const r = roles.find((x) => (x.id || x.Id) === roleId);
    if (!r) return false;
    if (r.isManagerLike === true) return true;
    return false;
}

function wpWfInitialDayHour(st) {
    if (!st) return { d: 0, h: 0 };
    let d = parseInt(String(st.expectedDurationDays ?? '').trim(), 10);
    if (isNaN(d)) d = 0;
    d = Math.max(0, d);
    let h = parseInt(String(st.expectedDurationHours ?? '').trim(), 10);
    if (isNaN(h)) h = 0;
    h = Math.min(24, Math.max(0, h));
    return { d: d, h: h };
}

/** عدّاد +/− لحقول اليوم والساعة في نموذج الخطوة */
function wpWfStepperAdjust(elId, delta, minBound, maxBound) {
    const el = document.getElementById(elId);
    if (!el) return;
    let v = parseInt(el.value, 10);
    if (isNaN(v)) v = minBound != null ? minBound : 0;
    v += delta;
    if (minBound != null && v < minBound) v = minBound;
    if (maxBound != null && v > maxBound) v = maxBound;
    el.value = String(v);
}

function wpWfShowAddForm() {
    if (!wpWfProcedureId) return;
    wpWfRenderForm(null);
}

function wpWfShowEditForm(stepId) {
    wpWfRenderForm(stepId);
}

function wpWfRenderForm(editId) {
    const w = document.getElementById('wpWfFormWrap');
    if (!w) return;
    const st = editId != null ? wpWfSteps.find((x) => x.id === editId) : null;
    const isEdit = !!st;

    // عند الإضافة: لا يوجد اختيار افتراضي للمكلف بالخطوة (يتم إجبار المستخدم على الاختيار).
    // عند التعديل: نلتزم بالقيمة المحفوظة (specific/fixed).
    const initialAssigneeMode = st ? (st.assigneeMode === 'fixed' ? 'fixed' : 'specific') : '';
    const initialFixedType = st ? (st.assigneeFixedType || '') : '';
    const initialOrgUnitId = st ? (st.assigneeOrgUnitId || 0) : 0;
    const initialActions = (st && Array.isArray(st.allowedActions)) ? st.allowedActions.slice() : [];
    const initialChannels = wpWfResolveInitialChannels(st);
    const initialReturnId = st ? (st.returnStepId || 0) : 0;
    const initialConcurrentStepId = st ? (st.concurrentStepId || 0) : 0;
    const initialDays = st ? (st.expectedDurationDays || '0') : '0';

    const ttl = document.getElementById('wpWfStepModalTitle');
    const sub = document.getElementById('wpWfStepModalSub');
    if (ttl) ttl.textContent = isEdit ? 'تعديل خطوة سير عمل' : 'إضافة خطوة سير عمل';
    if (sub) sub.textContent = isEdit ? 'تحديث بيانات الخطوة' : 'أدخل بيانات الخطوة الجديدة';

    w.innerHTML = `
<div class="fd-section wp-wf-step-form" data-mode="${initialAssigneeMode}">
  <div class="fd-section-title"><i class="bi bi-${isEdit ? 'pencil' : 'plus-circle'}"></i> ${isEdit ? 'بيانات الخطوة' : 'بيانات الخطوة الجديدة'}</div>
  <input type="hidden" id="wpWfFormEditId" value="${isEdit ? st.id : ''}">
  <input type="hidden" id="wpWfFormReturnStepId" value="${initialReturnId || ''}">
  <input type="hidden" id="wpWfFormConcurrentStepId" value="${initialConcurrentStepId || ''}">

  <div class="fd-form-row cols-1">
    <div class="fd-form-group">
      <label><span class="required-star">*</span> اسم الخطوة</label>
      <input type="text" class="form-control" id="wpWfStepLabel" value="${st ? esc(st.stepLabel) : ''}" placeholder="اسم الخطوة">
    </div>
  </div>

  <div class="fd-form-row cols-1">
    <div class="fd-form-group">
      <label><span class="required-star">*</span> المكلف بالخطوة</label>
      <div class="wp-wf-radio-row" id="wpWfAssigneeModeRow">
        <label class="wp-wf-radio" data-mode="specific">
          <input type="radio" name="wpWfAssigneeMode" value="specific" ${initialAssigneeMode === 'specific' ? 'checked' : ''}>
          <span>محدد</span>
        </label>
        <label class="wp-wf-radio" data-mode="fixed">
          <input type="radio" name="wpWfAssigneeMode" value="fixed" ${initialAssigneeMode === 'fixed' ? 'checked' : ''}>
          <span>ثابت</span>
        </label>
      </div>
    </div>
  </div>

  <div class="fd-form-row" id="wpWfAssigneeBlock">
    <!-- يُملأ ديناميكياً حسب وضع المكلف -->
  </div>

  <div class="fd-form-row">
    <div class="fd-form-group">
      <label><span class="required-star">*</span> الحالة</label>
      <select class="form-select" id="wpWfFormStatus"><option value="">—</option></select>
    </div>
    <div class="fd-form-group wp-wf-duration-block">
      <span class="wp-wf-duration-section-label"><span class="required-star">*</span> المدة المتوقعة للإنجاز</span>
      <div class="wp-wf-duration-pair">
        <div class="wp-wf-duration-unit">
          <div class="wp-wf-stepper-wrap">
            <div class="wp-wf-stepper" role="group" aria-label="عدد الأيام">
              <button type="button" class="wp-wf-stepper-btn" onclick="wpWfStepperAdjust('wpWfDays',-1,0,null)" aria-label="نقص">−</button>
              <input type="number" class="form-control wp-wf-stepper-input" id="wpWfDays" min="0" step="1" inputmode="numeric" autocomplete="off" value="${esc(initialDays)}">
              <button type="button" class="wp-wf-stepper-btn" onclick="wpWfStepperAdjust('wpWfDays',1,0,null)" aria-label="زيادة">+</button>
            </div>
          </div>
          <span class="wp-wf-duration-suffix">يوم</span>
        </div>
      </div>
    </div>
  </div>

  <div class="fd-form-row cols-1">
    <div class="fd-form-group">
      <label>إشعار تجاوز المدة</label>
      <input type="text" class="form-control" id="wpWfOverdue" value="${st ? esc(st.overdueNotificationText) : ''}">
    </div>
  </div>

  <div class="fd-form-row">
    <div class="fd-form-group">
      <label>النموذج المستخدم</label>
      <select class="form-select" id="wpWfFormDef"><option value="">— لا يوجد —</option></select>
    </div>
    <div class="fd-form-group" id="wpWfChannelGroup">
      <label><span class="required-star">*</span> قناة الإشعار</label>
      <div class="wp-wf-channel-list" id="wpWfChannelHost"></div>
      <div class="wp-wf-channel-note" id="wpWfChannelHint" style="display:none;">قنوات البريد الإلكتروني / SMS جاهزة للربط مستقبلاً (التفعيل الفعلي للإشعارات داخل النظام).</div>
    </div>
  </div>

  <div class="fd-form-row cols-1">
    <div class="fd-form-group">
      <label>نص إشعار تنفيذ الخطوة</label>
      <textarea class="form-control" id="wpWfExecNote" rows="3">${st ? esc(st.executionNotificationText) : ''}</textarea>
    </div>
  </div>

  <div class="fd-form-row cols-1">
    <div class="fd-form-group">
      <label><span class="required-star">*</span> الإجراءات المسموحة</label>
      <div class="wp-wf-actions-list" id="wpWfActionsHost"></div>
      <!-- قوالب صفوف فرعية تُنقل بعد الزر المناسب وقت الرسم -->
      <template id="wpWfReturnRowTpl">
        <div id="wpWfReturnRow" class="wp-wf-sub-row" style="display:none;">
          <div class="wp-wf-sub-row-left">
            <span class="wp-wf-sub-label">خطوة الرجوع <span class="required-star">*</span></span>
            <div class="wp-wf-radio-row wp-wf-yesno" id="wpWfReturnYesNoRow">
              <label class="wp-wf-radio"><input type="radio" name="wpWfReturnYesNo" value="yes" checked><span>نعم</span></label>
              <label class="wp-wf-radio"><input type="radio" name="wpWfReturnYesNo" value="no"><span>لا</span></label>
            </div>
          </div>
          <select class="form-select wp-wf-sub-select" id="wpWfReturnStep"><option value="">—</option></select>
        </div>
      </template>
      <template id="wpWfConcurrentRowTpl">
        <div id="wpWfConcurrentRow" class="wp-wf-sub-row" style="display:none;">
          <div class="wp-wf-sub-row-left">
            <span class="wp-wf-sub-label">خطوة التزامن <span class="required-star">*</span></span>
            <div class="wp-wf-radio-row wp-wf-yesno" id="wpWfConcurrentYesNoRow">
              <label class="wp-wf-radio"><input type="radio" name="wpWfConcurrentYesNo" value="yes" checked><span>نعم</span></label>
              <label class="wp-wf-radio"><input type="radio" name="wpWfConcurrentYesNo" value="no"><span>لا</span></label>
            </div>
          </div>
          <select class="form-select wp-wf-sub-select" id="wpWfConcurrentStep"><option value="">—</option></select>
        </div>
      </template>
    </div>
  </div>

  <div class="fd-form-row cols-1">
    <div class="fd-form-group">
      <label>الملاحظة</label>
      <textarea class="form-control" id="wpWfNotes" rows="2">${st ? esc(st.notes || '') : ''}</textarea>
    </div>
  </div>
</div>
<div class="d-flex gap-2 flex-wrap mt-3 pt-3" style="border-top:1px solid var(--gray-200);">
  <button type="button" class="btn btn-primary" onclick="wpWfSubmitForm()"><i class="bi bi-check-lg"></i> ${isEdit ? 'حفظ التحديث' : 'إضافة'}</button>
  <button type="button" class="fd-cancel-btn" data-bs-dismiss="modal">إلغاء</button>
</div>`;

    // تعبئة قائمة الحالات والنماذج
    wpWfFillSelect('wpWfFormStatus', (wpWfCtx && wpWfCtx.formStatuses) || [], st ? st.formStatusId : null, '—');
    wpWfFillSelect('wpWfFormDef', (wpWfCtx && wpWfCtx.formDefinitions) || [], st ? st.formDefinitionId : null, '— لا يوجد —');

    // قنوات الإشعار + الإجراءات المسموحة
    wpWfRenderChannels(initialChannels);
    wpWfRenderAllowedActions(initialActions);

    // قوائم الخطوات الفرعية (الرجوع/التزامن)
    wpWfFillStepSelect('wpWfReturnStep', editId, initialReturnId);
    wpWfFillStepSelect('wpWfConcurrentStep', editId, initialConcurrentStepId);

    // المكلف
    wpWfRenderAssigneeBlock(initialAssigneeMode, {
        roleId: st ? (st.executorRoleId || 0) : 0,
        fixedType: initialFixedType,
        orgUnitId: initialOrgUnitId
    });

    // ربط الأحداث
    document.querySelectorAll('input[name="wpWfAssigneeMode"]').forEach((r) => {
        r.addEventListener('change', () => {
            if (!r.checked) return;
            const mode = r.value;
            wpWfRenderAssigneeBlock(mode, { roleId: 0, fixedType: '', orgUnitId: 0 });
            const sec = document.querySelector('.wp-wf-step-form');
            if (sec) sec.setAttribute('data-mode', mode);
        });
    });

    document.querySelectorAll('input[name="wpWfReturnYesNo"]').forEach((r) => {
        r.addEventListener('change', () => wpWfUpdateReturnStepVisibility());
    });
    document.querySelectorAll('input[name="wpWfConcurrentYesNo"]').forEach((r) => {
        r.addEventListener('change', () => wpWfUpdateConcurrentStepVisibility());
    });
    wpWfUpdateReturnStepVisibility();
    wpWfUpdateConcurrentStepVisibility();
    wpWfUpdateChannelHint();

    try {
        wpWfStepFormModal().show();
    } catch (e) { console.error(e); }
}

function wpWfFillSelect(id, items, selectedId, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    const ph = placeholder ? `<option value="">${esc(placeholder)}</option>` : '';
    const opts = (items || []).map((x) => {
        const xid = x.id != null ? x.id : x.Id;
        const xn = x.name != null ? x.name : (x.Name || '');
        const sel = (selectedId != null && xid === selectedId) ? 'selected' : '';
        return `<option value="${xid}" ${sel}>${esc(xn)}</option>`;
    }).join('');
    el.innerHTML = ph + opts;
}

function wpWfFillStepSelect(id, editId, selectedStepId) {
    const el = document.getElementById(id);
    if (!el) return;
    const opts = wpWfSteps
        .filter((x) => !editId || x.id !== editId)
        .map((x) => {
            const sel = selectedStepId && x.id === selectedStepId ? 'selected' : '';
            return `<option value="${x.id}" ${sel}>${esc(x.stepLabel || '')}</option>`;
        }).join('');
    el.innerHTML = `<option value="">—</option>${opts}`;
}

function wpWfRoleOptionsHtml(selectedId) {
    const list = (wpWfCtx && wpWfCtx.allowedExecutorRoles) || [];
    return list.map((r) => {
        const id = r.id != null ? r.id : r.Id;
        const nm = r.name != null ? r.name : (r.Name || '');
        const sel = selectedId && id === selectedId ? 'selected' : '';
        return `<option value="${id}" ${sel}>${esc(nm)}</option>`;
    }).join('');
}

function wpWfFixedTypeOptionsHtml(selectedCode) {
    const list = (wpWfCtx && wpWfCtx.fixedAssigneeTypes) || [];
    return list.map((t) => {
        const code = t.code != null ? t.code : t.Code;
        const nm = t.name != null ? t.name : t.Name;
        const sel = selectedCode && code === selectedCode ? 'selected' : '';
        return `<option value="${code}" ${sel}>${esc(nm)}</option>`;
    }).join('');
}

function wpWfFixedTypeNeedsOrgUnit(code) {
    if (!code) return false;
    const list = (wpWfCtx && wpWfCtx.fixedAssigneeTypes) || [];
    const m = list.find((t) => (t.code != null ? t.code : t.Code) === code);
    return m ? !!(m.needsOrgUnit != null ? m.needsOrgUnit : m.NeedsOrgUnit) : false;
}

function wpWfOrgUnitOptionsHtml(selectedId) {
    const list = (wpWfCtx && wpWfCtx.organizationalUnits) || [];
    return list.map((u) => {
        const id = u.id != null ? u.id : u.Id;
        const nm = u.name != null ? u.name : (u.Name || '');
        const sel = selectedId && id === selectedId ? 'selected' : '';
        return `<option value="${id}" ${sel}>${esc(nm)}</option>`;
    }).join('');
}

/** يرسم قسم «المنفذ» حسب نوع المكلف (محدد / ثابت). الوضع الفارغ يخفي الكتلة. */
function wpWfRenderAssigneeBlock(mode, init) {
    const host = document.getElementById('wpWfAssigneeBlock');
    if (!host) return;
    init = init || {};
    if (!mode) {
        host.innerHTML = '';
        host.style.display = 'none';
        return;
    }
    host.style.display = '';
    if (mode === 'fixed') {
        const showOrg = wpWfFixedTypeNeedsOrgUnit(init.fixedType);
        host.innerHTML = `
            <div class="fd-form-group">
                <label><span class="required-star">*</span> المنفذ</label>
                <select class="form-select" id="wpWfFixedType" onchange="wpWfOnFixedTypeChange()">
                    <option value="">— اختر —</option>
                    ${wpWfFixedTypeOptionsHtml(init.fixedType)}
                </select>
            </div>
            <div class="fd-form-group" id="wpWfFixedOrgGroup" style="display:${showOrg ? '' : 'none'};">
                <label><span class="required-star">*</span> الوحدة التنظيمية للمنفذ</label>
                <select class="form-select" id="wpWfFixedOrgUnit">
                    <option value="">— اختر —</option>
                    ${wpWfOrgUnitOptionsHtml(init.orgUnitId)}
                </select>
            </div>`;
    } else {
        host.innerHTML = `
            <div class="fd-form-group" style="grid-column:1 / -1;">
                <label><span class="required-star">*</span> المنفذ</label>
                <select class="form-select" id="wpWfExecutorRoleN">
                    <option value="">— اختر —</option>
                    ${wpWfRoleOptionsHtml(init.roleId)}
                </select>
            </div>`;
    }
}

function wpWfOnFixedTypeChange() {
    const v = (document.getElementById('wpWfFixedType') || {}).value || '';
    const grp = document.getElementById('wpWfFixedOrgGroup');
    if (grp) grp.style.display = wpWfFixedTypeNeedsOrgUnit(v) ? '' : 'none';
}

/** يحدد القنوات الابتدائية مع التوافق مع التخزين القديم (channel مفرد). */
function wpWfResolveInitialChannels(st) {
    if (!st) return ['in_app'];
    if (Array.isArray(st.notificationChannels) && st.notificationChannels.length) {
        return st.notificationChannels.slice();
    }
    const single = (st.notificationChannel || 'in_app').toString();
    return [single];
}

function wpWfRenderChannels(selected) {
    const host = document.getElementById('wpWfChannelHost');
    if (!host) return;
    const channels = [
        { code: 'in_app', label: 'الإشعارات', live: true },
        { code: 'email', label: 'البريد الإلكتروني', live: false },
        { code: 'sms', label: 'رسائل SMS', live: false }
    ];
    const sel = new Set((selected || []).map(String));
    host.innerHTML = channels.map((c) => {
        const checked = sel.has(c.code) ? 'checked' : '';
        const liveBadge = c.live ? '' : '<span class="wp-wf-channel-soon">قريباً</span>';
        return `<label class="wp-wf-channel-chip${checked ? ' is-on' : ''}" data-ch="${c.code}">
            <input type="checkbox" class="wp-wf-channel-cb" value="${c.code}" ${checked} onchange="wpWfOnChannelChange(this)">
            <span>${esc(c.label)}</span>
            ${liveBadge}
        </label>`;
    }).join('');
}

function wpWfOnChannelChange(cb) {
    const lab = cb.closest('.wp-wf-channel-chip');
    if (lab) lab.classList.toggle('is-on', cb.checked);
    wpWfUpdateChannelHint();
}

function wpWfUpdateChannelHint() {
    const host = document.getElementById('wpWfChannelHost');
    const hint = document.getElementById('wpWfChannelHint');
    if (!host || !hint) return;
    const sel = host.querySelectorAll('.wp-wf-channel-cb:checked');
    let hasInactive = false;
    sel.forEach((cb) => { if (cb.value !== 'in_app') hasInactive = true; });
    hint.style.display = hasInactive ? '' : 'none';
}

function wpWfRenderAllowedActions(selected) {
    const host = document.getElementById('wpWfActionsHost');
    if (!host) return;
    const list = (wpWfCtx && wpWfCtx.allowedStepActions) || [];
    const sel = new Set((selected || []).map(String));
    let html = '';
    list.forEach((a) => {
        const code = a.code != null ? a.code : a.Code;
        const nm = a.name != null ? a.name : a.Name;
        const color = a.color != null ? a.color : (a.Color || '#6b7280');
        const checked = sel.has(code) ? 'checked' : '';
        html += `<div class="wp-wf-action-row" data-action-row="${code}">
            <label class="wp-wf-action-chip${checked ? ' is-on' : ''}" data-action="${code}" style="--wf-act-color:${color};">
                <input type="checkbox" class="wp-wf-action-cb" value="${code}" ${checked} onchange="wpWfOnActionChange(this)">
                <span>${esc(nm)}</span>
            </label>
        </div>`;
    });
    host.innerHTML = html;

    // إدراج الصفوف الفرعية تحت الزر المناسب مباشرةً
    const retTpl = document.getElementById('wpWfReturnRowTpl');
    const concTpl = document.getElementById('wpWfConcurrentRowTpl');
    const retSlot = host.querySelector('[data-action-row="return"]');
    const concSlot = host.querySelector('[data-action-row="concurrent_approvals"]');
    if (retTpl && retSlot && !document.getElementById('wpWfReturnRow')) {
        retSlot.appendChild(retTpl.content.cloneNode(true));
    }
    if (concTpl && concSlot && !document.getElementById('wpWfConcurrentRow')) {
        concSlot.appendChild(concTpl.content.cloneNode(true));
    }
}

function wpWfOnActionChange(cb) {
    const lab = cb.closest('.wp-wf-action-chip');
    if (lab) lab.classList.toggle('is-on', cb.checked);
    wpWfUpdateReturnStepVisibility();
    wpWfUpdateConcurrentStepVisibility();
}

function wpWfActionChecked(code) {
    const cb = document.querySelector(`.wp-wf-action-cb[value="${code}"]`);
    return !!(cb && cb.checked);
}

function wpWfUpdateReturnStepVisibility() {
    const row = document.getElementById('wpWfReturnRow');
    const sel = document.getElementById('wpWfReturnStep');
    const isOn = wpWfActionChecked('return');
    if (row) row.style.display = isOn ? '' : 'none';
    if (!isOn) {
        if (sel) sel.value = '';
        return;
    }
    const yes = (document.querySelector('input[name="wpWfReturnYesNo"]:checked') || {}).value || 'yes';
    if (sel) sel.style.display = yes === 'yes' ? '' : 'none';
    if (sel && yes !== 'yes') sel.value = '';
}

function wpWfUpdateConcurrentStepVisibility() {
    const row = document.getElementById('wpWfConcurrentRow');
    const sel = document.getElementById('wpWfConcurrentStep');
    const isOn = wpWfActionChecked('concurrent_approvals');
    if (row) row.style.display = isOn ? '' : 'none';
    if (!isOn) {
        if (sel) sel.value = '';
        return;
    }
    const yes = (document.querySelector('input[name="wpWfConcurrentYesNo"]:checked') || {}).value || 'yes';
    if (sel) sel.style.display = yes === 'yes' ? '' : 'none';
    if (sel && yes !== 'yes') sel.value = '';
}

function wpWfToggleDecisionFields() {
    const v = document.getElementById('wpWfIsDecision')?.value === '1';
    const bD = document.getElementById('wpWfBlockDecision');
    const bN = document.getElementById('wpWfBlockNormal');
    if (bD) bD.style.display = v ? '' : 'none';
    if (bN) bN.style.display = v ? 'none' : '';
}

function wpWfOnExecRoleChange() {
    const rid = parseInt(document.getElementById('wpWfExecutorRoleN')?.value || '0', 10);
    const mgr = wpWfIsManagerRole(rid);
    const syncG = document.getElementById('wpWfSyncGroup');
    const escH = document.getElementById('wpWfEscalationHost');
    const conc = document.getElementById('wpWfConcurrent');
    if (!mgr) {
        if (syncG) syncG.style.display = 'none';
        if (conc) {
            conc.value = '0';
            conc.disabled = true;
        }
        if (escH) escH.style.display = 'none';
    } else {
        if (syncG) syncG.style.display = '';
        if (conc) conc.disabled = false;
        wpWfOnConcurrentChange();
    }
}

function wpWfOnConcurrentChange() {
    const rid = parseInt(document.getElementById('wpWfExecutorRoleN')?.value || '0', 10);
    const mgr = wpWfIsManagerRole(rid);
    const on = document.getElementById('wpWfConcurrent')?.value === '1';
    const escH = document.getElementById('wpWfEscalationHost');
    if (escH) escH.style.display = mgr && on ? '' : 'none';
}

function wpWfAddEscLevel() {
    const host = document.getElementById('wpWfEscalationHost');
    if (!host) return;
    const rows = host.querySelectorAll('.wp-wf-escalation-row').length;
    const div = document.createElement('div');
    div.className = 'wp-wf-escalation-row';
    div.innerHTML = `<span style="font-weight:700;font-size:13px;">مستوى تصعيد ${rows + 1}</span>
      <select class="form-select form-select-sm" style="max-width:140px;" data-wf-esc-idx="${rows}">
        <option value="1">متزامن: نعم</option>
        <option value="0" selected>متزامن: لا</option>
      </select>`;
    const btn = host.querySelector('button');
    if (btn) host.insertBefore(div, btn);
}

function wpWfChannelHint() {
    const ch = document.getElementById('wpWfChannel')?.value || 'in_app';
    const h = document.getElementById('wpWfChannelHint');
    if (h) h.style.display = ch !== 'in_app' ? '' : 'none';
}

function wpWfCollectEscalationFlags() {
    const host = document.getElementById('wpWfEscalationHost');
    if (!host) return [];
    const sel = host.querySelectorAll('select[data-wf-esc-idx]');
    const arr = [];
    sel.forEach((el) => arr.push(el.value === '1'));
    return arr;
}

async function wpWfSubmitForm() {
    const editRaw = document.getElementById('wpWfFormEditId')?.value;
    const editId = editRaw ? parseInt(editRaw, 10) : 0;

    const label = (document.getElementById('wpWfStepLabel')?.value || '').trim();
    if (!label) return showToast('اسم الخطوة مطلوب', 'error');

    const modeEl = document.querySelector('input[name="wpWfAssigneeMode"]:checked');
    const assigneeMode = modeEl ? modeEl.value : '';
    if (!assigneeMode) return showToast('اختر نوع «المكلف بالخطوة» أولاً', 'error');
    let executorRoleId = 0;
    let assigneeFixedType = '';
    let assigneeOrgUnitId = null;
    if (assigneeMode === 'specific') {
        executorRoleId = parseInt(document.getElementById('wpWfExecutorRoleN')?.value || '0', 10);
        if (executorRoleId <= 0) return showToast('اختر المنفذ', 'error');
    } else {
        assigneeFixedType = (document.getElementById('wpWfFixedType')?.value || '').trim();
        if (!assigneeFixedType) return showToast('اختر نوع المنفذ', 'error');
        if (wpWfFixedTypeNeedsOrgUnit(assigneeFixedType)) {
            assigneeOrgUnitId = parseInt(document.getElementById('wpWfFixedOrgUnit')?.value || '0', 10);
            if (!assigneeOrgUnitId || assigneeOrgUnitId <= 0)
                return showToast('الوحدة التنظيمية للمنفذ مطلوبة', 'error');
        }
    }

    const fs = parseInt(document.getElementById('wpWfFormStatus')?.value || '0', 10);
    if (fs <= 0) return showToast('الحالة مطلوبة', 'error');

    const daysRaw = (document.getElementById('wpWfDays')?.value || '').trim();
    const daysNum = parseInt(daysRaw, 10);
    if (isNaN(daysNum) || daysNum < 0) return showToast('المدة المتوقعة للإنجاز مطلوبة وبأرقام موجبة', 'error');

    const fd = parseInt(document.getElementById('wpWfFormDef')?.value || '0', 10);
    const channels = Array.from(document.querySelectorAll('.wp-wf-channel-cb:checked')).map((cb) => cb.value);
    if (!channels.length) return showToast('قناة الإشعار مطلوبة', 'error');

    const allowed = Array.from(document.querySelectorAll('.wp-wf-action-cb:checked')).map((cb) => cb.value);
    if (!allowed.length) return showToast('الإجراءات المسموحة مطلوبة', 'error');

    let returnStepId = null;
    if (allowed.includes('return')) {
        const yes = (document.querySelector('input[name="wpWfReturnYesNo"]:checked') || {}).value || 'yes';
        if (yes === 'yes') {
            returnStepId = parseInt(document.getElementById('wpWfReturnStep')?.value || '0', 10) || null;
            if (!returnStepId) return showToast('خطوة الرجوع مطلوبة', 'error');
        }
    }
    let concurrentStepId = null;
    if (allowed.includes('concurrent_approvals')) {
        const yes = (document.querySelector('input[name="wpWfConcurrentYesNo"]:checked') || {}).value || 'yes';
        if (yes === 'yes') {
            concurrentStepId = parseInt(document.getElementById('wpWfConcurrentStep')?.value || '0', 10) || null;
            if (!concurrentStepId) return showToast('خطوة التزامن مطلوبة', 'error');
        }
    }

    const step = {
        id: editId || wpWfNextStepId(),
        sortOrder: 0,
        isDecision: false,
        stepLabel: label,
        executorRoleId: assigneeMode === 'specific' ? executorRoleId : 0,
        assigneeMode,
        assigneeFixedType,
        assigneeOrgUnitId,
        expectedDurationDays: String(daysNum),
        expectedDurationHours: '',
        isConcurrentStep: false,
        escalationSyncFlags: null,
        returnStepId,
        progressStepId: null,
        formDefinitionId: fd > 0 ? fd : null,
        formStatusId: fs,
        notificationChannel: channels.includes('in_app') ? 'in_app' : channels[0],
        notificationChannels: channels,
        overdueNotificationText: document.getElementById('wpWfOverdue')?.value?.trim() || '',
        executionNotificationText: document.getElementById('wpWfExecNote')?.value?.trim() || '',
        notes: document.getElementById('wpWfNotes')?.value?.trim() || null,
        allowedActions: allowed,
        concurrentStepId
    };

    if (editId) {
        const ix = wpWfSteps.findIndex((x) => x.id === editId);
        if (ix >= 0) {
            step.id = editId;
            wpWfSteps[ix] = step;
        }
    } else {
        wpWfSteps.push(step);
    }
    wpWfReindexSortOrder();
    await wpWfSaveAll();
}

function wpWfReindexSortOrder() {
    const sorted = [].concat(wpWfSteps).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    sorted.forEach((s, i) => {
        const x = wpWfSteps.find((z) => z.id === s.id);
        if (x) x.sortOrder = i + 1;
    });
}

async function wpWfSaveAll() {
    if (!wpWfProcedureId) return;
    const payload = {
        workProcedureId: wpWfProcedureId,
        steps: wpWfSteps.map((s) => ({
            id: s.id,
            sortOrder: s.sortOrder || 0,
            isDecision: s.isDecision,
            stepLabel: s.stepLabel || '',
            executorRoleId: s.executorRoleId,
            expectedDurationDays: s.expectedDurationDays || '',
            expectedDurationHours: s.expectedDurationHours || '',
            isConcurrentStep: !!s.isConcurrentStep,
            escalationSyncFlags: s.escalationSyncFlags || null,
            returnStepId: s.returnStepId,
            progressStepId: s.progressStepId,
            formDefinitionId: (s.formDefinitionId != null && s.formDefinitionId > 0) ? s.formDefinitionId : null,
            formStatusId: s.formStatusId,
            notificationChannel: s.notificationChannel || 'in_app',
            notificationChannels: Array.isArray(s.notificationChannels) && s.notificationChannels.length ? s.notificationChannels : null,
            overdueNotificationText: s.overdueNotificationText || '',
            executionNotificationText: s.executionNotificationText || '',
            notes: s.notes || null,
            assigneeMode: s.assigneeMode === 'fixed' ? 'fixed' : 'specific',
            assigneeFixedType: s.assigneeFixedType || '',
            assigneeOrgUnitId: (s.assigneeOrgUnitId != null && s.assigneeOrgUnitId > 0) ? s.assigneeOrgUnitId : null,
            allowedActions: Array.isArray(s.allowedActions) && s.allowedActions.length ? s.allowedActions : null,
            concurrentStepId: (s.concurrentStepId != null && s.concurrentStepId > 0) ? s.concurrentStepId : null
        }))
    };
    try {
        const res = await apiFetch('/WorkProcedures/SaveWorkflowSteps', 'POST', payload);
        if (res.success) {
            showToast('تم حفظ سير العمل', 'success');
            await wpWfLoad();
        } else showToast(res.message || 'فشل الحفظ', 'error');
    } catch {
        showToast('خطأ في الحفظ', 'error');
    }
}

async function wpWfDeleteStep(id) {
    if (!confirm('حذف هذه الخطوة؟')) return;
    wpWfSteps = wpWfSteps.filter((x) => x.id !== id);
    wpWfReindexSortOrder();
    await wpWfSaveAll();
}

function wpWfShowDetails(id) {
    const s = wpWfSteps.find((x) => x.id === id);
    if (!s) return;
    const sub = document.getElementById('wpWfDetSub');
    if (sub) sub.textContent = esc(s.stepLabel || '');
    const body = document.getElementById('wpWfDetBody');
    if (!body) return;
    const dec = !!s.isDecision;
    let html = '<div class="fd-detail-grid">';
    const modeLbl = s.assigneeMode === 'fixed' ? 'ثابت' : 'محدد';
    html += `<span class="fd-detail-lbl">نوع المكلف</span><span class="fd-detail-val">${esc(modeLbl)}</span>`;
    html += `<span class="fd-detail-lbl">المنفذ</span><span class="fd-detail-val">${wpWfAssigneeLabel(s)}</span>`;
    if (!dec) {
        html += `<span class="fd-detail-lbl">المدة</span><span class="fd-detail-val">${wpWfFormatDuration(s.expectedDurationDays, s.expectedDurationHours)}</span>`;
        html += `<span class="fd-detail-lbl">النموذج</span><span class="fd-detail-val">${esc(wpWfFdName(s.formDefinitionId))}</span>`;
        html += `<span class="fd-detail-lbl">الحالة</span><span class="fd-detail-val">${esc(wpWfFsName(s.formStatusId))}</span>`;
        html += `<span class="fd-detail-lbl">قنوات الإشعار</span><span class="fd-detail-val">${esc(wpWfChannelsLabel(s))}</span>`;
        html += `<span class="fd-detail-lbl">إشعار تجاوز</span><span class="fd-detail-val">${esc(s.overdueNotificationText) || '—'}</span>`;
        html += `<span class="fd-detail-lbl">إشعار التنفيذ</span><span class="fd-detail-val">${esc(s.executionNotificationText) || '—'}</span>`;
        if (Array.isArray(s.allowedActions) && s.allowedActions.length) {
            const list = (wpWfCtx && wpWfCtx.allowedStepActions) || [];
            const html2 = s.allowedActions.map((code) => {
                const m = list.find((a) => (a.code != null ? a.code : a.Code) === code);
                const nm = m ? esc(m.name != null ? m.name : m.Name) : esc(code);
                const color = m ? (m.color != null ? m.color : m.Color) : '#6b7280';
                return `<span class="fd-badge" style="background:${color}1a;color:${color};border:1px solid ${color}55;">${nm}</span>`;
            }).join(' ');
            html += `<span class="fd-detail-lbl">الإجراءات المسموحة</span><span class="fd-detail-val">${html2}</span>`;
        }
    }
    html += `<span class="fd-detail-lbl">خطوة الرجوع</span><span class="fd-detail-val">${wpWfStepNameById(s.returnStepId)}</span>`;
    html += `<span class="fd-detail-lbl">خطوة التزامن</span><span class="fd-detail-val">${wpWfStepNameById(s.concurrentStepId)}</span>`;
    if (s.notes) html += `<span class="fd-detail-lbl">ملاحظة</span><span class="fd-detail-val">${esc(s.notes)}</span>`;
    html += '</div>';
    body.innerHTML = html;
    wpWfDetModal().show();
}

document.addEventListener('DOMContentLoaded', () => {
    wpInitRelCbDelegation();
    const trig = document.getElementById('wpFilterOuTrigger');
    const panel = document.getElementById('wpFilterOuPanel');
    const wrap = document.querySelector('.wp-filt-ou-wrap');
    if (trig && panel) {
        trig.addEventListener('click', (ev) => {
            ev.preventDefault();
            wpFilterOuTogglePanel();
        });
        panel.addEventListener('click', (ev) => {
            const expBtn = ev.target.closest('.wp-filt-ou-tree-exp');
            if (expBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const eid = expBtn.getAttribute('data-exp');
                if (eid) {
                    wpFilterOuExpanded[eid] = !wpFilterOuExpanded[eid];
                    wpRenderFilterOuTreePanel();
                }
                return;
            }
            const row = ev.target.closest('.wp-filt-ou-tree-row');
            if (row && row.getAttribute('data-id') !== null) {
                const rawId = row.getAttribute('data-id');
                const hid = document.getElementById('wpFilterTargetOrg');
                const lab = document.getElementById('wpFilterOuLabel');
                if (rawId === '') {
                    if (hid) hid.value = '';
                    if (lab) lab.textContent = 'الوحدات التنظيمية المستهدفة';
                } else {
                    const uid = parseInt(rawId, 10);
                    const u = (wpLookups.organizationalUnits || []).find((x) => wpOuUnitId(x) === uid);
                    if (u && hid) {
                        hid.value = String(uid);
                        if (lab) lab.textContent = wpOuName(u);
                    }
                }
                wpFilterOuClosePanel();
                wpRenderFilterOuTreePanel();
                wpLoad();
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (!wrap || !panel || panel.classList.contains('d-none')) return;
        if (!wrap.contains(e.target)) wpFilterOuClosePanel();
    });
});
