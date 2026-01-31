import { useState } from "react";
import { useApp } from "../context/AppContext";
import type { AdoOrganization } from "../types";
import "./Settings.css";

export function Settings() {
	const {
		state,
		saveOrganization,
		deleteOrganization,
		setCurrentOrganization,
	} = useApp();
	const { organizations, settings } = state;

	const [editingOrg, setEditingOrg] = useState<Partial<AdoOrganization> | null>(
		null,
	);
	const [isTestingConnection, setIsTestingConnection] = useState(false);
	const [connectionResult, setConnectionResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);
	const [isSaving, setIsSaving] = useState(false);

	function handleNewOrg() {
		setEditingOrg({
			id: crypto.randomUUID(),
			name: "",
			url: "https://dev.azure.com/",
			projectName: "",
			patToken: "",
			isDefault: organizations.length === 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		setConnectionResult(null);
	}

	function handleEditOrg(org: AdoOrganization) {
		setEditingOrg({ ...org });
		setConnectionResult(null);
	}

	async function handleTestConnection() {
		if (!editingOrg?.url || !editingOrg?.patToken || !editingOrg?.projectName) {
			setConnectionResult({
				success: false,
				message: "Please fill in URL, Project, and PAT token",
			});
			return;
		}

		setIsTestingConnection(true);
		setConnectionResult(null);

		try {
			// Test by fetching projects from the API
			const baseUrl = editingOrg.url.replace(/\/$/, "");
			const auth = btoa(`:${editingOrg.patToken}`);
			const response = await fetch(
				`${baseUrl}/${editingOrg.projectName}/_apis/wit/wiql?api-version=7.1`,
				{
					method: "POST",
					headers: {
						Authorization: `Basic ${auth}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						query: "SELECT [System.Id] FROM WorkItems WHERE [System.Id] = 0",
					}),
				},
			);

			if (response.ok) {
				setConnectionResult({
					success: true,
					message: "Connection successful!",
				});
			} else if (response.status === 401) {
				setConnectionResult({
					success: false,
					message: "Authentication failed. Check your PAT token.",
				});
			} else if (response.status === 404) {
				setConnectionResult({
					success: false,
					message:
						"Project not found. Check your organization URL and project name.",
				});
			} else {
				setConnectionResult({
					success: false,
					message: `Connection failed: ${response.statusText}`,
				});
			}
		} catch (error) {
			setConnectionResult({
				success: false,
				message: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
			});
		}

		setIsTestingConnection(false);
	}

	function handleSaveOrg() {
		if (
			!editingOrg?.name ||
			!editingOrg?.url ||
			!editingOrg?.projectName ||
			!editingOrg?.patToken
		) {
			setConnectionResult({
				success: false,
				message: "Please fill in all fields",
			});
			return;
		}

		setIsSaving(true);

		const org: AdoOrganization = {
			id: editingOrg.id || crypto.randomUUID(),
			name: editingOrg.name,
			url: editingOrg.url.replace(/\/$/, ""),
			projectName: editingOrg.projectName,
			patToken: editingOrg.patToken,
			isDefault: editingOrg.isDefault || organizations.length === 0,
			createdAt: editingOrg.createdAt || new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		// Send to extension via postMessage
		saveOrganization(org);

		if (org.isDefault) {
			setCurrentOrganization(org.id);
		}

		setEditingOrg(null);
		setConnectionResult(null);
		setIsSaving(false);
	}

	function handleDeleteOrg(id: string) {
		if (
			confirm(
				"Delete this organization connection? Time entries will not be deleted.",
			)
		) {
			deleteOrganization(id);
		}
	}

	function handleSetDefault(org: AdoOrganization) {
		setCurrentOrganization(org.id);
	}

	return (
		<div className="settings-container">
			<h2>Settings</h2>

			{/* Organizations Section */}
			<section className="settings-section">
				<div className="section-header">
					<h3>Azure DevOps Organizations</h3>
					<button className="btn btn-primary" onClick={handleNewOrg}>
						+ Add Organization
					</button>
				</div>

				{organizations.length === 0 && !editingOrg && (
					<div className="empty-orgs">
						<p>
							No organizations connected. Add an Azure DevOps organization to
							start tracking time.
						</p>
					</div>
				)}

				{/* Organization List */}
				{organizations.length > 0 && !editingOrg && (
					<div className="org-list">
						{organizations.map((org) => (
							<div key={org.id} className="org-item">
								<div className="org-info">
									<div className="org-name">
										{org.name}
										{org.isDefault && (
											<span className="default-badge">Default</span>
										)}
									</div>
									<div className="org-details">
										{org.url} / {org.projectName}
									</div>
								</div>
								<div className="org-actions">
									{!org.isDefault && (
										<button
											className="btn btn-secondary btn-sm"
											onClick={() => handleSetDefault(org)}
										>
											Set Default
										</button>
									)}
									<button
										className="btn btn-secondary btn-sm"
										onClick={() => handleEditOrg(org)}
									>
										Edit
									</button>
									<button
										className="btn btn-danger btn-sm"
										onClick={() => handleDeleteOrg(org.id)}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Organization Form */}
				{editingOrg && (
					<div className="org-form card">
						<h4>
							{editingOrg.id &&
							organizations.find((o) => o.id === editingOrg.id)
								? "Edit Organization"
								: "New Organization"}
						</h4>

						<div className="form-group">
							<label className="form-label">Display Name</label>
							<input
								type="text"
								className="form-input"
								placeholder="My Company ADO"
								value={editingOrg.name || ""}
								onChange={(e) =>
									setEditingOrg({ ...editingOrg, name: e.target.value })
								}
							/>
						</div>

						<div className="form-group">
							<label className="form-label">Organization URL</label>
							<input
								type="text"
								className="form-input"
								placeholder="https://dev.azure.com/myorg"
								value={editingOrg.url || ""}
								onChange={(e) =>
									setEditingOrg({ ...editingOrg, url: e.target.value })
								}
							/>
							<span className="form-help">
								The base URL of your Azure DevOps organization
							</span>
						</div>

						<div className="form-group">
							<label className="form-label">Project Name</label>
							<input
								type="text"
								className="form-input"
								placeholder="MyProject"
								value={editingOrg.projectName || ""}
								onChange={(e) =>
									setEditingOrg({ ...editingOrg, projectName: e.target.value })
								}
							/>
						</div>

						<div className="form-group">
							<label className="form-label">Personal Access Token (PAT)</label>
							<input
								type="password"
								className="form-input"
								placeholder="Enter your PAT token"
								value={editingOrg.patToken || ""}
								onChange={(e) =>
									setEditingOrg({ ...editingOrg, patToken: e.target.value })
								}
							/>
							<span className="form-help">
								Create a PAT at Azure DevOps → User Settings → Personal Access
								Tokens.
								<br />
								Required scopes: Work Items (Read & Write)
							</span>
						</div>

						{connectionResult && (
							<div
								className={`connection-result ${connectionResult.success ? "success" : "error"}`}
							>
								{connectionResult.success ? "✓" : "✗"}{" "}
								{connectionResult.message}
							</div>
						)}

						<div className="form-actions">
							<button
								className="btn btn-secondary"
								onClick={handleTestConnection}
								disabled={isTestingConnection}
							>
								{isTestingConnection ? "Testing..." : "Test Connection"}
							</button>
							<div className="form-actions-right">
								<button
									className="btn btn-secondary"
									onClick={() => {
										setEditingOrg(null);
										setConnectionResult(null);
									}}
								>
									Cancel
								</button>
								<button
									className="btn btn-primary"
									onClick={handleSaveOrg}
									disabled={isSaving}
								>
									{isSaving ? "Saving..." : "Save Organization"}
								</button>
							</div>
						</div>
					</div>
				)}
			</section>

			{/* General Settings Section */}
			<section className="settings-section">
				<h3>Preferences</h3>

				<div className="setting-row">
					<div className="setting-info">
						<div className="setting-label">Time Rounding</div>
						<div className="setting-description">
							Round logged time to nearest interval
						</div>
					</div>
					<select
						className="form-select setting-select"
						value={settings.timeRounding}
						disabled
					>
						<option value={1}>1 minute</option>
						<option value={5}>5 minutes</option>
						<option value={15}>15 minutes</option>
						<option value={30}>30 minutes</option>
					</select>
				</div>

				<div className="setting-row">
					<div className="setting-info">
						<div className="setting-label">Default View</div>
						<div className="setting-description">
							Tab shown when opening the extension
						</div>
					</div>
					<select
						className="form-select setting-select"
						value={settings.defaultView}
						disabled
					>
						<option value="timer">Timer</option>
						<option value="entries">Time Entries</option>
						<option value="reports">Reports</option>
					</select>
				</div>
			</section>

			{/* About Section */}
			<section className="settings-section">
				<h3>About</h3>
				<div className="about-info">
					<p>
						<strong>Time Tracker for Azure DevOps</strong>
					</p>
					<p>Version 0.0.1</p>
					<p className="text-secondary">
						Track time on your Azure DevOps work items and sync completed hours
						directly to ADO.
					</p>
				</div>
			</section>
		</div>
	);
}
