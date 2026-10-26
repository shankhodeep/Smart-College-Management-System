const API = "/api";
let dashboardData = { students: [], notices: [], schedule: [] };
let currentRole = "student";
let messageTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function showMessage(text, type = "success") {
  const box = $("#message");
  box.textContent = text;
  box.className = `message ${type}`;
  box.hidden = false;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { box.hidden = true; }, 4500);
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function renderStats() {
  $("#total-students").textContent = dashboardData.totalStudents ?? dashboardData.students.length;
  $("#average-attendance").textContent = `${dashboardData.averageAttendance ?? 0}%`;
  $("#average-marks").textContent = dashboardData.averageMarks ?? 0;
  $("#total-notices").textContent = dashboardData.totalNotices ?? dashboardData.notices.length;
  $("#notice-count").textContent = dashboardData.notices.length;
}

function renderProfile() {
  const student = dashboardData.students[0];
  if (!student) {
    $("#student-profile").innerHTML = '<div class="empty-state">No student records yet. Add one from the Faculty / Admin view.</div>';
    $("#student-progress").innerHTML = "";
    return;
  }
  $("#student-profile").innerHTML = `
    <div class="profile-avatar">${escapeHtml(initials(student.name))}</div>
    <div class="profile-info"><strong>${escapeHtml(student.name)}</strong><span>${escapeHtml(student.course)} · ${escapeHtml(student.year)}</span><span>${escapeHtml(student.email)}</span></div>
    <span class="profile-id">${escapeHtml(student.id)}</span>`;
  $("#student-progress").innerHTML = `
    <div class="progress-row"><div class="progress-label"><span>Attendance</span><span>${Number(student.attendance)}%</span></div><div class="progress-track"><div class="progress-fill green-fill" style="width:${Number(student.attendance)}%"></div></div></div>
    <div class="progress-row"><div class="progress-label"><span>Academic marks</span><span>${Number(student.marks)}/100</span></div><div class="progress-track"><div class="progress-fill" style="width:${Number(student.marks)}%"></div></div></div>`;
}

function noticeMarkup(notice) {
  return `<article class="notice-item"><div class="notice-symbol">◉</div><div><h4>${escapeHtml(notice.title)}</h4><p>${escapeHtml(notice.message)}</p><time>${escapeHtml(formatDate(notice.date))}</time></div></article>`;
}

function renderNotices() {
  $("#latest-notices").innerHTML = dashboardData.notices.slice(0, 3).map(noticeMarkup).join("") || '<div class="empty-state">No notices yet.</div>';
  $("#all-notices").innerHTML = dashboardData.notices.map(notice => `
    <article class="notice-card"><div class="notice-symbol">◉</div><h3>${escapeHtml(notice.title)}</h3><p>${escapeHtml(notice.message)}</p><time>Published ${escapeHtml(formatDate(notice.date))}</time></article>
  `).join("") || '<div class="panel empty-state">No notices have been published.</div>';
}

function renderStudents(filter = "") {
  const normalizedFilter = filter.trim().toLowerCase();
  const students = dashboardData.students.filter(student =>
    [student.name, student.id, student.email, student.course, student.year].some(value => String(value).toLowerCase().includes(normalizedFilter))
  );
  const actionHeader = $("th.admin-only");
  if (actionHeader) actionHeader.hidden = currentRole !== "admin";
  $("#students-table").innerHTML = students.map(student => `
    <tr>
      <td><div class="student-cell"><div class="student-mini">${escapeHtml(initials(student.name))}</div><div><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.email)}</small></div></div></td>
      <td>${escapeHtml(student.id)}</td>
      <td>${escapeHtml(student.course)}<br><small>${escapeHtml(student.year)}</small></td>
      <td><span class="percent ${Number(student.attendance) < 75 ? "low" : ""}">${Number(student.attendance)}%</span></td>
      <td><strong>${Number(student.marks)}/100</strong></td>
      ${currentRole === "admin" ? `<td><div class="action-cell"><button class="small-action" data-action="attendance" data-id="${escapeHtml(student.id)}">Attendance</button><button class="small-action" data-action="marks" data-id="${escapeHtml(student.id)}">Marks</button></div></td>` : ""}
    </tr>
  `).join("") || `<tr><td colspan="${currentRole === "admin" ? 6 : 5}"><div class="empty-state">No matching students found.</div></td></tr>`;
}

