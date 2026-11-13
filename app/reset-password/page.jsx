import { tokenIsLive } from "@/lib/userStore";
import ResetClient from "./ResetClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose a new password — Squaremeter by CW", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  const token = typeof params?.token === "string" ? params.token : "";
  const live = token ? await tokenIsLive(token, "reset") : false;
  return <ResetClient token={token} live={live} />;
}
