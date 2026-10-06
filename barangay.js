
/* =====================================================================
   DATA LAYER - pang storage.
   ===================================================================== */
var db, me = null, lastList = 'home';
var REPORT_STEPS  = ['Submitted','Under Review','In Progress','Resolved','Closed'];
var REQUEST_STEPS = ['Submitted','Processing','Ready for Pickup','Released'];
var CATEGORIES = ['Road Damage','Garbage / Waste','Streetlight Problem','Flooding','Drainage','Noise Complaint','Public Safety','Stray Animals','Other'];
var DOC_TYPES  = ['Barangay Clearance','Certificate of Residency','Certificate of Indigency','Barangay Certificate','Business Clearance','Other Barangay Documents'];

function $(id) { return document.getElementById(id); }
function save() { localStorage.setItem('barangay_db', JSON.stringify(db)); }
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function when(d) { return d ? new Date(d).toLocaleString('en-PH', {dateStyle:'medium', timeStyle:'short'}) : '-'; }
function day(d) { return d ? new Date(d).toLocaleDateString('en-PH', {dateStyle:'medium'}) : '-'; }
function ago(h) { return new Date(Date.now() - h * 3600000).toISOString(); }
function badge(s) { return '<span class="status st-' + s.replace(/ /g, '-') + '">' + s + '</span>'; }
function userName(id) { var u = db.users.find(function (x) { return x.id == id; }); return u ? u.name : '-'; }
function toast(msg) { var t = $('toast'); t.textContent = msg; t.style.display = 'block'; setTimeout(function () { t.style.display = 'none'; }, 3500); }

