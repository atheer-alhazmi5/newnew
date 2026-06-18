'use strict';
/**
 * تقديم طلب جديد — معالج خطوات (Stepper):
 *  1. اختيار النوع   (بطاقات إجراءات معتمدة ومفعّلة)
 *  2. تعبئة النموذج (يُحمَّل ديناميكياً من Form Definition المرتبط بالإجراء)
 *  3. مراجعة         (بيانات النموذج مقسَّمة حسب الأقسام + المرفقات)
 *  4. تأكيد           (مسار العمل + الوحدات المستهدفة + المنفذون)
 */

var obsStep = 1;
var obsProcedures = [];
var obsFilteredProcedures = [];
var obsPickedId = 0;
var obsPickedData = null;
var obsFormDef = null;        // { id, name, fieldsJson, sections, fields, rules, titleAppearance }
var obsTemplateData = null;
var obsTargetOrgUnits = [];
var obsExecutors = [];
var obsFirstApprover = '';
var obsProcedurePriority = 'متوسط';
var obsCollected = null;      // آخر مجموعة إجابات تم جمعها لخطوة المراجعة

function obsEscAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function obsNormBiIcon(ic) {
    if (!ic) return 'bi-tag-fill';
    var v = String(ic).trim();
    if (!v) return 'bi-tag-fill';
    return v.indexOf('bi-') === 0 ? v : 'bi-' + v;
}

function obsRenderStepper() {
    document.querySelectorAll('#obsStepper .obs-step').forEach(function (el) {
        var s = parseInt(el.getAttribute('data-step') || '0', 10);
        el.classList.remove('is-active', 'is-done');
        if (s === obsStep) el.classList.add('is-active');
        else if (s < obsStep) el.classList.add('is-done');
        var c = el.querySelector('.obs-step-circle');
        if (c) c.innerHTML = (s < obsStep) ? '<i class="bi bi-check2"></i>' : String(s);
    });
}

function obsShowPanel(n) {
    [1, 2, 3, 4].forEach(function (i) {
        var p = document.getElementById('obsPanel' + i);
        if (p) p.style.display = (i === n) ? '' : 'none';
    });
}

function obsGoStep(n) {
    if (n === obsStep) return;
    if (n > obsStep) {
        if (obsStep === 1 && !obsPickedId) { showToast('يرجى اختيار نوع الإجراء أولاً', 'warning'); return; }
        if (obsStep === 2) {
            var collected = obsCollectAnswers({ validateRequired: true });
            if (!collected) return;
            obsCollected = collected;
        }
        if (n === 3) obsRenderReview();
    }
    obsStep = Math.max(1, Math.min(4, n));
    obsShowPanel(obsStep);
    obsRenderStepper();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Step 1 — Cards ────────────────────────────────────────────────────────
async function obsLoadProcedures() {
    var host = document.getElementById('obsCardsHost');
    if (host) host.innerHTML = '<div class="text-center w-100 py-4" style="grid-column:1/-1;"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    var r = await apiFetch('/Outbox/GetAvailableProcedures');
    if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="text-center w-100 py-4" style="grid-column:1/-1;color:var(--gray-500);">تعذّر تحميل قائمة الإجراءات</div>';
        return;
    }
    obsProcedures = r.data || [];
    obsFillCardFilters();
    obsApplyCardFilters();
}

function obsFillCardFilters() {
    var typeSel = document.getElementById('obsFilterType');
    var procSel = document.getElementById('obsFilterProcedure');
    if (!typeSel || !procSel) return;

    var types = {};
    obsProcedures.forEach(function (p) {
        var tid = p.typeId != null ? p.typeId : p.TypeId;
        var tname = p.typeName || p.TypeName || '—';
        if (tid != null) types[String(tid)] = tname;
    });
    var typeHtml = '<option value="">نوع الإجراء</option>';
    Object.keys(types).sort(function (a, b) {
        return String(types[a]).localeCompare(String(types[b]), 'ar');
    }).forEach(function (tid) {
        typeHtml += '<option value="' + obsEscAttr(tid) + '">' + esc(types[tid]) + '</option>';
    });
    typeSel.innerHTML = typeHtml;

    obsFillProcedureFilterOptions();
}

function obsFillProcedureFilterOptions() {
    var procSel = document.getElementById('obsFilterProcedure');
    var typeSel = document.getElementById('obsFilterType');
    if (!procSel) return;
    var fType = typeSel ? (typeSel.value || '') : '';
    var list = obsProcedures.filter(function (p) {
        if (!fType) return true;
        return String(p.typeId != null ? p.typeId : p.TypeId) === String(fType);
    });
    var procHtml = '<option value="">اسم الإجراء</option>';
    list.slice().sort(function (a, b) {
        return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    }).forEach(function (p) {
        procHtml += '<option value="' + obsEscAttr(String(p.id)) + '">' + esc(p.name || '') + '</option>';
    });
    procSel.innerHTML = procHtml;
}

function obsOnFilterTypeChange() {
    var procSel = document.getElementById('obsFilterProcedure');
    if (procSel) procSel.value = '';
    obsFillProcedureFilterOptions();
    obsApplyCardFilters();
}

function obsApplyCardFilters() {
    var fType = document.getElementById('obsFilterType')?.value || '';
    var fProc = document.getElementById('obsFilterProcedure')?.value || '';
    obsFilteredProcedures = obsProcedures.filter(function (p) {
        if (fType && String(p.typeId != null ? p.typeId : p.TypeId) !== String(fType)) return false;
        if (fProc && String(p.id) !== String(fProc)) return false;
        return true;
    });
    obsRenderCards();
}

