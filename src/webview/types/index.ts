/**
 * Shared types for the Time Tracker VS Code extension webview.
 */

// Azure DevOps Organization configuration
export interface AdoOrganization {
	id: string;
	name: string;
	url: string; // e.g., https://dev.azure.com/myorg
	projectName: string;
	patToken: string; // Stored securely in extension
	isDefault?: boolean;
	createdAt: string;
	updatedAt: string;
}

// Work item from Azure DevOps
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

// Time entry logged locally
export interface TimeEntry {
	id: string;
	workItemId: number;
	workItemTitle: string;
	workItemType: string;
	projectName: string;
	organizationId: string;
	organizationName: string;
	startTime: string; // ISO date string
	endTime: string; // ISO date string
	durationMinutes: number;
	description?: string;
	syncedToAdo: boolean;
	syncedAt?: string;
	createdAt: string;
	updatedAt: string;
}

// Timer state
export interface TimerState {
	isRunning: boolean;
	isPaused: boolean;
	startTime: string | null;
	currentWorkItem: WorkItem | null;
	elapsedSeconds: number;
}

// App settings
export interface AppSettings {
	timeRounding: 1 | 5 | 15 | 30;
	defaultView: "timer" | "entries" | "reports";
	theme: "light" | "dark" | "system";
}

// Report summary
export interface DailySummary {
	date: string;
	totalMinutes: number;
	entries: TimeEntry[];
	byProject: Record<string, number>;
	byWorkItem: Record<number, { title: string; type: string; minutes: number }>;
}

// View types
export type ViewType = "timer" | "entries" | "reports" | "settings";
