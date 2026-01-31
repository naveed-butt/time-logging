/**
 * Local database service using browser storage
 * Will be replaced with SQLite via Tauri plugin in production
 */

import type {
	AdoOrganization,
	TimeEntry,
	AppSettings,
	SyncLog,
} from "../types";

const STORAGE_KEYS = {
	organizations: "timetracker_organizations",
	timeEntries: "timetracker_entries",
	settings: "timetracker_settings",
	syncLog: "timetracker_synclog",
};

class Database {
	// Organizations
	async getOrganizations(): Promise<AdoOrganization[]> {
		const data = localStorage.getItem(STORAGE_KEYS.organizations);
		return data ? JSON.parse(data) : [];
	}

	async saveOrganization(org: AdoOrganization): Promise<void> {
		const orgs = await this.getOrganizations();
		const existingIndex = orgs.findIndex((o) => o.id === org.id);

		if (existingIndex >= 0) {
			orgs[existingIndex] = org;
		} else {
			// If this is the first org or marked as default, update others
			if (org.isDefault || orgs.length === 0) {
				orgs.forEach((o) => (o.isDefault = false));
				org.isDefault = true;
			}
			orgs.push(org);
		}

		localStorage.setItem(STORAGE_KEYS.organizations, JSON.stringify(orgs));
	}

	async deleteOrganization(id: string): Promise<void> {
		const orgs = await this.getOrganizations();
		const filtered = orgs.filter((o) => o.id !== id);

		// If we deleted the default, make the first one default
		if (filtered.length > 0 && !filtered.some((o) => o.isDefault)) {
			filtered[0].isDefault = true;
		}

		localStorage.setItem(STORAGE_KEYS.organizations, JSON.stringify(filtered));
	}

	// Time Entries
	async getTimeEntries(limit?: number): Promise<TimeEntry[]> {
		const data = localStorage.getItem(STORAGE_KEYS.timeEntries);
		const entries: TimeEntry[] = data ? JSON.parse(data) : [];

		// Sort by created date descending
		entries.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		return limit ? entries.slice(0, limit) : entries;
	}

	async getTimeEntriesByDateRange(
		startDate: string,
		endDate: string,
	): Promise<TimeEntry[]> {
		const entries = await this.getTimeEntries();
		return entries.filter((entry) => {
			const entryDate = entry.startTime.split("T")[0];
			return entryDate >= startDate && entryDate <= endDate;
		});
	}

	async getUnsyncedEntries(): Promise<TimeEntry[]> {
		const entries = await this.getTimeEntries();
		return entries.filter((entry) => !entry.syncedToAdo);
	}

	async addTimeEntry(entry: TimeEntry): Promise<void> {
		const entries = await this.getTimeEntries();
		entries.unshift(entry);
		localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(entries));
	}

	async updateTimeEntry(entry: TimeEntry): Promise<void> {
		const entries = await this.getTimeEntries();
		const index = entries.findIndex((e) => e.id === entry.id);

		if (index >= 0) {
			entries[index] = { ...entry, updatedAt: new Date().toISOString() };
			localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(entries));
		}
	}

	async deleteTimeEntry(id: string): Promise<void> {
		const entries = await this.getTimeEntries();
		const filtered = entries.filter((e) => e.id !== id);
		localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(filtered));
	}

	async markEntriesSynced(ids: string[]): Promise<void> {
		const entries = await this.getTimeEntries();
		const now = new Date().toISOString();

		entries.forEach((entry) => {
			if (ids.includes(entry.id)) {
				entry.syncedToAdo = true;
				entry.syncedAt = now;
				entry.updatedAt = now;
			}
		});

		localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(entries));
	}

	// Settings
	async getSettings(): Promise<AppSettings | null> {
		const data = localStorage.getItem(STORAGE_KEYS.settings);
		return data ? JSON.parse(data) : null;
	}

	async saveSettings(settings: AppSettings): Promise<void> {
		localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
	}

	// Sync Log
	async getSyncLog(limit = 50): Promise<SyncLog[]> {
		const data = localStorage.getItem(STORAGE_KEYS.syncLog);
		const logs: SyncLog[] = data ? JSON.parse(data) : [];
		return logs.slice(0, limit);
	}

	async addSyncLog(log: SyncLog): Promise<void> {
		const logs = await this.getSyncLog(100);
		logs.unshift(log);

		// Keep only last 100 entries
		const trimmed = logs.slice(0, 100);
		localStorage.setItem(STORAGE_KEYS.syncLog, JSON.stringify(trimmed));
	}

	// Clear all data
	async clearAll(): Promise<void> {
		Object.values(STORAGE_KEYS).forEach((key) => {
			localStorage.removeItem(key);
		});
	}
}

export const db = new Database();
