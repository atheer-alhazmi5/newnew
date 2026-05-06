'use strict';

function ouEsc(t) {
    if (typeof esc === 'function') return esc(t);
    var s = t == null ? '' : String(t);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

var ouRows = [];
var ouClassifications = [];
var ouEditingId = null;

function ouExcludedIdsForParentPicker(editUnitId) {
    if (!editUnitId) return {};
    var byParent = {};
    ouRows.forEach(function (u) {
        var pid = u.parentId != null ? u.parentId : u.ParentId;
        var k = (pid != null && pid !== '') ? String(pid) : '';
        if (!byParent[k]) byParent[k] = [];
        byParent[k].push(u.id);
    });
    var ex = {};
    function walk(id) {
        ex[id] = true;
        (byParent[String(id)] || []).forEach(walk);
    }
    walk(editUnitId);
    return ex;
}

function ouFillParentSelect() {
    var sel = document.getElementById('ouParentId');
    if (!sel) return;
    var exclude = ouExcludedIdsForParentPicker(ouEditingId);
    var allowed = ouRows.filter(function (u) { return !exclude[u.id]; });
    var allowedIds = {};
    allowed.forEach(function (u) { allowedIds[u.id] = true; });

    var childrenOf = {};
    function addChild(key, node) {
        if (!childrenOf[key]) childrenOf[key] = [];
        childrenOf[key].push(node);
    }
    allowed.forEach(function (u) {
        var pid = u.parentId != null ? u.parentId : u.ParentId;
        if (pid && allowedIds[pid]) addChild(String(pid), u);
        else addChild('__root__', u);
    });

    function sortUnits(arr) {
        return arr.slice().sort(function (a, b) {
            var sa = a.sortOrder != null ? a.sortOrder : 0;
            var sb = b.sortOrder != null ? b.sortOrder : 0;
            if (sa !== sb) return sa - sb;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
        });
    }

    var prev = sel.value;
    var parts = ['<option value="">— وحدة رئيسية (بدون أب في الشجرة) —</option>'];

    function walk(nodes, depth) {
        sortUnits(nodes || []).forEach(function (u) {
            var prefix = '';
            if (depth > 0) {
                prefix = '\u200f' + '\u00A0\u00A0'.repeat(depth) + '\u2514\u00A0';
            }
            parts.push('<option value="' + u.id + '">' + prefix + ouEsc(u.name || '') + '</option>');
            walk(childrenOf[String(u.id)], depth + 1);
        });
    }

    walk(childrenOf['__root__'], 0);

    sel.innerHTML = parts.join('');
    if (prev && Array.prototype.some.call(sel.options, function (o) { return o.value === prev; }))
        sel.value = prev;
}

async function ouLoad() {
    try {
        var r = await apiFetch('/Settings/GetOrganizationalUnits');
        if (!r || !r.success) {
            document.getElementById('ouBody').innerHTML =
                '<tr><td colspan="9" class="text-center py-4 text-danger">غير مصرح أو خطأ في التحميل</td></tr>';
            return;
        }
        ouRows = r.data || [];
        ouClassifications = r.classifications || [];
        ouFillClassificationSelect('ouClassificationId');
        ouFillClassificationSelect('ouFilterClassification');
        ouRenderTable();
    } catch (e) {
        document.getElementById('ouBody').innerHTML =
            '<tr><td colspan="9" class="text-center py-4 text-danger">خطأ في الاتصال</td></tr>';
    }
}

function ouFillClassificationSelect(elId) {
    var sel = document.getElementById(elId);
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = elId === 'ouFilterClassification'
        ? '<option value="">كل التصنيفات</option>'
        : '<option value="">— اختر التصنيف —</option>';
    ouClassifications.forEach(function (c) {
        sel.innerHTML += '<option value="' + c.id + '">' + ouEsc(c.name || '') + '</option>';
    });
    sel.value = keep;
}

function ouFilteredRows() {
    var q = (document.getElementById('ouSearch') && document.getElementById('ouSearch').value || '').trim().toLowerCase();
    var cf = document.getElementById('ouFilterClassification') ? document.getElementById('ouFilterClassification').value : '';
    return ouRows.filter(function (u) {
        if (q && String(u.name || '').toLowerCase().indexOf(q) === -1) return false;
        if (cf && String(u.classificationId) !== String(cf)) return false;
        return true;
    });
}

function ouRenderTable() {
    var body = document.getElementById('ouBody');
    if (!body) return;
    var list = ouFilteredRows();
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">لا توجد وحدات مطابقة</td></tr>';
        return;
    }
    list.sort(function (a, b) {
        var sa = a.sortOrder != null ? a.sortOrder : 0;
        var sb = b.sortOrder != null ? b.sortOrder : 0;
        if (sa !== sb) return sa - sb;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
    });
    var html = '';
    list.forEach(function (u, idx) {
        var cls = ouClassifications.find(function (c) { return String(c.id) === String(u.classificationId); });
        var badgeColor = cls && cls.color ? cls.color : '#25935F';
        var parentNm = u.parentName ? ouEsc(u.parentName) : '<span class="text-muted">—</span>';
        var mc = u.memberCount != null ? u.memberCount : (u.MemberCount != null ? u.MemberCount : 0);
        var mgrNm = u.unitManagerName || u.UnitManagerName || '';
        var mgrCell = mgrNm
            ? '<span style="font-size:12px;font-weight:600;">' + ouEsc(mgrNm) + '</span>'
            : '<span class="text-warning" style="font-size:12px;font-weight:700;">بدون مدير</span>';
        var activePill = u.isActive !== false
            ? '<span class="ou-status ou-on">مفعل</span>'
            : '<span class="ou-status ou-off">معطل</span>';
        html += '<tr>' +
            '<td style="text-align:center;font-weight:700;color:var(--gray-500);">' + (idx + 1) + '</td>' +
            '<td style="font-weight:700;">' + ouEsc(u.name || '') + '</td>' +
            '<td><span class="badge rounded-pill" style="background:' + badgeColor + ';font-size:11px;">' + ouEsc(u.classificationName || '') + '</span></td>' +
            '<td style="font-size:12px;">' + parentNm + '</td>' +
            '<td style="text-align:center;font-weight:700;">' + mc + '</td>' +
            '<td style="font-size:12px;max-width:220px;">' + mgrCell + '</td>' +
            '<td style="text-align:center;">' + u.sortOrder + '</td>' +
            '<td style="text-align:center;">' + activePill + '</td>' +
            '<td style="white-space:nowrap;text-align:center;">' +
            '<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;">' +
            '<button type="button" class="ou-action-btn ou-action-btn-detail" onclick="ouShowDetails(' + u.id + ')" title="تفاصيل"><i class="bi bi-eye"></i> تفاصيل</button>' +
            '<button type="button" class="ou-action-btn ou-action-btn-edit" onclick="ouEdit(' + u.id + ')" title="تحديث"><i class="bi bi-pencil"></i> تحديث</button>' +
            '<button type="button" class="ou-action-btn ou-action-btn-delete" onclick="ouConfirmDelete(' + u.id + ')" title="حذف"><i class="bi bi-trash3"></i> حذف</button>' +
            '</div></td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

function ouShowDetails(id) {
    var u = ouRows.find(function (x) { return x.id === id; });
    if (!u) return;
    var sub = document.getElementById('ouDetailsSubtitle');
    var body = document.getElementById('ouDetailsBody');
    if (!sub || !body) return;
    sub.textContent = u.name || '';

    var lev = u.level || u.Level || '';
    var parentNm = u.parentName || '';
    var mc = u.memberCount != null ? u.memberCount : (u.MemberCount != null ? u.MemberCount : 0);
    var mgrNm = u.unitManagerName || u.UnitManagerName || '';
    var mgrHtml = mgrNm
        ? ouEsc(mgrNm)
        : '<span class="text-warning fw-semibold">بدون مدير مسجّل لهذه الوحدة</span>';

    function detailRow(label, innerHtml) {
        return '<div class="d-flex flex-wrap py-2 border-bottom border-light" style="gap:8px;"><div class="text-muted fw-bold" style="min-width:170px;">' + ouEsc(label) + '</div><div class="flex-grow-1">' + innerHtml + '</div></div>';
    }

    var activeTxt = u.isActive !== false ? 'مفعّلة' : 'معطّلة';
    var members = u.members || u.Members || [];
    var membersBlock = '';
    if (members.length) {
        var rows = '';
        members.forEach(function (name, idx) {
            rows += '<tr><td style="text-align:center;font-weight:700;color:var(--gray-500);">' + (idx + 1) + '</td><td>' + ouEsc(String(name)) + '</td></tr>';
        });
        membersBlock =
            '<div class="mt-3 pt-3 border-top border-light">' +
            '<div class="table-responsive rounded border" style="max-height:280px;overflow-y:auto;">' +
            '<table class="table table-sm table-striped mb-0" style="font-size:13px;">' +
            '<thead class="table-light"><tr><th scope="col" style="width:44px;text-align:center;">ت</th><th scope="col">الاسم الكامل</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div></div>';
    } else {
        membersBlock =
            '<div class="mt-3 pt-3 border-top border-light">' +
            '<div class="table-responsive rounded border"><table class="table table-sm mb-0" style="font-size:13px;">' +
            '<thead class="table-light"><tr><th scope="col" style="width:44px;text-align:center;">ت</th><th scope="col">الاسم الكامل</th></tr></thead>' +
            '<tbody><tr><td colspan="2" class="text-muted text-center py-3 small">لا يوجد منسوبون مسجّلون لهذه الوحدة</td></tr></tbody>' +
            '</table></div></div>';
    }

    body.innerHTML =
        detailRow('التصنيف التنظيمي', ouEsc(u.classificationName || '—')) +
        detailRow('نوع الوحدة في الهيكل', ouEsc(lev || '—')) +
        detailRow('الوحدة التنظيمية الرئيسية', parentNm ? ouEsc(parentNm) : '<span class="text-muted">وحدة رئيسية (جذر)</span>') +
        detailRow('عدد المنسوبين', '<strong>' + mc + '</strong> مستفيد مرتبط بالوحدة التنظيمية') +
        detailRow('مدير الوحدة التنظيمية', mgrHtml) +
        detailRow('ترتيب العرض', String(u.sortOrder != null ? u.sortOrder : '')) +
        detailRow('التفعيل', ouEsc(activeTxt)) +
        membersBlock +
        detailRow('أنشئ بواسطة', ouEsc(u.createdBy || '—')) +
        detailRow('تاريخ الإنشاء', ouEsc(u.createdAt || u.CreatedAt || '—')) +
        detailRow('آخر تحديث بواسطة', ouEsc(u.updatedBy || u.UpdatedBy || '—')) +
        detailRow('تاريخ التحديث', ouEsc(u.updatedAt || u.UpdatedAt || '—'));

    bootstrap.Modal.getOrCreateInstance(document.getElementById('ouDetailsModal')).show();
}

function ouShowAddModal() {
    ouEditingId = null;
    document.getElementById('ouModalTitle').textContent = 'إضافة وحدة تنظيمية';
    document.getElementById('ouName').value = '';
    document.getElementById('ouClassificationId').value = '';
    document.getElementById('ouIsActive').checked = true;
    document.getElementById('ouSortWrap').style.display = 'none';
    ouFillParentSelect();
    document.getElementById('ouParentId').value = '';
    document.getElementById('ouError').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ouModal')).show();
}

function ouEdit(id) {
    var u = ouRows.find(function (x) { return x.id === id; });
    if (!u) return;
    ouEditingId = id;
    document.getElementById('ouModalTitle').textContent = 'تعديل وحدة تنظيمية';
    document.getElementById('ouName').value = u.name || '';
    document.getElementById('ouClassificationId').value = String(u.classificationId || '');
    document.getElementById('ouIsActive').checked = u.isActive !== false;
    document.getElementById('ouSortWrap').style.display = '';
    document.getElementById('ouSortOrder').value = u.sortOrder != null ? u.sortOrder : '';
    ouFillParentSelect();
    var pid = u.parentId != null ? u.parentId : u.ParentId;
    document.getElementById('ouParentId').value = pid ? String(pid) : '';
    document.getElementById('ouError').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ouModal')).show();
}

async function ouSave() {
    var errEl = document.getElementById('ouError');
    errEl.classList.add('d-none');
    var name = (document.getElementById('ouName').value || '').trim();
    var cid = parseInt(document.getElementById('ouClassificationId').value, 10);
    var pidRaw = document.getElementById('ouParentId').value;
    var parentId = pidRaw ? parseInt(pidRaw, 10) : null;
    if (!name) {
        errEl.textContent = 'اسم الوحدة مطلوب';
        errEl.classList.remove('d-none');
        return;
    }
    if (!cid) {
        errEl.textContent = 'اختر التصنيف التنظيمي';
        errEl.classList.remove('d-none');
        return;
    }
    if (pidRaw && (!parentId || parentId <= 0)) {
        errEl.textContent = 'اختيار الوحدة الرئيسية غير صالح';
        errEl.classList.remove('d-none');
        return;
    }
    if (ouEditingId && parentId === ouEditingId) {
        errEl.textContent = 'لا يمكن أن تكون الوحدة تابعة لنفسها';
        errEl.classList.remove('d-none');
        return;
    }

    try {
        if (ouEditingId) {
            var sortOrder = parseInt(document.getElementById('ouSortOrder').value, 10);
            if (!sortOrder || sortOrder < 1) sortOrder = 1;
            var r = await apiFetch('/Settings/UpdateOrganizationalUnit', 'POST', {
                id: ouEditingId,
                name: name,
                classificationId: cid,
                parentId: parentId,
                isActive: document.getElementById('ouIsActive').checked,
                sortOrder: sortOrder
            });
            if (r.success) {
                bootstrap.Modal.getInstance(document.getElementById('ouModal')).hide();
                showToast(r.message || 'تم التحديث', 'success');
                ouLoad();
            } else {
                errEl.textContent = r.message || 'خطأ';
                errEl.classList.remove('d-none');
            }
        } else {
            var r2 = await apiFetch('/Settings/AddOrganizationalUnit', 'POST', {
                name: name,
                classificationId: cid,
                parentId: parentId,
                isActive: document.getElementById('ouIsActive').checked
            });
            if (r2.success) {
                bootstrap.Modal.getInstance(document.getElementById('ouModal')).hide();
                showToast(r2.message || 'تم الإضافة', 'success');
                ouLoad();
            } else {
                errEl.textContent = r2.message || 'خطأ';
                errEl.classList.remove('d-none');
            }
        }
    } catch (e) {
        errEl.textContent = 'خطأ في الاتصال';
        errEl.classList.remove('d-none');
    }
}

var ouDeleteId = null;
function ouConfirmDelete(id) {
    ouDeleteId = id;
    var u = ouRows.find(function (x) { return x.id === id; });
    document.getElementById('ouDeleteName').textContent = u ? (u.name || '') : '';
    document.getElementById('ouDeleteErr').classList.add('d-none');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('ouDeleteModal')).show();
}

async function ouSubmitDelete() {
    var err = document.getElementById('ouDeleteErr');
    err.classList.add('d-none');
    try {
        var r = await apiFetch('/Settings/DeleteOrganizationalUnit', 'POST', { id: ouDeleteId });
        if (r.success) {
            bootstrap.Modal.getInstance(document.getElementById('ouDeleteModal')).hide();
            showToast(r.message || 'تم الحذف', 'success');
            ouLoad();
        } else {
            err.textContent = r.message || 'فشل الحذف';
            err.classList.remove('d-none');
        }
    } catch (e) {
        err.textContent = 'خطأ في الاتصال';
        err.classList.remove('d-none');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var s = document.getElementById('ouSearch');
    var f = document.getElementById('ouFilterClassification');
    if (s) s.addEventListener('input', function () { ouRenderTable(); });
    if (f) f.addEventListener('change', function () { ouRenderTable(); });
    ouLoad();
});
