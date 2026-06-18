'use strict';
/**
 * صندوق الصادر — قائمة طلبات إجراءات العمل مع الفلاتر، التفاصيل، والحذف.
 * يستخدم نفس Design System (rt-*, fd-*) المعتمد في النظام.
 */

var obAll = [];
var obProcedures = [];
var obProcedureTypes = [];
var obStages = [];
var obSelectedDelete = null;

function obEscAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function obFmtDate(s) {
    if (!s) return '—';
    var v = String(s).trim();
    if (!v) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.replace('T', ' ').replace(/\s+/g, ' ').trim();
    try {
        var d = new Date(v);
        if (!isNaN(d.getTime())) {
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var dd = String(d.getDate()).padStart(2, '0');
            var hh = String(d.getHours()).padStart(2, '0');
            var mm = String(d.getMinutes()).padStart(2, '0');
            return y + '-' + m + '-' + dd + ' ' + hh + ':' + mm;
        }
    } catch (e) {}
    return v;
}

function obFillSelect(selId, list, mapper, keep) {
    var el = document.getElementById(selId);
    if (!el) return;
    var current = keep != null ? keep : el.value;
    var firstOpt = el.querySelector('option[value=""]');
    el.innerHTML = '';
    if (firstOpt) el.appendChild(firstOpt);
    (list || []).forEach(function (it) {
        var o = document.createElement('option');
        var pair = mapper(it);
        o.value = pair.v;
        o.textContent = pair.t;
        el.appendChild(o);
    });
    if (current) el.value = current;
}

function obCatBadge(cat) {
    var v = (cat || '').trim();
    if (v === 'مفتوح') return '<span class="ob-badge ob-cat-open"><i class="bi bi-circle-fill" style="font-size:8px;"></i> مفتوح</span>';
    if (v === 'مغلق') return '<span class="ob-badge ob-cat-closed"><i class="bi bi-circle-fill" style="font-size:8px;"></i> مغلق</span>';
    return '<span class="ob-badge" style="background:var(--gray-100);color:var(--gray-600);">' + esc(v || '—') + '</span>';
}

function obPriorityBadge(p) {
    var v = (p || '').trim();
    if (v === 'مرتفع' || v === 'عالي' || v === 'عالية' || v === 'عاجل') return '<span class="ob-badge ob-prio-high"><i class="bi bi-arrow-up"></i> مرتفع</span>';
    if (v === 'منخفض' || v === 'منخفضة') return '<span class="ob-badge ob-prio-low"><i class="bi bi-arrow-down"></i> منخفض</span>';
    return '<span class="ob-badge ob-prio-med"><i class="bi bi-dash"></i> متوسط</span>';
}

function obSlaBadge(s) {
    var v = (s || '').trim();
    if (v === 'مبكر')        return '<span class="ob-badge ob-sla-early"><i class="bi bi-lightning-charge-fill"></i> مبكر</span>';
    if (v === 'في الموعد')   return '<span class="ob-badge ob-sla-onTime"><i class="bi bi-clock-fill"></i> في الموعد</span>';
    if (v === 'متأخر')       return '<span class="ob-badge ob-sla-late"><i class="bi bi-clock-history"></i> متأخر</span>';
    if (v === 'تم التصعيد')  return '<span class="ob-badge ob-sla-escalated"><i class="bi bi-exclamation-octagon-fill"></i> تم التصعيد</span>';
    return '<span class="ob-badge" style="background:var(--gray-100);color:var(--gray-600);">' + esc(v || '—') + '</span>';
}

function obStageBadge(name, color) {
    if (!name) return '<span class="text-muted">—</span>';
    var c = color && /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : '#9DA4AE';
    return '<span class="ob-stage"><span class="ob-stage-dot" style="background:' + c + '"></span>' + esc(name) + '</span>';
}

function obProcTypeChip(item) {
    var ic = item.procedureTypeIcon || 'bi-tag';
    if (ic && ic.indexOf('bi-') !== 0) ic = 'bi-' + ic;
    return '<span class="ob-proc-type"><i class="' + obEscAttr(ic) + '" style="color:' + obEscAttr(item.procedureTypeColor || '#25935F') + '"></i>' + esc(item.procedureTypeName || '—') + '</span>';
}

