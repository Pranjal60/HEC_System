const API = '';
let token = localStorage.getItem('hes_token') || '';
let currentUser = null;

// Loading bar
const loadingBar = document.getElementById('loading-bar');
let loadingTimer;
function showLoading() {
    loadingBar.style.display = 'block';
    loadingBar.style.width = '0';
    clearTimeout(loadingTimer);
    setTimeout(() => { loadingBar.style.width = '70%'; }, 10);
}
function hideLoading() {
    loadingBar.style.width = '100%';
    loadingTimer = setTimeout(() => {
        loadingBar.style.display = 'none';
        loadingBar.style.width = '0';
    }, 300);
}

// Toast notifications
function toast(msg, type = 'success') {
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || '•'}</span><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(30px)';
        el.style.transition = 'all .3s';
        setTimeout(() => el.remove(), 300);
    }, 3500);
}

// API helper
async function apiFetch(path, options = {}) {
    showLoading();
    try {
        const resp = await fetch(API + path, {
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            ...options
        });
        const data = await resp.json().catch(() => ({}));
        hideLoading();
        if (!resp.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: resp.status });
        return data;
    } catch (err) {
        hideLoading();
        throw err;
    }
}

// Location helpers — cache Dehradun locations for dropdowns
let _locationsCache = null;
async function getLocations(forceRefresh = false) {
    if (!_locationsCache || forceRefresh) {
        _locationsCache = await apiFetch('/api/locations');
    }
    return _locationsCache;
}

async function populateLocationSelect(selEl, selectedId = null, defaultLabel = '— Select pickup location —') {
    if (!selEl) return;
    try {
        const locs = await getLocations();
        selEl.innerHTML = `<option value="">${defaultLabel}</option>` +
            locs.map(l => `<option value="${l.location_id}" ${selectedId && Number(selectedId) === l.location_id ? 'selected' : ''}>${l.location_name}</option>`).join('');
    } catch {
        selEl.innerHTML = '<option value="">Failed to load locations</option>';
    }
}

// Badge helpers
function severityBadge(s) {
    const k = (s || '').toLowerCase();
    const cls = { critical: 'sev-critical', serious: 'sev-serious', moderate: 'sev-moderate', minor: 'sev-minor' };
    const dot = { critical: '#dc2626', serious: '#f97316', moderate: '#eab308', minor: '#16a34a' };
    return `<span class="badge ${cls[k] || ''}">${dot[k] ? `<span class="badge-dot" style="background:${dot[k]};"></span>` : ''}${s || '—'}</span>`;
}

function statusBadge(s) {
    const k = (s || '').toLowerCase().replace(/ /g, '_');
    const labels = {
        pending:'Pending', admitted:'Admitted', in_treatment:'In Treatment',
        discharged:'Discharged', cancelled:'Cancelled',
        available:'Available', in_transit:'In Transit',
        occupied:'Occupied', not_available:'Not Available',
        active:'Active', inactive:'Inactive', full:'Full',
        allocated:'Allocated', waiting:'Waiting', denied:'Denied', released:'Released',
        approved:'Approved', rejected:'Rejected',
        ongoing:'Ongoing', completed:'Completed',
        paid:'Paid', partial:'Partial', pending_pay:'Pending'
    };
    return `<span class="badge st-${k}">${labels[k] || s || '—'}</span>`;
}

function fmtDate(d) {
    if (!d) return '<span style="color:var(--gray-400);">—</span>';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDateShort(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function mono(text) { return `<span class="mono">${text}</span>`; }

// Modal helpers
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-close-x').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});
document.querySelectorAll('.modal-bg').forEach(bg => {
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); });
});

// Navigation
const pageTitles = {
    dashboard: ['Dashboard', 'System overview & quick actions'],
    emergencies: ['Emergency Cases', 'Manage the full emergency lifecycle'],
    'emg-detail': ['Emergency Detail', 'Full case view and workflow'],
    resources: ['Resources', 'Ambulances, hospitals, beds, doctors'],
    scheduling: ['CPU Scheduling', 'Member 4 — C scheduling algorithms'],
    banker: ["Banker's Algorithm", 'Member 5 — C++ deadlock avoidance'],
    deadlock: ['Deadlock Detection', 'Member 5 — C++ Resource Allocation Graph'],
    starvation: ['Starvation & Aging', 'Member 5 — C++ Priority Aging Algorithm'],
    synchronization: ['Synchronization', 'Member 5 — C++ Semaphore Demo'],
    'os-demo': ['OS Lab Demo', 'Two simultaneous emergencies — CPU scheduling · Banker\'s · Deadlock · Starvation'],
    treatment: ['Treatment Records', 'Medical diagnoses and notes'],
    billing: ['Billing & Payments', 'Financial records'],
};

function navigate(page, opts = {}) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));

    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');

    const link = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (link) link.classList.add('active');

    const titles = pageTitles[page] || [page, ''];
    document.getElementById('page-title').textContent = titles[0];
    const sub = document.getElementById('page-subtitle');
    if (titles[1]) { sub.textContent = titles[1]; sub.style.display = 'inline-block'; }
    else sub.style.display = 'none';

    loadPage(page, opts);
}

document.querySelectorAll('.nav-item[data-page]').forEach(l => {
    l.addEventListener('click', () => navigate(l.dataset.page));
});

document.getElementById('refresh-btn').addEventListener('click', () => {
    const active = document.querySelector('.nav-item.active');
    if (active) loadPage(active.dataset.page);
});

function loadPage(p, opts = {}) {
    const map = {
        dashboard: loadDashboard,
        emergencies: loadEmergencies,
        resources: () => loadResources(opts.tab),
        scheduling: loadSchedulingPage,
        banker: loadBankerPage,
        deadlock: loadDeadlockPage,
        starvation: loadStarvationPage,
        synchronization: loadSyncPage,
        'os-demo': loadOsDemoPage,
        treatment: loadTreatments,
        billing: loadBilling,
    };
    if (map[p]) map[p](opts);
}

// Auth
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
        const r = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: document.getElementById('login-username').value.trim(),
                password: document.getElementById('login-password').value
            })
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Login failed');
        token = json.token;
        currentUser = json.user;
        localStorage.setItem('hes_token', token);
        showApp();
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = 'Sign In';
    }
});

function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user-display').textContent = currentUser?.username || '';
    document.getElementById('user-role').textContent = currentUser?.role || '';
    document.getElementById('user-avatar').textContent = (currentUser?.username?.[0] || 'U').toUpperCase();
    navigate('dashboard');
}

document.getElementById('logout-btn').addEventListener('click', () => {
    token = ''; currentUser = null;
    localStorage.removeItem('hes_token');
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
});

if (token) {
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => r.json()).then(u => { currentUser = u; showApp(); })
        .catch(() => { token = ''; localStorage.removeItem('hes_token'); });
}

// DASHBOARD
async function loadDashboard() {
    try {
        const s = await apiFetch('/api/emergencies/dashboard/stats');
        document.getElementById('stat-total').textContent      = s.total_emergencies   ?? '–';
        document.getElementById('stat-active').textContent     = s.active_emergencies  ?? '–';
        document.getElementById('stat-ambulances').textContent = s.available_ambulances ?? '–';
        document.getElementById('stat-beds').textContent       = s.available_beds       ?? '–';
        document.getElementById('stat-doctors').textContent    = s.available_doctors    ?? '–';

        // Active badge in nav
        const badge = document.getElementById('nav-active-count');
        if (s.active_emergencies > 0) { badge.textContent = s.active_emergencies; badge.style.display = 'inline-block'; }
        else badge.style.display = 'none';

        // Recent emergencies table
        const tb = document.getElementById('dashboard-table');
        if (!s.recent_emergencies?.length) {
            tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--gray-400);">No emergencies yet</td></tr>';
        } else {
            tb.innerHTML = s.recent_emergencies.map(e => `
              <tr class="row-${e.severity?.toLowerCase()}">
                <td>${mono('E' + e.emergency_id)}</td>
                <td style="font-weight:600;">${e.patient_name || '—'}</td>
                <td>${severityBadge(e.severity)}</td>
                <td>${statusBadge(e.status)}</td>
                <td style="font-size:12px;color:var(--gray-500);">${fmtDate(e.request_time)}</td>
                <td><button class="btn btn-ghost btn-xs" onclick="openEmergencyDetail(${e.emergency_id})">View →</button></td>
              </tr>`).join('');
        }
    } catch (err) { toast(err.message, 'error'); }

    // System status badges
    checkSystemStatus();
}

async function checkSystemStatus() {
    try {
        const s = await apiFetch('/api/scheduling/status');
        document.getElementById('ss-sched').className = s.built ? 'badge st-available' : 'badge st-maintenance';
        document.getElementById('ss-sched').textContent = s.built ? '● Ready' : '⚠ Not built';
    } catch { document.getElementById('ss-sched').className = 'badge st-maintenance'; document.getElementById('ss-sched').textContent = '⚠ Error'; }
    try {
        const r = await apiFetch('/api/resources/status');
        document.getElementById('ss-res').className = r.built ? 'badge st-available' : 'badge st-maintenance';
        document.getElementById('ss-res').textContent = r.built ? '● Ready' : '⚠ Not built';
    } catch { document.getElementById('ss-res').className = 'badge st-maintenance'; document.getElementById('ss-res').textContent = '⚠ Error'; }
}

// EMERGENCIES LIST
let allEmergencies = [];

async function loadEmergencies() {
    try {
        const status = document.getElementById('emg-filter-status').value;
        const params = status ? `?status=${status}` : '';
        allEmergencies = await apiFetch('/api/emergencies' + params);
        renderEmergenciesTable(allEmergencies);
    } catch (err) { toast(err.message, 'error'); }
}

function renderEmergenciesTable(data) {
    const tb = document.getElementById('emergencies-table');
    if (!data.length) {
        tb.innerHTML = `<tr><td colspan="9" style="padding:50px;text-align:center;color:var(--gray-400);">
          <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin:0 auto 10px;display:block;opacity:.4;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          No emergencies found</td></tr>`;
        return;
    }
    tb.innerHTML = data.map(e => `
      <tr class="row-${e.severity?.toLowerCase()}">
        <td>${mono('E' + e.emergency_id)}</td>
        <td style="font-weight:600;">${e.patient_name || '—'}</td>
        <td>${severityBadge(e.severity)}</td>
        <td><span style="font-weight:700;font-size:14px;color:var(--gray-700);background:var(--gray-100);padding:2px 8px;border-radius:6px;">${e.priority}</span></td>
        <td style="font-size:12.5px;">${e.ambulance_reg ? `<span style="color:var(--gray-700);">${e.ambulance_reg}</span>` : '<span style="color:var(--gray-300);">—</span>'}</td>
        <td style="font-size:12.5px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.hospital_name || '<span style="color:var(--gray-300);">—</span>'}</td>
        <td>${statusBadge(e.status)}</td>
        <td style="font-size:12px;color:var(--gray-500);">${fmtDate(e.request_time)}</td>
        <td><button class="btn btn-ghost btn-xs" onclick="openEmergencyDetail(${e.emergency_id})">Details →</button></td>
      </tr>`).join('');
}

// Search filter
document.getElementById('emg-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    if (!q) { renderEmergenciesTable(allEmergencies); return; }
    renderEmergenciesTable(allEmergencies.filter(e =>
        (e.patient_name || '').toLowerCase().includes(q) ||
        String(e.emergency_id).includes(q)
    ));
});
document.getElementById('emg-filter-status').addEventListener('change', loadEmergencies);

// New Emergency Modal
document.getElementById('btn-new-emergency').addEventListener('click', async () => {
    openModal('modal-emergency');
    const pSel = document.getElementById('emg-patient');
    const hSel = document.getElementById('emg-hospital');
    const lSel = document.getElementById('emg-pickup-location');
    pSel.innerHTML = '<option value="">Loading patients…</option>';
    hSel.innerHTML = '<option value="">Loading hospitals…</option>';
    if (lSel) lSel.innerHTML = '<option value="">Loading locations…</option>';
    try {
        const pts = await apiFetch('/api/patients');
        pSel.innerHTML = '<option value="">— Select Patient —</option>';
        pts.forEach(p => pSel.appendChild(new Option(`${p.name} (ID: ${p.patient_id})`, p.patient_id)));
    } catch { pSel.innerHTML = '<option value="">Failed to load</option>'; }
    try {
        const hs = await apiFetch('/api/hospitals');
        hSel.innerHTML = '<option value="">— Select Hospital —</option>';
        hs.forEach(h => hSel.appendChild(new Option(`${h.hospital_name} (${h.available_beds} beds free)`, h.hospital_id)));
    } catch { hSel.innerHTML = '<option value="">Failed to load</option>'; }
    if (lSel) await populateLocationSelect(lSel, null, '— Select Emergency Pickup Location —');
});

document.getElementById('emg-severity').addEventListener('change', e => {
    const m = { critical: 1, serious: 2, moderate: 3, minor: 4 };
    document.getElementById('emg-priority').value = m[e.target.value] || '';
});

document.getElementById('submit-emergency').addEventListener('click', async () => {
    const patient_id         = document.getElementById('emg-patient').value;
    const hospital_id        = document.getElementById('emg-hospital').value;
    const severity           = document.getElementById('emg-severity').value;
    const priority           = document.getElementById('emg-priority').value;
    const pickup_location_id = document.getElementById('emg-pickup-location')?.value;

    if (!patient_id || !hospital_id || !severity) {
        toast('Patient, Hospital and Severity are required.', 'error'); return;
    }
    if (!pickup_location_id) {
        toast('Emergency Pickup Location is required.', 'error'); return;
    }

    const btn = document.getElementById('submit-emergency');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
        const newEmg = await apiFetch('/api/emergencies', {
            method: 'POST',
            body: JSON.stringify({
                patient_id,
                hospital_id,
                severity,
                priority: priority || undefined,
                pickup_location_id: Number(pickup_location_id)
            })
        });
        closeModal('modal-emergency');
        toast('Emergency E' + newEmg.emergency_id + ' created.');
        loadEmergencies(); loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Submit Emergency'; }
});

// EMERGENCY DETAIL PAGE
let currentEmgId = null;

async function openEmergencyDetail(id) {
    currentEmgId = id;
    navigate('emg-detail');
    await renderEmergencyDetail(id);
}

