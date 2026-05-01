# Team Task Manager (Full-Stack)

This project satisfies the assignment requirements with:

- Authentication (signup/login)
- Project and team management
- Task creation, assignment, and status tracking
- Dashboard (my tasks by status + overdue count)
- Role-based access control (Admin/Member)
- REST APIs backed by SQL database (SQLite)

## Stack

- Backend: Node.js + Express
- Database: SQLite (data/team_task_manager.db)
- Auth: JWT + bcrypt
- Frontend: HTML/CSS/Vanilla JS served by Express

## API Overview

### Auth
- POST /api/auth/signup
- POST /api/auth/login

### Projects
- GET /api/projects (auth)
- POST /api/projects (admin only)
- GET /api/projects/:projectId/members
- POST /api/projects/:projectId/members (admin only)
- DELETE /api/projects/:projectId/members/:userId (admin only)

### Users
- GET /api/users (admin only)

### Tasks
- GET /api/tasks?projectId=<id>
- POST /api/tasks
- PATCH /api/tasks/:taskId
- DELETE /api/tasks/:taskId

### Dashboard
- GET /api/dashboard

## Validation and Relationships

- Email is unique
- Password minimum length is 6
- Role must be either 'admin' or 'member'
- Project members must be unique per project
- Task rules:
  - status must be 'todo', 'in_progress', or 'done'
  - project must exist
  - assignee must belong to the project
- SQLite foreign keys are enabled

## Local Run

1. Install Node.js (v18+)

2. Install dependencies:
   npm install

3. Set environment variable:
   set JWT_SECRET=your_super_secret_key

4. Start server:
   npm start

5. Open:
   http://localhost:3000

## Render Deployment

1. Push your project to GitHub

2. Go to https://render.com

3. Click "New +" → "Web Service"

4. Connect your GitHub repository

5. Use the following settings:

   Build Command:
   npm install

   Start Command:
   npm start

6. Add Environment Variable:

   JWT_SECRET=your_super_secret_key

7. Click Deploy

8. After deployment, open your app:

   https://your-app-name.onrender.com

## Important Notes

- Make sure your server uses:
  const PORT = process.env.PORT || 3000;

- Ensure frontend is served using:
  app.use(express.static("public"));

- SQLite works but data may reset on free tier redeploy

- For production, use PostgreSQL instead of SQLite
