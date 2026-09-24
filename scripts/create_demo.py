from pathlib import Path
import sqlite3
from werkzeug.security import generate_password_hash

BASE_DIR = Path(__file__).resolve().parent.parent
DEMO_DIR = BASE_DIR / "demo"
DEMO_DB = DEMO_DIR / "c34_demo.db"

DEMO_DIR.mkdir(exist_ok=True)

if DEMO_DB.exists():
    DEMO_DB.unlink()

conn = sqlite3.connect(DEMO_DB)

conn.executescript("""
CREATE TABLE officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    badge_number TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES officers(id)
);

CREATE TABLE evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_number TEXT UNIQUE NOT NULL,
    incident_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    file_name TEXT,
    sha256_hash TEXT,
    collected_by INTEGER,
    collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'SECURED',
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (collected_by) REFERENCES officers(id)
);

CREATE TABLE custody_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_id INTEGER NOT NULL,
    from_officer INTEGER,
    to_officer INTEGER NOT NULL,
    reason TEXT,
    transferred_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_id) REFERENCES evidence(id),
    FOREIGN KEY (from_officer) REFERENCES officers(id),
    FOREIGN KEY (to_officer) REFERENCES officers(id)
);

CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    officer_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (officer_id) REFERENCES officers(id)
);
""")

password_hash = generate_password_hash("C34Demo123!")

conn.execute("""
INSERT INTO officers
(full_name, badge_number, role, password_hash)
VALUES (?, ?, ?, ?)
""", (
    "C34 Demo Officer",
    "C34-DEMO",
    "ADMIN",
    password_hash
))

officer_id = conn.execute(
    "SELECT id FROM officers WHERE badge_number = ?",
    ("C34-DEMO",)
).fetchone()[0]

conn.execute("""
INSERT INTO incidents
(incident_number, title, description, status, created_by)
VALUES (?, ?, ?, ?, ?)
""", (
    "C34-DEMO-001",
    "Demo Evidence Incident",
    "Demonstration incident containing fictional test data.",
    "OPEN",
    officer_id
))

incident_id = conn.execute(
    "SELECT id FROM incidents WHERE incident_number = ?",
    ("C34-DEMO-001",)
).fetchone()[0]

conn.execute("""
INSERT INTO evidence
(evidence_number, incident_id, description, file_name,
 sha256_hash, collected_by, status)
VALUES (?, ?, ?, ?, ?, ?, ?)
""", (
    "C34-DEMO-EVD-001",
    incident_id,
    "Fictional demonstration evidence record.",
    "demo-file.txt",
    "DEMO-NOT-A-REAL-HASH",
    officer_id,
    "SECURED"
))

conn.execute("""
INSERT INTO audit_logs
(officer_id, action, entity_type, entity_id, details)
VALUES (?, ?, ?, ?, ?)
""", (
    officer_id,
    "DEMO_DATABASE_CREATED",
    "SYSTEM",
    None,
    "Fictional demonstration dataset."
))

conn.commit()
conn.close()

print(f"Demo database created: {DEMO_DB}")
print("Demo badge: C34-DEMO")
print("Demo password: C34Demo123!")
