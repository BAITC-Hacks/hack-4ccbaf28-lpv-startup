import MatchApp from "@/components/match-app";
import { getMeta, initialQuery } from "@/server/catalog";
import { runSearch } from "@/server/search-service";
export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <MatchApp meta={getMeta()} initial={await runSearch(initialQuery, false)} />
  );
}