function renderSchedule() {
  $("#schedule-list").innerHTML = dashboardData.schedule.map(item => {
    const date = item.day.slice(0, 3);
    return `<article class="schedule-card"><div class="schedule-day"><strong>${escapeHtml(date)}</strong><span>${escapeHtml(item.day)}</span></div><div class="schedule-info"><strong>${escapeHtml(item.subject)}</strong><span>${escapeHtml(item.time)} · ${escapeHtml(item.room)}</span></div></article>`;
  }).join("") || '<div class="empty-state">No schedule has been added.</div>';
}

function setRole(role) {
  currentRole = role;
  const isAdmin = role === "admin";
  $("#welcome-title").textContent = isAdmin ? "Your campus at a glance." : "Learning starts with a clear plan.";
  $("#welcome-copy").textContent = isAdmin
    ? "Manage student records, update academic progress and share campus announcements."
    : "Keep track of your attendance, marks, classes and campus updates in one place.";
  $("#student-panel-title").textContent = isAdmin ? "Student snapshot" : "My student profile";
  $$(".admin-only").forEach(element => { element.hidden = !isAdmin; });
  renderStudents($("#student-search").value);
}

async function loadDashboard() {
  try {
    dashboardData = await apiRequest("/dashboard");
    renderStats();
    renderProfile();
    renderNotices();
    renderStudents($("#student-search").value);
    renderSchedule();
  } catch (error) {
    showMessage(`${error.message} Make sure the server is running.`, "error");
  }
}

function navigate(section) {
  $$(".page-section").forEach(page => { page.hidden = page.id !== `${section}-section`; });
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.section === section));
  const titles = { overview: "Good evening 👋", students: "Student records", schedule: "Course schedule", notices: "Campus notices" };
  $("#page-title").textContent = titles[section] || "EDUSmart";
  if (section === "students") renderStudents($("#student-search").value);
}

$$(".nav-item").forEach(button => button.addEventListener("click", () => navigate(button.dataset.section)));
$$("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
$("#role-select").addEventListener("change", event => setRole(event.target.value));
$("#student-search").addEventListener("input", event => renderStudents(event.target.value));

$("#students-table").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || currentRole !== "admin") return;
  const student = dashboardData.students.find(item => item.id === button.dataset.id);
  if (!student) return;

  const isAttendance = button.dataset.action === "attendance";
  const label = isAttendance ? "attendance percentage (0–100)" : "marks out of 100";
  const existing = isAttendance ? student.attendance : student.marks;
  const answer = window.prompt(`Enter ${label} for ${student.name}:`, String(existing));
  if (answer === null) return;
  if (answer.trim() === "" || !Number.isFinite(Number(answer)) || Number(answer) < 0 || Number(answer) > 100) {
    showMessage("Please enter a number from 0 to 100.", "error");
    return;
  }

  try {
    const field = isAttendance ? "attendance" : "marks";
    await apiRequest(`/students/${encodeURIComponent(student.id)}/${field}`, {
      method: "PATCH",
      body: JSON.stringify({ [field]: Number(answer) })
    });
    await loadDashboard();
    showMessage(`${isAttendance ? "Attendance" : "Marks"} updated for ${student.name}.`);
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("#add-student-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (currentRole !== "admin") return;
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await apiRequest("/students", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadDashboard();
    showMessage("Student record added successfully.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("#notice-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (currentRole !== "admin") return;
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await apiRequest("/notices", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadDashboard();
    showMessage("Notice published successfully.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

loadDashboard();
setInterval(loadDashboard, 30000);