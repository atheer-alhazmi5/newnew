'use strict';

let wpData = [];
let wpLookups = { workspaces: [], formDefinitions: [], executorBeneficiaries: [], executorRoles: [], organizationalUnits: [], myOrgUnitId: 0, myOrgUnitName: '' };
let wpIsAdmin = false;
let wpEditId = null;
let wpRejectId = null;
let wpDeleteId = null;
let wpRelated = [];
let wpWfProcedureId = null;
let wpWfCtx = null;
let wpWfSteps = [];

function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    refill(
        document.getElementById('wpFilterTargetOrg'),
        'الوحدات التنظيمية المستهدفة',
        orgList,
        (u) => u.name ?? u.Name ?? '',
        (u) => u.id ?? u.Id
    );
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
    ['wpSearch', 'wpFilterWorkspace', 'wpFilterFormDef', 'wpFilterValidity', 'wpFilterTargetOrg', 'wpFilterExecutor', 'wpFilterStatus', 'wpFilterActive'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
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
        tbody.innerHTML = `<tr><td colspan="10"><div class="fd-empty-state"><i class="bi bi-diagram-3"></i><p>لا توجد إجراءات بعد</p></div></td></tr>`;
        return;
    }
    const disp = wpIsAdmin ? '' : 'display:none;';
    tbody.innerHTML = wpData.map((f, i) => {
        const toggle = wpIsAdmin
            ? `<label class="fd-toggle" title="${f.status !== 'approved' ? 'يمكن التفعيل للإجراءات المعتمدة فقط' : ''}"><input type="checkbox" ${f.isActive ? 'checked' : ''} ${f.status !== 'approved' ? 'disabled' : ''} onchange="wpToggle(${f.id},this)"><span class="fd-slider"></span></label>`
            : '';
        return `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${i + 1}</td>
            <td style="font-weight:600;">${esc(f.code)}</td>
            <td>${esc(f.name)}</td>
            <td>${esc(f.workspaceName)}</td>
            <td>${esc(f.procedureClassification)}</td>
            <td style="font-size:13px;">${esc(f.orgUnitName)}</td>
            <td style="text-align:center;">${esc(f.validityType)}</td>
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
    host.innerHTML = units
        .map((u) => {
            const id = u.id;
            const checked = id === sid ? 'checked' : '';
            const eid = `wpown_${id}`;
            return `<div class="wp-dd-check-row">
  <input type="radio" class="wp-dd-check-row-cb" name="wpOwnerOuRadio" value="${id}" id="${eid}" ${checked} onclick="event.stopPropagation()">
  <label class="wp-dd-check-row-label" for="${eid}">${esc(u.name)}</label>
</div>`;
        })
        .join('');
    const syncLbl = () => {
        const v = parseInt(hid.value, 10) || 0;
        const u = units.find((x) => x.id === v);
        lbl.textContent = u ? u.name : 'اختر الوحدة التنظيمية المالكة...';
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
    const forms = wpFormsForCurrentWorkspace();
    if (!forms.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد نماذج معتمدة في هذه المساحة ضمن صلاحيتك.</div>';
        if (lbl) lbl.textContent = 'لا توجد نماذج';
        return;
    }
    host.innerHTML = forms.map(f => {
        const fid = f.id ?? f.Id;
        const fname = f.name ?? f.Name ?? '';
        const checked = sel.has(fid);
        return wpDdCheckboxRow('wp-form-cb', `wpu_${fid}`, fid, fname, checked, ` data-fid="${fid}"`);
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
    const sel = new Set(selectedIds || []);
    const units = wpLookups.organizationalUnits || [];
    host.innerHTML = units.map(u => {
        const checked = sel.has(u.id);
        return wpDdCheckboxRow('wp-target-ou-cb', `wptg_${u.id}`, u.id, u.name, checked, '');
    }).join('');
    wpWireCbLabel('wpTargetOrgCbHost', 'wp-target-ou-cb', 'wpTargetDdLbl', 'اختر الوحدات المستهدفة...', 'محدد:');
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
    const usedFiltered = usedPrev.filter((u) => allowedFormIds.has(u.formDefinitionId));
    wpRenderUsedFormsCb(usedFiltered);
    wpRenderAllRelCbs(prevIds, nextIds, impIds);
}

function wpBuildFormHtml(d) {
    d = d || {};
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

    return `
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> البيانات الأساسية</div>
    <div class="fd-form-row">
        <div class="fd-form-group"><label><span class="required-star">*</span> ترميز الإجراء</label><input type="text" class="form-control" id="wpCode" value="${esc(code)}"></div>
        <div class="fd-form-group"><label><span class="required-star">*</span> اسم الإجراء</label><input type="text" class="form-control" id="wpName" value="${esc(name)}"></div>
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
    return {
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
        previousProcedureIds: wpCollectCheckedIds('wpPrevCbHost', 'wp-rel-prev-cb'),
        nextProcedureIds: wpCollectCheckedIds('wpNextCbHost', 'wp-rel-next-cb'),
        implicitProcedureIds: wpCollectCheckedIds('wpImplicitCbHost', 'wp-rel-imp-cb'),
        additionalInputs: document.getElementById('wpAdditionalInputs')?.value || '',
        additionalOutputs: document.getElementById('wpAdditionalOutputs')?.value || ''
    };
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
    wpEditId = null;
    await wpLoad();
    document.getElementById('wpEditTitle').textContent = 'إضافة إجراء عمل جديد';
    document.getElementById('wpEditSub').textContent = 'أدخل بيانات الإجراء';
    document.getElementById('wpEditHead').className = 'fd-modal-header create';
    document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml({});
    wpInitFormStaticDds({});
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

async function wpShowEdit(id) {
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkProcedure?id=${id}`);
        if (!res.success) return showToast(res.message || 'خطأ', 'error');
        const d = res.data;
        wpEditId = id;
        await wpLoad();
        if (res.workspaces && res.workspaces.length) {
            wpLookups.workspaces = res.workspaces.map(x => ({ id: x.id, name: x.name }));
        }
        document.getElementById('wpEditTitle').textContent = 'تعديل إجراء العمل';
        document.getElementById('wpEditSub').textContent = d.name || '';
        document.getElementById('wpEditHead').className = 'fd-modal-header edit';
        document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml(d);
        wpInitFormStaticDds(d);
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

function wpValidateCodeNameUnique() {
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
    if (!wpValidateCodeNameUnique()) return;
    const payload = wpCollectPayload();
    payload.sendForApproval = sendForApproval;
    if (wpEditId) payload.id = wpEditId;
    try {
        let res;
        if (wpEditId) res = await apiFetch('/WorkProcedures/UpdateWorkProcedure', 'POST', payload);
        else res = await apiFetch('/WorkProcedures/AddWorkProcedure', 'POST', payload);
        if (res.success) {
            let msg = 'تم حفظ المسودة';
            if (sendForApproval) msg = wpIsAdmin ? 'تم نشر الإجراء بنجاح' : 'تم إرسال الإجراء للاعتماد';
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
        formDefinitionId: s.formDefinitionId != null ? s.formDefinitionId : s.FormDefinitionId,
        formStatusId: s.formStatusId != null ? s.formStatusId : s.FormStatusId,
        notificationChannel: s.notificationChannel != null ? s.notificationChannel : (s.NotificationChannel || 'in_app'),
        overdueNotificationText: s.overdueNotificationText != null ? s.overdueNotificationText : (s.OverdueNotificationText || ''),
        executionNotificationText: s.executionNotificationText != null ? s.executionNotificationText : (s.ExecutionNotificationText || ''),
        notes: s.notes != null ? s.notes : s.Notes
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
    const fds = (wpWfCtx && wpWfCtx.formDefinitions) || [];
    const f = fds.find((x) => (x.id || x.Id) === fdId);
    return f ? (f.name || f.Name || '') : '—';
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
        tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4 text-muted">لا توجد خطوات مسجّلة بعد</td></tr>';
        return;
    }
    tbody.innerHTML = sorted.map((s, i) => {
        const dec = !!s.isDecision;
        const mu = (c) => (dec ? ` class="wp-wf-muted"` : '');
        const na = dec ? '<span class="wp-wf-na">—</span>' : '';
        const dur = dec
            ? na
            : `${esc(s.expectedDurationDays || '')} / ${esc(s.expectedDurationHours || '')}`;
        const sync = dec ? na : (s.isConcurrentStep ? 'نعم' : 'لا');
        const fd = dec ? na : esc(wpWfFdName(s.formDefinitionId));
        const fs = dec ? na : esc(wpWfFsName(s.formStatusId));
        const ch = dec ? na : esc(wpWfChannelLabel(s.notificationChannel));
        return `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${i + 1}</td>
            <td${mu()}>${esc(s.stepLabel || '')}${dec ? ' <span class="badge bg-secondary">قرار</span>' : ''}</td>
            <td>${esc(wpWfRoleName(s.executorRoleId))}</td>
            <td${mu()}>${dur}</td>
            <td class="${dec ? 'wp-wf-muted' : ''}" style="text-align:center;">${dec ? na : sync}</td>
            <td>${wpWfStepNameById(s.returnStepId)}</td>
            <td>${wpWfStepNameById(s.progressStepId)}</td>
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
    const decision = st ? !!st.isDecision : false;
    const escFlags = (st && st.escalationSyncFlags) || [];
    let escHtml = '';
    escFlags.forEach((flag, idx) => {
        escHtml += `<div class="wp-wf-escalation-row">
            <span style="font-weight:700;font-size:13px;">مستوى تصعيد ${idx + 1}</span>
            <select class="form-select form-select-sm" style="max-width:140px;" data-wf-esc-idx="${idx}" id="wpWfEsc${idx}">
                <option value="1" ${flag ? 'selected' : ''}>متزامن: نعم</option>
                <option value="0" ${!flag ? 'selected' : ''}>متزامن: لا</option>
            </select>
        </div>`;
    });
    const stepOptions = wpWfSteps
        .filter((x) => !editId || x.id !== editId)
        .map((x) => `<option value="${x.id}" ${st && st.returnStepId === x.id ? 'selected' : ''}>${esc(x.stepLabel || '')}</option>`)
        .join('');
    const stepOptionsProg = wpWfSteps
        .filter((x) => !editId || x.id !== editId)
        .map((x) => `<option value="${x.id}" ${st && st.progressStepId === x.id ? 'selected' : ''}>${esc(x.stepLabel || '')}</option>`)
        .join('');
    const rolesOpts = ((wpWfCtx && wpWfCtx.allowedExecutorRoles) || [])
        .map((r) => {
            const id = r.id || r.Id;
            const sel = st && st.executorRoleId === id ? 'selected' : '';
            return `<option value="${id}" ${sel}>${esc(r.name || r.Name || '')}</option>`;
        })
        .join('');
    const fdOpts = ((wpWfCtx && wpWfCtx.formDefinitions) || [])
        .map((f) => {
            const id = f.id || f.Id;
            const sel = st && st.formDefinitionId === id ? 'selected' : '';
            return `<option value="${id}" ${sel}>${esc(f.name || f.Name || '')}</option>`;
        })
        .join('');
    const fsOpts = ((wpWfCtx && wpWfCtx.formStatuses) || [])
        .map((t) => {
            const id = t.id || t.Id;
            const sel = st && st.formStatusId === id ? 'selected' : '';
            return `<option value="${id}" ${sel}>${esc(t.name || t.Name || '')}</option>`;
        })
        .join('');

    const ch = st ? (st.notificationChannel || 'in_app') : 'in_app';
    const { d: wfDayVal, h: wfHourVal } = wpWfInitialDayHour(st);
    const ttl = document.getElementById('wpWfStepModalTitle');
    const sub = document.getElementById('wpWfStepModalSub');
    if (ttl) ttl.textContent = isEdit ? 'تعديل خطوة سير عمل' : 'إضافة خطوة سير عمل';
    if (sub) sub.textContent = isEdit ? 'تحديث بيانات الخطوة' : 'أدخل بيانات الخطوة الجديدة';
    w.innerHTML = `
<div class="fd-section">
<div class="fd-section-title"><i class="bi bi-${isEdit ? 'pencil' : 'plus-circle'}"></i> ${isEdit ? 'بيانات الخطوة' : 'بيانات الخطوة الجديدة'}</div>
<input type="hidden" id="wpWfFormEditId" value="${isEdit ? st.id : ''}">
<div class="fd-form-row cols-1">
  <div class="fd-form-group">
    <label>خطوة قرار</label>
    <select class="form-select" id="wpWfIsDecision" onchange="wpWfToggleDecisionFields()">
      <option value="0" ${!decision ? 'selected' : ''}>لا</option>
      <option value="1" ${decision ? 'selected' : ''}>نعم</option>
    </select>
  </div>
</div>
<div id="wpWfBlockDecision" style="display:${decision ? '' : 'none'};">
  <div class="fd-form-row">
    <div class="fd-form-group"><label><span class="required-star">*</span> المنفذ</label>
      <select class="form-select" id="wpWfExecutorRole">${rolesOpts}</select></div>
    <div class="fd-form-group"><label>التقدم إلى الخطوة</label>
      <select class="form-select" id="wpWfProgressStep"><option value="">—</option>${stepOptionsProg}</select></div>
  </div>
  <div class="fd-form-row cols-1">
    <div class="fd-form-group"><label><span class="required-star">*</span> الرجوع إلى الخطوة</label>
      <select class="form-select" id="wpWfReturnStep"><option value="">—</option>${stepOptions}</select></div>
  </div>
</div>
<div id="wpWfBlockNormal" style="display:${decision ? 'none' : ''};">
  <div class="fd-form-row cols-1">
    <div class="fd-form-group"><label><span class="required-star">*</span> الخطوة</label>
      <input type="text" class="form-control" id="wpWfStepLabel" value="${st ? esc(st.stepLabel) : ''}" placeholder="اسم الخطوة"></div>
  </div>
  <div class="fd-form-row">
    <div class="fd-form-group"><label><span class="required-star">*</span> المنفذ</label>
      <select class="form-select" id="wpWfExecutorRoleN" onchange="wpWfOnExecRoleChange()">${rolesOpts}</select></div>
    <div class="fd-form-group" id="wpWfSyncGroup">
      <label>خطوة متزامنة</label>
      <select class="form-select" id="wpWfConcurrent" onchange="wpWfOnConcurrentChange()">
        <option value="0" ${st && !st.isConcurrentStep ? 'selected' : ''}>لا</option>
        <option value="1" ${st && st.isConcurrentStep ? 'selected' : ''}>نعم</option>
      </select>
    </div>
  </div>
  <div id="wpWfEscalationHost" style="display:none;">${escHtml}
    <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="wpWfAddEscLevel()"><i class="bi bi-plus"></i> إضافة مستوى تصعيد</button>
  </div>
  <div class="fd-form-row">
    <div class="fd-form-group"><label><span class="required-star">*</span> الحالة</label>
      <select class="form-select" id="wpWfFormStatus"><option value="">—</option>${fsOpts}</select></div>
    <div class="fd-form-group"><label><span class="required-star">*</span> النموذج المستخدم</label>
      <select class="form-select" id="wpWfFormDef"><option value="">—</option>${fdOpts}</select></div>
  </div>
  <div class="fd-form-row">
    <div class="fd-form-group">
      <label>يوم (مدة متوقعة)</label>
      <div class="wp-wf-stepper-wrap">
        <div class="wp-wf-stepper" role="group" aria-label="عدد الأيام">
        <button type="button" class="wp-wf-stepper-btn" onclick="wpWfStepperAdjust('wpWfDays',-1,0,null)" title="نقص يوم" aria-label="نقص">−</button>
        <input type="number" class="form-control wp-wf-stepper-input" id="wpWfDays" min="0" step="1" inputmode="numeric" autocomplete="off" value="${wfDayVal}">
        <button type="button" class="wp-wf-stepper-btn" onclick="wpWfStepperAdjust('wpWfDays',1,0,null)" title="زيادة يوم" aria-label="زيادة">+</button>
        </div>
      </div>
    </div>
    <div class="fd-form-group">
      <label>ساعة (0–24)</label>
      <div class="wp-wf-stepper-wrap">
        <div class="wp-wf-stepper" role="group" aria-label="عدد الساعات">
        <button type="button" class="wp-wf-stepper-btn" onclick="wpWfStepperAdjust('wpWfHours',-1,0,24)" title="نقص ساعة" aria-label="نقص">−</button>
        <input type="number" class="form-control wp-wf-stepper-input" id="wpWfHours" min="0" max="24" step="1" inputmode="numeric" autocomplete="off" value="${wfHourVal}">
        <button type="button" class="wp-wf-stepper-btn" onclick="wpWfStepperAdjust('wpWfHours',1,0,24)" title="زيادة ساعة" aria-label="زيادة">+</button>
        </div>
      </div>
    </div>
  </div>
  <div class="fd-form-row cols-1">
    <div class="fd-form-group"><label>إشعار تجاوز المدة</label><input type="text" class="form-control" id="wpWfOverdue" value="${st ? esc(st.overdueNotificationText) : ''}"></div>
  </div>
  <div class="fd-form-row cols-1">
    <div class="fd-form-group"><label>نص إشعار تنفيذ الإجراء</label><textarea class="form-control" id="wpWfExecNote" rows="3">${st ? esc(st.executionNotificationText) : ''}</textarea></div>
  </div>
  <div class="fd-form-row cols-1">
    <div class="fd-form-group"><label>قناة الإشعار</label>
      <select class="form-select" id="wpWfChannel" onchange="wpWfChannelHint()">
        <option value="in_app" ${ch === 'in_app' ? 'selected' : ''}>الإشعارات</option>
        <option value="email" ${ch === 'email' ? 'selected' : ''}>البريد الإلكتروني</option>
        <option value="sms" ${ch === 'sms' ? 'selected' : ''}>SMS</option>
      </select>
      <div class="wp-wf-channel-note" id="wpWfChannelHint" style="display:${ch !== 'in_app' ? '' : 'none'};">سيتم تفعيلها في الإصدارات القادمة</div>
    </div>
  </div>
  <div class="fd-form-row cols-1">
    <div class="fd-form-group"><label>ملاحظة</label><textarea class="form-control" id="wpWfNotes" rows="2">${st ? esc(st.notes || '') : ''}</textarea></div>
  </div>
</div>
<div class="d-flex gap-2 flex-wrap mt-3 pt-3" style="border-top:1px solid var(--gray-200);">
  <button type="button" class="btn btn-primary" onclick="wpWfSubmitForm()"><i class="bi bi-check-lg"></i> ${isEdit ? 'حفظ التحديث' : 'إضافة'}</button>
</div>
</div>`;
    if (!decision) {
        const er = st ? st.executorRoleId : 0;
        const exN = document.getElementById('wpWfExecutorRoleN');
        if (exN && er) exN.value = String(er);
        wpWfOnExecRoleChange();
        wpWfOnConcurrentChange();
    } else {
        const ed = document.getElementById('wpWfExecutorRole');
        if (ed && st) ed.value = String(st.executorRoleId);
    }
    try {
        wpWfStepFormModal().show();
    } catch (e) { console.error(e); }
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
        if (syncG) syncG.style.opacity = '0.5';
        if (conc) {
            conc.value = '0';
            conc.disabled = true;
        }
        if (escH) escH.style.display = 'none';
    } else {
        if (syncG) syncG.style.opacity = '1';
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
    const isDecision = document.getElementById('wpWfIsDecision')?.value === '1';
    let step;
    if (isDecision) {
        const ex = parseInt(document.getElementById('wpWfExecutorRole')?.value || '0', 10);
        const ret = parseInt(document.getElementById('wpWfReturnStep')?.value || '0', 10);
        const prog = parseInt(document.getElementById('wpWfProgressStep')?.value || '0', 10);
        if (ex <= 0) return showToast('اختر المنفذ', 'error');
        if (ret <= 0) return showToast('خطوة الرجوع مطلوبة', 'error');
        step = {
            id: editId || wpWfNextStepId(),
            sortOrder: 0,
            isDecision: true,
            stepLabel: 'قرار',
            executorRoleId: ex,
            expectedDurationDays: '',
            expectedDurationHours: '',
            isConcurrentStep: false,
            escalationSyncFlags: null,
            returnStepId: ret,
            progressStepId: prog > 0 ? prog : null,
            formDefinitionId: null,
            formStatusId: null,
            notificationChannel: 'in_app',
            overdueNotificationText: '',
            executionNotificationText: '',
            notes: null
        };
    } else {
        const label = (document.getElementById('wpWfStepLabel')?.value || '').trim();
        const ex = parseInt(document.getElementById('wpWfExecutorRoleN')?.value || '0', 10);
        if (!label) return showToast('اسم الخطوة مطلوب', 'error');
        if (ex <= 0) return showToast('اختر المنفذ', 'error');
        const hrs = (document.getElementById('wpWfHours')?.value || '').trim();
        if (hrs && (parseInt(hrs, 10) > 24 || parseInt(hrs, 10) < 0)) return showToast('الساعات من 0 إلى 24', 'error');
        const mgr = wpWfIsManagerRole(ex);
        const concurrent = mgr && document.getElementById('wpWfConcurrent')?.value === '1';
        const esc = concurrent ? wpWfCollectEscalationFlags() : null;
        const fd = parseInt(document.getElementById('wpWfFormDef')?.value || '0', 10);
        const fs = parseInt(document.getElementById('wpWfFormStatus')?.value || '0', 10);
        if (fs <= 0) return showToast('الحالة مطلوبة', 'error');
        if (fd <= 0) return showToast('النموذج المستخدم مطلوب', 'error');
        step = {
            id: editId || wpWfNextStepId(),
            sortOrder: 0,
            isDecision: false,
            stepLabel: label,
            executorRoleId: ex,
            expectedDurationDays: document.getElementById('wpWfDays')?.value?.trim() || '',
            expectedDurationHours: hrs,
            isConcurrentStep: !!concurrent,
            escalationSyncFlags: esc && esc.length ? esc : null,
            returnStepId: null,
            progressStepId: null,
            formDefinitionId: fd,
            formStatusId: fs,
            notificationChannel: document.getElementById('wpWfChannel')?.value || 'in_app',
            overdueNotificationText: document.getElementById('wpWfOverdue')?.value?.trim() || '',
            executionNotificationText: document.getElementById('wpWfExecNote')?.value?.trim() || '',
            notes: document.getElementById('wpWfNotes')?.value?.trim() || null
        };
    }
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
            formDefinitionId: s.formDefinitionId,
            formStatusId: s.formStatusId,
            notificationChannel: s.notificationChannel || 'in_app',
            overdueNotificationText: s.overdueNotificationText || '',
            executionNotificationText: s.executionNotificationText || '',
            notes: s.notes || null
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
    html += `<span class="fd-detail-lbl">المنفذ</span><span class="fd-detail-val">${esc(wpWfRoleName(s.executorRoleId))}</span>`;
    if (!dec) {
        html += `<span class="fd-detail-lbl">المدة</span><span class="fd-detail-val">${esc(s.expectedDurationDays)} / ${esc(s.expectedDurationHours)}</span>`;
        html += `<span class="fd-detail-lbl">متزامنة</span><span class="fd-detail-val">${s.isConcurrentStep ? 'نعم' : 'لا'}</span>`;
        if (s.escalationSyncFlags && s.escalationSyncFlags.length) {
            html += `<span class="fd-detail-lbl">تصعيد</span><span class="fd-detail-val">${s.escalationSyncFlags.map((x, i) => `المستوى ${i + 1}: ${x ? 'نعم' : 'لا'}`).join(' — ')}</span>`;
        }
        html += `<span class="fd-detail-lbl">النموذج</span><span class="fd-detail-val">${esc(wpWfFdName(s.formDefinitionId))}</span>`;
        html += `<span class="fd-detail-lbl">الحالة</span><span class="fd-detail-val">${esc(wpWfFsName(s.formStatusId))}</span>`;
        html += `<span class="fd-detail-lbl">قناة الإشعار</span><span class="fd-detail-val">${esc(wpWfChannelLabel(s.notificationChannel))}</span>`;
        html += `<span class="fd-detail-lbl">إشعار تجاوز</span><span class="fd-detail-val">${esc(s.overdueNotificationText)}</span>`;
        html += `<span class="fd-detail-lbl">إشعار التنفيذ</span><span class="fd-detail-val">${esc(s.executionNotificationText)}</span>`;
    }
    html += `<span class="fd-detail-lbl">الرجوع</span><span class="fd-detail-val">${wpWfStepNameById(s.returnStepId)}</span>`;
    html += `<span class="fd-detail-lbl">التقدم</span><span class="fd-detail-val">${wpWfStepNameById(s.progressStepId)}</span>`;
    if (s.notes) html += `<span class="fd-detail-lbl">ملاحظة</span><span class="fd-detail-val">${esc(s.notes)}</span>`;
    html += '</div>';
    body.innerHTML = html;
    wpWfDetModal().show();
}

document.addEventListener('DOMContentLoaded', () => wpInitRelCbDelegation());
