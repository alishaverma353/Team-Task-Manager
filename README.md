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
- Database: SQLite (`data/team_task_manager.db`)
- Auth: JWT + bcrypt
- Frontend: HTML/CSS/Vanilla JS served by Express

## API Overview

- Auth
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
- Projects
  - `GET /api/projects` (auth)
  - `POST /api/projects` (admin only)
  - `GET /api/projects/:projectId/members` (project members)
  - `POST /api/projects/:projectId/members` (admin only)
  - `DELETE /api/projects/:projectId/members/:userId` (admin only)
- Users
  - `GET /api/users` (admin only)
- Tasks
  - `GET /api/tasks?projectId=<id>` (project members)
  - `POST /api/tasks` (project members, assignee must be member)
  - `PATCH /api/tasks/:taskId` (project members)
  - `DELETE /api/tasks/:taskId` (project members)
- Dashboard
  - `GET /api/dashboard` (my totals + overdue)

## Validation and Relationships

- Email is unique.
- Password length minimum 6.
- Role is restricted to `admin` or `member`.
- Project members are unique per project.
- Tasks enforce:
  - status in `todo`, `in_progress`, `done`
  - valid project reference
  - assignee must be in the same project
- Foreign keys are enabled in SQLite.

## Local Run

1. Install Node.js 18+.
2. Install dependencies:

```bash
npm install
```

3. Optional: set environment variable for production-grade token secret.

```bash
set JWT_SECRET=replace_with_long_random_value
```

4. Start:

```bash
npm start
```

5. Open:

`http://localhost:3000`

## Railway Deployment (Mandatory)

1. Push this project to GitHub.
2. In [Railway](https://railway.app), create **New Project**.
3. Choose **Deploy from GitHub Repo** and select this repo.
4. In service variables, set:
   - `JWT_SECRET` = a long random secret
5. Railway auto-provides `PORT`, and app already uses it.
6. Deploy and open the generated Railway domain.

## Notes

- SQLite data is created automatically at first start.
- For production, keep `JWT_SECRET` private and strong.
