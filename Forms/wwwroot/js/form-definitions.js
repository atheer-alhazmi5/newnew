'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
let fdData          = [];
let fdLookups       = { formClasses:[], formTypes:[], workspaces:[], templates:[], templateFilters:[], orgUnitFilters:[] };
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

// Conditional logic rules (step 3)
let fdConditionalRules = [];
let fdRuleSeq = 1;
const FD_RULE_OPERATORS = ['يساوي','لا يساوي','أكبر من','أصغر من','يحتوي على','فارغ','غير فارغ'];
const FD_RULE_NO_VALUE  = new Set(['فارغ','غير فارغ']);
const FD_RULE_ACTIONS   = ['إظهار الحقل','إخفاء الحقل','جعل الحقل مطلوبا','تعطيل الحقل'];

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
        { key:"defaultValue", label:"القيمة التلقائية", type:"text" },
        { key:"placeholder", label:"العنصر النائب", type:"text" },
        { key:"widthPx", label:"العرض بالبيكسل", type:"number" },
        { key:"minLength", label:"الحد الأدنى", type:"number" },
        { key:"maxLength", label:"الحد الأقصى", type:"number" },
        { key:"emailFormat", label:"التحقق من صيغة البريد (xxx@almadinah.gov.sa)", type:"checkbox" }
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
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"single", perOptionOther:true },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text" }
    ]},
    "قائمة اختيار متعدد": { props: [
        { key:"subName", label:"اسم فرعي", type:"text" },
        { key:"options", label:"الخيارات", type:"optionList", choiceMode:"multi", perOptionOther:true },
        { key:"emptyText", label:"نص الخيار الفارغ", type:"text" }
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
    ]}
};

(function fdAugmentFieldTypesReadOnly() {
    const roProp = { key:'readOnly', label:'للقراءة فقط', type:'checkbox', checkboxLabel:'حقل للقراءة فقط', col:'col-md-6 col-sm-6 mb-3' };
    Object.keys(FD_FIELD_TYPES).forEach(k => { FD_FIELD_TYPES[k].props.push({ ...roProp }); });
})();

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

function fdParseLines(s) {
    if (s == null || s === '') return [];
    return String(s).split(/[\r\n]+/).map(x => x.trim()).filter(Boolean);
}

