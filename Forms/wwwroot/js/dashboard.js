'use strict';

var dashStatusChart = null;
var dashLoaded = { summary: false, profile: false, delegations: false, audit: false };
var dashDelAll = [];
var dashDelMeId = null;
var dashAlAll = [];

function dashEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function dashResolveUrl(url) {
    if (!url) return '';
    if (typeof appResolveUrl === 'function') return appResolveUrl(url);
    return url.startsWith('/') ? url : '/' + url;
}

function dashSelectTab(name) {
    document.querySelectorAll('.dash-tab').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    var map = {
        summary: 'dashPanelSummary',
        profile: 'dashPanelProfile',
        delegations: 'dashPanelDelegations',
        audit: 'dashPanelAudit'
    };
    Object.keys(map).forEach(function (k) {
        var el = document.getElementById(map[k]);
        if (el) el.classList.toggle('active', k === name);
    });
    if (name === 'summary' && !dashLoaded.summary) dashLoadSummary();
    if (name === 'profile' && !dashLoaded.profile) dashLoadProfile();
    if (name === 'delegations' && !dashLoaded.delegations) dashLoadDelegations();
    if (name === 'audit' && !dashLoaded.audit) dashLoadAudit();
}

function dashInit() {
    dashLoadSummary();
}

function dashSetKpi(valId, barId, val, maxVal) {
    var el = document.getElementById(valId);
    var bar = document.getElementById(barId);
    if (el) el.textContent = val ?? 0;
    if (bar) {
        var pct = maxVal > 0 ? Math.min((val / maxVal) * 100, 100) : 0;
        bar.style.width = pct + '%';
    }
}

async function dashLoadSummary() {
    var r = await apiFetch('/Dashboard/GetSummary');
    if (!r || !r.success) return;

    dashLoaded.summary = true;
    var c = r.cards || {};
    var maxCard = Math.max(c.inbox || 0, c.outbox || 0, c.delegations || 0, 1);
    dashSetKpi('dashKpiInbox', 'dashKpiInboxBar', c.inbox || 0, maxCard);
    dashSetKpi('dashKpiOutbox', 'dashKpiOutboxBar', c.outbox || 0, maxCard);
    dashSetKpi('dashKpiDel', 'dashKpiDelBar', c.delegations || 0, maxCard);

    dashRenderStatusChart(r.chart || {});
}

function dashRenderStatusChart(chartData) {
    var canvas = document.getElementById('dashStatusChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (dashStatusChart) {
        dashStatusChart.destroy();
        dashStatusChart = null;
    }

    var labels = chartData.labels || [];
    var percents = chartData.percents || [];
    var counts = chartData.counts || [];
    var total = chartData.total || 0;

    if (!labels.length || total === 0) {
        var wrap = canvas.parentElement;
        if (wrap) wrap.innerHTML = '<div class="dash-future-card" style="min-height:240px;"><i class="bi bi-bar-chart"></i><span>لا توجد طلبات لعرضها</span></div>';
        return;
    }

    var colors = ['#25935F', '#1570EF', '#DC6803', '#D92D20', '#5925DC', '#0891b2', '#ca8a04', '#64748b'];
    var bg = labels.map(function (_, i) { return colors[i % colors.length]; });

    dashStatusChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: labels.map(function (lbl, i) {
                return lbl + ' (' + (percents[i] || 0) + '%)';
            }),
            datasets: [{
                data: counts,
                backgroundColor: bg,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Cairo', size: 12 }, padding: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            var pct = percents[ctx.dataIndex] || 0;
                            return ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
                        }
                    }
                }
            }
        }
    });
}

