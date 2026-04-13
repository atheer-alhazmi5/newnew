'use strict';

let wpData = [];
let wpLookups = { workspaces: [], formDefinitions: [], executorBeneficiaries: [], organizationalUnits: [], myOrgUnitId: 0, myOrgUnitName: '' };
let wpIsAdmin = false;
let wpEditId = null;
let wpRejectId = null;
let wpDeleteId = null;
let wpRelated = [];

function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const wpWizModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpEditModal'));
const wpDetModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpDetailsModal'));
const wpRejModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpRejectModal'));
const wpDelModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpDeleteModal'));
const wpFlowModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('wpWorkflowModal'));

async function wpLoad() {
    const search = document.getElementById('wpSearch')?.value || '';
    const status = document.getElementById('wpFilterStatus')?.value || '';
    const validity = document.getElementById('wpFilterValidity')?.value || '';
    const workspaceId = document.getElementById('wpFilterWorkspace')?.value || '';
    const formDefinitionId = document.getElementById('wpFilterFormDef')?.value || '';
    const isActive = document.getElementById('wpFilterActive')?.value || '';
    const p = new URLSearchParams({ search, status, validity, isActive });
    if (workspaceId) p.set('workspaceId', workspaceId);
    if (formDefinitionId) p.set('formDefinitionId', formDefinitionId);
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
    const wsSel = document.getElementById('wpFilterWorkspace');
    const fdSel = document.getElementById('wpFilterFormDef');
    if (wsSel && wsSel.options.length <= 1) {
        (res.workspaces || []).forEach(w => wsSel.add(new Option(w.name, w.id)));
    }
    if (fdSel && fdSel.options.length <= 1) {
        (res.formDefinitions || []).forEach(f => fdSel.add(new Option(f.name, f.id)));
    }
    const th = document.getElementById('wpThActive');
    if (th) th.style.display = wpIsAdmin ? '' : 'none';
}

