import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await requireAuth()) redirect("/");
  const params = await searchParams;
  return (
    <section className="hero">
      <div className="card">
        <div className="eyebrow">Private Kochzentrale</div>
        <h1>Einloggen und hungrig planen.</h1>
        <p>Cookingbot bleibt privat hinter deinem Login und verbindet Paprika-Rezepte mit Wochenplanung, LLM-Vorschlägen und Einkaufsliste.</p>
      </div>
      <form className="card form" method="post" action="/api/auth/login">
        <h2>Login</h2>
        {params.error ? <p style={{ color: "#b91c1c" }}>Passwort stimmt nicht.</p> : null}
        <label className="label" htmlFor="password">Passwort</label>
        <input className="input" id="password" name="password" type="password" autoFocus required />
        <button className="button" type="submit">Rein in die Küche</button>
      </form>
    </section>
  );
}
