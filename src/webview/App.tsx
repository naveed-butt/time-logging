import { useState } from "react";
import { Timer } from "./components/Timer";
import { TimeEntries } from "./components/TimeEntries";
import { Settings } from "./components/Settings";
import { Reports } from "./components/Reports";
import { Sidebar } from "./components/Sidebar";
import { AppProvider } from "./context/AppContext";
import "./styles/App.css";

type View = "timer" | "entries" | "reports" | "settings";

function App() {
	const [currentView, setCurrentView] = useState<View>("timer");

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
		<AppProvider>
			<div className="app-container">
				<Sidebar currentView={currentView} onViewChange={setCurrentView} />
				<main className="main-content">{renderView()}</main>
			</div>
		</AppProvider>
	);
}

export default App;