async function dashLoadProfile() {
    var host = document.getElementById('dashProfileHost');
    if (!host) return;
    host.innerHTML = '<div class="text-center py-5"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';

    var r = await apiFetch('/Dashboard/GetProfile');
    if (!r || !r.success) {
        host.innerHTML = '<div class="text-center py-4 text-danger">تعذّر تحميل البيانات</div>';
        return;
    }
    dashLoaded.profile = true;

    var p = r.profile || {};
    var canEditSign = !!r.canEditEndorsementSignature;
    var photo = p.photoUrl
        ? '<img src="' + dashEsc(dashResolveUrl(p.photoUrl)) + '" alt="">'
        : '<i class="bi bi-person-fill"></i>';

    function signHtml(type, file) {
        if (file) {
            var src = file.indexOf('data:') === 0 ? file : dashResolveUrl(file);
            if (file.indexOf('data:image') === 0 || (!file.startsWith('data:') && /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(file)))
                return '<img src="' + dashEsc(src) + '" alt="">';
            return '<span class="badge bg-secondary">PDF</span>';
        }
        if (type) return '<span class="text-muted">' + dashEsc(type) + '</span>';
        return '<span class="text-muted">—</span>';
    }

    var signSectionHtml = dashBuildSignSectionHtml(p, canEditSign, signHtml);

    var roles = r.executorRoles || [];
    var rolesHtml = '';
    if (!roles.length) {
        rolesHtml = '<tr><td colspan="4" class="text-center py-4 text-muted">لا توجد أدوار تنفيذية</td></tr>';
    } else {
        roles.forEach(function (row) {
            rolesHtml += '<tr><td>' + row.rowNum + '</td><td>' + dashEsc(row.name) + '</td><td>' + dashEsc(row.description || '—') + '</td><td>' + dashEsc(row.ownership || '—') + '</td></tr>';
        });
    }

    host.innerHTML =
        '<div class="dash-profile-grid">'
        + '<div class="dash-avatar-wrap"><div class="dash-avatar">' + photo + '</div></div>'
        + '<div>'
        + '<div class="dash-fields">'
        + '<div class="lbl">الاسم الكامل</div><div class="val">' + dashEsc(p.fullName || '—') + '</div>'
        + '<div class="lbl">الجوال</div><div class="val" dir="ltr" style="text-align:right;">' + dashEsc(p.phone || '—') + '</div>'
        + '<div class="lbl">الوحدة التنظيمية</div><div class="val">' + dashEsc(p.organizationalUnit || '—') + '</div>'
        + '<div class="lbl">الصفة في الوحدة</div><div class="val">' + dashEsc(p.roleInUnit || '—') + '</div>'
        + '<div class="lbl">البريد الإلكتروني</div><div class="val" dir="ltr" style="text-align:right;">' + dashEsc(p.email || '—') + '</div>'
        + '<div class="lbl">الهوية الوطنية</div><div class="val" dir="ltr" style="text-align:right;">' + dashEsc(p.nationalId || '—') + '</div>'
        + '</div>'
        + signSectionHtml
        + '</div></div>'
        + '<div style="margin-top:28px;">'
        + '<h3 class="dash-section-title"><i class="bi bi-person-badge"></i> قائمة الأدوار التنفيذية</h3>'
        + '<div class="card"><div class="card-body p-0"><div class="table-responsive">'
        + '<table class="table mb-0 dash-table"><thead><tr>'
        + '<th style="width:50px;">ت</th><th>الدور</th><th>الوصف</th><th>الملكية</th>'
        + '</tr></thead><tbody>' + rolesHtml + '</tbody></table>'
        + '</div></div></div></div>';

    if (canEditSign) {
        var endTypeEl = document.getElementById('dashEndorsementType');
        var sigTypeEl = document.getElementById('dashSignatureType');
        if (endTypeEl) endTypeEl.value = 'مرفق';
        if (sigTypeEl) sigTypeEl.value = 'مرفق';
        dashWireSignSection();
    }
}

