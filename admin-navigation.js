// Primary sections stay on one page; old category links return to Services.
window.initializeAdminNavigation = function (businessName, bizSlug) {
    const shell = document.getElementById('admin-shell');
    const sidebar = document.getElementById('admin-sidebar');
    const status = document.getElementById('business-status');
    const sections = ['calendar', 'services'];
    if (document.getElementById('profile-panel')) sections.push('profile');
    document.getElementById('admin-business-name').textContent = businessName || 'Your business';
    const viewBusiness = document.getElementById('admin-view-business');
    if (bizSlug) {
        viewBusiness.href = '/' + encodeURIComponent(bizSlug);
        viewBusiness.hidden = false;
    }
    sidebar.hidden = false;
    shell.classList.add('admin-ready');
    function showSection(moveFocus) {
        const requested = window.location.hash.slice(1);
        const active = requested === 'categories' ? 'services' : sections.includes(requested) ? requested : 'calendar';
        sections.forEach(section => {
            document.getElementById(section + '-panel').hidden = section !== active;
            const link = document.getElementById('nav-' + section);
            if (!link) return;
            if (section === active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        status.textContent = active === 'calendar' ? 'Tap a slot to toggle its availability' : active === 'services' ? 'Manage your service catalogue' : 'Manage your business profile';
        if (moveFocus) document.getElementById(active + '-heading').focus();
    }
    window.addEventListener('hashchange', () => showSection(true));
    showSection(false);
};

