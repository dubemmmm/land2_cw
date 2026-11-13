import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import SignupClient from "./SignupClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create an account — Squaremeter by CW" };

export default async function SignupPage({ searchParams }) {
  const params = await searchParams;
  if (await getUserSession()) redirect("/account");
  return <SignupClient initialRole={params?.as === "agent" ? "agent" : "customer"} />;
}
