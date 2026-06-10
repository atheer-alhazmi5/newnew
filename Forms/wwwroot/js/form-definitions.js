'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
// وضع إصدار النسخة: عند true يُستخدم نفس المعالج لكن دون خطوة "البيانات الأساسية"
let fdVersionMode   = false;
let fdVersionFormId = 0;     // معرف النموذج الذي ننشئ/نُحدّث له نسخة
let fdVersionEditId = null;  // معرف الإصدار عند التحديث، null عند الإنشاء
let fdVersionName   = '';    // اسم الإصدار للعرض في عنوان المعالج

let fdData          = [];
let fdLookups       = { formClasses:[], formTypes:[], workspaces:[], templates:[], templateFilters:[], orgUnitFilters:[] };
let fdOrgUnits      = [];
let fdFilterOuExpanded = {};

function fdFilterOuTogglePanel() {
    const panel = document.getElementById('fdFilterOuPanel');
    const trig = document.getElementById('fdFilterOuTrigger');
    if (!panel) return;
    if (panel.classList.contains('d-none')) {
        const cur = document.getElementById('fdFilterOrgUnit')?.value;
        if (cur) fdFilterOuExpandAncestorsForSelection(parseInt(cur, 10));
        fdRenderFilterOrgUnitTreePanel();
        panel.classList.remove('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'true');
    } else {
        panel.classList.add('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'false');
    }
}

function fdFilterOuClosePanel() {
    const panel = document.getElementById('fdFilterOuPanel');
    const trig = document.getElementById('fdFilterOuTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function fdFilterOuExpandAncestorsForSelection(selectId) {
    if (!selectId || isNaN(selectId)) return;
    const map = {};
    fdOrgUnits.forEach(u => { map[u.id] = u; });
    let u = map[selectId];
    while (u && u.parentId != null && u.parentId !== '') {
        fdFilterOuExpanded[String(u.parentId)] = true;
        u = map[u.parentId];
    }
}

function fdOrgUnitByParent() {
    const ids = {};
    fdOrgUnits.forEach(u => { ids[u.id] = true; });
    const byParent = {};
    fdOrgUnits.forEach(u => {
        let pk = '';
        if (u.parentId != null && u.parentId !== '' && ids[u.parentId]) pk = String(u.parentId);
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(k => {
        byParent[k].sort((a, b) => {
            const sa = a.sortOrder != null ? a.sortOrder : 0;
            const sb = b.sortOrder != null ? b.sortOrder : 0;
            if (sa !== sb) return sa - sb;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
        });
    });
    return byParent;
}

function fdRenderOuTreeRows(byParent, parentKey, depth, selectedId, expandedMap) {
    const rows = byParent[parentKey] || [];
    const sel = selectedId !== undefined && selectedId !== null ? String(selectedId) : (document.getElementById('fdFilterOrgUnit')?.value || '');
    let html = '';
    rows.forEach(u => {
        const idStr = String(u.id);
        const children = byParent[idStr] || [];
        const hasChildren = children.length > 0;
        const expanded = !!expandedMap[idStr];
        const indent = depth * 22;
        const rowSel = String(sel) === idStr ? ' is-selected' : '';
        html += `<div class="bnf-ou-tree-row d-flex align-items-center${rowSel}" data-id="${u.id}" role="option" dir="rtl" style="padding:8px 10px;padding-right:${12 + indent}px;">`;
        if (hasChildren) {
            html += `<button type="button" class="bnf-ou-tree-exp" data-exp="${idStr}" aria-expanded="${expanded}" title="${expanded ? 'طي' : 'توسيع'}">${expanded ? '−' : '+'}</button>`;
        } else {
            html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += `<span class="bnf-ou-tree-name flex-grow-1">${esc(u.name || '')}</span></div>`;
        if (hasChildren && expanded) html += fdRenderOuTreeRows(byParent, idStr, depth + 1, sel, expandedMap);
    });
    return html;
}

function fdRenderFilterOrgUnitTreePanel() {
    const panel = document.getElementById('fdFilterOuPanel');
    if (!panel) return;
    if (!fdOrgUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    const byParent = fdOrgUnitByParent();
    const selectedId = document.getElementById('fdFilterOrgUnit')?.value || '';
    const allSel = !selectedId ? ' is-selected' : '';
    let html = `<div class="bnf-ou-tree-row d-flex align-items-center${allSel}" data-id="" role="option" dir="rtl" style="padding:8px 10px;padding-right:12px;">`
        + '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>'
        + '<span class="bnf-ou-tree-name flex-grow-1" style="font-weight:700;color:var(--gray-700);">كل الوحدات</span></div>';
    html += fdRenderOuTreeRows(byParent, '', 0, selectedId, fdFilterOuExpanded);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function fdFilterOuSetSelection(id, name) {
    const hid = document.getElementById('fdFilterOrgUnit');
    const lab = document.getElementById('fdFilterOuLabel');
    if (hid) hid.value = id != null && id !== '' ? String(id) : '';
    if (lab) lab.textContent = name && String(name).trim() ? name : 'الوحدة التنظيمية';
    fdFilterOuClosePanel();
    fdLoad();
}

function fdInitOrgUnitFilterTree() {
    const trig = document.getElementById('fdFilterOuTrigger');
    if (trig && !trig._fdOuBound) {
        trig._fdOuBound = true;
        trig.addEventListener('click', fdFilterOuTogglePanel);
    }
    if (window._fdOuFilterBound) return;
    window._fdOuFilterBound = true;
    document.addEventListener('click', e => {
        const expBtn = e.target.closest('#fdFilterOuPanel .bnf-ou-tree-exp');
        if (expBtn) {
            e.preventDefault(); e.stopPropagation();
            const id = expBtn.getAttribute('data-exp');
            if (id) {
                if (fdFilterOuExpanded[id]) delete fdFilterOuExpanded[id];
                else fdFilterOuExpanded[id] = true;
                fdRenderFilterOrgUnitTreePanel();
            }
            return;
        }
        const row = e.target.closest('#fdFilterOuPanel .bnf-ou-tree-row');
        if (row) {
            e.preventDefault(); e.stopPropagation();
            const id = row.getAttribute('data-id');
            const nameEl = row.querySelector('.bnf-ou-tree-name');
            const name = nameEl ? nameEl.textContent.trim() : '';
            if (!id) fdFilterOuSetSelection('', 'الوحدة التنظيمية');
            else fdFilterOuSetSelection(id, name);
            return;
        }
        const wrap = document.querySelector('.bnf-filter-ou-wrap');
        const panel = document.getElementById('fdFilterOuPanel');
        if (wrap && panel && !panel.classList.contains('d-none') && !wrap.contains(e.target)) fdFilterOuClosePanel();
        if (!e.target.closest('.fd-workflow-wrap')) fdCloseWorkflowMenus();
    });
}
let fdIsAdmin       = false;
let fdStep          = 1;
let fdEditId        = null;
let fdRejectId      = null;
let fdDeleteId      = null;
let fdFields        = [];          // working field list
let fdFieldDragFromId = null;      // drag & drop reorder (field id)
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

// Conditional logic rules (step 3)
let fdConditionalRules = [];
let fdRuleSeq = 1;
const FD_RULE_OPERATORS = ['يساوي','لا يساوي','أكبر من','أصغر من','يحتوي على','فارغ','غير فارغ'];
const FD_RULE_NO_VALUE  = new Set(['فارغ','غير فارغ']);
const FD_RULE_ACTIONS   = ['إظهار','إخفاء','جعل العنصر مطلوباً','تعطيل'];
/** ترميغ القيم القديمة لإجراءات الحقل إلى المسميات الموحَّدة (حقل/قسم). */
const FD_RULE_ACTION_LEGACY = {
    'إظهار الحقل': 'إظهار',
    'إخفاء الحقل': 'إخفاء',
    'جعل الحقل مطلوبا': 'جعل العنصر مطلوباً',
    'جعل الحقل مطلوباً': 'جعل العنصر مطلوباً',
    'تعطيل الحقل': 'تعطيل'
};

// ─── FIELD TYPE DEFINITIONS (mirrors ready-tables) ───────────────────────────
const FD_FIELD_TYPES = {
    "الاسم الكامل": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب (Placeholder)", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"مثال: 300" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" }
    ]},
    "البريد الإلكتروني": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text", placeholder:"name@almadinah.gov.sa" },
        { key:"placeholder", label:"العنصر النائب", type:"text", placeholder:"name@almadinah.gov.sa" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minLength", label:"الحد الأدنى للأحرف", type:"number" },
        { key:"maxLength", label:"الحد الأقصى للأحرف", type:"number" }
    ]},
    "رقم الهاتف": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"phoneFormat", label:"صيغة الرقم", type:"select", options:["+966 (9 أرقام)","05xxxxxxxx (10 أرقام)","دولي","تلفون"] },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"inputPattern", label:"نمط الإدخال", type:"select", options:["أرقام فقط","حروف فقط","حروف وأرقام"] }
    ]},
    "نص قصير": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" }
    ]},
    "نص طويل": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"heightPx", label:"الارتفاع", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"editMode", label:"وضع التعديل", type:"select", options:["عادي","غني (Rich Text)"] }
    ]},
    "فقرة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"editMode", label:"وضع التعديل", type:"select", options:["عادي","غني (Rich Text)"] }
    ]},
    "رقم": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minValue", label:"الحد الأدنى", type:"number" },
        { key:"maxValue", label:"الحد الأقصى", type:"number" },
        { key:"decimals", label:"عدد الخانات العشرية", type:"number", placeholder:"2" }
    ]},
    "قائمة منسدلة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"listType", label:"نوع القائمة", type:"select", options:["قائمة مستقلة","قائمة فرعية","قائمة هرمية"] },
        { key:"dropdownListId", label:"اسم القائمة", type:"dropdownListPick" }
    ]},
    "قائمة اختيار الواحد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"optionsOrientation", label:"اتجاه عرض الخيارات", type:"select", options:["عمودي","أفقي"] },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"single", perOptionOther:true }
    ]},
    "قائمة اختيار متعدد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"optionsOrientation", label:"اتجاه عرض الخيارات", type:"select", options:["عمودي","أفقي"] },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"multi", perOptionOther:true }
    ]},
    "تاريخ": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"separator", label:"الفاصل", type:"select", options:["/",":","."] },
        { key:"calendarType", label:"نوع التقويم", type:"select", options:["ميلادي","هجري"] },
        { key:"startDate", label:"تاريخ البداية", type:"date" },
        { key:"endDate", label:"تاريخ النهاية", type:"date" }
    ]},
    "وقت": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"timeFormat", label:"نمط الوقت", type:"select", options:["12 ساعة","24 ساعة"] }
    ]},
    "رفع ملف": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"buttonText", label:"نص الزر", type:"text", placeholder:"رفع ملف" },
        { key:"maxFiles", label:"حد عدد الملفات", type:"number" },
        { type:"fileMbLimitsPair", label:"حد حجم الملف (ميغابايت)", col:"col-12 mb-2" },
        { key:"fileTypes", label:"أنواع الملفات المسموحة", type:"fileTypesPick" }
    ]},
    "دوار رقمي": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minValue", label:"الحد الأدنى", type:"number" },
        { key:"maxValue", label:"الحد الأقصى", type:"number" },
        { key:"stepValue", label:"قيمة الفترة", type:"number", placeholder:"مثال: 1" }
    ]},
    "التقييم بالنجوم": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"ratingIcon", label:"أيقونة التقييم", type:"select", options:["نجمة","قلب","إبهام"] },
        { key:"ratingRange", label:"مدى التقييم", type:"number", placeholder:"مثال: 5" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"number" }
    ]},
    "التقييم بالأرقام": { props: [
        { key:"lowRatingText", label:"نص أقل تقييم", type:"text" },
        { key:"highRatingText", label:"نص أعلى تقييم", type:"text" },
        { key:"minRating", label:"أقل قيمة", type:"number" },
        { key:"maxRating", label:"أعلى قيمة", type:"number" }
    ]},
    "جدول بيانات": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"readyTableId", label:"جدول بيانات ", type:"readyTablePick" }
    ]},
    "شبكة خيارات متعددة": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"rowLabels", label:"صفوف الشبكة (سطر لكل صف)", type:"textarea", rows:5, placeholder:"صف 1", hint:"اختيار واحد لكل صف." },
        { key:"options", label:"عناوين الأعمدة (خيار لكل عمود)", type:"optionList", choiceMode:"single" }
    ]},
    "شبكة مربعات اختيار": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"rowLabels", label:"صفوف الشبكة (سطر لكل صف)", type:"textarea", rows:5, placeholder:"صف 1", hint:"يمكن تحديد أكثر من خانة." },
        { key:"options", label:"عناوين الأعمدة", type:"optionList", choiceMode:"single" }
    ]},
    "عنوان": { props: [
        { key:"fontSize", label:"حجم الخط (px)", type:"number", placeholder:"18" },
        { key:"fontColor", label:"لون الخط", type:"color" },
        { key:"textAlign", label:"المحاذاة", type:"select", options:["يمين","وسط","يسار"] }
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
        { key:"decimals", label:"عدد الخانات العشرية", type:"number", placeholder:"2" }
    ]},
    "تأشير": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"mode", label:"النمط الافتراضي", type:"select", options:["مرفق","التوقيع بالقلم","التوقيع المعتمد في النظام"] },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"360" }
    ]},
    "توقيع": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"mode", label:"النمط الافتراضي", type:"select", options:["مرفق","التوقيع بالقلم","التوقيع المعتمد في النظام"] },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"360" },
        { key:"heightPx", label:"ارتفاع لوحة التوقيع (px)", type:"number", placeholder:"120" }
    ]},
    "تاريخ ووقت": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"القيمة التلقائية", type:"text", placeholder:"YYYY-MM-DDTHH:mm" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"startDate", label:"أقل تاريخ مسموح", type:"date" },
        { key:"endDate", label:"أقصى تاريخ مسموح", type:"date" },
        { key:"timeFormat", label:"نمط الوقت", type:"select", options:["12 ساعة","24 ساعة"] }
    ]},
    "تبديل": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"onText", label:"نص الحالة المفعلة", type:"text", placeholder:"نعم" },
        { key:"offText", label:"نص الحالة غير المفعلة", type:"text", placeholder:"لا" },
        { key:"defaultOn", label:"الحالة الافتراضية مفعلة", type:"checkbox", checkboxLabel:"يبدأ مفعلاً" }
    ]},
    "رابط": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"defaultValue", label:"الرابط الافتراضي", type:"text", placeholder:"https://example.com" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"linkLabel", label:"نص الزر", type:"text", placeholder:"فتح الرابط" }
    ]},
    "فاصل صفحات": { props: [
        { key:"pageLabel", label:"اسم الصفحة التالية (اختياري)", type:"text", placeholder:"الصفحة 2" }
    ]},
    "صورة عرض": { props: [
        { key:"imageUrl", label:"إرفاق صورة", type:"displayImageUpload" },
        { key:"altText", label:"نص بديل", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number", placeholder:"320" },
        { key:"heightPx", label:"الارتفاع بالبيكسل", type:"number", placeholder:"200" },
        { key:"imageAlign", label:"محاذاة الصورة", type:"select", options:["يمين","وسط","يسار"] }
    ]}
};

(function fdAugmentFieldTypesReadOnly() {
    const roProp = { key:'readOnly', label:'للقراءة فقط', type:'checkbox', checkboxLabel:'حقل للقراءة فقط', col:'col-md-6 col-sm-6 mb-3' };
    const skip = new Set(['عنوان', 'خط فاصل', 'فاصل صفحات', 'صورة عرض']);
    Object.keys(FD_FIELD_TYPES).forEach(k => { if (!skip.has(k)) FD_FIELD_TYPES[k].props.push({ ...roProp }); });
})();

/** أيقونة + فئة لونية لشارة نوع الحقل — مصدر واحد لصفحة النماذج والجداول الجاهزة */
const FD_FIELD_TYPE_UI = {
    'الاسم الكامل': { icon: 'bi-person-vcard', tone: 'text' },
    'البريد الإلكتروني': { icon: 'bi-envelope', tone: 'text' },
    'رقم الهاتف': { icon: 'bi-telephone', tone: 'text' },
    'نص قصير': { icon: 'bi-input-cursor-text', tone: 'text' },
    'نص طويل': { icon: 'bi-textarea-resize', tone: 'text' },
    'فقرة': { icon: 'bi-text-paragraph', tone: 'rich' },
    'رقم': { icon: 'bi-hash', tone: 'numeric' },
    'قائمة منسدلة': { icon: 'bi-menu-button-wide-fill', tone: 'choice' },
    'قائمة اختيار الواحد': { icon: 'bi-record-circle', tone: 'choice' },
    'قائمة اختيار متعدد': { icon: 'bi-ui-checks', tone: 'choice' },
    'تاريخ': { icon: 'bi-calendar3', tone: 'date' },
    'وقت': { icon: 'bi-clock', tone: 'date' },
    'رفع ملف': { icon: 'bi-cloud-arrow-up', tone: 'file' },
    'دوار رقمي': { icon: 'bi-arrow-down-up', tone: 'numeric' },
    'التقييم بالنجوم': { icon: 'bi-star-fill', tone: 'rating' },
    'التقييم بالأرقام': { icon: 'bi-123', tone: 'rating' },
    'جدول بيانات': { icon: 'bi-table', tone: 'grid' },
    'شبكة خيارات متعددة': { icon: 'bi-grid-3x3-gap', tone: 'grid' },
    'شبكة مربعات اختيار': { icon: 'bi-ui-checks-grid', tone: 'grid' },
    'عنوان': { icon: 'bi-type-h1', tone: 'structure' },
    'خط فاصل': { icon: 'bi-hr', tone: 'structure' },
    'عملة': { icon: 'bi-currency-exchange', tone: 'numeric' },
    'تأشير': { icon: 'bi-pen', tone: 'file' },
    'توقيع': { icon: 'bi-vector-pen', tone: 'file' },
    'تاريخ ووقت': { icon: 'bi-calendar-event', tone: 'date' },
    'تبديل': { icon: 'bi-toggle2-on', tone: 'bool' },
    'رابط': { icon: 'bi-link-45deg', tone: 'meta' },
    'فاصل صفحات': { icon: 'bi-files', tone: 'structure' },
    'صورة عرض': { icon: 'bi-image', tone: 'media' }
};

