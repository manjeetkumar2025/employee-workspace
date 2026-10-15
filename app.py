"""Employee Workspace - independent Flask and SQLite application."""
import os, re, sqlite3, secrets, time
from datetime import datetime, timezone, timedelta
from functools import wraps
from zoneinfo import ZoneInfo
from flask import Flask, g, request, session, redirect, render_template, jsonify, abort

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, "workspace.db")
KEYFILE = os.path.join(BASE, ".secret_key")
from werkzeug.security import generate_password_hash, check_password_hash

def secret():
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    if not os.path.exists(KEYFILE):
        with open(KEYFILE, "w") as f:
            f.write(secrets.token_hex(32))
    with open(KEYFILE) as f:
        return f.read().strip()

app = Flask(__name__)
app.config.update(SECRET_KEY=secret(), SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                  SESSION_COOKIE_SECURE=os.environ.get("PRODUCTION") == "1",
                  MAX_CONTENT_LENGTH=64 * 1024, PERMANENT_SESSION_LIFETIME=60 * 60 * 12)

META = "user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, demo INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT"
SCHEMA = f"""
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata', theme TEXT NOT NULL DEFAULT 'dark', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT DEFAULT 'Pending',
  priority TEXT DEFAULT 'Medium', department TEXT DEFAULT '', category TEXT DEFAULT '', due TEXT DEFAULT '', area TEXT DEFAULT 'ops', {META});
CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', status TEXT DEFAULT 'Active',
  progress INTEGER DEFAULT 0, techs TEXT DEFAULT '', repo_url TEXT DEFAULT '', deadline TEXT DEFAULT '', {META});
CREATE TABLE IF NOT EXISTS bugs(id INTEGER PRIMARY KEY, title TEXT NOT NULL, severity TEXT DEFAULT 'Medium', status TEXT DEFAULT 'Open',
  project TEXT DEFAULT '', {META});
CREATE TABLE IF NOT EXISTS meetings(id INTEGER PRIMARY KEY, title TEXT NOT NULL, start TEXT NOT NULL, agenda TEXT DEFAULT '',
  participants TEXT DEFAULT '', link TEXT DEFAULT '', status TEXT DEFAULT 'Scheduled', {META});
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT, check_in TEXT, check_out TEXT, duration INTEGER, lat REAL, lon REAL);
CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT, at TEXT);
CREATE INDEX IF NOT EXISTS i_t ON tasks(user_id); CREATE INDEX IF NOT EXISTS i_p ON projects(user_id);
CREATE INDEX IF NOT EXISTS i_b ON bugs(user_id); CREATE INDEX IF NOT EXISTS i_m ON meetings(user_id);
CREATE INDEX IF NOT EXISTS i_a ON attendance(user_id); CREATE INDEX IF NOT EXISTS i_l ON activity(user_id);
"""

def db():
    if "db" not in g:
        g.db = sqlite3.connect(DB)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

@app.teardown_appcontext
def close_db(_):
    d = g.pop("db", None)
    if d:
        d.close()

def init_db():
    c = sqlite3.connect(DB)
    c.executescript(SCHEMA)
    c.commit()
    c.close()

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

TZS = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "Australia/Sydney"]
THEMES = ["dark", "light"]
ST = ("Pending", "In Progress", "Completed")
LV = ("Low", "Medium", "High")
SPEC = {
    "tasks": {"title": ("s", 1, 120), "description": ("s", 0, 500), "status": ("e", ST), "priority": ("e", ("Medium", "Low", "High")),
              "department": ("s", 0, 60), "category": ("s", 0, 60), "due": ("d",), "area": ("e", ("ops", "dev"))},
    "projects": {"name": ("s", 1, 100), "description": ("s", 0, 500), "status": ("e", ("Active", "Completed", "On Hold")),
                 "progress": ("i", 0, 100), "techs": ("s", 0, 120), "repo_url": ("u",), "deadline": ("d",)},
    "bugs": {"title": ("s", 1, 120), "severity": ("e", ("Medium", "Low", "High")), "status": ("e", ("Open", "In Progress", "Resolved")),
             "project": ("s", 0, 100)},
    "meetings": {"title": ("s", 1, 120), "start": ("dt",), "agenda": ("s", 0, 500), "participants": ("s", 0, 200),
                 "link": ("u",), "status": ("e", ("Scheduled", "Cancelled"))},
}