/** يُكمِّل «صيغة الرقم» بفرض «نمط الإدخال» في حقول المعاينة. */
function fdPhoneInputPatternExtras(inputPatternRaw) {
    const ip = String(inputPatternRaw || 'أرقام فقط').trim();
    if (ip === 'حروف فقط')
        return { inpType: 'text', pt: ' pattern="^[A-Za-z\\u0600-\\u06FF\\s\\.\\-]+$"', inputmode: '', titleAttr: ` title="${fdEscAttr('حروف فقط')}"` };
    if (ip === 'حروف وأرقام')
        return { inpType: 'text', pt: ' pattern="^[A-Za-z0-9\\u0600-\\u06FF\\s\\.\\-]+$"', inputmode: '', titleAttr: ` title="${fdEscAttr('حروف وأرقام')}"` };
    return { inpType: 'tel', pt: ' pattern="^[0-9]+$"', inputmode: ' inputmode="numeric"', titleAttr: ` title="${fdEscAttr('أرقام فقط')}"` };
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

/** آخر لوحة تقويم هجري مفتوحة (يُغلق عند النقر خارجها). */
let fdHijriOpenPanel = null;

const FD_HIJRI_POP_PANEL_WIDTH = 270;

/** تموضع اللوحة كـ «منتقي نظام صغير» بجانب المجموعة دون امتداد عرض عمود المعاينة. */
function fdHijriPositionPanel(panel, wrap) {
    if (!panel || !wrap) return;
    const anchor = wrap.querySelector('.fd-date-input-group') || wrap;
    const rr = anchor.getBoundingClientRect();
    const vw = typeof window.innerWidth === 'number' ? window.innerWidth : 480;
    const vh = typeof window.innerHeight === 'number' ? window.innerHeight : 600;
    const gutter = 5;
    const pw = FD_HIJRI_POP_PANEL_WIDTH;
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

function fdHijriRepositionOpenPanel() {
    const p = fdHijriOpenPanel;
    if (!p || !p._fdAttachedWrap) return;
    fdHijriPositionPanel(p, p._fdAttachedWrap);
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const t = e.target;
        if (!fdHijriOpenPanel) return;
        const host = fdHijriOpenPanel.closest && fdHijriOpenPanel.closest('.fd-hijri-date');
        if (host && host.contains(t)) return;
        fdHijriOpenPanel.style.display = 'none';
        try { fdHijriOpenPanel._fdAttachedWrap = null; } catch (_) {}
        fdHijriOpenPanel = null;
    });
    document.addEventListener('keydown', e => {
        if ((e.key === 'Escape' || e.code === 'Escape') && fdHijriOpenPanel) {
            fdHijriOpenPanel.style.display = 'none';
            try { fdHijriOpenPanel._fdAttachedWrap = null; } catch (_) {}
            fdHijriOpenPanel = null;
        }
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('scroll', () => fdHijriRepositionOpenPanel(), { capture: true, passive: true });
    window.addEventListener('resize', () => fdHijriRepositionOpenPanel(), { passive: true });
}

function fdHijriBuildPanelHtml() {
    return `<div class="fd-hijri-pop fd-hijri-pop--floating" dir="rtl" role="dialog" aria-label="منتقي التاريخ الهجري" style="display:none;">
<div class="fd-hijri-pop-inner rounded-3 border bg-white shadow">
<div class="d-flex fd-h-nav-row justify-content-between align-items-center gap-1 px-2 pt-2 pb-1">
<button type="button" tabindex="-1" class="btn btn-sm btn-outline-secondary fd-h-prev px-2" aria-label="الشهر السابق">‹</button>
<span class="fd-h-cap fw-bold mx-1 flex-grow-1 text-center"></span>
<button type="button" tabindex="-1" class="btn btn-sm btn-outline-secondary fd-h-next px-2" aria-label="الشهر التالي">›</button></div>
<div class="fd-h-head d-grid text-center px-2 mb-0"></div>
<div class="fd-h-grid d-grid px-2 pb-2"></div>
<div class="text-center fd-h-footer border-top py-1"><button type="button" tabindex="-1" class="btn btn-link btn-sm py-1 lh-sm fd-h-clear">مسح التاريخ</button></div>
</div></div>`;
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
    const cap = panel.querySelector('.fd-h-cap');
    if (cap) cap.textContent = `${FD_HIJRI_MONTH_NAMES[hm - 1] || ''} ${hy} هـ`;
    const head = panel.querySelector('.fd-h-head');
    const grid = panel.querySelector('.fd-h-grid');
    if (!head || !grid) return;
    head.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
    head.style.gap = '2px';
    grid.style.gridTemplateColumns = 'repeat(7, minmax(0, 1fr))';
    grid.style.gap = '2px';
    const wk = ['أ', 'إ', 'ث', 'ر', 'خ', 'ج', 'س'];
    head.innerHTML = wk.map(c => `<span>${c}</span>`).join('');
    const first = fdFindFirstGregorianDayOfHijriMonth(hy, hm);
    const len = fdDaysInHijriMonth(hy, hm);
    const startCol = first.getUTCDay();
    const minG = wrap._fdMinG || null;
    const maxG = wrap._fdMaxG || null;
    let cells = '';
    let skip = startCol % 7;
    for (let i = 0; i < skip; i++) cells += '<span></span>';
    for (let day = 1; day <= len; day++) {
        const gd = fdAddDaysUtc(first, day - 1);
        const ok = fdHijriInRange(gd, minG, maxG);
        let cls = 'btn btn-light border fd-h-day btn-sm p-0 rounded text-dark lh-sm ';
        cls += ok ? '' : ' text-muted opacity-50';
        if (hSel && hSel.hy === hy && hSel.hm === hm && hSel.hd === day) cls = 'btn btn-primary border fd-h-day btn-sm p-0 rounded text-white lh-sm ';
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
            if (fdHijriOpenPanel === panel) fdHijriOpenPanel = null;
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

    let panel = wrap.querySelector(':scope > .fd-hijri-pop');
    if (!panel) {
        wrap.insertAdjacentHTML('beforeend', fdHijriBuildPanelHtml());
        panel = wrap.querySelector(':scope > .fd-hijri-pop');
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

    panel.querySelector('.fd-h-prev')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-h-prev')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        let hy = parseInt(wrap.getAttribute('data-fd-hy'), 10), hm = parseInt(wrap.getAttribute('data-fd-hm'), 10);
        if (hm <= 1) { hm = 12; hy -= 1; } else hm -= 1;
        wrap.setAttribute('data-fd-hy', String(hy));
        wrap.setAttribute('data-fd-hm', String(hm));
        fdHijriRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdHijriPositionPanel(panel, wrap));
    });
    panel.querySelector('.fd-h-next')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-h-next')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        let hy = parseInt(wrap.getAttribute('data-fd-hy'), 10), hm = parseInt(wrap.getAttribute('data-fd-hm'), 10);
        if (hm >= 12) { hm = 1; hy += 1; } else hm += 1;
        wrap.setAttribute('data-fd-hy', String(hy));
        wrap.setAttribute('data-fd-hm', String(hm));
        fdHijriRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdHijriPositionPanel(panel, wrap));
    });
    panel.querySelector('.fd-h-clear')?.addEventListener('mousedown', ev => { ev.preventDefault(); });
    panel.querySelector('.fd-h-clear')?.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        if (store) store.value = '';
        if (face) face.value = '';
        if (fdHijriOpenPanel === panel) {
            panel.style.display = 'none';
            panel._fdAttachedWrap = null;
            fdHijriOpenPanel = null;
        }
    });

    function togglePop(e) {
        e.preventDefault();
        e.stopPropagation();
        const wasOpen = (fdHijriOpenPanel === panel && panel.style.display !== 'none');
        if (fdHijriOpenPanel && fdHijriOpenPanel !== panel) {
            fdHijriOpenPanel.style.display = 'none';
            try { fdHijriOpenPanel._fdAttachedWrap = null; } catch (_) {}
            fdHijriOpenPanel = null;
        }
        if (wasOpen) {
            panel.style.display = 'none';
            fdHijriOpenPanel = null;
            panel._fdAttachedWrap = null;
            return;
        }
        if (btn?.disabled || face?.readOnly) return;
        fdHijriNormalizeFaceAndStore(wrap);
        fdHijriOpenPanel = panel;
        panel._fdAttachedWrap = wrap;
        panel.style.display = 'block';
        fdHijriRenderMonth(panel, wrap);
        requestAnimationFrame(() => fdHijriPositionPanel(panel, wrap));
    }
    btn?.addEventListener('click', togglePop);
    face?.addEventListener('click', togglePop);
    face?.addEventListener('blur', () => { fdHijriNormalizeFaceAndStore(wrap, { clearOnInvalidRange: true }); });
}

