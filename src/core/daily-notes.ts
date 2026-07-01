import { App, TFile } from "obsidian";

interface DailyNotesConfig {
	readonly folder: string;
	readonly format: string;
	// Daily-note template path as configured in periodic-notes / core daily-notes.
	// Read from the daily-note infrastructure, NOT from Templater, so the
	// scrap-creation fallback can find the template even when Templater is absent.
	// May be an empty string when no template is configured. Extension may be
	// omitted (Obsidian stores it without ".md"); the caller resolves that.
	readonly template: string;
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			template: periodicNotes.settings.daily.template || "",
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
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			template: dailyNotes.instance.options.template || "",
		};
	}

	return { folder: "DailyNotes", format: "YYYY-MM-DD", template: "" };
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
