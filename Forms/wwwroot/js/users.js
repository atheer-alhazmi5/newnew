/* users.js */
const ITEMS_PER_PAGE = 5;
const CURRENT_USER_ID = Number(window.__currentUserId || 0);
let allUsers = [];
let currentPage = 1;
let departments = [];
let selectedEditRole = '';
let currentEditUserId = 0;
let newUserPhotoData = '';

async function loadUsers() {
    const role = document.getElementById('roleFilter')?.value || '';
    const dept = document.getElementById('deptFilter')?.value || '';
    const r = await apiFetch(`/Users/GetUsers?deptId=${dept}&role=${role}`);
    if (!r?.success) return;
    allUsers = r.data || [];
    currentPage = 1;
    renderTable();
}

async function loadDepts() {
    const r = await apiFetch('/Users/GetDepartments');
    if (!r?.success) return;
    departments = r.data || [];

    const deptFilter = document.getElementById('deptFilter');
    if (deptFilter) {
        deptFilter.innerHTML = '<option value="">جميع الأقسام</option>';
        departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            deptFilter.appendChild(opt);
        });
    }

    const newDept = document.getElementById('newDept');
    if (newDept) {
        newDept.innerHTML = '';
        departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            newDept.appendChild(opt);
        });
    }

    const editDept = document.getElementById('editDept');
    if (editDept) {
        editDept.innerHTML = '';
        departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            editDept.appendChild(opt);
        });
    }
}