def clean(res, data, partial=False):
    out = {}
    for col, (k, *a) in SPEC[res].items():
        if col not in data and partial:
            continue
        v = data.get(col)
        label = col.replace("_", " ").capitalize()
        if k == "s":
            v = str(v if v is not None else "").strip()
            if len(v) < a[0]:
                raise ValueError(f"{label} is required.")
            if len(v) > a[1]:
                raise ValueError(f"{label} is too long (max {a[1]} characters).")
        elif k == "e":
            if v is None and not partial:
                v = a[0][0]
            if v not in a[0]:
                raise ValueError(f"{label} must be one of: {', '.join(a[0])}.")
        elif k == "i":
            try:
                v = int(v or 0)
            except (TypeError, ValueError):
                raise ValueError(f"{label} must be a number.")
            if not a[0] <= v <= a[1]:
                raise ValueError(f"{label} must be between {a[0]} and {a[1]}.")
        elif k in ("d", "dt"):
            v = str(v or "").strip()
            if v or k == "dt":
                try:
                    datetime.strptime(v, "%Y-%m-%d" if k == "d" else "%Y-%m-%dT%H:%M")
                except ValueError:
                    raise ValueError(f"{label} is not a valid {'date' if k == 'd' else 'date and time'}.")
        elif k == "u":
            v = str(v or "").strip()
            if v and (len(v) > 300 or not re.match(r"^https?://[^\s<>\"']+$", v, re.I)):
                raise ValueError(f"{label} must be a valid http(s) URL.")
        out[col] = v
    return out

def log(text):
    db().execute("INSERT INTO activity(user_id,text,at) VALUES(?,?,?)", (session["uid"], text[:200], now()))

# ---------- security ----------
@app.context_processor
def ctx():
    return {"csrf": session.setdefault("csrf", secrets.token_hex(16))}

@app.before_request
def csrf_guard():
    if request.method in ("POST", "PUT", "DELETE"):
        tok = request.headers.get("X-CSRF-Token") or request.form.get("csrf", "")
        if not session.get("csrf") or not secrets.compare_digest(tok, session["csrf"]):
            if request.path.startswith("/api/"):
                return jsonify(error="Session expired. Please refresh the page."), 403
            return redirect("/login")

