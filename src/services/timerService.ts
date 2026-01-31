import * as vscode from "vscode";
import { StateService } from "./stateService";
import { AzureDevOpsService } from "./azureDevOps";
import type { WorkItem, TimeEntry, TimerState, AdoOrganization } from "./types";

/**
 * Timer service that runs in the extension host.
 * Manages timer state and persists entries via StateService.
 */
export class TimerService implements vscode.Disposable {
	private readonly _onDidTick = new vscode.EventEmitter<number>();
	private readonly _onDidChangeState = new vscode.EventEmitter<TimerState>();

	readonly onDidTick = this._onDidTick.event;
	readonly onDidChangeState = this._onDidChangeState.event;

	private _isRunning = false;
	private _isPaused = false;
	private _startTime: Date | null = null;
	private _pausedTime = 0; // Accumulated paused time in ms
	private _pauseStart: Date | null = null;
	private _currentWorkItem: WorkItem | null = null;
	private _interval: ReturnType<typeof setInterval> | null = null;

	private adoService = new AzureDevOpsService();

	constructor(private readonly stateService: StateService) {}

	get isRunning(): boolean {
		return this._isRunning;
	}

	get isPaused(): boolean {
		return this._isPaused;
	}

	get elapsedSeconds(): number {
		if (!this._startTime) {
			return 0;
		}

		let elapsed = Date.now() - this._startTime.getTime() - this._pausedTime;

		if (this._isPaused && this._pauseStart) {
			elapsed -= Date.now() - this._pauseStart.getTime();
		}

		return Math.floor(elapsed / 1000);
	}

	getCurrentWorkItem(): WorkItem | null {
		return this._currentWorkItem;
	}

	setCurrentWorkItem(workItem: WorkItem | null): void {
		this._currentWorkItem = workItem;
		this.emitStateChange();
	}

	getState(): TimerState {
		return {
			isRunning: this._isRunning,
			isPaused: this._isPaused,
			startTime: this._startTime?.toISOString() || null,
			elapsedSeconds: this.elapsedSeconds,
			currentWorkItem: this._currentWorkItem,
		};
	}

	start(workItem: WorkItem): void {
		this._currentWorkItem = workItem;
		this._isRunning = true;
		this._isPaused = false;
		this._startTime = new Date();
		this._pausedTime = 0;
		this._pauseStart = null;

		this.startTicking();
		this.persistState();
		this.emitStateChange();
	}

	pause(): void {
		if (!this._isRunning || this._isPaused) {
			return;
		}

		this._isPaused = true;
		this._pauseStart = new Date();
		this.stopTicking();
		this.persistState();
		this.emitStateChange();
	}

	resume(): void {
		if (!this._isRunning || !this._isPaused || !this._pauseStart) {
			return;
		}

		this._pausedTime += Date.now() - this._pauseStart.getTime();
		this._isPaused = false;
		this._pauseStart = null;
		this.startTicking();
		this.persistState();
		this.emitStateChange();
	}

