import Link from "next/link";
import { Brand } from "./brand";
import { CogIcon, SearchIcon } from "./icons";

export function Topbar() {
  return (
    <div className="topbar">
      <Link href="/" aria-label="Zur Startseite">
        <Brand showSubtitle={false} />
      </Link>
      <div style={{ display: "flex", gap: 8 }}>
        <Link href="/recipes" className="top-act" aria-label="Rezepte durchsuchen">
          <SearchIcon />
        </Link>
        <Link href="/settings" className="top-act" aria-label="Einstellungen">
          <CogIcon />
        </Link>
      </div>
    </div>
  );
}
