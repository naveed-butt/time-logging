// Azure DevOps Organization configuration
export interface AdoOrganization {
	id: string;
	name: string;
	url: string; // e.g., https://dev.azure.com/myorg
	project: string;
	patToken: string; // Stored securely
	isDefault: boolean;
}

// Work item from Azure DevOps
export interface WorkItem {
	id: number;
	title: string;
	type: "Task" | "Bug" | "User Story" | "Feature" | "Epic" | string;
	state: string;
	assignedTo?: string;
	projectName: string;
	organizationId: string;
	completedWork?: number; // Hours already logged
	remainingWork?: number;
	originalEstimate?: number;
	parentId?: number;
	parentTitle?: string;
	areaPath?: string;
	iterationPath?: string;
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
	endTime?: string; // ISO date string, null if still running
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
	pausedDuration: number; // Total paused time in ms
	currentWorkItem: WorkItem | null;
	elapsedSeconds: number;
}

// Sync log entry
export interface SyncLog {
	id: string;
	workItemId: number;
	workItemTitle: string;
	organizationId: string;
	hoursSynced: number;
	syncedAt: string;
	status: "success" | "failed";
	errorMessage?: string;
}

// App settings
export interface AppSettings {
	minimizeToTray: boolean;
	startWithWindows: boolean;
	defaultOrganizationId: string | null;
	timeRoundingMinutes: number; // 1, 5, 15, 30
	reminderIntervalMinutes: number; // 0 = disabled
	theme: "light" | "dark" | "system";
}

// Report summary
export interface DailySummary {
	date: string;
	totalMinutes: number;
	entries: TimeEntry[];
	byProject: Record<string, number>;
	byWorkItem: Record<number, { title: string; minutes: number }>;
}

// API response types
export interface AdoWorkItemQueryResult {
	workItems: { id: number; url: string }[];
}

export interface AdoWorkItemDetails {
	id: number;
	rev: number;
	fields: {
		"System.Title": string;
		"System.WorkItemType": string;
		"System.State": string;
		"System.AssignedTo"?: { displayName: string };
		"System.AreaPath"?: string;
		"System.IterationPath"?: string;
		"Microsoft.VSTS.Scheduling.CompletedWork"?: number;
		"Microsoft.VSTS.Scheduling.RemainingWork"?: number;
		"Microsoft.VSTS.Scheduling.OriginalEstimate"?: number;
	};
	url: string;
	_links: {
		html: { href: string };
	};
}

// View types
export type ViewType = "timer" | "entries" | "reports" | "settings";
