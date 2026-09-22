import { notFound, redirect } from "next/navigation";
import { requireChatGPTUser } from "../../../chatgpt-auth";
import { isAdminUser } from "../../../../lib/admin-auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { formatCad, getPlan } from "../../../../lib/catalog";
export const dynamic = "force-dynamic";
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireChatGPTUser("/admin");
  if (!isAdminUser(user)) redirect("/connexion?admin=refuse");
  const { id } = await params;
  const db = createSupabaseAdminClient();
  const { data: order } = await db!
    .from("orders")
    .select("*,projects(title,address)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const paid = [
    "paid",
    "preflight",
    "printing",
    "shipped",
    "delivered",
  ].includes(order.status);
  const plan = getPlan(order.product_code || "essential");
  return (
    <main className="invoice-page">
      <header>
        <div>
          <span className="brand-mark">M</span>
          <b>Mémoire Maison</b>
          <small>
            Emilie Cauvier Inc.
            <br />
            Montréal–Laval, Québec, Canada
            <br />
            emilie@equipecauvier.com
          </small>
        </div>
        <div>
          <p>{paid ? "FACTURE" : "PRO FORMA"}</p>
          <h1>{order.invoice_number || order.order_number}</h1>
          <small>
            {new Date(order.created_at).toLocaleDateString("fr-CA")}
          </small>
        </div>
      </header>
      <section>
        <div>
          <small>FACTURÉ À</small>
          <b>{order.shipping_address?.name || order.customer_email}</b>
          <p>
            {order.shipping_address?.street1}
            <br />
            {order.shipping_address?.city}, {order.shipping_address?.regionCode}{" "}
            {order.shipping_address?.postalCode}
            <br />
            {order.shipping_address?.countryCode}
          </p>
        </div>
        <div>
          <small>PROJET</small>
          <b>{order.projects?.title || plan.name.fr}</b>
          <p>{order.projects?.address}</p>
        </div>
      </section>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qté</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {plan.name.fr} · {plan.pageCount} pages · {plan.copies}{" "}
              exemplaire(s)
            </td>
            <td>{order.quantity}</td>
            <td>{formatCad(order.subtotal_cents)}</td>
          </tr>
          <tr>
            <td>Livraison estimée</td>
            <td>1</td>
            <td>{formatCad(order.shipping_cents)}</td>
          </tr>
        </tbody>
      </table>
      <aside>
        <p>
          <span>Sous-total</span>
          <b>{formatCad(order.subtotal_cents + order.shipping_cents)}</b>
        </p>
        <p>
          <span>Taxes</span>
          <b>{formatCad(order.tax_cents)}</b>
        </p>
        <p className="total">
          <span>Total CAD</span>
          <b>{formatCad(order.total_cents)}</b>
        </p>
      </aside>
      <footer>
        <p>
          {paid
            ? "Document comptable émis pour une commande payée."
            : "Document pro forma : aucun paiement reçu et aucune impression lancée."}
        </p>
        <p className="print-hint">
          Utilisez Imprimer / Enregistrer en PDF dans votre navigateur
        </p>
      </footer>
    </main>
  );
}