function renderTable() {
    const body = document.getElementById('usersBody');
    if (!body) return;

    if (allUsers.length === 0) {
        body.innerHTML = `<tr><td colspan="6">${emptyState('bi-people', 'لا يوجد مستخدمون', '')}</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const page = allUsers.slice(start, start + ITEMS_PER_PAGE);

    body.innerHTML = page.map(u => {
        const isActive = String(u.status || '').toLowerCase() === 'active' || String(u.statusLabel || '') === 'نشط';
        const isSelf = Number(u.id) === CURRENT_USER_ID;
        const actions = isSelf
            ? '<span style="color:var(--gray-400);font-weight:700;">-</span>'
            : `<div class="d-flex gap-2">
                    <button class="action-btn action-btn-edit" onclick="showEditUserModal(${u.id})">
                        <i class="bi bi-pencil"></i> تعديل
                    </button>
                    <button class="action-btn ${isActive ? 'action-btn-stop' : 'action-btn-activate'}"
                            onclick="toggleStatus(${u.id})">
                        ${isActive ? 'إيقاف' : 'تفعيل'}
                    </button>
               </div>`;

        return `
        <tr>
            <td>
                <div class="d-flex align-items-center gap-2">
                    <div class="user-avatar">${u.fullName?.[0] || '?'}</div>
                    <span style="font-weight:600">${esc(u.fullName)}</span>
                </div>
            </td>
            <td style="font-size:13px;color:var(--gray-600);">${esc(u.email || u.username)}</td>
            <td style="font-size:13px;">${esc(u.deptName || '')}</td>
            <td><span class="badge bg-primary-subtle text-primary">${esc(u.roleLabel)}</span></td>
            <td>
                <span class="status-pill ${isActive ? 'active' : 'inactive'}">
                    ${u.statusLabel} <span class="status-dot"></span>
                </span>
            </td>
            <td>${actions}</td>
        </tr>`;
    }).join('');

    renderPagination(
        document.getElementById('paginationContainer'),
        allUsers.length, currentPage, ITEMS_PER_PAGE,
        'changePage'
    );
}

function changePage(p) {
    currentPage = p;
    renderTable();
}

async function toggleStatus(userId) {
    const r = await apiFetch(`/Users/ToggleStatus?userId=${userId}`, 'POST');
    if (r?.success) {
        showToast('تم تغيير حالة المستخدم');
        loadUsers();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
}

function showEditUserModal(userId) {
    const u = allUsers.find(x => Number(x.id) === Number(userId));
    if (!u) return;

    currentEditUserId = Number(userId);
    selectedEditRole = u.role || 'Staff';

    document.getElementById('editUserName').textContent = u.fullName || '';
    document.getElementById('editInfoName').textContent = u.fullName || '';
    document.getElementById('editInfoEmail').textContent = u.email || '-';
    document.getElementById('editInfoDept').textContent = u.deptName || '-';

    const editDept = document.getElementById('editDept');
    if (editDept) editDept.value = String(u.departmentId || '');

    selectRole(selectedEditRole);
    new bootstrap.Modal(document.getElementById('editUserModal')).show();
}

function selectRole(role) {
    selectedEditRole = role;
    document.querySelectorAll('#roleSelector .role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });
}

async function submitEditUser() {
    if (!currentEditUserId || !selectedEditRole) {
        showToast('البيانات غير مكتملة', 'danger');
        return;
    }
    const departmentId = parseInt(document.getElementById('editDept')?.value || '0', 10);
    const r = await apiFetch('/Users/UpdateRole', 'POST', {
        userId: currentEditUserId,
        role: selectedEditRole,
        departmentId
    });
    if (r?.success) {
        bootstrap.Modal.getInstance(document.getElementById('editUserModal'))?.hide();
        showToast(r.message || 'تم التعديل بنجاح');
        loadUsers();
    } else {
        showToast(r?.message || 'حدث خطأ', 'danger');
    }
}

function showAddUserModal() {
    document.getElementById('newNationalId').value = '';
    document.getElementById('newFullName').value = '';
    document.getElementById('newUsername').value = '';
    document.getElementById('newEmail').value = '';
    document.getElementById('newPhone').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newIsActive').checked = true;
    document.getElementById('newPhotoPreview').src = 'https://via.placeholder.com/54x54.png?text=+';
    newUserPhotoData = '';
    const lookupSection = document.getElementById('lookupResultSection');
    if (lookupSection) lookupSection.style.display = 'none';
    document.getElementById('addUserError').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('addUserModal')).show();
}

async function lookupNationalId() {
    const nationalId = (document.getElementById('newNationalId')?.value || '').trim();
    if (!nationalId) {
        showToast('أدخل رقم الهوية', 'warning');
        return;
    }
    const r = await apiFetch(`/Users/LookupByNationalId?nationalId=${encodeURIComponent(nationalId)}`);
    if (!r?.success) {
        const lookupSection = document.getElementById('lookupResultSection');
        if (lookupSection) lookupSection.style.display = 'none';
        const errEl = document.getElementById('addUserError');
        errEl.textContent = r?.message || 'لم يتم العثور على الهوية';
        errEl.classList.remove('d-none');
        return;
    }
    document.getElementById('addUserError').classList.add('d-none');
    const d = r.data || {};
    document.getElementById('newFullName').value = d.fullName || '';
    document.getElementById('newEmail').value = d.email || '';
    document.getElementById('newPhone').value = d.phone || '';
    if (!document.getElementById('newUsername').value && d.email) {
        document.getElementById('newUsername').value = String(d.email).split('@')[0];
    }
    if (d.departmentId) {
        document.getElementById('newDept').value = String(d.departmentId);
    }
    if (d.photoUrl) {
        document.getElementById('newPhotoPreview').src = d.photoUrl;
        newUserPhotoData = d.photoUrl;
    }
    const lookupSection = document.getElementById('lookupResultSection');
    if (lookupSection) lookupSection.style.display = 'block';
    showToast('تم جلب بيانات المستخدم ');
}

function onUserPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = e.target?.result || '';
        newUserPhotoData = String(data);
        document.getElementById('newPhotoPreview').src = newUserPhotoData;
    };
    reader.readAsDataURL(file);
}

async function submitAddUser() {
    if (!(document.getElementById('newNationalId')?.value || '').trim()) {
        showToast('رقم الهوية مطلوب', 'warning');
        return;
    }
    const fullName = (document.getElementById('newFullName')?.value || '').trim();
    const phone = (document.getElementById('newPhone')?.value || '').trim();
    const email = (document.getElementById('newEmail')?.value || '').trim();
    const role = document.getElementById('newRole')?.value || '';
    const dept = parseInt(document.getElementById('newDept')?.value || '0', 10);
    if (!fullName || !phone || !email || !role || dept <= 0) {
        showToast('يرجى تعبئة الحقول المطلوبة ذات النجمة الحمراء', 'warning');
        return;
    }

    const body = {
        nationalId: document.getElementById('newNationalId').value,
        fullName: fullName,
        username: document.getElementById('newUsername').value,
        email: email,
        phone: phone,
        photoUrl: newUserPhotoData,
        password: document.getElementById('newPassword').value,
        role: role,
        departmentId: dept,
        isActive: document.getElementById('newIsActive').checked
    };
    const r = await apiFetch('/Users/AddUser', 'POST', body);
    if (r?.success) {
        bootstrap.Modal.getInstance(document.getElementById('addUserModal'))?.hide();
        showToast('تم إضافة المستخدم بنجاح');
        loadUsers();
    } else {
        const errEl = document.getElementById('addUserError');
        errEl.textContent = r?.message || 'حدث خطأ';
        errEl.classList.remove('d-none');
    }
}

window.changePage = changePage;
window.toggleStatus = toggleStatus;
window.showEditUserModal = showEditUserModal;
window.selectRole = selectRole;
window.submitEditUser = submitEditUser;
window.showAddUserModal = showAddUserModal;
window.lookupNationalId = lookupNationalId;
window.onUserPhotoSelected = onUserPhotoSelected;
window.submitAddUser = submitAddUser;

loadDepts();
loadUsers();
