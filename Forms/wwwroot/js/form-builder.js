/* form-builder.js — wizard-based form builder */

var EDIT_FORM_ID = window.EDIT_FORM_ID || 0;
var USER_ROLE = window.USER_ROLE || '';
var CURRENT_USER_ID = window.CURRENT_USER_ID || 0;
var INIT_CATEGORIES = window.INIT_CATEGORIES || [];
var INIT_DEPARTMENTS = window.INIT_DEPARTMENTS || [];
var INIT_USERS = window.INIT_USERS || [];

let currentStep = 1;
let formData = {
    name: '', description: '', category: '', categoryId: 0,
    icon: 'document', pinAsReady: false,
    targetDeptIds: [], targetUserIds: [],
    startDate: '', endDate: '',
    sections: [{ id: sid(), title: 'القسم الأول', questions: [] }]
};


const FORM_ICONS = {
    document:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    chart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    calendar:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    users:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    plane:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>',
    star:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    folder:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    shield:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    clock:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    building:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>',
    heart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    globe:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    key:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    award:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    lightning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    camera:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    gift:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    compass:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
    truck:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    tools:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'
};

const QUESTION_TYPES = [
    { value: 'short_answer',         label: 'إجابة قصيرة' },
    { value: 'paragraph',            label: 'فقرة' },
    { value: 'multiple_choice',      label: 'خيارات متعددة' },
    { value: 'checkboxes',           label: 'مربعات اختيار' },
    { value: 'dropdown',             label: 'القائمة المنسدلة' },
    { value: 'date_only',            label: 'تاريخ فقط' },
    { value: 'date_time',            label: 'تاريخ ووقت' },
    { value: 'rating',               label: 'تقييم' },
    { value: 'file_upload',          label: 'تحميل ملف' },
    { value: 'table',                label: 'جدول بيانات' },
    { value: 'multiple_choice_grid', label: 'شبكة خيارات متعددة' },
    { value: 'checkbox_grid',        label: 'شبكة مربعات اختيار' }
];

function sid() { return 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }
function qid() { return 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function iconSvg(name, size) {
    const svg = FORM_ICONS[name] || FORM_ICONS['document'];
    return '<span style="width:' + size + 'px;height:' + size + 'px;display:inline-flex;align-items:center;justify-content:center;">' + svg + '</span>';
}

let categories = [...INIT_CATEGORIES];

// ─── INIT ──────────────────────────────────────────────────────────
async function init() {
    try {
        if (EDIT_FORM_ID > 0) {
            const r = await apiFetch('/FormBuilder/GetForm?id=' + EDIT_FORM_ID);
            if (r && r.success) {
                const f = r.data;
                formData.name = f.name || '';
                formData.description = f.description || '';
                formData.category = f.category || '';
                formData.icon = f.icon || 'document';
                formData.pinAsReady = f.pinAsReady || false;
                if (f.startDate) formData.startDate = f.startDate.substring(0, 10);
                if (f.endDate) formData.endDate = f.endDate.substring(0, 10);
                try { formData.sections = JSON.parse(f.sectionsJson || '[]'); } catch(ex) { }
                if (!formData.sections.length) formData.sections = [{ id: sid(), title: 'القسم الأول', questions: [] }];
            }
        }
        renderStep();
        renderStepper();
        renderFooter();
    } catch (e) {
        console.error('Form builder init error:', e);
        var body = document.getElementById('wizardBody');
        if (body) body.innerHTML = '<div class="text-center py-5 text-danger"><i class="bi bi-exclamation-triangle" style="font-size:48px;"></i><p class="mt-3">حدث خطأ في تحميل الصفحة</p><pre style="font-size:12px;direction:ltr;text-align:left;">' + e.message + '</pre></div>';
    }
}

// ─── STEPPER ───────────────────────────────────────────────────────
function renderStepper() {
    const steps = document.querySelectorAll('.stepper-step');
    const lines = [document.getElementById('line1'), document.getElementById('line2')];
    steps.forEach((el, i) => {
        const n = i + 1;
        el.classList.remove('active', 'completed');
        const circle = el.querySelector('.stepper-circle');
        if (n < currentStep) {
            el.classList.add('completed');
            circle.innerHTML = '<i class="bi bi-check-lg"></i>';
        } else if (n === currentStep) {
            el.classList.add('active');
            circle.textContent = n;
        } else {
            circle.textContent = n;
        }
    });
    if (lines[0]) lines[0].className = currentStep > 1 ? 'stepper-line done' : 'stepper-line';
    if (lines[1]) lines[1].className = currentStep > 2 ? 'stepper-line done' : 'stepper-line';
}

// ─── FOOTER ────────────────────────────────────────────────────────
function renderFooter() {
    const footer = document.getElementById('wizardFooter');
    if (!footer) return;
    let html = '';
    if (currentStep > 1) html += '<button class="btn-back" onclick="prevStep()">رجوع</button>';
    if (currentStep < 3) {
        html += '<button class="btn-next" onclick="nextStep()">التالي</button>';
    } else {
        if (formData.pinAsReady) {
            html += '<button class="btn-next" onclick="publishForm()"><i class="bi bi-pin-angle" style="margin-left:8px;"></i>تثبيت النموذج</button>';
        } else {
            html += '<button class="btn-next" onclick="publishForm()"><i class="bi bi-send" style="margin-left:8px;"></i>نشر النموذج</button>';
        }
    }
    footer.innerHTML = html;
}

// ─── NAVIGATION ────────────────────────────────────────────────────
function nextStep() {
    if (currentStep === 1) {
        saveStep1FromDOM();
        if (!formData.name.trim()) { showToast('عنوان النموذج مطلوب', 'warning'); return; }
        if (!formData.category.trim()) { showToast('التصنيف مطلوب', 'warning'); return; }
        if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
            showToast('تاريخ النهاية يجب أن يكون بعد تاريخ البداية', 'warning'); return;
        }
    }
    if (currentStep === 2) {
        saveStep2FromDOM();
        const totalQ = formData.sections.reduce((s, sec) => s + sec.questions.length, 0);
        if (totalQ === 0) { showToast('أضف سؤال واحد على الأقل قبل المتابعة', 'warning'); return; }
        const emptyReqQ = formData.sections.some(sec =>
            sec.questions.some(q => q.required && !q.text.trim()));
        if (emptyReqQ) { showToast('الأسئلة المطلوبة يجب أن تحتوي على نص', 'warning'); return; }
    }
    currentStep++;
    renderStep();
    renderStepper();
    renderFooter();
}

