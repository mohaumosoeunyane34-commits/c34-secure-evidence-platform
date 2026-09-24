from flask import Flask, request, jsonify, session, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from pathlib import Path
import sqlite3
import sys
import os
import uuid

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from database import init_database, get_connection

app = Flask(__name__)

# Development secret. Replace with a strong secret before deployment.
SECRET_FILE = BASE_DIR / ".c34_secret"
EVIDENCE_DIR = BASE_DIR / "data" / "evidence_files"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

if os.environ.get("C34_SECRET_KEY"):
    app.secret_key = os.environ["C34_SECRET_KEY"]
elif SECRET_FILE.exists():
    app.secret_key = SECRET_FILE.read_text().strip()
else:
    raise RuntimeError(
        "C34_SECRET_KEY is not set and .c34_secret is missing."
    )


@app.route("/")
def home():
    return jsonify({
        "success": True,
        "name": "C34 Secure Evidence Platform",
        "status": "ONLINE",
        "version": "1.0"
    })

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")
@app.route("/api/health")
def health():
    return jsonify({
        "success": True,
        "service": "C34 Evidence API",
        "database": "ONLINE"
    })
@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/api/officer/register", methods=["POST"])
def register_officer():
    officer_id, error = require_role("ADMIN")

    if error:
        return error

    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    badge_number = data.get("badge_number", "").strip()
    role = data.get("role", "").strip()
    password = data.get("password", "")

    if not full_name or not badge_number or not role or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must be at least 8 characters."
        }), 400

    password_hash = generate_password_hash(password)

    conn = get_connection()

    try:
        cursor = conn.execute(
            """
            INSERT INTO officers
            (full_name, badge_number, role, password_hash)
            VALUES (?, ?, ?, ?)
            """,
            (full_name, badge_number, role, password_hash)
        )

        officer_id = cursor.lastrowid

        conn.commit()

    except sqlite3.IntegrityError:
        conn.close()

        return jsonify({
            "success": False,
            "message": "Badge number already exists."
        }), 409

    conn.close()

    return jsonify({
        "success": True,
        "message": "Officer registered successfully.",
        "officer_id": officer_id
    }), 201


@app.route("/api/officer/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    badge_number = data.get("badge_number", "").strip()
    password = data.get("password", "")

    if not badge_number or not password:
        return jsonify({
            "success": False,
            "message": "Badge number and password are required."
        }), 400

    conn = get_connection()

    officer = conn.execute(
        """
        SELECT id, full_name, badge_number, role, password_hash
        FROM officers
        WHERE badge_number = ?
        """,
        (badge_number,)
    ).fetchone()

    conn.close()

    if officer is None:
        return jsonify({
            "success": False,
            "message": "Invalid credentials."
        }), 401

    if not check_password_hash(officer["password_hash"], password):
        return jsonify({
            "success": False,
            "message": "Invalid credentials."
        }), 401

    session.clear()
    session["officer_id"] = officer["id"]

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "officer": {
            "id": officer["id"],
            "full_name": officer["full_name"],
            "badge_number": officer["badge_number"],
            "role": officer["role"]
        }
    })


@app.route("/api/officer/me")
def current_officer():
    officer_id = session.get("officer_id")

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    officer = conn.execute(
        """
        SELECT id, full_name, badge_number, role
        FROM officers
        WHERE id = ?
        """,
        (officer_id,)
    ).fetchone()

    conn.close()

    if officer is None:
        session.clear()

        return jsonify({
            "success": False,
            "message": "Officer account not found."
        }), 401

    return jsonify({
        "success": True,
        "officer": dict(officer)
    })


@app.route("/api/officer/logout", methods=["POST"])
def logout():
    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })


def require_officer():
    officer_id = session.get("officer_id")

    if not officer_id:
        return None

    return officer_id


def require_role(*allowed_roles):
    officer_id = require_officer()

    if not officer_id:
        return None, (
            jsonify({
                "success": False,
                "message": "Authentication required."
            }),
            401
        )

    conn = get_connection()

    officer = conn.execute(
        "SELECT id, role FROM officers WHERE id = ?",
        (officer_id,)
    ).fetchone()

    conn.close()

    if officer is None:
        session.clear()
        return None, (
            jsonify({
                "success": False,
                "message": "Officer account not found."
            }),
            401
        )

    if officer["role"] not in allowed_roles:
        return None, (
            jsonify({
                "success": False,
                "message": "Insufficient permissions."
            }),
            403
        )

    return officer_id, None