async function obLoad() {
    var body = document.getElementById('obBody');
    if (body) body.innerHTML = '<tr><td colspan="10" class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></td></tr>';
    var r = await apiFetch('/Outbox/GetRequests');
    if (!r || !r.success) {
        if (body) body.innerHTML = '<tr><td colspan="10"><div class="ob-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر تحميل البيانات</p></div></td></tr>';
        return;
    }
    obAll = r.data || [];
    obProcedures = r.procedures || [];
    obProcedureTypes = r.procedureTypes || [];
    obStages = r.stages || [];

    obFillSelect('obFilterProcedure', obProcedures, function (it) { return { v: it.id, t: it.name }; });
    obFillSelect('obFilterType', obProcedureTypes, function (it) { return { v: it.id, t: it.name }; });
    obFillSelect('obFilterStage', obStages, function (it) { return { v: it.id, t: it.name }; });

    obApplyFilters();
}

function obMatchSearch(item, q) {
    if (!q) return true;
    var s = q.toLowerCase();
    if ((item.requestNumber || '').toLowerCase().indexOf(s) >= 0) return true;
    return false;
}

function obDateBetween(iso, from, to) {
    if (!iso) return false;
    var day = String(iso).substring(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
}

function obApplyFilters() {
    var q = (document.getElementById('obSearch')?.value || '').trim();
    var fProc = document.getElementById('obFilterProcedure')?.value || '';
    var fType = document.getElementById('obFilterType')?.value || '';
    var fCat  = document.getElementById('obFilterCategory')?.value || '';
    var fStage = document.getElementById('obFilterStage')?.value || '';
    var fSla = document.getElementById('obFilterSla')?.value || '';
    var fPrio = document.getElementById('obFilterPriority')?.value || '';
    var fFrom = document.getElementById('obFilterDateFrom')?.value || '';
    var fTo = document.getElementById('obFilterDateTo')?.value || '';

    var list = obAll.filter(function (it) {
        if (!obMatchSearch(it, q)) return false;
        if (fProc && String(it.procedureId) !== String(fProc)) return false;
        if (fType && String(it.procedureTypeId) !== String(fType)) return false;
        if (fCat && it.statusCategory !== fCat) return false;
        if (fStage && it.currentStageName) {
            var st = obStages.find(function (s) { return String(s.id) === String(fStage); });
            if (st && st.name && it.currentStageName !== st.name) return false;
        }
        if (fStage && !it.currentStageName) return false;
        if (fSla && it.slaState !== fSla) return false;
        if (fPrio && it.priority !== fPrio) return false;
        if ((fFrom || fTo) && !obDateBetween(it.submittedAt, fFrom, fTo)) return false;
        return true;
    });

    var countEl = document.getElementById('obCountTxt');
    if (countEl) countEl.textContent = String(obAll.length) + (list.length !== obAll.length ? ' (الظاهر: ' + list.length + ')' : '');

    var body = document.getElementById('obBody');
    if (!body) return;

    if (list.length === 0) {
        body.innerHTML = '<tr><td colspan="10"><div class="ob-empty"><i class="bi bi-inbox"></i><p>لا توجد طلبات مطابقة</p></div></td></tr>';
        return;
    }

    var html = '';
    list.forEach(function (it, i) {
        var isClosed = it.statusCategory === 'مغلق';
        var isNewStage = (it.currentStageName || '').trim() === 'جديد';
        var actions = '<button class="ob-act-btn ob-act-detail" onclick="obShowDetails(' + it.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>';
        if (!isClosed && isNewStage) {
            actions += ' <button class="ob-act-btn ob-act-wf" onclick="obShowWorkflow(' + it.id + ',' + (it.procedureId || 0) + ')" title="سير العمل"><i class="bi bi-diagram-3"></i> سير</button>';
            actions += ' <button class="ob-act-btn ob-act-del" onclick="obAskDelete(' + it.id + ',\'' + obEscAttr(it.requestNumber) + '\')"><i class="bi bi-trash3"></i> حذف</button>';
        }

        html += '<tr>'
            + '<td style="text-align:center;font-weight:700;color:var(--gray-500);">' + (i + 1) + '</td>'
            + '<td><a href="javascript:void(0)" class="ob-req-link" onclick="obShowDetails(' + it.id + ')">' + esc(it.requestNumber || '') + '</a></td>'
            + '<td>' + obProcTypeChip(it) + '</td>'
            + '<td style="font-weight:600;">' + esc(it.procedureName || '—') + '</td>'
            + '<td style="direction:ltr;text-align:right;color:var(--gray-700);">' + esc(obFmtDate(it.submittedAt)) + '</td>'
            + '<td style="text-align:center;">' + obPriorityBadge(it.priority) + '</td>'
            + '<td style="text-align:center;">' + obCatBadge(it.statusCategory) + '</td>'
            + '<td>' + obStageBadge(it.currentStageName, it.currentStageColor) + '</td>'
            + '<td style="text-align:center;">' + obSlaBadge(it.slaState) + '</td>'
            + '<td style="text-align:center;white-space:nowrap;">' + actions + '</td>'
            + '</tr>';
    });
    body.innerHTML = html;
}

function obClearFilters() {
    ['obSearch','obFilterDateFrom','obFilterDateTo'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    ['obFilterProcedure','obFilterType','obFilterCategory','obFilterStage','obFilterSla','obFilterPriority'].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    obApplyFilters();
}

// ─── DETAILS ────────────────────────────────────────────────────────────────
async function obShowDetails(id) {
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('obDetailsModal'));
    var host = document.getElementById('obDetailsBody');
    if (host) host.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    var subEl = document.getElementById('obDetailsSub');
    modal.show();
    var r = await apiFetch('/Outbox/GetRequest?id=' + encodeURIComponent(id));
    if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="ob-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر التحميل</p></div>';
        return;
    }
    var d = r.data || {};
    if (subEl) subEl.textContent = 'رقم الطلب: ' + (d.requestNumber || '—');

    var stagesHtml = '';
    (r.stages || []).forEach(function (s) {
        var dotColor = s.color && /^#/.test(s.color) ? s.color : '#9DA4AE';
        var isCur = d.currentStageId && Number(d.currentStageId) === Number(s.statusId);
        stagesHtml += '<span class="ob-badge" style="background:' + (isCur ? dotColor + '22' : 'var(--gray-50)') + ';color:var(--gray-800);border:1px solid ' + (isCur ? dotColor : 'var(--gray-200)') + ';">'
            + '<span class="ob-stage-dot" style="background:' + dotColor + '"></span>'
            + esc(s.name) + (isCur ? ' (الحالية)' : '') + '</span>';
    });

    var formExtras = '';
    try {
        var fd = JSON.parse(d.formDataJson || '{}');
        if (fd && typeof fd === 'object') {
            ['subject','body'].forEach(function (k) {
                if (fd[k]) formExtras += '<div class="ob-detail-lbl">' + (k === 'subject' ? 'موضوع الطلب' : 'وصف تفصيلي') + '</div><div class="ob-detail-val">' + esc(String(fd[k])) + '</div>';
            });
        }
    } catch (e) {}

    var procDetailsBtn = (d.procedureId || d.procedureId === 0)
        ? '<button type="button" class="ob-act-btn ob-act-detail" style="margin-inline-start:8px;" onclick="obShowProcedureDetails(' + (d.procedureId || 0) + ',' + (d.id || 0) + ')"><i class="bi bi-file-earmark-text"></i> تفاصيل الإجراء</button>'
        : '';

    host.innerHTML =
        '<div class="ob-detail-grid">'
        + '<div class="ob-detail-lbl">رقم الطلب</div><div class="ob-detail-val" style="direction:ltr;">' + esc(d.requestNumber || '—') + '</div>'
        + '<div class="ob-detail-lbl">اسم الإجراء</div><div class="ob-detail-val">' + esc(d.procedureName || '—') + procDetailsBtn + '</div>'
        + '<div class="ob-detail-lbl">نوع الإجراء</div><div class="ob-detail-val">' + esc(d.procedureTypeName || '—') + '</div>'
        + '<div class="ob-detail-lbl">تاريخ التقديم</div><div class="ob-detail-val" style="direction:ltr;text-align:right;">' + esc(obFmtDate(d.submittedAt)) + '</div>'
        + '<div class="ob-detail-lbl">الموعد المتوقع</div><div class="ob-detail-val" style="direction:ltr;text-align:right;">' + esc(obFmtDate(d.expectedDueAt)) + '</div>'
        + '<div class="ob-detail-lbl">الأولوية</div><div class="ob-detail-val">' + obPriorityBadge(d.priority) + '</div>'
        + '<div class="ob-detail-lbl">تصنيف الحالة</div><div class="ob-detail-val">' + obCatBadge(d.statusCategory) + '</div>'
        + '<div class="ob-detail-lbl">الحالة / المرحلة</div><div class="ob-detail-val">' + obStageBadge(d.currentStageName, d.currentStageColor) + '</div>'
        + '<div class="ob-detail-lbl">سرعة الاستجابة SLA</div><div class="ob-detail-val">' + obSlaBadge(d.slaState) + '</div>'
        + '<div class="ob-detail-lbl">تاريخ الإغلاق</div><div class="ob-detail-val" style="direction:ltr;text-align:right;">' + esc(obFmtDate(d.closedAt)) + '</div>'
        + '<div class="ob-detail-lbl">المُقدِّم</div><div class="ob-detail-val">' + esc(d.submittedByName || '—') + (d.submittedByDept ? ' <span class="text-muted">— ' + esc(d.submittedByDept) + '</span>' : '') + '</div>'
        + formExtras
        + (d.notes ? '<div class="ob-detail-lbl">ملاحظات</div><div class="ob-detail-val" style="white-space:pre-wrap;">' + esc(d.notes) + '</div>' : '')
        + (stagesHtml ? '<div class="ob-detail-lbl">مراحل الإجراء</div><div class="ob-detail-val"><div class="d-flex flex-wrap gap-2">' + stagesHtml + '</div></div>' : '')
        + '</div>';
}

