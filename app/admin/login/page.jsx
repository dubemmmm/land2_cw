import { redirect } from "next/navigation";
import { adminCredentials, getAdminSession, hasConfiguredAdminCredentials } from "@/lib/auth";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === "string" ? params.next : "/data";
  const session = await getAdminSession();
  if (session) redirect(next);
  const showDevHint = process.env.NODE_ENV !== "production" && !hasConfiguredAdminCredentials();
  return <LoginClient next={next} devCredentials={showDevHint ? adminCredentials() : null} />;
}