@app.route("/api/incidents", methods=["POST"])
def create_incident():
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    description = data.get("description", "").strip()

    if not title:
        return jsonify({
            "success": False,
            "message": "Incident title is required."
        }), 400

    conn = get_connection()

    cursor = conn.execute(
        """
        INSERT INTO incidents
        (incident_number, title, description, status, created_by)
        VALUES (?, ?, ?, ?, ?)
        """,
        ("TEMP", title, description, "OPEN", officer_id)
    )

    incident_id = cursor.lastrowid
    incident_number = f"C34-INC-{incident_id:05d}"

    conn.execute(
        """
        UPDATE incidents
        SET incident_number = ?
        WHERE id = ?
        """,
        (incident_number, incident_id)
    )

    conn.execute(
        """
        INSERT INTO audit_logs
        (officer_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            officer_id,
            "INCIDENT_CREATED",
            "INCIDENT",
            incident_id,
            f"Created incident {incident_number}"
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Incident created successfully.",
        "incident": {
            "id": incident_id,
            "incident_number": incident_number,
            "title": title,
            "description": description,
            "status": "OPEN"
        }
    }), 201


@app.route("/api/incidents", methods=["GET"])
def list_incidents():
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    incidents = conn.execute(
        """
        SELECT
            id,
            incident_number,
            title,
            description,
            status,
            created_at,
            updated_at
        FROM incidents
        WHERE created_by = ?
        ORDER BY id DESC
        """,
        (officer_id,)
    ).fetchall()

    conn.close()

    return jsonify({
        "success": True,
        "incidents": [dict(row) for row in incidents]
    })


@app.route("/api/incidents/<int:incident_id>", methods=["GET"])
def get_incident(incident_id):
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    incident = conn.execute(
        """
        SELECT
            id,
            incident_number,
            title,
            description,
            status,
            created_at,
            updated_at
        FROM incidents
        WHERE id = ? AND created_by = ?
        """,
        (incident_id, officer_id)
    ).fetchone()

    conn.close()

    if incident is None:
        return jsonify({
            "success": False,
            "message": "Incident not found."
        }), 404

    return jsonify({
        "success": True,
        "incident": dict(incident)
    })

    session.clear()

    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    })


import hashlib


def calculate_sha256(file_path):
    sha256 = hashlib.sha256()

    with open(file_path, "rb") as file:
        while True:
            chunk = file.read(8192)

            if not chunk:
                break

            sha256.update(chunk)

    return sha256.hexdigest()


@app.route("/api/evidence", methods=["POST"])
def register_evidence():
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    data = request.get_json(silent=True) or {}

    incident_id = data.get("incident_id")
    description = data.get("description", "").strip()
    file_path = data.get("file_path", "").strip()

    if not incident_id or not description:
        return jsonify({
            "success": False,
            "message": "Incident ID and evidence description are required."
        }), 400

    conn = get_connection()

    incident = conn.execute(
        """
        SELECT id, incident_number
        FROM incidents
        WHERE id = ?
        """,
        (incident_id,)
    ).fetchone()

    if incident is None:
        conn.close()

        return jsonify({
            "success": False,
            "message": "Incident not found."
        }), 404

    evidence_number = None
    sha256_hash = None
    file_name = None

    if file_path:
        path = Path(file_path)

        if not path.exists() or not path.is_file():
            conn.close()

            return jsonify({
                "success": False,
                "message": "Evidence file was not found."
            }), 404

        sha256_hash = calculate_sha256(path)
        file_name = path.name

    cursor = conn.execute(
        """
        INSERT INTO evidence
        (
            evidence_number,
            incident_id,
            description,
            file_name,
            sha256_hash,
            collected_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            "TEMP",
            incident_id,
            description,
            file_name,
            sha256_hash,
            officer_id
        )
    )

    evidence_id = cursor.lastrowid
    evidence_number = f"C34-EVD-{evidence_id:05d}"

    conn.execute(
        """
        UPDATE evidence
        SET evidence_number = ?
        WHERE id = ?
        """,
        (evidence_number, evidence_id)
    )

    conn.execute(
        """
        INSERT INTO audit_logs
        (
            officer_id,
            action,
            entity_type,
            entity_id,
            details
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            officer_id,
            "EVIDENCE_REGISTERED",
            "EVIDENCE",
            evidence_id,
            f"Registered evidence {evidence_number}"
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Evidence registered successfully.",
        "evidence": {
            "id": evidence_id,
            "evidence_number": evidence_number,
            "incident_id": incident_id,
            "description": description,
            "file_name": file_name,
            "sha256_hash": sha256_hash,
            "status": "SECURED"
        }
    }), 201

@app.route("/api/evidence", methods=["GET"])
def list_evidence():
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    rows = conn.execute(
        """
        SELECT
            e.id,
            e.evidence_number,
            e.incident_id,
            i.incident_number,
            e.description,
            e.file_name,
            e.sha256_hash,
            e.status,
            e.collected_by
        FROM evidence e
        LEFT JOIN incidents i ON i.id = e.incident_id
        ORDER BY e.id DESC
        """
    ).fetchall()

    conn.close()

    evidence = [dict(row) for row in rows]

    return jsonify({
        "success": True,
        "evidence": evidence
    }), 200


@app.route("/api/evidence/<int:evidence_id>/verify", methods=["POST"])
def verify_evidence(evidence_id):
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    evidence = conn.execute(
        """
        SELECT
            id,
            evidence_number,
            incident_id,
            description,
            file_name,
            sha256_hash,
            status
        FROM evidence
        WHERE id = ?
        """,
        (evidence_id,)
    ).fetchone()

    if evidence is None:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Evidence not found."
        }), 404

    data = request.get_json(silent=True) or {}
    file_path = data.get("file_path", "").strip()

    if not file_path:
        conn.close()
        return jsonify({
            "success": False,
            "message": "File path is required."
        }), 400

    path = Path(file_path)

    if not path.exists() or not path.is_file():
        conn.close()
        return jsonify({
            "success": False,
            "message": "Evidence file was not found."
        }), 404

    current_hash = calculate_sha256(path)
    stored_hash = evidence["sha256_hash"]

    integrity_verified = current_hash == stored_hash

    verification_status = (
        "INTEGRITY_VERIFIED"
        if integrity_verified
        else "INTEGRITY_COMPROMISED"
    )

    conn.execute(
        """
        INSERT INTO audit_logs
        (
            officer_id,
            action,
            entity_type,
            entity_id,
            details
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            officer_id,
            verification_status,
            "EVIDENCE",
            evidence_id,
            f"Evidence {evidence['evidence_number']} integrity verification: {verification_status}"
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "evidence": {
            "id": evidence["id"],
            "evidence_number": evidence["evidence_number"],
            "stored_sha256": stored_hash,
            "current_sha256": current_hash,
            "integrity_verified": integrity_verified,
            "verification_status": verification_status
        }
    })
