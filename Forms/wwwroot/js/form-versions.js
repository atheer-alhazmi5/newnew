'use strict';

/**
 * إدارة صفحة "إصدارات نسخ النموذج".
 * تعتمد على form-definitions.js لإعادة استخدام معالج الحقول/المنطق/المعاينة في وضع الإصدار.
 */

let fdvData = [];
let fdvIsAdmin = false;
let fdvDeleteId = null;
let fdvDeleteName = '';
let fdvFormMeta = { id: 0, name: '', publicId: '' };

function fdvInit() {
    const hidEl = document.getElementById('fdvFormId');
    const fid = hidEl ? parseInt(hidEl.value || '0', 10) : 0;
    fdvFormMeta.id = fid || 0;
    fdvLoad();
}

async function fdvLoad() {
    const fid = fdvFormMeta.id;
    if (!fid) return;
    try {
        const res = await apiFetch(`/FormDefinitionVersions/GetVersions?formId=${fid}`);
        if (!res || !res.success) {
            document.getElementById('fdvBody').innerHTML =
                `<tr><td colspan="12" class="text-center py-4 text-danger">${esc((res && res.message) || 'خطأ في تحميل البيانات')}</td></tr>`;
            return;
        }
        fdvData = res.data || [];
        fdvIsAdmin = !!res.isAdmin;
        if (res.form) fdvFormMeta = { id: res.form.id, name: res.form.name || '', publicId: res.form.publicId || '' };
        fdvRenderTable();
    } catch (e) {
        document.getElementById('fdvBody').innerHTML =
            '<tr><td colspan="12" class="text-center py-4 text-danger">خطأ في الاتصال بالخادم</td></tr>';
    }
}

