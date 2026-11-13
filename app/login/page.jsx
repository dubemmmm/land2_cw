import { redirect } from "next/navigation";
import { getUserSession, safeNext } from "@/lib/auth";
import UserLoginClient from "./UserLoginClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in — Squaremeter by CW" };

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params?.next, "/account");
  if (await getUserSession()) redirect(next);
  return <UserLoginClient next={next} />;
}