@app.after_request
def headers(r):
    r.headers["Content-Security-Policy"] = ("default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
                                            "script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["X-Frame-Options"] = "DENY"
    r.headers["Referrer-Policy"] = "same-origin"
    if request.path.startswith("/api/") or request.path in ("/login", "/signup"):
        r.headers["Cache-Control"] = "no-store"
    return r

@app.errorhandler(ValueError)
def bad(e):
    return jsonify(error=str(e)), 400

@app.errorhandler(404)
def nf(e):
    return (jsonify(error="Not found."), 404) if request.path.startswith("/api/") else (render_template("auth.html", mode="login", error="Page not found."), 404)

@app.errorhandler(Exception)
def boom(e):
    if hasattr(e, "code") and isinstance(e.code, int):
        return jsonify(error=getattr(e, "description", "Error")), e.code
    app.logger.exception(e)
    return jsonify(error="Something went wrong. Please try again."), 500

def api_login(f):
    @wraps(f)
    def w(*a, **k):
        if "uid" not in session:
            return jsonify(error="Please sign in."), 401
        return f(*a, **k)
    return w

def me():
    return db().execute("SELECT id,name,email,timezone,theme FROM users WHERE id=?", (session.get("uid"),)).fetchone()

# ---------- auth ----------
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
FAILS = {}

def locked(key):
    FAILS[key] = [t for t in FAILS.get(key, []) if time.time() - t < 300]
    return len(FAILS[key]) >= 5

@app.route("/")
def index():
    return redirect("/app" if "uid" in session else "/login")

@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("auth.html", mode="signup")
    f = request.form
    name, email, pw = f.get("name", "").strip(), f.get("email", "").strip().lower(), f.get("password", "")
    err = None
    if not 2 <= len(name) <= 60: err = "Please enter your name (2-60 characters)."
    elif not EMAIL.match(email) or len(email) > 120: err = "Please enter a valid email address."
    elif len(pw) < 8 or not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw): err = "Password needs at least 8 characters, including a letter and a number."
    elif pw != f.get("confirm", ""): err = "Passwords do not match."
    elif db().execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(): err = "An account with this email already exists. Try signing in."
    if err:
        return render_template("auth.html", mode="signup", error=err, name=name, email=email), 400
    cur = db().execute("INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?)", (name, email, generate_password_hash(pw), now()))
    uid = cur.lastrowid
    session.clear(); session["uid"] = uid; session.permanent = True
    if f.get("demo"):
        seed(uid)
    log("Created workspace")
    db().commit()
    return redirect("/app")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("auth.html", mode="login")
    email, pw = request.form.get("email", "").strip().lower(), request.form.get("password", "")
    key = (request.remote_addr, email)
    if locked(key):
        return render_template("auth.html", mode="login", error="Too many attempts. Please wait 5 minutes and try again.", email=email), 429
    u = db().execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not u or not check_password_hash(u["password_hash"], pw):
        FAILS.setdefault(key, []).append(time.time())
        return render_template("auth.html", mode="login", error="Incorrect email or password.", email=email), 401
    session.clear(); session["uid"] = u["id"]; session.permanent = True
    return redirect("/app")

@app.post("/logout")
def logout():
    session.clear()
    return redirect("/login")

@app.route("/app")
def dashboard():
    u = me()
    if not u:
        session.clear()
        return redirect("/login")
    return render_template("app.html", me=dict(u), tzs=TZS)

