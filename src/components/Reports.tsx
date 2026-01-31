import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import type { DailySummary } from "../types";
import "./Reports.css";

export function Reports() {
	const { state } = useApp();
	const { timeEntries } = state;

	const [dateRange, setDateRange] = useState<"week" | "month" | "all">("week");

	// Calculate date filter
	const filteredEntries = useMemo(() => {
		const now = new Date();
		let startDate: Date;

		switch (dateRange) {
			case "week":
				startDate = new Date(now);
				startDate.setDate(now.getDate() - 7);
				break;
			case "month":
				startDate = new Date(now);
				startDate.setMonth(now.getMonth() - 1);
				break;
			case "all":
				return timeEntries;
		}

		return timeEntries.filter(
			(entry) => new Date(entry.startTime) >= startDate,
		);
	}, [timeEntries, dateRange]);

	// Calculate daily summaries
	const dailySummaries = useMemo((): DailySummary[] => {
		const byDate: Record<string, DailySummary> = {};

		filteredEntries.forEach((entry) => {
			const date = entry.startTime.split("T")[0];

			if (!byDate[date]) {
				byDate[date] = {
					date,
					totalMinutes: 0,
					entries: [],
					byProject: {},
					byWorkItem: {},
				};
			}

			byDate[date].totalMinutes += entry.durationMinutes;
			byDate[date].entries.push(entry);

			// By project
			byDate[date].byProject[entry.projectName] =
				(byDate[date].byProject[entry.projectName] || 0) +
				entry.durationMinutes;

			// By work item
			if (!byDate[date].byWorkItem[entry.workItemId]) {
				byDate[date].byWorkItem[entry.workItemId] = {
					title: entry.workItemTitle,
					minutes: 0,
				};
			}
			byDate[date].byWorkItem[entry.workItemId].minutes +=
				entry.durationMinutes;
		});

		return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
	}, [filteredEntries]);

	// Calculate totals
	const totalMinutes = filteredEntries.reduce(
		(sum, e) => sum + e.durationMinutes,
		0,
	);
	const totalHours = (totalMinutes / 60).toFixed(1);

	// Calculate max for chart scaling
	const maxDailyMinutes = Math.max(
		...dailySummaries.map((d) => d.totalMinutes),
		1,
	);

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours === 0) return `${mins}m`;
		if (mins === 0) return `${hours}h`;
		return `${hours}h ${mins}m`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	}

	// Group by project for overview
	const projectTotals = useMemo(() => {
		const totals: Record<string, number> = {};
		filteredEntries.forEach((entry) => {
			totals[entry.projectName] =
				(totals[entry.projectName] || 0) + entry.durationMinutes;
		});
		return Object.entries(totals)
			.map(([name, minutes]) => ({ name, minutes }))
			.sort((a, b) => b.minutes - a.minutes);
	}, [filteredEntries]);

	// Top work items
	const topWorkItems = useMemo(() => {
		const totals: Record<number, { title: string; minutes: number }> = {};
		filteredEntries.forEach((entry) => {
			if (!totals[entry.workItemId]) {
				totals[entry.workItemId] = { title: entry.workItemTitle, minutes: 0 };
			}
			totals[entry.workItemId].minutes += entry.durationMinutes;
		});
		return Object.entries(totals)
			.map(([id, data]) => ({ id: Number(id), ...data }))
			.sort((a, b) => b.minutes - a.minutes)
			.slice(0, 5);
	}, [filteredEntries]);

	if (timeEntries.length === 0) {
		return (
			<div className="reports-container">
				<div className="card empty-state">
					<div className="empty-state-icon">📊</div>
					<h2 className="empty-state-title">No Data Yet</h2>
					<p className="empty-state-description">
						Start tracking time to see reports and summaries.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="reports-container">
			<div className="reports-header">
				<h2>Reports</h2>
				<div className="date-range-selector">
					<button
						className={`range-btn ${dateRange === "week" ? "active" : ""}`}
						onClick={() => setDateRange("week")}
					>
						Last 7 Days
					</button>
					<button
						className={`range-btn ${dateRange === "month" ? "active" : ""}`}
						onClick={() => setDateRange("month")}
					>
						Last Month
					</button>
					<button
						className={`range-btn ${dateRange === "all" ? "active" : ""}`}
						onClick={() => setDateRange("all")}
					>
						All Time
					</button>
				</div>
			</div>

			{/* Summary Cards */}
			<div className="summary-cards">
				<div className="summary-card">
					<div className="summary-value">{totalHours}h</div>
					<div className="summary-label">Total Hours</div>
				</div>
				<div className="summary-card">
					<div className="summary-value">{filteredEntries.length}</div>
					<div className="summary-label">Time Entries</div>
				</div>
				<div className="summary-card">
					<div className="summary-value">{dailySummaries.length}</div>
					<div className="summary-label">Days Tracked</div>
				</div>
				<div className="summary-card">
					<div className="summary-value">{projectTotals.length}</div>
					<div className="summary-label">Projects</div>
				</div>
			</div>

			{/* Daily Chart */}
			<div className="report-section card">
				<h3 className="card-title">Daily Activity</h3>
				<div className="daily-chart">
					{dailySummaries
						.slice(0, 14)
						.reverse()
						.map((day) => (
							<div key={day.date} className="chart-bar-container">
								<div
									className="chart-bar"
									style={{
										height: `${(day.totalMinutes / maxDailyMinutes) * 100}%`,
									}}
									title={`${formatDate(day.date)}: ${formatDuration(day.totalMinutes)}`}
								>
									<span className="chart-value">
										{formatDuration(day.totalMinutes)}
									</span>
								</div>
								<span className="chart-label">
									{new Date(day.date).toLocaleDateString("en-US", {
										weekday: "short",
									})}
								</span>
							</div>
						))}
				</div>
			</div>

			<div className="report-columns">
				{/* By Project */}
				<div className="report-section card">
					<h3 className="card-title">By Project</h3>
					<div className="breakdown-list">
						{projectTotals.map((project) => (
							<div key={project.name} className="breakdown-item">
								<div className="breakdown-info">
									<span className="breakdown-name">{project.name}</span>
									<span className="breakdown-duration">
										{formatDuration(project.minutes)}
									</span>
								</div>
								<div className="breakdown-bar">
									<div
										className="breakdown-fill"
										style={{
											width: `${(project.minutes / totalMinutes) * 100}%`,
										}}
									></div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Top Work Items */}
				<div className="report-section card">
					<h3 className="card-title">Top Work Items</h3>
					<div className="breakdown-list">
						{topWorkItems.map((item) => (
							<div key={item.id} className="breakdown-item">
								<div className="breakdown-info">
									<span className="breakdown-name">
										<span className="item-id">#{item.id}</span>
										{item.title.slice(0, 40)}
										{item.title.length > 40 ? "..." : ""}
									</span>
									<span className="breakdown-duration">
										{formatDuration(item.minutes)}
									</span>
								</div>
								<div className="breakdown-bar">
									<div
										className="breakdown-fill"
										style={{
											width: `${(item.minutes / topWorkItems[0].minutes) * 100}%`,
										}}
									></div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