let _fdFieldTypeBadgeStylesDone = false;
function fdEnsureFieldTypeBadgeStyles() {
    if (typeof document === 'undefined' || _fdFieldTypeBadgeStylesDone) return;
    const id = 'fd-field-type-badge-styles-v1';
    if (document.getElementById(id)) { _fdFieldTypeBadgeStylesDone = true; return; }
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
.fd-field-type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem 0.3rem 0.55rem;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  font-family: inherit;
  border: 1px solid transparent;
  vertical-align: middle;
}
.fd-field-type-badge__icon {
  font-size: 0.95rem;
  line-height: 1;
  flex-shrink: 0;
  opacity: 0.92;
}
.fd-field-type-badge__text { font-weight: 700; }
/* ألوان مجموعات الحقول */
.fd-field-type-badge--text {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-700, #374151);
  border-color: var(--gray-200, #e5e7eb);
}
.fd-field-type-badge--rich {
  background: #fffbeb;
  color: #92400e;
  border-color: #fde68a;
}
.fd-field-type-badge--numeric {
  background: var(--info-50, #eff6ff);
  color: var(--info-800, #1e40af);
  border-color: var(--info-200, #bfdbfe);
}
.fd-field-type-badge--choice {
  background: #ede9fe;
  color: #5b21b6;
  border-color: #ddd6fe;
}
.fd-field-type-badge--date {
  background: var(--sa-50, #ecfdf5);
  color: var(--sa-800, #065f46);
  border-color: var(--sa-200, #a7f3d0);
}
.fd-field-type-badge--file {
  background: #fff7ed;
  color: #9a3412;
  border-color: #fed7aa;
}
.fd-field-type-badge--rating {
  background: #fef9c3;
  color: #854d0e;
  border-color: #fde047;
}
.fd-field-type-badge--grid {
  background: #ecfeff;
  color: #155e75;
  border-color: #a5f3fc;
}
.fd-field-type-badge--structure {
  background: var(--gray-200, #e5e7eb);
  color: var(--gray-700, #374151);
  border-color: var(--gray-300, #d1d5db);
}
.fd-field-type-badge--bool {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #93c5fd;
}
.fd-field-type-badge--meta {
  background: #f3e8ff;
  color: #6b21a8;
  border-color: #e9d5ff;
}
.fd-field-type-badge--media {
  background: #fce7f3;
  color: #9d174d;
  border-color: #f9a8d4;
}
.fd-field-type-badge--default {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-600, #4b5563);
  border-color: var(--gray-200, #e5e7eb);
}
/* توحيد شارات «إجباري» مع الجداول الجاهزة */
table .fd-field-req:not([style*="background"]) {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 11px;
  background: #dcf5e8;
  color: #0f9f5c;
}
`;
    document.head.appendChild(el);
    _fdFieldTypeBadgeStylesDone = true;
}

/** HTML لعرض نوع الحقل في الجداول — يُعاد استخدامه في الجداول الجاهزة */
function fdFieldTypeBadgeHtml(fieldType) {
    fdEnsureFieldTypeBadgeStyles();
    const raw = fieldType == null ? '' : String(fieldType).trim();
    if (!raw) {
        return '<span class="fd-field-type-badge fd-field-type-badge--default"><span class="fd-field-type-badge__text">—</span></span>';
    }
    const meta = FD_FIELD_TYPE_UI[raw] || { icon: 'bi-tag-fill', tone: 'default' };
    const tone = meta.tone && /^[a-z]+$/.test(meta.tone) ? meta.tone : 'default';
    const ic = meta.icon && /^bi-[a-z0-9-]+$/.test(meta.icon) ? meta.icon : 'bi-tag-fill';
    return `<span class="fd-field-type-badge fd-field-type-badge--${tone}" title="${fdEscAttr(raw)}"><i class="bi ${ic} fd-field-type-badge__icon" aria-hidden="true"></i><span class="fd-field-type-badge__text">${esc(raw)}</span></span>`;
}

const FD_FILE_TYPE_CHOICES = [
    { ext:'pdf', label:'PDF' }, { ext:'jpg', label:'JPG' }, { ext:'jpeg', label:'JPEG' },
    { ext:'png', label:'PNG' }, { ext:'doc', label:'Word (.doc)' }, { ext:'docx', label:'Word (.docx)' },
    { ext:'xls', label:'Excel (.xls)' }, { ext:'xlsx', label:'Excel (.xlsx)' }, { ext:'txt', label:'TXT' },
    { ext:'pptx', label:'PowerPoint (.pptx)' }, { ext:'zip', label:'ZIP' }, { ext:'rar', label:'RAR' }
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
    if (!id) return;
    const existing = fdDropdownItemsCache[id];
    if (existing && typeof existing === 'object' && !Array.isArray(existing) && Array.isArray(existing.items)) return;
    try {
        const res = await apiFetch(`/Dropdowns/GetDropdownListItemsForForm?id=${id}`);
        if (res && res.success && Array.isArray(res.items)) {
            fdDropdownItemsCache[id] = {
                listType: res.listType || '',
                selectionType: res.selectionType || '',
                items: res.items
            };
        } else fdDropdownItemsCache[id] = { listType: '', selectionType: '', items: [] };
    } catch {
        fdDropdownItemsCache[id] = { listType: '', selectionType: '', items: [] };
    }
}

function fdNormalizeDropdownCacheEntry(listId) {
    const id = parseInt(listId, 10);
    const raw = fdDropdownItemsCache[id];
    if (!raw) return { listType: '', selectionType: '', items: [] };
    if (Array.isArray(raw)) {
        const items = raw.map(x => {
            if (typeof x === 'string') return { id: 0, itemText: x, parentItemId: null, levelNumber: 1, sortOrder: 0, parentItemText: '' };
            return {
                id: x.id ?? x.Id ?? 0,
                itemText: x.itemText ?? x.ItemText ?? '',
                parentItemId: x.parentItemId ?? x.ParentItemId ?? null,
                levelNumber: x.levelNumber ?? x.LevelNumber ?? 1,
                parentItemText: x.parentItemText ?? x.ParentItemText ?? '',
                sortOrder: x.sortOrder ?? x.SortOrder ?? 0
            };
        });
        return { listType: 'قائمة مستقلة', selectionType: 'خيار محدد', items };
    }
    return {
        listType: raw.listType || '',
        selectionType: raw.selectionType || '',
        items: Array.isArray(raw.items) ? raw.items : []
    };
}

function fdSelectionIsMulti(selectionType) {
    return String(selectionType || '').includes('متعدد');
}

/** مطابق لمنطق القوائم: جذور = مستوى أول بدون أب داخل القائمة */
function fdBuildDropdownTreeNodes(items) {
    const roots = items.filter(i => {
        const ln = i.levelNumber ?? i.LevelNumber ?? 1;
        const pid = i.parentItemId ?? i.ParentItemId;
        return (ln <= 1 || ln === 0) && (pid == null || pid === '');
    });
    function getChildren(parentId) {
        return items.filter(i => (i.parentItemId ?? i.ParentItemId) === parentId);
    }
    function sortItems(arr) {
        return arr.slice().sort((a, b) => {
            const oa = a.sortOrder ?? a.SortOrder ?? 0;
            const ob = b.sortOrder ?? b.SortOrder ?? 0;
            if (oa !== ob) return oa - ob;
            return (a.id ?? a.Id ?? 0) - (b.id ?? b.Id ?? 0);
        });
    }
    function buildNode(item) {
        const iid = item.id ?? item.Id;
        const rawKids = getChildren(iid);
        const kids = sortItems(rawKids).map(buildNode);
        return { item, children: kids };
    }
    return sortItems(roots).map(buildNode);
}

/** قائمة فرعية: كل العناصر ترتبط بعنصر من القائمة الأم — تجميع تحت عنوان كل عنصر أب */
function fdBuildSublistGroupedRoots(items) {
    const map = new Map();
    items.forEach(it => {
        const pid = it.parentItemId ?? it.ParentItemId;
        const key = pid == null || pid === '' ? '__none__' : String(pid);
        if (!map.has(key)) {
            const pt = it.parentItemText ?? it.ParentItemText ?? '';
            map.set(key, { parentId: pid, parentText: pt, items: [] });
        }
        map.get(key).items.push(it);
    });
    const groups = Array.from(map.values()).map(g => ({
        ...g,
        items: g.items.slice().sort((a, b) => {
            const oa = a.sortOrder ?? a.SortOrder ?? 0;
            const ob = b.sortOrder ?? b.SortOrder ?? 0;
            if (oa !== ob) return oa - ob;
            return (a.id ?? a.Id ?? 0) - (b.id ?? b.Id ?? 0);
        })
    }));
    groups.sort((a, b) => String(a.parentText || '').localeCompare(String(b.parentText || ''), 'ar'));
    return groups;
}

function fdPlanDropdownFormPresentation(listType, items) {
    const lt = listType || '';
    if (lt === 'قائمة هرمية') {
        const nodes = fdBuildDropdownTreeNodes(items);
        if (nodes.length) return { mode: 'nested', nodes };
    }
    if (lt === 'قائمة فرعية') {
        const nested = fdBuildDropdownTreeNodes(items);
        if (nested.length) return { mode: 'nested', nodes: nested };
        const groups = fdBuildSublistGroupedRoots(items);
        if (groups.length) return { mode: 'grouped', groups };
    }
    return { mode: 'flat' };
}

/** تبديل فروع قائمة الشجرة المربوطة بأزرار + / − */
function fdDdlBranchToggleHandler(e) {
    const btn = e.target.closest('.fd-ddl-tree .bnf-ou-tree-exp');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const row = btn.closest('.bnf-ou-tree-row');
    if (!row) return;
    const branch = row.nextElementSibling;
    if (!branch || !branch.classList.contains('fd-ddl-tree-branch')) return;
    const nowCollapsed = branch.classList.toggle('d-none');
    btn.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
    btn.textContent = nowCollapsed ? '+' : '−';
}

function fdDdlEnsureTreeExpandDelegation() {
    if (typeof window === 'undefined') return;
    if (window.fdDdlTreeExpBound) return;
    window.fdDdlTreeExpBound = true;
    document.addEventListener('click', fdDdlBranchToggleHandler);
}

function fdRenderDropdownTreeLeaves(items, inputType, nameBase, disabled, defSingle, defMultiSet, depth) {
    let html = '';
    const indent = Math.max(0, (depth || 0) * 22);
    const pr = 12 + indent;
    items.forEach((item, idx) => {
        const id = item.id ?? item.Id ?? idx;
        const txt = String(item.itemText ?? item.ItemText ?? '').trim();
        const inputId = `${nameBase}_i_${id}_${depth}_${idx}`;
        const dis = disabled ? ' disabled' : '';
        let checked = '';
        if (inputType === 'checkbox') {
            if (defMultiSet[txt]) checked = ' checked';
        } else if (String(defSingle || '') === txt) checked = ' checked';
        const inp = inputType === 'checkbox'
            ? `<input class="form-check-input flex-shrink-0" type="checkbox" id="${fdEscAttr(inputId)}" value="${fdEscAttr(String(id))}" data-dd-text="${fdEscAttr(txt)}"${checked}${dis}>`
            : `<input class="form-check-input flex-shrink-0" type="radio" name="${fdEscAttr(nameBase)}" id="${fdEscAttr(inputId)}" value="${fdEscAttr(String(id))}" data-dd-text="${fdEscAttr(txt)}"${checked}${dis}>`;
        html += `<div class="fd-ddl-tree-node">`;
        html += `<div class="bnf-ou-tree-row d-flex align-items-center" dir="rtl" role="presentation" style="padding:8px 10px;padding-right:${pr}px;gap:8px;">`;
        html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
        html += `<div class="form-check m-0 flex-grow-1 d-flex align-items-center gap-2" style="min-width:0;">${inp}<label class="form-check-label mb-0" style="flex:1;min-width:0;" for="${fdEscAttr(inputId)}">${esc(txt)}</label></div>`;
        html += '</div></div>';
    });
    return html;
}

function fdRenderDropdownNestedNodes(nodes, inputType, nameBase, disabled, defSingle, defMultiSet, depth) {
    let html = '';
    nodes.forEach((node, idx) => {
        const item = node.item;
        const id = item.id ?? item.Id ?? idx;
        const txt = String(item.itemText ?? item.ItemText ?? '').trim();
        const hasKids = node.children && node.children.length > 0;
        const inputId = `${nameBase}_n_${id}_${depth}_${idx}`;
        const dis = disabled ? ' disabled' : '';
        let checked = '';
        if (inputType === 'checkbox') {
            if (defMultiSet[txt]) checked = ' checked';
        } else if (String(defSingle || '') === txt) checked = ' checked';
        const indent = Math.max(0, depth * 22);
        const pr = 12 + indent;
        const inp = inputType === 'checkbox'
            ? `<input class="form-check-input flex-shrink-0" type="checkbox" id="${fdEscAttr(inputId)}" value="${fdEscAttr(String(id))}" data-dd-text="${fdEscAttr(txt)}"${checked}${dis}>`
            : `<input class="form-check-input flex-shrink-0" type="radio" name="${fdEscAttr(nameBase)}" id="${fdEscAttr(inputId)}" value="${fdEscAttr(String(id))}" data-dd-text="${fdEscAttr(txt)}"${checked}${dis}>`;
        html += '<div class="fd-ddl-tree-node">';
        html += `<div class="bnf-ou-tree-row d-flex align-items-center" dir="rtl" role="presentation" style="padding:8px 10px;padding-right:${pr}px;gap:8px;">`;
        if (hasKids) {
            html += '<button type="button" class="bnf-ou-tree-exp" aria-expanded="false">+</button>';
        } else {
            html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += `<div class="form-check m-0 flex-grow-1 d-flex align-items-center gap-2" style="min-width:0;">${inp}<label class="form-check-label fw-semibold mb-0" style="flex:1;min-width:0;" for="${fdEscAttr(inputId)}">${esc(txt)}</label></div>`;
        html += '</div>';
        if (hasKids) {
            html += `<div class="fd-ddl-tree-branch d-none">${fdRenderDropdownNestedNodes(node.children, inputType, nameBase, disabled, defSingle, defMultiSet, depth + 1)}</div>`;
        }
        html += '</div>';
    });
    return html;
}

function fdBuildBoundDropdownHtml(f, props, reqAttr, roSel, ttAttr, mk, ph) {
    const listId = props.dropdownListId;
    const entry = fdNormalizeDropdownCacheEntry(listId);
    const { listType, selectionType, items } = entry;
    const multi = fdSelectionIsMulti(selectionType);
    const emptyLab = (props.emptyText || ph || 'اختر...').replace(/</g, '&lt;');
    const def = (props.defaultOption || '').trim();
    const defMulti = {};
    String(props.defaultOption || '').split(/,\s*/).forEach(d => { const t = d.trim(); if (t) defMulti[t] = true; });
    const disabled = props.readOnly ? ' disabled' : '';
    const nameBase = 'fd_dd_' + String(f.id ?? 'f') + '_' + String(listId);
    const presentation = fdPlanDropdownFormPresentation(listType, items);

    if (!items.length) {
        return `<select class="form-select"${reqAttr}${roSel}${ttAttr}${mk()}><option value="">${emptyLab}</option><option disabled>— لم تُحمَّل عناصر القائمة —</option></select>`;
    }

    if (presentation.mode === 'flat') {
        const labels = items.map(it => String(it.itemText ?? it.ItemText ?? '').trim()).filter(Boolean);
        if (multi) {
            const sz = Math.min(Math.max(labels.length + 1, 3), 12);
            let h = `<select class="form-select" multiple size="${sz}"${reqAttr}${roSel}${ttAttr}${mk()}>`;
            labels.forEach(o => {
                const sel = defMulti[o] ? ' selected' : '';
                h += `<option value="${fdEscAttr(o)}"${sel}>${o.replace(/</g, '&lt;')}</option>`;
            });
            return h + '</select>';
        }
        let inp = `<select class="form-select"${reqAttr}${roSel}${ttAttr}${mk()}><option value="">${emptyLab}</option>`;
        labels.forEach(o => {
            inp += `<option value="${fdEscAttr(o)}"${o === def ? ' selected' : ''}>${o.replace(/</g, '&lt;')}</option>`;
        });
        return inp + '</select>';
    }

    const inputType = multi ? 'checkbox' : 'radio';
    let innerUl = '';
    if (presentation.mode === 'nested') {
        innerUl = fdRenderDropdownNestedNodes(presentation.nodes, inputType, nameBase, disabled, def, defMulti, 0);
    } else if (presentation.mode === 'grouped') {
        innerUl = presentation.groups.map(g => {
            const header = g.parentText
                ? `<div class="fd-ddl-tree-group-heading fw-semibold small text-muted">${esc(g.parentText)}</div>`
                : '';
            const leaves = fdRenderDropdownTreeLeaves(g.items, inputType, nameBase, disabled, def, defMulti, g.parentText ? 1 : 0);
            return `<div class="fd-ddl-tree-group">${header}<div>${leaves}</div></div>`;
        }).join('');
    }

    const reqHint = f.isRequired && !multi ? ' <span class="text-danger">*</span>' : '';
    return `<div class="fd-ddl-tree"${ttAttr}${mk()}><div class="small text-muted mb-2 px-1">${multi ? 'يمكنك تحديد أكثر من خيار' : emptyLab}${reqHint}</div><div class="fd-ddl-tree-panel">${innerUl}</div></div>`;
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
    const lt = document.getElementById('fdProp_listType');
    if (lt) {
        lt.onchange = () => fdRefreshDropdownListPicker();
    }
    const rt = document.getElementById('fdProp_readyTableId');
    if (rt) {
        rt.onchange = () => {
            const v = parseInt(rt.value, 10) || 0;
            if (v) fdFetchReadyTableGridForField(v);
        };
    }
}

function fdRefreshDropdownListPicker(preselectId) {
    const dl = document.getElementById('fdProp_dropdownListId');
    const lt = document.getElementById('fdProp_listType');
    if (!dl) return;
    const selectedType = lt ? (lt.value || '') : '';
    if (!selectedType) {
        dl.disabled = true;
        dl.innerHTML = '<option value="">-- اختر نوع القائمة أولاً --</option>';
        return;
    }
    const all = fdBindingLookups.dropdownLists || [];
    const filtered = all.filter(o => {
        const lstType = o.listType || o.ListType || 'قائمة مستقلة';
        return lstType === selectedType;
    });
    dl.disabled = false;
    let html = `<option value="">-- اختر اسم القائمة --</option>`;
    filtered.forEach(o => {
        const id = o.id ?? o.Id;
        const nm = o.name ?? o.Name ?? '';
        html += `<option value="${id}">${esc(nm)}</option>`;
    });
    if (!filtered.length) {
        html += `<option value="" disabled>— لا توجد قوائم من هذا النوع —</option>`;
    }
    dl.innerHTML = html;
    if (preselectId) {
        const exists = filtered.some(o => (o.id ?? o.Id) === preselectId);
        if (exists) dl.value = String(preselectId);
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
    const perOther = el.getAttribute('data-fd-per-option-other') === '1';
    const markLines = String(po.choiceOtherMarks || '').split(/[\r\n]+/);
    lines.forEach((t, idx) => {
        const mk = !!(perOther && (markLines[idx] === '1' || /^true$/i.test((markLines[idx] || '').trim())));
        rowsHost.appendChild(fdCreateOptionRow(pfx, mode, t, defStr, defMulti, propKey, { showOtherCheckbox: perOther, otherChecked: mk }));
    });
    el.appendChild(rowsHost);
    const btn = document.createElement('button'); btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-primary mt-2';
    btn.innerHTML = '<i class="bi bi-plus-lg"></i> إضافة خيار';
    btn.onclick = () => rowsHost.appendChild(fdCreateOptionRow(pfx, mode, '', '', [], propKey, { showOtherCheckbox: perOther, otherChecked: false }));
    el.appendChild(btn);
}

function fdCreateOptionRow(pfx, mode, text, defSingle, defMultiArr, propKey, rowOpts) {
    propKey = propKey || 'options';
    rowOpts = rowOpts || {};
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
        if (rowOpts.showOtherCheckbox) {
            const od = document.createElement('div'); od.className = 'form-check m-0 flex-shrink-0';
            const oc = document.createElement('input'); oc.type = 'checkbox'; oc.className = 'form-check-input rtc-opt-choice-other';
            //oc.title = 'عند التفعيل، يظهر مربع نص مرتبط بهذا الخيار عند اختياره في النموذج';
            if (rowOpts.otherChecked) oc.checked = true;
            const ol = document.createElement('label'); ol.className = 'form-check-label small'; ol.textContent = 'أخرى';
            od.appendChild(oc); od.appendChild(ol); wrap.appendChild(od);
        }
    } else {
        const d = document.createElement('div'); d.className = 'form-check m-0 flex-shrink-0';
        const r = document.createElement('input'); r.type = 'radio'; r.name = pfx + '_' + propKey + '_defaultOpt';
        r.className = 'form-check-input rtc-opt-def-single';
        if (trimmed && defSingle && trimmed === defSingle) r.checked = true;
        const l = document.createElement('label'); l.className = 'form-check-label small'; l.textContent = 'افتراضي';
        d.appendChild(r); d.appendChild(l); wrap.appendChild(d);
        if (rowOpts.showOtherCheckbox) {
            const od = document.createElement('div'); od.className = 'form-check m-0 flex-shrink-0';
            const oc = document.createElement('input'); oc.type = 'checkbox'; oc.className = 'form-check-input rtc-opt-choice-other';
            //oc.title = 'عند التفعيل، يظهر مربع نص في المعاينة ليقوم المستخدم بكتابة خيار آخر بعد اختيار هذا الخيار';
            if (rowOpts.otherChecked) oc.checked = true;
            const ol = document.createElement('label'); ol.className = 'form-check-label small'; ol.textContent = 'أخرى';
            od.appendChild(oc); od.appendChild(ol); wrap.appendChild(od);
        }
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
    const perOther = el.getAttribute('data-fd-per-option-other') === '1';
    const host = el.querySelector('.rtc-opt-rows');
    if (!host) return { options:'', defaultOption:'' };
    const lines = [], defMulti = []; let defOption = ''; const otherMarks = [];
    host.querySelectorAll('.rtc-opt-row').forEach(row => {
        const t = (row.querySelector('.rtc-opt-text')?.value || '').trim();
        if (!t) return; lines.push(t);
        if (mode === 'multi') {
            if (row.querySelector('.rtc-opt-def-multi')?.checked) defMulti.push(t);
            if (perOther) otherMarks.push((row.querySelector('.rtc-opt-choice-other')?.checked) ? '1' : '0');
        } else {
            if (row.querySelector('.rtc-opt-def-single')?.checked) defOption = t;
            if (perOther) otherMarks.push((row.querySelector('.rtc-opt-choice-other')?.checked) ? '1' : '0');
        }
    });
    const out = { options: lines.join('\n'), defaultOption: mode === 'multi' ? defMulti.join(', ') : defOption };
    if (perOther) out.choiceOtherMarks = otherMarks.join('\n');
    return out;
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
        if (p.perOptionOther && o.choiceOtherMarks != null) result.choiceOtherMarks = o.choiceOtherMarks;
    });
    if (def.props.some(p => p.type === 'fileTypesPick')) result.fileTypes = fdCollectFileTypesPick(pfx);
    return result;
}

function fdApplyPropsSpecialEditors(type, pfx, po) {
    const def = FD_FIELD_TYPES[type]; if (!def) return;
    def.props.forEach(p => { if (p.type === 'optionList') fdInitOptionListEditor(pfx, p.choiceMode||'single', po||{}, p.key); });
    fdApplyFileTypesFromProps(pfx, po||{});
    if (type === 'صورة عرض') fdWireDisplayImageProp(pfx, 'imageUrl');
}

function fdBuildSinglePropHtml(p, pfx) {
    if (p.type === 'dropdownListPick') {
        const col = p.col || 'col-md-4 mb-3';
        let h = `<div class="${col}"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label} <span class="required-star">*</span></label>
        <select class="form-select form-select-sm" id="fdProp_dropdownListId" style="border-radius:8px;font-size:12.5px;" disabled>
            <option value="">-- اختر نوع القائمة أولاً --</option>
        </select>
        </div>`;
        return h;
    }
    if (p.type === 'readyTablePick') {
        const opts = fdBindingLookups.readyTables || [];
        const col = p.col || 'col-md-4 mb-3';
        let h = `<div class="${col}"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label} <span class="required-star">*</span></label>
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
        const dOther = p.perOptionOther ? ' data-fd-per-option-other="1"' : '';
        return `<div class="col-12 mb-3"><label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label}</label>
        <p class="text-muted small mb-2" style="font-size:11px;">أضف خياراً لكل سطر، وحدد «افتراضي» لقيمة تظهر تلقائياً.</p>
        <div id="${pfx}_${p.key}_options_editor" class="border rounded-3 p-3" style="background:#fafafa;" data-mode="${p.choiceMode||'single'}"${dOther}></div></div>`;
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
    if (p.type === 'displayImageUpload') {
        const fid = `${pfx}_${p.key}`;
        return `<div class="col-12 mb-3 fd-display-image-prop">
        <label class="d-block fw-bold mb-1" style="color:var(--gray-600);font-size:12px;">${p.label}</label>
        <input type="file" class="form-control form-control-sm" id="${fid}_file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp">
        <p class="text-muted small mb-0 mt-1" style="font-size:11px;">اختر ملف صورة من الجهاز (PNG، JPEG، GIF، WebP). تُخزَّن ضمن النموذج كمرفق.</p>
        <textarea class="form-control form-control-sm visually-hidden" id="${fid}" rows="1" autocomplete="off" style="position:absolute;left:-9999px;height:1px;width:1px;opacity:0;" aria-hidden="true"></textarea>
        <div class="mt-2 p-2 rounded-3" style="border:1px dashed var(--gray-300);background:var(--gray-50);min-height:72px;">
            <img id="${fid}_preview" alt="" class="rounded" style="max-width:100%;max-height:180px;display:none;object-fit:contain;">
            <span id="${fid}_empty" class="text-muted small">لم تُرفع صورة بعد</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="${fid}_clear" style="display:none;">إزالة الصورة</button>
        </div>`;
    }
    const fid = `${pfx}_${p.key}`;
    const col = p.col || 'col-md-4 col-sm-6 mb-3';
    const hints = { subName:'<div class="text-muted" style="font-size:10px;margin-top:2px;">نص صغير يظهر أسفل الحقل</div>', defaultValue:'<div class="text-muted" style="font-size:10px;margin-top:2px;">قيمة تُعبأ تلقائياً في الحقل</div>', placeholder:'<div class="text-muted" style="font-size:10px;margin-top:2px;">نص إرشادي يختفي عند الكتابة</div>' };
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

/** ربط حقل إرفاق صورة «صورة عرض»: قراءة الملف إلى data URL في الحقل الخفي + معاينة. */
function fdWireDisplayImageProp(pfx, key) {
    const tid = `${pfx}_${key}`;
    const fileInp = document.getElementById(`${tid}_file`);
    const ta = document.getElementById(tid);
    const prev = document.getElementById(`${tid}_preview`);
    const empty = document.getElementById(`${tid}_empty`);
    const clr = document.getElementById(`${tid}_clear`);
    if (!fileInp || !ta) return;
    function sync() {
        const v = String(ta.value || '').trim();
        if (v) {
            if (prev) { prev.src = v; prev.style.display = ''; }
            if (empty) empty.style.display = 'none';
            if (clr) clr.style.display = '';
        } else {
            if (prev) { prev.removeAttribute('src'); prev.style.display = 'none'; }
            if (empty) empty.style.display = '';
            if (clr) clr.style.display = 'none';
        }
    }
    fileInp.onchange = function () {
        const f = fileInp.files && fileInp.files[0];
        if (!f) return;
        if (!/^image\//i.test(f.type)) {
            if (typeof showToast === 'function') showToast('يرجى اختيار ملف صورة', 'error');
            fileInp.value = '';
            return;
        }
        const r = new FileReader();
        r.onload = () => { ta.value = r.result || ''; sync(); };
        r.readAsDataURL(f);
        fileInp.value = '';
    };
    if (clr) clr.onclick = () => { ta.value = ''; sync(); };
    sync();
}

function fdParseLines(s) {
    if (s == null || s === '') return [];
    return String(s).split(/[\r\n]+/).map(x => x.trim()).filter(Boolean);
}

/** يُكمِّل «صيغة الرقم» بفرض «نمط الإدخال» في حقول المعاينة. filter → تقييد مباشر أثناء الكتابة واللصق */
function fdPhoneInputPatternExtras(inputPatternRaw) {
    const ip = String(inputPatternRaw || 'أرقام فقط').trim();
    if (ip === 'حروف فقط')
        return { inpType: 'text', pt: ' pattern="^[A-Za-z\\u0600-\\u06FF\\s\\.\\-]+$"', inputmode: '', titleAttr: ` title="${fdEscAttr('حروف فقط')}"`, filter: 'letters' };
    if (ip === 'حروف وأرقام')
        return { inpType: 'text', pt: ' pattern="^[A-Za-z0-9\\u0600-\\u06FF\\s\\.\\-]+$"', inputmode: '', titleAttr: ` title="${fdEscAttr('حروف وأرقام')}"`, filter: 'alnum' };
    return { inpType: 'tel', pt: ' pattern="^[0-9]+$"', inputmode: ' inputmode="numeric"', titleAttr: ` title="${fdEscAttr('أرقام فقط')}"`, filter: 'digits' };
}

/** إزالة الأحرف غير المطابقة لنمط حقل الهاتف (كامل النص أو جزء اللصق). */
function fdPhoneFilterStr(mode, s) {
    const str = s == null ? '' : String(s);
    if (mode === 'digits') return str.replace(/[^0-9]/g, '');
    if (mode === 'letters') return str.replace(/[^A-Za-z\u0600-\u06FF\s\.\-]/g, '');
    if (mode === 'alnum') return str.replace(/[^A-Za-z0-9\u0600-\u06FF\s\.\-]/g, '');
    return str;
}

/** أقصى طول فقط عند وجود خاصية maxlength في الوسم (تجنّب قيم maxLength الافتراضية الضخمة في المتصفح). */
function fdPhoneParsedMaxLength(inp) {
    if (!inp || typeof inp.hasAttribute !== 'function' || !inp.hasAttribute('maxlength')) return null;
    const n = parseInt(String(inp.getAttribute('maxlength')), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function fdClampPhonePatternValue(inp) {
    const mode = inp.getAttribute('data-fd-phone-filter');
    if (!mode || inp.readOnly || inp.disabled) return;
    if (inp.dataset.fdCompose === '1') return;
    const old = inp.value;
    let caret = typeof inp.selectionStart === 'number' ? inp.selectionStart : old.length;
    let next = fdPhoneFilterStr(mode, old);
    const maxLen = fdPhoneParsedMaxLength(inp);
    if (maxLen != null && next.length > maxLen) next = next.slice(0, maxLen);
    if (next === old) return;
    const caretBase = caret <= 0 ? '' : fdPhoneFilterStr(mode, old.slice(0, caret));
    let newCaret = Math.min(caretBase.length, next.length);
    inp.value = next;
    inp.setSelectionRange(newCaret, newCaret);
}

function fdBindPhonePatternFilters(root) {
    const scope = root || document;
    scope.querySelectorAll('input[data-fd-phone-filter]').forEach(inp => {
        if (inp.readOnly || inp.disabled) return;
        if (inp.getAttribute('data-fd-phone-pat-bound') === '1') return;
        inp.setAttribute('data-fd-phone-pat-bound', '1');
        inp.addEventListener('input', () => fdClampPhonePatternValue(inp));
        inp.addEventListener('compositionstart', () => { inp.dataset.fdCompose = '1'; }, false);
        inp.addEventListener('compositionend', () => {
            delete inp.dataset.fdCompose;
            fdClampPhonePatternValue(inp);
        }, false);
        inp.addEventListener('paste', e => {
            if (inp.readOnly || inp.disabled) return;
            const mode = inp.getAttribute('data-fd-phone-filter');
            if (!mode) return;
            e.preventDefault();
            let pasted = '';
            try {
                const cd = e.clipboardData || (typeof window !== 'undefined' ? window.clipboardData : null);
                pasted = cd && typeof cd.getData === 'function' ? cd.getData('text') : '';
            } catch (_) { pasted = ''; }
            const insRaw = fdPhoneFilterStr(mode, pasted);
            const start = inp.selectionStart || 0;
            const end = inp.selectionEnd || 0;
            const mergedRaw = inp.value.slice(0, start) + insRaw + inp.value.slice(end);
            let merged = fdPhoneFilterStr(mode, mergedRaw);
            const maxLen = fdPhoneParsedMaxLength(inp);
            if (maxLen != null && merged.length > maxLen) merged = merged.slice(0, maxLen);
            const caretAfterIns = fdPhoneFilterStr(mode, inp.value.slice(0, start) + insRaw).length;
            const newCaret = Math.min(caretAfterIns, merged.length);
            inp.value = merged;
            inp.setSelectionRange(newCaret, newCaret);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
        }, true);
        fdClampPhonePatternValue(inp);
    });
}

/** معاينة قائمة واحد/متعدد: مربع نص لكل خيار «أخرى»، وإلزامه عند ظهوره إذا كان الحقل مطلوباً. */
function fdOcHideAllOtherWrapsInGroup(g) {
    if (!g || !g.querySelectorAll) return;
    g.querySelectorAll('.fd-oc-other-wrap').forEach(w => { w.style.display = 'none'; });
    g.querySelectorAll('.fd-oc-other-input').forEach(t => { t.required = false; });
}

function fdOcGroupIsRequired(g) {
    return g && g.getAttribute('data-fd-required') === '1';
}

function fdOcSyncCheckbox(cb) {
    const item = cb && cb.closest ? cb.closest('.fd-oc-item') : null;
    const g = cb && cb.closest ? cb.closest('.fd-oc-group') : null;
    if (!item || !g) return;
    const wrap = item.querySelector('.fd-oc-other-wrap');
    const tInp = item.querySelector('.fd-oc-other-input');
    if (!wrap) return;
    const isOther = cb.getAttribute('data-fd-other') === '1';
    const show = !!cb.checked && isOther;
    wrap.style.display = show ? 'block' : 'none';
    if (tInp) tInp.required = !!(show && fdOcGroupIsRequired(g));
}

function fdOcSyncRadioGroup(g) {
    if (!g || !g.querySelectorAll) return;
    const sel = g.querySelector('input[type="radio"]:checked');
    if (!sel) { fdOcHideAllOtherWrapsInGroup(g); return; }
    const req = fdOcGroupIsRequired(g);
    g.querySelectorAll('.fd-oc-item').forEach(item => {
        const r = item.querySelector('input[type="radio"]');
        const wrap = item.querySelector('.fd-oc-other-wrap');
        const tInp = item.querySelector('.fd-oc-other-input');
        if (!wrap || !r) return;
        const show = !!(r.checked && r.getAttribute('data-fd-other') === '1');
        wrap.style.display = show ? 'block' : 'none';
        if (tInp) tInp.required = !!(show && req);
    });
}

function fdOcChoiceChange(el) {
    const g = el && el.closest ? el.closest('.fd-oc-group') : null;
    if (!g) return;
    const mode = g.getAttribute('data-fd-oc-mode') || '';
    if (el.type === 'radio' || mode === 'single') fdOcSyncRadioGroup(g);
    else fdOcSyncCheckbox(el);
}

function fdOcInitGroup(g) {
    const mode = g.getAttribute('data-fd-oc-mode') || '';
    if (mode === 'single') fdOcSyncRadioGroup(g);
    else g.querySelectorAll('input[type="checkbox"][data-fd-other]').forEach(cb => fdOcSyncCheckbox(cb));
}
if (typeof window !== 'undefined') window.fdOcChoiceChange = fdOcChoiceChange;

// ─── HIJRI DATE PICKER (معاينة حقل تاريخ — يطابق تجربة type=date بقدر الإمكان) ─
const FD_HIJRI_MONTH_NAMES = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];

function fdHijriIntlSupported() {
    try {
        new Intl.DateTimeFormat('en', { calendar: 'islamic-umalqura' }).format(new Date());
        return true;
    } catch { return false; }
}

function fdUtcDate(y, m, d, h12) {
    return new Date(Date.UTC(y, m - 1, d, typeof h12 === 'number' ? h12 : 12, 0, 0));
}

function fdAddDaysUtc(d, n) {
    const x = new Date(d.getTime());
    x.setUTCDate(x.getUTCDate() + n);
    return x;
}

function fdIntlHijriPartsUtc(d) {
    const fmt = new Intl.DateTimeFormat('en-US', { calendar: 'islamic-umalqura', timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = {}; fmt.formatToParts(d).forEach(p => { if (p.type !== 'literal') parts[p.type] = +p.value; });
    return { y: parts.year, m: parts.month, d: parts.day };
}

function fdHijriMonthKey(y, m) {
    return y * 12 + m;
}

function fdFindFirstGregorianDayOfHijriMonth(hy, hm) {
    const targetKey = fdHijriMonthKey(hy, hm);
    let d = fdAddDaysUtc(fdUtcDate(622, 7, 18, 12), Math.floor(((hy - 1) * 12 + (hm - 1)) * 29.530588853));
    for (let i = 0; i < 200; i++) {
        const h = fdIntlHijriPartsUtc(d);
        const curKey = fdHijriMonthKey(h.y, h.m);
        if (curKey === targetKey) break;
        const step = Math.max(-90, Math.min(90, (targetKey - curKey) * 29));
        d = fdAddDaysUtc(d, step === 0 ? (targetKey > curKey ? 1 : -1) : step);
    }
    for (let i = 0; i < 500; i++) {
        const h = fdIntlHijriPartsUtc(d);
        const curKey = fdHijriMonthKey(h.y, h.m);
        if (curKey === targetKey) break;
        d = fdAddDaysUtc(d, curKey < targetKey ? 1 : -1);
    }
    for (let i = 0; i < 35; i++) {
        const p = fdIntlHijriPartsUtc(fdAddDaysUtc(d, -1));
        if (p.y === hy && p.m === hm) d = fdAddDaysUtc(d, -1);
        else break;
    }
    return d;
}

function fdDaysInHijriMonth(hy, hm) {
    let nHy = hm === 12 ? hy + 1 : hy;
    let nHm = hm === 12 ? 1 : hm + 1;
    const s = fdFindFirstGregorianDayOfHijriMonth(hy, hm);
    const e = fdFindFirstGregorianDayOfHijriMonth(nHy, nHm);
    return Math.round((e.getTime() - s.getTime()) / 86400000);
}

function fdFormatHijriStored(hy, hm, hd) {
    const p = (n, w) => String(n).padStart(w, '0');
    return `${hy}/${p(hm, 2)}/${p(hd, 2)}`;
}

function fdParseHijriStored(s) {
    if (s == null || String(s).trim() === '') return null;
    const m = String(s).trim().match(/^(\d{4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})$/);
    if (!m) return null;
    const hy = parseInt(m[1], 10), hm = parseInt(m[2], 10), hd = parseInt(m[3], 10);
    if (hm < 1 || hm > 12 || hd < 1 || hd > 31) return null;
    return { hy, hm, hd };
}

/** يَفهم قيم الواجهة المختلفة ويُحوّلها إلى طقم هجري Umm al-Qura (يوم كامل بتوقيت UTC). */
function fdCoerceFlexibleInputToHijriParts(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    const s = String(raw).trim();

    const isoGre = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    let m = s.match(isoGre);
    if (m) {
        const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
        if (y >= 1900 && y <= 3100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            const g = fdUtcDate(y, mo, d, 12);
            if (!isNaN(g.getTime())) return fdIntlHijriPartsUtc(g);
        }
        if (y < 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            const hj = fdParseHijriStored(s);
            if (hj) return hj;
        }
    }

    const dmyGre = /^(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{4})$/;
    m = s.match(dmyGre);
    if (m) {
        const dd = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
        if (y >= 1900 && y <= 3100 && mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) {
            const g = fdUtcDate(y, mo, dd, 12);
            if (!isNaN(g.getTime())) return fdIntlHijriPartsUtc(g);
        }
    }

    const ymd4 = /^(\d{4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})$/;
    m = s.match(ymd4);
    if (m) {
        const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
        if (y >= 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            const g = fdUtcDate(y, mo, d, 12);
            if (!isNaN(g.getTime())) return fdIntlHijriPartsUtc(g);
        }
    }

    return fdParseHijriStored(s);
}

/** يُطبِّع الواجهة والمُخفي إلى «سنة/شهر/يوم» هجري وفق مدخلات المستخدم (ميلادي أو هجري). */
function fdHijriNormalizeFaceAndStore(wrap, opts) {
    if (!wrap) return false;
    const face = wrap.querySelector('.fd-hijri-face');
    const store = wrap.querySelector('.fd-hijri-store');
    const raw = String((face && face.value) || (store && store.value) || '').trim();
    if (!raw) return false;

    let pv = fdCoerceFlexibleInputToHijriParts(raw);
    if (!pv) return false;

    const g = fdGregorianUtcFromHijri(pv.hy, pv.hm, pv.hd);
    const minG = wrap._fdMinG || null;
    const maxG = wrap._fdMaxG || null;
    if (!fdHijriInRange(g, minG, maxG)) {
        const clr = !!(opts && opts.clearOnInvalidRange);
        if (clr) {
            if (store) store.value = '';
            if (face) face.value = '';
            wrap.removeAttribute('data-fd-hy');
            wrap.removeAttribute('data-fd-hm');
        }
        return false;
    }

    const disp = fdFormatHijriStored(pv.hy, pv.hm, pv.hd);
    if (store) store.value = disp;
    if (face) face.value = disp;
    wrap.setAttribute('data-fd-hy', String(pv.hy));
    wrap.setAttribute('data-fd-hm', String(pv.hm));
    return true;
}

function fdGregorianUtcFromHijri(hy, hm, hd) {
    const start = fdFindFirstGregorianDayOfHijriMonth(hy, hm);
    return fdAddDaysUtc(start, hd - 1);
}

function fdParseIsoMinMax(s) {
    if (!s || !/\d{4}-\d{2}-\d{2}/.test(String(s))) return null;
    const [y, m, d] = String(s).split('-').map(x => parseInt(x, 10));
    const u = fdUtcDate(y, m, d, 12);
    return isNaN(u.getTime()) ? null : u;
}

function fdHijriInRange(gUtc, minG, maxG) {
    if (!gUtc || isNaN(gUtc.getTime())) return false;
    if (minG && +gUtc < +minG) return false;
    if (maxG && +gUtc > +maxG) return false;
    return true;
}

/** آخر لوحة تقويم (هجري/ميلادي) مفتوحة — يُغلق بالنقر خارجها أو Escape. */
let fdCalOpenPanel = null;

const FD_CAL_POP_PANEL_WIDTH = 256;

/** تموضع اللوحة بجانب المجموعة (نفس العرض الهجري/الميلادي). */
function fdCalPositionPanel(panel, wrap) {
    if (!panel || !wrap) return;
    const anchor = wrap.querySelector('.fd-date-input-group') || wrap;
    const rr = anchor.getBoundingClientRect();
    const vw = typeof window.innerWidth === 'number' ? window.innerWidth : 480;
    const vh = typeof window.innerHeight === 'number' ? window.innerHeight : 600;
    const gutter = 5;
    const pw = FD_CAL_POP_PANEL_WIDTH;
    panel.style.position = 'fixed';
    panel.style.zIndex = '1090';
    panel.style.margin = '0';
    panel.style.width = pw + 'px';
    panel.style.left = '';
    panel.style.right = '';
    panel.style.bottom = '';

    let top = rr.bottom + gutter;
    let left = rr.left;

    const ph = panel.offsetHeight || 280;
    if (top + ph > vh - 8 && rr.top > ph + gutter) top = rr.top - ph - gutter;
    else if (top + ph > vh - 8) top = Math.max(8, vh - ph - 8);

    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
}

function fdCalRepositionOpenPanel() {
    const p = fdCalOpenPanel;
    if (!p || !p._fdAttachedWrap) return;
    fdCalPositionPanel(p, p._fdAttachedWrap);
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const t = e.target;
        if (!fdCalOpenPanel) return;
        const host = fdCalOpenPanel.closest && fdCalOpenPanel.closest('.fd-date-field-wrap');
        if (host && host.contains(t)) return;
        fdCalOpenPanel.style.display = 'none';
        try { fdCalOpenPanel._fdAttachedWrap = null; } catch (_) {}
        fdCalOpenPanel = null;
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Escape' || e.code === 'Escape') && fdCalOpenPanel) {
            fdCalOpenPanel.style.display = 'none';
            try { fdCalOpenPanel._fdAttachedWrap = null; } catch (_) {}
            fdCalOpenPanel = null;
        }
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('scroll', () => fdCalRepositionOpenPanel(), { capture: true, passive: true });
    window.addEventListener('resize', () => fdCalRepositionOpenPanel(), { passive: true });
}

/** هيكل واحد لمربع التقويم (هجري/ميلادي) — نفس الـ DOM والتنسيق. */
function fdCalPopShellHtml(ariaLabel) {
    const al = fdEscAttr(ariaLabel);
    return `<div class="fd-cal-pop fd-cal-pop--floating" dir="rtl" role="dialog" aria-label="${al}" style="display:none;">
<div class="fd-cal-pop-inner">
<div class="fd-cal-nav-row d-flex justify-content-between align-items-stretch gap-2 px-3 pt-3 pb-2">
<button type="button" tabindex="-1" class="btn btn-sm fd-cal-nav-btn fd-cal-prev" aria-label="الشهر السابق">‹</button>
<span class="fd-cal-cap flex-grow-1 text-center align-self-center"></span>
<button type="button" tabindex="-1" class="btn btn-sm fd-cal-nav-btn fd-cal-next" aria-label="الشهر التالي">›</button></div>
<div class="fd-cal-head fd-cal-weekdays"></div>
<div class="fd-cal-grid fd-cal-days"></div>
<div class="fd-cal-footer"><button type="button" tabindex="-1" class="btn fd-cal-clear">مسح التاريخ</button></div>
</div></div>`;
}

function fdGregorianParseIsoStored(raw) {
    const s = String(raw || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = fdUtcDate(y, mo, d, 12);
    if (isNaN(dt.getTime())) return null;
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
    return { y, m: mo, d };
}

/** تطبيع إدخال التاريخ yyyy-mm-dd دون المس بالمنطق الهجري. */
function fdGregorianNormalizeFaceAndStore(wrap, opts) {
    const face = wrap.querySelector('.fd-greg-face');
    if (!face) return false;
    const raw = String(face.value || '').trim();
    if (!raw) return true;
    const p = fdGregorianParseIsoStored(raw);
    const minG = wrap._fdMinG || null;
    const maxG = wrap._fdMaxG || null;
    const clr = !!(opts && opts.clearOnInvalidRange);
    if (!p) {
        if (clr) face.value = '';
        return false;
    }
    const g = fdUtcDate(p.y, p.m, p.d, 12);
    if (!fdHijriInRange(g, minG, maxG)) {
        if (clr) face.value = '';
        return false;
    }
    face.value = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    return true;
}

function fdGregorianRenderMonth(panel, wrap) {
    let gy = parseInt(wrap.getAttribute('data-fd-gy') || '', 10);
    let gm = parseInt(wrap.getAttribute('data-fd-gm') || '', 10);
    const face = wrap.querySelector('.fd-greg-face');
    const sel = fdGregorianParseIsoStored(face && face.value);
    if (!(gy > 0 && gm >= 1 && gm <= 12)) {
        if (sel) {
            gy = sel.y;
            gm = sel.m;
        } else {
            const n = new Date();
            gy = n.getUTCFullYear();
            gm = n.getUTCMonth() + 1;
        }
    }
    wrap.setAttribute('data-fd-gy', String(gy));
    wrap.setAttribute('data-fd-gm', String(gm));
    const cap = panel.querySelector('.fd-cal-cap');
    const head = panel.querySelector('.fd-cal-head');
    const grid = panel.querySelector('.fd-cal-grid');
    if (!head || !grid) return;
    if (cap) {
        try {
            const capFmt = new Intl.DateTimeFormat('ar', { calendar: 'gregory', month: 'long', year: 'numeric', timeZone: 'UTC' });
            cap.textContent = capFmt.format(new Date(Date.UTC(gy, gm - 1, 1)));
        } catch (_) {
            cap.textContent = `${gm} / ${gy}`;
        }
    }
    const wk = ['أ', 'إ', 'ث', 'ر', 'خ', 'ج', 'س'];
    head.innerHTML = wk.map(c => `<span class="fd-cal-wd">${c}</span>`).join('');
    const dim = new Date(Date.UTC(gy, gm, 0)).getUTCDate();
    const startCol = new Date(Date.UTC(gy, gm - 1, 1)).getUTCDay();
    const minG = wrap._fdMinG || null;
    const maxG = wrap._fdMaxG || null;
    let cells = '';
    let skip = startCol % 7;
    for (let i = 0; i < skip; i++) cells += '<span class="fd-cal-slot" aria-hidden="true"></span>';
    for (let day = 1; day <= dim; day++) {
        const gd = fdUtcDate(gy, gm, day, 12);
        const ok = fdHijriInRange(gd, minG, maxG);
        let cls = 'fd-cal-day ';
        cls += ok ? 'fd-cal-day--enabled' : 'fd-cal-day--disabled';
        if (sel && sel.y === gy && sel.m === gm && sel.d === day) cls += ' fd-cal-day--selected';
        cells += `<button type="button" tabindex="-1" class="${cls}" data-fd-d="${day}" ${ok ? '' : 'disabled aria-disabled="true"'}">${day}</button>`;
    }
    grid.innerHTML = cells;
    grid.querySelectorAll('[data-fd-d]').forEach(btn => {
        btn.addEventListener('mousedown', e => { e.preventDefault(); });
        btn.onclick = e => {
            e.stopPropagation();
            const dd = parseInt(btn.getAttribute('data-fd-d') || '', 10);
            if (!dd || btn.disabled) return;
            const g = fdUtcDate(gy, gm, dd, 12);
            if (!fdHijriInRange(g, minG, maxG)) return;
            const iso = `${gy}-${String(gm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
            if (face) face.value = iso;
            panel.style.display = 'none';
            try { panel._fdAttachedWrap = null; } catch (_) {}
            if (fdCalOpenPanel === panel) fdCalOpenPanel = null;
        };
    });
}

function fdHijriRenderMonth(panel, wrap) {
    let hy = parseInt(wrap.getAttribute('data-fd-hy') || '', 10);
    let hm = parseInt(wrap.getAttribute('data-fd-hm') || '', 10);
    const hSel = fdParseHijriStored(wrap.querySelector('.fd-hijri-store')?.value);
    if (!(hy > 0 && hm >= 1 && hm <= 12)) {
        const b = fdIntlHijriPartsUtc(fdUtcDate(2000, 1, 1, 12));
        hy = (hSel ? hSel.hy : b.y); hm = (hSel ? hSel.hm : b.m);
    }
    wrap.setAttribute('data-fd-hy', String(hy));
    wrap.setAttribute('data-fd-hm', String(hm));
    const cap = panel.querySelector('.fd-cal-cap');
    if (cap) cap.textContent = `${FD_HIJRI_MONTH_NAMES[hm - 1] || ''} ${hy} هـ`;
    const head = panel.querySelector('.fd-cal-head');
    const grid = panel.querySelector('.fd-cal-grid');
    if (!head || !grid) return;
    const wk = ['أ', 'إ', 'ث', 'ر', 'خ', 'ج', 'س'];
    head.innerHTML = wk.map(c => `<span class="fd-cal-wd">${c}</span>`).join('');
    const first = fdFindFirstGregorianDayOfHijriMonth(hy, hm);
    const len = fdDaysInHijriMonth(hy, hm);
    const startCol = first.getUTCDay();
    const minG = wrap._fdMinG || null;
    const maxG = wrap._fdMaxG || null;
    let cells = '';
    let skip = startCol % 7;
    for (let i = 0; i < skip; i++) cells += '<span class="fd-cal-slot" aria-hidden="true"></span>';
    for (let day = 1; day <= len; day++) {
        const gd = fdAddDaysUtc(first, day - 1);
        const ok = fdHijriInRange(gd, minG, maxG);
        let cls = 'fd-cal-day ';
        cls += ok ? 'fd-cal-day--enabled' : 'fd-cal-day--disabled';
        if (hSel && hSel.hy === hy && hSel.hm === hm && hSel.hd === day) cls += ' fd-cal-day--selected';
        cells += `<button type="button" tabindex="-1" class="${cls}" data-fd-d="${day}" ${ok ? '' : 'disabled aria-disabled="true"'}">${day}</button>`;
    }
    grid.innerHTML = cells;
    grid.querySelectorAll('[data-fd-d]').forEach(btn => {
        btn.addEventListener('mousedown', e => { e.preventDefault(); });
        btn.onclick = e => {
            e.stopPropagation();
            const dd = parseInt(btn.getAttribute('data-fd-d') || '', 10);
            if (!dd || btn.disabled) return;
            const g = fdGregorianUtcFromHijri(hy, hm, dd);
            if (!fdHijriInRange(g, minG, maxG)) return;
            const stor = fdFormatHijriStored(hy, hm, dd);
            const store = wrap.querySelector('.fd-hijri-store');
            const face = wrap.querySelector('.fd-hijri-face');
            if (store) store.value = stor;
            if (face) face.value = stor;
            panel.style.display = 'none';
            try { panel._fdAttachedWrap = null; } catch (_) {}
            if (fdCalOpenPanel === panel) fdCalOpenPanel = null;
        };
    });
}

function fdHijriBindWrap(wrap) {
    if (!wrap || wrap.dataset.fdHijriBound === '1') return;
    if (!fdHijriIntlSupported()) return;
    const minS = wrap.getAttribute('data-fd-min') || '';
    const maxS = wrap.getAttribute('data-fd-max') || '';
    wrap._fdMinG = fdParseIsoMinMax(minS);
    wrap._fdMaxG = fdParseIsoMinMax(maxS);
    if (!wrap.style.position) wrap.style.position = 'relative';

    let panel = wrap.querySelector(':scope > .fd-cal-pop');
    if (!panel) {
        wrap.insertAdjacentHTML('beforeend', fdCalPopShellHtml('منتقي التاريخ الهجري'));
        panel = wrap.querySelector(':scope > .fd-cal-pop');
    }
    if (!panel) return;

    const face = wrap.querySelector('.fd-hijri-face');
    const btn = wrap.querySelector('.fd-hijri-btn');
    const store = wrap.querySelector('.fd-hijri-store');

    const hadRawInit = String((face?.value ?? store?.value ?? '')).trim();
    if (hadRawInit) {
        fdHijriNormalizeFaceAndStore(wrap, { clearOnInvalidRange: true });
    }

    let pv = fdParseHijriStored(String((store?.value || '')).trim());
    if (!pv) {
        const now = new Date();
        const cur = fdIntlHijriPartsUtc(fdUtcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), 12));
        wrap.setAttribute('data-fd-hy', String(cur.y));
        wrap.setAttribute('data-fd-hm', String(cur.m));
    }

    wrap.dataset.fdHijriBound = '1';

    panel.querySelector('.fd-cal-prev')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-cal-prev')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        let hy = parseInt(wrap.getAttribute('data-fd-hy'), 10), hm = parseInt(wrap.getAttribute('data-fd-hm'), 10);
        if (hm <= 1) { hm = 12; hy -= 1; } else hm -= 1;
        wrap.setAttribute('data-fd-hy', String(hy));
        wrap.setAttribute('data-fd-hm', String(hm));
        fdHijriRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdCalPositionPanel(panel, wrap));
    });
    panel.querySelector('.fd-cal-next')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-cal-next')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        let hy = parseInt(wrap.getAttribute('data-fd-hy'), 10), hm = parseInt(wrap.getAttribute('data-fd-hm'), 10);
        if (hm >= 12) { hm = 1; hy += 1; } else hm += 1;
        wrap.setAttribute('data-fd-hy', String(hy));
        wrap.setAttribute('data-fd-hm', String(hm));
        fdHijriRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdCalPositionPanel(panel, wrap));
    });
    panel.querySelector('.fd-cal-clear')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-cal-clear')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (store) store.value = '';
        if (face) face.value = '';
        if (fdCalOpenPanel === panel) {
            panel.style.display = 'none';
            panel._fdAttachedWrap = null;
            fdCalOpenPanel = null;
        }
    });

    function togglePop(e) {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = (fdCalOpenPanel === panel && panel.style.display !== 'none');
        if (fdCalOpenPanel && fdCalOpenPanel !== panel) {
            fdCalOpenPanel.style.display = 'none';
            try { fdCalOpenPanel._fdAttachedWrap = null; } catch (_) {}
            fdCalOpenPanel = null;
        }
        if (wasOpen) {
            panel.style.display = 'none';
            fdCalOpenPanel = null;
            panel._fdAttachedWrap = null;
            return;
        }
        if (btn?.disabled || face?.readOnly) return;
        fdHijriNormalizeFaceAndStore(wrap);
        fdCalOpenPanel = panel;
        panel._fdAttachedWrap = wrap;
        panel.style.display = 'block';
        fdHijriRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdCalPositionPanel(panel, wrap));
    }
    btn?.addEventListener('click', togglePop);
    face?.addEventListener('click', togglePop);
    face?.addEventListener('blur', () => { fdHijriNormalizeFaceAndStore(wrap, { clearOnInvalidRange: true }); });
}

function fdHijriBindInRoot(root) {
    (root || document).querySelectorAll('.fd-hijri-date').forEach(fdHijriBindWrap);
}

/** تنسيق موحَّد لمربّعات التاريخ الهجري/الميلادي + نافذة التقويم المشتركة. */
function fdEnsureDateFieldStyles() {
    if (typeof document === 'undefined') return;
    const id = 'fd-date-field-unified-styles-v5';
    if (document.getElementById(id)) return;
    document.querySelectorAll('style[id^="fd-date-field-unified-styles"]').forEach(s => s.remove());
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
.fd-date-field-wrap .fd-date-input-group {
  align-items: stretch;
  direction: ltr;
  flex-direction: row;
}
.fd-date-field-wrap.fd-hijri-date,
.fd-date-field-wrap.fd-date-miladi {
  overflow: visible !important;
}
.fd-date-field-wrap .fd-date-input-group > .fd-date-control.form-control {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  direction: ltr;
  min-height: calc(1.5em + 0.75rem + 2px);
}
.fd-date-field-wrap .fd-date-input-group > input.fd-date-control.fd-hijri-face.form-control,
.fd-date-field-wrap .fd-date-input-group > input.fd-date-control.fd-greg-face.form-control,
.fd-date-field-wrap.fd-date-hijri-fallback .fd-date-input-group > .fd-date-control.form-control {
  font-variant-numeric: tabular-nums;
}
.fd-date-field-wrap .fd-date-input-group > .fd-date-cal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.6rem;
  padding-inline: 0.6rem;
  background: var(--sa-50, #ecfdf5);
  color: var(--sa-700, #047857);
  border-color: var(--gray-200, #e5e7eb);
  transition: background-color .15s ease, color .15s ease, border-color .15s ease;
}
.fd-date-field-wrap .fd-date-input-group > .fd-date-cal-btn:hover:not([disabled]) {
  background: var(--sa-100, #d1fae5);
  color: var(--sa-800, #065f46);
  border-color: var(--sa-300, #6ee7b7);
}
.fd-date-field-wrap .fd-date-input-group > .fd-date-cal-btn .bi-calendar3 {
  font-size: 1.1rem;
  line-height: 1;
}
.fd-date-field-wrap.fd-date-hijri-fallback .fd-date-cal-btn[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}
/* أيقونة التقويم على يسار الحقل: حواف يسرى مدوّرة على الزرّ، ويمنى على المدخل */
.fd-date-field-wrap .fd-date-cal-left.fd-date-input-group > .fd-date-cal-btn {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-inline-end: 0;
}
.fd-date-field-wrap .fd-date-cal-left.fd-date-input-group > .fd-date-control.form-control {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

/* قوائم الاختيار الأفقية */
.fd-oc-group.fd-oc-horiz { align-items: center; }
.fd-oc-group.fd-oc-horiz .fd-oc-item { flex: 0 0 auto; }
.fd-oc-group.fd-oc-horiz .form-check { display: inline-flex; align-items: center; padding-inline-start: 0; margin: 0; gap: 6px; }
.fd-oc-group.fd-oc-horiz .form-check-input { margin: 0; }
.fd-oc-group.fd-oc-horiz .form-check-label { margin: 0; cursor: pointer; }

/* تبديل (Switch) */
.fd-switch-field .fd-switch-input { width: 2.4rem; height: 1.3rem; cursor: pointer; }
.fd-switch-field .fd-switch-label { transition: color .15s ease; }

/* حقل الرابط */
.fd-url-input-group .fd-url-input { direction: ltr; }
.fd-url-input-group .fd-url-open-btn { white-space: nowrap; font-weight: 600; }
.fd-url-input-group .fd-url-open-btn .bi { font-size: 0.95rem; }

/* فاصل الصفحات داخل بانية الحقول */
.fd-page-break { user-select: none; }

/* مرقّم الصفحات للنماذج متعددة الصفحات */
.fd-form-pager { display: block; }
.fd-page-dot { transition: transform .15s ease; }
.fd-page-nav button[disabled] { opacity: 0.55; cursor: not-allowed; }

/* نافذة التقويم — هجري/ميلادي: حجم أوضح، شبكة منتظمة، بدون تلاصق */
.fd-cal-pop.fd-cal-pop--floating {
  position: fixed !important;
  inset: unset !important;
  margin: 0 !important;
  padding: 0 !important;
  left: auto;
  top: auto;
  z-index: 1090 !important;
  isolation: isolate;
  font-family: inherit;
}

.fd-cal-pop .fd-cal-pop-inner {
  width: ${FD_CAL_POP_PANEL_WIDTH}px;
  max-width: calc(100vw - 14px);
  box-sizing: border-box;
  background: #ffffff;
  border: 1px solid rgba(15, 23, 42, 0.09);
  border-radius: 10px;
  box-shadow:
    0 4px 18px rgba(15, 23, 42, 0.08),
    0 1px 3px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.fd-cal-pop .fd-cal-nav-row {
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  background: linear-gradient(to bottom, #fafbfc, #fff);
}

.fd-cal-pop .fd-cal-cap {
  font-size: 11.75px;
  font-weight: 700;
  line-height: 1.35;
  color: #0f172a;
  letter-spacing: 0.02em;
  padding: 4px 2px;
  min-height: 2.125rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.fd-cal-pop .fd-cal-nav-btn {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  min-width: 2rem;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  border-radius: 8px !important;
  border: 1px solid rgba(15, 23, 42, 0.12) !important;
  background: #ffffff !important;
  color: #334155 !important;
  font-size: 1.1rem !important;
  line-height: 1 !important;
  font-weight: 600;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.fd-cal-pop .fd-cal-nav-btn:hover:not(:disabled) {
  background: #f8fafc !important;
  border-color: rgba(15, 23, 42, 0.2) !important;
  color: #0f172a !important;
}

.fd-cal-pop .fd-cal-weekdays,
.fd-cal-pop .fd-cal-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  column-gap: 5px;
  row-gap: 5px;
  padding-inline: 10px;
}
.fd-cal-pop .fd-cal-weekdays {
  padding-top: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  background: #f8fafc;
}

.fd-cal-pop .fd-cal-wd {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10.5px;
  font-weight: 700;
  color: #64748b;
  line-height: 1.2;
  min-height: 1.125rem;
  text-transform: none;
}

.fd-cal-pop .fd-cal-days {
  padding-top: 8px;
  padding-bottom: 10px;
}

.fd-cal-pop .fd-cal-slot {
  display: block;
  width: 100%;
  min-height: 0;
  aspect-ratio: 1;
}

.fd-cal-pop .fd-cal-day {
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100%;
  aspect-ratio: 1;
  min-height: 2rem;
  max-height: 2.375rem;
  border-radius: 6px !important;
  border: 1px solid rgba(226, 232, 240, 0.95) !important;
  font-size: 12px !important;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1 !important;
  font-family: inherit;
  cursor: pointer;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
}

.fd-cal-pop .fd-cal-day--enabled {
  background: #fff !important;
  color: #0f172a !important;
}
.fd-cal-pop .fd-cal-day--enabled:not(:disabled):hover {
  background: #f1f5f9 !important;
  border-color: #cbd5e1 !important;
}

.fd-cal-pop .fd-cal-day--disabled {
  background: #fafafa !important;
  color: #94a3b8 !important;
  opacity: 0.9;
  cursor: not-allowed !important;
  border-color: #f1f5f9 !important;
}

.fd-cal-pop .fd-cal-day--selected.fd-cal-day--enabled {
  background: var(--bs-primary, #0d6efd) !important;
  border-color: var(--bs-primary, #0d6efd) !important;
  color: #ffffff !important;
  font-weight: 700 !important;
}
.fd-cal-pop .fd-cal-day--selected.fd-cal-day--disabled {
  opacity: 0.5;
}

.fd-cal-pop .fd-cal-footer {
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  padding: 6px 10px 8px;
  text-align: center;
  background: #fafbfc;
}

.fd-cal-pop .fd-cal-footer .fd-cal-clear {
  font-size: 11.75px !important;
  font-weight: 600;
  line-height: 1.35;
  color: var(--bs-primary, #0d6efd);
  padding: 4px 10px !important;
  margin: 0;
  border: none !important;
  border-radius: 6px !important;
  background: transparent !important;
  text-decoration: none !important;
  box-shadow: none !important;
}
.fd-cal-pop .fd-cal-footer .fd-cal-clear:hover {
  background: rgba(13, 110, 253, 0.08) !important;
  color: var(--bs-primary, #0a58ca);
}
`;
    document.head.appendChild(el);
}

/** منتقي تقويم ميلادي بنفس الواجهة والسلوك الهجري (بدون منتقي المتصفح الأصلي). */
function fdGregorianCalBindWrap(wrap) {
    if (!wrap || wrap.dataset.fdGregCalBound === '1') return;
    const minS = wrap.getAttribute('data-fd-min') || '';
    const maxS = wrap.getAttribute('data-fd-max') || '';
    wrap._fdMinG = fdParseIsoMinMax(minS);
    wrap._fdMaxG = fdParseIsoMinMax(maxS);
    if (!wrap.style.position) wrap.style.position = 'relative';

    let panel = wrap.querySelector(':scope > .fd-cal-pop');
    if (!panel) {
        wrap.insertAdjacentHTML('beforeend', fdCalPopShellHtml('منتقي التاريخ الميلادي'));
        panel = wrap.querySelector(':scope > .fd-cal-pop');
    }
    if (!panel) return;

    const face = wrap.querySelector('.fd-greg-face');
    const btn = wrap.querySelector('.fd-greg-datepicker-btn');
    if (!face || !btn) return;

    if (String(face.value || '').trim()) fdGregorianNormalizeFaceAndStore(wrap, { clearOnInvalidRange: true });

    const sv = fdGregorianParseIsoStored(face.value);
    if (sv) {
        wrap.setAttribute('data-fd-gy', String(sv.y));
        wrap.setAttribute('data-fd-gm', String(sv.m));
    } else {
        const n = new Date();
        wrap.setAttribute('data-fd-gy', String(n.getUTCFullYear()));
        wrap.setAttribute('data-fd-gm', String(n.getUTCMonth() + 1));
    }

    wrap.dataset.fdGregCalBound = '1';

    panel.querySelector('.fd-cal-prev')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-cal-prev')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        let gy = parseInt(wrap.getAttribute('data-fd-gy'), 10), gm = parseInt(wrap.getAttribute('data-fd-gm'), 10);
        if (gm <= 1) { gm = 12; gy -= 1; } else gm -= 1;
        wrap.setAttribute('data-fd-gy', String(gy));
        wrap.setAttribute('data-fd-gm', String(gm));
        fdGregorianRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdCalPositionPanel(panel, wrap));
    });
    panel.querySelector('.fd-cal-next')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-cal-next')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        let gy = parseInt(wrap.getAttribute('data-fd-gy'), 10), gm = parseInt(wrap.getAttribute('data-fd-gm'), 10);
        if (gm >= 12) { gm = 1; gy += 1; } else gm += 1;
        wrap.setAttribute('data-fd-gy', String(gy));
        wrap.setAttribute('data-fd-gm', String(gm));
        fdGregorianRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdCalPositionPanel(panel, wrap));
    });
    panel.querySelector('.fd-cal-clear')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-cal-clear')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        face.value = '';
        if (fdCalOpenPanel === panel) {
            panel.style.display = 'none';
            panel._fdAttachedWrap = null;
            fdCalOpenPanel = null;
        }
    });

    function togglePop(e) {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = (fdCalOpenPanel === panel && panel.style.display !== 'none');
        if (fdCalOpenPanel && fdCalOpenPanel !== panel) {
            fdCalOpenPanel.style.display = 'none';
            try { fdCalOpenPanel._fdAttachedWrap = null; } catch (_) {}
            fdCalOpenPanel = null;
        }
        if (wasOpen) {
            panel.style.display = 'none';
            fdCalOpenPanel = null;
            panel._fdAttachedWrap = null;
            return;
        }
        if (btn.disabled || face.readOnly) return;
        fdGregorianNormalizeFaceAndStore(wrap);
        const p = fdGregorianParseIsoStored(face.value);
        if (p) {
            wrap.setAttribute('data-fd-gy', String(p.y));
            wrap.setAttribute('data-fd-gm', String(p.m));
        }
        fdCalOpenPanel = panel;
        panel._fdAttachedWrap = wrap;
        panel.style.display = 'block';
        fdGregorianRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdCalPositionPanel(panel, wrap));
    }
    btn.addEventListener('click', togglePop);
    face.addEventListener('click', togglePop);
    face.addEventListener('blur', () => { fdGregorianNormalizeFaceAndStore(wrap, { clearOnInvalidRange: true }); });
}

function fdGregorianDateBindInRoot(root) {
    (root || document).querySelectorAll('.fd-greg-date.fd-date-miladi').forEach(fdGregorianCalBindWrap);
}

/** التحقق من رفع ملفات المعاينة: العدد، الحجم، الامتداد. */
const FD_FILE_UPLOAD_MAX_ITEMS = 100;

/** ٠–٩ و ۰–۹ → 0–9 حتى لا يعود parseInt إلى NaN ويُفهم الحدّ كـ ملف واحد. */
function fdDigitsToLatinDigits(s) {
    if (s == null || s === '') return '';
    return String(s)
        .replace(/[\u0660-\u0669]/g, ch => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[\u06f0-\u06f9]/gi, ch => String(ch.charCodeAt(0) - 0x06f0));
}

/** يستخرج عدداً صحيحاً بين 1 و FD_FILE_UPLOAD_MAX_ITEMS أو null إن لم يوجد أو غير صالح. */
function fdParseMaxFilesRaw(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        const n = Math.floor(Math.abs(raw));
        if (n < 1) return null;
        return Math.min(n, FD_FILE_UPLOAD_MAX_ITEMS);
    }
    const latin = fdDigitsToLatinDigits(String(raw).trim());
    const n = parseInt(latin, 10);
    if (isNaN(n) || n < 1) return null;
    return Math.min(n, FD_FILE_UPLOAD_MAX_ITEMS);
}

/** أقصى عدد مسموح من الغلاف (data-fd-max-files). */
function fdWrapMaxFiles(wrap) {
    if (!wrap || !wrap.getAttribute) return 1;
    const attr = wrap.getAttribute('data-fd-max-files');
    const n = fdParseMaxFilesRaw(attr != null && attr !== '' ? attr : '1');
    return n != null ? n : 1;
}

/** أقصى عدد من خصائص التعريف (يدعم تسمية Pascal من الخادم). */
function fdResolvedMaxFilesFromProps(props) {
    if (!props || typeof props !== 'object') return 1;
    const raw = props.maxFiles ?? props.MaxFiles;
    const n = fdParseMaxFilesRaw(raw);
    return n != null ? n : 1;
}

/**
 * تتبّع وقت التشغيل (اختياري): أضِف ?traceFileUpload=1 أو sessionStorage FD_TRACE_FILE_UPLOAD=1 أو window.FD_TRACE_FILE_UPLOAD=true
 * يطبع maxFiles والخاصية multiple و مقطعاً من outerHTML لكل حقول الرفع ضمن الجذر.
 */
function fdShouldTraceFileUpload() {
    try {
        if (typeof window !== 'undefined' && window.FD_TRACE_FILE_UPLOAD === true) return true;
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('FD_TRACE_FILE_UPLOAD') === '1') return true;
        if (typeof location !== 'undefined' && /[?&]traceFileUpload=1(?:&|$)/.test(String(location.search || ''))) return true;
    } catch (_) {}
    return false;
}

/** @param {string} stage */
function fdFileUploadTraceStage(stage, root) {
    if (!fdShouldTraceFileUpload()) return;
    const r = root || document;
    const list = r.querySelectorAll ? r.querySelectorAll('.fd-file-upload-wrap input[type="file"]') : [];
    list.forEach((inp, idx) => {
        const wrap = inp && inp.closest ? inp.closest('.fd-file-upload-wrap') : null;
        let mf = null;
        try { mf = wrap ? fdWrapMaxFiles(wrap) : null; } catch (_) {}
        console.info('[FormsSystem FD file]', stage, { idx, maxFiles: mf, inputMultiple: !!(inp && inp.multiple), hasAttrMultiple: !!(inp && inp.hasAttribute && inp.hasAttribute('multiple')), outerHTML: inp ? String(inp.outerHTML || '').slice(0, 520) : '' });
    });
    if (!list.length) console.info('[FormsSystem FD file]', stage, '(no file inputs under .fd-file-upload-wrap)');
}

/** يجد غلاف رفع الملفات حتى مع هيكلة DOM بسيطة (حقل واحد تحت الغلاف). */
function fdFileUploadResolveWrapForInput(input) {
    if (!input) return null;
    let wrap = input.closest && input.closest('.fd-file-upload-wrap');
    if (!wrap && input.parentElement && input.parentElement.classList && input.parentElement.classList.contains('fd-file-upload-wrap')) wrap = input.parentElement;
    return wrap || null;
}

/** إعادة فرض الخاصية multiple وفق data-fd-max-files — بدون تكرار مستمع التغيير. */
function fdFileUploadReassertMultipleInRoot(root) {
    const r = root || document;
    r.querySelectorAll('.fd-file-upload-wrap').forEach(wrap => {
        const inp = wrap.querySelector('input[type="file"]');
        if (!inp) return;
        if (!inp.classList.contains('fd-file-input')) inp.classList.add('fd-file-input');
        fdFileInputApplyMultiple(inp);
    });
}

/** يفعِّل اختيار عدة ملفات في نفس الحوار وفق الحد المعروض في الغلاف. */
function fdFileInputApplyMultiple(input) {
    const wrap = fdFileUploadResolveWrapForInput(input);
    if (!input || !wrap) {
        if (fdShouldTraceFileUpload()) console.info('[FormsSystem FD file] fdFileInputApplyMultiple(skip: no wrap)', input ? input.outerHTML : null);
        return;
    }
    const mf = fdWrapMaxFiles(wrap);
    if (fdShouldTraceFileUpload()) {
        console.info('[FormsSystem FD file] fdFileInputApplyMultiple BEFORE', { maxFiles: mf, inputMultiple: input.multiple, outerHTML: String(input.outerHTML || '').slice(0, 520) });
    }
    if (mf > 1) {
        input.setAttribute('multiple', 'multiple');
        try { input.multiple = true; } catch (_) {}
    } else {
        input.removeAttribute('multiple');
        try { input.multiple = false; } catch (_) {}
    }
    if (fdShouldTraceFileUpload()) {
        console.info('[FormsSystem FD file] fdFileInputApplyMultiple AFTER', { maxFiles: mf, inputMultiple: input.multiple, outerHTML: String(input.outerHTML || '').slice(0, 520) });
    }
}

function fdFileUploadParseExtents(wrap) {
    const raw = wrap.getAttribute('data-fd-accept-exts') || '';
    if (!raw) return [];
    return raw.split('|').map(s => s.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
}

function fdFileExtension(name) {
    const m = String(name || '').match(/\.([^./\\]+)$/);
    return (m ? m[1] : '').toLowerCase();
}

/** فحص اختيار الملفات (بدون مسح الإدخال) — لواجهات الحفظ/التحقق. */
function fdFileUploadInspect(wrap, fileList) {
    const ok = { ok: true, msg: '' };
    if (!wrap || !fileList || fileList.length === 0) return ok;

    const maxFiles = fdWrapMaxFiles(wrap);

    const mnStr = wrap.getAttribute('data-fd-min-mb');
    const mxStr = wrap.getAttribute('data-fd-max-mb');
    let minMb = mnStr !== null && mnStr !== '' ? parseFloat(mnStr) : null;
    let maxMb = mxStr !== null && mxStr !== '' ? parseFloat(mxStr) : null;
    if (minMb !== null && (isNaN(minMb) || minMb < 0)) minMb = null;
    if (maxMb !== null && (isNaN(maxMb) || maxMb < 0)) maxMb = null;

    const allowed = fdFileUploadParseExtents(wrap);
    const n = fileList.length;
    if (n > maxFiles) {
        return { ok: false, msg: `عدد الملفات المسموح بإرفاقها لا يتجاوز "${maxFiles}"` };
    }

    const minBytes = minMb != null ? minMb * 1024 * 1024 : null;
    const maxBytes = maxMb != null ? maxMb * 1024 * 1024 : null;

    for (let i = 0; i < n; i++) {
        const f = fileList[i];
        const ext = fdFileExtension(f.name);
        if (allowed.length && !allowed.includes(ext)) {
            return { ok: false, msg: `الامتداد «.${ext}» غير مسموح لملف "${f.name}".` };
        }
        if (minBytes != null && f.size < minBytes) {
            return { ok: false, msg: `الملف "${f.name}" أصغر من الحد الأدنى (${minMb} ميغابايت).` };
        }
        if (maxBytes != null && f.size > maxBytes) {
            const sizeLbl = `${maxMb} ميغابايت`;
            return { ok: false, msg: `حجم الملفات المسموح بإرفاقها لا يتجاوز "${sizeLbl}"` };
        }
    }
    return ok;
}

function fdFileUploadSetErr(wrap, msg) {
    const errEl = wrap && wrap.querySelector ? wrap.querySelector('.fd-file-err') : null;
    if (!errEl) return;
    if (msg) {
        errEl.textContent = msg;
        errEl.style.display = '';
    } else {
        errEl.textContent = '';
        errEl.style.display = 'none';
    }
}

function fdIvRangeMsg(loDisp, hiDisp) {
    return `القيمة المدخلة يجب أن تتراوح بين "${loDisp}" و "${hiDisp}"`;
}

function fdIvParseOptionalInt(v) {
    if (v == null || v === '') return null;
    const n = parseInt(String(v).trim(), 10);
    return Number.isFinite(n) ? n : null;
}

function fdIvParseOptionalFloat(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).trim().replace(/,/g, '.'));
    return Number.isFinite(n) ? n : null;
}

function fdIvUsesInlineValidation(f) {
    const t = f.fieldType;
    return t === 'الاسم الكامل' || t === 'نص قصير' || t === 'رقم الهاتف' || t === 'البريد الإلكتروني'
        || t === 'نص طويل' || t === 'فقرة' || t === 'رقم' || t === 'دوار رقمي' || t === 'عملة';
}

function fdIvFindPrimaryControl(ft, slot) {
    if (!slot) return null;
    if (ft === 'نص طويل' || ft === 'فقرة') return slot.querySelector('textarea');
    if (ft === 'دوار رقمي') return slot.querySelector('input.fd-spin-input');
    if (ft === 'رقم' || ft === 'عملة') {
        const g = slot.querySelector('.input-group input[type="number"]');
        if (g) return g;
        return slot.querySelector('input[type="number"]');
    }
    if (ft === 'رقم الهاتف') {
        const ig = slot.querySelector('.input-group input.form-control');
        if (ig) return ig;
    }
    return slot.querySelector('input:not([type=hidden]):not([type=file]), select');
}

function fdIvValidateWrap(wrap) {
    if (!wrap || wrap.getAttribute('data-fd-iv') !== '1') return '';
    let props = {};
    try {
        const rawProps = wrap.getAttribute('data-fd-props') || '{}';
        props = JSON.parse(rawProps);
    } catch (_) { props = {}; }
    const ft = wrap.getAttribute('data-fd-ft') || '';
    const slot = wrap.querySelector('.fd-iv-slot');
    const el = fdIvFindPrimaryControl(ft, slot);
    if (!el || el.disabled || el.readOnly) return '';

    const textTypes = new Set(['الاسم الكامل','نص قصير','رقم الهاتف','البريد الإلكتروني','نص طويل','فقرة']);
    const numTypes = new Set(['رقم','دوار رقمي','عملة']);

    const loLbl = mn => (mn !== null ? String(mn) : '—');
    const hiLbl = mx => (mx !== null ? String(mx) : '—');

    if (textTypes.has(ft)) {
        const raw = String(el.value != null ? el.value : '');
        const len = raw.length;
        const mn = fdIvParseOptionalInt(props.minLength);
        let mx = fdIvParseOptionalInt(props.maxLength);
        if (mx === null && props.charLimit != null && props.charLimit !== '') mx = fdIvParseOptionalInt(props.charLimit);

        // ── البريد الإلكتروني: صيغة معتمَدة xxx@almadinah.gov.sa ──────────────
        if (ft === 'البريد الإلكتروني' && raw.trim() !== '') {
            const ok = /^[A-Za-z0-9._%+\-]+@almadinah\.gov\.sa$/i.test(raw.trim());
            if (!ok) return 'يجب أن يكون البريد الإلكتروني بصيغة xxx@almadinah.gov.sa';
        }

        // ── رقم الهاتف: تحقق من الصيغة + النمط + عدد الأرقام المسموح به ──────
        if (ft === 'رقم الهاتف' && raw.trim() !== '') {
            const fmt = String(props.phoneFormat || '+966 (9 أرقام)').trim();
            const ip = String(props.inputPattern || 'أرقام فقط').trim();
            const v = raw.trim();
            if (fmt === '+966 (9 أرقام)') {
                if (!/^[0-9]{9}$/.test(v)) return 'رقم الهاتف بعد +966 يجب أن يكون 9 أرقام بالضبط';
            } else if (fmt === '05xxxxxxxx (10 أرقام)') {
                if (!/^05[0-9]{8}$/.test(v)) return 'رقم الهاتف يجب أن يبدأ بـ 05 ويتكون من 10 أرقام بالضبط';
            } else if (fmt === 'دولي') {
                if (!/^[0-9]{7,15}$/.test(v)) return 'رقم الهاتف الدولي يجب أن يحتوي على 7 إلى 15 رقماً';
            } else if (fmt === 'تلفون') {
                if (ip === 'أرقام فقط' && !/^[0-9]+$/.test(v)) return 'يجب أن يحتوي الرقم على أرقام فقط';
            }
            if (ip === 'أرقام فقط' && !/^[0-9]+$/.test(v)) return 'يُسمح بإدخال أرقام فقط';
            if (ip === 'حروف فقط' && !/^[A-Za-z\u0600-\u06FF\s\.\-]+$/.test(v)) return 'يُسمح بإدخال حروف فقط';
            if (ip === 'حروف وأرقام' && !/^[A-Za-z0-9\u0600-\u06FF\s\.\-]+$/.test(v)) return 'يُسمح بإدخال حروف وأرقام فقط';
        }

        if (mn === null && mx === null) return '';
        if (mn !== null && len < mn) return fdIvRangeMsg(loLbl(mn), hiLbl(mx));
        if (mx !== null && len > mx) return fdIvRangeMsg(loLbl(mn), hiLbl(mx));
        return '';
    }

    if (numTypes.has(ft)) {
        const s = String(el.value != null ? el.value : '').trim();
        if (!s) return '';
        const num = parseFloat(s.replace(/,/g, '').replace(/\s+/g, ''));
        if (!Number.isFinite(num)) return '';
        const mn = fdIvParseOptionalFloat(props.minValue);
        const mx = fdIvParseOptionalFloat(props.maxValue);
        if (mn === null && mx === null) return '';
        if (mn !== null && num < mn) return fdIvRangeMsg(loLbl(mn), hiLbl(mx));
        if (mx !== null && num > mx) return fdIvRangeMsg(loLbl(mn), hiLbl(mx));
        return '';
    }
    return '';
}

function fdIvApplyWrapErr(wrap, msg) {
    const msgEl = wrap && wrap.querySelector ? wrap.querySelector('.fd-iv-msg') : null;
    if (!msgEl) return;
    if (msg) {
        msgEl.textContent = msg;
        msgEl.style.display = '';
    } else {
        msgEl.textContent = '';
        msgEl.style.display = 'none';
    }
}

/** تحقّق معاينة النموذج (خطوة 4): يُحدِّث رسائل الملف والحقول ويعيد أوّل رسالة خطأ. */
function fdValidateInteractivePreview(root) {
    const scope = root || document;
    let first = '';

    scope.querySelectorAll('input.fd-spin-input').forEach(el => {
        if (!el.readOnly && !el.disabled) fdSpinClamp(el);
    });

    scope.querySelectorAll('.fd-file-upload-wrap').forEach(w => fdFileUploadSetErr(w, ''));
    scope.querySelectorAll('input.fd-file-input[type="file"]').forEach(inp => {
        const w = inp.closest('.fd-file-upload-wrap');
        if (!w || inp.disabled) return;
        const inv = fdFileUploadInspect(w, inp.files);
        if (!inv.ok) {
            fdFileUploadSetErr(w, inv.msg);
            if (!first) first = inv.msg;
        }
    });

    scope.querySelectorAll('.fd-iv-wrap[data-fd-iv="1"]').forEach(wrap => fdIvApplyWrapErr(wrap, ''));
    scope.querySelectorAll('.fd-iv-wrap[data-fd-iv="1"]').forEach(wrap => {
        const v = fdIvValidateWrap(wrap);
        if (v) {
            fdIvApplyWrapErr(wrap, v);
            if (!first) first = v;
        }
    });
    return first;
}

function fdIvBindLive(root) {
    const scope = root || document;
    if (scope.getAttribute('data-fd-iv-live') === '1') return;
    scope.setAttribute('data-fd-iv-live', '1');

    function onLive(ev) {
        const target = ev.target;
        if (target && target.matches && target.matches('input.fd-spin-input')
            && scope.contains(target) && !target.readOnly && !target.disabled
            && (ev.type === 'input' || ev.type === 'change' || ev.type === 'blur')) {
            fdSpinClamp(target);
        }
        const wrapIv = target && target.closest ? target.closest('.fd-iv-wrap[data-fd-iv="1"]') : null;
        if (wrapIv && scope.contains(wrapIv)) {
            const v = fdIvValidateWrap(wrapIv);
            fdIvApplyWrapErr(wrapIv, v);
            return;
        }
        const fileIn = target && target.matches && target.matches('input.fd-file-input[type="file"]') ? target : null;
        if (fileIn && scope.contains(fileIn)) {
            const w = fileIn.closest('.fd-file-upload-wrap');
            if (!w || fileIn.disabled) return;
            const inv = fdFileUploadInspect(w, fileIn.files);
            fdFileUploadSetErr(w, inv.ok ? '' : inv.msg);
        }
    }

    scope.addEventListener('input', onLive, true);
    scope.addEventListener('change', onLive, true);
    scope.addEventListener('blur', onLive, true);
    scope.addEventListener('click', ev => {
        const btn = ev.target && ev.target.closest ? ev.target.closest('.input-group button') : null;
        if (!btn || !scope.contains(btn)) return;
        const wrapIv = btn.closest('.fd-iv-wrap[data-fd-iv="1"]');
        if (!wrapIv) return;
        queueMicrotask(() => {
            const v = fdIvValidateWrap(wrapIv);
            fdIvApplyWrapErr(wrapIv, v);
        });
    }, true);
}

function fdFileUploadValidate(input) {
    const wrap = input && input.closest && input.closest('.fd-file-upload-wrap');
    if (!wrap || !input.files) return true;
    const errEl = wrap.querySelector('.fd-file-err');
    const hintEl = wrap.querySelector('.fd-file-hint');
    const listEl = wrap.querySelector('.fd-file-list');
    function clearErr() {
        if (errEl) {
            errEl.textContent = '';
            errEl.style.display = 'none';
        }
    }
    function showErr(msg) {
        if (errEl) {
            errEl.textContent = msg;
            errEl.style.display = '';
        }
        input.value = '';
        if (listEl) {
            listEl.innerHTML = '';
            listEl.hidden = true;
        }
        return false;
    }
    clearErr();

    const n = input.files.length;
    if (n === 0) {
        if (listEl) {
            listEl.innerHTML = '';
            listEl.hidden = true;
        }
        return true;
    }

    const inv = fdFileUploadInspect(wrap, input.files);
    if (!inv.ok) return showErr(inv.msg);

    let itemsHtml = '';
    for (let i = 0; i < input.files.length; i++) {
        const f = input.files[i];
        const kb = Math.round((f.size / 1024) * 100) / 100;
        itemsHtml += `<li class="text-muted">${fdEscAttr(f.name)} <span dir="ltr" class="badge bg-light text-secondary border">(${kb}&nbsp;KB)</span></li>`;
    }
    if (listEl && n > 0) {
        listEl.innerHTML = itemsHtml;
        listEl.hidden = false;
    }
    if (hintEl && hintEl.dataset.fdPlaceholder) {
        hintEl.textContent = hintEl.dataset.fdPlaceholder;
        hintEl.style.display = '';
    }
    return true;
}

function fdFileUploadBindWrap(wrap) {
    if (!wrap) return;
    const inp = wrap.querySelector('input.fd-file-input[type="file"]') || wrap.querySelector('input[type="file"]');
    if (!inp) return;
    if (!inp.classList.contains('fd-file-input')) inp.classList.add('fd-file-input');

    fdFileInputApplyMultiple(inp);

    if (wrap.dataset.fdFileBound === '1') return;
    wrap.dataset.fdFileBound = '1';
    if (fdShouldTraceFileUpload()) console.info('[FormsSystem FD file] fdFileUploadBindWrap (listeners attached)', { maxFiles: fdWrapMaxFiles(wrap), outerHTML: String(inp.outerHTML || '').slice(0, 520) });
    const hint = wrap.querySelector('.fd-file-hint');
    if (hint && hint.dataset.fdPlaceholder) {
        hint.textContent = hint.dataset.fdPlaceholder;
        hint.style.display = '';
    }
    inp.addEventListener('change', () => fdFileUploadValidate(inp));
}

function fdFileUploadBindInRoot(root) {
    const r = root || document;
    fdFileUploadTraceStage('[fdFileUploadBindInRoot] قبل الربط', r);
    r.querySelectorAll('.fd-file-upload-wrap').forEach(fdFileUploadBindWrap);
    fdFileUploadReassertMultipleInRoot(r);
    fdFileUploadTraceStage('[fdFileUploadBindInRoot] بعد مرّة التزامن', r);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => {
            fdFileUploadReassertMultipleInRoot(r);
            fdFileUploadTraceStage('[fdFileUploadBindInRoot] بعد requestAnimationFrame', r);
        });
    }
}

if (typeof window !== 'undefined') {
    window.fdFileUploadValidate = fdFileUploadValidate;
    window.fdValidateInteractivePreview = fdValidateInteractivePreview;
    window.fdResolvedMaxFilesFromProps = fdResolvedMaxFilesFromProps;
    window.fdShouldTraceFileUpload = fdShouldTraceFileUpload;
    window.fdFileUploadTraceStage = fdFileUploadTraceStage;
    window.fdFileUploadReassertMultipleInRoot = fdFileUploadReassertMultipleInRoot;
}

// ─── FIELD INPUT BUILDER (for step-3 preview) ─────────────────────────────────
function fdBuildFieldInput(f, opt) {
    let props = {};
    try { props = JSON.parse(f.propertiesJson||'{}'); } catch(e) {}
    const tipMerged = String((f.tooltipText != null && f.tooltipText !== '') ? f.tooltipText : (props.tooltipText || '')).trim();
    const ph = ((f.placeholder||'') || tipMerged).replace(/"/g,'&quot;');
    if (opt && opt.forceReadOnly) props.readOnly = true;
    const defVal  = props.defaultValue != null ? String(props.defaultValue).replace(/"/g,'&quot;') : '';
    const roAttr  = props.readOnly ? ' readonly' : '';
    const roSel   = props.readOnly ? ' disabled' : '';
    const roStyle = props.readOnly ? 'background:#f3f4f6;cursor:not-allowed;' : '';
    const reqAttr = f.isRequired ? ' required' : '';
    const maxL    = (props.maxLength||props.charLimit) ? ` maxlength="${props.maxLength||props.charLimit}"` : '';
    const minL    = props.minLength ? ` minlength="${props.minLength}"` : '';
    const wStyle  = props.widthPx ? `width:${props.widthPx}px;` : '';
    const ttAttr  = tipMerged ? ` title="${fdEscAttr(tipMerged)}"` : '';
    function mk(extra) { const s=(wStyle+roStyle+(extra||'')).trim(); return s?` style="${s}"`:''; }
    let inp = '';

    if (f.fieldType==='الاسم الكامل'||f.fieldType==='نص قصير') {
        inp = `<input type="text" class="form-control" placeholder="${ph}" value="${defVal}"${reqAttr}${maxL}${minL}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='رقم الهاتف') {
        const fmt = props.phoneFormat || '+966 (9 أرقام)';
        const ie = fdPhoneInputPatternExtras(props.inputPattern);
        const dPf = ie.filter ? ` data-fd-phone-filter="${ie.filter}"` : '';
        const wrapStyle = wStyle ? ` style="${wStyle}"` : '';
        const maxLA = maxL || '';
        const ltrSt = mk('direction:ltr;');
        if (fmt === '+966 (9 أرقام)') {
            if (ie.inpType === 'tel') {
                inp = `<div class="input-group"${ttAttr}${wrapStyle}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+966</span><input type="tel" class="form-control" placeholder="5XXXXXXXX" maxlength="9" pattern="[0-9]{9}"${ie.titleAttr} value="${defVal}"${reqAttr}${roAttr}${ie.inputmode}${dPf}${ltrSt}></div>`;
            } else {
                inp = `<div class="input-group"${ttAttr}${wrapStyle}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+966</span><input type="text" class="form-control"${ie.pt}${ie.titleAttr} placeholder="${ph}" value="${defVal}"${reqAttr}${maxLA}${roAttr}${dPf}${ltrSt}></div>`;
            }
        } else if (fmt === '05xxxxxxxx (10 أرقام)') {
            if (ie.inpType === 'tel') {
                inp = `<input type="tel" class="form-control" placeholder="05XXXXXXXX" maxlength="10" pattern="05[0-9]{8}"${ie.titleAttr} value="${defVal}"${reqAttr}${roAttr}${ttAttr}${ie.inputmode}${dPf}${ltrSt}>`;
            } else {
                inp = `<input type="text" class="form-control"${ie.pt}${ie.titleAttr} placeholder="05XXXXXXXX" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ttAttr}${dPf}${ltrSt}>`;
            }
        } else if (fmt === 'تلفون') {
            inp = `<input type="${ie.inpType}" class="form-control" placeholder="${ph || 'XXXXXXXX'}" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ttAttr}${ie.pt}${ie.titleAttr}${ie.inputmode}${dPf}${ltrSt}>`;
        } else {
            inp = `<div class="input-group"${ttAttr}${mk('direction:ltr;')}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+</span><input type="${ie.inpType}" class="form-control" placeholder="${ph || 'XXX XXXXXXXXX'}" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ie.pt}${ie.titleAttr}${ie.inputmode}${dPf}></div>`;
        }
    } else if (f.fieldType==='البريد الإلكتروني') {
        // الصيغة المعتمَدة دائماً: xxx@almadinah.gov.sa — يُفرض على مستوى pattern وعلى مستوى fdIvValidateWrap.
        const pat = ` pattern="[A-Za-z0-9._%+\\-]+@almadinah\\.gov\\.sa" title="${fdEscAttr('يجب أن يكون البريد الإلكتروني بصيغة xxx@almadinah.gov.sa')}"`;
        const phEmail = ph || 'name@almadinah.gov.sa';
        inp = `<input type="email" class="form-control" placeholder="${phEmail}" value="${defVal}"${pat}${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='نص طويل'||f.fieldType==='فقرة') {
        const hPx = props.heightPx ? `height:${props.heightPx}px;` : '';
        inp = `<textarea class="form-control" rows="3" placeholder="${ph}"${reqAttr}${maxL}${minL}${roAttr}${ttAttr}${mk(hPx)}>${(props.defaultValue||'').replace(/</g,'&lt;')}</textarea>`;
    } else if (f.fieldType==='رقم') {
        const mn = props.minValue!=null&&props.minValue!==''?` min="${props.minValue}"`:'';
        const mx = props.maxValue!=null&&props.maxValue!==''?` max="${props.maxValue}"`:'';
        let dec = (props.decimals != null && props.decimals !== '') ? parseInt(props.decimals, 10) : 0;
        if (isNaN(dec) || dec < 0) dec = 0;
        const stepVal = dec > 0 ? (1 / Math.pow(10, dec)) : 1;
        inp = `<input type="number" class="form-control" placeholder="${ph}" value="${defVal}" step="${stepVal}"${mn}${mx}${reqAttr}${roAttr}${ttAttr}${mk('text-align:left;direction:ltr;')}>`;
    } else if (f.fieldType==='دوار رقمي') {
        const mn = props.minValue!=null&&props.minValue!==''?` min="${props.minValue}"`:'';
        const mx = props.maxValue!=null&&props.maxValue!==''?` max="${props.maxValue}"`:'';
        const st = props.stepValue!=null&&props.stepValue!==''?` step="${props.stepValue}"`:(props.noDecimals?' step="1"':'');
        const wrapStyle = wStyle ? ` style="${wStyle}"` : '';
        let spinNum = NaN;
        if (props.defaultValue != null && props.defaultValue !== '') spinNum = parseFloat(String(props.defaultValue).trim());
        if (isNaN(spinNum)) {
            if (props.minValue != null && props.minValue !== '') spinNum = parseFloat(String(props.minValue));
            else spinNum = 0;
        }
        const loSpin = (props.minValue != null && props.minValue !== '') ? parseFloat(String(props.minValue)) : null;
        const hiSpin = (props.maxValue != null && props.maxValue !== '') ? parseFloat(String(props.maxValue)) : null;
        if (loSpin != null && !isNaN(loSpin) && spinNum < loSpin) spinNum = loSpin;
        if (hiSpin != null && !isNaN(hiSpin) && spinNum > hiSpin) spinNum = hiSpin;
        const spinVal = String(spinNum);
        const spinClampEv = props.readOnly ? '' : ' oninput="fdSpinClamp(this)" onblur="fdSpinClamp(this)"';
        inp = `<div class="input-group fd-spinner-group"${ttAttr}${wrapStyle}><button type="button" class="btn btn-outline-secondary" onclick="fdSpinDec(this)" style="padding:4px 10px;">−</button><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="form-control text-center fd-spin-input" value="${spinVal}"${mn}${mx}${st}${reqAttr}${roAttr} style="text-align:center;direction:ltr"${spinClampEv}><button type="button" class="btn btn-outline-secondary" onclick="fdSpinInc(this)" style="padding:4px 10px;">+</button></div>`;
    } else if (f.fieldType === 'قائمة منسدلة') {
        if (props.dropdownListId) {
            inp = fdBuildBoundDropdownHtml(f, props, reqAttr, roSel, ttAttr, mk, ph);
        } else {
            let opts = props.options ? String(props.options).split(/[\r\n]+/).map(s => s.trim()).filter(Boolean) : [];
            const def = (props.defaultOption || '').trim();
            inp = `<select class="form-select"${reqAttr}${roSel}${ttAttr}${mk()}><option value="">${(props.emptyText || ph || 'اختر...').replace(/</g, '&lt;')}</option>`;
            opts.forEach(o => { inp += `<option value="${fdEscAttr(o)}"${o === def ? ' selected' : ''}>${o.replace(/</g, '&lt;')}</option>`; });
            inp += '</select>';
        }
    } else if (f.fieldType === 'قائمة اختيار الواحد') {
        let opts = props.options ? String(props.options).split(/[\r\n]+/).map(s => s.trim()).filter(Boolean) : [];
        const marks = String(props.choiceOtherMarks || '').split(/[\r\n]+/);
        const def = (props.defaultOption || '').trim();
        const gname = `fd_sc_${String(f.id)}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`;
        const fsdis = props.readOnly ? ' disabled' : '';
        const roOt = props.readOnly ? ' disabled' : '';
        const otherPh = fdEscAttr('اكتب خياراً آخراً');
        const reqGrp = f.isRequired ? ' data-fd-required="1"' : '';
        const isHoriz = String(props.optionsOrientation || '').trim() === 'أفقي';
        const groupCls = isHoriz ? 'fd-oc-group fd-oc-horiz d-flex flex-wrap gap-3' : 'fd-oc-group d-flex flex-column gap-1';
        if (!opts.length) {
            inp = `<span class="text-muted"${ttAttr}>—</span>`;
        } else {
            let body = '';
            opts.forEach((o, i) => {
                const isOther = !!(marks[i] === '1' || /^true$/i.test((marks[i] || '').trim()));
                const rid = gname + '_' + i;
                const sel = (def && def === o) ? ' checked' : '';
                const reqOne = (f.isRequired && i === 0) ? ' required' : '';
                const othBlk = isOther
                    ? `<div class="fd-oc-other-wrap mt-1 ms-3" style="display:none;"><input type="text" class="form-control form-control-sm fd-oc-other-input" id="${rid}_oth" name="${gname}__other__${i}" data-fd-option-index="${i}" placeholder="${otherPh}"${roOt}></div>`
                    : '';
                body += `<div class="fd-oc-item"><div class="form-check"><input class="form-check-input" type="radio" name="${gname}" id="${rid}" value="${fdEscAttr(o)}"${sel}${fsdis}${reqOne} data-fd-other="${isOther ? '1' : '0'}" onchange="fdOcChoiceChange(this)"><label class="form-check-label" for="${rid}">${o.replace(/</g, '&lt;')}</label></div>${othBlk}</div>`;
            });
            inp = `<div class="${groupCls}" data-fd-field-id="${String(f.id ?? '')}" data-fd-oc-mode="single"${reqGrp}${ttAttr}${mk()}>${body}</div>`;
        }
    } else if (f.fieldType==='قائمة اختيار متعدد') {
        const opts = props.options ? String(props.options).split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean) : [];
        const marks = String(props.choiceOtherMarks || '').split(/[\r\n]+/);
        const defSet = {}; String(props.defaultOption||'').split(/,\s*/).forEach(d=>{if(d.trim())defSet[d.trim()]=true;});
        const fsdis = props.readOnly ? ' disabled' : '';
        const roOt = props.readOnly ? ' disabled' : '';
        const otherPh = fdEscAttr('اكتب خياراً آخراً');
        const gname = `fd_mc_${String(f.id)}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`;
        const reqGrp = f.isRequired ? ' data-fd-required="1"' : '';
        const isHorizM = String(props.optionsOrientation || '').trim() === 'أفقي';
        const groupClsM = isHorizM ? 'fd-oc-group fd-oc-horiz d-flex flex-wrap gap-3' : 'fd-oc-group d-flex flex-column gap-1';
        if (!opts.length) {
            inp = `<span class="text-muted"${ttAttr}>—</span>`;
        } else {
            let body = '';
            opts.forEach((o, i) => {
                const isOther = !!(marks[i] === '1' || /^true$/i.test((marks[i] || '').trim()));
                const cid = gname + '_' + i;
                const checked = defSet[o] ? ' checked' : '';
                const othBlk = isOther
                    ? `<div class="fd-oc-other-wrap mt-1 ms-3" style="display:none;"><input type="text" class="form-control form-control-sm fd-oc-other-input" id="${cid}_oth" name="${gname}__other__${i}" data-fd-option-index="${i}" placeholder="${otherPh}"${roOt}></div>`
                    : '';
                body += `<div class="fd-oc-item"><div class="form-check mb-0"><input class="form-check-input" type="checkbox" name="${gname}[]" id="${cid}" value="${fdEscAttr(o)}" data-fd-other="${isOther ? '1' : '0'}"${checked}${fsdis} onchange="fdOcChoiceChange(this)"><label class="form-check-label" for="${cid}">${o.replace(/</g,'&lt;')}</label></div>${othBlk}</div>`;
            });
            inp = `<div class="${groupClsM}" data-fd-field-id="${String(f.id ?? '')}"${ttAttr}${mk()} data-fd-oc-mode="multi"${reqGrp}>${body}</div>`;
        }
    } else if (f.fieldType==='تاريخ') {
        const cal = String(props.calendarType || 'ميلادي').trim();
        const phDateA11y = fdEscAttr('اختر التاريخ');
        const ttlOpenCal = fdEscAttr('فتح التقويم');
        const ttlHijNA = fdEscAttr('التقويم التفاعلي غير مدعوم — أدخل التاريخ الهجري يدويًا');
        const grpCls = 'input-group fd-date-input-group fd-date-cal-left';
        const btnCls = 'btn btn-outline-secondary fd-date-cal-btn';
        if (cal === 'هجري' && fdHijriIntlSupported()) {
            const uid = `fd_hij_${String(f.id ?? 'x')}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`.replace(/[^\w\-]/g, '');
            const minAttr = props.startDate ? ` data-fd-min="${fdEscAttr(String(props.startDate))}"` : '';
            const maxAttr = props.endDate ? ` data-fd-max="${fdEscAttr(String(props.endDate))}"` : '';
            const rawDv = props.defaultValue != null ? String(props.defaultValue).trim() : '';
            let canon = '';
            if (rawDv) {
                const pj = fdCoerceFlexibleInputToHijriParts(rawDv.replace(/-/g, '/'));
                if (pj) canon = fdFormatHijriStored(pj.hy, pj.hm, pj.hd);
            }
            const faceEsc = canon ? fdEscAttr(canon) : '';
            const disBtn = props.readOnly ? ' disabled' : '';
            const faceRo = props.readOnly ? ' readonly' : '';
            const hidReq = f.isRequired ? ' required' : '';
            inp = `<div class="fd-date-field-wrap fd-date-hijri fd-hijri-date position-relative"${minAttr}${maxAttr}${ttAttr}${mk('direction:ltr;')}><div class="${grpCls}"><button type="button" class="${btnCls} fd-hijri-btn"${disBtn} title="${ttlOpenCal}" aria-label="${ttlOpenCal}"><i class="bi bi-calendar3" aria-hidden="true"></i></button><input type="text" id="${fdEscAttr(uid)}_face" class="form-control fd-date-control fd-hijri-face" autocomplete="off" placeholder="${ph}" aria-label="${phDateA11y}" title="${phDateA11y}" dir="ltr" value="${faceEsc}"${faceRo}></div><input type="hidden" class="fd-hijri-store" id="${fdEscAttr(uid)}_hid" value="${faceEsc}"${hidReq}/></div>`;
        } else if (cal === 'هجري') {
            const hijPh = fdEscAttr(ph || '1447/06/15 — مثال');
            inp = `<div class="fd-date-field-wrap fd-date-hijri fd-date-hijri-fallback position-relative"${ttAttr}${mk('direction:ltr;')}><div class="${grpCls}"><button type="button" class="${btnCls}" disabled tabindex="-1" title="${ttlHijNA}" aria-label="${ttlHijNA}"><i class="bi bi-calendar3" aria-hidden="true"></i></button><input type="text" class="form-control fd-date-control" dir="ltr" placeholder="${hijPh}" aria-label="${phDateA11y}" title="${phDateA11y}" value="${defVal}"${reqAttr}${roAttr}></div></div>`;
        } else {
            const uidG = `fd_gr_${String(f.id ?? 'x')}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`.replace(/[^\w\-]/g, '');
            const minAttrG = props.startDate ? ` data-fd-min="${fdEscAttr(String(props.startDate))}"` : '';
            const maxAttrG = props.endDate ? ` data-fd-max="${fdEscAttr(String(props.endDate))}"` : '';
            const disBtnG = props.readOnly ? ' disabled' : '';
            let gv = '';
            if (props.defaultValue != null && String(props.defaultValue).trim() !== '') {
                const iso = fdGregorianParseIsoStored(String(props.defaultValue).trim());
                if (iso) gv = `${iso.y}-${String(iso.m).padStart(2, '0')}-${String(iso.d).padStart(2, '0')}`;
            }
            const gvEsc = gv ? fdEscAttr(gv) : '';
            const patTip = fdEscAttr('التنسيق: yyyy-mm-dd');
            inp = `<div class="fd-date-field-wrap fd-date-miladi fd-greg-date position-relative"${minAttrG}${maxAttrG}${ttAttr}${mk('direction:ltr;')}><div class="${grpCls}"><button type="button" class="${btnCls} fd-greg-datepicker-btn"${disBtnG} title="${ttlOpenCal}" aria-label="${ttlOpenCal}"><i class="bi bi-calendar3" aria-hidden="true"></i></button><input type="text" id="${fdEscAttr(uidG)}" autocomplete="off" inputmode="numeric" spellcheck="false" pattern="^[0-9]{4}-[0-9]{2}-[0-9]{2}$" placeholder="yyyy-mm-dd" class="form-control fd-date-control fd-greg-face fd-greg-datepicker" dir="ltr" value="${gvEsc}" aria-label="${phDateA11y}" title="${patTip}"${reqAttr}${roAttr}></div></div>`;
        }
    } else if (f.fieldType==='وقت') {
        inp = `<input type="time" class="form-control" value="${defVal}"${reqAttr}${roAttr}${ttAttr}${mk()}>`;
    } else if (f.fieldType==='رفع ملف') {
        const acc = (props.fileTypes||'').split(/[,\s;|]+/).filter(Boolean).map(s=>'.'+(s.trim().replace(/^\./,''))).join(',');
        const extsFlat = (props.fileTypes||'').split(/[,\s;|]+/).map(s => s.trim().replace(/^\./,'').toLowerCase()).filter(Boolean);
        const extsAttr = extsFlat.length ? ` data-fd-accept-exts="${fdEscAttr(extsFlat.join('|'))}"` : '';

        let maxFiles = fdResolvedMaxFilesFromProps(props);
        const multi = maxFiles > 1 ? ' multiple="multiple"' : '';

        let minMb = props.minFileSize != null && String(props.minFileSize).trim() !== '' ? parseFloat(props.minFileSize) : null;
        let maxMb = props.maxFileSize != null && String(props.maxFileSize).trim() !== '' ? parseFloat(props.maxFileSize) : null;
        if (minMb !== null && (isNaN(minMb) || minMb < 0)) minMb = null;
        if (maxMb !== null && (isNaN(maxMb) || maxMb < 0)) maxMb = null;
        const dMin = minMb != null ? ` data-fd-min-mb="${fdEscAttr(String(minMb))}"` : '';
        const dMax = maxMb != null ? ` data-fd-max-mb="${fdEscAttr(String(maxMb))}"` : '';

        const uidFu = `fd_fu_${String(f.id ?? 'x')}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`.replace(/[^\w\-]/g, '');
        const disFile = props.readOnly ? ' disabled' : '';

        const hintPieces = [];
        hintPieces.push(maxFiles > 1 ? `يمكن رفع حتى ${maxFiles} ملفات` : 'ملف واحد مسموح');
        if (minMb != null) hintPieces.push(`الحد الأدنى للحجم: ${minMb} ميغابايت`);
        if (maxMb != null) hintPieces.push(`الحد الأقصى للحجم: ${maxMb} ميغابايت`);
        const hintData = fdEscAttr(hintPieces.join(' — '));

        const accAttr = acc ? ` accept="${fdEscAttr(acc)}"` : '';
        inp = `<div class="fd-file-upload-wrap"${extsAttr}${dMin}${dMax} data-fd-max-files="${maxFiles}"${ttAttr}${mk()}><input type="file" class="form-control fd-file-input" id="${fdEscAttr(uidFu)}"${accAttr}${multi}${reqAttr}${disFile}/><p class="fd-file-hint small text-muted mt-1 mb-0" style="display:none;" data-fd-placeholder="${hintData}"></p><p class="fd-file-err small text-danger mt-1 mb-0" style="display:none;"></p><ul class="fd-file-list list-unstyled small mt-2 mb-0 px-1" hidden></ul></div>`;
    } else if (f.fieldType==='التقييم بالنجوم') {
        const range = parseInt(props.ratingRange)||5;
        const icon  = props.ratingIcon||'نجمة';
        const char  = icon==='قلب'?'♥':icon==='إبهام'?'👍':'★';
        const sdef  = parseInt(defVal)||0;
        inp = `<div class="d-flex gap-1"${ttAttr}>`;
        for (let i=1;i<=range;i++) inp += `<span onclick="fdStarClick(this,${i})" style="font-size:22px;cursor:pointer;color:${i<=sdef?'#f59e0b':'#d1d5db'}" data-i="${i}">${char}</span>`;
        inp += `<span class="ms-2 fw-bold" style="font-size:13px;">${sdef}/${range}</span></div>`;
    } else if (f.fieldType==='التقييم بالأرقام') {
        const lo = parseInt(props.minRating, 10);
        const hi = parseInt(props.maxRating, 10);
        const arMin = (props.minRating != null && props.minRating !== '' && !isNaN(lo)) ? lo : 0;
        const arMax = (props.maxRating != null && props.maxRating !== '' && !isNaN(hi)) ? hi : 10;
        let cur = defVal !== '' ? parseInt(defVal, 10) : arMin;
        if (isNaN(cur)) cur = arMin;
        if (cur < arMin) cur = arMin;
        if (cur > arMax) cur = arMax;
        const lowLbl = props.lowRatingText ? `<span class="text-muted" style="font-size:11px;">${fdEscAttr(String(props.lowRatingText))}</span>` : '';
        const highLbl = props.highRatingText ? `<span class="text-muted" style="font-size:11px;">${fdEscAttr(String(props.highRatingText))}</span>` : '';
        let legendRow = '';
        if (lowLbl || highLbl) {
            legendRow = `<div class="d-flex justify-content-between align-items-start gap-2 mt-1 px-1">${lowLbl}${highLbl}</div>`;
        }
        const disR = props.readOnly ? ' disabled' : '';
        const onInp = props.readOnly ? '' : ' oninput="this.nextElementSibling.textContent=this.value"';
        inp = `<div${ttAttr}><input type="range" class="form-range" min="${arMin}" max="${arMax}" value="${cur}"${disR}${onInp}${reqAttr}><div class="text-center fw-bold" style="font-size:14px;">${cur}</div>${legendRow}</div>`;
    } else if (f.fieldType==='جدول بيانات') {
        let cols = [];
        let numRows = 1;
        if (props.readyTableId && fdReadyTableGridCache[props.readyTableId]) {
            const g = fdReadyTableGridCache[props.readyTableId];
            cols = (g.columns || []).slice();
            const maxR = (g.rowCountMode === 'مقيد' && g.maxRows) ? parseInt(g.maxRows, 10) : 3;
            numRows = Math.min(Math.max(maxR > 0 ? maxR : 3, 1), 50);
        } else {
            cols = fdParseLines(props.options);
        }
        const c = cols.length ? cols : ['عمود'];
        const ro = props.readOnly ? ' readonly' : '';
        let t = `<div class="table-responsive"${ttAttr}><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><thead><tr>`;
        c.forEach(h => { t += `<th>${esc(h)}</th>`; });
        t += '</tr></thead><tbody>';
        for (let ri = 0; ri < numRows; ri++) {
            t += '<tr>';
            c.forEach(() => { t += `<td><input type="text" class="form-control form-control-sm"${ro}${reqAttr}></td>`; });
            t += '</tr>';
        }
        t += '</tbody></table></div>';
        inp = t;
    } else if (f.fieldType==='شبكة خيارات متعددة') {
        const cols = fdParseLines(props.options);
        const rows = fdParseLines(props.rowLabels);
        const c = cols.length ? cols : ['خيار'];
        const r = rows.length ? rows : ['صف'];
        const gridName = 'fd_gr_' + (f.id || 'n') + '_' + (f.fieldName||'').replace(/\s/g,'_');
        const dis = props.readOnly ? ' disabled' : '';
        const hintBar = `<div style="font-size:11px;color:var(--info-700);background:var(--info-50);border:1px solid var(--info-100);border-radius:6px;padding:4px 10px;margin-bottom:6px;display:inline-flex;align-items:center;gap:6px;"><i class="bi bi-record-circle"></i> اختيار واحد لكل صف</div>`;
        let t = `<div${ttAttr}>${hintBar}<div class="table-responsive"><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><thead><tr><th></th>`;
        c.forEach(h => { t += `<th class="text-center">${esc(h)}</th>`; });
        t += '</tr></thead><tbody>';
        r.forEach((rn, ri) => {
            t += `<tr><th scope="row" style="background:var(--gray-50);">${esc(rn)}</th>`;
            c.forEach(() => { t += `<td class="text-center"><input type="radio" class="form-check-input" name="${gridName}_r${ri}"${dis}></td>`; });
            t += '</tr>';
        });
        t += '</tbody></table></div></div>';
        inp = t;
    } else if (f.fieldType==='شبكة مربعات اختيار') {
        const cols = fdParseLines(props.options);
        const rows = fdParseLines(props.rowLabels);
        const c = cols.length ? cols : ['عمود'];
        const r = rows.length ? rows : ['صف'];
        const dis = props.readOnly ? ' disabled' : '';
        const hintBar = `<div style="font-size:11px;color:var(--success-700);background:var(--success-50);border:1px solid var(--success-100);border-radius:6px;padding:4px 10px;margin-bottom:6px;display:inline-flex;align-items:center;gap:6px;"><i class="bi bi-check2-square"></i> يمكن اختيار أكثر من خانة لكل صف</div>`;
        let t = `<div${ttAttr}>${hintBar}<div class="table-responsive"><table class="table table-bordered table-sm mb-0" style="font-size:13px;"><thead><tr><th></th>`;
        c.forEach(h => { t += `<th class="text-center">${esc(h)}</th>`; });
        t += '</tr></thead><tbody>';
        r.forEach((rn) => {
            t += `<tr><th scope="row" style="background:var(--gray-50);">${esc(rn)}</th>`;
            c.forEach(() => { t += `<td class="text-center"><input type="checkbox" class="form-check-input"${dis}></td>`; });
            t += '</tr>';
        });
        t += '</tbody></table></div></div>';
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
        inp = fdBuildSignatureFieldHtml(f, props, reqAttr, roAttr, roSel, ttAttr, opt || {});
    } else if (f.fieldType === 'تاريخ ووقت') {
        const minA = props.startDate ? ` min="${fdEscAttr(String(props.startDate))}T00:00"` : '';
        const maxA = props.endDate   ? ` max="${fdEscAttr(String(props.endDate))}T23:59"` : '';
        const stepA = String(props.timeFormat || '').trim() === '12 ساعة' ? ' step="60"' : '';
        inp = `<input type="datetime-local" class="form-control fd-datetime-control" value="${defVal}"${reqAttr}${roAttr}${minA}${maxA}${stepA}${ttAttr}${mk('direction:ltr;')}>`;
    } else if (f.fieldType === 'تبديل') {
        const onText = props.onText || 'نعم';
        const offText = props.offText || 'لا';
        const checked = props.defaultOn ? ' checked' : '';
        const dis = props.readOnly ? ' disabled' : '';
        const uidSw = `fd_sw_${String(f.id ?? 'x')}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`.replace(/[^\w\-]/g, '');
        inp = `<div class="fd-switch-field d-flex align-items-center gap-2"${ttAttr}${mk()}>` +
            `<div class="form-check form-switch m-0" style="min-width:48px;">` +
            `<input class="form-check-input fd-switch-input" type="checkbox" role="switch" id="${fdEscAttr(uidSw)}"${checked}${dis} data-fd-on-text="${fdEscAttr(onText)}" data-fd-off-text="${fdEscAttr(offText)}" onchange="fdSwitchSync(this)">` +
            `</div>` +
            `<label for="${fdEscAttr(uidSw)}" class="fd-switch-label mb-0" style="font-size:13px;font-weight:600;color:var(--gray-700);cursor:pointer;">${esc(checked ? onText : offText)}</label>` +
            `</div>`;
    } else if (f.fieldType === 'رابط') {
        const lbl = (props.linkLabel || 'فتح الرابط').trim();
        const phUrl = ph || 'https://example.com';
        const uidUrl = `fd_url_${String(f.id ?? 'x')}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`.replace(/[^\w\-]/g, '');
        const dStyle = wStyle ? ` style="${wStyle}"` : '';
        inp = `<div class="input-group fd-url-input-group"${ttAttr}${dStyle}>` +
            `<input type="url" id="${fdEscAttr(uidUrl)}" class="form-control fd-url-input" placeholder="${phUrl}" value="${defVal}"${reqAttr}${roAttr} pattern="https?://.+" title="${fdEscAttr('أدخل رابطاً يبدأ بـ http:// أو https://')}" dir="ltr" style="direction:ltr;${roStyle}">` +
            `<button type="button" class="btn btn-outline-secondary fd-url-open-btn" onclick="fdUrlOpen('${fdEscAttr(uidUrl)}')" title="${fdEscAttr('فتح الرابط في صفحة جديدة')}"><i class="bi bi-box-arrow-up-right" aria-hidden="true"></i> ${esc(lbl)}</button>` +
            `</div>`;
    } else if (f.fieldType === 'فاصل صفحات') {
        const lbl = (props.pageLabel || '').trim();
        inp = `<div class="fd-page-break" data-fd-pagebreak="1" style="display:flex;align-items:center;gap:12px;padding:8px 12px;border:1.5px dashed var(--info-300,#93c5fd);background:var(--info-50,#eff6ff);color:var(--info-700,#1d4ed8);border-radius:10px;font-weight:700;font-size:12.5px;"${ttAttr}>` +
            `<i class="bi bi-file-earmark-break" aria-hidden="true"></i>` +
            `<span>فاصل صفحات</span>` +
            (lbl ? `<span style="margin-inline-start:auto;font-weight:600;color:var(--info-600);">→ ${esc(lbl)}</span>` : '') +
            `</div>`;
    } else if (f.fieldType === 'صورة عرض') {
        const imgUrl = String(props.imageUrl || '').trim();
        const alt = fdEscAttr(props.altText || f.fieldName || '');
        const w = props.widthPx ? `${parseInt(props.widthPx,10) || 320}px` : 'auto';
        const h = props.heightPx ? `${parseInt(props.heightPx,10) || 0}px` : 'auto';
        const alignMap2 = { 'يمين':'flex-end', 'يسار':'flex-start', 'وسط':'center' };
        const justify = alignMap2[props.imageAlign] || 'flex-start';
        if (imgUrl) {
            inp = `<div class="fd-image-display" style="display:flex;justify-content:${justify};"${ttAttr}><img src="${fdEscAttr(imgUrl)}" alt="${alt}" style="max-width:100%;width:${w};${h !== 'auto' ? 'height:'+h+';' : ''}border-radius:8px;object-fit:contain;border:1px solid var(--gray-200);background:#fff;padding:4px;"></div>`;
        } else {
            inp = `<div class="fd-image-display fd-image-placeholder" style="display:flex;justify-content:${justify};"${ttAttr}><div style="border:2px dashed var(--gray-300);border-radius:10px;padding:20px 24px;color:var(--gray-400);background:var(--gray-50);font-size:12.5px;text-align:center;min-width:160px;"><i class="bi bi-image" style="font-size:24px;display:block;margin-bottom:4px;"></i>أضف صورة من خصائص الحقل (إرفاق من الجهاز)</div></div>`;
        }
    } else {
        inp = `<input type="text" class="form-control" placeholder="${ph}" value="${defVal}"${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
    }

    return inp;
}

/** تزامن تسمية زر التبديل (نعم/لا أو المعرّف من خصائص الحقل) مع حالة المربع. */
function fdSwitchSync(el) {
    if (!el || !el.classList) return;
    const wrap = el.closest('.fd-switch-field');
    if (!wrap) return;
    const lab = wrap.querySelector('.fd-switch-label');
    const onTxt = el.getAttribute('data-fd-on-text') || 'نعم';
    const offTxt = el.getAttribute('data-fd-off-text') || 'لا';
    if (lab) lab.textContent = el.checked ? onTxt : offTxt;
}

/** فتح رابط حقل URL في نافذة جديدة (مع حماية noopener). */
function fdUrlOpen(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    let v = String(el.value || '').trim();
    if (!v) { el.focus(); return; }
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
        window.open(v, '_blank', 'noopener,noreferrer');
    } catch (_) {
        window.location.href = v;
    }
}

if (typeof window !== 'undefined') {
    window.fdSwitchSync = fdSwitchSync;
    window.fdUrlOpen = fdUrlOpen;
}

function fdSpinArabicDigitsToAscii(s) {
    return String(s)
        .replace(/[\u0660-\u0669]/g, ch => String(ch.charCodeAt(0) - 0x0660))
        .replace(/[\u06F0-\u06F9]/g, ch => String(ch.charCodeAt(0) - 0x06F0));
}

/** لا كسور معالجة يدوياً إن كانت خطوة العد عدداً صحيحاً ≥ 1؛ عدا ذلك تُسمح بالكسر. */
function fdSpinAllowsFraction(el) {
    if (!el) return true;
    const raw = String(el.getAttribute('step') || '').replace(/,/g, '.').trim();
    if (!raw) return true;
    const st = parseFloat(raw);
    if (!Number.isFinite(st) || st <= 0) return true;
    if (st > 0 && st < 1) return true;
    return st !== Math.floor(st);
}

function fdSpinAllowsNegative(el) {
    const lo = fdSpinGetMin(el);
    return lo === -Infinity || lo < 0;
}

function fdSpinCleanRaw(s, allowFrac, allowNeg) {
    let t = fdSpinArabicDigitsToAscii(String(s)).replace(/\s/g, '').replace(/,/g, '.').replace(/\u066B/g, '.');
    let out = '';
    let seenDot = false;
    let i = 0;
    if (allowNeg && i < t.length && t[i] === '-') {
        out += '-';
        i++;
    }
    while (i < t.length) {
        const c = t[i++];
        if (c >= '0' && c <= '9') {
            out += c;
            continue;
        }
        if ((c === '.' || c === ',') && allowFrac && !seenDot) {
            seenDot = true;
            out += '.';
        }
    }
    return out;
}

function fdSpinGetMin(el) {
    if (!el || !el.hasAttribute('min')) return -Infinity;
    const x = parseFloat(String(el.getAttribute('min')).replace(/,/g, '.'));
    return (isNaN(x)) ? -Infinity : x;
}
function fdSpinGetMax(el) {
    if (!el || !el.hasAttribute('max')) return Infinity;
    const x = parseFloat(String(el.getAttribute('max')).replace(/,/g, '.'));
    return (isNaN(x)) ? Infinity : x;
}
function fdSpinFormatForInput(v, el) {
    const stAttr = el.getAttribute('step');
    const st = (stAttr != null && stAttr !== '') ? parseFloat(String(stAttr).replace(/,/g, '.')) : NaN;
    if (!isNaN(st) && st > 0 && st < 1) {
        const decPart = String(st).split('.')[1] || '';
        const dec = Math.min(Math.max(decPart.length || 2, 1), 10);
        return (+v).toFixed(dec);
    }
    const rounded = +(+(v).toFixed(4));
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
/** حقل دوار مراقَب كنص لتصفية أي غير أرقام وفرض النطاق min/max كلما كان الرقم مقبولاً. */
function fdSpinClamp(el) {
    if (!el || !el.classList.contains('fd-spin-input')) return;
    if (el.readOnly || el.disabled) return;
    const allowFrac = fdSpinAllowsFraction(el);
    const allowNeg = fdSpinAllowsNegative(el);
    const lo = fdSpinGetMin(el);
    const hi = fdSpinGetMax(el);

    let cleaned = fdSpinCleanRaw(el.value, allowFrac, allowNeg);
    if (!allowFrac) {
        const ixDot = cleaned.indexOf('.');
        if (ixDot >= 0) cleaned = cleaned.slice(0, ixDot);
    }
    const t = cleaned.trim();
    el.value = cleaned;

    if (t === '' || t === '-' || !t) return;
    if (allowFrac && (/^-?\d+\.$/).test(cleaned)) return;
    if (allowFrac && (cleaned === '.' || cleaned === '-.')) return;

    const v = parseFloat(cleaned.replace(/,/g, '.'));
    if (!Number.isFinite(v)) {
        if (Number.isFinite(lo)) el.value = fdSpinFormatForInput(lo, el);
        else el.value = '';
        return;
    }
    let x = v;
    if (x < lo) x = lo;
    if (x > hi) x = hi;
    el.value = fdSpinFormatForInput(x, el);
}
function fdSpinInc(btn) {
    const i = btn.parentElement && btn.parentElement.querySelector('input.fd-spin-input');
    if (!i || i.readOnly || i.disabled) return;
    const stAttr = i.getAttribute('step');
    const s = (stAttr != null && stAttr !== '') ? (parseFloat(String(stAttr).replace(/,/g, '.')) || 1) : 1;
    const lo = fdSpinGetMin(i), hi = fdSpinGetMax(i);
    let v = parseFloat(String(i.value).replace(/,/g, '.'));
    if (isNaN(v)) v = (lo !== -Infinity) ? lo : 0;
    let next = v + s;
    if (next > hi) next = hi;
    i.value = fdSpinFormatForInput(next, i);
    fdSpinClamp(i);
}
function fdSpinDec(btn) {
    const i = btn.parentElement && btn.parentElement.querySelector('input.fd-spin-input');
    if (!i || i.readOnly || i.disabled) return;
    const stAttr = i.getAttribute('step');
    const s = (stAttr != null && stAttr !== '') ? (parseFloat(String(stAttr).replace(/,/g, '.')) || 1) : 1;
    const lo = fdSpinGetMin(i), hi = fdSpinGetMax(i);
    let v = parseFloat(String(i.value).replace(/,/g, '.'));
    if (isNaN(v)) v = (lo !== -Infinity) ? lo : 0;
    let next = v - s;
    if (next < lo) next = lo;
    i.value = fdSpinFormatForInput(next, i);
    fdSpinClamp(i);
}
if (typeof window !== 'undefined') {
    window.fdSpinClamp = fdSpinClamp;
    window.fdSpinInc = fdSpinInc;
    window.fdSpinDec = fdSpinDec;
}

// ─── SIGNATURE / APPROVAL FIELD (mirrors Beneficiary endorsement/signature) ──
/** في شاشة التعبئة: عيّن window.fdBeneficiarySignatureContext = { endorsementFile, signatureFile } بنفس صيغة بطاقة المستفيد، أو مرّر opt.beneficiaryProfile إلى fdBuildFieldInput */
const FD_SIG_MODE_SYSTEM = 'التوقيع المعتمد في النظام';
const FD_SIG_VALID_MODES = new Set(['مرفق', 'التوقيع بالقلم', FD_SIG_MODE_SYSTEM]);

/** إذا وُجدت قيمة mode صالحة في propertiesJson يُثبَّت النمط ويُخفى Dropdown للمستخدم النهائي والمعاينة. */
function fdSigModeIsFixed(props) {
    if (!props || props.mode == null) return false;
    const m = String(props.mode).trim();
    return FD_SIG_VALID_MODES.has(m);
}

function fdResolveBeneficiarySignatureAssets(opt) {
    const fromOpt = opt && opt.beneficiaryProfile;
    const g = (typeof window !== 'undefined' && window.fdBeneficiarySignatureContext) ? window.fdBeneficiarySignatureContext : null;
    const b = fromOpt || g || {};
    const endorsementFile = String(b.endorsementFile ?? b.EndorsementFile ?? '').trim();
    const signatureFile = String(b.signatureFile ?? b.SignatureFile ?? '').trim();
    return { endorsementFile, signatureFile };
}

function fdBuildSignatureFieldHtml(f, props, reqAttr, roAttr, roSel, ttAttr, opt) {
    opt = opt || {};
    const isSig = f.fieldType === 'توقيع';
    const modeFixed = fdSigModeIsFixed(props);
    const currentMode = modeFixed ? String(props.mode).trim() : (props.mode || 'مرفق');
    const widthCss = props.widthPx ? `${parseInt(props.widthPx, 10)}px` : '100%';
    const canvasH = props.heightPx ? parseInt(props.heightPx, 10) : 120;
    const uid = 'fdSig_' + (f.id || Math.random().toString(36).slice(2, 8));
    const selId = uid + '_sel';
    const fileWrapId = uid + '_fileWrap';
    const canvasWrapId = uid + '_canvasWrap';
    const systemWrapId = uid + '_systemWrap';
    const canvasId = uid + '_canvas';
    const previewId = uid + '_preview';
    const fileInputId = uid + '_fileInput';
    const showFile = currentMode === 'مرفق' ? 'block' : 'none';
    const showCanvas = currentMode === 'التوقيع بالقلم' ? 'block' : 'none';
    const fileLbl = isSig ? 'رفع ملف التوقيع' : 'رفع ملف التأشير';
    const canvasLbl = isSig ? 'التوقيع الإلكتروني' : 'التوقيع الإلكتروني للتأشير';
    const assets = fdResolveBeneficiarySignatureAssets(opt);
    const assetForField = isSig ? assets.signatureFile : assets.endorsementFile;
    let systemInner = '';
    if (assetForField.startsWith('data:image')) {
        const safeSrc = assetForField.replace(/"/g, '&quot;');
        systemInner = `<img src="${safeSrc}" alt="" class="fd-sig-attach-preview" style="max-height:${canvasH}px;max-width:100%;object-fit:contain;">`;
    } else if (assetForField.startsWith('data:application/pdf')) {
        systemInner = '<div class="d-flex align-items-center gap-2 flex-wrap"><span class="badge bg-success" style="font-size:12px;"><i class="bi bi-patch-check-fill"></i> ملف PDF معتمد من بطاقة المستفيد</span></div>';
    } else if (assetForField.length > 40) {
        systemInner = '<div class="d-flex align-items-center gap-2 flex-wrap"><span class="badge bg-success" style="font-size:12px;"><i class="bi bi-patch-check-fill"></i> ملف معتمد محفوظ في بطاقة المستفيد</span></div>';
    } else {
        systemInner = `<p class="text-muted small mb-0" style="font-style:normal;line-height:1.55;">عند تعبئة النموذج يُستخدم تلقائياً ${isSig ? '<strong>التوقيع</strong>' : '<strong>التأشير</strong>'} المعتمد المسجَّل في بطاقة المستفيد في النظام (لا يُطلب من المستخدم رفع ملف أو الرسم هنا).</p>`;
    }

    if (currentMode === FD_SIG_MODE_SYSTEM) {
        const roleWord = isSig ? 'التوقيع' : 'التأشير';
        const systemHeader = `<div class="d-flex align-items-start gap-2 mb-3 pb-3 border-bottom" style="border-color:var(--gray-200)!important;font-style:normal;">
            <i class="bi bi-patch-check-fill text-success flex-shrink-0" style="font-size:1.35rem;margin-top:2px;"></i>
            <div>
                <div style="font-weight:700;font-size:13px;color:var(--sa-800);">${FD_SIG_MODE_SYSTEM}</div>
                <div style="font-size:12px;color:var(--gray-600);margin-top:4px;line-height:1.5;">يُؤخذ ${roleWord} المستفيد المحفوظ في النظام تلقائياً عند التعبئة، وفق ما تم تسجيله عند إضافته كمستفيد.</div>
            </div>
        </div>`;
        return `<div class="fd-sig-field fd-sig-field-system-only" style="max-width:${widthCss};font-style:normal;"${ttAttr}>
            ${systemHeader}
            <div class="fd-sig-system-wrap border rounded-3 p-3" style="background:var(--gray-50);border-color:var(--gray-200) !important;">
                ${systemInner}
            </div>
        </div>`;
    }

    if (modeFixed && currentMode === 'مرفق') {
        return `<div class="fd-sig-field fd-sig-field-mode-fixed" style="max-width:${widthCss};" data-fd-sig-mode-fixed="مرفق"${ttAttr}>
            <div id="${fileWrapId}" class="fd-sig-file-wrap" style="display:block;">
                <label class="form-label small mb-1" style="color:var(--gray-600);font-weight:700;">${fileLbl}</label>
                <input type="file" class="form-control form-control-sm" id="${fileInputId}" accept="image/*,.pdf" onchange="fdSigFileChange(this,'${previewId}')"${roAttr}${reqAttr}>
                <div id="${previewId}" class="fd-sig-attach-preview-wrap mt-2" style="display:none;"></div>
            </div>
        </div>`;
    }

    if (modeFixed && currentMode === 'التوقيع بالقلم') {
        return `<div class="fd-sig-field fd-sig-field-mode-fixed" style="max-width:${widthCss};" data-fd-sig-canvas="${canvasId}" data-fd-sig-mode-fixed="قلم"${ttAttr}>
            <label class="form-label small mb-1" style="color:var(--gray-600);font-weight:700;">${canvasLbl}</label>
            <div class="fd-sig-canvas-wrap">
                <canvas class="fd-sig-canvas" id="${canvasId}" width="280" height="${canvasH}" data-fd-init-sig></canvas>
                <button type="button" class="btn btn-outline-secondary btn-sm" onclick="fdSigClearCanvas('${canvasId}')"><i class="bi bi-eraser"></i> مسح</button>
            </div>
        </div>`;
    }

    return `<div class="fd-sig-field" style="max-width:${widthCss};" data-fd-sig-canvas="${canvasId}"${ttAttr}>
        <select class="form-select form-select-sm mb-2" id="${selId}" onchange="fdSigToggle('${uid}')"${roSel}>
            <option value="مرفق" ${currentMode==='مرفق'?'selected':''}>مرفق (صورة أو PDF)</option>
            <option value="التوقيع بالقلم" ${currentMode==='التوقيع بالقلم'?'selected':''}>التوقيع بالقلم</option>
            <option value="${FD_SIG_MODE_SYSTEM}" ${currentMode===FD_SIG_MODE_SYSTEM?'selected':''}>التوقيع المعتمد في النظام</option>
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
        <div id="${systemWrapId}" class="fd-sig-system-wrap border rounded-3 p-3" style="display:none;background:var(--gray-50);border-color:var(--gray-200) !important;">
            ${systemInner}
        </div>
    </div>`;
}

function fdSigToggle(uid) {
    const sel = document.getElementById(uid + '_sel');
    const fileWrap = document.getElementById(uid + '_fileWrap');
    const canvasWrap = document.getElementById(uid + '_canvasWrap');
    const sysWrap = document.getElementById(uid + '_systemWrap');
    const canvas = document.getElementById(uid + '_canvas');
    if (!sel || !fileWrap || !canvasWrap) return;
    if (sel.value === 'مرفق') {
        fileWrap.style.display = 'block';
        canvasWrap.style.display = 'none';
        if (sysWrap) sysWrap.style.display = 'none';
    } else if (sel.value === FD_SIG_MODE_SYSTEM) {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'none';
        if (sysWrap) sysWrap.style.display = 'block';
    } else {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'block';
        if (sysWrap) sysWrap.style.display = 'none';
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
    fdEnsureDateFieldStyles();
    fdEnsureFieldTypeBadgeStyles();
    fdDdlEnsureTreeExpandDelegation();
    (root || document).querySelectorAll('canvas[data-fd-init-sig]').forEach(fdSigBindCanvas);
    (root || document).querySelectorAll('.fd-oc-group').forEach(fdOcInitGroup);
    (root || document).querySelectorAll('.fd-switch-input').forEach(el => fdSwitchSync(el));
    fdHijriBindInRoot(root);
    fdGregorianDateBindInRoot(root);
    fdFileUploadBindInRoot(root);
    fdBindPhonePatternFilters(root);
    fdIvBindLive(root);
}

if (typeof window !== 'undefined') {
    window.fdInitDynamicWidgets = fdInitDynamicWidgets;
    window.fdFieldTypeBadgeHtml = fdFieldTypeBadgeHtml;
}

/** التنقل بين صفحات النموذج (التالي/السابق) — يُحدِّث حالة الأزرار والمؤشرات. */
function fdPagerNav(btn, direction) {
    const pager = btn && btn.closest ? btn.closest('[data-fd-pager="1"]') : null;
    if (!pager) return;
    const total = parseInt(pager.getAttribute('data-fd-page-count') || '1', 10);
    let cur = parseInt(pager.getAttribute('data-fd-page-current') || '0', 10);
    cur = Math.max(0, Math.min(total - 1, cur + (direction || 0)));
    pager.setAttribute('data-fd-page-current', String(cur));
    pager.querySelectorAll('.fd-form-page').forEach(p => {
        const idx = parseInt(p.getAttribute('data-fd-page-idx') || '0', 10);
        p.style.display = idx === cur ? '' : 'none';
    });
    pager.querySelectorAll('.fd-page-dot').forEach(d => {
        const i = parseInt(d.getAttribute('data-fd-page-dot') || '0', 10);
        d.style.background = i === cur ? 'var(--sa-600,#047857)' : 'var(--gray-300,#d1d5db)';
    });
    const numEl = pager.querySelector('.fd-page-num');
    if (numEl) numEl.textContent = String(cur + 1);
    const prev = pager.querySelector('.fd-page-prev');
    const next = pager.querySelector('.fd-page-next');
    if (prev) prev.disabled = cur === 0;
    if (next) next.disabled = cur === total - 1;
    pager.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

if (typeof window !== 'undefined') {
    window.fdPagerNav = fdPagerNav;
    window.fdCloseWorkflowMenus = fdCloseWorkflowMenus;
    window.fdToggleWorkflowMenu = fdToggleWorkflowMenu;
    window.fdOnFieldDragStart = fdOnFieldDragStart;
    window.fdOnFieldDragEnd = fdOnFieldDragEnd;
    window.fdOnFieldDragOver = fdOnFieldDragOver;
    window.fdOnFieldDragLeave = fdOnFieldDragLeave;
    window.fdOnFieldDrop = fdOnFieldDrop;
}

// ─── SECTIONS HELPERS ──────────────────────────────────────────────────────
function fdDefaultSections() { return [{ id: 1, title: 'القسم الأول' }]; }

function fdParseFieldsJsonPayload(json) {
    const def = { sections: fdDefaultSections(), fields: [], rules: [], titleAppearance: fdDefaultTitleAppearance() };
    if (!json) return def;
    let p;
    try { p = JSON.parse(json); } catch { return def; }
    if (Array.isArray(p)) {
        p.forEach(f => { if (!f.sectionId) f.sectionId = 1; });
        return { sections: def.sections, fields: p, rules: [], titleAppearance: fdDefaultTitleAppearance() };
    }
    if (p && typeof p === 'object') {
        const s = Array.isArray(p.sections) && p.sections.length
            ? p.sections.map((x, i) => ({ id: x.id || (i + 1), title: x.title || `القسم ${i + 1}` }))
            : def.sections;
        const fs = Array.isArray(p.fields) ? p.fields : [];
        const firstId = s[0].id;
        const valid = new Set(s.map(x => x.id));
        fs.forEach(f => { if (!f.sectionId || !valid.has(f.sectionId)) f.sectionId = firstId; });
        const rs = Array.isArray(p.rules) ? p.rules : [];
        const ta = fdNormalizeTitleAppearance(p.meta && p.meta.titleAppearance);
        return { sections: s, fields: fs, rules: rs, titleAppearance: ta };
    }
    return def;
}

function fdSerializeFieldsJson() {
    fdReindexFieldSortOrders();
    const ta = fdStep1State && fdStep1State.titleAppearance
        ? fdNormalizeTitleAppearance(fdStep1State.titleAppearance)
        : fdDefaultTitleAppearance();
    return JSON.stringify({
        sections: fdSections,
        fields: fdFields,
        rules: fdConditionalRules,
        meta: { titleAppearance: ta }
    });
}

function fdResetSectionsState() {
    fdSections = fdDefaultSections();
    fdActiveSectionId = fdSections[0].id;
    fdSectionSeq = 2;
    fdConditionalRules = [];
    fdRuleSeq = 1;
}

function fdApplyParsedFieldsData(parsed) {
    fdSections = (parsed.sections && parsed.sections.length) ? parsed.sections : fdDefaultSections();
    fdActiveSectionId = fdSections[0].id;
    const ids = fdSections.map(s => s.id);
    fdSectionSeq = (ids.length ? Math.max(...ids) : 0) + 1;
    fdFields = parsed.fields || [];
    fdFields.forEach((f, i) => { if (!f.id) f.id = i + 1; });
    fdReindexFieldSortOrders();
    const validFieldIds = new Set(fdFields.map(f => f.id));
    const validSecIds = new Set(fdSections.map(s => s.id));
    const firstFieldRef = fdFields[0] ? `field:${fdFields[0].id}` : (fdSections[0] ? `section:${fdSections[0].id}` : '');
    const firstAltRef = (fdSections[0] ? `section:${fdSections[0].id}` : (fdFields[0] ? `field:${fdFields[0].id}` : ''));
    fdConditionalRules = (parsed.rules || []).map((r, i) => {
        // قراءة sourceRef/targetRef الموحَّدَين، مع توافق رجعي مع fieldId/sectionId القديمة
        let src = fdParseRuleRef(r.sourceRef);
        if (!src && r.fieldId != null) src = { kind: 'field', id: r.fieldId };
        if (!src || !fdRuleRefIsValid(src, validFieldIds, validSecIds)) src = fdParseRuleRef(firstFieldRef) || { kind: 'field', id: 0 };

        let tgt = fdParseRuleRef(r.targetRef);
        if (!tgt && r.sectionId != null) tgt = { kind: 'section', id: r.sectionId };
        if (!tgt || !fdRuleRefIsValid(tgt, validFieldIds, validSecIds)) tgt = fdParseRuleRef(firstAltRef) || { kind: 'section', id: 1 };
        // تجنّب تطابق الهدف مع المصدر
        if (fdRuleRefEqual(src, tgt)) {
            const alt = fdRuleFirstRefExcluding(src, fdFields, fdSections);
            if (alt) tgt = alt;
        }

        const rawAction = r.action || FD_RULE_ACTIONS[0];
        const migratedAction = FD_RULE_ACTION_LEGACY[rawAction] || rawAction;
        return {
            id: r.id || (i + 1),
            isEnabled: r.isEnabled !== false,
            sourceRef: fdSerializeRuleRef(src),
            operator: FD_RULE_OPERATORS.includes(r.operator) ? r.operator : FD_RULE_OPERATORS[0],
            value: r.value || '',
            action: FD_RULE_ACTIONS.includes(migratedAction) ? migratedAction : FD_RULE_ACTIONS[0],
            targetRef: fdSerializeRuleRef(tgt)
        };
    });
    const ruleIds = fdConditionalRules.map(r => r.id);
    fdRuleSeq = (ruleIds.length ? Math.max(...ruleIds) : 0) + 1;
    if (fdStep1State) fdStep1State.titleAppearance = fdNormalizeTitleAppearance(parsed.titleAppearance);
}

/** "field:123" → { kind:'field', id:123 } ;  "section:1" → { kind:'section', id:1 }. */
function fdParseRuleRef(ref) {
    if (ref == null) return null;
    const s = String(ref).trim();
    if (!s) return null;
    const m = s.match(/^(field|section)\s*:\s*(\d+)$/i);
    if (!m) return null;
    return { kind: m[1].toLowerCase(), id: parseInt(m[2], 10) };
}

function fdSerializeRuleRef(ref) {
    if (!ref || !ref.kind || ref.id == null) return '';
    return `${ref.kind}:${ref.id}`;
}

function fdRuleRefIsValid(ref, fieldIds, secIds) {
    if (!ref) return false;
    if (ref.kind === 'field') return fieldIds.has(ref.id);
    if (ref.kind === 'section') return secIds.has(ref.id);
    return false;
}

function fdRuleRefEqual(a, b) {
    return !!(a && b && a.kind === b.kind && a.id === b.id);
}

/** أول مرجع متاح يختلف عن المرجع الممرَّر (يُفضّل القسم ثم الحقل). */
function fdRuleFirstRefExcluding(excludeRef, fields, sections) {
    for (const s of sections) {
        const ref = { kind: 'section', id: s.id };
        if (!fdRuleRefEqual(ref, excludeRef)) return ref;
    }
    for (const f of fields) {
        const ref = { kind: 'field', id: f.id };
        if (!fdRuleRefEqual(ref, excludeRef)) return ref;
    }
    return null;
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
    const ownership = document.getElementById('fdFilterOwnership')?.value||'';
    const templateId = document.getElementById('fdFilterTemplate')?.value||'';
    const orgUnitId = document.getElementById('fdFilterOrgUnit')?.value||'';
    const activation = document.getElementById('fdFilterActivation')?.value||'';
    const p = new URLSearchParams({search,status});
    if (catId)  p.set('formClassId',catId);
    if (typeId) p.set('typeId',typeId);
    if (ownership) p.set('ownership', ownership);
    if (templateId) p.set('templateId', templateId);
    if (orgUnitId) p.set('orgUnitId', orgUnitId);
    if (activation) p.set('activation', activation);
    try {
        const res = await apiFetch(`/FormDefinitions/GetFormDefinitions?${p}`);
        if (!res.success) return;
        fdData    = res.data||[];
        fdIsAdmin = res.isAdmin;
        fdLookups = {
            formClasses:res.formClasses||[],
            formTypes:res.formTypes||[],
            workspaces:res.workspaces||[],
            templates:res.templates||[],
            templateFilters:res.templateFilters||[],
            orgUnitFilters:res.orgUnitFilters||[]
        };
        fdOrgUnits = (fdLookups.orgUnitFilters || []).map(u => ({
            id: u.id, name: u.name, parentId: u.parentId ?? u.ParentId ?? null, sortOrder: u.sortOrder ?? u.SortOrder ?? 0
        }));
        fdFillFilters(); fdRenderTable();
    } catch(e) { console.error('fdLoad',e); }
}

function fdFillFilters() {
    const catSel  = document.getElementById('fdFilterCat');
    const typeSel = document.getElementById('fdFilterType');
    const tplSel  = document.getElementById('fdFilterTemplate');
    if (catSel && catSel.options.length<=1) fdLookups.formClasses.forEach(c=>catSel.add(new Option(c.name,c.id)));
    if (typeSel && typeSel.options.length<=1) fdLookups.formTypes.forEach(t=>typeSel.add(new Option(t.name,t.id)));
    if (tplSel && tplSel.options.length<=1) (fdLookups.templateFilters||[]).forEach(t=>tplSel.add(new Option(t.name,t.id)));
    fdInitOrgUnitFilterTree();
    const th = document.getElementById('fdThActive');
    if (th) th.style.display = '';
}

function fdClear() {
    ['fdSearch','fdFilterCat','fdFilterType','fdFilterStatus','fdFilterOwnership','fdFilterTemplate','fdFilterActivation'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    const ou = document.getElementById('fdFilterOrgUnit');
    if (ou) ou.value = '';
    const ouLab = document.getElementById('fdFilterOuLabel');
    if (ouLab) ouLab.textContent = 'الوحدة التنظيمية';
    fdFilterOuClosePanel();
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
        const disp = '';
        let toggle;
        if (fdIsAdmin) {
            toggle = `<label class="fd-toggle" title="${f.status!=='approved'?'يمكن التفعيل للنماذج المعتمدة فقط':''}"><input type="checkbox" ${f.isActive?'checked':''} ${f.status!=='approved'?'disabled':''} onchange="fdToggle(${f.id},this)"><span class="fd-slider"></span></label>`;
        } else {
            toggle = `<label class="fd-toggle fd-toggle-readonly" title="عرض فقط"><input type="checkbox" ${f.isActive?'checked':''} disabled onclick="event.preventDefault();return false;"><span class="fd-slider"></span></label>`;
        }
        const publicIdCell = f.publicId
            ? `<span class="fd-publicid-badge">${esc(f.publicId)}</span>`
            : `<span class="fd-activever-empty">—</span>`;
        const activeVerCell = f.activeVersionLabel
            ? `<span class="fd-activever-badge">${esc(f.activeVersionLabel)}</span>`
            : `<span class="fd-activever-empty">—</span>`;
        return `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${i+1}</td>
            <td style="text-align:center;">${publicIdCell}</td>
            <td style="font-weight:600;">${esc(f.name)}</td>
            <td>${esc(f.formClassName)}</td>
            <td>${esc(f.formTypeName)}</td>
            <td style="text-align:center;">${fdOwnershipBadge(f.ownership)}</td>
            <td style="font-size:13px;">${esc(f.orgUnitName)}</td>
            <td style="text-align:center;">${activeVerCell}</td>
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

function fdCloseWorkflowMenus() {
    document.querySelectorAll('.fd-workflow-menu').forEach(m => m.classList.add('d-none'));
}

function fdToggleWorkflowMenu(id, ev) {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    const menu = document.getElementById('fdWfMenu-' + id);
    if (!menu) return;
    const wasOpen = !menu.classList.contains('d-none');
    fdCloseWorkflowMenus();
    if (!wasOpen) menu.classList.remove('d-none');
}

function fdActions(f) {
    let h = '<div class="fd-actions-wrap d-flex gap-1 justify-content-center flex-wrap align-items-center">';
    h += `<button class="fd-action-btn fd-action-btn-detail" onclick="fdShowDetails(${f.id})"><i class="bi bi-eye"></i> تفاصيل</button>`;
    const isApproved = f.status === 'approved';
    if (!isApproved && (fdIsAdmin || f.status === 'draft' || f.status === 'rejected'))
        h += `<button class="fd-action-btn fd-action-btn-edit" onclick="fdShowEdit(${f.id})"><i class="bi bi-pencil-square"></i> تعديل</button>`;

    const wfItems = [];
    if (!fdIsAdmin && (f.status === 'draft' || f.status === 'rejected'))
        wfItems.push(`<button type="button" class="fd-wf-item fd-wf-send" onclick="fdCloseWorkflowMenus();fdSendApproval(${f.id})"><i class="bi bi-send-fill"></i> إرسال للاعتماد</button>`);
    if (fdIsAdmin && f.status === 'pending') {
        wfItems.push(`<button type="button" class="fd-wf-item fd-wf-approve" onclick="fdCloseWorkflowMenus();fdApprove(${f.id})"><i class="bi bi-check-lg"></i> اعتماد النموذج</button>`);
        wfItems.push(`<button type="button" class="fd-wf-item fd-wf-reject" onclick="fdCloseWorkflowMenus();fdShowReject(${f.id},'${esc(f.name)}')"><i class="bi bi-x-lg"></i> رفض النموذج</button>`);
    }
    if (wfItems.length) {
        h += `<div class="fd-workflow-wrap"><button type="button" class="fd-action-btn fd-action-btn-workflow" onclick="fdToggleWorkflowMenu(${f.id}, event)" title="إرسال واعتماد"><i class="bi bi-send-check"></i></button>`;
        h += `<div class="fd-workflow-menu d-none" id="fdWfMenu-${f.id}">${wfItems.join('')}</div></div>`;
    }

    if (!isApproved)
        h += `<button class="fd-action-btn fd-action-btn-version" onclick="fdGoToVersions(${f.id})" title="إصدار نسخة"><i class="bi bi-layers"></i> إصدار نسخة</button>`;
    if (!isApproved && (fdIsAdmin || f.status === 'draft' || f.status === 'rejected'))
        h += `<button class="fd-action-btn fd-action-btn-delete" onclick="fdShowDelete(${f.id},'${esc(f.name)}')"><i class="bi bi-trash3"></i> حذف</button>`;
    return h + '</div>';
}

function fdGoToVersions(formId) {
    if (!formId) return;
    window.location.href = `/FormDefinitionVersions/Index?id=${encodeURIComponent(formId)}`;
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
    fdVersionMode = false; fdVersionFormId = 0; fdVersionEditId = null; fdVersionName = '';
    fdEditId = null; fdStep = 1; fdFields = []; fdEditingIdx = -1; fdCurrentTemplate = null;
    fdBindingLookupsLoaded = false;
    fdDropdownItemsCache = {};
    fdReadyTableGridCache = {};
    fdResetSectionsState();
    fdStep1State = { name:'', desc:'', ownership:'عام', formClassId:0, typeId:0, wsId:0, tplId:0, titleAppearance: fdDefaultTitleAppearance() };
    document.getElementById('fdWizardTitle').textContent = 'إنشاء نموذج جديد';
    document.getElementById('fdWizardSub').textContent = 'أدخل بيانات النموذج الجديد';
    document.getElementById('fdWizardHead').className = 'fd-modal-header create';
    fdRenderStep(); fdWizModal().show();
}

async function fdShowEdit(id) {
    try {
        fdVersionMode = false; fdVersionFormId = 0; fdVersionEditId = null; fdVersionName = '';
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
            tplId: d.templateId || 0,
            titleAppearance: fdDefaultTitleAppearance()
        };
        // لقطة القالب من الخادم + مزامنة العلامة المائية مع القالب الحي (WatermarkUrl/Opacity/…)
        fdCurrentTemplate = await fdEnrichTemplateDataWatermark(d.templateData || null, d.templateId);
        fdApplyParsedFieldsData(fdParseFieldsJsonPayload(d.fieldsJson || ''));
        document.getElementById('fdWizardTitle').textContent = 'تعديل النموذج';
        document.getElementById('fdWizardSub').textContent = d.name;
        document.getElementById('fdWizardHead').className = 'fd-modal-header edit';
        fdRenderStep(d); fdWizModal().show();
    } catch { showToast('خطأ في تحميل البيانات', 'error'); }
}

// ─── WIZARD RENDER ────────────────────────────────────────────────────────────
function fdRenderStep(data) {
    ['fdStep1El','fdStep2El','fdStep3El','fdStep4El'].forEach((id,idx) => {
        const el=document.getElementById(id); if(!el) return;
        el.className='fd-step'+(idx+1===fdStep?' active':idx+1<fdStep?' done':'');
        // إخفاء خطوة "البيانات الأساسية" عند وضع الإصدار
        if (idx === 0) el.style.display = fdVersionMode ? 'none' : '';
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
        // في وضع الإصدار: لا يوجد "السابق" لأن خطوة 1 محذوفة
        const backBtn2 = fdVersionMode
            ? `<div></div>`
            : `<button class="fd-cancel-btn" onclick="fdGoStepBack(2)"><i class="bi bi-arrow-right-short"></i> السابق</button>`;
        foot.innerHTML = `${backBtn2}
        <button class="fd-save-btn send" id="fdStep2NextBtn" onclick="fdGoStep3()" ${fdFields.length ? '' : 'disabled title="أضف حقلًا واحدًا على الأقل"'}><i class="bi bi-arrow-left-short"></i> التالي</button>`;
    } else if (fdStep===3) {
        body.innerHTML = fdStep3Html();
        fdRenderRules();
        foot.innerHTML = `<button class="fd-cancel-btn" onclick="fdGoStepBack(3)"><i class="bi bi-arrow-right-short"></i> السابق</button>
        <button class="fd-save-btn send" onclick="fdGoStep4()"><i class="bi bi-arrow-left-short"></i> التالي</button>`;
    } else {
        body.innerHTML = fdStep4Html();
        fdInitDynamicWidgets(body);
        let primaryActionLabel, primaryActionIcon;
        if (fdVersionMode) {
            primaryActionLabel = fdIsAdmin ? 'اعتماد وتفعيل الإصدار' : 'اعتماد الإصدار';
            primaryActionIcon  = 'bi-check-circle-fill';
        } else {
            primaryActionLabel = fdIsAdmin ? 'نشر النموذج' : 'إرسال للاعتماد';
            primaryActionIcon  = fdIsAdmin ? 'bi-upload' : 'bi-send-fill';
        }
        foot.innerHTML = `<button class="fd-cancel-btn" onclick="fdGoStepBack(4)"><i class="bi bi-arrow-right-short"></i> السابق</button>
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
    const ta = fdNormalizeTitleAppearance((fdStep1State && fdStep1State.titleAppearance) ? fdStep1State.titleAppearance : (d.titleAppearance || {}));
    const alR = ta.align === 'right' ? 'selected' : '';
    const alC = ta.align === 'center' ? 'selected' : '';
    const alL = ta.align === 'left' ? 'selected' : '';
    return `
    <div class="fd-section">
        <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> المعلومات الأساسية</div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label><span class="required-star">*</span> اسم النموذج</label><input type="text" class="form-control" id="fdFName" value="${esc(d.name||'')}" placeholder="مثال: نموذج طلب إجازة"></div>
            <div class="fd-form-group"><label><span class="required-star">*</span> الملكية</label><select class="form-select" id="fdFOwnership"><option value="عام" ${ow==='عام'?'selected':''}>عام</option><option value="خاص" ${ow==='خاص'?'selected':''}>خاص</option></select></div>
        </div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label>محاذاة عنوان النموذج في المعاينة</label><select class="form-select" id="fdFTitleAlign"><option value="right" ${alR}>يمين</option><option value="center" ${alC}>وسط</option><option value="left" ${alL}>يسار</option></select></div>
            <div class="fd-form-group"><label style="margin-bottom:6px;"></label><div class="form-check" style="padding-top:10px;"><input class="form-check-input" type="checkbox" id="fdFTitleBold" ${ta.bold?'checked':''}><label class="form-check-label small" for="fdFTitleBold">غامق</label></div></div>
            <div class="fd-form-group"><label>حجم خط العنوان (بكسل)</label><input type="number" class="form-control" id="fdFTitleFontPx" min="10" max="48" step="1" value="${Number(ta.fontSizePx)}"></div>
        </div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label>لون عنوان النموذج</label><div class="fd-color-picker-wrap"><input type="color" id="fdFTitleColor" value="${esc(ta.color)}" oninput="document.getElementById('fdFTitleColorHex').textContent=this.value"><div class="fd-color-hex" id="fdFTitleColorHex">${esc(ta.color)}</div></div></div>
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
            <div class="fd-form-group"><label>القالب المستخدم <span style="font-weight:400;color:var(--gray-500);font-size:12px;"></span></label><select class="form-select" id="fdFTpl"><option value="">— بدون قالب —</option>${tpl}</select></div>
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
                        <th style="width:36px;text-align:center;"></th>
                        <th style="width:60px;text-align:center;">الترتيب</th>
                        <th>نوع الحقل</th>
                        <th>اسم الحقل</th>
                        <th style="width:70px;text-align:center;">إجباري</th>
                        <th style="width:90px;text-align:center;">للقراءة فقط</th>
                        <th>القسم</th>
                        <th>طريقة العرض</th>
                        <th style="width:100px;text-align:center;">الإجراءات</th>
                    </tr>
                </thead>
                <tbody id="fdFieldsBody">
                    <tr><td colspan="9" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>
                </tbody>
            </table>
        </div>

        <!-- Add/Edit field form -->
        <div style="background:var(--gray-50);border:2px dashed var(--gray-200);border-radius:10px;padding:16px;">
            <div style="font-size:13px;font-weight:700;color:var(--sa-700);margin-bottom:12px;display:flex;align-items:center;gap:6px;">
                <i class="bi bi-plus-circle-fill" style="color:var(--sa-500);"></i>
                <span id="fdFieldFormLabel">إضافة حقل رقم</span> <span id="fdFieldNum" style="color:var(--sa-600);">1</span>
                <span id="fdPropsCell" style="color:var(--sa-500);font-weight:600;font-size:11px;margin-inline-start:auto;"></span>
            </div>
            <div class="row g-3 mb-2 align-items-end">
                <div class="col-md-4">
                    <label class="small fw-bold text-muted">نوع الحقل <span class="required-star">*</span></label>
                    <select class="form-select form-select-sm" id="fdFieldType" onchange="fdOnFieldTypeChange()">
                        <option value="">-- اختر النوع --</option>${typeOpts}
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted" id="fdFieldNameLabel">اسم الحقل <span class="required-star">*</span></label>
                    <input type="text" class="form-control form-control-sm" id="fdFieldName" placeholder="اسم الحقل">
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted">القسم <span class="required-star">*</span></label>
                    <select class="form-select form-select-sm" id="fdFieldSection">${sectionOpts}</select>
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted">إجباري</label>
                    <select class="form-select form-select-sm" id="fdFieldRequired">
                        <option value="1">نعم</option>
                        <option value="0">لا</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted">طريقة العرض</label>
                    <select class="form-select form-select-sm" id="fdFieldDisplayLayout">
                        <option value="">اختر</option>
                        <option value="يمتد عبر كامل الصف (واحد من واحد)">يمتد عبر كامل الصف (واحد من واحد)</option>
                        <option value="يمتد عبر نصف الصف (واحد من اثنين)">يمتد عبر نصف الصف (واحد من اثنين)</option>
                        <option value="يمتد عبر ثلاثة أرباع الصف (ثلاثة من أربعة)">يمتد عبر ثلاثة أرباع الصف (ثلاثة من أربعة)</option>
                        <option value="يمتد عبر ربع الصف (واحد من أربعة)">يمتد عبر ربع الصف (واحد من أربعة)</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="small fw-bold text-muted">نص التلميح</label>
                    <input type="text" class="form-control form-control-sm" id="fdFieldTooltip" placeholder="يظهر عند تمرير الماوس على الحقل والعنوان" title="يُحفظ مع الحقل ويُعرض كتلميح عند مرور المؤشر على العنوان أو منطقة الإدخال">
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

/** مظهر عنوان النموذج داخل المعاينة / التعبئة / الطباعة (محفوظ في fieldsJson → meta.titleAppearance). */
function fdDefaultTitleAppearance() {
    return { align: 'right', bold: true, fontSizePx: 17, color: '#111827' };
}

function fdNormalizeTitleAppearance(raw) {
    const d = fdDefaultTitleAppearance();
    if (!raw || typeof raw !== 'object') return d;
    const al0 = raw.align != null ? String(raw.align).trim() : '';
    if (al0 === 'يمين' || String(al0).toLowerCase() === 'right') d.align = 'right';
    else if (al0 === 'وسط' || String(al0).toLowerCase() === 'center') d.align = 'center';
    else if (al0 === 'يسار' || String(al0).toLowerCase() === 'left') d.align = 'left';
    else if (['right', 'center', 'left'].includes(String(al0).toLowerCase())) d.align = String(al0).toLowerCase();
    if (typeof raw.bold === 'boolean') d.bold = raw.bold;
    else if (raw.bold === false || raw.bold === 'false' || raw.bold === '0' || raw.bold === 0) d.bold = false;
    else if (raw.bold === true || raw.bold === 'true' || raw.bold === '1' || raw.bold === 1) d.bold = true;
    let px = parseInt(raw.fontSizePx, 10);
    if (!Number.isFinite(px)) px = d.fontSizePx;
    d.fontSizePx = Math.min(48, Math.max(10, px));
    const c0 = String(raw.color || '').trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(c0) || /^#[0-9A-Fa-f]{3}$/.test(c0)) d.color = c0;
    return d;
}

/** عند عرض نموذج محفوظ: تُستمد إعدادات العلامة المائية من القالب المرتبط فقط (GetTemplateForPreview). إن لم يضع القالب علامة — يُرجَع tplBase دون تعديل. */
async function fdEnrichTemplateDataWatermark(tplBase, templateId) {
    const tid = parseInt(String(templateId || ''), 10) || 0;
    if (tid <= 0) return tplBase || null;
    if (!tplBase || typeof tplBase !== 'object') return tplBase || null;
    try {
        const res = await apiFetch(`/FormDefinitions/GetTemplateForPreview?id=${tid}`);
        if (!res?.success || !res.data) return tplBase;
        const full = res.data;
        const u = fdTplWatermarkUrl(full);
        if (!u) return tplBase;
        const base = { ...tplBase };
        const wmKeys = ['WatermarkUrl', 'WatermarkOpacity', 'WatermarkSize', 'WatermarkPosition', 'WatermarkRepeat',
            'watermarkUrl', 'watermarkOpacity', 'watermarkSize', 'watermarkPosition', 'watermarkRepeat'];
        wmKeys.forEach(k => {
            if (full[k] != null && full[k] !== '') base[k] = full[k];
        });
        if (!fdTplWatermarkUrl(base)) {
            base.WatermarkUrl = full.WatermarkUrl ?? full.watermarkUrl ?? u;
        }
        return base;
    } catch (_) {
        return tplBase;
    }
}

/** عتامة العلامة المائية (0–1 أو 0–100) كما في إدارة القوالب */
function fdTplWatermarkOpacity(raw) {
    if (raw === null || raw === undefined || raw === '') return 0.14;
    let n = Number(raw);
    if (Number.isNaN(n)) return 0.14;
    if (n > 1) n /= 100;
    return Math.min(1, Math.max(0.02, n));
}

/** صفوف الرأس/التذييل من JSON أو من HeaderSections/FooterSections (تسلسل API) */
function fdTplHeaderFooterArrays(tpl) {
    if (!tpl) return { hd: [], fd: [] };
    let hd = [], fd = [];
    try { hd = JSON.parse(tpl.headerJson || tpl.HeaderJson || '[]'); } catch (e) { hd = []; }
    try { fd = JSON.parse(tpl.footerJson || tpl.FooterJson || '[]'); } catch (e) { fd = []; }
    const hs = tpl.headerSections || tpl.HeaderSections;
    const fs = tpl.footerSections || tpl.FooterSections;
    if ((!hd || !hd.length) && Array.isArray(hs)) hd = hs;
    if ((!fd || !fd.length) && Array.isArray(fs)) fd = fs;
    return { hd: hd || [], fd: fd || [] };
}

function fdTplWatermarkUrl(tpl) {
    if (!tpl) return '';
    const u = tpl.watermarkUrl ?? tpl.WatermarkUrl ?? '';
    return String(u).trim();
}

function fdTplWatermarkSizeCss(tpl) {
    const s = tpl?.watermarkSize ?? tpl?.WatermarkSize;
    if (s == null || String(s).trim() === '') return '55% auto';
    return String(s).trim();
}

function fdTplWatermarkPositionCss(tpl) {
    const p = tpl?.watermarkPosition ?? tpl?.WatermarkPosition;
    if (p == null || String(p).trim() === '') return 'center';
    return String(p).trim();
}

function fdTplWatermarkRepeatCss(tpl) {
    const r0 = tpl?.watermarkRepeat ?? tpl?.WatermarkRepeat ?? tpl?.WatermarkTile;
    const r = r0 != null ? String(r0).trim().toLowerCase() : '';
    const allowed = new Set(['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round']);
    if (allowed.has(r)) return r;
    if (r === 'true' || r === '1' || r === 'yes' || r === 'تكرار') return 'repeat';
    return 'no-repeat';
}

/** قيمة background-image (url(...)) آمنة داخل خاصية style="..." — لا نستخدم JSON.stringify على المسار لأن الاقتباسات المزدوجة تُقطع عند أول " وتُلغى الصورة. */
function fdCssBgImageUrl(raw) {
    const u = String(raw || '').trim();
    if (!u) return '';
    if (/^[a-zA-Z0-9_\-/.:?#=&+%]+$/.test(u)) return `url(${u})`;
    const esc = u.replace(/\\/g, '/').replace(/'/g, '%27');
    return `url('${esc}')`;
}

/** طبقة علامة مائية داخل جسم الصفحة — تُحترَم خصائص القالب ومطابقة الطباعة. */
function fdBuildWatermarkLayerHtml(tpl) {
    const wmUrl = fdTplWatermarkUrl(tpl);
    if (!wmUrl) return '';
    const wmOp = fdTplWatermarkOpacity(tpl?.watermarkOpacity ?? tpl?.WatermarkOpacity);
    const wmSize = fdTplWatermarkSizeCss(tpl);
    const wmPos = fdTplWatermarkPositionCss(tpl);
    const wmRep = fdTplWatermarkRepeatCss(tpl);
    const bgUrl = fdCssBgImageUrl(wmUrl);
    if (!bgUrl) return '';
    return `<div class="fd-form-wm-layer" aria-hidden="true" style="pointer-events:none;position:absolute;inset:0;background-image:${bgUrl};background-repeat:${wmRep};background-position:${wmPos};background-size:${wmSize};opacity:${wmOp};z-index:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;
}

function fdTplZoneBackgroundStyle(tpl, zone) {
    const isHeader = zone === 'header';
    const color = String(isHeader
        ? (tpl?.headerBackgroundColor ?? tpl?.HeaderBackgroundColor ?? '')
        : (tpl?.footerBackgroundColor ?? tpl?.FooterBackgroundColor ?? '')).trim();
    const img = String(isHeader
        ? (tpl?.headerBackgroundImageUrl ?? tpl?.HeaderBackgroundImageUrl ?? '')
        : (tpl?.footerBackgroundImageUrl ?? tpl?.FooterBackgroundImageUrl ?? '')).trim();
    const defaultBg = isHeader ? '#fff' : 'transparent';
    const styles = [];
    if (img) {
        const bgUrl = fdCssBgImageUrl(img);
        if (bgUrl) {
            styles.push(`background-image:${bgUrl}`);
            styles.push('background-size:cover');
            styles.push('background-position:center');
            styles.push('background-repeat:no-repeat');
        }
    }
    if (color) styles.push(`background-color:${color}`);
    else if (!img) styles.push(`background-color:${defaultBg}`);
    return styles.join(';');
}

// ─── SHARED FORM PREVIEW BUILDER ─────────────────────────────────────────────
// Renders Header + Body (fields) + Footer from a real saved template object.
// tplData   – object with headerJson/footerJson/color/margins (or null = fallback)
// formName  – string
// formDesc  – string
// fields    – array of field objects
// interactive – true → render editable inputs (step-3), false → read-only display (details)
// titleAppearanceOpt – { align:'right'|'center'|'left', bold:boolean, fontSizePx:number, color:string } من meta.titleAppearance
function fdBuildFormPreview(tplData, formName, formDesc, fields, interactive, sectionsOverride, titleAppearanceOpt) {

    const sections = (sectionsOverride && sectionsOverride.length) ? sectionsOverride : fdDefaultSections();
    fields = fdSortFieldsList(fields, sections);
    const hasTpl = !!tplData;
    const ta = fdNormalizeTitleAppearance(titleAppearanceOpt || fdDefaultTitleAppearance());
    const tAlign = ta.align === 'center' ? 'center' : (ta.align === 'left' ? 'left' : 'right');
    const tWeight = ta.bold ? '800' : '400';
    const tSizePx = `${ta.fontSizePx}px`;
    const tColor = ta.color || '#111827';
    const titleIntroHtml =
        `<div style="margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--gray-200);font-style:normal;text-align:${tAlign};">` +
            `<h5 style="font-size:${tSizePx};font-weight:${tWeight};color:${tColor};margin:0 0 4px;font-style:normal;text-align:${tAlign};">${esc(formName)}</h5>` +
            (formDesc ? `<p style="font-size:13px;color:var(--gray-500);margin:0;font-style:normal;text-align:${tAlign};">${esc(formDesc)}</p>` : '') +
        `</div>`;

    // ── fields HTML ──────────────────────────────────────────────────────────
    const renderField = f => {
        const isStructural = f.fieldType === 'عنوان' || f.fieldType === 'خط فاصل'
            || f.fieldType === 'فاصل صفحات' || f.fieldType === 'صورة عرض';
        const colClass = fdDisplayLayoutColClass(f.displayLayout);
        let _tipPo = {}; try { _tipPo = JSON.parse(f.propertiesJson || '{}'); } catch (e) {}
        const tipMerged = String((f.tooltipText != null && f.tooltipText !== '') ? f.tooltipText : (_tipPo.tooltipText || '')).trim();
        const tipAttr   = tipMerged ? ` title="${fdEscAttr(tipMerged)}"` : '';
        const infoIcon  = tipMerged ? `<i class="bi bi-info-circle ms-1" style="font-size:11px;color:${hasTpl ? 'var(--gray-400)' : 'var(--sa-400)'};"${tipAttr}></i>` : '';
        const subName   = f.subName ? `<small style="display:block;color:var(--gray-400);font-size:11px;margin-top:6px;font-style:normal;">${esc(f.subName)}</small>` : '';
        const inputHtml = interactive
            ? fdBuildFieldInput(f, f.isReadOnly ? { forceReadOnly: true } : undefined)
            : fdBuildFieldInput(f, { forceReadOnly: true });
        let renderedInput = inputHtml;
        if (!isStructural && interactive && !f.isReadOnly && fdIvUsesInlineValidation(f)) {
            renderedInput = `<div class="fd-iv-wrap" data-fd-iv="1" data-fd-ft="${fdEscAttr(f.fieldType)}" data-fd-props="${fdEscAttr(f.propertiesJson || '{}')}"><div class="fd-iv-slot">${inputHtml}</div><p class="fd-iv-msg small text-danger mt-1 mb-0" style="display:none;" aria-live="polite"></p></div>`;
        }
        if (isStructural) {
            return `<div class="${colClass}" style="font-style:normal;">${inputHtml}</div>`;
        }
        return `<div class="${colClass}" style="font-style:normal;">
            <label style="font-size:13px;font-weight:700;color:var(--gray-700);display:block;margin-bottom:4px;font-style:normal;"${tipAttr}>
                ${esc(f.fieldName)}${f.isRequired ? '<span style="color:#ef4444;margin-right:4px;">*</span>' : ''}${infoIcon}
            </label>
            ${renderedInput}
            ${subName}
        </div>`;
    };

    /** يُقسّم تسلسل الأقسام/الحقول إلى صفحات بناءً على حقول «فاصل صفحات». */
    function fdBuildPages(allFields, allSections) {
        const pages = [];
        let cur = { label: '', sectionsMap: new Map() };
        const orderedSections = allSections.slice();
        // اقرأ الحقول ضمن ترتيب الأقسام
        const fieldsBySection = new Map();
        orderedSections.forEach(sec => fieldsBySection.set(sec.id, []));
        allFields.forEach(f => {
            const sid = f.sectionId || (orderedSections[0] ? orderedSections[0].id : 1);
            if (!fieldsBySection.has(sid)) fieldsBySection.set(sid, []);
            fieldsBySection.get(sid).push(f);
        });
        for (const sec of orderedSections) {
            const items = fieldsBySection.get(sec.id) || [];
            for (const f of items) {
                if (f.fieldType === 'فاصل صفحات') {
                    pages.push(cur);
                    let nextLabel = '';
                    try { const _p = JSON.parse(f.propertiesJson || '{}'); nextLabel = String(_p.pageLabel || '').trim(); } catch (_) {}
                    cur = { label: nextLabel, sectionsMap: new Map() };
                    continue;
                }
                if (!cur.sectionsMap.has(sec.id)) cur.sectionsMap.set(sec.id, []);
                cur.sectionsMap.get(sec.id).push(f);
            }
        }
        pages.push(cur);
        return pages;
    }

    function fdRenderPageContent(pageObj, idx, totalPages) {
        const showSectionTitles = sections.length > 1;
        const sectionsHtml = sections.map(sec => {
            const items = pageObj.sectionsMap.get(sec.id) || [];
            if (!items.length && !showSectionTitles) return '';
            const secRibbon = hasTpl
                ? 'margin:12px 0 8px;padding:8px 12px;background:var(--gray-50);border-inline-start:4px solid var(--gray-300);border-radius:8px;font-weight:800;font-size:14px;color:var(--gray-800);font-style:normal;'
                : 'margin:12px 0 8px;padding:8px 12px;background:var(--sa-50);border-inline-start:4px solid var(--sa-500);border-radius:8px;font-weight:800;font-size:14px;color:var(--sa-800);font-style:normal;';
            const head = showSectionTitles ? `<div style="${secRibbon}">${esc(sec.title)}</div>` : '';
            if (!items.length) return head + `<div class="text-center py-2" style="color:var(--gray-300);font-size:12px;font-style:normal;">لا توجد حقول في هذا القسم</div>`;
            return head + '<div class="row g-3">' + items.map(renderField).join('') + '</div>';
        }).join('');
        const labelHtml = pageObj.label
            ? `<div style="font-size:12.5px;font-weight:700;color:var(--info-700);background:var(--info-50);padding:4px 12px;border-radius:999px;display:inline-block;margin-bottom:8px;">${esc(pageObj.label)}</div>`
            : '';
        return `<div class="fd-form-page" data-fd-page-idx="${idx}" data-fd-page-total="${totalPages}" style="${idx === 0 ? '' : 'display:none;'}">${labelHtml}${sectionsHtml}</div>`;
    }

    let fieldsHtml = '';
    if (!fields.length) {
        fieldsHtml = `<div class="text-center py-4" style="color:var(--gray-400);font-style:normal;">
            <i class="bi bi-inbox" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);"></i>
            لم تُضف حقول بعد
        </div>`;
    } else {
        const pages = fdBuildPages(fields, sections);
        if (pages.length <= 1) {
            // مسار غير مُجزَّأ — يحافظ على السلوك القديم
            const showSectionTitles = sections.length > 1;
            fieldsHtml = sections.map(sec => {
                const items = fields.filter(f => (f.sectionId || sections[0].id) === sec.id);
                if (!items.length && !showSectionTitles) return '';
                const secRibbon = hasTpl
                    ? 'margin:12px 0 8px;padding:8px 12px;background:var(--gray-50);border-inline-start:4px solid var(--gray-300);border-radius:8px;font-weight:800;font-size:14px;color:var(--gray-800);font-style:normal;'
                    : 'margin:12px 0 8px;padding:8px 12px;background:var(--sa-50);border-inline-start:4px solid var(--sa-500);border-radius:8px;font-weight:800;font-size:14px;color:var(--sa-800);font-style:normal;';
                const head = showSectionTitles
                    ? `<div style="${secRibbon}">${esc(sec.title)}</div>`
                    : '';
                if (!items.length) return head + `<div class="text-center py-2" style="color:var(--gray-300);font-size:12px;font-style:normal;">لا توجد حقول في هذا القسم</div>`;
                return head + '<div class="row g-3">' + items.map(renderField).join('') + '</div>';
            }).join('');
        } else {
            const pagesHtml = pages.map((p, i) => fdRenderPageContent(p, i, pages.length)).join('');
            const indicatorHtml = pages.map((_, i) =>
                `<span class="fd-page-dot" data-fd-page-dot="${i}" style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${i === 0 ? 'var(--sa-600,#047857)' : 'var(--gray-300,#d1d5db)'};transition:background-color .15s ease;"></span>`
            ).join('');
            fieldsHtml = `<div class="fd-form-pager" data-fd-pager="1" data-fd-page-current="0" data-fd-page-count="${pages.length}">
                <div class="fd-form-pages">${pagesHtml}</div>
                <div class="fd-page-nav" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px;padding-top:14px;border-top:1px dashed var(--gray-200);">
                    <button type="button" class="btn btn-outline-secondary btn-sm fd-page-prev" onclick="fdPagerNav(this,-1)" disabled><i class="bi bi-chevron-right" aria-hidden="true"></i> السابق</button>
                    <div class="fd-page-info d-flex align-items-center gap-2" style="font-size:12px;color:var(--gray-500);font-weight:600;">
                        <span class="fd-page-dots d-flex align-items-center gap-1">${indicatorHtml}</span>
                        <span class="fd-page-label">صفحة <span class="fd-page-num">1</span> من ${pages.length}</span>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm fd-page-next" onclick="fdPagerNav(this,1)">التالي <i class="bi bi-chevron-left" aria-hidden="true"></i></button>
                </div>
            </div>`;
        }
    }

    // ── المسار بلا قالب: حاوية بسيطة فقط (بدون رأس/تذييل/خطوط/إطار قالب وهمي) ──
    if (!hasTpl) {
        return `<div style="background:#fff;padding:24px;direction:rtl;font-style:normal;">${titleIntroHtml}${fieldsHtml}</div>`;
    }

    // ── template layout (مطابقة إدارة القوالب: لا نفرض لون العلامة على الخط الفاصل، ولا خلفية للتذييل، ونُظهر العلامة المائية) ──
    // عند الوصول هنا، يوجد قالب فعليًا (تم التعامل مع حالة «بدون قالب» أعلاه بإرجاع مبكر).
    const tpl      = tplData;
    const pageDir  = String(tpl.pageDirection || tpl.PageDirection || 'RTL').toLowerCase();
    const mt = tpl.marginTop    ?? tpl.MarginTop    ?? 24;
    const mb = tpl.marginBottom ?? tpl.MarginBottom ?? 24;
    const mr = tpl.marginRight  ?? tpl.MarginRight  ?? 24;
    const ml = tpl.marginLeft   ?? tpl.MarginLeft   ?? 24;
    /** لون خط الرأس/الفاصل كما في شاشة القوالب — رمادي محايد، وليس لون العلامة (color). */
    const headerDividerCss = 'var(--gray-200)';
    const { hd, fd } = fdTplHeaderFooterArrays(tpl);
    const tplName = tpl.name || tpl.Name || '';
    const showHeadLine = !!(tpl.showHeaderLine ?? tpl.ShowHeaderLine);
    const showFootLine = !!(tpl.showFooterLine ?? tpl.ShowFooterLine);
    const wmLayer = fdBuildWatermarkLayerHtml(tpl);
    const headerBgStyle = fdTplZoneBackgroundStyle(tpl, 'header');
    const footerBgStyle = fdTplZoneBackgroundStyle(tpl, 'footer');

    const headerHtml = hd.length
        ? `<div style="display:grid;grid-template-columns:repeat(${hd.length},1fr);min-height:52px;align-items:center;padding:10px ${mr}px;${headerBgStyle};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${hd.map(s => fdRenderTemplateSection(s)).join('')}</div>`
        : `<div style="padding:12px ${mr}px;${headerBgStyle};color:var(--gray-300);font-size:12px;text-align:center;font-style:normal;-webkit-print-color-adjust:exact;print-color-adjust:exact;"><i class="bi bi-layout-text-window-reverse" style="font-size:18px;display:block;margin-bottom:3px;"></i>${esc(tplName)}</div>`;

    const headerLineHtml = showHeadLine ? `<div style="height:2px;background:${headerDividerCss};"></div>` : '';
    const footerLineHtml = showFootLine ? `<div style="height:1px;background:${headerDividerCss};"></div>` : '';

    const footerHtml = fd.length
        ? `<div style="display:grid;grid-template-columns:repeat(${fd.length},1fr);min-height:40px;align-items:center;padding:8px ${mr}px;${footerBgStyle};-webkit-print-color-adjust:exact;print-color-adjust:exact;">${fd.map(s => fdRenderTemplateSection(s)).join('')}</div>`
        : `<div style="padding:10px ${mr}px;${footerBgStyle};color:var(--gray-300);font-size:11px;text-align:center;font-style:normal;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(tplName)}</div>`;

    return `<div style="border:1px solid var(--gray-200);border-radius:12px;overflow:hidden;font-style:normal;direction:rtl;background:#fff;">
        ${headerHtml}${headerLineHtml}
        <div style="background:#fff;padding:${mt}px ${mr}px ${mb}px ${ml}px;direction:${pageDir};font-style:normal;position:relative;overflow:hidden;">
            ${wmLayer}
            <div style="position:relative;z-index:1;font-style:normal;">
            ${titleIntroHtml}
            ${fieldsHtml}
            </div>
        </div>
        ${footerLineHtml}${footerHtml}
    </div>`;
}

// ─── STEP 3 HTML (preview) — uses shared helper ───────────────────────────────
function fdStep4Html() {
    const fName = (fdStep1State?.name || '').trim() || 'اسم النموذج';
    const fDesc = (fdStep1State?.desc || '').trim() || '';
    const ta = fdStep1State && fdStep1State.titleAppearance
        ? fdNormalizeTitleAppearance(fdStep1State.titleAppearance)
        : fdDefaultTitleAppearance();
    return fdBuildFormPreview(fdCurrentTemplate, fName, fDesc, fdFields, true, fdSections, ta);
}

// ─── STEP 3 — CONDITIONAL LOGIC ──────────────────────────────────────────────
function fdStep3Html() {
    return `
    <div class="fd-section" style="margin-bottom:0;">
        <div class="fd-section-title" style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><span><i class="bi bi-diagram-3-fill"></i> المنطق الشرطي </span>
            
            <button type="button" class="btn btn-sm btn-primary" onclick="fdAddRule()" style="border-radius:8px;font-size:12px;font-weight:700;">
                <i class="bi bi-plus-lg"></i> إضافة قاعدة
            </button>
        </div>
        <div id="fdRulesList"></div>
    </div>`;
}

function fdAddRule() {
    if (!fdFields.length && !fdSections.length) {
        showToast('أضف حقولاً أو أقساماً أولاً قبل إضافة قواعد المنطق الشرطي', 'error');
        return;
    }
    const sourceRef = fdFields[0] ? `field:${fdFields[0].id}` : (fdSections[0] ? `section:${fdSections[0].id}` : '');
    const sourceParsed = fdParseRuleRef(sourceRef);
    const targetParsedFallback = fdRuleFirstRefExcluding(sourceParsed, fdFields, fdSections);
    const targetRef = fdSerializeRuleRef(targetParsedFallback) || sourceRef;
    const rule = {
        id: fdRuleSeq++,
        isEnabled: true,
        sourceRef,
        operator: FD_RULE_OPERATORS[0],
        value: '',
        action: FD_RULE_ACTIONS[0],
        targetRef
    };
    fdConditionalRules.push(rule);
    fdRenderRules();
}

function fdDeleteRule(id) {
    fdConditionalRules = fdConditionalRules.filter(r => r.id !== id);
    fdRenderRules();
}

function fdRuleFieldName(fid) {
    const f = fdFields.find(x => x.id === fid);
    return f ? f.fieldName : '';
}

function fdUpdateRule(id, patch) {
    const r = fdConditionalRules.find(x => x.id === id);
    if (!r) return;
    Object.assign(r, patch);
    if (FD_RULE_NO_VALUE.has(r.operator)) r.value = '';
    // عند تغيير المصدر: إذا تطابق مع الهدف نختار أول مرجع مختلف للهدف
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'sourceRef')) {
        const src = fdParseRuleRef(r.sourceRef);
        const tgt = fdParseRuleRef(r.targetRef);
        if (src && tgt && fdRuleRefEqual(src, tgt)) {
            const alt = fdRuleFirstRefExcluding(src, fdFields, fdSections);
            if (alt) r.targetRef = fdSerializeRuleRef(alt);
        }
    }
    fdRenderRules();
}

function fdRenderRules() {
    const host = document.getElementById('fdRulesList');
    if (!host) return;
    if (!fdConditionalRules.length) {
        host.innerHTML = `<div class="fd-empty-fields" style="padding:32px 16px;"><i class="bi bi-diagram-3"></i></div>`;
        return;
    }
    host.innerHTML = fdConditionalRules.map((r, idx) => fdRuleCardHtml(r, idx + 1)).join('');
}

/** خيارات موحَّدة: الأقسام أولاً ثم الحقول، مع إمكانية استبعاد مرجع معيّن (لتفادي اختيار نفس العنصر في الجهتين). */
function fdRuleBuildUnifiedOptions(selectedRef, excludeRef) {
    let html = '';
    if (fdSections.length) {
        html += '<optgroup label="الأقسام">';
        fdSections.forEach(s => {
            const ref = `section:${s.id}`;
            if (excludeRef && ref === excludeRef) return;
            const sel = ref === selectedRef ? ' selected' : '';
            html += `<option value="${ref}"${sel}> ${esc(s.title || ('القسم ' + s.id))}</option>`;
        });
        html += '</optgroup>';
    }
    if (fdFields.length) {
        html += '<optgroup label="الحقول">';
        fdFields.forEach(f => {
            // فاصل الصفحات وصورة العرض هياكل عرض فقط — لا تظهر في المنطق الشرطي
            if (f.fieldType === 'فاصل صفحات' || f.fieldType === 'صورة عرض' || f.fieldType === 'خط فاصل' || f.fieldType === 'عنوان') return;
            const ref = `field:${f.id}`;
            if (excludeRef && ref === excludeRef) return;
            const sel = ref === selectedRef ? ' selected' : '';
            const typeBadge = f.fieldType ? ` [${f.fieldType}]` : '';
            html += `<option value="${ref}"${sel}>${esc(f.fieldName || ('حقل ' + f.id))}${esc(typeBadge)}</option>`;
        });
        html += '</optgroup>';
    }
    return html || '<option value="">— لا توجد عناصر —</option>';
}

function fdRuleCardHtml(r, n) {
    const opOpts = FD_RULE_OPERATORS.map(op => `<option value="${esc(op)}" ${op === r.operator ? 'selected' : ''}>${esc(op)}</option>`).join('');
    const actOpts = FD_RULE_ACTIONS.map(a => `<option value="${esc(a)}" ${a === r.action ? 'selected' : ''}>${esc(a)}</option>`).join('');
    const sourceOpts = fdRuleBuildUnifiedOptions(r.sourceRef || '', null);
    const targetOpts = fdRuleBuildUnifiedOptions(r.targetRef || '', r.sourceRef || '');
    const valDisabled = FD_RULE_NO_VALUE.has(r.operator);
    return `<div class="fd-rule-card" style="background:#fff;border:1.5px solid var(--gray-200);border-radius:12px;padding:16px 18px 14px;margin-top:14px;position:relative;">
        <div class="d-flex align-items-center justify-content-between" style="margin-bottom:14px;border-bottom:1px solid var(--gray-100);padding-bottom:10px;">
            <div style="font-weight:800;color:var(--sa-700);font-size:13.5px;display:flex;align-items:center;gap:8px;">
                <span style="background:var(--sa-50);color:var(--sa-700);min-width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;">${n}</span>
                القاعدة رقم ${n}
            </div>
            <div class="d-flex align-items-center gap-3">
                <label class="fd-toggle" title="${r.isEnabled ? 'الحالة: مفعّلة' : 'الحالة: معطّلة'}" style="margin:0;">
                    <input type="checkbox" ${r.isEnabled ? 'checked' : ''} onchange="fdUpdateRule(${r.id}, { isEnabled: this.checked })">
                    <span class="fd-slider"></span>
                </label>
                <button type="button" class="btn btn-sm btn-outline-danger" title="حذف القاعدة" onclick="fdDeleteRule(${r.id})" style="padding:4px 10px;border-radius:8px;">
                    <i class="bi bi-trash3"></i>
                </button>
            </div>
        </div>
        <div class="row g-2">
            <div class="col-md-4">
                <label class="small fw-bold text-muted">الحقل / القسم <span class="required-star">*</span></label>
                <select class="form-select form-select-sm" onchange="fdUpdateRule(${r.id}, { sourceRef: this.value })">${sourceOpts}</select>
            </div>
            <div class="col-md-4">
                <label class="small fw-bold text-muted">الشرط <span class="required-star">*</span></label>
                <select class="form-select form-select-sm" onchange="fdUpdateRule(${r.id}, { operator: this.value })">${opOpts}</select>
            </div>
            <div class="col-md-4">
                <label class="small fw-bold text-muted">القيمة</label>
                <input type="text" class="form-control form-control-sm" value="${fdEscAttr(r.value || '')}" placeholder="${valDisabled ? 'لا يحتاج قيمة' : 'أدخل القيمة'}" ${valDisabled ? 'disabled' : ''} oninput="fdUpdateRuleValue(${r.id}, this.value)">
            </div>
            <div class="col-md-6">
                <label class="small fw-bold text-muted">الإجراء <span class="required-star">*</span></label>
                <select class="form-select form-select-sm" onchange="fdUpdateRule(${r.id}, { action: this.value })">${actOpts}</select>
            </div>
            <div class="col-md-6">
                <label class="small fw-bold text-muted">الحقل / القسم <span class="required-star">*</span></label>
                <select class="form-select form-select-sm" onchange="fdUpdateRule(${r.id}, { targetRef: this.value })">${targetOpts}</select>
            </div>
        </div>
    </div>`;
}

function fdUpdateRuleValue(id, v) {
    const r = fdConditionalRules.find(x => x.id === id);
    if (!r) return;
    r.value = v;
}

// ─── STEP NAVIGATION ─────────────────────────────────────────────────────────
async function fdGoStep2() {
    const s = fdCollect1();
    if (!s.name) return showToast('اسم النموذج مطلوب','error');
    if (!s.formClassId) return showToast('أصناف النماذج مطلوبة','error');
    if (!s.typeId) return showToast('نوع النموذج مطلوب','error');
    if (!s.wsId) return showToast('مساحة العمل مطلوبة','error');
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

function fdGoStep3() {
    if (!fdFields.length) return showToast('أضف حقلًا واحدًا على الأقل قبل المتابعة', 'error');
    fdSyncRulesAfterFieldChanges();
    fdStep = 3;
    fdRenderStep();
}

function fdSyncRulesAfterFieldChanges() {
    const fieldIds = new Set(fdFields.map(f => f.id));
    const sectionIds = new Set(fdSections.map(s => s.id));
    fdConditionalRules.forEach(r => {
        // التحقق من صلاحية المرجع المصدر؛ إذا أُزيل العنصر نختار أول حقل ثم أول قسم
        let src = fdParseRuleRef(r.sourceRef);
        if (!src || !fdRuleRefIsValid(src, fieldIds, sectionIds)) {
            const fb = fdFields[0]
                ? { kind: 'field', id: fdFields[0].id }
                : (fdSections[0] ? { kind: 'section', id: fdSections[0].id } : null);
            r.sourceRef = fdSerializeRuleRef(fb);
            src = fb;
        }
        let tgt = fdParseRuleRef(r.targetRef);
        if (!tgt || !fdRuleRefIsValid(tgt, fieldIds, sectionIds) || (src && fdRuleRefEqual(src, tgt))) {
            const alt = fdRuleFirstRefExcluding(src, fdFields, fdSections);
            r.targetRef = fdSerializeRuleRef(alt);
        }
    });
}

async function fdGoStep4() {
    const tplId = parseInt(fdStep1State?.tplId || '0');
    if (tplId > 0) {
        try {
            const res = await apiFetch(`/FormDefinitions/GetTemplateForPreview?id=${tplId}`);
            if (res && res.success) fdCurrentTemplate = res.data;
        } catch {}
    } else {
        if (!fdEditId && !fdVersionMode) fdCurrentTemplate = null;
    }
    // ملاحظة: في وضع الإصدار يكون القالب محمّلاً مسبقاً قبل فتح المعالج، فلا يُمسح إن لم نعِد جلبه.
    await fdPrefetchBindingCachesForFields();
    fdStep = 4;
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
    let html = '';
    def.props.forEach(p => { html += fdBuildSinglePropHtml(p,'fdProp'); });
    if(cont) cont.innerHTML = html;
    fdApplyPropsSpecialEditors(type,'fdProp',null);
    if (needsBinding) fdWireBindingPropListeners(type);
    if(type==='رقم الهاتف'){
        const el=document.getElementById('fdProp_phoneFormat'); if(el&&!el.value) el.value='+966 (9 أرقام)';
        const ipp=document.getElementById('fdProp_inputPattern'); if(ipp&&!ipp.value) ipp.value='أرقام فقط';
    }
    if(type==='تاريخ'){ const cal=document.getElementById('fdProp_calendarType'); if(cal&&!cal.value) cal.value='ميلادي'; }
    const roCb = document.getElementById('fdProp_readOnly');
    if (roCb) roCb.onchange = fdSyncRequiredDisabledFromReadOnly;
    fdSyncRequiredDisabledFromReadOnly();
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
    fdNormalizeMaxFilesProp(result);
    return fdMergeSpecialProps(type,'fdProp',result);
}

function fdNormalizeMaxFilesProp(result) {
    if (!result || result.maxFiles == null || result.maxFiles === '') return;
    const n = fdParseMaxFilesRaw(result.maxFiles);
    if (n != null) result.maxFiles = n;
    else delete result.maxFiles;
}

function fdSetFieldProps(type, po) {
    if(!type||!FD_FIELD_TYPES[type]) return;
    const def=FD_FIELD_TYPES[type]; po=po||{};
    if (type === 'قائمة منسدلة') {
        const lt = document.getElementById('fdProp_listType');
        if (lt) {
            let saved = po.listType || '';
            if (!saved && po.dropdownListId) {
                const lst = (fdBindingLookups.dropdownLists || []).find(o => (o.id ?? o.Id) === po.dropdownListId);
                saved = lst ? (lst.listType || lst.ListType || 'قائمة مستقلة') : 'قائمة مستقلة';
            }
            if (saved) lt.value = saved;
        }
        fdRefreshDropdownListPicker(parseInt(po.dropdownListId, 10) || 0);
    }
    def.props.forEach(p => {
        if(p.type==='optionList'||p.type==='fileTypesPick') return;
        if(p.type==='dropdownListPick'||p.type==='readyTablePick'){
            const el=document.getElementById(`fdProp_${p.key}`); if(!el) return;
            const v=po[p.key]; if(v!=null&&v!=='') el.value=String(v);
            return;
        }
        if(p.key==='listType') return;
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
    if (type === 'صورة عرض') {
        const draft = fdCollectFieldProps();
        if (!String(draft.imageUrl || '').trim()) return showToast('يرجى إرفاق صورة لحقل صورة العرض', 'error');
    }
    if (type === 'شبكة خيارات متعددة' || type === 'شبكة مربعات اختيار') {
        const rl = document.getElementById('fdProp_rowLabels');
        if (!rl || !String(rl.value || '').trim()) return showToast('يرجى إدخال عناوين الصفوف (سطر لكل صف)', 'error');
    }
    const props = fdCollectFieldProps();
    const secSel = document.getElementById('fdFieldSection');
    const secId = secSel ? (parseInt(secSel.value, 10) || fdActiveSectionId) : fdActiveSectionId;
    const isReadOnly = !!props.readOnly;
    const structuralTypes = new Set(['عنوان', 'خط فاصل', 'فاصل صفحات', 'صورة عرض']);
    const isStructural = structuralTypes.has(type);
    const isRequired = !isReadOnly && !isStructural && document.getElementById('fdFieldRequired')?.value === '1';
    const tooltipText = document.getElementById('fdFieldTooltip')?.value?.trim() || '';
    const field = { id: fdEditingIdx>=0 ? fdFields[fdEditingIdx].id : Date.now(), fieldType:type, fieldName:name, isRequired, isReadOnly, subName:props.subName||'', placeholder:props.placeholder||'', tooltipText, displayLayout:document.getElementById('fdFieldDisplayLayout')?.value?.trim()||'', sortOrder: fdNextFieldSortOrder(secId), sectionId: secId, propertiesJson:JSON.stringify(props) };
    if(fdEditingIdx>=0){ fdFields[fdEditingIdx]=field; showToast('تم تحديث الحقل','success'); fdEditingIdx=-1; }
    else { fdFields.push(field); showToast('تم إضافة الحقل','success'); }
    fdReindexFieldSortOrders();
    fdRenderFieldsTable(); fdResetFieldForm();
}

async function fdEditField(idx) {
    const f=fdFields[idx]; if(!f) return;
    fdEditingIdx=idx;
    document.getElementById('fdFieldType').value=f.fieldType;
    document.getElementById('fdFieldName').value=f.fieldName;
    let po = {};
    try { po = JSON.parse(f.propertiesJson || '{}'); } catch (e) {}
    const ro = !!(f.isReadOnly || po.readOnly);
    if (ro) po.readOnly = true;
    document.getElementById('fdFieldTooltip').value = f.tooltipText || '';
    document.getElementById('fdFieldRequired').value = (!ro && f.isRequired) ? '1' : '0';
    const fdLay = document.getElementById('fdFieldDisplayLayout');
    if (fdLay) fdLay.value = (f.displayLayout != null && f.displayLayout !== '') ? f.displayLayout : '';
    const fdSec = document.getElementById('fdFieldSection');
    if (fdSec) fdSec.value = String(f.sectionId || fdActiveSectionId);
    document.getElementById('fdFieldNum').textContent=String(idx+1);
    document.getElementById('fdFieldFormLabel').textContent='تعديل حقل رقم';
    document.getElementById('fdAddFieldBtnTxt').textContent='تحديث الحقل';
    document.getElementById('fdCancelEditBtn').style.display='';
    await fdOnFieldTypeChange();
    fdSetFieldProps(f.fieldType, po);
    fdSyncRequiredDisabledFromReadOnly();
    if (po.dropdownListId) await fdFetchDropdownItemsForField(po.dropdownListId);
    if (po.readyTableId) await fdFetchReadyTableGridForField(po.readyTableId);
    document.getElementById('fdPropsArea')?.scrollIntoView({behavior:'smooth'});
}

function fdSyncRequiredDisabledFromReadOnly() {
    const ro = !!document.getElementById('fdProp_readOnly')?.checked;
    const reqSel = document.getElementById('fdFieldRequired');
    if (!reqSel) return;
    if (ro) {
        reqSel.value = '0';
        reqSel.disabled = true;
        reqSel.title = 'لا يمكن جعل الحقل إجباري إذا كان للقراءة فقط';
    } else {
        reqSel.disabled = false;
        reqSel.title = '';
    }
}

function fdDeleteField(idx) {
    fdFields.splice(idx,1);
    if(fdEditingIdx===idx) fdResetFieldForm(); else if(fdEditingIdx>idx) fdEditingIdx--;
    fdReindexFieldSortOrders();
    fdRenderFieldsTable(); fdResetFieldForm();
}

function fdReindexFieldSortOrders() {
    fdSections.forEach(sec => {
        const items = fdFields
            .map((f, i) => ({ f, i }))
            .filter(x => (x.f.sectionId || fdSections[0].id) === sec.id)
            .sort((a, b) => {
                const sa = a.f.sortOrder != null ? a.f.sortOrder : a.i;
                const sb = b.f.sortOrder != null ? b.f.sortOrder : b.i;
                return sa - sb;
            });
        items.forEach((x, idx) => { x.f.sortOrder = idx + 1; });
    });
}

function fdSortFieldsList(fields, sections) {
    if (!fields || !fields.length) return fields || [];
    const secOrder = (sections || fdDefaultSections()).map(s => s.id);
    return fields.slice().sort((a, b) => {
        const ai = secOrder.indexOf(a.sectionId || secOrder[0]);
        const bi = secOrder.indexOf(b.sectionId || secOrder[0]);
        const sa = ai >= 0 ? ai : 0;
        const sb = bi >= 0 ? bi : 0;
        if (sa !== sb) return sa - sb;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

function fdNextFieldSortOrder(secId) {
    const sid = secId || fdActiveSectionId || (fdSections[0] ? fdSections[0].id : 1);
    const max = fdFields
        .filter(f => (f.sectionId || fdSections[0].id) === sid)
        .reduce((m, f) => Math.max(m, f.sortOrder || 0), 0);
    return max + 1;
}

function fdUpdateStep2NextBtn() {
    const btn = document.getElementById('fdStep2NextBtn');
    if (!btn) return;
    const ok = fdFields.length > 0;
    btn.disabled = !ok;
    btn.title = ok ? '' : 'أضف حقلًا واحدًا على الأقل';
}

function fdGetFieldsInSectionOrdered(secId) {
    const sid = secId || (fdSections[0] ? fdSections[0].id : 1);
    const fallbackSec = fdSections[0] ? fdSections[0].id : 1;
    return fdFields
        .filter(f => (f.sectionId || fallbackSec) === sid)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function fdApplyFieldOrderInSection(secId, orderedFields) {
    orderedFields.forEach((f, i) => { f.sortOrder = i + 1; });
}

function fdReorderFieldByDrop(fromFieldId, toFieldId, toSectionId) {
    const moved = fdFields.find(f => f.id === fromFieldId);
    if (!moved) return false;

    const fallbackSec = fdSections[0] ? fdSections[0].id : 1;
    const prevSecId = moved.sectionId || fallbackSec;
    const targetSecId = toSectionId != null ? toSectionId : prevSecId;

    if (prevSecId !== targetSecId) {
        const prevList = fdGetFieldsInSectionOrdered(prevSecId).filter(f => f.id !== fromFieldId);
        fdApplyFieldOrderInSection(prevSecId, prevList);
        moved.sectionId = targetSecId;
    }

    const ordered = fdGetFieldsInSectionOrdered(targetSecId);
    const fromPos = ordered.findIndex(f => f.id === fromFieldId);
    let toPos = toFieldId != null ? ordered.findIndex(f => f.id === toFieldId) : ordered.length - 1;
    if (toPos < 0) toPos = Math.max(ordered.length - 1, 0);

    const list = ordered.slice();
    if (fromPos >= 0) list.splice(fromPos, 1);
    if (fromPos >= 0 && fromPos < toPos) toPos--;
    list.splice(toPos, 0, moved);
    moved.sectionId = targetSecId;
    fdApplyFieldOrderInSection(targetSecId, list);
    return true;
}

function fdOnFieldDragStart(ev, fieldId) {
    fdFieldDragFromId = fieldId;
    ev.dataTransfer.effectAllowed = 'move';
    ev.dataTransfer.setData('text/plain', String(fieldId));
    const row = ev.target && ev.target.closest ? ev.target.closest('.fd-field-data-row') : null;
    if (row) row.classList.add('fd-field-row-dragging');
}

function fdOnFieldDragEnd(ev) {
    fdFieldDragFromId = null;
    document.querySelectorAll('.fd-field-row-dragging, .fd-field-row-drop-target').forEach(el => {
        el.classList.remove('fd-field-row-dragging', 'fd-field-row-drop-target');
    });
}

function fdOnFieldDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    const row = ev.currentTarget;
    if (row && row.classList.contains('fd-field-data-row')) row.classList.add('fd-field-row-drop-target');
}

function fdOnFieldDragLeave(ev) {
    const row = ev.currentTarget;
    if (row) row.classList.remove('fd-field-row-drop-target');
}

function fdOnFieldDrop(ev, toFieldId, toSectionId) {
    ev.preventDefault();
    ev.stopPropagation();
    const fromId = fdFieldDragFromId;
    fdOnFieldDragEnd(ev);
    if (fromId == null || fromId === toFieldId) return;
    if (fdReorderFieldByDrop(fromId, toFieldId, toSectionId)) fdRenderFieldsTable();
}

function fdRenderFieldsTable() {
    fdRenderSectionsBar();
    const body=document.getElementById('fdFieldsBody');
    const badge=document.getElementById('fdFieldsCountBadge');
    if(badge) badge.textContent=`${fdFields.length} حقل`;
    const num=document.getElementById('fdFieldNum');
    if(num) num.textContent=String(fdEditingIdx>=0?fdEditingIdx+1:fdFields.length+1);
    fdUpdateStep2NextBtn();
    if(!body) return;
    if(!fdFields.length){ body.innerHTML='<tr><td colspan="9" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>'; return; }
    let html = '';
    let globalIdx = 0;
    fdSections.forEach(sec => {
        const items = [];
        fdFields.forEach((f, origIdx) => { if ((f.sectionId || fdSections[0].id) === sec.id) items.push({ f, origIdx }); });
        items.sort((a, b) => (a.f.sortOrder || 0) - (b.f.sortOrder || 0));
        html += `<tr class="fd-sec-row-head"><td colspan="9" style="background:var(--sa-50);color:var(--sa-700);font-weight:700;font-size:12px;padding:8px 12px;border-top:2px solid var(--sa-100);"><i class="bi bi-collection"></i> ${esc(sec.title)} <span style="color:var(--gray-500);font-weight:500;margin-inline-start:6px;">(${items.length})</span></td></tr>`;
        if (!items.length) {
            html += `<tr><td colspan="9" class="text-center text-muted py-2" style="font-size:11px;">لا توجد حقول في هذا القسم</td></tr>`;
            return;
        }
        items.forEach(({ f, origIdx }) => {
            globalIdx++;
            const req = f.isRequired ? '<span class="fd-field-req">نعم</span>' : '<span style="font-size:11px;color:var(--gray-400);">لا</span>';
            let isRo = false;
            if (f.isReadOnly) isRo = true;
            else { try { const _po = JSON.parse(f.propertiesJson || '{}'); if (_po.readOnly) isRo = true; } catch (e) {} }
            const ro = isRo
                ? '<span class="fd-field-req" style="background:var(--info-100);color:var(--info-700);">نعم</span>'
                : '<span style="font-size:11px;color:var(--gray-400);">لا</span>';
            const layout = f.displayLayout || 'يمتد عبر كامل الصف (واحد من واحد)';
            html += `<tr class="fd-field-data-row" data-field-id="${f.id}" data-orig-idx="${origIdx}" data-section-id="${sec.id}"
                ondragover="fdOnFieldDragOver(event)" ondragleave="fdOnFieldDragLeave(event)"
                ondrop="fdOnFieldDrop(event, ${f.id}, ${sec.id})">
                <td style="text-align:center;"><i class="bi bi-grip-vertical fd-field-drag" draggable="true" title="اسحب لإعادة الترتيب"
                    ondragstart="fdOnFieldDragStart(event, ${f.id})" ondragend="fdOnFieldDragEnd(event)"></i></td>
                <td style="text-align:center;font-weight:700;color:var(--gray-500);">${globalIdx}</td>
                <td>${fdFieldTypeBadgeHtml(f.fieldType)}</td>
                <td style="font-weight:600;">${esc(f.fieldName)}</td>
                <td style="text-align:center;">${req}</td>
                <td style="text-align:center;">${ro}</td>
                <td style="font-size:12px;color:var(--gray-700);">${esc(sec.title)}</td>
                <td style="font-size:11px;color:var(--gray-600);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${fdEscAttr(layout)}">${esc(layout)}</td>
                <td style="white-space:nowrap;text-align:center;">
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
    const req=document.getElementById('fdFieldRequired'); if(req) { req.value='1'; req.disabled=false; req.title=''; }
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
    const align = document.getElementById('fdFTitleAlign')?.value || 'right';
    const boldEl = document.getElementById('fdFTitleBold');
    const bold = boldEl ? !!boldEl.checked : true;
    let fontPx = parseInt(document.getElementById('fdFTitleFontPx')?.value || '17', 10);
    if (!Number.isFinite(fontPx)) fontPx = 17;
    fontPx = Math.min(48, Math.max(10, fontPx));
    const color = document.getElementById('fdFTitleColor')?.value || '#111827';
    const titleAppearance = fdNormalizeTitleAppearance({ align, bold, fontSizePx: fontPx, color });
    return {
        name:     (document.getElementById('fdFName')?.value||'').trim(),
        desc:     (document.getElementById('fdFDesc')?.value||'').trim(),
        ownership: document.getElementById('fdFOwnership')?.value||'عام',
        formClassId: parseInt(document.getElementById('fdFFormClass')?.value||'0'),
        typeId:   parseInt(document.getElementById('fdFType')?.value||'0'),
        wsId:     parseInt(document.getElementById('fdFWs')?.value||'0'),
        tplId:    parseInt(document.getElementById('fdFTpl')?.value||'0'),
        titleAppearance
    };
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────
async function fdSave(sendForApproval) {
    if (fdStep === 4) {
        const host = document.getElementById('fdWizardBody');
        const vErr = host ? fdValidateInteractivePreview(host) : '';
        if (vErr) return showToast(vErr, 'error');
    }

    // ── وضع إنشاء/تحديث إصدار نسخة ───────────────────────────────────────────
    if (fdVersionMode) {
        if (!fdVersionFormId) return showToast('النموذج المرتبط غير محدد', 'error');
        const versionPayload = { fieldsJson: fdSerializeFieldsJson(), sendForApproval };
        try {
            let res;
            if (fdVersionEditId) {
                versionPayload.id = fdVersionEditId;
                res = await apiFetch('/FormDefinitionVersions/UpdateVersion', 'POST', versionPayload);
            } else {
                versionPayload.formDefinitionId = fdVersionFormId;
                res = await apiFetch('/FormDefinitionVersions/AddVersion', 'POST', versionPayload);
            }
            if (res && res.success) {
                const okMsg = sendForApproval
                    ? (fdIsAdmin ? 'تم اعتماد الإصدار وتفعيله' : 'تم حفظ الإصدار')
                    : 'تم حفظ الإصدار كمسودة';
                showToast(okMsg, 'success');
                fdWizModal().hide();
                if (typeof fdvLoad === 'function') fdvLoad();
            } else showToast((res && res.message) || 'خطأ في الحفظ', 'error');
        } catch { showToast('خطأ في الاتصال بالخادم', 'error'); }
        return;
    }

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
        const titleApp = parsed.titleAppearance;

        // Template data comes embedded in the response — تكميل العلامة المائية من القالب المرتبط إن وُجدت في القالب فقط
        let tplData = d.templateData || null;
        tplData = await fdEnrichTemplateDataWatermark(tplData, d.templateId);

        // ── info section ────────────────────────────────────────────────────
        const activeBadge = d.isActive
            ? '<span class="badge bg-success-subtle text-success"><i class="bi bi-check-circle-fill"></i> مفعّل</span>'
            : '<span class="badge bg-secondary-subtle text-secondary"><i class="bi bi-dash-circle"></i> معطّل</span>';
        const publicIdVal = d.publicId
            ? `<span class="fd-publicid-badge">${esc(d.publicId)}</span>`
            : '<span style="color:var(--gray-400);">—</span>';
        const activeVerVal = d.activeVersionLabel
            ? `<span class="fd-activever-badge">${esc(d.activeVersionLabel)}</span>`
            : '<span style="color:var(--gray-400);">—</span>';

        let html = `<div class="fd-section">
            <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> معلومات النموذج</div>
            <div class="fd-detail-grid">
                <span class="fd-detail-lbl">المعرف</span><span class="fd-detail-val">${publicIdVal}</span>
                <span class="fd-detail-lbl">اسم النموذج</span><span class="fd-detail-val" style="font-weight:700;">${esc(d.name)}</span>
                <span class="fd-detail-lbl">الوصف العام</span><span class="fd-detail-val">${d.description ? esc(d.description) : '<span style="color:var(--gray-400);">—</span>'}</span>
                <span class="fd-detail-lbl">الإصدار النشط</span><span class="fd-detail-val">${activeVerVal}</span>
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
            ${fdBuildFormPreview(tplData, d.name, d.description, fields, false, sections, titleApp)}
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