function dashBuildSignSectionHtml(p, canEdit, signHtmlFn) {
    if (canEdit) {
        return '<div class="dash-sign-section">'
            + '<div class="dash-sign-label"><i class="bi bi-pencil-square"></i> التأشير والتوقيع</div>'
            + '<p class="dash-sign-locked-note"><i class="bi bi-info-circle"></i> يمكن إضافة التأشير والتوقيع مرة واحدة فقط؛ بعد الحفظ لا يمكن تعديلهما.</p>'
            + '<div class="dash-sign-grid">'
            + '<div>'
            + '<label class="form-label">التأشير</label>'
            + '<select class="form-select" id="dashEndorsementType"><option value="مرفق">مرفق (صورة أو PDF)</option><option value="التوقيع بالقلم">التوقيع بالقلم</option></select>'
            + '<div id="dashEndorsementFileWrap" class="mt-2"><label class="form-label small">رفع ملف التأشير</label>'
            + '<input type="file" class="form-control" id="dashEndorsementFile" accept="image/*,.pdf">'
            + '<div id="dashEndorsementPreview" class="dash-attach-preview-wrap mt-2" style="display:none;"></div></div>'
            + '<div id="dashEndorsementCanvasWrap" class="mt-2" style="display:none;"><label class="form-label small">التوقيع الإلكتروني للتأشير</label>'
            + '<div class="dash-sign-canvas-wrap"><canvas id="dashEndorsementCanvas" class="dash-sign-canvas" width="280" height="120"></canvas>'
            + '<button type="button" class="btn btn-outline-secondary btn-sm" onclick="dashClearCanvas(\'dashEndorsementCanvas\')">مسح</button></div></div>'
            + '</div>'
            + '<div>'
            + '<label class="form-label">التوقيع</label>'
            + '<select class="form-select" id="dashSignatureType"><option value="مرفق">مرفق (صورة أو PDF)</option><option value="التوقيع بالقلم">التوقيع بالقلم</option></select>'
            + '<div id="dashSignatureFileWrap" class="mt-2"><label class="form-label small">رفع ملف التوقيع</label>'
            + '<input type="file" class="form-control" id="dashSignatureFile" accept="image/*,.pdf">'
            + '<div id="dashSignaturePreview" class="dash-attach-preview-wrap mt-2" style="display:none;"></div></div>'
            + '<div id="dashSignatureCanvasWrap" class="mt-2" style="display:none;"><label class="form-label small">التوقيع الإلكتروني</label>'
            + '<div class="dash-sign-canvas-wrap"><canvas id="dashSignatureCanvas" class="dash-sign-canvas" width="280" height="120"></canvas>'
            + '<button type="button" class="btn btn-outline-secondary btn-sm" onclick="dashClearCanvas(\'dashSignatureCanvas\')">مسح</button></div></div>'
            + '</div></div>'
            + '<div class="mt-3"><button type="button" class="btn btn-primary" id="dashSaveSignBtn" onclick="dashSaveEndorsementSignature()"><i class="bi bi-check-lg"></i> حفظ التأشير والتوقيع</button></div>'
            + '<div id="dashSignError" class="alert alert-danger d-none mt-3" style="font-size:13px;"></div>'
            + '</div>';
    }

    return '<div class="dash-sign-section dash-sign-section-locked">'
        + '<div class="dash-sign-label"><i class="bi bi-pencil-square"></i> التأشير والتوقيع</div>'

        + '<div class="dash-sign-grid">'
        + '<div><div class="dash-sign-label" style="margin-top:0;font-size:13px;"><i class="bi bi-pen"></i> التأشير</div>'
        + '<div class="dash-sign-box">' + signHtmlFn(p.endorsementType, p.endorsementFile) + '</div></div>'
        + '<div><div class="dash-sign-label" style="margin-top:0;font-size:13px;"><i class="bi bi-vector-pen"></i> التوقيع</div>'
        + '<div class="dash-sign-box">' + signHtmlFn(p.signatureType, p.signatureFile) + '</div></div>'
        + '</div></div>';
}

function dashWireSignSection() {
    var endType = document.getElementById('dashEndorsementType');
    var sigType = document.getElementById('dashSignatureType');
    var endFile = document.getElementById('dashEndorsementFile');
    var sigFile = document.getElementById('dashSignatureFile');
    if (endType) endType.addEventListener('change', dashToggleEndorsement);
    if (sigType) sigType.addEventListener('change', dashToggleSignature);
    if (endFile) endFile.addEventListener('change', function (e) {
        dashHandleFileUpload(e, 'dashEndorsementFile', 'dashEndorsementPreview');
    });
    if (sigFile) sigFile.addEventListener('change', function (e) {
        dashHandleFileUpload(e, 'dashSignatureFile', 'dashSignaturePreview');
    });
    dashInitSignatureCanvas('dashEndorsementCanvas');
    dashInitSignatureCanvas('dashSignatureCanvas');
    dashToggleEndorsement();
    dashToggleSignature();
}

