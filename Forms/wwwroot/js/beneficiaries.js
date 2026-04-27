var bnfAll = [];
var bnfUnits = [];
var bnfOuExpanded = {};
var bnfFilterOuExpanded = {};
var bnfSignCtx = {};

function bnfIsSysAdminRole() {
    var c = document.querySelector('input[name="bnfSubRole"]:checked');
    return !!(c && c.value === 'مدير النظام');
}

function bnfApplyRoleVisibility() {
    var sys = bnfIsSysAdminRole();
    document.querySelectorAll('.bnf-rep-only').forEach(function (el) {
        el.classList.toggle('d-none', sys);
    });
}

function bnfBindDigitsOnly(inputId, maxLen) {
    var el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', function () {
        var v = el.value.replace(/\D/g, '');
        if (maxLen) v = v.slice(0, maxLen);
        if (v !== el.value) el.value = v;
    });
}

function bnfShowPhotoFileInput() {
    bnfSetPhotoFileInputVisible(true);
    document.getElementById('bnfPhoto').value = '';
}

function bnfSetPhotoFileInputVisible(showInput) {
    var wrap = document.getElementById('bnfPhotoInputWrap');
    var btn = document.getElementById('bnfPhotoChangeBtn');
    if (!wrap || !btn) return;
    if (showInput) {
        wrap.style.display = '';
        btn.style.display = 'none';
    } else {
        wrap.style.display = 'none';
        btn.style.display = '';
    }
}

function bnfSetPhotoPlaceholderVisible(visible) {
    var ph = document.getElementById('bnfPhotoPlaceholder');
    if (!ph) return;
    if (visible) ph.style.removeProperty('display');
    else ph.style.setProperty('display', 'none', 'important');
}

document.addEventListener('DOMContentLoaded', function () {
    bnfBindDigitsOnly('bnfNationalId', 10);
    bnfBindDigitsOnly('bnfPhone', 10);
    bnfLoad();

    var filterIds = ['bnfFilterName', 'bnfFilterNationalId', 'bnfFilterSubRole'];
    filterIds.forEach(function (fid) {
        var el = document.getElementById(fid);
        if (!el) return;
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () { bnfRenderTable(); });
    });
    document.getElementById('bnfFilterClear').addEventListener('click', function () {
        document.getElementById('bnfFilterName').value = '';
        document.getElementById('bnfFilterNationalId').value = '';
        document.getElementById('bnfFilterUnit').value = '';
        var flab = document.getElementById('bnfFilterOuLabel');
        if (flab) flab.textContent = 'الوحدة التنظيمية';
        bnfFilterOuExpanded = {};
        document.getElementById('bnfFilterSubRole').value = '';
        bnfRenderTable();
    });
    bnfBindDigitsOnly('bnfFilterNationalId', 10);

    document.querySelectorAll('input[name="bnfSubRole"]').forEach(function (r) {
        r.addEventListener('change', function () { bnfApplyRoleVisibility(); });
    });
    var bnfFormModal = document.getElementById('bnfFormModal');
    if (bnfFormModal) {
        bnfFormModal.addEventListener('shown.bs.modal', function () { bnfApplyRoleVisibility(); });
    }

    document.getElementById('bnfPhoto').addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (f) {
            var r = new FileReader();
            r.onload = function () {
                document.getElementById('bnfPhotoPreview').src = r.result;
                document.getElementById('bnfPhotoPreview').style.display = 'block';
                bnfSetPhotoPlaceholderVisible(false);
                document.getElementById('bnfPhoto').dataset.base64 = r.result;
                bnfSetPhotoFileInputVisible(false);
            };
            r.readAsDataURL(f);
        } else {
            document.getElementById('bnfPhotoPreview').style.display = 'none';
            bnfSetPhotoPlaceholderVisible(true);
            document.getElementById('bnfPhoto').dataset.base64 = '';
            bnfSetPhotoFileInputVisible(true);
        }
    });

    document.getElementById('bnfEndorsementType').addEventListener('change', bnfToggleEndorsement);
    document.getElementById('bnfSignatureType').addEventListener('change', bnfToggleSignature);

    document.getElementById('bnfEndorsementFile').addEventListener('change', function (e) {
        bnfHandleFileUpload(e, 'bnfEndorsementFile', 'bnfEndorsementPreview', 'bnfEndorsement');
    });
    document.getElementById('bnfSignatureFile').addEventListener('change', function (e) {
        bnfHandleFileUpload(e, 'bnfSignatureFile', 'bnfSignaturePreview', 'bnfSignature');
    });

    document.getElementById('bnfIsActive').addEventListener('change', function () {
        document.getElementById('bnfActivationStatus').textContent = this.checked ? 'مفعل' : 'معطل';
    });

    document.getElementById('bnfPassword').addEventListener('input', bnfCheckPasswordLive);

    bnfInitSignatureCanvas('bnfEndorsementCanvas');
    bnfInitSignatureCanvas('bnfSignatureCanvas');
    bnfToggleEndorsement();
    bnfToggleSignature();

    var bnfOuTrigger = document.getElementById('bnfOuTreeTrigger');
    var bnfOuPanel = document.getElementById('bnfOuTreePanel');
    if (bnfOuTrigger && bnfOuPanel) {
        bnfOuTrigger.addEventListener('click', function (e) {
            e.preventDefault();
            bnfOuTogglePanel();
        });
        bnfOuPanel.addEventListener('click', function (e) {
            var expBtn = e.target.closest('.bnf-ou-tree-exp');
            if (expBtn) {
                e.preventDefault();
                e.stopPropagation();
                var eid = expBtn.getAttribute('data-exp');
                if (eid) {
                    bnfOuExpanded[eid] = !bnfOuExpanded[eid];
                    bnfRenderOrgUnitTreePanel();
                }
                return;
            }
            var row = e.target.closest('.bnf-ou-tree-row');
            if (row && row.getAttribute('data-id')) {
                var uid = parseInt(row.getAttribute('data-id'), 10);
                var u = bnfUnits.find(function (x) { return x.id === uid; });
                if (u) {
                    bnfOuSetSelection(u.id, u.name);
                    bnfOuClosePanel();
                }
            }
        });
    }

    var bnfFilterOuTrigger = document.getElementById('bnfFilterOuTrigger');
    var bnfFilterOuPanel = document.getElementById('bnfFilterOuPanel');
    if (bnfFilterOuTrigger && bnfFilterOuPanel) {
        bnfFilterOuTrigger.addEventListener('click', function (e) {
            e.preventDefault();
            bnfFilterOuTogglePanel();
        });
        bnfFilterOuPanel.addEventListener('click', function (e) {
            var expBtn = e.target.closest('.bnf-ou-tree-exp');
            if (expBtn) {
                e.preventDefault();
                e.stopPropagation();
                var eid = expBtn.getAttribute('data-exp');
                if (eid) {
                    bnfFilterOuExpanded[eid] = !bnfFilterOuExpanded[eid];
                    bnfRenderFilterOrgUnitTreePanel();
                }
                return;
            }
            var row = e.target.closest('.bnf-ou-tree-row');
            if (row && row.getAttribute('data-id') !== null) {
                var rawId = row.getAttribute('data-id');
                if (rawId === '') {
                    document.getElementById('bnfFilterUnit').value = '';
                    document.getElementById('bnfFilterOuLabel').textContent = 'الوحدة التنظيمية';
                } else {
                    var uid = parseInt(rawId, 10);
                    var u = bnfUnits.find(function (x) { return x.id === uid; });
                    if (u) {
                        document.getElementById('bnfFilterUnit').value = String(u.id);
                        document.getElementById('bnfFilterOuLabel').textContent = u.name;
                    }
                }
                bnfFilterOuClosePanel();
                bnfRenderFilterOrgUnitTreePanel();
                bnfRenderTable();
            }
        });
        document.addEventListener('click', function (e) {
            var wrap = document.querySelector('.bnf-filter-ou-wrap');
            var panel = document.getElementById('bnfFilterOuPanel');
            if (!wrap || !panel || panel.classList.contains('d-none')) return;
            if (!wrap.contains(e.target)) bnfFilterOuClosePanel();
        });
    }
});

