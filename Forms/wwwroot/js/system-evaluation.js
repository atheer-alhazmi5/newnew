'use strict';

var seDetailChart = null;
var seOverallChart = null;
var seIsAdmin = false;
var seCanSubmit = true;
var seEvaluateModal = null;
var seForm = { overall: '', ease: '', design: '', performance: '', support: '' };

var sePickedLabelMap = { ease: 'sePickedEase', design: 'sePickedDesign', performance: 'sePickedPerformance', support: 'sePickedSupport' };

function seEsc(s) {
    if (s == null) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function seRatingBadge(val) {
    var v = (val || '').trim();
    if (v === 'منخفض جدا') v = 'منخفض جداً';
    var cls = 'se-rating-average';
    if (v === 'ممتاز') cls = 'se-rating-excellent';
    else if (v === 'جيد') cls = 'se-rating-good';
    else if (v === 'متوسط') cls = 'se-rating-average';
    else if (v === 'منخفض') cls = 'se-rating-low';
    else if (v === 'منخفض جداً') cls = 'se-rating-verylow';
    return '<span class="se-rating-pill ' + cls + '">' + seEsc(v || '—') + '</span>';
}

var seLevelColors = {
    'ممتاز': '#047857',
    'جيد': '#10b981',
    'متوسط': '#d97706',
    'منخفض': '#ea580c',
    'منخفض جداً': '#dc2626'
};

function seUpdateSubmitUi() {
    var btn = document.getElementById('seBtnEvaluate');
    var msg = document.getElementById('seAlreadyMsg');
    if (btn) {
        btn.disabled = !seCanSubmit;
        btn.style.opacity = seCanSubmit ? '1' : '0.55';
        btn.style.cursor = seCanSubmit ? 'pointer' : 'not-allowed';
    }
    if (msg) msg.classList.toggle('show', !seCanSubmit);
}

function seOpenEvaluateModal() {
    if (!seCanSubmit) {
        if (typeof showToast === 'function') showToast('تم إرسال تقييمك مسبقًا', 'info');
        return;
    }
    seResetFeedbackForm();
    var el = document.getElementById('seEvaluateModal');
    if (!el) return;
    if (!seEvaluateModal && typeof bootstrap !== 'undefined') seEvaluateModal = new bootstrap.Modal(el);
    if (seEvaluateModal) seEvaluateModal.show();
}

function sePickOverall(btn) {
    if (!btn) return;
    var level = btn.getAttribute('data-level') || '';
    seForm.overall = level;
    document.querySelectorAll('#seOverallPills .se-choice-pill').forEach(function (p) {
        p.classList.toggle('is-selected', p === btn);
    });
    var hint = document.getElementById('seOverallHint');
    if (hint) hint.textContent = 'اختيارك: ' + level;
}

function sePickDim(btn) {
    if (!btn) return;
    var field = btn.getAttribute('data-field') || '';
    var level = btn.getAttribute('data-level') || '';
    if (!field) return;
    seForm[field] = level;
    var block = btn.closest('.se-detail-block');
    if (block) {
        block.querySelectorAll('.se-dim-btn').forEach(function (b) {
            b.classList.toggle('is-selected', b === btn);
        });
    }
    var pickedId = sePickedLabelMap[field];
    var pickedEl = pickedId ? document.getElementById(pickedId) : null;
    if (pickedEl) {
        pickedEl.textContent = level;
        pickedEl.classList.remove('is-empty');
    }
}

function seGetFormValues() {
    return {
        overallRating: seForm.overall || '',
        easeOfUse: seForm.ease || '',
        design: seForm.design || '',
        performance: seForm.performance || '',
        technicalSupport: seForm.support || '',
        notes: document.getElementById('seFbNotes')?.value || ''
    };
}

function seResetFeedbackForm() {
    seForm = { overall: '', ease: '', design: '', performance: '', support: '' };
    document.querySelectorAll('.se-choice-pill.is-selected').forEach(function (p) { p.classList.remove('is-selected'); });
    document.querySelectorAll('.se-dim-btn.is-selected').forEach(function (b) { b.classList.remove('is-selected'); });
    Object.keys(sePickedLabelMap).forEach(function (k) {
        var el = document.getElementById(sePickedLabelMap[k]);
        if (el) { el.textContent = '—'; el.classList.add('is-empty'); }
    });
    var hint = document.getElementById('seOverallHint');
    if (hint) hint.textContent = 'اختر مستوى رضاك العام عن النظام';
    var notes = document.getElementById('seFbNotes');
    if (notes) notes.value = '';
}

async function seSubmitFeedback() {
    if (!seCanSubmit) return;
    var btn = document.getElementById('seFbSubmitBtn');
    if (btn) btn.disabled = true;

    var payload = seGetFormValues();

    var r = await apiFetch('/SystemEvaluation/Submit', 'POST', payload);
    if (btn) btn.disabled = false;

    if (!r || !r.success) {
        if (typeof showToast === 'function') showToast(r?.message || 'تعذّر إرسال التقييم', 'warning');
        return;
    }

    if (typeof showToast === 'function') showToast(r.message || 'تم إرسال التقييم بنجاح', 'success');
    seCanSubmit = false;
    seUpdateSubmitUi();
    seResetFeedbackForm();
    if (seEvaluateModal) seEvaluateModal.hide();
    await seLoad();
}

function seDestroyCharts() {
    if (seDetailChart) { seDetailChart.destroy(); seDetailChart = null; }
    if (seOverallChart) { seOverallChart.destroy(); seOverallChart = null; }
}

function seRenderDetailChart(payload) {
    var canvas = document.getElementById('seDetailChart');
    if (!canvas || typeof Chart === 'undefined') return;
    var levels = payload.ratingLevels || [];
    var stats = payload.detailStats || [];
    var labels = stats.map(function (s) { return s.dimension; });

    var datasets = levels.map(function (level) {
        return {
            label: level,
            data: stats.map(function (s) { return (s.counts && s.counts[level]) ? s.counts[level] : 0; }),
            backgroundColor: seLevelColors[level] || '#9ca3af',
            borderRadius: 6,
            maxBarThickness: 36
        };
    });

    seDetailChart = new Chart(canvas, {
        type: 'bar',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Cairo', size: 12 }, padding: 14 }
                }
            },
            scales: {
                x: {
                    ticks: { font: { family: 'Cairo', size: 12 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, font: { family: 'Cairo', size: 12 } },
                    grid: { color: 'rgba(0,0,0,0.06)' }
                }
            }
        }
    });
}

