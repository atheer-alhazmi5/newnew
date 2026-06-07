'use strict';

var spAll = [];
var spIsAdmin = false;
var spCreateAttachments = [];
var spUpdateId = null;
var spDeleteId = null;
var spCreateModal = null;
var spUpdateModal = null;
var spDetailModal = null;
var spDeleteModal = null;

function spEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function spCatBadge(cat) {
    var v = (cat || '').trim();
    var cls = 'sp-badge';
    if (v === 'استفسار') cls += ' sp-cat-inquiry';
    else if (v === 'شكوى') cls += ' sp-cat-complaint';
    else if (v === 'ملاحظة') cls += ' sp-cat-note';
    else if (v === 'اقتراح') cls += ' sp-cat-suggestion';
    else if (v === 'دعم فني') cls += ' sp-cat-support';
    else if (v === 'طلب تفويض') cls += ' sp-cat-delegation';
    else return '<span class="sp-badge" style="background:var(--gray-100);color:var(--gray-600);border:1px solid var(--gray-200);">' + spEsc(v || '—') + '</span>';
    return '<span class="' + cls + '">' + spEsc(v || '—') + '</span>';
}

function spImpBadge(imp) {
    var v = (imp || '').trim();
    var cls = 'sp-badge';
    if (v === 'عالية') cls += ' sp-imp-high';
    else if (v === 'منخفضة') cls += ' sp-imp-low';
    else cls += ' sp-imp-med';
    return '<span class="' + cls + '">' + spEsc(v || 'متوسطة') + '</span>';
}

function spStatusBadge(st) {
    var v = (st || '').trim();
    if (v === 'مغلق') return '<span class="sp-badge sp-st-closed"><i class="bi bi-circle-fill" style="font-size:8px;"></i> مغلق</span>';
    return '<span class="sp-badge sp-st-open"><i class="bi bi-circle-fill" style="font-size:8px;"></i> مفتوح</span>';
}

function spAttachmentsHtml(list) {
    if (!list || !list.length) return '<span class="text-muted">—</span>';
    return '<div class="sp-attach-list">' + list.map(function (a) {
        var url = typeof appResolveUrl === 'function' ? appResolveUrl(a.url) : a.url;
        return '<a class="sp-attach-item" href="' + spEsc(url) + '" target="_blank" rel="noopener"><i class="bi bi-paperclip"></i> ' + spEsc(a.name || 'مرفق') + '</a>';
    }).join('') + '</div>';
}

function spColspan() {
    return spIsAdmin ? 10 : 8;
}

function spInit() {
    spIsAdmin = window.spIsAdmin === true || window.spIsAdmin === 'true';
    spCreateModal = document.getElementById('spCreateModal') ? bootstrap.Modal.getOrCreateInstance(document.getElementById('spCreateModal')) : null;
    spUpdateModal = document.getElementById('spUpdateModal') ? bootstrap.Modal.getOrCreateInstance(document.getElementById('spUpdateModal')) : null;
    spDetailModal = document.getElementById('spDetailModal') ? bootstrap.Modal.getOrCreateInstance(document.getElementById('spDetailModal')) : null;
    spDeleteModal = document.getElementById('spDeleteModal') ? bootstrap.Modal.getOrCreateInstance(document.getElementById('spDeleteModal')) : null;
    spLoad();
}

async function spLoad() {
    var body = document.getElementById('spBody');
    if (body) body.innerHTML = '<tr><td colspan="' + spColspan() + '" class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></td></tr>';

    var r = await apiFetch('/Support/GetTickets');
    if (!r || !r.success) {
        if (body) body.innerHTML = '<tr><td colspan="' + spColspan() + '"><div class="sp-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر تحميل البيانات</p></div></td></tr>';
        return;
    }

    spAll = r.data || [];
    spIsAdmin = r.isAdmin === true;

    if (spIsAdmin) {
        var orgSel = document.getElementById('spFilterOrgUnit');
        if (orgSel) {
            var cur = orgSel.value;
            var names = {};
            spAll.forEach(function (t) {
                if (t.organizationalUnitName) names[t.organizationalUnitName] = true;
            });
            orgSel.innerHTML = '<option value="">الوحدة التنظيمية</option>';
            Object.keys(names).sort(function (a, b) { return a.localeCompare(b, 'ar'); }).forEach(function (n) {
                var o = document.createElement('option');
                o.value = n;
                o.textContent = n;
                orgSel.appendChild(o);
            });
            if (cur) orgSel.value = cur;
        }
    }

    spApplyFilters();
}