function fdHijriBindInRoot(root) {
    (root || document).querySelectorAll('.fd-hijri-date').forEach(fdHijriBindWrap);
}

/** تنسيق موحَّد لمربّعات التاريخ الهجري/الميلادي (ارتفاع الزر وحقل الإدخال). */
function fdEnsureDateFieldStyles() {
    if (typeof document === 'undefined') return;
    const id = 'fd-date-field-unified-styles-v3';
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
.fd-date-field-wrap .fd-date-input-group > input[type="date"].fd-date-control.form-control {
  color-scheme: light;
}
.fd-date-field-wrap .fd-date-input-group > input.fd-date-control.fd-hijri-face.form-control,
.fd-date-field-wrap.fd-date-hijri-fallback .fd-date-input-group > .fd-date-control.form-control {
  font-variant-numeric: tabular-nums;
}
.fd-date-field-wrap .fd-date-input-group > .fd-date-cal-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  padding-inline: 0.65rem;
  border-radius: 8px;
}
.fd-date-field-wrap .fd-date-input-group > .fd-date-cal-btn .bi-calendar3 {
  font-size: 1.125rem;
  line-height: 1;
}
.fd-date-field-wrap.fd-date-hijri-fallback .fd-date-cal-btn[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}

/* منتقي الهجري: نافذة عائمة صغيرة (مثل نمط منتقي النظام) */
.fd-hijri-pop.fd-hijri-pop--floating {
  position: fixed !important;
  inset: unset !important;
  margin: 0 !important;
  padding: 0 !important;
  left: auto;
  top: auto;
  z-index: 1090 !important;
  isolation: isolate;
}
.fd-hijri-pop-inner.shadow {
  box-shadow: 0 0.4rem 1rem rgba(0,0,0,.12), 0 0.1rem 0.25rem rgba(0,0,0,.08) !important;
}
.fd-hijri-pop .fd-hijri-pop-inner {
  width: ${FD_HIJRI_POP_PANEL_WIDTH}px;
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
}
.fd-hijri-pop .fd-h-cap {
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--bs-body-color, #1f2937);
}
.fd-hijri-pop .fd-h-prev,
.fd-hijri-pop .fd-h-next {
  min-height: calc(1.5em + 0.375rem + 2px);
  padding-top: .2rem !important;
  padding-bottom: .2rem !important;
  border-radius: 8px !important;
  font-size: 1rem;
}
.fd-hijri-pop .fd-h-head span {
  display: inline-block;
  font-size: 10px !important;
  font-weight: 600;
  color: #64748b;
  line-height: 1;
  padding-bottom: 2px;
}
.fd-hijri-pop .fd-h-grid .fd-h-day {
  min-height: calc(2rem + 4px);
  width: 100%;
  max-width: 100%;
  font-size: 12.5px !important;
  font-weight: 500;
}
.fd-hijri-pop .fd-h-grid .btn-primary.fd-h-day {
  font-weight: 700 !important;
}
.fd-hijri-pop .fd-h-footer .fd-h-clear {
  font-size: 12px !important;
  text-decoration: none;
}`;
    document.head.appendChild(el);
}

/** نفس بنية الحقل الهجري: مجموعة إدخال + زر يفتح منتقي التاريخ الأصلي (showPicker أو focus). */
function fdGregorianDateBindWrap(wrap) {
    if (!wrap || wrap.dataset.fdDateGregBound === '1') return;
    const inp = wrap.querySelector('input[type="date"].fd-greg-datepicker');
    const btn = wrap.querySelector('.fd-greg-datepicker-btn');
    if (!inp || !btn) return;
    wrap.dataset.fdDateGregBound = '1';
    btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled || inp.disabled || inp.readOnly) return;
        if (typeof inp.showPicker === 'function') {
            try { inp.showPicker(); } catch (_) { inp.focus(); }
        } else {
            inp.focus();
        }
    });
}

function fdGregorianDateBindInRoot(root) {
    (root || document).querySelectorAll('.fd-date-miladi').forEach(fdGregorianDateBindWrap);
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
        const wrapStyle = wStyle ? ` style="${wStyle}"` : '';
        const maxLA = maxL || '';
        const ltrSt = mk('direction:ltr;');
        if (fmt === '+966 (9 أرقام)') {
            if (ie.inpType === 'tel') {
                inp = `<div class="input-group"${ttAttr}${wrapStyle}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+966</span><input type="tel" class="form-control" placeholder="5XXXXXXXX" maxlength="9" pattern="[0-9]{9}"${ie.titleAttr} value="${defVal}"${reqAttr}${roAttr}${ie.inputmode}${ltrSt}></div>`;
            } else {
                inp = `<div class="input-group"${ttAttr}${wrapStyle}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+966</span><input type="text" class="form-control"${ie.pt}${ie.titleAttr} placeholder="${ph}" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ltrSt}></div>`;
            }
        } else if (fmt === '05xxxxxxxx (10 أرقام)') {
            if (ie.inpType === 'tel') {
                inp = `<input type="tel" class="form-control" placeholder="05XXXXXXXX" maxlength="10" pattern="05[0-9]{8}"${ie.titleAttr} value="${defVal}"${reqAttr}${roAttr}${ttAttr}${ie.inputmode}${ltrSt}>`;
            } else {
                inp = `<input type="text" class="form-control"${ie.pt}${ie.titleAttr} placeholder="05XXXXXXXX" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ttAttr}${ltrSt}>`;
            }
        } else if (fmt === 'تلفون') {
            inp = `<input type="${ie.inpType}" class="form-control" placeholder="${ph || 'XXXXXXXX'}" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ttAttr}${ie.pt}${ie.titleAttr}${ie.inputmode}${ltrSt}>`;
        } else {
            inp = `<div class="input-group"${ttAttr}${mk('direction:ltr;')}><span class="input-group-text fw-bold" style="background:var(--sa-50);">+</span><input type="${ie.inpType}" class="form-control" placeholder="${ph || 'XXX XXXXXXXXX'}" value="${defVal}"${reqAttr}${maxLA}${roAttr}${ie.pt}${ie.titleAttr}${ie.inputmode}></div>`;
        }
    } else if (f.fieldType==='البريد الإلكتروني') {
        const pat = props.emailFormat ? ` pattern="[^\\s@]+@almadinah\\.gov\\.sa" title="${fdEscAttr('يجب أن يكون البريد بصيغة اسم@almadinah.gov.sa')}"` : '';
        inp = `<input type="email" class="form-control" placeholder="${ph}" value="${defVal}"${pat}${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
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
            inp = `<fieldset class="fd-oc-group border-0 p-0 m-0" data-fd-field-id="${String(f.id ?? '')}" data-fd-oc-mode="single"${reqGrp} style="margin:0;padding:0;border:none;"${ttAttr}${mk()}>${body}</fieldset>`;
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
            inp = `<div class="fd-oc-group d-flex flex-column gap-1" data-fd-field-id="${String(f.id ?? '')}"${ttAttr}${mk()} data-fd-oc-mode="multi"${reqGrp}>${body}</div>`;
        }
    } else if (f.fieldType==='تاريخ') {
        const cal = String(props.calendarType || 'ميلادي').trim();
        const mn = props.startDate ? ` min="${fdEscAttr(String(props.startDate))}"` : '';
        const mx = props.endDate ? ` max="${fdEscAttr(String(props.endDate))}"` : '';
        const phDateA11y = fdEscAttr('اختر التاريخ');
        const ttlOpenCal = fdEscAttr('فتح التقويم');
        const ttlHijNA = fdEscAttr('التقويم التفاعلي غير مدعوم — أدخل التاريخ الهجري يدويًا');
        const grpCls = 'input-group fd-date-input-group';
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
            inp = `<div class="fd-date-field-wrap fd-date-hijri fd-hijri-date position-relative"${minAttr}${maxAttr}${ttAttr}${mk('direction:ltr;')}><div class="${grpCls}"><input type="text" id="${fdEscAttr(uid)}_face" class="form-control fd-date-control fd-hijri-face" autocomplete="off" placeholder="${ph}" aria-label="${phDateA11y}" title="${phDateA11y}" dir="ltr" value="${faceEsc}"${faceRo}><button type="button" class="${btnCls} fd-hijri-btn"${disBtn} title="${ttlOpenCal}" aria-label="${ttlOpenCal}"><i class="bi bi-calendar3" aria-hidden="true"></i></button></div><input type="hidden" class="fd-hijri-store" id="${fdEscAttr(uid)}_hid" value="${faceEsc}"${hidReq}/></div>`;
        } else if (cal === 'هجري') {
            const hijPh = fdEscAttr(ph || '1447/06/15 — مثال');
            inp = `<div class="fd-date-field-wrap fd-date-hijri fd-date-hijri-fallback position-relative"${ttAttr}${mk('direction:ltr;')}><div class="${grpCls}"><input type="text" class="form-control fd-date-control" dir="ltr" placeholder="${hijPh}" aria-label="${phDateA11y}" title="${phDateA11y}" value="${defVal}"${reqAttr}${roAttr}><button type="button" class="${btnCls}" disabled tabindex="-1" title="${ttlHijNA}" aria-label="${ttlHijNA}"><i class="bi bi-calendar3" aria-hidden="true"></i></button></div></div>`;
        } else {
            const uidG = `fd_gr_${String(f.id ?? 'x')}_${String(f.fieldName || 'f').replace(/\s+/g, '_')}`.replace(/[^\w\-]/g, '');
            const disBtnG = props.readOnly ? ' disabled' : '';
            inp = `<div class="fd-date-field-wrap fd-date-miladi position-relative"${ttAttr}${mk('direction:ltr;')}><div class="${grpCls}"><input type="date" class="form-control fd-date-control fd-greg-datepicker" id="${fdEscAttr(uidG)}" value="${defVal}"${mn}${mx}${reqAttr}${roAttr} aria-label="${phDateA11y}" title="${phDateA11y}"><button type="button" class="${btnCls} fd-greg-datepicker-btn"${disBtnG} title="${ttlOpenCal}" aria-label="${ttlOpenCal}"><i class="bi bi-calendar3" aria-hidden="true"></i></button></div></div>`;
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
    } else {
        inp = `<input type="text" class="form-control" placeholder="${ph}" value="${defVal}"${reqAttr}${maxL}${roAttr}${ttAttr}${mk()}>`;
    }

    return inp;
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
    fdDdlEnsureTreeExpandDelegation();
    (root || document).querySelectorAll('canvas[data-fd-init-sig]').forEach(fdSigBindCanvas);
    (root || document).querySelectorAll('.fd-oc-group').forEach(fdOcInitGroup);
    fdHijriBindInRoot(root);
    fdGregorianDateBindInRoot(root);
    fdFileUploadBindInRoot(root);
    fdIvBindLive(root);
}

