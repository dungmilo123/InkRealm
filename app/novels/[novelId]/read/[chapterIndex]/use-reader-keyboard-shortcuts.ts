import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

type ShortcutActions = {
  /** URL for previous chapter, or null if at start */
  previousChapterHref: string | null;
  /** URL for next chapter, or null if at end */
  nextChapterHref: string | null;
  /** Toggle between original and translated text */
  toggleTranslation?: () => void;
  /** Toggle the settings popover */
  toggleSettings: () => void;
  /** Toggle the glossary mode */
  toggleGlossary?: () => void;
  /** Toggle the chapter table of contents drawer */
  toggleChapterDrawer: () => void;
  /** Toggle the keyboard shortcuts help dialog */
  toggleHelp: () => void;
  /** Toggle the in-chapter text search */
  toggleSearch: () => void;
};

/**
 * Keyboard shortcuts for the novel reader.
 *
 * Navigation:
 *   ArrowLeft / p  — Previous chapter
 *   ArrowRight / n — Next chapter
 *
 * Toggles:
 *   t — Toggle original/translated text
 *   s — Toggle reading settings
 *   g — Toggle glossary mode
 *   c — Open chapter table of contents
 *   f — Open in-chapter text search (also Ctrl/⌘+F)
 *   ? — Show keyboard shortcuts help
 *
 * All shortcuts are suppressed when the user is typing in an input,
 * textarea, select, or contenteditable element.
 */
export function useReaderKeyboardShortcuts(actions: ShortcutActions) {
  const router = useRouter();
  const actionsRef = useRef(actions);

  // Sync ref in an effect — React 19 forbids ref writes during render
  useEffect(() => {
    actionsRef.current = actions;
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept keyboard events when user is typing in form elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Intercept Ctrl/⌘+F to open in-reader search instead of browser find
      if (e.key === "f" && (e.ctrlKey || e.metaKey) && !e.altKey) {
        e.preventDefault();
        actionsRef.current.toggleSearch();
        return;
      }

      // Don't intercept when modifier keys are held (browser shortcuts)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const { previousChapterHref, nextChapterHref } = actionsRef.current;

      switch (e.key) {
        case "ArrowLeft":
        case "p":
          if (previousChapterHref) {
            e.preventDefault();
            router.push(previousChapterHref);
          }
          break;

        case "ArrowRight":
        case "n":
          if (nextChapterHref) {
            e.preventDefault();
            router.push(nextChapterHref);
          }
          break;

        case "t":
          if (actionsRef.current.toggleTranslation) {
            e.preventDefault();
            actionsRef.current.toggleTranslation();
          }
          break;

        case "s":
          e.preventDefault();
          actionsRef.current.toggleSettings();
          break;

        case "g":
          if (actionsRef.current.toggleGlossary) {
            e.preventDefault();
            actionsRef.current.toggleGlossary();
          }
          break;

        case "c":
          e.preventDefault();
          actionsRef.current.toggleChapterDrawer();
          break;

        case "f":
          e.preventDefault();
          actionsRef.current.toggleSearch();
          break;

        case "?":
          e.preventDefault();
          actionsRef.current.toggleHelp();
          break;
      }
    },
    [router]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
