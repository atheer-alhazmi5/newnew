'use strict';
/**
 * دليل المستخدم — قارئ تفاعلي
 * يقرأ من /Guide/GetReaderItems — تصميم الكتاب المفتوح + شجرة + تقدم + تكبير.
 */

let grItems = [];
let grFlat = [];
let grActiveIndex = 0;
let grSearchQuery = '';

const GR_MENU_EMOJI = {
    'مقدمة': '💻',
    'عن النظام': '📊',
    'لوحة المعلومات': '💻',
    'صندوق الوارد': '📊',
    'صندوق الصادر': '📊'
};

function grEsc(s) {
    if (typeof esc === 'function') return esc(s);
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function grUserKey() {
    const uid = (typeof window !== 'undefined' && window.GR_USER_ID) ? window.GR_USER_ID : 0;
    return 'guideReader_u' + uid;
}

function grReadStorageKey(itemId, stepKey) {
    return grUserKey() + '_step_' + itemId + '_' + stepKey;
}

function grCompareOrder(a, b) {
    const pa = String(a.orderPath || a.OrderPath || '').split('،').map(function (x) { return parseInt(x, 10) || 0; });
    const pb = String(b.orderPath || b.OrderPath || '').split('،').map(function (x) { return parseInt(x, 10) || 0; });
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
}

function grIsIconImage(icon) {
    if (!icon) return false;
    const s = String(icon).trim();
    return s.indexOf('data:image') === 0 || s.indexOf('http://') === 0 || s.indexOf('https://') === 0 || s.indexOf('/') === 0;
}

function grMenuEmoji(name) {
    const n = String(name || '').trim();
    if (GR_MENU_EMOJI[n]) return GR_MENU_EMOJI[n] + ' ';
    return '';
}

function grIconHtml(item) {
    const name = item.name || item.Name || '';
    const icon = item.icon || item.Icon || '';
    const color = item.color || item.Color || '#167248';
    const emoji = grMenuEmoji(name);
    if (emoji) {
        return '<span class="gr-tree-icon" aria-hidden="true">' + emoji + '</span>';
    }
    if (grIsIconImage(icon)) {
        return '<span class="gr-tree-icon"><img src="' + grEsc(icon) + '" alt=""></span>';
    }
    const cls = (icon && String(icon).indexOf('bi-') === 0) ? icon : ('bi-' + (icon || 'journal-text'));
    return '<span class="gr-tree-icon" style="color:' + grEsc(color) + ';"><i class="bi ' + grEsc(cls) + '"></i></span>';
}

function grBuildTreeNodes(parentId) {
    return grItems
        .filter(function (x) {
            const pid = x.parentId != null ? x.parentId : x.ParentId;
            if (parentId == null) return pid == null || pid === '' || pid === 0;
            return Number(pid) === Number(parentId);
        })
        .sort(grCompareOrder);
}

function grRenderTreeNode(item) {
    const id = item.id != null ? item.id : item.Id;
    const children = grBuildTreeNodes(id);
    const isActive = grFlat[grActiveIndex] && (grFlat[grActiveIndex].id === id || grFlat[grActiveIndex].Id === id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gr-tree-btn' + (isActive ? ' active' : '');
    btn.dataset.id = String(id);
    btn.innerHTML = grIconHtml(item) + '<span class="gr-tree-label">' + grEsc(item.name || item.Name) + '</span>';
    btn.addEventListener('click', function () { grJumpToId(id); grCloseMobileSidebar(); });

    const li = document.createElement('li');
    li.className = 'gr-tree-item';
    li.dataset.id = String(id);
    li.appendChild(btn);

    if (children.length) {
        const ul = document.createElement('ul');
        ul.className = 'gr-tree-children';
        children.forEach(function (ch) { ul.appendChild(grRenderTreeNode(ch)); });
        li.appendChild(ul);
    }
    return li;
}

function grRenderTree() {
    const host = document.getElementById('grTree');
    if (!host) return;
    if (!grItems.length) {
        host.innerHTML = '<div class="gr-tree-loading">لا توجد أقسام</div>';
        return;
    }
    const roots = grBuildTreeNodes(null);
    const ul = document.createElement('ul');
    ul.className = 'gr-tree-list sidebar-menu';
    roots.forEach(function (r) { ul.appendChild(grRenderTreeNode(r)); });
    host.innerHTML = '';
    host.appendChild(ul);
    grApplySearchFilter();
}

function grApplySearchFilter() {
    const q = grSearchQuery.trim().toLowerCase();
    document.querySelectorAll('#grTree .gr-tree-item').forEach(function (li) {
        if (!q) { li.style.display = ''; return; }
        const btn = li.querySelector('.gr-tree-btn');
        const text = (btn ? btn.textContent : '').toLowerCase();
        li.style.display = text.includes(q) ? '' : 'none';
    });
}

/** أقسام التنقل: كل العقد (رئيسية وفرعية) بترتيب الشجرة */
function grBuildFlatList() {
    grFlat = [];
    function walk(parentId) {
        grBuildTreeNodes(parentId).forEach(function (item) {
            grFlat.push(item);
            const id = item.id != null ? item.id : item.Id;
            walk(id);
        });
    }
    walk(null);
    if (!grFlat.length) grFlat = grItems.slice().sort(grCompareOrder);
}

function grFindIndexById(id) {
    id = Number(id);
    for (let i = 0; i < grFlat.length; i++) {
        const fid = grFlat[i].id != null ? grFlat[i].id : grFlat[i].Id;
        if (Number(fid) === id) return i;
    }
    return 0;
}

function grJumpToId(id) {
    grActiveIndex = grFindIndexById(id);
    grUpdateUI();
    if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#/' + id);
    }
}

function grChangeSection(dir) {
    grActiveIndex += dir;
    if (grActiveIndex < 0) grActiveIndex = 0;
    if (grActiveIndex >= grFlat.length) grActiveIndex = grFlat.length - 1;
    grUpdateUI();
}

function grUpdateProgress() {
    const bar = document.getElementById('grProgressBar');
    if (!bar) return;
    if (grFlat.length <= 1) {
        bar.style.width = grFlat.length ? '100%' : '0%';
        return;
    }
    bar.style.width = ((grActiveIndex / (grFlat.length - 1)) * 100) + '%';
}

function grUpdateNavButtons() {
    const prev = document.getElementById('grPrevBtn');
    const next = document.getElementById('grNextBtn');
    if (prev) prev.disabled = grActiveIndex <= 0;
    if (next) next.disabled = grActiveIndex >= grFlat.length - 1;
}

function grStripScripts(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';
    tmp.querySelectorAll('script').forEach(function (s) { s.remove(); });
    return tmp.innerHTML;
}

/** شطب الخطوات عند التحديد — steps-list */
function grWireStepsList(itemId, container) {
    if (!container) return;
    container.querySelectorAll('.steps-list input[type="checkbox"]').forEach(function (cb, idx) {
        const li = cb.closest('li');
        const key = grReadStorageKey(itemId, cb.id || ('idx_' + idx));
        if (localStorage.getItem(key) === '1') {
            cb.checked = true;
            if (li) li.classList.add('done');
        }
        function toggle() {
            if (li) li.classList.toggle('done', cb.checked);
            localStorage.setItem(key, cb.checked ? '1' : '0');
        }
        cb.addEventListener('change', toggle);
        const lbl = cb.nextElementSibling;
        if (lbl && lbl.tagName === 'LABEL') {
            lbl.addEventListener('click', function () { setTimeout(toggle, 0); });
        }
    });
    container.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('click', function (e) {
            e.preventDefault();
            grOpenZoom(img.src, img.alt);
        });
    });
}

