import { useState } from "react";
import { useApp } from "../context/AppContext";
import { adoService } from "../services/azureDevOps";
import { db } from "../services/database";
import type { TimeEntry, SyncLog } from "../types";
import "./TimeEntries.css";

export function TimeEntries() {
	const { state, dispatch } = useApp();
	const { timeEntries, organizations } = state;

	const [isSyncing, setIsSyncing] = useState(false);
	const [syncResults, setSyncResults] = useState<{
		success: number;
		failed: number;
	} | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Group entries by date
	const entriesByDate = timeEntries.reduce(
		(acc, entry) => {
			const date = entry.startTime.split("T")[0];
			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(entry);
			return acc;
		},
		{} as Record<string, TimeEntry[]>,
	);

	// Get unsynced entries
	const unsyncedEntries = timeEntries.filter((e) => !e.syncedToAdo);

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (dateStr === today.toISOString().split("T")[0]) {
			return "Today";
		} else if (dateStr === yesterday.toISOString().split("T")[0]) {
			return "Yesterday";
		}

		return date.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	}

	function formatTime(isoString: string): string {
		return new Date(isoString).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
		});
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours === 0) return `${mins}m`;
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}

	function getDayTotal(entries: TimeEntry[]): number {
		return entries.reduce((sum, e) => sum + e.durationMinutes, 0);
	}

	function toggleSelection(id: string) {
		const newSelection = new Set(selectedIds);
		if (newSelection.has(id)) {
			newSelection.delete(id);
		} else {
			newSelection.add(id);
		}
		setSelectedIds(newSelection);
	}

	function selectAllUnsynced() {
		setSelectedIds(new Set(unsyncedEntries.map((e) => e.id)));
	}

	function clearSelection() {
		setSelectedIds(new Set());
	}

	async function handleSync() {
		const entriesToSync = timeEntries.filter(
			(e) => selectedIds.has(e.id) && !e.syncedToAdo,
		);

		if (entriesToSync.length === 0) {
			return;
		}

		setIsSyncing(true);
		setSyncResults(null);

		let success = 0;
		let failed = 0;

		// Group entries by work item and organization
		const groupedByWorkItem = entriesToSync.reduce(
			(acc, entry) => {
				const key = `${entry.organizationId}-${entry.workItemId}`;
				if (!acc[key]) {
					acc[key] = {
						organizationId: entry.organizationId,
						workItemId: entry.workItemId,
						workItemTitle: entry.workItemTitle,
						totalMinutes: 0,
						entryIds: [],
					};
				}
				acc[key].totalMinutes += entry.durationMinutes;
				acc[key].entryIds.push(entry.id);
				return acc;
			},
			{} as Record<
				string,
				{
					organizationId: string;
					workItemId: number;
					workItemTitle: string;
					totalMinutes: number;
					entryIds: string[];
				}
			>,
		);

		// Sync each work item
		for (const group of Object.values(groupedByWorkItem)) {
			const org = organizations.find((o) => o.id === group.organizationId);
			if (!org) {
				failed++;
				continue;
			}

			const hoursToSync = group.totalMinutes / 60;
			const result = await adoService.updateCompletedWork(
				org,
				group.workItemId,
				hoursToSync,
			);

			const syncLog: SyncLog = {
				id: crypto.randomUUID(),
				workItemId: group.workItemId,
				workItemTitle: group.workItemTitle,
				organizationId: org.id,
				hoursSynced: hoursToSync,
				syncedAt: new Date().toISOString(),
				status: result.success ? "success" : "failed",
				errorMessage: result.error,
			};

			await db.addSyncLog(syncLog);

			if (result.success) {
				await db.markEntriesSynced(group.entryIds);

				// Update state
				group.entryIds.forEach((id) => {
					const entry = timeEntries.find((e) => e.id === id);
					if (entry) {
						dispatch({
							type: "UPDATE_TIME_ENTRY",
							payload: {
								...entry,
								syncedToAdo: true,
								syncedAt: new Date().toISOString(),
							},
						});
					}
				});

				success++;
			} else {
				failed++;
			}
		}

		setSyncResults({ success, failed });
		setSelectedIds(new Set());
		setIsSyncing(false);
	}

	async function handleDelete(id: string) {
		if (confirm("Delete this time entry?")) {
			await db.deleteTimeEntry(id);
			dispatch({ type: "DELETE_TIME_ENTRY", payload: id });
		}
	}

	if (timeEntries.length === 0) {
		return (
			<div className="time-entries-container">
				<div className="card empty-state">
					<div className="empty-state-icon">📋</div>
					<h2 className="empty-state-title">No Time Entries</h2>
					<p className="empty-state-description">
						Start the timer on a work item to create your first time entry.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="time-entries-container">
			<div className="entries-header">
				<h2>Time Entries</h2>
				<div className="entries-actions">
					{unsyncedEntries.length > 0 && (
						<>
							<span className="unsynced-count">
								{unsyncedEntries.length} unsynced
							</span>
							<button
								className="btn btn-secondary"
								onClick={
									selectedIds.size > 0 ? clearSelection : selectAllUnsynced
								}
							>
								{selectedIds.size > 0
									? "Clear Selection"
									: "Select All Unsynced"}
							</button>
							<button
								className="btn btn-primary"
								onClick={handleSync}
								disabled={selectedIds.size === 0 || isSyncing}
							>
								{isSyncing ? (
									<>
										<span className="spinner"></span>
										Syncing...
									</>
								) : (
									`Sync to ADO (${selectedIds.size})`
								)}
							</button>
						</>
					)}
				</div>
			</div>

			{syncResults && (
				<div
					className={`sync-result ${syncResults.failed > 0 ? "has-errors" : "success"}`}
				>
					{syncResults.failed === 0 ? (
						<span>
							✓ Successfully synced {syncResults.success} work item(s) to Azure
							DevOps
						</span>
					) : (
						<span>
							Synced {syncResults.success} work item(s), {syncResults.failed}{" "}
							failed. Check the sync log for details.
						</span>
					)}
				</div>
			)}

			<div className="entries-list">
				{Object.entries(entriesByDate)
					.sort(([a], [b]) => b.localeCompare(a))
					.map(([date, entries]) => (
						<div key={date} className="day-group">
							<div className="day-header">
								<span className="day-label">{formatDate(date)}</span>
								<span className="day-total">
									{formatDuration(getDayTotal(entries))}
								</span>
							</div>
							<div className="day-entries">
								{entries.map((entry) => (
									<div
										key={entry.id}
										className={`entry-row ${selectedIds.has(entry.id) ? "selected" : ""}`}
									>
										{!entry.syncedToAdo && (
											<input
												type="checkbox"
												className="entry-checkbox"
												checked={selectedIds.has(entry.id)}
												onChange={() => toggleSelection(entry.id)}
											/>
										)}
										<div className="entry-time">
											{formatTime(entry.startTime)}
											{entry.endTime && ` - ${formatTime(entry.endTime)}`}
										</div>
										<div className="entry-workitem">
											<span
												className={`entry-type type-${entry.workItemType.toLowerCase().replace(/\s+/g, "-")}`}
											>
												{entry.workItemType}
											</span>
											<span className="entry-id">#{entry.workItemId}</span>
											<span className="entry-title">{entry.workItemTitle}</span>
										</div>
										<div className="entry-duration">
											{formatDuration(entry.durationMinutes)}
										</div>
										<div className="entry-status">
											{entry.syncedToAdo ? (
												<span className="badge badge-success">Synced</span>
											) : (
												<span className="badge badge-warning">Pending</span>
											)}
										</div>
										<div className="entry-actions">
											{!entry.syncedToAdo && (
												<button
													className="btn-icon-sm"
													onClick={() => handleDelete(entry.id)}
													title="Delete"
												>
													🗑️
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
			</div>
		</div>
	);
}