	async stop(): Promise<TimeEntry | null> {
		if (!this._isRunning || !this._startTime || !this._currentWorkItem) {
			return null;
		}

		// If paused, add final pause time
		if (this._isPaused && this._pauseStart) {
			this._pausedTime += Date.now() - this._pauseStart.getTime();
		}

		const endTime = new Date();
		const durationMs =
			endTime.getTime() - this._startTime.getTime() - this._pausedTime;
		const durationMinutes = Math.round(durationMs / 60000);

		if (durationMinutes < 1) {
			this.reset();
			return null;
		}

		// Get current organization for the entry
		const orgs = await this.stateService.getOrganizations();
		const org = orgs.find(
			(o) => o.id === this._currentWorkItem?.organizationId,
		);

		const entry: TimeEntry = {
			id: crypto.randomUUID(),
			workItemId: this._currentWorkItem.id,
			workItemTitle: this._currentWorkItem.title,
			workItemType: this._currentWorkItem.type,
			projectName: this._currentWorkItem.projectName,
			organizationId: this._currentWorkItem.organizationId,
			organizationName: org?.name || "Unknown",
			startTime: this._startTime.toISOString(),
			endTime: endTime.toISOString(),
			durationMinutes,
			syncedToAdo: false,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		await this.stateService.addTimeEntry(entry);
		this.reset();

		return entry;
	}

	private reset(): void {
		this._isRunning = false;
		this._isPaused = false;
		this._startTime = null;
		this._pausedTime = 0;
		this._pauseStart = null;
		this._currentWorkItem = null;
		this.stopTicking();
		this.persistState();
		this.emitStateChange();
	}

	private startTicking(): void {
		if (this._interval) {
			return;
		}
		this._interval = setInterval(() => {
			this._onDidTick.fire(this.elapsedSeconds);
		}, 1000);
	}

	private stopTicking(): void {
		if (this._interval) {
			clearInterval(this._interval);
			this._interval = null;
		}
	}

	private async persistState(): Promise<void> {
		if (this._isRunning) {
			await this.stateService.saveTimerState({
				isRunning: this._isRunning,
				isPaused: this._isPaused,
				startTime: this._startTime?.toISOString() || null,
				pausedTime: this._pausedTime,
				workItem: this._currentWorkItem,
			});
		} else {
			await this.stateService.saveTimerState(null);
		}
	}

	async restoreState(): Promise<void> {
		const saved = await this.stateService.getTimerState();
		if (!saved || !saved.isRunning || !saved.startTime || !saved.workItem) {
			return;
		}

		this._isRunning = saved.isRunning;
		this._isPaused = saved.isPaused;
		this._startTime = new Date(saved.startTime);
		this._pausedTime = saved.pausedTime;
		this._currentWorkItem = saved.workItem;

		if (this._isPaused) {
			// If paused, set pause start to now (we don't know exactly when)
			this._pauseStart = new Date();
		} else {
			this.startTicking();
		}

		this.emitStateChange();
	}

	private emitStateChange(): void {
		this._onDidChangeState.fire(this.getState());
	}

	// ============ Work Item Search ============

	async searchWorkItems(query: string, orgId: string): Promise<WorkItem[]> {
		const orgs = await this.stateService.getOrganizations();
		const org = orgs.find((o) => o.id === orgId);
		if (!org) {
			return [];
		}
		return this.adoService.searchWorkItems(org, query);
	}

	async getMyWorkItems(orgId: string): Promise<WorkItem[]> {
		const orgs = await this.stateService.getOrganizations();
		const org = orgs.find((o) => o.id === orgId);
		if (!org) {
			return [];
		}
		return this.adoService.getMyWorkItems(org);
	}

	// ============ Sync to ADO ============

	async syncEntry(entryId: string): Promise<boolean> {
		const entries = await this.stateService.getTimeEntries();
		const entry = entries.find((e) => e.id === entryId);
		if (!entry || entry.syncedToAdo) {
			return false;
		}

		const orgs = await this.stateService.getOrganizations();
		const org = orgs.find((o) => o.id === entry.organizationId);
		if (!org) {
			throw new Error("Organization not found");
		}

		await this.adoService.updateCompletedWork(
			org,
			entry.workItemId,
			entry.durationMinutes,
		);

		entry.syncedToAdo = true;
		entry.syncedAt = new Date().toISOString();
		entry.updatedAt = new Date().toISOString();
		await this.stateService.updateTimeEntry(entry);

		return true;
	}

	async syncPendingEntries(): Promise<{ synced: number; failed: number }> {
		const pending = await this.stateService.getPendingEntries();
		let synced = 0;
		let failed = 0;

		for (const entry of pending) {
			try {
				await this.syncEntry(entry.id);
				synced++;
			} catch {
				failed++;
			}
		}

		return { synced, failed };
	}

	dispose(): void {
		this.stopTicking();
		this._onDidTick.dispose();
		this._onDidChangeState.dispose();
	}
}
