console.log("Starting server initialization...");

process.on("uncaughtException", (error) => {
  console.error("[uncaughtException] Unhandled exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[unhandledRejection] Unhandled promise rejection at:", promise, "reason:", reason);
  process.exit(1);
});

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const DB_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DB_DIR, "team_task_manager.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new sqlite3.Database(DB_FILE);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      return resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      return resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      return resolve(rows);
    });
  });
}

async function initializeDatabase() {
  console.log("Initializing database at:", DB_FILE);

  try {
    await run("PRAGMA foreign_keys = ON");
    console.log("Database connection established, foreign keys enabled.");
  } catch (error) {
    console.error("Failed to enable foreign keys:", error);
    throw error;
  }

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      owner_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS project_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      added_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')) DEFAULT 'todo',
      due_date TEXT,
      project_id INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

function tokenFor(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "2d"
  });
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Missing token." });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

function adminRequired(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  return next();
}

async function isProjectMember(projectId, userId) {
  const member = await get(
    "SELECT id FROM project_members WHERE project_id = ? AND user_id = ?",
    [projectId, userId]
  );
  return Boolean(member);
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.send("Team Task Manager API is running");
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = String(req.body.role || "member");

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }
    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({ message: "Role must be admin or member." });
    }

    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      return res.status(409).json({ message: "Email already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insert = await run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, role]
    );
    const user = await get("SELECT id, name, email, role FROM users WHERE id = ?", [insert.id]);
    const token = tokenFor(user);
    return res.status(201).json({ token, user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create account.", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) return res.status(401).json({ message: "Invalid credentials." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials." });

    const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = tokenFor(safeUser);
    return res.json({ token, user: safeUser });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login.", error: error.message });
  }
});

app.get("/api/projects", authRequired, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT p.id, p.name, p.description, p.owner_id, p.created_at
      FROM projects p
      INNER JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
      `,
      [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch projects.", error: error.message });
  }
});

app.post("/api/projects", authRequired, adminRequired, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim();
    if (!name) return res.status(400).json({ message: "Project name is required." });

    const insert = await run(
      "INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)",
      [name, description, req.user.id]
    );

    await run(
      "INSERT INTO project_members (project_id, user_id, added_by) VALUES (?, ?, ?)",
      [insert.id, req.user.id, req.user.id]
    );

    const project = await get("SELECT * FROM projects WHERE id = ?", [insert.id]);
    return res.status(201).json(project);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create project.", error: error.message });
  }
});

app.get("/api/projects/:projectId/members", authRequired, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId)) {
      return res.status(400).json({ message: "Invalid project id." });
    }

    const allowed = await isProjectMember(projectId, req.user.id);
    if (!allowed) return res.status(403).json({ message: "Project access denied." });

    const members = await all(
      `
      SELECT u.id, u.name, u.email, u.role
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.name ASC
      `,
      [projectId]
    );
    return res.json(members);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch members.", error: error.message });
  }
});

app.post("/api/projects/:projectId/members", authRequired, adminRequired, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const userId = Number(req.body.userId);
    if (!Number.isInteger(projectId) || !Number.isInteger(userId)) {
      return res.status(400).json({ message: "Invalid ids." });
    }

    const project = await get("SELECT id FROM projects WHERE id = ?", [projectId]);
    if (!project) return res.status(404).json({ message: "Project not found." });

    const user = await get("SELECT id FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ message: "User not found." });

    await run(
      "INSERT OR IGNORE INTO project_members (project_id, user_id, added_by) VALUES (?, ?, ?)",
      [projectId, userId, req.user.id]
    );

    return res.status(201).json({ message: "Member added." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add member.", error: error.message });
  }
});

app.delete(
  "/api/projects/:projectId/members/:userId",
  authRequired,
  adminRequired,
  async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const userId = Number(req.params.userId);
      if (!Number.isInteger(projectId) || !Number.isInteger(userId)) {
        return res.status(400).json({ message: "Invalid ids." });
      }

      const project = await get("SELECT owner_id FROM projects WHERE id = ?", [projectId]);
      if (!project) return res.status(404).json({ message: "Project not found." });
      if (project.owner_id === userId) {
        return res.status(400).json({ message: "Cannot remove project owner." });
      }

      await run("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", [
        projectId,
        userId
      ]);
      return res.status(204).send();
    } catch (error) {
      return res.status(500).json({ message: "Failed to remove member.", error: error.message });
    }
  }
);

app.get("/api/users", authRequired, adminRequired, async (_req, res) => {
  try {
    const users = await all("SELECT id, name, email, role, created_at FROM users ORDER BY id DESC");
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users.", error: error.message });
  }
});

app.get("/api/tasks", authRequired, async (req, res) => {
  try {
    const projectId = Number(req.query.projectId);
    if (!Number.isInteger(projectId)) {
      return res.status(400).json({ message: "projectId query is required." });
    }

    const allowed = await isProjectMember(projectId, req.user.id);
    if (!allowed) return res.status(403).json({ message: "Project access denied." });

    const rows = await all(
      `
      SELECT t.*, u.name AS assignee_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
      `,
      [projectId]
    );
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks.", error: error.message });
  }
});

app.post("/api/tasks", authRequired, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const projectId = Number(req.body.projectId);
    const assignedTo = Number(req.body.assignedTo);
    const dueDate = req.body.dueDate ? String(req.body.dueDate) : null;

    if (!title || !Number.isInteger(projectId) || !Number.isInteger(assignedTo)) {
      return res.status(400).json({ message: "title, projectId, and assignedTo are required." });
    }

    const allowed = await isProjectMember(projectId, req.user.id);
    if (!allowed) return res.status(403).json({ message: "Project access denied." });

    const assigneeIsMember = await isProjectMember(projectId, assignedTo);
    if (!assigneeIsMember) {
      return res.status(400).json({ message: "Assignee must be a project member." });
    }

    const insert = await run(
      `
      INSERT INTO tasks (title, description, project_id, assigned_to, created_by, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [title, description, projectId, assignedTo, req.user.id, dueDate]
    );

    const task = await get("SELECT * FROM tasks WHERE id = ?", [insert.id]);
    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create task.", error: error.message });
  }
});

