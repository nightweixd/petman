import { useEffect, useRef, type ReactNode } from "react";
import Icon from "./Icon";
export function useModalFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const targets = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length && el.tabIndex >= 0);
    targets()[0]?.focus();
    function keys(e: KeyboardEvent) {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]',
      );
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const items = targets(),
          first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !ref.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keys);
      before?.focus();
    };
  }, []);
  return ref;
}
export default function Drawer({
  children,
  title,
  onClose,
  eyebrow = "Customers / Pet record",
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  eyebrow?: string;
}) {
  const ref = useModalFocus(onClose);
  return (
    <div
      className="pm-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={ref}
    >
      <button
        className="pm-drawer-scrim"
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onClick={onClose}
      />
      <section className="pm-drawer">
        <header className="pm-drawer-heading">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="pm-icon-button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
