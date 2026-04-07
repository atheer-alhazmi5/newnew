/* ═══════════════════════════════════════════════════════════════
   templates.js  –  إدارة القوالب
   ═══════════════════════════════════════════════════════════════ */
let tpAllData = [];
let tpFiltered = [];
let tpWizardMode = 'create'; // 'create' | 'edit'
let tpEditId = 0;
let tpCurrentStep = 0;
const TP_TOTAL_STEPS = 4;

// Per-section data for header and footer
let tpHeaderData = [{ type:'text', lines:1, align:'center', fontSize:16, bold:true, text:[''], imageUrl:'', imageSize:'medium', imageAlign:'center' }];
let tpFooterData = [{ type:'text', lines:1, align:'center', fontSize:12, bold:false, text:[''], imageUrl:'', imageSize:'medium', imageAlign:'center' }];

/* ── helpers ─────────────────────────────────────────────────── */
async function tpApiFetch(url, method = 'GET', body = null) {
    const tokenMeta = document.querySelector('meta[name="csrf-token"]');
    const token = tokenMeta ? tokenMeta.getAttribute('content') : '';
    const opts = {
        method,
        headers: {
            'X-CSRF-TOKEN': token
        }
    };
    if (body && method !== 'GET') {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    try {
        const res = await fetch(url, opts);
        if (res.redirected) {
            window.location.href = res.url;
            return null;
        }
        const text = await res.text();
        try {
            return text ? JSON.parse(text) : { success: false, message: 'استجابة فارغة' };
        } catch {
            if (!res.ok) return { success: false, message: `خطأ في الخادم (${res.status})` };
            return { success: false, message: 'خطأ في قراءة الاستجابة' };
        }
    } catch {
        return { success: false, message: 'خطأ في الاتصال بالخادم' };
    }
}

function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

/* ── Load & Render ───────────────────────────────────────────── */
async function tpLoad() {
    const r = await tpApiFetch('/Templates/GetTemplates');
    if (r.success) { tpAllData = r.data; tpFiltered = [...tpAllData]; }
    tpRenderTable();
}

function tpRenderTable() {
    const tb = document.getElementById('tpTableBody');
    const badge = document.getElementById('tpCountBadge');
    badge.textContent = `(${tpFiltered.length})`;

    if (!tpFiltered.length) {
        tb.innerHTML = `<tr><td colspan="5"><div class="tp-empty-state"><i class="bi bi-file-earmark-ruled"></i><p>لا توجد قوالب</p></div></td></tr>`;
        return;
    }

    tb.innerHTML = tpFiltered.map((t, i) => `
        <tr>
            <td style="font-weight:700;color:var(--gray-400);">${i + 1}</td>
            <td style="font-weight:700;">${escHtml(t.name)}</td>
            <td><span class="tp-color-swatch" style="background:${t.color};"></span></td>
            <td>
                <label class="tp-toggle">
                    <input type="checkbox" ${t.isActive ? 'checked' : ''} onchange="tpToggleActive(${t.id})">
                    <span class="tp-slider"></span>
                </label>
            </td>
            <td>
                <div class="d-flex gap-2 justify-content-center flex-wrap">
                    <button class="tp-action-btn tp-action-btn-detail" onclick="tpShowDetails(${t.id})"><i class="bi bi-eye"></i> تفاصيل</button>
                    <button class="tp-action-btn tp-action-btn-edit" onclick="tpShowEditModal(${t.id})"><i class="bi bi-pencil"></i> تعديل</button>
                    <button class="tp-action-btn tp-action-btn-delete" onclick="tpShowDeleteModal(${t.id})"><i class="bi bi-trash3"></i> حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

/* ── Filters ─────────────────────────────────────────────────── */
function tpApplyFilters() {
    const q = document.getElementById('tpSearchInput').value.trim().toLowerCase();
    const st = document.getElementById('tpFilterStatus').value;
    tpFiltered = tpAllData.filter(t => {
        if (q && !t.name.toLowerCase().includes(q)) return false;
        if (st === 'true' && !t.isActive) return false;
        if (st === 'false' && t.isActive) return false;
        return true;
    });
    tpRenderTable();
}

function tpClearFilters() {
    document.getElementById('tpSearchInput').value = '';
    document.getElementById('tpFilterStatus').value = '';
    tpFiltered = [...tpAllData];
    tpRenderTable();
}

/* ── Toggle Active ───────────────────────────────────────────── */
async function tpToggleActive(id) {
    await tpApiFetch('/Templates/ToggleTemplate', 'POST', { id });
    tpLoad();
}

/* ═══════════ WIZARD ═══════════════════════════════════════════ */
function tpShowCreateModal() {
    tpWizardMode = 'create';
    tpEditId = 0;
    tpCurrentStep = 0;

    document.getElementById('tpWizardHeader').className = 'tp-modal-header create';
    document.getElementById('tpWizardTitle').textContent = 'إنشاء قالب جديد';
    document.getElementById('tpWizardSubtitle').textContent = 'أدخل بيانات القالب الجديد';

    document.getElementById('tpwName').value = '';
    document.getElementById('tpwDescription').value = '';
    document.getElementById('tpwColor').value = '#25935F';
    document.getElementById('tpwColorHex').textContent = '#25935F';
    document.getElementById('tpwIsActive').checked = true;
    document.getElementById('tpwMarginTop').value = 20;
    document.getElementById('tpwMarginBottom').value = 20;
    document.getElementById('tpwMarginRight').value = 20;
    document.getElementById('tpwMarginLeft').value = 20;
    document.getElementById('tpwPageDirection').value = 'RTL';
    document.getElementById('tpwPageSize').value = 'A4';
    document.getElementById('tpwShowHeaderLine').checked = true;
    document.getElementById('tpwShowFooterLine').checked = true;

    tpHeaderData = [tpDefaultSection(16, true)];
    tpFooterData = [tpDefaultSection(12, false)];

    tpRenderWizardStep();
    tpBuildCountBar('header', 1);
    tpBuildCountBar('footer', 1);
    tpRenderSections('header');
    tpRenderSections('footer');

    new bootstrap.Modal(document.getElementById('tpWizardModal')).show();
}

async function tpShowEditModal(id) {
    const r = await tpApiFetch(`/Templates/GetTemplate?id=${id}`);
    if (!r.success) return;
    const t = r.data;

    tpWizardMode = 'edit';
    tpEditId = id;
    tpCurrentStep = 0;

    document.getElementById('tpWizardHeader').className = 'tp-modal-header edit';
    document.getElementById('tpWizardTitle').textContent = 'تعديل القالب';
    document.getElementById('tpWizardSubtitle').textContent = t.name;

    document.getElementById('tpwName').value = t.name;
    document.getElementById('tpwDescription').value = t.description;
    document.getElementById('tpwColor').value = t.color;
    document.getElementById('tpwColorHex').textContent = t.color;
    document.getElementById('tpwIsActive').checked = t.isActive;
    document.getElementById('tpwMarginTop').value = t.marginTop;
    document.getElementById('tpwMarginBottom').value = t.marginBottom;
    document.getElementById('tpwMarginRight').value = t.marginRight;
    document.getElementById('tpwMarginLeft').value = t.marginLeft;
    document.getElementById('tpwPageDirection').value = t.pageDirection;
    document.getElementById('tpwPageSize').value = t.pageSize;
    document.getElementById('tpwShowHeaderLine').checked = t.showHeaderLine;
    document.getElementById('tpwShowFooterLine').checked = t.showFooterLine;

    try { tpHeaderData = JSON.parse(t.headerJson); } catch { tpHeaderData = [tpDefaultSection(16, true)]; }
    try { tpFooterData = JSON.parse(t.footerJson); } catch { tpFooterData = [tpDefaultSection(12, false)]; }

    if (!tpHeaderData.length) tpHeaderData = [tpDefaultSection(16, true)];
    if (!tpFooterData.length) tpFooterData = [tpDefaultSection(12, false)];

    tpRenderWizardStep();
    tpBuildCountBar('header', tpHeaderData.length);
    tpBuildCountBar('footer', tpFooterData.length);
    tpRenderSections('header');
    tpRenderSections('footer');

    new bootstrap.Modal(document.getElementById('tpWizardModal')).show();
}

function tpDefaultSection(fontSize, bold) {
    return { type: 'text', lines: 1, align: 'center', fontSize: fontSize || 14, bold: bold || false, text: [''], imageUrl: '', logoWidth: 4, logoHeight: 2, imageAlign: 'center' };
}

/* ──  Navigation ───────────────────────────────────────── */
function tpGoToStep(step) {
    if (step < 0 || step >= TP_TOTAL_STEPS) return;
    if (step === 0 || tpCurrentStep >= step) {
        tpCurrentStep = step;
        tpRenderWizardStep();
    }
}

function tpNextStep() {
    if (tpCurrentStep === 0) {
        const name = document.getElementById('tpwName').value.trim();
        if (!name) { alert('اسم القالب مطلوب'); return; }
    }
    if (tpCurrentStep < TP_TOTAL_STEPS - 1) {
        tpCollectCurrentSections();
        tpCurrentStep++;
        tpRenderWizardStep();
        if (tpCurrentStep === 3) tpBuildFullPreview();
    }
}

function tpPrevStep() {
    if (tpCurrentStep > 0) {
        tpCollectCurrentSections();
        tpCurrentStep--;
        tpRenderWizardStep();
    }
}

function tpRenderWizardStep() {
    for (let i = 0; i < TP_TOTAL_STEPS; i++) {
        const panel = document.getElementById(`tpStep${i}`);
        const stepEl = document.querySelector(`.tp-wizard-step[data-step="${i}"]`);
        panel.classList.toggle('active', i === tpCurrentStep);
        stepEl.classList.remove('active', 'done');
        if (i === tpCurrentStep) stepEl.classList.add('active');
        else if (i < tpCurrentStep) stepEl.classList.add('done');
    }
    for (let i = 0; i < TP_TOTAL_STEPS - 1; i++) {
        const line = document.getElementById(`tpLine${i}`);
        if (line) line.classList.toggle('done', i < tpCurrentStep);
    }

    const isFirst = tpCurrentStep === 0;
    const isLast = tpCurrentStep === TP_TOTAL_STEPS - 1;
    document.getElementById('tpBtnNext').style.display = isLast ? 'none' : '';
    document.getElementById('tpBtnSubmit').style.display = isLast ? '' : 'none';
    document.getElementById('tpBtnBack').style.display = isFirst ? 'none' : '';
    document.getElementById('tpBtnSubmit').innerHTML = tpWizardMode === 'edit'
        ? '<i class="bi bi-check-lg"></i> تحديث'
        : '<i class="bi bi-check-lg"></i> حفظ';

    if (tpCurrentStep === 1) { tpRenderSections('header'); tpUpdatePreview('header'); }
    if (tpCurrentStep === 2) { tpRenderSections('footer'); tpUpdatePreview('footer'); }
}

/* ═══════════ SECTION BUILDER ══════════════════════════════════ */
function tpBuildCountBar(zone, selected) {
    const bar = document.getElementById(zone === 'header' ? 'tpHeaderCountBar' : 'tpFooterCountBar');
    let html = '';
    for (let i = 1; i <= 6; i++) {
        html += `<button type="button" class="tp-sec-count-btn ${i === selected ? 'active' : ''}" onclick="tpSetSectionCount('${zone}',${i})">${i}</button>`;
    }
    bar.innerHTML = html;
}

function tpSetSectionCount(zone, count) {
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    tpCollectCurrentSections();
    while (data.length < count) data.push(tpDefaultSection(zone === 'header' ? 16 : 12, zone === 'header'));
    while (data.length > count) data.pop();
    if (zone === 'header') tpHeaderData = data; else tpFooterData = data;
    tpBuildCountBar(zone, count);
    tpRenderSections(zone);
    tpUpdatePreview(zone);
}

function tpRenderSections(zone) {
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    const container = document.getElementById(zone === 'header' ? 'tpHeaderSections' : 'tpFooterSections');
    const cols = data.length <= 3 ? data.length : (data.length <= 4 ? 2 : 3);
    let html = `<div class="tp-sec-grid" style="grid-template-columns:repeat(${cols},1fr);">`;

    data.forEach((sec, idx) => {
        const pfx = `${zone}_${idx}`;
        html += `<div class="tp-sec-card">
            <div class="tp-sec-card-head">
                <span>القسم ${idx + 1}</span>
                <select class="form-select tp-mini-select" id="tp_type_${pfx}" onchange="tpOnTypeChange('${zone}',${idx})">
                    <option value="text" ${sec.type === 'text' ? 'selected' : ''}>نص</option>
                    <option value="logo" ${sec.type === 'logo' ? 'selected' : ''}>شعار (Logo)</option>
                </select>
            </div>
            <div class="tp-sec-card-body" id="tp_body_${pfx}">
                ${tpBuildSectionBody(zone, idx, sec)}
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function tpBuildSectionBody(zone, idx, sec) {
    const pfx = `${zone}_${idx}`;
    if (sec.type === 'logo') {
        const logoW = sec.logoWidth || 4;
        const logoH = sec.logoHeight || 2;
        const preview = sec.imageUrl
            ? `<img src="${escHtml(sec.imageUrl)}" alt="">`
            : `<i class="bi bi-cloud-arrow-up"></i><div>رفع الشعار</div>`;
        return `
            <div class="tp-logo-upload-zone" id="tp_imgzone_${pfx}" onclick="document.getElementById('tp_imgfile_${pfx}').click()">
                ${preview}
            </div>
            <input type="file" accept="image/*" id="tp_imgfile_${pfx}" style="display:none;" onchange="tpUploadImage('${zone}',${idx},this)">
            <div class="tp-logo-size-row">
                <label>العرض (سم)</label>
                <input type="number" id="tp_logoW_${pfx}" value="${logoW}" min="3" max="5" step="0.5" onchange="tpCollectAndPreview('${zone}')">
                <label>الارتفاع (سم)</label>
                <input type="number" id="tp_logoH_${pfx}" value="${logoH}" min="1.5" max="3" step="0.5" onchange="tpCollectAndPreview('${zone}')">
            </div>
            <div style="margin-top:8px;">
                <select class="form-select tp-mini-select" id="tp_imgalign_${pfx}" onchange="tpCollectAndPreview('${zone}')">
                    <option value="right" ${sec.imageAlign === 'right' ? 'selected' : ''}>يمين</option>
                    <option value="center" ${sec.imageAlign === 'center' ? 'selected' : ''}>وسط</option>
                    <option value="left" ${sec.imageAlign === 'left' ? 'selected' : ''}>يسار</option>
                </select>
            </div>`;
    }

    // Text type
    const linesCount = sec.lines || 1;
    let linesHtml = '';
    for (let l = 0; l < linesCount; l++) {
        linesHtml += `<input type="text" class="form-control" style="font-size:12px;padding:6px 10px;border-radius:8px;margin-bottom:4px;" id="tp_text_${pfx}_${l}" value="${escHtml((sec.text && sec.text[l]) || '')}" placeholder="السطر ${l + 1}" oninput="tpCollectAndPreview('${zone}')">`;
    }

    return `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select class="form-select tp-mini-select" id="tp_lines_${pfx}" onchange="tpOnLinesChange('${zone}',${idx})">
                <option value="1" ${linesCount === 1 ? 'selected' : ''}>سطر 1</option>
                <option value="2" ${linesCount === 2 ? 'selected' : ''}>2 أسطر</option>
                <option value="3" ${linesCount === 3 ? 'selected' : ''}>3 أسطر</option>
            </select>
            <select class="form-select tp-mini-select" id="tp_align_${pfx}" onchange="tpCollectAndPreview('${zone}')">
                <option value="right" ${sec.align === 'right' ? 'selected' : ''}>يمين</option>
                <option value="center" ${sec.align === 'center' ? 'selected' : ''}>وسط</option>
                <option value="left" ${sec.align === 'left' ? 'selected' : ''}>يسار</option>
            </select>
            <select class="form-select tp-mini-select" id="tp_fsize_${pfx}" onchange="tpCollectAndPreview('${zone}')">
                ${[10,11,12,13,14,16,18,20,22,24].map(s => `<option value="${s}" ${sec.fontSize === s ? 'selected' : ''}>${s}px</option>`).join('')}
            </select>
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;cursor:pointer;">
                <input type="checkbox" id="tp_bold_${pfx}" ${sec.bold ? 'checked' : ''} onchange="tpCollectAndPreview('${zone}')" style="accent-color:var(--sa-600);width:16px;height:16px;">
                غامق
            </label>
        </div>
        <div id="tp_textlines_${pfx}" style="margin-top:6px;">
            ${linesHtml}
        </div>`;
}

function tpOnTypeChange(zone, idx) {
    tpCollectCurrentSections();
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    const pfx = `${zone}_${idx}`;
    const newType = document.getElementById(`tp_type_${pfx}`).value;
    data[idx].type = newType;
    if (newType === 'logo') {
        data[idx].imageUrl = data[idx].imageUrl || '';
        data[idx].logoWidth = data[idx].logoWidth || 4;
        data[idx].logoHeight = data[idx].logoHeight || 2;
        data[idx].imageAlign = data[idx].imageAlign || 'center';
    }
    tpRenderSections(zone);
    tpUpdatePreview(zone);
}

function tpOnLinesChange(zone, idx) {
    tpCollectCurrentSections();
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    const pfx = `${zone}_${idx}`;
    const newLines = parseInt(document.getElementById(`tp_lines_${pfx}`).value) || 1;
    data[idx].lines = newLines;
    while (data[idx].text.length < newLines) data[idx].text.push('');
    tpRenderSections(zone);
    tpUpdatePreview(zone);
}

async function tpUploadImage(zone, idx, input) {
    if (!input.files || !input.files[0]) return;
    const form = new FormData();
    form.append('file', input.files[0]);
    const r = await fetch('/Templates/UploadTemplateImage', { method: 'POST', body: form });
    const j = await r.json();
    if (!j.success) { alert(j.message || 'فشل رفع الصورة'); return; }
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    data[idx].imageUrl = j.url;
    tpRenderSections(zone);
    tpUpdatePreview(zone);
}

function tpCollectAndPreview(zone) {
    tpCollectCurrentSections();
    tpUpdatePreview(zone);
}

function tpCollectCurrentSections() {
    tpCollectZone('header');
    tpCollectZone('footer');
}

function tpCollectZone(zone) {
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    data.forEach((sec, idx) => {
        const pfx = `${zone}_${idx}`;
        const typeEl = document.getElementById(`tp_type_${pfx}`);
        if (!typeEl) return;
        sec.type = typeEl.value;

        if (sec.type === 'text') {
            sec.lines = parseInt(document.getElementById(`tp_lines_${pfx}`)?.value) || 1;
            sec.align = document.getElementById(`tp_align_${pfx}`)?.value || 'center';
            sec.fontSize = parseInt(document.getElementById(`tp_fsize_${pfx}`)?.value) || 14;
            sec.bold = document.getElementById(`tp_bold_${pfx}`)?.checked || false;
            sec.text = [];
            for (let l = 0; l < sec.lines; l++) {
                sec.text.push(document.getElementById(`tp_text_${pfx}_${l}`)?.value || '');
            }
        } else {
            sec.logoWidth = parseFloat(document.getElementById(`tp_logoW_${pfx}`)?.value) || 4;
            sec.logoHeight = parseFloat(document.getElementById(`tp_logoH_${pfx}`)?.value) || 2;
            sec.imageAlign = document.getElementById(`tp_imgalign_${pfx}`)?.value || 'center';
        }
    });
}

/* ═══════════ PREVIEW ══════════════════════════════════════════ */
function tpUpdatePreview(zone) {
    const data = zone === 'header' ? tpHeaderData : tpFooterData;
    const previewEl = document.getElementById(zone === 'header' ? 'tpHeaderPreview' : 'tpFooterPreview');
    previewEl.style.gridTemplateColumns = `repeat(${data.length}, 1fr)`;
    previewEl.innerHTML = data.map(sec => tpRenderPreviewSection(sec)).join('');
}

function tpRenderPreviewSection(sec) {
    if (sec.type === 'logo') {
        const w = (sec.logoWidth || 4) * 37.8;
        const h = (sec.logoHeight || 2) * 37.8;
        if (!sec.imageUrl) return `<div class="tp-preview-sec" style="text-align:${sec.imageAlign || 'center'};color:var(--gray-300);font-size:12px;"><i class="bi bi-image" style="font-size:24px;"></i><div style="font-size:11px;">شعار</div></div>`;
        return `<div class="tp-preview-sec" style="text-align:${sec.imageAlign || 'center'};"><img src="${sec.imageUrl}" style="width:${w}px;height:${h}px;object-fit:contain;border-radius:4px;" alt=""></div>`;
    }
    const lines = (sec.text || ['']).map(t => `<div style="font-size:${sec.fontSize || 14}px;font-weight:${sec.bold ? '700' : '400'};line-height:1.5;">${escHtml(t) || '<span style="color:var(--gray-300);">نص</span>'}</div>`).join('');
    return `<div class="tp-preview-sec" style="text-align:${sec.align || 'center'};">${lines}</div>`;
}

function tpBuildFullPreview() {
    tpCollectCurrentSections();
    const showHL = document.getElementById('tpwShowHeaderLine').checked;
    const showFL = document.getElementById('tpwShowFooterLine').checked;
    const mt = document.getElementById('tpwMarginTop').value;
    const mb = document.getElementById('tpwMarginBottom').value;
    const mr = document.getElementById('tpwMarginRight').value;
    const ml = document.getElementById('tpwMarginLeft').value;
    const dir = document.getElementById('tpwPageDirection').value;

    let html = `<div style="direction:${dir.toLowerCase()};padding:${mt}px ${mr}px ${mb}px ${ml}px;">`;

    // Header
    html += `<div style="display:grid;grid-template-columns:repeat(${tpHeaderData.length},1fr);min-height:50px;align-items:center;">`;
    tpHeaderData.forEach(sec => { html += tpRenderPreviewSection(sec); });
    html += '</div>';
    if (showHL) html += '<div class="tp-preview-line" style="margin:8px 0;"></div>';

    // Body placeholder
    html += `<div style="min-height:180px;display:flex;align-items:center;justify-content:center;color:var(--gray-300);font-size:14px;padding:30px;">
        <div style="text-align:center;"><i class="bi bi-file-earmark-text" style="font-size:36px;display:block;margin-bottom:8px;"></i> محتوى النموذج</div>
    </div>`;

    if (showFL) html += '<div class="tp-preview-line" style="margin:8px 0;"></div>';
    // Footer
    html += `<div style="display:grid;grid-template-columns:repeat(${tpFooterData.length},1fr);min-height:40px;align-items:center;">`;
    tpFooterData.forEach(sec => { html += tpRenderPreviewSection(sec); });
    html += '</div>';

    html += '</div>';
    document.getElementById('tpFullPreview').innerHTML = html;
}

/* ═══════════ SUBMIT ═══════════════════════════════════════════ */
async function tpSubmitWizard() {
    tpCollectCurrentSections();
    const name = document.getElementById('tpwName').value.trim();
    if (!name) { alert('اسم القالب مطلوب'); tpGoToStep(0); return; }

    const payload = {
        name,
        description: document.getElementById('tpwDescription').value.trim(),
        color: document.getElementById('tpwColor').value,
        isActive: document.getElementById('tpwIsActive').checked,
        headerSections: tpHeaderData.length,
        footerSections: tpFooterData.length,
        headerJson: JSON.stringify(tpHeaderData),
        footerJson: JSON.stringify(tpFooterData),
        marginTop: parseInt(document.getElementById('tpwMarginTop').value) || 20,
        marginBottom: parseInt(document.getElementById('tpwMarginBottom').value) || 20,
        marginRight: parseInt(document.getElementById('tpwMarginRight').value) || 20,
        marginLeft: parseInt(document.getElementById('tpwMarginLeft').value) || 20,
        pageDirection: document.getElementById('tpwPageDirection').value,
        pageSize: document.getElementById('tpwPageSize').value,
        showHeaderLine: document.getElementById('tpwShowHeaderLine').checked,
        showFooterLine: document.getElementById('tpwShowFooterLine').checked
    };

    let url, reqBody;
    if (tpWizardMode === 'edit') {
        url = '/Templates/UpdateTemplate';
        reqBody = { id: tpEditId, ...payload };
    } else {
        url = '/Templates/AddTemplate';
        reqBody = payload;
    }

    const r = await tpApiFetch(url, 'POST', reqBody);

    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('tpWizardModal'))?.hide();
        tpLoad();
    } else {
        alert((r && r.message) || 'حدث خطأ');
    }
}

/* ═══════════ DETAILS ══════════════════════════════════════════ */
async function tpShowDetails(id) {
    const r = await tpApiFetch(`/Templates/GetTemplate?id=${id}`);
    if (!r.success) return;
    const t = r.data;

    document.getElementById('tpDetailSubtitle').textContent = t.name;

    let headerData = [], footerData = [];
    try { headerData = JSON.parse(t.headerJson); } catch {}
    try { footerData = JSON.parse(t.footerJson); } catch {}

    const showHL = t.showHeaderLine;
    const showFL = t.showFooterLine;

    let html = `<div class="tp-section">
        <div class="tp-section-title"><i class="bi bi-info-circle-fill"></i> البيانات الأساسية</div>
        <div class="tp-detail-grid">
            <div class="tp-detail-label">اسم القالب</div><div class="tp-detail-value">${escHtml(t.name)}</div>
            <div class="tp-detail-label">الوصف</div><div class="tp-detail-value">${escHtml(t.description) || '<span style="color:var(--gray-400);">—</span>'}</div>
            <div class="tp-detail-label">اللون</div><div class="tp-detail-value"><span class="tp-color-swatch" style="background:${t.color};"></span> ${t.color}</div>
            <div class="tp-detail-label">الحالة</div><div class="tp-detail-value">${t.isActive ? '<span class="tp-badge-active">مفعل</span>' : '<span class="tp-badge-inactive">معطل</span>'}</div>
            <div class="tp-detail-label">اتجاه الصفحة</div><div class="tp-detail-value">${t.pageDirection}</div>
            <div class="tp-detail-label">حجم الورق</div><div class="tp-detail-value">${t.pageSize}</div>
            <div class="tp-detail-label">الهوامش</div><div class="tp-detail-value">أعلى: ${t.marginTop}mm | أسفل: ${t.marginBottom}mm | يمين: ${t.marginRight}mm | يسار: ${t.marginLeft}mm</div>
            <div class="tp-detail-label">خط فاصل هيدر</div><div class="tp-detail-value">${t.showHeaderLine ? 'نعم' : 'لا'}</div>
            <div class="tp-detail-label">خط فاصل فوتر</div><div class="tp-detail-value">${t.showFooterLine ? 'نعم' : 'لا'}</div>
            <div class="tp-detail-label">أنشأه</div><div class="tp-detail-value">${escHtml(t.createdBy)}</div>
        </div>
    </div>`;

    // Full preview
    html += `<div class="tp-section">
        <div class="tp-section-title"><i class="bi bi-eye"></i> معاينة القالب</div>
        <div style="border:2px solid var(--gray-200);border-radius:12px;overflow:hidden;background:#fff;">
            <div style="direction:${t.pageDirection.toLowerCase()};padding:${t.marginTop}px ${t.marginRight}px ${t.marginBottom}px ${t.marginLeft}px;">
                <div style="display:grid;grid-template-columns:repeat(${headerData.length || 1},1fr);min-height:50px;align-items:center;">
                    ${(headerData.length ? headerData : [tpDefaultSection(16,true)]).map(s => tpRenderPreviewSection(s)).join('')}
                </div>
                ${showHL ? '<div class="tp-preview-line" style="margin:8px 0;"></div>' : ''}
                <div style="min-height:180px;display:flex;align-items:center;justify-content:center;color:var(--gray-300);font-size:14px;padding:30px;">
                    <div style="text-align:center;"><i class="bi bi-file-earmark-text" style="font-size:36px;display:block;margin-bottom:8px;"></i> محتوى النموذج</div>
                </div>
                ${showFL ? '<div class="tp-preview-line" style="margin:8px 0;"></div>' : ''}
                <div style="display:grid;grid-template-columns:repeat(${footerData.length || 1},1fr);min-height:40px;align-items:center;">
                    ${(footerData.length ? footerData : [tpDefaultSection(12,false)]).map(s => tpRenderPreviewSection(s)).join('')}
                </div>
            </div>
        </div>
    </div>`;

    document.getElementById('tpDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('tpDetailsModal')).show();
}

/* ═══════════ DELETE ═══════════════════════════════════════════ */
function tpShowDeleteModal(id) {
    const t = tpAllData.find(x => x.id === id);
    if (!t) return;
    document.getElementById('tpDeleteId').value = id;
    document.getElementById('tpDeleteName').textContent = t.name;
    new bootstrap.Modal(document.getElementById('tpDeleteModal')).show();
}

async function tpSubmitDelete() {
    const id = parseInt(document.getElementById('tpDeleteId').value);
    const r = await tpApiFetch('/Templates/DeleteTemplate', 'POST', { id });
    if (r.success) {
        bootstrap.Modal.getInstance(document.getElementById('tpDeleteModal'))?.hide();
        tpLoad();
    } else {
        alert(r.message || 'حدث خطأ');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    tpLoad();
});
