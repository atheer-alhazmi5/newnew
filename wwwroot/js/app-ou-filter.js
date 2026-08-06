'use strict';

/** فلتر الوحدة التنظيمية الموحّد — مطابق لآلية صفحة النماذج المستخدمة. */
window.AppOuFilter = (function () {
    var instances = {};
    var globalClickBound = false;

    function escHtml(s) {
        if (typeof esc === 'function') return esc(s);
        if (s == null) return '';
        var d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function mapOrgUnits(list) {
        return (list || []).map(function (u) {
            return {
                id: u.id != null ? u.id : u.Id,
                name: u.name != null ? u.name : u.Name,
                parentId: u.parentId != null ? u.parentId : (u.ParentId != null ? u.ParentId : null),
                sortOrder: u.sortOrder != null ? u.sortOrder : (u.SortOrder != null ? u.SortOrder : 0)
            };
        });
    }

    function buildByParent(units) {
        var ids = {};
        units.forEach(function (u) { ids[u.id] = true; });
        var byParent = {};
        units.forEach(function (u) {
            var pk = (u.parentId != null && u.parentId !== '' && ids[u.parentId]) ? String(u.parentId) : '';
            if (!byParent[pk]) byParent[pk] = [];
            byParent[pk].push(u);
        });
        Object.keys(byParent).forEach(function (k) {
            byParent[k].sort(function (a, b) {
                var sa = a.sortOrder != null ? a.sortOrder : 0;
                var sb = b.sortOrder != null ? b.sortOrder : 0;
                if (sa !== sb) return sa - sb;
                return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
            });
        });
        return byParent;
    }

    function expandAncestors(inst, selectId) {
        if (!selectId || isNaN(selectId)) return;
        var map = {};
        inst.units.forEach(function (u) { map[u.id] = u; });
        var u = map[selectId];
        while (u && u.parentId != null && u.parentId !== '') {
            inst.expanded[String(u.parentId)] = true;
            u = map[u.parentId];
        }
    }

    function renderRows(inst, byParent, parentKey, depth, selectedId) {
        var rows = byParent[parentKey] || [];
        var sel = selectedId !== undefined && selectedId !== null ? String(selectedId) : (document.getElementById(inst.hiddenId)?.value || '');
        var html = '';
        rows.forEach(function (u) {
            var idStr = String(u.id);
            var children = byParent[idStr] || [];
            var hasChildren = children.length > 0;
            var expanded = !!inst.expanded[idStr];
            var indent = depth * 22;
            var rowSel = String(sel) === idStr ? ' is-selected' : '';
            html += '<div class="bnf-ou-tree-row d-flex align-items-center' + rowSel + '" data-id="' + u.id + '" role="option" dir="rtl" style="padding:8px 10px;padding-right:' + (12 + indent) + 'px;">';
            if (hasChildren) {
                html += '<button type="button" class="bnf-ou-tree-exp" data-exp="' + idStr + '" aria-expanded="' + expanded + '" title="' + (expanded ? 'طي' : 'توسيع') + '">' + (expanded ? '−' : '+') + '</button>';
            } else {
                html += '<span class="bnf-ou-tree-exp-spacer" aria-hidden="true"></span>';
            }
            html += '<span class="bnf-ou-tree-name flex-grow-1">' + escHtml(u.name || '') + '</span></div>';
            if (hasChildren && expanded) html += renderRows(inst, byParent, idStr, depth + 1, sel);
        });
        return html;
    }

    function renderPanel(inst) {
        var panel = document.getElementById(inst.panelId);
        if (!panel) return;
        if (!inst.units.length) {
            panel.innerHTML = '<div class="text-muted text-center py-3 px-2" style="font-size:13px;">لا توجد وحدات تنظيمية</div>';
            return;
        }
        var byParent = buildByParent(inst.units);
        var selectedId = document.getElementById(inst.hiddenId)?.value || '';
        var html = renderRows(inst, byParent, '', 0, selectedId);
        panel.innerHTML = html || '<div class="text-muted text-center py-3">لا توجد وحدات</div>';
    }

    function closePanel(inst) {
        var panel = document.getElementById(inst.panelId);
        var trig = document.getElementById(inst.triggerId);
        if (panel) panel.classList.add('d-none');
        if (trig) trig.setAttribute('aria-expanded', 'false');
    }

    function togglePanel(inst) {
        var panel = document.getElementById(inst.panelId);
        var trig = document.getElementById(inst.triggerId);
        if (!panel) return;
        if (panel.classList.contains('d-none')) {
            var cur = document.getElementById(inst.hiddenId)?.value;
            if (cur) expandAncestors(inst, parseInt(cur, 10));
            renderPanel(inst);
            panel.classList.remove('d-none');
            if (trig) trig.setAttribute('aria-expanded', 'true');
        } else {
            closePanel(inst);
        }
    }

    function setSelection(inst, id, name, skipCallback) {
        var hid = document.getElementById(inst.hiddenId);
        var lab = document.getElementById(inst.labelId);
        var defaultLabel = inst.defaultLabel || 'الوحدة التنظيمية';
        if (hid) hid.value = id != null && id !== '' ? String(id) : '';
        if (lab) lab.textContent = name && String(name).trim() ? name : defaultLabel;
        closePanel(inst);
        if (!skipCallback && typeof inst.onChange === 'function') inst.onChange(inst.getValue());
    }

    function syncLabel(inst) {
        var hid = document.getElementById(inst.hiddenId);
        var lab = document.getElementById(inst.labelId);
        if (!hid || !lab) return;
        var v = hid.value;
        if (!v) {
            lab.textContent = inst.defaultLabel || 'الوحدة التنظيمية';
            return;
        }
        var uid = parseInt(v, 10);
        var u = inst.units.find(function (x) { return x.id === uid; });
        lab.textContent = u ? u.name : (inst.defaultLabel || 'الوحدة التنظيمية');
    }

    function bindGlobalClick() {
        if (globalClickBound) return;
        globalClickBound = true;
        document.addEventListener('click', function (e) {
            Object.keys(instances).forEach(function (key) {
                var inst = instances[key];
                var panel = document.getElementById(inst.panelId);
                if (!panel || panel.classList.contains('d-none')) return;

                var expBtn = e.target.closest('#' + inst.panelId + ' .bnf-ou-tree-exp');
                if (expBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    var expId = expBtn.getAttribute('data-exp');
                    if (expId) {
                        if (inst.expanded[expId]) delete inst.expanded[expId];
                        else inst.expanded[expId] = true;
                        renderPanel(inst);
                    }
                    return;
                }

                var row = e.target.closest('#' + inst.panelId + ' .bnf-ou-tree-row');
                if (row) {
                    e.preventDefault();
                    e.stopPropagation();
                    var rid = row.getAttribute('data-id');
                    if (!rid) return;
                    var nameEl = row.querySelector('.bnf-ou-tree-name');
                    var name = nameEl ? nameEl.textContent.trim() : '';
                    setSelection(inst, rid, name);
                    return;
                }

                var wrap = inst.wrapSelector ? document.querySelector(inst.wrapSelector) : panel.parentElement;
                if (wrap && !wrap.contains(e.target)) closePanel(inst);
            });
        });
    }

    function create(config) {
        var inst = {
            id: config.id,
            hiddenId: config.hiddenId,
            triggerId: config.triggerId,
            panelId: config.panelId,
            labelId: config.labelId,
            wrapSelector: config.wrapSelector || null,
            defaultLabel: config.defaultLabel || 'الوحدة التنظيمية',
            onChange: config.onChange || null,
            units: [],
            expanded: {},
            getValue: function () {
                return document.getElementById(inst.hiddenId)?.value || '';
            }
        };
        instances[config.id] = inst;

        var trig = document.getElementById(inst.triggerId);
        if (trig && !trig._appOuBound) {
            trig._appOuBound = true;
            trig.addEventListener('click', function (ev) {
                ev.stopPropagation();
                togglePanel(inst);
            });
        }
        bindGlobalClick();
        return inst;
    }

    function setUnits(id, orgUnitFilters, isAdmin, orgUnitsForSelect) {
        var inst = instances[id];
        if (!inst) return;
        // فلتر الجدول: orgUnitFilters = كل الوحدات الفعّالة (مصدر موحّد — مطابق لمدير النظام).
        var src = (orgUnitFilters && orgUnitFilters.length) ? orgUnitFilters : (orgUnitsForSelect || []);
        inst.units = mapOrgUnits(src);
        inst.expanded = {};
        renderPanel(inst);
        syncLabel(inst);
    }

    function clear(id) {
        var inst = instances[id];
        if (!inst) return;
        inst.expanded = {};
        setSelection(inst, '', inst.defaultLabel || 'الوحدة التنظيمية');
    }

    async function loadFromFormDefinitions(id) {
        var res = await apiFetch('/FormDefinitions/GetOrganizationalUnitFilters');
        if (!res || !res.success) return null;
        setUnits(id, res.orgUnitFilters, res.isAdmin, res.orgUnitsForSelect);
        return res;
    }

    return {
        create: create,
        setUnits: setUnits,
        clear: clear,
        hasInstance: function (id) { return !!instances[id]; },
        syncLabel: function (id) { syncLabel(instances[id]); },
        getValue: function (id) { return instances[id] ? instances[id].getValue() : ''; },
        loadFromFormDefinitions: loadFromFormDefinitions,
        mapOrgUnits: mapOrgUnits
    };
})();
