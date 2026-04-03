/* forms.js - النماذج الجاهزة */
var ITEMS_PER_PAGE = 12;
var allForms = [], allUsers = [], pickedIds = [], currentFormId = null, currentPage = 1;
var pendingDeleteFormId = 0;
var userRole = window.__userRole || '';

async function init() {
    await loadCategories();
    await loadForms();
}

async function loadCategories() {
    var r = await apiFetch('/Forms/GetForms');
    if (!r || !r.success) return;
    var sel = document.getElementById('catFilter');
    (r.categories || []).forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c.name; opt.textContent = c.name;
        sel.appendChild(opt);
    });
}

async function loadForms() {
    var search = document.getElementById('searchInput')?.value || '';
    var cat = document.getElementById('catFilter')?.value || '';
    var r = await apiFetch('/Forms/GetForms?search=' + encodeURIComponent(search) + '&category=' + encodeURIComponent(cat));
    if (!r || !r.success) return;
    allForms = r.data || [];
    currentPage = 1;
    renderForms();
}

function renderForms() {
    var grid = document.getElementById('formsGrid');
    var count = document.getElementById('forms-count');
    if (!grid) return;

    if (count) count.textContent = '(' + allForms.length + ')';

    if (allForms.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;">' + emptyState('bi-file-earmark-text', 'لا توجد نماذج', 'لم يتم إضافة نماذج بعد') + '</div>';
        return;
    }

    var start = (currentPage - 1) * ITEMS_PER_PAGE;
    var page = allForms.slice(start, start + ITEMS_PER_PAGE);

    grid.innerHTML = page.map(function(f) {
        var adminBtns = '';
        if (userRole === 'Admin') {
            adminBtns =
                '<button class="f-btn f-btn-outline" onclick="editForm(' + f.id + ')" title="تعديل"><i class="bi bi-pencil"></i></button>' +
                '<button class="f-btn f-btn-danger" onclick="deleteForm(' + f.id + ',\'' + esc(f.name).replace(/'/g, "\\'") + '\')" title="حذف"><i class="bi bi-trash"></i></button>';
        }
        return '<div class="f-card">' +
            '<div class="f-icon">' + getFormIcon(f.icon, 24) + '</div>' +
            '<div class="f-name">' + esc(f.name) + '</div>' +
            '<div class="f-cat">' + esc(f.category || '') + '</div>' +
            '<div class="f-desc">' + esc(f.description || '') + '</div>' +
            '<div class="f-actions">' +
            '<button class="f-btn f-btn-primary" onclick="openSendModal(' + f.id + ')"><i class="bi bi-send"></i> إرسال</button>' +
            '<button class="f-btn f-btn-outline" onclick="viewForm(' + f.id + ')" title="معاينة"><i class="bi bi-eye"></i></button>' +
            adminBtns +
            '</div></div>';
    }).join('');

    if (typeof renderPagination === 'function') {
        renderPagination(
            document.getElementById('paginationContainer'),
            allForms.length, currentPage, ITEMS_PER_PAGE,
            'changePage'
        );
    }
}

function changePage(p) { currentPage = p; renderForms(); }

function viewForm(id) {
    window.location.href = '/FormFill/Index?formId=' + id + '&mode=view';
}

function editForm(id) {
    window.location.href = '/FormBuilder/Index?id=' + id;
}

function deleteForm(id, name) {
    pendingDeleteFormId = id;
    var nameEl = document.getElementById('deleteFormName');
    if (nameEl) nameEl.textContent = name;
    new bootstrap.Modal(document.getElementById('deleteFormModal')).show();
}

async function confirmDeleteForm() {
    if (!pendingDeleteFormId) return;
    var r = await apiFetch('/Forms/Delete?id=' + pendingDeleteFormId, 'DELETE');
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('deleteFormModal')).hide();
        showToast('تم حذف النموذج بنجاح');
        loadForms();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
    pendingDeleteFormId = 0;
}

async function openSendModal(formId) {
    currentFormId = formId;
    pickedIds = [];

    var r = await apiFetch('/Forms/GetUsers');
    if (!r?.success) return;
    allUsers = r.data || [];

    renderRecipientList('');
    updatePickedCount();

    new bootstrap.Modal(document.getElementById('sendModal')).show();
}

function renderRecipientList(search) {
    var list = document.getElementById('recipientList');
    var filtered = allUsers.filter(function(u) {
        return !search || (u.fullName || '').toLowerCase().indexOf(search.toLowerCase()) >= 0;
    });
    if (!list) return;
    list.innerHTML = filtered.map(function(u) {
        return '<div class="send-item ' + (pickedIds.indexOf(u.id) >= 0 ? 'picked' : '') + '" onclick="togglePick(' + u.id + ')">' +
            '<div class="send-avatar">' + (u.fullName ? u.fullName[0] : '?') + '</div>' +
            '<div><div style="font-weight:700;font-size:14px;">' + esc(u.fullName) + '</div>' +
            '<div style="font-size:12px;color:var(--gray-500);">' + esc(u.roleLabel) + ' · ' + esc(u.deptName || '') + '</div></div>' +
            '<i class="bi bi-check-circle-fill send-check"></i></div>';
    }).join('');
}

function togglePick(id) {
    var idx = pickedIds.indexOf(id);
    if (idx >= 0) pickedIds.splice(idx, 1);
    else pickedIds.push(id);
    var search = document.getElementById('recipientSearch')?.value || '';
    renderRecipientList(search);
    updatePickedCount();
}

function updatePickedCount() {
    var el = document.getElementById('selectedCount');
    if (el) el.textContent = pickedIds.length > 0 ? 'تم اختيار ' + pickedIds.length + ' مستلم' : '';
}

async function confirmSend() {
    if (!currentFormId || pickedIds.length === 0) {
        showToast('اختر مستلماً على الأقل', 'warning'); return;
    }
    var btn = document.getElementById('confirmSendBtn');
    btn.disabled = true;

    var r = await apiFetch('/Forms/SendForm', 'POST', {
        formId: currentFormId,
        recipientIds: pickedIds,
        startDate: document.getElementById('startDate')?.value || null,
        endDate: document.getElementById('endDate')?.value || null
    });

    btn.disabled = false;
    if (r?.success) {
        bootstrap.Modal.getInstance(document.getElementById('sendModal')).hide();
        showToast('تم الإرسال بنجاح');
        pickedIds = [];
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
}

function debounce(fn, delay) {
    var t;
    return function() {
        var args = arguments;
        clearTimeout(t);
        t = setTimeout(function() { fn.apply(null, args); }, delay);
    };
}

document.getElementById('searchInput')?.addEventListener('input', debounce(loadForms, 400));
document.getElementById('catFilter')?.addEventListener('change', loadForms);
document.getElementById('recipientSearch')?.addEventListener('input', function() {
    renderRecipientList(this.value);
});

window.changePage = changePage;

init();
