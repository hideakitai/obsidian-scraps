import { App, TFile } from "obsidian";

interface DailyNotesConfig {
	readonly folder: string;
	readonly format: string;
}

export function getDailyNotesConfig(app: App): DailyNotesConfig {
	// Access non-public plugin APIs to detect daily notes configuration
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	const periodicNotes = (app as any).plugins?.getPlugin?.("periodic-notes");
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (periodicNotes?.settings?.daily?.folder) {
		return {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			folder: periodicNotes.settings.daily.folder,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			format: periodicNotes.settings.daily.format || "YYYY-MM-DD",
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	const dailyNotes = (app as any).internalPlugins?.getPluginById?.(
		"daily-notes",
	);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	if (dailyNotes?.instance?.options?.folder) {
		return {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			folder: dailyNotes.instance.options.folder,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			format: dailyNotes.instance.options.format || "YYYY-MM-DD",
		};
	}

	return { folder: "DailyNotes", format: "YYYY-MM-DD" };
}

export function getDailyNoteFile(
	app: App,
	folder: string,
	date: string,
): TFile | null {
	const path = `${folder}/${date}.md`;
	const file = app.vault.getAbstractFileByPath(path);
	if (file instanceof TFile) return file;
	return null;
}
