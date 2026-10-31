// Match the public calendar's South African booking clock, including exact-time expiry.
window.adminSlotHasPassed = function (date, time, now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone:'Africa/Johannesburg', year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
    }).formatToParts(now).map(part => [part.type,part.value]));
    const current = parts.year + '-' + parts.month + '-' + parts.day + 'T' + parts.hour + ':' + parts.minute + ':' + parts.second;
    return date + 'T' + time.slice(0,5) + ':00' <= current;
};
let adminPastSlotTimer;
window.notifyAdminPastSlot = function (time) {
    const notice = document.getElementById('admin-calendar-toast');
    if (!notice) return;
    clearTimeout(adminPastSlotTimer);
    notice.hidden = false;
    notice.textContent = time.slice(0,5) + ' has passed. Clients can only book future times.';
    adminPastSlotTimer = setTimeout(() => { notice.hidden = true; },6000);
};