app.patch("/api/tasks/:taskId", authRequired, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) return res.status(400).json({ message: "Invalid task id." });

    const task = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) return res.status(404).json({ message: "Task not found." });

    const allowed = await isProjectMember(task.project_id, req.user.id);
    if (!allowed) return res.status(403).json({ message: "Project access denied." });

    const status = req.body.status ? String(req.body.status) : task.status;
    const title = req.body.title ? String(req.body.title).trim() : task.title;
    const description =
      req.body.description !== undefined ? String(req.body.description).trim() : task.description;
    const dueDate = req.body.dueDate !== undefined ? String(req.body.dueDate || "") : task.due_date;
    const assignedTo = req.body.assignedTo !== undefined ? Number(req.body.assignedTo) : task.assigned_to;

    if (!["todo", "in_progress", "done"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }
    if (!title) return res.status(400).json({ message: "Title cannot be empty." });
    if (!Number.isInteger(assignedTo)) {
      return res.status(400).json({ message: "Invalid assignedTo." });
    }

    const assigneeIsMember = await isProjectMember(task.project_id, assignedTo);
    if (!assigneeIsMember) {
      return res.status(400).json({ message: "Assignee must be a project member." });
    }

    await run(
      `
      UPDATE tasks
      SET title = ?, description = ?, status = ?, due_date = ?, assigned_to = ?, updated_at = datetime('now')
      WHERE id = ?
      `,
      [title, description, status, dueDate || null, assignedTo, taskId]
    );

    const updated = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update task.", error: error.message });
  }
});

app.delete("/api/tasks/:taskId", authRequired, async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    if (!Number.isInteger(taskId)) return res.status(400).json({ message: "Invalid task id." });

    const task = await get("SELECT * FROM tasks WHERE id = ?", [taskId]);
    if (!task) return res.status(404).json({ message: "Task not found." });

    const allowed = await isProjectMember(task.project_id, req.user.id);
    if (!allowed) return res.status(403).json({ message: "Project access denied." });

    await run("DELETE FROM tasks WHERE id = ?", [taskId]);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete task.", error: error.message });
  }
});

app.get("/api/dashboard", authRequired, async (req, res) => {
  try {
    const total = await get("SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ?", [req.user.id]);
    const todo = await get(
      "SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status = 'todo'",
      [req.user.id]
    );
    const inProgress = await get(
      "SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status = 'in_progress'",
      [req.user.id]
    );
    const done = await get(
      "SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status = 'done'",
      [req.user.id]
    );
    const overdue = await get(
      `
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE assigned_to = ?
        AND due_date IS NOT NULL
        AND date(due_date) < date('now')
        AND status != 'done'
      `,
      [req.user.id]
    );

    return res.json({
      tasks: {
        total: total.count,
        todo: todo.count,
        inProgress: inProgress.count,
        done: done.count,
        overdue: overdue.count
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load dashboard.", error: error.message });
  }
});

app.use((error, _req, res, _next) => {
  return res.status(500).json({ message: "Unexpected server error.", error: error.message });
});

initializeDatabase()
  .then(() => {
    console.log("Database initialized successfully. Starting HTTP server on port " + PORT + "...");
    app.listen(PORT, "0.0.0.0", () => {
      console.log("Server is ready and listening on port " + PORT);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed — server will not start:", error);
    process.exit(1);
  });