// ─── EDIT ───────────────────────────────────────────────────────────────────
async function obShowEdit(id) {
    obSelectedEdit = id;
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('obEditModal'));
    var host = document.getElementById('obEditBody');
    var subEl = document.getElementById('obEditSub');
    host.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    modal.show();

    var r = await apiFetch('/Outbox/GetRequest?id=' + encodeURIComponent(id));
    if (!r || !r.success) { host.innerHTML = '<div class="ob-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر التحميل</p></div>'; return; }
    var d = r.data || {};
    var stages = r.stages || [];
    if (subEl) subEl.textContent = 'رقم الطلب: ' + (d.requestNumber || '—');

    var stageOpts = '';
    stages.forEach(function (s) {
        var sel = d.currentStageId && Number(d.currentStageId) === Number(s.statusId) ? ' selected' : '';
        stageOpts += '<option value="' + obEscAttr(String(s.statusId)) + '"' + sel + '>' + esc(s.name) + ' — ' + esc(s.statusCategory) + '</option>';
    });

    var fd = {};
    try { fd = JSON.parse(d.formDataJson || '{}'); } catch (e) {}

    host.innerHTML =
        '<div class="obs-form-row">'
        +   '<div class="obs-form-group"><label>اسم الإجراء</label>'
        +     '<input type="text" class="form-control" value="' + obEscAttr(d.procedureName || '') + '" readonly style="background:var(--gray-50);font-weight:700;">'
        +   '</div>'
        +   '<div class="obs-form-group"><label>الأولوية</label>'
        +     '<select class="form-select" id="obEditPriority">'
        +       ['منخفض','متوسط','مرتفع'].map(function (p) { return '<option value="' + p + '"' + (p === d.priority || (p === 'مرتفع' && (d.priority === 'عالي' || d.priority === 'عاجل')) ? ' selected' : '') + '>' + p + '</option>'; }).join('')
        +     '</select>'
        +   '</div>'
        + '</div>'
        + '<div class="obs-form-row cols-1">'
        +   '<div class="obs-form-group"><label>الحالة / المرحلة</label>'
        +     '<select class="form-select" id="obEditStage">' + (stageOpts || '<option value="">— لا توجد مراحل —</option>') + '</select>'
        +   '</div>'
        + '</div>'
        + '<div class="obs-form-row cols-1">'
        +   '<div class="obs-form-group"><label>موضوع الطلب</label>'
        +     '<input type="text" class="form-control" id="obEditSubject" value="' + obEscAttr(fd.subject || '') + '">'
        +   '</div>'
        + '</div>'
        + '<div class="obs-form-row cols-1">'
        +   '<div class="obs-form-group"><label>وصف تفصيلي</label>'
        +     '<textarea class="form-control" id="obEditBodyTxt" rows="3">' + esc(fd.body || '') + '</textarea>'
        +   '</div>'
        + '</div>'
        + '<div class="obs-form-row cols-1">'
        +   '<div class="obs-form-group"><label>ملاحظات</label>'
        +     '<textarea class="form-control" id="obEditNotes" rows="2">' + esc(d.notes || '') + '</textarea>'
        +   '</div>'
        + '</div>';
}