function dashToggleEndorsement() {
    var type = document.getElementById('dashEndorsementType');
    var fileWrap = document.getElementById('dashEndorsementFileWrap');
    var canvasWrap = document.getElementById('dashEndorsementCanvasWrap');
    if (!type || !fileWrap || !canvasWrap) return;
    if (type.value === 'مرفق') {
        fileWrap.style.display = 'block';
        canvasWrap.style.display = 'none';
        var endFile = document.getElementById('dashEndorsementFile');
        var endPreview = document.getElementById('dashEndorsementPreview');
        if (endFile) endFile.value = '';
        if (endPreview) endPreview.style.display = 'none';
        dashClearCanvas('dashEndorsementCanvas');
    } else {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'block';
        dashClearCanvas('dashEndorsementCanvas');
    }
}

function dashToggleSignature() {
    var type = document.getElementById('dashSignatureType');
    var fileWrap = document.getElementById('dashSignatureFileWrap');
    var canvasWrap = document.getElementById('dashSignatureCanvasWrap');
    if (!type || !fileWrap || !canvasWrap) return;
    if (type.value === 'مرفق') {
        fileWrap.style.display = 'block';
        canvasWrap.style.display = 'none';
        var sigFile = document.getElementById('dashSignatureFile');
        var sigPreview = document.getElementById('dashSignaturePreview');
        if (sigFile) sigFile.value = '';
        if (sigPreview) sigPreview.style.display = 'none';
        dashClearCanvas('dashSignatureCanvas');
    } else {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'block';
        dashClearCanvas('dashSignatureCanvas');
    }
}

function dashHandleFileUpload(e, inputId, previewId) {
    var f = e.target.files && e.target.files[0];
    var input = document.getElementById(inputId);
    var preview = document.getElementById(previewId);
    if (!input || !preview) return;
    if (f) {
        var r = new FileReader();
        r.onload = function () {
            input.dataset.base64 = r.result;
            if (f.type.indexOf('image') === 0) {
                preview.innerHTML = '<img src="' + r.result + '" class="dash-attach-preview" alt="">';
            } else {
                preview.innerHTML = '<span class="badge bg-secondary">PDF</span>';
            }
            preview.style.display = 'flex';
        };
        r.readAsDataURL(f);
    } else {
        input.dataset.base64 = '';
        preview.innerHTML = '';
        preview.style.display = 'none';
    }
}

function dashInitSignatureCanvas(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    var drawing = false;
    var lastX = 0, lastY = 0;

    function getPos(e) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        var clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }
    function start(e) { e.preventDefault(); drawing = true; var p = getPos(e); lastX = p.x; lastY = p.y; }
    function draw(e) {
        e.preventDefault();
        if (!drawing) return;
        var p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        lastX = p.x; lastY = p.y;
    }
    function end(e) { e.preventDefault(); drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseout', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
}

