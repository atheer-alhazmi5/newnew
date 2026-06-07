'use strict';

var ntAll = [];
var ntEditingId = null;
var ntDeleteId = null;
var ntFormModal = null;
var ntDetailModal = null;
var ntDeleteModal = null;
var ntMenuDocBound = false;

var ntDefaultColors = { 'عالية': '#fee2e2', 'متوسطة': '#fef9c3', 'منخفضة': '#d1fae5' };

function ntEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function ntImportanceClass(v) {
    if (v === 'عالية') return 'nt-importance-high';
    if (v === 'منخفضة') return 'nt-importance-low';
    return 'nt-importance-med';
}

function ntImportanceLabel(v) {
    if (v === 'عالية') return 'مرتفعة';
    if (v === 'منخفضة') return 'منخفضة';
    return 'متوسطة';
}

function ntEditorCmd(cmd) {
    var ed = document.getElementById('ntEditor');
    if (!ed) return;
    ed.focus();
    document.execCommand(cmd, false, null);
}

function ntEditorLink() {
    var url = prompt('أدخل الرابط (URL):');
    if (!url) return;
    var ed = document.getElementById('ntEditor');
    if (ed) ed.focus();
    document.execCommand('createLink', false, url);
}

function ntOnImportanceChange() {
    var imp = document.getElementById('ntImportance')?.value || 'متوسطة';
    var col = ntDefaultColors[imp] || '#fef9c3';
    var colorIn = document.getElementById('ntColor');
    var hex = document.getElementById('ntColorHex');
    if (colorIn) colorIn.value = col;
    if (hex) hex.textContent = col;
}

function ntOnColorInput() {
    var v = document.getElementById('ntColor')?.value || '';
    var hex = document.getElementById('ntColorHex');
    if (hex) hex.textContent = v;
}

function ntStripHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || d.innerText || '').replace(/\u00a0/g, ' ').trim();
}

function ntToggleCardMenu(id, ev) {
    if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
    }
    var menu = document.getElementById('ntMenu-' + id);
    if (!menu) return;
    var willOpen = menu.classList.contains('d-none');
    document.querySelectorAll('.nt-card-menu').forEach(function (m) { m.classList.add('d-none'); });
    if (willOpen) menu.classList.remove('d-none');
}

function ntCloseCardMenus() {
    document.querySelectorAll('.nt-card-menu').forEach(function (m) { m.classList.add('d-none'); });
}

function ntClearFilters() {
    var s = document.getElementById('ntSearch'); if (s) s.value = '';
    var imp = document.getElementById('ntFilterImportance'); if (imp) imp.value = '';
    var st = document.getElementById('ntFilterStatus'); if (st) st.value = 'active';
    ntApplyFilters();
}

function ntApplyFilters() {
    var q = (document.getElementById('ntSearch')?.value || '').trim().toLowerCase();
    var fImp = document.getElementById('ntFilterImportance')?.value || '';
    var statusEl = document.getElementById('ntFilterStatus');
    var fSt = statusEl ? statusEl.value : 'active';

    var list = ntAll.filter(function (n) {
        if (fSt === 'active' && n.isArchived) return false;
        if (fSt === 'archived' && !n.isArchived) return false;
        if (fImp && n.importance !== fImp) return false;
        if (q && (n.title || '').toLowerCase().indexOf(q) < 0) return false;
        return true;
    });

    list.sort(function (a, b) {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
    });

    ntRenderCards(list);
}

async function ntLoad() {
    var host = document.getElementById('ntCardsHost');
    if (host) host.innerHTML = '<div class="nt-empty"><div class="spinner-border" style="color:var(--sa-600);"></div></div>';
    var r = await apiFetch('/Note/GetNotes');
    if (!r || !r.success) {
        if (host) host.innerHTML = '<div class="nt-empty"><i class="bi bi-exclamation-circle"></i><p>تعذّر تحميل الملاحظات</p></div>';
        return;
    }
    ntAll = r.data || [];
    ntApplyFilters();
}

