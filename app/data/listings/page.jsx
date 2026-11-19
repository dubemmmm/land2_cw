import AppShell from "@/components/AppShell";
import { requireAdminPage } from "@/lib/auth";
import { getListingFields, getListingViews } from "@/lib/listingFieldStore";
import { getLandListings } from "@/lib/listingStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { s3Config } from "@/lib/s3";
import ListingsDesk from "./ListingsDesk";

export const dynamic = "force-dynamic";
export const metadata = { title: "Listings desk — Squaremeter by CW" };

// Where CW staff keep the listings right: every plot in one table, with a side
// panel for the whole record. `?open=<id>` opens one listing straight away.
export default async function ListingsDeskPage({ searchParams }) {
  await requireAdminPage("/data/listings");
  const params = (await searchParams) || {};
  const [listings, neighborhoods, fields, views] = await Promise.all([
    getLandListings({ includeDrafts: true, includeDeleted: true, summary: true }),
    getNeighborhoods(),
    getListingFields({ includeArchived: true }),
    getListingViews()
  ]);
  return (
    <AppShell active="desk">
      <ListingsDesk
        initialListings={listings}
        neighborhoods={neighborhoods.map((item) => ({ id: item.id, name: item.name })).sort((a, b) => a.name.localeCompare(b.name))}
        initialFields={fields}
        initialViews={views}
        photosReady={Boolean(s3Config())}
        initialOpen={typeof params.open === "string" ? params.open : ""}
        startNew={params.new === "1"}
      />
    </AppShell>
  );
}
