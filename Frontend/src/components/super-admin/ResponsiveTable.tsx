import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  children: ReactNode;
  /**
   * Below this Tailwind breakpoint the wrapped table is shown as stacked cards
   * (one card per row, each cell labelled with its column header) instead of
   * a wide table that hides its last columns off-screen.
   */
  cardBelow?: "md" | "lg" | "xl";
  className?: string;
}

/**
 * Wraps an existing `<table>` (or the shadcn `<Table>`) and makes it responsive
 * without duplicating the row markup: on narrow screens the CSS in `index.css`
 * (`.responsive-table`) turns rows into cards and uses each cell's `data-label`
 * attribute — filled in here from the `<thead>` texts — as its caption.
 */
export function ResponsiveTable({ children, cardBelow = "lg", className }: ResponsiveTableProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const applyLabels = () => {
      const labels = Array.from(root.querySelectorAll("thead th")).map(
        (th) => th.textContent?.replace(/\s+/g, " ").trim() ?? "",
      );
      root.querySelectorAll("tbody tr").forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          if (!(cell instanceof HTMLTableCellElement) || cell.colSpan > 1) return;
          const label = labels[index] ?? "";
          if (cell.dataset.label !== label) cell.dataset.label = label;
        });
      });
    };

    applyLabels();
    // Rows can be added/removed without this wrapper re-rendering (e.g. after a refetch).
    const observer = new MutationObserver(applyLabels);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={cn("responsive-table", `rt-${cardBelow}`, className)}>
      {children}
    </div>
  );
}