function obsClearCardFilters() {
    ['obsFilterType', 'obsFilterProcedure'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    obsFillProcedureFilterOptions();
    obsApplyCardFilters();
}

function obsRenderCards() {
    var host = document.getElementById('obsCardsHost');
    if (!host) return;
    var list = obsFilteredProcedures;
    if (!list.length) {
        var hasAny = obsProcedures.length > 0;
        host.innerHTML = '<div class="text-center w-100 py-4" style="grid-column:1/-1;color:var(--gray-500);"><i class="bi bi-inbox" style="font-size:42px;display:block;margin-bottom:6px;color:var(--gray-300);"></i>'
            + (hasAny ? 'لا توجد إجراءات مطابقة للفلتر' : 'لا توجد إجراءات عمل معتمدة ومفعّلة حالياً') + '</div>';
        return;
    }
    var html = '';
    list.forEach(function (p) {
        var ic = obsNormBiIcon(p.typeIcon);
        var color = p.typeColor && /^#/.test(p.typeColor) ? p.typeColor : '#25935F';
        var selected = (obsPickedId && Number(obsPickedId) === Number(p.id));
        html += '<div class="obs-card' + (selected ? ' is-selected' : '') + '" data-id="' + obsEscAttr(String(p.id)) + '" onclick="obsPick(' + p.id + ',event)">'
            + '<div class="obs-card-selected-mark"><i class="bi bi-check"></i></div>'
            + '<div class="obs-card-head">'
            +   '<span class="obs-card-icon" style="background:' + obsEscAttr(color) + ';"><i class="' + obsEscAttr(ic) + '"></i></span>'
            +   '<div class="obs-card-name">' + esc(p.name || '') + '<small>' + esc(p.code || '') + ' • ' + esc(p.versionLabel || 'V1.0') + '</small></div>'
            + '</div>'
            + '<span class="obs-card-type"><i class="' + obsEscAttr(ic) + '" style="color:' + obsEscAttr(color) + '"></i>' + esc(p.typeName || '—') + '</span>'
            + '<div class="obs-card-actions">'
            +   '<button class="obs-btn obs-btn-detail" onclick="event.stopPropagation();obsShowProcDetails(' + p.id + ')"><i class="bi bi-info-circle"></i> تفاصيل</button>'
            +   '<button class="obs-btn obs-btn-pick' + (selected ? ' is-picked' : '') + '" onclick="event.stopPropagation();obsPick(' + p.id + ')">'
            +     '<i class="bi ' + (selected ? 'bi-check2-circle' : 'bi-send-fill') + '"></i> ' + (selected ? 'محدّد' : 'تقديم')
            +   '</button>'
            + '</div>'
            + '</div>';
    });
    host.innerHTML = html;

    var nextBtn = document.getElementById('obsBtnNext1');
    if (nextBtn) nextBtn.disabled = !obsPickedId;
}

async function obsPick(id, ev) {
    if (ev) ev.stopPropagation();
    obsPickedId = id;
    obsFormDef = null;
    obsTemplateData = null;
    obsTargetOrgUnits = [];
    obsExecutors = [];
    obsFirstApprover = '';

    var r = await apiFetch('/Outbox/GetProcedureForSubmit?id=' + encodeURIComponent(id));
    if (!r || !r.success) {
        showToast((r && r.message) || 'الإجراء غير متاح', 'danger');
        obsPickedId = 0;
        obsRenderCards();
        return;
    }
    obsPickedData = r.data || null;

    // تحميل النموذج المرتبط مسبقاً ليكون جاهزاً للخطوة الثانية
    await obsLoadProcedureForm(id);

    obsRenderCards();
    showToast('تم اختيار الإجراء: ' + (obsPickedData?.name || ''), 'info');
}

// ─── Step 2 — Dynamic Form Loading & Rendering ─────────────────────────────
async function obsLoadProcedureForm(procedureId) {
    var host = document.getElementById('obsFormHost');
    if (host) host.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';

    var r = await apiFetch('/Outbox/GetProcedureFormDefinition?id=' + encodeURIComponent(procedureId));
    if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="text-center py-4" style="color:var(--gray-500);"><i class="bi bi-exclamation-circle" style="font-size:28px;display:block;margin-bottom:6px;color:var(--gray-300);"></i>تعذّر تحميل النموذج</div>';
        return;
    }

    obsTargetOrgUnits = r.targetOrgUnits || [];
    obsExecutors = r.executors || [];
    obsFirstApprover = r.firstApprover || '';
    obsProcedurePriority = r.priorityLevel || 'متوسط';

    if (!r.hasForm) {
        obsFormDef = null;
        obsTemplateData = null;
        if (host) host.innerHTML = '<div class="text-center py-4" style="color:var(--gray-500);"><i class="bi bi-file-earmark-x" style="font-size:28px;display:block;margin-bottom:6px;color:var(--gray-300);"></i>' + esc(r.message || 'لا يوجد نموذج مرتبط بهذا الإجراء') + '</div>';
        return;
    }

    // معالجة FieldsJson عبر helper الـ form-definitions.js
    var fdInfo = (typeof fdParseFieldsJsonPayload === 'function')
        ? fdParseFieldsJsonPayload(r.form.fieldsJson || '')
        : obsParseFieldsJsonFallback(r.form.fieldsJson || '');

    obsFormDef = {
        id: r.form.id,
        name: r.form.name || '',
        description: r.form.description || '',
        fields: fdInfo.fields || [],
        sections: fdInfo.sections || [{ id: 1, title: 'القسم الأول' }],
        rules: fdInfo.rules || [],
        titleAppearance: fdInfo.titleAppearance
    };
    obsTemplateData = r.templateData || null;

    obsRenderForm();
}

