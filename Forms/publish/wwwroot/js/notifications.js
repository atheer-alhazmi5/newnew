/* notifications.js */
async function loadNotifications() {
    const type = document.getElementById('typeFilter')?.value || '';
    const r = await apiFetch(`/Notifications/GetAll?type=${encodeURIComponent(type)}`);
    if (!r?.success) return;
    renderList(r.data || []);
}

function renderList(items) {
    const list = document.getElementById('notifList');
    if (!list) return;

    if (items.length === 0) {
        list.innerHTML = emptyState('bi-bell-slash', 'لا توجد إشعارات', 'ستظهر الإشعارات هنا');
        return;
    }

    const typeIcons = {
        form_received: 'bi-envelope-fill',
        form_reply: 'bi-reply-fill',
        fill_request: 'bi-pencil-fill',
        approval_request: 'bi-check-circle-fill'
    };

    list.innerHTML = `
    <div class="d-flex flex-column gap-3">
        ${items.map(n => `
        <div class="card ${!n.isRead ? 'border-start border-primary border-3' : ''}">
            <div class="card-body d-flex gap-3 align-items-start">
                <div style="width:42px;height:42px;border-radius:50%;background:var(--sa-100);color:var(--sa-700);
                    display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
                    <i class="bi ${typeIcons[n.type] || 'bi-bell-fill'}"></i>
                </div>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${esc(n.title)}</div>
                    <div style="font-size:13px;color:var(--gray-600);margin-bottom:6px;">${esc(n.message)}</div>
                    <div style="font-size:12px;color:var(--gray-400);">
                        <i class="bi bi-clock" style="margin-left:4px;"></i>${fmtDate(n.createdAt)}
                        · ${esc(n.senderName)}
                    </div>
                </div>
                <div class="d-flex gap-2">
                    ${!n.isRead ? `<button class="btn btn-sm btn-outline-success" onclick="markRead(${n.id})">
                        <i class="bi bi-check"></i>
                    </button>` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteNotif(${n.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>`).join('')}
    </div>`;
}

async function markRead(id) {
    await apiFetch(`/Notifications/MarkRead?id=${id}`, 'POST');
    loadNotifications();
}

async function markAllRead() {
    await apiFetch('/Notifications/MarkAllRead', 'POST');
    showToast('تم تعليم جميع الإشعارات كمقروءة');
    loadNotifications();
}

async function deleteNotif(id) {
    await apiFetch(`/Notifications/Delete?id=${id}`, 'DELETE');
    loadNotifications();
}

loadNotifications();
