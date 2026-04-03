/* form-fill.js - تعبئة النموذج */

var formData = null;
var receivedFormData = null;

async function initFormFill() {
    var container = document.getElementById('formFillContainer');
    if (!container) return;

    var formId = typeof FORM_ID !== 'undefined' ? FORM_ID : null;
    var receivedId = typeof RECEIVED_FORM_ID !== 'undefined' ? RECEIVED_FORM_ID : null;
    var mode = typeof VIEW_MODE !== 'undefined' ? VIEW_MODE : 'fill';

    try {
        if (receivedId) {
            var r = await apiFetch('/FormFill/GetReceivedForm?id=' + receivedId);
            if (!r || !r.success) {
                container.innerHTML = '<div class="alert alert-danger">النموذج غير موجود أو غير متاح</div>';
                return;
            }
            receivedFormData = r.data;
            formData = r.form;
        } else if (formId) {
            var r2 = await apiFetch('/Forms/GetForm?id=' + formId);
            if (!r2 || !r2.success) {
                container.innerHTML = '<div class="alert alert-danger">النموذج غير موجود</div>';
                return;
            }
            formData = r2.data;
        } else {
            container.innerHTML = '<div class="alert alert-warning">لم يتم تحديد نموذج</div>';
            return;
        }
        renderForm(container, mode);
    } catch(e) {
        container.innerHTML = '<div class="alert alert-danger">حدث خطأ في تحميل النموذج</div>';
    }
}