function dashClearCanvas(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function dashGetCanvasDataUrl(canvasId) {
    var canvas = document.getElementById(canvasId);
    return canvas ? canvas.toDataURL('image/png') : '';
}

function dashIsCanvasEmpty(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return true;
    var ctx = canvas.getContext('2d');
    var px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (var i = 3; i < px.length; i += 4) {
        if (px[i] > 0) return false;
    }
    return true;
}

function dashGetEndorsementData() {
    var typeEl = document.getElementById('dashEndorsementType');
    if (!typeEl) return '';
    if (typeEl.value === 'مرفق') {
        var inp = document.getElementById('dashEndorsementFile');
        return (inp && inp.dataset.base64) ? inp.dataset.base64 : '';
    }
    return dashGetCanvasDataUrl('dashEndorsementCanvas');
}

function dashGetSignatureData() {
    var typeEl = document.getElementById('dashSignatureType');
    if (!typeEl) return '';
    if (typeEl.value === 'مرفق') {
        var inp = document.getElementById('dashSignatureFile');
        return (inp && inp.dataset.base64) ? inp.dataset.base64 : '';
    }
    return dashGetCanvasDataUrl('dashSignatureCanvas');
}

async function dashSaveEndorsementSignature() {
    var errEl = document.getElementById('dashSignError');
    var btn = document.getElementById('dashSaveSignBtn');
    if (errEl) errEl.classList.add('d-none');

    var endorsementType = document.getElementById('dashEndorsementType')?.value || 'مرفق';
    var signatureType = document.getElementById('dashSignatureType')?.value || 'مرفق';
    var endorsementFile = dashGetEndorsementData();
    var signatureFile = dashGetSignatureData();

    if (!String(endorsementFile || '').trim()) {
        if (errEl) { errEl.textContent = endorsementType === 'مرفق' ? 'يرجى رفع ملف التأشير' : 'يرجى رسم التأشير'; errEl.classList.remove('d-none'); }
        return;
    }
    if (endorsementType === 'التوقيع بالقلم' && dashIsCanvasEmpty('dashEndorsementCanvas')) {
        if (errEl) { errEl.textContent = 'يرجى رسم التأشير'; errEl.classList.remove('d-none'); }
        return;
    }
    if (!String(signatureFile || '').trim()) {
        if (errEl) { errEl.textContent = signatureType === 'مرفق' ? 'يرجى رفع ملف التوقيع' : 'يرجى رسم التوقيع'; errEl.classList.remove('d-none'); }
        return;
    }
    if (signatureType === 'التوقيع بالقلم' && dashIsCanvasEmpty('dashSignatureCanvas')) {
        if (errEl) { errEl.textContent = 'يرجى رسم التوقيع'; errEl.classList.remove('d-none'); }
        return;
    }

    if (btn) btn.disabled = true;
    try {
        var r = await apiFetch('/Dashboard/SaveMyEndorsementSignature', 'POST', {
            endorsementType: endorsementType,
            endorsementFile: endorsementFile,
            signatureType: signatureType,
            signatureFile: signatureFile
        });
        if (r && r.success) {
            if (typeof showToast === 'function') showToast(r.message || 'تم الحفظ', 'success');
            dashLoaded.profile = false;
            await dashLoadProfile();
        } else if (errEl) {
            errEl.textContent = (r && r.message) || 'تعذّر الحفظ';
            errEl.classList.remove('d-none');
        }
    } catch (e) {
        if (errEl) { errEl.textContent = 'خطأ في الاتصال'; errEl.classList.remove('d-none'); }
    } finally {
        if (btn) btn.disabled = false;
    }
}

function dashDelStatusLabel(code) {
    switch ((code || '').toLowerCase()) {
        case 'active': return '<span class="badge bg-success">ساري</span>';
        case 'scheduled': return '<span class="badge bg-info text-dark">مجدول</span>';
        case 'expired': return '<span class="badge bg-secondary">منتهي</span>';
        case 'cancelled': return '<span class="badge bg-dark">ملغى</span>';
        case 'draft': return '<span class="badge bg-warning text-dark">مسودة</span>';
        default: return '<span class="badge bg-light text-dark">' + dashEsc(code || '') + '</span>';
    }
}

function dashDelDuration(start, end) {
    if (!start || !end) return '—';
    try {
        var s = new Date(String(start).substring(0, 10));
        var e = new Date(String(end).substring(0, 10));
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return '—';
        var days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
        return days + ' يوم';
    } catch (ex) { return '—'; }
}

function dashDelMatchSearch(d, q, nameFields) {
    if (!q) return true;
    var s = q.toLowerCase();
    return nameFields.some(function (f) { return (f || '').toLowerCase().indexOf(s) >= 0; });
}

function dashDelDateBetween(start, end, from, to) {
    var day = String(start || '').substring(0, 10);
    if (from && day < from) return false;
    if (to && String(end || '').substring(0, 10) > to) return false;
    return true;
}

function dashDelFiltered() {
    var q = (document.getElementById('dashDelSearch')?.value || '').trim();
    var type = document.getElementById('dashDelType')?.value || '';
    var org = document.getElementById('dashDelOrgUnit')?.value || '';
    var st = document.getElementById('dashDelStatus')?.value || '';
    var from = document.getElementById('dashDelDateFrom')?.value || '';
    var to = document.getElementById('dashDelDateTo')?.value || '';

    return dashDelAll.filter(function (d) {
        var isDelegator = dashDelMeId && Number(d.delegatorBeneficiaryId || d.DelegatorBeneficiaryId) === Number(dashDelMeId);
        var isDelegatee = dashDelMeId && Number(d.delegateeBeneficiaryId || d.DelegateeBeneficiaryId) === Number(dashDelMeId);
        if (type === 'delegator' && !isDelegator) return false;
        if (type === 'delegatee' && !isDelegatee) return false;

        if (org) {
            var ou = isDelegator
                ? (d.delegatorOrgUnitName || d.DelegatorOrgUnitName || '')
                : (d.delegateeOrgUnitName || d.DelegateeOrgUnitName || '');
            if (ou !== org) return false;
        }
        if (st && (d.statusCode || d.StatusCode || '').toLowerCase() !== st) return false;
        if (!dashDelDateBetween(d.startDate || d.StartDate, d.endDate || d.EndDate, from, to)) return false;
        if (!dashDelMatchSearch(d, q, [
            d.delegatorName || d.DelegatorName,
            d.delegateeName || d.DelegateeName,
            d.delegationReason || d.DelegationReason,
            String(d.referenceNumber || d.ReferenceNumber || '')
        ])) return false;
        return true;
    });
}

function dashDelRenderTable(bodyId, rows, mode) {
    var body = document.getElementById(bodyId);
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">لا توجد تفويضات</td></tr>';
        return;
    }
    var html = '';
    rows.forEach(function (d, idx) {
        var person, ou;
        if (mode === 'delegator') {
            person = d.delegateeName || d.DelegateeName || '—';
            ou = d.delegatorOrgUnitName || d.DelegatorOrgUnitName || '—';
        } else {
            person = d.delegateeName || d.DelegateeName || '—';
            ou = d.delegateeOrgUnitName || d.DelegateeOrgUnitName || '—';
        }

        html += '<tr>'
            + '<td>' + (idx + 1) + '</td>'
            + '<td dir="ltr">' + dashEsc(String(d.referenceNumber || d.ReferenceNumber || '—')) + '</td>'
            + '<td>' + dashEsc(person) + '</td>'
            + '<td>' + dashEsc(ou) + '</td>'
            + '<td dir="ltr">' + dashEsc(d.startDate || d.StartDate || '—') + '</td>'
            + '<td dir="ltr">' + dashEsc(d.endDate || d.EndDate || '—') + '</td>'
            + '<td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + dashEsc(d.delegationReason || d.DelegationReason) + '">' + dashEsc(d.delegationReason || d.DelegationReason || '—') + '</td>'
            + '<td>' + dashDelDuration(d.startDate || d.StartDate, d.endDate || d.EndDate) + '</td>'
            + '<td>' + dashDelStatusLabel(d.statusCode || d.StatusCode) + '</td>'
            + '</tr>';
    });
    body.innerHTML = html;
}

