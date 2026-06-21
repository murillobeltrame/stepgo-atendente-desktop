import type { KeyboardEvent } from "react";

export function handleSupportComposerKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  onSend: () => void,
): void {
  if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  onSend();
}
