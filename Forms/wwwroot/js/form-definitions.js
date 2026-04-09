'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
let fdData          = [];
let fdLookups       = { classifications:[], formTypes:[], workspaces:[], templates:[] };
let fdIsAdmin       = false;
let fdStep          = 1;
let fdEditId        = null;
let fdRejectId      = null;
let fdDeleteId      = null;
let fdFields        = [];          // working field list
let fdEditingIdx    = -1;          // -1 = adding, >= 0 = editing field at idx
let fdCurrentTemplate = null;     // fetched template data for step-3 preview
let fdStep1State    = null;        // persisted step-1 data across wizard steps

// ─── FIELD TYPE DEFINITIONS (mirrors ready-tables) ───────────────────────────
const FD_FIELD_TYPES = {
    "الاسم الكامل": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب (Placeholder)", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"مثال: 300" },
        { key:"charLimit", label:"حد الأحرف", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"fieldCount", label:"عدد الحقول", type:"number", placeholder:"مثال: 3" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "البريد الإلكتروني": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"charLimit", label:"حد الأحرف", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"emailFormat", label:"التحقق من صيغة البريد (xxx@almadinah.gov.sa)", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "رقم الهاتف": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"phoneFormat", label:"صيغة الرقم", type:"select", options:["+966 (9 أرقام)","05xxxxxxxx (10 أرقام)","دولي","تلفون"] },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"charLimit", label:"حد الأحرف", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"inputPattern", label:"نمط الإدخال", type:"select", options:["أرقام فقط","حروف فقط","حروف وأرقام"] },
        { key:"validation", label:"التحقق", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "نص قصير": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"charLimit", label:"حد الأحرف", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"validation", label:"التحقق", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "نص طويل": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"heightPx", label:"الارتفاع", type:"number" },
        { key:"charLimit", label:"حد الأحرف", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"editMode", label:"وضع التعديل", type:"select", options:["عادي","غني (Rich Text)"] },
        { key:"validation", label:"التحقق", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "فقرة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"charLimit", label:"حد الأحرف", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"editMode", label:"وضع التعديل", type:"select", options:["عادي","غني (Rich Text)"] },
        { key:"validation", label:"التحقق", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "رقم": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minValue", label:"الحد الأدنى", type:"number" },
        { key:"maxValue", label:"الحد الأقصى", type:"number" },
        { key:"inputLimits", label:"حدود المدخلات", type:"checkbox" },
        { key:"validation", label:"التحقق", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "قائمة منسدلة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"single" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text", placeholder:"اختر خياراً" },
        { key:"optionsCount", label:"عدد الخيارات", type:"number" },
        { key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }
    ]},
    "قائمة اختيار الواحد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"single" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text" },
        { key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }
    ]},
    "قائمة اختيار متعدد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"multi" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" },
        { key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }
    ]},
    "تاريخ": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"separator", label:"الفاصل", type:"select", options:["/",":","."] },
        { key:"startDate", label:"تاريخ البداية", type:"date" },
        { key:"endDate", label:"تاريخ النهاية", type:"date" },
        { key:"autoDate", label:"التاريخ التلقائي", type:"checkbox" },
        { key:"showCalendar", label:"ظهور التقويم", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "وقت": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"timeFormat", label:"نمط الوقت", type:"select", options:["12 ساعة","24 ساعة"] },
        { key:"autoTime", label:"الوقت التلقائي", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "رفع ملف": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"buttonText", label:"نص الزر", type:"text", placeholder:"رفع ملف" },
        { key:"maxFiles", label:"حد عدد الملفات", type:"number" },
        { type:"fileMbLimitsPair", label:"حد حجم الملف (ميغابايت)", col:"col-12 mb-2" },
        { key:"fileTypes", label:"أنواع الملفات المسموحة", type:"fileTypesPick" },
        { key:"validateSize", label:"التحقق من الحجم", type:"checkbox" }
    ]},
    "دوار رقمي": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minValue", label:"الحد الأدنى", type:"number" },
        { key:"maxValue", label:"الحد الأقصى", type:"number" },
        { key:"stepValue", label:"قيمة الفترة", type:"number", placeholder:"مثال: 1" },
        { key:"noDecimals", label:"بدون عشرية", type:"checkbox" },
        { key:"negativeValue", label:"قيمة سلبية", type:"checkbox" }
    ]},
    "التقييم بالنجوم": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"ratingIcon", label:"أيقونة التقييم", type:"select", options:["نجمة","قلب","إبهام"] },
        { key:"ratingRange", label:"مدى التقييم", type:"number", placeholder:"مثال: 5" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"number" },
        { key:"tooltipText", label:"نص التلميح", type:"text" }
    ]},
    "التقييم بالأرقام": { props: [
        { key:"lowRatingText", label:"نص أقل تقييم", type:"text" },
        { key:"highRatingText", label:"نص أعلى تقييم", type:"text" },
        { key:"minRating", label:"أقل قيمة", type:"number" },
        { key:"maxRating", label:"أعلى قيمة", type:"number" },
        { key:"tooltipText", label:"نص التلميح", type:"text" }
    ]}
};

const FD_FILE_TYPE_CHOICES = [
    { ext:'pdf', label:'PDF' }, { ext:'jpg', label:'JPG' }, { ext:'jpeg', label:'JPEG' },
    { ext:'png', label:'PNG' }, { ext:'doc', label:'Word (.doc)' }, { ext:'docx', label:'Word (.docx)' },
    { ext:'xls', label:'Excel (.xls)' }, { ext:'xlsx', label:'Excel (.xlsx)' }, { ext:'txt', label:'TXT' }
];

// ─── FIELD BUILDER HELPERS ────────────────────────────────────────────────────
function fdEscAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function fdInitOptionListEditor(pfx, mode, propsObj) {
    const el = document.getElementById(pfx + '_options_editor');
    if (!el) return;
    el.innerHTML = ''; el.setAttribute('data-mode', mode);
    const rowsHost = document.createElement('div'); rowsHost.className = 'rtc-opt-rows';
    const po = propsObj || {};
    let lines = [''], defStr = '';
    if (po.options && String(po.options).trim()) {
        lines = String(po.options).split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
        if (!lines.length) lines = [''];
        defStr = (po.defaultOption || '').trim();
    }
    const defMulti = mode === 'multi' ? defStr.split(/,\s*/).map(s => s.trim()).filter(Boolean) : [];
    lines.forEach(t => rowsHost.appendChild(fdCreateOptionRow(pfx, mode, t, defStr, defMulti)));
    el.appendChild(rowsHost);
    const btn = document.createElement('button'); btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-primary mt-2';
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> إضافة خيار';
    btn.onclick = () => rowsHost.appendChild(fdCreateOptionRow(pfx, mode, '', '', []));
    el.appendChild(btn);
}

function fdCreateOptionRow(pfx, mode, text, defSingle, defMultiArr) {
    const wrap = document.createElement('div');
    wrap.className = 'rtc-opt-row d-flex align-items-center gap-2 mb-2 flex-wrap';
    const inp = document.createElement('input'); inp.type = 'text';
    inp.className = 'form-control form-control-sm rtc-opt-text flex-grow-1';
    inp.style.minWidth = '140px'; inp.placeholder = 'نص الخيار'; inp.value = text || '';
    wrap.appendChild(inp);
    const trimmed = (text || '').trim();
    if (mode === 'multi') {
        const d = document.createElement('div'); d.className = 'form-check m-0 flex-shrink-0';
        const c = document.createElement('input'); c.type = 'checkbox'; c.className = 'form-check-input rtc-opt-def-multi';
        if (trimmed && defMultiArr.includes(trimmed)) c.checked = true;
        const l = document.createElement('label'); l.className = 'form-check-label small'; l.textContent = 'افتراضي';
        d.appendChild(c); d.appendChild(l); wrap.appendChild(d);
    } else {
        const d = document.createElement('div'); d.className = 'form-check m-0 flex-shrink-0';
        const r = document.createElement('input'); r.type = 'radio'; r.name = pfx + '_defaultOpt';
        r.className = 'form-check-input rtc-opt-def-single';
        if (trimmed && defSingle && trimmed === defSingle) r.checked = true;
        const l = document.createElement('label'); l.className = 'form-check-label small'; l.textContent = 'افتراضي';
        d.appendChild(r); d.appendChild(l); wrap.appendChild(d);
    }
    const rm = document.createElement('button'); rm.type = 'button';
    rm.className = 'btn btn-sm btn-outline-danger flex-shrink-0';
    rm.innerHTML = '<i class="bi bi-x-lg"></i>'; rm.title = 'حذف الخيار';
    rm.onclick = () => {
        const host = wrap.parentElement;
        if (host && host.querySelectorAll('.rtc-opt-row').length <= 1) { inp.value = ''; }
        else { wrap.remove(); }
    };
    wrap.appendChild(rm);
    return wrap;
}

