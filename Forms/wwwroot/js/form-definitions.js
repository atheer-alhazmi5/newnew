'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
let fdData          = [];
let fdLookups       = { formClasses:[], formTypes:[], workspaces:[], templates:[] };
let fdIsAdmin       = false;
let fdStep          = 1;
let fdEditId        = null;
let fdRejectId      = null;
let fdDeleteId      = null;
let fdFields        = [];          // working field list
let fdEditingIdx    = -1;          // -1 = adding, >= 0 = editing field at idx
let fdCurrentTemplate = null;     // fetched template data for step-3 preview
let fdStep1State    = null;        // persisted step-1 data across wizard steps
let fdBindingLookups = { readyTables: [], dropdownLists: [] };
let fdBindingLookupsLoaded = false;
let fdDropdownItemsCache = {};
let fdReadyTableGridCache = {};

// Form sections (groupings of fields inside a single form definition)
let fdSections = [{ id: 1, title: 'القسم الأول' }];
let fdActiveSectionId = 1;
let fdSectionSeq = 2;

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
        { key:"dropdownListId", label:"قائمة المنسدلة ", type:"dropdownListPick" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text", placeholder:"اختر خياراً" },
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
    ]},
    "جدول بيانات": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"readyTableId", label:"جدول بيانات ", type:"readyTablePick" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "شبكة خيارات متعددة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"rowLabels", label:"صفوف الشبكة (سطر لكل صف)", type:"textarea", rows:5, placeholder:"صف 1", hint:"اختيار واحد لكل صف." },
        { key:"options", label:"عناوين الأعمدة (خيار لكل عمود)", type:"optionList", choiceMode:"single" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "شبكة مربعات اختيار": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"rowLabels", label:"صفوف الشبكة (سطر لكل صف)", type:"textarea", rows:5, placeholder:"صف 1", hint:"يمكن تحديد أكثر من خانة." },
        { key:"options", label:"عناوين الأعمدة", type:"optionList", choiceMode:"single" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "عنوان": { props: [
        { key:"fontSize", label:"حجم الخط (px)", type:"number", placeholder:"18" },
        { key:"fontColor", label:"لون الخط", type:"color" },
        { key:"textAlign", label:"المحاذاة", type:"select", options:["يمين","وسط","يسار"] },
        { key:"bold", label:"غامق", type:"checkbox" }
    ]},
    "خط فاصل": { props: [
        { key:"lineStyle", label:"نمط الخط", type:"select", options:["صلب","منقط","متقطع"] },
        { key:"lineColor", label:"اللون", type:"color" },
        { key:"lineThickness", label:"السماكة (px)", type:"number", placeholder:"1" }
    ]},
    "عملة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"currency", label:"العملة", type:"select", options:["ر.س","$","€","£","د.إ","د.ك","د.ب","د.أ","ج.م"] },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minValue", label:"الحد الأدنى", type:"number" },
        { key:"maxValue", label:"الحد الأقصى", type:"number" },
        { key:"decimals", label:"عدد الخانات العشرية", type:"number", placeholder:"2" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "تأشير": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"mode", label:"النمط الافتراضي", type:"select", options:["مرفق","التوقيع بالقلم"] },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"360" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ]},
    "توقيع": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"mode", label:"النمط الافتراضي", type:"select", options:["مرفق","التوقيع بالقلم"] },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"360" },
        { key:"heightPx", label:"ارتفاع لوحة التوقيع (px)", type:"number", placeholder:"120" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
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

async function fdEnsureFieldBindingLookups() {
    if (fdBindingLookupsLoaded) return;
    try {
        const res = await apiFetch('/FormDefinitions/GetFieldBindingLookups');
        if (res && res.success) {
            fdBindingLookups.readyTables = res.readyTables || [];
            fdBindingLookups.dropdownLists = res.dropdownLists || [];
            fdBindingLookupsLoaded = true;
        }
    } catch (e) {
        console.error('fdEnsureFieldBindingLookups', e);
    }
}

async function fdFetchDropdownItemsForField(listId) {
    const id = parseInt(listId, 10);
    if (!id || fdDropdownItemsCache[id]) return;
    try {
        const res = await apiFetch(`/FormDefinitions/GetDropdownListItemsForField?id=${id}`);
        if (res && res.success && Array.isArray(res.items)) fdDropdownItemsCache[id] = res.items;
        else fdDropdownItemsCache[id] = [];
    } catch {
        fdDropdownItemsCache[id] = [];
    }
}

async function fdFetchReadyTableGridForField(tableId) {
    const id = parseInt(tableId, 10);
    if (!id || fdReadyTableGridCache[id]) return;
    try {
        const res = await apiFetch(`/FormDefinitions/GetReadyTableForField?id=${id}`);
        if (res && res.success) fdReadyTableGridCache[id] = res;
        else fdReadyTableGridCache[id] = null;
    } catch {
        fdReadyTableGridCache[id] = null;
    }
}

function fdWireBindingPropListeners(type) {
    const dl = document.getElementById('fdProp_dropdownListId');
    if (dl) {
        dl.onchange = () => {
            const v = parseInt(dl.value, 10) || 0;
            if (v) fdFetchDropdownItemsForField(v);
        };
    }
    const rt = document.getElementById('fdProp_readyTableId');
    if (rt) {
        rt.onchange = () => {
            const v = parseInt(rt.value, 10) || 0;
            if (v) fdFetchReadyTableGridForField(v);
        };
    }
}

function fdInitOptionListEditor(pfx, mode, propsObj, propKey) {
    propKey = propKey || 'options';
    const el = document.getElementById(pfx + '_' + propKey + '_options_editor');
    if (!el) return;
    el.innerHTML = ''; el.setAttribute('data-mode', mode);
    const rowsHost = document.createElement('div'); rowsHost.className = 'rtc-opt-rows';
    const po = propsObj || {};
    const raw = (po[propKey] != null && String(po[propKey]).trim() !== '') ? po[propKey] : (propKey === 'options' ? po.options : '');
    let lines = [''], defStr = '';
    if (raw && String(raw).trim()) {
        lines = String(raw).split(/[\r\n]+/).map(s => s.trim()).filter(Boolean);
        if (!lines.length) lines = [''];
        defStr = (po.defaultOption || '').trim();
    }
    const defMulti = mode === 'multi' ? defStr.split(/,\s*/).map(s => s.trim()).filter(Boolean) : [];
    lines.forEach(t => rowsHost.appendChild(fdCreateOptionRow(pfx, mode, t, defStr, defMulti, propKey)));
    el.appendChild(rowsHost);
    const btn = document.createElement('button'); btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-primary mt-2';
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> إضافة خيار';
    btn.onclick = () => rowsHost.appendChild(fdCreateOptionRow(pfx, mode, '', '', [], propKey));
    el.appendChild(btn);
}

function fdCreateOptionRow(pfx, mode, text, defSingle, defMultiArr, propKey) {
    propKey = propKey || 'options';
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
        const r = document.createElement('input'); r.type = 'radio'; r.name = pfx + '_' + propKey + '_defaultOpt';
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

function fdCollectOptionListFromEditor(pfx, propKey) {
    propKey = propKey || 'options';
    const el = document.getElementById(pfx + '_' + propKey + '_options_editor');
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
    def.props.forEach(p => {
        if (p.type !== 'optionList') return;
        const o = fdCollectOptionListFromEditor(pfx, p.key);
        if (!o) return;
        result[p.key] = o.options;
        if (p.choiceMode === 'multi') result.defaultOption = o.defaultOption;
        else if (p.key === 'options') result.defaultOption = o.defaultOption;
    });
    if (def.props.some(p => p.type === 'fileTypesPick')) result.fileTypes = fdCollectFileTypesPick(pfx);
    return result;
}

function fdApplyPropsSpecialEditors(type, pfx, po) {
    const def = FD_FIELD_TYPES[type]; if (!def) return;
    def.props.forEach(p => { if (p.type === 'optionList') fdInitOptionListEditor(pfx, p.choiceMode||'single', po||{}, p.key); });
    fdApplyFileTypesFromProps(pfx, po||{});
}

function fdBuildSinglePropHtml(p, pfx) {
    if (p.type === 'dropdownListPick') {
        const opts = fdBindingLookups.dropdownLists || [];
        let h = `<div class="col-12 mb-3"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label} <span class="required-star">*</span></label>
     
        <select class="form-select form-select-sm" id="fdProp_dropdownListId" style="border-radius:8px;font-size:12.5px;">
        <option value="">-- اختر قائمة منسدلة --</option>`;
        opts.forEach(o => {
            const id = o.id ?? o.Id;
            const nm = o.name ?? o.Name ?? '';
            h += `<option value="${id}">${esc(nm)}</option>`;
        });
        return h + '</select></div>';
    }
    if (p.type === 'readyTablePick') {
        const opts = fdBindingLookups.readyTables || [];
        let h = `<div class="col-12 mb-3"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label} <span class="required-star">*</span></label>
        
        <select class="form-select form-select-sm" id="fdProp_readyTableId" style="border-radius:8px;font-size:12.5px;">
        <option value="">-- اختر جدول جاهز --</option>`;
        opts.forEach(o => {
            const id = o.id ?? o.Id;
            const nm = o.name ?? o.Name ?? '';
            h += `<option value="${id}">${esc(nm)}</option>`;
        });
        return h + '</select></div>';
    }
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
        <div id="${pfx}_${p.key}_options_editor" class="border rounded-3 p-3" style="background:#fafafa;" data-mode="${p.choiceMode||'single'}"></div></div>`;
    }
    if (p.type === 'textarea') {
        const fid = `${pfx}_${p.key}`;
        const hint = p.hint ? `<p class="text-muted small mb-2" style="font-size:11px;">${p.hint}</p>` : '';
        return `<div class="col-12 mb-3"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label}</label>
        ${hint}
        <textarea class="form-control form-control-sm" id="${fid}" rows="${p.rows||4}" placeholder="${fdEscAttr(p.placeholder||'')}" style="border-radius:8px;font-size:12.5px;"></textarea></div>`;
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

function fdParseLines(s) {
    if (s == null || s === '') return [];
    return String(s).split(/[\r\n]+/).map(x => x.trim()).filter(Boolean);
}

// ─── FIELD INPUT BUILDER (for step-3 preview) ─────────────────────────────────
function fdBuildFieldInput(f, opt) {
    const ph = ((f.placeholder||'') || (f.tooltipText||'')).replace(/"/g,'&quot;');
    let props = {};
    try { props = JSON.parse(f.propertiesJson||'{}'); } catch(e) {}
    if (opt && opt.forceReadOnly) props.readOnly = true;
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
        let opts = [];
        if (f.fieldType === 'قائمة منسدلة' && props.dropdownListId) {
            opts = fdDropdownItemsCache[props.dropdownListId] || [];
        }
        if (!opts.length && props.options) opts = String(props.options).split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
        const def  = (props.defaultOption||'').trim();
        inp = `<select class="form-select"${reqAttr}${roSel}${ttAttr}${mk()}><option value="">${(props.emptyText||ph||'اختر...').replace(/</g,'&lt;')}</option>`;
        opts.forEach(o => { inp += `<option value="${o.replace(/"/g,'&quot;')}"${o===def?' selected':''}>${o.replace(/</g,'&lt;')}</option>`; });
        if (f.fieldType === 'قائمة منسدلة' && props.dropdownListId && !opts.length) inp += '<option disabled>— لم تُحمَّل عناصر القائمة —</option>';
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
    } else if (f.fieldType==='جدول بيانات') {
        let cols = [];
        let rows = [];
        if (props.readyTableId && fdReadyTableGridCache[props.readyTableId]) {
            const g = fdReadyTableGridCache[props.readyTableId];
            cols = (g.columns || []).slice();
            const maxR = (g.rowCountMode === 'مقيد' && g.maxRows) ? parseInt(g.maxRows, 10) : 3;
            const n = Math.min(Math.max(maxR > 0 ? maxR : 3, 1), 50);
            rows = Array.from({ length: n }, (_, i) => `صف ${i + 1}`);
        } else {
            cols = fdParseLines(props.options);
            rows = fdParseLines(props.rowLabels);
        }
        const c = cols.length ? cols : ['عمود'];
        const r = rows.length ? rows : ['صف'];
        const ro = props.readOnly ? ' readonly' : '';
        let t = `<div class="table-responsive"${ttAttr}><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><thead><tr><th></th>`;
        c.forEach(h => { t += `<th>${esc(h)}</th>`; });
        t += '</tr></thead><tbody>';
        r.forEach((rn) => {
            t += `<tr><th scope="row" style="white-space:nowrap;background:var(--gray-50);">${esc(rn)}</th>`;
            c.forEach(() => { t += `<td><input type="text" class="form-control form-control-sm"${ro}${reqAttr}></td>`; });
            t += '</tr>';
        });
        t += '</tbody></table></div>';
        inp = t;
    } else if (f.fieldType==='شبكة خيارات متعددة') {
        const cols = fdParseLines(props.options);
        const rows = fdParseLines(props.rowLabels);
        const c = cols.length ? cols : ['خيار'];
        const r = rows.length ? rows : ['صف'];
        const gridName = 'fd_gr_' + (f.id || 'n') + '_' + (f.fieldName||'').replace(/\s/g,'_');
        const dis = props.readOnly ? ' disabled' : '';
        let t = `<div class="table-responsive"${ttAttr}><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><thead><tr><th></th>`;
        c.forEach(h => { t += `<th class="text-center">${esc(h)}</th>`; });
        t += '</tr></thead><tbody>';
        r.forEach((rn, ri) => {
            t += `<tr><th scope="row" style="background:var(--gray-50);">${esc(rn)}</th>`;
            c.forEach(() => { t += `<td class="text-center"><input type="radio" class="form-check-input" name="${gridName}_r${ri}"${dis}></td>`; });
            t += '</tr>';
        });
        t += '</tbody></table></div>';
        inp = t;
    } else if (f.fieldType==='شبكة مربعات اختيار') {
        const cols = fdParseLines(props.options);
        const rows = fdParseLines(props.rowLabels);
        const c = cols.length ? cols : ['عمود'];
        const r = rows.length ? rows : ['صف'];
        const dis = props.readOnly ? ' disabled' : '';
        let t = `<div class="table-responsive"${ttAttr}><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><thead><tr><th></th>`;
        c.forEach(h => { t += `<th class="text-center">${esc(h)}</th>`; });
        t += '</tr></thead><tbody>';
        r.forEach((rn) => {
            t += `<tr><th scope="row" style="background:var(--gray-50);">${esc(rn)}</th>`;
            c.forEach(() => { t += `<td class="text-center"><input type="checkbox" class="form-check-input"${dis}></td>`; });
            t += '</tr>';
        });
        t += '</tbody></table></div>';
        inp = t;
    } else if (f.fieldType==='عنوان') {
        const fs = parseInt(props.fontSize, 10) || 18;
        const col = props.fontColor || '#0f172a';
        const alignMap = { 'يمين':'right', 'يسار':'left', 'وسط':'center' };
        const al = alignMap[props.textAlign] || 'right';
        const bld = props.bold ? '800' : '700';
        inp = `<div style="font-size:${fs}px;font-weight:${bld};color:${col};text-align:${al};padding:6px 0;"${ttAttr}>${esc(f.fieldName || '')}</div>`;
    } else if (f.fieldType==='خط فاصل') {
        const styleMap = { 'منقط':'dotted','متقطع':'dashed','صلب':'solid' };
        const ls = styleMap[props.lineStyle] || 'solid';
        const lc = props.lineColor || '#94a3b8';
        const lt = parseInt(props.lineThickness, 10) || 1;
        inp = `<hr style="border:none;border-top:${lt}px ${ls} ${lc};margin:8px 0;"${ttAttr}>`;
    } else if (f.fieldType==='عملة') {
        const cur = props.currency || 'ر.س';
        const dec = (props.decimals != null && props.decimals !== '') ? parseInt(props.decimals,10) : 2;
        const stepVal = dec > 0 ? (1 / Math.pow(10, dec)) : 1;
        const mn = props.minValue!=null&&props.minValue!==''?` min="${props.minValue}"`:'';
        const mx = props.maxValue!=null&&props.maxValue!==''?` max="${props.maxValue}"`:'';
        inp = `<div class="input-group"${ttAttr}${wStyle?` style="${wStyle}"`:''}><input type="number" class="form-control" placeholder="${ph||'0'}" value="${defVal}" step="${stepVal}"${mn}${mx}${reqAttr}${roAttr} style="text-align:left;direction:ltr;${roStyle}"><span class="input-group-text fw-bold" style="background:var(--sa-50);color:var(--sa-700);">${esc(cur)}</span></div>`;
    } else if (f.fieldType === 'تأشير' || f.fieldType === 'توقيع') {
        inp = fdBuildSignatureFieldHtml(f, props, reqAttr, roAttr, roSel, ttAttr);
    } else {
        inp = `<input type="text" class="form-control" placeholder="${ph}" value="${defVal}"${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
    }

    const sub = (f.subName||props.subName||'').trim();
    if (sub) inp += `<div class="text-muted mt-1" style="font-size:11px;">${sub.replace(/</g,'&lt;')}</div>`;
    return inp;
}

function fdSpinInc(btn) { const i=btn.parentElement.querySelector('input[type="number"]'); if(!i) return; const s=parseFloat(i.step)||1,m=i.max!==''?parseFloat(i.max):Infinity,v=parseFloat(i.value)||0; if(v+s<=m) i.value=+(v+s).toFixed(4); }
function fdSpinDec(btn) { const i=btn.parentElement.querySelector('input[type="number"]'); if(!i) return; const s=parseFloat(i.step)||1,m=i.min!==''?parseFloat(i.min):-Infinity,v=parseFloat(i.value)||0; if(v-s>=m) i.value=+(v-s).toFixed(4); }

// ─── SIGNATURE / APPROVAL FIELD (mirrors Beneficiary endorsement/signature) ──
function fdBuildSignatureFieldHtml(f, props, reqAttr, roAttr, roSel, ttAttr) {
    const isSig = f.fieldType === 'توقيع';
    const currentMode = props.mode || 'مرفق';
    const widthCss = props.widthPx ? `${parseInt(props.widthPx, 10)}px` : '100%';
    const canvasH = props.heightPx ? parseInt(props.heightPx, 10) : 120;
    const uid = 'fdSig_' + (f.id || Math.random().toString(36).slice(2, 8));
    const selId = uid + '_sel';
    const fileWrapId = uid + '_fileWrap';
    const canvasWrapId = uid + '_canvasWrap';
    const canvasId = uid + '_canvas';
    const previewId = uid + '_preview';
    const fileInputId = uid + '_fileInput';
    const showFile = currentMode === 'مرفق' ? 'block' : 'none';
    const showCanvas = currentMode === 'التوقيع بالقلم' ? 'block' : 'none';
    const fileLbl = isSig ? 'رفع ملف التوقيع' : 'رفع ملف التأشير';
    const canvasLbl = isSig ? 'التوقيع الإلكتروني' : 'التوقيع الإلكتروني للتأشير';
    return `<div class="fd-sig-field" style="max-width:${widthCss};" data-fd-sig-canvas="${canvasId}"${ttAttr}>
        <select class="form-select form-select-sm mb-2" id="${selId}" onchange="fdSigToggle('${uid}')"${roSel}>
            <option value="مرفق" ${currentMode==='مرفق'?'selected':''}>مرفق (صورة أو PDF)</option>
            <option value="التوقيع بالقلم" ${currentMode==='التوقيع بالقلم'?'selected':''}>التوقيع بالقلم</option>
        </select>
        <div id="${fileWrapId}" class="fd-sig-file-wrap" style="display:${showFile};">
            <label class="form-label small mb-1" style="color:var(--gray-600);font-weight:700;">${fileLbl}</label>
            <input type="file" class="form-control form-control-sm" id="${fileInputId}" accept="image/*,.pdf" onchange="fdSigFileChange(this,'${previewId}')"${roAttr}${reqAttr}>
            <div id="${previewId}" class="fd-sig-attach-preview-wrap mt-2" style="display:none;"></div>
        </div>
        <div id="${canvasWrapId}" class="fd-sig-canvas-section" style="display:${showCanvas};">
            <label class="form-label small mb-1" style="color:var(--gray-600);font-weight:700;">${canvasLbl}</label>
            <div class="fd-sig-canvas-wrap">
                <canvas class="fd-sig-canvas" id="${canvasId}" width="280" height="${canvasH}" data-fd-init-sig></canvas>
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="fdSigClearCanvas('${canvasId}')"><i class="bi bi-eraser"></i> مسح</button>
            </div>
        </div>
    </div>`;
}

function fdSigToggle(uid) {
    const sel = document.getElementById(uid + '_sel');
    const fileWrap = document.getElementById(uid + '_fileWrap');
    const canvasWrap = document.getElementById(uid + '_canvasWrap');
    const canvas = document.getElementById(uid + '_canvas');
    if (!sel || !fileWrap || !canvasWrap) return;
    if (sel.value === 'مرفق') {
        fileWrap.style.display = 'block';
        canvasWrap.style.display = 'none';
    } else {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'block';
        if (canvas) fdSigBindCanvas(canvas);
    }
}

function fdSigFileChange(input, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    const f = input.files && input.files[0];
    if (!f) { preview.innerHTML = ''; preview.style.display = 'none'; return; }
    const r = new FileReader();
    r.onload = function () {
        if ((f.type || '').indexOf('image') === 0) {
            preview.innerHTML = `<img src="${r.result}" class="fd-sig-attach-preview">`;
        } else {
            preview.innerHTML = `<span class="badge bg-secondary" style="font-size:12px;padding:6px 10px;"><i class="bi bi-file-earmark-pdf"></i> PDF</span>`;
        }
        preview.style.display = 'flex';
    };
    r.readAsDataURL(f);
}

function fdSigBindCanvas(canvas) {
    if (!canvas || canvas.dataset.fdSigReady === '1') return;
    canvas.dataset.fdSigReady = '1';
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    let drawing = false, lastX = 0, lastY = 0;
    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        const cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
    }
    function start(e) { e.preventDefault(); drawing = true; const p = getPos(e); lastX = p.x; lastY = p.y; }
    function draw(e) { if (!drawing) return; e.preventDefault(); const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); lastX = p.x; lastY = p.y; }
    function end(e) { e.preventDefault(); drawing = false; }
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseout', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
}

function fdSigClearCanvas(canvasId) {
    const c = document.getElementById(canvasId);
    if (!c) return;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

function fdInitDynamicWidgets(root) {
    (root || document).querySelectorAll('canvas[data-fd-init-sig]').forEach(fdSigBindCanvas);
}

// ─── SECTIONS HELPERS ──────────────────────────────────────────────────────
function fdDefaultSections() { return [{ id: 1, title: 'القسم الأول' }]; }

function fdParseFieldsJsonPayload(json) {
    const def = { sections: fdDefaultSections(), fields: [] };
    if (!json) return def;
    let p;
    try { p = JSON.parse(json); } catch { return def; }
    if (Array.isArray(p)) {
        p.forEach(f => { if (!f.sectionId) f.sectionId = 1; });
        return { sections: def.sections, fields: p };
    }
    if (p && typeof p === 'object') {
        const s = Array.isArray(p.sections) && p.sections.length
            ? p.sections.map((x, i) => ({ id: x.id || (i + 1), title: x.title || `القسم ${i + 1}` }))
            : def.sections;
        const fs = Array.isArray(p.fields) ? p.fields : [];
        const firstId = s[0].id;
        const valid = new Set(s.map(x => x.id));
        fs.forEach(f => { if (!f.sectionId || !valid.has(f.sectionId)) f.sectionId = firstId; });
        return { sections: s, fields: fs };
    }
    return def;
}

function fdSerializeFieldsJson() {
    return JSON.stringify({ sections: fdSections, fields: fdFields });
}

function fdResetSectionsState() {
    fdSections = fdDefaultSections();
    fdActiveSectionId = fdSections[0].id;
    fdSectionSeq = 2;
}

function fdApplyParsedFieldsData(parsed) {
    fdSections = (parsed.sections && parsed.sections.length) ? parsed.sections : fdDefaultSections();
    fdActiveSectionId = fdSections[0].id;
    const ids = fdSections.map(s => s.id);
    fdSectionSeq = (ids.length ? Math.max(...ids) : 0) + 1;
    fdFields = parsed.fields || [];
    fdFields.forEach((f, i) => { if (!f.id) f.id = i + 1; });
}

function fdSyncSectionFieldSelect() {
    const sel = document.getElementById('fdFieldSection');
    if (!sel) return;
    sel.innerHTML = fdSections.map(s => `<option value="${s.id}" ${s.id === fdActiveSectionId ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
}

function fdPromptSection(title, subtitle, initial, onOk) {
    const modalEl = document.getElementById('fdSectionPromptModal');
    if (!modalEl) { const v = (prompt(title, initial || '') || '').trim(); if (v) onOk(v); return; }
    document.getElementById('fdSectionPromptTitle').textContent = title;
    document.getElementById('fdSectionPromptSub').textContent = subtitle || 'حدّد اسم القسم';
    const input = document.getElementById('fdSectionPromptInput');
    input.value = initial || '';
    const okBtn = document.getElementById('fdSectionPromptOk');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    function cleanup() {
        okBtn.onclick = null;
        input.onkeydown = null;
        modalEl.removeEventListener('hidden.bs.modal', cleanup);
    }
    function commit() {
        const v = (input.value || '').trim();
        if (!v) { input.focus(); input.classList.add('is-invalid'); setTimeout(() => input.classList.remove('is-invalid'), 800); return; }
        cleanup();
        modal.hide();
        onOk(v);
    }
    okBtn.onclick = commit;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } };
    modalEl.addEventListener('shown.bs.modal', () => { input.focus(); input.select(); }, { once: true });
    modalEl.addEventListener('hidden.bs.modal', cleanup);
    modal.show();
}