function fdvRenderTable() {
    const tbody = document.getElementById('fdvBody');
    if (!tbody) return;
    if (!fdvData.length) {
        tbody.innerHTML = `<tr><td colspan="12"><div class="fdv-empty-state"><i class="bi bi-layers"></i><p>لا توجد إصدارات بعد</p></div></td></tr>`;
        return;
    }
    let html = '';
    fdvData.forEach((v, idx) => {
        const statusBadge = v.status === 'approved'
            ? '<span class="fdv-badge fdv-badge-approved"><i class="bi bi-check-circle-fill"></i>معتمد</span>'
            : '<span class="fdv-badge fdv-badge-draft"><i class="bi bi-pencil-fill"></i>مسودة</span>';
        const activeBadge = v.isActive
            ? '<span class="fdv-badge fdv-badge-active"><i class="bi bi-toggle-on"></i>مفعل</span>'
            : '<span class="fdv-badge fdv-badge-inactive"><i class="bi bi-toggle-off"></i>غير مفعل</span>';
        html += `<tr>
            <td style="text-align:center;font-weight:700;color:var(--gray-400);">${idx + 1}</td>
            <td><span class="fdv-version-name">${esc(v.versionName)}</span></td>
            <td style="text-align:center;font-weight:700;">${v.fieldsCount}</td>
            <td style="text-align:center;font-weight:700;">${v.sectionsCount}</td>
            <td style="text-align:center;font-weight:700;">${v.rulesCount}</td>
            <td>${esc(v.createdBy || '')}</td>
            <td>${esc(v.createdAt || '')}</td>
            <td>${esc(v.updatedBy || '—')}</td>
            <td>${esc(v.updatedAt || '—')}</td>
            <td style="text-align:center;">${statusBadge}</td>
            <td style="text-align:center;">${activeBadge}</td>
            <td style="text-align:center;">${fdvActions(v)}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

function fdvActions(v) {
    let h = '<div class="d-flex gap-1 justify-content-center flex-wrap">';
    if (v.status === 'approved') {
        // الإصدار المعتمد: تفاصيل فقط
        h += `<button class="fdv-action-btn fdv-action-btn-detail" onclick="fdvShowDetails(${v.id})"><i class="bi bi-eye"></i> تفاصيل</button>`;
    } else {
        // الإصدار المسودة: تحديث وحذف
        h += `<button class="fdv-action-btn fdv-action-btn-edit" onclick="fdvEditVersion(${v.id})"><i class="bi bi-pencil-square"></i> تحديث</button>`;
        h += `<button class="fdv-action-btn fdv-action-btn-delete" onclick="fdvShowDelete(${v.id},'${esc(v.versionName).replace(/'/g,'\\\'')}')"><i class="bi bi-trash3"></i> حذف</button>`;
    }
    return h + '</div>';
}

// ─── إنشاء نسخة جديدة (يستخدم معالج form-definitions.js في وضع الإصدار) ─────
async function fdvCreateNewVersion() {
    const fid = fdvFormMeta.id;
    if (!fid) return showToast('النموذج غير محدد', 'error');
    try {
        // جلب بيانات النموذج (للقالب) + لقطة الإصدار النشط (لبدء التعديل عليها)
        const formRes = await apiFetch(`/FormDefinitions/GetFormDefinition?id=${fid}`);
        if (!formRes || !formRes.success) return showToast(formRes && formRes.message || 'تعذر تحميل بيانات النموذج', 'error');
        const formData = formRes.data;

        const activeRes = await apiFetch(`/FormDefinitionVersions/GetActiveVersionForForm?formId=${fid}`);
        const baseFieldsJson = (activeRes && activeRes.success && activeRes.data && activeRes.data.fieldsJson)
            ? activeRes.data.fieldsJson
            : (formData.fieldsJson || '[]');

        await fdvOpenWizardForVersion({
            formData,
            baseFieldsJson,
            isEdit: false,
            versionId: null,
            versionTitle: 'إنشاء نسخة إصدار جديدة',
            versionSubtitle: `${formData.name || ''} – سيتم ترقيم النسخة تلقائياً`
        });
    } catch (e) {
        showToast('تعذر فتح معالج الإصدار', 'error');
    }
}

async function fdvEditVersion(versionId) {
    try {
        const verRes = await apiFetch(`/FormDefinitionVersions/GetVersion?id=${versionId}`);
        if (!verRes || !verRes.success) return showToast((verRes && verRes.message) || 'تعذر تحميل الإصدار', 'error');
        const verData = verRes.data;
        const formRes = await apiFetch(`/FormDefinitions/GetFormDefinition?id=${verData.formDefinitionId}`);
        if (!formRes || !formRes.success) return showToast((formRes && formRes.message) || 'تعذر تحميل النموذج', 'error');
        const formData = formRes.data;

        await fdvOpenWizardForVersion({
            formData,
            baseFieldsJson: verData.fieldsJson || '[]',
            isEdit: true,
            versionId: verData.id,
            versionTitle: 'تحديث الإصدار',
            versionSubtitle: `${formData.name || ''} – ${verData.versionName}`
        });
    } catch (e) {
        showToast('تعذر فتح معالج الإصدار', 'error');
    }
}

async function fdvOpenWizardForVersion(opts) {
    const { formData, baseFieldsJson, isEdit, versionId, versionTitle, versionSubtitle } = opts;

    // تفعيل وضع الإصدار داخل form-definitions.js
    fdVersionMode = true;
    fdVersionFormId = formData.id;
    fdVersionEditId = isEdit ? versionId : null;
    fdEditId = null;
    fdEditingIdx = -1;
    fdBindingLookupsLoaded = false;
    fdDropdownItemsCache = {};
    fdReadyTableGridCache = {};

    // مزامنة بيانات الخطوة الأولى من النموذج (مطلوبة لـ fdGoStep4 لجلب القالب)
    fdStep1State = {
        name: formData.name || '',
        desc: formData.description || '',
        ownership: formData.ownership || 'عام',
        formClassId: formData.formClassId || 0,
        typeId: formData.formTypeId || 0,
        wsId: formData.workspaceId || 0,
        tplId: formData.templateId || 0,
        titleAppearance: (typeof fdDefaultTitleAppearance === 'function') ? fdDefaultTitleAppearance() : null
    };

    // معاينة القالب (الرأس/التذييل + العلامة المائية) – نفس آلية تحرير النموذج
    try {
        if (typeof fdEnrichTemplateDataWatermark === 'function') {
            fdCurrentTemplate = await fdEnrichTemplateDataWatermark(formData.templateData || null, formData.templateId);
        } else {
            fdCurrentTemplate = formData.templateData || null;
        }
    } catch (e) { fdCurrentTemplate = formData.templateData || null; }

    // تحميل بيانات الحقول/الأقسام/قواعد المنطق إلى المتغيرات العامة
    fdApplyParsedFieldsData(fdParseFieldsJsonPayload(baseFieldsJson));

    // تأكد من تحميل خدمات الربط (القوائم المنسدلة / الجداول الجاهزة) قبل معالجة الحقول
    if (typeof fdEnsureFieldBindingLookups === 'function') {
        try { await fdEnsureFieldBindingLookups(); } catch (e) {}
    }

    // تحديث عنوان المعالج + إظهار النافذة عند الخطوة 2 (بناء الحقول)
    const titleEl = document.getElementById('fdWizardTitle');
    const subEl = document.getElementById('fdWizardSub');
    const headEl = document.getElementById('fdWizardHead');
    if (titleEl) titleEl.textContent = versionTitle;
    if (subEl) subEl.textContent = versionSubtitle;
    if (headEl) headEl.className = 'fd-modal-header ' + (isEdit ? 'edit' : 'create');

    fdStep = 2;
    fdRenderStep();
    fdWizModal().show();
}

// ─── تفاصيل الإصدار ─────────────────────────────────────────────────────────
async function fdvShowDetails(versionId) {
    try {
        const res = await apiFetch(`/FormDefinitionVersions/GetVersion?id=${versionId}`);
        if (!res || !res.success) return showToast((res && res.message) || 'خطأ', 'error');
        const v = res.data;
        let fieldsCount = 0, sectionsCount = 0, rulesCount = 0;
        try {
            const parsed = JSON.parse(v.fieldsJson || '[]');
            if (Array.isArray(parsed)) fieldsCount = parsed.length;
            else if (parsed && typeof parsed === 'object') {
                fieldsCount = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
                sectionsCount = Array.isArray(parsed.sections) ? parsed.sections.length : 0;
                rulesCount = Array.isArray(parsed.rules) ? parsed.rules.length : 0;
            }
        } catch (e) { }
        const status = v.status === 'approved' ? 'معتمد' : 'مسودة';
        const active = v.isActive ? 'مفعل' : 'غير مفعل';
        const html = `<div class="fd-section"><div class="fd-section-title"><i class="bi bi-layers"></i> معلومات الإصدار</div>
            <div class="fd-detail-grid">
                <div class="fd-detail-lbl">اسم الإصدار</div><div class="fd-detail-val">${esc(v.versionName)}</div>
                <div class="fd-detail-lbl">المعرف</div><div class="fd-detail-val">${esc(v.formPublicId || '')}</div>
                <div class="fd-detail-lbl">اسم النموذج</div><div class="fd-detail-val">${esc(v.formName || '')}</div>
                <div class="fd-detail-lbl">عدد الحقول</div><div class="fd-detail-val">${fieldsCount}</div>
                <div class="fd-detail-lbl">عدد الأقسام</div><div class="fd-detail-val">${sectionsCount}</div>
                <div class="fd-detail-lbl">عدد قواعد المنطق</div><div class="fd-detail-val">${rulesCount}</div>
                <div class="fd-detail-lbl">الحالة</div><div class="fd-detail-val">${esc(status)}</div>
                <div class="fd-detail-lbl">التفعيل</div><div class="fd-detail-val">${esc(active)}</div>
                <div class="fd-detail-lbl">أنشئ بواسطة</div><div class="fd-detail-val">${esc(v.createdBy || '—')}</div>
                <div class="fd-detail-lbl">تاريخ الإنشاء</div><div class="fd-detail-val">${esc(v.createdAt || '—')}</div>
                <div class="fd-detail-lbl">التحديث بواسطة</div><div class="fd-detail-val">${esc(v.updatedBy || '—')}</div>
                <div class="fd-detail-lbl">تاريخ التحديث</div><div class="fd-detail-val">${esc(v.updatedAt || '—')}</div>
            </div></div>`;
        const body = document.getElementById('fdvDetailsBody');
        const sub = document.getElementById('fdvDetailsSub');
        if (body) body.innerHTML = html;
        if (sub) sub.textContent = `${v.formName || ''} – ${v.versionName}`;
        const modalEl = document.getElementById('fdvDetailsModal');
        if (modalEl) new bootstrap.Modal(modalEl).show();
    } catch (e) { showToast('خطأ', 'error'); }
}

// ─── حذف ─────────────────────────────────────────────────────────────────────
function fdvShowDelete(id, name) {
    fdvDeleteId = id;
    fdvDeleteName = name || '';
    const nameEl = document.getElementById('fdvDeleteName');
    if (nameEl) nameEl.textContent = fdvDeleteName;
    const modalEl = document.getElementById('fdvDeleteModal');
    if (modalEl) new bootstrap.Modal(modalEl).show();
}

async function fdvSubmitDelete() {
    if (!fdvDeleteId) return;
    try {
        const r = await apiFetch('/FormDefinitionVersions/DeleteVersion', 'POST', { id: fdvDeleteId });
        if (r && r.success) {
            const modalEl = document.getElementById('fdvDeleteModal');
            if (modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
            showToast('تم حذف الإصدار', 'success');
            fdvDeleteId = null;
            fdvDeleteName = '';
            fdvLoad();
        } else showToast((r && r.message) || 'خطأ في الحذف', 'error');
    } catch (e) { showToast('خطأ', 'error'); }
}
