import { App, setIcon } from "obsidian";
import { TagSuggest } from "./tag-suggest";

export interface FilterBarCallbacks {
  readonly onSearchChange: (query: string) => void;
  readonly onDateRangeChange: (from: string, to: string) => void;
}

export interface FilterBarElements {
  readonly containerEl: HTMLElement;
  readonly updateAvailableTags: (tags: readonly string[]) => void;
}

export function renderFilterBar(parent: HTMLElement, callbacks: FilterBarCallbacks, app: App): FilterBarElements {
  const containerEl = parent.createDiv({ cls: "scraps-filter-bar" });

  // Search row: [date-range toggle] [search icon] [search input]
  const searchWrapper = containerEl.createDiv({ cls: "scraps-search-wrapper" });

  const dateToggle = searchWrapper.createSpan({ cls: "scraps-date-toggle" });
  setIcon(dateToggle, "calendar-range");

  const searchIcon = searchWrapper.createSpan({ cls: "scraps-search-icon" });
  setIcon(searchIcon, "search");
  const searchInput = searchWrapper.createEl("input", {
    cls: "scraps-search",
    type: "search",
    placeholder: "Search scraps... (use # for tags)",
  });
  searchInput.addEventListener("input", () => {
    callbacks.onSearchChange(searchInput.value);
  });

  // Tag suggest
  const tagSuggest = new TagSuggest(app, searchInput);

  // Collapsible date range (below search row)
  const contentEl = containerEl.createDiv({ cls: "scraps-filter-content is-collapsed" });

  dateToggle.addEventListener("click", () => {
    const collapsed = contentEl.classList.toggle("is-collapsed");
    if (collapsed) {
      dateToggle.removeClass("is-active");
    } else {
      dateToggle.addClass("is-active");
    }
  });

  // Date range row
  const dateRow = contentEl.createDiv({ cls: "scraps-date-range" });
  const fromGroup = dateRow.createDiv({ cls: "scraps-date-group" });
  fromGroup.createEl("label", { cls: "scraps-date-label", text: "From" });
  const dateFrom = fromGroup.createEl("input", {
    cls: "scraps-date-input",
    type: "date",
  });
  const toGroup = dateRow.createDiv({ cls: "scraps-date-group" });
  toGroup.createEl("label", { cls: "scraps-date-label", text: "To" });
  const dateTo = toGroup.createEl("input", {
    cls: "scraps-date-input",
    type: "date",
  });

  const onDateChange = (): void => {
    callbacks.onDateRangeChange(dateFrom.value, dateTo.value);
  };
  dateFrom.addEventListener("change", onDateChange);
  dateTo.addEventListener("change", onDateChange);

  function updateAvailableTags(tags: readonly string[]): void {
    tagSuggest.setTags(tags);
  }

  return { containerEl, updateAvailableTags };
}