function fdAddSection() {
    const defaultTitle = `القسم ${fdSections.length + 1}`;
    fdPromptSection('إضافة قسم جديد', 'أدخل اسم القسم الجديد', defaultTitle, (title) => {
        const id = fdSectionSeq++;
        fdSections.push({ id, title });
        fdActiveSectionId = id;
        fdRenderSectionsBar();
        fdRenderFieldsTable();
        fdSyncSectionFieldSelect();
    });
}

function fdRenameSection(id) {
    const s = fdSections.find(x => x.id === id);
    if (!s) return;
    fdPromptSection('إعادة تسمية القسم', `القسم الحالي: ${s.title}`, s.title, (title) => {
        s.title = title;
        fdRenderSectionsBar();
        fdRenderFieldsTable();
        fdSyncSectionFieldSelect();
    });
}

function fdDeleteSection(id) {
    if (fdSections.length <= 1) {
        if (typeof showToast === 'function') showToast('لا يمكن حذف القسم الوحيد', 'error');
        return;
    }
    const s = fdSections.find(x => x.id === id);
    if (!s) return;
    const fieldsInside = fdFields.filter(f => f.sectionId === id).length;
    const modalEl = document.getElementById('fdSectionDeleteModal');
    const nameEl = document.getElementById('fdSectionDeleteName');
    const noteEl = document.getElementById('fdSectionDeleteNote');
    const okBtn = document.getElementById('fdSectionDeleteOk');
    if (!modalEl || !nameEl || !okBtn) {
        if (!confirm(fieldsInside ? `سيتم نقل ${fieldsInside} حقل إلى القسم السابق. هل أنت متأكد؟` : 'هل أنت متأكد من حذف هذا القسم؟')) return;
        fdApplySectionDelete(id);
        return;
    }
    nameEl.textContent = s.title;
    if (noteEl) noteEl.textContent = fieldsInside ? `سيتم نقل ${fieldsInside} حقل إلى القسم السابق.` : 'القسم لا يحتوي أي حقول.';
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    function cleanup() { okBtn.onclick = null; modalEl.removeEventListener('hidden.bs.modal', cleanup); }
    okBtn.onclick = () => {
        cleanup();
        modal.hide();
        fdApplySectionDelete(id);
    };
    modalEl.addEventListener('hidden.bs.modal', cleanup);
    modal.show();
}

