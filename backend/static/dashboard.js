async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
            "Accept": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    let data = {};
    try {
        data = await response.json();
    } catch (_) {
        data = {};
    }

    if (response.status === 401) {
        window.location.href = "/login";
        return null;
    }

    return {
        response,
        ...data
    };
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================
   OSINT WORKSPACE
========================= */

async function createOSINTCase(event) {
    event.preventDefault();

    const status = document.getElementById("osintCreateStatus");
    const button = event.target.querySelector("button[type='submit']");

    const caseNumber =
        document.getElementById("osintCaseNumber").value.trim();

    const title =
        document.getElementById("osintCaseTitle").value.trim();

    const description =
        document.getElementById("osintCaseDescription").value.trim();

    const classification =
        document.getElementById("osintClassification").value;

    if (!caseNumber || !title) {
        if (status) {
            status.textContent = "Case number and title are required.";
        }
        return;
    }

    try {
        if (status) {
            status.textContent = "Creating investigation...";
        }

        if (button) {
            button.disabled = true;
            button.textContent = "CREATING...";
        }

        const data = await apiFetch("/api/osint/cases", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                case_number: caseNumber,
                title: title,
                description: description,
                classification: classification
            })
        });

        if (!data) return;

        if (!data.success) {
            throw new Error(
                data.message || "Unable to create investigation."
            );
        }

        if (status) {
            status.textContent =
                `Investigation ${data.case_number} created successfully.`;
        }

        event.target.reset();

        const classificationField =
            document.getElementById("osintClassification");

        if (classificationField) {
            classificationField.value = "INTERNAL";
        }

        await loadOSINT();

        if (data.case_id) {
            await viewOSINTCase(Number(data.case_id));
        }

    } catch (error) {
        console.error("C34 CREATE OSINT CASE ERROR:", error);

        if (status) {
            status.textContent =
                error.message || "Unable to create investigation.";
        }

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "CREATE INVESTIGATION";
        }
    }
}

/* =========================
   OSINT
========================= */

const createOSINTForm =
    document.getElementById("createOSINTCaseForm");

if (createOSINTForm) {
    createOSINTForm.addEventListener(
        "submit",
        createOSINTCase
    );
}