document.getElementById('btn-back-to-emergencies').addEventListener('click', () => navigate('emergencies'));

async function renderEmergencyDetail(id) {
    try {
        const e = await apiFetch(`/api/emergencies/${id}`);

        document.getElementById('detail-heading').textContent = `Emergency E${e.emergency_id}`;
        document.getElementById('detail-patient-sub').textContent =
            `${e.patient_name || 'Unknown Patient'} · ${(e.severity || '').toUpperCase()} · Priority ${e.priority}`;

        // Progress tracker
        const stages = [
            { key: 'requested', label: 'Requested' },
            { key: 'pending',   label: 'Pending'   },
            { key: 'admitted',  label: 'Admitted'  },
            { key: 'in_treatment', label: 'Treatment' },
            { key: 'discharged', label: 'Discharged' },
        ];
        const stageOrder = ['pending', 'admitted', 'in_treatment', 'discharged'];
        const currentIdx = stageOrder.indexOf(e.status);
        const cancelledOrDone = e.status === 'cancelled' || e.status === 'discharged';

        const trackEl = document.getElementById('progress-track');
        trackEl.innerHTML = stages.map((stage, i) => {
            const sIdx = stageOrder.indexOf(stage.key);
            let cls = 'pending', icon = i + 1;
            if (e.status === 'cancelled') {
                cls = sIdx < currentIdx ? 'done' : (stage.key === 'pending' ? 'current' : 'pending');
            } else if (sIdx < currentIdx) { cls = 'done'; icon = '✓'; }
            else if (sIdx === currentIdx || (stage.key === 'pending' && currentIdx === -1)) { cls = 'current'; }
            return `<div class="pt-step ${i < stages.length - 1 ? (sIdx < currentIdx ? 'done' : '') : ''}">
              <div class="pt-dot ${cls}">${icon}</div>
              <div class="pt-label ${cls}">${stage.label}</div>
            </div>`;
        }).join('');
        if (e.status === 'cancelled') {
            trackEl.innerHTML += `<div style="position:absolute;right:16px;top:8px;"><span class="badge st-cancelled" style="font-size:12px;">✕ Cancelled</span></div>`;
            trackEl.style.position = 'relative';
        }

        // Patient & Emergency info
        document.getElementById('detail-info').innerHTML = `
          <div class="detail-row"><span class="detail-key">Emergency ID</span><span class="detail-value">${mono('E' + e.emergency_id)}</span></div>
          <div class="detail-row"><span class="detail-key">Patient</span><span class="detail-value">${e.patient_name || '—'}</span></div>
          <div class="detail-row"><span class="detail-key">Severity</span><span class="detail-value">${severityBadge(e.severity)}</span></div>
          <div class="detail-row"><span class="detail-key">Priority</span><span class="detail-value">${e.priority}</span></div>
          <div class="detail-row"><span class="detail-key">Status</span><span class="detail-value">${statusBadge(e.status)}</span></div>
          ${e.pickup_location_name ? `<div class="detail-row"><span class="detail-key">Pickup Location</span><span class="detail-value" style="font-weight:600;color:var(--gray-800);">📍 ${e.pickup_location_name}</span></div>` : ''}
          ${e.pickup_address ? `<div class="detail-row"><span class="detail-key">Pickup Address</span><span class="detail-value" style="font-size:12.5px;max-width:200px;text-align:right;">${e.pickup_address}</span></div>` : ''}`;

        // Resources
        document.getElementById('detail-resources').innerHTML = `
          <div class="detail-row"><span class="detail-key">🚑 Ambulance</span><span class="detail-value">${e.ambulance_reg || '<span style="color:var(--gray-400);">Not assigned</span>'}</span></div>
          <div class="detail-row"><span class="detail-key">🏥 Hospital</span><span class="detail-value">${e.hospital_name || '<span style="color:var(--gray-400);">Not assigned</span>'}</span></div>
          <div class="detail-row"><span class="detail-key">🛏 Bed</span><span class="detail-value">${e.bed_number || '<span style="color:var(--gray-400);">Not assigned</span>'}</span></div>
          <div class="detail-row"><span class="detail-key">👨‍⚕️ Doctor</span><span class="detail-value">${e.doctor_name || '<span style="color:var(--gray-400);">Not assigned</span>'}</span></div>`;

        // Timeline
        const timelineItems = [
            ['Requested',  e.request_time],
            ['Dispatched', e.dispatch_time],
            ['Picked Up',  e.pickup_time],
            ['Admitted',   e.admission_time],
            ['Discharged', e.discharge_time],
        ];
        document.getElementById('detail-timeline').innerHTML = timelineItems.map(([label, dt]) =>
            `<div class="detail-row"><span class="detail-key" style="font-size:12px;">${label}</span><span class="detail-value" style="font-size:12px;">${fmtDate(dt)}</span></div>`
        ).join('');

        // Update form
        renderDetailUpdateForm(e);

        // Action buttons
        const actionsEl = document.getElementById('detail-actions');
        actionsEl.innerHTML = '';

    } catch (err) {
        toast('Failed to load emergency details: ' + err.message, 'error');
    }
}

