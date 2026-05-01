const state = {
  token: localStorage.getItem("token") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  selectedProjectId: null
};

const messageEl = document.getElementById("message");
const currentUserEl = document.getElementById("current-user");
const projectSelect = document.getElementById("project-select");
const projectList = document.getElementById("project-list");
const memberList = document.getElementById("member-list");
const userList = document.getElementById("user-list");
const taskList = document.getElementById("task-list");
const dashboardList = document.getElementById("dashboard-list");
const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const showLoginBtn = document.getElementById("show-login");
const showSignupBtn = document.getElementById("show-signup");

function isAdminUser() {
  const role = String(state.user?.role || "")
    .trim()
    .toLowerCase();
  return role === "admin";
}

function showMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.style.color = isError ? "#b91c1c" : "#065f46";
}

function authHeaders(extra = {}) {
  return state.token
    ? { ...extra, Authorization: `Bearer ${state.token}` }
    : { ...extra };
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  return response.status === 204 ? null : response.json();
}

function updateUserBar() {
  if (state.user) {
    currentUserEl.textContent = `${state.user.name} (${state.user.role})`;
  } else {
    currentUserEl.textContent = "Not logged in";
  }
}

function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  updateUserBar();
}

function clearSession() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  updateUserBar();
  showAuthView("login");
  showMessage("Logged out.");
}

function showAuthView(type) {
  if (type === "signup") {
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    showSignupBtn.disabled = true;
    showLoginBtn.disabled = false;
  } else {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    showLoginBtn.disabled = true;
    showSignupBtn.disabled = false;
  }
}

function showMainDashboard() {
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  document.body.classList.add("logged-in");
}

function showAuthOnly() {
  authSection.classList.remove("hidden");
  appSection.classList.add("hidden");
  document.body.classList.remove("logged-in");
}

function renderProjects(projects) {
  projectList.innerHTML = "";
  projectSelect.innerHTML = "";
  for (const project of projects) {
    const li = document.createElement("li");
    li.textContent = `#${project.id} ${project.name} - ${project.description || "No description"}`;
    projectList.appendChild(li);

    const option = document.createElement("option");
    option.value = String(project.id);
    option.textContent = `${project.name} (#${project.id})`;
    projectSelect.appendChild(option);
  }
  if (projects.length > 0) {
    state.selectedProjectId = Number(projectSelect.value);
  } else {
    state.selectedProjectId = null;
  }
}

function renderMembers(members) {
  memberList.innerHTML = "";
  for (const member of members) {
    const li = document.createElement("li");
    li.className = "item-with-action";
    li.innerHTML = `
      <span>#${member.id} ${member.name} (${member.role})</span>
      ${
        isAdminUser()
          ? `<button type="button" class="danger small delete-member-btn" data-user-id="${member.id}">Remove</button>`
          : ""
      }
    `;
    memberList.appendChild(li);
  }
}

function renderUsers(users) {
  userList.innerHTML = "";
  for (const user of users) {
    const li = document.createElement("li");
    li.textContent = `#${user.id} ${user.name} - ${user.email} (${user.role})`;
    userList.appendChild(li);
  }
}

