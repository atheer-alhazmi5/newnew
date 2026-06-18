'use strict';
/**
 * مودال «تفاصيل الإجراء» — مشترك بين:
 *  - صفحة «تقديم طلب جديد» (الزر «تفاصيل» داخل البطاقة في الخطوة الأولى)
 *  - صفحة «صندوق الصادر» (الزر «تفاصيل الإجراء» داخل تفاصيل الطلب)
 *
 * يعرض كل بيانات الإجراء + جدول سير العمل بنفس تخطيط النظام (Saudi Enterprise Style).
 */
(function () {
    if (window.opdShow) return; // already loaded

    function escA(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    function escH(s) {
        if (s == null) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function normBi(ic) {
        if (!ic) return 'bi-file-earmark-text';
        var v = String(ic).trim();
        if (!v) return 'bi-file-earmark-text';
        return v.indexOf('bi-') === 0 ? v : 'bi-' + v;
    }
    function ensureModal() {
        if (document.getElementById('opdModal')) return document.getElementById('opdModal');
        var html = ''
            + '<div class="modal fade opd-modal-wrap" id="opdModal" tabindex="-1">'
            + '  <div class="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">'
            + '    <div class="modal-content opd-modal">'
            + '      <div class="opd-modal-header">'
            + '        <button type="button" class="opd-x" data-bs-dismiss="modal" aria-label="إغلاق"><i class="bi bi-x-lg"></i></button>'
            + '        <h5 class="opd-modal-title">تفاصيل الإجراء</h5>'
            + '      </div>'
            + '      <div class="opd-modal-body" id="opdBody">'
            + '        <div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>'
            + '      </div>'
            + '      <div class="opd-modal-footer">'
            + '        <button type="button" class="opd-btn-close" data-bs-dismiss="modal">إغلاق</button>'
            + '      </div>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        var d = document.createElement('div');
        d.innerHTML = html.trim();
        document.body.appendChild(d.firstChild);
        return document.getElementById('opdModal');
    }
    function ensureStyles() {
        if (document.getElementById('opd-styles')) return;
        var css = ''
+ '.opd-modal { border-radius:20px; border:none; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,.18); }'
+ '.opd-modal-header { padding:18px 24px; position:relative; background:var(--sa-800); color:#fff; }'
+ '.opd-modal-title { margin:0; font-weight:800; font-size:18px; color:#fff; }'
+ '.opd-modal-header .opd-x { position:absolute; top:14px; left:14px; background:rgba(255,255,255,.12); border:none; color:#fff; width:32px; height:32px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:16px; transition:background .15s; }'
+ '.opd-modal-header .opd-x:hover { background:rgba(255,255,255,.22); }'
+ '.opd-modal-body { padding:20px 24px; max-height:78vh; overflow-y:auto; background:#fff; }'
+ '.opd-modal-footer { padding:14px 24px; display:flex; justify-content:flex-end; gap:10px; background:var(--gray-50); border-top:1px solid var(--gray-200); }'
+ '.opd-btn-close { padding:9px 22px; border-radius:10px; font-weight:700; font-size:13px; font-family:"Cairo",sans-serif; border:2px solid var(--gray-200); background:#fff; color:var(--gray-700); cursor:pointer; transition:all .15s; }'
+ '.opd-btn-close:hover { background:var(--gray-100); border-color:var(--gray-300); }'

+ '.opd-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:14px 16px; background:linear-gradient(180deg,var(--sa-50),#fff); border:1px solid var(--sa-100); border-radius:12px; margin-bottom:16px; flex-wrap:wrap; }'
+ '.opd-head-ttl { font-weight:800; font-size:15px; color:var(--sa-800); display:inline-flex; align-items:center; gap:8px; }'
+ '.opd-head-ttl i { font-size:18px; color:var(--sa-600); }'
+ '.opd-head-meta { display:flex; align-items:center; gap:10px; }'
+ '.opd-type-ic { width:38px !important; height:38px !important; border-radius:10px !important; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:16px; flex-shrink:0; }'
+ '.opd-head-info .opd-head-name { font-weight:800; font-size:14px; color:var(--gray-900); }'
+ '.opd-head-info .opd-head-sub { font-size:11.5px; color:var(--gray-500); font-weight:600; direction:ltr; text-align:right; }'

+ '.opd-section { margin-bottom:18px; }'
+ '.opd-section-ttl { font-weight:800; font-size:14px; color:var(--sa-800); background:var(--sa-50); border:1px solid var(--sa-100); border-bottom:none; border-top-right-radius:10px; border-top-left-radius:10px; padding:9px 14px; }'
+ '.opd-table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--gray-200); border-radius:0; font-family:"Cairo",sans-serif; }'
+ '.opd-section .opd-table { border-top-right-radius:0; border-top-left-radius:0; border-bottom-right-radius:10px; border-bottom-left-radius:10px; overflow:hidden; }'
+ '.opd-table .opd-th { background:var(--gray-50); color:var(--gray-700); font-weight:700; font-size:12.5px; padding:8px 12px; text-align:right; border:1px solid var(--gray-200); white-space:nowrap; width:1%; }'
+ '.opd-table .opd-td { padding:8px 12px; font-size:13px; color:var(--gray-900); border:1px solid var(--gray-200); vertical-align:middle; background:#fff; }'
+ '.opd-table .opd-pre { white-space:pre-wrap; line-height:1.7; font-size:12.5px; color:var(--gray-800); }'
+ '.opd-empty { color:var(--gray-300); font-weight:500; letter-spacing:2px; }'
+ '.opd-muted { color:var(--gray-400); font-weight:500; font-size:11.5px; }'

+ '.opd-table-scroll { overflow-x:auto; border:1px solid var(--gray-200); border-top:none; border-bottom-right-radius:10px; border-bottom-left-radius:10px; background:#fff; }'
+ '.opd-wf-table thead th { background:var(--gray-50); color:var(--gray-700); font-weight:700; font-size:12px; padding:9px 10px; text-align:center; border:1px solid var(--gray-200); white-space:nowrap; }'
+ '.opd-wf-table tbody td { padding:8px 10px; font-size:12.5px; color:var(--gray-800); border:1px solid var(--gray-200); text-align:center; vertical-align:middle; }'
+ '.opd-wf-table tbody tr:hover td { background:var(--sa-25); }'
+ '.opd-wf-table .opd-cnum { font-weight:800; color:var(--gray-500); width:42px; }'
+ '.opd-wf-table .opd-step-name { font-weight:700; color:var(--gray-900); text-align:right; }'
+ '.opd-wf-table .opd-c { text-align:center; }'
+ '.opd-empty-row { text-align:center; color:var(--gray-400); font-style:normal; padding:18px 8px; font-size:13px; background:#fff; }'

+ '.opd-status-chip { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px; background:var(--gray-50); border:1px solid var(--gray-200); font-size:11.5px; font-weight:700; color:var(--gray-700); }'
+ '.opd-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }'

+ '.opd-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:700; line-height:1.4; border:1px solid transparent; white-space:nowrap; }'
+ '.opd-pill i { font-size:11.5px; }'
+ '.opd-pill-ok    { background:var(--success-100); color:var(--success-700); border-color:var(--success-200); }'
+ '.opd-pill-no    { background:var(--error-100);   color:var(--error-700);   border-color:var(--error-200); }'
+ '.opd-pill-warn  { background:#fef3c7; color:#92400e; border-color:#fde68a; }'
+ '.opd-pill-muted { background:var(--gray-100); color:var(--gray-600); border-color:var(--gray-200); }'
+ '.opd-pill-urgent{ background:#fde8e8; color:#b42318; border-color:#fecdca; }'
+ '.opd-pill-high  { background:#fff1e6; color:#b54708; border-color:#fed7aa; }'
+ '.opd-pill-med   { background:#fef9c3; color:#854d0e; border-color:#fde047; }'
+ '.opd-pill-low   { background:#e0f2fe; color:#075985; border-color:#bae6fd; }'

+ '@media (max-width:768px) { .opd-table .opd-th, .opd-table .opd-td { font-size:12px; padding:6px 8px; } .opd-modal-body { padding:14px 16px; } }';

        var s = document.createElement('style');
        s.id = 'opd-styles';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function statusBadge(code, label, isActive) {
        var c = (code || '').toLowerCase();
        var cls = 'opd-pill opd-pill-muted';
        var ic = 'bi-dash-circle';
        if (c === 'approved') { cls = 'opd-pill opd-pill-ok'; ic = 'bi-check-circle-fill'; }
        else if (c === 'pending') { cls = 'opd-pill opd-pill-warn'; ic = 'bi-hourglass-split'; }
        else if (c === 'rejected') { cls = 'opd-pill opd-pill-no'; ic = 'bi-x-circle-fill'; }
        else if (c === 'draft') { cls = 'opd-pill opd-pill-muted'; ic = 'bi-pencil-fill'; }
        var act = isActive
            ? ' <span class="opd-pill opd-pill-ok"><i class="bi bi-toggle-on"></i> مفعّل</span>'
            : ' <span class="opd-pill opd-pill-muted"><i class="bi bi-toggle-off"></i> غير مفعّل</span>';
        return '<span class="' + cls + '"><i class="bi ' + ic + '"></i> ' + escH(label || code || '—') + '</span>' + act;
    }

    function priorityBadge(p) {
        var v = (p || '').trim();
        var cls = 'opd-pill opd-pill-muted';
        var ic = 'bi-dash';
        if (v === 'عاجل')   { cls = 'opd-pill opd-pill-urgent'; ic = 'bi-exclamation-triangle-fill'; }
        else if (v === 'عالي') { cls = 'opd-pill opd-pill-high'; ic = 'bi-arrow-up'; }
        else if (v === 'متوسط') { cls = 'opd-pill opd-pill-med'; ic = 'bi-dash'; }
        else if (v === 'منخفض') { cls = 'opd-pill opd-pill-low'; ic = 'bi-arrow-down'; }
        return '<span class="' + cls + '"><i class="bi ' + ic + '"></i> ' + escH(v || '—') + '</span>';
    }

    function buildHtml(d, workflow) {
        function dash(v) { return (v == null || String(v).trim() === '') ? '<span class="opd-empty">…</span>' : escH(String(v)); }
        function refs(list) {
            if (!Array.isArray(list) || list.length === 0) return '<span class="opd-empty">…</span>';
            return list.map(function (x, i) { return (i + 1) + '- ' + escH(x.name || '') + (x.code ? ' <span class="opd-muted">(' + escH(x.code) + ')</span>' : ''); }).join('<br>');
        }
        function orgUnits(list) {
            if (!Array.isArray(list) || list.length === 0) return '<span class="opd-empty">…</span>';
            return list.map(function (x, i) { return (i + 1) + '- ' + escH(x.name || ''); }).join('<br>');
        }
        function reglist(list) {
            if (!Array.isArray(list) || list.length === 0) return '<span class="opd-empty">…</span>';
            return list.map(function (s, i) { return (i + 1) + '- ' + escH(String(s || '')); }).join('<br>');
        }
        function row(cells) {
            return '<tr>' + cells.map(function (c) {
                var lbl = c.lbl ? '<th class="opd-th">' + escH(c.lbl) + '</th>' : '';
                var spanAttr = c.span ? ' colspan="' + (c.span * 2 - 1) + '"' : '';
                return lbl + '<td class="opd-td"' + spanAttr + '>' + (c.val == null ? '<span class="opd-empty">…</span>' : c.val) + '</td>';
            }).join('') + '</tr>';
        }

        var icon = normBi(d.typeIcon);
        var tColor = d.typeColor || '#25935F';

        var head =
            '<div class="opd-head">'
            + '<div class="opd-head-ttl"><i class="bi bi-file-earmark-text"></i> تفاصيل الإجراء</div>'
            + '<div class="opd-head-meta">'
            +   '<span class="opd-type-ic" style="background:' + escA(tColor) + ';"><i class="' + escA(icon) + '"></i></span>'
            +   '<div class="opd-head-info">'
            +     '<div class="opd-head-name">' + escH(d.name || '') + '</div>'
            +     '<div class="opd-head-sub">' + escH(d.code || '') + (d.versionLabel ? ' • ' + escH(d.versionLabel) : '') + (d.typeName ? ' • ' + escH(d.typeName) : '') + '</div>'
            +   '</div>'
            + '</div>'
            + '</div>';

        var detailsTbl =
            '<div class="opd-section">'
            + '<div class="opd-section-ttl">تفاصيل الإجراء</div>'
            + '<table class="opd-table"><tbody>'
            +   row([
                    { lbl: 'ترميز الإجراء', val: dash(d.code) },
                    { lbl: 'اسم الإجراء', val: dash(d.name) },
                    { lbl: 'حالة الإجراء', val: statusBadge(d.statusCode, d.statusLabel, d.isActive) }
                ])
            +   row([
                    { lbl: 'صلاحية الإجراء', val: dash(d.validityType) },
                    { lbl: 'تاريخ بدء الصلاحية', val: d.validityStartDate ? escH(d.validityStartDate) : '<span class="opd-empty">…</span>' },
                    { lbl: 'تاريخ انتهاء الصلاحية', val: d.validityEndDate ? escH(d.validityEndDate) : '<span class="opd-empty">…</span>' }
                ])
            +   row([
                    { lbl: 'الهدف من الإجراء', val: d.objectives ? '<div class="opd-pre">' + escH(d.objectives) + '</div>' : '<span class="opd-empty">…</span>', span: 3 }
                ])
            +   row([
                    { lbl: 'معدل الاستخدام', val: dash(d.usageFrequency) },
                    { lbl: 'التصنيف', val: dash(d.procedureClassification) },
                    { lbl: 'نوع الإجراء', val: dash(d.typeName) }
                ])
            +   row([
                    { lbl: 'الأولوية', val: d.priority ? priorityBadge(d.priority) : '<span class="opd-empty">…</span>' },
                    { lbl: 'مساحة العمل', val: dash(d.workspaceName) },
                    { lbl: 'الوحدة التنظيمية المالكة للإجراء', val: dash(d.ownerOrgName) }
                ])
            +   row([
                    { lbl: 'الوحدات التنظيمية المستهدفة', val: orgUnits(d.targetOrgUnits), span: 3 }
                ])
            +   row([
                    { lbl: 'الإجراءات السابقة المرتبطة', val: refs(d.previousProcedures), span: 3 }
                ])
            +   row([
                    { lbl: 'الإجراءات الضمنية المرتبطة', val: refs(d.implicitProcedures), span: 3 }
                ])
            +   row([
                    { lbl: 'الإجراءات اللاحقة المرتبطة', val: refs(d.nextProcedures), span: 3 }
                ])
            +   row([
                    { lbl: 'المدخلات', val: d.additionalInputs ? '<div class="opd-pre">' + escH(d.additionalInputs) + '</div>' : '<span class="opd-empty">…</span>', span: 3 }
                ])
            +   row([
                    { lbl: 'المخرجات', val: d.additionalOutputs ? '<div class="opd-pre">' + escH(d.additionalOutputs) + '</div>' : '<span class="opd-empty">…</span>', span: 3 }
                ])
            +   row([
                    { lbl: 'الأنظمة واللوائح والتعليمات المنظمة لعمل الإجراء', val: reglist(d.regulations), span: 3 }
                ])
            + '</tbody></table>'
            + '</div>';

        var wfHead =
            '<thead><tr>'
            + '<th>ت</th>'
            + '<th>اسم الخطوة</th>'
            + '<th>المكلف بالتنفيذ</th>'
            + '<th>المنفذ</th>'
            + '<th>مدة الإنجاز</th>'
            + '<th>الإرجاع</th>'
            + '<th>خطوة الرجوع</th>'
            + '<th>موافقات متزامنة</th>'
            + '<th>النموذج المستخدم</th>'
            + '<th>قناة الإشعار</th>'
            + '<th>الحالة</th>'
            + '</tr></thead>';

        var wfBody = '';
        if (!Array.isArray(workflow) || workflow.length === 0) {
            wfBody = '<tbody><tr><td colspan="11" class="opd-empty-row">لا توجد خطوات سير عمل معرَّفة</td></tr></tbody>';
        } else {
            wfBody = '<tbody>' + workflow.map(function (w) {
                var stColor = w.statusColor && /^#/.test(w.statusColor) ? w.statusColor : '#9DA4AE';
                var stChip = w.statusLabel && w.statusLabel !== '—'
                    ? '<span class="opd-status-chip"><span class="opd-status-dot" style="background:' + escA(stColor) + '"></span>' + escH(w.statusLabel) + '</span>'
                    : '<span class="opd-empty">…</span>';
                var retChip = w.canReturn
                    ? '<span class="opd-pill opd-pill-ok"><i class="bi bi-check-circle-fill"></i> نعم</span>'
                    : '<span class="opd-pill opd-pill-no"><i class="bi bi-dash-circle"></i> لا</span>';
                return '<tr>'
                    + '<td class="opd-cnum">' + escH(String(w.index)) + '</td>'
                    + '<td class="opd-step-name">' + escH(w.stepLabel || '') + '</td>'
                    + '<td>' + escH(w.assigner || '—') + '</td>'
                    + '<td>' + escH(w.executors || '—') + '</td>'
                    + '<td>' + escH(w.duration || '—') + '</td>'
                    + '<td class="opd-c">' + retChip + '</td>'
                    + '<td>' + escH(w.returnLabel || '—') + '</td>'
                    + '<td>' + escH(w.concurrentLabel || '—') + '</td>'
                    + '<td>' + escH(w.formName || '—') + '</td>'
                    + '<td>' + escH(w.channelLabel || '—') + '</td>'
                    + '<td>' + stChip + '</td>'
                    + '</tr>';
            }).join('') + '</tbody>';
        }

        var workflowTbl =
            '<div class="opd-section">'
            + '<div class="opd-section-ttl">سير عمل الإجراء</div>'
            + '<div class="opd-table-scroll"><table class="opd-table opd-wf-table">' + wfHead + wfBody + '</table></div>'
            + '</div>';

        return head + detailsTbl + workflowTbl;
    }

    async function opdShow(procedureId, opts) {
        ensureStyles();
        var modalEl = ensureModal();
        var body = document.getElementById('opdBody');
        if (body) body.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
        var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();

        var url = '/Outbox/GetProcedureDetails?id=' + encodeURIComponent(procedureId);
        if (opts && opts.outboxRequestId) url += '&outboxRequestId=' + encodeURIComponent(opts.outboxRequestId);

        var r = null;
        try { r = await apiFetch(url); } catch (e) { r = null; }
        if (!r || !r.success) {
            if (body) body.innerHTML = '<div class="text-center py-4" style="color:var(--gray-500);"><i class="bi bi-exclamation-circle" style="font-size:28px;display:block;margin-bottom:6px;color:var(--gray-300);"></i>تعذّر تحميل تفاصيل الإجراء</div>';
            return;
        }
        body.innerHTML = buildHtml(r.data || {}, r.workflow || []);
    }

    window.opdShow = opdShow;
})();
