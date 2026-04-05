import { AbstractInputSuggest, App } from "obsidian";

export class TagSuggest extends AbstractInputSuggest<string> {
  private tags: readonly string[] = [];
  private readonly inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  setTags(tags: readonly string[]): void {
    this.tags = tags;
  }

  getSuggestions(inputStr: string): string[] {
    // Find the last `#` fragment in the input
    const lastHash = inputStr.lastIndexOf("#");
    if (lastHash < 0) return [];
    const fragment = inputStr.slice(lastHash + 1).toLowerCase();
    // Don't suggest if cursor is not right after the hash fragment (space after means done)
    const afterFragment = inputStr.slice(lastHash);
    if (afterFragment.includes(" ") && afterFragment.indexOf(" ") > 0) return [];

    return this.tags.filter((tag) => tag.toLowerCase().includes(fragment)).slice(0, 20);
  }

  renderSuggestion(tag: string, el: HTMLElement): void {
    el.setText(`#${tag}`);
  }

  selectSuggestion(tag: string): void {
    const value = this.inputEl.value;
    const lastHash = value.lastIndexOf("#");
    if (lastHash < 0) return;
    this.inputEl.value = value.slice(0, lastHash) + `#${tag} `;
    this.inputEl.dispatchEvent(new Event("input"));
  }
}
