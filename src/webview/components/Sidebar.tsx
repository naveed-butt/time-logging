import { useApp } from "../context/AppContext";
import type { ViewType } from "../types";
import "./Sidebar.css";

interface SidebarProps {
	currentView: ViewType;
	onViewChange: (view: ViewType) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
	const { state } = useApp();
	const { timer, organizations, currentOrganization } = state;

	const navItems: { id: ViewType; label: string; icon: string }[] = [
		{ id: "timer", label: "Timer", icon: "⏱️" },
		{ id: "entries", label: "Time Entries", icon: "📋" },
		{ id: "reports", label: "Reports", icon: "📊" },
		{ id: "settings", label: "Settings", icon: "⚙️" },
	];

	return (
		<aside className="sidebar">
			<div className="sidebar-header">
				<h1 className="sidebar-title">Time Tracker</h1>
				{currentOrganization && (
					<span className="sidebar-org">{currentOrganization.name}</span>
				)}
			</div>

			{timer.isRunning && (
				<div className="sidebar-timer-status">
					<span className="timer-indicator"></span>
					<div className="timer-info">
						<span className="timer-label">Recording</span>
						<span className="timer-workitem">
							{timer.currentWorkItem?.title.slice(0, 25)}...
						</span>
					</div>
				</div>
			)}

			<nav className="sidebar-nav">
				{navItems.map((item) => (
					<button
						key={item.id}
						className={`nav-item ${currentView === item.id ? "active" : ""}`}
						onClick={() => onViewChange(item.id)}
					>
						<span className="nav-icon">{item.icon}</span>
						<span className="nav-label">{item.label}</span>
					</button>
				))}
			</nav>

			<div className="sidebar-footer">
				{organizations.length === 0 ? (
					<div className="sidebar-warning">
						<span className="warning-icon">⚠️</span>
						<span>No ADO connection</span>
					</div>
				) : (
					<div className="sidebar-status">
						<span className="status-dot connected"></span>
						<span>{organizations.length} org(s) connected</span>
					</div>
				)}
			</div>
		</aside>
	);
}