function ntRenderCards(list) {
    var host = document.getElementById('ntCardsHost');
    if (!host) return;
    if (!list.length) {
        host.innerHTML = '<div class="nt-empty"><i class="bi bi-stickies"></i><p>لا توجد ملاحظات</p></div>';
        return;
    }
    host.innerHTML = list.map(function (n) {
        var bg = n.color || ntDefaultColors[n.importance] || '#fef9c3';
        var pinCls = n.isPinned ? ' is-pinned' : '';
        var pinBtnCls = n.isPinned ? ' is-pinned' : '';
        return ''
            + '<div class="nt-card' + pinCls + '" style="background:' + ntEsc(bg) + ';border-color:' + ntEsc(bg) + ';">'
            +   '<div class="nt-card-top">'
            +     '<div class="nt-card-title">' + ntEsc(n.title) + '</div>'
            +     '<div class="nt-card-top-actions">'
            +       '<button type="button" class="nt-pin-btn' + pinBtnCls + '" title="' + (n.isPinned ? 'إلغاء التثبيت' : 'تثبيت') + '" onclick="ntTogglePin(' + n.id + ')"><i class="bi bi-pin-angle' + (n.isPinned ? '-fill' : '') + '"></i></button>'
            +       '<div class="nt-card-menu-wrap">'
            +         '<button type="button" class="nt-menu-btn" title="إجراءات" onclick="ntToggleCardMenu(' + n.id + ', event)"><i class="bi bi-three-dots-vertical"></i></button>'
            +         '<div class="nt-card-menu d-none" id="ntMenu-' + n.id + '">'
            +           '<button type="button" class="nt-act-btn nt-act-detail" title="تفاصيل" onclick="ntCloseCardMenus(); ntShowDetail(' + n.id + ')"><i class="bi bi-eye"></i></button>'
            +           '<button type="button" class="nt-act-btn nt-act-edit" title="تعديل" onclick="ntCloseCardMenus(); ntShowEditModal(' + n.id + ')"><i class="bi bi-pencil"></i></button>'
            +           '<button type="button" class="nt-act-btn nt-act-archive" title="' + (n.isArchived ? 'استعادة' : 'أرشفة') + '" onclick="ntCloseCardMenus(); ntToggleArchive(' + n.id + ')"><i class="bi bi-' + (n.isArchived ? 'arrow-counterclockwise' : 'archive') + '"></i></button>'
            +           '<button type="button" class="nt-act-btn nt-act-delete" title="حذف" onclick="ntCloseCardMenus(); ntShowDeleteModal(' + n.id + ')"><i class="bi bi-trash"></i></button>'
            +         '</div>'
            +       '</div>'
            +     '</div>'
            +   '</div>'
            +   '<span class="nt-importance-pill ' + ntImportanceClass(n.importance) + '">' + ntEsc(ntImportanceLabel(n.importance)) + '</span>'
            +   '<div class="nt-card-dates">'
            +     '<span><i class="bi bi-calendar-plus"></i> الإنشاء: <span style="direction:ltr;display:inline-block;">' + ntEsc(n.createdAt) + '</span></span>'
            +     '<span><i class="bi bi-pencil-square"></i> التحديث: <span style="direction:ltr;display:inline-block;">' + ntEsc(n.updatedAt) + '</span></span>'
            +   '</div>'
            + '</div>';
    }).join('');
}

function ntResetForm() {
    ntEditingId = null;
    var t = document.getElementById('ntTitle'); if (t) t.value = '';
    var ed = document.getElementById('ntEditor'); if (ed) { ed.innerHTML = ''; ed.classList.remove('is-invalid'); }
    var imp = document.getElementById('ntImportance'); if (imp) imp.value = 'متوسطة';
    var pin = document.getElementById('ntPinCheck'); if (pin) pin.checked = false;
    ntOnImportanceChange();
}

function ntShowAddModal() {
    ntResetForm();
    var title = document.getElementById('ntFormTitle');
    if (title) title.textContent = 'إضافة ملاحظة جديدة';
    var el = document.getElementById('ntFormModal');
    if (!ntFormModal && typeof bootstrap !== 'undefined') ntFormModal = new bootstrap.Modal(el);
    if (ntFormModal) ntFormModal.show();
}

async function ntShowEditModal(id) {
    var r = await apiFetch('/Note/GetNote?id=' + encodeURIComponent(id));
    if (!r || !r.success || !r.data) {
        if (typeof showToast === 'function') showToast(r?.message || 'تعذّر تحميل الملاحظة', 'warning');
        return;
    }
    var n = r.data;
    ntEditingId = n.id;
    document.getElementById('ntFormTitle').textContent = 'تعديل الملاحظة';
    document.getElementById('ntTitle').value = n.title || '';
    document.getElementById('ntEditor').innerHTML = n.contentHtml || '';
    document.getElementById('ntImportance').value = n.importance || 'متوسطة';
    document.getElementById('ntColor').value = n.color || ntDefaultColors[n.importance] || '#fef9c3';
    document.getElementById('ntColorHex').textContent = n.color || ntDefaultColors[n.importance] || '#fef9c3';
    document.getElementById('ntPinCheck').checked = !!n.isPinned;
    var el = document.getElementById('ntFormModal');
    if (!ntFormModal && typeof bootstrap !== 'undefined') ntFormModal = new bootstrap.Modal(el);
    if (ntFormModal) ntFormModal.show();
}

async function ntShowDetail(id) {
    var r = await apiFetch('/Note/GetNote?id=' + encodeURIComponent(id));
    if (!r || !r.success || !r.data) return;
    var n = r.data;
    document.getElementById('ntDetailTitle').textContent = n.title || '—';
    document.getElementById('ntDetailMeta').textContent = ntImportanceLabel(n.importance) + ' · ' + (n.updatedAt || '');
    document.getElementById('ntDetailContent').innerHTML = n.contentHtml || '<span style="color:var(--gray-400);">لا يوجد نص</span>';
    var el = document.getElementById('ntDetailModal');
    if (!ntDetailModal && typeof bootstrap !== 'undefined') ntDetailModal = new bootstrap.Modal(el);
    if (ntDetailModal) ntDetailModal.show();
}