function spMatchSearch(item, q) {
    if (!q) return true;
    var s = q.toLowerCase();
    if ((item.requestNumber || '').toLowerCase().indexOf(s) >= 0) return true;
    if ((item.submitterName || '').toLowerCase().indexOf(s) >= 0) return true;
    if ((item.subject || '').toLowerCase().indexOf(s) >= 0) return true;
    return false;
}

function spDateBetween(iso, from, to) {
    if (!iso) return true;
    var day = String(iso).substring(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
}

function spApplyFilters() {
    var q = (document.getElementById('spSearch')?.value || '').trim();
    var org = document.getElementById('spFilterOrgUnit')?.value || '';
    var cat = document.getElementById('spFilterCategory')?.value || '';
    var imp = document.getElementById('spFilterImportance')?.value || '';
    var from = document.getElementById('spFilterDateFrom')?.value || '';
    var to = document.getElementById('spFilterDateTo')?.value || '';
    var st = document.getElementById('spFilterStatus')?.value || '';

    var filtered = spAll.filter(function (item) {
        if (!spMatchSearch(item, q)) return false;
        if (org && (item.organizationalUnitName || '') !== org) return false;
        if (cat && item.category !== cat) return false;
        if (imp && item.importance !== imp) return false;
        if (st && item.status !== st) return false;
        if (!spDateBetween(item.createdAt, from, to)) return false;
        return true;
    });

    spRenderTable(filtered);
}

function spClearFilters() {
    ['spSearch', 'spFilterOrgUnit', 'spFilterCategory', 'spFilterImportance', 'spFilterDateFrom', 'spFilterDateTo', 'spFilterStatus'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    spApplyFilters();
}

function spRenderTable(list) {
    var body = document.getElementById('spBody');
    if (!body) return;

    if (!list.length) {
        body.innerHTML = '<tr><td colspan="' + spColspan() + '"><div class="sp-empty"><i class="bi bi-headset"></i><p>لا توجد طلبات</p></div></td></tr>';
        return;
    }

    var html = '';
    list.forEach(function (item, idx) {
        var closed = item.status === 'مغلق';
        var acts = '<button type="button" class="sp-act-btn sp-act-detail" onclick="spShowDetail(' + item.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>';
        if (!closed) {
            if (spIsAdmin) {
                acts += ' <button type="button" class="sp-act-btn sp-act-edit" onclick="spShowUpdate(' + item.id + ')"><i class="bi bi-pencil"></i> تحديث</button>';
            } else {
                acts += ' <button type="button" class="sp-act-btn sp-act-del" onclick="spShowDelete(' + item.id + ')"><i class="bi bi-trash"></i> حذف</button>';
            }
        }

        html += '<tr>';
        html += '<td>' + (idx + 1) + '</td>';
        html += '<td><span class="sp-req-num">' + spEsc(item.requestNumber || '—') + '</span></td>';
        if (spIsAdmin) {
            html += '<td>' + spEsc(item.submitterName || '—') + '</td>';
            html += '<td>' + spEsc(item.organizationalUnitName || '—') + '</td>';
        }
        html += '<td style="direction:ltr;">' + spEsc(item.createdAt || '—') + '</td>';
        html += '<td style="text-align:right;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + spEsc(item.subject) + '">' + spEsc(item.subject || '—') + '</td>';
        html += '<td>' + spCatBadge(item.category) + '</td>';
        html += '<td>' + spImpBadge(item.importance) + '</td>';
        html += '<td>' + spStatusBadge(item.status) + '</td>';
        html += '<td><div class="d-flex flex-wrap gap-1 justify-content-center">' + acts + '</div></td>';
        html += '</tr>';
    });
    body.innerHTML = html;
}

function spShowCreateModal() {
    spCreateAttachments = [];
    var cat = document.getElementById('spCreateCategory'); if (cat) cat.value = '';
    var imp = document.getElementById('spCreateImportance'); if (imp) imp.value = 'متوسطة';
    var sub = document.getElementById('spCreateSubject'); if (sub) sub.value = '';
    var con = document.getElementById('spCreateContent'); if (con) con.value = '';
    var att = document.getElementById('spCreateAttachments'); if (att) att.innerHTML = '';
    var file = document.getElementById('spCreateFile'); if (file) file.value = '';
    if (spCreateModal) spCreateModal.show();
}


function spRenderAttachmentChips(containerId, list, mode) {
    var host = document.getElementById(containerId);
    if (!host) return;
    host.innerHTML = (list || []).map(function (a, i) {
        return '<span class="sp-attach-chip"><i class="bi bi-paperclip"></i> ' + spEsc(a.name)
            + ' <button type="button" onclick="spRemoveAttachment(\'' + mode + '\',' + i + ')" title="إزالة"><i class="bi bi-x-lg"></i></button></span>';
    }).join('');
}

function spRemoveAttachment(mode, idx) {
    if (mode === 'create') {
        spCreateAttachments.splice(idx, 1);
        spRenderAttachmentChips('spCreateAttachments', spCreateAttachments, 'create');
    }
}

async function spHandleUpload(input, mode) {
    if (!input || !input.files || !input.files[0]) return;
    var file = input.files[0];
    input.value = '';

    var form = new FormData();
    form.append('file', file);

    try {
        var res = await fetch(typeof appResolveUrl === 'function' ? appResolveUrl('/Support/UploadAttachment') : '/Support/UploadAttachment', {
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': typeof getCsrfToken === 'function' ? getCsrfToken() : '' },
            body: form
        });
        var r = await res.json();
        if (!r || !r.success) {
            showToast(r?.message || 'فشل رفع الملف', 'danger');
            return;
        }
        if (mode === 'create') {
            spCreateAttachments.push({ name: r.name || file.name, url: r.url });
            spRenderAttachmentChips('spCreateAttachments', spCreateAttachments, 'create');
        }
    } catch (e) {
        showToast('خطأ في رفع الملف', 'danger');
    }
}

async function spSubmitCreate() {
    var payload = {
        category: document.getElementById('spCreateCategory')?.value || '',
        importance: document.getElementById('spCreateImportance')?.value || 'متوسطة',
        subject: document.getElementById('spCreateSubject')?.value || '',
        content: document.getElementById('spCreateContent')?.value || '',
        attachments: spCreateAttachments
    };

    if (!payload.category) { showToast('التصنيف مطلوب', 'warning'); return; }
    if (!payload.subject.trim()) { showToast('الموضوع مطلوب', 'warning'); return; }
    if (!payload.content.trim()) { showToast('المحتوى مطلوب', 'warning'); return; }

    var r = await apiFetch('/Support/CreateTicket', 'POST', payload);
    if (!r || !r.success) {
        showToast(r?.message || 'تعذّر حفظ الطلب', 'danger');
        return;
    }
    showToast(r.message || 'تم تقديم الطلب بنجاح', 'success');
    if (spCreateModal) spCreateModal.hide();
    await spLoad();
}

function spBuildDetailHtml(d, includeStatus) {
    var html = '<div class="sp-detail-grid">';
    html += '<div class="lbl">رقم الطلب</div><div class="val" style="direction:ltr;">' + spEsc(d.requestNumber || '—') + '</div>';
    html += '<div class="lbl">تاريخ الطلب</div><div class="val" style="direction:ltr;">' + spEsc(d.createdAt || '—') + '</div>';
    html += '<div class="lbl">مقدم الطلب</div><div class="val">' + spEsc(d.submitterName || '—') + '</div>';
    html += '<div class="lbl">الوحدة التنظيمية</div><div class="val">' + spEsc(d.organizationalUnitName || '—') + '</div>';
    html += '<div class="lbl">التصنيف</div><div class="val">' + spCatBadge(d.category) + '</div>';
    html += '<div class="lbl">درجة الأهمية</div><div class="val">' + spImpBadge(d.importance) + '</div>';
    if (includeStatus) {
        html += '<div class="lbl">حالة الطلب</div><div class="val">' + spStatusBadge(d.status) + '</div>';
    }
    html += '<div class="lbl">المرفقات</div><div class="val">' + spAttachmentsHtml(d.attachments) + '</div>';
    html += '<div class="lbl">الموضوع</div><div class="val">' + spEsc(d.subject || '—') + '</div>';
    html += '<div class="lbl">المحتوى</div><div class="val"><div class="sp-detail-content">' + spEsc(d.content || '—') + '</div></div>';
    html += '<div class="lbl">الرد</div><div class="val"><div class="sp-detail-content">' + spEsc(d.response || '—') + '</div></div>';
    html += '</div>';
    return html;
}

async function spShowDetail(id) {
    var host = document.getElementById('spDetailBody');
    var sub = document.getElementById('spDetailSub');
    if (host) host.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    if (spDetailModal) spDetailModal.show();

    var r = await apiFetch('/Support/GetTicket?id=' + encodeURIComponent(id));
    if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="sp-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر التحميل</p></div>';
        return;
    }
    var d = r.data || {};
    if (sub) sub.textContent = 'رقم الطلب: ' + (d.requestNumber || '—');
    if (host) host.innerHTML = spBuildDetailHtml(d, true);
}

async function spShowUpdate(id) {
    if (!spIsAdmin) return;
    spUpdateId = id;
    var host = document.getElementById('spUpdateBody');
    var sub = document.getElementById('spUpdateSub');
    if (host) host.innerHTML = '<div class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    if (spUpdateModal) spUpdateModal.show();

    var r = await apiFetch('/Support/GetTicket?id=' + encodeURIComponent(id));
    if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="sp-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر التحميل</p></div>';
        return;
    }
    var d = r.data || {};
    if (sub) sub.textContent = 'رقم الطلب: ' + (d.requestNumber || '—') + ' — سيتم إغلاق الطلب بعد إرسال الرد';

    host.innerHTML = spBuildDetailHtml(d, false)
        + '<hr style="margin:20px 0;border-color:var(--gray-200);">'
        + '<div class="mb-0"><label class="form-label">الرد <span class="text-danger">*</span></label>'
        + '<textarea class="form-control" id="spUpdateResponse" rows="4" placeholder="اكتب ردك على الطلب..." required>' + spEsc(d.response || '') + '</textarea></div>';
}

