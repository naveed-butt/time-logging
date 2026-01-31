import {
	createContext,
	useContext,
	useReducer,
	useEffect,
	ReactNode,
	useCallback,
} from "react";
import type {
	AdoOrganization,
	WorkItem,
	TimeEntry,
	TimerState,
	AppSettings,
} from "../types";

// VS Code API interface
interface VsCodeApi {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Get the VS Code API (only available in webview context)
const vscode =
	typeof acquireVsCodeApi !== "undefined" ? acquireVsCodeApi() : null;

// State shape
interface AppState {
	organizations: AdoOrganization[];
	currentOrganizationId: string | null;
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
	| { type: "SET_FULL_STATE"; payload: Partial<AppState> }
	| { type: "SET_ORGANIZATIONS"; payload: AdoOrganization[] }
	| { type: "SET_CURRENT_ORGANIZATION_ID"; payload: string | null }
	| { type: "SET_WORK_ITEMS"; payload: WorkItem[] }
	| { type: "SET_TIME_ENTRIES"; payload: TimeEntry[] }
	| { type: "SET_TIMER"; payload: TimerState }
	| { type: "TIMER_TICK"; payload: number }
	| { type: "SET_SETTINGS"; payload: Partial<AppSettings> }
	| { type: "SET_LOADING"; payload: boolean }
	| { type: "SET_ERROR"; payload: string | null };

// Initial state
const initialState: AppState = {
	organizations: [],
	currentOrganizationId: null,
	currentOrganization: null,
	workItems: [],
	timeEntries: [],
	timer: {
		isRunning: false,
		isPaused: false,
		startTime: null,
		currentWorkItem: null,
		elapsedSeconds: 0,
	},
	settings: {
		timeRounding: 1,
		defaultView: "timer",
		theme: "system",
	},
	isLoading: true,
	error: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case "SET_FULL_STATE": {
			const newOrgs = action.payload.organizations ?? state.organizations;
			const newOrgId =
				action.payload.currentOrganizationId ?? state.currentOrganizationId;
			return {
				...state,
				...action.payload,
				currentOrganization: newOrgs.find((o) => o.id === newOrgId) ?? null,
				isLoading: false,
			};
		}

		case "SET_ORGANIZATIONS": {
			const currentOrg =
				action.payload.find((o) => o.id === state.currentOrganizationId) ??
				null;
			return {
				...state,
				organizations: action.payload,
				currentOrganization: currentOrg,
			};
		}

		case "SET_CURRENT_ORGANIZATION_ID": {
			const org =
				state.organizations.find((o) => o.id === action.payload) ?? null;
			return {
				...state,
				currentOrganizationId: action.payload,
				currentOrganization: org,
			};
		}

		case "SET_WORK_ITEMS":
			return { ...state, workItems: action.payload };

		case "SET_TIME_ENTRIES":
			return { ...state, timeEntries: action.payload };

		case "SET_TIMER":
			return { ...state, timer: action.payload };

		case "TIMER_TICK":
			return {
				...state,
				timer: { ...state.timer, elapsedSeconds: action.payload },
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
	stopTimer: () => void;
	searchWorkItems: (query: string) => void;
	saveOrganization: (org: AdoOrganization) => void;
	deleteOrganization: (orgId: string) => void;
	setCurrentOrganization: (orgId: string) => void;
	deleteTimeEntry: (entryId: string) => void;
	syncEntry: (entryId: string) => void;
	syncAll: () => void;
	addManualEntry: (
		entry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">,
	) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(appReducer, initialState);

	// Listen for messages from the extension
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			const message = event.data;

			switch (message.type) {
				case "stateUpdate":
					dispatch({ type: "SET_FULL_STATE", payload: message.state });
					break;
				case "timerTick":
					dispatch({ type: "TIMER_TICK", payload: message.elapsed });
					break;
				case "workItemsLoaded":
					dispatch({ type: "SET_WORK_ITEMS", payload: message.items });
					break;
				case "error":
					dispatch({ type: "SET_ERROR", payload: message.message });
					break;
			}
		}

		window.addEventListener("message", handleMessage);

		// Request initial state
		vscode?.postMessage({ type: "ready" });

		return () => window.removeEventListener("message", handleMessage);
	}, []);

	// Post message helper
	const postMessage = useCallback((message: unknown) => {
		vscode?.postMessage(message);
	}, []);

	// Timer methods
	const startTimer = useCallback(
		(workItem: WorkItem) => {
			postMessage({ type: "startTimer", workItem });
		},
		[postMessage],
	);

	const pauseTimer = useCallback(() => {
		postMessage({ type: "pauseTimer" });
	}, [postMessage]);

	const resumeTimer = useCallback(() => {
		postMessage({ type: "resumeTimer" });
	}, [postMessage]);

	const stopTimer = useCallback(() => {
		postMessage({ type: "stopTimer" });
	}, [postMessage]);

	// Work items
	const searchWorkItems = useCallback(
		(query: string) => {
			if (state.currentOrganizationId) {
				postMessage({
					type: "searchWorkItems",
					query,
					orgId: state.currentOrganizationId,
				});
			}
		},
		[postMessage, state.currentOrganizationId],
	);

	// Organizations
	const saveOrganization = useCallback(
		(org: AdoOrganization) => {
			postMessage({ type: "saveOrganization", org });
		},
		[postMessage],
	);

	const deleteOrganization = useCallback(
		(orgId: string) => {
			postMessage({ type: "deleteOrganization", orgId });
		},
		[postMessage],
	);

	const setCurrentOrganization = useCallback(
		(orgId: string) => {
			postMessage({ type: "setCurrentOrganization", orgId });
		},
		[postMessage],
	);

	// Time entries
	const deleteTimeEntry = useCallback(
		(entryId: string) => {
			postMessage({ type: "deleteTimeEntry", entryId });
		},
		[postMessage],
	);

	const syncEntry = useCallback(
		(entryId: string) => {
			postMessage({ type: "syncEntry", entryId });
		},
		[postMessage],
	);

	const syncAll = useCallback(() => {
		postMessage({ type: "syncAll" });
	}, [postMessage]);

	const addManualEntry = useCallback(
		(entry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">) => {
			postMessage({ type: "addManualEntry", entry });
		},
		[postMessage],
	);

	const contextValue: AppContextType = {
		state,
		dispatch,
		startTimer,
		pauseTimer,
		resumeTimer,
		stopTimer,
		searchWorkItems,
		saveOrganization,
		deleteOrganization,
		setCurrentOrganization,
		deleteTimeEntry,
		syncEntry,
		syncAll,
		addManualEntry,
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
