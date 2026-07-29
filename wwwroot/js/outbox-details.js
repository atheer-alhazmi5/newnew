'use strict';
/**
 * صفحة تفاصيل الطلب (صندوق الصادر) — عرض كامل الصفحة بدل النافذة المنبثقة.
 *
 * تعتمد على:
 *  - outbox.js            : مساعدات البادجات والتواريخ (obFmtDate, obCatBadge, ...)
 *  - form-definitions.js  : بناء النموذج بنفس تصميم شاشة التعبئة (fdBuildFormPreview)
 *  - outbox-attachments.js: رفع المرفقات وتنسيق أسمائها وأحجامها
 *  - outbox-procedure-details.js : نافذة «تفاصيل الإجراء» دون أي تغيير في سلوكها
 */

var obdRequestId = 0;
var obdPendingFiles = [];

/** أنواع الحقول التي لا يمكن حقن قيمتها في الإدخال، فتُعرض ببديل للقراءة فقط. */
var OBD_CUSTOM_VALUE_TYPES = [
    'رفع ملف', 'جدول بيانات', 'شبكة خيارات متعددة', 'شبكة مربعات اختيار',
    'توقيع', 'تأشير', 'البيانات التلقائية للمستفيد', 'بيانات التصديق'
];

/** الحقول البنيوية التي لا تحمل قيمة. */
var OBD_STRUCTURAL_TYPES = ['عنوان', 'خط فاصل', 'فاصل صفحات', 'صورة عرض'];

// ─── PAGE LOAD ──────────────────────────────────────────────────────────────
async function obdLoad(id) {
    obdRequestId = parseInt(id, 10) || 0;
    if (!obdRequestId) {
        obdRenderInfoState('bi-exclamation-circle', 'الطلب غير محدد');
        return;
    }

    await obdLoadInfo();
    await Promise.all([obdLoadForm(), obdLoadComments(), obdLoadDocuments()]);
}

/** تبديل التبويب المعروض — بنفس آلية تبويبات لوحة المعلومات. */
function obdSelectTab(name) {
    document.querySelectorAll('.dash-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    var map = {
        form: 'obdPanelForm',
        workflow: 'obdPanelWorkflow',
        comments: 'obdPanelComments',
        documents: 'obdPanelDocuments'
    };
    Object.keys(map).forEach(function (k) {
        var el = document.getElementById(map[k]);
        if (el) el.classList.toggle('active', k === name);
    });
}

// ─── REQUEST INFO CARD ──────────────────────────────────────────────────────
async function obdLoadInfo() {
    var host = document.getElementById('obdContent');
    if (!host) return;

    var r = await apiFetch('/Outbox/GetRequest?id=' + encodeURIComponent(obdRequestId));
    if (!r || !r.success) {
        obdRenderInfoState('bi-exclamation-circle', (r && r.message) || 'تعذّر تحميل بيانات الطلب');
        return;
    }

    var d = r.data || {};
    var numEl = document.getElementById('obdReqNum');
    if (numEl) numEl.textContent = d.requestNumber || '—';

    host.innerHTML = obdInfoCardHtml(d);
}

function obdInfoCardHtml(d) {
    // زر «تفاصيل الإجراء» — نفس تصميم ووظيفة الزر المستخدم سابقاً داخل النافذة المنبثقة.
    var procDetailsBtn = d.procedureId
        ? '<button type="button" class="ob-act-btn ob-act-detail" onclick="obShowProcedureDetails(' + (d.procedureId || 0) + ',' + (d.id || 0) + ')"><i class="bi bi-file-earmark-text"></i> تفاصيل الإجراء</button>'
        : '';

    return '<div class="obd-info-card">'
        + '<div class="obd-info-row cols-1">'
        +   obdField('اسم الإجراء', '<div class="obd-proc-name"><span>' + esc(d.procedureName || '—') + '</span>' + procDetailsBtn + '</div>')
        + '</div>'
        + '<div class="obd-info-row cols-3">'
        +   obdField('نوع الإجراء', obProcTypeChip(d))
        +   obdField('تاريخ التقديم', '<span style="direction:ltr;display:inline-block;">' + esc(obFmtDate(d.submittedAt)) + '</span>')
        +   obdField('الأولوية', obPriorityBadge(d.priority))
        + '</div>'
        + '<div class="obd-info-row cols-3">'
        +   obdField('تصنيف الحالة', obCatBadge(d.statusCategory))
        +   obdField('الحالة / المرحلة', obStageBadge(d.currentStageName, d.currentStageColor))
        +   obdField('سرعة الاستجابة SLA', obSlaBadge(d.slaState))
        + '</div>'
        + '</div>';
}