function grRenderMedia(item) {
    const panel = document.getElementById('grMediaPanel');
    if (!panel) return;
    const url = (item.attachmentUrl || item.AttachmentUrl || '').trim();
    const caption = (item.notes || item.Notes || '').trim()
        || '[ لقطة شاشة: معاينة القسم ]';

    if (url) {
        panel.innerHTML = '<div class="system-screenshot" role="button" tabindex="0" aria-label="تكبير الصورة">'
            + '<img src="' + grEsc(url) + '" alt="' + grEsc(item.name || item.Name) + '">'
            + '<span class="gr-zoom-hint">(🔍 انقر للتكبير)</span></div>';
        panel.querySelector('.system-screenshot')?.addEventListener('click', function () {
            grOpenZoom(url, item.name || item.Name);
        });
        return;
    }

    panel.innerHTML = '<div class="system-screenshot" role="button" tabindex="0" aria-label="تكبير المعاينة">'
        + '<div><strong>' + grEsc(caption) + '</strong>'
        + '<span class="gr-zoom-hint">(🔍 انقر هنا للتكبير)</span></div></div>';
    const shot = panel.querySelector('.system-screenshot');
    if (shot) {
        shot.addEventListener('click', function () {
            grOpenZoomHtml(shot.innerHTML);
        });
    }
}