// ─── SECTIONS HELPERS ──────────────────────────────────────────────────────
function fdDefaultSections() { return [{ id: 1, title: 'القسم الأول' }]; }

function fdParseFieldsJsonPayload(json) {
    const def = { sections: fdDefaultSections(), fields: [], rules: [] };
    if (!json) return def;
    let p;
    try { p = JSON.parse(json); } catch { return def; }
    if (Array.isArray(p)) {
        p.forEach(f => { if (!f.sectionId) f.sectionId = 1; });
        return { sections: def.sections, fields: p, rules: [] };
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
        return { sections: s, fields: fs, rules: rs };
    }
    return def;
}

function fdSerializeFieldsJson() {
    return JSON.stringify({ sections: fdSections, fields: fdFields, rules: fdConditionalRules });
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
    const validFieldIds = new Set(fdFields.map(f => f.id));
    const validSecIds = new Set(fdSections.map(s => s.id));
    const firstFieldId = fdFields[0]?.id || 0;
    const firstSecId = fdSections[0]?.id || 1;
    fdConditionalRules = (parsed.rules || []).map((r, i) => ({
        id: r.id || (i + 1),
        isEnabled: r.isEnabled !== false,
        fieldId: validFieldIds.has(r.fieldId) ? r.fieldId : firstFieldId,
        operator: FD_RULE_OPERATORS.includes(r.operator) ? r.operator : FD_RULE_OPERATORS[0],
        value: r.value || '',
        action: FD_RULE_ACTIONS.includes(r.action) ? r.action : FD_RULE_ACTIONS[0],
        sectionId: validSecIds.has(r.sectionId) ? r.sectionId : firstSecId
    }));
    const ruleIds = fdConditionalRules.map(r => r.id);
    fdRuleSeq = (ruleIds.length ? Math.max(...ruleIds) : 0) + 1;
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
        fdFillFilters(); fdRenderTable();
    } catch(e) { console.error('fdLoad',e); }
}