function fdCollectOptionListFromEditor(pfx) {
    const el = document.getElementById(pfx + '_options_editor');
    if (!el) return null;
    const mode = el.getAttribute('data-mode') || 'single';
    const host = el.querySelector('.rtc-opt-rows');
    if (!host) return { options:'', defaultOption:'' };
    const lines = [], defMulti = []; let defOption = '';
    host.querySelectorAll('.rtc-opt-row').forEach(row => {
        const t = (row.querySelector('.rtc-opt-text')?.value || '').trim();
        if (!t) return; lines.push(t);
        if (mode === 'multi') { if (row.querySelector('.rtc-opt-def-multi')?.checked) defMulti.push(t); }
        else { if (row.querySelector('.rtc-opt-def-single')?.checked) defOption = t; }
    });
    return { options: lines.join('\n'), defaultOption: mode === 'multi' ? defMulti.join(', ') : defOption };
}

function fdCollectFileTypesPick(pfx) {
    const wrap = document.getElementById(pfx + '_fileTypes_pick');
    if (!wrap) return '';
    return Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked')).map(c => c.value).join(',');
}

function fdApplyFileTypesFromProps(pfx, po) {
    const wrap = document.getElementById(pfx + '_fileTypes_pick');
    if (!wrap) return;
    const set = {};
    if (po && po.fileTypes) String(po.fileTypes).split(/[,\s;|]+/).forEach(s => { const x = s.trim().replace(/^\./,'').toLowerCase(); if (x) set[x]=true; });
    wrap.querySelectorAll('input[type="checkbox"]').forEach(c => { c.checked = !!set[(c.value||'').toLowerCase()]; });
}

function fdMergeSpecialProps(type, pfx, result) {
    const def = FD_FIELD_TYPES[type]; if (!def) return result;
    if (def.props.some(p => p.type === 'optionList')) {
        const o = fdCollectOptionListFromEditor(pfx);
        if (o) { result.options = o.options; result.defaultOption = o.defaultOption; }
    }
    if (def.props.some(p => p.type === 'fileTypesPick')) result.fileTypes = fdCollectFileTypesPick(pfx);
    return result;
}

function fdApplyPropsSpecialEditors(type, pfx, po) {
    const def = FD_FIELD_TYPES[type]; if (!def) return;
    def.props.forEach(p => { if (p.type === 'optionList') fdInitOptionListEditor(pfx, p.choiceMode||'single', po||{}); });
    fdApplyFileTypesFromProps(pfx, po||{});
}

function fdBuildSinglePropHtml(p, pfx) {
    if (p.type === 'fileMbLimitsPair') {
        return `<div class="${p.col||'col-12 mb-2'}"><span class="d-block small fw-bold mb-1" style="color:var(--gray-600);">${p.label||'حد حجم الملف (ميغابايت)'}</span>
        <div class="d-flex flex-nowrap align-items-end gap-2">
        <div><label class="small text-muted mb-0 d-block">أدنى</label><input type="number" min="0" step="0.01" class="form-control form-control-sm" id="${pfx}_minFileSize" placeholder="0" style="border-radius:8px;width:90px;"></div>
        <div><label class="small text-muted mb-0 d-block">أقصى</label><input type="number" min="0" step="0.01" class="form-control form-control-sm" id="${pfx}_maxFileSize" placeholder="10" style="border-radius:8px;width:90px;"></div>
        </div></div>`;
    }
    if (p.type === 'optionList') {
        return `<div class="col-12 mb-3"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label}</label>
        <p class="text-muted small mb-2" style="font-size:11px;">أضف خياراً لكل سطر، وحدد «افتراضي» لقيمة تظهر تلقائياً.</p>
        <div id="${pfx}_options_editor" class="border rounded-3 p-3" style="background:#fafafa;" data-mode="${p.choiceMode||'single'}"></div></div>`;
    }
    if (p.type === 'fileTypesPick') {
        let h = `<div class="col-12 mb-3"><label class="d-block fw-bold mb-2" style="color:var(--gray-600);font-size:12px;">${p.label}</label>
        <div id="${pfx}_fileTypes_pick" class="d-flex flex-wrap gap-3 border rounded-3 p-3 bg-white">`;
        FD_FILE_TYPE_CHOICES.forEach(ft => {
            h += `<div class="form-check m-0"><input class="form-check-input" type="checkbox" value="${ft.ext}" id="${pfx}_ft_${ft.ext}"><label class="form-check-label" for="${pfx}_ft_${ft.ext}" style="font-size:12.5px;">${ft.label}</label></div>`;
        });
        return h + '</div></div>';
    }
    const fid = `${pfx}_${p.key}`;
    const col = p.col || 'col-md-4 col-sm-6 mb-3';
    const hints = { subName:'<div class="text-muted" style="font-size:10px;margin-top:2px;">نص صغير يظهر أسفل الحقل</div>', defaultValue:'<div class="text-muted" style="font-size:10px;margin-top:2px;">قيمة تُعبأ تلقائياً في الحقل</div>', placeholder:'<div class="text-muted" style="font-size:10px;margin-top:2px;">نص إرشادي يختفي عند الكتابة</div>', readOnly:'<div class="text-muted" style="font-size:10px;margin-top:2px;">الحقل يظهر لكن لا يمكن تعديله</div>' };
    let html = `<div class="${col}"><label class="d-block" style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:4px;">${p.label}</label>`;
    if (p.type === 'checkbox') {
        html += `<div class="form-check mt-1"><input class="form-check-input" type="checkbox" id="${fid}"><label class="form-check-label" for="${fid}" style="font-size:12.5px;">${p.checkboxLabel||'تفعيل'}</label></div>`;
    } else if (p.type === 'select') {
        html += `<select class="form-select form-select-sm" id="${fid}" style="border-radius:8px;font-size:12.5px;"><option value="">اختر</option>`;
        (p.options||[]).forEach(o => { html += `<option value="${fdEscAttr(o)}">${o}</option>`; });
        html += '</select>';
    } else {
        html += `<input type="${p.type||'text'}" class="form-control form-control-sm" id="${fid}" placeholder="${fdEscAttr(p.placeholder||'')}" style="border-radius:8px;font-size:12.5px;">`;
    }
    return html + (hints[p.key]||'') + '</div>';
}