/* Passwords are never stored as plain text: we store a salted SHA-256 hash.*/
async function hash(text) {
  var bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('barangay' + text));
  return Array.from(new Uint8Array(bytes)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

/* Sample data lang toh*/
async function makeSampleData() {
  var rp = await hash('resident123'), op = await hash('officer123');
  return {
    users: [
      {id:'u1', name:'Maria Santos', email:'maria@example.ph', phone:'09171234567', address:'12 Mabini St., Purok 2', role:'resident', active:true, pass:rp, created:ago(900)},
      {id:'u2', name:'Jose Ramirez', email:'jose@example.ph', phone:'09281112233', address:'45 Rizal Ave., Purok 4', role:'resident', active:true, pass:rp, created:ago(800)},
      {id:'o1', name:'Kgd. Ricardo Bautista', email:'officer@barangay.ph', phone:'09175550001', address:'Barangay Hall', role:'officer', active:true, pass:op, created:ago(900)},
      {id:'o2', name:'Kgd. Liza Manalo', email:'liza@barangay.ph', phone:'09175550002', address:'Barangay Hall', role:'officer', active:true, pass:op, created:ago(900)}
    ],
    reports: [
      {id:'r1', code:'RPT-2026-0001', user:'u1', title:'Broken Streetlight on Mabini Street', category:'Streetlight Problem', description:'The streetlight in front of No. 12 has been out for a week.', location:'Mabini Street, Purok 2', incident:ago(100), image:null, status:'In Progress', officer:'o1', resolution:'', phone:'09171234567', created:ago(96), updated:ago(40)},
      {id:'r2', code:'RPT-2026-0002', user:'u1', title:'Flooding Near Barangay Hall', category:'Flooding', description:'Knee-deep water after short rains near the hall entrance.', location:'Beside Barangay Hall', incident:ago(35), image:null, status:'Under Review', officer:null, resolution:'', phone:'09171234567', created:ago(30), updated:ago(15)},
      {id:'r3', code:'RPT-2026-0003', user:'u1', title:'Garbage Collection Issue', category:'Garbage / Waste', description:'No garbage pickup for two weeks in our purok.', location:'Purok 2', incident:ago(310), image:null, status:'Resolved', officer:'o2', resolution:'Truck rescheduled to Tue/Fri and backlog cleared.', phone:'09171234567', created:ago(300), updated:ago(150)},
      {id:'r4', code:'RPT-2026-0004', user:'u2', title:'Clogged drainage on Rizal Avenue', category:'Drainage', description:'Drain is blocked with plastic and mud.', location:'Rizal Ave. corner Luna St.', incident:ago(10), image:null, status:'Submitted', officer:null, resolution:'', phone:'09281112233', created:ago(6), updated:ago(6)}
    ],
    requests: [
      {id:'q1', code:'DOC-2026-0001', user:'u1', type:'Barangay Clearance', purpose:'Employment', copies:2, info:'', file:null, pickup:'2026-10-10', status:'Ready for Pickup', reason:'', created:ago(72), updated:ago(36)},
      {id:'q2', code:'DOC-2026-0002', user:'u1', type:'Certificate of Residency', purpose:'School enrollment', copies:1, info:'', file:null, pickup:'2026-10-12', status:'Processing', reason:'', created:ago(20), updated:ago(10)},
      {id:'q3', code:'DOC-2026-0003', user:'u2', type:'Certificate of Indigency', purpose:'Medical assistance', copies:1, info:'', file:null, pickup:'2026-10-11', status:'Submitted', reason:'', created:ago(5), updated:ago(5)}
    ],
    updates: [
      {ref:'r1', officer:'o1', status:'Under Review', message:'Report received and verified.', internal:false, date:ago(90)},
      {ref:'r1', officer:'o1', status:'In Progress', message:'Electrician scheduled this week.', internal:false, date:ago(40)},
      {ref:'r1', officer:'o1', status:'In Progress', message:'Ask the power company about the pole.', internal:true, date:ago(39)},
      {ref:'q1', officer:'o1', status:'Ready for Pickup', message:'Bring one valid ID. Office hours 8AM-5PM.', internal:false, date:ago(36)}
    ],
    notifications: [
      {user:'u1', title:'Document ready for pickup', message:'Your Barangay Clearance (DOC-2026-0001) is ready.', read:false, date:ago(36)},
      {user:'u1', title:'Report status changed', message:'RPT-2026-0001 is now In Progress.', read:false, date:ago(40)},
      {user:'o1', title:'New document request', message:'DOC-2026-0003: Certificate of Indigency', read:false, date:ago(5)}
    ]
  };
}

function notify(userId, title, message) { db.notifications.unshift({user:userId, title:title, message:message, read:false, date:new Date().toISOString()}); }
function notifyOfficers(title, message) { db.users.filter(function (u) { return u.role == 'officer' && u.active; }).forEach(function (o) { notify(o.id, title, message); }); }
function nextCode(prefix, list) { return prefix + '-2026-' + String(list.length + 1).padStart(4, '0'); }

/* Read an uploaded file safely: only allowed types, max size 1 MB */
function readFile(file, allowed) {
  return new Promise(function (resolve, reject) {
    if (!file) return resolve(null);
    if (allowed.indexOf(file.type) < 0) return reject('That file type is not allowed.');
    if (file.size > 1048576) return reject('The file is too large. Maximum is 1 MB.');
    var r = new FileReader();
    r.onload = function () { resolve({name:file.name, data:r.result}); };
    r.onerror = function () { reject('Could not read the file.'); };
    r.readAsDataURL(file);
  });
}

/* =====================================================================
   PAGES AND ACCESS CONTROL
   ===================================================================== */
var RESIDENT_PAGES = ['r-dash','report-new','r-reports','request-new','r-requests'];
var OFFICER_PAGES  = ['o-dash','o-reports','o-requests','o-residents'];
var NEED_LOGIN     = ['detail','notifications','profile'];

function showPage(id) {
  closeAccountMenu();
  // role-based access: residents cannot open officer pages and vice versa
  if (RESIDENT_PAGES.indexOf(id) >= 0 && (!me || me.role != 'resident')) { toast('Please log in as a resident.'); id = 'login'; }
  if (OFFICER_PAGES.indexOf(id) >= 0 && (!me || me.role != 'officer')) { toast('That page is for barangay officers only.'); id = me ? 'r-dash' : 'login'; }
  if (NEED_LOGIN.indexOf(id) >= 0 && !me) id = 'login';
  if (id != 'detail') lastList = id;

  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  $(id).classList.add('active');
  window.scrollTo(0, 0);
  if (draw[id]) draw[id]();
  updateMenu();
}

function toggleAccountMenu() {
  var nav = document.querySelector('.navbar');
  if (window.matchMedia('(max-width: 600px)').matches) {
    var open = !nav.classList.contains('mobile-open');
    nav.classList.toggle('mobile-open', open);
    document.body.classList.toggle('mobile-nav-open', open);
    document.querySelector('#account-menu').setAttribute('aria-hidden', String(!open));
    setAccountButtonState(open);
    return;
  }
  var open = !nav.classList.contains('account-open');
  nav.classList.toggle('account-open', open);
  document.querySelector('#account-menu').setAttribute('aria-hidden', String(!open));
  setAccountButtonState(open);
}

function setAccountButtonState(open) {
  var button = document.querySelector('.profile');
  var unreadCount = me ? db.notifications.filter(function (n) { return n.user == me.id && !n.read; }).length : 0;
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', (open ? 'Close' : 'Open') + ' account menu' + (unreadCount ? ', ' + unreadCount + ' unread notifications' : ''));
  button.title = unreadCount ? unreadCount + ' unread notifications' : 'Account';
}

function closeAccountMenu() {
  var nav = document.querySelector('.navbar');
  if (!nav) return;
  nav.classList.remove('account-open', 'mobile-open');
  document.body.classList.remove('mobile-nav-open');
  var menu = document.querySelector('#account-menu'), button = document.querySelector('.profile');
  if (menu) menu.setAttribute('aria-hidden', 'true');
  if (button) {
    setAccountButtonState(false);
  }
}

function closeMobileNav() {
  closeAccountMenu();
}

function closeAccountMenuOnOutsideClick(event) {
  var nav = document.querySelector('.navbar');
  if (nav && !nav.contains(event.target)) closeAccountMenu();
}

function updateMenu() {
  var role = me ? me.role : 'guest';
  document.querySelectorAll('.menu').forEach(function (m) {
    var visible = m.dataset.role == role;
    m.style.display = visible ? 'contents' : 'none';
    m.classList.toggle('is-visible', visible);
  });
  $('account-link').textContent = me ? 'My account' : 'Log in';
  $('bell').style.display = me ? '' : 'none';
  $('bell').classList.toggle('is-visible', !!me);
  $('logout-link').style.display = me ? '' : 'none';
  $('logout-link').classList.toggle('is-visible', !!me);
  var n = me ? db.notifications.filter(function (x) { return x.user == me.id && !x.read; }).length : 0;
  $('bell-count').textContent = n || '';
  $('profile-dot').hidden = !n;

  var reports = db.reports.filter(function (r) {
    return r.status != 'Resolved' && r.status != 'Closed' && (role == 'officer' || (me && r.user == me.id));
  }).length;
  var requests = db.requests.filter(function (q) {
    return q.status != 'Released' && q.status != 'Rejected' && (role == 'officer' || (me && q.user == me.id));
  }).length;
  setNavAttention('resident-reports-link', role == 'resident' && reports > 0, 'My Reports: active reports');
  setNavAttention('resident-requests-link', role == 'resident' && requests > 0, 'My Requests: active document requests');
  setNavAttention('officer-reports-link', role == 'officer' && reports > 0, 'Reports: active reports');
  setNavAttention('officer-requests-link', role == 'officer' && requests > 0, 'Document Requests: active requests');
  setAccountButtonState(document.querySelector('.profile').getAttribute('aria-expanded') == 'true');
}

function setNavAttention(linkId, hasAttention, accessibleLabel) {
  var link = $(linkId);
  var dot = link.querySelector('.nav-dot');
  dot.hidden = !hasAttention;
  link.title = hasAttention ? accessibleLabel : '';
  link.setAttribute('aria-label', hasAttention ? accessibleLabel : link.textContent.trim());
}

document.addEventListener('click', closeAccountMenuOnOutsideClick);
document.addEventListener('keydown', function (event) {
  if (event.key == 'Escape') closeAccountMenu();
});

function goReport() { showPage(me && me.role == 'resident' ? 'report-new' : (me ? 'o-reports' : 'login')); }

/* =====================================================================
   LOGIN, REGISTER, LOGOUT
   ===================================================================== */
async function login(e) {
  e.preventDefault();
  var email = $('login-email').value.trim().toLowerCase(), pass = $('login-pass').value, role = $('login-role').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return $('login-error').textContent = 'Enter a valid email address.';
  if (!pass) return $('login-error').textContent = 'Enter your password.';
  var u = db.users.find(function (x) { return x.email == email && x.role == role; });
  if (!u || u.pass != await hash(pass)) return $('login-error').textContent = 'Incorrect email or password.';
  if (!u.active) return $('login-error').textContent = 'This account is deactivated. Please contact the barangay office.';
  me = u; sessionStorage.setItem('uid', u.id); $('login-error').textContent = '';
  toast('Welcome, ' + u.name.split(' ')[0] + '.');
  showPage(u.role == 'officer' ? 'o-dash' : 'r-dash');
}

async function register(e) {
  e.preventDefault();
  var name = $('reg-name').value.trim(), email = $('reg-email').value.trim().toLowerCase(), phone = $('reg-phone').value.trim(),
      address = $('reg-address').value.trim(), pass = $('reg-pass').value, err = $('reg-error');
  if (name.length < 3) return err.textContent = 'Enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = 'Enter a valid email address.';
  if (!/^(09|\+639)\d{9}$/.test(phone)) return err.textContent = 'Enter a valid mobile number, like 09171234567.';
  if (address.length < 5) return err.textContent = 'Enter your home address.';
  if (pass.length < 8) return err.textContent = 'Password must be at least 8 characters.';
  if (pass != $('reg-pass2').value) return err.textContent = 'Passwords do not match.';
  if (db.users.some(function (u) { return u.email == email; })) return err.textContent = 'That email is already registered.';
  var u = {id:'u' + Date.now(), name:name, email:email, phone:phone, address:address, role:'resident', active:true, pass:await hash(pass), created:new Date().toISOString()};
  db.users.push(u); save(); me = u; sessionStorage.setItem('uid', u.id); err.textContent = '';
  toast('Account created.'); showPage('r-dash');
}

function logout() {
  if (!confirm('Log out of your account?')) return;
  me = null; sessionStorage.removeItem('uid'); toast('You have been logged out.'); showPage('home');
}

/* =====================================================================
   RESIDENT ACTIONS
   ===================================================================== */
async function newReport(e) {
  e.preventDefault();
  var err = $('rp-error'), title = $('rp-title').value.trim(), cat = $('rp-cat').value, desc = $('rp-desc').value.trim(),
      loc = $('rp-loc').value.trim(), at = $('rp-when').value, phone = $('rp-phone').value.trim();
  if (title.length < 5) return err.textContent = 'Enter a title of at least 5 characters.';
  if (!cat) return err.textContent = 'Choose a category.';
  if (desc.length < 15) return err.textContent = 'Describe the problem in at least 15 characters.';
  if (!loc) return err.textContent = 'Enter the location.';
  if (!at || new Date(at) > new Date()) return err.textContent = 'Enter a valid date and time (not in the future).';
  if (!/^(09|\+639)\d{9}$/.test(phone)) return err.textContent = 'Enter a valid mobile number.';
  try { var img = await readFile($('rp-img').files[0], ['image/jpeg','image/png']); } catch (m) { return err.textContent = m; }
  var r = {id:'r' + Date.now(), code:nextCode('RPT', db.reports), user:me.id, title:title, category:cat, description:desc, location:loc,
           incident:new Date(at).toISOString(), image:img, status:'Submitted', officer:null, resolution:'', phone:phone, created:new Date().toISOString(), updated:new Date().toISOString()};
  db.reports.unshift(r);
  notify(me.id, 'Report submitted', 'Your report ' + r.code + ' was received.');
  notifyOfficers('New report submitted', r.code + ': ' + r.title);
  save(); err.textContent = ''; e.target.reset();
  toast('Report submitted. Your Report ID is ' + r.code); openReport(r.id);
}

async function newRequest(e) {
  e.preventDefault();
  var err = $('rq-error'), type = $('rq-type').value, purpose = $('rq-purpose').value.trim(), copies = +$('rq-copies').value, pickup = $('rq-pickup').value;
  if (!type) return err.textContent = 'Choose a document type.';
  if (purpose.length < 3) return err.textContent = 'Enter the purpose.';
  if (!(copies >= 1 && copies <= 10)) return err.textContent = 'Copies must be between 1 and 10.';
  if (!pickup) return err.textContent = 'Choose a preferred pickup date.';
  try { var file = await readFile($('rq-file').files[0], ['application/pdf','image/jpeg','image/png']); } catch (m) { return err.textContent = m; }
  var q = {id:'q' + Date.now(), code:nextCode('DOC', db.requests), user:me.id, type:type, purpose:purpose, copies:copies, info:$('rq-info').value.trim(),
           file:file, pickup:pickup, status:'Submitted', reason:'', created:new Date().toISOString(), updated:new Date().toISOString()};
  db.requests.unshift(q);
  notify(me.id, 'Request submitted', 'Your request ' + q.code + ' (' + type + ') was received.');
  notifyOfficers('New document request', q.code + ': ' + type);
  save(); err.textContent = ''; e.target.reset();
  toast('Request submitted. Your Request ID is ' + q.code); openRequest(q.id);
}

function saveProfile(e) {
  e.preventDefault();
  var name = $('pf-name').value.trim(), phone = $('pf-phone').value.trim(), address = $('pf-address').value.trim(), err = $('pf-error');
  if (name.length < 3) return err.textContent = 'Enter your full name.';
  if (!/^(09|\+639)\d{9}$/.test(phone)) return err.textContent = 'Enter a valid mobile number.';
  if (address.length < 5) return err.textContent = 'Enter your address.';
  me.name = name; me.phone = phone; me.address = address; save(); err.textContent = ''; toast('Profile saved.');
}

/* =====================================================================
   OFFICER ACTIONS
   ===================================================================== */
// Opens the popup that asks for a required note or reason
function askText(title, minLength, onDone) {
  $('ask-title').textContent = title; $('ask-text').value = ''; $('ask-error').textContent = '';
  $('ask').showModal();
  $('ask-ok').onclick = function () {
    var v = $('ask-text').value.trim();
    if (v.length < minLength) return $('ask-error').textContent = 'Please write at least ' + minLength + ' characters.';
    $('ask').close(); onDone(v);
  };
}

function saveReportUpdate(id) {
  var r = db.reports.find(function (x) { return x.id == id; }), status = $('u-status').value, pub = $('u-public').value.trim(),
      note = $('u-note').value.trim(), officer = $('u-officer').value;
  if (status == 'Resolved' && r.status != 'Resolved') return toast('Use the "Mark as resolved" button so you can add a resolution note.');
  r.officer = officer || null;
  if (note) db.updates.push({ref:id, officer:me.id, status:r.status, message:note, internal:true, date:new Date().toISOString()});
  if (status != r.status || pub) {
    r.status = status;
    db.updates.push({ref:id, officer:me.id, status:status, message:pub || 'Status updated to ' + status, internal:false, date:new Date().toISOString()});
    notify(r.user, 'Report status changed', r.code + ' is now ' + status + '.');
  }
  r.updated = new Date().toISOString(); save(); toast('Report updated. The resident was notified.'); openReport(id);
}

function resolveReport(id) {
  askText('Resolution note (what was done?)', 10, function (text) {
    var r = db.reports.find(function (x) { return x.id == id; });
    r.status = 'Resolved'; r.resolution = text; r.updated = new Date().toISOString();
    db.updates.push({ref:id, officer:me.id, status:'Resolved', message:'Resolved: ' + text, internal:false, date:r.updated});
    notify(r.user, 'Report resolved', r.code + ' has been resolved.');
    save(); toast('Report marked as resolved.'); openReport(id);
  });
}

function changeRequest(id, status, label) {
  function apply(note, reason) {
    var q = db.requests.find(function (x) { return x.id == id; });
    q.status = status; q.updated = new Date().toISOString(); if (reason) q.reason = reason;
    db.updates.push({ref:id, officer:me.id, status:status, message:reason ? 'Rejected: ' + reason : (note || 'Status updated to ' + status), internal:false, date:q.updated});
    var titles = {'Processing':'Request approved', 'Rejected':'Request rejected', 'Ready for Pickup':'Document ready for pickup', 'Released':'Document released'};
    notify(q.user, titles[status], q.code + ' (' + q.type + '): ' + status + '.' + (reason ? ' Reason: ' + reason : ''));
    save(); toast('Request updated. The resident was notified.'); openRequest(id);
  }
  if (status == 'Rejected') askText('Reason for rejection (required)', 5, function (t) { apply('', t); });
  else if (confirm(label + '?')) apply('', '');
}

function toggleResident(id) {
  var u = db.users.find(function (x) { return x.id == id; });
  if (!confirm((u.active ? 'Deactivate ' : 'Reactivate ') + u.name + '?')) return;
  u.active = !u.active; save(); renderResidents();
}

/* =====================================================================
   DRAWING THE PAGES
   ===================================================================== */
var draw = {};

function timeline(steps, current, rejected) {
  var at = steps.indexOf(current), html = '<ol class="timeline">';
  steps.forEach(function (s, i) {
    var cls = rejected ? (i == 0 ? 'done' : '') : (i < at ? 'done' : (i == at ? 'current' : ''));
    html += '<li class="' + cls + '">' + s + '</li>';
  });
  if (rejected) html += '<li class="current rejected">Rejected</li>';
  return html + '</ol>';
}

function reportRows(list, forOfficer) {
  if (!list.length) return '<div class="empty">No reports found.</div>';
  var h = '<table><tr><th>Report ID</th><th>Title</th>' + (forOfficer ? '<th>Resident</th>' : '') + '<th>Category</th><th>Submitted</th><th>Location</th><th>Status</th><th>Last update</th><th></th></tr>';
  list.forEach(function (r) {
    h += '<tr><td>' + r.code + '</td><td>' + esc(r.title) + '</td>' + (forOfficer ? '<td>' + esc(userName(r.user)) + '</td>' : '') + '<td>' + esc(r.category) + '</td><td>' + day(r.created) + '</td><td>' + esc(r.location) + '</td><td>' + badge(r.status) + '</td><td>' + when(r.updated) + '</td><td><button class="small outline" onclick="openReport(\'' + r.id + '\')">View details</button></td></tr>';
  });
  return h + '</table>';
}

function requestRows(list, forOfficer) {
  if (!list.length) return '<div class="empty">No requests found.</div>';
  var h = '<table><tr><th>Request ID</th><th>Document</th>' + (forOfficer ? '<th>Resident</th>' : '') + '<th>Requested</th><th>Pickup date</th><th>Status</th><th>Last update</th><th></th></tr>';
  list.forEach(function (q) {
    h += '<tr><td>' + q.code + '</td><td>' + esc(q.type) + '</td>' + (forOfficer ? '<td>' + esc(userName(q.user)) + '</td>' : '') + '<td>' + day(q.created) + '</td><td>' + day(q.pickup) + '</td><td>' + badge(q.status) + '</td><td>' + when(q.updated) + '</td><td><button class="small outline" onclick="openRequest(\'' + q.id + '\')">View details</button></td></tr>';
  });
  return h + '</table>';
}

function notifHtml(list) {
  if (!list.length) return '<div class="empty">You have no notifications.</div>';
  return list.map(function (n) { return '<p><b>' + esc(n.title) + '</b>' + (n.read ? '' : ' <span class="badge-count">new</span>') + '<br>' + esc(n.message) + '<br><span class="muted">' + when(n.date) + '</span></p>'; }).join('');
}

draw['r-dash'] = function () {
  $('welcome').textContent = 'Welcome, ' + me.name.split(' ')[0];
  var items = [];
  db.reports.filter(function (r) { return r.user == me.id && r.status != 'Resolved' && r.status != 'Closed'; }).forEach(function (r) { items.push('<p>Report: <a onclick="openReport(\'' + r.id + '\')">' + esc(r.title) + '</a> ' + badge(r.status) + '</p>'); });
  db.requests.filter(function (q) { return q.user == me.id && q.status != 'Released' && q.status != 'Rejected'; }).forEach(function (q) { items.push('<p>Request: <a onclick="openRequest(\'' + q.id + '\')">' + esc(q.type) + '</a> ' + badge(q.status) + '</p>'); });
  $('r-active').innerHTML = items.join('') || '<div class="empty">Nothing in progress.</div>';
  $('r-notifs').innerHTML = notifHtml(db.notifications.filter(function (n) { return n.user == me.id; }).slice(0, 3));
};
draw['report-new'] = function () { if (!$('rp-phone').value) $('rp-phone').value = me.phone; };
draw['request-new'] = function () { $('rq-pickup').min = new Date().toISOString().slice(0, 10); };
draw['r-reports']  = function () { $('r-reports-list').innerHTML  = reportRows(db.reports.filter(function (r) { return r.user == me.id; }), false); };
draw['r-requests'] = function () { $('r-requests-list').innerHTML = requestRows(db.requests.filter(function (q) { return q.user == me.id; }), false); };
draw['notifications'] = function () {
  var mine = db.notifications.filter(function (n) { return n.user == me.id; });
  $('notif-list').innerHTML = notifHtml(mine);
  mine.forEach(function (n) { n.read = true; }); save();   // marked as read after they are shown
};
draw['profile'] = function () { $('pf-name').value = me.name; $('pf-email').value = me.email; $('pf-phone').value = me.phone; $('pf-address').value = me.address; };

/* ----- Report details (residents and officers) ----- */
function openReport(id) {
  var r = db.reports.find(function (x) { return x.id == id; });
  if (!r || (me.role == 'resident' && r.user != me.id)) return toast('Report not found.');
  var isOfficer = me.role == 'officer', u = db.users.find(function (x) { return x.id == r.user; });
  var ups = db.updates.filter(function (x) { return x.ref == id && (isOfficer || !x.internal); }).reverse();
  var h = '<h2>' + esc(r.title) + '</h2><p>' + r.code + ' ' + badge(r.status) + '</p>';
  h += '<div class="box"><p><b>Category:</b> ' + esc(r.category) + '<br><b>Location:</b> ' + esc(r.location) + '<br><b>Incident:</b> ' + when(r.incident) + '<br><b>Submitted:</b> ' + when(r.created) + '<br><b>Assigned to:</b> ' + (r.officer ? esc(userName(r.officer)) : 'Not yet assigned') + '</p><p>' + esc(r.description) + '</p>';
  if (r.image) h += '<img src="' + r.image.data + '" alt="Photo of the problem" style="max-width:100%;max-height:260px;border-radius:10px">';
  if (r.resolution) h += '<p><b>Resolution:</b> ' + esc(r.resolution) + '</p>';
  h += '</div>';
  if (isOfficer && u) h += '<div class="box"><h3>Resident</h3><p>' + esc(u.name) + '<br>' + esc(u.address) + '<br>' + esc(r.phone) + ' Â· ' + esc(u.email) + '</p></div>';
  h += '<div class="box"><h3>Progress</h3>' + timeline(REPORT_STEPS.slice(0, 4), r.status == 'Closed' ? 'Resolved' : r.status, false) + '</div>';
  h += '<div class="box"><h3>Updates</h3>' + (ups.map(function (x) { return '<p>' + (x.internal ? '<b>Internal note</b>' : badge(x.status)) + ' <b>' + esc(userName(x.officer)) + '</b> <span class="muted">' + when(x.date) + '</span><br>' + esc(x.message) + '</p>'; }).join('') || '<p class="muted">No updates yet.</p>') + '</div>';
  if (isOfficer) {
    h += '<div class="box"><h3>Handle this report</h3><label>Assigned officer</label><select id="u-officer"><option value="">Unassigned</option>' + db.users.filter(function (o) { return o.role == 'officer'; }).map(function (o) { return '<option value="' + o.id + '"' + (r.officer == o.id ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') + '</select>';
    h += '<label>Status</label><select id="u-status">' + REPORT_STEPS.map(function (s) { return '<option' + (s == r.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>';
    h += '<label>Public update (the resident can see this)</label><textarea id="u-public" rows="2"></textarea><label>Internal note (officers only)</label><textarea id="u-note" rows="2"></textarea><br><button onclick="saveReportUpdate(\'' + id + '\')">Save update</button> ';
    if (r.status != 'Resolved' && r.status != 'Closed') h += '<button class="danger" style="background:var(--ok);border-color:var(--ok)" onclick="resolveReport(\'' + id + '\')">Mark as resolved</button>';
    h += '</div>';
  }
  $('detail-body').innerHTML = h; showPage('detail');
}

/* ----- Request details (residents and officers) ----- */
function openRequest(id) {
  var q = db.requests.find(function (x) { return x.id == id; });
  if (!q || (me.role == 'resident' && q.user != me.id)) return toast('Request not found.');
  var isOfficer = me.role == 'officer', u = db.users.find(function (x) { return x.id == q.user; });
  var ups = db.updates.filter(function (x) { return x.ref == id; }).reverse();
  var h = '<h2>' + esc(q.type) + '</h2><p>' + q.code + ' ' + badge(q.status) + '</p>';
  h += '<div class="box"><p><b>Purpose:</b> ' + esc(q.purpose) + '<br><b>Copies:</b> ' + q.copies + '<br><b>Preferred pickup:</b> ' + day(q.pickup) + '<br><b>Requested:</b> ' + when(q.created) + '</p>';
  if (q.info) h += '<p>' + esc(q.info) + '</p>';
  if (q.file) h += '<p>Attachment: <a href="' + q.file.data + '" download="' + esc(q.file.name) + '">' + esc(q.file.name) + '</a></p>';
  if (q.reason) h += '<p><b>Reason for rejection:</b> ' + esc(q.reason) + '</p>';
  if (q.status == 'Ready for Pickup') h += '<p><b>Your document is ready.</b> Bring one valid ID to the Barangay Hall.</p>';
  h += '</div>';
  if (isOfficer && u) h += '<div class="box"><h3>Resident</h3><p>' + esc(u.name) + '<br>' + esc(u.address) + '<br>' + esc(u.phone) + ' Â· ' + esc(u.email) + '</p></div>';
  h += '<div class="box"><h3>Progress</h3>' + timeline(REQUEST_STEPS, q.status, q.status == 'Rejected') + '</div>';
  h += '<div class="box"><h3>Updates</h3>' + (ups.map(function (x) { return '<p>' + badge(x.status) + ' <span class="muted">' + when(x.date) + '</span><br>' + esc(x.message) + '</p>'; }).join('') || '<p class="muted">No updates yet.</p>') + '</div>';
  if (isOfficer) {
    var actions = {'Submitted':[['Approve','Processing'],['Reject','Rejected']], 'Processing':[['Mark ready for pickup','Ready for Pickup'],['Reject','Rejected']], 'Ready for Pickup':[['Mark as released','Released']]}[q.status] || [];
    h += '<div class="box"><h3>Actions</h3>' + (actions.map(function (a) { return '<button class="' + (a[1] == 'Rejected' ? 'danger' : '') + '" onclick="changeRequest(\'' + id + '\',\'' + a[1] + '\',\'' + a[0] + '\')">' + a[0] + '</button> '; }).join('') || '<p class="muted">No further actions. This request is complete.</p>') + '</div>';
  }
  $('detail-body').innerHTML = h; showPage('detail');
}

/* ----- Officer pages ----- */
draw['o-dash'] = function () {
  var R = db.reports, Q = db.requests;
  function count(list, fn) { return list.filter(fn).length; }
  var stats = [['Total Reports', R.length], ['Pending Reports', count(R, function (r) { return r.status == 'Submitted' || r.status == 'Under Review'; })],
    ['Reports In Progress', count(R, function (r) { return r.status == 'In Progress'; })], ['Resolved Reports', count(R, function (r) { return r.status == 'Resolved' || r.status == 'Closed'; })],
    ['Total Document Requests', Q.length], ['Pending Document Requests', count(Q, function (q) { return q.status == 'Submitted' || q.status == 'Processing'; })],
    ['Completed Requests', count(Q, function (q) { return q.status == 'Released'; })]];
  $('o-stats').innerHTML = stats.map(function (s) { return '<div class="box"><span class="stat">' + s[1] + '</span>' + s[0] + '</div>'; }).join('');
  $('o-chart').innerHTML = REPORT_STEPS.map(function (s) { var n = count(R, function (r) { return r.status == s; }); return '<div class="bar"><div style="width:' + (R.length ? Math.max(n / R.length * 100, 8) : 8) + '%">' + s + ': ' + n + '</div></div>'; }).join('');
};

function fillOptions(selectId, list) { var s = $(selectId); if (s.options.length == 1) list.forEach(function (x) { s.add(new Option(x, x)); }); }

function renderOfficerReports() {
  fillOptions('f-rc', CATEGORIES); fillOptions('f-rs', REPORT_STEPS);
  var q = $('f-rq').value.toLowerCase(), c = $('f-rc').value, s = $('f-rs').value, d = $('f-rd').value;
  var list = db.reports.filter(function (r) {
    return (!q || (r.title + r.code + userName(r.user) + r.location).toLowerCase().indexOf(q) >= 0) && (!c || r.category == c) && (!s || r.status == s) && (!d || r.created.slice(0, 10) >= d);
  });
  $('o-reports-list').innerHTML = reportRows(list, true);
}
draw['o-reports'] = renderOfficerReports;

function renderOfficerRequests() {
  fillOptions('f-qt', DOC_TYPES); fillOptions('f-qs', REQUEST_STEPS.concat(['Rejected']));
  var q = $('f-qq').value.toLowerCase(), t = $('f-qt').value, s = $('f-qs').value;
  var list = db.requests.filter(function (r) { return (!q || (r.code + r.type + userName(r.user)).toLowerCase().indexOf(q) >= 0) && (!t || r.type == t) && (!s || r.status == s); });
  $('o-requests-list').innerHTML = requestRows(list, true);
}
draw['o-requests'] = renderOfficerRequests;

function renderResidents() {
  var q = $('f-res').value.toLowerCase();
  var list = db.users.filter(function (u) { return u.role == 'resident' && (!q || (u.name + u.email + u.address).toLowerCase().indexOf(q) >= 0); });
  if (!list.length) { $('o-residents-list').innerHTML = '<div class="empty">No residents found.</div>'; return; }
  var h = '<table><tr><th>Name</th><th>Address</th><th>Phone</th><th>Reports</th><th>Requests</th><th>Account</th><th></th></tr>';
  list.forEach(function (u) {   // phone is partly hidden so we do not expose more than needed
    var nr = db.reports.filter(function (r) { return r.user == u.id; }).length, nq = db.requests.filter(function (r) { return r.user == u.id; }).length;
    h += '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.address) + '</td><td>' + esc(u.phone.slice(0, 4)) + '*****' + esc(u.phone.slice(-2)) + '</td><td>' + nr + '</td><td>' + nq + '</td><td>' + (u.active ? 'Active' : 'Deactivated') + '</td><td><button class="small ' + (u.active ? 'danger' : '') + '" onclick="toggleResident(\'' + u.id + '\')">' + (u.active ? 'Deactivate' : 'Reactivate') + '</button></td></tr>';
  });
  $('o-residents-list').innerHTML = h + '</table>';
}
draw['o-residents'] = renderResidents;

/* =====================================================================
   START-UP + CYCLING WORD
   ===================================================================== */
(async function () {
  try { db = JSON.parse(localStorage.getItem('barangay_db')); } catch (x) { db = null; }
  if (!db) { db = await makeSampleData(); save(); }
  var uid = sessionStorage.getItem('uid');
  me = uid ? db.users.find(function (u) { return u.id == uid && u.active; }) || null : null;
  updateMenu();
})();

// The word next to REPORT MO! button changes every 2 seconds.
// REMEMBER CHANGE CSS YUNG .changing-word TO MATCH THE LENGTH OF THE LONGEST WORD IN THIS LIST BAKA MABALIW KA
var words = ['Maingay?', 'Baha?', 'Basura?', 'Madilim?', 'Sira ang kalsada?'], current = 0;
setInterval(function () { current = (current + 1) % words.length; $('changing-word').textContent = words[current]; }, 2000);