function grRenderPage() {
    if (!grFlat.length) return;
    const item = grFlat[grActiveIndex];
    const id = item.id != null ? item.id : item.Id;
    const total = grFlat.length;
    const body = document.getElementById('grContentBody');
    body.innerHTML = grStripScripts(item.content || item.Content || '')
        || '<p class="text-muted">لا يوجد محتوى نصي لهذا القسم.</p>';
    grWireStepsList(id, body);

    grRenderMedia(item);

    const totalPages = total * 2;
    const pageRight = grActiveIndex * 2 + 1;
    const pageLeft = grActiveIndex * 2 + 2;

    const footL = document.getElementById('grPageFootLeft');
    const footR = document.getElementById('grPageFootRight');
    if (footR) footR.textContent = 'صفحة ' + pageRight + ' من ' + totalPages;
    if (footL) footL.textContent = 'صفحة ' + pageLeft + ' من ' + totalPages;

    grRenderTree();
}

function grUpdateUI() {
    const empty = document.getElementById('grEmpty');
    const book = document.getElementById('grBook');
    const controls = document.getElementById('grControls');

    if (!grFlat.length) {
        empty?.classList.remove('d-none');
        book?.classList.add('d-none');
        if (controls) controls.style.display = 'none';
        grUpdateProgress();
        return;
    }

    empty?.classList.add('d-none');
    book?.classList.remove('d-none');
    if (controls) controls.style.display = '';

    grRenderPage();
    grUpdateProgress();
    grUpdateNavButtons();
}

function grOpenZoom(src, alt) {
    const overlay = document.getElementById('grZoomOverlay');
    const content = document.getElementById('grZoomContent');
    if (!overlay || !content) return;
    content.innerHTML = '<img src="' + grEsc(src) + '" alt="' + grEsc(alt || '') + '">';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function grOpenZoomHtml(html) {
    const overlay = document.getElementById('grZoomOverlay');
    const content = document.getElementById('grZoomContent');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function grCloseZoom() {
    const overlay = document.getElementById('grZoomOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.getElementById('grZoomContent').innerHTML = '';
    document.body.style.overflow = '';
}

function grToggleDarkMode() {
    const root = document.getElementById('grRoot');
    if (!root) return;
    const isDark = root.classList.toggle('gr-dark');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem(grUserKey() + '_dark', isDark ? '1' : '0');
    const icon = document.getElementById('grThemeIcon');
    if (icon) icon.className = isDark ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
}

function grApplySavedTheme() {
    if (localStorage.getItem(grUserKey() + '_dark') === '1') {
        document.getElementById('grRoot')?.classList.add('gr-dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        const icon = document.getElementById('grThemeIcon');
        if (icon) icon.className = 'bi bi-sun-fill';
    }
}

function grCloseMobileSidebar() {
    document.getElementById('grSidebar')?.classList.remove('open');
}

function grOpenMobileSidebar() {
    document.getElementById('grSidebar')?.classList.add('open');
}

function grWireEvents() {
    document.getElementById('grPrevBtn')?.addEventListener('click', function () { grChangeSection(-1); });
    document.getElementById('grNextBtn')?.addEventListener('click', function () { grChangeSection(1); });
    document.getElementById('grThemeBtn')?.addEventListener('click', grToggleDarkMode);
    document.getElementById('grZoomClose')?.addEventListener('click', grCloseZoom);
    document.getElementById('grZoomOverlay')?.addEventListener('click', function (e) {
        if (e.target.id === 'grZoomOverlay') grCloseZoom();
    });
    document.getElementById('grSearch')?.addEventListener('input', function (e) {
        grSearchQuery = e.target.value || '';
        grApplySearchFilter();
    });
    document.getElementById('grMobileToggle')?.addEventListener('click', grOpenMobileSidebar);
    document.getElementById('grSidebarClose')?.addEventListener('click', grCloseMobileSidebar);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') grCloseZoom();
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 's' || e.key === 'P' || e.key === 'S')) {
            e.preventDefault();
        }
    });
}

async function grLoad() {
    const tree = document.getElementById('grTree');
    try {
        const res = await apiFetch('/Guide/GetReaderItems');
        if (!res || !res.success) {
            if (tree) tree.innerHTML = '<div class="gr-tree-loading">تعذّر تحميل الدليل</div>';
            return;
        }
        grItems = res.data || [];
        grBuildFlatList();
        grActiveIndex = 0;

        const hash = window.location.hash.replace(/^#\/?/, '');
        if (hash && /^\d+$/.test(hash)) {
            grActiveIndex = grFindIndexById(parseInt(hash, 10));
        }

        grUpdateUI();
    } catch (e) {
        console.error('grLoad', e);
        if (tree) tree.innerHTML = '<div class="gr-tree-loading">خطأ في التحميل</div>';
    }
}

function grInit() {
    grApplySavedTheme();
    grWireEvents();
    grLoad();
}

window.grInit = grInit;
