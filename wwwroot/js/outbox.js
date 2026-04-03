/* outbox.js */
var ITEMS_PER_PAGE = 10;
var allItems = [], currentPage = 1;

async function loadOutbox() {
    var status = document.getElementById('statusFilter')?.value || '';
    var r = await apiFetch('/Outbox/GetItems?status=' + encodeURIComponent(status));
    if (!r || !r.success) return;
    allItems = r.data || [];
    currentPage = 1;
    renderTable();
}

function renderTable() {
    var body = document.getElementById('outboxBody');
    if (!body) return;

    if (allItems.length === 0) {
        body.innerHTML = '<tr><td colspan="6">' + emptyState('bi-send', 'لا توجد نماذج مرسلة', 'لم ترسل أي نماذج بعد') + '</td></tr>';
        return;
    }

    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var page = allItems.slice(start, start + ITEMS_PER_PAGE);

    body.innerHTML = page.map(function(item) {
        var sentTo = '';
        try {
            var arr = JSON.parse(item.sentToJson || '[]');
            sentTo = arr.map(function(x) { return x.fullName || x.name || ''; }).filter(Boolean).join('، ') || 'غير محدد';
        } catch(e) { sentTo = 'متعدد'; }

        return '<tr>' +
            '<td><div class="d-flex align-items-center gap-2">' +
                '<div style="width:36px;height:36px;border-radius:10px;background:var(--sa-50);display:flex;align-items:center;justify-content:center;">' +
                    getFormIcon(item.formIcon, 18) +
                '</div>' +
                '<span style="font-weight:600">' + esc(item.formName) + '</span>' +
            '</div></td>' +
            '<td style="font-size:13px;color:var(--gray-600);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(sentTo) + '</td>' +
            '<td>' + fmtDate(item.sentDate) + '</td>' +
            '<td>' + statusBadge(item.status) + '</td>' +
            '<td><button class="btn btn-sm btn-outline-success" onclick="viewReplies(' + item.formId + ',\'' + esc(item.formName).replace(/'/g, "\\'") + '\')">' +
                '<i class="bi bi-reply-all"></i> عرض الردود</button></td>' +
            '<td><div class="d-flex gap-1">' +
                '<button class="btn btn-sm btn-outline-primary" onclick="viewForm(' + item.formId + ')" title="معاينة">' +
                    '<i class="bi bi-eye"></i></button>' +
            '</div></td></tr>';
    }).join('');

    renderPagination(
        document.getElementById('paginationContainer'),
        allItems.length, currentPage, ITEMS_PER_PAGE,
        'changePage'
    );
}

function changePage(p) { currentPage = p; renderTable(); }

function viewForm(formId) {
    window.location.href = '/FormFill/Index?formId=' + formId + '&mode=view';
}

async function viewReplies(formId, formName) {
    var body = document.getElementById('repliesBody');
    body.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    new bootstrap.Modal(document.getElementById('repliesModal')).show();

    var r = await apiFetch('/Outbox/GetReplies?formId=' + formId);
    if (!r || !r.success || !r.data || r.data.length === 0) {
        body.innerHTML = '<div class="text-center py-5"><i class="bi bi-inbox" style="font-size:40px;color:var(--gray-400);"></i>' +
            '<h6 style="color:var(--gray-500);margin-top:12px;">لا توجد ردود حتى الآن</h6></div>';
        return;
    }

    var formR = await apiFetch('/Forms/GetForm?id=' + formId);
    var sections = [];
    if (formR && formR.success && formR.data) {
        try { sections = JSON.parse(formR.data.sectionsJson || '[]'); } catch(e) {}
    }

    var questionsMap = {};
    sections.forEach(function(sec) {
        (sec.questions || []).forEach(function(q) {
            questionsMap[q.id] = q.label || q.text || q.question || '';
        });
    });

    var html = '<h6 style="font-weight:700;margin-bottom:16px;color:var(--sa-800);">' +
        '<i class="bi bi-file-earmark-text" style="margin-left:6px;"></i>' + esc(formName) +
        ' <span style="font-weight:400;color:var(--gray-500);">(' + r.data.length + ' رد)</span></h6>';

    r.data.forEach(function(reply) {
        var answersArr = [];
        try { answersArr = JSON.parse(reply.answersJson || '[]'); } catch(e) {}

        html += '<div class="reply-card">' +
            '<div class="reply-header">' +
                '<div><span class="reply-name">' + esc(reply.responderName) + '</span>' +
                    '<span class="reply-dept" style="margin-right:8px;">(' + esc(reply.responderDepartment) + ')</span></div>' +
                '<div class="d-flex align-items-center gap-2">' +
                    '<span class="reply-date">' + fmtDate(reply.replyDate) + '</span>' +
                    '<button class="btn btn-sm btn-outline-danger" onclick="downloadPdf(' + formId + ',' + reply.id + ')" title="تحميل PDF">' +
                        '<i class="bi bi-file-earmark-pdf"></i></button>' +
                '</div>' +
            '</div>';

        if (answersArr.length > 0) {
            answersArr.forEach(function(a) {
                var qLabel = a.label || a.question || questionsMap[a.questionId] || 'سؤال';
                html += '<div class="reply-answer">' +
                    '<div class="q-label">' + esc(qLabel) + '</div>' +
                    '<div class="q-value">' + esc(a.answer || '—') + '</div></div>';
            });
        } else {
            html += '<div style="color:var(--gray-500);font-size:13px;">لا توجد إجابات</div>';
        }
        html += '</div>';
    });

    body.innerHTML = html;
}

function downloadPdf(formId, replyId) {
    window.open('/FormFill/PrintView?formId=' + formId + '&replyId=' + replyId, '_blank');
}

window.changePage = changePage;
loadOutbox();
