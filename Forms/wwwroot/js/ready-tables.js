/* ===== Ready Tables JS (Index Page) ===== */
var rtAllData = [], rtFilteredData = [], rtOrgUnits = [], rtCurrentUser = '', rtIsAdmin = false;
var rtcFields = [], rtcEditingIndex = -1;

function rtNormalizeHeaderHex(val) {
    if (!val || typeof val !== 'string') return '#d1d5db';
    var s = val.trim();
    if (!s) return '#d1d5db';
    if (s[0] !== '#') s = '#' + s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
        s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    }
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
    return '#d1d5db';
}

function rtcGetColumnHeaderColor() {
    var no = document.getElementById('rtcNoColumnHeaderColor');
    if (no && no.checked) return '';
    var inp = document.getElementById('rtcColumnHeaderColor');
    return inp ? rtNormalizeHeaderHex(inp.value) : '';
}

function rtcOnNoColumnHeaderColorChange() {
    var no = document.getElementById('rtcNoColumnHeaderColor');
    var inp = document.getElementById('rtcColumnHeaderColor');
    var row = document.getElementById('rtcColumnColorRow');
    if (!inp || !no) return;
    inp.disabled = no.checked;
    if (row) row.style.opacity = no.checked ? '0.55' : '1';
}

function rtcOnColumnHeaderColorInput() {
    var inp = document.getElementById('rtcColumnHeaderColor');
    var hex = document.getElementById('rtcColumnHeaderColorHex');
    if (hex && inp) hex.textContent = rtNormalizeHeaderHex(inp.value);
}

function rtcResetColumnHeaderColorUI() {
    var no = document.getElementById('rtcNoColumnHeaderColor');
    var inp = document.getElementById('rtcColumnHeaderColor');
    var hex = document.getElementById('rtcColumnHeaderColorHex');
    if (no) no.checked = true;
    var def = '#d1d5db';
    if (inp) { inp.value = def; inp.disabled = true; }
    if (hex) hex.textContent = def;
    rtcOnNoColumnHeaderColorChange();
}

function rtEditGetColumnHeaderColor() {
    var no = document.getElementById('rtEditNoColumnHeaderColor');
    if (no && no.checked) return '';
    var inp = document.getElementById('rtEditColumnHeaderColor');
    return inp ? rtNormalizeHeaderHex(inp.value) : '';
}

function rtEditOnNoColumnHeaderColorChange() {
    var no = document.getElementById('rtEditNoColumnHeaderColor');
    var inp = document.getElementById('rtEditColumnHeaderColor');
    var row = document.getElementById('rtEditColumnColorRow');
    if (!inp || !no) return;
    inp.disabled = no.checked;
    if (row) row.style.opacity = no.checked ? '0.55' : '1';
}

function rtEditOnColumnHeaderColorInput() {
    var inp = document.getElementById('rtEditColumnHeaderColor');
    var hex = document.getElementById('rtEditColumnHeaderColorHex');
    if (hex && inp) hex.textContent = rtNormalizeHeaderHex(inp.value);
}

function rtEditApplyColumnHeaderColorFromValue(saved) {
    var no = document.getElementById('rtEditNoColumnHeaderColor');
    var inp = document.getElementById('rtEditColumnHeaderColor');
    var hex = document.getElementById('rtEditColumnHeaderColorHex');
    var c = (saved || '').trim();
    if (!c) {
        if (no) no.checked = true;
        var def = '#d1d5db';
        if (inp) { inp.value = def; inp.disabled = true; }
        if (hex) hex.textContent = def;
    } else {
        var norm = rtNormalizeHeaderHex(c);
        if (no) no.checked = false;
        if (inp) { inp.value = norm; inp.disabled = false; }
        if (hex) hex.textContent = norm;
    }
    rtEditOnNoColumnHeaderColorChange();
}

var RT_FIELD_TYPES = {
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
    ] },
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
    ] },
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
    ] },
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
    ] },
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
    ] },
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
    ] },
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
    ] },
    "قائمة منسدلة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"single" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text", placeholder:"اختر خياراً" },
        { key:"optionsCount", label:"عدد الخيارات", type:"number" },
        { key:"visibleOptions", label:"الخيارات المرئية", type:"number" },
        { key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }
    ] },
    "قائمة اختيار الواحد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"single" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text" },
        { key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }
    ] },
    "قائمة اختيار متعدد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"multi" },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" },
        { key:"inputLimits", label:"حدود المدخلات", type:"checkbox" },
        { key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }
    ] },
    "تاريخ": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"separator", label:"الفاصل", type:"select", options:["/",":","."] },
        { key:"startDate", label:"تاريخ البداية", type:"date" },
        { key:"endDate", label:"تاريخ النهاية", type:"date" },
        { key:"autoDate", label:"التاريخ التلقائي", type:"checkbox" },
        { key:"showCalendar", label:"ظهور التقويم", type:"checkbox" },
        { key:"simpleMode", label:"الوضع البسيط", type:"checkbox" },
        { key:"timeSlot", label:"خانة الوقت", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ] },
    "وقت": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"timeFormat", label:"نمط الوقت", type:"select", options:["12 ساعة","24 ساعة"] },
        { key:"timeRangeStart", label:"بداية النطاق", type:"time" },
        { key:"timeRangeEnd", label:"نهاية النطاق", type:"time" },
        { key:"autoTime", label:"الوقت التلقائي", type:"checkbox" },
        { key:"readOnly", label:"القراءة فقط", type:"checkbox" }
    ] },
    "رفع ملف": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"buttonText", label:"نص الزر", type:"text", placeholder:"رفع ملف" },
        { key:"maxFiles", label:"حد عدد الملفات", type:"number" },
        { type:"fileMbLimitsPair", label:"حد حجم الملف (ميغابايت)", col:"col-12 mb-2" },
        { key:"fileTypes", label:"أنواع الملفات المسموحة", type:"fileTypesPick" },
        { key:"fileSizeLimit", label:"حد حجم الملفات", type:"checkbox", col:"col-12 mb-3 rt-file-size-enable", checkboxLabel:"تفعيل" },
        { key:"validateSize", label:"التحقق من الحجم", type:"checkbox" }
    ] },
    "دوار رقمي": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minValue", label:"الحد الأدنى", type:"number" },
        { key:"maxValue", label:"الحد الأقصى", type:"number" },
        { key:"stepValue", label:"قيمة الفترة", type:"number", placeholder:"مثال: 1" },
        { key:"inputLimits", label:"حدود المدخلات", type:"checkbox" },
        { key:"noDecimals", label:"بدون عشرية", type:"checkbox" },
        { key:"negativeValue", label:"قيمة سلبية", type:"checkbox" }
    ] },
    "التقييم بالنجوم": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"ratingIcon", label:"أيقونة التقييم", type:"select", options:["نجمة","قلب","إبهام"] },
        { key:"ratingRange", label:"مدى التقييم", type:"number", placeholder:"مثال: 5" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"number" },
        { key:"tooltipText", label:"نص التلميح", type:"text" }
    ] },
    "التقييم بالأرقام": { props: [
        { key:"lowRatingText", label:"نص أقل تقييم", type:"text" },
        { key:"highRatingText", label:"نص أعلى تقييم", type:"text" },
        { key:"minRating", label:"أقل قيمة", type:"number" },
        { key:"maxRating", label:"أعلى قيمة", type:"number" },
        { key:"tooltipText", label:"نص التلميح", type:"text" }
    ] }
};

var RT_FILE_TYPE_CHOICES = [
    { ext: 'pdf', label: 'PDF' },
    { ext: 'jpg', label: 'JPG' },
    { ext: 'jpeg', label: 'JPEG' },
    { ext: 'png', label: 'PNG' },
    { ext: 'doc', label: 'Word (.doc)' },
    { ext: 'docx', label: 'Word (.docx)' },
    { ext: 'xls', label: 'Excel (.xls)' },
    { ext: 'xlsx', label: 'Excel (.xlsx)' },
    { ext: 'txt', label: 'TXT' }
];