@app.route("/api/evidence/<int:evidence_id>/transfer", methods=["POST"])
def transfer_evidence(evidence_id):
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    data = request.get_json(silent=True) or {}

    to_officer = data.get("to_officer")
    reason = data.get("reason", "").strip()

    if not to_officer:
        return jsonify({
            "success": False,
            "message": "Receiving officer ID is required."
        }), 400

    conn = get_connection()

    evidence = conn.execute(
        """
        SELECT id, evidence_number, status
        FROM evidence
        WHERE id = ?
        """,
        (evidence_id,)
    ).fetchone()

    if evidence is None:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Evidence not found."
        }), 404

    recipient = conn.execute(
        """
        SELECT id, full_name, badge_number, role
        FROM officers
        WHERE id = ?
        """,
        (to_officer,)
    ).fetchone()

    if recipient is None:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Receiving officer not found."
        }), 404

    if int(to_officer) == int(officer_id):
        conn.close()
        return jsonify({
            "success": False,
            "message": "Evidence cannot be transferred to the same officer."
        }), 400

    conn.execute(
        """
        INSERT INTO custody_transfers
        (
            evidence_id,
            from_officer,
            to_officer,
            reason
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            evidence_id,
            officer_id,
            to_officer,
            reason
        )
    )

    transfer_id = conn.execute(
        "SELECT last_insert_rowid()"
    ).fetchone()[0]

    conn.execute(
        """
        INSERT INTO audit_logs
        (
            officer_id,
            action,
            entity_type,
            entity_id,
            details
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            officer_id,
            "EVIDENCE_TRANSFERRED",
            "EVIDENCE",
            evidence_id,
            f"Evidence {evidence['evidence_number']} transferred to officer {recipient['badge_number']}"
        )
    )

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "message": "Evidence transferred successfully.",
        "transfer": {
            "id": transfer_id,
            "evidence_id": evidence_id,
            "evidence_number": evidence["evidence_number"],
            "from_officer": officer_id,
            "to_officer": recipient["id"],
            "recipient_badge": recipient["badge_number"],
            "recipient_name": recipient["full_name"],
            "reason": reason
        }
    }), 201
