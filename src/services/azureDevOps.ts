import type { AdoOrganization, WorkItem } from "./types";

interface AdoWorkItemQueryResult {
	workItems: Array<{ id: number; url: string }>;
}

interface AdoWorkItemResponse {
	id: number;
	fields: {
		"System.Title": string;
		"System.WorkItemType": string;
		"System.State": string;
		"System.AssignedTo"?: { displayName: string };
		"Microsoft.VSTS.Scheduling.CompletedWork"?: number;
	};
	_links: {
		html: { href: string };
	};
}

/**
 * Azure DevOps REST API service.
 * Handles work item queries, search, and updates.
 */
export class AzureDevOpsService {
	private getHeaders(patToken: string): Record<string, string> {
		const auth = Buffer.from(`:${patToken}`).toString("base64");
		return {
			Authorization: `Basic ${auth}`,
			"Content-Type": "application/json",
		};
	}

	private getApiUrl(org: AdoOrganization, path: string): string {
		const baseUrl = org.url.endsWith("/") ? org.url.slice(0, -1) : org.url;
		return `${baseUrl}/${org.projectName}/_apis/${path}`;
	}

	/**
	 * Get work items assigned to the current user
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
			throw new Error(`Failed to fetch work items: ${response.statusText}`);
		}

		const result = (await response.json()) as AdoWorkItemQueryResult;

		if (!result.workItems || result.workItems.length === 0) {
			return [];
		}

		const ids = result.workItems.slice(0, 50).map((wi) => wi.id);
		return this.getWorkItemDetails(org, ids);
	}

	/**
	 * Get details for specific work item IDs
	 */
	async getWorkItemDetails(
		org: AdoOrganization,
		ids: number[],
	): Promise<WorkItem[]> {
		if (ids.length === 0) {
			return [];
		}

		const fields = [
			"System.Id",
			"System.Title",
			"System.WorkItemType",
			"System.State",
			"System.AssignedTo",
		].join(",");

		const baseUrl = org.url.endsWith("/") ? org.url.slice(0, -1) : org.url;
		const url = `${baseUrl}/_apis/wit/workitems?ids=${ids.join(",")}&fields=${fields}&api-version=7.1`;

		const response = await fetch(url, {
			method: "GET",
			headers: this.getHeaders(org.patToken),
		});

		if (!response.ok) {
			throw new Error(
				`Failed to fetch work item details: ${response.statusText}`,
			);
		}

		const result = (await response.json()) as { value: AdoWorkItemResponse[] };

		return result.value.map((wi) => ({
			id: wi.id,
			title: wi.fields["System.Title"],
			type: wi.fields["System.WorkItemType"],
			state: wi.fields["System.State"],
			projectName: org.projectName,
			organizationId: org.id,
			assignedTo: wi.fields["System.AssignedTo"]?.displayName,
			url: wi._links.html.href,
		}));
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

		const result = (await response.json()) as AdoWorkItemQueryResult;

		if (!result.workItems || result.workItems.length === 0) {
			return [];
		}

		const ids = result.workItems.slice(0, 50).map((wi) => wi.id);
		return this.getWorkItemDetails(org, ids);
	}

	/**
	 * Update the Completed Work field on a work item
	 */
	async updateCompletedWork(
		org: AdoOrganization,
		workItemId: number,
		minutesToAdd: number,
	): Promise<void> {
		// First get current completed work
		const baseUrl = org.url.endsWith("/") ? org.url.slice(0, -1) : org.url;
		const getUrl = `${baseUrl}/_apis/wit/workitems/${workItemId}?fields=Microsoft.VSTS.Scheduling.CompletedWork&api-version=7.1`;

		const getResponse = await fetch(getUrl, {
			method: "GET",
			headers: this.getHeaders(org.patToken),
		});

		if (!getResponse.ok) {
			throw new Error(`Failed to get work item: ${getResponse.statusText}`);
		}

		const workItem = (await getResponse.json()) as AdoWorkItemResponse;
		const currentHours =
			workItem.fields["Microsoft.VSTS.Scheduling.CompletedWork"] || 0;
		const hoursToAdd = minutesToAdd / 60;
		const newHours = currentHours + hoursToAdd;

		// Update the field
		const patchUrl = `${baseUrl}/_apis/wit/workitems/${workItemId}?api-version=7.1`;
		const patchBody = [
			{
				op: "add",
				path: "/fields/Microsoft.VSTS.Scheduling.CompletedWork",
				value: newHours,
			},
		];

		const patchResponse = await fetch(patchUrl, {
			method: "PATCH",
			headers: {
				...this.getHeaders(org.patToken),
				"Content-Type": "application/json-patch+json",
			},
			body: JSON.stringify(patchBody),
		});

		if (!patchResponse.ok) {
			throw new Error(
				`Failed to update work item: ${patchResponse.statusText}`,
			);
		}
	}
}
