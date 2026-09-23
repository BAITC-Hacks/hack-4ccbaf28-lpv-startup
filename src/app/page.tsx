import MatchApp from "@/components/match-app";
import { getMeta } from "@/server/catalog";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <MatchApp meta={getMeta()} />;
}
