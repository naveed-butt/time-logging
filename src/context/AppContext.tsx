import {
	createContext,
	useContext,
	useReducer,
	useEffect,
	ReactNode,
} from "react";
import type {
	AdoOrganization,
	WorkItem,
	TimeEntry,
	TimerState,
	AppSettings,
} from "../types";
import { db } from "../services/database";

// State shape
interface AppState {
	organizations: AdoOrganization[];
	currentOrganization: AdoOrganization | null;
	workItems: WorkItem[];
	timeEntries: TimeEntry[];
	timer: TimerState;
	settings: AppSettings;
	isLoading: boolean;
	error: string | null;
}

// Action types
type AppAction =
	| { type: "SET_ORGANIZATIONS"; payload: AdoOrganization[] }
	| { type: "ADD_ORGANIZATION"; payload: AdoOrganization }
	| { type: "UPDATE_ORGANIZATION"; payload: AdoOrganization }
	| { type: "DELETE_ORGANIZATION"; payload: string }
	| { type: "SET_CURRENT_ORGANIZATION"; payload: AdoOrganization | null }
	| { type: "SET_WORK_ITEMS"; payload: WorkItem[] }
	| { type: "SET_TIME_ENTRIES"; payload: TimeEntry[] }
	| { type: "ADD_TIME_ENTRY"; payload: TimeEntry }
	| { type: "UPDATE_TIME_ENTRY"; payload: TimeEntry }
	| { type: "DELETE_TIME_ENTRY"; payload: string }
	| { type: "START_TIMER"; payload: WorkItem }
	| { type: "PAUSE_TIMER" }
	| { type: "RESUME_TIMER" }
	| { type: "STOP_TIMER" }
	| { type: "TICK_TIMER" }
	| { type: "SET_SETTINGS"; payload: Partial<AppSettings> }
	| { type: "SET_LOADING"; payload: boolean }
	| { type: "SET_ERROR"; payload: string | null };

// Initial state
const initialState: AppState = {
	organizations: [],
	currentOrganization: null,
	workItems: [],
	timeEntries: [],
	timer: {
		isRunning: false,
		isPaused: false,
		startTime: null,
		pausedDuration: 0,
		currentWorkItem: null,
		elapsedSeconds: 0,
	},
	settings: {
		minimizeToTray: true,
		startWithWindows: false,
		defaultOrganizationId: null,
		timeRoundingMinutes: 1,
		reminderIntervalMinutes: 0,
		theme: "light",
	},
	isLoading: false,
	error: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case "SET_ORGANIZATIONS":
			return { ...state, organizations: action.payload };

		case "ADD_ORGANIZATION":
			return {
				...state,
				organizations: [...state.organizations, action.payload],
			};

		case "UPDATE_ORGANIZATION":
			return {
				...state,
				organizations: state.organizations.map((org) =>
					org.id === action.payload.id ? action.payload : org,
				),
				currentOrganization:
					state.currentOrganization?.id === action.payload.id
						? action.payload
						: state.currentOrganization,
			};

		case "DELETE_ORGANIZATION":
			return {
				...state,
				organizations: state.organizations.filter(
					(org) => org.id !== action.payload,
				),
				currentOrganization:
					state.currentOrganization?.id === action.payload
						? null
						: state.currentOrganization,
			};

		case "SET_CURRENT_ORGANIZATION":
			return { ...state, currentOrganization: action.payload };

		case "SET_WORK_ITEMS":
			return { ...state, workItems: action.payload };

		case "SET_TIME_ENTRIES":
			return { ...state, timeEntries: action.payload };

		case "ADD_TIME_ENTRY":
			return {
				...state,
				timeEntries: [action.payload, ...state.timeEntries],
			};

		case "UPDATE_TIME_ENTRY":
			return {
				...state,
				timeEntries: state.timeEntries.map((entry) =>
					entry.id === action.payload.id ? action.payload : entry,
				),
			};

		case "DELETE_TIME_ENTRY":
			return {
				...state,
				timeEntries: state.timeEntries.filter(
					(entry) => entry.id !== action.payload,
				),
			};

		case "START_TIMER":
			return {
				...state,
				timer: {
					isRunning: true,
					isPaused: false,
					startTime: new Date().toISOString(),
					pausedDuration: 0,
					currentWorkItem: action.payload,
					elapsedSeconds: 0,
				},
			};

		case "PAUSE_TIMER":
			return {
				...state,
				timer: {
					...state.timer,
					isPaused: true,
				},
			};

		case "RESUME_TIMER":
			return {
				...state,
				timer: {
					...state.timer,
					isPaused: false,
				},
			};

		case "STOP_TIMER":
			return {
				...state,
				timer: {
					isRunning: false,
					isPaused: false,
					startTime: null,
					pausedDuration: 0,
					currentWorkItem: null,
					elapsedSeconds: 0,
				},
			};

		case "TICK_TIMER":
			if (
				!state.timer.isRunning ||
				state.timer.isPaused ||
				!state.timer.startTime
			) {
				return state;
			}
			const elapsed = Math.floor(
				(Date.now() -
					new Date(state.timer.startTime).getTime() -
					state.timer.pausedDuration) /
					1000,
			);
			return {
				...state,
				timer: {
					...state.timer,
					elapsedSeconds: elapsed,
				},
			};

		case "SET_SETTINGS":
			return {
				...state,
				settings: { ...state.settings, ...action.payload },
			};

		case "SET_LOADING":
			return { ...state, isLoading: action.payload };

		case "SET_ERROR":
			return { ...state, error: action.payload };

		default:
			return state;
	}
}

