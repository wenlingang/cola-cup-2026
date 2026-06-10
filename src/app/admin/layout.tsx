import { getCurrentSettler } from "../../lib/settler";
import { AdminTabs } from "../components/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settler = await getCurrentSettler();
  return (
    <>
      {settler && <AdminTabs />}
      {children}
    </>
  );
}