# ---------- generic CRUD ----------
@app.get("/api/<res>")
@api_login
def list_(res):
    if res not in SPEC: abort(404)
    rows = db().execute(f"SELECT * FROM {res} WHERE user_id=? ORDER BY id DESC", (session["uid"],)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/<res>")
@api_login
def create(res):
    if res not in SPEC: abort(404)
    d = clean(res, request.get_json(silent=True) or {})
    cols = list(d)
    cur = db().execute(f"INSERT INTO {res}(user_id,created_at,updated_at,{','.join(cols)}) VALUES(?,?,?,{','.join('?' * len(cols))})",
                       (session["uid"], now(), now(), *d.values()))
    log(f"Created {res[:-1]}: {d.get('title') or d.get('name')}")
    db().commit()
    return jsonify(id=cur.lastrowid), 201

@app.put("/api/<res>/<int:rid>")
@api_login
def update(res, rid):
    if res not in SPEC: abort(404)
    row = db().execute(f"SELECT * FROM {res} WHERE id=? AND user_id=?", (rid, session["uid"])).fetchone()
    if not row: abort(404)
    d = clean(res, request.get_json(silent=True) or {}, partial=True)
    if d:
        db().execute(f"UPDATE {res} SET {','.join(c + '=?' for c in d)},updated_at=? WHERE id=? AND user_id=?",
                     (*d.values(), now(), rid, session["uid"]))
        log(f"Updated {res[:-1]}: {d.get('title') or d.get('name') or row[1]}" + (f" -> {d['status']}" if "status" in d else ""))
        db().commit()
    return jsonify(ok=True)

@app.delete("/api/<res>/<int:rid>")
@api_login
def remove(res, rid):
    if res not in SPEC: abort(404)
    cur = db().execute(f"DELETE FROM {res} WHERE id=? AND user_id=?", (rid, session["uid"]))
    if not cur.rowcount: abort(404)
    log(f"Deleted {res[:-1]} #{rid}")
    db().commit()
    return jsonify(ok=True)

@app.get("/api/activity")
@api_login
def activity():
    rows = db().execute("SELECT text,at FROM activity WHERE user_id=? ORDER BY id DESC LIMIT 40", (session["uid"],)).fetchall()
    return jsonify([dict(r) for r in rows])

# ---------- attendance ----------
def user_tz():
    return ZoneInfo(me()["timezone"])

@app.get("/api/attendance")
@api_login
def att_list():
    rows = [dict(r) for r in db().execute("SELECT * FROM attendance WHERE user_id=? ORDER BY id DESC LIMIT 200", (session["uid"],))]
    return jsonify(rows=rows, open=next((r for r in rows if not r["check_out"]), None))

@app.post("/api/attendance/checkin")
@api_login
def check_in():
    if db().execute("SELECT 1 FROM attendance WHERE user_id=? AND check_out IS NULL", (session["uid"],)).fetchone():
        return jsonify(error="You are already checked in."), 409
    d = request.get_json(silent=True) or {}
    lat = lon = None
    try:
        if d.get("lat") is not None:
            lat, lon = float(d["lat"]), float(d["lon"])
            if not (-90 <= lat <= 90 and -180 <= lon <= 180): raise ValueError
    except (TypeError, ValueError):
        return jsonify(error="Invalid location data."), 400
    day = datetime.now(user_tz()).strftime("%Y-%m-%d")
    db().execute("INSERT INTO attendance(user_id,day,check_in,lat,lon) VALUES(?,?,?,?,?)", (session["uid"], day, now(), lat, lon))
    log("Checked in")
    db().commit()
    return jsonify(ok=True), 201

@app.post("/api/attendance/checkout")
@api_login
def check_out():
    r = db().execute("SELECT * FROM attendance WHERE user_id=? AND check_out IS NULL", (session["uid"],)).fetchone()
    if not r:
        return jsonify(error="You are not checked in."), 409
    t = now()
    secs = int((datetime.fromisoformat(t) - datetime.fromisoformat(r["check_in"])).total_seconds())
    db().execute("UPDATE attendance SET check_out=?,duration=? WHERE id=?", (t, secs, r["id"]))
    log("Checked out")
    db().commit()
    return jsonify(ok=True)

# ---------- profile ----------
@app.put("/api/profile")
@api_login
def profile():
    d = request.get_json(silent=True) or {}
    name, email = str(d.get("name", "")).strip(), str(d.get("email", "")).strip().lower()
    if not 2 <= len(name) <= 60: raise ValueError("Display name must be 2-60 characters.")
    if not EMAIL.match(email) or len(email) > 120: raise ValueError("Please enter a valid email address.")
    if d.get("timezone") not in TZS: raise ValueError("Unsupported timezone.")
    if d.get("theme") not in THEMES: raise ValueError("Invalid theme.")
    if db().execute("SELECT 1 FROM users WHERE email=? AND id<>?", (email, session["uid"])).fetchone():
        raise ValueError("That email is used by another account.")
    db().execute("UPDATE users SET name=?,email=?,timezone=?,theme=? WHERE id=?", (name, email, d["timezone"], d["theme"], session["uid"]))
    log("Updated profile settings")
    db().commit()
    return jsonify(ok=True)

@app.post("/api/password")
@api_login
def password():
    d = request.get_json(silent=True) or {}
    u = db().execute("SELECT password_hash FROM users WHERE id=?", (session["uid"],)).fetchone()
    new = str(d.get("new", ""))
    if not check_password_hash(u["password_hash"], str(d.get("current", ""))): raise ValueError("Current password is incorrect.")
    if len(new) < 8 or not re.search(r"[A-Za-z]", new) or not re.search(r"\d", new):
        raise ValueError("New password needs at least 8 characters, including a letter and a number.")
    db().execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(new), session["uid"]))
    log("Changed password")
    db().commit()
    return jsonify(ok=True)