function renderDetailUpdateForm(e) {
    const el = document.getElementById('detail-update-form');
    const nextMap = {
        pending:      ['admitted', 'cancelled'],
        admitted:     ['in_treatment', 'cancelled'],
        in_treatment: ['discharged', 'cancelled']
    };
    const options = nextMap[e.status];
    if (!options || e.status === 'discharged' || e.status === 'cancelled') {
        el.innerHTML = `<p style="font-size:13px;color:var(--gray-400);">This case is ${e.status}. No further actions available.</p>`;
        return;
    }

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label class="lbl">New Status</label>
          <select id="detail-new-status" class="inp" style="margin-top:6px;">
            ${options.map(o => `<option value="${o}">${o.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>`).join('')}
          </select>
        </div>
        <div id="detail-resource-fields">
          ${e.status === 'pending' ? `
          <div style="background:var(--gray-50);border-radius:8px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <p style="font-size:12px;font-weight:600;color:var(--gray-600);margin:0;">Assign Resources (Required for Admitted)</p>
              <button id="btn-assign-nearest-emg" type="button" class="btn btn-secondary btn-sm" style="font-size:11px;padding:3px 8px;">
                ⚡ Auto-Assign Nearest
              </button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <label class="lbl">Ambulance</label>
                <select id="detail-amb-select" class="inp" style="font-size:12.5px;"></select>
              </div>
              <div>
                <label class="lbl">Bed</label>
                <select id="detail-bed-select" class="inp" style="font-size:12.5px;"></select>
              </div>
              <div class="full" style="grid-column:1/-1;">
                <label class="lbl">Doctor</label>
                <select id="detail-doc-select" class="inp" style="font-size:12.5px;"></select>
              </div>
            </div>
          </div>` : ''}
        </div>
        <button id="btn-detail-update" class="btn btn-primary" style="justify-content:center;">Update Status</button>
      </div>`;

    // Load dropdowns if pending
    if (e.status === 'pending') {
        loadDetailDropdowns(e);
        const autoBtn = document.getElementById('btn-assign-nearest-emg');
        if (autoBtn) {
            autoBtn.addEventListener('click', async () => {
                autoBtn.disabled = true;
                autoBtn.textContent = 'Allocating…';
                try {
                    const res = await apiFetch(`/api/emergencies/${e.emergency_id}/assign-nearest`, { method: 'POST', body: JSON.stringify({}) });
                    toast(`Nearest ambulance ${res.assigned_ambulance.vehicle_number} assigned (${res.assigned_ambulance.distance_km} km)!`);
                    await renderEmergencyDetail(e.emergency_id);
                } catch (err) {
                    toast(err.message, 'error');
                } finally {
                    autoBtn.disabled = false;
                    autoBtn.textContent = '⚡ Auto-Assign Nearest';
                }
            });
        }
    }

    document.getElementById('btn-detail-update').addEventListener('click', () => submitDetailUpdate(e));
}

async function loadDetailDropdowns(emg = null) {
    try {
        const sel = document.getElementById('detail-amb-select');
        if (sel) {
            let availableAmbs = [];
            if (emg && emg.pickup_location_id) {
                // If pickup location is known, rank by road distance
                const rankedData = await apiFetch('/api/ambulances/find-suitable', {
                    method: 'POST',
                    body: JSON.stringify({ pickup_location_id: emg.pickup_location_id })
                }).catch(() => null);

                if (rankedData && rankedData.ranked_ambulances && rankedData.ranked_ambulances.length) {
                    availableAmbs = rankedData.ranked_ambulances.map(a => ({
                        id: a.ambulance_id,
                        label: `${a.vehicle_number} (${a.type || 'Basic'}) — ${a.distance_km} km (${a.current_location_name})`
                    }));
                }
            }
            if (!availableAmbs.length) {
                const ambs = await apiFetch('/api/ambulances');
                availableAmbs = ambs.filter(a => a.status === 'available').map(a => ({
                    id: a.ambulance_id,
                    label: `${a.vehicle_number} (${a.type || 'Basic'}) · ${a.current_location_name || 'No location'}`
                }));
            }
            sel.innerHTML = '<option value="">— Select Ambulance —</option>' +
                availableAmbs.map((a, i) => `<option value="${a.id}" ${i === 0 ? 'selected' : ''}>${a.label}</option>`).join('');
            if (!availableAmbs.length) sel.innerHTML = '<option value="">No ambulances available</option>';
        }
    } catch {}
    try {
        const beds = await apiFetch('/api/beds?status=available');
        const sel = document.getElementById('detail-bed-select');
        if (sel) {
            sel.innerHTML = '<option value="">— Select Bed —</option>' +
                beds.map(b => `<option value="${b.bed_id}">${b.bed_number} · ${b.bed_type} · ${b.hospital_name}</option>`).join('');
            if (!beds.length) sel.innerHTML = '<option value="">No beds available</option>';
        }
    } catch {}
    try {
        const docs = await apiFetch('/api/doctors?availability=available');
        const sel = document.getElementById('detail-doc-select');
        if (sel) {
            sel.innerHTML = '<option value="">— Select Doctor —</option>' +
                docs.map(d => `<option value="${d.doctor_id}">${d.name} · ${d.hospital_name}</option>`).join('');
            if (!docs.length) sel.innerHTML = '<option value="">No doctors available</option>';
        }
    } catch {}
}

async function submitDetailUpdate(emg) {
    const status = document.getElementById('detail-new-status').value;
    const body = { status };

    if (emg.status === 'pending') {
        const aId = document.getElementById('detail-amb-select')?.value;
        const bId = document.getElementById('detail-bed-select')?.value;
        const dId = document.getElementById('detail-doc-select')?.value;
        if (aId) body.ambulance_id = parseInt(aId);
        if (bId) body.bed_id       = parseInt(bId);
        if (dId) body.doctor_id    = parseInt(dId);
    }
    if (status === 'admitted')   body.admission_time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (status === 'discharged') body.discharge_time = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const btn = document.getElementById('btn-detail-update');
    btn.disabled = true; btn.textContent = 'Updating…';
    try {
        await apiFetch(`/api/emergencies/${emg.emergency_id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast(`Emergency E${emg.emergency_id} → ${status}`, 'success');
        await renderEmergencyDetail(emg.emergency_id);
        loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Update Status'; }
}

// RESOURCES
function loadResources(tab = 'ambulances') {
    document.querySelectorAll('.res-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.res-panel').forEach(p => p.classList.remove('active'));
    const tabEl = document.querySelector(`.res-tab[data-tab="${tab}"]`);
    if (tabEl) tabEl.classList.add('active');
    const panelEl = document.getElementById(`res-panel-${tab}`);
    if (panelEl) panelEl.classList.add('active');

    const loaders = {
        ambulances: loadAmbulances,
        hospitals:  loadHospitals,
        beds:       loadBedsList,
        doctors:    loadDoctors,
    };
    if (loaders[tab]) loaders[tab]();
}

document.querySelectorAll('.res-tab').forEach(tab => {
    tab.addEventListener('click', () => loadResources(tab.dataset.tab));
});

// Ambulances
async function loadAmbulances() {
    try {
        const data = await apiFetch('/api/ambulances');
        const tb = document.getElementById('ambulances-table');
        if (!data.length) { tb.innerHTML = '<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--gray-400);">No ambulances registered</td></tr>'; return; }
        tb.innerHTML = data.map(a => `
          <tr>
            <td>${mono('A' + a.ambulance_id)}</td>
            <td style="font-weight:600;">${a.vehicle_number}</td>
            <td style="font-size:12.5px;">${a.type || '—'}</td>
            <td>${a.driver_name || '—'}</td>
            <td style="font-size:12.5px;">${a.hospital_name || '—'}</td>
            <td>${a.current_location_name ? `<span style="font-weight:500;color:var(--gray-800);">📍 ${a.current_location_name}</span>` : '<span style="color:var(--gray-400);">Not set</span>'}</td>
            <td>${statusBadge(a.status)}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px;">
                <select class="inp" style="padding:4px 6px;font-size:11.5px;width:110px;" onchange="updateAmbStatus(${a.ambulance_id},this)">
                  <option value="">Status…</option>
                  <option value="available" ${a.status === 'available' ? 'selected' : ''}>Available</option>
                  <option value="in_transit" ${a.status === 'in_transit' ? 'selected' : ''}>In Transit</option>
                </select>
                <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:11.5px;" onclick="openEditAmbulance(${a.ambulance_id})">Edit</button>
              </div>
            </td>
          </tr>`).join('');

        // Also ensure find-pickup-location is populated
        const findSel = document.getElementById('find-pickup-location');
        if (findSel && findSel.options.length <= 1) {
            await populateLocationSelect(findSel, null, '— Select pickup location —');
        }
    } catch (err) { toast(err.message, 'error'); }
}

window.openEditAmbulance = async function(id) {
    try {
        const a = await apiFetch(`/api/ambulances/${id}`);
        document.getElementById('amb-edit-id').value = a.ambulance_id;
        document.getElementById('modal-ambulance-title').textContent = `Edit Ambulance (${a.vehicle_number})`;
        document.getElementById('amb-reg').value = a.vehicle_number || '';
        document.getElementById('amb-type').value = a.type || 'Basic';
        document.getElementById('amb-driver').value = a.driver_name || '';
        document.getElementById('amb-license').value = a.driver_license || '';

        const hSel = document.getElementById('amb-hospital');
        const hs = await apiFetch('/api/hospitals');
        hSel.innerHTML = '<option value="">— Select Hospital —</option>';
        hs.forEach(h => {
            const opt = new Option(h.hospital_name, h.hospital_id);
            if (h.hospital_id === a.hospital_id) opt.selected = true;
            hSel.appendChild(opt);
        });

        const lSel = document.getElementById('amb-location');
        await populateLocationSelect(lSel, a.current_location_id, '— Select Location —');

        openModal('modal-ambulance');
    } catch (err) { toast(err.message, 'error'); }
};

window.updateAmbStatus = async function (id, sel) {
    const status = sel.value;
    if (!status) return;
    try {
        await apiFetch(`/api/ambulances/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
        toast(`Ambulance A${id} → ${status}`);
        sel.value = ''; loadAmbulances();
    } catch (err) { toast(err.message, 'error'); sel.value = ''; }
};

document.getElementById('btn-new-ambulance').addEventListener('click', async () => {
    document.getElementById('amb-edit-id').value = '';
    document.getElementById('modal-ambulance-title').textContent = 'Register Ambulance';
    document.getElementById('amb-reg').value = '';
    document.getElementById('amb-type').value = '';
    document.getElementById('amb-driver').value = '';
    document.getElementById('amb-license').value = '';

    openModal('modal-ambulance');
    const sel = document.getElementById('amb-hospital');
    sel.innerHTML = '<option value="">Loading…</option>';
    try {
        const hs = await apiFetch('/api/hospitals');
        sel.innerHTML = '<option value="">— Select Hospital —</option>';
        hs.forEach(h => sel.appendChild(new Option(h.hospital_name, h.hospital_id)));
    } catch { sel.innerHTML = '<option value="">Failed to load</option>'; }

    const lSel = document.getElementById('amb-location');
    await populateLocationSelect(lSel, null, '— Select Location —');
});

document.getElementById('submit-ambulance').addEventListener('click', async () => {
    const editId = document.getElementById('amb-edit-id').value;
    const body = {
        hospital_id:         document.getElementById('amb-hospital').value,
        vehicle_number:      document.getElementById('amb-reg').value.trim(),
        type:                document.getElementById('amb-type').value,
        driver_name:         document.getElementById('amb-driver').value.trim(),
        driver_license:      document.getElementById('amb-license').value.trim(),
        current_location_id: document.getElementById('amb-location').value ? Number(document.getElementById('amb-location').value) : undefined,
    };
    if (!body.hospital_id || !body.vehicle_number || !body.driver_name) {
        toast('Hospital, vehicle number and driver name are required.', 'error'); return;
    }
    if (!body.current_location_id) {
        toast('Please select a current Dehradun location.', 'error'); return;
    }
    const btn = document.getElementById('submit-ambulance');
    btn.disabled = true; btn.textContent = editId ? 'Saving…' : 'Registering…';
    try {
        if (editId) {
            await apiFetch(`/api/ambulances/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
            toast(`Ambulance ${body.vehicle_number} updated.`);
        } else {
            await apiFetch('/api/ambulances', { method: 'POST', body: JSON.stringify(body) });
            toast('Ambulance registered.');
        }
        closeModal('modal-ambulance');
        loadAmbulances();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Ambulance'; }
});

// Find Nearest Ambulance (Member 2)
document.getElementById('btn-find-nearest').addEventListener('click', async () => {
    const locId = document.getElementById('find-pickup-location').value;
    const reqType = document.getElementById('find-amb-type').value;
    const resBox = document.getElementById('find-nearest-result');

    if (!locId) {
        toast('Please select an Emergency Pickup Location.', 'error');
        return;
    }

    const btn = document.getElementById('btn-find-nearest');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;margin-right:6px;"></span> Searching…';

    try {
        const data = await apiFetch('/api/ambulances/find-suitable', {
            method: 'POST',
            body: JSON.stringify({ pickup_location_id: Number(locId), required_type: reqType || undefined })
        });

        resBox.style.display = 'block';

        if (!data.ranked_ambulances || !data.ranked_ambulances.length) {
            resBox.innerHTML = `
              <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:16px;color:#92400e;margin-top:14px;">
                <div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">No Available Ambulances Found</div>
                <div style="font-size:12.5px;line-height:1.6;">
                  No suitable ambulance is currently available for <strong>${data.pickup_location.location_name}</strong>.
                  All registered ambulances are either in transit or lack road distance entries.
                </div>
              </div>`;
            return;
        }

        const rec = data.best_ambulance;
        resBox.innerHTML = `
          <div style="margin-top:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;flex-wrap:wrap;">
              <div>
                <span style="display:inline-block;background:#15803d;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:12px;letter-spacing:0.5px;margin-bottom:4px;">Recommended Match</span>
                <div style="font-size:14.5px;font-weight:700;color:#14532d;">
                  🚑 ${rec.vehicle_number} (${rec.type || 'Standard'}) — ${rec.distance_km} km away
                </div>
                <div style="font-size:12px;color:#166534;margin-top:2px;">
                  Current Location: <strong>${rec.current_location_name}</strong> · Driver: ${rec.driver_name || 'Assigned'} · Status: ${rec.status}
                </div>
              </div>
            </div>

            <div class="tbl-wrap" style="border:1px solid var(--gray-200);border-radius:8px;overflow:hidden;">
              <table class="tbl">
                <thead>
                  <tr>
                    <th>Ambulance</th>
                    <th>Current location</th>
                    <th style="text-align:right;">Distance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.ranked_ambulances.map((a, idx) => `
                    <tr style="${idx === 0 ? 'background:#f0fdf4;font-weight:600;' : ''}">
                      <td>
                        <div style="display:flex;align-items:center;gap:8px;">
                          <span>🚑 ${a.vehicle_number}</span>
                          <span style="font-size:11px;color:var(--gray-500);font-weight:400;">(${a.type || 'Basic'})</span>
                          ${idx === 0 ? '<span class="badge" style="background:#dcfce7;color:#166534;font-size:10.5px;padding:2px 6px;">Recommended</span>' : ''}
                        </div>
                      </td>
                      <td>${a.current_location_name || '—'}</td>
                      <td style="text-align:right;font-weight:700;color:${idx === 0 ? '#15803d' : 'var(--gray-800)'};">${a.distance_km} km</td>
                      <td>${statusBadge(a.status)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>

            <p style="font-size:11.5px;color:var(--gray-400);margin-top:10px;font-style:italic;">
              * ${data.distance_note || 'Distances are illustrative demo estimates only, not verified road distances.'}
            </p>
          </div>`;

    } catch (err) {
        toast(err.message, 'error');
        resBox.style.display = 'block';
        resBox.innerHTML = `
          <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;padding:14px;color:#b91c1c;margin-top:14px;font-size:12.5px;">
            <strong>Error:</strong> ${err.message}
          </div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
});

// Hospitals
async function loadHospitals() {
    try {
        const data = await apiFetch('/api/hospitals');
        const grid = document.getElementById('hospitals-grid');
        const bSel = document.getElementById('bed-filter-hospital');
        const dSel = document.getElementById('doc-filter-hospital');
        bSel.innerHTML = '<option value="">All Hospitals</option>';
        dSel.innerHTML = '<option value="">All Hospitals</option>';
        data.forEach(h => {
            bSel.appendChild(new Option(`${h.hospital_name}`, h.hospital_id));
            dSel.appendChild(new Option(h.hospital_name, h.hospital_id));
        });
        if (!data.length) { grid.innerHTML = '<p style="color:var(--gray-400);">No hospitals found.</p>'; return; }
        grid.innerHTML = data.map(h => `
          <div class="hospital-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
              <h4>${h.hospital_name}</h4>
              ${statusBadge(h.status)}
            </div>
            <p style="font-size:12px;color:var(--gray-500);">📍 ${h.location_name || '<span style="color:var(--gray-300);">No location set</span>'}</p>
            <div class="hospital-stats">
              <div class="h-stat"><div class="h-stat-val" style="color:var(--green);">${h.available_beds ?? '–'}</div><div class="h-stat-lbl">Available Beds</div></div>
              <div class="h-stat"><div class="h-stat-val" style="color:var(--blue);">${h.emergency_capacity ?? '–'}</div><div class="h-stat-lbl">Emergency Cap.</div></div>
            </div>
          </div>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

// Beds
async function loadBedsList() {
    try {
        const hId  = document.getElementById('bed-filter-hospital').value;
        const bType = document.getElementById('bed-filter-type').value;
        const st    = document.getElementById('bed-filter-status').value;
        const p = new URLSearchParams();
        if (hId)   p.set('hospital_id', hId);
        if (bType) p.set('bed_type', bType);
        if (st)    p.set('status', st);
        const data = await apiFetch('/api/beds?' + p.toString());
        const tb = document.getElementById('beds-table');
        if (!data.length) { tb.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--gray-400);">No beds found</td></tr>'; return; }
        tb.innerHTML = data.map(b => `
          <tr>
            <td>${mono('B' + b.bed_id)}</td>
            <td style="font-size:12.5px;">${b.hospital_name}</td>
            <td style="font-weight:600;">${b.bed_number}</td>
            <td style="font-size:12.5px;">${b.bed_type}</td>
            <td>${statusBadge(b.status)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

['bed-filter-hospital', 'bed-filter-type', 'bed-filter-status'].forEach(id =>
    document.getElementById(id).addEventListener('change', loadBedsList));

// Doctors
async function loadDoctors() {
    try {
        const hId = document.getElementById('doc-filter-hospital').value;
        const av  = document.getElementById('doc-filter-avail').value;
        const p = new URLSearchParams();
        if (hId) p.set('hospital_id', hId);
        if (av)  p.set('availability', av);
        const data = await apiFetch('/api/doctors?' + p.toString());
        const tb = document.getElementById('doctors-table');
        if (!data.length) { tb.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--gray-400);">No doctors found</td></tr>'; return; }
        tb.innerHTML = data.map(d => `
          <tr>
            <td>${mono('D' + d.doctor_id)}</td>
            <td style="font-weight:600;">${d.name}</td>
            <td style="font-size:12.5px;">${d.hospital_name}</td>
            <td>${statusBadge(d.availability)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

['doc-filter-hospital', 'doc-filter-avail'].forEach(id =>
    document.getElementById(id).addEventListener('change', loadDoctors));

// Add Hospital
document.getElementById('btn-new-hospital').addEventListener('click', async () => {
    document.getElementById('modal-hospital-title').textContent = 'Add Hospital';
    document.getElementById('hosp-name').value       = '';
    document.getElementById('hosp-total-beds').value = '';
    document.getElementById('hosp-avail-beds').value = '';
    document.getElementById('hosp-emg-cap').value    = '';
    document.getElementById('hosp-status').value     = 'Active';
    openModal('modal-hospital');
    await populateLocationSelect(document.getElementById('hosp-location'), null, '— Select location —');
});

document.getElementById('submit-hospital').addEventListener('click', async () => {
    const name = document.getElementById('hosp-name').value.trim();
    if (!name) { toast('Hospital name is required.', 'error'); return; }
    const btn = document.getElementById('submit-hospital');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await apiFetch('/api/hospitals', {
            method: 'POST',
            body: JSON.stringify({
                hospital_name:      name,
                location_id:        document.getElementById('hosp-location').value || undefined,
                total_beds:         parseInt(document.getElementById('hosp-total-beds').value) || 0,
                available_beds:     parseInt(document.getElementById('hosp-avail-beds').value) || 0,
                emergency_capacity: parseInt(document.getElementById('hosp-emg-cap').value) || 0,
                status:             document.getElementById('hosp-status').value,
            })
        });
        closeModal('modal-hospital');
        toast(`Hospital "${name}" added.`);
        loadHospitals();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Hospital'; }
});

// Add Bed
document.getElementById('btn-new-bed').addEventListener('click', async () => {
    document.getElementById('modal-bed-title').textContent = 'Add Bed';
    document.getElementById('bed-number').value = '';
    document.getElementById('bed-type').value   = 'General';
    document.getElementById('bed-status').value = 'available';
    const sel = document.getElementById('bed-hospital');
    sel.innerHTML = '<option value="">Loading…</option>';
    openModal('modal-bed');
    try {
        const hs = await apiFetch('/api/hospitals');
        sel.innerHTML = '<option value="">— Select Hospital —</option>';
        hs.forEach(h => sel.appendChild(new Option(h.hospital_name, h.hospital_id)));
    } catch { sel.innerHTML = '<option value="">Failed to load</option>'; }
});

document.getElementById('submit-bed').addEventListener('click', async () => {
    const hid    = document.getElementById('bed-hospital').value;
    const number = document.getElementById('bed-number').value.trim();
    const type   = document.getElementById('bed-type').value;
    if (!hid || !number) { toast('Hospital and bed number are required.', 'error'); return; }
    const btn = document.getElementById('submit-bed');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await apiFetch('/api/beds', {
            method: 'POST',
            body: JSON.stringify({
                hospital_id: parseInt(hid),
                bed_number:  number,
                bed_type:    type,
                status:      document.getElementById('bed-status').value,
            })
        });
        closeModal('modal-bed');
        toast(`Bed ${number} added.`);
        loadBedsList();
        // refresh hospital counters
        loadHospitals();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Bed'; }
});

// Add Doctor
document.getElementById('btn-new-doctor').addEventListener('click', async () => {
    document.getElementById('modal-doctor-title').textContent = 'Add Doctor';
    document.getElementById('doc-name').value  = '';
    document.getElementById('doc-avail').value = 'available';
    const sel = document.getElementById('doc-hospital');
    sel.innerHTML = '<option value="">Loading…</option>';
    openModal('modal-doctor');
    try {
        const hs = await apiFetch('/api/hospitals');
        sel.innerHTML = '<option value="">— Select Hospital —</option>';
        hs.forEach(h => sel.appendChild(new Option(h.hospital_name, h.hospital_id)));
    } catch { sel.innerHTML = '<option value="">Failed to load</option>'; }
});

document.getElementById('submit-doctor').addEventListener('click', async () => {
    const name  = document.getElementById('doc-name').value.trim();
    const hid   = document.getElementById('doc-hospital').value;
    const avail = document.getElementById('doc-avail').value;
    if (!name || !hid) { toast('Name and hospital are required.', 'error'); return; }
    const btn = document.getElementById('submit-doctor');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await apiFetch('/api/doctors', {
            method: 'POST',
            body: JSON.stringify({ name, hospital_id: parseInt(hid), availability: avail })
        });
        closeModal('modal-doctor');
        toast(`Dr. ${name} added.`);
        loadDoctors();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Doctor'; }
});

// CPU SCHEDULING
let schedResults = {};

async function loadSchedulingPage() {
    try {
        const s = await apiFetch('/api/scheduling/status');
        const badge = document.getElementById('sched-binary-badge');
        badge.innerHTML = s.built
            ? '<span class="badge st-available">✓ C Scheduler Ready (Member 4)</span>'
            : '<span class="badge st-maintenance">⚠ Not Built — run: cd c_modules && make</span>';
    } catch {}

    // Populate preset buttons with real active emergency IDs
    try {
        const emergencies = await apiFetch('/api/emergencies');
        const active    = emergencies.filter(e => !['discharged','cancelled'].includes(e.status));
        const critical  = active.filter(e => e.severity === 'critical' || e.priority === 1);
        const allIds    = active.map(e => e.emergency_id).join(',');
        const critIds   = critical.map(e => e.emergency_id).join(',');

        document.getElementById('sched-preset-all').onclick = () => {
            document.getElementById('algo-fcfs').checked     = true;
            document.getElementById('algo-priority').checked = true;
            document.getElementById('algo-rr').checked       = true;
            document.getElementById('rr-quantum').value      = '5';
            document.getElementById('sched-ids').value       = '';
            toast(`Running all active emergencies (${active.length} total).`, 'info');
        };
        document.getElementById('sched-preset-critical').onclick = () => {
            document.getElementById('algo-fcfs').checked     = true;
            document.getElementById('algo-priority').checked = true;
            document.getElementById('algo-rr').checked       = false;
            document.getElementById('sched-ids').value       = critIds;
            toast(`Loaded ${critical.length} critical emergency ID(s): ${critIds}`, 'info');
        };
        document.getElementById('sched-preset-rr').onclick = () => {
            document.getElementById('algo-fcfs').checked     = false;
            document.getElementById('algo-priority').checked = false;
            document.getElementById('algo-rr').checked       = true;
            document.getElementById('rr-quantum').value      = '3';
            document.getElementById('sched-ids').value       = allIds;
            toast(`Round Robin only, quantum=3, all active IDs: ${allIds}`, 'info');
        };
    } catch {}

    await loadSchedulingLogs();
}

async function loadSchedulingLogs() {
    try {
        const data = await apiFetch('/api/scheduling/logs');
        const tb = document.getElementById('sched-log-table');
        if (!data.length) { tb.innerHTML = '<tr class="tbl-empty"><td colspan="8">No scheduling runs yet.</td></tr>'; return; }
        tb.innerHTML = data.slice(0, 30).map(l => `
          <tr>
            <td>${mono('E' + l.emergency_id)}</td>
            <td><span style="font-size:12.5px;font-weight:600;">${l.algorithm}</span></td>
            <td style="font-size:12.5px;">${l.arrival_time}</td>
            <td style="font-size:12.5px;">${l.burst_time}</td>
            <td style="font-size:12.5px;">${l.waiting_time}</td>
            <td style="font-size:12.5px;">${l.turnaround_time}</td>
            <td style="font-size:12.5px;">${l.response_time}</td>
            <td style="font-size:12px;color:var(--gray-400);">${fmtDate(l.run_at)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

document.getElementById('run-scheduling').addEventListener('click', async () => {
    const algos = [];
    if (document.getElementById('algo-fcfs').checked)     algos.push('FCFS');
    if (document.getElementById('algo-priority').checked) algos.push('Priority');
    if (document.getElementById('algo-rr').checked)       algos.push('Round Robin');
    if (!algos.length) { toast('Select at least one algorithm.', 'error'); return; }

    const quantum = parseInt(document.getElementById('rr-quantum').value) || 5;
    const idsRaw  = document.getElementById('sched-ids').value.trim();
    const ids = idsRaw ? idsRaw.split(',').map(s => parseInt(s.trim())).filter(Boolean) : undefined;

    const btn = document.getElementById('run-scheduling');
    btn.disabled = true;
    btn.innerHTML = '<svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Running…';

    try {
        const r = await apiFetch('/api/scheduling/run', {
            method: 'POST',
            body: JSON.stringify({ algorithms: algos, quantum, emergency_ids: ids })
        });
        schedResults = r.results || {};
        document.getElementById('sched-empty-hint').style.display = 'none';
        document.getElementById('scheduling-results').style.display = 'block';

        // Activate first available tab
        const firstAlgo = algos[0];
        document.querySelectorAll('.sched-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.algo === firstAlgo);
            t.className = t.dataset.algo === firstAlgo ? 'btn btn-primary btn-sm sched-tab active' : 'btn btn-secondary btn-sm sched-tab';
        });
        renderSchedTab(firstAlgo);
        toast(`Scheduling complete — ${r.processes_count} emergencies processed.`);
        await loadSchedulingLogs();
    } catch (err) { toast(err.message, 'error'); }
    finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Run Scheduling';
    }
});

document.querySelectorAll('.sched-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sched-tab').forEach(b => {
            b.className = b === btn ? 'btn btn-primary btn-sm sched-tab active' : 'btn btn-secondary btn-sm sched-tab';
        });
        renderSchedTab(btn.dataset.algo);
    });
});

function renderSchedTab(algo) {
    const sec = schedResults[algo];
    const tb  = document.getElementById('sched-table');
    const av  = document.getElementById('sched-averages');
    const gantt = document.getElementById('gantt-chart');

    if (!sec) {
        tb.innerHTML = '<tr class="tbl-empty"><td colspan="7">No results for ' + algo + '</td></tr>';
        av.innerHTML = ''; gantt.innerHTML = ''; return;
    }

    // Averages
    av.innerHTML = `
      <div class="card card-sm" style="text-align:center;">
        <div style="font-size:22px;font-weight:800;color:var(--blue);">${sec.averages.avg_waiting_time?.toFixed(2) ?? '–'}</div>
        <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">Avg Waiting (min)</div>
      </div>
      <div class="card card-sm" style="text-align:center;">
        <div style="font-size:22px;font-weight:800;color:var(--green);">${sec.averages.avg_turnaround_time?.toFixed(2) ?? '–'}</div>
        <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">Avg Turnaround (min)</div>
      </div>
      <div class="card card-sm" style="text-align:center;">
        <div style="font-size:22px;font-weight:800;color:var(--purple);">${sec.averages.avg_response_time?.toFixed(2) ?? '–'}</div>
        <div style="font-size:11px;color:var(--gray-500);margin-top:2px;">Avg Response (min)</div>
      </div>`;

    // Gantt Chart
    if (sec.processes?.length) {
        const maxTime = Math.max(...sec.processes.map(p => p.completion_time));
        const colors = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2'];
        let ganttHtml = '';
        // Time labels
        ganttHtml += `<div class="gantt-row"><div class="gantt-label" style="font-size:10px;color:var(--gray-400);">Time</div>
          <div class="gantt-bar-wrap" style="background:none;">`;
        for (let t = 0; t <= maxTime; t += Math.max(1, Math.floor(maxTime / 8))) {
            ganttHtml += `<span class="gantt-time-label" style="position:absolute;left:${(t/maxTime)*100}%;font-size:10px;color:var(--gray-400);">${t}</span>`;
        }
        ganttHtml += '</div></div>';

        sec.processes.forEach((p, i) => {
            const start = p.completion_time - p.burst_time;
            const left  = (start / maxTime) * 100;
            const width = (p.burst_time / maxTime) * 100;
            const color = colors[i % colors.length];
            ganttHtml += `<div class="gantt-row">
              <div class="gantt-label">${p.id}</div>
              <div class="gantt-bar-wrap">
                <div class="gantt-block" style="left:${left}%;width:${width}%;background:${color};" title="${p.id}: ${start}→${p.completion_time} min">${width > 6 ? p.id : ''}</div>
              </div>
            </div>`;
        });
        gantt.innerHTML = ganttHtml;
    } else {
        gantt.innerHTML = '<p style="color:var(--gray-400);font-size:13px;">No process data.</p>';
    }

    // Table
    if (!sec.processes?.length) { tb.innerHTML = '<tr class="tbl-empty"><td colspan="7">No process data</td></tr>'; return; }
    tb.innerHTML = sec.processes.map(p => `
      <tr>
        <td>${mono(p.id)}</td>
        <td style="font-size:12.5px;">${p.arrival_time}</td>
        <td style="font-size:12.5px;">${p.burst_time}</td>
        <td style="font-size:12.5px;font-weight:600;">${p.completion_time}</td>
        <td style="font-size:12.5px;">${p.waiting_time}</td>
        <td style="font-size:12.5px;">${p.turnaround_time}</td>
        <td style="font-size:12.5px;">${p.response_time}</td>
      </tr>`).join('');
}

// BANKER'S ALGORITHM
async function loadBankerPage() {
    try {
        const r = await apiFetch('/api/resources/status');
        const badge = document.getElementById('res-binary-badge');
        badge.innerHTML = r.built
            ? '<span class="badge st-available">✓ C++ Resource Manager Ready (Member 5)</span>'
            : '<span class="badge st-maintenance">⚠ Not Built — run: cd c_modules && make</span>';
    } catch {}

    // Populate preset buttons with real pending emergency + available resource IDs
    try {
        const [emergencies, beds, doctors, ambulances] = await Promise.all([
            apiFetch('/api/emergencies'),
            apiFetch('/api/beds?status=available'),
            apiFetch('/api/doctors?availability=available'),
            apiFetch('/api/ambulances'),
        ]);
        const pending  = emergencies.find(e => e.status === 'pending');
        const freeBed  = beds[0];
        const freeDoc  = doctors[0];
        const freeAmb  = ambulances.find(a => a.status === 'available');

        document.getElementById('banker-preset-bed').onclick = () => {
            if (!pending || !freeBed) { toast('No pending emergency or available bed found.', 'error'); return; }
            document.getElementById('res-emergency-id').value = pending.emergency_id;
            document.getElementById('res-type').value         = 'BED';
            document.getElementById('res-resource-id').value  = freeBed.bed_id;
            document.getElementById('res-hospital-id').value  = freeBed.hospital_id;
            document.getElementById('res-result').style.display = 'none';
            toast(`Loaded: E${pending.emergency_id} → Bed ${freeBed.bed_number} (${freeBed.hospital_name})`, 'info');
        };
        document.getElementById('banker-preset-doc').onclick = () => {
            if (!pending || !freeDoc) { toast('No pending emergency or available doctor found.', 'error'); return; }
            document.getElementById('res-emergency-id').value = pending.emergency_id;
            document.getElementById('res-type').value         = 'DOCTOR';
            document.getElementById('res-resource-id').value  = freeDoc.doctor_id;
            document.getElementById('res-hospital-id').value  = freeDoc.hospital_id;
            document.getElementById('res-result').style.display = 'none';
            toast(`Loaded: E${pending.emergency_id} → Dr. ${freeDoc.name} (${freeDoc.hospital_name})`, 'info');
        };
        document.getElementById('banker-preset-amb').onclick = () => {
            if (!pending || !freeAmb) { toast('No pending emergency or available ambulance found.', 'error'); return; }
            document.getElementById('res-emergency-id').value = pending.emergency_id;
            document.getElementById('res-type').value         = 'AMBULANCE';
            document.getElementById('res-resource-id').value  = freeAmb.ambulance_id;
            document.getElementById('res-hospital-id').value  = -1;
            document.getElementById('res-result').style.display = 'none';
            toast(`Loaded: E${pending.emergency_id} → Ambulance ${freeAmb.vehicle_number}`, 'info');
        };
    } catch {}

    await loadBankerLogs();
}

async function loadBankerLogs() {
    try {
        const data = await apiFetch('/api/resources/logs');
        const tb = document.getElementById('resources-table');
        if (!data.length) { tb.innerHTML = '<tr class="tbl-empty"><td colspan="7">No allocation logs yet.</td></tr>'; return; }
        tb.innerHTML = data.slice(0, 50).map(l => `
          <tr>
            <td>${mono('#' + l.log_id)}</td>
            <td>${mono('E' + l.emergency_id)}</td>
            <td style="font-size:12.5px;font-weight:600;">${l.resource_type}</td>
            <td style="font-size:12.5px;">${mono(l.resource_id)}</td>
            <td>${statusBadge(l.state)}</td>
            <td style="font-size:12px;color:var(--gray-500);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.decision_reason || '—'}</td>
            <td style="font-size:12px;color:var(--gray-400);">${fmtDate(l.datetime)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

document.getElementById('btn-request-resource').addEventListener('click', async () => {
    const eid   = document.getElementById('res-emergency-id').value;
    const rtype = document.getElementById('res-type').value;
    const rid   = document.getElementById('res-resource-id').value;
    const hid   = document.getElementById('res-hospital-id').value || -1;
    if (!eid || !rid) { toast('Emergency ID and Resource ID are required.', 'error'); return; }
    const rd = document.getElementById('res-result');
    const btn = document.getElementById('btn-request-resource');
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
        const r = await apiFetch('/api/resources/request', {
            method: 'POST',
            body: JSON.stringify({ emergency_id: +eid, resource_type: rtype, resource_id: +rid, hospital_id: +hid })
        });
        const styles = {
            APPROVED: 'background:#f0fdf4;border:1px solid #bbf7d0;color:var(--green);',
            WAITING:  'background:#fffbeb;border:1px solid #fde68a;color:var(--amber);',
            REJECTED: 'background:#fef2f2;border:1px solid #fca5a5;color:var(--red);',
        };
        const icons = { APPROVED: '✓', WAITING: '⏳', REJECTED: '✕' };
        const st = styles[r.decision] || styles.REJECTED;
        rd.style.display = 'block';
        rd.innerHTML = `<div style="${st} padding:14px 16px;border-radius:10px;">
          <div style="font-size:15px;font-weight:800;margin-bottom:4px;">${icons[r.decision] || '?'} ${r.decision}</div>
          <div style="font-size:12.5px;opacity:.85;">${r.reason || 'No reason provided'}</div></div>`;
        loadBankerLogs();
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px 14px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    }
    finally { btn.disabled = false; btn.textContent = 'Request'; }
});

document.getElementById('btn-release-resource').addEventListener('click', async () => {
    const eid   = document.getElementById('res-emergency-id').value;
    const rtype = document.getElementById('res-type').value;
    const rid   = document.getElementById('res-resource-id').value;
    if (!rid) { toast('Resource ID is required.', 'error'); return; }
    try {
        await apiFetch('/api/resources/release', {
            method: 'POST',
            body: JSON.stringify({ emergency_id: eid ? +eid : undefined, resource_type: rtype, resource_id: +rid })
        });
        toast('Resource released.');
        loadBankerLogs();
    } catch (err) { toast(err.message, 'error'); }
});

// DEADLOCK DETECTION
async function loadDeadlockPage() {
    try {
        const r = await apiFetch('/api/resources/status');
        const badge = document.getElementById('deadlock-binary-badge');
        badge.innerHTML = r.built
            ? '<span class="badge st-available">✓ C++ Resource Manager Ready (Member 5)</span>'
            : '<span class="badge st-not_available">⚠ Not Built — run: cd c_modules && make</span>';
    } catch {}
    // Seed with safe example on first load if table is empty
    if (!document.getElementById('dl-alloc-rows').children.length) {
        dlLoadPreset('safe');
    }
}

// Deadlock edge table helpers

function dlAddAllocRow(from = '', to = '') {
    const tbody = document.getElementById('dl-alloc-rows');
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-100)';
    tr.innerHTML = `
      <td style="padding:5px 8px;">
        <input type="text" class="inp dl-alloc-from" value="${from}" placeholder="R-Amb-1"
               style="padding:5px 8px;font-size:12px;font-family:monospace;"/>
      </td>
      <td style="padding:5px 8px;">
        <input type="text" class="inp dl-alloc-to" value="${to}" placeholder="E-1"
               style="padding:5px 8px;font-size:12px;font-family:monospace;"/>
      </td>
      <td style="padding:5px 6px;text-align:center;">
        <button type="button" class="btn btn-xs" style="background:#fef2f2;color:var(--red);padding:3px 7px;"
                onclick="this.closest('tr').remove()">✕</button>
      </td>`;
    tbody.appendChild(tr);
}

function dlAddReqRow(from = '', to = '') {
    const tbody = document.getElementById('dl-req-rows');
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-100)';
    tr.innerHTML = `
      <td style="padding:5px 8px;">
        <input type="text" class="inp dl-req-from" value="${from}" placeholder="E-1"
               style="padding:5px 8px;font-size:12px;font-family:monospace;"/>
      </td>
      <td style="padding:5px 8px;">
        <input type="text" class="inp dl-req-to" value="${to}" placeholder="R-Bed-2"
               style="padding:5px 8px;font-size:12px;font-family:monospace;"/>
      </td>
      <td style="padding:5px 6px;text-align:center;">
        <button type="button" class="btn btn-xs" style="background:#fef2f2;color:var(--red);padding:3px 7px;"
                onclick="this.closest('tr').remove()">✕</button>
      </td>`;
    tbody.appendChild(tr);
}

function dlLoadPreset(type) {
    document.getElementById('dl-alloc-rows').innerHTML = '';
    document.getElementById('dl-req-rows').innerHTML = '';
    document.getElementById('deadlock-result').style.display = 'none';

    if (type === 'safe') {
        // E-1 holds Amb-1, E-2 holds Bed-2. E-1 waits for Amb-2 (not held), E-2 waits for Bed-3 (not held) — no cycle
        dlAddAllocRow('R-Amb-1', 'E-1');
        dlAddAllocRow('R-Bed-2', 'E-2');
        dlAddReqRow('E-1', 'R-Amb-2');
        dlAddReqRow('E-2', 'R-Bed-3');
        toast('Loaded safe scenario — no circular wait.', 'info');
    } else if (type === 'deadlock') {
        // E-1 holds Amb-1, waits for Bed-2. E-2 holds Bed-2, waits for Amb-1 — circular!
        dlAddAllocRow('R-Amb-1', 'E-1');
        dlAddAllocRow('R-Bed-2', 'E-2');
        dlAddReqRow('E-1', 'R-Bed-2');
        dlAddReqRow('E-2', 'R-Amb-1');
        toast('Loaded deadlock scenario — circular wait between E-1 and E-2.', 'info');
    }
}

function dlCollectEdges() {
    const allocEdges = [];
    document.querySelectorAll('#dl-alloc-rows tr').forEach(tr => {
        const from = tr.querySelector('.dl-alloc-from')?.value.trim();
        const to   = tr.querySelector('.dl-alloc-to')?.value.trim();
        if (from && to) allocEdges.push({ from, to });
    });
    const reqEdges = [];
    document.querySelectorAll('#dl-req-rows tr').forEach(tr => {
        const from = tr.querySelector('.dl-req-from')?.value.trim();
        const to   = tr.querySelector('.dl-req-to')?.value.trim();
        if (from && to) reqEdges.push({ from, to });
    });
    return { allocEdges, reqEdges };
}

document.getElementById('btn-dl-add-alloc').addEventListener('click', () => dlAddAllocRow());
document.getElementById('btn-dl-add-req').addEventListener('click', () => dlAddReqRow());
document.getElementById('btn-deadlock-safe').addEventListener('click', () => dlLoadPreset('safe'));
document.getElementById('btn-deadlock-preset-deadlock').addEventListener('click', () => dlLoadPreset('deadlock'));
document.getElementById('btn-deadlock-clear').addEventListener('click', () => {
    document.getElementById('dl-alloc-rows').innerHTML = '';
    document.getElementById('dl-req-rows').innerHTML = '';
    document.getElementById('deadlock-result').style.display = 'none';
});

document.getElementById('btn-detect-deadlock').addEventListener('click', async () => {
    const { allocEdges: allocationEdges, reqEdges: requestEdges } = dlCollectEdges();
    if (!allocationEdges.length && !requestEdges.length) {
        toast('Add at least one edge before running detection.', 'error'); return;
    }
    const rd = document.getElementById('deadlock-result');
    const btn = document.getElementById('btn-detect-deadlock');
    btn.disabled = true; btn.textContent = 'Detecting…';
    try {
        const r = await apiFetch('/api/resources/deadlock', {
            method: 'POST',
            body: JSON.stringify({ allocationEdges, requestEdges })
        });
        const isDeadlock = r.deadlockDetected;
        rd.style.display = 'block';
        rd.innerHTML = `<div style="${isDeadlock
            ? 'background:#fef2f2;border:1px solid #fca5a5;color:var(--red);'
            : 'background:#f0fdf4;border:1px solid #bbf7d0;color:var(--green);'
        }padding:14px 16px;border-radius:10px;">
          <div style="font-size:15px;font-weight:800;margin-bottom:6px;">${isDeadlock ? '⚠ DEADLOCK DETECTED' : '✓ NO DEADLOCK — System Safe'}</div>
          <div style="font-size:12.5px;opacity:.85;margin-bottom:8px;">${r.message}</div>
          <div style="font-size:12px;opacity:.7;">Allocation edges: ${r.allocationEdges} &nbsp;|&nbsp; Request edges: ${r.requestEdges}</div>
        </div>`;
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px 14px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Run Detection';
    }
});

// STARVATION & AGING
async function loadStarvationPage() {
    try {
        const r = await apiFetch('/api/resources/status');
        const badge = document.getElementById('starvation-binary-badge');
        badge.innerHTML = r.built
            ? '<span class="badge st-available">✓ C++ Resource Manager Ready (Member 5)</span>'
            : '<span class="badge st-not_available">⚠ Not Built — run: cd c_modules && make</span>';
    } catch {}
    // Seed table on first load
    if (!document.getElementById('starv-req-rows').children.length) {
        starvLoadPreset('normal');
    }
}

// Starvation row helpers

const STARV_RESOURCE_TYPES = ['AMBULANCE', 'BED', 'DOCTOR'];

function starvAddRow(emergencyId = '', resourceId = '', resourceType = 'AMBULANCE', basePriority = 3) {
    const tbody = document.getElementById('starv-req-rows');
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-100)';
    const typeOptions = STARV_RESOURCE_TYPES.map(t =>
        `<option value="${t}" ${t === resourceType ? 'selected' : ''}>${t}</option>`
    ).join('');
    const priorityOptions = [1,2,3,4].map(p =>
        `<option value="${p}" ${p == basePriority ? 'selected' : ''}>${p}${p===1?' (Critical)':p===4?' (Minor)':''}</option>`
    ).join('');
    tr.innerHTML = `
      <td style="padding:5px 8px;">
        <input type="number" class="inp starv-eid" value="${emergencyId}" min="1" placeholder="1"
               style="padding:5px 8px;font-size:12px;width:60px;"/>
      </td>
      <td style="padding:5px 8px;">
        <input type="number" class="inp starv-rid" value="${resourceId}" min="1" placeholder="1"
               style="padding:5px 8px;font-size:12px;width:60px;"/>
      </td>
      <td style="padding:5px 8px;">
        <select class="inp starv-rtype" style="padding:5px 8px;font-size:12px;">${typeOptions}</select>
      </td>
      <td style="padding:5px 8px;">
        <select class="inp starv-prio" style="padding:5px 8px;font-size:12px;width:110px;">${priorityOptions}</select>
      </td>
      <td style="padding:5px 6px;text-align:center;">
        <button type="button" class="btn btn-xs" style="background:#fef2f2;color:var(--red);padding:3px 7px;"
                onclick="this.closest('tr').remove()">✕</button>
      </td>`;
    tbody.appendChild(tr);
}

function starvLoadPreset(type) {
    document.getElementById('starv-req-rows').innerHTML = '';
    document.getElementById('starvation-result').style.display = 'none';

    if (type === 'normal') {
        starvAddRow(1, 1, 'AMBULANCE', 2);
        starvAddRow(2, 2, 'BED',       3);
        starvAddRow(3, 3, 'DOCTOR',    1);
        document.getElementById('starv-ticks').value = '5';
        toast('Loaded normal queue — mix of priorities, 5 ticks.', 'info');
    } else if (type === 'starvation') {
        // Low priority request that will starve without aging
        starvAddRow(1, 1, 'AMBULANCE', 1); // Critical — always gets served
        starvAddRow(2, 2, 'BED',       1); // Critical
        starvAddRow(3, 3, 'DOCTOR',    4); // Minor — will starve, needs aging
        starvAddRow(4, 4, 'AMBULANCE', 4); // Minor
        document.getElementById('starv-ticks').value = '9';
        toast('Loaded starvation scenario — run 9 ticks to watch aging boost E-3 and E-4.', 'info');
    }
}

function starvCollectRequests() {
    const requests = [];
    document.querySelectorAll('#starv-req-rows tr').forEach(tr => {
        const eid   = parseInt(tr.querySelector('.starv-eid')?.value);
        const rid   = parseInt(tr.querySelector('.starv-rid')?.value);
        const rtype = tr.querySelector('.starv-rtype')?.value;
        const prio  = parseInt(tr.querySelector('.starv-prio')?.value);
        if (eid && rid && rtype && prio) {
            requests.push({ emergency_id: eid, resource_id: rid, resource_type: rtype, basePriority: prio });
        }
    });
    return requests;
}

document.getElementById('btn-starv-add-row').addEventListener('click', () => starvAddRow());
document.getElementById('btn-starv-preset-normal').addEventListener('click', () => starvLoadPreset('normal'));
document.getElementById('btn-starv-preset-starvation').addEventListener('click', () => starvLoadPreset('starvation'));
document.getElementById('btn-starv-clear').addEventListener('click', () => {
    document.getElementById('starv-req-rows').innerHTML = '';
    document.getElementById('starvation-result').style.display = 'none';
});

document.getElementById('btn-run-starvation').addEventListener('click', async () => {
    const waitingRequests = starvCollectRequests();
    if (!waitingRequests.length) { toast('Add at least one waiting request.', 'error'); return; }
    const ticks  = parseInt(document.getElementById('starv-ticks').value, 10) || 5;
    const rd = document.getElementById('starvation-result');
    const btn = document.getElementById('btn-run-starvation');
    btn.disabled = true; btn.textContent = 'Simulating…';
    try {
        const r = await apiFetch('/api/resources/starvation-tick', {
            method: 'POST',
            body: JSON.stringify({ waitingRequests, ticks })
        });
        rd.style.display = 'block';
        const headerColor = r.starvationDetected ? 'var(--amber)' : 'var(--green)';
        const headerBg    = r.starvationDetected ? 'var(--amber-light)' : 'var(--green-light)';
        const headerBorder= r.starvationDetected ? '#fde68a' : '#bbf7d0';
        let html = `<div style="background:${headerBg};border:1px solid ${headerBorder};border-radius:10px;padding:12px 14px;margin-bottom:12px;">
          <div style="font-weight:700;font-size:13.5px;color:${headerColor};margin-bottom:4px;">
            ${r.starvationDetected ? '⚠ Starvation Detected — aging applied' : '✓ No Starvation After ' + r.ticks + ' Tick(s)'}
          </div>
          <div style="font-size:12px;color:var(--gray-600);">After <strong>${r.ticks}</strong> tick(s) · <strong>${r.queueSize}</strong> request(s) in queue</div>
        </div>`;
        if (r.queue && r.queue.length) {
            html += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
              <th>Emergency</th><th>Resource</th><th>Type</th><th>Base Priority</th><th>Effective Priority</th><th>Wait Ticks</th>
            </tr></thead><tbody>`;
            html += r.queue.map(q => {
                const boosted = q.effectivePriority < q.basePriority;
                return `<tr>
                  <td>${mono('E' + q.emergency_id)}</td>
                  <td>${mono('#' + q.resource_id)}</td>
                  <td style="font-size:12px;">${q.resource_type}</td>
                  <td style="text-align:center;">${q.basePriority}</td>
                  <td style="text-align:center;font-weight:700;color:${boosted ? 'var(--green)' : 'var(--gray-600)'};">${q.effectivePriority}${boosted ? ' ↑' : ''}</td>
                  <td style="text-align:center;">${q.waiting_time}</td>
                </tr>`;
            }).join('');
            html += '</tbody></table></div>';
        }
        rd.innerHTML = html;
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px 14px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Run Simulation'; }
});

// SYNCHRONIZATION — SEMAPHORE DEMO
async function loadSyncPage() {
    try {
        const r = await apiFetch('/api/resources/status');
        const badge = document.getElementById('sync-binary-badge');
        badge.innerHTML = r.built
            ? '<span class="badge st-available">✓ C++ Resource Manager Ready (Member 5)</span>'
            : '<span class="badge st-not_available">⚠ Not Built — run: cd c_modules && make</span>';
    } catch {}
}

// Semaphore preset buttons
document.getElementById('btn-sem-preset-low').addEventListener('click', () => {
    document.getElementById('sem-permits').value = '3';
    document.getElementById('sem-threads').value = '5';
    document.getElementById('semaphore-result').style.display = 'none';
    toast('Low load: 3 permits, 5 threads.', 'info');
});
document.getElementById('btn-sem-preset-high').addEventListener('click', () => {
    document.getElementById('sem-permits').value = '2';
    document.getElementById('sem-threads').value = '20';
    document.getElementById('semaphore-result').style.display = 'none';
    toast('High load: 2 permits, 20 threads — watch the queue build up.', 'info');
});
document.getElementById('btn-sem-preset-exact').addEventListener('click', () => {
    document.getElementById('sem-permits').value = '5';
    document.getElementById('sem-threads').value = '5';
    document.getElementById('semaphore-result').style.display = 'none';
    toast('Exact match: permits = threads, everyone fits at once.', 'info');
});

document.getElementById('btn-run-semaphore').addEventListener('click', async () => {
    const permits    = parseInt(document.getElementById('sem-permits').value, 10)  || 3;
    const numThreads = parseInt(document.getElementById('sem-threads').value, 10) || 10;
    const rd  = document.getElementById('semaphore-result');
    const btn = document.getElementById('btn-run-semaphore');
    btn.disabled = true; btn.textContent = 'Running…';
    try {
        const r = await apiFetch('/api/resources/semaphore', {
            method: 'POST',
            body: JSON.stringify({ permits, numThreads })
        });
        const passed = r.peakConcurrent <= r.permits;
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:${passed ? '#f0fdf4' : '#fef2f2'};border:1px solid ${passed ? '#bbf7d0' : '#fca5a5'};border-radius:10px;padding:16px;">
          <div style="font-size:15px;font-weight:800;margin-bottom:10px;color:${passed ? 'var(--green)' : 'var(--red)'};">
            ${passed ? '✓ Semaphore Enforced Correctly' : '✕ Concurrency Violation'}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px;">
            <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:var(--blue);">${r.permits}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;">Permits</div>
            </div>
            <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:var(--purple);">${r.numThreads}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;">Total Threads</div>
            </div>
            <div style="background:rgba(255,255,255,.7);border-radius:8px;padding:12px;text-align:center;">
              <div style="font-size:22px;font-weight:800;color:${passed ? 'var(--green)' : 'var(--red)'};">${r.peakConcurrent}</div>
              <div style="font-size:11.5px;color:var(--gray-500);margin-top:2px;">Peak Concurrent</div>
            </div>
          </div>
          <div style="font-size:12.5px;color:var(--gray-600);">${r.message}</div>
        </div>`;
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px 14px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Run Simulation'; }
});

// OS LAB DEMO

// OS LAB DEMO

const DEMO_MAX = 5;
const DEMO_LABELS  = ['A','B','C','D','E'];
const DEMO_COLORS  = ['var(--red)','var(--amber)','var(--green)','var(--blue)','var(--purple)'];
const DEMO_DEFAULTS = [
    { name: 'Suresh Kumar',  sev: 'critical' },
    { name: 'Priya Sharma',  sev: 'moderate' },
    { name: 'Rahul Verma',   sev: 'serious'  },
    { name: 'Anita Negi',    sev: 'minor'    },
    { name: 'Deepak Rawat',  sev: 'serious'  },
];

// State
let _demoEmergencies = [];   // array of { emergency_id, severity, priority, patient }
let _demoCount = 2;          // how many cards are currently shown
let _demoLocations = [];     // cached locations

function setPill(step) {
    for (let i = 1; i <= 5; i++) {
        const p = document.getElementById(`pill-${i}`);
        if (!p) continue;
        if (i < step)       { p.style.background = 'var(--green)'; p.style.color = '#fff'; }
        else if (i === step){ p.style.background = 'var(--blue)';  p.style.color = '#fff'; }
        else                { p.style.background = 'var(--gray-100)'; p.style.color = 'var(--gray-400)'; }
    }
}

function renderDemoCards() {
    const container = document.getElementById('demo-emg-list');
    const countLabel = document.getElementById('demo-emg-count-label');
    const addBtn = document.getElementById('btn-demo-add-emg');

    container.innerHTML = '';
    for (let i = 0; i < _demoCount; i++) {
        const lbl   = DEMO_LABELS[i];
        const col   = DEMO_COLORS[i];
        const def   = DEMO_DEFAULTS[i];
        const locOpts = _demoLocations.map((l, idx) =>
            `<option value="${l.location_id}" ${idx === i % _demoLocations.length ? 'selected' : ''}>${l.location_name}</option>`
        ).join('');

        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = `border:2px solid ${col};position:relative;`;
        card.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="background:${col};color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;">${lbl}</span>
              <h4 style="font-size:13px;font-weight:700;color:var(--gray-800);">Emergency ${lbl}</h4>
            </div>
            ${i >= 2 ? `<button class="btn btn-xs" style="background:#fef2f2;color:var(--red);" onclick="removeDemoCard(${i})">✕</button>` : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <label class="lbl">Patient Name *</label>
              <input id="demo-name-${i}" type="text" class="inp" value="${def.name}" style="margin-top:5px;"/>
            </div>
            <div>
              <label class="lbl">Severity *</label>
              <select id="demo-sev-${i}" class="inp" style="margin-top:5px;">
                <option value="critical" ${def.sev==='critical'?'selected':''}>🔴 Critical (Priority 1)</option>
                <option value="serious"  ${def.sev==='serious' ?'selected':''}>🟠 Serious (Priority 2)</option>
                <option value="moderate" ${def.sev==='moderate'?'selected':''}>🟡 Moderate (Priority 3)</option>
                <option value="minor"    ${def.sev==='minor'   ?'selected':''}>🟢 Minor (Priority 4)</option>
              </select>
            </div>
            <div>
              <label class="lbl">Pickup Location *</label>
              <select id="demo-loc-${i}" class="inp" style="margin-top:5px;">${locOpts}</select>
            </div>
          </div>`;
        container.appendChild(card);
    }

    countLabel.textContent = `${_demoCount} emergency${_demoCount > 1 ? 'ies' : 'y'}`;
    addBtn.disabled = _demoCount >= DEMO_MAX;
    addBtn.style.opacity = _demoCount >= DEMO_MAX ? '.4' : '1';
    if (_demoCount >= DEMO_MAX) addBtn.title = 'Maximum 5 emergencies';
}

window.removeDemoCard = function(idx) {
    if (_demoCount <= 2) { toast('Minimum 2 emergencies required.', 'error'); return; }
    _demoCount--;
    // Shift defaults down from idx
    for (let i = idx; i < DEMO_MAX - 1; i++) DEMO_DEFAULTS[i] = DEMO_DEFAULTS[i + 1];
    renderDemoCards();
};

async function loadOsDemoPage() {
    _demoEmergencies = [];
    _demoCount = 2;
    setPill(1);

    document.getElementById('os-step-1').style.display = 'block';
    ['os-step-2','os-step-3','os-step-4','os-step-5'].forEach(id =>
        document.getElementById(id).style.display = 'none'
    );
    document.getElementById('demo-create-result').style.display = 'none';
    ['demo-sched-result','demo-banker-result','demo-deadlock-result','demo-starv-result'].forEach(id =>
        document.getElementById(id).style.display = 'none'
    );

    // Load locations once
    if (!_demoLocations.length) {
        try { _demoLocations = await getLocations(); } catch {}
    }
    renderDemoCards();
}

document.getElementById('btn-demo-add-emg').addEventListener('click', () => {
    if (_demoCount >= DEMO_MAX) return;
    _demoCount++;
    renderDemoCards();
    toast(`Emergency ${DEMO_LABELS[_demoCount - 1]} added.`, 'info');
});

// Step 1: Create all emergencies
document.getElementById('btn-demo-create').addEventListener('click', async () => {
    const entries = [];
    for (let i = 0; i < _demoCount; i++) {
        const name = document.getElementById(`demo-name-${i}`)?.value.trim();
        const sev  = document.getElementById(`demo-sev-${i}`)?.value;
        const loc  = document.getElementById(`demo-loc-${i}`)?.value;
        if (!name || !loc) { toast(`Fill in all fields for Emergency ${DEMO_LABELS[i]}.`, 'error'); return; }
        entries.push({ name, sev, loc: Number(loc), label: DEMO_LABELS[i], color: DEMO_COLORS[i] });
    }

    const btn = document.getElementById('btn-demo-create');
    btn.disabled = true;
    btn.innerHTML = '<svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Dispatching…';

    try {
        // Fire sequentially so each dispatch sees the updated resource state from the previous one
        const results = [];
        for (const e of entries) {
            try {
                const r = await apiFetch('/api/emergencies/quick-dispatch', {
                    method: 'POST',
                    body: JSON.stringify({ patient_name: e.name, severity: e.sev, pickup_location_id: e.loc })
                });
                results.push({ ok: true, data: r, entry: e });
            } catch (err) {
                results.push({ ok: false, error: err.message, entry: e });
            }
        }

        const succeeded = results.filter(r => r.ok);
        const failed    = results.filter(r => !r.ok);

        if (succeeded.length === 0) {
            toast('All emergencies failed to dispatch. Check resource availability.', 'error');
            return;
        }

        _demoEmergencies = succeeded.map(r => ({
            emergency_id: r.data.emergency_id,
            severity:     r.data.severity,
            priority:     r.data.priority,
            patient:      r.data.patient,
            label:        r.entry.label,
            color:        r.entry.color,
            bed_id:       r.data.bed?.bed_id       || null,
            doctor_id:    r.data.doctor?.doctor_id || null,
            hospital_id:  r.data.hospital?.hospital_id || -1,
        }));

        const sevColors = { critical:'#b91c1c', serious:'#c2410c', moderate:'#92400e', minor:'#15803d' };
        const rd = document.getElementById('demo-create-result');
        rd.style.display = 'block';
        rd.innerHTML = `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:10px;">
            ${results.map(r => r.ok ? `
            <div style="background:var(--gray-50);border:1px solid #bbf7d0;border-radius:10px;padding:12px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <span style="background:${r.entry.color};color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${r.entry.label}</span>
                <span style="font-weight:700;font-size:13px;color:var(--gray-900);">E${r.data.emergency_id} — ${r.data.patient.name}</span>
              </div>
              <div style="font-size:12px;color:var(--gray-600);display:flex;flex-direction:column;gap:3px;">
                <div>Severity: <strong style="color:${sevColors[r.data.severity]};text-transform:capitalize;">${r.data.severity}</strong> · P${r.data.priority}</div>
                <div>🚑 ${r.data.ambulance.vehicle_number}</div>
                <div>🏥 ${r.data.hospital.hospital_name}</div>
                <div>🛏 ${r.data.bed.bed_number}</div>
              </div>
            </div>` : `
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <span style="background:var(--gray-400);color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;">${r.entry.label}</span>
                <span style="font-weight:700;font-size:13px;color:var(--red);">Emergency ${r.entry.label} — Failed</span>
              </div>
              <div style="font-size:12px;color:var(--red);opacity:.85;">✕ ${r.error}</div>
              <div style="font-size:11.5px;color:var(--gray-400);margin-top:4px;">Not created — no resources available or conflict.</div>
            </div>`).join('')}
          </div>
          ${failed.length > 0 ? `
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:12.5px;color:#c2410c;">
            ⚠ ${failed.length} emergency${failed.length > 1 ? 'ies' : 'y'} could not be dispatched (insufficient resources). The ${succeeded.length} successful one${succeeded.length > 1 ? 's' : ''} will proceed through the OS modules.
          </div>` : ''}
          <div style="background:var(--green-light);border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#166534;">
            ✓ ${succeeded.length} emergency${succeeded.length > 1 ? 'ies' : 'y'} dispatched simultaneously (${succeeded.map(r=>'E'+r.data.emergency_id).join(', ')}). Now run each OS module below.
          </div>`;

        document.getElementById('os-step-2').style.display = 'block';
        setPill(2);
        if (failed.length > 0)
            toast(`${succeeded.length} dispatched, ${failed.length} failed — insufficient resources.`, 'info');
        else
            toast(`${succeeded.length} emergencies dispatched!`, 'success');
        loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
    finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Create All Emergencies Simultaneously';
    }
});

// Step 2: CPU Scheduling
document.getElementById('btn-demo-schedule').addEventListener('click', async () => {
    if (!_demoEmergencies.length) return;
    const btn = document.getElementById('btn-demo-schedule');
    btn.disabled = true; btn.textContent = 'Running…';
    const rd = document.getElementById('demo-sched-result');
    try {
        const ids = _demoEmergencies.map(e => e.emergency_id);
        const r = await apiFetch('/api/scheduling/run', {
            method: 'POST',
            body: JSON.stringify({ emergency_ids: ids, algorithms: ['FCFS','Priority','Round Robin'], quantum: 5 })
        });

        rd.style.display = 'block';
        const algoColors = { FCFS: 'var(--blue)', Priority: 'var(--red)', 'Round Robin': 'var(--purple)' };
        const algoDesc = {
            FCFS: 'Served in creation order — no priority considered.',
            Priority: 'Higher severity served first — critical before moderate.',
            'Round Robin': '5-min CPU slices shared equally between all emergencies.',
        };

        let html = '<div style="display:flex;flex-direction:column;gap:12px;">';
        for (const algo of ['FCFS','Priority','Round Robin']) {
            const sec = r.results[algo];
            if (!sec) continue;
            html += `<div style="border:1px solid var(--gray-200);border-radius:8px;overflow:hidden;">
              <div style="background:var(--gray-50);padding:9px 14px;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12.5px;font-weight:700;color:${algoColors[algo]};">${algo}</span>
                <span style="font-size:11.5px;color:var(--gray-500);">Avg wait: ${sec.averages.avg_waiting_time?.toFixed(1) ?? '–'} min &nbsp;|&nbsp; ${algoDesc[algo]}</span>
              </div>
              <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                <thead><tr style="background:var(--gray-50);">
                  <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--gray-500);">Process</th>
                  <th style="padding:6px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--gray-500);">Burst</th>
                  <th style="padding:6px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--gray-500);">Waiting</th>
                  <th style="padding:6px 12px;text-align:center;font-size:11px;font-weight:700;color:var(--gray-500);">Turnaround</th>
                </tr></thead><tbody>
                ${sec.processes.map(p => `<tr style="border-top:1px solid var(--gray-100);">
                  <td style="padding:7px 12px;font-weight:600;">${p.id}</td>
                  <td style="padding:7px 12px;text-align:center;">${p.burst_time} min</td>
                  <td style="padding:7px 12px;text-align:center;color:${p.waiting_time > 0 ? 'var(--amber)' : 'var(--green)'};">${p.waiting_time} min</td>
                  <td style="padding:7px 12px;text-align:center;">${p.turnaround_time} min</td>
                </tr>`).join('')}
              </tbody></table>
            </div>`;
        }
        html += '</div>';
        rd.innerHTML = html;

        document.getElementById('os-step-3').style.display = 'block';
        setPill(3);
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Run Scheduling →'; }
});

// Step 3: Banker's Algorithm
document.getElementById('btn-demo-banker').addEventListener('click', async () => {
    if (!_demoEmergencies.length) return;
    const btn = document.getElementById('btn-demo-banker');
    btn.disabled = true; btn.textContent = 'Running…';
    const rd = document.getElementById('demo-banker-result');
    try {
        const [allBeds, allDoctors] = await Promise.all([
            apiFetch('/api/beds?status=available'),
            apiFetch('/api/doctors?availability=available'),
        ]);

        // Each emergency requests a fresh available bed + doctor it does NOT yet hold.
        // We pick unique resources by index so no two emergencies request the same one.
        // This gives the Banker's algorithm a real concurrent allocation scenario to evaluate.
        if (!allBeds.length && !allDoctors.length) {
            rd.style.display = 'block';
            rd.innerHTML = `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;font-size:13px;color:#c2410c;">
              No available beds or doctors left — all resources are occupied by the demo emergencies.
              Run <strong>Clean Up Demo Data</strong> to release them, then retry.
            </div>`;
            document.getElementById('os-step-4').style.display = 'block';
            setPill(4);
            return;
        }

        const requests = [];
        _demoEmergencies.forEach((e, i) => {
            // Round-robin through free resources — guaranteed different index per emergency
            const bed    = allBeds[i % allBeds.length];
            const doctor = allDoctors[i % allDoctors.length];
            if (bed)
                requests.push({
                    label: `E${e.emergency_id} requests Bed ${bed.bed_number}`,
                    eid: e.emergency_id, rtype: 'BED',
                    rid: bed.bed_id, hid: bed.hospital_id
                });
            if (doctor)
                requests.push({
                    label: `E${e.emergency_id} requests Dr. ${doctor.name}`,
                    eid: e.emergency_id, rtype: 'DOCTOR',
                    rid: doctor.doctor_id, hid: doctor.hospital_id
                });
        });

        // Sequential so each sees updated state — same pattern that prevents race in quickDispatch
        const results = [];
        for (const req of requests) {
            const r = await apiFetch('/api/resources/request', {
                method: 'POST',
                body: JSON.stringify({ emergency_id: req.eid, resource_type: req.rtype, resource_id: req.rid, hospital_id: req.hid })
            }).catch(err => ({ decision: 'ERROR', reason: err.message }));
            results.push(r);
        }

        const decStyles = {
            APPROVED: 'background:#f0fdf4;border:1px solid #bbf7d0;color:var(--green);',
            WAITING:  'background:#fffbeb;border:1px solid #fde68a;color:var(--amber);',
            REJECTED: 'background:#fef2f2;border:1px solid #fca5a5;color:var(--red);',
            ERROR:    'background:#fef2f2;border:1px solid #fca5a5;color:var(--red);',
        };
        const decIcons = { APPROVED:'✓', WAITING:'⏳', REJECTED:'✕', ERROR:'✕' };

        const approvedCount = results.filter(r => r.decision === 'APPROVED').length;
        const waitingCount  = results.filter(r => r.decision === 'WAITING').length;
        const rejectedCount = results.filter(r => r.decision === 'REJECTED').length;

        rd.style.display = 'block';
        rd.innerHTML = `
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;">
            Each emergency requests one additional Bed and one Doctor from the available pool.
            The C++ Banker's Algorithm checks safe state for each request sequentially.
            When multiple emergencies want the same resource, later ones get WAITING.
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:var(--green);">${approvedCount}</div>
              <div style="font-size:11px;color:var(--gray-500);">APPROVED</div>
            </div>
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:var(--amber);">${waitingCount}</div>
              <div style="font-size:11px;color:var(--gray-500);">WAITING</div>
            </div>
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:var(--red);">${rejectedCount}</div>
              <div style="font-size:11px;color:var(--gray-500);">REJECTED</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${requests.map((req, i) => {
                const res = results[i];
                return `<div style="${decStyles[res.decision] || decStyles.ERROR}padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <span style="font-size:12.5px;">${req.label}</span>
                  <div style="text-align:right;flex-shrink:0;">
                    <div style="font-weight:700;font-size:13px;">${decIcons[res.decision]} ${res.decision}</div>
                    <div style="font-size:11px;opacity:.7;">${res.reason || ''}</div>
                  </div>
                </div>`;
            }).join('')}
          </div>`;

        document.getElementById('os-step-4').style.display = 'block';
        setPill(4);
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally { btn.disabled = false; btn.textContent = "Run Banker's →"; }
});

// Step 4: Deadlock Detection
document.getElementById('btn-demo-deadlock').addEventListener('click', async () => {
    if (!_demoEmergencies.length) return;
    const btn = document.getElementById('btn-demo-deadlock');
    btn.disabled = true; btn.textContent = 'Detecting…';
    const rd = document.getElementById('demo-deadlock-result');
    try {
        // Build RAG from actual DB state — what each emergency really holds
        // Allocation edges: Resource → Emergency (resource is held by emergency)
        // Request edges:    Emergency → Resource (emergency is waiting for something)
        // After quick-dispatch every emergency already has its ambulance, bed, doctor
        // assigned and is admitted — so there are allocation edges but NO request edges.
        // That means: no circular wait → no deadlock. Honest result.
        const ids = _demoEmergencies.map(e => e.emergency_id);
        const emergencies = await apiFetch('/api/emergencies');
        const ours = emergencies.filter(e => ids.includes(e.emergency_id));

        const allocEdges = [];
        ours.forEach(e => {
            if (e.ambulance_id) allocEdges.push({ from: `R-Amb-${e.ambulance_id}`, to: `E-${e.emergency_id}` });
            if (e.bed_id)       allocEdges.push({ from: `R-Bed-${e.bed_id}`,       to: `E-${e.emergency_id}` });
            if (e.doctor_id)    allocEdges.push({ from: `R-Doc-${e.doctor_id}`,    to: `E-${e.emergency_id}` });
        });

        // No pending requests since all are admitted — requestEdges is empty
        // This correctly shows no deadlock (resources held, nothing waiting)
        const requestEdges = [];

        const r = await apiFetch('/api/resources/deadlock', {
            method: 'POST',
            body: JSON.stringify({ allocationEdges: allocEdges, requestEdges })
        });

        const isDeadlock = r.deadlockDetected;
        rd.style.display = 'block';
        rd.innerHTML = `
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;">
            RAG built from actual DB state — what each emergency really holds right now.
            Allocation edges: ${allocEdges.length} (resources held). Request edges: ${requestEdges.length} (resources waited for).
          </div>
          <div style="${isDeadlock
            ? 'background:#fef2f2;border:1px solid #fca5a5;color:var(--red);'
            : 'background:#f0fdf4;border:1px solid #bbf7d0;color:var(--green);'
          }padding:14px 16px;border-radius:10px;margin-bottom:10px;">
            <div style="font-size:15px;font-weight:800;margin-bottom:6px;">${isDeadlock ? '⚠ DEADLOCK DETECTED' : '✓ NO DEADLOCK — System Safe'}</div>
            <div style="font-size:12.5px;opacity:.85;">${r.message}</div>
          </div>
          <div style="background:var(--blue-light);border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;font-size:12.5px;color:#1e40af;">
            <strong>Why no deadlock?</strong> Every emergency was fully admitted — each holds its own ambulance, bed and doctor with no pending requests.
            A deadlock would appear if emergency A held a resource and waited for one held by B, while B waited for A's resource (circular wait).
            Try the standalone <strong>Deadlock Detection</strong> page to simulate that scenario manually.
          </div>`;

        document.getElementById('os-step-5').style.display = 'block';
        setPill(5);
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Run Detection →'; }
});

// Step 5: Starvation & Aging
document.getElementById('btn-demo-starvation').addEventListener('click', async () => {
    if (!_demoEmergencies.length) return;
    const btn = document.getElementById('btn-demo-starvation');
    btn.disabled = true; btn.textContent = 'Simulating…';
    const rd = document.getElementById('demo-starv-result');
    try {
        const waitingRequests = _demoEmergencies.map((e, i) => ({
            emergency_id:  e.emergency_id,
            resource_id:   i + 1,
            resource_type: i % 2 === 0 ? 'BED' : 'DOCTOR',
            basePriority:  e.priority,
        }));

        const r = await apiFetch('/api/resources/starvation-tick', {
            method: 'POST',
            body: JSON.stringify({ waitingRequests, ticks: 9 })
        });

        rd.style.display = 'block';
        const headerColor  = r.starvationDetected ? 'var(--amber)' : 'var(--green)';
        const headerBg     = r.starvationDetected ? 'var(--amber-light)' : 'var(--green-light)';
        const headerBorder = r.starvationDetected ? '#fde68a' : '#bbf7d0';

        let html = `
          <div style="font-size:12px;color:var(--gray-500);margin-bottom:10px;">
            All ${_demoEmergencies.length} emergencies placed in waiting queue. Lower-priority ones age up over 9 ticks.
          </div>
          <div style="background:${headerBg};border:1px solid ${headerBorder};border-radius:10px;padding:12px 14px;margin-bottom:10px;">
            <div style="font-weight:700;font-size:13.5px;color:${headerColor};">
              ${r.starvationDetected ? '⚠ Starvation Detected — aging applied' : '✓ No Starvation Detected'}
            </div>
            <div style="font-size:12px;color:var(--gray-600);margin-top:4px;">After ${r.ticks} tick(s) · ${r.queueSize} request(s)</div>
          </div>`;

        if (r.queue?.length) {
            html += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
              <th>Emergency</th><th>Resource</th><th>Base Priority</th><th>Effective Priority</th><th>Wait Ticks</th>
            </tr></thead><tbody>`;
            html += r.queue.map(q => {
                const boosted = q.effectivePriority < q.basePriority;
                return `<tr>
                  <td>${mono('E' + q.emergency_id)}</td>
                  <td style="font-size:12px;">${q.resource_type}</td>
                  <td style="text-align:center;">${q.basePriority}</td>
                  <td style="text-align:center;font-weight:700;color:${boosted ? 'var(--green)' : 'var(--gray-600)'};">${q.effectivePriority}${boosted ? ' ↑ aged' : ''}</td>
                  <td style="text-align:center;">${q.waiting_time}</td>
                </tr>`;
            }).join('');
            html += '</tbody></table></div>';
        }
        rd.innerHTML = html;
        setPill(6);
    } catch (err) {
        rd.style.display = 'block';
        rd.innerHTML = `<div style="background:#fef2f2;border:1px solid #fca5a5;color:var(--red);padding:12px;border-radius:8px;font-size:13px;">${err.message}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Run Simulation →'; }
});

// Reset
document.getElementById('btn-demo-reset').addEventListener('click', () => {
    loadOsDemoPage();
    toast('Demo reset — ready to run again.', 'info');
});

// Clean Up Demo Data
document.getElementById('btn-demo-cleanup').addEventListener('click', async () => {
    const btn = document.getElementById('btn-demo-cleanup');
    btn.disabled = true; btn.textContent = '⏳ Cleaning…';
    try {
        const r = await apiFetch('/api/emergencies/demo-cleanup', { method: 'POST', body: JSON.stringify({}) });
        toast(r.message, 'success');
        // Reset the demo page and refresh dashboard
        loadOsDemoPage();
        loadDashboard();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🗑 Clean Up Demo Data'; }
});

// TREATMENT
async function loadTreatments() {
    try {
        const data = await apiFetch('/api/treatments');
        const tb = document.getElementById('treatments-table');
        if (!data.length) { tb.innerHTML = '<tr class="tbl-empty"><td colspan="6">No treatment records</td></tr>'; return; }
        tb.innerHTML = data.map(t => `
          <tr>
            <td>${mono('T' + t.treatment_id)}</td>
            <td style="font-weight:600;">${t.patient_name || '—'}</td>
            <td style="font-size:12.5px;">${t.doctor_name}</td>
            <td style="font-size:12.5px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.diagnosis || '—'}</td>
            <td>${statusBadge(t.status)}</td>
            <td style="font-size:12px;color:var(--gray-400);">${fmtDate(t.start_time)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

document.getElementById('btn-new-treatment').addEventListener('click', async () => {
    openModal('modal-treatment');
    const sel = document.getElementById('treat-doctor');
    sel.innerHTML = '<option value="">Loading doctors…</option>';
    try {
        const docs = await apiFetch('/api/doctors?availability=available');
        sel.innerHTML = '<option value="">— Select Doctor —</option>';
        docs.forEach(d => sel.appendChild(new Option(`${d.name} (${d.hospital_name})`, d.doctor_id)));
        if (!docs.length) sel.innerHTML = '<option value="">No available doctors</option>';
    } catch { sel.innerHTML = '<option value="">Failed to load</option>'; }
});

document.getElementById('submit-treatment').addEventListener('click', async () => {
    const eid = document.getElementById('treat-emergency').value;
    const did = document.getElementById('treat-doctor').value;
    if (!eid || !did) { toast('Emergency ID and Doctor are required.', 'error'); return; }
    const btn = document.getElementById('submit-treatment');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
        await apiFetch('/api/treatments', {
            method: 'POST',
            body: JSON.stringify({
                emergency_id: +eid, doctor_id: +did,
                diagnosis: document.getElementById('treat-diagnosis').value.trim(),
                treatment: document.getElementById('treat-notes').value.trim(),
                status:    document.getElementById('treat-status').value,
                start_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
            })
        });
        closeModal('modal-treatment');
        toast('Treatment record saved.');
        loadTreatments();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Record'; }
});

// BILLING
async function loadBilling() {
    await Promise.all([loadBills(), loadPayments()]);
}

async function loadBills() {
    try {
        const data = await apiFetch('/api/billing/bills');
        const tb = document.getElementById('bills-table');
        if (!data.length) { tb.innerHTML = '<tr class="tbl-empty"><td colspan="5">No bills yet</td></tr>'; return; }
        tb.innerHTML = data.map(b => `
          <tr>
            <td>${mono('B' + b.bill_id)}</td>
            <td style="font-size:13px;">${b.patient_name || '—'}</td>
            <td style="font-weight:700;">₹${parseFloat(b.amount).toLocaleString('en-IN')}</td>
            <td style="font-size:12.5px;">${fmtDateShort(b.bill_date)}</td>
            <td>${statusBadge(b.payment_status)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

async function loadPayments() {
    try {
        const data = await apiFetch('/api/billing/payments');
        const tb = document.getElementById('payments-table');
        if (!data.length) { tb.innerHTML = '<tr class="tbl-empty"><td colspan="5">No payments yet</td></tr>'; return; }
        tb.innerHTML = data.map(p => `
          <tr>
            <td>${mono('P' + p.payment_id)}</td>
            <td>${mono('B' + p.bill_id)}</td>
            <td style="font-weight:700;">₹${parseFloat(p.amount).toLocaleString('en-IN')}</td>
            <td style="font-size:12.5px;">${p.payment_mode}</td>
            <td style="font-size:12.5px;">${fmtDateShort(p.payment_date)}</td>
          </tr>`).join('');
    } catch (err) { toast(err.message, 'error'); }
}

document.getElementById('btn-new-bill').addEventListener('click', () => openModal('modal-bill'));
document.getElementById('submit-bill').addEventListener('click', async () => {
    const eid = document.getElementById('bill-emergency').value;
    const pid = document.getElementById('bill-patient').value;
    const amt = document.getElementById('bill-amount').value;
    const dt  = document.getElementById('bill-date').value;
    if (!eid || !pid || !amt || !dt) { toast('All fields are required.', 'error'); return; }
    const btn = document.getElementById('submit-bill');
    btn.disabled = true; btn.textContent = 'Creating…';
    try {
        await apiFetch('/api/billing/bills', { method: 'POST', body: JSON.stringify({ emergency_id: +eid, patient_id: +pid, amount: +amt, bill_date: dt }) });
        closeModal('modal-bill');
        toast('Bill created.');
        loadBilling();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Create Bill'; }
});

document.getElementById('btn-new-payment').addEventListener('click', () => openModal('modal-payment'));
document.getElementById('submit-payment').addEventListener('click', async () => {
    const bid  = document.getElementById('pay-bill').value;
    const amt  = document.getElementById('pay-amount').value;
    const dt   = document.getElementById('pay-date').value;
    const mode = document.getElementById('pay-mode').value;
    if (!bid || !amt || !dt || !mode) { toast('All fields are required.', 'error'); return; }
    const btn = document.getElementById('submit-payment');
    btn.disabled = true; btn.textContent = 'Recording…';
    try {
        await apiFetch('/api/billing/payments', { method: 'POST', body: JSON.stringify({ bill_id: +bid, amount: +amt, payment_date: dt, payment_mode: mode }) });
        closeModal('modal-payment');
        toast('Payment recorded.');
        loadBilling();
    } catch (err) { toast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Record Payment'; }
});

// Default dates
document.querySelectorAll('input[type="date"]').forEach(el => {
    el.value = new Date().toISOString().split('T')[0];
});

// QUICK EMERGENCY DISPATCH
(function () {
    let selectedSeverity = '';

    function resetQE() {
        document.getElementById('qe-name').value = '';
        selectedSeverity = '';
        document.getElementById('qe-severity').value = '';
        document.querySelectorAll('.qe-sev-btn').forEach(b => { b.style.outline = 'none'; b.style.transform = 'scale(1)'; });
        document.getElementById('qe-name-err').style.display = 'none';
        document.getElementById('qe-loc-err').style.display  = 'none';
        document.getElementById('qe-sev-err').style.display  = 'none';
        document.getElementById('qe-form-body').style.display   = 'block';
        document.getElementById('qe-result-body').style.display = 'none';
        document.getElementById('qe-footer').style.display      = 'flex';
    }

    document.querySelectorAll('.qe-sev-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.qe-sev-btn').forEach(b => { b.style.outline = 'none'; b.style.transform = 'scale(1)'; });
            btn.style.outline = '3px solid var(--blue)';
            btn.style.transform = 'scale(1.04)';
            selectedSeverity = btn.dataset.sev;
            document.getElementById('qe-severity').value = selectedSeverity;
            document.getElementById('qe-sev-err').style.display = 'none';
        });
    });

    async function openQE() {
        resetQE();
        openModal('modal-quick-emergency');
        // Populate location dropdown
        await populateLocationSelect(
            document.getElementById('qe-location'),
            null,
            '— Select pickup location —'
        );
    }
    document.getElementById('btn-quick-emergency').addEventListener('click', openQE);
    document.getElementById('btn-quick-emergency-dash').addEventListener('click', openQE);

    document.getElementById('submit-quick-emergency').addEventListener('click', async () => {
        const name  = document.getElementById('qe-name').value.trim();
        const locId = document.getElementById('qe-location').value;
        const sev   = document.getElementById('qe-severity').value;
        let valid = true;
        if (!name)  { document.getElementById('qe-name-err').textContent = 'Patient name is required.'; document.getElementById('qe-name-err').style.display = 'block'; valid = false; }
        if (!locId) { document.getElementById('qe-loc-err').textContent  = 'Pickup location is required.'; document.getElementById('qe-loc-err').style.display  = 'block'; valid = false; }
        if (!sev)   { document.getElementById('qe-sev-err').textContent  = 'Please select a severity.';  document.getElementById('qe-sev-err').style.display  = 'block'; valid = false; }
        if (!valid) return;

        const btn = document.getElementById('submit-quick-emergency');
        btn.disabled = true;
        btn.innerHTML = '<svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Dispatching…';
        try {
            const r = await apiFetch('/api/emergencies/quick-dispatch', {
                method: 'POST',
                body: JSON.stringify({ patient_name: name, severity: sev, pickup_location_id: Number(locId) })
            });
            document.getElementById('qe-form-body').style.display = 'none';
            document.getElementById('qe-footer').style.display    = 'none';
            const sevColors = { critical: '#b91c1c', serious: '#c2410c', moderate: '#92400e', minor: '#15803d' };
            // Get location name from the dropdown for display
            const locSel  = document.getElementById('qe-location');
            const locName = locSel.options[locSel.selectedIndex]?.text || '';
            document.getElementById('qe-result-body').innerHTML = `
              <div style="text-align:center;margin-bottom:20px;">
                <div style="width:52px;height:52px;background:#f0fdf4;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">
                  <svg width="26" height="26" fill="none" stroke="var(--green)" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div style="font-size:16px;font-weight:800;color:var(--gray-900);">Emergency Dispatched!</div>
                <div style="font-size:12.5px;color:var(--gray-500);margin-top:4px;">E${r.emergency_id} · Resources auto-assigned</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${[
                    ['Patient',        r.patient.name],
                    ['📍 Pickup',      `<span style="font-weight:600;color:var(--gray-800);">${locName}</span>`],
                    ['Severity',       `<span style="font-weight:700;color:${sevColors[r.severity] || '#374151'};text-transform:capitalize;">${r.severity}</span>`],
                    ['🚑 Ambulance',   `<span style="color:#c2410c;font-weight:700;">${r.ambulance.vehicle_number}</span>`],
                    ['🏥 Hospital',    `<span style="color:#1d4ed8;font-weight:700;">${r.hospital.hospital_name}</span>`],
                    ['🛏 Bed',         `<span style="color:#15803d;font-weight:700;">${r.bed.bed_number} (${r.bed.bed_type})</span>`],
                    ['👨‍⚕️ Doctor',   r.doctor ? `<span style="color:var(--purple);font-weight:700;">${r.doctor.name}</span>` : '<span style="color:var(--gray-400);">Not assigned</span>'],
                ].map(([k,v]) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--gray-50);border-radius:8px;"><span style="font-size:12.5px;color:var(--gray-500);">${k}</span><span style="font-size:13.5px;">${v}</span></div>`).join('')}
              </div>
              <div style="display:flex;gap:8px;margin-top:16px;">
                <button class="btn btn-secondary" style="flex:1;justify-content:center;" onclick="closeModal('modal-quick-emergency')">Close</button>
                <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="closeModal('modal-quick-emergency');openEmergencyDetail(${r.emergency_id})">View Details →</button>
              </div>`;
            document.getElementById('qe-result-body').style.display = 'block';
            toast(`Emergency E${r.emergency_id} dispatched!`, 'success');
            loadDashboard();
        } catch (err) { toast(err.message, 'error'); }
        finally {
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Dispatch Now';
        }
    });
})();

// GUIDED DEMO MODE
const demoSteps = [
    {
        title: '1. System Overview — Dashboard',
        desc: 'The dashboard shows live stats: total emergencies, active cases, available ambulances, beds, and doctors. All numbers come from the real database. Click a stat card to navigate directly.',
        action: () => navigate('dashboard')
    },
    {
        title: '2. Emergency Management',
        desc: 'The Emergencies page lists all cases. Each row is color-coded by severity (red = critical, green = minor). Click "Details →" on any row to open the full emergency lifecycle view.',
        action: () => navigate('emergencies')
    },
    {
        title: '3. Create a New Emergency',
        desc: 'Click "New Emergency" to open the creation form. Fill in patient, hospital, and severity. The system auto-calculates priority (Critical = 1, Minor = 4). You can also use Quick Dispatch in the header to auto-assign all resources.',
        action: () => navigate('emergencies')
    },
    {
        title: '4. Emergency Lifecycle & Resource Assignment',
        desc: 'The Emergency Detail page shows the full lifecycle tracker: Pending → Admitted → In Treatment → Discharged. When moving to "Admitted", you assign an ambulance, bed, and doctor from live dropdowns — no raw IDs needed.',
        action: async () => {
            navigate('emergencies');
            await loadEmergencies();
            if (allEmergencies.length) openEmergencyDetail(allEmergencies[0].emergency_id);
        }
    },
    {
        title: '5. Resources — Ambulances, Hospitals, Beds, Doctors',
        desc: 'The Resources section has four tabs. Each shows real-time status from the database. You can update ambulance status inline. Beds and doctors update automatically when emergencies are admitted or discharged.',
        action: () => navigate('resources', { tab: 'ambulances' })
    },
    {
        title: '6. CPU Scheduling Algorithms (Member 4 — C Program)',
        desc: 'Select FCFS, Priority, and/or Round Robin, set a time quantum, and click Run. The C binary processes active emergencies and returns results. The Gantt chart and metrics table display the actual algorithm output.',
        action: () => navigate('scheduling')
    },
    {
        title: "7. Banker's Algorithm (Member 5 — C++ Program)",
        desc: "Enter an Emergency ID, resource type, and resource ID, then click Request. The C++ Banker's Algorithm checks whether the allocation leaves the system in a safe state. APPROVED = safe state, REJECTED = unsafe (deadlock risk).",
        action: () => navigate('banker')
    },
    {
        title: '8. Treatment & Billing Records',
        desc: 'Treatment records link emergencies to doctors and diagnoses. Billing tracks amounts and payment status. Payments auto-update the bill status (partial/paid). All data persists in MySQL.',
        action: () => navigate('treatment')
    },
    {
        title: '9. Demo Complete!',
        desc: 'The full emergency lifecycle: request → scheduling → ambulance → hospital/bed → Banker\'s allocation → treatment → billing. All modules (Member 2 ambulances, Member 3 hospitals/beds/doctors, Member 4 scheduling, Member 5 resources) are integrated.',
        action: () => navigate('dashboard')
    }
];

let demoActive = false;
let demoIdx = 0;

function startDemo() {
    demoActive = true;
    demoIdx = 0;
    document.getElementById('demo-overlay').classList.add('active');
    renderDemoStep();
}

function renderDemoStep() {
    const step = demoSteps[demoIdx];
    const total = demoSteps.length;

    // Step bar
    document.getElementById('demo-step-bar').innerHTML = demoSteps.map((_, i) =>
        `<div class="demo-step-dot ${i < demoIdx ? 'done' : i === demoIdx ? 'current' : ''}"></div>`
    ).join('');

    document.getElementById('demo-step-num').textContent = `Step ${demoIdx + 1} of ${total}`;
    document.getElementById('demo-step-title').textContent = step.title;
    document.getElementById('demo-step-desc').textContent = step.desc;
    document.getElementById('demo-count').textContent = `${demoIdx + 1} / ${total}`;
    document.getElementById('demo-prev').disabled = demoIdx === 0;
    document.getElementById('demo-next').textContent = demoIdx === total - 1 ? 'Finish ✓' : 'Next →';

    if (step.action) step.action();
}

document.getElementById('btn-start-demo').addEventListener('click', startDemo);
document.getElementById('demo-exit').addEventListener('click', () => {
    demoActive = false;
    document.getElementById('demo-overlay').classList.remove('active');
    document.querySelectorAll('.demo-highlight').forEach(el => el.classList.remove('demo-highlight'));
});
document.getElementById('demo-next').addEventListener('click', () => {
    if (demoIdx < demoSteps.length - 1) { demoIdx++; renderDemoStep(); }
    else {
        demoActive = false;
        document.getElementById('demo-overlay').classList.remove('active');
        toast('Demo complete! All modules demonstrated.', 'info');
    }
});
document.getElementById('demo-prev').addEventListener('click', () => {
    if (demoIdx > 0) { demoIdx--; renderDemoStep(); }
});

// EXPOSE openEmergencyDetail globally
window.openEmergencyDetail = openEmergencyDetail;
