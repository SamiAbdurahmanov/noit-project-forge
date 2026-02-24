"use client";

/**
 * withAuth.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Higher-Order Component that protects any page from unauthenticated access.
 *
 * Usage — wrap your default export:
 *
 *   export default withAuth(MyProtectedPage);
 *
 * What it does:
 *   • While auth is loading  → shows <LoadingScreen />
 *   • If user is not logged in → redirects to /auth/login
 *   • If user is logged in   → renders the wrapped page normally
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import LoadingScreen from "@/src/lib/components/LoadingScreen";

type ComponentWithAuth = React.ComponentType<any>;

export function withAuth(WrappedComponent: ComponentWithAuth): ComponentWithAuth {
  function ProtectedPage(props: any) {
    const { user, isLoading } = useUser();
    const router = useRouter();

    useEffect(() => {
      
      if (isLoading) return;

     
      if (!user) {
        router.replace("/auth/login");
      }
    }, [user, isLoading, router]);

    
    if (isLoading) return <LoadingScreen />;

    if (!user) return <LoadingScreen />;

    
    return <WrappedComponent {...props} />;
  }

  // Keep the display name for easier debugging in React DevTools
  ProtectedPage.displayName = `withAuth(${WrappedComponent.displayName ?? WrappedComponent.name ?? "Component"})`;

  return ProtectedPage;
}