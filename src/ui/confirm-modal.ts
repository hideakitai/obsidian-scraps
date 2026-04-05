import { App, Modal } from "obsidian";

class ConfirmModal extends Modal {
  private resolved = false;
  private readonly message: string;
  private readonly confirmText: string;
  private readonly cancelText: string;
  private readonly confirmCls: string;
  private resolve: ((value: boolean) => void) | null = null;

  constructor(app: App, message: string, confirmText: string, cancelText: string, confirmCls = "mod-cta") {
    super(app);
    this.message = message;
    this.confirmText = confirmText;
    this.cancelText = cancelText;
    this.confirmCls = confirmCls;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("p", { text: this.message });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });
    const confirmBtn = buttonContainer.createEl("button", {
      text: this.confirmText,
      cls: this.confirmCls,
    });
    const cancelBtn = buttonContainer.createEl("button", { text: this.cancelText });

    confirmBtn.addEventListener("click", () => {
      this.resolved = true;
      this.resolve?.(true);
      this.close();
    });

    cancelBtn.addEventListener("click", () => {
      this.resolved = true;
      this.resolve?.(false);
      this.close();
    });
  }

  onClose(): void {
    if (!this.resolved) {
      this.resolve?.(false);
    }
    this.contentEl.empty();
  }

  openAndAwait(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}

export function confirm(
  app: App,
  message: string,
  confirmText = "OK",
  cancelText = "Cancel",
  confirmCls = "mod-cta",
): Promise<boolean> {
  return new ConfirmModal(app, message, confirmText, cancelText, confirmCls).openAndAwait();
}