// Context
interface AppContextType {
	state: AppState;
	dispatch: React.Dispatch<AppAction>;
	// Convenience methods
	startTimer: (workItem: WorkItem) => void;
	pauseTimer: () => void;
	resumeTimer: () => void;
	stopTimer: () => Promise<TimeEntry | null>;
	selectOrganization: (org: AdoOrganization) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(appReducer, initialState);

	// Timer tick effect
	useEffect(() => {
		let interval: number | undefined;

		if (state.timer.isRunning && !state.timer.isPaused) {
			interval = window.setInterval(() => {
				dispatch({ type: "TICK_TIMER" });
			}, 1000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [state.timer.isRunning, state.timer.isPaused]);

	// Load initial data
	useEffect(() => {
		loadInitialData();
	}, []);

	async function loadInitialData() {
		dispatch({ type: "SET_LOADING", payload: true });
		try {
			const organizations = await db.getOrganizations();
			dispatch({ type: "SET_ORGANIZATIONS", payload: organizations });

			const defaultOrg =
				organizations.find((org) => org.isDefault) || organizations[0];
			if (defaultOrg) {
				dispatch({ type: "SET_CURRENT_ORGANIZATION", payload: defaultOrg });
			}

			const entries = await db.getTimeEntries();
			dispatch({ type: "SET_TIME_ENTRIES", payload: entries });

			const settings = await db.getSettings();
			if (settings) {
				dispatch({ type: "SET_SETTINGS", payload: settings });
			}
		} catch (error) {
			console.error("Failed to load initial data:", error);
			dispatch({ type: "SET_ERROR", payload: "Failed to load data" });
		} finally {
			dispatch({ type: "SET_LOADING", payload: false });
		}
	}

	// Timer methods
	function startTimer(workItem: WorkItem) {
		dispatch({ type: "START_TIMER", payload: workItem });
	}

	function pauseTimer() {
		dispatch({ type: "PAUSE_TIMER" });
	}

	function resumeTimer() {
		dispatch({ type: "RESUME_TIMER" });
	}

	async function stopTimer(): Promise<TimeEntry | null> {
		const { timer } = state;
		if (!timer.isRunning || !timer.currentWorkItem || !timer.startTime) {
			return null;
		}

		const endTime = new Date().toISOString();
		const durationMinutes = Math.max(1, Math.round(timer.elapsedSeconds / 60));

		const entry: TimeEntry = {
			id: crypto.randomUUID(),
			workItemId: timer.currentWorkItem.id,
			workItemTitle: timer.currentWorkItem.title,
			workItemType: timer.currentWorkItem.type,
			projectName: timer.currentWorkItem.projectName,
			organizationId: timer.currentWorkItem.organizationId,
			organizationName: state.currentOrganization?.name || "",
			startTime: timer.startTime,
			endTime,
			durationMinutes,
			syncedToAdo: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await db.addTimeEntry(entry);
		dispatch({ type: "ADD_TIME_ENTRY", payload: entry });
		dispatch({ type: "STOP_TIMER" });

		return entry;
	}

	function selectOrganization(org: AdoOrganization) {
		dispatch({ type: "SET_CURRENT_ORGANIZATION", payload: org });
	}

	const contextValue: AppContextType = {
		state,
		dispatch,
		startTimer,
		pauseTimer,
		resumeTimer,
		stopTimer,
		selectOrganization,
	};

	return (
		<AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
	);
}

// Hook
export function useApp() {
	const context = useContext(AppContext);
	if (!context) {
		throw new Error("useApp must be used within AppProvider");
	}
	return context;
}
