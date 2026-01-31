import { useState } from "react";
import { Timer } from "./components/Timer";
import { TimeEntries } from "./components/TimeEntries";
import { Settings } from "./components/Settings";
import { Reports } from "./components/Reports";
import { AppProvider, useApp } from "./context/AppContext";
import "./styles/App.css";

type View = "timer" | "entries" | "reports" | "settings";

const tabs: { id: View; label: string }[] = [
	{ id: "timer", label: "Timer" },
	{ id: "entries", label: "Entries" },
	{ id: "reports", label: "Reports" },
	{ id: "settings", label: "Settings" },
];

function AppContent() {
	const [currentView, setCurrentView] = useState<View>("timer");
	const { state } = useApp();
	const { organizations } = state;

	const renderView = () => {
		switch (currentView) {
			case "timer":
				return <Timer />;
			case "entries":
				return <TimeEntries />;
			case "reports":
				return <Reports />;
			case "settings":
				return <Settings />;
			default:
				return <Timer />;
		}
	};

	return (
		<div className="app-container">
			<nav className="tab-nav">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						className={`tab-btn ${currentView === tab.id ? "active" : ""}`}
						onClick={() => setCurrentView(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</nav>
			{organizations.length === 0 && (
				<div className="connection-status warning">
					⚠ No ADO connection
				</div>
			)}
			<main className="main-content">{renderView()}</main>
		</div>
	);
}

function App() {
	return (
		<AppProvider>
			<AppContent />
		</AppProvider>
	);
}

export default App;
