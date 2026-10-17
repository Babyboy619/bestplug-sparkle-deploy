import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  role: "user" | "admin" | null;
  loading: boolean;
  roleLoading: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  roleLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AuthState["role"]>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let roleRequest = 0;

    async function updateRole(nextUser: User | null) {
      const request = ++roleRequest;
      setUser(nextUser);
      setRole(null);
      if (!nextUser) {
        setRoleLoading(false);
        return;
      }
      setRoleLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", nextUser.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!active || request !== roleRequest) return;
      setRole(data?.role === "admin" ? "admin" : "user");
      setRoleLoading(false);
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setLoading(false);
      void updateRole(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
      void Promise.resolve().then(() => updateRole(session?.user ?? null));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading, roleLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthUser = () => useContext(AuthContext);