function obdField(label, valueHtml) {
    return '<div class="obd-field">'
        + '<div class="obd-field-lbl">' + esc(label) + '</div>'
        + '<div class="obd-field-val">' + valueHtml + '</div>'
        + '</div>';
}

function obdRenderInfoState(iconClass, message) {
    var host = document.getElementById('obdContent');
    if (host) host.innerHTML = '<div class="obd-info-card">' + obdStateHtml(iconClass, message) + '</div>';
}

function obdStateHtml(iconClass, message) {
    return '<div class="obd-state"><i class="bi ' + iconClass + '"></i><p>' + esc(message) + '</p></div>';
}

// ─── TAB 1: FORM DATA ───────────────────────────────────────────────────────
/**
 * يعرض نموذج الطلب بنفس ترتيب وتصميم شاشة التعبئة، للقراءة فقط، بقيمه المحفوظة.
 * تُحقَن القيم في خصائص الحقول ليتكفّل fdBuildFormPreview بالعرض، وتُستبدل
 * الإدخالات التي لا تقبل الحقن (الملفات والجداول والتواقيع) ببدائل عرض.
 */
async function obdLoadForm() {
    var host = document.getElementById('obdFormHost');
    if (!host) return;

    var r = await apiFetch('/Outbox/GetRequestFormView?id=' + encodeURIComponent(obdRequestId));
    if (!r || !r.success) {
        host.innerHTML = obdStateHtml('bi-exclamation-circle', (r && r.message) || 'تعذّر تحميل النموذج');
        return;
    }
    if (!r.hasForm || !r.form) {
        host.innerHTML = obdStateHtml('bi-file-earmark-x', 'لا يوجد نموذج مرتبط بهذا الطلب');
        return;
    }
    if (typeof fdBuildFormPreview !== 'function' || typeof fdParseFieldsJsonPayload !== 'function') {
        host.innerHTML = obdStateHtml('bi-exclamation-circle', 'تعذّر تحميل مكوّنات النموذج — أعد تحميل الصفحة');
        return;
    }

    var parsed = fdParseFieldsJsonPayload(r.form.fieldsJson || '');
    var answers = obdAnswerMap(r.formDataJson);
    var fields = (parsed.fields || []).map(function (f) { return obdFieldWithAnswer(f, answers[String(f.id)]); });

    window.fdFormFillPhase = 'submit';
    await obdPrefetchCaches(fields);

    host.innerHTML = '<div class="obd-form-host">'
        + fdBuildFormPreview(
            r.templateData,
            r.form.name || '',
            r.form.description || '',
            fields,
            false,
            parsed.sections || null,
            parsed.titleAppearance || null
        )
        + '</div>';

    try { if (typeof fdInitDynamicWidgets === 'function') fdInitDynamicWidgets(host); } catch (e) { /* widgets optional */ }
    obdApplyCustomValues(host, parsed.fields || [], answers);
}

/** يحوّل fields المحفوظة في formDataJson إلى خريطة حسب معرّف الحقل. */
function obdAnswerMap(formDataJson) {
    var map = {};
    var parsed;
    try { parsed = JSON.parse(formDataJson || '{}'); } catch (e) { return map; }
    var list = parsed && Array.isArray(parsed.fields) ? parsed.fields : [];
    list.forEach(function (entry) {
        if (entry && entry.id != null) map[String(entry.id)] = entry;
    });
    return map;
}