function fdApplySectionDelete(id) {
    const idx = fdSections.findIndex(x => x.id === id);
    if (idx < 0) return;
    const targetId = fdSections[idx === 0 ? 1 : idx - 1].id;
    fdFields.forEach(f => { if (f.sectionId === id) f.sectionId = targetId; });
    fdSections.splice(idx, 1);
    if (fdActiveSectionId === id) fdActiveSectionId = targetId;
    fdRenderSectionsBar();
    fdRenderFieldsTable();
    fdSyncSectionFieldSelect();
}

function fdSelectSection(id) {
    fdActiveSectionId = id;
    fdRenderSectionsBar();
    const sel = document.getElementById('fdFieldSection');
    if (sel) sel.value = String(id);
}

function fdRenderSectionsBar() {
    const host = document.getElementById('fdSectionsBar');
    if (!host) return;
    const chips = fdSections.map(s => {
        const active = s.id === fdActiveSectionId;
        const cls = active ? 'fd-sec-chip active' : 'fd-sec-chip';
        const count = fdFields.filter(f => f.sectionId === s.id).length;
        return `<div class="${cls}" onclick="fdSelectSection(${s.id})">
            <span class="fd-sec-chip-title">${esc(s.title)}</span>
            <span class="fd-sec-chip-count">${count}</span>
            <button type="button" class="fd-sec-chip-btn" title="إعادة تسمية" onclick="event.stopPropagation();fdRenameSection(${s.id})"><i class="bi bi-pencil"></i></button>
            <button type="button" class="fd-sec-chip-btn fd-sec-chip-btn-del" title="حذف" onclick="event.stopPropagation();fdDeleteSection(${s.id})"><i class="bi bi-x-lg"></i></button>
        </div>`;
    }).join('');
    host.innerHTML = chips + `<button type="button" class="fd-sec-add-btn" onclick="fdAddSection()"><i class="bi bi-plus-lg"></i> إضافة قسم</button>`;
}
function fdStarClick(el,idx) { const w=el.closest('div'); if(!w) return; w.querySelectorAll('[data-i]').forEach(s=>{ s.style.color=parseInt(s.dataset.i)<=idx?'#f59e0b':'#d1d5db'; }); const l=w.querySelector('span:not([data-i])'); if(l) l.textContent=idx+'/'+(w.querySelectorAll('[data-i]').length); }

