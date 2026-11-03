// Mock of src/lib/AuthContext: ?v=me → a manager account, else an admin.
const me = new URLSearchParams(location.search).get("v") === "me";
export const useAuth = () =>
  ({
    user: { email: me ? "manager@vp.uz" : "rahbar@vodiyprint.uz" },
    staff: me ? { full_name: "Maryam", report_manager_id: "m3", permissions: {} } : { full_name: "Rahbar" },
    isAdmin: !me,
    isManagerAccount: me,
    can: () => true,
    role: me ? "manager" : "admin",
  }) as any;
export type AuthContextValue = any;
