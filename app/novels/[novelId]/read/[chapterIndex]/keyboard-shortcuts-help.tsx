import { useEffect, useRef } from "react";

type KeyboardShortcut = {
  keys: string[];
  label: string;
  available: boolean;
};

type KeyboardShortcutsHelpProps = {
  onClose: () => void;
  hasTranslation: boolean;
  hasGlossary: boolean;
};

export function KeyboardShortcutsHelp({
  onClose,
  hasTranslation,
  hasGlossary,
}: KeyboardShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const shortcuts: KeyboardShortcut[] = [
    { keys: ["←", "P"], label: "Previous chapter", available: true },
    { keys: ["→", "N"], label: "Next chapter", available: true },
    { keys: ["C"], label: "Chapter table of contents", available: true },
    { keys: ["F"], label: "Search in chapter", available: true },
    { keys: ["B"], label: "Toggle chapter bookmark", available: true },
    { keys: ["T"], label: "Toggle original / translated", available: hasTranslation },
    { keys: ["S"], label: "Toggle reading settings", available: true },
    { keys: ["G"], label: "Toggle glossary highlights", available: hasGlossary },
    { keys: ["?"], label: "Show / hide this help", available: true },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.label}
              className={`flex items-center justify-between py-1.5 ${
                shortcut.available ? "" : "opacity-40"
              }`}
            >
              <span className="text-sm text-foreground">{shortcut.label}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground mx-1">
                        /
                      </span>
                    )}
                    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-mono text-muted-foreground">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          Press <kbd className="rounded border border-border bg-muted px-1 text-xs font-mono">?</kbd> or{" "}
          <kbd className="rounded border border-border bg-muted px-1 text-xs font-mono">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