function obsParseFieldsJsonFallback(json) {
    var def = { sections: [{ id: 1, title: 'القسم الأول' }], fields: [], rules: [] };
    if (!json) return def;
    var p;
    try { p = JSON.parse(json); } catch (e) { return def; }
    if (Array.isArray(p)) {
        p.forEach(function (f) { if (!f.sectionId) f.sectionId = 1; });
        return { sections: def.sections, fields: p, rules: [] };
    }
    if (p && typeof p === 'object') {
        var s = Array.isArray(p.sections) && p.sections.length ? p.sections : def.sections;
        var fs = Array.isArray(p.fields) ? p.fields : [];
        var firstId = s[0].id;
        var valid = {};
        s.forEach(function (x) { valid[x.id] = 1; });
        fs.forEach(function (f) { if (!f.sectionId || !valid[f.sectionId]) f.sectionId = firstId; });
        return { sections: s, fields: fs, rules: Array.isArray(p.rules) ? p.rules : [] };
    }
    return def;
}

/** يبني الـ HTML الكامل للنموذج (يُعيد استخدام fdBuildFormPreview للحفاظ على التماثل البصري) */
function obsRenderForm() {
    var host = document.getElementById('obsFormHost');
    if (!host || !obsFormDef) return;

    if (typeof fdBuildFormPreview === 'function') {
        var html = fdBuildFormPreview(
            obsTemplateData,
            obsFormDef.name || '',
            obsFormDef.description || '',
            obsFormDef.fields || [],
            true,                         // interactive = true
            obsFormDef.sections || null,
            obsFormDef.titleAppearance || null
        );
        host.innerHTML = html;
    } else {
        // fallback مبسّط (لو لم يُحمَّل form-definitions.js لأي سبب)
        host.innerHTML = obsRenderFormFallback();
    }

    // تفعيل الـ widgets الديناميكية (تواريخ، دوار، رفع ملفات، قوائم...)
    try { if (typeof fdInitDynamicWidgets === 'function') fdInitDynamicWidgets(host); } catch (e) { console.warn('fdInitDynamicWidgets', e); }
}

function obsRenderFormFallback() {
    var html = '';
    (obsFormDef.sections || []).forEach(function (sec) {
        var items = (obsFormDef.fields || []).filter(function (f) { return (f.sectionId || obsFormDef.sections[0].id) === sec.id; });
        html += '<div style="margin-bottom:12px;"><div style="font-weight:700;color:var(--sa-800);margin-bottom:8px;">' + esc(sec.title || '') + '</div>';
        items.forEach(function (f) {
            html += '<div style="margin-bottom:10px;"><label style="font-weight:700;font-size:13px;display:block;margin-bottom:4px;">' + esc(f.fieldName || '') + (f.isRequired ? ' <span style="color:#ef4444;">*</span>' : '') + '</label>';
            html += '<input type="text" class="form-control" placeholder="' + esc(f.placeholder || '') + '"' + (f.isRequired ? ' required' : '') + '></div>';
        });
        html += '</div>';
    });
    return html;
}

// ─── Step 2 → Step 3: Validation + Answer Collection ───────────────────────
/** يجمع إجابات النموذج المعروض ويتحقق من الحقول الإلزامية إن طُلب */
function obsCollectAnswers(opt) {
    var validateRequired = !!(opt && opt.validateRequired);
    var host = document.getElementById('obsFormHost');
    if (!obsFormDef || !host) {
        return { fields: [], priority: obsProcedurePriority || 'متوسط', notes: '' };
    }

    // 1) التحقق من سلامة الحقول (Format) عبر fdValidateInteractivePreview
    if (validateRequired && typeof fdValidateInteractivePreview === 'function') {
        var firstFormatErr = fdValidateInteractivePreview(host);
        if (firstFormatErr) { showToast(firstFormatErr, 'danger'); return null; }
    }

    var col = host.querySelectorAll('.col-12, .col-md-6, .col-md-4, .col-md-3, .col-md-12, .col-sm-12, .col-sm-6');
    // البحث عن الحقول داخل النموذج عبر علامات form-definitions القياسية:
    // كل حقل ضمن fdBuildFormPreview يُلَفّ بـ <div class="col-..."> يضم label + الإدخال.
    var entries = [];
    var firstRequiredMissing = null;

    (obsFormDef.fields || []).forEach(function (f) {
        // تجاوز العناصر البنيوية
        if (f.fieldType === 'عنوان' || f.fieldType === 'خط فاصل' || f.fieldType === 'فاصل صفحات' || f.fieldType === 'صورة عرض') return;

        var value = obsExtractFieldValue(host, f);
        var isEmpty = value == null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === '');

        if (validateRequired && f.isRequired && isEmpty && !firstRequiredMissing) {
            firstRequiredMissing = f;
        }

        entries.push({
            id: f.id,
            sectionId: f.sectionId || (obsFormDef.sections[0] ? obsFormDef.sections[0].id : 1),
            fieldType: f.fieldType,
            fieldName: f.fieldName || '',
            subName: f.subName || '',
            isRequired: !!f.isRequired,
            value: value
        });
    });

    if (firstRequiredMissing) {
        showToast('الحقل «' + (firstRequiredMissing.fieldName || '—') + '» مطلوب', 'warning');
        // محاولة التركيز على أول حقل ناقص
        try { obsFocusField(host, firstRequiredMissing); } catch (e) {}
        return null;
    }

    return {
        fields: entries,
        priority: obsProcedurePriority || 'متوسط',
        notes: ''
    };
}