function renderForm(container, mode) {
    var sections = tryParse(formData.sectionsJson) || [];
    var isView = mode === 'view';
    var existingAnswers = receivedFormData ? (tryParse(receivedFormData.answersJson) || []) : [];
    var answerMap = {};
    existingAnswers.forEach(function(a) { answerMap[a.questionId || a.label] = a.answer; });

    var html = '<div style="max-width:800px;margin:0 auto;">' +
        '<div class="d-flex align-items-center gap-3 mb-4">' +
            '<div style="width:56px;height:56px;border-radius:50%;background:var(--sa-800);display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;">' +
                '<i class="bi bi-file-earmark-text"></i></div>' +
            '<div><h3 style="font-weight:700;margin:0;">' + esc(formData.name) + '</h3>' +
            '<p style="color:var(--gray-500);margin:0;font-size:14px;">' + esc(formData.description || '') + '</p></div></div>';

    if (sections.length === 0) {
        html += '<div class="alert alert-info">لا توجد أسئلة في هذا النموذج</div>';
    } else {
        sections.forEach(function(sec, si) {
            html += '<div class="card mb-4"><div class="card-body">' +
                '<h5 style="font-weight:700;color:var(--sa-800);margin-bottom:20px;padding-bottom:10px;border-bottom:2px solid var(--sa-100);">' +
                (si + 1) + '. ' + esc(sec.title || sec.name || 'قسم') + '</h5>';
            (sec.questions || []).forEach(function(q, qi) {
                var qKey = q.id || (si + '_' + qi);
                var existingVal = answerMap[qKey] || answerMap[q.label] || answerMap[q.text] || '';
                html += renderQuestion(q, qi, si, qKey, existingVal, isView);
            });
            html += '</div></div>';
        });
    }

    if (!isView && !(receivedFormData && receivedFormData.status && receivedFormData.status.indexOf('تم') >= 0)) {
        html += '<div class="d-flex gap-3 mt-4 mb-4">' +
            '<button class="btn btn-primary btn-lg" onclick="submitForm()">' +
            '<i class="bi bi-send" style="margin-left:8px;"></i>إرسال النموذج</button>' +
            '<button class="btn btn-outline-secondary" onclick="history.back()">' +
            '<i class="bi bi-arrow-right" style="margin-left:8px;"></i>رجوع</button></div>';
    } else {
        html += '<div class="d-flex gap-3 mt-4 mb-4">' +
            '<button class="btn btn-outline-secondary" onclick="history.back()">' +
            '<i class="bi bi-arrow-right" style="margin-left:8px;"></i>رجوع</button></div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

function renderQuestion(q, qi, si, qKey, existingVal, isView) {
    var qNum = qi + 1;
    var type = q.type || 'text';
    var label = esc(q.label || q.text || q.question || 'سؤال ' + qNum);
    var required = q.required ? '<span style="color:#dc3545;margin-left:4px;">*</span>' : '';
    var disabled = isView ? 'disabled' : '';
    var id = 'q_' + si + '_' + qi;
    var showOther = !!q.enableOther && (type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown' || type === 'select');
    var input = '';

    switch (type) {
        case 'text':
        case 'short_text':
        case 'short_answer':
            input = '<input type="text" class="form-control" id="' + id + '" data-key="' + qKey + '" placeholder="' + esc(q.placeholder || '') + '" value="' + esc(existingVal) + '" maxlength="255" ' + disabled + '>';
            break;

        case 'textarea':
        case 'long_text':
        case 'paragraph':
            input = '<textarea class="form-control" id="' + id + '" data-key="' + qKey + '" rows="4" maxlength="1000" ' + disabled + '>' + esc(existingVal) + '</textarea>';
            break;

        case 'number':
            input = '<input type="number" class="form-control" id="' + id + '" data-key="' + qKey + '" value="' + esc(existingVal) + '" ' + disabled + '>';
            break;

        case 'date':
        case 'date_only':
            input = '<input type="date" class="form-control" id="' + id + '" data-key="' + qKey + '" value="' + esc(existingVal) + '" ' + disabled + '>';
            break;

        case 'date_time':
            input = '<input type="datetime-local" class="form-control" id="' + id + '" data-key="' + qKey + '" value="' + esc(existingVal) + '" ' + disabled + '>';
            break;

        case 'select':
        case 'dropdown': {
            var baseOptions = (q.options || []).map(function(o) {
                return typeof o === 'string' ? o : (o.value || o.label || o);
            });
            var isOtherSelected = showOther && existingVal && baseOptions.indexOf(existingVal) < 0;
            var opts = (q.options || []).map(function(o) {
                var val = typeof o === 'string' ? o : (o.value || o.label || o);
                return '<option value="' + esc(val) + '" ' + (existingVal === val ? 'selected' : '') + '>' + esc(val) + '</option>';
            }).join('');
            if (showOther) {
                opts += '<option value="__other__" ' + (isOtherSelected ? 'selected' : '') + '>أخرى</option>';
            }
            input = '<select class="form-select" id="' + id + '" data-key="' + qKey + '" ' + (showOther && !isView ? 'onchange="toggleOtherInput(\'' + id + '\',\'dropdown\')"' : '') + ' ' + disabled + '><option value="">-- اختر --</option>' + opts + '</select>';
            if (showOther) {
                input += '<input type="text" class="form-control mt-2" id="' + id + '_other" placeholder="اكتب خيارًا آخر..." value="' + esc(isOtherSelected ? existingVal : '') + '" style="' + (isOtherSelected ? '' : 'display:none;') + '" ' + disabled + '>';
            }
            break;
        }

        case 'radio':
        case 'multiple_choice': {
            var existArr = Array.isArray(existingVal) ? existingVal : [existingVal];
            var existingSingle = existArr.length ? existArr[0] : '';
            var baseOptions2 = (q.options || []).map(function(o) {
                return typeof o === 'string' ? o : (o.value || o.label || o);
            });
            var isOtherSelected2 = showOther && existingSingle && baseOptions2.indexOf(existingSingle) < 0;
            input = (q.options || []).map(function(o, oi) {
                var val = typeof o === 'string' ? o : (o.value || o.label || o);
                return '<div class="form-check">' +
                    '<input class="form-check-input" type="radio" name="' + id + '" id="' + id + '_' + oi + '" data-key="' + qKey + '" value="' + esc(val) + '" ' + (existArr.indexOf(val) >= 0 ? 'checked' : '') + ' ' + disabled + '>' +
                    '<label class="form-check-label" for="' + id + '_' + oi + '">' + esc(val) + '</label></div>';
            }).join('');
            if (showOther) {
                input += '<div class="form-check">' +
                    '<input class="form-check-input" type="radio" name="' + id + '" id="' + id + '_other_radio" data-key="' + qKey + '" value="__other__" ' + (isOtherSelected2 ? 'checked' : '') + ' ' + (isView ? 'disabled' : 'onclick="toggleOtherInput(\'' + id + '\',\'radio\')"') + ' ' + disabled + '>' +
                    '<label class="form-check-label" for="' + id + '_other_radio">أخرى</label></div>' +
                    '<input type="text" class="form-control mt-2" id="' + id + '_other" placeholder="اكتب خيارًا آخر..." value="' + esc(isOtherSelected2 ? existingSingle : '') + '" style="' + (isOtherSelected2 ? '' : 'display:none;') + '" ' + disabled + '>';
            }
            break;
        }

        case 'checkbox':
        case 'checkboxes': {
            var existArr2 = Array.isArray(existingVal) ? existingVal :
                (existingVal ? existingVal.split('،').map(function(s) { return s.trim(); }) : []);
            var baseOptions3 = (q.options || []).map(function(o) {
                return typeof o === 'string' ? o : (o.value || o.label || o);
            });
            var existingOtherValues = existArr2.filter(function(v) { return baseOptions3.indexOf(v) < 0; });
            var hasOtherChecked = showOther && existingOtherValues.length > 0;
            input = (q.options || []).map(function(o, oi) {
                var val = typeof o === 'string' ? o : (o.value || o.label || o);
                return '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="' + id + '_' + oi + '" data-key="' + qKey + '" value="' + esc(val) + '" ' + (existArr2.indexOf(val) >= 0 ? 'checked' : '') + ' ' + disabled + '>' +
                    '<label class="form-check-label" for="' + id + '_' + oi + '">' + esc(val) + '</label></div>';
            }).join('');
            if (showOther) {
                input += '<div class="form-check">' +
                    '<input class="form-check-input" type="checkbox" id="' + id + '_other_cb" data-key="' + qKey + '" value="__other__" ' + (hasOtherChecked ? 'checked' : '') + ' ' + (isView ? 'disabled' : 'onclick="toggleOtherInput(\'' + id + '\',\'checkbox\')"') + ' ' + disabled + '>' +
                    '<label class="form-check-label" for="' + id + '_other_cb">أخرى</label></div>' +
                    '<input type="text" class="form-control mt-2" id="' + id + '_other" placeholder="اكتب خيارًا آخر..." value="' + esc(hasOtherChecked ? existingOtherValues.join('، ') : '') + '" style="' + (hasOtherChecked ? '' : 'display:none;') + '" ' + disabled + '>';
            }
            break;
        }

        case 'rating': {
            var maxR = q.maxRating || 5;
            var stars = '';
            for (var n = 1; n <= maxR; n++) {
                stars += '<span class="star ' + (Number(existingVal) >= n ? 'active' : '') + '" data-val="' + n + '" onclick="' + (isView ? '' : "setRating('" + id + "'," + n + ")") + '" style="font-size:28px;cursor:' + (isView ? 'default' : 'pointer') + ';color:' + (Number(existingVal) >= n ? '#f59e0b' : '#d1d5db') + ';margin-left:4px;">★</span>';
            }
            input = '<div class="star-rating" id="' + id + '" data-key="' + qKey + '">' + stars +
                '<input type="hidden" id="' + id + '_val" data-key="' + qKey + '" value="' + esc(existingVal) + '"></div>';
            break;
        }

        case 'file':
        case 'file_upload':
            if (isView) {
                input = existingVal ? '<a href="' + esc(existingVal) + '" target="_blank" class="btn btn-outline-primary btn-sm"><i class="bi bi-download"></i> تحميل الملف</a>' : '<span class="text-muted">لا يوجد ملف</span>';
            } else {
                input = '<input type="file" class="form-control" id="' + id + '" data-key="' + qKey + '">';
            }
            break;

        case 'table': {
            var tRows = q.tableRows || ['صف 1'];
            var tCols = q.tableCols || ['عمود 1'];
            var existTable = {};
            try { if (existingVal) existTable = JSON.parse(existingVal); } catch(e) {}
            input = '<div class="table-responsive"><table class="table table-bordered" id="' + id + '" data-key="' + qKey + '" data-type="table"><thead><tr><th></th>';
            tCols.forEach(function(c) { input += '<th style="font-weight:600;font-size:13px;">' + esc(c) + '</th>'; });
            input += '</tr></thead><tbody>';
            tRows.forEach(function(r, ri) {
                input += '<tr><td style="font-weight:600;font-size:13px;">' + esc(r) + '</td>';
                tCols.forEach(function(c, ci) {
                    var cellVal = (existTable[ri + '_' + ci]) || '';
                    input += '<td><input type="text" class="form-control form-control-sm table-cell-input" data-row="' + ri + '" data-col="' + ci + '" value="' + esc(cellVal) + '" ' + disabled + '></td>';
                });
                input += '</tr>';
            });
            input += '</tbody></table></div>';
            break;
        }

        case 'multiple_choice_grid': {
            var gRows = q.gridRows || ['صف 1'];
            var gCols = q.gridCols || ['عمود 1'];
            var existGrid = {};
            try { if (existingVal) existGrid = JSON.parse(existingVal); } catch(e) {}
            input = '<div class="table-responsive"><table class="table table-bordered" id="' + id + '" data-key="' + qKey + '" data-type="mc_grid"><thead><tr><th></th>';
            gCols.forEach(function(c) { input += '<th style="font-weight:600;font-size:13px;text-align:center;">' + esc(c) + '</th>'; });
            input += '</tr></thead><tbody>';
            gRows.forEach(function(r, ri) {
                input += '<tr><td style="font-weight:600;font-size:13px;">' + esc(r) + '</td>';
                gCols.forEach(function(c, ci) {
                    var checked = (existGrid['row_' + ri] === c) ? 'checked' : '';
                    input += '<td style="text-align:center;"><input type="radio" name="' + id + '_row_' + ri + '" data-row="' + ri + '" value="' + esc(c) + '" ' + checked + ' ' + disabled + '></td>';
                });
                input += '</tr>';
            });
            input += '</tbody></table></div>';
            break;
        }

        case 'checkbox_grid': {
            var gRows2 = q.gridRows || ['صف 1'];
            var gCols2 = q.gridCols || ['عمود 1'];
            var existGrid2 = {};
            try { if (existingVal) existGrid2 = JSON.parse(existingVal); } catch(e) {}
            input = '<div class="table-responsive"><table class="table table-bordered" id="' + id + '" data-key="' + qKey + '" data-type="cb_grid"><thead><tr><th></th>';
            gCols2.forEach(function(c) { input += '<th style="font-weight:600;font-size:13px;text-align:center;">' + esc(c) + '</th>'; });
            input += '</tr></thead><tbody>';
            gRows2.forEach(function(r, ri) {
                input += '<tr><td style="font-weight:600;font-size:13px;">' + esc(r) + '</td>';
                gCols2.forEach(function(c, ci) {
                    var arr = existGrid2['row_' + ri] || [];
                    var checked = (Array.isArray(arr) && arr.indexOf(c) >= 0) ? 'checked' : '';
                    input += '<td style="text-align:center;"><input type="checkbox" data-row="' + ri + '" data-col="' + ci + '" value="' + esc(c) + '" ' + checked + ' ' + disabled + '></td>';
                });
                input += '</tr>';
            });
            input += '</tbody></table></div>';
            break;
        }

        default:
            input = '<input type="text" class="form-control" id="' + id + '" data-key="' + qKey + '" value="' + esc(existingVal) + '" ' + disabled + '>';
    }

    return '<div class="mb-4" data-question-id="' + qKey + '">' +
        '<div class="d-flex align-items-center gap-2 mb-2">' +
            '<span class="question-number" style="width:28px;height:28px;border-radius:50%;background:var(--sa-100);color:var(--sa-700);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">' + qNum + '</span>' +
            '<label class="form-label mb-0" style="font-weight:600;">' + required + label + '</label></div>' +
        (q.description ? '<p style="font-size:13px;color:var(--gray-500);margin-bottom:8px;">' + esc(q.description) + '</p>' : '') +
        input + '</div>';
}

function setRating(id, val) {
    var stars = document.querySelectorAll('#' + id + ' .star');
    stars.forEach(function(s, i) {
        s.classList.toggle('active', i < val);
        s.style.color = i < val ? '#f59e0b' : '#d1d5db';
    });
    var hidden = document.getElementById(id + '_val');
    if (hidden) hidden.value = val;
}

function toggleOtherInput(baseId, mode) {
    var otherInput = document.getElementById(baseId + '_other');
    if (!otherInput) return;
    var show = false;
    if (mode === 'radio') {
        show = !!document.getElementById(baseId + '_other_radio')?.checked;
    } else if (mode === 'checkbox') {
        show = !!document.getElementById(baseId + '_other_cb')?.checked;
    } else if (mode === 'dropdown') {
        var sel = document.getElementById(baseId);
        show = !!sel && sel.value === '__other__';
    }
    otherInput.style.display = show ? '' : 'none';
    if (!show) otherInput.value = '';
}

async function submitForm() {
    var receivedId = typeof RECEIVED_FORM_ID !== 'undefined' ? RECEIVED_FORM_ID : null;
    var formId = typeof FORM_ID !== 'undefined' ? FORM_ID : null;
    var collectedAnswers = [];
    var sections = tryParse(formData.sectionsJson) || [];
    var validationFailed = false;

    sections.forEach(function(sec, si) {
        (sec.questions || []).forEach(function(q, qi) {
            if (validationFailed) return;
            var qKey = q.id || (si + '_' + qi);
            var id = 'q_' + si + '_' + qi;
            var type = q.type || 'text';
            var answer = '';

            if (type === 'radio' || type === 'multiple_choice') {
                var checked = document.querySelector('input[name="' + id + '"]:checked');
                answer = checked ? checked.value : '';
                if (answer === '__other__') {
                    var otherText = document.getElementById(id + '_other')?.value?.trim() || '';
                    answer = otherText;
                }
            } else if (type === 'checkbox' || type === 'checkboxes') {
                var allChecked = document.querySelectorAll('input[data-key="' + qKey + '"]:checked');
                var vals = Array.from(allChecked).map(function(c) { return c.value; });
                if (vals.indexOf('__other__') >= 0) {
                    vals = vals.filter(function(v) { return v !== '__other__'; });
                    var otherText2 = document.getElementById(id + '_other')?.value?.trim() || '';
                    if (otherText2) vals.push(otherText2);
                }
                answer = vals.join('، ');
            } else if (type === 'select' || type === 'dropdown') {
                var sel2 = document.getElementById(id);
                answer = sel2 ? sel2.value : '';
                if (answer === '__other__') {
                    answer = document.getElementById(id + '_other')?.value?.trim() || '';
                }
            } else if (type === 'rating') {
                var hidden = document.getElementById(id + '_val');
                answer = hidden ? hidden.value : '';
            } else if (type === 'table') {
                var tbl = document.getElementById(id);
                if (tbl) {
                    var cellData = {};
                    tbl.querySelectorAll('.table-cell-input').forEach(function(inp) {
                        cellData[inp.dataset.row + '_' + inp.dataset.col] = inp.value;
                    });
                    answer = JSON.stringify(cellData);
                }
            } else if (type === 'multiple_choice_grid') {
                var gridTbl = document.getElementById(id);
                if (gridTbl) {
                    var gridData = {};
                    var rows = q.gridRows || [];
                    rows.forEach(function(r, ri) {
                        var sel = gridTbl.querySelector('input[name="' + id + '_row_' + ri + '"]:checked');
                        if (sel) gridData['row_' + ri] = sel.value;
                    });
                    answer = JSON.stringify(gridData);
                }
            } else if (type === 'checkbox_grid') {
                var gridTbl2 = document.getElementById(id);
                if (gridTbl2) {
                    var gridData2 = {};
                    var rows2 = q.gridRows || [];
                    rows2.forEach(function(r, ri) {
                        var checks = gridTbl2.querySelectorAll('input[data-row="' + ri + '"]:checked');
                        gridData2['row_' + ri] = Array.from(checks).map(function(c) { return c.value; });
                    });
                    answer = JSON.stringify(gridData2);
                }
            } else {
                var el = document.getElementById(id);
                answer = el ? el.value : '';
            }

            if (q.required && !answer) {
                showToast('يرجى الإجابة على السؤال: ' + (q.label || q.text), 'danger');
                validationFailed = true;
                return;
            }

            collectedAnswers.push({
                questionId: qKey,
                label: q.label || q.text || '',
                question: q.label || q.text || '',
                type: type,
                answer: answer
            });
        });
    });

    if (validationFailed) return;

    try {
        var payload = {
            receivedFormId: receivedId,
            formId: formId,
            answersJson: JSON.stringify(collectedAnswers)
        };
        var r = await apiFetch('/FormFill/Submit', 'POST', payload);
        if (r && r.success) {
            showToast('تم إرسال النموذج بنجاح!');
            setTimeout(function() { window.location.href = '/Inbox/Index'; }, 1500);
        } else {
            showToast(r?.message || 'حدث خطأ', 'danger');
        }
    } catch(e) {
        showToast('حدث خطأ أثناء الإرسال', 'danger');
    }
}

function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
function tryParse(s) { try { return JSON.parse(s); } catch(e) { return null; } }

document.addEventListener('DOMContentLoaded', initFormFill);
