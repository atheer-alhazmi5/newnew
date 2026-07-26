'use strict';
/**
 * مساعدات المرفقات المشتركة في صندوق الصادر — الرفع، تنسيق الحجم، الأيقونات، والمعاينة.
 * تُستخدم في صفحة «تقديم طلب جديد» (حقول رفع الملف) وصفحة «تفاصيل الطلب»
 * (مرفقات التعليقات وتبويب الوثائق المرفقة).
 */

/** يرفع ملفاً واحداً إلى مساحة صندوق الصادر ويعيد بياناته المخزّنة. */
async function obaUploadFile(file) {
    if (!file) return { success: false, message: 'لم يتم اختيار ملف' };
    var form = new FormData();
    form.append('file', file);
    try {
        var res = await fetch(appResolveUrl('/Outbox/UploadRequestAttachment'), {
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': getCsrfToken() },
            body: form
        });
        if (res.redirected) { window.location.href = res.url; return { success: false }; }
        return await res.json();
    } catch (e) {
        console.error('obaUploadFile error:', e);
        return { success: false, message: 'تعذّر رفع الملف' };
    }
}

function obaFmtFileSize(bytes) {
    var n = parseInt(bytes, 10) || 0;
    if (n <= 0) return '';
    if (n < 1024) return n + ' بايت';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' كيلوبايت';
    return (n / (1024 * 1024)).toFixed(1) + ' ميغابايت';
}

function obaFileExt(name) {
    var v = String(name || '').trim();
    var i = v.lastIndexOf('.');
    return i >= 0 ? v.slice(i + 1).toLowerCase() : '';
}

/** أيقونة Bootstrap مناسبة لامتداد الملف. */
function obaFileIcon(name) {
    var ext = obaFileExt(name);
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].indexOf(ext) >= 0) return 'bi-file-earmark-image';
    if (ext === 'pdf') return 'bi-file-earmark-pdf';
    if (['doc', 'docx'].indexOf(ext) >= 0) return 'bi-file-earmark-word';
    if (['xls', 'xlsx', 'csv'].indexOf(ext) >= 0) return 'bi-file-earmark-excel';
    if (['ppt', 'pptx'].indexOf(ext) >= 0) return 'bi-file-earmark-slides';
    if (['zip', 'rar'].indexOf(ext) >= 0) return 'bi-file-earmark-zip';
    if (ext === 'txt') return 'bi-file-earmark-text';
    return 'bi-file-earmark';
}

/** الملفات القابلة للفتح مباشرة في المتصفح (معاينة). */
function obaIsPreviewable(name) {
    var ext = obaFileExt(name);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pdf', 'txt'].indexOf(ext) >= 0;
}

function obaOpenPreview(url) {
    if (!url) return;
    window.open(appResolveUrl(url), '_blank', 'noopener');
}

window.obaUploadFile = obaUploadFile;
window.obaFmtFileSize = obaFmtFileSize;
window.obaFileIcon = obaFileIcon;
window.obaIsPreviewable = obaIsPreviewable;
window.obaOpenPreview = obaOpenPreview;