function obsFocusField(host, f) {
    var label = Array.from(host.querySelectorAll('label')).find(function (l) {
        return (l.textContent || '').trim().indexOf(String(f.fieldName || '').trim()) === 0;
    });
    var wrap = label ? label.parentElement : null;
    if (!wrap) return;
    var inp = wrap.querySelector('input,textarea,select');
    if (inp && typeof inp.focus === 'function') inp.focus();
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** يستخرج قيمة الحقل من الـ DOM (يدعم جميع الأنواع الموجودة في FD_FIELD_TYPES) */
function obsExtractFieldValue(host, f) {
    var label = Array.from(host.querySelectorAll('label')).find(function (l) {
        return (l.textContent || '').trim().indexOf(String(f.fieldName || '').trim()) === 0;
    });
    var wrap = label ? label.parentElement : null;
    if (!wrap) return null;

    var t = f.fieldType;

    if (t === 'قائمة اختيار الواحد') {
        var grp = wrap.querySelector('[data-fd-oc-mode="single"]');
        if (!grp) return null;
        var r = grp.querySelector('input[type="radio"]:checked');
        return r ? (r.value || '') : '';
    }
    if (t === 'قائمة اختيار متعدد') {
        var grpm = wrap.querySelector('[data-fd-oc-mode="multi"]');
        if (!grpm) return [];
        return Array.from(grpm.querySelectorAll('input[type="checkbox"]:checked')).map(function (c) { return c.value || ''; }).filter(Boolean);
    }
    if (t === 'قائمة منسدلة') {
        var sel = wrap.querySelector('select.form-select, select.form-control, select');
        if (!sel) return '';
        if (sel.multiple) return Array.from(sel.selectedOptions).map(function (o) { return o.value; });
        return sel.value || '';
    }
    if (t === 'تاريخ') {
        var hijFace = wrap.querySelector('input.fd-hijri-face');
        var gregFace = wrap.querySelector('input.fd-greg-face');
        if (hijFace) return hijFace.value || '';
        if (gregFace) return gregFace.value || '';
        var d = wrap.querySelector('input[type="date"]');
        return d ? (d.value || '') : '';
    }
    if (t === 'وقت') {
        var tm = wrap.querySelector('input[type="time"], input.fd-time-input');
        return tm ? (tm.value || '') : '';
    }
    if (t === 'تاريخ ووقت') {
        var dt = wrap.querySelector('input[type="datetime-local"], input[type="date"], input.fd-greg-face, input.fd-hijri-face');
        return dt ? (dt.value || '') : '';
    }
    if (t === 'رفع ملف') {
        var inp = wrap.querySelector('input[type="file"]');
        if (!inp || !inp.files || !inp.files.length) return [];
        return Array.from(inp.files).map(function (file) { return { name: file.name, size: file.size, type: file.type }; });
    }
    if (t === 'تبديل') {
        var sw = wrap.querySelector('input[type="checkbox"], input.fd-switch-input');
        return sw ? !!sw.checked : false;
    }
    if (t === 'دوار رقمي' || t === 'رقم' || t === 'عملة' || t === 'التقييم بالأرقام') {
        var num = wrap.querySelector('input.fd-spin-input, input[type="number"], input[type="text"]');
        return num ? (num.value || '') : '';
    }
    if (t === 'التقييم بالنجوم') {
        var rating = wrap.querySelector('input[type="hidden"][data-fd-rating], input.fd-rating-value');
        if (rating) return rating.value || '';
        var checkedR = wrap.querySelector('input[type="radio"]:checked');
        return checkedR ? checkedR.value : '';
    }
    if (t === 'توقيع' || t === 'تأشير') {
        // نكتفي بمؤشر بسيط — التوقيع canvas-based ولن نحفظ الصورة هنا
        var sigCanvas = wrap.querySelector('canvas');
        return sigCanvas ? '(تم التوقيع)' : '';
    }
    if (t === 'رابط') {
        var lk = wrap.querySelector('input[type="url"], input.fd-url-input, input[type="text"]');
        return lk ? (lk.value || '') : '';
    }
    if (t === 'البريد الإلكتروني') {
        var em = wrap.querySelector('input[type="email"], input[type="text"]');
        return em ? (em.value || '') : '';
    }
    if (t === 'رقم الهاتف') {
        var ph = wrap.querySelector('input[type="tel"], input[type="text"]');
        return ph ? (ph.value || '') : '';
    }
    if (t === 'نص طويل' || t === 'فقرة') {
        var ta = wrap.querySelector('textarea');
        return ta ? (ta.value || '') : '';
    }
    if (t === 'شبكة خيارات متعددة' || t === 'شبكة مربعات اختيار' || t === 'جدول بيانات') {
        // قراءة مبسّطة: كل الخلايا/الراديو/الـ checkbox
        var rows = [];
        wrap.querySelectorAll('tr').forEach(function (tr) {
            var label = (tr.querySelector('th, td:first-child')?.textContent || '').trim();
            var ans;
            if (t === 'شبكة خيارات متعددة') {
                ans = (tr.querySelector('input[type="radio"]:checked')?.value || '').trim();
            } else if (t === 'شبكة مربعات اختيار') {
                ans = Array.from(tr.querySelectorAll('input[type="checkbox"]:checked')).map(function (c) { return c.value || ''; }).filter(Boolean);
            } else {
                ans = Array.from(tr.querySelectorAll('input,select,textarea')).map(function (i) { return i.value || ''; });
            }
            if (label) rows.push({ label: label, value: ans });
        });
        return rows;
    }

    // النصوص الافتراضية
    var any = wrap.querySelector('input[type="text"], input:not([type]), textarea, input[type="number"], input[type="email"], input[type="url"], input[type="tel"]');
    return any ? (any.value || '') : '';
}

// ─── Step 3 — Review ───────────────────────────────────────────────────────
function obsRenderReview() {
    var host = document.getElementById('obsReviewHost');
    if (!host) return;
    var priority = obsCollected?.priority || obsProcedurePriority || 'متوسط';
    var procName = obsPickedData?.name || '—';
    var procCode = obsPickedData?.code || '';
    var procType = obsPickedData?.typeName || '—';

    // بطاقة بيانات الطلب الأساسية
    var html = ''
        + '<div class="obs-review-meta">'
        +   '<div class="mtch"><span class="l">الإجراء</span><span class="v">' + esc(procName) + (procCode ? ' <span style="color:var(--gray-400);font-weight:500;">— ' + esc(procCode) + '</span>' : '') + '</span></div>'
        +   '<div class="mtch"><span class="l">نوع الإجراء</span><span class="v">' + esc(procType) + '</span></div>'
        +   '<div class="mtch"><span class="l">الأولوية</span><span class="v">' + esc(priority) + '</span></div>'
        + '</div>';

    // مجموعات النموذج حسب الأقسام
    var entries = (obsCollected && obsCollected.fields) ? obsCollected.fields : [];
    if (obsFormDef && entries.length) {
        var byId = {};
        (obsFormDef.sections || []).forEach(function (s) { byId[s.id] = { title: s.title || ('القسم ' + s.id), items: [] }; });
        entries.forEach(function (e) {
            var sid = e.sectionId || (obsFormDef.sections[0] ? obsFormDef.sections[0].id : 1);
            if (!byId[sid]) byId[sid] = { title: 'قسم', items: [] };
            byId[sid].items.push(e);
        });

        (obsFormDef.sections || []).forEach(function (s) {
            var bucket = byId[s.id];
            if (!bucket || !bucket.items.length) return;
            html += '<div class="obs-review-section">';
            html += '<div class="obs-review-section-title"><i class="bi bi-collection"></i>' + esc(bucket.title) + '</div>';
            html += '<div class="obs-review-grid">';
            bucket.items.forEach(function (it) {
                html += '<div class="lbl">' + esc(it.fieldName || '—') + (it.isRequired ? ' <span style="color:#ef4444;">*</span>' : '') + '</div>';
                html += '<div class="' + (obsValueIsEmpty(it.value) ? 'val empty' : 'val') + '">' + obsFormatValueHtml(it) + '</div>';
            });
            html += '</div></div>';
        });
    } else if (obsFormDef && !entries.length) {
        html += '<div class="obs-review-section"><div class="obs-review-section-title"><i class="bi bi-info-circle"></i>لم يتم تعبئة أي حقول</div></div>';
    } else if (!obsFormDef) {
        html += '<div class="obs-review-section"><div class="obs-review-section-title"><i class="bi bi-info-circle"></i>لا يوجد نموذج مرتبط بالإجراء</div></div>';
    }

    host.innerHTML = html;
}

function obsValueIsEmpty(v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'boolean') return false;
    return String(v).trim() === '';
}

