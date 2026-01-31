/**
 * Shared types for the Time Tracker extension.
 * These are used by both the extension host and will be shared with the webview.
 */

export interface AdoOrganization {
	id: string;
	name: string;
	url: string;
	projectName: string;
	patToken: string;
	isDefault?: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface WorkItem {
	id: number;
	title: string;
	type: string;
	state: string;
	projectName: string;
	organizationId: string;
	assignedTo?: string;
	url: string;
}

export interface TimeEntry {
	id: string;
	workItemId: number;
	workItemTitle: string;
	workItemType: string;
	projectName: string;
	organizationId: string;
	organizationName: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	description?: string;
	syncedToAdo: boolean;
	syncedAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface TimerState {
	isRunning: boolean;
	isPaused: boolean;
	startTime: string | null;
	elapsedSeconds: number;
	currentWorkItem: WorkItem | null;
}

export interface AppSettings {
	timeRounding: 1 | 5 | 15 | 30;
	defaultView: "timer" | "entries" | "reports";
	theme: "light" | "dark" | "system";
}

export interface SyncLog {
	id: string;
	entryId: string;
	workItemId: number;
	status: "success" | "failed";
	errorMessage?: string;
	syncedAt: string;
}

export interface DailySummary {
	date: string;
	totalMinutes: number;
	entries: TimeEntry[];
}

// Message types for webview communication
export type ExtensionMessage =
	| { type: "stateUpdate"; state: AppState }
	| { type: "timerTick"; elapsed: number }
	| { type: "workItemsLoaded"; items: WorkItem[] }
	| { type: "error"; message: string };

export type WebviewMessage =
	| { type: "ready" }
	| { type: "startTimer"; workItem: WorkItem }
	| { type: "stopTimer" }
	| { type: "pauseTimer" }
	| { type: "resumeTimer" }
	| { type: "searchWorkItems"; query: string; orgId: string }
	| { type: "saveOrganization"; org: AdoOrganization }
	| { type: "deleteOrganization"; orgId: string }
	| { type: "setCurrentOrganization"; orgId: string }
	| { type: "deleteTimeEntry"; entryId: string }
	| { type: "syncEntry"; entryId: string }
	| { type: "syncAll" }
	| {
			type: "addManualEntry";
			entry: Omit<TimeEntry, "id" | "createdAt" | "updatedAt">;
	  }
	| { type: "getState" };

export interface AppState {
	organizations: AdoOrganization[];
	currentOrganizationId: string | null;
	timeEntries: TimeEntry[];
	timer: TimerState;
	settings: AppSettings;
	workItems: WorkItem[];
}
