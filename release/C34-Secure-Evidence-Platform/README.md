# C34 Secure Evidence Platform

A security-focused Flask and SQLite prototype for managing digital evidence, incidents, officer authentication, custody transfers, and audit records.

## Project Purpose

The C34 Secure Evidence Platform demonstrates practical cybersecurity concepts in an evidence-management workflow.

The system focuses on:
- Officer authentication
- Role-based authorization
- Incident management
- Evidence records
- SHA-256 integrity verification
- Chain-of-custody records
- Audit logging
- Secure application-secret handling
- Git/GitHub repository security

## Technology Stack

- Python 3
- Flask
- SQLite
- HTML/CSS/JavaScript
- Werkzeug password hashing
- SHA-256
- Git/GitHub

## Security Controls

### Authentication

Officer accounts authenticate using a badge number and password.

Passwords are stored using Werkzeug password hashing rather than plaintext passwords.

### Role-Based Authorization

Officer registration is restricted to users with the ADMIN role.

The application returns 401 Unauthorized when authentication is required and 403 Forbidden when an authenticated user lacks permission.

### Evidence Integrity

Evidence records support SHA-256 hashes for integrity verification.

### Chain of Custody

Evidence transfers record the sending officer, receiving officer, evidence identifier, reason, and timestamp.

### Audit Logging

Security-relevant evidence actions are recorded in the audit-log database table.

### Secret Protection

The Flask application secret is loaded from the C34_SECRET_KEY environment variable or a local .c34_secret file. The local secret is excluded from Git.

### Repository Security

Sensitive historical development files were removed from Git history before the repository was pushed to GitHub.

## Project Structure

```text
c34-secure-evidence-platform/
├── backend/
│   ├── app.py
│   └── database.py
├── data/
│   └── evidence_files/
├── static/
├── templates/
├── .gitignore
├── LICENSE
└── README.md
```

## Running Locally

```bash
cd ~/c34-evidence-platform
python backend/app.py
```

The development server runs on port 5001.

Open http://127.0.0.1:5001/ in a browser.

## Security Testing

Officer-registration authorization was tested with 401 Unauthorized for unauthenticated requests, 403 Forbidden for an INVESTIGATOR registration attempt, and 201 Created for an authorized ADMIN registration attempt.

Python syntax validation was performed with:

```bash
python -m py_compile backend/app.py backend/database.py
```

Git validation was performed with:

```bash
git diff --check
```

## Evidence Storage

Controlled local evidence storage is located at data/evidence_files/. This directory is excluded from Git so local evidence files are not committed to the repository.

## Limitations

This is a cybersecurity prototype and should not be treated as a production forensic-evidence system.

Further production controls would include secure multipart file-upload handling, stronger evidence-access authorization, CSRF protection, production HTTPS, secure session-cookie configuration, automated security tests, input validation, rate limiting, secure deployment, backups, and formal forensic procedures.

## Author

**Mohau Mosoeunyane**

CANNIBAL 34 / C34 Secure Evidence Platform
# CANNIBAL 34 Secure Evidence Platform

A security-focused evidence management platform designed to help
organizations record incidents, manage evidence, track custody transfers,
and maintain audit records.

## Features

- Officer accounts
- Incident management
- Evidence registration
- Evidence verification
- Chain-of-custody transfers
- Audit logging
- Evidence status tracking
- Local SQLite database
- Flask web interface

## Intended Use

This project is intended for authorized security, investigative,
training, and evidence-management environments.

## Security

Do not use real sensitive evidence, personal information, passwords,
or production credentials in a test installation.

## Status

CANNIBAL 34 Development Release v1.0

## License

See LICENSE for licensing information.

## Contact

CANNIBAL 34