async function loadOSINT() {
    try {
        const data = await apiFetch("/api/osint/cases");

        if (!data) return;

        if (!data.success) {
            throw new Error(
                data.message || "OSINT API failed."
            );
        }

        const cases = data.cases || [];

        const count = document.getElementById("osintCaseCount");
        if (count) {
            count.textContent = cases.length;
        }

        const table = document.getElementById("osintCaseTable");

        if (!table) return;

        if (!cases.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        No OSINT investigations registered.
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = cases.map(c => `
            <tr class="clickable-row"
                onclick="viewOSINTCase(${Number(c.id)})">

                <td>
                    <strong>${escapeHTML(c.case_number)}</strong>
                </td>

                <td>
                    ${escapeHTML(c.title)}
                </td>

                <td>
                    <span class="classification">
                        ${escapeHTML(c.classification)}
                    </span>
                </td>

                <td>
                    ${escapeHTML(c.status)}
                </td>

                <td>
                    ${escapeHTML(c.created_at)}
                </td>

                <td>
                    <button
                        class="button small"
                        onclick="event.stopPropagation(); viewOSINTCase(${Number(c.id)})">
                        Open
                    </button>
                </td>
            </tr>
        `).join("");

    } catch (error) {
        console.error("C34 OSINT ERROR:", error);
    }
}


async function viewOSINTCase(caseId) {
    try {
        const data =
            await apiFetch(`/api/osint/cases/${Number(caseId)}`);

        if (!data) return;

        if (!data.success) {
            throw new Error(
                data.message || "Unable to load OSINT case."
            );
        }

        const c = data.case;

        const panel =
            document.getElementById("osintCaseDetail");

        if (!panel) return;

        panel.style.display = "block";

        const targets = c.targets || [];
        const sources = c.sources || [];
        const findings = c.findings || [];
        const timeline = c.timeline || [];

        panel.innerHTML = `
            <div class="case-header">

                <div>
                    <div class="eyebrow">
                        INVESTIGATION
                    </div>

                    <h3>
                        ${escapeHTML(c.case_number)}
                    </h3>

                    <p class="case-description">
                        ${escapeHTML(c.title)}
                    </p>
                </div>

                <span class="classification">
                    ${escapeHTML(c.classification)}
                </span>

            </div>

            <div class="case-description">
                ${escapeHTML(c.description || "No description recorded.")}
            </div>

            <div class="intel-actions">
                <button
                    class="button primary"
                    onclick="viewOSINTReport(${Number(caseId)})">
                    VIEW REPORT
                </button>
            </div>

            <div class="intel-stats">

                <div class="intel-stat">
                    <span>TARGETS</span>
                    <strong>${targets.length}</strong>
                </div>

                <div class="intel-stat">
                    <span>SOURCES</span>
                    <strong>${sources.length}</strong>
                </div>

                <div class="intel-stat">
                    <span>FINDINGS</span>
                    <strong>${findings.length}</strong>
                </div>

                <div class="intel-stat">
                    <span>TIMELINE</span>
                    <strong>${timeline.length}</strong>
                </div>

            </div>

            <div class="case-grid">

                <section>
                    <div class="eyebrow">TARGETS</div>

                    ${
                        targets.length
                        ? targets.map(t => `
                            <div class="intel-record">
                                <strong>
                                    ${escapeHTML(t.target_type)}
                                </strong>
                                <span>
                                    ${escapeHTML(t.target_value)}
                                </span>
                                ${
                                    t.label
                                    ? `<small>${escapeHTML(t.label)}</small>`
                                    : ""
                                }
                            </div>
                        `).join("")
                        : `<div class="muted">No targets recorded.</div>`
                    }
                </section>

                <section>
                    <div class="eyebrow">SOURCES</div>

                    ${
                        sources.length
                        ? sources.map(src => `
                            <div class="intel-record">
                                <strong>
                                    ${escapeHTML(src.source_type)}
                                </strong>
                                <span>
                                    ${escapeHTML(src.source_name || "Unnamed source")}
                                </span>
                                ${
                                    src.source_url
                                    ? `<small>${escapeHTML(src.source_url)}</small>`
                                    : ""
                                }
                            </div>
                        `).join("")
                        : `<div class="muted">No sources recorded.</div>`
                    }
                </section>

            </div>

            <section>
                <div class="eyebrow">FINDINGS</div>

                ${
                    findings.length
                    ? findings.map(f => `
                        <div class="intel-record">
                            <strong>
                                ${escapeHTML(f.title)}
                            </strong>

                            <span>
                                ${escapeHTML(f.finding_type)}
                                · ${escapeHTML(f.confidence)}
                            </span>

                            <small>
                                ${escapeHTML(f.observed_data)}
                            </small>

                            ${
                                f.analyst_assessment
                                ? `<small>${escapeHTML(f.analyst_assessment)}</small>`
                                : ""
                            }
                        </div>
                    `).join("")
                    : `<div class="muted">No findings recorded.</div>`
                }
            </section>

            <section>
                <div class="eyebrow">TIMELINE</div>

                ${
                    timeline.length
                    ? timeline.map(event => `
                        <div class="intel-record">
                            <strong>
                                ${escapeHTML(event.event_title)}
                            </strong>

                            <span>
                                ${escapeHTML(event.event_type)}
                                · ${escapeHTML(event.event_time)}
                            </span>

                            <small>
                                ${escapeHTML(event.event_description || "")}
                            </small>
                        </div>
                    `).join("")
                    : `<div class="muted">No timeline events recorded.</div>`
                }
            </section>
        `;

    } catch (error) {
        console.error("C34 OSINT case error:", error);
        alert(error.message || "Unable to load investigation.");
    }
}

async function viewOSINTReport(caseId) {
    try {
        const data =
            await apiFetch(`/api/osint/cases/${Number(caseId)}/report`);

        if (!data) return;

        if (!data.success) {
            throw new Error(
                data.message || "Unable to generate case report."
            );
        }

        const report = data.report;
        const c = report.case;

        const reportWindow = window.open("", "_blank");

        if (!reportWindow) {
            throw new Error(
                "Popup blocked. Allow popups for the C34 dashboard."
            );
        }

        const targets = report.targets || [];
        const sources = report.sources || [];
        const findings = report.findings || [];
        const timeline = report.timeline || [];

        const generatedAt = new Date().toLocaleString();

        reportWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">

<title>
${escapeHTML(c.case_number)} — C34 Case Report
</title>

<style>
* {
    box-sizing: border-box;
}

body {
    margin: 0;
    padding: 0;
    background: #061426;
    color: #f2f7ff;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.55;
}

.toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    padding: 14px 24px;
    background: #081b32;
    border-bottom: 1px solid #28578c;
    display: flex;
    justify-content: flex-end;
}

.toolbar button {
    border: 1px solid #4da6ff;
    background: #0b3d91;
    color: white;
    padding: 10px 18px;
    border-radius: 7px;
    font-weight: bold;
    cursor: pointer;
}

.report {
    max-width: 1050px;
    margin: 0 auto;
    padding: 34px 22px 60px;
}

.header {
    padding: 28px;
    background: #0b2340;
    border: 1px solid #28578c;
    border-top: 4px solid #2f8cff;
    border-radius: 12px;
    margin-bottom: 24px;
}

.brand {
    font-size: 13px;
    letter-spacing: 2px;
    color: #4da6ff;
    font-weight: bold;
}

.header h1 {
    margin: 12px 0 5px;
    font-size: 30px;
}

.subtitle {
    color: #a9bfdc;
    font-size: 16px;
}

.meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 24px;
}

.meta-card {
    background: #102f55;
    border: 1px solid #28578c;
    padding: 14px;
    border-radius: 8px;
}

.label {
    color: #a9bfdc;
    font-size: 11px;
    letter-spacing: 1.4px;
    font-weight: bold;
}

.value {
    margin-top: 5px;
    font-weight: bold;
}

.classification {
    display: inline-block;
    color: #4da6ff;
    border: 1px solid #4da6ff;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: 12px;
}

.section {
    background: #0b2340;
    border: 1px solid #28578c;
    border-radius: 12px;
    padding: 22px;
    margin-bottom: 20px;
}

.section-title {
    color: #4da6ff;
    font-size: 12px;
    letter-spacing: 2px;
    font-weight: bold;
    margin-bottom: 15px;
}

.description {
    color: #d8e7f7;
}

.record {
    padding: 16px 0;
    border-bottom: 1px solid #28578c;
}

.record:last-child {
    border-bottom: none;
}

.record-title {
    font-size: 16px;
    font-weight: bold;
}

.record-type {
    color: #4da6ff;
    font-size: 12px;
    margin-top: 3px;
}

.record-value {
    margin-top: 7px;
    word-break: break-word;
}

.record-meta {
    color: #a9bfdc;
    font-size: 13px;
    margin-top: 6px;
}

.confidence {
    display: inline-block;
    margin-left: 8px;
    padding: 3px 8px;
    border: 1px solid #2f8cff;
    border-radius: 5px;
    font-size: 11px;
    color: #4da6ff;
}

.timeline-item {
    position: relative;
    padding: 15px 0 15px 22px;
    border-left: 2px solid #2f8cff;
    margin-left: 6px;
}

.timeline-item:last-child {
    border-left-color: #28578c;
}

.timeline-time {
    color: #4da6ff;
    font-size: 12px;
    font-weight: bold;
}

.notice {
    margin-top: 26px;
    padding: 18px;
    border: 1px solid #28578c;
    background: #081b32;
    border-radius: 10px;
    color: #a9bfdc;
    font-size: 13px;
}

.footer {
    text-align: center;
    color: #6f8dab;
    font-size: 12px;
    margin-top: 25px;
}

@media (max-width: 700px) {
    body {
        font-size: 14px;
    }

    .report {
        padding: 18px 12px 40px;
    }

    .meta-grid {
        grid-template-columns: 1fr;
    }

    .header h1 {
        font-size: 23px;
    }
}

@media print {
    body {
        background: white;
        color: black;
    }

    .toolbar {
        display: none;
    }

    .report {
        max-width: none;
        padding: 0;
    }

    .header,
    .section,
    .notice {
        background: white;
        color: black;
        border-color: #999;
        break-inside: avoid;
    }

    .brand,
    .section-title,
    .record-type,
    .timeline-time {
        color: #174f8a;
    }

    .subtitle,
    .description,
    .record-meta,
    .notice,
    .footer {
        color: #444;
    }
}
</style>
</head>

<body>

<div class="toolbar">
    <button onclick="window.print()">
        PRINT / SAVE PDF
    </button>
</div>

<main class="report">

    <header class="header">

        <div class="brand">
            CANNIBAL 34
            — SECURE INTELLIGENCE PLATFORM
        </div>

        <h1>
            ${escapeHTML(c.case_number)}
        </h1>

        <div class="subtitle">
            ${escapeHTML(c.title)}
        </div>

        <div class="meta-grid">

            <div class="meta-card">
                <div class="label">STATUS</div>
                <div class="value">
                    ${escapeHTML(c.status)}
                </div>
            </div>

            <div class="meta-card">
                <div class="label">CLASSIFICATION</div>
                <div class="value">
                    <span class="classification">
                        ${escapeHTML(c.classification)}
                    </span>
                </div>
            </div>

            <div class="meta-card">
                <div class="label">GENERATED</div>
                <div class="value">
                    ${escapeHTML(generatedAt)}
                </div>
            </div>

        </div>

    </header>

    <section class="section">

        <div class="section-title">
            CASE DESCRIPTION
        </div>

        <div class="description">
            ${escapeHTML(
                c.description || "No description recorded."
            )}
        </div>

    </section>

    <section class="section">

        <div class="section-title">
            TARGETS
        </div>

        ${
            targets.length
            ? targets.map(t => `
                <div class="record">

                    <div class="record-title">
                        ${escapeHTML(t.label || "Target")}
                    </div>

                    <div class="record-type">
                        ${escapeHTML(t.target_type)}
                    </div>

                    <div class="record-value">
                        ${escapeHTML(t.target_value)}
                    </div>

                    ${
                        t.notes
                        ? `<div class="record-meta">
                            ${escapeHTML(t.notes)}
                        </div>`
                        : ""
                    }

                </div>
            `).join("")
            : `<div class="record-meta">
                No targets recorded.
            </div>`
        }

    </section>

    <section class="section">

        <div class="section-title">
            SOURCES
        </div>

        ${
            sources.length
            ? sources.map(src => `
                <div class="record">

                    <div class="record-title">
                        ${escapeHTML(
                            src.source_name || "Unnamed source"
                        )}
                    </div>

                    <div class="record-type">
                        ${escapeHTML(src.source_type)}
                    </div>

                    ${
                        src.source_url
                        ? `<div class="record-value">
                            ${escapeHTML(src.source_url)}
                        </div>`
                        : ""
                    }

                    <div class="record-meta">
                        Collected:
                        ${escapeHTML(src.collected_at || "Unknown")}
                    </div>

                </div>
            `).join("")
            : `<div class="record-meta">
                No sources recorded.
            </div>`
        }

    </section>

    <section class="section">

        <div class="section-title">
            FINDINGS
        </div>

        ${
            findings.length
            ? findings.map(f => `
                <div class="record">

                    <div class="record-title">
                        ${escapeHTML(f.title)}

                        <span class="confidence">
                            ${escapeHTML(f.confidence)}
                        </span>
                    </div>

                    <div class="record-type">
                        ${escapeHTML(f.finding_type)}
                    </div>

                    <div class="record-value">
                        <strong>Observed data</strong><br>
                        ${escapeHTML(f.observed_data)}
                    </div>

                    <div class="record-meta">
                        <strong>Analyst assessment</strong><br>
                        ${escapeHTML(
                            f.analyst_assessment ||
                            "No assessment recorded."
                        )}
                    </div>

                    <div class="record-meta">
                        Status:
                        ${escapeHTML(f.status || "UNREVIEWED")}
                    </div>

                </div>
            `).join("")
            : `<div class="record-meta">
                No findings recorded.
            </div>`
        }

    </section>

    <section class="section">

        <div class="section-title">
            INVESTIGATION TIMELINE
        </div>

        ${
            timeline.length
            ? timeline.map(event => `
                <div class="timeline-item">

                    <div class="timeline-time">
                        ${escapeHTML(event.event_time)}
                    </div>

                    <div class="record-title">
                        ${escapeHTML(event.event_title)}
                    </div>

                    <div class="record-type">
                        ${escapeHTML(event.event_type)}
                    </div>

                    <div class="record-meta">
                        ${escapeHTML(
                            event.event_description || ""
                        )}
                    </div>

                </div>
            `).join("")
            : `<div class="record-meta">
                No timeline events recorded.
            </div>`
        }

    </section>

    <div class="notice">

        <strong>C34 AUTHORIZED-USE NOTICE</strong><br><br>

        This demonstration report is designed for authorized
        investigations and public-information intelligence workflows.
        Findings should be independently reviewed before operational use.

    </div>

    <div class="footer">
        ${escapeHTML(report.generated_by)}
        · Case ${escapeHTML(c.case_number)}
        · CANNIBAL 34
    </div>

</main>

</body>
</html>
        `);

        reportWindow.document.close();

    } catch (error) {
        console.error("C34 OSINT report error:", error);

        alert(
            error.message ||
            "Unable to generate case report."
        );
    }
}

async function loadIncidents() {
    try {
        const data = await apiFetch("/api/incidents");

        if (!data || !data.success) {
            throw new Error(
                data?.message || "Incident API failed."
            );
        }

        const incidents = data.incidents || [];

        const openCount =
            document.getElementById("openIncidentCount");

        if (openCount) {
            openCount.textContent =
                incidents.filter(
                    i => i.status === "OPEN"
                ).length;
        }

        const table =
            document.getElementById("incidentTable");

        if (!table) return;

        table.innerHTML = incidents.length
            ? incidents.map(i => `
                <tr>
                    <td>${escapeHTML(i.incident_number)}</td>
                    <td>${escapeHTML(i.title)}</td>
                    <td>${escapeHTML(i.status)}</td>
                    <td>${escapeHTML(i.created_at)}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="4" class="empty-state">
                        No incidents registered.
                    </td>
                </tr>
            `;

    } catch (error) {
        console.error("C34 INCIDENT ERROR:", error);
    }
}


/* =========================
   EVIDENCE
========================= */

async function loadEvidence() {
    try {
        const data = await apiFetch("/api/evidence");

        if (!data || !data.success) {
            throw new Error(
                data?.message || "Evidence API failed."
            );
        }

        const evidence = data.evidence || [];

        const count =
            document.getElementById("evidenceCount");

        if (count) {
            count.textContent = evidence.length;
        }

        const verified =
            evidence.filter(
                e =>
                    e.verification_status ===
                    "INTEGRITY_VERIFIED"
            ).length;

        const verifiedCount =
            document.getElementById(
                "verifiedEvidenceCount"
            );

        if (verifiedCount) {
            verifiedCount.textContent = verified;
        }

        const table =
            document.getElementById("evidenceTable");

        if (!table) return;

        table.innerHTML = evidence.length
            ? evidence.map(e => `
                <tr>
                    <td>
                        ${escapeHTML(e.evidence_number)}
                    </td>

                    <td>
                        ${escapeHTML(e.description || "")}
                    </td>

                    <td>
                        ${escapeHTML(
                            e.verification_status || "UNVERIFIED"
                        )}
                    </td>

                    <td>
                        <button
                            class="button small"
                            onclick="verifyEvidence(${Number(e.id)})">
                            Verify
                        </button>
                    </td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="4" class="empty-state">
                        No evidence records.
                    </td>
                </tr>
            `;

    } catch (error) {
        console.error("C34 EVIDENCE ERROR:", error);
    }
}


/* =========================
   AUDIT
========================= */

async function loadAudit() {
    try {
        const auditData =
            await apiFetch("/api/audit-logs");

        if (!auditData || !auditData.success) {
            throw new Error(
                auditData?.message ||
                "Audit API failed."
            );
        }

        const logs =
            auditData.audit_logs || [];

        const transfers =
            logs.filter(
                log =>
                    String(log.action || "")
                        .toUpperCase()
                        .includes("CUSTODY")
            ).length;

        const transferCount =
            document.getElementById(
                "custodyTransferCount"
            );

        if (transferCount) {
            transferCount.textContent = transfers;
        }

        const table =
            document.getElementById("auditTable");

        if (!table) return;

        table.innerHTML = logs.length
            ? logs.map(log => `
                <tr>
                    <td>${escapeHTML(log.action || "")}</td>
                    <td>${escapeHTML(log.officer_name || "")}</td>
                    <td>${escapeHTML(log.details || "")}</td>
                    <td>${escapeHTML(log.created_at || "")}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="4" class="empty-state">
                        No audit events.
                    </td>
                </tr>
            `;

    } catch (error) {
        console.error("C34 AUDIT ERROR:", error);
    }
}


/* =========================
   EVIDENCE VERIFICATION
========================= */

async function verifyEvidence(evidenceId) {
    const evidencePath = prompt(
        "Enter the evidence file path to verify:"
    );

    if (!evidencePath) {
        return;
    }

    try {
        const response = await fetch(
            `/api/evidence/${Number(evidenceId)}/verify`,
            {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    file_path: evidencePath
                })
            }
        );

        const data = await response.json();

        console.log(
            "C34 VERIFICATION RESPONSE:",
            data
        );

        if (!response.ok || !data.success) {
            alert(
                "Verification failed:\n" +
                (data.message || "Unknown error")
            );
            return;
        }

        if (
            data.evidence &&
            data.evidence.verification_status ===
                "INTEGRITY_VERIFIED"
        ) {
            alert(
                "✓ INTEGRITY VERIFIED\n\n" +
                data.evidence.evidence_number
            );
        } else {
            alert(
                "⚠ INTEGRITY COMPROMISED\n\n" +
                (
                    data.evidence?.evidence_number ||
                    "Evidence"
                )
            );
        }

        await loadDashboard();

    } catch (error) {
        console.error(
            "C34 VERIFY ERROR:",
            error
        );

        alert(
            "Unable to verify evidence."
        );
    }
}


/* =========================
   CUSTODY
========================= */

async function viewCustody(evidenceId) {
    try {
        const data =
            await apiFetch(
                `/api/evidence/${Number(evidenceId)}/custody`
            );

        if (!data || !data.success) {
            throw new Error(
                data?.message ||
                "Custody API failed."
            );
        }

        const transfers =
            data.transfers || [];

        if (!transfers.length) {
            alert(
                "No custody transfers recorded."
            );
            return;
        }

        const message =
            transfers.map(t => {
                return [
                    `Transfer #${t.id}`,
                    `From: ${t.from_officer_name || t.from_officer_id}`,
                    `To: ${t.to_officer_name || t.to_officer_id}`,
                    `Reason: ${t.reason || ""}`,
                    `Time: ${t.created_at || ""}`
                ].join("\n");
            }).join("\n\n");

        alert(
            "C34 CHAIN OF CUSTODY\n\n" +
            message
        );

    } catch (error) {
        console.error(
            "C34 CUSTODY ERROR:",
            error
        );

        alert(
            "Unable to load custody history."
        );
    }
}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {
    console.log(
        "C34 Intelligence & Evidence Console loading..."
    );

    await Promise.all([
        loadOSINT(),
        loadIncidents(),
        loadEvidence(),
        loadAudit()
    ]);

    const message =
        document.getElementById("systemMessage");

    if (message) {
        message.textContent =
            "C34 Intelligence & Evidence services synchronized.";
    }
}


loadDashboard();