function fdFillFilters() {
    const catSel  = document.getElementById('fdFilterCat');
    const typeSel = document.getElementById('fdFilterType');
    const tplSel  = document.getElementById('fdFilterTemplate');
    const ouSel   = document.getElementById('fdFilterOrgUnit');
    if (catSel && catSel.options.length<=1) fdLookups.formClasses.forEach(c=>catSel.add(new Option(c.name,c.id)));
    if (typeSel && typeSel.options.length<=1) fdLookups.formTypes.forEach(t=>typeSel.add(new Option(t.name,t.id)));
    if (tplSel && tplSel.options.length<=1) (fdLookups.templateFilters||[]).forEach(t=>tplSel.add(new Option(t.name,t.id)));
    if (ouSel && ouSel.options.length<=1) (fdLookups.orgUnitFilters||[]).forEach(u=>ouSel.add(new Option(u.name,u.id)));
    const th = document.getElementById('fdThActive');
    if (th) th.style.display = '';
}

function fdClear() {
    ['fdSearch','fdFilterCat','fdFilterType','fdFilterStatus','fdFilterOwnership','fdFilterTemplate','fdFilterOrgUnit','fdFilterActivation'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
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
    ['fdStep1El','fdStep2El','fdStep3El','fdStep4El'].forEach((id,idx) => {
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
    } else if (fdStep===3) {
        body.innerHTML = fdStep3Html();
        fdRenderRules();
        foot.innerHTML = `<button class="fd-cancel-btn" onclick="fdGoStepBack(3)"><i class="bi bi-arrow-right-short"></i> السابق</button>
        <button class="fd-save-btn send" onclick="fdGoStep4()"><i class="bi bi-arrow-left-short"></i> التالي</button>`;
    } else {
        body.innerHTML = fdStep4Html();
        fdInitDynamicWidgets(body);
        const primaryActionLabel = fdIsAdmin ? 'نشر النموذج' : 'إرسال للاعتماد';
        const primaryActionIcon  = fdIsAdmin ? 'bi-upload' : 'bi-send-fill';
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
    return `
    <div class="fd-section">
        <div class="fd-section-title"><i class="bi bi-info-circle-fill"></i> المعلومات الأساسية</div>
        <div class="fd-form-row">
            <div class="fd-form-group"><label><span class="required-star">*</span> اسم النموذج</label><input type="text" class="form-control" id="fdFName" value="${esc(d.name||'')}" placeholder="مثال: نموذج طلب إجازة"></div>
            <div class="fd-form-group"><label><span class="required-star">*</span> الملكية</label><select class="form-select" id="fdFOwnership"><option value="عام" ${ow==='عام'?'selected':''}>عام</option><option value="خاص" ${ow==='خاص'?'selected':''}>خاص</option></select></div>
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
                    <tr><td colspan="8" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>
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
        let _tipPo = {}; try { _tipPo = JSON.parse(f.propertiesJson || '{}'); } catch (e) {}
        const tipMerged = String((f.tooltipText != null && f.tooltipText !== '') ? f.tooltipText : (_tipPo.tooltipText || '')).trim();
        const tipAttr   = tipMerged ? ` title="${fdEscAttr(tipMerged)}"` : '';
        const infoIcon  = tipMerged ? `<i class="bi bi-info-circle ms-1" style="font-size:11px;color:var(--sa-400);"${tipAttr}></i>` : '';
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
function fdStep4Html() {
    const fName = (fdStep1State?.name || '').trim() || 'اسم النموذج';
    const fDesc = (fdStep1State?.desc || '').trim() || '';
    return fdBuildFormPreview(fdCurrentTemplate, fName, fDesc, fdFields, true, fdSections);
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
    if (!fdFields.length) {
        showToast('أضف حقولاً أولاً قبل إضافة قواعد المنطق الشرطي', 'error');
        return;
    }
    const rule = {
        id: fdRuleSeq++,
        isEnabled: true,
        fieldId: fdFields[0]?.id || 0,
        operator: FD_RULE_OPERATORS[0],
        value: '',
        action: FD_RULE_ACTIONS[0],
        sectionId: fdSections[0]?.id || 1
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

function fdRuleCardHtml(r, n) {
    const fieldOpts = fdFields.map(f => `<option value="${f.id}" ${f.id === r.fieldId ? 'selected' : ''}>${esc(f.fieldName || ('حقل ' + f.id))}</option>`).join('');
    const opOpts = FD_RULE_OPERATORS.map(op => `<option value="${esc(op)}" ${op === r.operator ? 'selected' : ''}>${esc(op)}</option>`).join('');
    const actOpts = FD_RULE_ACTIONS.map(a => `<option value="${esc(a)}" ${a === r.action ? 'selected' : ''}>${esc(a)}</option>`).join('');
    const secOpts = fdSections.map(s => `<option value="${s.id}" ${s.id === r.sectionId ? 'selected' : ''}>${esc(s.title)}</option>`).join('');
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
                <label class="small fw-bold text-muted">الحقل <span class="required-star">*</span></label>
                <select class="form-select form-select-sm" onchange="fdUpdateRule(${r.id}, { fieldId: parseInt(this.value, 10) })">${fieldOpts}</select>
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
                <label class="small fw-bold text-muted">القسم <span class="required-star">*</span></label>
                <select class="form-select form-select-sm" onchange="fdUpdateRule(${r.id}, { sectionId: parseInt(this.value, 10) })">${secOpts}</select>
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

function fdGoStep3() {
    fdSyncRulesAfterFieldChanges();
    fdStep = 3;
    fdRenderStep();
}

function fdSyncRulesAfterFieldChanges() {
    const fieldIds = new Set(fdFields.map(f => f.id));
    const sectionIds = new Set(fdSections.map(s => s.id));
    fdConditionalRules.forEach(r => {
        if (!fieldIds.has(r.fieldId)) r.fieldId = fdFields[0]?.id || 0;
        if (!sectionIds.has(r.sectionId)) r.sectionId = fdSections[0]?.id || 1;
    });
}

async function fdGoStep4() {
    const tplId = parseInt(fdStep1State?.tplId || '0');
    fdCurrentTemplate = null;
    if (tplId > 0) {
        try {
            const res = await apiFetch(`/FormDefinitions/GetTemplateForPreview?id=${tplId}`);
            if (res && res.success) fdCurrentTemplate = res.data;
        } catch {}
    }
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
    if (type === 'شبكة خيارات متعددة' || type === 'شبكة مربعات اختيار') {
        const rl = document.getElementById('fdProp_rowLabels');
        if (!rl || !String(rl.value || '').trim()) return showToast('يرجى إدخال عناوين الصفوف (سطر لكل صف)', 'error');
    }
    const props = fdCollectFieldProps();
    const secSel = document.getElementById('fdFieldSection');
    const secId = secSel ? (parseInt(secSel.value, 10) || fdActiveSectionId) : fdActiveSectionId;
    const isReadOnly = !!props.readOnly;
    const isRequired = !isReadOnly && document.getElementById('fdFieldRequired')?.value === '1';
    const tooltipText = document.getElementById('fdFieldTooltip')?.value?.trim() || '';
    const field = { id: fdEditingIdx>=0 ? fdFields[fdEditingIdx].id : Date.now(), fieldType:type, fieldName:name, isRequired, isReadOnly, subName:props.subName||'', placeholder:props.placeholder||'', tooltipText, displayLayout:document.getElementById('fdFieldDisplayLayout')?.value?.trim()||'', sortOrder:0, sectionId: secId, propertiesJson:JSON.stringify(props) };
    if(fdEditingIdx>=0){ fdFields[fdEditingIdx]=field; showToast('تم تحديث الحقل','success'); fdEditingIdx=-1; }
    else { fdFields.push(field); showToast('تم إضافة الحقل','success'); }
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
    if(!fdFields.length){ body.innerHTML='<tr><td colspan="8" class="text-center py-3 text-muted">لا توجد حقول مضافة بعد</td></tr>'; return; }
    let html = '';
    let globalIdx = 0;
    fdSections.forEach(sec => {
        const items = [];
        fdFields.forEach((f, origIdx) => { if ((f.sectionId || fdSections[0].id) === sec.id) items.push({ f, origIdx }); });
        html += `<tr class="fd-sec-row-head"><td colspan="8" style="background:var(--sa-50);color:var(--sa-700);font-weight:700;font-size:12px;padding:8px 12px;border-top:2px solid var(--sa-100);"><i class="bi bi-collection"></i> ${esc(sec.title)} <span style="color:var(--gray-500);font-weight:500;margin-inline-start:6px;">(${items.length})</span></td></tr>`;
        if (!items.length) {
            html += `<tr><td colspan="8" class="text-center text-muted py-2" style="font-size:11px;">لا توجد حقول في هذا القسم</td></tr>`;
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
            html += `<tr>
                <td style="text-align:center;font-weight:700;color:var(--gray-500);">${globalIdx}</td>
                <td><span class="fd-field-type">${esc(f.fieldType)}</span></td>
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
    return {
        name:     (document.getElementById('fdFName')?.value||'').trim(),
        desc:     (document.getElementById('fdFDesc')?.value||'').trim(),
        ownership: document.getElementById('fdFOwnership')?.value||'عام',
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
    if (fdStep === 4) {
        const host = document.getElementById('fdWizardBody');
        const vErr = host ? fdValidateInteractivePreview(host) : '';
        if (vErr) return showToast(vErr, 'error');
    }
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
