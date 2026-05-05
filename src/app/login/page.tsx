import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await requireAuth()) redirect("/");
  const params = await searchParams;
  const errorMessage =
    params.error === "rate_limit"
      ? "Zu viele Versuche. Bitte ein paar Minuten warten."
      : params.error
        ? "Passwort stimmt nicht."
        : null;

  return (
    <>
      <div className="login-bg" aria-hidden />
      <div className="login-card">
        <div className="login-mark" aria-hidden>
          c
        </div>
        <div className="eyebrow">Cookingbot · privat</div>
        <h1>
          Was kommt heute <em>auf den Tisch?</em>
        </h1>
        <p className="lead">
          Deine Wochenplanung mit Paprika-Rezepten, KI-Vorschlägen und einer ehrlichen Einkaufsliste.
        </p>
        <LoginForm errorMessage={errorMessage} />
        <p className="login-foot">Privat gehostet · keine Tracker · keine Telemetrie</p>
      </div>
    </>
  );
}