function fdGetPropsSummary(f) {
    try {
        const p = JSON.parse(f.propertiesJson||'{}'), parts=[], def=FD_FIELD_TYPES[f.fieldType];
        if (!def) return '-';
        if (f.fieldType === 'قائمة منسدلة' && p.dropdownListId) {
            const n = (fdBindingLookups.dropdownLists || []).find(x => (x.id ?? x.Id) === p.dropdownListId);
            if (n) parts.push('قائمة: ' + (n.name ?? n.Name ?? ''));
            else parts.push('قائمة #' + p.dropdownListId);
        }
        if (f.fieldType === 'جدول بيانات' && p.readyTableId) {
            const n = (fdBindingLookups.readyTables || []).find(x => (x.id ?? x.Id) === p.readyTableId);
            if (n) parts.push('جدول: ' + (n.name ?? n.Name ?? ''));
            else parts.push('جدول #' + p.readyTableId);
        }
        for (const k in p) {
            if (p[k]===''||p[k]===false||p[k]===null||p[k]===undefined) continue;
            if (k==='subName'||k==='placeholder'||k==='dropdownListId'||k==='readyTableId') continue;
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
    if (catId)  p.set('formClassId',catId);
    if (typeId) p.set('typeId',typeId);
    try {
        const res = await apiFetch(`/FormDefinitions/GetFormDefinitions?${p}`);
        if (!res.success) return;
        fdData    = res.data||[];
        fdIsAdmin = res.isAdmin;
        fdLookups = { formClasses:res.formClasses||[], formTypes:res.formTypes||[], workspaces:res.workspaces||[], templates:res.templates||[] };
        fdFillFilters(); fdRenderTable();
    } catch(e) { console.error('fdLoad',e); }
}

function fdFillFilters() {
    const catSel  = document.getElementById('fdFilterCat');
    const typeSel = document.getElementById('fdFilterType');
    if (catSel && catSel.options.length<=1) fdLookups.formClasses.forEach(c=>catSel.add(new Option(c.name,c.id)));
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
            <td>${esc(f.formClassName)}</td>
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
    fdBindingLookupsLoaded = false;
    fdDropdownItemsCache = {};
    fdReadyTableGridCache = {};
    fdResetSectionsState();
    fdStep1State = { name:'', desc:'', ownership:'عام', formClassId:0, typeId:0, wsId:0, tplId:0 };
    document.getElementById('fdWizardTitle').textContent = 'إنشاء نموذج جديد';
    document.getElementById('fdWizardSub').textContent = 'أدخل بيانات النموذج الجديد';
    document.getElementById('fdWizardHead').className = 'fd-modal-header create';
    fdRenderStep(); fdWizModal().show();
}

async function fdShowEdit(id) {
    try {
        const res = await apiFetch(`/FormDefinitions/GetFormDefinition?id=${id}`);
        if (!res.success) return showToast(res.message, 'error');
        fdBindingLookupsLoaded = false;
        fdDropdownItemsCache = {};
        fdReadyTableGridCache = {};
        const d = res.data;
        if (res.workspaces && res.workspaces.length)
            fdLookups.workspaces = res.workspaces;
        if (res.formClasses && res.formClasses.length)
            fdLookups.formClasses = res.formClasses;
        fdEditId = id; fdStep = 1; fdEditingIdx = -1;
        fdStep1State = {
            name: d.name || '',
            desc: d.description || '',
            ownership: d.ownership || 'عام',
            formClassId: d.formClassId || 0,
            typeId: d.formTypeId || 0,
            wsId: d.workspaceId || 0,
            tplId: d.templateId || 0
        };
        // Pre-cache the template data so Step 3 renders immediately without extra fetch
        fdCurrentTemplate = d.templateData || null;
        fdApplyParsedFieldsData(fdParseFieldsJsonPayload(d.fieldsJson || ''));
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
        fdInitDynamicWidgets(body);
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
    const fcIdVal = d.formClassId != null && d.formClassId !== '' ? d.formClassId : (fdStep1State?.formClassId || 0);
    const typeIdVal = d.formTypeId != null ? d.formTypeId : d.typeId;
    const wsIdVal = d.workspaceId != null && d.workspaceId !== '' ? d.workspaceId : (d.wsId || 0);
    const tplIdVal = d.templateId != null ? d.templateId : d.tplId;
    const fcs = fdLookups.formClasses || [];
    const fcOpts = fcs.map(c=>`<option value="${c.id}" ${c.id==fcIdVal?'selected':''}>${esc(c.name)}</option>`).join('');
    const fcFirstOpt = fcs.length
        ? '<option value="">-- اختر --</option>'
        : '<option value="" disabled selected>لا توجد أصناف مفعّلة — أضف أصنافاً من الإعدادات</option>';
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
            <div class="fd-form-group"><label><span class="required-star">*</span>  تصنيف النموذج</label><select class="form-select" id="fdFFormClass">${fcFirstOpt}${fcOpts}</select></div>
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
    const sectionOpts = fdSections.map(s => `<option value="${s.id}" ${s.id === fdActiveSectionId ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
    return `
    <div class="fd-section" style="margin-bottom:16px;padding:14px 18px;">
        <div class="fd-section-title"><i class="bi bi-layout-three-columns"></i> أقسام النموذج <span style="font-size:11px;font-weight:500;color:var(--gray-400);margin-inline-start:6px;">— اختر قسماً لعرضه أدناه أو أضف قسماً جديداً</span></div>
        <div id="fdSectionsBar" class="fd-sec-bar"></div>
    </div>
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
                    <label class="small fw-bold text-muted mt-2 d-block">طريقة العرض</label>
                    <select class="form-select form-select-sm" id="fdFieldDisplayLayout">
                        <option value="">اختر</option>
                        <option value="يمتد عبر كامل الصف (واحد من واحد)">يمتد عبر كامل الصف (واحد من واحد)</option>
                        <option value="يمتد عبر نصف الصف (واحد من اثنين)">يمتد عبر نصف الصف (واحد من اثنين)</option>
                        <option value="يمتد عبر ثلاثة أرباع الصف (ثلاثة من أربعة)">يمتد عبر ثلاثة أرباع الصف (ثلاثة من أربعة)</option>
                        <option value="يمتد عبر ربع الصف (واحد من أربعة)">يمتد عبر ربع الصف (واحد من أربعة)</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted" id="fdFieldNameLabel">اسم الحقل <span class="required-star">*</span></label>
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
                <div class="col-md-3">
                    <label class="small fw-bold text-muted">القسم <span class="required-star">*</span></label>
                    <select class="form-select form-select-sm" id="fdFieldSection">${sectionOpts}</select>
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

function fdDisplayLayoutColClass(layout) {
    const L = (layout != null && String(layout).trim()) || '';
    const map = {
        '': 'col-md-12',
        'يمتد عبر كامل الصف (واحد من واحد)': 'col-md-12',
        'يمتد عبر نصف الصف (واحد من اثنين)': 'col-md-6',
        'يمتد عبر ثلاثة أرباع الصف (ثلاثة من أربعة)': 'col-md-9',
        'يمتد عبر ربع الصف (واحد من أربعة)': 'col-md-3'
    };
    return map[L] || 'col-md-12';
}

// ─── SHARED FORM PREVIEW BUILDER ─────────────────────────────────────────────
// Renders Header + Body (fields) + Footer from a real saved template object.
// tplData   – object with headerJson/footerJson/color/margins (or null = fallback)
// formName  – string
// formDesc  – string
// fields    – array of field objects
// interactive – true → render editable inputs (step-3), false → read-only display (details)
function fdBuildFormPreview(tplData, formName, formDesc, fields, interactive, sectionsOverride) {

    const sections = (sectionsOverride && sectionsOverride.length) ? sectionsOverride : fdDefaultSections();

    // ── fields HTML ──────────────────────────────────────────────────────────
    const renderField = f => {
        const isStructural = f.fieldType === 'عنوان' || f.fieldType === 'خط فاصل';
        const colClass = fdDisplayLayoutColClass(f.displayLayout);
        const tipAttr   = f.tooltipText ? ` title="${fdEscAttr(f.tooltipText)}"` : '';
        const infoIcon  = f.tooltipText ? `<i class="bi bi-info-circle ms-1" style="font-size:11px;color:var(--sa-400);"${tipAttr}></i>` : '';
        const subName   = f.subName ? `<small style="display:block;color:var(--gray-400);font-size:11px;margin-top:2px;font-style:normal;">${esc(f.subName)}</small>` : '';
        const inputHtml = interactive
            ? fdBuildFieldInput(f)
            : fdBuildFieldInput(f, { forceReadOnly: true });
        if (isStructural) {
            return `<div class="${colClass}" style="font-style:normal;">${inputHtml}</div>`;
        }
        return `<div class="${colClass}" style="font-style:normal;">
            <label style="font-size:13px;font-weight:700;color:var(--gray-700);display:block;margin-bottom:4px;font-style:normal;"${tipAttr}>
                ${esc(f.fieldName)}${f.isRequired ? '<span style="color:#ef4444;margin-right:4px;">*</span>' : ''}${infoIcon}
            </label>
            ${subName}
            ${inputHtml}
        </div>`;
    };

    let fieldsHtml = '';
    if (!fields.length) {
        fieldsHtml = `<div class="text-center py-4" style="color:var(--gray-400);font-style:normal;">
            <i class="bi bi-inbox" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);"></i>
            لم تُضف حقول بعد
        </div>`;
    } else {
        const showSectionTitles = sections.length > 1;
        fieldsHtml = sections.map(sec => {
            const items = fields.filter(f => (f.sectionId || sections[0].id) === sec.id);
            if (!items.length && !showSectionTitles) return '';
            const head = showSectionTitles
                ? `<div style="margin:12px 0 8px;padding:8px 12px;background:var(--sa-50);border-inline-start:4px solid var(--sa-500);border-radius:8px;font-weight:800;font-size:14px;color:var(--sa-800);font-style:normal;">${esc(sec.title)}</div>`
                : '';
            if (!items.length) return head + `<div class="text-center py-2" style="color:var(--gray-300);font-size:12px;font-style:normal;">لا توجد حقول في هذا القسم</div>`;
            return head + '<div class="row g-3">' + items.map(renderField).join('') + '</div>';
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
    return fdBuildFormPreview(fdCurrentTemplate, fName, fDesc, fdFields, true, fdSections);
}

// ─── STEP NAVIGATION ─────────────────────────────────────────────────────────
async function fdGoStep2() {
    const s = fdCollect1();
    if (!s.name) return showToast('اسم النموذج مطلوب','error');
    if (!s.formClassId) return showToast('أصناف النماذج مطلوبة','error');
    if (!s.typeId) return showToast('نوع النموذج مطلوب','error');
    if (!s.wsId) return showToast('مساحة العمل مطلوبة','error');
    if (!s.tplId) return showToast('القالب مطلوب','error');
    fdStep1State = s;
    await fdEnsureFieldBindingLookups();
    fdStep=2; fdRenderStep();
}

async function fdPrefetchBindingCachesForFields() {
    for (const f of fdFields) {
        let p = {};
        try { p = JSON.parse(f.propertiesJson || '{}'); } catch (e) {}
        if (f.fieldType === 'قائمة منسدلة' && p.dropdownListId) await fdFetchDropdownItemsForField(p.dropdownListId);
        if (f.fieldType === 'جدول بيانات' && p.readyTableId) await fdFetchReadyTableGridForField(p.readyTableId);
    }
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
    await fdPrefetchBindingCachesForFields();
    fdStep = 3;
    fdRenderStep();
}
function fdGoStepBack(from) { fdStep=from-1; fdRenderStep(); }

// ─── STEP 2 – FIELD BUILDER LOGIC ─────────────────────────────────────────────
async function fdOnFieldTypeChange() {
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
    const needsBinding = type === 'قائمة منسدلة' || type === 'جدول بيانات';
    if (needsBinding) await fdEnsureFieldBindingLookups();
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
    if (needsBinding) fdWireBindingPropListeners(type);
    if(type==='رقم الهاتف'){ const el=document.getElementById('fdProp_phoneFormat'); if(el&&!el.value) el.value='+966 (9 أرقام)'; }
    const tipEl = document.getElementById('fdFieldTooltip');
    if(tipEl&&!tipEl.value){ const d={'الاسم الكامل':'أدخل الاسم الكامل','البريد الإلكتروني':'أدخل البريد الإلكتروني','رقم الهاتف':'أدخل رقم الهاتف','نص قصير':'أدخل النص','نص طويل':'أدخل النص','فقرة':'أدخل الفقرة','رقم':'أدخل الرقم','قائمة منسدلة':'اختر من القائمة','قائمة اختيار الواحد':'اختر خياراً','قائمة اختيار متعدد':'اختر خياراً أو أكثر','تاريخ':'اختر التاريخ','وقت':'اختر الوقت','رفع ملف':'ارفع ملفاً','دوار رقمي':'حدد الرقم','التقييم بالنجوم':'حدد التقييم','التقييم بالأرقام':'حدد التقييم','جدول بيانات':'عبّئ الجدول','شبكة خيارات متعددة':'اختر خياراً لكل صف','شبكة مربعات اختيار':'حدد الخانات المطلوبة'}; tipEl.value=d[type]||'أدخل قيمة الحقل'; }
}

function fdCollectFieldProps() {
    const type = document.getElementById('fdFieldType')?.value;
    if(!type||!FD_FIELD_TYPES[type]) return {};
    const def=FD_FIELD_TYPES[type], result={};
    def.props.forEach(p => {
        if(p.type==='optionList'||p.type==='fileTypesPick') return;
        if(p.type==='dropdownListPick'||p.type==='readyTablePick'){
            const el=document.getElementById(`fdProp_${p.key}`); if(!el) return;
            const v=parseInt(el.value,10); result[p.key]=v>0?v:0; return;
        }
        if(p.type==='fileMbLimitsPair'){ const mn=document.getElementById('fdProp_minFileSize'); const mx=document.getElementById('fdProp_maxFileSize'); if(mn) result.minFileSize=mn.value; if(mx) result.maxFileSize=mx.value; return; }
        const el=document.getElementById(`fdProp_${p.key}`); if(!el) return;
        result[p.key] = (p.type==='checkbox') ? el.checked : el.value;
    });
    return fdMergeSpecialProps(type,'fdProp',result);
}

function fdSetFieldProps(type, po) {
    if(!type||!FD_FIELD_TYPES[type]) return;
    const def=FD_FIELD_TYPES[type]; po=po||{};
    def.props.forEach(p => {
        if(p.type==='optionList'||p.type==='fileTypesPick') return;
        if(p.type==='dropdownListPick'||p.type==='readyTablePick'){
            const el=document.getElementById(`fdProp_${p.key}`); if(!el) return;
            const v=po[p.key]; if(v!=null&&v!=='') el.value=String(v);
            return;
        }
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
    if (type === 'قائمة منسدلة') {
        const did = parseInt(document.getElementById('fdProp_dropdownListId')?.value || '0', 10);
        if (!did) return showToast('اختر قائمة منسدلة جاهزة من الإعدادات', 'error');
    }
    if (type === 'جدول بيانات') {
        const rid = parseInt(document.getElementById('fdProp_readyTableId')?.value || '0', 10);
        if (!rid) return showToast('اختر جدولاً جاهزاً من الإعدادات', 'error');
    }
    if (def?.props.some(p => p.type === 'optionList')) {
        const o = fdCollectOptionListFromEditor('fdProp', 'options');
        if (!o || !String(o.options || '').trim()) return showToast('يرجى إدخال خيار واحد على الأقل', 'error');
    }
    if (type === 'شبكة خيارات متعددة' || type === 'شبكة مربعات اختيار') {
        const rl = document.getElementById('fdProp_rowLabels');
        if (!rl || !String(rl.value || '').trim()) return showToast('يرجى إدخال عناوين الصفوف (سطر لكل صف)', 'error');
    }
    const props = fdCollectFieldProps();
    const secSel = document.getElementById('fdFieldSection');
    const secId = secSel ? (parseInt(secSel.value, 10) || fdActiveSectionId) : fdActiveSectionId;
    const field = { id: fdEditingIdx>=0 ? fdFields[fdEditingIdx].id : Date.now(), fieldType:type, fieldName:name, isRequired:document.getElementById('fdFieldRequired')?.value==='1', subName:props.subName||'', placeholder:props.placeholder||'', tooltipText:document.getElementById('fdFieldTooltip')?.value?.trim()||'', displayLayout:document.getElementById('fdFieldDisplayLayout')?.value?.trim()||'', sortOrder:0, sectionId: secId, propertiesJson:JSON.stringify(props) };
    if(fdEditingIdx>=0){ fdFields[fdEditingIdx]=field; showToast('تم تحديث الحقل','success'); fdEditingIdx=-1; }
    else { fdFields.push(field); showToast('تم إضافة الحقل','success'); }
    fdRenderFieldsTable(); fdResetFieldForm();
}

async function fdEditField(idx) {
    const f=fdFields[idx]; if(!f) return;
    fdEditingIdx=idx;
    document.getElementById('fdFieldType').value=f.fieldType;
    document.getElementById('fdFieldName').value=f.fieldName;
    document.getElementById('fdFieldRequired').value=f.isRequired?'1':'0';
    document.getElementById('fdFieldTooltip').value=f.tooltipText||'';
    const fdLay = document.getElementById('fdFieldDisplayLayout');
    if (fdLay) fdLay.value = (f.displayLayout != null && f.displayLayout !== '') ? f.displayLayout : '';
    const fdSec = document.getElementById('fdFieldSection');
    if (fdSec) fdSec.value = String(f.sectionId || fdActiveSectionId);
    document.getElementById('fdFieldNum').textContent=String(idx+1);
    document.getElementById('fdFieldFormLabel').textContent='تعديل حقل رقم';
    document.getElementById('fdAddFieldBtnTxt').textContent='تحديث الحقل';
    document.getElementById('fdCancelEditBtn').style.display='';
    let po = {};
    try { po = JSON.parse(f.propertiesJson || '{}'); } catch (e) {}
    await fdOnFieldTypeChange();
    fdSetFieldProps(f.fieldType, po);
    if (po.dropdownListId) await fdFetchDropdownItemsForField(po.dropdownListId);
    if (po.readyTableId) await fdFetchReadyTableGridForField(po.readyTableId);
    document.getElementById('fdPropsArea')?.scrollIntoView({behavior:'smooth'});
}

function fdDeleteField(idx) {
    fdFields.splice(idx,1);
    if(fdEditingIdx===idx) fdResetFieldForm(); else if(fdEditingIdx>idx) fdEditingIdx--;
    fdRenderFieldsTable(); fdResetFieldForm();
}

function fdRenderFieldsTable() {
    fdRenderSectionsBar();
    const body=document.getElementById('fdFieldsBody');
    const badge=document.getElementById('fdFieldsCountBadge');
    if(badge) badge.textContent=`${fdFields.length} حقل`;
    const num=document.getElementById('fdFieldNum');
    if(num) num.textContent=String(fdEditingIdx>=0?fdEditingIdx+1:fdFields.length+1);
    if(!body) return;
    if(!fdFields.length){ body.innerHTML='<tr><td colspan="7" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>'; return; }
    let html = '';
    let globalIdx = 0;
    fdSections.forEach(sec => {
        const items = [];
        fdFields.forEach((f, origIdx) => { if ((f.sectionId || fdSections[0].id) === sec.id) items.push({ f, origIdx }); });
        html += `<tr class="fd-sec-row-head"><td colspan="7" style="background:var(--sa-50);color:var(--sa-700);font-weight:700;font-size:12px;padding:8px 12px;border-top:2px solid var(--sa-100);"><i class="bi bi-collection"></i> ${esc(sec.title)} <span style="color:var(--gray-500);font-weight:500;margin-inline-start:6px;">(${items.length})</span></td></tr>`;
        if (!items.length) {
            html += `<tr><td colspan="7" class="text-center text-muted py-2" style="font-size:11px;">لا توجد حقول في هذا القسم</td></tr>`;
            return;
        }
        items.forEach(({ f, origIdx }) => {
            globalIdx++;
            const req=f.isRequired?'<span class="fd-field-req">نعم</span>':'<span style="font-size:11px;color:var(--gray-400);">لا</span>';
            const props=fdGetPropsSummary(f);
            html += `<tr>
                <td>${globalIdx}</td>
                <td><span class="fd-field-type">${esc(f.fieldType)}</span></td>
                <td style="font-weight:600;">${esc(f.fieldName)}</td>
                <td style="text-align:center;">${req}</td>
                <td style="font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${fdEscAttr(props)}">${esc(props)}</td>
                <td style="font-size:12px;color:var(--gray-500);">${esc(f.tooltipText||'-')}</td>
                <td style="white-space:nowrap;">
                    <button class="fd-action-btn fd-action-btn-edit" onclick="fdEditField(${origIdx})" style="padding:3px 8px;font-size:10px;"><i class="bi bi-pencil"></i></button>
                    <button class="fd-action-btn fd-action-btn-delete" onclick="fdDeleteField(${origIdx})" style="padding:3px 8px;font-size:10px;"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
        });
    });
    body.innerHTML = html;
}

function fdResetFieldForm() {
    const fn=document.getElementById('fdFieldNum'); if(fn) fn.textContent=String(fdFields.length+1);
    const lbl=document.getElementById('fdFieldFormLabel'); if(lbl) lbl.textContent='إضافة حقل رقم';
    const ft=document.getElementById('fdFieldType'); if(ft) ft.value='';
    const fname=document.getElementById('fdFieldName'); if(fname) fname.value='';
    const req=document.getElementById('fdFieldRequired'); if(req) req.value='1';
    const tip=document.getElementById('fdFieldTooltip'); if(tip) tip.value='';
    const fdLay=document.getElementById('fdFieldDisplayLayout'); if(fdLay) fdLay.value='';
    const area=document.getElementById('fdPropsArea'); if(area) area.style.display='none';
    const flds=document.getElementById('fdPropsFields'); if(flds) flds.innerHTML='';
    const cell=document.getElementById('fdPropsCell'); if(cell) cell.innerHTML='';
    const btnTxt=document.getElementById('fdAddFieldBtnTxt'); if(btnTxt) btnTxt.textContent='إضافة الحقل';
    const cancelBtn=document.getElementById('fdCancelEditBtn'); if(cancelBtn) cancelBtn.style.display='none';
    const nmLbl=document.getElementById('fdFieldNameLabel'); if(nmLbl) nmLbl.innerHTML='اسم الحقل <span class="required-star">*</span>';
    const sec=document.getElementById('fdFieldSection');
    if (sec) {
        sec.innerHTML = fdSections.map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('');
        sec.value = String(fdActiveSectionId);
    }
    fdEditingIdx=-1;
}

// ─── COLLECT STEP 1 DATA ──────────────────────────────────────────────────────
function fdCollect1() {
    return {
        name:     (document.getElementById('fdFName')?.value||'').trim(),
        desc:     (document.getElementById('fdFDesc')?.value||'').trim(),
        ownership: fdIsAdmin ? 'عام' : (document.getElementById('fdFOwnership')?.value||'عام'),
        formClassId: parseInt(document.getElementById('fdFFormClass')?.value||'0'),
        typeId:   parseInt(document.getElementById('fdFType')?.value||'0'),
        wsId:     parseInt(document.getElementById('fdFWs')?.value||'0'),
        tplId:    parseInt(document.getElementById('fdFTpl')?.value||'0'),
    };
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────
async function fdSave(sendForApproval) {
    const s = fdStep1State && fdStep1State.name ? fdStep1State : fdCollect1();
    if (!s.name) return showToast('اسم النموذج مطلوب','error');
    const payload = { name:s.name, description:s.desc, ownership:s.ownership, formClassId:s.formClassId, formTypeId:s.typeId, workspaceId:s.wsId, templateId:s.tplId, fieldsJson:fdSerializeFieldsJson(), sendForApproval };
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

        // Parse saved fields (supports sectioned payload)
        const parsed = fdParseFieldsJsonPayload(d.fieldsJson || '');
        const fields = parsed.fields;
        const sections = parsed.sections;

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
                <span class="fd-detail-lbl">التصنيف</span><span class="fd-detail-val">${esc(d.formClassName)}</span>
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
            ${fdBuildFormPreview(tplData, d.name, d.description, fields, false, sections)}
        </div>`;

        const detailsBody = document.getElementById('fdDetailsBody');
        detailsBody.innerHTML = html;
        fdInitDynamicWidgets(detailsBody);
        fdDetModal().show();
    } catch(e) {
        showToast('خطأ في تحميل التفاصيل', 'error');
    }
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function esc(s) { if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
