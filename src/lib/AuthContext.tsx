import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { getOne, upsertOne } from "./firestoreDb";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  fullPermissions,
  type ModuleKey,
  type PermissionAction,
  type Staff,
} from "./permissions";

export type AuthContextValue = {
  user: User | null;
  initializing: boolean;
  staff: Staff | null;
  staffLoading: boolean;
  isAdmin: boolean;
  can: (module: ModuleKey, action: PermissionAction) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [staffLoading, setStaffLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStaff = async () => {
      if (!user?.email) {
        setStaff(null);
        setStaffLoading(false);
        return;
      }
      setStaffLoading(true);
      const email = user.email.toLowerCase();
      let record = await getOne<Staff>("staff", email);
      if (!record && email === BOOTSTRAP_ADMIN_EMAIL) {
        record = await upsertOne<Staff>("staff", email, {
          email,
          full_name: email,
          role: "admin",
          permissions: fullPermissions(),
        });
      }
      if (!cancelled) {
        setStaff(record);
        setStaffLoading(false);
      }
    };

    void loadStaff();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      staff,
      staffLoading,
      isAdmin: staff?.role === "admin",
      can: (moduleKey, action) => {
        if (staff?.role === "admin") return true;
        return !!staff?.permissions?.[moduleKey]?.[action];
      },
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
    }),
    [user, initializing, staff, staffLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth AuthProvider ichida chaqirilishi kerak");
  }
  return ctx;
}
