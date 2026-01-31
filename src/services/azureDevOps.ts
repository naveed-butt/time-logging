/**
 * Azure DevOps REST API Service
 * Handles all interactions with ADO for work items and time tracking
 */

import type {
	AdoOrganization,
	WorkItem,
	AdoWorkItemQueryResult,
	AdoWorkItemDetails,
} from "../types";

class AzureDevOpsService {
	private getHeaders(patToken: string): HeadersInit {
		const encodedPat = btoa(`:${patToken}`);
		return {
			"Content-Type": "application/json",
			Authorization: `Basic ${encodedPat}`,
		};
	}

	private getApiUrl(org: AdoOrganization, path: string): string {
		// Ensure URL doesn't have trailing slash
		const baseUrl = org.url.replace(/\/$/, "");
		return `${baseUrl}/${org.project}/_apis/${path}`;
	}

	/**
	 * Test connection to Azure DevOps
	 */
	async testConnection(
		org: AdoOrganization,
	): Promise<{ success: boolean; message: string }> {
		try {
			const url = `${org.url.replace(/\/$/, "")}/_apis/projects?api-version=7.1`;
			const response = await fetch(url, {
				headers: this.getHeaders(org.patToken),
			});

			if (response.ok) {
				return { success: true, message: "Connection successful!" };
			} else if (response.status === 401) {
				return {
					success: false,
					message: "Authentication failed. Check your PAT token.",
				};
			} else if (response.status === 404) {
				return {
					success: false,
					message: "Organization not found. Check the URL.",
				};
			} else {
				return {
					success: false,
					message: `Connection failed: ${response.statusText}`,
				};
			}
		} catch (error) {
			return {
				success: false,
				message: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	}

	/**
	 * Fetch work items assigned to current user
	 */
	async getMyWorkItems(org: AdoOrganization): Promise<WorkItem[]> {
		const wiqlQuery = {
			query: `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State]
        FROM WorkItems
        WHERE [System.AssignedTo] = @Me
          AND [System.State] NOT IN ('Closed', 'Resolved', 'Done', 'Removed')
          AND [System.WorkItemType] IN ('Task', 'Bug', 'User Story', 'Feature', 'Product Backlog Item')
        ORDER BY [System.ChangedDate] DESC
      `,
		};

		const url = this.getApiUrl(org, "wit/wiql?api-version=7.1");

		const response = await fetch(url, {
			method: "POST",
			headers: this.getHeaders(org.patToken),
			body: JSON.stringify(wiqlQuery),
		});

		if (!response.ok) {
			throw new Error(`Failed to query work items: ${response.statusText}`);
		}

		const result: AdoWorkItemQueryResult = await response.json();

		if (!result.workItems || result.workItems.length === 0) {
			return [];
		}

		// Get details for each work item (batch up to 200)
		const ids = result.workItems.slice(0, 200).map((wi) => wi.id);
		return this.getWorkItemDetails(org, ids);
	}

	/**
	 * Get detailed information for specific work items
	 */
	async getWorkItemDetails(
		org: AdoOrganization,
		ids: number[],
	): Promise<WorkItem[]> {
		if (ids.length === 0) return [];

		const fields = [
			"System.Id",
			"System.Title",
			"System.WorkItemType",
			"System.State",
			"System.AssignedTo",
			"System.AreaPath",
			"System.IterationPath",
			"Microsoft.VSTS.Scheduling.CompletedWork",
			"Microsoft.VSTS.Scheduling.RemainingWork",
			"Microsoft.VSTS.Scheduling.OriginalEstimate",
		].join(",");

		const url = this.getApiUrl(
			org,
			`wit/workitems?ids=${ids.join(",")}&fields=${fields}&api-version=7.1`,
		);

		const response = await fetch(url, {
			headers: this.getHeaders(org.patToken),
		});

		if (!response.ok) {
			throw new Error(
				`Failed to get work item details: ${response.statusText}`,
			);
		}

		const result: { value: AdoWorkItemDetails[] } = await response.json();

		return result.value.map((wi) => this.mapWorkItem(wi, org));
	}

	/**
	 * Search work items by text or ID
	 */
	async searchWorkItems(
		org: AdoOrganization,
		searchText: string,
	): Promise<WorkItem[]> {
		// Check if search text is a numeric ID
		const numericId = parseInt(searchText.replace(/^#/, ""), 10);
		const isIdSearch = !isNaN(numericId) && numericId > 0;

		if (isIdSearch) {
			// Direct ID lookup
			try {
				const item = await this.getWorkItem(org, numericId);
				return item ? [item] : [];
			} catch {
				return [];
			}
		}

		// Text-based search
		const wiqlQuery = {
			query: `
        SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State]
        FROM WorkItems
        WHERE [System.Title] CONTAINS '${searchText.replace(/'/g, "''")}'
          AND [System.State] NOT IN ('Closed', 'Resolved', 'Done', 'Removed')
          AND [System.WorkItemType] IN ('Task', 'Bug', 'User Story', 'Feature', 'Product Backlog Item')
        ORDER BY [System.ChangedDate] DESC
      `,
		};

		const url = this.getApiUrl(org, "wit/wiql?api-version=7.1");

		const response = await fetch(url, {
			method: "POST",
			headers: this.getHeaders(org.patToken),
			body: JSON.stringify(wiqlQuery),
		});

		if (!response.ok) {
			throw new Error(`Failed to search work items: ${response.statusText}`);
		}

		const result: AdoWorkItemQueryResult = await response.json();

		if (!result.workItems || result.workItems.length === 0) {
			return [];
		}

		const ids = result.workItems.slice(0, 50).map((wi) => wi.id);
		return this.getWorkItemDetails(org, ids);
	}

	/**
	 * Get a single work item by ID
	 */
	async getWorkItem(
		org: AdoOrganization,
		id: number,
	): Promise<WorkItem | null> {
		const items = await this.getWorkItemDetails(org, [id]);
		return items[0] || null;
	}

	/**
	 * Update completed work on a work item
	 * Adds the specified hours to the existing CompletedWork value
	 */
	async updateCompletedWork(
		org: AdoOrganization,
		workItemId: number,
		additionalHours: number,
	): Promise<{ success: boolean; newTotal: number; error?: string }> {
		try {
			// First get current completed work
			const currentItem = await this.getWorkItem(org, workItemId);
			if (!currentItem) {
				return { success: false, newTotal: 0, error: "Work item not found" };
			}

			const currentCompleted = currentItem.completedWork || 0;
			const newTotal = currentCompleted + additionalHours;

			// Update the work item
			const patchDocument = [
				{
					op: "add",
					path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
					value: newTotal,
				},
			];

			const url = this.getApiUrl(
				org,
				`wit/workitems/${workItemId}?api-version=7.1`,
			);

			const response = await fetch(url, {
				method: "PATCH",
				headers: {
					...this.getHeaders(org.patToken),
					"Content-Type": "application/json-patch+json",
				},
				body: JSON.stringify(patchDocument),
			});

			if (!response.ok) {
				const errorText = await response.text();
				return {
					success: false,
					newTotal: currentCompleted,
					error: `Failed to update: ${errorText}`,
				};
			}

			return { success: true, newTotal };
		} catch (error) {
			return {
				success: false,
				newTotal: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * Map ADO API response to our WorkItem type
	 */
	private mapWorkItem(wi: AdoWorkItemDetails, org: AdoOrganization): WorkItem {
		return {
			id: wi.id,
			title: wi.fields["System.Title"],
			type: wi.fields["System.WorkItemType"],
			state: wi.fields["System.State"],
			assignedTo: wi.fields["System.AssignedTo"]?.displayName,
			projectName: org.project,
			organizationId: org.id,
			completedWork: wi.fields["Microsoft.VSTS.Scheduling.CompletedWork"],
			remainingWork: wi.fields["Microsoft.VSTS.Scheduling.RemainingWork"],
			originalEstimate: wi.fields["Microsoft.VSTS.Scheduling.OriginalEstimate"],
			areaPath: wi.fields["System.AreaPath"],
			iterationPath: wi.fields["System.IterationPath"],
			url: wi._links?.html?.href || wi.url,
		};
	}
}

export const adoService = new AzureDevOpsService();