function obsFormatValueHtml(item) {
    var v = item.value;
    var t = item.fieldType;
    if (obsValueIsEmpty(v)) return '—';

    if (t === 'رفع ملف' && Array.isArray(v)) {
        return '<div class="obs-review-files">' + v.map(function (f) {
            return '<span class="file-chip"><i class="bi bi-paperclip"></i>' + esc(f.name || '') + (f.size ? ' <span style="color:var(--gray-500);font-weight:500;">(' + obsFmtFileSize(f.size) + ')</span>' : '') + '</span>';
        }).join('') + '</div>';
    }
    if (t === 'قائمة اختيار متعدد' && Array.isArray(v)) {
        return v.map(function (x) { return esc(String(x)); }).join(' • ');
    }
    if (t === 'تبديل') {
        return v ? '<span style="color:var(--success-700);font-weight:700;"><i class="bi bi-check-circle-fill"></i> مفعّل</span>' : '<span style="color:var(--gray-500);"><i class="bi bi-dash-circle"></i> غير مفعّل</span>';
    }
    if (t === 'شبكة خيارات متعددة' && Array.isArray(v)) {
        return v.map(function (r) { return '<div><b>' + esc(r.label) + ':</b> ' + esc(String(r.value || '—')) + '</div>'; }).join('');
    }
    if (t === 'شبكة مربعات اختيار' && Array.isArray(v)) {
        return v.map(function (r) { return '<div><b>' + esc(r.label) + ':</b> ' + esc((r.value || []).join(' • ') || '—') + '</div>'; }).join('');
    }
    if (t === 'جدول بيانات' && Array.isArray(v)) {
        return v.map(function (r) { return '<div><b>' + esc(r.label) + ':</b> ' + esc((r.value || []).filter(Boolean).join(' | ') || '—') + '</div>'; }).join('');
    }
    if (t === 'رابط' && v) {
        return '<a href="' + obsEscAttr(String(v)) + '" target="_blank" rel="noopener" style="color:var(--info-700);direction:ltr;">' + esc(String(v)) + '</a>';
    }
    return esc(String(v));
}