async function obSubmitEdit() {
    if (!obSelectedEdit) return;
    var stage = document.getElementById('obEditStage')?.value || '';
    var priority = document.getElementById('obEditPriority')?.value || 'متوسط';
    var subject = document.getElementById('obEditSubject')?.value || '';
    var body = document.getElementById('obEditBodyTxt')?.value || '';
    var notes = document.getElementById('obEditNotes')?.value || '';
    var payload = {
        id: obSelectedEdit,
        priority: priority,
        notes: notes,
        formDataJson: JSON.stringify({ subject: subject.trim(), body: body.trim() })
    };
    if (stage) payload.currentFormStatusId = parseInt(stage, 10);
    var r = await apiFetch('/Outbox/UpdateRequest', 'POST', payload);
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر التحديث', 'danger'); return; }
    showToast(r.message || 'تم التحديث', 'success');
    bootstrap.Modal.getInstance(document.getElementById('obEditModal')).hide();
    obSelectedEdit = null;
    obLoad();
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
function obAskDelete(id, name) {
    obSelectedDelete = id;
    var n = document.getElementById('obDeleteName');
    if (n) n.textContent = name || ('#' + id);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('obDeleteModal')).show();
}

async function obSubmitDelete() {
    if (!obSelectedDelete) return;
    var r = await apiFetch('/Outbox/DeleteRequest', 'POST', { id: obSelectedDelete });
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر الحذف', 'danger'); return; }
    showToast(r.message || 'تم الحذف', 'success');
    bootstrap.Modal.getInstance(document.getElementById('obDeleteModal')).hide();
    obSelectedDelete = null;
    obLoad();
}

function obShowProcedureDetails(procedureId, outboxRequestId) {
    if (!procedureId) return;
    if (typeof window.opdShow === 'function') {
        window.opdShow(procedureId, { outboxRequestId: outboxRequestId || 0 });
    } else {
        showToast('تعذّر فتح تفاصيل الإجراء — أعد تحميل الصفحة', 'danger');
    }
}

function obShowWorkflow(requestId, procedureId) {
    if (procedureId) obShowProcedureDetails(procedureId, requestId);
    else obShowDetails(requestId);
}

window.obLoad = obLoad;
window.obApplyFilters = obApplyFilters;
window.obClearFilters = obClearFilters;
window.obShowDetails = obShowDetails;
window.obAskDelete = obAskDelete;
window.obSubmitDelete = obSubmitDelete;
window.obShowProcedureDetails = obShowProcedureDetails;
window.obShowWorkflow = obShowWorkflow;
