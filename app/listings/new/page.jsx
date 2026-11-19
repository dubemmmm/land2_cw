import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Listings are added and edited on the listings desk. This address is kept so
// old links and bookmarks still land in the right place.
export default async function NewListingPage({ searchParams }) {
  await requireAdminPage("/data/listings");
  const params = (await searchParams) || {};
  redirect(typeof params.id === "string" ? `/data/listings?open=${encodeURIComponent(params.id)}` : "/data/listings?new=1");
}
