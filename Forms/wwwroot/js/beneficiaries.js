var bnfAll = [];
var bnfUnits = [];
var bnfSignCtx = {};

document.addEventListener('DOMContentLoaded', function () {
    bnfLoad();
    // الصورة الشخصية - صورة واحدة
    document.getElementById('bnfPhoto').addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (f) {
            var r = new FileReader();
            r.onload = function () {
                document.getElementById('bnfPhotoPreview').src = r.result;
                document.getElementById('bnfPhotoPreview').style.display = 'block';
                document.getElementById('bnfPhotoPlaceholder').style.display = 'none';
                document.getElementById('bnfPhoto').dataset.base64 = r.result;
            };
            r.readAsDataURL(f);
        } else {
            document.getElementById('bnfPhotoPreview').style.display = 'none';
            document.getElementById('bnfPhotoPlaceholder').style.display = 'flex';
            document.getElementById('bnfPhoto').dataset.base64 = '';
        }
    });

    // تبديل التأشير: مرفق | قلم
    document.getElementById('bnfEndorsementType').addEventListener('change', bnfToggleEndorsement);
    document.getElementById('bnfSignatureType').addEventListener('change', bnfToggleSignature);

    // رفع ملف التأشير
    document.getElementById('bnfEndorsementFile').addEventListener('change', function (e) {
        bnfHandleFileUpload(e, 'bnfEndorsementFile', 'bnfEndorsementPreview', 'bnfEndorsement');
    });
    document.getElementById('bnfSignatureFile').addEventListener('change', function (e) {
        bnfHandleFileUpload(e, 'bnfSignatureFile', 'bnfSignaturePreview', 'bnfSignature');
    });

    // التفعيل - تحديث النص
    document.getElementById('bnfIsActive').addEventListener('change', function () {
        document.getElementById('bnfActivationStatus').textContent = this.checked ? 'مفعل' : 'معطل';
    });

    // تهيئة لوحات التوقيع
    bnfInitSignatureCanvas('bnfEndorsementCanvas');
    bnfInitSignatureCanvas('bnfSignatureCanvas');
    bnfToggleEndorsement();
    bnfToggleSignature();
});

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
            bnfRenderTable();
            bnfFillUnitDropdown();
        } else {
            document.getElementById('bnfBody').innerHTML =
                '<tr><td colspan="5">' + emptyState('bi-people-fill', 'لا يوجد مستفيدين', 'أضف مستفيدين للبدء') + '</td></tr>';
        }
    } catch (e) {
        document.getElementById('bnfBody').innerHTML =
            '<tr><td colspan="5" class="text-center py-4 text-danger">خطأ في تحميل البيانات</td></tr>';
    }
}

function bnfFillUnitDropdown() {
    var html = '<option value="">-- اختر --</option>';
    bnfUnits.forEach(function (u) {
        html += '<option value="' + u.id + '">' + esc(u.name) + '</option>';
    });
    document.getElementById('bnfOrganizationalUnitId').innerHTML = html;
}

