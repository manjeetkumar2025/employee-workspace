# Employee Workspace

A corporate-style productivity workspace built with Flask + SQLite: Operations dashboard, Web Developer dashboard, live IST clock, attendance, meeting scheduler, profile/settings.
This is an independent workspace application, not an official Tech Mahindra product or employee system. Attendance and records are local application data, not verified employment records.

## Structure
```
demo-workspace/
  app.py              Flask backend, DB schema, auth, API
  requirements.txt
  templates/          auth.html (login/signup), app.html (workspace shell)
  static/             style.css, app.js, logo.svg
  workspace.db        created automatically on first run
```

## Windows setup
1. Install Python 3.10+ from python.org (tick "Add python.exe to PATH").
2. Open PowerShell in the project folder, then run:
```
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
3. Open **http://127.0.0.1:5000** in your browser.

## Create an account
Open `/signup`, enter name, email and a password (8+ characters with a letter and a number). Keep "Set up workspace with example work items" ticked for sample records. You are signed in automatically; use Log out in the sidebar, and sign in again from `/login`.

## Features
Operations (tasks, filters, search, sort, daily report, CSV export), Web Developer (projects, bugs, coding tasks, deadlines, timeline), Attendance (server-recorded check in/out, optional location), Meetings (IST, countdown, edit/delete), Settings (name, email, timezone, theme, password, starter schedule on/off).

## Troubleshooting
- `python` not found: reinstall Python with PATH ticked, or use `py app.py`.
- `venv\Scripts\activate` blocked: run `Set-ExecutionPolicy -Scope Process Bypass` first.
- Port 5000 in use: change `port=5000` at the bottom of `app.py`.
- Timezone error: run `pip install tzdata`.
- Location denied: allow location in the browser site settings, or check in without it.
- Reset everything: stop the server, delete `workspace.db`, restart.

## Security notes
Password hashing (Werkzeug), CSRF tokens, HttpOnly/SameSite cookies, parameterised SQL, per-user authorization on every query, input validation, escaped output, CSP and security headers, login throttling.

## Deploying later
1. Use HTTPS and set env vars: `SECRET_KEY=<long random>` and `PRODUCTION=1`.
2. Run a production server, not `app.py`: Windows `waitress-serve --port=8000 app:app`; Linux `gunicorn -w 3 app:app`, behind Nginx/Caddy.
3. Keep `workspace.db` on a persistent, backed-up disk (or move to PostgreSQL for multi-server use).
4. Login throttling is in-memory; use Redis or a proxy rate limiter if you run multiple workers.
