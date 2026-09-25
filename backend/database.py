import sqlite3
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.environ.get("C34_DB_PATH", DATA_DIR / "c34_evidence.db"))


def get_connection():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    conn = get_connection()

    conn.executescript("""
    CREATE TABLE IF NOT EXISTS officers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        badge_number TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS incidents (
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

    CREATE TABLE IF NOT EXISTS evidence (
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

    CREATE TABLE IF NOT EXISTS custody_transfers (
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

    CREATE TABLE IF NOT EXISTS audit_logs (
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


    conn.executescript("""
    CREATE TABLE IF NOT EXISTS osint_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_number TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'OPEN',
        classification TEXT NOT NULL DEFAULT 'INTERNAL',
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES officers(id)
    );

    CREATE TABLE IF NOT EXISTS osint_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        target_type TEXT NOT NULL,
        target_value TEXT NOT NULL,
        label TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES osint_cases(id)
    );

    CREATE TABLE IF NOT EXISTS osint_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        source_type TEXT NOT NULL,
        source_name TEXT,
        source_url TEXT,
        collected_at TEXT DEFAULT CURRENT_TIMESTAMP,
        collector_id INTEGER NOT NULL,
        notes TEXT,
        FOREIGN KEY (case_id) REFERENCES osint_cases(id),
        FOREIGN KEY (collector_id) REFERENCES officers(id)
    );

    CREATE TABLE IF NOT EXISTS osint_findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        target_id INTEGER,
        source_id INTEGER,
        finding_type TEXT NOT NULL,
        title TEXT NOT NULL,
        observed_data TEXT NOT NULL,
        analyst_assessment TEXT,
        confidence TEXT NOT NULL DEFAULT 'UNASSESSED',
        status TEXT NOT NULL DEFAULT 'UNREVIEWED',
        created_by INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES osint_cases(id),
        FOREIGN KEY (target_id) REFERENCES osint_targets(id),
        FOREIGN KEY (source_id) REFERENCES osint_sources(id),
        FOREIGN KEY (created_by) REFERENCES officers(id)
    );

    CREATE TABLE IF NOT EXISTS osint_timeline (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        event_title TEXT NOT NULL,
        event_description TEXT,
        event_time TEXT DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER NOT NULL,
        FOREIGN KEY (case_id) REFERENCES osint_cases(id),
        FOREIGN KEY (created_by) REFERENCES officers(id)
    );
    """)

    conn.commit()
    conn.close()

    print("C34 SECURE EVIDENCE DATABASE READY")
    print(f"Database: {DB_PATH}")


if __name__ == "__main__":
    init_database()