function rtEscAttr(s) {
    if (s == null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function rtInitOptionListEditor(idPrefix, mode, propsObj) {
    var el = document.getElementById(idPrefix + '_options_editor');
    if (!el) return;
    el.classList.add('rtc-option-list-editor');
    el.setAttribute('data-mode', mode);
    el.innerHTML = '';
    var rowsHost = document.createElement('div');
    rowsHost.className = 'rtc-opt-rows';
    var lines = [''];
    var defaultStr = '';
    var po = propsObj || {};
    if (po.options != null && String(po.options).trim() !== '') {
        lines = String(po.options).split(/[\r\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (lines.length === 0) lines = [''];
        defaultStr = (po.defaultOption || '').trim();
    }
    var defaultMulti = mode === 'multi' ? defaultStr.split(/,\s*/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    lines.forEach(function (text) {
        rowsHost.appendChild(rtCreateOptionRow(idPrefix, mode, text, defaultStr, defaultMulti));
    });
    el.appendChild(rowsHost);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-primary mt-2';
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> إضافة خيار';
    btn.addEventListener('click', function () {
        rowsHost.appendChild(rtCreateOptionRow(idPrefix, mode, '', '', []));
    });
    el.appendChild(btn);
}

function rtCreateOptionRow(idPrefix, mode, text, defaultSingle, defaultMultiArr) {
    var wrap = document.createElement('div');
    wrap.className = 'rtc-opt-row d-flex align-items-center gap-2 mb-2 flex-wrap';
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-control form-control-sm rtc-opt-text flex-grow-1';
    inp.style.minWidth = '140px';
    inp.placeholder = 'نص الخيار';
    inp.value = text || '';
    wrap.appendChild(inp);
    var trimmed = (text || '').trim();
    if (mode === 'multi') {
        var d = document.createElement('div');
        d.className = 'form-check m-0 flex-shrink-0';
        var c = document.createElement('input');
        c.type = 'checkbox';
        c.className = 'form-check-input rtc-opt-def-multi';
        c.title = 'يُحدَّد مسبقاً عند فتح النموذج';
        if (trimmed && defaultMultiArr.indexOf(trimmed) >= 0) c.checked = true;
        var lid = document.createElement('label');
        lid.className = 'form-check-label small';
        lid.textContent = 'افتراضي';
        d.appendChild(c);
        d.appendChild(lid);
        wrap.appendChild(d);
    } else {
        var d2 = document.createElement('div');
        d2.className = 'form-check m-0 flex-shrink-0';
        var r = document.createElement('input');
        r.type = 'radio';
        r.name = idPrefix + '_defaultOpt';
        r.className = 'form-check-input rtc-opt-def-single';
        r.title = 'الخيار الافتراضي عند فتح النموذج';
        if (trimmed && defaultSingle && trimmed === defaultSingle) r.checked = true;
        var lid2 = document.createElement('label');
        lid2.className = 'form-check-label small';
        lid2.textContent = 'افتراضي';
        d2.appendChild(r);
        d2.appendChild(lid2);
        wrap.appendChild(d2);
    }
    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-sm btn-outline-danger flex-shrink-0';
    rm.innerHTML = '<i class="bi bi-x-lg"></i>';
    rm.title = 'حذف الخيار';
    rm.addEventListener('click', function () {
        var host = wrap.parentElement;
        if (!host) return;
        if (host.querySelectorAll('.rtc-opt-row').length <= 1) { inp.value = ''; return; }
        wrap.remove();
    });
    wrap.appendChild(rm);
    return wrap;
}

function rtCollectOptionListFromEditor(idPrefix) {
    var el = document.getElementById(idPrefix + '_options_editor');
    if (!el) return null;
    var mode = el.getAttribute('data-mode') || 'single';
    var host = el.querySelector('.rtc-opt-rows');
    if (!host) return { options: '', defaultOption: '' };
    var lines = [], defaultOption = '', defaultsMulti = [];
    host.querySelectorAll('.rtc-opt-row').forEach(function (row) {
        var ti = row.querySelector('.rtc-opt-text');
        var t = ti ? ti.value.trim() : '';
        if (!t) return;
        lines.push(t);
        if (mode === 'multi') {
            var c = row.querySelector('.rtc-opt-def-multi');
            if (c && c.checked) defaultsMulti.push(t);
        } else {
            var r = row.querySelector('.rtc-opt-def-single');
            if (r && r.checked) defaultOption = t;
        }
    });
    return { options: lines.join('\n'), defaultOption: mode === 'multi' ? defaultsMulti.join(', ') : defaultOption };
}

function rtCollectFileTypesPick(idPrefix) {
    var wrap = document.getElementById(idPrefix + '_fileTypes_pick');
    if (!wrap) return '';
    var parts = [];
    wrap.querySelectorAll('input[type="checkbox"]:checked').forEach(function (c) { parts.push(c.value); });
    return parts.join(',');
}

function rtApplyFileTypesFromProps(idPrefix, propsObj) {
    var wrap = document.getElementById(idPrefix + '_fileTypes_pick');
    if (!wrap || !propsObj || propsObj.fileTypes == null || propsObj.fileTypes === '') {
        if (wrap) wrap.querySelectorAll('input[type="checkbox"]').forEach(function (c) { c.checked = false; });
        return;
    }
    var set = {};
    String(propsObj.fileTypes).split(/[,\s;|]+/).forEach(function (s) {
        var x = s.trim().replace(/^\./, '').toLowerCase();
        if (x) set[x] = true;
    });
    wrap.querySelectorAll('input[type="checkbox"]').forEach(function (c) {
        c.checked = !!set[(c.value || '').toLowerCase()];
    });
}

function rtMergeSpecialPropsIntoResult(type, idPrefix, result) {
    var def = RT_FIELD_TYPES[type];
    if (!def) return result;
    if (def.props.some(function (p) { return p.type === 'optionList'; })) {
        var o = rtCollectOptionListFromEditor(idPrefix);
        if (o) {
            result.options = o.options;
            result.defaultOption = o.defaultOption;
        }
    }
    if (def.props.some(function (p) { return p.type === 'fileTypesPick'; })) {
        result.fileTypes = rtCollectFileTypesPick(idPrefix);
    }
    return result;
}

function rtApplyPropsSpecialEditors(type, idPrefix, propsObj) {
    var def = RT_FIELD_TYPES[type];
    if (!def) return;
    var po = propsObj || {};
    def.props.forEach(function (p) {
        if (p.type === 'optionList') {
            rtInitOptionListEditor(idPrefix, p.choiceMode || 'single', po);
        }
    });
    rtApplyFileTypesFromProps(idPrefix, po);
}

function rtBuildSinglePropHtml(p, idPrefix) {
    if (p.type === 'fileMbLimitsPair') {
        return '<div class="' + (p.col || 'col-12 mb-2') + '"><span class="d-block small fw-bold mb-1" style="color:var(--gray-600);">' + (p.label || 'حد حجم الملف (ميغابايت)') + '</span>' +
            '<div class="d-flex flex-nowrap align-items-end gap-2 rt-file-mb-pair">' +
            '<div class="flex-shrink-0"><label class="small text-muted mb-0 d-block">أدنى</label><input type="number" min="0" step="0.01" class="form-control form-control-sm rt-file-mb-input" id="' + idPrefix + '_minFileSize" placeholder="0" style="border-radius:8px;"></div>' +
            '<div class="flex-shrink-0"><label class="small text-muted mb-0 d-block">أقصى</label><input type="number" min="0" step="0.01" class="form-control form-control-sm rt-file-mb-input" id="' + idPrefix + '_maxFileSize" placeholder="مثال 10" style="border-radius:8px;"></div>' +
            '</div></div>';
    }
    if (p.type === 'optionList') {
        return '<div class="col-12 mb-3"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">' + p.label + '</label><p class="text-muted small mb-2" style="font-size:11px;">أضف خياراً لكل سطر، وحدد «افتراضي» لقيمة تظهر تلقائياً في الجدول.</p><div id="' + idPrefix + '_options_editor" class="border rounded-3 p-3" style="background:#fafafa;" data-mode="' + (p.choiceMode || 'single') + '"></div></div>';
    }
    if (p.type === 'fileTypesPick') {
        var h = '<div class="col-12 mb-3"><label class="d-block fw-bold mb-2" style="color:var(--gray-600);font-size:12px;">' + p.label + '</label><div id="' + idPrefix + '_fileTypes_pick" class="d-flex flex-wrap gap-3 border rounded-3 p-3 bg-white">';
        RT_FILE_TYPE_CHOICES.forEach(function (ft) {
            var cid = idPrefix + '_ft_' + ft.ext;
            h += '<div class="form-check m-0"><input class="form-check-input" type="checkbox" value="' + ft.ext + '" id="' + cid + '"><label class="form-check-label" for="' + cid + '" style="font-size:12.5px;">' + ft.label + '</label></div>';
        });
        return h + '</div></div>';
    }
    var fid = idPrefix + '_' + p.key;
    var colClass = p.col || 'col-md-4 col-sm-6 mb-3';
    var hint = '';
    if (p.key === 'subName') hint = '<div class="text-muted" style="font-size:10px;margin-top:2px;">نص صغير يظهر أسفل الحقل</div>';
    if (p.key === 'defaultValue') hint = '<div class="text-muted" style="font-size:10px;margin-top:2px;">قيمة تُعبأ تلقائياً في الحقل</div>';
    if (p.key === 'placeholder') hint = '<div class="text-muted" style="font-size:10px;margin-top:2px;">نص إرشادي يختفي عند الكتابة</div>';
    if (p.key === 'readOnly') hint = '<div class="text-muted" style="font-size:10px;margin-top:2px;">الحقل يظهر لكن لا يمكن تعديله</div>';
    var html = '<div class="' + colClass + '"><label class="d-block" style="font-size:12px;font-weight:600;color:var(--gray-600);margin-bottom:4px;">' + p.label + '</label>';
    if (p.type === 'checkbox') {
        var cbLbl = (p.checkboxLabel != null && p.checkboxLabel !== '') ? p.checkboxLabel : 'تفعيل';
        html += '<div class="form-check mt-1"><input class="form-check-input" type="checkbox" id="' + fid + '"><label class="form-check-label" for="' + fid + '" style="font-size:12.5px;">' + cbLbl + '</label></div>';
    } else if (p.type === 'select') {
        html += '<select class="form-select form-select-sm" id="' + fid + '" style="border-radius:8px;font-size:12.5px;"><option value="">اختر</option>';
        (p.options || []).forEach(function (o) { html += '<option value="' + rtEscAttr(o) + '">' + o + '</option>'; });
        html += '</select>';
    } else if (p.type === 'textarea') {
        html += '<textarea class="form-control form-control-sm" id="' + fid + '" rows="3" placeholder="' + rtEscAttr(p.placeholder || '') + '" style="border-radius:8px;font-size:12.5px;"></textarea>';
    } else {
        html += '<input type="' + (p.type || 'text') + '" class="form-control form-control-sm" id="' + fid + '" placeholder="' + rtEscAttr(p.placeholder || '') + '" style="border-radius:8px;font-size:12.5px;">';
    }
    return html + hint + '</div>';
}

/* ===== Page Load ===== */
document.addEventListener('DOMContentLoaded', rtLoad);

async function rtLoad() {
    try {
        var r = await apiFetch('/Tables/GetReadyTables');
        if (!r || !r.success) return;
        rtAllData = r.data || [];
        rtFilteredData = rtAllData.slice();
        rtOrgUnits = r.organizationalUnits || [];
        rtCurrentUser = r.currentUser || '';
        rtIsAdmin = r.isAdmin || false;
        rtRenderOrgFilter();
        rtRenderTable();
    } catch(e) { console.error('rtLoad error:', e); }
}

function rtRenderOrgFilter() {
    var sel = document.getElementById('rtFilterOrgUnit');
    sel.innerHTML = '<option value="">قائمة بالوحدات التنظيمية</option>';
    rtOrgUnits.forEach(function(u) { sel.innerHTML += '<option value="' + u.id + '">' + u.name + '</option>'; });
}

function rtApplyFilters() {
    var s = (document.getElementById('rtSearchInput').value || '').trim().toLowerCase();
    var rc = document.getElementById('rtFilterRowCount').value;
    var ow = document.getElementById('rtFilterOwnership').value;
    var ou = document.getElementById('rtFilterOrgUnit').value;
    rtFilteredData = rtAllData.filter(function(t) {
        if (s && !(t.name||'').toLowerCase().includes(s) && !(t.description||'').toLowerCase().includes(s)) return false;
        if (rc && t.rowCountMode !== rc) return false;
        if (ow && t.ownership !== ow) return false;
        if (ou && t.organizationalUnitId !== parseInt(ou)) return false;
        return true;
    });
    rtRenderTable();
}

function rtClearFilters() {
    document.getElementById('rtSearchInput').value = '';
    document.getElementById('rtFilterRowCount').value = '';
    document.getElementById('rtFilterOwnership').value = '';
    document.getElementById('rtFilterOrgUnit').value = '';
    rtFilteredData = rtAllData.slice();
    rtRenderTable();
}

function rtCanEdit(t) { return t.createdBy === rtCurrentUser || rtIsAdmin; }

function rtRenderTable() {
    var badge = document.getElementById('rtCountBadge');
    badge.textContent = '(' + rtAllData.length + ')';
    var body = document.getElementById('rtBody');
    if (rtFilteredData.length === 0) {
        body.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">لا توجد جداول</td></tr>';
        return;
    }
    var html = '';
    rtFilteredData.forEach(function(t) {
        var rowClass = t.rowCountMode === 'مفتوح' ? 'rt-row-open' : 'rt-row-restricted';
        var rowLabel = t.rowCountMode === 'مقيد' ? 'مقيد' : 'مفتوح';
        var owClass = t.ownership === 'عام' ? 'rt-badge-public' : 'rt-badge-private';
        var actClass = t.isActive ? 'rt-badge-active' : 'rt-badge-inactive';
        var actLabel = t.isActive ? 'مفعل' : 'معطل';
        html += '<tr>';
        html += '<td style="text-align:center;">' + t.sortOrder + '</td>';
        html += '<td style="text-align:right;">' + (t.name||'') + '</td>';
        html += '<td style="text-align:center;">' + (t.fieldCount||0) + '</td>';
        html += '<td style="text-align:center;"><span class="' + rowClass + '">' + rowLabel + '</span></td>';
        html += '<td style="text-align:right;">' + (t.organizationalUnitName||'') + '</td>';
        html += '<td style="text-align:center;"><span class="' + owClass + '">' + t.ownership + '</span></td>';
        html += '<td style="text-align:center;"><span class="' + actClass + '">' + actLabel + '</span></td>';
        html += '<td style="text-align:center;white-space:nowrap;">';
        html += '<div style="display:inline-flex;gap:4px;align-items:center;justify-content:center;">';
        html += '<button class="rt-action-btn rt-action-btn-detail" onclick="rtShowDetails(' + t.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>';
        if (rtCanEdit(t)) {
            html += '<button class="rt-action-btn rt-action-btn-edit" onclick="rtShowEditModal(' + t.id + ')"><i class="bi bi-pencil"></i> تحديث</button>';
            html += '<button class="rt-action-btn rt-action-btn-delete" onclick="rtShowDeleteModal(' + t.id + ',\'' + (t.name||'').replace(/'/g,"\\'") + '\')"><i class="bi bi-trash"></i> حذف</button>';
        }
        html += '</div></td></tr>';
    });
    body.innerHTML = html;
}

/* ===== Create Modal ===== */
function rtShowCreateModal() {
    rtcFields = [];
    rtcEditingIndex = -1;
    document.getElementById('rtcName').value = '';
    document.getElementById('rtcDesc').value = '';
    document.getElementById('rtcOwPublic').checked = true;
    document.getElementById('rtcRowOpen').checked = true;
    document.getElementById('rtcMaxRows').style.display = 'none';
    document.getElementById('rtcMaxRows').value = '';
    document.getElementById('rtcActiveOn').checked = true;
    rtcResetColumnHeaderColorUI();
    rtcResetFieldForm();
    document.getElementById('rtcFieldsSection').style.display = 'none';
    document.getElementById('rtcFieldsBody').innerHTML = '<tr><td colspan="7" class="text-muted text-center py-3">لا توجد حقول مضافة بعد</td></tr>';
    document.getElementById('rtcFieldsCount').textContent = '0';
    document.getElementById('rtcCreateError').classList.add('d-none');
    var pi = document.getElementById('rtcPreviewInline');
    if (pi) pi.classList.add('d-none');
    new bootstrap.Modal(document.getElementById('rtCreateModal')).show();
}

function rtcToggleMaxRows() {
    var mode = document.querySelector('input[name="rtcRowMode"]:checked').value;
    document.getElementById('rtcMaxRows').style.display = mode === 'مقيد' ? 'inline-block' : 'none';
    if (mode !== 'مقيد') document.getElementById('rtcMaxRows').value = '';
}

function rtcShowFieldsSection() {
    var name = document.getElementById('rtcName').value.trim();
    if (!name) { showToast('يرجى إدخال اسم الجدول أولاً', 'danger'); return; }
    var rowMode = document.querySelector('input[name="rtcRowMode"]:checked').value;
    if (rowMode === 'مقيد') {
        var mx = parseInt(document.getElementById('rtcMaxRows').value, 10);
        if (!mx || mx < 1) { showToast('يرجى تحديد عدد الصفوف', 'danger'); return; }
    }
    document.getElementById('rtcFieldsSection').style.display = 'block';
    document.getElementById('rtcFieldsSection').scrollIntoView({ behavior:'smooth' });
}

function rtcOnFieldTypeChange() {
    var type = document.getElementById('rtcFieldType').value;
    var area = document.getElementById('rtcPropsArea');
    var container = document.getElementById('rtcPropsFields');
    var cell = document.getElementById('rtcPropsCell');
    if (!type || !RT_FIELD_TYPES[type]) {
        area.style.display = 'none';
        container.innerHTML = '';
        cell.innerHTML = '<span class="text-muted" style="font-size:11px;">اختر نوع الحقل أولاً</span>';
        return;
    }
    var def = RT_FIELD_TYPES[type];
    area.style.display = 'block';
    cell.innerHTML = '<span style="font-size:11px;color:var(--sa-600);"><i class="bi bi-check-circle-fill"></i> ' + def.props.length + ' خاصية</span>';
    var html = '<div class="row g-2">';
    var cbStarted = false;
    def.props.forEach(function (p) {
        if (p.type === 'checkbox' && !cbStarted) {
            cbStarted = true;
            html += '<div class="col-12"><hr style="border-color:var(--gray-200);margin:8px 0 4px;"><div style="font-size:11px;font-weight:700;color:var(--gray-400);margin-bottom:6px;"><i class="bi bi-toggles"></i> خيارات التفعيل</div></div>';
        }
        html += rtBuildSinglePropHtml(p, 'rtcProp');
    });
    html += '</div>';
    container.innerHTML = html;
    rtApplyPropsSpecialEditors(type, 'rtcProp', null);
    if (type === 'رقم الهاتف') {
        var pfmt = document.getElementById('rtcProp_phoneFormat');
        if (pfmt && !pfmt.value) pfmt.value = '+966 (9 أرقام)';
    }
    var tooltip = document.getElementById('rtcFieldTooltip');
    if (!tooltip.value) {
        var defaults = { "الاسم الكامل":"أدخل الاسم الكامل","البريد الإلكتروني":"أدخل البريد الإلكتروني","رقم الهاتف":"أدخل رقم الهاتف","نص قصير":"أدخل النص","نص طويل":"أدخل النص","فقرة":"أدخل الفقرة","رقم":"أدخل الرقم","قائمة منسدلة":"اختر من القائمة","قائمة اختيار الواحد":"اختر خياراً واحداً","قائمة اختيار متعدد":"اختر خياراً أو أكثر","تاريخ":"اختر التاريخ","وقت":"اختر الوقت","رفع ملف":"ارفع ملفاً","دوار رقمي":"حدد الرقم","التقييم بالنجوم":"حدد التقييم","التقييم بالأرقام":"حدد التقييم" };
        tooltip.value = defaults[type] || "أدخل قيمة الحقل";
    }
}

function rtcCollectProps() {
    var type = document.getElementById('rtcFieldType').value;
    if (!type || !RT_FIELD_TYPES[type]) return {};
    var def = RT_FIELD_TYPES[type], result = {};
    def.props.forEach(function (p) {
        if (p.type === 'optionList' || p.type === 'fileTypesPick') return;
        if (p.type === 'fileMbLimitsPair') {
            var mn = document.getElementById('rtcProp_minFileSize');
            var mx = document.getElementById('rtcProp_maxFileSize');
            if (mn) result.minFileSize = mn.value;
            if (mx) result.maxFileSize = mx.value;
            return;
        }
        var el = document.getElementById('rtcProp_' + p.key);
        if (!el) return;
        if (p.type === 'checkbox') result[p.key] = el.checked; else result[p.key] = el.value;
    });
    return rtMergeSpecialPropsIntoResult(type, 'rtcProp', result);
}

function rtcSetProps(type, propsObj) {
    if (!type || !RT_FIELD_TYPES[type]) return;
    var def = RT_FIELD_TYPES[type];
    var po = propsObj || {};
    def.props.forEach(function (p) {
        if (p.type === 'optionList' || p.type === 'fileTypesPick') return;
        if (p.type === 'fileMbLimitsPair') {
            var mn = document.getElementById('rtcProp_minFileSize');
            var mx = document.getElementById('rtcProp_maxFileSize');
            if (mn && po.minFileSize !== undefined && po.minFileSize !== null) mn.value = po.minFileSize;
            if (mx && po.maxFileSize !== undefined && po.maxFileSize !== null) mx.value = po.maxFileSize;
            return;
        }
        var el = document.getElementById('rtcProp_' + p.key);
        if (!el) return;
        var v = po[p.key];
        if (p.type === 'checkbox') el.checked = !!v; else if (v !== undefined && v !== null) el.value = v;
    });
    rtApplyPropsSpecialEditors(type, 'rtcProp', po);
}

function rtcAddField() {
    var type = document.getElementById('rtcFieldType').value;
    var name = document.getElementById('rtcFieldName').value.trim();
    if (!type) { showToast('يرجى اختيار نوع الحقل', 'danger'); return; }
    if (!name) { showToast('يرجى إدخال اسم الحقل', 'danger'); return; }
    var defPre = RT_FIELD_TYPES[type];
    if (defPre && defPre.props.some(function (p) { return p.type === 'optionList'; })) {
        var oc = rtCollectOptionListFromEditor('rtcProp');
        if (!oc || !String(oc.options || '').trim()) { showToast('يرجى إدخال خيار واحد على الأقل للقائمة', 'danger'); return; }
    }
    var props = rtcCollectProps();
    var field = { fieldType:type, fieldName:name, isRequired:document.getElementById('rtcFieldRequired').value === '1', subName:props.subName||'', placeholder:props.placeholder||'', tooltipText:document.getElementById('rtcFieldTooltip').value.trim(), propertiesJson:JSON.stringify(props) };
    if (rtcEditingIndex >= 0) { rtcFields[rtcEditingIndex] = field; rtcEditingIndex = -1; showToast('تم تحديث الحقل', 'success'); } else { rtcFields.push(field); showToast('تم إضافة الحقل', 'success'); }
    rtcResetFieldForm();
    rtcRenderFieldsTable();
}

function rtcResetFieldForm() {
    var fn = document.getElementById('rtcFieldNum');
    if (fn) fn.textContent = (rtcFields.length + 1).toString();
    var ft = document.getElementById('rtcFieldType');
    if (ft) ft.value = '';
    var fname = document.getElementById('rtcFieldName');
    if (fname) fname.value = '';
    var req = document.getElementById('rtcFieldRequired');
    if (req) req.value = '1';
    var tip = document.getElementById('rtcFieldTooltip');
    if (tip) tip.value = '';
    var area = document.getElementById('rtcPropsArea');
    if (area) area.style.display = 'none';
    var fields = document.getElementById('rtcPropsFields');
    if (fields) fields.innerHTML = '';
    var cell = document.getElementById('rtcPropsCell');
    if (cell) cell.innerHTML = '<span class="text-muted" style="font-size:11px;">اختر نوع الحقل أولاً</span>';
    rtcEditingIndex = -1;
}

function rtcEditField(idx) {
    var f = rtcFields[idx];
    if (!f) return;
    rtcEditingIndex = idx;
    document.getElementById('rtcFieldType').value = f.fieldType;
    document.getElementById('rtcFieldName').value = f.fieldName;
    document.getElementById('rtcFieldRequired').value = f.isRequired ? '1' : '0';
    document.getElementById('rtcFieldTooltip').value = f.tooltipText || '';
    document.getElementById('rtcFieldNum').textContent = (idx + 1).toString();
    rtcOnFieldTypeChange();
    try { var p = JSON.parse(f.propertiesJson || '{}'); rtcSetProps(f.fieldType, p); } catch(e) {}
    document.getElementById('rtcFieldsSection').scrollIntoView({ behavior:'smooth' });
}

function rtcDeleteField(idx) {
    rtcFields.splice(idx, 1);
    if (rtcEditingIndex === idx) rtcResetFieldForm(); else if (rtcEditingIndex > idx) rtcEditingIndex--;
    rtcRenderFieldsTable();
    rtcResetFieldForm();
}

function rtcRenderFieldsTable() {
    var body = document.getElementById('rtcFieldsBody');
    var count = document.getElementById('rtcFieldsCount');
    if (count) count.textContent = rtcFields.length;
    var fn = document.getElementById('rtcFieldNum');
    if (fn) fn.textContent = (rtcEditingIndex >= 0 ? rtcEditingIndex + 1 : rtcFields.length + 1).toString();
    if (!body) return;
    if (rtcFields.length === 0) { body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-3">لا توجد حقول مضافة بعد</td></tr>'; return; }
    var html = '';
    rtcFields.forEach(function(f, i) {
        var reqBadge = f.isRequired ? '<span class="rt-field-badge-req">نعم</span>' : '<span class="rt-field-badge-opt">لا</span>';
        var propsText = rtcGetPropsSummaryCreate(f);
        html += '<tr><td>' + (i+1) + '</td><td>' + f.fieldType + '</td><td>' + f.fieldName + '</td><td>' + reqBadge + '</td><td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + propsText.replace(/"/g,'&quot;') + '">' + propsText + '</td><td>' + (f.tooltipText||'-') + '</td><td style="white-space:nowrap;"><button class="rt-action-btn rt-action-btn-edit" onclick="rtcEditField(' + i + ')"><i class="bi bi-pencil"></i></button> <button class="rt-action-btn rt-action-btn-delete" onclick="rtcDeleteField(' + i + ')"><i class="bi bi-trash"></i></button></td></tr>';
    });
    body.innerHTML = html;
}

function rtcGetPropsSummaryCreate(f) {
    try {
        var p = JSON.parse(f.propertiesJson || '{}'), parts = [];
        for (var k in p) {
            if (p[k] === '' || p[k] === false || p[k] === null || p[k] === undefined) continue;
            if (k === 'subName' || k === 'placeholder') continue;
            if (f.fieldType === 'رفع ملف' && (k === 'minFileSize' || k === 'maxFileSize')) continue;
            var def = RT_FIELD_TYPES[f.fieldType];
            if (!def) continue;
            var pDef = def.props.find(function(pp) { return pp.key === k; });
            if (!pDef) continue;
            if (pDef.type === 'checkbox' && p[k]) parts.push(pDef.label); else if (p[k]) parts.push(pDef.label + ': ' + p[k]);
        }
        if (f.fieldType === 'رفع ملف') {
            var mn = p.minFileSize, mx = p.maxFileSize;
            var hasM = mn !== '' && mn != null && mn !== undefined;
            var hasX = mx !== '' && mx != null && mx !== undefined;
            if (hasM || hasX) parts.push('الحد (MB): ' + (hasM ? mn : '—') + ' – ' + (hasX ? mx : '—'));
        }
        return parts.length > 0 ? parts.join(' | ') : '-';
    } catch(e) { return '-'; }
}

async function rtcSubmitTable() {
    var name = document.getElementById('rtcName').value.trim();
    if (!name) { showToast('يرجى إدخال اسم الجدول', 'danger'); return; }
    var rowMode = document.querySelector('input[name="rtcRowMode"]:checked').value;
    var maxRows = rowMode === 'مقيد' ? parseInt(document.getElementById('rtcMaxRows').value, 10) : null;
    if (rowMode === 'مقيد' && (!maxRows || maxRows < 1)) { showToast('يرجى تحديد عدد الصفوف', 'danger'); return; }
    if (rtcFields.length === 0) { showToast('يرجى إضافة حقل واحد على الأقل', 'danger'); return; }
    var reqBody = { name:name, description:document.getElementById('rtcDesc').value.trim(), ownership:document.querySelector('input[name="rtcOwnership"]:checked').value, rowCountMode:rowMode, maxRows:maxRows, columnHeaderColor:rtcGetColumnHeaderColor(), isActive:document.querySelector('input[name="rtcActive"]:checked').value === '1', fields:rtcFields.map(function(f){return{fieldName:f.fieldName,fieldType:f.fieldType,isRequired:f.isRequired,subName:f.subName||'',placeholder:f.placeholder||'',tooltipText:f.tooltipText||'',propertiesJson:f.propertiesJson||'{}'};}) };
    try {
        var r = await apiFetch('/Tables/AddReadyTable', 'POST', reqBody);
        if (r && r.success) {
            showToast(r.message || 'تم إنشاء الجدول بنجاح', 'success');
            var m = bootstrap.Modal.getInstance(document.getElementById('rtCreateModal'));
            if (m) m.hide();
            await rtLoad();
        } else { var err = document.getElementById('rtcCreateError'); err.textContent = (r&&r.message)||'حدث خطأ'; err.classList.remove('d-none'); }
    } catch(e) { showToast('حدث خطأ في الاتصال', 'danger'); }
}

function rtpFieldPlaceholder(f) {
    var ph = ((f.placeholder != null && f.placeholder !== '') ? f.placeholder : (f.tooltipText || '')).replace(/"/g, '&quot;');
    return ph;
}

function rtpFileAcceptFromProps(p) {
    if (!p || p.fileTypes == null || String(p.fileTypes).trim() === '') return '';
    var raw = p.fileTypes;
    var parts = [];
    if (typeof raw === 'string') {
        raw.split(/[,\s;|]+/).forEach(function (s) {
            var x = s.trim().replace(/^\./, '').toLowerCase();
            if (x) parts.push('.' + x);
        });
    }
    return parts.join(',');
}

function rtpBuildFieldInput(f) {
    var ph = rtpFieldPlaceholder(f);
    var props = {};
    try { props = JSON.parse(f.propertiesJson || '{}'); } catch (e) {}
    var defVal = (props.defaultValue != null && props.defaultValue !== '') ? String(props.defaultValue).replace(/"/g, '&quot;') : '';
    var roAttr = props.readOnly ? ' readonly' : '';
    var roSel = props.readOnly ? ' disabled' : '';
    var roStyle = props.readOnly ? 'background:#f3f4f6;cursor:not-allowed;' : '';
    var reqAttr = f.isRequired ? ' required' : '';
    var maxL = (props.maxLength || props.charLimit) ? ' maxlength="' + (props.maxLength || props.charLimit) + '"' : '';
    var minL = props.minLength ? ' minlength="' + props.minLength + '"' : '';
    var wStyle = props.widthPx ? 'width:' + props.widthPx + 'px;' : '';
    var ttAttr = f.tooltipText ? ' title="' + rtEscAttr(f.tooltipText) + '"' : '';
    function mkStyle(extra) { var s = (wStyle + roStyle + (extra || '')).trim(); return s ? ' style="' + s + '"' : ''; }
    var inp = '';

    if (f.fieldType === 'الاسم الكامل' || f.fieldType === 'نص قصير') {
        inp = '<input type="text" class="form-control" placeholder="' + ph + '" value="' + defVal + '"' + reqAttr + maxL + minL + roAttr + ttAttr + mkStyle() + '>';
    } else if (f.fieldType === 'رقم الهاتف') {
        var fmt = props.phoneFormat || '+966 (9 أرقام)';
        if (fmt === '+966 (9 أرقام)') {
            inp = '<div class="input-group" style="direction:ltr;' + wStyle + '"' + ttAttr + '><span class="input-group-text" style="font-weight:700;font-size:13px;background:var(--sa-50);border-color:var(--gray-200);">+966</span><input type="tel" class="form-control" placeholder="5XXXXXXXX" maxlength="9" pattern="[0-9]{9}" value="' + defVal + '"' + reqAttr + roAttr + mkStyle('direction:ltr;') + '></div>';
        } else if (fmt === '05xxxxxxxx (10 أرقام)') {
            inp = '<input type="tel" class="form-control" placeholder="05XXXXXXXX" maxlength="10" pattern="05[0-9]{8}" value="' + (defVal || '') + '"' + reqAttr + roAttr + ttAttr + mkStyle('direction:ltr;') + '>';
        } else if (fmt === 'تلفون') {
            inp = '<input type="tel" class="form-control" placeholder="' + (ph || 'XXXXXXX') + '" value="' + defVal + '"' + reqAttr + maxL + roAttr + ttAttr + mkStyle('direction:ltr;') + '>';
        } else {
            inp = '<div class="input-group" style="direction:ltr;' + wStyle + '"' + ttAttr + '><span class="input-group-text" style="font-weight:700;font-size:13px;background:var(--sa-50);border-color:var(--gray-200);">+</span><input type="tel" class="form-control" placeholder="' + (ph || 'XXX XXXXXXXXX') + '" value="' + defVal + '"' + reqAttr + maxL + roAttr + mkStyle('direction:ltr;') + '></div>';
        }
    } else if (f.fieldType === 'البريد الإلكتروني') {
        var pat = '';
        if (props.emailFormat) {
            pat = ' pattern="[^\\s@]+@almadinah\\.gov\\.sa" title="يجب أن يكون البريد بصيغة اسم@almadinah.gov.sa"';
        }
        inp = '<input type="email" class="form-control" placeholder="' + ph + '" value="' + defVal + '"' + pat + reqAttr + maxL + roAttr + ttAttr + mkStyle() + '>';
    } else if (f.fieldType === 'نص طويل' || f.fieldType === 'فقرة') {
        var dv = (props.defaultValue != null) ? String(props.defaultValue) : '';
        var hPx = props.heightPx ? 'height:' + props.heightPx + 'px;' : '';
        inp = '<textarea class="form-control" rows="3" placeholder="' + ph + '"' + reqAttr + maxL + minL + roAttr + ttAttr + mkStyle(hPx) + '>' + dv.replace(/</g, '&lt;') + '</textarea>';
    } else if (f.fieldType === 'رقم') {
        var numMin = (props.minValue != null && props.minValue !== '') ? ' min="' + props.minValue + '"' : '';
        var numMax = (props.maxValue != null && props.maxValue !== '') ? ' max="' + props.maxValue + '"' : '';
        inp = '<input type="number" class="form-control" placeholder="' + ph + '" value="' + defVal + '"' + numMin + numMax + reqAttr + roAttr + ttAttr + mkStyle() + '>';
    } else if (f.fieldType === 'دوار رقمي') {
        var spMin = (props.minValue != null && props.minValue !== '') ? ' min="' + props.minValue + '"' : '';
        var spMax = (props.maxValue != null && props.maxValue !== '') ? ' max="' + props.maxValue + '"' : '';
        var spStep = (props.stepValue != null && props.stepValue !== '') ? ' step="' + props.stepValue + '"' : ' step="1"';
        var spNoD = props.noDecimals ? ' step="1"' : spStep;
        inp = '<div class="input-group rt-spinner-group" style="' + wStyle + '"' + ttAttr + '><button type="button" class="btn btn-outline-secondary rt-spin-btn" onclick="rtSpinDec(this)" style="border-radius:8px 0 0 8px;padding:4px 10px;font-size:16px;font-weight:700;">−</button><input type="number" class="form-control text-center rt-spin-input" value="' + (defVal || props.minValue || '0') + '"' + spMin + spMax + spNoD + reqAttr + (props.readOnly ? ' readonly style="background:#f3f4f6;"' : '') + '><button type="button" class="btn btn-outline-secondary rt-spin-btn" onclick="rtSpinInc(this)" style="border-radius:0 8px 8px 0;padding:4px 10px;font-size:16px;font-weight:700;">+</button></div>';
    } else if (f.fieldType === 'التقييم بالأرقام') {
        var arMin = (props.minRating != null && props.minRating !== '') ? props.minRating : '0';
        var arMax = (props.maxRating != null && props.maxRating !== '') ? props.maxRating : '10';
        inp = '<div' + ttAttr + '><input type="range" class="form-range" min="' + arMin + '" max="' + arMax + '" value="' + (defVal || arMin) + '" oninput="this.nextElementSibling.textContent=this.value"><div class="text-center fw-bold" style="font-size:14px;">' + (defVal || arMin) + '</div>';
        var lo = props.lowRatingText ? '<span class="text-muted" style="font-size:11px;">' + rtEscAttr(props.lowRatingText) + '</span>' : '';
        var hi = props.highRatingText ? '<span class="text-muted" style="font-size:11px;">' + rtEscAttr(props.highRatingText) + '</span>' : '';
        if (lo || hi) inp += '<div class="d-flex justify-content-between">' + lo + hi + '</div>';
        inp += '</div>';
    } else if (f.fieldType === 'قائمة منسدلة' || f.fieldType === 'قائمة اختيار الواحد') {
        var opts = [];
        if (props.options) opts = String(props.options).split(/[\r\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        var emptyText = (props.emptyText || '').trim();
        var defaultOpt = (props.defaultOption || '').trim();
        var firstLabel = emptyText || ph || 'اختر...';
        inp = '<select class="form-select"' + reqAttr + roSel + ttAttr + mkStyle() + '>';
        inp += '<option value="">' + String(firstLabel).replace(/</g, '&lt;') + '</option>';
        opts.forEach(function (o) {
            var sel = (defaultOpt && o === defaultOpt) ? ' selected' : '';
            inp += '<option value="' + String(o).replace(/"/g, '&quot;') + '"' + sel + '>' + String(o).replace(/</g, '&lt;') + '</option>';
        });
        inp += '</select>';
    } else if (f.fieldType === 'قائمة اختيار متعدد') {
        var opts2 = [];
        if (props.options) opts2 = String(props.options).split(/[\r\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        var defaultSet = {};
        String(props.defaultOption || '').split(/,\s*/).forEach(function (d) {
            var t = d.trim();
            if (t) defaultSet[t] = true;
        });
        inp = '<div class="d-flex flex-wrap gap-2"' + ttAttr + '>';
        opts2.forEach(function (o) {
            var chk = defaultSet[o] ? ' checked' : '';
            var dis = props.readOnly ? ' disabled' : '';
            inp += '<div class="form-check mb-0"><input class="form-check-input" type="checkbox"' + chk + dis + '><label class="form-check-label">' + String(o).replace(/</g, '&lt;') + '</label></div>';
        });
        if (opts2.length === 0) inp += '<span class="text-muted">—</span>';
        inp += '</div>';
    } else if (f.fieldType === 'تاريخ') {
        inp = '<input type="date" class="form-control" value="' + defVal + '"' + reqAttr + roAttr + ttAttr + mkStyle() + '>';
    } else if (f.fieldType === 'وقت') {
        var tfmt = props.timeFormat || '';
        inp = '<input type="time" class="form-control" value="' + defVal + '"' + reqAttr + roAttr + ttAttr + mkStyle() + (tfmt === '24 ساعة' ? '' : ' step="3600"') + '>';
    } else if (f.fieldType === 'رفع ملف') {
        var acc = rtpFileAcceptFromProps(props);
        inp = '<input type="file" class="form-control form-control-sm"' + (acc ? ' accept="' + acc.replace(/"/g, '') + '"' : '') + reqAttr + ttAttr + '>';
    } else if (f.fieldType === 'التقييم بالنجوم') {
        var range = parseInt(props.ratingRange) || 5;
        var icon = props.ratingIcon || 'نجمة';
        var starChar = icon === 'قلب' ? '♥' : icon === 'إبهام' ? '👍' : '★';
        var sdef = parseInt(defVal) || 0;
        inp = '<div class="rt-star-rating d-flex gap-1 align-items-center"' + ttAttr + ' data-val="' + sdef + '">';
        for (var si = 1; si <= range; si++) {
            var active = si <= sdef ? 'color:#f59e0b;' : 'color:#d1d5db;';
            inp += '<span class="rt-star-icon" data-i="' + si + '" style="font-size:22px;cursor:pointer;' + active + '" onclick="rtStarClick(this,' + si + ')">' + starChar + '</span>';
        }
        inp += '<span class="rt-star-val ms-2 fw-bold" style="font-size:13px;">' + sdef + '/' + range + '</span></div>';
    } else {
        inp = '<input type="text" class="form-control" placeholder="' + ph + '" value="' + defVal + '"' + reqAttr + maxL + minL + roAttr + ttAttr + mkStyle() + '>';
    }
    var subName = (f.subName || props.subName || '').trim();
    if (subName) {
        inp += '<div class="rt-field-subname">' + subName.replace(/</g, '&lt;') + '</div>';
    }
    return inp;
}

function rtSpinInc(btn) {
    var inp = btn.parentElement.querySelector('.rt-spin-input');
    if (!inp) return;
    var step = parseFloat(inp.step) || 1;
    var max = inp.max !== '' ? parseFloat(inp.max) : Infinity;
    var v = parseFloat(inp.value) || 0;
    if (v + step <= max) inp.value = +(v + step).toFixed(4);
}
function rtSpinDec(btn) {
    var inp = btn.parentElement.querySelector('.rt-spin-input');
    if (!inp) return;
    var step = parseFloat(inp.step) || 1;
    var min = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
    var v = parseFloat(inp.value) || 0;
    if (v - step >= min) inp.value = +(v - step).toFixed(4);
}
function rtStarClick(el, idx) {
    var wrap = el.closest('.rt-star-rating');
    if (!wrap) return;
    wrap.setAttribute('data-val', idx);
    var stars = wrap.querySelectorAll('.rt-star-icon');
    stars.forEach(function(s) {
        var i = parseInt(s.getAttribute('data-i'));
        s.style.color = (i <= idx) ? '#f59e0b' : '#d1d5db';
    });
    var lbl = wrap.querySelector('.rt-star-val');
    if (lbl) lbl.textContent = idx + '/' + stars.length;
}

function rtpBuildRowHtml() {
    var html = '<tr>';
    rtcFields.forEach(function(f) { html += '<td>' + rtpBuildFieldInput(f) + '</td>'; });
    return html + '</tr>';
}

var rtpPreviewFields = [];
function rtpAddRow(btn) {
    var tbody = document.getElementById('rtpPreviewTbody');
    var addRow = document.getElementById('rtpAddRowTr');
    if (!tbody || !addRow) return;
    var fields = rtpPreviewFields.length ? rtpPreviewFields : rtcFields;
    var tr = document.createElement('tr');
    tr.innerHTML = fields.map(function(f){ return '<td>' + rtpBuildFieldInput(f) + '</td>'; }).join('');
    tbody.insertBefore(tr, addRow);
}

function rtcShowPreview() {
    var name = document.getElementById('rtcName').value.trim();
    var desc = document.getElementById('rtcDesc').value.trim();
    var ownership = document.querySelector('input[name="rtcOwnership"]:checked').value;
    var rowMode = document.querySelector('input[name="rtcRowMode"]:checked').value;
    var maxRowsVal = rowMode === 'مقيد' ? document.getElementById('rtcMaxRows').value : '';
    var numRows = rowMode === 'مقيد' ? (parseInt(maxRowsVal, 10) || 1) : 1;
    var isActive = document.querySelector('input[name="rtcActive"]:checked').value === '1';
    var headerColor = rtcGetColumnHeaderColor() || '#f3f4f6';

    var previewInline = document.getElementById('rtcPreviewInline');
    var body = document.getElementById('rtPreviewBody');
    if (rtcFields.length === 0) {
        if (previewInline) previewInline.classList.remove('d-none');
        if (previewInline) previewInline.scrollIntoView({ behavior:'smooth', block:'center' });
        showToast('يرجى إضافة حقول أولاً لكي تتم المعاينة', 'info');
        return;
    }
    if (previewInline) previewInline.classList.add('d-none');
    rtpPreviewFields = [];

    var html = '<div class="mb-4 pb-3 border-bottom"><div class="row"><div class="col-md-6"><strong>اسم الجدول:</strong> ' + (name || '—') + '</div><div class="col-md-6"><strong>الوصف:</strong> ' + (desc || '—') + '</div></div><div class="mt-2 text-muted" style="font-size:13px;"><strong>الملكية:</strong> ' + ownership + ' | <strong>عدد الصفوف:</strong> ' + (rowMode === 'مقيد' ? 'مقيد' : 'مفتوح') + ' | <strong>التفعيل:</strong> ' + (isActive ? 'مفعل' : 'معطل') + ' | <strong>عدد الحقول:</strong> ' + rtcFields.length + '</div></div>';
    html += '<p class="mb-3 fw-bold" style="font-size:15px;">نموذج الجدول - مطلوب تعبئته: <span class="text-muted" style="font-size:13px;font-weight:normal;">(مرّر أفقياً لعرض جميع الحقول)</span></p>';
    html += '<div class="rt-preview-wrap"><table class="table rt-preview-form-table mb-0"><thead><tr class="rt-preview-thead-row">';
    rtcFields.forEach(function(f) {
        var ttip = f.tooltipText ? ' title="' + rtEscAttr(f.tooltipText) + '" style="background:' + headerColor + ' !important;color:#1f2937 !important;cursor:help;"' : ' style="background:' + headerColor + ' !important;color:#1f2937 !important;"';
        html += '<th' + ttip + '>' + f.fieldName + (f.isRequired ? ' <span class="required-star">*</span>' : '') + (f.tooltipText ? ' <i class="bi bi-info-circle" style="font-size:11px;opacity:.5;"></i>' : '') + '</th>';
    });
    html += '</tr></thead><tbody id="rtpPreviewTbody">';
    for (var i = 0; i < numRows; i++) { html += rtpBuildRowHtml(); }
    if (rowMode === 'مفتوح') {
        html += '<tr id="rtpAddRowTr"><td colspan="' + rtcFields.length + '" style="padding:12px;text-align:center;border:1px dashed #e5e7eb;"><button type="button" class="rt-add-fields-btn" onclick="rtpAddRow(this)"><i class="bi bi-plus-circle"></i> إضافة صف</button></td></tr>';
    }
    html += '</tbody></table></div>';

    body.innerHTML = html;

    var createModal = document.getElementById('rtCreateModal');
    var previewModalEl = document.getElementById('rtPreviewModal');
    var createModalInstance = bootstrap.Modal.getInstance(createModal);

    function showPreviewModal() {
        var pm = new bootstrap.Modal(previewModalEl);
        previewModalEl.addEventListener('hidden.bs.modal', function onPreviewHidden() {
            if (createModalInstance) createModalInstance.show();
        }, { once: true });
        pm.show();
    }

    if (createModalInstance) {
        createModal.addEventListener('hidden.bs.modal', showPreviewModal, { once: true });
        createModalInstance.hide();
    } else {
        showPreviewModal();
    }
}

/* ===== Details Modal ===== */
async function rtShowDetails(id) {
    try {
        var r = await apiFetch('/Tables/GetReadyTableDetails?id=' + id);
        if (!r || !r.success) { showToast((r && r.message) || 'خطأ', 'danger'); return; }
        var d = r.data;
        var rowLabel = d.rowCountMode === 'مقيد' ? 'مقيد' : 'مفتوح';
        var actLabel = d.isActive ? '<span class="rt-badge-active">مفعل</span>' : '<span class="rt-badge-inactive">معطل</span>';
        var colorBox = d.columnHeaderColor ? '<span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:' + d.columnHeaderColor + ';border:1px solid #ccc;vertical-align:middle;"></span>' : 'بدون لون';

        var html = '<div class="rt-section"><div class="rt-section-title">معلومات الجدول</div>';
        html += '<table class="table table-sm mb-0"><tbody>';
        html += '<tr><th style="width:35%;">الترتيب</th><td>' + d.sortOrder + '</td></tr>';
        html += '<tr><th>اسم الجدول</th><td>' + d.name + '</td></tr>';
        html += '<tr><th>الوصف</th><td>' + (d.description || '-') + '</td></tr>';
        html += '<tr><th>الملكية</th><td>' + d.ownership + '</td></tr>';
        html += '<tr><th>عدد الصفوف</th><td>' + rowLabel + '</td></tr>';
        html += '<tr><th>الوحدة التنظيمية المالكة</th><td>' + d.organizationalUnitName + '</td></tr>';
        html += '<tr><th>خلفية حقول الأعمدة</th><td>' + colorBox + '</td></tr>';
        html += '<tr><th>التفعيل</th><td>' + actLabel + '</td></tr>';
        html += '<tr><th>أنشئ بواسطة</th><td>' + (d.createdBy || '-') + '</td></tr>';
        html += '<tr><th>تاريخ الإنشاء</th><td>' + (d.createdAt || '-') + '</td></tr>';
        html += '<tr><th>تحديث بواسطة</th><td>' + (d.updatedBy || '-') + '</td></tr>';
        html += '<tr><th>تاريخ التحديث</th><td>' + (d.updatedAt || '-') + '</td></tr>';
        html += '</tbody></table></div>';

        if (d.fields && d.fields.length > 0) {
            html += '<div class="rt-section"><div class="rt-section-title">حقول الجدول (' + d.fields.length + ')</div>';
            html += '<div class="table-responsive"><table class="table table-sm mb-0"><thead><tr>';
            html += '<th>رقم</th><th>نوع الحقل</th><th>اسم الحقل</th><th>إلزامي</th><th>التلميح</th><th>الخصائص</th>';
            html += '</tr></thead><tbody>';
            d.fields.forEach(function(f) {
                var reqBadge = f.isRequired ? '<span class="rt-field-badge-req">نعم</span>' : '<span class="rt-field-badge-opt">لا</span>';
                var propsSummary = rtGetPropsSummary(f);
                html += '<tr><td>' + f.sortOrder + '</td><td>' + f.fieldType + '</td><td>' + f.fieldName + '</td><td>' + reqBadge + '</td><td>' + (f.tooltipText || '-') + '</td><td style="font-size:11px;">' + propsSummary + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        document.getElementById('rtDetailsBody').innerHTML = html;
        new bootstrap.Modal(document.getElementById('rtDetailsModal')).show();
    } catch(e) { showToast('خطأ في جلب البيانات', 'danger'); }
}

function rtGetPropsSummary(f) {
    try {
        var p = JSON.parse(f.propertiesJson || '{}');
        var parts = [];
        for (var k in p) {
            if (p[k] === '' || p[k] === false || p[k] === null || p[k] === undefined) continue;
            if (k === 'subName' || k === 'placeholder') continue;
            if (f.fieldType === 'رفع ملف' && (k === 'minFileSize' || k === 'maxFileSize')) continue;
            var def = RT_FIELD_TYPES[f.fieldType];
            if (!def) continue;
            var pDef = def.props.find(function(pp) { return pp.key === k; });
            if (!pDef) continue;
            if (pDef.type === 'checkbox' && p[k]) parts.push(pDef.label);
            else if (p[k]) parts.push(pDef.label + ': ' + p[k]);
        }
        if (f.fieldType === 'رفع ملف') {
            var mn = p.minFileSize, mx = p.maxFileSize;
            var hasM = mn !== '' && mn != null && mn !== undefined;
            var hasX = mx !== '' && mx != null && mx !== undefined;
            if (hasM || hasX) parts.push('الحد (MB): ' + (hasM ? mn : '—') + ' – ' + (hasX ? mx : '—'));
        }
        return parts.length > 0 ? parts.join(' | ') : '-';
    } catch(e) { return '-'; }
}

/* ===== Edit Modal ===== */
var rtEditFields = [], rtEditEditingIndex = -1;

async function rtShowEditModal(id) {
    if (id == null || id === '' || isNaN(parseInt(id, 10))) {
        showToast('معرّف الجدول غير صحيح', 'danger');
        return;
    }
    try {
        var r = await apiFetch('/Tables/GetReadyTableDetails?id=' + encodeURIComponent(id));
        if (!r) { showToast('خطأ في الاتصال بالخادم', 'danger'); return; }
        if (!r.success) { showToast((r.message) || 'خطأ', 'danger'); return; }
        var d = r.data;
        if (!d) { showToast('لم يتم استلام بيانات الجدول', 'danger'); return; }
        var elId = document.getElementById('rtEditId');
        if (!elId) { console.error('rtEditId not found'); showToast('خطأ في تحميل النموذج', 'danger'); return; }
        elId.value = d.id;
        document.getElementById('rtEditName').value = d.name;
        document.getElementById('rtEditDescription').value = d.description || '';
        document.getElementById('rtEditSortOrder').value = d.sortOrder;

        if (d.rowCountMode === 'مقيد') {
            document.getElementById('rtEditRowRestricted').checked = true;
            document.getElementById('rtEditMaxRowsWrap').style.display = 'block';
            document.getElementById('rtEditMaxRows').value = d.maxRows || '';
        } else {
            document.getElementById('rtEditRowOpen').checked = true;
            document.getElementById('rtEditMaxRowsWrap').style.display = 'none';
        }

        if (d.ownership === 'خاص') document.getElementById('rtEditOwnershipPrivate').checked = true;
        else document.getElementById('rtEditOwnershipPublic').checked = true;

        rtEditApplyColumnHeaderColorFromValue(d.columnHeaderColor || '');

        if (d.isActive) document.getElementById('rtEditIsActiveOn').checked = true;
        else document.getElementById('rtEditIsActiveOff').checked = true;

        rtEditFields = (d.fields || []).map(function(f) { return {
            fieldName: f.fieldName, fieldType: f.fieldType, isRequired: f.isRequired,
            subName: f.subName || '', placeholder: f.placeholder || '',
            tooltipText: f.tooltipText || '', propertiesJson: f.propertiesJson || '{}'
        };});
        rtEditEditingIndex = -1;
        rtEditRenderFieldsTable();
        rtEditResetFieldForm();
        document.getElementById('rtEditFieldsSection').style.display = (rtEditFields.length > 0 ? 'block' : 'none');
        document.getElementById('rtEditError').classList.add('d-none');
        var pi = document.getElementById('rtEditPreviewInline');
        if (pi) pi.classList.add('d-none');
        new bootstrap.Modal(document.getElementById('rtEditModal')).show();
    } catch(e) {
        console.error('rtShowEditModal error:', e);
        showToast((e && e.message) ? ('خطأ: ' + e.message) : 'خطأ في جلب البيانات', 'danger');
    }
}

function rtEditShowFieldsSection() {
    var name = document.getElementById('rtEditName').value.trim();
    if (!name) { showToast('يرجى إدخال اسم الجدول أولاً', 'danger'); return; }
    var rowMode = document.querySelector('input[name="rtEditRowMode"]:checked').value;
    if (rowMode === 'مقيد') {
        var mx = parseInt(document.getElementById('rtEditMaxRows').value, 10);
        if (!mx || mx < 1) { showToast('يرجى تحديد عدد الصفوف', 'danger'); return; }
    }
    document.getElementById('rtEditFieldsSection').style.display = 'block';
    document.getElementById('rtEditFieldsSection').scrollIntoView({ behavior:'smooth' });
}

function rtEditOnFieldTypeChange() {
    var type = document.getElementById('rtEditFieldType').value;
    var area = document.getElementById('rtEditPropsArea');
    var container = document.getElementById('rtEditPropsFields');
    var cell = document.getElementById('rtEditPropsCell');
    if (!type || !RT_FIELD_TYPES[type]) {
        area.style.display = 'none';
        container.innerHTML = '';
        cell.innerHTML = '<span class="text-muted" style="font-size:11px;">اختر نوع الحقل أولاً</span>';
        return;
    }
    var def = RT_FIELD_TYPES[type];
    area.style.display = 'block';
    cell.innerHTML = '<span style="font-size:11px;color:var(--sa-600);"><i class="bi bi-check-circle-fill"></i> ' + def.props.length + ' خاصية</span>';
    var html = '<div class="row g-2">';
    var cbStarted2 = false;
    def.props.forEach(function (p) {
        if (p.type === 'checkbox' && !cbStarted2) {
            cbStarted2 = true;
            html += '<div class="col-12"><hr style="border-color:var(--gray-200);margin:8px 0 4px;"><div style="font-size:11px;font-weight:700;color:var(--gray-400);margin-bottom:6px;"><i class="bi bi-toggles"></i> خيارات التفعيل</div></div>';
        }
        html += rtBuildSinglePropHtml(p, 'rtEditProp');
    });
    html += '</div>';
    container.innerHTML = html;
    rtApplyPropsSpecialEditors(type, 'rtEditProp', null);
    if (type === 'رقم الهاتف') {
        var pfmt2 = document.getElementById('rtEditProp_phoneFormat');
        if (pfmt2 && !pfmt2.value) pfmt2.value = '+966 (9 أرقام)';
    }
    var tooltip = document.getElementById('rtEditFieldTooltip');
    if (tooltip && !tooltip.value) {
        var defaults = { "الاسم الكامل":"أدخل الاسم الكامل","البريد الإلكتروني":"أدخل البريد الإلكتروني","رقم الهاتف":"أدخل رقم الهاتف","نص قصير":"أدخل النص","نص طويل":"أدخل النص","فقرة":"أدخل الفقرة","رقم":"أدخل الرقم","قائمة منسدلة":"اختر من القائمة","قائمة اختيار الواحد":"اختر خياراً واحداً","قائمة اختيار متعدد":"اختر خياراً أو أكثر","تاريخ":"اختر التاريخ","وقت":"اختر الوقت","رفع ملف":"ارفع ملفاً","دوار رقمي":"حدد الرقم","التقييم بالنجوم":"حدد التقييم","التقييم بالأرقام":"حدد التقييم" };
        tooltip.value = defaults[type] || "أدخل قيمة الحقل";
    }
}

function rtEditCollectProps() {
    var type = document.getElementById('rtEditFieldType').value;
    if (!type || !RT_FIELD_TYPES[type]) return {};
    var def = RT_FIELD_TYPES[type], result = {};
    def.props.forEach(function (p) {
        if (p.type === 'optionList' || p.type === 'fileTypesPick') return;
        if (p.type === 'fileMbLimitsPair') {
            var mn = document.getElementById('rtEditProp_minFileSize');
            var mx = document.getElementById('rtEditProp_maxFileSize');
            if (mn) result.minFileSize = mn.value;
            if (mx) result.maxFileSize = mx.value;
            return;
        }
        var el = document.getElementById('rtEditProp_' + p.key);
        if (!el) return;
        if (p.type === 'checkbox') result[p.key] = el.checked; else result[p.key] = el.value;
    });
    return rtMergeSpecialPropsIntoResult(type, 'rtEditProp', result);
}

function rtEditSetProps(type, propsObj) {
    if (!type || !RT_FIELD_TYPES[type]) return;
    var def = RT_FIELD_TYPES[type];
    var po = propsObj || {};
    def.props.forEach(function (p) {
        if (p.type === 'optionList' || p.type === 'fileTypesPick') return;
        if (p.type === 'fileMbLimitsPair') {
            var mn = document.getElementById('rtEditProp_minFileSize');
            var mx = document.getElementById('rtEditProp_maxFileSize');
            if (mn && po.minFileSize !== undefined && po.minFileSize !== null) mn.value = po.minFileSize;
            if (mx && po.maxFileSize !== undefined && po.maxFileSize !== null) mx.value = po.maxFileSize;
            return;
        }
        var el = document.getElementById('rtEditProp_' + p.key);
        if (!el) return;
        var v = po[p.key];
        if (p.type === 'checkbox') el.checked = !!v; else if (v !== undefined && v !== null) el.value = v;
    });
    rtApplyPropsSpecialEditors(type, 'rtEditProp', po);
}

function rtEditAddField() {
    var type = document.getElementById('rtEditFieldType').value;
    var name = document.getElementById('rtEditFieldName').value.trim();
    if (!type) { showToast('يرجى اختيار نوع الحقل', 'danger'); return; }
    if (!name) { showToast('يرجى إدخال اسم الحقل', 'danger'); return; }
    var defPre2 = RT_FIELD_TYPES[type];
    if (defPre2 && defPre2.props.some(function (p) { return p.type === 'optionList'; })) {
        var oc2 = rtCollectOptionListFromEditor('rtEditProp');
        if (!oc2 || !String(oc2.options || '').trim()) { showToast('يرجى إدخال خيار واحد على الأقل للقائمة', 'danger'); return; }
    }
    var props = rtEditCollectProps();
    var field = { fieldType:type, fieldName:name, isRequired:document.getElementById('rtEditFieldRequired').value === '1', subName:props.subName||'', placeholder:props.placeholder||'', tooltipText:document.getElementById('rtEditFieldTooltip').value.trim(), propertiesJson:JSON.stringify(props) };
    if (rtEditEditingIndex >= 0) { rtEditFields[rtEditEditingIndex] = field; rtEditEditingIndex = -1; showToast('تم تحديث الحقل', 'success'); } else { rtEditFields.push(field); showToast('تم إضافة الحقل', 'success'); }
    rtEditResetFieldForm();
    rtEditRenderFieldsTable();
}

function rtEditResetFieldForm() {
    var fn = document.getElementById('rtEditFieldNum');
    if (fn) fn.textContent = (rtEditFields.length + 1).toString();
    var ft = document.getElementById('rtEditFieldType');
    if (ft) ft.value = '';
    var fname = document.getElementById('rtEditFieldName');
    if (fname) fname.value = '';
    var req = document.getElementById('rtEditFieldRequired');
    if (req) req.value = '1';
    var tip = document.getElementById('rtEditFieldTooltip');
    if (tip) tip.value = '';
    var area = document.getElementById('rtEditPropsArea');
    if (area) area.style.display = 'none';
    var fields = document.getElementById('rtEditPropsFields');
    if (fields) fields.innerHTML = '';
    var cell = document.getElementById('rtEditPropsCell');
    if (cell) cell.innerHTML = '<span class="text-muted" style="font-size:11px;">اختر نوع الحقل أولاً</span>';
    rtEditEditingIndex = -1;
}

function rtEditEditField(idx) {
    var f = rtEditFields[idx];
    if (!f) return;
    rtEditEditingIndex = idx;
    document.getElementById('rtEditFieldType').value = f.fieldType;
    document.getElementById('rtEditFieldName').value = f.fieldName;
    document.getElementById('rtEditFieldRequired').value = f.isRequired ? '1' : '0';
    document.getElementById('rtEditFieldTooltip').value = f.tooltipText || '';
    document.getElementById('rtEditFieldNum').textContent = (idx + 1).toString();
    rtEditOnFieldTypeChange();
    try { var p = JSON.parse(f.propertiesJson || '{}'); rtEditSetProps(f.fieldType, p); } catch(e) {}
    document.getElementById('rtEditFieldsSection').scrollIntoView({ behavior:'smooth' });
}

function rtEditDeleteField(idx) {
    rtEditFields.splice(idx, 1);
    if (rtEditEditingIndex === idx) rtEditResetFieldForm(); else if (rtEditEditingIndex > idx) rtEditEditingIndex--;
    rtEditRenderFieldsTable();
    rtEditResetFieldForm();
}

function rtEditRenderFieldsTable() {
    var body = document.getElementById('rtEditFieldsBody');
    var count = document.getElementById('rtEditFieldsCount');
    if (count) count.textContent = String(rtEditFields.length);
    var fn = document.getElementById('rtEditFieldNum');
    if (fn) fn.textContent = (rtEditEditingIndex >= 0 ? rtEditEditingIndex + 1 : rtEditFields.length + 1).toString();
    if (!body) { console.warn('rtEditFieldsBody not found'); return; }
    if (rtEditFields.length === 0) { body.innerHTML = '<tr><td colspan="7" class="text-muted text-center py-3">لا توجد حقول مضافة بعد</td></tr>'; return; }
    var html = '';
    rtEditFields.forEach(function(f, i) {
        var reqBadge = f.isRequired ? '<span class="rt-field-badge-req">نعم</span>' : '<span class="rt-field-badge-opt">لا</span>';
        var propsText = rtcGetPropsSummaryCreate(f);
        html += '<tr><td>' + (i+1) + '</td><td>' + f.fieldType + '</td><td>' + f.fieldName + '</td><td>' + reqBadge + '</td><td style="font-size:11px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + propsText.replace(/"/g,'&quot;') + '">' + propsText + '</td><td>' + (f.tooltipText||'-') + '</td><td style="white-space:nowrap;"><button class="rt-action-btn rt-action-btn-edit" onclick="rtEditEditField(' + i + ')"><i class="bi bi-pencil"></i></button> <button class="rt-action-btn rt-action-btn-delete" onclick="rtEditDeleteField(' + i + ')"><i class="bi bi-trash"></i></button></td></tr>';
    });
    body.innerHTML = html;
}

function rtEditShowPreview() {
    var name = document.getElementById('rtEditName').value.trim();
    var desc = document.getElementById('rtEditDescription').value.trim();
    var ownership = document.querySelector('input[name="rtEditOwnership"]:checked').value;
    var rowMode = document.querySelector('input[name="rtEditRowMode"]:checked').value;
    var maxRowsVal = rowMode === 'مقيد' ? document.getElementById('rtEditMaxRows').value : '';
    var numRows = rowMode === 'مقيد' ? (parseInt(maxRowsVal, 10) || 1) : 1;
    var isActive = document.querySelector('input[name="rtEditIsActive"]:checked').value === '1';
    var headerColor = rtEditGetColumnHeaderColor() || '#f3f4f6';

    var previewInline = document.getElementById('rtEditPreviewInline');
    var body = document.getElementById('rtPreviewBody');
    if (rtEditFields.length === 0) {
        if (previewInline) previewInline.classList.remove('d-none');
        if (previewInline) previewInline.scrollIntoView({ behavior:'smooth', block:'center' });
        showToast('يرجى إضافة حقول أولاً لكي تتم المعاينة', 'info');
        return;
    }
    if (previewInline) previewInline.classList.add('d-none');
    rtpPreviewFields = rtEditFields.slice();

    var html = '<div class="mb-4 pb-3 border-bottom"><div class="row"><div class="col-md-6"><strong>اسم الجدول:</strong> ' + (name || '—') + '</div><div class="col-md-6"><strong>الوصف:</strong> ' + (desc || '—') + '</div></div><div class="mt-2 text-muted" style="font-size:13px;"><strong>الملكية:</strong> ' + ownership + ' | <strong>عدد الصفوف:</strong> ' + (rowMode === 'مقيد' ? 'مقيد' : 'مفتوح') + ' | <strong>التفعيل:</strong> ' + (isActive ? 'مفعل' : 'معطل') + ' | <strong>عدد الحقول:</strong> ' + rtEditFields.length + '</div></div>';
    html += '<p class="mb-3 fw-bold" style="font-size:15px;">نموذج الجدول - مطلوب تعبئته: <span class="text-muted" style="font-size:13px;font-weight:normal;">(مرّر أفقياً لعرض جميع الحقول)</span></p>';
    html += '<div class="rt-preview-wrap"><table class="table rt-preview-form-table mb-0"><thead><tr class="rt-preview-thead-row">';
    rtEditFields.forEach(function(f) {
        var ttip = f.tooltipText ? ' title="' + rtEscAttr(f.tooltipText) + '" style="background:' + headerColor + ' !important;color:#1f2937 !important;cursor:help;"' : ' style="background:' + headerColor + ' !important;color:#1f2937 !important;"';
        html += '<th' + ttip + '>' + f.fieldName + (f.isRequired ? ' <span class="required-star">*</span>' : '') + (f.tooltipText ? ' <i class="bi bi-info-circle" style="font-size:11px;opacity:.5;"></i>' : '') + '</th>';
    });
    html += '</tr></thead><tbody id="rtpPreviewTbody">';
    for (var i = 0; i < numRows; i++) {
        html += '<tr>';
        rtEditFields.forEach(function(f) { html += '<td>' + rtpBuildFieldInput(f) + '</td>'; });
        html += '</tr>';
    }
    if (rowMode === 'مفتوح') {
        html += '<tr id="rtpAddRowTr"><td colspan="' + rtEditFields.length + '" style="padding:12px;text-align:center;border:1px dashed #e5e7eb;"><button type="button" class="rt-add-fields-btn" onclick="rtpAddRow(this)"><i class="bi bi-plus-circle"></i> إضافة صف</button></td></tr>';
    }
    html += '</tbody></table></div>';

    body.innerHTML = html;
    var editModal = document.getElementById('rtEditModal');
    var previewModalEl = document.getElementById('rtPreviewModal');
    var editModalInstance = bootstrap.Modal.getInstance(editModal);

    function showPreviewModal() {
        var pm = new bootstrap.Modal(previewModalEl);
        previewModalEl.addEventListener('hidden.bs.modal', function onPreviewHidden() {
            if (editModalInstance) editModalInstance.show();
        }, { once: true });
        pm.show();
    }
    if (editModalInstance) {
        editModal.addEventListener('hidden.bs.modal', showPreviewModal, { once: true });
        editModalInstance.hide();
    } else {
        showPreviewModal();
    }
}

function rtToggleRowMode(mode) {
    if (mode === 'edit') {
        var v = document.querySelector('input[name="rtEditRowMode"]:checked').value;
        document.getElementById('rtEditMaxRowsWrap').style.display = v === 'مقيد' ? 'block' : 'none';
    }
}

async function rtSubmitEdit() {
    var id = parseInt(document.getElementById('rtEditId').value);
    var name = document.getElementById('rtEditName').value.trim();
    var errEl = document.getElementById('rtEditError');
    if (!name) { errEl.textContent = 'اسم الجدول مطلوب'; errEl.classList.remove('d-none'); return; }
    var rowMode = document.querySelector('input[name="rtEditRowMode"]:checked').value;
    if (rowMode === 'مقيد') {
        var maxRows = parseInt(document.getElementById('rtEditMaxRows').value, 10);
        if (!maxRows || maxRows < 1) { errEl.textContent = 'يرجى تحديد عدد الصفوف'; errEl.classList.remove('d-none'); return; }
    }
    if (rtEditFields.length === 0) { errEl.textContent = 'يرجى إضافة حقل واحد على الأقل'; errEl.classList.remove('d-none'); return; }

    var body = {
        id: id,
        name: name,
        description: document.getElementById('rtEditDescription').value.trim(),
        sortOrder: parseInt(document.getElementById('rtEditSortOrder').value) || 0,
        rowCountMode: document.querySelector('input[name="rtEditRowMode"]:checked').value,
        maxRows: parseInt(document.getElementById('rtEditMaxRows').value) || null,
        ownership: document.querySelector('input[name="rtEditOwnership"]:checked').value,
        columnHeaderColor: rtEditGetColumnHeaderColor(),
        isActive: document.querySelector('input[name="rtEditIsActive"]:checked').value === '1',
        fields: rtEditFields.map(function(f) { return {
            fieldName: f.fieldName, fieldType: f.fieldType, isRequired: f.isRequired,
            subName: f.subName || '', placeholder: f.placeholder || '',
            tooltipText: f.tooltipText || '', propertiesJson: f.propertiesJson || '{}'
        };})
    };

    try {
        var r = await apiFetch('/Tables/UpdateReadyTable', 'POST', body);
        if (r && r.success) {
            showToast(r.message || 'تم التحديث', 'success');
            var editModal = bootstrap.Modal.getInstance(document.getElementById('rtEditModal'));
            if (editModal) editModal.hide();
            await rtLoad();
        } else {
            errEl.textContent = (r && r.message) || 'حدث خطأ';
            errEl.classList.remove('d-none');
        }
    } catch(e) { errEl.textContent = 'خطأ في الاتصال'; errEl.classList.remove('d-none'); }
}

/* ===== Delete ===== */
function rtShowDeleteModal(id, name) {
    document.getElementById('rtDeleteId').value = id;
    document.getElementById('rtDeleteNameLabel').textContent = name;
    document.getElementById('rtDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('rtDeleteModal')).show();
}

async function rtSubmitDelete() {
    var id = parseInt(document.getElementById('rtDeleteId').value);
    try {
        var r = await apiFetch('/Tables/DeleteReadyTable', 'POST', {id:id});
        if (r && r.success) {
            showToast(r.message || 'تم الحذف', 'success');
            var delModal = bootstrap.Modal.getInstance(document.getElementById('rtDeleteModal'));
            if (delModal) delModal.hide();
            await rtLoad();
        } else {
            var errEl = document.getElementById('rtDeleteError');
            errEl.textContent = (r && r.message) || 'خطأ';
            errEl.classList.remove('d-none');
        }
    } catch(e) { showToast('خطأ في الاتصال', 'danger'); }
}
