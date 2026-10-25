import { useEffect, useState } from "react";
import {
  database,
  fetchDeletedCustomers,
  type DbDeletedCustomer,
} from "@/lib/database";
import { api } from "@/lib/workspace";
import { Empty, ErrorMessage, Heading } from "./Operations";
export default function RecoveryRecords({
  onBack,
  onRestore,
}: {
  onBack: () => void;
  onRestore: () => void;
}) {
  const [rows, setRows] = useState<DbDeletedCustomer[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    void fetchDeletedCustomers().then(setRows);
  }, []);
  return (
    <section className="pm-table-card">
      <Heading
        title="Archived customers"
        description="Archiving preserves customer identities, memberships, bookings and account links."
      >
        <button className="pm-button" onClick={onBack}>
          Back to customers
        </button>
      </Heading>
      <ErrorMessage error={error} />
      {rows.map((r) => (
        <div className="ops-task" key={r.id}>
          <div>
            <strong>{r.customer_name}</strong>
            <p>
              {r.customer_id} · {r.deleted_at}
            </p>
            {r.snapshot?.version !== 3 && (
              <small>
                Legacy recovery restores the data available in its snapshot.
                Membership and login details may not be included.
              </small>
            )}
          </div>
          <button
            className="pm-button"
            disabled={!!busy}
            onClick={async () => {
              setBusy(r.id);
              try {
                await api("/restore", { id: r.id });
                setRows((a) => a.filter((x) => x.id !== r.id));
                onRestore();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy("");
              }
            }}
          >
            {busy === r.id ? "Restoring…" : "Restore customer"}
          </button>
        </div>
      ))}
      {!rows.length && <Empty>No archived customers.</Empty>}
    </section>
  );
}
