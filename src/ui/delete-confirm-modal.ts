import { App, Modal } from "obsidian";

interface DeleteConfirmResult {
  readonly confirmed: boolean;
  readonly dontAskAgain: boolean;
}

class DeleteConfirmModal extends Modal {
  private resolved = false;
  private readonly message: string;
  private resolve: ((value: DeleteConfirmResult) => void) | null = null;

  constructor(app: App, message: string) {
    super(app);
    this.message = message;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    const checkboxContainer = contentEl.createDiv({ cls: "scraps-dont-ask-again" });
    const checkbox = checkboxContainer.createEl("input", { type: "checkbox" });
    checkboxContainer.createEl("label", { text: "Don't ask again" });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const deleteBtn = buttonContainer.createEl("button", {
      text: "Delete",
      cls: "mod-warning",
    });
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });

    deleteBtn.addEventListener("click", () => {
      this.resolved = true;
      this.resolve?.({ confirmed: true, dontAskAgain: checkbox.checked });
      this.close();
    });

    cancelBtn.addEventListener("click", () => {
      this.resolved = true;
      this.resolve?.({ confirmed: false, dontAskAgain: false });
      this.close();
    });
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolve?.({ confirmed: false, dontAskAgain: false });
    }
    this.contentEl.empty();
  }

  openAndAwait(): Promise<DeleteConfirmResult> {
    return new Promise<DeleteConfirmResult>((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}

export function confirmDeleteWithOption(app: App, message: string): Promise<DeleteConfirmResult> {
  return new DeleteConfirmModal(app, message).openAndAwait();
}