function obsFmtFileSize(bytes) {
    var n = parseInt(bytes, 10) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Step 4 — Submit ───────────────────────────────────────────────────────
async function obsSubmit() {
    var btn = document.getElementById('obsBtnSubmit');
    if (!obsPickedId) { showToast('يرجى اختيار نوع الإجراء', 'warning'); obsGoStep(1); return; }
    if (!obsCollected) {
        var c = obsCollectAnswers({ validateRequired: true });
        if (!c) { obsGoStep(2); return; }
        obsCollected = c;
    }

    var payload = {
        procedureId: obsPickedId,
        priority: obsCollected.priority || obsProcedurePriority || 'متوسط',
        notes: obsCollected.notes || '',
        formDataJson: JSON.stringify({
            formId: obsFormDef ? obsFormDef.id : 0,
            formName: obsFormDef ? obsFormDef.name : '',
            fields: obsCollected.fields || []
        })
    };

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> جاري الإرسال...'; }
    var r = await apiFetch('/Outbox/CreateRequest', 'POST', payload);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send-fill"></i> تأكيد وإرسال'; }
    if (!r || !r.success) { showToast((r && r.message) || 'تعذّر إرسال الطلب', 'danger'); return; }

    var num = r.requestNumber || ('#' + r.id);
    var label = document.getElementById('obsConfirmNumber');
    if (label) label.textContent = num;

    // عرض بطاقات «المعتمد الأول / الوحدات / المنفذون»
    obsRenderRoutingCards();

    obsStep = 4;
    obsShowPanel(4);
    obsRenderStepper();
    showToast(r.message || 'تم تقديم الطلب بنجاح', 'success');
}

function obsRenderRoutingCards() {
    var host = document.getElementById('obsConfirmRouting');
    if (!host) return;
    var html = '';

    if (obsFirstApprover) {
        html += '<div class="obs-routing-card"><i class="bi bi-person-check-fill"></i>'
              + '<div><b>المعتمد الأول</b>' + esc(obsFirstApprover) + '</div></div>';
    }

    if (obsTargetOrgUnits && obsTargetOrgUnits.length) {
        html += '<div class="obs-routing-card"><i class="bi bi-diagram-3-fill"></i>'
              + '<div><b>الوحدات التنظيمية المستهدفة</b>'
              + '<div class="chips">' + obsTargetOrgUnits.map(function (u) { return '<span>' + esc(u.name || '') + '</span>'; }).join('') + '</div>'
              + '</div></div>';
    }

    if (obsExecutors && obsExecutors.length) {
        var top = obsExecutors.slice(0, 8);
        var extra = obsExecutors.length - top.length;
        html += '<div class="obs-routing-card"><i class="bi bi-people-fill"></i>'
              + '<div><b>المنفذون المرتبطون بالإجراء</b>'
              + '<div class="chips">' + top.map(function (e) { return '<span>' + esc(e.fullName || '') + (e.role ? ' • ' + esc(e.role) : '') + '</span>'; }).join('') + (extra > 0 ? '<span>+ ' + extra + '</span>' : '') + '</div>'
              + '</div></div>';
    }

    host.innerHTML = html;
}

// ─── Procedure Details Modal — يفوّض للـ shared modal opdShow ───────────────
async function obsShowProcDetails(id, opts) {
    if (typeof window.opdShow === 'function') {
        return window.opdShow(id, opts || {});
    }
    // fallback (لو لم يُحمَّل outbox-procedure-details.js لأي سبب)
    var modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('obsProcDetailsModal'));
    var host = document.getElementById('obsProcDetailsBody');
    if (host) host.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    modal.show();
    var url = '/Outbox/GetProcedureDetails?id=' + encodeURIComponent(id);
    if (opts && opts.outboxRequestId) url += '&outboxRequestId=' + encodeURIComponent(opts.outboxRequestId);
    var r = await apiFetch(url);
    if (!r || !r.success) { host.innerHTML = '<div class="text-center py-4 text-muted">تعذّر التحميل</div>'; return; }
    host.innerHTML = obsBuildProcedureDetailsHtml(r.data || {}, r.workflow || []);
}

