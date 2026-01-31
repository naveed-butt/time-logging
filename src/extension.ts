import * as vscode from "vscode";
import { TimerService } from "./services/timerService";
import { StateService } from "./services/stateService";
import { TimerStatusBar } from "./providers/TimerStatusBar";
import { TimeTrackerViewProvider } from "./providers/WebviewProvider";

let timerService: TimerService;
let stateService: StateService;
let statusBar: TimerStatusBar;

export async function activate(context: vscode.ExtensionContext) {
	console.log("Time Tracker extension is now active");

	// Initialize services
	stateService = new StateService(context);
	timerService = new TimerService(stateService);

	// Initialize status bar
	statusBar = new TimerStatusBar(timerService);
	context.subscriptions.push(statusBar);

	// Initialize webview provider
	const webviewProvider = new TimeTrackerViewProvider(
		context.extensionUri,
		timerService,
		stateService,
	);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			"timeTracker.mainView",
			webviewProvider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
			},
		),
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand("timeTracker.startTimer", async () => {
			const workItem = timerService.getCurrentWorkItem();
			if (workItem) {
				timerService.start(workItem);
				vscode.window.showInformationMessage(
					`Timer started for: ${workItem.title}`,
				);
			} else {
				vscode.window.showWarningMessage("Please select a work item first");
			}
		}),

		vscode.commands.registerCommand("timeTracker.stopTimer", async () => {
			const entry = await timerService.stop();
			if (entry) {
				vscode.window.showInformationMessage(
					`Timer stopped. Logged ${Math.round(entry.durationMinutes)} minutes`,
				);
			}
		}),

		vscode.commands.registerCommand("timeTracker.pauseTimer", () => {
			timerService.pause();
		}),

		vscode.commands.registerCommand("timeTracker.resumeTimer", () => {
			timerService.resume();
		}),

		vscode.commands.registerCommand("timeTracker.syncToAdo", async () => {
			try {
				const result = await timerService.syncPendingEntries();
				vscode.window.showInformationMessage(
					`Synced ${result.synced} entries to Azure DevOps`,
				);
			} catch (error) {
				vscode.window.showErrorMessage(
					`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		}),
	);

	// Restore timer state if it was running
	await timerService.restoreState();
}

export function deactivate() {
	if (timerService) {
		timerService.dispose();
	}
}