function renderTasks(tasks) {
  taskList.innerHTML = "";
  for (const task of tasks) {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>#${task.id} ${task.title}</strong><br>
      ${task.description || "No description"}<br>
      Status: ${task.status} | Assigned to: ${task.assignee_name || task.assigned_to}<br>
      Due: ${task.due_date || "N/A"}
    `;
    taskList.appendChild(li);
  }
}

function renderDashboard(data) {
  dashboardList.innerHTML = `
    <li>Total: ${data.tasks.total}</li>
    <li>To Do: ${data.tasks.todo}</li>
    <li>In Progress: ${data.tasks.inProgress}</li>
    <li>Done: ${data.tasks.done}</li>
    <li>Overdue: ${data.tasks.overdue}</li>
  `;
}

async function loadProjects() {
  const projects = await api("/api/projects", { headers: authHeaders() });
  renderProjects(projects);
  await loadMembersAndTasks();
}

async function loadMembersAndTasks() {
  const projectId = state.selectedProjectId;
  if (!projectId) {
    renderMembers([]);
    renderTasks([]);
    return;
  }
  const [members, tasks] = await Promise.all([
    api(`/api/projects/${projectId}/members`, { headers: authHeaders() }),
    api(`/api/tasks?projectId=${projectId}`, { headers: authHeaders() })
  ]);
  renderMembers(members);
  renderTasks(tasks);
}

async function loadUsersIfAdmin() {
  if (!isAdminUser()) {
    userList.innerHTML = "";
    return;
  }
  const users = await api("/api/users", { headers: authHeaders() });
  renderUsers(users);
}

async function loadDashboard() {
  const data = await api("/api/dashboard", { headers: authHeaders() });
  renderDashboard(data);
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      name: document.getElementById("signup-name").value.trim(),
      email: document.getElementById("signup-email").value.trim(),
      password: document.getElementById("signup-password").value,
      role: document.getElementById("signup-role").value
    };
    const data = await api("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    saveSession(data.token, data.user);
    showMainDashboard();
    await loadProjects();
    await loadUsersIfAdmin();
    await loadDashboard();
    showMessage("Signup successful.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      email: document.getElementById("login-email").value.trim(),
      password: document.getElementById("login-password").value
    };
    const data = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    saveSession(data.token, data.user);
    showMainDashboard();
    await loadProjects();
    await loadUsersIfAdmin();
    await loadDashboard();
    showMessage("Login successful.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  clearSession();
  showAuthOnly();
});

showLoginBtn.addEventListener("click", () => showAuthView("login"));
showSignupBtn.addEventListener("click", () => showAuthView("signup"));

document.getElementById("project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      name: document.getElementById("project-name").value.trim(),
      description: document.getElementById("project-description").value.trim()
    };
    await api("/api/projects", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    await loadProjects();
    showMessage("Project created.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

projectSelect.addEventListener("change", async () => {
  state.selectedProjectId = Number(projectSelect.value);
  try {
    await loadMembersAndTasks();
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("load-project-data").addEventListener("click", async () => {
  try {
    await loadMembersAndTasks();
    showMessage("Project data loaded.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("member-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const userId = Number(document.getElementById("member-user-id").value);
    if (!state.selectedProjectId) throw new Error("Select a project first.");
    await api(`/api/projects/${state.selectedProjectId}/members`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ userId })
    });
    await loadMembersAndTasks();
    showMessage("Member added.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

memberList.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-member-btn");
  if (!button) return;

  try {
    if (!state.selectedProjectId) throw new Error("Select a project first.");
    const userId = Number(button.dataset.userId);
    await api(`/api/projects/${state.selectedProjectId}/members/${userId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    await loadMembersAndTasks();
    showMessage("Member removed.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("task-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!state.selectedProjectId) throw new Error("Select a project first.");
    const payload = {
      title: document.getElementById("task-title").value.trim(),
      description: document.getElementById("task-description").value.trim(),
      assignedTo: Number(document.getElementById("task-assigned-to").value),
      dueDate: document.getElementById("task-due-date").value || null,
      projectId: state.selectedProjectId
    };
    await api("/api/tasks", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload)
    });
    await loadMembersAndTasks();
    await loadDashboard();
    showMessage("Task created.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("refresh-dashboard").addEventListener("click", async () => {
  try {
    await loadDashboard();
    showMessage("Dashboard refreshed.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

async function bootstrap() {
  updateUserBar();
  if (state.token && state.user) {
    try {
      showMainDashboard();
      await loadProjects();
      await loadUsersIfAdmin();
      await loadDashboard();
    } catch (error) {
      clearSession();
      showMessage(error.message, true);
    }
  } else {
    showAuthOnly();
    showAuthView("login");
  }
}

bootstrap();
