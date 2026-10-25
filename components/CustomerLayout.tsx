import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";
export default function CustomerLayout({
  children,
  signedIn = false,
  active,
}: {
  children: ReactNode;
  signedIn?: boolean;
  active?: "portal" | "book" | "login";
}) {
  return (
    <div className="pc-shell">
      <header className="pc-header">
        <div className="pc-header-inner">
          <Link href={signedIn ? "/portal" : "/book"} className="pc-brand">
            <span>
              <Icon name="paw" size={23} />
            </span>
            PetMan<small>Pet care, together.</small>
          </Link>
          <nav aria-label="Customer navigation">
            {signedIn && (
              <Link
                href="/portal"
                aria-current={active === "portal" ? "page" : undefined}
              >
                My account
              </Link>
            )}
            <Link
              href="/book"
              aria-current={active === "book" ? "page" : undefined}
            >
              Book a visit
            </Link>
            {!signedIn && (
              <Link
                href="/login"
                aria-current={active === "login" ? "page" : undefined}
              >
                Member sign in
              </Link>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="pc-footer">
        <span>PetMan</span>
        <span>A little care for every chapter.</span>
        <Link href="/">Staff workspace</Link>
      </footer>
    </div>
  );
}
