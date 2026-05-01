# 🚀 Team Task Manager (Full-Stack)

🌐 **Live Demo:** https://team-task-manager-7pud.onrender.com/

This project satisfies the assignment requirements with:

- 🔐 Authentication (signup/login)
- 📁 Project and team management
- ✅ Task creation, assignment, and status tracking
- 📊 Dashboard (my tasks by status + overdue count)
- 🛡️ Role-based access control (Admin/Member)
- 🔗 REST APIs backed by SQL database (SQLite)

## 🛠️ Stack

- Backend: Node.js + Express
- Database: SQLite (data/team_task_manager.db)
- Auth: JWT + bcrypt
- Frontend: HTML/CSS/Vanilla JS served by Express

## 📡 API Overview

### 🔐 Auth
- POST /api/auth/signup
- POST /api/auth/login

### 📁 Projects
- GET /api/projects (auth)
- POST /api/projects (admin only)
- GET /api/projects/:projectId/members (project members)
- POST /api/projects/:projectId/members (admin only)
- DELETE /api/projects/:projectId/members/:userId (admin only)

### 👤 Users
- GET /api/users (admin only)

### ✅ Tasks
- GET /api/tasks?projectId=<id> (project members)
- POST /api/tasks (project members, assignee must be member)
- PATCH /api/tasks/:taskId (project members)
- DELETE /api/tasks/:taskId (project members)

### 📊 Dashboard
- GET /api/dashboard (my totals + overdue)

## ✔️ Validation and Relationships

- Email is unique  
- Password length minimum 6  
- Role is restricted to `admin` or `member`  
- Project members are unique per project  

### Task Rules
- status must be `todo`, `in_progress`, or `done`
- project must exist
- assignee must belong to the same project

- Foreign keys are enabled in SQLite  

## 💻 Local Run

1. Install Node.js 18+

2. Install dependencies:
   npm install

3. Optional: set environment variable:
   set JWT_SECRET=replace_with_long_random_value

4. Start server:
   npm start

5. Open:
   http://localhost:3000

## 🌐 Render Deployment

1. Push this project to GitHub  

2. Go to https://render.com  

3. Click **New + → Web Service**  

4. Connect your GitHub repository  

5. Use the following settings:

   Build Command:
   npm install

   Start Command:
   npm start

6. Add Environment Variable:

   JWT_SECRET=your_super_secret_key

7. Click **Deploy**

8. After deployment, open:

   https://your-app-name.onrender.com

## ⚠️ Important Notes

- Make sure your server uses:
  const PORT = process.env.PORT || 3000;

- Ensure frontend is served using:
  app.use(express.static("public"));

- SQLite works but data may reset on free tier redeploy  

- For production, use PostgreSQL instead of SQLite
