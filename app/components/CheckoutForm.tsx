"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "./SafeLink";
import {
  CART_STORAGE_KEY,
  CATALOG_ADD_ONS,
  calculateCatalogSubtotal,
  estimateShippingCents,
  formatCad,
  getPlan,
  type PlanId,
} from "../../lib/catalog";
import { estimateTax } from "../../lib/tax";

type Address = {
  name: string;
  street1: string;
  street2: string;
  city: string;
  regionCode: string;
  countryCode: string;
  postalCode: string;
  phone: string;
};
const emptyAddress: Address = {
  name: "",
  street1: "",
  street2: "",
  city: "",
  regionCode: "QC",
  countryCode: "CA",
  postalCode: "",
  phone: "",
};

export function CheckoutForm({ locale = "fr" }: { locale?: "fr" | "en" }) {
  const en = locale === "en";
  const [planId, setPlanId] = useState<PlanId>("essential");
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const [projectId, setProjectId] = useState("");
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const queryProject =
        new URL(window.location.href).searchParams.get("project") || "";
      setProjectId(queryProject);
      try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        if (raw) {
          const cart = JSON.parse(raw) as {
            planId?: PlanId;
            addOnIds?: string[];
            projectId?: string;
          };
          if (cart.planId) setPlanId(cart.planId);
          if (cart.addOnIds) setAddOnIds(cart.addOnIds);
          if (!queryProject && cart.projectId) setProjectId(cart.projectId);
        }
      } catch {
        /* empty cart */
      }
      const payment = new URL(window.location.href).searchParams.get("payment");
      const sessionId = new URL(window.location.href).searchParams.get("session_id");
      if (payment === "cancelled") {
        setMessage(en ? "Payment cancelled. Your order is still available in your account." : "Paiement annulé. Votre commande reste disponible dans votre profil.");
      }
      if (payment === "success" && sessionId) {
        setStatus("sending");
        fetch(`/api/stripe/checkout?sessionId=${encodeURIComponent(sessionId)}`)
          .then(async (response) => ({ ok: response.ok, result: await response.json() as { paid?: boolean; orderNumber?: string; error?: string } }))
          .then(({ ok, result }) => {
            if (!ok || !result.paid) throw new Error(result.error || "payment");
            localStorage.removeItem(CART_STORAGE_KEY);
            setOrderNumber(result.orderNumber || "Maison Mémoire");
            setStatus("done");
          })
          .catch(() => {
            setStatus("error");
            setMessage(en ? "Payment is being verified. Check your order in your account in a moment." : "Le paiement est en cours de vérification. Consultez votre commande dans votre profil dans un instant.");
          });
      }
    }, 0);
    fetch("/api/account/profile")
      .then((response) => (response.ok ? response.json() as Promise<{profile?:{display_name?:string;phone?:string;shipping_address?:Partial<Address>;region_code?:string;country_code?:string;postal_code?:string}}> : null))
      .then((result) => {
        const profile = result?.profile;
        if (!profile) return;
        const saved = profile.shipping_address || {};
        setAddress((current) => ({
          ...current,
          name: profile.display_name || "",
          phone: profile.phone || "",
          street1: saved.street1 || "",
          street2: saved.street2 || "",
          city: saved.city || "",
          regionCode: saved.regionCode || profile.region_code || "QC",
          countryCode: saved.countryCode || profile.country_code || "CA",
          postalCode: saved.postalCode || profile.postal_code || "",
        }));
      })
      .catch(() => null);
    return () => window.clearTimeout(timer);
  }, [en]);
  const plan = getPlan(planId);
  const subtotal = useMemo(
    () => calculateCatalogSubtotal(planId, addOnIds),
    [planId, addOnIds],
  );
  const shipping = estimateShippingCents(address.countryCode);
  const tax = estimateTax(
    subtotal + shipping,
    address.countryCode,
    address.regionCode,
  );
  const total = subtotal + shipping + (tax.taxCents || 0);
  const startCheckout = async (orderId: string) => {
    const checkout = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const result = await checkout.json() as { url?: string; error?: string };
    if (!checkout.ok || !result.url) throw new Error(result.error || (en ? "Secure payment is unavailable." : "Le paiement sécurisé est indisponible."));
    localStorage.removeItem(CART_STORAGE_KEY);
    window.location.assign(result.url);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId) {
      setStatus("error");
      setMessage(
        en
          ? "Return to your proof and approve it before ordering."
          : "Retournez à votre aperçu et approuvez-le avant de commander.",
      );
      return;
    }
    setStatus("sending");
    setMessage("");
    if (pendingOrderId) {
      try { await startCheckout(pendingOrderId); } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Stripe indisponible."); }
      return;
    }
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        planId,
        addOnIds,
        locale,
        shippingAddress: address,
      }),
    });
    const result = await response.json() as {error?:string;order?:{id:string;orderNumber:string}};
    if (!response.ok) {
      setStatus("error");
      setMessage(
        result.error ||
          (en
            ? "The order could not be saved."
            : "La commande n’a pas pu être enregistrée."),
      );
      return;
    }
    if (!result.order?.id) { setStatus("error"); setMessage(en ? "The order could not be prepared." : "La commande n’a pas pu être préparée."); return; }
    setPendingOrderId(result.order.id);
    setOrderNumber(result.order.orderNumber || '');
    try { await startCheckout(result.order.id); } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Stripe indisponible."); }
  };
  if (status === "done")
    return (
      <main className="checkout-page">
        <section className="checkout-success">
          <span>✓</span>
          <p className="eyebrow">{en ? "Payment confirmed" : "Paiement confirmé"}</p>
          <h1>{orderNumber}</h1>
          <p>
            {en
              ? "Maison Mémoire has received your payment. Your order is in your account and will enter preflight before printing."
              : "Maison Mémoire a reçu votre paiement. La commande se trouve dans votre profil et passe au contrôle prépresse avant impression."}
          </p>
          <Link className="button" href={en ? "/en/profile" : "/profil"}>
            {en ? "View my orders →" : "Voir mes commandes →"}
          </Link>
        </section>
      </main>
    );
  return (
    <main className="checkout-page">
      <header>
        <p className="eyebrow">{en ? "Secure order" : "Commande sécurisée"}</p>
        <h1>{en ? "Finalize your keepsake." : "Finalisez votre souvenir."}</h1>
        <p>
          {en
            ? "Account required · exact proof approval required · no printing before payment."
            : "Compte requis · aperçu exact approuvé · aucune impression avant paiement."}
        </p>
      </header>
      <form className="checkout-grid" onSubmit={submit}>
        <section className="checkout-fields panel">
          <h2>{en ? "Delivery address" : "Adresse de livraison"}</h2>
          <div className="form-grid">
            <label>
              {en ? "Full name" : "Nom complet"}
              <input
                required
                value={address.name}
                onChange={(event) =>
                  setAddress({ ...address, name: event.target.value })
                }
              />
            </label>
            <label>
              {en ? "Phone" : "Téléphone"}
              <input
                required
                inputMode="tel"
                value={address.phone}
                onChange={(event) =>
                  setAddress({ ...address, phone: event.target.value })
                }
              />
            </label>
            <label className="wide">
              {en ? "Address" : "Adresse"}
              <input
                required
                value={address.street1}
                onChange={(event) =>
                  setAddress({ ...address, street1: event.target.value })
                }
              />
            </label>
            <label className="wide">
              {en ? "Apartment (optional)" : "Appartement (facultatif)"}
              <input
                value={address.street2}
                onChange={(event) =>
                  setAddress({ ...address, street2: event.target.value })
                }
              />
            </label>
            <label>
              {en ? "City" : "Ville"}
              <input
                required
                value={address.city}
                onChange={(event) =>
                  setAddress({ ...address, city: event.target.value })
                }
              />
            </label>
            <label>
              {en ? "Province / State" : "Province / État"}
              <input
                required
                maxLength={3}
                value={address.regionCode}
                onChange={(event) =>
                  setAddress({
                    ...address,
                    regionCode: event.target.value.toUpperCase(),
                  })
                }
              />
            </label>
            <label>
              {en ? "Country" : "Pays"}
              <select
                value={address.countryCode}
                onChange={(event) =>
                  setAddress({
                    ...address,
                    countryCode: event.target.value,
                    regionCode: event.target.value === "CA" ? "QC" : "",
                  })
                }
              >
                <option value="CA">Canada</option>
                <option value="US">United States</option>
                <option value="FR">France</option>
                <option value="BE">Belgique</option>
                <option value="CH">Suisse</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Deutschland</option>
                <option value="ES">España</option>
                <option value="IT">Italia</option>
              </select>
            </label>
            <label>
              {en ? "Postal code" : "Code postal"}
              <input
                required
                value={address.postalCode}
                onChange={(event) =>
                  setAddress({ ...address, postalCode: event.target.value })
                }
              />
            </label>
          </div>
          <p className="checkout-note">
            {en
              ? "International taxes and import duties are finalized from the delivery address when payment is enabled."
              : "Les taxes internationales et droits d’importation seront finalisés selon l’adresse de livraison lors de l’activation du paiement."}
          </p>
        </section>
        <aside className="order-summary panel">
          <p className="eyebrow">{en ? "Your selection" : "Votre sélection"}</p>
          <h2>{plan.name[locale]}</h2>
          <p>{plan.tagline[locale]}</p>
          <div className="summary-line">
            <span>{en ? "Book package" : "Formule livre"}</span>
            <b>{formatCad(plan.priceCents, locale)}</b>
          </div>
          {CATALOG_ADD_ONS.filter((item) => addOnIds.includes(item.id)).map(
            (item) => (
              <div className="summary-line" key={item.id}>
                <span>{item.name[locale]}</span>
                <b>{formatCad(item.priceCents, locale)}</b>
              </div>
            ),
          )}
          <div className="summary-line">
            <span>{en ? "Estimated shipping" : "Livraison estimée"}</span>
            <b>{formatCad(shipping, locale)}</b>
          </div>
          <div className="summary-line">
            <span>{tax.label}</span>
            <b>
              {tax.taxCents === null
                ? en
                  ? "At payment"
                  : "Au paiement"
                : formatCad(tax.taxCents, locale)}
            </b>
          </div>
          <div className="summary-total">
            <span>Total CAD</span>
            <b>{formatCad(total, locale)}</b>
          </div>
          <small>
            {en
              ? "Rounded prices. No hidden decimal pricing. Taxes shown are an estimate until payment."
              : "Prix ronds, sans tarification à virgule cachée. Les taxes affichées restent estimatives jusqu’au paiement."}
          </small>
          {message ? (
            <p className="studio-error" role="alert">
              {message}
            </p>
          ) : null}
          <button className="button" disabled={status === "sending"}>
            {status === "sending"
              ? en
                ? "Opening secure payment…"
                : "Ouverture du paiement sécurisé…"
              : en
                ? "Pay securely →"
                : "Payer en toute sécurité →"}
          </button>
          <Link href={en ? "/en/preview" : "/apercu"}>
            {en ? "← Return to proof" : "← Revenir à l’aperçu"}
          </Link>
        </aside>
      </form>
    </main>
  );
}
