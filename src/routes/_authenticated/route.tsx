import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    let role: "admin" | "corretor" = "corretor";
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profileError) {
        console.error("[_authenticated] Falha ao ler profile; usando fallback 'corretor'.", profileError);
      } else if (profile?.role === "admin") {
        role = "admin";
      }
    } catch (err) {
      console.error("[_authenticated] Exceção ao ler profile; usando fallback 'corretor'.", err);
    }
    return { user: data.user, role };
  },
  component: () => <Outlet />,
});