# ---------- starter work schedule ----------
def seed(uid):
    c = db(); n = now()
    today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
    D = lambda k: (today + timedelta(days=k)).isoformat()
    def ins(t, **v):
        v.update(user_id=uid, demo=1, created_at=n, updated_at=n)
        c.execute(f"INSERT INTO {t}({','.join(v)}) VALUES({','.join('?' * len(v))})", list(v.values()))
    for t, s, p, dep, cat, due, a in [
        ("Prepare weekly status summary", "In Progress", "High", "Operations", "Reporting", D(1), "ops"),
        ("Reconcile vendor invoices", "Pending", "Medium", "Finance", "Review", D(3), "ops"),
        ("Update onboarding checklist", "Completed", "Low", "HR", "Planning", D(-1), "ops"),
        ("Review support ticket backlog", "Pending", "High", "Support", "Maintenance", D(-2), "ops"),
        ("Plan warehouse audit schedule", "Pending", "Low", "Logistics", "Planning", D(7), "ops"),
        ("Build responsive navbar", "Completed", "Medium", "Web Development", "General", D(-3), "dev"),
        ("Add form validation to sign-up page", "In Progress", "High", "Web Development", "General", D(2), "dev"),
        ("Write API integration tests", "Pending", "Medium", "Web Development", "General", D(5), "dev")]:
        ins("tasks", title=t, description="Work item. Update the status and notes as progress is made.", status=s, priority=p, department=dep, category=cat, due=due, area=a)
    for nme, st, pg, tech, dl in [("Customer Portal UI Refresh", "Active", 72, "HTML,CSS,JavaScript", D(10)),
                                  ("Operations Workflow Dashboard", "Active", 45, "HTML,CSS,JavaScript,React", D(21)),
                                  ("Inventory Service API", "Active", 30, "JavaScript,Node.js", D(30)),
                                  ("Corporate Landing Page", "Completed", 100, "HTML,CSS", D(-12))]:
        ins("projects", name=nme, description="Project workspace record. Update details to reflect current progress.", status=st, progress=pg, techs=tech,
            repo_url="", deadline=dl)
    for t, sv, st, pr in [("Menu overlaps content on small screens", "Medium", "Open", "Customer Portal UI Refresh"),
                          ("Form submits twice on slow networks", "High", "In Progress", "Operations Workflow Dashboard"),
                          ("Typo in footer text", "Low", "Resolved", "Corporate Landing Page")]:
        ins("bugs", title=t, severity=sv, status=st, project=pr)
    for t, dk, tm, ag, pp in [("Daily Team Stand-up", 1, "10:00", "Review yesterday’s progress, today’s priorities, and blockers", "Operations and Development Team"),
                              ("Sprint Planning and Backlog Prioritisation", 2, "15:30", "Estimate upcoming stories, confirm owners, and agree sprint scope", "Product Owner, Scrum Master, Development Team"),
                              ("Weekly Delivery Review", 3, "11:00", "Review deliverables, risks, dependencies, and next actions", "Project Lead and Workstream Owners")]:
        ins("meetings", title=t, start=f"{D(dk)}T{tm}", agenda=ag, participants=pp, link="")

@app.post("/api/seed")
@api_login
def seed_route():
    if db().execute("SELECT 1 FROM tasks WHERE user_id=? AND demo=1", (session["uid"],)).fetchone():
        raise ValueError("The starter work schedule is already loaded.")
    seed(session["uid"]); log("Loaded starter work schedule"); db().commit()
    return jsonify(ok=True)

@app.delete("/api/seed")
@api_login
def unseed():
    for t in SPEC:
        db().execute(f"DELETE FROM {t} WHERE user_id=? AND demo=1", (session["uid"],))
    log("Removed starter work schedule"); db().commit()
    return jsonify(ok=True)

init_db()
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
