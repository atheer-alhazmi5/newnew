/* ===== Ready Tables JS (Index Page) ===== */
var rtAllData = [], rtFilteredData = [], rtOrgUnits = [], rtCurrentUser = '', rtIsAdmin = false;
var rtcFields = [], rtcEditingIndex = -1, rtcSelectedColor = '';

var RT_FIELD_TYPES = {
    "الاسم الكامل": {
        props: [
            { key:"subName", label:"اسم فرعي", type:"text" },
            { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"مثال: 300" },
            { key:"charLimit", label:"حد الأحرف", type:"number" },
            { key:"minLength", label:"الحد الأدنى", type:"number" },
            { key:"maxLength", label:"الحد الأقصى", type:"number" },
            { key:"fieldCount", label:"عدد الحقول", type:"number", placeholder:"مثال: 3" },
            { key:"readOnly", label:"القراءة فقط", type:"checkbox" },
            { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
            { key:"placeholder", label:"العنصر النائب (Placeholder)", type:"text" }
        ]
    },
    "البريد الإلكتروني": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"charLimit", label:"حد الأحرف", type:"number" },{ key:"minLength", label:"الحد الأدنى", type:"number" },{ key:"maxLength", label:"الحد الأقصى", type:"number" },{ key:"emailFormat", label:"صيغة البريد الإلكتروني", type:"checkbox" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" },{ key:"placeholder", label:"العنصر النائب", type:"text" }] },
    "رقم الهاتف": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"charLimit", label:"حد الأحرف", type:"number" },{ key:"minLength", label:"الحد الأدنى", type:"number" },{ key:"maxLength", label:"الحد الأقصى", type:"number" },{ key:"inputPattern", label:"نمط الإدخال", type:"select", options:["أرقام فقط","حروف فقط","حروف وأرقام"] },{ key:"validation", label:"التحقق", type:"checkbox" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" },{ key:"placeholder", label:"العنصر النائب", type:"text" }] },
    "نص قصير": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"charLimit", label:"حد الأحرف", type:"number" },{ key:"minLength", label:"الحد الأدنى", type:"number" },{ key:"maxLength", label:"الحد الأقصى", type:"number" },{ key:"validation", label:"التحقق", type:"checkbox" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" },{ key:"placeholder", label:"العنصر النائب", type:"text" }] },
    "نص طويل": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"heightPx", label:"الارتفاع", type:"number" },{ key:"charLimit", label:"حد الأحرف", type:"number" },{ key:"minLength", label:"الحد الأدنى", type:"number" },{ key:"maxLength", label:"الحد الأقصى", type:"number" },{ key:"editMode", label:"وضع التعديل", type:"select", options:["عادي","غني (Rich Text)"] },{ key:"validation", label:"التحقق", type:"checkbox" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" },{ key:"placeholder", label:"العنصر النائب", type:"text" }] },
    "فقرة": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"charLimit", label:"حد الأحرف", type:"number" },{ key:"minLength", label:"الحد الأدنى", type:"number" },{ key:"maxLength", label:"الحد الأقصى", type:"number" },{ key:"editMode", label:"وضع التعديل", type:"select", options:["عادي","غني (Rich Text)"] },{ key:"validation", label:"التحقق", type:"checkbox" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" },{ key:"placeholder", label:"العنصر النائب", type:"text" }] },
    "رقم": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"inputLimits", label:"حدود المدخلات", type:"checkbox" },{ key:"minValue", label:"الحد الأدنى", type:"number" },{ key:"maxValue", label:"الحد الأقصى", type:"number" },{ key:"validation", label:"التحقق", type:"checkbox" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" },{ key:"placeholder", label:"العنصر النائب", type:"text" }] },
    "قائمة منسدلة": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"options", label:"الخيارات (كل خيار في سطر)", type:"textarea" },{ key:"defaultOption", label:"الخيار التلقائي", type:"text" },{ key:"emptyText", label:"نص الخيار الفارغ", type:"text", placeholder:"اختر خياراً" },{ key:"optionsCount", label:"عدد الخيارات", type:"number" },{ key:"visibleOptions", label:"الخيارات المرئية", type:"number" },{ key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }] },
    "قائمة اختيار الواحد": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"options", label:"الخيارات", type:"textarea" },{ key:"defaultOption", label:"الخيار التلقائي", type:"text" },{ key:"emptyText", label:"نص الخيار الفارغ", type:"text" },{ key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }] },
    "قائمة اختيار متعدد": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"options", label:"الخيارات", type:"textarea" },{ key:"defaultOption", label:"الخيار التلقائي", type:"text" },{ key:"emptyText", label:"نص الخيار الفارغ", type:"text" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" },{ key:"inputLimits", label:"حدود المدخلات", type:"checkbox" },{ key:"shuffleOptions", label:"خلط الخيارات", type:"checkbox" }] },
    "تاريخ": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"separator", label:"الفاصل", type:"select", options:["/",":","."] },{ key:"autoDate", label:"التاريخ التلقائي", type:"checkbox" },{ key:"showCalendar", label:"ظهور التقويم", type:"checkbox" },{ key:"simpleMode", label:"الوضع البسيط", type:"checkbox" },{ key:"timeSlot", label:"خانة الوقت", type:"checkbox" },{ key:"startDate", label:"تاريخ البداية", type:"date" },{ key:"endDate", label:"تاريخ النهاية", type:"date" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" }] },
    "وقت": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"timeFormat", label:"نمط الوقت", type:"select", options:["12 ساعة","24 ساعة"] },{ key:"autoTime", label:"الوقت التلقائي", type:"checkbox" },{ key:"timeRangeStart", label:"بداية النطاق", type:"time" },{ key:"timeRangeEnd", label:"نهاية النطاق", type:"time" },{ key:"readOnly", label:"القراءة فقط", type:"checkbox" }] },
    "رفع ملف": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"fileSizeLimit", label:"حد حجم الملفات", type:"checkbox" },{ key:"minFileSize", label:"الحد الأدنى (MB)", type:"number" },{ key:"maxFileSize", label:"الحد الأقصى (MB)", type:"number" },{ key:"fileTypes", label:"أنواع الملفات (PDF,JPG,PNG)", type:"text" },{ key:"maxFiles", label:"حد عدد الملفات", type:"number" },{ key:"buttonText", label:"نص الزر", type:"text", placeholder:"رفع ملف" },{ key:"validateSize", label:"التحقق من الحجم", type:"checkbox" }] },
    "دوار رقمي": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"inputLimits", label:"حدود المدخلات", type:"checkbox" },{ key:"minValue", label:"الحد الأدنى", type:"number" },{ key:"maxValue", label:"الحد الأقصى", type:"number" },{ key:"widthPx", label:"العرض بالبيكسل", type:"number" },{ key:"stepValue", label:"قيمة الفترة", type:"number", placeholder:"مثال: 1" },{ key:"noDecimals", label:"بدون عشرية", type:"checkbox" },{ key:"negativeValue", label:"قيمة سلبية", type:"checkbox" },{ key:"defaultValue", label:"القيمة التلقائية", type:"text" }] },
    "التقييم بالنجوم": { props: [{ key:"subName", label:"اسم فرعي", type:"text" },{ key:"ratingIcon", label:"أيقونة التقييم", type:"select", options:["نجمة","قلب","إبهام"] },{ key:"ratingRange", label:"مدى التقييم", type:"number", placeholder:"مثال: 5" },{ key:"defaultValue", label:"القيمة التلقائية", type:"number" },{ key:"tooltipText", label:"نص التلميح", type:"text" }] },
    "التقييم بالأرقام": { props: [{ key:"lowRatingText", label:"نص أقل تقييم", type:"text" },{ key:"highRatingText", label:"نص أعلى تقييم", type:"text" },{ key:"minRating", label:"أقل قيمة", type:"number" },{ key:"maxRating", label:"أعلى قيمة", type:"number" },{ key:"tooltipText", label:"نص التلميح", type:"text" }] }
};

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
    rtcSelectedColor = '';
    document.getElementById('rtcName').value = '';
    document.getElementById('rtcDesc').value = '';
    document.getElementById('rtcOwPublic').checked = true;
    document.getElementById('rtcRowOpen').checked = true;
    document.getElementById('rtcMaxRows').style.display = 'none';
    document.getElementById('rtcMaxRows').value = '';
    document.getElementById('rtcActiveOn').checked = true;
    document.querySelectorAll('#rtcColorPicker .rt-color-option').forEach(function(el, i) {
        el.classList.toggle('selected', i === 0);
    });
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