@app.route("/api/evidence/<int:evidence_id>/custody", methods=["GET"])
def get_custody_history(evidence_id):
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    evidence = conn.execute(
        """
        SELECT id, evidence_number, description, status
        FROM evidence
        WHERE id = ?
        """,
        (evidence_id,)
    ).fetchone()

    if evidence is None:
        conn.close()
        return jsonify({
            "success": False,
            "message": "Evidence not found."
        }), 404

    transfers = conn.execute(
        """
        SELECT
            ct.id,
            ct.evidence_id,
            ct.from_officer,
            ct.to_officer,
            ct.reason,
            ct.transferred_at,
            sender.full_name AS from_name,
            sender.badge_number AS from_badge,
            recipient.full_name AS to_name,
            recipient.badge_number AS to_badge
        FROM custody_transfers ct
        LEFT JOIN officers sender
            ON sender.id = ct.from_officer
        JOIN officers recipient
            ON recipient.id = ct.to_officer
        WHERE ct.evidence_id = ?
        ORDER BY ct.id ASC
        """,
        (evidence_id,)
    ).fetchall()

    history = []

    for transfer in transfers:
        history.append({
            "id": transfer["id"],
            "evidence_id": transfer["evidence_id"],
            "from_officer": transfer["from_officer"],
            "from_name": transfer["from_name"],
            "from_badge": transfer["from_badge"],
            "to_officer": transfer["to_officer"],
            "to_name": transfer["to_name"],
            "to_badge": transfer["to_badge"],
            "reason": transfer["reason"],
            "transferred_at": transfer["transferred_at"]
        })

    conn.close()

    return jsonify({
        "success": True,
        "evidence": {
            "id": evidence["id"],
            "evidence_number": evidence["evidence_number"],
            "description": evidence["description"],
            "status": evidence["status"]
        },
        "custody_history": history,
        "transfer_count": len(history)
    })
@app.route("/api/audit-logs", methods=["GET"])
def get_audit_logs():
    officer_id = require_officer()

    if not officer_id:
        return jsonify({
            "success": False,
            "message": "Authentication required."
        }), 401

    conn = get_connection()

    logs = conn.execute(
        """
        SELECT
            al.id,
            al.officer_id,
            o.full_name,
            o.badge_number,
            al.action,
            al.entity_type,
            al.entity_id,
            al.details,
            al.created_at
        FROM audit_logs al
        LEFT JOIN officers o
            ON o.id = al.officer_id
        ORDER BY al.id ASC
        """
    ).fetchall()

    audit_history = []

    for log in logs:
        audit_history.append({
            "id": log["id"],
            "officer_id": log["officer_id"],
            "officer_name": log["full_name"],
            "officer_badge": log["badge_number"],
            "action": log["action"],
            "entity_type": log["entity_type"],
            "entity_id": log["entity_id"],
            "details": log["details"],
            "created_at": log["created_at"]
        })

    conn.close()

    return jsonify({
        "success": True,
        "audit_logs": audit_history,
        "log_count": len(audit_history)
    })

if __name__ == "__main__":
    init_database()

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=False
    )