/** ينسخ تعريف الحقل مع حقن القيمة المحفوظة كقيمة افتراضية للعرض. */
function obdFieldWithAnswer(f, entry) {
    var copy = Object.assign({}, f);
    if (OBD_STRUCTURAL_TYPES.indexOf(f.fieldType) >= 0) return copy;

    var props = {};
    try { props = JSON.parse(f.propertiesJson || '{}'); } catch (e) { props = {}; }
    props.readOnly = true;

    var v = entry ? entry.value : null;
    var t = f.fieldType;

    if (OBD_CUSTOM_VALUE_TYPES.indexOf(t) < 0) {
        if (t === 'تبديل') {
            props.defaultOn = !!v;
        } else if (t === 'قائمة منسدلة' || t === 'قائمة اختيار الواحد' || t === 'قائمة اختيار متعدد') {
            props.defaultOption = Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v));
        } else {
            props.defaultValue = (v == null || typeof v === 'object') ? '' : String(v);
        }
    }

    copy.propertiesJson = JSON.stringify(props);
    return copy;
}

/** يحمّل قوائم الاختيار والجداول الجاهزة المطلوبة قبل بناء النموذج. */
async function obdPrefetchCaches(fields) {
    for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        if (f.fieldType !== 'قائمة منسدلة' && f.fieldType !== 'جدول بيانات') continue;
        var p = {};
        try { p = JSON.parse(f.propertiesJson || '{}'); } catch (e) { p = {}; }
        if (f.fieldType === 'قائمة منسدلة' && p.dropdownListId && typeof fdFetchDropdownItemsForField === 'function') {
            await fdFetchDropdownItemsForField(p.dropdownListId);
        }
        if (f.fieldType === 'جدول بيانات' && p.readyTableId && typeof fdFetchReadyTableGridForField === 'function') {
            await fdFetchReadyTableGridForField(p.readyTableId);
        }
    }
}

/** يستبدل إدخالات الأنواع التي لا تقبل حقن القيمة ببديل عرض للقراءة فقط. */
function obdApplyCustomValues(host, fields, answers) {
    fields.forEach(function (f) {
        if (OBD_CUSTOM_VALUE_TYPES.indexOf(f.fieldType) < 0) return;
        var wrap = host.querySelector('[data-fd-field-id="' + f.id + '"]');
        if (!wrap) return;
        var entry = answers[String(f.id)];
        obdReplaceControl(wrap, obdReadOnlyValueHtml(f.fieldType, entry ? entry.value : null));
    });
}

/** يزيل عناصر الإدخال من غلاف الحقل مع الإبقاء على التسمية والوصف الفرعي. */
function obdReplaceControl(wrap, html) {
    var keep = [];
    Array.from(wrap.children).forEach(function (child) {
        var tag = child.tagName.toLowerCase();
        if (tag === 'label' || tag === 'small') keep.push(child);
        else child.remove();
    });
    var subName = keep.length > 1 ? keep[keep.length - 1] : null;
    if (subName && subName.tagName.toLowerCase() === 'small') subName.insertAdjacentHTML('beforebegin', html);
    else wrap.insertAdjacentHTML('beforeend', html);
}

function obdIsEmptyValue(v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'boolean') return false;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return String(v).trim() === '';
}

/** بديل العرض للقراءة فقط حسب نوع الحقل. */
function obdReadOnlyValueHtml(fieldType, v) {
    if (obdIsEmptyValue(v)) return '<div class="obd-ro-value empty">—</div>';

    if (fieldType === 'رفع ملف' && Array.isArray(v)) {
        return '<div class="obd-ro-files">' + v.map(obdFileChipHtml).join('') + '</div>';
    }

    if (fieldType === 'جدول بيانات') {
        return obdGridTableHtml(v) || obdRowsTableHtml(v);
    }

    if (fieldType === 'شبكة خيارات متعددة' || fieldType === 'شبكة مربعات اختيار') {
        return obdRowsTableHtml(v);
    }

    if (fieldType === 'توقيع' || fieldType === 'تأشير') {
        return '<div class="obd-ro-value"><i class="bi bi-check-circle-fill" style="color:var(--success-600);"></i> ' + esc(String(v)) + '</div>';
    }

    if (fieldType === 'البيانات التلقائية للمستفيد' || fieldType === 'بيانات التصديق') {
        return obdAutoDataHtml(fieldType, v);
    }

    return '<div class="obd-ro-value">' + esc(String(v)) + '</div>';
}

