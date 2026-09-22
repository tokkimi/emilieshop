"use client";
import { FormEvent, useState } from "react";
import Link from "./SafeLink";
export function ProfessionalOnboarding() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const body = {
      organizationName: form.get("organizationName"),
      organizationType: form.get("organizationType"),
      businessNumber: form.get("businessNumber"),
      taxNumbers: {
        gst: String(form.get("gst") || ""),
        qst: String(form.get("qst") || ""),
      },
      contactName: form.get("contactName"),
      contactEmail: form.get("contactEmail"),
      phone: form.get("phone"),
      countryCode: form.get("countryCode"),
      regionCode: form.get("regionCode"),
      billingCycle: form.get("billingCycle"),
      planCode: form.get("planCode"),
    };
    const response = await fetch("/api/professional-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as {error?:string};
    if (!response.ok) {
      setStatus("error");
      setMessage(result.error || 'Impossible de créer ce compte.');
      return;
    }
    setStatus("done");
  };
  if (status === "done")
    return (
      <main className="pro-onboarding">
        <section className="checkout-success">
          <span>✓</span>
          <h1>Compte professionnel préparé.</h1>
          <p>
            Les renseignements légaux sont enregistrés. Aucun débit ne sera
            effectué avant l’activation du paiement et la validation du contrat.
          </p>
          <Link className="button" href="/profil">
            Ouvrir mon espace →
          </Link>
        </section>
      </main>
    );
  return (
    <main className="pro-onboarding">
      <header>
        <p className="eyebrow">Portail professionnel</p>
        <h1>Préparez votre agence.</h1>
        <p>
          Renseignements légaux obligatoires, responsables, facturation
          mensuelle ou annuelle, puis crédits par vendeur.
        </p>
      </header>
      <form className="panel" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Nom légal de l’organisation
            <input name="organizationName" required />
          </label>
          <label>
            Type
            <select name="organizationType">
              <option value="broker">Courtier indépendant</option>
              <option value="team">Équipe</option>
              <option value="agency">Agence</option>
              <option value="network">Réseau</option>
            </select>
          </label>
          <label>
            Numéro d’entreprise
            <input name="businessNumber" required />
          </label>
          <label>
            TPS / GST
            <input name="gst" />
          </label>
          <label>
            TVQ / QST
            <input name="qst" />
          </label>
          <label>
            Responsable
            <input name="contactName" required />
          </label>
          <label>
            Courriel professionnel
            <input name="contactEmail" type="email" required />
          </label>
          <label>
            Téléphone
            <input name="phone" required />
          </label>
          <label>
            Pays
            <select name="countryCode">
              <option value="CA">Canada</option>
              <option value="US">États-Unis</option>
              <option value="FR">France</option>
            </select>
          </label>
          <label>
            Province / État
            <input name="regionCode" defaultValue="QC" maxLength={3} required />
          </label>
          <label>
            Facturation
            <select name="billingCycle">
              <option value="annual">Annuelle · 490 $ / an</option>
              <option value="monthly">Mensuelle · 49 $ / mois</option>
            </select>
          </label>
          <label>
            Pack de départ
            <select name="planCode">
              <option value="starter">10 crédits · 1 390 $</option>
              <option value="team">25 crédits · 3 250 $</option>
              <option value="agency">50 crédits · 6 250 $</option>
              <option value="network">100 crédits · 11 900 $</option>
            </select>
          </label>
        </div>
        <p className="checkout-note">
          Le portail et les crédits restent en attente jusqu’à l’activation du
          paiement. Chaque crédit finance un livre Essentiel individuel, sans
          minimum d’impression groupée.
        </p>
        {message ? <p className="studio-error">{message}</p> : null}
        <button className="button" disabled={status === "sending"}>
          {status === "sending"
            ? "Enregistrement…"
            : "Créer le compte professionnel →"}
        </button>
      </form>
    </main>
  );
}