/** Fallback لبناء محتوى المودال (مستخدم فقط لو الـ shared file غير مُحمَّل) */
function obsBuildProcedureDetailsHtml(d, workflow) {
    function dash(v) { return (v == null || String(v).trim() === '') ? '<span class="opd-empty">…</span>' : esc(String(v)); }
    function refs(list, label) {
        if (!Array.isArray(list) || list.length === 0) return '<span class="opd-empty">…</span>';
        return list.map(function (x, i) { return (label ? (i + 1) + '- ' : '') + esc(x.name || '') + (x.code ? ' <span class="opd-muted">(' + esc(x.code) + ')</span>' : ''); }).join('<br>');
    }
    function orgUnits(list) {
        if (!Array.isArray(list) || list.length === 0) return '<span class="opd-empty">…</span>';
        return list.map(function (x, i) { return (i + 1) + '- ' + esc(x.name || ''); }).join('<br>');
    }
    function reglist(list) {
        if (!Array.isArray(list) || list.length === 0) return '<span class="opd-empty">…</span>';
        return list.map(function (s, i) { return (i + 1) + '- ' + esc(String(s || '')); }).join('<br>');
    }

    var icon = obsNormBiIcon(d.typeIcon);
    var tColor = d.typeColor || '#25935F';

    // Header — title chip + sub
    var head =
        '<div class="opd-head">'
        + '<div class="opd-head-ttl"><i class="bi bi-file-earmark-text"></i> تفاصيل الإجراء</div>'
        + '<div class="opd-head-meta">'
        +   '<span class="obs-card-icon opd-type-ic" style="background:' + obsEscAttr(tColor) + ';"><i class="' + obsEscAttr(icon) + '"></i></span>'
        +   '<div class="opd-head-info">'
        +     '<div class="opd-head-name">' + esc(d.name || '') + '</div>'
        +     '<div class="opd-head-sub">' + esc(d.code || '') + (d.versionLabel ? ' • ' + esc(d.versionLabel) : '') + (d.typeName ? ' • ' + esc(d.typeName) : '') + '</div>'
        +   '</div>'
        + '</div>'
        + '</div>';

    // ── Table 1: Procedure details (يطابق التخطيط الشبكي في الصورة) ──
    function row(cells) {
        return '<tr>' + cells.map(function (c) {
            var lbl = c.lbl ? '<th class="opd-th">' + esc(c.lbl) + '</th>' : '';
            var spanAttr = c.span ? ' colspan="' + (c.span * 2) + '"' : '';
            return lbl + '<td class="opd-td"' + spanAttr + '>' + (c.val == null ? '<span class="opd-empty">…</span>' : c.val) + '</td>';
        }).join('') + '</tr>';
    }

    var detailsTbl =
        '<div class="opd-section">'
        + '<div class="opd-section-ttl">تفاصيل الإجراء</div>'
        + '<table class="opd-table"><tbody>'
        +   row([
                { lbl: 'ترميز الإجراء', val: dash(d.code) },
                { lbl: 'اسم الإجراء', val: dash(d.name) },
                { lbl: 'حالة الإجراء', val: opdStatusBadge(d.statusCode, d.statusLabel, d.isActive) }
            ])
        +   row([
                { lbl: 'صلاحية الإجراء', val: dash(d.validityType) },
                { lbl: 'تاريخ بدء الصلاحية', val: d.validityStartDate ? esc(d.validityStartDate) : '<span class="opd-empty">…</span>' },
                { lbl: 'تاريخ انتهاء الصلاحية', val: d.validityEndDate ? esc(d.validityEndDate) : '<span class="opd-empty">…</span>' }
            ])
        +   row([
                { lbl: 'الهدف من الإجراء', val: d.objectives ? '<div class="opd-pre">' + esc(d.objectives) + '</div>' : '<span class="opd-empty">…</span>', span: 3 }
            ])
        +   row([
                { lbl: 'معدل الاستخدام', val: dash(d.usageFrequency) },
                { lbl: 'التصنيف', val: dash(d.procedureClassification) },
                { lbl: 'نوع الإجراء', val: dash(d.typeName) }
            ])
        +   row([
                { lbl: 'الأولوية', val: d.priority ? opdPriorityBadge(d.priority) : '<span class="opd-empty">…</span>' },
                { lbl: 'مساحة العمل', val: dash(d.workspaceName) },
                { lbl: 'الوحدة التنظيمية المالكة للإجراء', val: dash(d.ownerOrgName) }
            ])
        +   row([
                { lbl: 'الوحدات التنظيمية المستهدفة', val: orgUnits(d.targetOrgUnits), span: 3 }
            ])
        +   row([
                { lbl: 'الإجراءات السابقة المرتبطة', val: refs(d.previousProcedures), span: 3 }
            ])
        +   row([
                { lbl: 'الإجراءات الضمنية المرتبطة', val: refs(d.implicitProcedures), span: 3 }
            ])
        +   row([
                { lbl: 'الإجراءات اللاحقة المرتبطة', val: refs(d.nextProcedures), span: 3 }
            ])
        +   row([
                { lbl: 'المدخلات', val: d.additionalInputs ? '<div class="opd-pre">' + esc(d.additionalInputs) + '</div>' : '<span class="opd-empty">…</span>', span: 3 }
            ])
        +   row([
                { lbl: 'المخرجات', val: d.additionalOutputs ? '<div class="opd-pre">' + esc(d.additionalOutputs) + '</div>' : '<span class="opd-empty">…</span>', span: 3 }
            ])
        +   row([
                { lbl: 'الأنظمة واللوائح والتعليمات المنظمة لعمل الإجراء', val: reglist(d.regulations), span: 3 }
            ])
        + '</tbody></table>'
        + '</div>';

    // ── Table 2: Workflow ──
    var wfHead =
        '<thead><tr>'
        + '<th>ت</th>'
        + '<th>اسم الخطوة</th>'
        + '<th>المكلف بالتنفيذ</th>'
        + '<th>المنفذ</th>'
        + '<th>مدة الإنجاز</th>'
        + '<th>الإرجاع</th>'
        + '<th>خطوة الرجوع</th>'
        + '<th>موافقات متزامنة</th>'
        + '<th>النموذج المستخدم</th>'
        + '<th>قناة الإشعار</th>'
        + '<th>الحالة</th>'
        + '</tr></thead>';

    var wfBody = '';
    if (!Array.isArray(workflow) || workflow.length === 0) {
        wfBody = '<tbody><tr><td colspan="11" class="opd-empty-row">لا توجد خطوات سير عمل معرَّفة</td></tr></tbody>';
    } else {
        wfBody = '<tbody>' + workflow.map(function (w) {
            var stColor = w.statusColor && /^#/.test(w.statusColor) ? w.statusColor : '#9DA4AE';
            var stChip = w.statusLabel && w.statusLabel !== '—'
                ? '<span class="opd-status-chip"><span class="opd-status-dot" style="background:' + obsEscAttr(stColor) + '"></span>' + esc(w.statusLabel) + '</span>'
                : '<span class="opd-empty">…</span>';
            var retChip = w.canReturn
                ? '<span class="opd-pill opd-pill-ok"><i class="bi bi-check-circle-fill"></i> نعم</span>'
                : '<span class="opd-pill opd-pill-no"><i class="bi bi-dash-circle"></i> لا</span>';
            return '<tr>'
                + '<td class="opd-cnum">' + esc(String(w.index)) + '</td>'
                + '<td class="opd-step-name">' + esc(w.stepLabel || '') + '</td>'
                + '<td>' + esc(w.assigner || '—') + '</td>'
                + '<td>' + esc(w.executors || '—') + '</td>'
                + '<td>' + esc(w.duration || '—') + '</td>'
                + '<td class="opd-c">' + retChip + '</td>'
                + '<td>' + esc(w.returnLabel || '—') + '</td>'
                + '<td>' + esc(w.concurrentLabel || '—') + '</td>'
                + '<td>' + esc(w.formName || '—') + '</td>'
                + '<td>' + esc(w.channelLabel || '—') + '</td>'
                + '<td>' + stChip + '</td>'
                + '</tr>';
        }).join('') + '</tbody>';
    }

    var workflowTbl =
        '<div class="opd-section">'
        + '<div class="opd-section-ttl">سير عمل الإجراء</div>'
        + '<div class="opd-table-scroll"><table class="opd-table opd-wf-table">' + wfHead + wfBody + '</table></div>'
        + '</div>';

    return head + detailsTbl + workflowTbl;
}

