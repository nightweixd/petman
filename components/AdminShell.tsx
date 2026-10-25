import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Icon, { type IconName } from "./Icon";
import { signOut, type Session } from "@/lib/database";
export const AdminNavigation = createContext({
  view: "list",
  setView: (_view: string) => {},
});
const navigation: {
  id: string;
  label: string;
  icon: IconName;
  href: string;
}[] = [
  {
    id: "dashboard",
    label: "Overview",
    icon: "grid",
    href: "/?section=dashboard",
  },
  { id: "list", label: "Customers", icon: "users", href: "/" },
  { id: "bookings", label: "Bookings", icon: "calendar", href: "/bookings" },
  {
    id: "members",
    label: "Memberships",
    icon: "award",
    href: "/?section=members",
  },
  {
    id: "accounts",
    label: "Customer accounts",
    icon: "lock",
    href: "/?section=accounts",
  },
  { id: "backup", label: "Backups", icon: "archive", href: "/?section=backup" },
  {
    id: "deleted",
    label: "Deleted records",
    icon: "trash",
    href: "/?section=deleted",
  },
];
export default function AdminShell({
  children,
  session,
}: {
  children: ReactNode;
  session: Session;
}) {
  const { view, setView } = useContext(AdminNavigation),
    router = useRouter(),
    [expanded, setExpanded] = useState(false);
  const active =
    router.pathname === "/"
      ? view === "detail"
        ? "list"
        : view
      : router.pathname === "/staff"
        ? "staff"
        : router.pathname.slice(1);
  const title =
    [...navigation, { id: "staff", label: "Users & permissions" }].find(
      (n) => n.id === active,
    )?.label ?? "PetMan";
  const initials = session.user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className={`pm-shell ${expanded ? "pm-nav-expanded" : ""}`}>
      <aside className="pm-rail" aria-label="Main navigation">
        <Link href="/" className="pm-brand" aria-label="PetMan customers">
          <Icon name="paw" size={23} />
        </Link>
        <span className="pm-rail-rule" />
        <nav>
          {navigation.map((n) => (
            <Link
              href={n.href}
              key={n.id}
              title={n.label}
              aria-label={n.label}
              aria-current={active === n.id ? "page" : undefined}
              className={`pm-nav-link ${active === n.id ? "is-active" : ""}`}
              onClick={() => {
                setExpanded(false);
                setView(n.id);
              }}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="pm-rail-bottom">
          <Link
            href="/staff"
            title="Users & permissions"
            aria-label="Users & permissions"
            aria-current={active === "staff" ? "page" : undefined}
            className={`pm-nav-link ${active === "staff" ? "is-active" : ""}`}
          >
            <Icon name="settings" />
            <span>Users & permissions</span>
          </Link>
          <button
            className="pm-nav-link"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => {
              void signOut()
                .then(() => router.push("/"))
                .catch(() =>
                  window.dispatchEvent(
                    new CustomEvent("petman-error", {
                      detail: "Unable to sign out. Please try again.",
                    }),
                  ),
                );
            }}
          >
            <Icon name="logout" />
            <span>Sign out</span>
          </button>
          <div className="pm-rail-avatar" title={session.user.email}>
            {initials || "A"}
          </div>
        </div>
      </aside>
      {expanded && (
        <button
          className="pm-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setExpanded(false)}
        />
      )}
      <div className="pm-main">
        <header className="pm-topbar">
          <div className="pm-title-group">
            <button
              className="pm-icon-button pm-menu-toggle"
              aria-label="Toggle navigation"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              <Icon name="menu" />
            </button>
            <h1>{title}</h1>
            <span className="pm-admin-label">Salon workspace</span>
          </div>
          <div className="pm-topbar-right">
            <Link href="/book" className="pm-outline-link" target="_blank">
              Booking page
              <Icon name="arrow" size={15} />
            </Link>
            <span className="pm-topbar-divider" />
            <span className="pm-user-name">
              {session.user.name}
              <small>Administrator</small>
            </span>
            <Link
              className="pm-profile"
              href="/staff"
              aria-label="Your account"
            >
              {initials || "A"}
            </Link>
          </div>
        </header>
        <div className="pm-page">{children}</div>
        <footer className="pm-footer">
          <span>PetMan</span>
          <span>Customer care, all in one place.</span>
        </footer>
      </div>
    </div>
  );
}