// ─── FIELD INPUT BUILDER (for step-3 preview) ─────────────────────────────────
function fdBuildFieldInput(f) {
    const ph = ((f.placeholder||'') || (f.tooltipText||'')).replace(/"/g,'&quot;');
    let props = {};
    try { props = JSON.parse(f.propertiesJson||'{}'); } catch(e) {}
    const defVal  = props.defaultValue != null ? String(props.defaultValue).replace(/"/g,'&quot;') : '';
    const roAttr  = props.readOnly ? ' readonly' : '';
    const roSel   = props.readOnly ? ' disabled' : '';
    const roStyle = props.readOnly ? 'background:#f3f4f6;cursor:not-allowed;' : '';
    const reqAttr = f.isRequired ? ' required' : '';
    const maxL    = (props.maxLength||props.charLimit) ? ` maxlength="${props.maxLength||props.charLimit}"` : '';
    const minL    = props.minLength ? ` minlength="${props.minLength}"` : '';
    const wStyle  = props.widthPx ? `width:${props.widthPx}px;` : '';
    const ttAttr  = f.tooltipText ? ` title="${fdEscAttr(f.tooltipText)}"` : '';
    function mk(extra) { const s=(wStyle+roStyle+(extra||'')).trim(); return s?` style="${s}"`:''; }
    let inp = '';

    if (f.fieldType==='الاسم الكامل'||f.fieldType==='نص قصير') {
        inp = `<input type="text" class="form-control" placeholder="${ph}" value="${defVal}"${reqAttr}${maxL}${minL}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='رقم الهاتف') {
        const fmt = props.phoneFormat||'+966 (9 أرقام)';
        if (fmt==='+966 (9 أرقام)') inp = `<div class="input-group"${ttAttr}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+966</span><input type="tel" class="form-control" placeholder="5XXXXXXXX" maxlength="9" value="${defVal}"${reqAttr}${roAttr}></div>`;
        else if (fmt==='05xxxxxxxx (10 أرقام)') inp = `<input type="tel" class="form-control" placeholder="05XXXXXXXX" maxlength="10" value="${defVal}"${reqAttr}${roAttr}${ttAttr}${mk('direction:ltr;')}>`;
        else inp = `<input type="tel" class="form-control" placeholder="${ph||'XXXXXXXX'}" value="${defVal}"${reqAttr}${maxL}${roAttr}${ttAttr}${mk('direction:ltr;')}>`;
    } else if (f.fieldType==='البريد الإلكتروني') {
        const pat = props.emailFormat ? ' pattern="[^\\s@]+@almadinah\\.gov\\.sa"' : '';
        inp = `<input type="email" class="form-control" placeholder="${ph}" value="${defVal}"${pat}${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='نص طويل'||f.fieldType==='فقرة') {
        const hPx = props.heightPx ? `height:${props.heightPx}px;` : '';
        inp = `<textarea class="form-control" rows="3" placeholder="${ph}"${reqAttr}${maxL}${minL}${roAttr}${ttAttr}${mk(hPx)}>${(props.defaultValue||'').replace(/</g,'&lt;')}</textarea>`;
    } else if (f.fieldType==='رقم') {
        const mn = props.minValue!=null&&props.minValue!==''?` min="${props.minValue}"`:'';
        const mx = props.maxValue!=null&&props.maxValue!==''?` max="${props.maxValue}"`:'';
        inp = `<input type="number" class="form-control" placeholder="${ph}" value="${defVal}"${mn}${mx}${reqAttr}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='دوار رقمي') {
        const mn = props.minValue!=null&&props.minValue!==''?` min="${props.minValue}"`:'';
        const mx = props.maxValue!=null&&props.maxValue!==''?` max="${props.maxValue}"`:'';
        const st = props.stepValue!=null&&props.stepValue!==''?` step="${props.stepValue}"`:(props.noDecimals?' step="1"':'');
        inp = `<div class="input-group"${ttAttr}><button type="button" class="btn btn-outline-secondary" onclick="fdSpinDec(this)" style="padding:4px 10px;">−</button><input type="number" class="form-control text-center" value="${defVal||props.minValue||'0'}"${mn}${mx}${st}${reqAttr}><button type="button" class="btn btn-outline-secondary" onclick="fdSpinInc(this)" style="padding:4px 10px;">+</button></div>`;
    } else if (f.fieldType==='قائمة منسدلة'||f.fieldType==='قائمة اختيار الواحد') {
        const opts = props.options ? String(props.options).split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean) : [];
        const def  = (props.defaultOption||'').trim();
        inp = `<select class="form-select"${reqAttr}${roSel}${ttAttr}${mk()}><option value="">${(props.emptyText||ph||'اختر...').replace(/</g,'&lt;')}</option>`;
        opts.forEach(o => { inp += `<option value="${o.replace(/"/g,'&quot;')}"${o===def?' selected':''}>${o.replace(/</g,'&lt;')}</option>`; });
        inp += '</select>';
    } else if (f.fieldType==='قائمة اختيار متعدد') {
        const opts = props.options ? String(props.options).split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean) : [];
        const defSet = {}; String(props.defaultOption||'').split(/,\s*/).forEach(d=>{if(d.trim())defSet[d.trim()]=true;});
        inp = `<div class="d-flex flex-wrap gap-2"${ttAttr}>`;
        opts.forEach(o => { inp += `<div class="form-check mb-0"><input class="form-check-input" type="checkbox"${defSet[o]?' checked':''}${props.readOnly?' disabled':''}><label class="form-check-label">${o.replace(/</g,'&lt;')}</label></div>`; });
        if (!opts.length) inp += '<span class="text-muted">—</span>';
        inp += '</div>';
    } else if (f.fieldType==='تاريخ') {
        inp = `<input type="date" class="form-control" value="${defVal}"${reqAttr}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='وقت') {
        inp = `<input type="time" class="form-control" value="${defVal}"${reqAttr}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='رفع ملف') {
        const acc = (props.fileTypes||'').split(/[,\s;|]+/).filter(Boolean).map(s=>'.'+(s.trim().replace(/^\./,''))).join(',');
        inp = `<input type="file" class="form-control"${acc?` accept="${acc}"`:''}${reqAttr}${ttAttr}>`;
    } else if (f.fieldType==='التقييم بالنجوم') {
        const range = parseInt(props.ratingRange)||5;
        const icon  = props.ratingIcon||'نجمة';
        const char  = icon==='قلب'?'♥':icon==='إبهام'?'👍':'★';
        const sdef  = parseInt(defVal)||0;
        inp = `<div class="d-flex gap-1"${ttAttr}>`;
        for (let i=1;i<=range;i++) inp += `<span onclick="fdStarClick(this,${i})" style="font-size:22px;cursor:pointer;color:${i<=sdef?'#f59e0b':'#d1d5db'}" data-i="${i}">${char}</span>`;
        inp += `<span class="ms-2 fw-bold" style="font-size:13px;">${sdef}/${range}</span></div>`;
    } else if (f.fieldType==='التقييم بالأرقام') {
        const lo = parseInt(props.minRating)||0, hi = parseInt(props.maxRating)||10;
        inp = `<div${ttAttr}><input type="range" class="form-range" min="${lo}" max="${hi}" value="${defVal||lo}" oninput="this.nextElementSibling.textContent=this.value"><div class="text-center fw-bold">${defVal||lo}</div></div>`;
    } else {
        inp = `<input type="text" class="form-control" placeholder="${ph}" value="${defVal}"${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
    }

    const sub = (f.subName||props.subName||'').trim();
    if (sub) inp += `<div class="text-muted mt-1" style="font-size:11px;">${sub.replace(/</g,'&lt;')}</div>`;
    return inp;
}

function fdSpinInc(btn) { const i=btn.parentElement.querySelector('input[type="number"]'); if(!i) return; const s=parseFloat(i.step)||1,m=i.max!==''?parseFloat(i.max):Infinity,v=parseFloat(i.value)||0; if(v+s<=m) i.value=+(v+s).toFixed(4); }
function fdSpinDec(btn) { const i=btn.parentElement.querySelector('input[type="number"]'); if(!i) return; const s=parseFloat(i.step)||1,m=i.min!==''?parseFloat(i.min):-Infinity,v=parseFloat(i.value)||0; if(v-s>=m) i.value=+(v-s).toFixed(4); }
function fdStarClick(el,idx) { const w=el.closest('div'); if(!w) return; w.querySelectorAll('[data-i]').forEach(s=>{ s.style.color=parseInt(s.dataset.i)<=idx?'#f59e0b':'#d1d5db'; }); const l=w.querySelector('span:not([data-i])'); if(l) l.textContent=idx+'/'+(w.querySelectorAll('[data-i]').length); }

function fdGetPropsSummary(f) {
    try {
        const p = JSON.parse(f.propertiesJson||'{}'), parts=[], def=FD_FIELD_TYPES[f.fieldType];
        if (!def) return '-';
        for (const k in p) {
            if (p[k]===''||p[k]===false||p[k]===null||p[k]===undefined) continue;
            if (k==='subName'||k==='placeholder') continue;
            const pd = def.props.find(x=>x.key===k); if (!pd) continue;
            if (pd.type==='checkbox'&&p[k]) parts.push(pd.label);
            else if (p[k]) parts.push(pd.label+': '+p[k]);
        }
        return parts.length ? parts.join(' | ') : '-';
    } catch(e) { return '-'; }
}

// ─── BOOTSTRAP MODAL HELPERS ─────────────────────────────────────────────────
const fdWizModal  = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('fdWizardModal'));
const fdDetModal  = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('fdDetailsModal'));
const fdRejModal  = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('fdRejectModal'));
const fdDelModal  = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('fdDeleteModal'));

// ─── LOAD / RENDER TABLE ──────────────────────────────────────────────────────
async function fdLoad() {
    const search = document.getElementById('fdSearch')?.value||'';
    const status = document.getElementById('fdFilterStatus')?.value||'';
    const catId  = document.getElementById('fdFilterCat')?.value||'';
    const typeId = document.getElementById('fdFilterType')?.value||'';
    const p = new URLSearchParams({search,status});
    if (catId)  p.set('categoryId',catId);
    if (typeId) p.set('typeId',typeId);
    try {
        const res = await apiFetch(`/FormDefinitions/GetFormDefinitions?${p}`);
        if (!res.success) return;
        fdData    = res.data||[];
        fdIsAdmin = res.isAdmin;
        fdLookups = { classifications:res.classifications||[], formTypes:res.formTypes||[], workspaces:res.workspaces||[], templates:res.templates||[] };
        fdFillFilters(); fdRenderTable();
    } catch(e) { console.error('fdLoad',e); }
}

function fdFillFilters() {
    const catSel  = document.getElementById('fdFilterCat');
    const typeSel = document.getElementById('fdFilterType');
    if (catSel && catSel.options.length<=1) fdLookups.classifications.forEach(c=>catSel.add(new Option(c.name,c.id)));
    if (typeSel && typeSel.options.length<=1) fdLookups.formTypes.forEach(t=>typeSel.add(new Option(t.name,t.id)));
    const th = document.getElementById('fdThActive');
    if (th) th.style.display = fdIsAdmin ? '' : 'none';
}

function fdClear() {
    ['fdSearch','fdFilterCat','fdFilterType','fdFilterStatus'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    fdLoad();
}

function fdRenderTable() {
    const tbody = document.getElementById('fdBody');
    if (!tbody) return;
    if (!fdData.length) {
        tbody.innerHTML = `<tr><td colspan="11"><div class="fd-empty-state"><i class="bi bi-file-earmark-x"></i><p>لا توجد نماذج بعد</p></div></td></tr>`;
        return;
    }
    tbody.innerHTML = fdData.map((f,i) => {
        const disp = fdIsAdmin ? '' : 'display:none;';
        const toggle = fdIsAdmin ? `<label class="fd-toggle" title="${f.status!=='approved'?'يمكن التفعيل للنماذج المعتمدة فقط':''}"><input type="checkbox" ${f.isActive?'checked':''} ${f.status!=='approved'?'disabled':''} onchange="fdToggle(${f.id},this)"><span class="fd-slider"></span></label>` : '';
        return `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${i+1}</td>
            <td style="font-weight:600;">${esc(f.name)}</td>
            <td>${esc(f.workspaceName)}</td>
            <td>${esc(f.categoryName)}</td>
            <td>${esc(f.formTypeName)}</td>
            <td>${esc(f.templateName)}</td>
            <td style="text-align:center;">${fdOwnershipBadge(f.ownership)}</td>
            <td style="font-size:13px;">${esc(f.orgUnitName)}</td>
            <td style="text-align:center;">${fdStatusBadge(f.status)}</td>
            <td style="text-align:center;${disp}">${toggle}</td>
            <td style="text-align:center;">${fdActions(f)}</td>
        </tr>`;
    }).join('');
}

function fdStatusBadge(status) {
    const map = { draft:['fd-badge-draft','bi-pencil-fill','مسودة'], pending:['fd-badge-pending','bi-clock-fill','بانتظار الاعتماد'], approved:['fd-badge-approved','bi-check-circle-fill','معتمد'], rejected:['fd-badge-rejected','bi-x-circle-fill','مرفوض'] };
    const [cls,icon,lbl] = map[status]||map.draft;
    return `<span class="fd-badge ${cls}"><i class="bi ${icon}"></i>${lbl}</span>`;
}

function fdOwnershipBadge(ownership) {
    if (!ownership) return `<span class="fd-owner-badge fd-owner-none">—</span>`;
    if (ownership === 'عام') return `<span class="fd-owner-badge fd-owner-public">عام</span>`;
    if (ownership === 'خاص') return `<span class="fd-owner-badge fd-owner-private">خاص</span>`;
    return `<span class="fd-owner-badge fd-owner-none">—</span>`;
}

function fdActions(f) {
    let h = '<div class="d-flex gap-1 justify-content-center flex-wrap">';
    h += `<button class="fd-action-btn fd-action-btn-detail" onclick="fdShowDetails(${f.id})"><i class="bi bi-eye"></i> تفاصيل</button>`;
    if (fdIsAdmin||f.status==='draft'||f.status==='rejected')
        h += `<button class="fd-action-btn fd-action-btn-edit" onclick="fdShowEdit(${f.id})"><i class="bi bi-pencil-square"></i> تعديل</button>`;
    if (!fdIsAdmin&&(f.status==='draft'||f.status==='rejected'))
        h += `<button class="fd-action-btn fd-action-btn-send" onclick="fdSendApproval(${f.id})"><i class="bi bi-send-fill"></i> إرسال</button>`;
    if (fdIsAdmin&&f.status==='pending') {
        h += `<button class="fd-action-btn fd-action-btn-approve" onclick="fdApprove(${f.id})"><i class="bi bi-check-lg"></i> اعتماد</button>`;
        h += `<button class="fd-action-btn fd-action-btn-reject" onclick="fdShowReject(${f.id},'${esc(f.name)}')"><i class="bi bi-x-lg"></i> رفض</button>`;
    }
    if (fdIsAdmin||f.status==='draft'||f.status==='rejected')
        h += `<button class="fd-action-btn fd-action-btn-delete" onclick="fdShowDelete(${f.id},'${esc(f.name)}')"><i class="bi bi-trash3"></i> حذف</button>`;
    return h + '</div>';
}

// ─── TOGGLE ACTIVE ────────────────────────────────────────────────────────────
async function fdToggle(id, el) {
    try {
        const res = await apiFetch('/FormDefinitions/ToggleFormDefinition','POST',{id});
        if (res.success) { showToast(res.isActive?'تم تفعيل النموذج':'تم تعطيل النموذج','success'); fdLoad(); }
        else { showToast(res.message||'خطأ','error'); el.checked=!el.checked; }
    } catch { el.checked=!el.checked; }
}

// ─── WIZARD SHOW ──────────────────────────────────────────────────────────────
function fdShowCreate() {
    fdEditId = null; fdStep = 1; fdFields = []; fdEditingIdx = -1; fdCurrentTemplate = null;
    fdStep1State = { name:'', desc:'', ownership:'عام', catId:0, typeId:0, wsId:0, tplId:0 };
    document.getElementById('fdWizardTitle').textContent = 'إنشاء نموذج جديد';
    document.getElementById('fdWizardSub').textContent = 'أدخل بيانات النموذج الجديد';
    document.getElementById('fdWizardHead').className = 'fd-modal-header create';
    fdRenderStep(); fdWizModal().show();
}

async function fdShowEdit(id) {
    try {
        const res = await apiFetch(`/FormDefinitions/GetFormDefinition?id=${id}`);
        if (!res.success) return showToast(res.message, 'error');
        const d = res.data;
        if (res.workspaces && res.workspaces.length)
            fdLookups.workspaces = res.workspaces;
        fdEditId = id; fdStep = 1; fdEditingIdx = -1;
        fdStep1State = {
            name: d.name || '',
            desc: d.description || '',
            ownership: d.ownership || 'عام',
            catId: d.categoryId || 0,
            typeId: d.formTypeId || 0,
            wsId: d.workspaceId || 0,
            tplId: d.templateId || 0
        };
        // Pre-cache the template data so Step 3 renders immediately without extra fetch
        fdCurrentTemplate = d.templateData || null;
        try { fdFields = JSON.parse(d.fieldsJson || '[]'); } catch { fdFields = []; }
        fdFields.forEach((f, i) => { if (!f.id) f.id = i + 1; });
        document.getElementById('fdWizardTitle').textContent = 'تعديل النموذج';
        document.getElementById('fdWizardSub').textContent = d.name;
        document.getElementById('fdWizardHead').className = 'fd-modal-header edit';
        fdRenderStep(d); fdWizModal().show();
    } catch { showToast('خطأ في تحميل البيانات', 'error'); }
}

// ─── WIZARD RENDER ────────────────────────────────────────────────────────────
function fdRenderStep(data) {
    ['fdStep1El','fdStep2El','fdStep3El'].forEach((id,idx) => {
        const el=document.getElementById(id); if(!el) return;
        el.className='fd-step'+(idx+1===fdStep?' active':idx+1<fdStep?' done':'');
    });
    const body = document.getElementById('fdWizardBody');
    const foot = document.getElementById('fdWizardFoot');

    if (fdStep===1) {
        body.innerHTML = fdStep1Html(data);
        foot.innerHTML = `<div></div><div class="d-flex gap-2"><button class="fd-save-btn send" onclick="fdGoStep2()"><i class="bi bi-arrow-left-short"></i> التالي</button></div>`;
    } else if (fdStep===2) {
        body.innerHTML = fdStep2Html();
        fdRenderFieldsTable();
        fdResetFieldForm();
        foot.innerHTML = `<button class="fd-cancel-btn" onclick="fdGoStepBack(2)"><i class="bi bi-arrow-right-short"></i> السابق</button>
        <button class="fd-save-btn send" onclick="fdGoStep3()"><i class="bi bi-arrow-left-short"></i> التالي</button>`;
    } else {
        body.innerHTML = fdStep3Html();
        const primaryActionLabel = fdIsAdmin ? 'نشر النموذج' : 'إرسال للاعتماد';
        const primaryActionIcon  = fdIsAdmin ? 'bi-upload' : 'bi-send-fill';
        foot.innerHTML = `<button class="fd-cancel-btn" onclick="fdGoStepBack(3)"><i class="bi bi-arrow-right-short"></i> السابق</button>
        <div class="d-flex gap-2">
            <button class="fd-save-btn draft" onclick="fdSave(false)"><i class="bi bi-floppy2-fill"></i> حفظ كمسودة</button>
            <button class="fd-save-btn send" onclick="fdSave(true)"><i class="bi ${primaryActionIcon}"></i> ${primaryActionLabel}</button>
        </div>`;
    }
}

// ─── STEP 1 HTML ─────────────────────────────────────────────────────────────
function fdStep1Html(d) {
    d = d || fdStep1State || {};
    const ow  = d.ownership||'عام';
    const catIdVal = d.categoryId != null ? d.categoryId : d.catId;
    const typeIdVal = d.formTypeId != null ? d.formTypeId : d.typeId;
    const wsIdVal = d.workspaceId != null && d.workspaceId !== '' ? d.workspaceId : (d.wsId || 0);
    const tplIdVal = d.templateId != null ? d.templateId : d.tplId;
    const cat = fdLookups.classifications.map(c=>`<option value="${c.id}" ${c.id==catIdVal?'selected':''}>${c.name}</option>`).join('');
    const typ = fdLookups.formTypes.map(t=>`<option value="${t.id}" ${t.id==typeIdVal?'selected':''}>${t.name}</option>`).join('');
    const ws  = fdLookups.workspaces.map(w=>`<option value="${w.id}" ${w.id==wsIdVal?'selected':''}>${w.name}</option>`).join('');
    const tpl = fdLookups.templates.map(t=>`<option value="${t.id}" ${t.id==tplIdVal?'selected':''}>${t.name}</option>`).join('');
    return `
    <div class="fd-section">
        <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> المعلومات الأساسية</div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label><span class="required-star">*</span> اسم النموذج</label><input type="text" class="form-control" id="fdFName" value="${esc(d.name||'')}" placeholder="مثال: نموذج طلب إجازة"></div>
            ${fdIsAdmin
                ? `<div class="fd-form-group"><label>الملكية</label><input type="text" class="form-control" value="لا تنطبق على مدير النظام" disabled></div>`
                : `<div class="fd-form-group"><label><span class="required-star">*</span> الملكية</label><select class="form-select" id="fdFOwnership"><option ${ow==='عام'?'selected':''}>عام</option><option ${ow==='خاص'?'selected':''}>خاص</option></select></div>`
            }
        </div>
        <div class="fd-form-row cols-1"><div class="fd-form-group"><label>الوصف العام</label><textarea class="form-control" id="fdFDesc" rows="2" placeholder="وصف مختصر">${esc(d.description||'')}</textarea></div></div>
    </div>
    <div class="fd-section">
        <div class="fd-section-title"><i class="bi bi-tags-fill"></i> التصنيف والنوع والقالب</div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label><span class="required-star">*</span> التصنيف التنظيمي</label><select class="form-select" id="fdFCat"><option value="">-- اختر --</option>${cat}</select></div>
            <div class="fd-form-group"><label><span class="required-star">*</span> نوع النموذج</label><select class="form-select" id="fdFType"><option value="">-- اختر --</option>${typ}</select></div>
        </div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label><span class="required-star">*</span> مساحة العمل</label><select class="form-select" id="fdFWs"><option value="">-- اختر --</option>${ws}</select></div>
            <div class="fd-form-group"><label><span class="required-star">*</span> القالب المستخدم</label><select class="form-select" id="fdFTpl"><option value="">-- اختر --</option>${tpl}</select></div>
        </div>
    </div>`;
}

// ─── STEP 2 HTML (field builder — mirrors ready tables) ────────────────────────
function fdStep2Html() {
    const typeOpts = Object.keys(FD_FIELD_TYPES).map(t=>`<option value="${t}">${t}</option>`).join('');
    return `
    <div class="fd-section" style="margin-bottom:0;">
        <div class="fd-section-title"><i class="bi bi-layout-text-sidebar"></i> حقول النموذج <span class="badge bg-secondary-subtle text-secondary ms-auto" id="fdFieldsCountBadge">0 حقل</span></div>

        <!-- Fields table -->
        <div class="table-responsive mb-3">
            <table class="table table-sm mb-0" style="font-size:12.5px;">
                <thead>
                    <tr>
                        <th style="width:36px;">#</th>
                        <th>نوع الحقل</th>
                        <th>اسم الحقل</th>
                        <th style="width:60px;">إجباري</th>
                        <th>الخصائص</th>
                        <th>التلميح</th>
                        <th style="width:80px;">إجراءات</th>
                    </tr>
                </thead>
                <tbody id="fdFieldsBody">
                    <tr><td colspan="7" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>
                </tbody>
            </table>
        </div>

        <!-- Add/Edit field form -->
        <div style="background:var(--gray-50);border:2px dashed var(--gray-200);border-radius:10px;padding:16px;">
            <div style="font-size:13px;font-weight:700;color:var(--sa-700);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <i class="bi bi-plus-circle-fill" style="color:var(--sa-500);"></i>
                <span id="fdFieldFormLabel">إضافة حقل رقم</span> <span id="fdFieldNum" style="color:var(--sa-600);">1</span>
            </div>
            <div class="row g-2 mb-2">
                <div class="col-md-3">
                    <label class="small fw-bold text-muted">نوع الحقل <span class="required-star">*</span></label>
                    <select class="form-select form-select-sm" id="fdFieldType" onchange="fdOnFieldTypeChange()">
                        <option value="">-- اختر النوع --</option>${typeOpts}
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted">اسم الحقل <span class="required-star">*</span></label>
                    <input type="text" class="form-control form-control-sm" id="fdFieldName" placeholder="اسم الحقل">
                </div>
                <div class="col-md-2">
                    <label class="small fw-bold text-muted">إجباري</label>
                    <select class="form-select form-select-sm" id="fdFieldRequired">
                        <option value="1">نعم</option>
                        <option value="0">لا</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="small fw-bold text-muted">نص التلميح <span id="fdPropsCell" style="color:var(--sa-500);font-weight:600;"></span></label>
                    <input type="text" class="form-control form-control-sm" id="fdFieldTooltip" placeholder="يظهر عند التمرير">
                </div>
            </div>

            <!-- Properties area -->
            <div id="fdPropsArea" style="display:none;">
                <div style="border-top:2px solid var(--gray-200);margin-top:12px;padding-top:12px;">
                    <div style="font-size:12px;font-weight:700;color:var(--sa-700);margin-bottom:8px;display:flex;align-items:center;gap:5px;">
                        <i class="bi bi-sliders2"></i> الخصائص الإضافية حسب نوع الحقل
                    </div>
                    <div class="row g-2" id="fdPropsFields"></div>
                </div>
            </div>

            <div class="d-flex justify-content-end mt-3 gap-2">
                <button class="btn btn-sm btn-outline-secondary" onclick="fdResetFieldForm()" id="fdCancelEditBtn" style="display:none;">إلغاء التعديل</button>
                <button class="btn btn-sm btn-primary" onclick="fdAddField()">
                    <i class="bi bi-plus-lg"></i> <span id="fdAddFieldBtnTxt">إضافة الحقل</span>
                </button>
            </div>
        </div>
    </div>`;
}

// ─── TEMPLATE SECTION RENDERER (mirrors tpRenderPreviewSection) ──────────────
function fdRenderTemplateSection(sec) {
    if (!sec) return '';
    if (sec.type === 'logo') {
        const w = (sec.logoWidth || 4) * 37.8;
        const h = (sec.logoHeight || 2) * 37.8;
        if (!sec.imageUrl) return `<div style="text-align:${sec.imageAlign||'center'};color:var(--gray-300);font-size:12px;padding:6px;"><i class="bi bi-image" style="font-size:22px;display:block;"></i>شعار</div>`;
        return `<div style="text-align:${sec.imageAlign||'center'};padding:4px;"><img src="${sec.imageUrl}" style="width:${w}px;height:${h}px;object-fit:contain;" alt=""></div>`;
    }
    const lines = (sec.text || ['']).map(t => `<div style="font-size:${sec.fontSize||14}px;font-weight:${sec.bold?'700':'400'};line-height:1.5;font-style:normal;">${t ? esc(t) : '<span style="opacity:.3;">نص</span>'}</div>`).join('');
    return `<div style="text-align:${sec.align||'center'};padding:4px;font-style:normal;">${lines}</div>`;
}

// ─── SHARED FORM PREVIEW BUILDER ─────────────────────────────────────────────
// Renders Header + Body (fields) + Footer from a real saved template object.
// tplData   – object with headerJson/footerJson/color/margins (or null = fallback)
// formName  – string
// formDesc  – string
// fields    – array of field objects
// interactive – true → render editable inputs (step-3), false → read-only display (details)
function fdBuildFormPreview(tplData, formName, formDesc, fields, interactive) {

    // ── fields HTML ──────────────────────────────────────────────────────────
    let fieldsHtml = '';
    if (!fields.length) {
        fieldsHtml = `<div class="text-center py-4" style="color:var(--gray-400);font-style:normal;">
            <i class="bi bi-inbox" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);"></i>
            لم تُضف حقول بعد
        </div>`;
    } else {
        fieldsHtml = fields.map(f => {
            const tipAttr   = f.tooltipText ? ` title="${fdEscAttr(f.tooltipText)}"` : '';
            const infoIcon  = f.tooltipText ? `<i class="bi bi-info-circle ms-1" style="font-size:11px;color:var(--sa-400);"${tipAttr}></i>` : '';
            const subName   = f.subName ? `<small style="display:block;color:var(--gray-400);font-size:11px;margin-top:2px;font-style:normal;">${esc(f.subName)}</small>` : '';
            const inputHtml = interactive
                ? fdBuildFieldInput(f)
                : `<div style="padding:8px 12px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:13px;color:var(--gray-500);background:var(--gray-50);font-style:normal;">${esc(f.defaultValue || f.placeholder || '—')}</div>`;
            return `<div style="margin-bottom:18px;font-style:normal;">
                <label style="font-size:13px;font-weight:700;color:var(--gray-700);display:block;margin-bottom:4px;font-style:normal;"${tipAttr}>
                    ${esc(f.fieldName)}${f.isRequired ? '<span style="color:#ef4444;margin-right:4px;">*</span>' : ''}${infoIcon}
                </label>
                ${subName}
                ${inputHtml}
            </div>`;
        }).join('');
    }

    // ── template layout ───────────────────────────────────────────────────────
    const tpl      = tplData;
    const tplColor = tpl ? (tpl.color || '#14573A') : 'var(--sa-800)';
    const pageDir  = tpl ? (tpl.pageDirection || 'RTL').toLowerCase() : 'rtl';
    const mt = tpl ? (tpl.marginTop    ?? 24) : 24;
    const mb = tpl ? (tpl.marginBottom ?? 24) : 24;
    const mr = tpl ? (tpl.marginRight  ?? 24) : 24;
    const ml = tpl ? (tpl.marginLeft   ?? 24) : 24;

    let headerHtml = '', headerLineHtml = '', footerLineHtml = '', footerHtml = '';

    if (tpl) {
        let hd = [], fd = [];
        try { hd = JSON.parse(tpl.headerJson || '[]'); } catch {}
        try { fd = JSON.parse(tpl.footerJson || '[]'); } catch {}

        headerHtml = hd.length
            ? `<div style="display:grid;grid-template-columns:repeat(${hd.length},1fr);min-height:52px;align-items:center;padding:10px ${mr}px;background:#fff;">${hd.map(s => fdRenderTemplateSection(s)).join('')}</div>`
            : `<div style="padding:12px ${mr}px;background:#fff;color:var(--gray-300);font-size:12px;text-align:center;font-style:normal;"><i class="bi bi-layout-text-window-reverse" style="font-size:18px;display:block;margin-bottom:3px;"></i>${esc(tpl.name)}</div>`;

        headerLineHtml = tpl.showHeaderLine ? `<div style="height:2px;background:${tplColor};"></div>` : '';
        footerLineHtml = tpl.showFooterLine ? `<div style="height:1px;background:var(--gray-200);"></div>` : '';

        footerHtml = fd.length
            ? `<div style="display:grid;grid-template-columns:repeat(${fd.length},1fr);min-height:40px;align-items:center;padding:8px ${mr}px;background:var(--gray-50);">${fd.map(s => fdRenderTemplateSection(s)).join('')}</div>`
            : `<div style="padding:10px ${mr}px;background:var(--gray-50);color:var(--gray-300);font-size:11px;text-align:center;font-style:normal;">${esc(tpl.name)}</div>`;
    } else {
        headerHtml = `<div style="background:var(--sa-800);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;font-weight:700;color:#fff;font-style:normal;"><i class="bi bi-file-earmark-richtext" style="margin-left:6px;"></i>${esc(formName)}</span>
            <span style="font-size:11px;color:rgba(255,255,255,.4);">لم يُحدَّد قالب</span>
        </div>`;
        footerHtml = `<div style="background:var(--gray-100);padding:10px 24px;border-top:1px solid var(--gray-200);font-size:11px;color:var(--gray-400);text-align:center;font-style:normal;">تذييل النموذج</div>`;
    }

    return `<div style="border:2px solid var(--gray-200);border-radius:12px;overflow:hidden;font-style:normal;direction:rtl;background:#fff;">
        ${headerHtml}${headerLineHtml}
        <div style="background:#fff;padding:${mt}px ${mr}px ${mb}px ${ml}px;direction:${pageDir};font-style:normal;">
            <div style="margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--gray-100);">
                <h5 style="font-size:17px;font-weight:800;color:var(--sa-800);margin:0 0 4px;font-style:normal;">${esc(formName)}</h5>
                ${formDesc ? `<p style="font-size:13px;color:var(--gray-500);margin:0;font-style:normal;">${esc(formDesc)}</p>` : ''}
            </div>
            ${fieldsHtml}
        </div>
        ${footerLineHtml}${footerHtml}
    </div>`;
}

// ─── STEP 3 HTML (preview) — uses shared helper ───────────────────────────────
function fdStep3Html() {
    const fName = (fdStep1State?.name || '').trim() || 'اسم النموذج';
    const fDesc = (fdStep1State?.desc || '').trim() || '';
    return fdBuildFormPreview(fdCurrentTemplate, fName, fDesc, fdFields, true);
}

// ─── STEP NAVIGATION ─────────────────────────────────────────────────────────
function fdGoStep2() {
    const s = fdCollect1();
    if (!s.name) return showToast('اسم النموذج مطلوب','error');
    if (!s.catId) return showToast('التصنيف مطلوب','error');
    if (!s.typeId) return showToast('نوع النموذج مطلوب','error');
    if (!s.wsId) return showToast('مساحة العمل مطلوبة','error');
    if (!s.tplId) return showToast('القالب مطلوب','error');
    fdStep1State = s;
    fdStep=2; fdRenderStep();
}

async function fdGoStep3() {
    // Fetch actual template data for the real header/footer preview
    const tplId = parseInt(fdStep1State?.tplId || '0');
    fdCurrentTemplate = null;
    if (tplId > 0) {
        try {
            const res = await apiFetch(`/FormDefinitions/GetTemplateForPreview?id=${tplId}`);
            if (res && res.success) fdCurrentTemplate = res.data;
        } catch {}
    }
    fdStep = 3;
    fdRenderStep();
}
function fdGoStepBack(from) { fdStep=from-1; fdRenderStep(); }

// ─── STEP 2 – FIELD BUILDER LOGIC ─────────────────────────────────────────────
function fdOnFieldTypeChange() {
    const type = document.getElementById('fdFieldType')?.value;
    const area  = document.getElementById('fdPropsArea');
    const cont  = document.getElementById('fdPropsFields');
    const cell  = document.getElementById('fdPropsCell');
    if (!type||!FD_FIELD_TYPES[type]) {
        if(area) area.style.display='none';
        if(cont) cont.innerHTML='';
        if(cell) cell.innerHTML='';
        return;
    }
    const def = FD_FIELD_TYPES[type];
    if(area) area.style.display='block';
    if(cell) cell.innerHTML=`<span style="font-size:11px;color:var(--sa-600);"><i class="bi bi-check-circle-fill"></i> ${def.props.length} خاصية</span>`;
    let html='', cbStarted=false;
    def.props.forEach(p => {
        if(p.type==='checkbox'&&!cbStarted){ cbStarted=true; html+=`<div class="col-12"><hr style="border-color:var(--gray-200);margin:8px 0 4px;"><div style="font-size:11px;font-weight:700;color:var(--gray-400);margin-bottom:6px;"><i class="bi bi-toggles"></i> خيارات التفعيل</div></div>`; }
        html += fdBuildSinglePropHtml(p,'fdProp');
    });
    if(cont) cont.innerHTML = html;
    fdApplyPropsSpecialEditors(type,'fdProp',null);
    if(type==='رقم الهاتف'){ const el=document.getElementById('fdProp_phoneFormat'); if(el&&!el.value) el.value='+966 (9 أرقام)'; }
    const tipEl = document.getElementById('fdFieldTooltip');
    if(tipEl&&!tipEl.value){ const d={'الاسم الكامل':'أدخل الاسم الكامل','البريد الإلكتروني':'أدخل البريد الإلكتروني','رقم الهاتف':'أدخل رقم الهاتف','نص قصير':'أدخل النص','نص طويل':'أدخل النص','فقرة':'أدخل الفقرة','رقم':'أدخل الرقم','قائمة منسدلة':'اختر من القائمة','قائمة اختيار الواحد':'اختر خياراً','قائمة اختيار متعدد':'اختر خياراً أو أكثر','تاريخ':'اختر التاريخ','وقت':'اختر الوقت','رفع ملف':'ارفع ملفاً','دوار رقمي':'حدد الرقم','التقييم بالنجوم':'حدد التقييم','التقييم بالأرقام':'حدد التقييم'}; tipEl.value=d[type]||'أدخل قيمة الحقل'; }
}

function fdCollectFieldProps() {
    const type = document.getElementById('fdFieldType')?.value;
    if(!type||!FD_FIELD_TYPES[type]) return {};
    const def=FD_FIELD_TYPES[type], result={};
    def.props.forEach(p => {
        if(p.type==='optionList'||p.type==='fileTypesPick') return;
        if(p.type==='fileMbLimitsPair'){ const mn=document.getElementById('fdProp_minFileSize'); const mx=document.getElementById('fdProp_maxFileSize'); if(mn) result.minFileSize=mn.value; if(mx) result.maxFileSize=mx.value; return; }
        const el=document.getElementById(`fdProp_${p.key}`); if(!el) return;
        result[p.key] = p.type==='checkbox' ? el.checked : el.value;
    });
    return fdMergeSpecialProps(type,'fdProp',result);
}

function fdSetFieldProps(type, po) {
    if(!type||!FD_FIELD_TYPES[type]) return;
    const def=FD_FIELD_TYPES[type]; po=po||{};
    def.props.forEach(p => {
        if(p.type==='optionList'||p.type==='fileTypesPick') return;
        if(p.type==='fileMbLimitsPair'){ const mn=document.getElementById('fdProp_minFileSize'); const mx=document.getElementById('fdProp_maxFileSize'); if(mn&&po.minFileSize!=null) mn.value=po.minFileSize; if(mx&&po.maxFileSize!=null) mx.value=po.maxFileSize; return; }
        const el=document.getElementById(`fdProp_${p.key}`); if(!el) return;
        const v=po[p.key];
        if(p.type==='checkbox') el.checked=!!v; else if(v!=null) el.value=v;
    });
    fdApplyPropsSpecialEditors(type,'fdProp',po);
}

function fdAddField() {
    const type = document.getElementById('fdFieldType')?.value;
    const name = document.getElementById('fdFieldName')?.value?.trim();
    if(!type) return showToast('يرجى اختيار نوع الحقل','error');
    if(!name) return showToast('يرجى إدخال اسم الحقل','error');
    const def = FD_FIELD_TYPES[type];
    if(def?.props.some(p=>p.type==='optionList')){ const o=fdCollectOptionListFromEditor('fdProp'); if(!o||!String(o.options||'').trim()) return showToast('يرجى إدخال خيار واحد على الأقل','error'); }
    const props = fdCollectFieldProps();
    const field = { id: fdEditingIdx>=0 ? fdFields[fdEditingIdx].id : Date.now(), fieldType:type, fieldName:name, isRequired:document.getElementById('fdFieldRequired')?.value==='1', subName:props.subName||'', placeholder:props.placeholder||'', tooltipText:document.getElementById('fdFieldTooltip')?.value?.trim()||'', sortOrder:0, propertiesJson:JSON.stringify(props) };
    if(fdEditingIdx>=0){ fdFields[fdEditingIdx]=field; showToast('تم تحديث الحقل','success'); fdEditingIdx=-1; }
    else { fdFields.push(field); showToast('تم إضافة الحقل','success'); }
    fdRenderFieldsTable(); fdResetFieldForm();
}

function fdEditField(idx) {
    const f=fdFields[idx]; if(!f) return;
    fdEditingIdx=idx;
    document.getElementById('fdFieldType').value=f.fieldType;
    document.getElementById('fdFieldName').value=f.fieldName;
    document.getElementById('fdFieldRequired').value=f.isRequired?'1':'0';
    document.getElementById('fdFieldTooltip').value=f.tooltipText||'';
    document.getElementById('fdFieldNum').textContent=String(idx+1);
    document.getElementById('fdFieldFormLabel').textContent='تعديل حقل رقم';
    document.getElementById('fdAddFieldBtnTxt').textContent='تحديث الحقل';
    document.getElementById('fdCancelEditBtn').style.display='';
    fdOnFieldTypeChange();
    try { fdSetFieldProps(f.fieldType,JSON.parse(f.propertiesJson||'{}')); } catch(e) {}
    document.getElementById('fdPropsArea')?.scrollIntoView({behavior:'smooth'});
}

function fdDeleteField(idx) {
    fdFields.splice(idx,1);
    if(fdEditingIdx===idx) fdResetFieldForm(); else if(fdEditingIdx>idx) fdEditingIdx--;
    fdRenderFieldsTable(); fdResetFieldForm();
}

function fdRenderFieldsTable() {
    const body=document.getElementById('fdFieldsBody');
    const badge=document.getElementById('fdFieldsCountBadge');
    if(badge) badge.textContent=`${fdFields.length} حقل`;
    const num=document.getElementById('fdFieldNum');
    if(num) num.textContent=String(fdEditingIdx>=0?fdEditingIdx+1:fdFields.length+1);
    if(!body) return;
    if(!fdFields.length){ body.innerHTML='<tr><td colspan="7" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>'; return; }
    body.innerHTML = fdFields.map((f,i) => {
        const req=f.isRequired?'<span class="fd-field-req">نعم</span>':'<span style="font-size:11px;color:var(--gray-400);">لا</span>';
        const props=fdGetPropsSummary(f);
        return `<tr>
            <td>${i+1}</td>
            <td><span class="fd-field-type">${esc(f.fieldType)}</span></td>
            <td style="font-weight:600;">${esc(f.fieldName)}</td>
            <td style="text-align:center;">${req}</td>
            <td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${fdEscAttr(props)}">${esc(props)}</td>
            <td style="font-size:12px;color:var(--gray-500);">${esc(f.tooltipText||'-')}</td>
            <td style="white-space:nowrap;">
                <button class="fd-action-btn fd-action-btn-edit" onclick="fdEditField(${i})" style="padding:3px 8px;font-size:10px;"><i class="bi bi-pencil"></i></button>
                <button class="fd-action-btn fd-action-btn-delete" onclick="fdDeleteField(${i})" style="padding:3px 8px;font-size:10px;"><i class="bi bi-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function fdResetFieldForm() {
    const fn=document.getElementById('fdFieldNum'); if(fn) fn.textContent=String(fdFields.length+1);
    const lbl=document.getElementById('fdFieldFormLabel'); if(lbl) lbl.textContent='إضافة حقل رقم';
    const ft=document.getElementById('fdFieldType'); if(ft) ft.value='';
    const fname=document.getElementById('fdFieldName'); if(fname) fname.value='';
    const req=document.getElementById('fdFieldRequired'); if(req) req.value='1';
    const tip=document.getElementById('fdFieldTooltip'); if(tip) tip.value='';
    const area=document.getElementById('fdPropsArea'); if(area) area.style.display='none';
    const flds=document.getElementById('fdPropsFields'); if(flds) flds.innerHTML='';
    const cell=document.getElementById('fdPropsCell'); if(cell) cell.innerHTML='';
    const btnTxt=document.getElementById('fdAddFieldBtnTxt'); if(btnTxt) btnTxt.textContent='إضافة الحقل';
    const cancelBtn=document.getElementById('fdCancelEditBtn'); if(cancelBtn) cancelBtn.style.display='none';
    fdEditingIdx=-1;
}

