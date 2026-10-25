export type StaffRole = "owner" | "receptionist" | "groomer";
export type Profile = {
  id: string;
  role: string;
  staff_role: StaffRole;
  customer_id: string | null;
  is_active: number;
  full_name: string;
};
export function can(
  profile: Profile,
  capability: "manage" | "care" | "bookings" | "finance" | "records",
) {
  if (profile.role !== "admin") return false;
  if (profile.staff_role === "owner") return true;
  if (profile.staff_role === "receptionist") return capability !== "manage";
  return capability === "bookings";
}