function obdFileChipHtml(file) {
    var name = (file && file.name) || 'ملف';
    var size = file && file.size ? ' <span class="sz">(' + esc(obaFmtFileSize(file.size)) + ')</span>' : '';
    var icon = obaFileIcon(name);
    if (file && file.url) {
        return '<a class="obd-file-chip" href="' + obEscAttr(appResolveUrl(file.url)) + '" target="_blank" rel="noopener" download="' + obEscAttr(name) + '">'
            + '<i class="bi ' + icon + '"></i>' + esc(name) + size + '</a>';
    }
    return '<span class="obd-file-chip"><i class="bi ' + icon + '"></i>' + esc(name) + size + '</span>';
}

/**
 * «جدول بيانات» يُحفظ بشكل عمودي: [{ label: اسم العمود, value: [قيم الصفوف] }].
 * يُعاد بناؤه كجدول بأعمدة وصفوف مطابق لما ظهر أثناء التعبئة، أو '' إن لم يطابق الشكل.
 */
function obdGridTableHtml(cols) {
    if (!Array.isArray(cols) || !cols.length) return '';
    if (!cols.every(function (c) { return c && Array.isArray(c.value); })) return '';

    var rowCount = cols.reduce(function (max, c) { return Math.max(max, c.value.length); }, 0);
    if (!rowCount) return '';

    var head = cols.map(function (c) { return '<th>' + esc(c.label || '') + '</th>'; }).join('');
    var body = '';
    for (var ri = 0; ri < rowCount; ri++) {
        var cells = cols.map(function (c) {
            var cell = c.value[ri];
            var text = Array.isArray(cell) ? cell.filter(Boolean).join(' • ') : (cell == null ? '' : String(cell));
            return '<td>' + (text ? esc(text) : '<span class="text-muted">—</span>') + '</td>';
        }).join('');
        body += '<tr>' + cells + '</tr>';
    }

    return '<div class="table-responsive"><table class="table table-bordered table-sm mb-0 rt-preview-form-table">'
        + '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

/** جدول عرض للقيم المخزّنة على شكل [{ label, value }]. */
function obdRowsTableHtml(rows) {
    if (!Array.isArray(rows) || !rows.length) return '<div class="obd-ro-value empty">—</div>';
    var body = rows.map(function (row) {
        var val = row && row.value;
        var text = Array.isArray(val) ? val.filter(Boolean).join(' • ') : (val == null ? '' : String(val));
        return '<tr><th scope="row" style="background:var(--gray-50);width:40%;">' + esc((row && row.label) || '—') + '</th>'
            + '<td>' + (text ? esc(text) : '<span class="text-muted">—</span>') + '</td></tr>';
    }).join('');
    return '<div class="table-responsive"><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><tbody>' + body + '</tbody></table></div>';
}

/** عرض لقطة البيانات التلقائية المحفوظة وقت التقديم. */
function obdAutoDataHtml(fieldType, v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return '<div class="obd-ro-value">' + esc(String(v)) + '</div>';
    var scope = fieldType === 'بيانات التصديق' ? 'certification' : 'beneficiary';
    var rows = Object.keys(v).map(function (k) {
        var label = (typeof fdAutoDataLabelForKey === 'function') ? fdAutoDataLabelForKey(scope, k) : k;
        var val = v[k];
        var cell;
        if (val && String(val).indexOf('data:image') === 0) {
            cell = '<img src="' + obEscAttr(String(val)) + '" alt="" style="max-height:52px;max-width:140px;object-fit:contain;">';
        } else {
            cell = val ? esc(String(val)) : '<span class="text-muted">—</span>';
        }
        return { label: label, cell: cell };
    });
    if (!rows.length) return '<div class="obd-ro-value empty">—</div>';
    var body = rows.map(function (r) {
        return '<tr><th scope="row" style="background:var(--gray-50);width:40%;">' + esc(r.label) + '</th><td>' + r.cell + '</td></tr>';
    }).join('');
    return '<div class="table-responsive"><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><tbody>' + body + '</tbody></table></div>';
}

// ─── TAB 3: COMMENTS ────────────────────────────────────────────────────────
async function obdLoadComments() {
    var host = document.getElementById('obdCommentsHost');
    if (!host) return;

    var r = await apiFetch('/Outbox/GetRequestComments?id=' + encodeURIComponent(obdRequestId));
    if (!r || !r.success) {
        host.innerHTML = obdStateHtml('bi-exclamation-circle', (r && r.message) || 'تعذّر تحميل التعليقات');
        return;
    }

    var list = r.data || [];
    var countEl = document.getElementById('obdCommentsCount');
    if (countEl) countEl.textContent = String(list.length);

    if (!list.length) {
        host.innerHTML = obdStateHtml('bi-chat-left-dots', 'لا توجد تعليقات على هذا الطلب بعد');
        return;
    }

    host.innerHTML = '<div class="obd-comments">' + list.map(obdCommentHtml).join('') + '</div>';
}

function obdCommentHtml(c) {
    var typeCls = c.commentType === 'طلب توضيح' ? 'obd-ctype-clarify' : 'obd-ctype-general';
    var typeIcon = c.commentType === 'طلب توضيح' ? 'bi-question-circle-fill' : 'bi-chat-dots-fill';
    var files = (c.attachments || []).map(function (a) {
        return obdFileChipHtml({ name: a.fileName, size: a.size, url: a.url });
    }).join('');

    return '<div class="obd-comment">'
        + '<div class="obd-comment-avatar">' + esc(obdInitials(c.authorName)) + '</div>'
        + '<div class="obd-comment-body">'
        +   '<div class="obd-comment-head">'
        +     '<span class="obd-comment-author">' + esc(c.authorName || '—') + '</span>'
        +     (c.authorDept ? '<span class="obd-comment-dept">' + esc(c.authorDept) + '</span>' : '')
        +     '<span class="obd-ctype ' + typeCls + '"><i class="bi ' + typeIcon + '"></i>' + esc(c.commentType || 'عام') + '</span>'
        +     '<span class="obd-comment-date">' + esc(obFmtDate(c.createdAt)) + '</span>'
        +   '</div>'
        +   (c.content ? '<div class="obd-comment-text">' + esc(c.content) + '</div>' : '')
        +   (files ? '<div class="obd-comment-files">' + files + '</div>' : '')
        + '</div>'
        + '</div>';
}

function obdInitials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '؟';
    if (parts.length === 1) return parts[0].charAt(0);
    return parts[0].charAt(0) + parts[1].charAt(0);
}