function dashDelApplyFilters() {
    var list = dashDelFiltered();
    var delegatorRows = list.filter(function (d) {
        return dashDelMeId && Number(d.delegatorBeneficiaryId || d.DelegatorBeneficiaryId) === Number(dashDelMeId);
    });
    var delegateeRows = list.filter(function (d) {
        return dashDelMeId && Number(d.delegateeBeneficiaryId || d.DelegateeBeneficiaryId) === Number(dashDelMeId);
    });
    dashDelRenderTable('dashDelDelegatorBody', delegatorRows, 'delegator');
    dashDelRenderTable('dashDelDelegateeBody', delegateeRows, 'delegatee');
}

function dashDelClearFilters() {
    ['dashDelSearch', 'dashDelType', 'dashDelOrgUnit', 'dashDelStatus', 'dashDelDateFrom', 'dashDelDateTo'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    dashDelApplyFilters();
}

async function dashLoadDelegations() {
    var r = await apiFetch('/Settings/GetMyDelegations');
    if (!r || !r.success) {
        document.getElementById('dashDelDelegatorBody').innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">تعذّر التحميل</td></tr>';
        document.getElementById('dashDelDelegateeBody').innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">تعذّر التحميل</td></tr>';
        return;
    }
    dashLoaded.delegations = true;
    dashDelAll = r.data || [];
    dashDelMeId = r.myBeneficiaryId || null;

    var orgNames = {};
    dashDelAll.forEach(function (d) {
        var n1 = d.delegatorOrgUnitName || d.DelegatorOrgUnitName;
        var n2 = d.delegateeOrgUnitName || d.DelegateeOrgUnitName;
        if (n1) orgNames[n1] = true;
        if (n2) orgNames[n2] = true;
    });
    var orgSel = document.getElementById('dashDelOrgUnit');
    if (orgSel) {
        orgSel.innerHTML = '<option value="">الوحدة التنظيمية</option>';
        Object.keys(orgNames).sort(function (a, b) { return a.localeCompare(b, 'ar'); }).forEach(function (n) {
            var o = document.createElement('option');
            o.value = n;
            o.textContent = n;
            orgSel.appendChild(o);
        });
    }

    dashDelApplyFilters();
}

function dashAlApplyFilters() {
    var action = document.getElementById('dashAlAction')?.value || '';
    var from = document.getElementById('dashAlDateFrom')?.value || '';
    var to = document.getElementById('dashAlDateTo')?.value || '';

    var filtered = dashAlAll.filter(function (row) {
        if (action && row.action !== action) return false;
        var day = String(row.createdAt || '').substring(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
    });

    var body = document.getElementById('dashAlBody');
    if (!body) return;
    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">لا توجد عمليات</td></tr>';
        return;
    }
    body.innerHTML = filtered.map(function (row, idx) {
        return '<tr>'
            + '<td>' + (idx + 1) + '</td>'
            + '<td><span class="dash-al-badge">' + dashEsc(row.action || '—') + '</span></td>'
            + '<td dir="ltr">' + dashEsc(row.createdAt || '—') + '</td>'
            + '<td>' + dashEsc(row.browser || '—') + '</td>'
            + '<td><span class="dash-al-ip">' + dashEsc(row.ipAddress || '—') + '</span></td>'
            + '<td>' + dashEsc(row.operatingSystem || '—') + '</td>'
            + '</tr>';
    }).join('');
}

function dashAlClearFilters() {
    ['dashAlAction', 'dashAlDateFrom', 'dashAlDateTo'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    dashAlApplyFilters();
}

async function dashLoadAudit() {
    var body = document.getElementById('dashAlBody');
    if (body) body.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></td></tr>';

    var r = await apiFetch('/Dashboard/GetMyAuditLogs');
    if (!r || !r.success) {
        if (body) body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">تعذّر التحميل</td></tr>';
        return;
    }
    dashLoaded.audit = true;
    dashAlAll = (r.data || []).map(function (x) {
        return {
            action: x.action || x.Action,
            createdAt: x.createdAt || x.CreatedAt,
            browser: x.browser || x.Browser,
            ipAddress: x.ipAddress || x.IpAddress,
            operatingSystem: x.operatingSystem || x.OperatingSystem
        };
    });

    var sel = document.getElementById('dashAlAction');
    if (sel) {
        sel.innerHTML = '<option value="">العملية</option>';
        (r.actions || []).forEach(function (a) {
            var o = document.createElement('option');
            o.value = a;
            o.textContent = a;
            sel.appendChild(o);
        });
    }
    dashAlApplyFilters();
}
