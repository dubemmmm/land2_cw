import VerifyClient from "./VerifyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm your email — Squaremeter by CW", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams;
  return <VerifyClient token={typeof params?.token === "string" ? params.token : ""} />;
}
