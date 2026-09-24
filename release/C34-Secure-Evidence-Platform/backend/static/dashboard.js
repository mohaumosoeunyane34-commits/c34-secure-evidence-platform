async function apiFetch(url, options = {}) {
    options.credentials = "same-origin";

    options.headers = {
        ...(options.headers || {}),
        "Accept": "application/json"
    };

    return fetch(url, options);
}

async function loadDashboard() {
    try {
        const incidentsResponse = await apiFetch("/api/incidents");
        const incidentsData = await incidentsResponse.json();

        if (!incidentsData.success) {
            document.getElementById("message").textContent =
                incidentsData.message || "Authentication required.";
            return;
        }

        const incidents = incidentsData.incidents || [];

        document.getElementById("incidentCount").textContent =
            incidents.length;

        const incidentTable =
            document.getElementById("incidentTable");

        incidentTable.innerHTML = incidents.map(incident => `
            <tr>
                <td>${incident.incident_number}</td>
                <td>${incident.title}</td>
                <td>
                    <span class="badge">${incident.status}</span>
                </td>
                <td>${incident.created_at}</td>
            </tr>
        `).join("");

        const evidenceResponse =
            await apiFetch("/api/evidence");

        const evidenceData =
            await evidenceResponse.json();

        if (!evidenceData.success) {
            throw new Error(
                evidenceData.message || "Evidence API failed."
            );
        }

        const evidence =
            evidenceData.evidence || [];

        document.getElementById("evidenceCount").textContent =
            evidence.length;

        const evidenceTable =
            document.getElementById("evidenceTable");

        evidenceTable.innerHTML = evidence.map(item => `
            <tr>
                <td>${item.evidence_number}</td>
                <td>${item.incident_number || item.incident_id}</td>
                <td>${item.description}</td>
                <td>${item.file_name || "—"}</td>
                <td>
                    <span class="badge">
                        ${item.status}
                    </span>
                </td>
                <td>
                    <span class="muted">
                        ${(item.sha256_hash || "—").substring(0, 16)}...
                    </span>
                </td>
                <td>
                    <button onclick="verifyEvidence(${item.id})">
                        VERIFY INTEGRITY
                    </button>
                </td>
            </tr>
        `).join("");

        const auditResponse =
            await apiFetch("/api/audit-logs");

        const auditData =
            await auditResponse.json();

        if (!auditData.success) {
            throw new Error(
                auditData.message || "Audit API failed."
            );
        }

        const logs =
            auditData.audit_logs || [];

        const verified = logs.filter(
            log => log.action === "INTEGRITY_VERIFIED"
        );

        const transfers = logs.filter(
            log => log.action === "EVIDENCE_TRANSFERRED"
        );

        document.getElementById("verifiedCount").textContent =
            verified.length;

        document.getElementById("transferCount").textContent =
            transfers.length;

        const auditTable =
            document.getElementById("auditTable");

        auditTable.innerHTML =
            logs.slice().reverse().map(log => `
                <tr>
                    <td>${log.action}</td>
                    <td>${log.officer_badge}</td>
                    <td>${log.details}</td>
                    <td>${log.created_at}</td>
                </tr>
            `).join("");

        document.getElementById("message").textContent =
            "Dashboard synchronized with C34 Evidence API.";

    } catch (error) {
        console.error("C34 DASHBOARD ERROR:", error);

        document.getElementById("message").textContent =
            "Unable to connect to C34 Evidence API.";
    }
}

async function viewCustody(evidenceId) {
    try {
        const data = await apiFetch(
            `/api/evidence/${evidenceId}/custody`
        );

        if (!data.success) {
            alert("Unable to load custody history.");
            return;
        }

        let message =
            `CANNIBAL 34 — CHAIN OF CUSTODY\\n\\n` +
            `Evidence: ${data.evidence.evidence_number}\\n` +
            `Status: ${data.evidence.status}\\n` +
            `Transfers: ${data.transfer_count}\\n\\n`;

        if (!data.custody_history ||
            data.custody_history.length === 0) {

            message += "No custody transfers recorded.";
        } else {
            data.custody_history.forEach((entry, index) => {
                message +=
                    `TRANSFER ${index + 1}\\n` +
                    `From: ${entry.from_name} (${entry.from_badge})\\n` +
                    `To: ${entry.to_name} (${entry.to_badge})\\n` +
                    `Reason: ${entry.reason || "N/A"}\\n` +
                    `Time: ${entry.transferred_at}\\n\\n`;
            });
        }

        alert(message);

    } catch (error) {
        console.error(error);
        alert("Failed to load custody history.");
    }
}

async function verifyEvidence(evidenceId) {
    const filePath = prompt(
        "Enter the exact evidence file path:"
    );

    if (!filePath) {
        return;
    }

    try {
        const response = await apiFetch(
            `/api/evidence/${evidenceId}/verify`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    file_path: filePath.trim()
                })
            }
        );

        const data = await response.json();

        console.log("C34 VERIFICATION RESPONSE:", data);

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
                (data.evidence?.evidence_number || "Evidence")
            );
        }

        await loadDashboard();

    } catch (error) {
        console.error("C34 VERIFY ERROR:", error);
        alert("Unable to verify evidence.");
    }
}

loadDashboard();