function obdPickCommentFile() {
    var input = document.getElementById('obdCommentFile');
    if (input) input.click();
}

async function obdHandleCommentFile(input) {
    if (!input || !input.files || !input.files[0]) return;
    var file = input.files[0];
    input.value = '';

    var res = await obaUploadFile(file);
    if (!res || !res.success) {
        showToast((res && res.message) || 'تعذّر رفع الملف', 'danger');
        return;
    }
    obdPendingFiles.push({
        name: res.name || file.name,
        url: res.url,
        contentType: res.contentType || file.type || '',
        size: res.size || file.size || 0
    });
    obdRenderPendingFiles();
}

function obdRenderPendingFiles() {
    var host = document.getElementById('obdPendingFiles');
    if (!host) return;
    host.innerHTML = obdPendingFiles.map(function (f, i) {
        return '<span class="obd-pending-chip"><i class="bi ' + obaFileIcon(f.name) + '"></i>' + esc(f.name)
            + '<button type="button" onclick="obdRemovePendingFile(' + i + ')" title="إزالة" aria-label="إزالة"><i class="bi bi-x-lg"></i></button></span>';
    }).join('');
}

function obdRemovePendingFile(index) {
    obdPendingFiles.splice(index, 1);
    obdRenderPendingFiles();
}

