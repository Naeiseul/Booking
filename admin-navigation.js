// Navigation changes the visible section without reloading or changing the admin link.
window.initializeAdminNavigation = function (businessName, bizSlug) {
    const shell = document.getElementById('admin-shell');
    const sidebar = document.getElementById('admin-sidebar');
    const status = document.getElementById('business-status');
    const sections = ['calendar', 'services', 'categories'];

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
        const active = sections.includes(requested) ? requested : 'calendar';
        sections.forEach(section => {
            document.getElementById(section + '-panel').hidden = section !== active;
            const link = document.getElementById('nav-' + section);
            if (section === active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        status.textContent = active === 'calendar'
            ? 'Tap a slot to toggle its availability'
            : active === 'categories' ? 'Manage your browsing categories' : 'Manage your service catalogue';
        if (moveFocus) document.getElementById(active + '-heading').focus();
    }

    window.addEventListener('hashchange', () => showSection(true));
    showSection(false);
};
