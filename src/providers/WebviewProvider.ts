import * as vscode from "vscode";
import { TimerService } from "../services/timerService";
import { StateService } from "../services/stateService";
import type { WebviewMessage, AppState, TimeEntry } from "../services/types";

/**
 * Webview provider for the Time Tracker sidebar panel.
 * Hosts the React application and handles message passing.
 */
export class TimeTrackerViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = "timeTracker.mainView";

	private view?: vscode.WebviewView;
	private readonly disposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly timerService: TimerService,
		private readonly stateService: StateService,
	) {
		// Subscribe to timer updates
		this.disposables.push(
			timerService.onDidTick((elapsed) => {
				this.postMessage({ type: "timerTick", elapsed });
			}),
			timerService.onDidChangeState(() => {
				this.sendFullState();
			}),
		);
	}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	): void {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, "out", "webview"),
			],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

		// Handle messages from the webview
		this.disposables.push(
			webviewView.webview.onDidReceiveMessage((message: WebviewMessage) =>
				this.handleMessage(message),
			),
		);

		// Re-send state when view becomes visible
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				this.sendFullState();
			}
		});
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case "ready":
			case "getState":
				await this.sendFullState();
				break;

			case "startTimer":
				this.timerService.setCurrentWorkItem(message.workItem);
				this.timerService.start(message.workItem);
				break;

			case "stopTimer":
				await this.timerService.stop();
				await this.sendFullState();
				break;

			case "pauseTimer":
				this.timerService.pause();
				break;

			case "resumeTimer":
				this.timerService.resume();
				break;

			case "searchWorkItems":
				try {
					const items = await this.timerService.searchWorkItems(
						message.query,
						message.orgId,
					);
					this.postMessage({ type: "workItemsLoaded", items });
				} catch (error) {
					this.postMessage({
						type: "error",
						message: error instanceof Error ? error.message : "Search failed",
					});
				}
				break;

			case "saveOrganization":
				await this.stateService.saveOrganization(message.org);
				await this.sendFullState();
				break;

			case "deleteOrganization":
				await this.stateService.deleteOrganization(message.orgId);
				await this.sendFullState();
				break;

			case "setCurrentOrganization":
				await this.stateService.setCurrentOrganizationId(message.orgId);
				// Load work items for the new org
				try {
					const items = await this.timerService.getMyWorkItems(message.orgId);
					this.postMessage({ type: "workItemsLoaded", items });
				} catch {
					// Ignore errors
				}
				await this.sendFullState();
				break;

			case "deleteTimeEntry":
				await this.stateService.deleteTimeEntry(message.entryId);
				await this.sendFullState();
				break;

			case "syncEntry":
				try {
					await this.timerService.syncEntry(message.entryId);
					await this.sendFullState();
				} catch (error) {
					this.postMessage({
						type: "error",
						message: error instanceof Error ? error.message : "Sync failed",
					});
				}
				break;

			case "syncAll":
				try {
					await this.timerService.syncPendingEntries();
					await this.sendFullState();
				} catch (error) {
					this.postMessage({
						type: "error",
						message: error instanceof Error ? error.message : "Sync failed",
					});
				}
				break;

			case "addManualEntry":
				const entry: TimeEntry = {
					...message.entry,
					id: crypto.randomUUID(),
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				await this.stateService.addTimeEntry(entry);
				await this.sendFullState();
				break;
		}
	}

	private async sendFullState(): Promise<void> {
		const [organizations, timeEntries, settings, currentOrgId] =
			await Promise.all([
				this.stateService.getOrganizations(),
				this.stateService.getTimeEntries(),
				this.stateService.getSettings(),
				this.stateService.getCurrentOrganizationId(),
			]);

		const state: AppState = {
			organizations,
			currentOrganizationId: currentOrgId || null,
			timeEntries,
			timer: this.timerService.getState(),
			settings,
			workItems: [],
		};

		this.postMessage({ type: "stateUpdate", state });
	}

	private postMessage(message: { type: string; [key: string]: unknown }): void {
		this.view?.webview.postMessage(message);
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, "out", "webview", "index.js"),
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, "out", "webview", "index.css"),
		);

		const nonce = this.getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src https://*.visualstudio.com https://dev.azure.com;">
	<link href="${styleUri}" rel="stylesheet">
	<title>Time Tracker</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}

	private getNonce(): string {
		let text = "";
		const possible =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	}

	dispose(): void {
		this.disposables.forEach((d) => d.dispose());
	}
}