function prevStep() {
    if (currentStep === 2) saveStep2FromDOM();
    if (currentStep === 1) return;
    currentStep--;
    renderStep();
    renderStepper();
    renderFooter();
}

function goStep(n) {
    if (n > currentStep) return;
    if (currentStep === 2) saveStep2FromDOM();
    if (currentStep === 1) saveStep1FromDOM();
    currentStep = n;
    renderStep();
    renderStepper();
    renderFooter();
}

// ─── SAVE DOM STATE ────────────────────────────────────────────────
function saveStep1FromDOM() {
    var el = function(id) { return document.getElementById(id); };
    formData.name = el('formName')?.value?.trim() || '';
    formData.description = el('formDesc')?.value?.trim() || '';
    formData.category = el('formCategory')?.value || '';
    formData.startDate = el('startDate')?.value || '';
    formData.endDate = el('endDate')?.value || '';
    if (USER_ROLE === 'Admin') {
        formData.pinAsReady = el('pinReady')?.checked || false;
    }
}

function saveStep2FromDOM() {
    formData.sections.forEach((sec, si) => {
        const titleEl = document.querySelector('[data-section="' + si + '"] .section-title-input');
        if (titleEl) sec.title = titleEl.value.trim() || sec.title;
        sec.questions.forEach((q, qi) => {
            const qEl = document.querySelector('[data-section="' + si + '"] [data-qi="' + qi + '"]');
            if (!qEl) return;
            const textIn = qEl.querySelector('.q-text-input');
            if (textIn) q.text = textIn.value;
            const typeIn = qEl.querySelector('.q-type-select');
            if (typeIn) q.type = typeIn.value;
            const reqIn = qEl.querySelector('.q-required-toggle');
            if (reqIn) q.required = reqIn.checked;

            if (['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type)) {
                q.options = [];
                qEl.querySelectorAll('.q-option-input').forEach(inp => {
                    if (inp.value.trim()) q.options.push(inp.value.trim());
                });
                var otherToggle = qEl.querySelector('.q-enable-other');
                q.enableOther = otherToggle ? otherToggle.checked : !!q.enableOther;
            }
            if (q.type === 'rating') {
                const mr = qEl.querySelector('.q-max-rating');
                if (mr) q.maxRating = parseInt(mr.value) || 5;
            }
            if (q.type === 'table') {
                q.tableRows = []; q.tableCols = [];
                qEl.querySelectorAll('.q-table-row-input').forEach(inp => { if (inp.value.trim()) q.tableRows.push(inp.value.trim()); });
                qEl.querySelectorAll('.q-table-col-input').forEach(inp => { if (inp.value.trim()) q.tableCols.push(inp.value.trim()); });
            }
            if (q.type === 'multiple_choice_grid' || q.type === 'checkbox_grid') {
                q.gridRows = []; q.gridCols = [];
                qEl.querySelectorAll('.q-grid-row-input').forEach(inp => { if (inp.value.trim()) q.gridRows.push(inp.value.trim()); });
                qEl.querySelectorAll('.q-grid-col-input').forEach(inp => { if (inp.value.trim()) q.gridCols.push(inp.value.trim()); });
            }
        });
    });
}

// ─── RENDER STEP ───────────────────────────────────────────────────
function renderStep() {
    const body = document.getElementById('wizardBody');
    if (!body) return;
    try {
        var html = '';
        if (currentStep === 1) html = renderStep1();
        else if (currentStep === 2) html = renderStep2();
        else html = renderStep3();
        body.innerHTML = html;
    } catch (e) {
        console.error('Render step ' + currentStep + ' error:', e);
        body.innerHTML = '<div class="text-center py-5 text-danger"><i class="bi bi-exclamation-triangle" style="font-size:48px;"></i><p class="mt-3">حدث خطأ في عرض الخطوة</p><pre style="font-size:12px;direction:ltr;text-align:left;">' + (e.message || e) + '</pre></div>';
    }
}

// ═════ STEP 1 ══════════════════════════════════════════════════════
function renderStep1() {
    var iconItems = Object.keys(FORM_ICONS).map(function(key) {
        return '<div class="icon-picker-item ' + (formData.icon === key ? 'selected' : '') +
            '" onclick="selectIcon(\'' + key + '\', this)">' + FORM_ICONS[key] + '</div>';
    }).join('');

    var catOptions = categories.map(function(c) {
        return '<option value="' + esc(c.name) + '" ' + (formData.category === c.name ? 'selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');

    var catBtns = '';
    if (USER_ROLE === 'Admin') {
        catBtns = ' <button class="cat-action-btn add" onclick="openAddCatModal()"><i class="bi bi-plus"></i> إضافة تصنيف</button>' +
            ' <button class="cat-action-btn del" onclick="deleteSelectedCat()"><i class="bi bi-trash"></i> حذف تصنيف</button>';
    }

    var pinSection = '';
    if (USER_ROLE === 'Admin') {
        pinSection = '<div style="background:var(--sa-50);border:1px solid var(--sa-200);border-radius:12px;padding:16px;margin-top:20px;">' +
            '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" id="pinReady" onchange="togglePinReady()" ' + (formData.pinAsReady ? 'checked' : '') + '>' +
            '<label class="form-check-label" for="pinReady">' +
            '<strong><i class="bi bi-pin-angle" style="margin-left:4px;"></i> تثبيت كنموذج جاهز</strong>' +
            '<div style="font-size:12px;color:var(--gray-500);">سيكون متاح تلقائياً لجميع مستخدمين النظام بدون الحاجة لتحديد مستهدفين</div>' +
            '</label></div></div>';
    }

    var deptCount = formData.targetDeptIds.length;
    var deptLabel = deptCount > 0 ? (deptCount + ' قسم محدد') : 'اختر الأقسام';
    var deptItems = INIT_DEPARTMENTS.map(function(d) {
        var checked = formData.targetDeptIds.includes(d.id);
        return '<div class="ms-item' + (checked ? ' checked' : '') + '" data-id="' + d.id + '" onclick="toggleMsItem(this,\'dept\')">' +
            '<input class="form-check-input" type="checkbox" ' + (checked ? 'checked' : '') + ' style="pointer-events:none;">' +
            '<span>' + esc(d.name) + '</span></div>';
    }).join('');
    var allDeptsChecked = INIT_DEPARTMENTS.length > 0 && formData.targetDeptIds.length === INIT_DEPARTMENTS.length;

    var userCount = formData.targetUserIds.length;
    var userLabel = userCount > 0 ? (userCount + ' مستخدم محدد') : 'اختر المستخدمين';
    var userItems = INIT_USERS.map(function(u) {
        var checked = formData.targetUserIds.includes(u.id);
        return '<div class="ms-item' + (checked ? ' checked' : '') + '" data-id="' + u.id + '" data-name="' + esc(u.fullName) + '" onclick="toggleMsItem(this,\'user\')">' +
            '<input class="form-check-input" type="checkbox" ' + (checked ? 'checked' : '') + ' style="pointer-events:none;">' +
            '<span>' + esc(u.fullName) + '</span><small>(' + esc(u.deptName) + ')</small></div>';
    }).join('');
    var allUsersChecked = INIT_USERS.length > 0 && formData.targetUserIds.length === INIT_USERS.length;

    var targetsDisplay = formData.pinAsReady ? 'none' : 'block';

    return '<div class="section-card"><div class="section-body" style="padding-top:24px;">' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;">عنوان النموذج <span class="text-danger">*</span></label>' +
        '<input type="text" class="form-control form-control-lg" id="formName" placeholder="أدخل عنوان النموذج" value="' + esc(formData.name) + '"></div>' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;">وصف النموذج</label>' +
        '<textarea class="form-control" id="formDesc" rows="3" placeholder="أدخل وصف مختصر للنموذج...">' + esc(formData.description) + '</textarea></div>' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;">التصنيف <span class="text-danger">*</span></label>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        '<select class="form-select" id="formCategory" style="flex:1;min-width:180px;"><option value="">اختر التصنيف</option>' + catOptions + '</select>' + catBtns + '</div></div>' +
        '<div class="mb-3"><label class="form-label" style="font-weight:600;">اختيار الأيقونة</label>' +
        '<div class="icon-picker">' + iconItems + '</div>' +
        '<input type="hidden" id="formIcon" value="' + esc(formData.icon) + '">' +
        '</div>' +
        pinSection +
        '<div id="targetsSection" style="display:' + targetsDisplay + ';">' +
        '<div class="targets-section"><label class="section-label">المستهدفين (أقسام)</label>' +
        '<div class="ms-dropdown" id="deptDropdown">' +
        '<div class="ms-trigger" onclick="toggleMsDropdown(\'deptDropdown\')">' +
        '<span>' + deptLabel + '</span>' +
        (deptCount > 0 ? '<span class="ms-count">' + deptCount + '</span>' : '') +
        '<i class="bi bi-chevron-down" style="font-size:12px;color:#a3a3a3;"></i></div>' +
        '<div class="ms-panel" style="display:none;">' +
        '<div class="ms-all" onclick="toggleAllMs(\'dept\')">' +
        '<input class="form-check-input" type="checkbox" ' + (allDeptsChecked ? 'checked' : '') + ' style="pointer-events:none;">' +
        '<span>تحديد الكل</span></div>' +
        '<div class="ms-list">' + (deptItems || '<div class="ms-empty">لا توجد أقسام</div>') + '</div></div></div></div>' +
        '<div class="targets-section" style="margin-top:16px;"><label class="section-label">المستهدفين (مستخدمين)</label>' +
        '<div class="ms-dropdown" id="userDropdown">' +
        '<div class="ms-trigger" onclick="toggleMsDropdown(\'userDropdown\')">' +
        '<span>' + userLabel + '</span>' +
        (userCount > 0 ? '<span class="ms-count">' + userCount + '</span>' : '') +
        '<i class="bi bi-chevron-down" style="font-size:12px;color:#a3a3a3;"></i></div>' +
        '<div class="ms-panel" style="display:none;">' +
        '<input class="ms-search" type="text" placeholder="ابحث بالاسم..." oninput="filterMsUsers(this.value)">' +
        '<div class="ms-all" onclick="toggleAllMs(\'user\')">' +
        '<input class="form-check-input" type="checkbox" ' + (allUsersChecked ? 'checked' : '') + ' style="pointer-events:none;">' +
        '<span>تحديد الكل</span></div>' +
        '<div class="ms-list" id="userMsList">' + (userItems || '<div class="ms-empty">لا يوجد مستخدمين</div>') + '</div></div></div></div>' +
        '<div class="row mt-3"><div class="col-6"><label class="form-label">تاريخ البداية</label>' +
        '<input type="date" class="form-control" id="startDate" value="' + esc(formData.startDate) + '"></div>' +
        '<div class="col-6"><label class="form-label">تاريخ النهاية</label>' +
        '<input type="date" class="form-control" id="endDate" value="' + esc(formData.endDate) + '"></div></div>' +
        '</div></div></div>';
}

function selectIcon(key, el) {
    formData.icon = key;
    document.querySelectorAll('.icon-picker-item').forEach(i => i.classList.remove('selected'));
    if (el) el.classList.add('selected');
    const hidden = document.getElementById('formIcon');
    if (hidden) hidden.value = key;
}

function togglePinReady() {
    formData.pinAsReady = document.getElementById('pinReady')?.checked || false;
    const ts = document.getElementById('targetsSection');
    if (ts) ts.style.display = formData.pinAsReady ? 'none' : 'block';
    renderFooter();
}

function openAddCatModal() {
    document.getElementById('newCatName').value = '';
    new bootstrap.Modal(document.getElementById('addCatModal')).show();
}

async function addCategory() {
    var name = document.getElementById('newCatName')?.value?.trim();
    if (!name) { showToast('اسم التصنيف مطلوب', 'warning'); return; }
    var r = await apiFetch('/FormBuilder/AddCategory', 'POST', { name: name });
    if (r && r.success) {
        categories.push(r.data);
        bootstrap.Modal.getInstance(document.getElementById('addCatModal')).hide();
        showToast('تم إضافة التصنيف');
        saveStep1FromDOM();
        formData.category = r.data.name;
        renderStep();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
}

function deleteSelectedCat() {
    var sel = document.getElementById('formCategory');
    var selectedName = sel ? sel.value : '';
    if (!selectedName) { showToast('اختر تصنيف أولاً لحذفه', 'warning'); return; }
    var cat = categories.find(function(c) { return c.name === selectedName; });
    if (!cat) { showToast('التصنيف غير موجود', 'warning'); return; }
    pendingDeleteCatId = cat.id;
    document.getElementById('deleteCatName').textContent = selectedName;
    new bootstrap.Modal(document.getElementById('deleteCatModal')).show();
}

var pendingDeleteCatId = 0;

async function confirmDeleteCategory() {
    if (!pendingDeleteCatId) return;
    var r = await apiFetch('/FormBuilder/DeleteCategory', 'POST', { id: pendingDeleteCatId });
    if (r && r.success) {
        categories = categories.filter(function(c) { return c.id !== pendingDeleteCatId; });
        bootstrap.Modal.getInstance(document.getElementById('deleteCatModal')).hide();
        showToast('تم حذف التصنيف');
        saveStep1FromDOM();
        if (formData.category) {
            var stillExists = categories.some(function(c) { return c.name === formData.category; });
            if (!stillExists) formData.category = '';
        }
        renderStep();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
    pendingDeleteCatId = 0;
}

// ─── MULTI-SELECT DROPDOWN ──────────────────────────────────────────
function toggleMsDropdown(id) {
    var dd = document.getElementById(id);
    if (!dd) return;
    var panel = dd.querySelector('.ms-panel');
    var trigger = dd.querySelector('.ms-trigger');
    var isOpen = panel.style.display !== 'none';
    closeAllMsDropdowns();
    if (!isOpen) {
        panel.style.display = 'flex';
        trigger.classList.add('open');
    }
}

function closeAllMsDropdowns() {
    document.querySelectorAll('.ms-panel').forEach(function(p) { p.style.display = 'none'; });
    document.querySelectorAll('.ms-trigger').forEach(function(t) { t.classList.remove('open'); });
}

function toggleMsItem(el, type) {
    var id = parseInt(el.getAttribute('data-id'));
    var cb = el.querySelector('input[type=checkbox]');
    var arr = type === 'dept' ? formData.targetDeptIds : formData.targetUserIds;
    var idx = arr.indexOf(id);
    if (idx >= 0) { arr.splice(idx, 1); el.classList.remove('checked'); cb.checked = false; }
    else { arr.push(id); el.classList.add('checked'); cb.checked = true; }
    updateMsTrigger(type);
    updateMsAllCheckbox(type);
}

function toggleAllMs(type) {
    var items = type === 'dept' ? INIT_DEPARTMENTS : INIT_USERS;
    var arr = type === 'dept' ? formData.targetDeptIds : formData.targetUserIds;
    var allSelected = arr.length === items.length;
    if (allSelected) {
        if (type === 'dept') formData.targetDeptIds = []; else formData.targetUserIds = [];
    } else {
        var allIds = items.map(function(i) { return i.id; });
        if (type === 'dept') formData.targetDeptIds = allIds.slice(); else formData.targetUserIds = allIds.slice();
    }
    var ddId = type === 'dept' ? 'deptDropdown' : 'userDropdown';
    var dd = document.getElementById(ddId);
    if (dd) {
        var newArr = type === 'dept' ? formData.targetDeptIds : formData.targetUserIds;
        dd.querySelectorAll('.ms-item').forEach(function(el) {
            var itemId = parseInt(el.getAttribute('data-id'));
            var cb = el.querySelector('input[type=checkbox]');
            if (newArr.includes(itemId)) { el.classList.add('checked'); cb.checked = true; }
            else { el.classList.remove('checked'); cb.checked = false; }
        });
    }
    updateMsTrigger(type);
    updateMsAllCheckbox(type);
}

function updateMsTrigger(type) {
    var ddId = type === 'dept' ? 'deptDropdown' : 'userDropdown';
    var dd = document.getElementById(ddId);
    if (!dd) return;
    var arr = type === 'dept' ? formData.targetDeptIds : formData.targetUserIds;
    var label = type === 'dept'
        ? (arr.length > 0 ? arr.length + ' قسم محدد' : 'اختر الأقسام')
        : (arr.length > 0 ? arr.length + ' مستخدم محدد' : 'اختر المستخدمين');
    var trigger = dd.querySelector('.ms-trigger');
    trigger.innerHTML = '<span>' + label + '</span>' +
        (arr.length > 0 ? '<span class="ms-count">' + arr.length + '</span>' : '') +
        '<i class="bi bi-chevron-down" style="font-size:12px;color:#a3a3a3;"></i>';
}

function updateMsAllCheckbox(type) {
    var ddId = type === 'dept' ? 'deptDropdown' : 'userDropdown';
    var dd = document.getElementById(ddId);
    if (!dd) return;
    var items = type === 'dept' ? INIT_DEPARTMENTS : INIT_USERS;
    var arr = type === 'dept' ? formData.targetDeptIds : formData.targetUserIds;
    var allCb = dd.querySelector('.ms-all input[type=checkbox]');
    if (allCb) allCb.checked = items.length > 0 && arr.length === items.length;
}

function filterMsUsers(query) {
    var list = document.getElementById('userMsList');
    if (!list) return;
    var q = query.trim().toLowerCase();
    list.querySelectorAll('.ms-item').forEach(function(el) {
        var name = (el.getAttribute('data-name') || '').toLowerCase();
        el.style.display = (!q || name.indexOf(q) >= 0) ? 'flex' : 'none';
    });
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.ms-dropdown')) closeAllMsDropdowns();
});

// ═════ STEP 2 ══════════════════════════════════════════════════════
function renderStep2() {
    let html = formData.sections.map((sec, si) => {
        const canDelete = formData.sections.length > 1;
        const deleteBtn = canDelete
            ? '<button onclick="removeSection(' + si + ')" style="background:none;border:none;color:#dc3545;opacity:.6;cursor:pointer;"><i class="bi bi-trash" style="font-size:18px;"></i></button>'
            : '';
        let questionsHtml = sec.questions.map((q, qi) => renderQCard(q, si, qi)).join('');
        return '<div class="section-card" data-section="' + si + '">' +
            '<div class="section-header">' +
            '<input class="section-title-input" value="' + esc(sec.title) + '" placeholder="عنوان القسم">' +
            deleteBtn + '</div>' +
            '<div class="section-body">' + questionsHtml +
            '<div class="add-q-btn" onclick="addQuestion(' + si + ')">' +
            '<i class="bi bi-plus-circle" style="font-size:18px;"></i> إضافة سؤال</div>' +
            '</div></div>';
    }).join('');

    html += '<div class="add-q-btn" style="border-style:dashed;margin-top:8px;" onclick="addSection()">' +
        '<i class="bi bi-plus-lg"></i> إضافة قسم جديد</div>';
    return html;
}

function renderQCard(q, si, qi) {
    const typeOptions = QUESTION_TYPES.map(t =>
        '<option value="' + t.value + '" ' + (q.type === t.value ? 'selected' : '') + '>' + t.label + '</option>'
    ).join('');

    var validationHtml = '';
    if (q.type === 'short_answer') {
        validationHtml = '<div class="q-options" style="padding-right:44px;">' +
            '<small style="color:#737373;"><i class="bi bi-info-circle" style="margin-left:4px;"></i> الحد الأقصى: 255 حرف</small></div>';
    } else if (q.type === 'paragraph') {
        validationHtml = '<div class="q-options" style="padding-right:44px;">' +
            '<small style="color:#737373;"><i class="bi bi-info-circle" style="margin-left:4px;"></i> الحد الأقصى: 1000 حرف</small></div>';
    }

    var optionsHtml = '';
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type)) {
        const iconChar = q.type === 'multiple_choice' ? '○' : q.type === 'checkboxes' ? '☐' : '▾';
        const opts = (q.options && q.options.length) ? q.options : [''];
        optionsHtml = '<div class="q-options">' + opts.map((o, oi) =>
            '<div class="q-option-row">' +
            '<span class="q-option-icon">' + iconChar + '</span>' +
            '<input class="q-option-input" value="' + esc(o) + '" placeholder="خيار ' + (oi + 1) + '">' +
            '<button class="q-option-remove" onclick="removeOption(' + si + ',' + qi + ',' + oi + ')"><i class="bi bi-x"></i></button></div>'
        ).join('') +
        '<button class="q-add-option" onclick="addOption(' + si + ',' + qi + ')">' +
        '<i class="bi bi-plus"></i> إضافة خيار</button>' +
        '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #e5e7eb;">' +
        '<div class="form-check form-switch">' +
        '<input class="form-check-input q-enable-other" type="checkbox" id="other_' + si + '_' + qi + '" ' + (q.enableOther ? 'checked' : '') + '>' +
        '<label class="form-check-label" for="other_' + si + '_' + qi + '" style="font-size:13px;font-weight:600;">تفعيل خيار "أخرى"</label>' +
        '</div>' +
        '</div>' +
        '</div>';
    } else if (q.type === 'rating') {
        optionsHtml = '<div class="q-options"><label style="font-size:13px;font-weight:600;margin-left:8px;">عدد النجوم:</label>' +
            '<input type="number" class="form-control form-control-sm q-max-rating" min="3" max="10" value="' + (q.maxRating || 5) + '" style="width:80px;display:inline-block;"></div>';
    } else if (q.type === 'table') {
        const rows = q.tableRows || [''];
        const cols = q.tableCols || [''];
        optionsHtml = '<div class="q-options">' +
            '<label style="font-size:13px;font-weight:600;">صفوف الجدول:</label>' +
            rows.map((r, ri) => '<div class="grid-inputs-row"><input class="form-control form-control-sm q-table-row-input" value="' + esc(r) + '" placeholder="صف ' + (ri + 1) + '">' +
            '<button class="btn btn-outline-danger btn-sm" onclick="removeTableRow(' + si + ',' + qi + ',' + ri + ')"><i class="bi bi-x"></i></button></div>').join('') +
            '<button class="q-add-option" onclick="addTableRow(' + si + ',' + qi + ')"><i class="bi bi-plus"></i> إضافة صف</button>' +
            '<label style="font-size:13px;font-weight:600;margin-top:12px;display:block;">أعمدة الجدول:</label>' +
            cols.map((c, ci) => '<div class="grid-inputs-row"><input class="form-control form-control-sm q-table-col-input" value="' + esc(c) + '" placeholder="عمود ' + (ci + 1) + '">' +
            '<button class="btn btn-outline-danger btn-sm" onclick="removeTableCol(' + si + ',' + qi + ',' + ci + ')"><i class="bi bi-x"></i></button></div>').join('') +
            '<button class="q-add-option" onclick="addTableCol(' + si + ',' + qi + ')"><i class="bi bi-plus"></i> إضافة عمود</button></div>';
    } else if (q.type === 'multiple_choice_grid' || q.type === 'checkbox_grid') {
        const rows = q.gridRows || [''];
        const cols = q.gridCols || [''];
        optionsHtml = '<div class="q-options">' +
            '<label style="font-size:13px;font-weight:600;">صفوف الشبكة:</label>' +
            rows.map((r, ri) => '<div class="grid-inputs-row"><input class="form-control form-control-sm q-grid-row-input" value="' + esc(r) + '" placeholder="صف ' + (ri + 1) + '">' +
            '<button class="btn btn-outline-danger btn-sm" onclick="removeGridRow(' + si + ',' + qi + ',' + ri + ')"><i class="bi bi-x"></i></button></div>').join('') +
            '<button class="q-add-option" onclick="addGridRow(' + si + ',' + qi + ')"><i class="bi bi-plus"></i> إضافة صف</button>' +
            '<label style="font-size:13px;font-weight:600;margin-top:12px;display:block;">أعمدة الشبكة:</label>' +
            cols.map((c, ci) => '<div class="grid-inputs-row"><input class="form-control form-control-sm q-grid-col-input" value="' + esc(c) + '" placeholder="عمود ' + (ci + 1) + '">' +
            '<button class="btn btn-outline-danger btn-sm" onclick="removeGridCol(' + si + ',' + qi + ',' + ci + ')"><i class="bi bi-x"></i></button></div>').join('') +
            '<button class="q-add-option" onclick="addGridCol(' + si + ',' + qi + ')"><i class="bi bi-plus"></i> إضافة عمود</button></div>';
    }

    return '<div class="q-card" data-qi="' + qi + '">' +
        '<div class="q-top">' +
        '<div class="q-num">' + (qi + 1) + '</div>' +
        '<input class="q-text-input" value="' + esc(q.text) + '" placeholder="نص السؤال">' +
        '<select class="q-type-select" onchange="changeQType(' + si + ',' + qi + ',this.value)">' + typeOptions + '</select></div>' +
        validationHtml + optionsHtml +
        '<div class="q-footer">' +
        '<div class="form-check form-switch"><input class="form-check-input q-required-toggle" type="checkbox" id="req_' + si + '_' + qi + '" ' + (q.required ? 'checked' : '') + '>' +
        '<label class="form-check-label" for="req_' + si + '_' + qi + '" style="font-size:13px;font-weight:600;">مطلوب</label></div>' +
        '<button class="q-delete-btn" onclick="removeQuestion(' + si + ',' + qi + ')"><i class="bi bi-trash"></i> حذف</button>' +
        '</div></div>';
}

function addSection() {
    saveStep2FromDOM();
    formData.sections.push({ id: sid(), title: 'قسم ' + (formData.sections.length + 1), questions: [] });
    renderStep();
}

function removeSection(si) {
    if (formData.sections.length <= 1) { showToast('يجب أن يحتوي النموذج على قسم واحد على الأقل', 'warning'); return; }
    saveStep2FromDOM();
    formData.sections.splice(si, 1);
    renderStep();
}

function addQuestion(si) {
    saveStep2FromDOM();
    formData.sections[si].questions.push({
        id: qid(), text: '', type: 'short_answer', required: false, options: [], enableOther: false
    });
    renderStep();
}

function removeQuestion(si, qi) {
    saveStep2FromDOM();
    formData.sections[si].questions.splice(qi, 1);
    renderStep();
}

function changeQType(si, qi, newType) {
    saveStep2FromDOM();
    const q = formData.sections[si].questions[qi];
    q.type = newType;
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(newType) && (!q.options || !q.options.length)) {
        q.options = ['خيار 1'];
    }
    if (!['multiple_choice', 'checkboxes', 'dropdown'].includes(newType)) {
        q.enableOther = false;
    } else if (typeof q.enableOther !== 'boolean') {
        q.enableOther = false;
    }
    if (newType === 'rating' && !q.maxRating) q.maxRating = 5;
    if (newType === 'table') { if (!q.tableRows) q.tableRows = ['']; if (!q.tableCols) q.tableCols = ['']; }
    if (newType === 'multiple_choice_grid' || newType === 'checkbox_grid') {
        if (!q.gridRows) q.gridRows = ['']; if (!q.gridCols) q.gridCols = [''];
    }
    renderStep();
}

function addOption(si, qi) { saveStep2FromDOM(); formData.sections[si].questions[qi].options.push(''); renderStep(); }
function removeOption(si, qi, oi) { saveStep2FromDOM(); formData.sections[si].questions[qi].options.splice(oi, 1); renderStep(); }
function addTableRow(si, qi) { saveStep2FromDOM(); if (!formData.sections[si].questions[qi].tableRows) formData.sections[si].questions[qi].tableRows = []; formData.sections[si].questions[qi].tableRows.push(''); renderStep(); }
function removeTableRow(si, qi, ri) { saveStep2FromDOM(); formData.sections[si].questions[qi].tableRows.splice(ri, 1); renderStep(); }
function addTableCol(si, qi) { saveStep2FromDOM(); if (!formData.sections[si].questions[qi].tableCols) formData.sections[si].questions[qi].tableCols = []; formData.sections[si].questions[qi].tableCols.push(''); renderStep(); }
function removeTableCol(si, qi, ci) { saveStep2FromDOM(); formData.sections[si].questions[qi].tableCols.splice(ci, 1); renderStep(); }
function addGridRow(si, qi) { saveStep2FromDOM(); if (!formData.sections[si].questions[qi].gridRows) formData.sections[si].questions[qi].gridRows = []; formData.sections[si].questions[qi].gridRows.push(''); renderStep(); }
function removeGridRow(si, qi, ri) { saveStep2FromDOM(); formData.sections[si].questions[qi].gridRows.splice(ri, 1); renderStep(); }
function addGridCol(si, qi) { saveStep2FromDOM(); if (!formData.sections[si].questions[qi].gridCols) formData.sections[si].questions[qi].gridCols = []; formData.sections[si].questions[qi].gridCols.push(''); renderStep(); }
function removeGridCol(si, qi, ci) { saveStep2FromDOM(); formData.sections[si].questions[qi].gridCols.splice(ci, 1); renderStep(); }

// ═════ STEP 3 — PREVIEW ═══════════════════════════════════════════
function renderStep3() {
    const totalQ = formData.sections.reduce((s, sec) => s + sec.questions.length, 0);

    let topCard = '<div class="section-card" style="text-align:center;padding:32px 24px;">' +
        '<div style="width:64px;height:64px;border-radius:50%;background:var(--sa-600);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#fff;">' +
        iconSvg(formData.icon, 28) + '</div>' +
        '<div style="font-weight:700;font-size:20px;color:var(--gold-600);">' + esc(formData.name) + '</div>' +
        (formData.description ? '<div style="color:#6c757d;font-size:14px;margin-top:4px;">' + esc(formData.description) + '</div>' : '');

    if (formData.pinAsReady) {
        topCard += '<div style="background:var(--sa-50);border:1px solid var(--sa-200);border-radius:12px;padding:16px;margin-top:20px;display:flex;align-items:center;gap:12px;justify-content:center;">' +
            '<i class="bi bi-pin-angle-fill" style="font-size:24px;color:var(--sa-700);"></i>' +
            '<div><strong>نموذج جاهز</strong> — متاح لجميع المستخدمين<br><small style="color:var(--gray-500);">' + totalQ + ' سؤال</small></div></div>';
    } else {
        const selectedDepts = INIT_DEPARTMENTS.filter(d => formData.targetDeptIds.includes(d.id));
        const selectedUsers = INIT_USERS.filter(u => formData.targetUserIds.includes(u.id));

        topCard += '<div class="row g-3 mt-3">' +
            '<div class="col-md-4"><div class="preview-card" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:var(--sa-600);">' + totalQ + '</div><div style="font-size:13px;color:#6c757d;">عدد الأسئلة</div></div></div>' +
            '<div class="col-md-4"><div class="preview-card" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:var(--gold-600);">' + selectedDepts.length + '</div><div style="font-size:13px;color:#6c757d;">أقسام مستهدفة</div></div></div>' +
            '<div class="col-md-4"><div class="preview-card" style="text-align:center;"><div style="font-size:28px;font-weight:800;color:var(--info-600);">' + selectedUsers.length + '</div><div style="font-size:13px;color:#6c757d;">مستخدمين مستهدفين</div></div></div></div>';

        if (selectedDepts.length) {
            topCard += '<div style="margin-top:16px;"><strong style="font-size:13px;">الأقسام:</strong> ' +
                selectedDepts.map(d => '<span class="badge bg-secondary-subtle text-secondary" style="margin:2px;">' + esc(d.name) + '</span>').join('') + '</div>';
        }
        if (selectedUsers.length) {
            topCard += '<div style="margin-top:8px;"><strong style="font-size:13px;">المستخدمين:</strong> ' +
                selectedUsers.map(u => '<span class="badge bg-primary-subtle text-primary" style="margin:2px;">' + esc(u.fullName) + '</span>').join('') + '</div>';
        }
        if (formData.startDate || formData.endDate) {
            topCard += '<div style="margin-top:8px;font-size:13px;color:#6c757d;"><i class="bi bi-calendar3" style="margin-left:4px;"></i> ';
            if (formData.startDate) topCard += 'من ' + formData.startDate + ' ';
            if (formData.endDate) topCard += 'إلى ' + formData.endDate;
            topCard += '</div>';
        }
    }
    topCard += '</div>';

    let questionsPreview = '';
    let globalQNum = 0;
    formData.sections.forEach((sec) => {
        sec.questions.forEach((q) => {
            globalQNum++;
            questionsPreview += renderPreviewCard(q, globalQNum);
        });
    });

    return topCard + questionsPreview;
}

function renderPreviewCard(q, num) {
    let field = '';
    var showOther = !!q.enableOther && ['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type);
    switch (q.type) {
        case 'short_answer':
            field = '<input type="text" class="form-control" disabled placeholder="إجابة قصيرة" maxlength="255" style="max-width:400px;">' +
                '<small class="text-muted">الحد الأقصى: 255 حرف</small>';
            break;
        case 'paragraph':
            field = '<textarea class="form-control" rows="2" disabled placeholder="نص الفقرة" maxlength="1000"></textarea>' +
                '<small class="text-muted">الحد الأقصى: 1000 حرف</small>';
            break;
        case 'multiple_choice':
            field = (q.options || []).map(o =>
                '<div class="form-check"><input class="form-check-input" type="radio" disabled><label class="form-check-label">' + esc(o) + '</label></div>'
            ).join('') + (showOther
                ? '<div class="form-check"><input class="form-check-input" type="radio" disabled><label class="form-check-label">أخرى</label></div>' +
                  '<input type="text" class="form-control mt-2" disabled placeholder="اكتب خيارًا آخر..." style="max-width:320px;">'
                : '');
            break;
        case 'checkboxes':
            field = (q.options || []).map(o =>
                '<div class="form-check"><input class="form-check-input" type="checkbox" disabled><label class="form-check-label">' + esc(o) + '</label></div>'
            ).join('') + (showOther
                ? '<div class="form-check"><input class="form-check-input" type="checkbox" disabled><label class="form-check-label">أخرى</label></div>' +
                  '<input type="text" class="form-control mt-2" disabled placeholder="اكتب خيارًا آخر..." style="max-width:320px;">'
                : '');
            break;
        case 'dropdown':
            field = '<select class="form-select" disabled style="max-width:300px;"><option>اختر...</option>' +
                (q.options || []).map(o => '<option>' + esc(o) + '</option>').join('') +
                (showOther ? '<option>أخرى</option>' : '') +
                '</select>' +
                (showOther ? '<input type="text" class="form-control mt-2" disabled placeholder="اكتب خيارًا آخر..." style="max-width:320px;">' : '');
            break;
        case 'date_only':
            field = '<input type="date" class="form-control" disabled style="max-width:200px;">';
            break;
        case 'date_time':
            field = '<input type="datetime-local" class="form-control" disabled style="max-width:220px;">';
            break;
        case 'file_upload':
            field = '<input type="file" class="form-control" disabled>' +
                '<small class="text-muted">PDF، Word، صور</small>';
            break;
        case 'rating': {
            const stars = q.maxRating || 5;
            field = '<div style="font-size:22px;color:#e5e5e5;">' +
                Array(stars).fill('<i class="bi bi-star"></i>').join(' ') +
                '</div><small class="text-muted">' + stars + ' نجوم</small>';
            break;
        }
        case 'table': {
            const tr = q.tableRows || [];
            const tc = q.tableCols || [];
            if (tr.length && tc.length) {
                field = '<div class="table-responsive"><table class="table table-bordered table-sm"><thead><tr><th></th>' +
                    tc.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
                    tr.map(r => '<tr><td style="font-weight:600;">' + esc(r) + '</td>' +
                    tc.map(() => '<td><input class="form-control form-control-sm" disabled></td>').join('') + '</tr>').join('') +
                    '</tbody></table></div>';
            } else {
                field = '<small class="text-muted">جدول بدون بيانات</small>';
            }
            break;
        }
        case 'multiple_choice_grid':
        case 'checkbox_grid': {
            const gr = q.gridRows || [];
            const gc = q.gridCols || [];
            const inputType = q.type === 'multiple_choice_grid' ? 'radio' : 'checkbox';
            if (gr.length && gc.length) {
                field = '<div class="table-responsive"><table class="table table-bordered table-sm"><thead><tr><th></th>' +
                    gc.map(c => '<th class="text-center">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
                    gr.map((r, ri) => '<tr><td style="font-weight:600;">' + esc(r) + '</td>' +
                    gc.map(() => '<td class="text-center"><input type="' + inputType + '" disabled' + (inputType === 'radio' ? ' name="grid_' + ri + '"' : '') + '></td>').join('') + '</tr>').join('') +
                    '</tbody></table></div>';
            } else {
                field = '<small class="text-muted">شبكة بدون بيانات</small>';
            }
            break;
        }
        default:
            field = '<input type="text" class="form-control" disabled>';
    }

    return '<div class="preview-card">' +
        '<div style="margin-bottom:12px;"><span class="preview-q-num">' + num + '</span>' +
        '<span style="font-weight:700;font-size:15px;">' + esc(q.text) + (q.required ? ' <span class="text-danger">*</span>' : '') + '</span></div>' +
        field + '</div>';
}

// ─── PUBLISH ───────────────────────────────────────────────────────
async function publishForm() {
    if (!formData.pinAsReady && !formData.targetDeptIds.length && !formData.targetUserIds.length) {
        showToast('حدد مستهدفين للنموذج (ارجع للخطوة الأولى)', 'warning');
        return;
    }

    const payload = {
        editId: EDIT_FORM_ID || 0,
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        category: formData.category,
        sectionsJson: JSON.stringify(formData.sections),
        pinAsReady: formData.pinAsReady,
        targetDepartmentIds: formData.targetDeptIds,
        targetUserIds: formData.targetUserIds,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null
    };

    const btn = document.querySelector('.wizard-footer .btn-next');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm" style="margin-left:8px;"></span> جاري النشر...'; }

    const r = await apiFetch('/FormBuilder/Publish', 'POST', payload);
    if (r && r.success) {
        showToast(r.message || 'تم بنجاح');
        setTimeout(() => { window.location.href = r.redirect || '/Outbox/Index'; }, 1200);
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
        if (btn) { btn.disabled = false; renderFooter(); }
    }
}

document.addEventListener('DOMContentLoaded', init);
