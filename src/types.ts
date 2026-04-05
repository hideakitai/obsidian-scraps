export interface Memo {
  readonly id: string;
  readonly date: string;
  readonly time: string;
  readonly timeNormalized: string;
  readonly content: string;
  readonly rawLines: readonly string[];
  readonly tags: readonly string[];
}

export interface ScrapsSettings {
  readonly sectionHeading: string;
  readonly displayRange: number;
  readonly timeFormat: "HH:mm:ss" | "HH:mm";
  readonly sortOrder: "newest-first" | "oldest-first";
  readonly autoCreateNote: boolean;
  readonly confirmBeforeDelete: boolean;
  readonly dateDisplayFormat: string;
  readonly loadMoreDays: number;
}

export const DEFAULT_SETTINGS: ScrapsSettings = {
  sectionHeading: "## Thino",
  displayRange: 7,
  timeFormat: "HH:mm:ss",
  sortOrder: "newest-first",
  autoCreateNote: false,
  confirmBeforeDelete: true,
  dateDisplayFormat: "YYYY-MM-DD (ddd)",
  loadMoreDays: 7,
};

export interface MemoEditDraft {
  readonly memoId: string;
  readonly text: string;
}

export interface DraftState {
  readonly memoInput: string;
  readonly captureModal: string;
  readonly memoEdit: MemoEditDraft | null;
}

export const DEFAULT_DRAFTS: DraftState = {
  memoInput: "",
  captureModal: "",
  memoEdit: null,
};

export interface PluginData {
  readonly settings: ScrapsSettings;
  readonly drafts: DraftState;
}
