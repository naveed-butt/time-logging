import { useState, useEffect, useCallback, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { adoService } from "../services/azureDevOps";
import { db } from "../services/database";
import type { WorkItem, TimeEntry } from "../types";
import "./Timer.css";

export function Timer() {
	const { state, dispatch, startTimer, pauseTimer, resumeTimer, stopTimer } =
		useApp();
	const { timer, currentOrganization, workItems } = state;

	const [localWorkItems, setLocalWorkItems] = useState<WorkItem[]>(workItems);
	const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(
		null,
	);
	const [searchText, setSearchText] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showDropdown, setShowDropdown] = useState(false);

	// Manual entry state
	const [showManualEntry, setShowManualEntry] = useState(false);
	const [manualHours, setManualHours] = useState("");
	const [manualMinutes, setManualMinutes] = useState("");
	const [manualDescription, setManualDescription] = useState("");

	// Load work items when organization changes
	useEffect(() => {
		if (currentOrganization) {
			loadWorkItems();
		}
	}, [currentOrganization?.id]);

	async function loadWorkItems() {
		if (!currentOrganization) return;

		setIsLoading(true);
		try {
			const items = await adoService.getMyWorkItems(currentOrganization);
			setLocalWorkItems(items);
		} catch (error) {
			console.error("Failed to load work items:", error);
		} finally {
			setIsLoading(false);
		}
	}

	// Search work items with debounce
	const searchWorkItems = useCallback(
		async (text: string) => {
			if (!currentOrganization || text.length < 2) {
				if (text.length === 0) {
					loadWorkItems();
				}
				return;
			}

			setIsLoading(true);
			try {
				const items = await adoService.searchWorkItems(
					currentOrganization,
					text,
				);
				setLocalWorkItems(items);
			} catch (error) {
				console.error("Failed to search work items:", error);
			} finally {
				setIsLoading(false);
			}
		},
		[currentOrganization],
	);

	useEffect(() => {
		const timeout = setTimeout(() => {
			if (searchText) {
				searchWorkItems(searchText);
			}
		}, 300);
		return () => clearTimeout(timeout);
	}, [searchText, searchWorkItems]);

	// Format elapsed time as HH:MM:SS
	function formatTime(totalSeconds: number): string {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		return [
			hours.toString().padStart(2, "0"),
			minutes.toString().padStart(2, "0"),
			seconds.toString().padStart(2, "0"),
		].join(":");
	}

	function handleStart() {
		if (selectedWorkItem) {
			startTimer(selectedWorkItem);
		}
	}

	async function handleStop() {
		await stopTimer();
		setSelectedWorkItem(null);
	}

	function selectWorkItem(item: WorkItem) {
		setSelectedWorkItem(item);
		setSearchText(item.title);
		setShowDropdown(false);
	}

	// Manual time entry handler
	async function handleManualEntry() {
		if (!selectedWorkItem || !currentOrganization) return;

		const hours = parseInt(manualHours) || 0;
		const minutes = parseInt(manualMinutes) || 0;
		const totalMinutes = hours * 60 + minutes;

		if (totalMinutes <= 0) return;

		const now = new Date();
		const entry: TimeEntry = {
			id: crypto.randomUUID(),
			workItemId: selectedWorkItem.id,
			workItemTitle: selectedWorkItem.title,
			workItemType: selectedWorkItem.type,
			projectName: selectedWorkItem.projectName,
			organizationId: selectedWorkItem.organizationId,
			organizationName: currentOrganization.name,
			startTime: now.toISOString(),
			endTime: now.toISOString(),
			durationMinutes: totalMinutes,
			description: manualDescription || undefined,
			syncedToAdo: false,
			createdAt: now.toISOString(),
			updatedAt: now.toISOString(),
		};

		await db.addTimeEntry(entry);
		dispatch({ type: "ADD_TIME_ENTRY", payload: entry });

		// Reset form
		setManualHours("");
		setManualMinutes("");
		setManualDescription("");
		setSelectedWorkItem(null);
		setSearchText("");
		setShowManualEntry(false);
	}

	// Calculate last 2 days summary
	const recentDaysSummary = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		const todayStr = today.toISOString().split("T")[0];
		const yesterdayStr = yesterday.toISOString().split("T")[0];

		let todayMinutes = 0;
		let yesterdayMinutes = 0;

		state.timeEntries.forEach((entry) => {
			const entryDate = entry.startTime.split("T")[0];
			if (entryDate === todayStr) {
				todayMinutes += entry.durationMinutes;
			} else if (entryDate === yesterdayStr) {
				yesterdayMinutes += entry.durationMinutes;
			}
		});

		return { todayMinutes, yesterdayMinutes };
	}, [state.timeEntries]);

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours === 0) return `${mins}m`;
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}

	const hasNoOrganization = !currentOrganization;

	return (
		<div className="timer-container">
			<div className="timer-card card">
				<div className="timer-display">
					<span className={`time ${timer.isRunning ? "running" : ""}`}>
						{formatTime(timer.elapsedSeconds)}
					</span>
					{timer.isPaused && <span className="paused-indicator">PAUSED</span>}
				</div>

				{timer.isRunning && timer.currentWorkItem && (
					<div className="current-task">
						<span className="task-type">{timer.currentWorkItem.type}</span>
						<span className="task-id">#{timer.currentWorkItem.id}</span>
						<span className="task-title">{timer.currentWorkItem.title}</span>
					</div>
				)}

				{!timer.isRunning && (
					<div className="work-item-selector">
						<label className="form-label">Select Work Item</label>
						<div className="search-container">
							<input
								type="text"
								className="form-input"
								placeholder={
									hasNoOrganization
										? "Connect to ADO first..."
										: "Search or select a work item..."
								}
								value={searchText}
								onChange={(e) => {
									setSearchText(e.target.value);
									setShowDropdown(true);
								}}
								onFocus={() => setShowDropdown(true)}
								disabled={hasNoOrganization}
							/>
							{isLoading && <span className="search-spinner spinner"></span>}
						</div>

						{showDropdown && localWorkItems.length > 0 && (
							<ul className="work-items-dropdown">
								{localWorkItems.map((item) => (
									<li
										key={item.id}
										className={`work-item-option ${selectedWorkItem?.id === item.id ? "selected" : ""}`}
										onClick={() => selectWorkItem(item)}
									>
										<span
											className={`item-type type-${item.type.toLowerCase().replace(/\s+/g, "-")}`}
										>
											{item.type}
										</span>
										<span className="item-id">#{item.id}</span>
										<span className="item-title">{item.title}</span>
										<span className="item-state">{item.state}</span>
									</li>
								))}
							</ul>
						)}

						{showDropdown &&
							!isLoading &&
							localWorkItems.length === 0 &&
							currentOrganization && (
								<div className="no-items-message">
									{searchText
										? "No matching work items found"
										: "No work items assigned to you"}
								</div>
							)}
					</div>
				)}

				<div className="timer-controls">
					{!timer.isRunning ? (
						<>
							<button
								className="btn btn-primary btn-lg start-btn"
								onClick={handleStart}
								disabled={!selectedWorkItem}
							>
								▶ Start Timer
							</button>
							<button
								className="btn btn-secondary btn-lg"
								onClick={() => setShowManualEntry(!showManualEntry)}
								disabled={!selectedWorkItem}
							>
								+ Log Manually
							</button>
						</>
					) : (
						<>
							{timer.isPaused ? (
								<button
									className="btn btn-primary btn-lg"
									onClick={resumeTimer}
								>
									▶ Resume
								</button>
							) : (
								<button
									className="btn btn-secondary btn-lg"
									onClick={pauseTimer}
								>
									⏸ Pause
								</button>
							)}
							<button className="btn btn-danger btn-lg" onClick={handleStop}>
								⏹ Stop
							</button>
						</>
					)}
				</div>

				{/* Manual Entry Form */}
				{showManualEntry && selectedWorkItem && (
					<div className="manual-entry-form">
						<h4>Log Time Manually</h4>
						<div className="manual-entry-inputs">
							<div className="time-input-group">
								<input
									type="number"
									className="form-input time-input"
									placeholder="0"
									min="0"
									max="24"
									value={manualHours}
									onChange={(e) => setManualHours(e.target.value)}
								/>
								<span className="time-label">hours</span>
							</div>
							<div className="time-input-group">
								<input
									type="number"
									className="form-input time-input"
									placeholder="0"
									min="0"
									max="59"
									value={manualMinutes}
									onChange={(e) => setManualMinutes(e.target.value)}
								/>
								<span className="time-label">minutes</span>
							</div>
						</div>
						<input
							type="text"
							className="form-input"
							placeholder="Description (optional)"
							value={manualDescription}
							onChange={(e) => setManualDescription(e.target.value)}
						/>
						<div className="manual-entry-actions">
							<button
								className="btn btn-secondary"
								onClick={() => setShowManualEntry(false)}
							>
								Cancel
							</button>
							<button
								className="btn btn-primary"
								onClick={handleManualEntry}
								disabled={
									(parseInt(manualHours) || 0) * 60 +
										(parseInt(manualMinutes) || 0) <=
									0
								}
							>
								Add Entry
							</button>
						</div>
					</div>
				)}

				{hasNoOrganization && (
					<div className="setup-prompt">
						<p>To start tracking time, connect to Azure DevOps in Settings.</p>
					</div>
				)}
			</div>

			{/* Recent Days Summary */}
			<div className="recent-summary card">
				<h3 className="card-title">Recent Activity</h3>
				<div className="summary-days">
					<div className="summary-day">
						<span className="day-name">Today</span>
						<span className="day-hours">
							{recentDaysSummary.todayMinutes > 0
								? formatDuration(recentDaysSummary.todayMinutes)
								: "No time logged"}
						</span>
					</div>
					<div className="summary-day">
						<span className="day-name">Yesterday</span>
						<span className="day-hours">
							{recentDaysSummary.yesterdayMinutes > 0
								? formatDuration(recentDaysSummary.yesterdayMinutes)
								: "No time logged"}
						</span>
					</div>
				</div>
			</div>

			<div className="timer-tips card">
				<h3 className="card-title">Quick Tips</h3>
				<ul className="tips-list">
					<li>Search by work item ID (e.g., #12345) or title</li>
					<li>Use "Log Manually" to add time without starting the timer</li>
					<li>Time is saved locally when you stop the timer</li>
					<li>Sync to Azure DevOps manually from Time Entries</li>
				</ul>
			</div>
		</div>
	);
}
