import * as vscode from "vscode";
import type {
	AdoOrganization,
	TimeEntry,
	AppSettings,
	WorkItem,
} from "./types";

// Re-export types for convenience
export type { AdoOrganization, TimeEntry, AppSettings, WorkItem };

/**
 * Service for managing extension state using VS Code's storage APIs.
 * - Secrets API for PAT tokens
 * - GlobalState for organizations, time entries, settings
 */
export class StateService {
	private static readonly ORGS_KEY = "ado-organizations";
	private static readonly ENTRIES_KEY = "time-entries";
	private static readonly SETTINGS_KEY = "app-settings";
	private static readonly CURRENT_ORG_KEY = "current-org-id";
	private static readonly TIMER_STATE_KEY = "timer-state";

	constructor(private readonly context: vscode.ExtensionContext) {}

	// ============ Organizations ============

	async getOrganizations(): Promise<AdoOrganization[]> {
		const orgs = this.context.globalState.get<
			Omit<AdoOrganization, "patToken">[]
		>(StateService.ORGS_KEY, []);

		// Restore PAT tokens from secrets
		const orgsWithTokens: AdoOrganization[] = [];
		for (const org of orgs) {
			const patToken = await this.context.secrets.get(`pat-${org.id}`);
			orgsWithTokens.push({
				...org,
				patToken: patToken || "",
			});
		}
		return orgsWithTokens;
	}

	async saveOrganization(org: AdoOrganization): Promise<void> {
		const orgs = await this.getOrganizations();
		const existingIndex = orgs.findIndex((o) => o.id === org.id);

		if (existingIndex >= 0) {
			orgs[existingIndex] = org;
		} else {
			orgs.push(org);
		}

		// Store PAT token in secrets
		await this.context.secrets.store(`pat-${org.id}`, org.patToken);

		// Store orgs without PAT tokens in globalState
		const orgsWithoutTokens = orgs.map(({ patToken, ...rest }) => rest);
		await this.context.globalState.update(
			StateService.ORGS_KEY,
			orgsWithoutTokens,
		);
	}

	async deleteOrganization(orgId: string): Promise<void> {
		const orgs = await this.getOrganizations();
		const filtered = orgs.filter((o) => o.id !== orgId);

		// Remove PAT token
		await this.context.secrets.delete(`pat-${orgId}`);

		const orgsWithoutTokens = filtered.map(({ patToken, ...rest }) => rest);
		await this.context.globalState.update(
			StateService.ORGS_KEY,
			orgsWithoutTokens,
		);
	}

	async getCurrentOrganizationId(): Promise<string | undefined> {
		return this.context.globalState.get<string>(StateService.CURRENT_ORG_KEY);
	}

	async setCurrentOrganizationId(orgId: string): Promise<void> {
		await this.context.globalState.update(StateService.CURRENT_ORG_KEY, orgId);
	}

	// ============ Time Entries ============

	async getTimeEntries(): Promise<TimeEntry[]> {
		return this.context.globalState.get<TimeEntry[]>(
			StateService.ENTRIES_KEY,
			[],
		);
	}

	async addTimeEntry(entry: TimeEntry): Promise<void> {
		const entries = await this.getTimeEntries();
		entries.push(entry);
		await this.context.globalState.update(StateService.ENTRIES_KEY, entries);
	}

	async updateTimeEntry(entry: TimeEntry): Promise<void> {
		const entries = await this.getTimeEntries();
		const index = entries.findIndex((e) => e.id === entry.id);
		if (index >= 0) {
			entries[index] = entry;
			await this.context.globalState.update(StateService.ENTRIES_KEY, entries);
		}
	}

	async deleteTimeEntry(entryId: string): Promise<void> {
		const entries = await this.getTimeEntries();
		const filtered = entries.filter((e) => e.id !== entryId);
		await this.context.globalState.update(StateService.ENTRIES_KEY, filtered);
	}

	async getPendingEntries(): Promise<TimeEntry[]> {
		const entries = await this.getTimeEntries();
		return entries.filter((e) => !e.syncedToAdo);
	}

	// ============ Settings ============

	async getSettings(): Promise<AppSettings> {
		return this.context.globalState.get<AppSettings>(
			StateService.SETTINGS_KEY,
			{
				timeRounding: 1,
				defaultView: "timer",
				theme: "system",
			},
		);
	}

	async saveSettings(settings: AppSettings): Promise<void> {
		await this.context.globalState.update(StateService.SETTINGS_KEY, settings);
	}

	// ============ Timer State (for restore on reload) ============

	async getTimerState(): Promise<{
		isRunning: boolean;
		isPaused: boolean;
		startTime: string | null;
		pausedTime: number;
		workItem: WorkItem | null;
	} | null> {
		return this.context.globalState.get(StateService.TIMER_STATE_KEY, null);
	}

	async saveTimerState(
		state: {
			isRunning: boolean;
			isPaused: boolean;
			startTime: string | null;
			pausedTime: number;
			workItem: WorkItem | null;
		} | null,
	): Promise<void> {
		await this.context.globalState.update(StateService.TIMER_STATE_KEY, state);
	}
}