function bnfRenderTable() {
    var body = document.getElementById('bnfBody');
    if (bnfAll.length === 0) {
        body.innerHTML = '<tr><td colspan="5">' +
            emptyState('bi-people-fill', 'لا يوجد مستفيدين', 'اضغط إضافة لإدخال مستفيد جديد') + '</td></tr>';
        return;
    }
    var html = '';
    bnfAll.forEach(function (b, idx) {
        var safeName = esc(b.fullName).replace(/'/g, "\\'");
        html += '<tr>' +
            '<td style="text-align:center;font-weight:800;">' + (idx + 1) + '</td>' +
            '<td style="font-weight:700;">' + esc(b.fullName) + '</td>' +
            '<td>' + esc(b.nationalId) + '</td>' +
            '<td>' + esc(b.roleDisplay) + '</td>' +
            '<td>' +
                '<div style="display:flex;gap:6px;align-items:center;justify-content:center;">' +
                    '<button class="bnf-action-btn bnf-action-btn-detail" onclick="bnfShowDetails(' + b.id + ')"><i class="bi bi-eye"></i> تفاصيل</button>' +
                    '<button class="bnf-action-btn bnf-action-btn-edit" onclick="bnfShowEditModal(' + b.id + ')"><i class="bi bi-pencil"></i> تحديث</button>' +
                    '<button class="bnf-action-btn bnf-action-btn-delete" onclick="bnfShowDeleteModal(' + b.id + ',\'' + safeName + '\')"><i class="bi bi-trash3"></i> حذف</button>' +
                '</div>' +
            '</td>' +
            '</tr>';
    });
    body.innerHTML = html;
}

function bnfValidate(isAdd) {
    var nid = (document.getElementById('bnfNationalId').value || '').trim();
    if (!nid) return 'الهوية الوطنية مطلوبة';
    if (nid.length !== 10 || !/^\d+$/.test(nid))
        return 'الهوية الوطنية يجب أن تتكون من 10 أرقام وتبدأ بـ 10 أو 11';
    if (!nid.startsWith('10') && !nid.startsWith('11'))
        return 'الهوية الوطنية يجب أن تتكون من 10 أرقام وتبدأ بـ 10 أو 11';

    var phone = (document.getElementById('bnfPhone').value || '').trim();
    if (!phone) return 'رقم الجوال مطلوب';
    if (!phone.startsWith('05'))
        return 'رقم الجوال يجب أن يبدأ بـ 05';
    if (phone.length < 10 || !/^\d+$/.test(phone))
        return 'رقم الجوال يجب أن يبدأ بـ 05';

    var email = (document.getElementById('bnfEmail').value || '').trim();
    if (!email) return 'البريد الإلكتروني مطلوب';
    if (!/^[^\s@]+@gov\.sa$/i.test(email))
        return 'يجب إدخال بريد إلكتروني رسمي بصيغة xxxxx@gov.sa';

    var mainRole = document.querySelector('input[name="bnfMainRole"]:checked');
    mainRole = mainRole ? mainRole.value : '';
    if (!mainRole || (mainRole !== 'موظف' && mainRole !== 'مدير'))
        return 'الدور الرئيسي يجب أن يكون موظف أو مدير';

    if (!document.getElementById('bnfFirstName').value.trim()) return 'الاسم الأول مطلوب';
    if (!document.getElementById('bnfSecondName').value.trim()) return 'الاسم الثاني مطلوب';
    if (!document.getElementById('bnfThirdName').value.trim()) return 'الاسم الثالث مطلوب';
    if (!document.getElementById('bnfFourthName').value.trim()) return 'الاسم الرابع مطلوب';
    if (!parseInt(document.getElementById('bnfOrganizationalUnitId').value))
        return 'الوحدة التنظيمية مطلوبة';

    // التأشير
    var endorsementType = document.getElementById('bnfEndorsementType').value;
    if (endorsementType === 'مرفق') {
        var endorsementFile = document.getElementById('bnfEndorsementFile').dataset.base64 || '';
        if (!endorsementFile) return 'يجب رفع ملف التأشير (صورة أو PDF)';
    } else {
        if (bnfIsCanvasEmpty('bnfEndorsementCanvas'))
            return 'يجب التوقيع في مربع التأشير الإلكتروني';
    }

    // التوقيع
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
    if (pwd && pwd !== confirm)
        return 'كلمة المرور وتأكيد كلمة المرور غير متطابقتين';
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
    document.getElementById('bnfOrganizationalUnitId').value = '';
    document.getElementById('bnfPhone').value = '';
    document.getElementById('bnfEmail').value = '';
    document.getElementById('bnfIsActive').checked = true;
    document.getElementById('bnfActivationStatus').textContent = 'مفعل';
    var mainRoleRadios = document.querySelectorAll('input[name="bnfMainRole"]');
    mainRoleRadios.forEach(function (r) { r.checked = (r.value === 'موظف'); });
    var subRoleRadios = document.querySelectorAll('input[name="bnfSubRole"]');
    subRoleRadios.forEach(function (r) { r.checked = (r.value === ''); });
    document.getElementById('bnfPassword').value = '';
    document.getElementById('bnfConfirmPassword').value = '';
    document.getElementById('bnfPasswordWrap').style.display = '';
    document.getElementById('bnfConfirmWrap').style.display = '';
    document.getElementById('bnfPhotoPreview').style.display = 'none';
    document.getElementById('bnfPhotoPlaceholder').style.display = 'flex';
    document.getElementById('bnfPhoto').value = '';
    document.getElementById('bnfPhoto').dataset.base64 = '';
    document.getElementById('bnfEndorsementFile').value = '';
    document.getElementById('bnfEndorsementFile').dataset.base64 = '';
    document.getElementById('bnfSignatureFile').value = '';
    document.getElementById('bnfSignatureFile').dataset.base64 = '';
    document.getElementById('bnfError').classList.add('d-none');
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
    document.getElementById('bnfOrganizationalUnitId').value = b.organizationalUnitId || '';
    document.getElementById('bnfPhone').value = b.phone || '';
    document.getElementById('bnfEmail').value = b.email || '';
    document.getElementById('bnfIsActive').checked = b.isActive !== false;
    document.getElementById('bnfActivationStatus').textContent = b.isActive !== false ? 'مفعل' : 'معطل';
    var mainRole = b.mainRole || 'موظف';
    document.querySelectorAll('input[name="bnfMainRole"]').forEach(function (r) { r.checked = (r.value === mainRole); });
    var subRole = b.subRole || '';
    document.querySelectorAll('input[name="bnfSubRole"]').forEach(function (r) { r.checked = (r.value === subRole); });
    document.getElementById('bnfPassword').value = '';
    document.getElementById('bnfConfirmPassword').value = '';
    document.getElementById('bnfPasswordWrap').style.display = '';
    document.getElementById('bnfConfirmWrap').style.display = '';
    document.getElementById('bnfError').classList.add('d-none');

    if (b.photoUrl) {
        document.getElementById('bnfPhotoPreview').src = b.photoUrl;
        document.getElementById('bnfPhotoPreview').style.display = 'block';
        document.getElementById('bnfPhotoPlaceholder').style.display = 'none';
        document.getElementById('bnfPhoto').dataset.base64 = b.photoUrl;
    } else {
        document.getElementById('bnfPhotoPreview').style.display = 'none';
        document.getElementById('bnfPhotoPlaceholder').style.display = 'flex';
        document.getElementById('bnfPhoto').dataset.base64 = '';
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

    var photoData = document.getElementById('bnfPhoto').dataset.base64 || '';
    var body = {
        photoUrl: photoData || undefined,
        nationalId: document.getElementById('bnfNationalId').value.trim(),
        endorsementType: document.getElementById('bnfEndorsementType').value,
        endorsementFile: bnfGetEndorsementData(),
        signatureType: document.getElementById('bnfSignatureType').value,
        signatureFile: bnfGetSignatureData(),
        firstName: document.getElementById('bnfFirstName').value.trim(),
        secondName: document.getElementById('bnfSecondName').value.trim(),
        thirdName: document.getElementById('bnfThirdName').value.trim(),
        fourthName: document.getElementById('bnfFourthName').value.trim(),
        organizationalUnitId: parseInt(document.getElementById('bnfOrganizationalUnitId').value),
        phone: document.getElementById('bnfPhone').value.trim(),
        email: document.getElementById('bnfEmail').value.trim(),
        isActive: document.getElementById('bnfIsActive').checked,
        mainRole: (document.querySelector('input[name="bnfMainRole"]:checked') || {}).value || '',
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
        '<div class="bnf-section"><div class="bnf-section-title"><i class="bi bi-person-badge"></i>الأدوار</div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الدور الرئيسي:</strong></div><div class="col-md-10">' + esc(b.mainRole) + '</div></div>' +
        '<div class="row mb-3"><div class="col-md-2"><strong>الدور:</strong></div><div class="col-md-10">' + (b.subRole ? esc(b.subRole) : '—') + '</div></div></div>';

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