function ntShowDeleteModal(id) {
    ntDeleteId = id;
    var note = ntAll.find(function (n) { return n.id === id; });
    document.getElementById('ntDeleteName').textContent = note ? note.title : '—';
    var el = document.getElementById('ntDeleteModal');
    if (!ntDeleteModal && typeof bootstrap !== 'undefined') ntDeleteModal = new bootstrap.Modal(el);
    if (ntDeleteModal) ntDeleteModal.show();
}

async function ntSaveNote() {
    var title = (document.getElementById('ntTitle')?.value || '').trim();
    var contentHtml = document.getElementById('ntEditor')?.innerHTML || '';
    var editor = document.getElementById('ntEditor');
    if (!title) {
        if (typeof showToast === 'function') showToast('عنوان الملاحظة مطلوب', 'warning');
        return;
    }
    if (!ntStripHtml(contentHtml)) {
        if (typeof showToast === 'function') showToast('نص الملاحظة مطلوب', 'warning');
        if (editor) {
            editor.classList.add('is-invalid');
            editor.focus();
        }
        return;
    }
    if (editor) editor.classList.remove('is-invalid');
    var payload = {
        title: title,
        contentHtml: contentHtml,
        importance: document.getElementById('ntImportance')?.value || 'متوسطة',
        color: document.getElementById('ntColor')?.value || '',
        isPinned: !!document.getElementById('ntPinCheck')?.checked
    };
    var url = '/Note/AddNote';
    if (ntEditingId) {
        payload.id = ntEditingId;
        url = '/Note/UpdateNote';
    }
    var r = await apiFetch(url, 'POST', payload);
    if (!r || !r.success) {
        if (typeof showToast === 'function') showToast(r?.message || 'تعذّر الحفظ', 'warning');
        return;
    }
    if (typeof showToast === 'function') showToast(r.message || 'تم الحفظ', 'success');
    if (ntFormModal) ntFormModal.hide();
    await ntLoad();
}

async function ntConfirmDelete() {
    if (!ntDeleteId) return;
    var r = await apiFetch('/Note/DeleteNote', 'POST', { id: ntDeleteId });
    if (!r || !r.success) {
        if (typeof showToast === 'function') showToast(r?.message || 'تعذّر الحذف', 'warning');
        return;
    }
    if (ntDeleteModal) ntDeleteModal.hide();
    ntDeleteId = null;
    if (typeof showToast === 'function') showToast('تم حذف الملاحظة', 'success');
    await ntLoad();
}

async function ntTogglePin(id) {
    var r = await apiFetch('/Note/TogglePin', 'POST', { id: id });
    if (!r || !r.success) return;
    if (typeof showToast === 'function') showToast(r.isPinned ? 'تم تثبيت الملاحظة' : 'تم إلغاء التثبيت', 'success');
    await ntLoad();
}

async function ntToggleArchive(id) {
    var r = await apiFetch('/Note/ToggleArchive', 'POST', { id: id });
    if (!r || !r.success) {
        if (typeof showToast === 'function') showToast(r?.message || 'تعذّر تحديث الأرشيف', 'warning');
        return;
    }
    if (typeof showToast === 'function') showToast(r.isArchived ? 'تمت أرشفة الملاحظة' : 'تمت استعادة الملاحظة', 'success');
    await ntLoad();
}

function ntInit() {
    ntDefaultColors = { 'عالية': '#fee2e2', 'متوسطة': '#fef9c3', 'منخفضة': '#d1fae5' };
    if (!ntMenuDocBound) {
        document.addEventListener('click', ntCloseCardMenus);
        ntMenuDocBound = true;
    }
    ntLoad();
}

window.ntInit = ntInit;
window.ntShowAddModal = ntShowAddModal;
window.ntShowEditModal = ntShowEditModal;
window.ntShowDetail = ntShowDetail;
window.ntShowDeleteModal = ntShowDeleteModal;
window.ntSaveNote = ntSaveNote;
window.ntConfirmDelete = ntConfirmDelete;
window.ntTogglePin = ntTogglePin;
window.ntToggleArchive = ntToggleArchive;
window.ntToggleCardMenu = ntToggleCardMenu;
window.ntCloseCardMenus = ntCloseCardMenus;
window.ntApplyFilters = ntApplyFilters;
window.ntClearFilters = ntClearFilters;
window.ntEditorCmd = ntEditorCmd;
window.ntEditorLink = ntEditorLink;
window.ntOnImportanceChange = ntOnImportanceChange;
window.ntOnColorInput = ntOnColorInput;
