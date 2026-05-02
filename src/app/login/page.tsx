import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await requireAuth()) redirect("/");
  const params = await searchParams;
  return (
    <section className="login-stage">
      <div className="login-card">
        <div className="brand-mark login-mark">c</div>
        <div className="eyebrow">Cookingbot · privat</div>
        <h1>Was kommt heute <em>auf den Tisch?</em></h1>
        <p>Deine Wochenplanung mit Paprika-Rezepten, KI-Vorschlägen und einer ehrlichen Einkaufsliste.</p>
        <form className="form" method="post" action="/api/auth/login">
          {params.error ? <p style={{ color: "#a23a2b" }}>Passwort stimmt nicht.</p> : null}
          <label className="label" htmlFor="password">Passwort</label>
          <input className="input" id="password" name="password" type="password" autoFocus required />
          <button className="button block" type="submit">In die Küche</button>
        </form>
        <p className="login-foot">Privat gehostet · keine Tracker · keine Telemetrie</p>
      </div>
    </section>
  );
}