function bnfFilterOuTogglePanel() {
    var panel = document.getElementById('bnfFilterOuPanel');
    var trig = document.getElementById('bnfFilterOuTrigger');
    if (!panel) return;
    if (panel.classList.contains('d-none')) {
        var cur = document.getElementById('bnfFilterUnit').value;
        if (cur) bnfFilterOuExpandAncestorsForSelection(parseInt(cur, 10));
        bnfRenderFilterOrgUnitTreePanel();
        panel.classList.remove('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'true');
    } else {
        panel.classList.add('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'false');
    }
}

function bnfFilterOuClosePanel() {
    var panel = document.getElementById('bnfFilterOuPanel');
    var trig = document.getElementById('bnfFilterOuTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function bnfFilterOuExpandAncestorsForSelection(selectId) {
    if (!selectId || isNaN(selectId)) return;
    var map = {};
    bnfUnits.forEach(function (u) { map[u.id] = u; });
    var u = map[selectId];
    while (u && u.parentId != null && u.parentId !== '') {
        bnfFilterOuExpanded[String(u.parentId)] = true;
        u = map[u.parentId];
    }
}

function bnfRenderFilterOrgUnitTreePanel() {
    var panel = document.getElementById('bnfFilterOuPanel');
    if (!panel) return;
    if (!bnfUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    var byParent = bnfOrgUnitByParent();
    var selectedId = document.getElementById('bnfFilterUnit').value;
    var allSel = !selectedId ? ' is-selected' : '';
    var html = '<div class="bnf-ou-tree-row d-flex align-items-center' + allSel + '" data-id="" role="option" dir="rtl" style="padding:8px 10px;padding-right:12px;">' +
        '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>' +
        '<span class="bnf-ou-tree-name flex-grow-1" style="font-weight:700;color:var(--gray-700);">كل الوحدات</span></div>';
    html += bnfRenderOuTreeRows(byParent, '', 0, selectedId, bnfFilterOuExpanded);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function bnfOuTogglePanel() {
    var panel = document.getElementById('bnfOuTreePanel');
    var trig = document.getElementById('bnfOuTreeTrigger');
    if (!panel) return;
    if (panel.classList.contains('d-none')) {
        bnfRenderOrgUnitTreePanel();
        panel.classList.remove('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'true');
    } else {
        panel.classList.add('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'false');
    }
}

function bnfOuClosePanel() {
    var panel = document.getElementById('bnfOuTreePanel');
    var trig = document.getElementById('bnfOuTreeTrigger');
    if (panel) panel.classList.add('d-none');
    if (trig) trig.setAttribute('aria-expanded', 'false');
}

function bnfOrgUnitByParent() {
    var ids = {};
    bnfUnits.forEach(function (u) { ids[u.id] = true; });
    var byParent = {};
    bnfUnits.forEach(function (u) {
        var pk = '';
        if (u.parentId != null && u.parentId !== '' && ids[u.parentId]) {
            pk = String(u.parentId);
        }
        if (!byParent[pk]) byParent[pk] = [];
        byParent[pk].push(u);
    });
    Object.keys(byParent).forEach(function (k) {
        byParent[k].sort(function (a, b) {
            var sa = a.sortOrder != null ? a.sortOrder : 0;
            var sb = b.sortOrder != null ? b.sortOrder : 0;
            if (sa !== sb) return sa - sb;
            return (a.name || '').localeCompare(b.name || '', 'ar');
        });
    });
    return byParent;
}

function bnfRenderOuTreeRows(byParent, parentKey, depth, selectedId, expandedMap) {
    var rows = byParent[parentKey] || [];
    var sel = selectedId !== undefined && selectedId !== null ? String(selectedId) : document.getElementById('bnfOrganizationalUnitId').value;
    var expMap = expandedMap !== undefined && expandedMap !== null ? expandedMap : bnfOuExpanded;
    var html = '';
    rows.forEach(function (u) {
        var idStr = String(u.id);
        var children = byParent[idStr] || [];
        var hasChildren = children.length > 0;
        var expanded = !!expMap[idStr];
        var indent = depth * 22;
        var rowSel = String(sel) === idStr ? ' is-selected' : '';
        html += '<div class="bnf-ou-tree-row d-flex align-items-center' + rowSel + '" data-id="' + u.id + '" role="option" dir="rtl" style="padding:8px 10px; padding-right:' + (12 + indent) + 'px;">';
        if (hasChildren) {
            html += '<button type="button" class="bnf-ou-tree-exp" data-exp="' + idStr + '" aria-expanded="' + expanded + '" title="' + (expanded ? 'طي' : 'توسيع') + '">' + (expanded ? '−' : '+') + '</button>';
        } else {
            html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
        }
        html += '<span class="bnf-ou-tree-name flex-grow-1">' + esc(u.name) + '</span></div>';
        if (hasChildren && expanded) {
            html += bnfRenderOuTreeRows(byParent, idStr, depth + 1, sel, expMap);
        }
    });
    return html;
}

function bnfRenderOrgUnitTreePanel() {
    var panel = document.getElementById('bnfOuTreePanel');
    if (!panel) return;
    if (!bnfUnits.length) {
        panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
        return;
    }
    var byParent = bnfOrgUnitByParent();
    var selectedId = document.getElementById('bnfOrganizationalUnitId').value;
    var html = bnfRenderOuTreeRows(byParent, '', 0, selectedId, bnfOuExpanded);
    panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
}

function bnfOuSetSelection(id, name) {
    var hid = document.getElementById('bnfOrganizationalUnitId');
    var lab = document.getElementById('bnfOuTreeLabel');
    if (hid) hid.value = id != null && id !== '' ? String(id) : '';
    if (lab) lab.textContent = name && String(name).trim() ? name : '-- اختر --';
    bnfRenderOrgUnitTreePanel();
}

function bnfOuExpandAncestorsForSelection(selectId) {
    var map = {};
    bnfUnits.forEach(function (u) { map[u.id] = u; });
    var u = map[selectId];
    while (u && u.parentId != null && u.parentId !== '') {
        bnfOuExpanded[String(u.parentId)] = true;
        u = map[u.parentId];
    }
}

function bnfToggleEndorsement() {
    var type = document.getElementById('bnfEndorsementType').value;
    var fileWrap = document.getElementById('bnfEndorsementFileWrap');
    var canvasWrap = document.getElementById('bnfEndorsementCanvasWrap');
    if (type === 'مرفق') {
        fileWrap.style.display = 'block';
        canvasWrap.style.display = 'none';
        document.getElementById('bnfEndorsementFile').value = '';
        document.getElementById('bnfEndorsementPreview').style.display = 'none';
        bnfClearCanvas('bnfEndorsementCanvas');
    } else {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'block';
        bnfClearCanvas('bnfEndorsementCanvas');
    }
}

function bnfToggleSignature() {
    var type = document.getElementById('bnfSignatureType').value;
    var fileWrap = document.getElementById('bnfSignatureFileWrap');
    var canvasWrap = document.getElementById('bnfSignatureCanvasWrap');
    if (type === 'مرفق') {
        fileWrap.style.display = 'block';
        canvasWrap.style.display = 'none';
        document.getElementById('bnfSignatureFile').value = '';
        document.getElementById('bnfSignaturePreview').style.display = 'none';
        bnfClearCanvas('bnfSignatureCanvas');
    } else {
        fileWrap.style.display = 'none';
        canvasWrap.style.display = 'block';
        bnfClearCanvas('bnfSignatureCanvas');
    }
}

function bnfHandleFileUpload(e, inputId, previewId, dataPrefix) {
    var f = e.target.files[0];
    var input = document.getElementById(inputId);
    var preview = document.getElementById(previewId);
    if (f) {
        var r = new FileReader();
        r.onload = function () {
            input.dataset.base64 = r.result;
            if (f.type.indexOf('image') === 0) {
                preview.innerHTML = '<img src="' + r.result + '" class="bnf-attach-preview">';
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

function bnfInitSignatureCanvas(canvasId) {
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

    function start(e) {
        e.preventDefault();
        drawing = true;
        var p = getPos(e);
        lastX = p.x;
        lastY = p.y;
    }
    function draw(e) {
        e.preventDefault();
        if (!drawing) return;
        var p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        lastX = p.x;
        lastY = p.y;
    }
    function end(e) {
        e.preventDefault();
        drawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseout', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
}

function bnfClearCanvas(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function bnfDrawImageOnCanvas(canvasId, dataUrl) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !dataUrl || dataUrl.indexOf('data:image') !== 0) return;
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
}

function bnfGetCanvasDataUrl(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
}

function bnfIsCanvasEmpty(canvasId) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return true;
    var ctx = canvas.getContext('2d');
    var px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (var i = 3; i < px.length; i += 4) {
        if (px[i] > 0) return false;
    }
    return true;
}

async function bnfLoad() {
    try {
        var r = await apiFetch('/Settings/GetBeneficiaries');
        if (r && r.success) {
            bnfAll = r.data;
            bnfUnits = r.organizationalUnits || [];
            bnfFillUnitDropdown();
            bnfSyncFilterUnitTreeLabel();
            bnfRenderTable();
        } else {
            document.getElementById('bnfBody').innerHTML =
                '<tr><td colspan="11">' + emptyState('bi-people-fill', 'لا يوجد مستفيدين', 'أضف مستفيدين للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('bnfBody').innerHTML =
            '<tr><td colspan="11" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function bnfFillUnitDropdown() {
    var hid = document.getElementById('bnfOrganizationalUnitId');
    var lab = document.getElementById('bnfOuTreeLabel');
    if (hid && lab) {
        if (hid.value) {
            var u = bnfUnits.find(function (x) { return String(x.id) === String(hid.value); });
            lab.textContent = u ? u.name : '-- اختر --';
        } else {
            lab.textContent = '-- اختر --';
        }
    }
    bnfRenderOrgUnitTreePanel();
}

function bnfSyncFilterUnitTreeLabel() {
    var hid = document.getElementById('bnfFilterUnit');
    var lab = document.getElementById('bnfFilterOuLabel');
    if (!hid || !lab) return;
    if (hid.value) {
        var u = bnfUnits.find(function (x) { return String(x.id) === String(hid.value); });
        lab.textContent = u ? u.name : 'الوحدة التنظيمية';
    } else {
        lab.textContent = 'الوحدة التنظيمية';
    }
}

function bnfGetFilteredBeneficiaries() {
    var nameQ = (document.getElementById('bnfFilterName') && document.getElementById('bnfFilterName').value || '').trim();
    var nidQ = (document.getElementById('bnfFilterNationalId') && document.getElementById('bnfFilterNationalId').value || '').trim();
    var unitId = document.getElementById('bnfFilterUnit') ? document.getElementById('bnfFilterUnit').value : '';
    var subRole = document.getElementById('bnfFilterSubRole') ? document.getElementById('bnfFilterSubRole').value : '';

    return bnfAll.filter(function (b) {
        if (nameQ && (b.fullName || '').indexOf(nameQ) === -1)
            return false;
        if (nidQ && (b.nationalId || '').indexOf(nidQ) === -1)
            return false;
        if (unitId && String(b.organizationalUnitId) !== String(unitId))
            return false;
        if (subRole) {
            var isUnitMgr = !!(b.isUnitManager || (b.mainRole || '').trim() === 'مدير');
            if (subRole === '__employee__') {
                if (isUnitMgr) return false;
            } else if (subRole === '__unit_manager__') {
                if (!isUnitMgr) return false;
            } else {
                var sr = (b.subRole || '').trim();
                if (sr !== subRole) return false;
            }
        }
        return true;
    });
}

function bnfRenderTable() {
    var body = document.getElementById('bnfBody');
    if (bnfAll.length === 0) {
        body.innerHTML = '<tr><td colspan="11">' +
            emptyState('bi-people-fill', 'لا يوجد مستفيدين', 'اضغط إضافة لإدخال مستفيد جديد') + '</td></tr>';
        return;
    }
    var rows = bnfGetFilteredBeneficiaries();
    if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="11">' +
            emptyState('bi-search', 'لا توجد نتائج', 'جرّب تعديل معايير البحث أو مسح الفلاتر') + '</td></tr>';
        return;
    }
    var html = '';
    rows.forEach(function (b, idx) {
        var safeName = esc(b.fullName).replace(/'/g, "\\'");
        var avatarHtml = b.photoUrl
            ? '<img src="' + esc(b.photoUrl) + '" class="bnf-tbl-avatar" alt="" onerror="this.outerHTML=\'<span class=bnf-tbl-avatar-placeholder><i class=bi bi-person></i></span>\'">'
            : '<span class="bnf-tbl-avatar-placeholder"><i class="bi bi-person"></i></span>';
        var active = b.isActive !== false;
        var statusClass = active ? 'active' : 'inactive';
        var statusText = active ? 'مفعل' : 'معطل';
        html += '<tr>' +
            '<td style="text-align:center;font-weight:700;color:var(--gray-500);">' + (idx + 1) + '</td>' +
            '<td style="text-align:center;">' + avatarHtml + '</td>' +
            '<td style="font-weight:700;">' + esc(b.fullName) + '</td>' +
            '<td><span dir="ltr" style="font-size:12px;">' + esc(b.username || '') + '</span></td>' +
            '<td><span dir="ltr" style="font-family:Consolas,monospace;font-size:12px;">' + esc(b.nationalId || '') + '</span></td>' +
            '<td><span dir="ltr" style="font-size:12px;">' + esc(b.phone || '') + '</span></td>' +
            '<td><span dir="ltr" style="font-size:11px;">' + esc(b.email || '') + '</span></td>' +
            '<td style="font-size:12px;">' + esc(b.roleDisplay) + '</td>' +
            '<td style="font-size:12px;">' + esc(b.organizationalUnitName || '') + '</td>' +
            '<td style="text-align:center;"><span class="bnf-status-pill ' + statusClass + '"><span class="bnf-status-dot"></span>' + statusText + '</span></td>' +
            '<td>' +
                '<div style="display:flex;gap:4px;align-items:center;justify-content:center;">' +
                    '<button class="bnf-action-btn bnf-action-btn-detail" onclick="bnfShowDetails(' + b.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="bnf-action-btn bnf-action-btn-edit" onclick="bnfShowEditModal(' + b.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="bnf-action-btn bnf-action-btn-delete" onclick="bnfShowDeleteModal(' + b.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

function bnfValidatePasswordStrength(pwd) {
    if (!pwd) return null;
    if (pwd.length < 8)
        return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل (يُفضّل 12 حرفًا أو أكثر).';
    if (!/[A-Z]/.test(pwd))
        return 'كلمة المرور يجب أن تحتوي على حرف كبير (A-Z).';
    if (!/[a-z]/.test(pwd))
        return 'كلمة المرور يجب أن تحتوي على حرف صغير (a-z).';
    if (!/[0-9]/.test(pwd))
        return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل (0-9).';
    if (!/[!@#$%^&*]/.test(pwd))
        return 'كلمة المرور يجب أن تحتوي على رمز خاص من المجموعة: ! @ # $ % ^ & *';
    return null;
}

function bnfCheckPasswordLive() {
    var pwd = document.getElementById('bnfPassword').value;
    var rules = [
        { id: 'pwReqLen',     test: pwd.length >= 8 },
        { id: 'pwReqUpper',   test: /[A-Z]/.test(pwd) },
        { id: 'pwReqLower',   test: /[a-z]/.test(pwd) },
        { id: 'pwReqDigit',   test: /[0-9]/.test(pwd) },
        { id: 'pwReqSpecial', test: /[!@#$%^&*]/.test(pwd) }
    ];
    rules.forEach(function (r) {
        var li = document.getElementById(r.id);
        if (!li) return;
        var icon = li.querySelector('.bnf-pw-req-icon i');
        if (pwd.length === 0) {
            li.classList.remove('pw-met');
            if (icon) { icon.className = 'bi bi-circle'; }
        } else if (r.test) {
            li.classList.add('pw-met');
            if (icon) { icon.className = 'bi bi-check-lg'; }
        } else {
            li.classList.remove('pw-met');
            if (icon) { icon.className = 'bi bi-circle'; }
        }
    });
}

function bnfValidate(isAdd) {
    if (!document.querySelector('input[name="bnfSubRole"]:checked'))
        return 'اختر الدور';

    if (bnfIsSysAdminRole()) {
        if (!document.getElementById('bnfFirstName').value.trim()) return 'الاسم الأول مطلوب';
        if (!document.getElementById('bnfSecondName').value.trim()) return 'الاسم الثاني مطلوب';
        if (!document.getElementById('bnfThirdName').value.trim()) return 'الاسم الثالث مطلوب';
        if (!document.getElementById('bnfFourthName').value.trim()) return 'الاسم الرابع مطلوب';

        var usernameSa = (document.getElementById('bnfUsername').value || '').trim();
        if (!usernameSa) return 'اسم المستخدم مطلوب';
        if (usernameSa.length < 3) return 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
        if (!/^[a-zA-Z0-9_]+$/.test(usernameSa)) return 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط';

        var pwdSa = document.getElementById('bnfPassword').value;
        var confirmSa = document.getElementById('bnfConfirmPassword').value;
        if (isAdd && !pwdSa) return 'كلمة المرور مطلوبة عند إضافة مستفيد جديد';
        if (pwdSa && pwdSa !== confirmSa)
            return 'كلمة المرور وتأكيد كلمة المرور غير متطابقتين';
        if (pwdSa) {
            var pwStrengthSa = bnfValidatePasswordStrength(pwdSa);
            if (pwStrengthSa) return pwStrengthSa;
        }
        return null;
    }

    var nid = (document.getElementById('bnfNationalId').value || '').trim();
    if (!nid) return 'الهوية الوطنية مطلوبة';
    if (nid.length !== 10 || !/^\d+$/.test(nid))
        return 'الهوية الوطنية يجب أن تتكون من 10 أرقام وتبدأ بـ 10 أو 11';
    if (!nid.startsWith('10') && !nid.startsWith('11'))
        return 'الهوية الوطنية يجب أن تتكون من 10 أرقام وتبدأ بـ 10 أو 11';

    var phone = (document.getElementById('bnfPhone').value || '').trim();
    if (!phone) return 'رقم الجوال مطلوب';
    if (phone.length !== 10 || !/^\d+$/.test(phone) || !phone.startsWith('05'))
        return 'رقم الجوال ١٠ ارقام تبدا ب ٠٥';

    var email = (document.getElementById('bnfEmail').value || '').trim();
    if (!email) return 'البريد الإلكتروني مطلوب';
    if (!/^[^\s@]+@almadinah\.gov\.sa$/i.test(email))
        return 'يجب إدخال بريد إلكتروني بصيغة xxx@almadinah.gov.sa';

    if (!document.getElementById('bnfFirstName').value.trim()) return 'الاسم الأول مطلوب';
    if (!document.getElementById('bnfSecondName').value.trim()) return 'الاسم الثاني مطلوب';
    if (!document.getElementById('bnfThirdName').value.trim()) return 'الاسم الثالث مطلوب';
    if (!document.getElementById('bnfFourthName').value.trim()) return 'الاسم الرابع مطلوب';
    if (!parseInt(document.getElementById('bnfOrganizationalUnitId').value))
        return 'الوحدة التنظيمية مطلوبة';

    var username = (document.getElementById('bnfUsername').value || '').trim();
    if (!username) return 'اسم المستخدم مطلوب';
    if (username.length < 3) return 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط';

    var endorsementType = document.getElementById('bnfEndorsementType').value;
    if (endorsementType === 'مرفق') {
        var endorsementFile = document.getElementById('bnfEndorsementFile').dataset.base64 || '';
        if (!endorsementFile) return 'يجب رفع ملف التأشير (صورة أو PDF)';
    } else {
        if (bnfIsCanvasEmpty('bnfEndorsementCanvas'))
            return 'يجب التوقيع في مربع التأشير الإلكتروني';
    }

    var signatureType = document.getElementById('bnfSignatureType').value;
    if (signatureType === 'مرفق') {
        var signatureFile = document.getElementById('bnfSignatureFile').dataset.base64 || '';
        if (!signatureFile) return 'يجب رفع ملف التوقيع (صورة أو PDF)';
    } else {
        if (bnfIsCanvasEmpty('bnfSignatureCanvas'))
            return 'يجب التوقيع في مربع التوقيع الإلكتروني';
    }

    var pwd = document.getElementById('bnfPassword').value;
    var confirm = document.getElementById('bnfConfirmPassword').value;
    if (isAdd && !pwd) return 'كلمة المرور مطلوبة عند إضافة مستفيد جديد';
    if (pwd && pwd !== confirm)
        return 'كلمة المرور وتأكيد كلمة المرور غير متطابقتين';
    if (pwd) {
        var pwStrength = bnfValidatePasswordStrength(pwd);
        if (pwStrength) return pwStrength;
    }
    return null;
}

function bnfGetEndorsementData() {
    var type = document.getElementById('bnfEndorsementType').value;
    if (type === 'مرفق')
        return document.getElementById('bnfEndorsementFile').dataset.base64 || '';
    return bnfGetCanvasDataUrl('bnfEndorsementCanvas');
}

function bnfGetSignatureData() {
    var type = document.getElementById('bnfSignatureType').value;
    if (type === 'مرفق')
        return document.getElementById('bnfSignatureFile').dataset.base64 || '';
    return bnfGetCanvasDataUrl('bnfSignatureCanvas');
}

function bnfClearDuplicateFieldHighlight() {
    ['bnfNationalId', 'bnfPhone', 'bnfEmail', 'bnfUsername'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('is-invalid');
    });
}

function bnfHighlightDuplicateField(field) {
    bnfClearDuplicateFieldHighlight();
    var map = { nationalId: 'bnfNationalId', phone: 'bnfPhone', email: 'bnfEmail', username: 'bnfUsername' };
    var id = map[field];
    if (id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('is-invalid');
    }
}

function bnfShowAddModal() {
    document.getElementById('bnfId').value = '';
    document.getElementById('bnfModalTitle').innerHTML = '<i class="bi bi-plus-circle" style="margin-left:8px;"></i>إضافة مستفيد';
    document.getElementById('bnfModalSubtitle').textContent = 'أدخل بيانات المستفيد';
    document.getElementById('bnfSubmitBtn').textContent = 'حفظ';
    document.getElementById('bnfNationalId').value = '';
    document.getElementById('bnfNationalId').readOnly = false;
    document.getElementById('bnfEndorsementType').value = 'مرفق';
    document.getElementById('bnfSignatureType').value = 'مرفق';
    bnfToggleEndorsement();
    bnfToggleSignature();
    document.getElementById('bnfFirstName').value = '';
    document.getElementById('bnfSecondName').value = '';
    document.getElementById('bnfThirdName').value = '';
    document.getElementById('bnfFourthName').value = '';
    bnfOuExpanded = {};
    bnfOuSetSelection('', '');
    bnfOuClosePanel();
    document.getElementById('bnfPhone').value = '';
    document.getElementById('bnfEmail').value = '';
    document.getElementById('bnfIsActive').checked = true;
    document.getElementById('bnfActivationStatus').textContent = 'مفعل';
    document.getElementById('bnfIsUnitManager').checked = false;
    var bnfSubUnit = document.getElementById('bnfSubRoleUnit');
    var bnfSubAdm = document.getElementById('bnfSubRoleAdmin');
    if (bnfSubUnit) bnfSubUnit.checked = true;
    if (bnfSubAdm) bnfSubAdm.checked = false;
    bnfApplyRoleVisibility();
    document.getElementById('bnfUsername').value = '';
    document.getElementById('bnfUsername').readOnly = false;
    document.getElementById('bnfPassword').value = '';
    document.getElementById('bnfConfirmPassword').value = '';
    document.getElementById('bnfPasswordWrap').style.display = '';
    document.getElementById('bnfConfirmWrap').style.display = '';
    document.getElementById('bnfPhotoPreview').style.display = 'none';
    bnfSetPhotoPlaceholderVisible(true);
    document.getElementById('bnfPhoto').value = '';
    document.getElementById('bnfPhoto').dataset.base64 = '';
    bnfSetPhotoFileInputVisible(true);
    document.getElementById('bnfEndorsementFile').value = '';
    document.getElementById('bnfEndorsementFile').dataset.base64 = '';
    document.getElementById('bnfSignatureFile').value = '';
    document.getElementById('bnfSignatureFile').dataset.base64 = '';
    document.getElementById('bnfError').classList.add('d-none');
    bnfClearDuplicateFieldHighlight();
    bnfCheckPasswordLive();
    new bootstrap.Modal(document.getElementById('bnfFormModal')).show();
}

function bnfShowEditModal(id) {
    var b = bnfAll.find(function (x) { return x.id === id; });
    if (!b) return;

    document.getElementById('bnfId').value = b.id;
    document.getElementById('bnfModalTitle').innerHTML = '<i class="bi bi-pencil-square" style="margin-left:8px;"></i>تحديث المستفيد';
    document.getElementById('bnfModalSubtitle').textContent = 'تعديل بيانات المستفيد';
    document.getElementById('bnfSubmitBtn').textContent = 'حفظ التعديلات';
    document.getElementById('bnfNationalId').value = b.nationalId;
    document.getElementById('bnfNationalId').readOnly = true;
    document.getElementById('bnfEndorsementType').value = b.endorsementType || 'مرفق';
    document.getElementById('bnfSignatureType').value = b.signatureType || 'مرفق';
    bnfToggleEndorsement();
    bnfToggleSignature();
    if (b.endorsementFile && (b.endorsementType || 'مرفق') === 'التوقيع بالقلم') {
        bnfDrawImageOnCanvas('bnfEndorsementCanvas', b.endorsementFile);
    }
    if (b.endorsementFile && (b.endorsementType || 'مرفق') === 'مرفق') {
        document.getElementById('bnfEndorsementFile').dataset.base64 = b.endorsementFile;
        document.getElementById('bnfEndorsementPreview').innerHTML = b.endorsementFile.indexOf('data:image') === 0
            ? '<img src="' + esc(b.endorsementFile) + '" class="bnf-attach-preview">'
            : '<span class="badge bg-secondary">PDF</span>';
        document.getElementById('bnfEndorsementPreview').style.display = 'flex';
    }
    if (b.signatureFile && (b.signatureType || 'مرفق') === 'التوقيع بالقلم') {
        bnfDrawImageOnCanvas('bnfSignatureCanvas', b.signatureFile);
    }
    if (b.signatureFile && (b.signatureType || 'مرفق') === 'مرفق') {
        document.getElementById('bnfSignatureFile').dataset.base64 = b.signatureFile;
        document.getElementById('bnfSignaturePreview').innerHTML = b.signatureFile.indexOf('data:image') === 0
            ? '<img src="' + esc(b.signatureFile) + '" class="bnf-attach-preview">'
            : '<span class="badge bg-secondary">PDF</span>';
        document.getElementById('bnfSignaturePreview').style.display = 'flex';
    }
    document.getElementById('bnfFirstName').value = b.firstName || '';
    document.getElementById('bnfSecondName').value = b.secondName || '';
    document.getElementById('bnfThirdName').value = b.thirdName || '';
    document.getElementById('bnfFourthName').value = b.fourthName || '';
    bnfOuExpanded = {};
    var ouId = b.organizationalUnitId;
    if (ouId) {
        bnfOuExpandAncestorsForSelection(ouId);
        bnfOuSetSelection(ouId, b.organizationalUnitName || '');
    } else {
        bnfOuSetSelection('', '');
    }
    bnfOuClosePanel();
    document.getElementById('bnfPhone').value = b.phone || '';
    document.getElementById('bnfEmail').value = b.email || '';
    document.getElementById('bnfIsActive').checked = b.isActive !== false;
    document.getElementById('bnfActivationStatus').textContent = b.isActive !== false ? 'مفعل' : 'معطل';
    document.getElementById('bnfIsUnitManager').checked = !!b.isUnitManager || b.mainRole === 'مدير';
    var subRole = b.subRole || '';
    document.querySelectorAll('input[name="bnfSubRole"]').forEach(function (r) { r.checked = (r.value === subRole); });
    if (!document.querySelector('input[name="bnfSubRole"]:checked') && document.getElementById('bnfSubRoleUnit'))
        document.getElementById('bnfSubRoleUnit').checked = true;
    document.getElementById('bnfUsername').value = b.username || '';
    document.getElementById('bnfPassword').value = '';
    document.getElementById('bnfConfirmPassword').value = '';
    document.getElementById('bnfPasswordWrap').style.display = '';
    document.getElementById('bnfConfirmWrap').style.display = '';
    document.getElementById('bnfError').classList.add('d-none');
    bnfClearDuplicateFieldHighlight();
    bnfCheckPasswordLive();

    if (b.photoUrl) {
        document.getElementById('bnfPhotoPreview').src = b.photoUrl;
        document.getElementById('bnfPhotoPreview').style.display = 'block';
        bnfSetPhotoPlaceholderVisible(false);
        document.getElementById('bnfPhoto').dataset.base64 = b.photoUrl;
        bnfSetPhotoFileInputVisible(false);
    } else {
        document.getElementById('bnfPhotoPreview').style.display = 'none';
        bnfSetPhotoPlaceholderVisible(true);
        document.getElementById('bnfPhoto').dataset.base64 = '';
        bnfSetPhotoFileInputVisible(true);
    }
    document.getElementById('bnfPhoto').value = '';

    new bootstrap.Modal(document.getElementById('bnfFormModal')).show();
}

function bnfSubmit() {
    var id = document.getElementById('bnfId').value;
    var isAdd = !id;
    var err = bnfValidate(isAdd);
    if (err) {
        var errEl = document.getElementById('bnfError');
        errEl.textContent = err;
        errEl.classList.remove('d-none');
        return;
    }
    bnfClearDuplicateFieldHighlight();

    var photoData = document.getElementById('bnfPhoto').dataset.base64 || '';
    var isSys = bnfIsSysAdminRole();
    var ouVal = parseInt(document.getElementById('bnfOrganizationalUnitId').value, 10) || 0;
    var sysAdd = isSys && isAdd;
    var body = {
        photoUrl: photoData || undefined,
        nationalId: sysAdd ? '' : document.getElementById('bnfNationalId').value.trim(),
        endorsementType: sysAdd ? 'مرفق' : document.getElementById('bnfEndorsementType').value,
        endorsementFile: sysAdd ? '' : bnfGetEndorsementData(),
        signatureType: sysAdd ? 'مرفق' : document.getElementById('bnfSignatureType').value,
        signatureFile: sysAdd ? '' : bnfGetSignatureData(),
        firstName: document.getElementById('bnfFirstName').value.trim(),
        secondName: document.getElementById('bnfSecondName').value.trim(),
        thirdName: document.getElementById('bnfThirdName').value.trim(),
        fourthName: document.getElementById('bnfFourthName').value.trim(),
        organizationalUnitId: sysAdd ? 0 : ouVal,
        phone: sysAdd ? '' : document.getElementById('bnfPhone').value.trim(),
        email: sysAdd ? '' : document.getElementById('bnfEmail').value.trim(),
        username: document.getElementById('bnfUsername').value.trim(),
        isActive: document.getElementById('bnfIsActive').checked,
        isUnitManager: isSys ? false : !!document.getElementById('bnfIsUnitManager').checked,
        subRole: (document.querySelector('input[name="bnfSubRole"]:checked') || {}).value || '',
        password: document.getElementById('bnfPassword').value || undefined,
        confirmPassword: document.getElementById('bnfConfirmPassword').value || undefined
    };

    if (isAdd) {
        apiFetch('/Settings/AddBeneficiary', 'POST', body).then(function (r) {
            if (r && r.success) {
                bootstrap.Modal.getInstance(document.getElementById('bnfFormModal')).hide();
                showToast(r.message, 'success');
                bnfLoad();
            } else {
                if (r && r.duplicateField) bnfHighlightDuplicateField(r.duplicateField);
                document.getElementById('bnfError').textContent = (r && r.message) || 'حدث خطأ';
                document.getElementById('bnfError').classList.remove('d-none');
            }
        });
    } else {
        body.id = parseInt(id);
        apiFetch('/Settings/UpdateBeneficiary', 'POST', body).then(function (r) {
            if (r && r.success) {
                bootstrap.Modal.getInstance(document.getElementById('bnfFormModal')).hide();
                showToast(r.message, 'success');
                bnfLoad();
            } else {
                if (r && r.duplicateField) bnfHighlightDuplicateField(r.duplicateField);
                document.getElementById('bnfError').textContent = (r && r.message) || 'حدث خطأ';
                document.getElementById('bnfError').classList.remove('d-none');
            }
        });
    }
}

function bnfShowDetails(id) {
    var b = bnfAll.find(function (x) { return x.id === id; });
    if (!b) return;

    var photoHtml = b.photoUrl ? '<img src="' + esc(b.photoUrl) + '" class="bnf-photo-preview">' : '<span class="text-muted">—</span>';
    var endorsementHtml = (b.endorsementType || '—') + (b.endorsementFile ? ' <small class="text-success">✓</small>' : '');
    var signatureHtml = (b.signatureType || '—') + (b.signatureFile ? ' <small class="text-success">✓</small>' : '');
    var endorsementPreview = b.endorsementFile && b.endorsementFile.indexOf('data:image') === 0
        ? '<div class="mt-2"><img src="' + esc(b.endorsementFile) + '" class="bnf-attach-preview"></div>' : '';
    var signaturePreview = b.signatureFile && b.signatureFile.indexOf('data:image') === 0
        ? '<div class="mt-2"><img src="' + esc(b.signatureFile) + '" class="bnf-attach-preview"></div>' : '';

    var html =
        '<div class="bnf-section"><div class="bnf-section-title"><i class="bi bi-person-badge"></i>الصورة والهوية</div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الصورة:</strong></div><div class="col-md-10">' + photoHtml + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الهوية الوطنية:</strong></div><div class="col-md-10">' + esc(b.nationalId) + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>التأشير:</strong></div><div class="col-md-10">' + endorsementHtml + endorsementPreview + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>التوقيع:</strong></div><div class="col-md-10">' + signatureHtml + signaturePreview + '</div></div></div>' +
        '<div class="bnf-section"><div class="bnf-section-title"><i class="bi bi-person-lines-fill"></i>الأسماء</div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الاسم الكامل:</strong></div><div class="col-md-10">' + esc(b.fullName) + '</div></div></div>' +
        '<div class="bnf-section"><div class="bnf-section-title"><i class="bi bi-building"></i>الوحدة والاتصال</div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الوحدة التنظيمية:</strong></div><div class="col-md-10">' + esc(b.organizationalUnitName || '—') + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الجوال:</strong></div><div class="col-md-10">' + esc(b.phone) + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>البريد الإلكتروني:</strong></div><div class="col-md-10">' + esc(b.email) + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>التفعيل:</strong></div><div class="col-md-10">' + (b.isActive ? 'مفعل' : 'معطل') + '</div></div></div>' +
        '<div class="bnf-section"><div class="bnf-section-title"><i class="bi bi-person-badge"></i>الأدوار وبيانات الدخول</div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>اسم المستخدم:</strong></div><div class="col-md-10"><span dir="ltr">' + esc(b.username || '—') + '</span></div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>مدير وحدة تنظيمية:</strong></div><div class="col-md-10">' + ((b.isUnitManager || b.mainRole === 'مدير') ? 'نعم' : 'لا') + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الدور:</strong></div><div class="col-md-10">' + (b.subRole ? esc(b.subRole) : '—') + '</div></div></div>' +
        '<div class="bnf-section"><div class="bnf-section-title"><i class="bi bi-clock-history"></i>معلومات التدقيق</div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>اسم المنشئ:</strong></div><div class="col-md-10">' + esc(b.createdBy || '—') + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>تاريخ الإنشاء:</strong></div><div class="col-md-10">' + esc(b.createdAt || '—') + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>آخر تحديث بواسطة:</strong></div><div class="col-md-10">' + esc(b.updatedBy || '—') + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>تاريخ التحديث:</strong></div><div class="col-md-10">' + esc(b.updatedAt || '—') + '</div></div></div>';

    document.getElementById('bnfDetailsBody').innerHTML = html;
    new bootstrap.Modal(document.getElementById('bnfDetailsModal')).show();
}

function bnfShowDeleteModal(id, name) {
    document.getElementById('bnfDeleteId').value = id;
    document.getElementById('bnfDeleteNameLabel').textContent = name;
    document.getElementById('bnfDeleteError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('bnfDeleteModal')).show();
}

async function bnfSubmitDelete() {
    var id = parseInt(document.getElementById('bnfDeleteId').value);
    var errEl = document.getElementById('bnfDeleteError');
    errEl.classList.add('d-none');

    var r = await apiFetch('/Settings/DeleteBeneficiary', 'POST', { id: id });
    if (r && r.success) {
        bootstrap.Modal.getInstance(document.getElementById('bnfDeleteModal')).hide();
        showToast(r.message, 'success');
        await bnfLoad();
    } else {
        errEl.textContent = (r && r.message) || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}
