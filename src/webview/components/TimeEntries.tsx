import { useState } from "react";
import { useApp } from "../context/AppContext";
import type { TimeEntry } from "../types";
import "./TimeEntries.css";

export function TimeEntries() {
	const { state, deleteTimeEntry, syncEntry, syncAll } = useApp();
	const { timeEntries } = state;

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [isSyncing, setIsSyncing] = useState(false);

	// Group entries by date
	const entriesByDate = timeEntries.reduce(
		(acc: Record<string, TimeEntry[]>, entry: TimeEntry) => {
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
	const unsyncedEntries = timeEntries.filter((e: TimeEntry) => !e.syncedToAdo);

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
		return entries.reduce((sum: number, e: TimeEntry) => sum + e.durationMinutes, 0);
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
		setSelectedIds(new Set(unsyncedEntries.map((e: TimeEntry) => e.id)));
	}

	function clearSelection() {
		setSelectedIds(new Set());
	}

	async function handleSync() {
		if (selectedIds.size === 0) return;

		setIsSyncing(true);

		// Sync selected entries
		for (const id of selectedIds) {
			syncEntry(id);
		}

		setSelectedIds(new Set());
		setIsSyncing(false);
	}

	async function handleSyncAll() {
		setIsSyncing(true);
		syncAll();
		setIsSyncing(false);
	}

	function handleDelete(id: string) {
		if (confirm("Delete this time entry?")) {
			deleteTimeEntry(id);
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
								className="btn btn-secondary btn-sm"
								onClick={
									selectedIds.size > 0 ? clearSelection : selectAllUnsynced
								}
							>
								{selectedIds.size > 0
									? "Clear Selection"
									: "Select All Unsynced"}
							</button>
							<button
								className="btn btn-primary btn-sm"
								onClick={handleSync}
								disabled={selectedIds.size === 0 || isSyncing}
							>
								{isSyncing ? "Syncing..." : `Sync Selected (${selectedIds.size})`}
							</button>
							<button
								className="btn btn-primary btn-sm"
								onClick={handleSyncAll}
								disabled={isSyncing}
							>
								Sync All
							</button>
						</>
					)}
				</div>
			</div>

			<div className="entries-list">
				{Object.entries(entriesByDate)
					.sort(([a], [b]) => b.localeCompare(a))
					.map(([date, entries]) => (
						<div key={date} className="day-group">
							<div className="day-header">
								<span className="day-label">{formatDate(date)}</span>
								<span className="day-total">
									{formatDuration(getDayTotal(entries as TimeEntry[]))}
								</span>
							</div>
							<div className="day-entries">
								{(entries as TimeEntry[]).map((entry: TimeEntry) => (
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
