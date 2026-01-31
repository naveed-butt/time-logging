import * as vscode from "vscode";
import { TimerService } from "../services/timerService";

/**
 * Status bar item that displays the current timer state.
 * Shows elapsed time and current work item when running.
 */
export class TimerStatusBar implements vscode.Disposable {
	private readonly statusBarItem: vscode.StatusBarItem;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(private readonly timerService: TimerService) {
		this.statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Right,
			100,
		);

		this.statusBarItem.command = "timeTracker.stopTimer";
		this.update();
		this.statusBarItem.show();

		// Subscribe to timer events
		this.disposables.push(
			timerService.onDidTick(() => this.update()),
			timerService.onDidChangeState(() => this.update()),
		);
	}

	private update(): void {
		const state = this.timerService.getState();

		if (!state.isRunning) {
			this.statusBarItem.text = "$(clock) Time Tracker";
			this.statusBarItem.tooltip = "Click to open Time Tracker";
			this.statusBarItem.command = undefined; // Will fall through to view focus
			this.statusBarItem.backgroundColor = undefined;
			return;
		}

		const elapsed = this.formatTime(state.elapsedSeconds);
		const workItemTitle = state.currentWorkItem?.title || "Unknown";
		const truncatedTitle =
			workItemTitle.length > 30
				? workItemTitle.substring(0, 27) + "..."
				: workItemTitle;

		if (state.isPaused) {
			this.statusBarItem.text = `$(debug-pause) ${elapsed} - ${truncatedTitle}`;
			this.statusBarItem.tooltip = `Paused - ${workItemTitle}\nClick to stop timer`;
			this.statusBarItem.backgroundColor = new vscode.ThemeColor(
				"statusBarItem.warningBackground",
			);
		} else {
			this.statusBarItem.text = `$(clock) ${elapsed} - ${truncatedTitle}`;
			this.statusBarItem.tooltip = `Tracking: ${workItemTitle}\nClick to stop timer`;
			this.statusBarItem.backgroundColor = undefined;
		}

		this.statusBarItem.command = "timeTracker.stopTimer";
	}

	private formatTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		return [hours, minutes, secs]
			.map((v) => v.toString().padStart(2, "0"))
			.join(":");
	}

	dispose(): void {
		this.statusBarItem.dispose();
		this.disposables.forEach((d) => d.dispose());
	}
}