// ─── COLLECT STEP 1 DATA ──────────────────────────────────────────────────────
function fdCollect1() {
    return {
        name:     (document.getElementById('fdFName')?.value||'').trim(),
        desc:     (document.getElementById('fdFDesc')?.value||'').trim(),
        ownership: fdIsAdmin ? 'عام' : (document.getElementById('fdFOwnership')?.value||'عام'),
        catId:    parseInt(document.getElementById('fdFCat')?.value||'0'),
        typeId:   parseInt(document.getElementById('fdFType')?.value||'0'),
        wsId:     parseInt(document.getElementById('fdFWs')?.value||'0'),
        tplId:    parseInt(document.getElementById('fdFTpl')?.value||'0'),
    };
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────
async function fdSave(sendForApproval) {
    const s = fdStep1State && fdStep1State.name ? fdStep1State : fdCollect1();
    if (!s.name) return showToast('اسم النموذج مطلوب','error');
    const payload = { name:s.name, description:s.desc, ownership:s.ownership, categoryId:s.catId, formTypeId:s.typeId, workspaceId:s.wsId, templateId:s.tplId, fieldsJson:JSON.stringify(fdFields), sendForApproval };
    try {
        let res;
        if (fdEditId) { payload.id=fdEditId; res=await apiFetch('/FormDefinitions/UpdateFormDefinition','POST',payload); }
        else { res=await apiFetch('/FormDefinitions/AddFormDefinition','POST',payload); }
        if (res.success) {
            let okMsg = 'تم حفظ النموذج كمسودة';
            if (sendForApproval) okMsg = fdIsAdmin ? 'تم نشر النموذج بنجاح' : 'تم إرسال النموذج للاعتماد';
            showToast(okMsg,'success');
            fdWizModal().hide(); fdLoad();
        }
        else showToast(res.message||'خطأ في الحفظ','error');
    } catch { showToast('خطأ في الاتصال بالخادم','error'); }
}

// ─── SEND / APPROVE / REJECT / DELETE ────────────────────────────────────────
async function fdSendApproval(id) {
    if (!confirm('إرسال للاعتماد؟')) return;
    try { const r=await apiFetch('/FormDefinitions/SubmitForApproval','POST',{id}); if(r.success){showToast('تم الإرسال','success');fdLoad();} else showToast(r.message,'error'); } catch { showToast('خطأ','error'); }
}
async function fdApprove(id) {
    if (!confirm('اعتماد النموذج؟')) return;
    try {
        const r = await apiFetch('/FormDefinitions/ApproveFormDefinition','POST',{id});
        if (r.success) {
            showToast('تم اعتماد النموذج بنجاح. يمكنك الآن التحكم بتفعيله من عمود التفعيل.','success');
            fdLoad();
        } else showToast(r.message,'error');
    } catch { showToast('خطأ','error'); }
}
function fdShowReject(id,name) { fdRejectId=id; document.getElementById('fdRejectSub').textContent=`النموذج: ${name}`; document.getElementById('fdRejectReason').value=''; fdRejModal().show(); }
async function fdSubmitReject() {
    const reason=document.getElementById('fdRejectReason')?.value?.trim();
    if(!reason) return showToast('سبب الرفض مطلوب','error');
    try { const r=await apiFetch('/FormDefinitions/RejectFormDefinition','POST',{id:fdRejectId,reason}); if(r.success){showToast('تم الرفض','success');fdRejModal().hide();fdLoad();} else showToast(r.message,'error'); } catch { showToast('خطأ','error'); }
}
function fdShowDelete(id,name) { fdDeleteId=id; document.getElementById('fdDeleteName').textContent=name; fdDelModal().show(); }
async function fdSubmitDelete() {
    try { const r=await apiFetch('/FormDefinitions/DeleteFormDefinition','POST',{id:fdDeleteId}); if(r.success){showToast('تم الحذف','success');fdDelModal().hide();fdLoad();} else showToast(r.message,'error'); } catch { showToast('خطأ','error'); }
}

// ─── DETAILS ─────────────────────────────────────────────────────────────────
async function fdShowDetails(id) {
    try {
        const res = await apiFetch(`/FormDefinitions/GetFormDefinition?id=${id}`);
        if (!res.success) return showToast(res.message, 'error');
        const d = res.data;

        // Parse saved fields
        let fields = [];
        try { fields = JSON.parse(d.fieldsJson || '[]'); } catch {}

        // Template data comes embedded in the response
        const tplData = d.templateData || null;

        // ── info section ────────────────────────────────────────────────────
        const activeBadge = d.isActive
            ? '<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle-fill"></i> مفعّل</span>'
            : '<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-dash-circle"></i> معطّل</span>';

        let html = `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> معلومات النموذج</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">اسم النموذج</span><span class="fd-detail-val" style="font-weight:700;">${esc(d.name)}</span>
                <span class="fd-detail-lbl">الحالة</span><span class="fd-detail-val">${fdStatusBadge(d.status)}</span>
                <span class="fd-detail-lbl">التفعيل</span><span class="fd-detail-val">${activeBadge}</span>
                <span class="fd-detail-lbl">الملكية</span><span class="fd-detail-val">${fdOwnershipBadge(d.ownership)}</span>
                <span class="fd-detail-lbl">التصنيف</span><span class="fd-detail-val">${esc(d.categoryName)}</span>
                <span class="fd-detail-lbl">النوع</span><span class="fd-detail-val">${esc(d.formTypeName)}</span>
                <span class="fd-detail-lbl">مساحة العمل</span><span class="fd-detail-val">${esc(d.workspaceName)}</span>
                <span class="fd-detail-lbl">القالب</span>
                <span class="fd-detail-val">
                    ${tplData ? `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:3px;background:${tplData.color};display:inline-block;"></span>${esc(tplData.name)}</span>` : (esc(d.templateName) || '<span style="color:var(--gray-400);">—</span>')}
                </span>
                <span class="fd-detail-lbl">الوحدة التنظيمية</span><span class="fd-detail-val">${esc(d.orgUnitName)}</span>
                ${d.description ? `<span class="fd-detail-lbl">الوصف</span><span class="fd-detail-val">${esc(d.description)}</span>` : ''}
            </div>
        </div>`;

        // ── audit section ────────────────────────────────────────────────────
        html += `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-clock-history"></i> معلومات التدقيق</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">أنشأه</span><span class="fd-detail-val">${esc(d.createdBy)}</span>
                <span class="fd-detail-lbl">تاريخ الإنشاء</span><span class="fd-detail-val">${esc(d.createdAt)}</span>
                ${d.approvedBy ? `<span class="fd-detail-lbl">اعتمده</span><span class="fd-detail-val">${esc(d.approvedBy)}</span><span class="fd-detail-lbl">تاريخ الاعتماد</span><span class="fd-detail-val">${esc(d.approvedAt || '')}</span>` : ''}
                ${d.rejectionReason ? `<span class="fd-detail-lbl" style="color:var(--error-600);">سبب الرفض</span><span class="fd-detail-val" style="color:var(--error-700);">${esc(d.rejectionReason)}</span>` : ''}
            </div>
        </div>`;

        // ── full form preview (template header + body + footer) ──────────────
        html += `<div class="fd-section" style="padding:18px 20px;">
            <div class="fd-section-title"><i class="bi bi-eye-fill"></i> معاينة النموذج <span style="font-size:11px;font-weight:400;color:var(--gray-400);">(القالب + الحقول)</span></div>
            ${fdBuildFormPreview(tplData, d.name, d.description, fields, false)}
        </div>`;

        document.getElementById('fdDetailsBody').innerHTML = html;
        fdDetModal().show();
    } catch(e) {
        showToast('خطأ في تحميل التفاصيل', 'error');
    }
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function esc(s) { if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