function wpClear() {
    ['wpSearch', 'wpFilterValidity', 'wpFilterStatus', 'wpFilterActive', 'wpFilterWorkspace', 'wpFilterFormDef'].forEach(id => {
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

function wpOptsWorkspaces(selectedId) {
    return wpLookups.workspaces.map(w => `<option value="${w.id}" ${w.id == selectedId ? 'selected' : ''}>${esc(w.name)}</option>`).join('');
}

function wpOptsOrgUnits(selIds) {
    const set = new Set(selIds || []);
    return wpLookups.organizationalUnits.map(u => `<option value="${u.id}" ${set.has(u.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
}

/** مدير النظام: قائمة اختيار. ممثل الوحدة: عرض ثابت (وحدة عمله عند الإنشاء، وحدة الإجراء عند التعديل). */
function wpOwnerOrgFieldHtml(d) {
    d = d || {};
    const owner = d.organizationalUnitId || d.OrganizationalUnitId || 0;
    const ownerName = d.orgUnitName || d.OrgUnitName || '';
    if (wpIsAdmin) {
        return `<select class="form-select" id="wpOrganizationalUnitId"><option value="">-- اختر --</option>${wpOptsOrgUnits([owner])}</select>`;
    }
    const lockedId = wpEditId ? owner : (wpLookups.myOrgUnitId || 0);
    const lockedName = wpEditId
        ? (ownerName || (wpLookups.organizationalUnits || []).find(u => u.id === owner)?.name || '—')
        : (wpLookups.myOrgUnitName || (wpLookups.organizationalUnits || []).find(u => u.id === lockedId)?.name || '—');
    return `<input type="hidden" id="wpOrganizationalUnitId" value="${lockedId}">
        <div class="form-control" style="background:var(--gray-50);cursor:default;border:2px solid var(--gray-200);border-radius:10px;">${esc(lockedName)}</div>
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

function wpRenderExecutorCb(selectedIds) {
    const host = document.getElementById('wpExecCbHost');
    if (!host) return;
    const sel = new Set(selectedIds || []);
    const items = wpLookups.executorBeneficiaries || [];
    if (!items.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا يوجد موظفون مضافون في أدوار المنفذين.</div>';
        const lbl = document.getElementById('wpExecDdLbl');
        if (lbl) lbl.textContent = 'لا يوجد منفذون';
        return;
    }
    host.innerHTML = items.map(b => {
        const id = b.id;
        const checked = sel.has(id);
        return wpDdCheckboxRow('wp-exec-cb', `wpex_${id}`, id, b.fullName, checked, '');
    }).join('');
    wpWireCbLabel('wpExecCbHost', 'wp-exec-cb', 'wpExecDdLbl', 'اختر المنفذين...', 'محدد:');
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
    const forms = wpLookups.formDefinitions || [];
    if (!forms.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">لا توجد نماذج مستخدمة متاحة لصلاحيتك.</div>';
        const lbl = document.getElementById('wpUsedDdLbl');
        if (lbl) lbl.textContent = 'لا توجد نماذج';
        return;
    }
    host.innerHTML = forms.map(f => {
        const checked = sel.has(f.id);
        return wpDdCheckboxRow('wp-form-cb', `wpu_${f.id}`, f.id, f.name, checked, ` data-fid="${f.id}"`);
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

function wpRenderRelCb(hostId, cbClass, lblId, selectedIds) {
    const host = document.getElementById(hostId);
    if (!host) return;
    const sel = new Set(selectedIds || []);
    const list = wpRelated || [];
    if (!list.length) {
        host.innerHTML = '<div class="px-3 py-2 text-muted small">اختر مساحة عمل أولاً أو لا توجد إجراءات أخرى.</div>';
        const lbl = document.getElementById(lblId);
        if (lbl) lbl.textContent = '—';
        return;
    }
    host.innerHTML = list.map(p => {
        const checked = sel.has(p.id);
        const uid = hostId + '_p_' + p.id;
        const lbl = `${p.code} — ${p.name}`;
        return wpDdCheckboxRow(cbClass, uid, p.id, lbl, checked, '');
    }).join('');
    const emptyMap = { wpPrevDdLbl: 'الإجراءات السابقة...', wpNextDdLbl: 'الإجراءات اللاحقة...', wpImplicitDdLbl: 'الإجراءات الضمنية...' };
    wpWireCbLabel(hostId, cbClass, lblId, emptyMap[lblId] || 'اختر...', 'محدد:');
}

async function wpLoadRelated(workspaceId, excludeId) {
    if (!workspaceId) {
        wpRelated = [];
        return;
    }
    const q = `workspaceId=${workspaceId}${excludeId ? `&excludeId=${excludeId}` : ''}`;
    try {
        const r = await apiFetch(`/WorkProcedures/ListRelatedProcedures?${q}`);
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
    await wpLoadRelated(ws, wpEditId);
    wpRenderRelCb('wpPrevCbHost', 'wp-rel-prev-cb', 'wpPrevDdLbl', prevIds);
    wpRenderRelCb('wpNextCbHost', 'wp-rel-next-cb', 'wpNextDdLbl', nextIds);
    wpRenderRelCb('wpImplicitCbHost', 'wp-rel-imp-cb', 'wpImplicitDdLbl', impIds);
}

function wpBuildFormHtml(d) {
    d = d || {};
    const code = d.code || '';
    const name = d.name || '';
    const objectives = d.objectives || '';
    const ws = d.workspaceId || 0;
    const usage = d.usageFrequency || 'شهري';
    const procClass = d.procedureClassification || 'رئيسي';
    const conf = d.confidentialityLevel || 'متوسط';
    const valType = d.validityType || 'دائم';
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
    <div class="fd-form-row cols-1">
        <div class="fd-form-group"><label>الأنظمة واللوائح والتعليمات (مرفق)</label>
            <input type="file" class="form-control" id="wpRegFiles" multiple onchange="wpSyncFileJson('wpRegFiles','wpRegulationsAttachmentsJson')">
            <input type="hidden" id="wpRegulationsAttachmentsJson" value="${esc(d.regulationsAttachmentsJson || '[]')}">
            <span class="text-muted small">يُخزن اسم الملف للمرجعية</span>
        </div>
    </div>
    <div class="fd-form-row">
        <div class="fd-form-group"><label><span class="required-star">*</span> مساحة العمل</label>
            <select class="form-select" id="wpWorkspaceId" onchange="wpOnWorkspaceChange()"><option value="">-- اختر --</option>${wpOptsWorkspaces(ws)}</select></div>
        <div class="fd-form-group"><label><span class="required-star">*</span> معدل الاستخدام</label>
            <select class="form-select" id="wpUsageFrequency">
                <option ${usage === 'يومي' ? 'selected' : ''}>يومي</option>
                <option ${usage === 'أسبوعي' ? 'selected' : ''}>أسبوعي</option>
                <option ${usage === 'شهري' ? 'selected' : ''}>شهري</option>
                <option ${usage === 'ربع سنوي' ? 'selected' : ''}>ربع سنوي</option>
                <option ${usage === 'نصف سنوي' ? 'selected' : ''}>نصف سنوي</option>
                <option ${usage === 'سنوي' ? 'selected' : ''}>سنوي</option>
            </select></div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-file-earmark-check"></i> النماذج المستخدمة</div>
    <p class="small text-muted mb-2">يُعرض حسب الصلاحية: مدير النظام يرى كل النماذج المستخدمة؛ ممثل الوحدة يرى ما يُسمح له به.</p>
    <div class="dropdown wp-dd w-100">
        <button class="dropdown-toggle wp-dd-toggle" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">
            <span id="wpUsedDdLbl">اختر النماذج...</span>
        </button>
        <div class="dropdown-menu wp-dd-menu w-100 p-0">
            <div id="wpUsedFormsCbHost"></div>
        </div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-person-badge"></i> المنفذين والتصنيف</div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group">
            <label><span class="required-star">*</span> المنفذين للإجراء</label>
            <p class="small text-muted mb-2">الموظفون المضافون ضمن <strong>أدوار المنفذين</strong> (يظهرون هنا للاختيار).</p>
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
    <div class="fd-form-row">
        <div class="fd-form-group"><label><span class="required-star">*</span> التصنيف</label>
            <select class="form-select" id="wpProcedureClassification">
                <option ${procClass === 'رئيسي' ? 'selected' : ''}>رئيسي</option>
                <option ${procClass === 'ثانوي' ? 'selected' : ''}>ثانوي</option>
                <option ${procClass === 'مساند' ? 'selected' : ''}>مساند</option>
            </select></div>
        <div class="fd-form-group"><label><span class="required-star">*</span> مستوى السرية</label>
            <select class="form-select" id="wpConfidentialityLevel">
                <option ${conf === 'منخفض' ? 'selected' : ''}>منخفض</option>
                <option ${conf === 'متوسط' ? 'selected' : ''}>متوسط</option>
                <option ${conf === 'مرتفع' ? 'selected' : ''}>مرتفع</option>
            </select></div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-calendar-range"></i> صلاحية الإجراء</div>
    <div class="fd-form-row">
        <div class="fd-form-group"><label><span class="required-star">*</span> الصلاحية</label>
            <select class="form-select" id="wpValidityType" onchange="wpOnValidityChange()">
                <option value="دائم" ${valType === 'دائم' ? 'selected' : ''}>دائم</option>
                <option value="مؤقت" ${valType === 'مؤقت' ? 'selected' : ''}>مؤقت</option>
            </select></div>
    </div>
    <div class="fd-form-row" id="wpValidityDatesRow" style="display:${valType === 'مؤقت' ? '' : 'none'};">
        <div class="fd-form-group"><label><span class="required-star">*</span> تاريخ بداية الصلاحية</label><input type="date" class="form-control" id="wpValidityStart" value="${esc(vs)}"></div>
        <div class="fd-form-group"><label><span class="required-star">*</span> تاريخ نهاية الصلاحية</label><input type="date" class="form-control" id="wpValidityEnd" value="${esc(ve)}"></div>
    </div>
</div>
<div class="fd-section">
    <div class="fd-section-title"><i class="bi bi-building"></i> الوحدات التنظيمية</div>
    <div class="fd-form-row">
        <div class="fd-form-group"><label><span class="required-star">*</span> الوحدة التنظيمية المالكة للإجراء</label>
            ${wpOwnerOrgFieldHtml(d)}</div>
    </div>
    <div class="fd-form-row cols-1">
        <div class="fd-form-group">
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
    <div class="fd-section-title"><i class="bi bi-link-45deg"></i> العلاقات (نفس مساحة العمل)</div>
    <p class="small text-muted mb-2">بعد اختيار مساحة العمل، تظهر الإجراءات الأخرى ضمنها للاختيار.</p>
    <div class="fd-form-row cols-3">
        <div class="fd-form-group">
            <label>الإجراءات السابقة</label>
            <div class="dropdown wp-dd wp-dd-sm w-100">
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
            <div class="dropdown wp-dd wp-dd-sm w-100">
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
            <div class="dropdown wp-dd wp-dd-sm w-100">
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
        executorBeneficiaryIds: wpCollectCheckedIds('wpExecCbHost', 'wp-exec-cb'),
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

async function wpShowCreate() {
    wpEditId = null;
    await wpLoad();
    document.getElementById('wpEditTitle').textContent = 'إضافة إجراء عمل جديد';
    document.getElementById('wpEditSub').textContent = 'أدخل بيانات الإجراء';
    document.getElementById('wpEditHead').className = 'fd-modal-header create';
    document.getElementById('wpEditBody').innerHTML = wpBuildFormHtml({});
    wpOnValidityChange();
    wpRenderUsedFormsCb([]);
    wpRenderExecutorCb([]);
    wpRenderTargetOrgCb([]);
    await wpLoadRelated(parseInt(document.getElementById('wpWorkspaceId')?.value || '0', 10), null);
    wpRenderRelCb('wpPrevCbHost', 'wp-rel-prev-cb', 'wpPrevDdLbl', []);
    wpRenderRelCb('wpNextCbHost', 'wp-rel-next-cb', 'wpNextDdLbl', []);
    wpRenderRelCb('wpImplicitCbHost', 'wp-rel-imp-cb', 'wpImplicitDdLbl', []);
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
        await wpLoadRelated(d.workspaceId || d.WorkspaceId, id);
        wpRenderRelCb('wpPrevCbHost', 'wp-rel-prev-cb', 'wpPrevDdLbl', prev);
        wpRenderRelCb('wpNextCbHost', 'wp-rel-next-cb', 'wpNextDdLbl', next);
        wpRenderRelCb('wpImplicitCbHost', 'wp-rel-imp-cb', 'wpImplicitDdLbl', imp);
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

async function wpSave(sendForApproval) {
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
        await wpLoadRelated(d.workspaceId || d.WorkspaceId || 0, id);
        const activeBadge = d.isActive
            ? '<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle-fill"></i> مفعّل</span>'
            : '<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-dash-circle"></i> غير مفعل</span>';

        let used = [];
        try { used = JSON.parse(d.usedFormDefinitionsJson || '[]'); } catch { used = []; }
        const usedLines = used.map(u => {
            const fid = u.formDefinitionId != null ? u.formDefinitionId : u.formdefinitionId;
            const fd = wpLookups.formDefinitions.find(x => x.id === fid);
            return fd ? esc(fd.name) : String(fid);
        }).join('، ') || '—';

        let exBen = wpParseExecutorBeneficiaryIds(d);
        const exNames = exBen.map(bid => {
            const b = (wpLookups.executorBeneficiaries || []).find(x => x.id === bid);
            return b ? esc(b.fullName) : bid;
        }).join('، ') || '—';

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
                <span class="fd-detail-lbl">أهداف الإجراء</span><span class="fd-detail-val">${esc(d.objectives) || '—'}</span>
            </div></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-file-earmark-check"></i> النماذج المستخدمة</div>
            <p class="fd-detail-val">${usedLines}</p></div>`;

        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-person-badge"></i> المنفذون والوحدات</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">المنفذون</span><span class="fd-detail-val">${exNames}</span>
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

async function wpShowWorkflow(id) {
    const f = wpData.find(x => x.id === id);
    document.getElementById('wpFlowSub').textContent = f ? `${esc(f.code)} — ${esc(f.name)}` : '';
    let d = f;
    try {
        const res = await apiFetch(`/WorkProcedures/GetWorkProcedure?id=${id}`);
        if (res.success) d = res.data;
    } catch {}
    const steps = [];
    steps.push({ t: 'إنشاء', v: `${esc(d.createdBy || '')} — ${esc(d.createdAt || '')}` });
    if (d.status === 'pending') steps.push({ t: 'بانتظار الاعتماد', v: '—' });
    if (d.status === 'approved') steps.push({ t: 'معتمد', v: `${esc(d.approvedBy || '')} — ${esc(d.approvedAt || '')}` });
    if (d.status === 'rejected') steps.push({ t: 'مرفوض', v: esc(d.rejectionReason || '') });
    let html = '<div class="list-group list-group-flush">';
    steps.forEach(s => {
        html += `<div class="list-group-item"><strong>${s.t}</strong><div class="small text-muted">${s.v}</div></div>`;
    });
    html += '</div>';
    document.getElementById('wpFlowBody').innerHTML = html;
    wpFlowModal().show();
}