function seRenderOverallChart(payload) {
    var canvas = document.getElementById('seOverallChart');
    if (!canvas || typeof Chart === 'undefined') return;
    var levels = payload.ratingLevels || [];
    var counts = payload.overallCounts || {};
    var percents = payload.overallPercents || {};
    var data = levels.map(function (l) { return counts[l] || 0; });
    var colors = levels.map(function (l) { return seLevelColors[l] || '#9ca3af'; });

    seOverallChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: levels,
            datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Cairo', size: 12 }, padding: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            var level = levels[ctx.dataIndex];
                            var pct = percents[level] != null ? percents[level] : 0;
                            return level + ': ' + ctx.raw + ' (' + pct + '%)';
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'sePieLabels',
            afterDatasetsDraw: function (chart) {
                var ctx = chart.ctx;
                var meta = chart.getDatasetMeta(0);
                var total = payload.totalCount || 0;
                if (!total) return;
                meta.data.forEach(function (arc, i) {
                    var pct = percents[levels[i]] != null ? percents[levels[i]] : 0;
                    if (!pct) return;
                    var pos = arc.tooltipPosition();
                    ctx.save();
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 12px Cairo, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(pct + '%', pos.x, pos.y);
                    ctx.restore();
                });
            }
        }]
    });
}

function seRenderTable(rows) {
    var body = document.getElementById('seBody');
    if (!body) return;
    var colSpan = seIsAdmin ? 11 : 10;

    if (!rows || !rows.length) {
        body.innerHTML = '<tr><td colspan="' + colSpan + '"><div class="se-empty"><i class="bi bi-inbox" style="font-size:40px;color:var(--gray-300);display:block;margin-bottom:8px;"></i><p>لا توجد تقييمات بعد</p></div></td></tr>';
        return;
    }

    body.innerHTML = rows.map(function (r, i) {
        var html = ''
            + '<tr>'
            + '<td>' + (i + 1) + '</td>'
            + '<td style="font-weight:700;">' + seEsc(r.submitterName || '—') + '</td>'
            + '<td>' + seEsc(r.organizationalUnitName || '—') + '</td>'
            + '<td style="direction:ltr;">' + seEsc(r.createdAt || '—') + '</td>'
            + '<td>' + seRatingBadge(r.overallRating) + '</td>'
            + '<td>' + seRatingBadge(r.easeOfUse) + '</td>'
            + '<td>' + seRatingBadge(r.design) + '</td>'
            + '<td>' + seRatingBadge(r.performance) + '</td>'
            + '<td>' + seRatingBadge(r.technicalSupport) + '</td>'
            + '<td class="se-notes-cell">' + seEsc(r.notes || '—') + '</td>';

        if (seIsAdmin) {
            var pubCls = r.isPublished ? 'se-publish-on' : 'se-publish-off';
            var pubLbl = r.isPublished ? 'منشور' : 'غير منشور';
            var pubIcon = r.isPublished ? 'bi-eye-fill' : 'bi-eye-slash';
            html += '<td><button type="button" class="se-publish-btn ' + pubCls + '" onclick="seTogglePublish(' + r.id + ')"><i class="bi ' + pubIcon + '"></i> ' + pubLbl + '</button></td>';
        }
        html += '</tr>';
        return html;
    }).join('');
}

async function seLoad() {
    var body = document.getElementById('seBody');
    var colSpan = seIsAdmin ? 11 : 10;
    if (body) body.innerHTML = '<tr><td colspan="' + colSpan + '" class="text-center py-4"><div class="spinner-border" style="color:var(--sa-600);"></div></td></tr>';

    var r = await apiFetch('/SystemEvaluation/GetEvaluations');
    if (!r || !r.success) {
        if (body) body.innerHTML = '<tr><td colspan="' + colSpan + '"><div class="se-empty">تعذّر تحميل البيانات</div></td></tr>';
        return;
    }

    seCanSubmit = r.canSubmit !== false;
    seUpdateSubmitUi();

    seDestroyCharts();
    seRenderDetailChart(r);
    seRenderOverallChart(r);
    seRenderTable(r.data || []);
}

async function seTogglePublish(id) {
    if (!seIsAdmin) return;
    var r = await apiFetch('/SystemEvaluation/TogglePublish', 'POST', { id: id });
    if (!r || !r.success) {
        if (typeof showToast === 'function') showToast(r?.message || 'تعذّر تحديث حالة النشر', 'error');
        return;
    }
    if (typeof showToast === 'function') showToast(r.isPublished ? 'تم نشر التقييم' : 'تم إلغاء نشر التقييم', 'success');
    await seLoad();
}

function seInit() {
    seIsAdmin = !!window.seIsAdmin;
    seLoad();
}

window.seInit = seInit;
window.seOpenEvaluateModal = seOpenEvaluateModal;
window.sePickOverall = sePickOverall;
window.sePickDim = sePickDim;
window.seSubmitFeedback = seSubmitFeedback;
window.seTogglePublish = seTogglePublish;
window.seLoad = seLoad;
