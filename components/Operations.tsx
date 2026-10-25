import type { ReactNode } from "react";
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <p className="pm-inline-error" role="alert">
      {error}
    </p>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return <p className="ops-empty">{children}</p>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="ops-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="pm-table-toolbar">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="ops-actions">{children}</div>
    </div>
  );
}