function rtcSelectColor(el) {
    document.querySelectorAll('#rtcColorPicker .rt-color-option').forEach(function(e) { e.classList.remove('selected'); });
    el.classList.add('selected');
    rtcSelectedColor = el.getAttribute('data-color') || '';
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
    cell.innerHTML = '<span style="font-size:11px;color:var(--sa-600);">تم عرض ' + def.props.length + ' خاصية أدناه</span>';
    var html = '<div class="row g-2">';
    def.props.forEach(function(p) {
        html += '<div class="col-md-4 col-sm-6 mb-2"><label class="d-block">' + p.label + '</label>';
        if (p.type === 'checkbox') {
            html += '<div class="form-check"><input class="form-check-input" type="checkbox" id="rtcProp_' + p.key + '"><label class="form-check-label" for="rtcProp_' + p.key + '">تفعيل</label></div>';
        } else if (p.type === 'select') {
            html += '<select class="form-select form-select-sm" id="rtcProp_' + p.key + '"><option value="">اختر</option>';
            (p.options||[]).forEach(function(o) { html += '<option value="' + o + '">' + o + '</option>'; });
            html += '</select>';
        } else if (p.type === 'textarea') {
            html += '<textarea class="form-control form-control-sm" id="rtcProp_' + p.key + '" rows="3" placeholder="' + (p.placeholder||'') + '"></textarea>';
        } else {
            html += '<input type="' + (p.type||'text') + '" class="form-control form-control-sm" id="rtcProp_' + p.key + '" placeholder="' + (p.placeholder||'') + '">';
        }
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
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
    def.props.forEach(function(p) {
        var el = document.getElementById('rtcProp_' + p.key);
        if (!el) return;
        if (p.type === 'checkbox') result[p.key] = el.checked; else result[p.key] = el.value;
    });
    return result;
}

function rtcSetProps(type, propsObj) {
    if (!type || !RT_FIELD_TYPES[type]) return;
    var def = RT_FIELD_TYPES[type];
    def.props.forEach(function(p) {
        var el = document.getElementById('rtcProp_' + p.key);
        if (!el) return;
        var v = propsObj[p.key];
        if (p.type === 'checkbox') el.checked = !!v; else if (v !== undefined && v !== null) el.value = v;
    });
}

function rtcAddField() {
    var type = document.getElementById('rtcFieldType').value;
    var name = document.getElementById('rtcFieldName').value.trim();
    if (!type) { showToast('يرجى اختيار نوع الحقل', 'danger'); return; }
    if (!name) { showToast('يرجى إدخال اسم الحقل', 'danger'); return; }
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
            var def = RT_FIELD_TYPES[f.fieldType];
            if (!def) continue;
            var pDef = def.props.find(function(pp) { return pp.key === k; });
            if (!pDef) continue;
            if (pDef.type === 'checkbox' && p[k]) parts.push(pDef.label); else if (p[k]) parts.push(pDef.label + ': ' + p[k]);
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
    var reqBody = { name:name, description:document.getElementById('rtcDesc').value.trim(), ownership:document.querySelector('input[name="rtcOwnership"]:checked').value, rowCountMode:rowMode, maxRows:maxRows, columnHeaderColor:rtcSelectedColor, isActive:document.querySelector('input[name="rtcActive"]:checked').value === '1', fields:rtcFields.map(function(f){return{fieldName:f.fieldName,fieldType:f.fieldType,isRequired:f.isRequired,subName:f.subName||'',placeholder:f.placeholder||'',tooltipText:f.tooltipText||'',propertiesJson:f.propertiesJson||'{}'};}) };
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

function rtpBuildFieldInput(f) {
    var ph = (f.tooltipText || '').replace(/"/g, '&quot;');
    var inp = '';
    if (f.fieldType === 'الاسم الكامل' || f.fieldType === 'نص قصير' || f.fieldType === 'البريد الإلكتروني' || f.fieldType === 'رقم الهاتف') {
        inp = '<input type="' + (f.fieldType === 'البريد الإلكتروني' ? 'email' : f.fieldType === 'رقم الهاتف' ? 'tel' : 'text') + '" class="form-control" placeholder="' + ph + '"' + (f.isRequired ? ' required' : '') + '>';
    } else if (f.fieldType === 'نص طويل' || f.fieldType === 'فقرة') {
        inp = '<textarea class="form-control" rows="3" placeholder="' + ph + '"' + (f.isRequired ? ' required' : '') + '></textarea>';
    } else if (f.fieldType === 'رقم' || f.fieldType === 'دوار رقمي' || f.fieldType === 'التقييم بالأرقام') {
        inp = '<input type="number" class="form-control" placeholder="' + ph + '"' + (f.isRequired ? ' required' : '') + '>';
    } else if (f.fieldType === 'قائمة منسدلة' || f.fieldType === 'قائمة اختيار الواحد') {
        var opts = [];
        try { var p = JSON.parse(f.propertiesJson || '{}'); if (p.options) opts = String(p.options).split(/[\r\n]+/).map(function(s){return s.trim();}).filter(Boolean); } catch(e) {}
        inp = '<select class="form-select"' + (f.isRequired ? ' required' : '') + '><option value="">' + (ph || 'اختر...') + '</option>';
        opts.forEach(function(o){ inp += '<option value="' + String(o).replace(/"/g,'&quot;') + '">' + o + '</option>'; });
        inp += '</select>';
    } else if (f.fieldType === 'قائمة اختيار متعدد') {
        var opts2 = [];
        try { var p2 = JSON.parse(f.propertiesJson || '{}'); if (p2.options) opts2 = String(p2.options).split(/[\r\n]+/).map(function(s){return s.trim();}).filter(Boolean); } catch(e) {}
        inp = '<div class="d-flex flex-wrap gap-2">';
        opts2.forEach(function(o){ inp += '<div class="form-check mb-0"><input class="form-check-input" type="checkbox"><label class="form-check-label">' + String(o).replace(/</g,'&lt;') + '</label></div>'; });
        if (opts2.length === 0) inp += '<span class="text-muted">—</span>';
        inp += '</div>';
    } else if (f.fieldType === 'تاريخ') {
        inp = '<input type="date" class="form-control"' + (f.isRequired ? ' required' : '') + '>';
    } else if (f.fieldType === 'وقت') {
        inp = '<input type="time" class="form-control"' + (f.isRequired ? ' required' : '') + '>';
    } else if (f.fieldType === 'رفع ملف') {
        inp = '<input type="file" class="form-control form-control-sm"' + (f.isRequired ? ' required' : '') + '>';
    } else if (f.fieldType === 'التقييم بالنجوم') {
        inp = '<input type="number" class="form-control" min="0" max="5" placeholder="0-5"' + (f.isRequired ? ' required' : '') + '>';
    } else {
        inp = '<input type="text" class="form-control" placeholder="' + ph + '"' + (f.isRequired ? ' required' : '') + '>';
    }
    return inp;
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
    var headerColor = rtcSelectedColor || '#f3f4f6';

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
    html += '<div class="rt-preview-wrap"><table class="table rt-preview-form-table mb-0"><thead><tr class="rt-preview-thead-row" style="background:' + headerColor + ' !important;color:#1f2937;">';
    rtcFields.forEach(function(f) {
        html += '<th style="padding:10px 12px;text-align:center;font-weight:700;border:1px solid #e5e7eb;">' + f.fieldName + (f.isRequired ? ' <span class="required-star">*</span>' : '') + '</th>';
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
            var def = RT_FIELD_TYPES[f.fieldType];
            if (!def) continue;
            var pDef = def.props.find(function(pp) { return pp.key === k; });
            if (!pDef) continue;
            if (pDef.type === 'checkbox' && p[k]) parts.push(pDef.label);
            else if (p[k]) parts.push(pDef.label + ': ' + p[k]);
        }
        return parts.length > 0 ? parts.join(' | ') : '-';
    } catch(e) { return '-'; }
}

/* ===== Edit Modal ===== */
var rtEditFields = [], rtEditEditingIndex = -1, rtEditSelectedColor = '';

function rtEditSelectColor(el) {
    document.querySelectorAll('#rtEditColorPicker .rt-color-option').forEach(function(e) { e.classList.remove('selected'); });
    el.classList.add('selected');
    rtEditSelectedColor = el.getAttribute('data-color') || '';
}

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

        rtEditSelectedColor = d.columnHeaderColor || '';
        document.querySelectorAll('#rtEditColorPicker .rt-color-option').forEach(function(el) {
            var c = el.getAttribute('data-color') || '';
            el.classList.toggle('selected', c === (d.columnHeaderColor || ''));
        });

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
    cell.innerHTML = '<span style="font-size:11px;color:var(--sa-600);">تم عرض ' + def.props.length + ' خاصية أدناه</span>';
    var html = '<div class="row g-2">';
    def.props.forEach(function(p) {
        html += '<div class="col-md-4 col-sm-6 mb-2"><label class="d-block">' + p.label + '</label>';
        if (p.type === 'checkbox') {
            html += '<div class="form-check"><input class="form-check-input" type="checkbox" id="rtEditProp_' + p.key + '"><label class="form-check-label" for="rtEditProp_' + p.key + '">تفعيل</label></div>';
        } else if (p.type === 'select') {
            html += '<select class="form-select form-select-sm" id="rtEditProp_' + p.key + '"><option value="">اختر</option>';
            (p.options||[]).forEach(function(o) { html += '<option value="' + o + '">' + o + '</option>'; });
            html += '</select>';
        } else if (p.type === 'textarea') {
            html += '<textarea class="form-control form-control-sm" id="rtEditProp_' + p.key + '" rows="3" placeholder="' + (p.placeholder||'') + '"></textarea>';
        } else {
            html += '<input type="' + (p.type||'text') + '" class="form-control form-control-sm" id="rtEditProp_' + p.key + '" placeholder="' + (p.placeholder||'') + '">';
        }
        html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
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
    def.props.forEach(function(p) {
        var el = document.getElementById('rtEditProp_' + p.key);
        if (!el) return;
        if (p.type === 'checkbox') result[p.key] = el.checked; else result[p.key] = el.value;
    });
    return result;
}

function rtEditSetProps(type, propsObj) {
    if (!type || !RT_FIELD_TYPES[type]) return;
    var def = RT_FIELD_TYPES[type];
    def.props.forEach(function(p) {
        var el = document.getElementById('rtEditProp_' + p.key);
        if (!el) return;
        var v = propsObj[p.key];
        if (p.type === 'checkbox') el.checked = !!v; else if (v !== undefined && v !== null) el.value = v;
    });
}

function rtEditAddField() {
    var type = document.getElementById('rtEditFieldType').value;
    var name = document.getElementById('rtEditFieldName').value.trim();
    if (!type) { showToast('يرجى اختيار نوع الحقل', 'danger'); return; }
    if (!name) { showToast('يرجى إدخال اسم الحقل', 'danger'); return; }
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
    var headerColor = rtEditSelectedColor || '#f3f4f6';

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
    html += '<div class="rt-preview-wrap"><table class="table rt-preview-form-table mb-0"><thead><tr class="rt-preview-thead-row" style="background:' + headerColor + ' !important;color:#1f2937;">';
    rtEditFields.forEach(function(f) {
        html += '<th style="padding:10px 12px;text-align:center;font-weight:700;border:1px solid #e5e7eb;">' + f.fieldName + (f.isRequired ? ' <span class="required-star">*</span>' : '') + '</th>';
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

    var colorEl = document.querySelector('#rtEditColorPicker .rt-color-option.selected');
    var body = {
        id: id,
        name: name,
        description: document.getElementById('rtEditDescription').value.trim(),
        sortOrder: parseInt(document.getElementById('rtEditSortOrder').value) || 0,
        rowCountMode: document.querySelector('input[name="rtEditRowMode"]:checked').value,
        maxRows: parseInt(document.getElementById('rtEditMaxRows').value) || null,
        ownership: document.querySelector('input[name="rtEditOwnership"]:checked').value,
        columnHeaderColor: colorEl ? (colorEl.getAttribute('data-color') || '') : '',
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
