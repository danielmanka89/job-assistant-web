"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      loading={pending}
      className="px-3.5 py-2 text-sm"
      onClick={async () => {
        setPending(true);
        await logout();
        router.replace("/login");
      }}
    >
      Sign out
    </Button>
  );
}