function opdStatusBadge(code, label, isActive) {
    var c = (code || '').toLowerCase();
    var cls = 'opd-pill opd-pill-muted';
    var ic = 'bi-dash-circle';
    if (c === 'approved') { cls = 'opd-pill opd-pill-ok'; ic = 'bi-check-circle-fill'; }
    else if (c === 'pending') { cls = 'opd-pill opd-pill-warn'; ic = 'bi-hourglass-split'; }
    else if (c === 'rejected') { cls = 'opd-pill opd-pill-no'; ic = 'bi-x-circle-fill'; }
    else if (c === 'draft') { cls = 'opd-pill opd-pill-muted'; ic = 'bi-pencil-fill'; }
    var act = isActive
        ? ' <span class="opd-pill opd-pill-ok"><i class="bi bi-toggle-on"></i> مفعّل</span>'
        : ' <span class="opd-pill opd-pill-muted"><i class="bi bi-toggle-off"></i> غير مفعّل</span>';
    return '<span class="' + cls + '"><i class="bi ' + ic + '"></i> ' + esc(label || code || '—') + '</span>' + act;
}

function opdPriorityBadge(p) {
    var v = (p || '').trim();
    if (v === 'عاجل' || v === 'عالي' || v === 'عالية') v = 'مرتفع';
    var cls = 'opd-pill opd-pill-muted';
    var ic = 'bi-dash';
    if (v === 'مرتفع') { cls = 'opd-pill opd-pill-high'; ic = 'bi-arrow-up'; }
    else if (v === 'متوسط') { cls = 'opd-pill opd-pill-med'; ic = 'bi-dash'; }
    else if (v === 'منخفض') { cls = 'opd-pill opd-pill-low'; ic = 'bi-arrow-down'; }
    return '<span class="' + cls + '"><i class="bi ' + ic + '"></i> ' + esc(v || '—') + '</span>';
}

// ─── Reset ─────────────────────────────────────────────────────────────────
function obsResetAndStart() {
    obsPickedId = 0;
    obsPickedData = null;
    obsFormDef = null;
    obsTemplateData = null;
    obsCollected = null;
    obsTargetOrgUnits = [];
    obsExecutors = [];
    obsFirstApprover = '';
    obsProcedurePriority = 'متوسط';
    var fh = document.getElementById('obsFormHost');
    if (fh) fh.innerHTML = '<div class="text-center py-4" style="color:var(--gray-500);"><i class="bi bi-info-circle" style="font-size:24px;display:block;margin-bottom:6px;color:var(--gray-300);"></i>اختر إجراءً أولاً لتحميل نموذجه</div>';
    obsStep = 1;
    obsShowPanel(1);
    obsRenderStepper();
    obsRenderCards();
}

async function obsInit() {
    obsStep = 1;
    obsShowPanel(1);
    obsRenderStepper();
    await obsLoadProcedures();
}

window.obsInit = obsInit;
window.obsGoStep = obsGoStep;
window.obsPick = obsPick;
window.obsShowProcDetails = obsShowProcDetails;
window.obsSubmit = obsSubmit;
window.obsResetAndStart = obsResetAndStart;
window.obsOnFilterTypeChange = obsOnFilterTypeChange;
window.obsApplyCardFilters = obsApplyCardFilters;
window.obsClearCardFilters = obsClearCardFilters;