async function obdSubmitComment() {
    var textEl = document.getElementById('obdCommentText');
    var typeEl = document.getElementById('obdCommentType');
    var btn = document.getElementById('obdSendBtn');

    var content = (textEl?.value || '').trim();
    if (!content && !obdPendingFiles.length) {
        showToast('اكتب نص التعليق أو أرفق ملفاً', 'warning');
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الإرسال...'; }
    var r = await apiFetch('/Outbox/AddRequestComment', 'POST', {
        requestId: obdRequestId,
        commentType: typeEl?.value || 'عام',
        content: content,
        attachments: obdPendingFiles
    });
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send-fill"></i> إرسال'; }

    if (!r || !r.success) {
        showToast((r && r.message) || 'تعذّر إضافة التعليق', 'danger');
        return;
    }

    showToast(r.message || 'تمت إضافة التعليق', 'success');
    if (textEl) textEl.value = '';
    if (typeEl) typeEl.value = 'عام';
    obdPendingFiles = [];
    obdRenderPendingFiles();
    await Promise.all([obdLoadComments(), obdLoadDocuments()]);
}

// ─── TAB 4: ATTACHED DOCUMENTS ──────────────────────────────────────────────
async function obdLoadDocuments() {
    var host = document.getElementById('obdDocsHost');
    if (!host) return;

    var r = await apiFetch('/Outbox/GetRequestAttachments?id=' + encodeURIComponent(obdRequestId));
    if (!r || !r.success) {
        host.innerHTML = obdStateHtml('bi-exclamation-circle', (r && r.message) || 'تعذّر تحميل الوثائق');
        return;
    }

    var list = r.data || [];
    var countEl = document.getElementById('obdDocsCount');
    if (countEl) countEl.textContent = String(list.length);

    if (!list.length) {
        host.innerHTML = obdStateHtml('bi-folder2-open', 'لا توجد وثائق مرفقة بهذا الطلب');
        return;
    }

    var rows = list.map(function (a, i) {
        var url = appResolveUrl(a.url);
        var preview = obaIsPreviewable(a.fileName)
            ? '<button type="button" class="ob-act-btn ui-act-btn ob-act-detail" title="معاينة" onclick="obaOpenPreview(\'' + obEscAttr(a.url) + '\')"><i class="bi bi-eye"></i></button> '
            : '';
        var srcLabel = a.source || '—';
        var srcDetail = a.fieldName ? ' — ' + a.fieldName : '';
        var size = a.size ? ' <span style="color:var(--gray-500);font-weight:500;">(' + esc(obaFmtFileSize(a.size)) + ')</span>' : '';

        return '<tr>'
            + '<td style="text-align:center;font-weight:700;color:var(--gray-500);">' + (i + 1) + '</td>'
            + '<td><span class="obd-doc-src"><i class="bi bi-tag-fill"></i>' + esc(srcLabel) + '</span>' + (srcDetail ? '<div style="font-size:11.5px;color:var(--gray-500);margin-top:4px;">' + esc(a.fieldName) + '</div>' : '') + '</td>'
            + '<td><span class="obd-doc-name"><i class="bi ' + obaFileIcon(a.fileName) + '"></i>' + esc(a.fileName || '—') + '</span>' + size + '</td>'
            + '<td class="obd-doc-date">' + esc(obFmtDate(a.uploadedAt)) + '</td>'
            + '<td>' + esc(a.uploadedByName || '—') + '</td>'
            + '<td style="white-space:nowrap;">' + preview
            +   '<a class="ob-act-btn ui-act-btn ob-act-detail" title="تحميل" href="' + obEscAttr(url) + '" download="' + obEscAttr(a.fileName || '') + '"><i class="bi bi-download"></i></a>'
            + '</td>'
            + '</tr>';
    }).join('');

    host.innerHTML = '<div class="table-responsive"><table class="table mb-0 obd-docs-table">'
        + '<thead><tr>'
        +   '<th style="width:50px;text-align:center;">ت</th>'
        +   '<th>نوع المرفق</th>'
        +   '<th>اسم الملف</th>'
        +   '<th>تاريخ الرفع</th>'
        +   '<th>رفع بواسطة</th>'
        +   '<th style="width:200px;">الإجراءات</th>'
        + '</tr></thead>'
        + '<tbody>' + rows + '</tbody></table></div>';
}

window.obdLoad = obdLoad;
window.obdSelectTab = obdSelectTab;
window.obdPickCommentFile = obdPickCommentFile;
window.obdHandleCommentFile = obdHandleCommentFile;
window.obdRemovePendingFile = obdRemovePendingFile;
window.obdSubmitComment = obdSubmitComment;
