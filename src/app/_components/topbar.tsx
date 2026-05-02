import Link from "next/link";
import { Brand } from "./brand";
import { SearchIcon } from "./icons";

export function Topbar() {
  return (
    <div className="topbar">
      <Link href="/" aria-label="Zur Startseite">
        <Brand showSubtitle={false} />
      </Link>
      <Link href="/recipes" className="top-act" aria-label="Rezepte durchsuchen">
        <SearchIcon />
      </Link>
    </div>
  );
}