async function spSubmitUpdate() {
    if (!spUpdateId) return;
    var response = (document.getElementById('spUpdateResponse')?.value || '').trim();
    if (!response) {
        showToast('الرد مطلوب', 'warning');
        var ta = document.getElementById('spUpdateResponse');
        if (ta) {
            ta.classList.add('is-invalid');
            ta.focus();
        }
        return;
    }
    var payload = {
        id: spUpdateId,
        response: response,
        status: 'مغلق'
    };
    var r = await apiFetch('/Support/UpdateTicket', 'POST', payload);
    if (!r || !r.success) {
        showToast(r?.message || 'تعذّر التحديث', 'danger');
        return;
    }
    showToast(r.message || 'تم إغلاق الطلب وإرسال الرد', 'success');
    if (spUpdateModal) spUpdateModal.hide();
    spUpdateId = null;
    await spLoad();
}

function spShowDelete(id) {
    spDeleteId = id;
    var item = spAll.find(function (t) { return t.id === id; });
    var el = document.getElementById('spDeleteName');
    if (el) el.textContent = item ? (item.requestNumber || '—') : '—';
    if (spDeleteModal) spDeleteModal.show();
}

async function spConfirmDelete() {
    if (!spDeleteId) return;
    var r = await apiFetch('/Support/DeleteTicket', 'POST', { id: spDeleteId });
    if (!r || !r.success) {
        showToast(r?.message || 'تعذّر الحذف', 'danger');
        return;
    }
    showToast(r.message || 'تم حذف الطلب', 'success');
    if (spDeleteModal) spDeleteModal.hide();
    spDeleteId = null;
    await spLoad();
}
