"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "./SafeLink";
import { formatCad } from "../../lib/catalog";
type Props = { name: string; email: string; locale?: "fr" | "en" };
type Project = {
  id: string;
  title: string;
  address: string | null;
  status: string;
  progress: number;
  collection: string;
};
type Order = {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  currency: string;
  product_code: string;
  quantity: number;
  created_at: string;
  tracking_url: string | null;
};
type Profile = {
  display_name: string | null;
  phone: string | null;
  preferred_locale: "fr" | "en";
  shipping_address: Record<string, string>;
};
type Thread = {
  id: string;
  subject: string;
  status: string;
  updated_at: string;
  unread_customer: number;
};
type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  is_mine?: boolean;
};
export function RealCustomerAccount({ name, email, locale = "fr" }: Props) {
  const en = locale === "en";
  const [tab, setTab] = useState<
    "projects" | "orders" | "messages" | "account"
  >("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThread, setActiveThread] = useState("");
  const [draft, setDraft] = useState("");
  const [profile, setProfile] = useState<Profile>({
    display_name: name,
    phone: "",
    preferred_locale: locale,
    shipping_address: {},
  });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    const [p, o, a, t] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/orders"),
      fetch("/api/account/profile"),
      fetch("/api/message-threads"),
    ]);
    if (p.ok) setProjects(((await p.json()) as {projects:Project[]}).projects || []);
    if (o.ok) setOrders(((await o.json()) as {orders:Order[]}).orders || []);
    if (a.ok) {
      const value = ((await a.json()) as {profile:Profile|null}).profile;
      if (value)
        setProfile({
          ...value,
          shipping_address: value.shipping_address || {},
        });
    }
    if (t.ok) {
      const value = ((await t.json()) as {threads:Thread[]}).threads || [];
      setThreads(value);
      if (value[0] && !activeThread) setActiveThread(value[0].id);
    }
    setLoading(false);
  };
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!activeThread) return;
    fetch(`/api/messages?threadId=${encodeURIComponent(activeThread)}`)
      .then((response) => (response.ok ? response.json() as Promise<{messages:Message[]}> : null))
      .then((result) => setMessages(result?.messages || []))
      .catch(() => setMessages([]));
  }, [activeThread]);
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: profile.display_name || name,
        phone: profile.phone || "",
        preferredLocale: profile.preferred_locale,
        shippingAddress: profile.shipping_address,
      }),
    });
    setNotice(
      response.ok
        ? en
          ? "Profile saved."
          : "Profil enregistré."
        : en
          ? "Could not save the profile."
          : "Le profil n’a pas pu être enregistré.",
    );
  };
  const send = async () => {
    if (!draft.trim()) return;
    if (!activeThread) {
      const response = await fetch("/api/message-threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: en
            ? "My Mémoire Maison project"
            : "Mon projet Mémoire Maison",
          body: draft,
        }),
      });
      if (response.ok) {
        const result = await response.json() as {id:string};
        setDraft("");
        setActiveThread(result.id);
        await refresh();
      }
      return;
    }
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: activeThread, body: draft }),
    });
    if (response.ok) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          body: draft,
          sender_id: "me",
          created_at: new Date().toISOString(),
          is_mine: true,
        },
      ]);
      setDraft("");
    }
  };
  return (
    <main className="profile-page">
      <aside className="profile-nav">
        <div className="profile-person">
          <span>
            {(profile.display_name || name).slice(0, 2).toUpperCase()}
          </span>
          <div>
            <b>{profile.display_name || name}</b>
            <small>{email}</small>
          </div>
        </div>
        <mark className="demo-badge">
          {en ? "SECURE ACCOUNT" : "COMPTE SÉCURISÉ"}
        </mark>
        <nav>
          <button
            className={tab === "projects" ? "active" : ""}
            onClick={() => setTab("projects")}
          >
            ⌂ {en ? "My projects" : "Mes projets"}
          </button>
          <button
            className={tab === "orders" ? "active" : ""}
            onClick={() => setTab("orders")}
          >
            □ {en ? "My orders" : "Mes commandes"}
          </button>
          <button
            className={tab === "messages" ? "active" : ""}
            onClick={() => setTab("messages")}
          >
            ◉ {en ? "Messages" : "Messagerie"}
          </button>
          <button
            className={tab === "account" ? "active" : ""}
            onClick={() => setTab("account")}
          >
            ◎ {en ? "My account" : "Mon compte"}
          </button>
        </nav>
        <a href="/auth/sign-out">{en ? "Sign out" : "Se déconnecter"}</a>
      </aside>
      <section className="profile-content">
        <div className="profile-heading">
          <div>
            <p className="eyebrow">{en ? "My space" : "Mon espace"}</p>
            <h1>
              {tab === "projects"
                ? en
                  ? "Your stories."
                  : "Vos histoires."
                : tab === "orders"
                  ? en
                    ? "Your orders."
                    : "Vos commandes."
                  : tab === "messages"
                    ? en
                      ? "Your messages."
                      : "Vos messages."
                    : en
                      ? "Your account."
                      : "Votre compte."}
            </h1>
          </div>
          <Link className="button" href={en ? "/en/studio" : "/atelier"}>
            ＋ {en ? "New book" : "Nouveau livre"}
          </Link>
        </div>
        {notice ? <p className="cloud-notice">{notice}</p> : null}
        {tab === "projects" ? (
          <div className="real-projects">
            {loading ? (
              <article className="panel">
                <h2>{en ? "Loading…" : "Chargement…"}</h2>
              </article>
            ) : projects.length ? (
              projects.map((project) => (
                <article className="panel real-project-card" key={project.id}>
                  <div className="mini-book forest">
                    <span>MM</span>
                  </div>
                  <div>
                    <p className="eyebrow">
                      {project.collection} · {project.progress}%
                    </p>
                    <h2>{project.title}</h2>
                    <p>
                      {project.address ||
                        (en ? "Address to complete" : "Adresse à compléter")}
                    </p>
                    <div className="progress">
                      <i style={{ width: `${project.progress}%` }} />
                    </div>
                    <div className="profile-buttons">
                      <Link
                        className="button button-small"
                        href={`${en ? "/en/preview" : "/apercu"}?project=${project.id}`}
                      >
                        {en ? "Open proof →" : "Ouvrir l’aperçu →"}
                      </Link>
                    </div>
                  </div>
                  <mark>{project.status}</mark>
                </article>
              ))
            ) : (
              <article className="panel empty-project">
                <span className="brand-mark">M</span>
                <h2>
                  {en
                    ? "Your first story starts here."
                    : "Votre première histoire commence ici."}
                </h2>
                <Link className="button" href={en ? "/en/studio" : "/atelier"}>
                  {en ? "Create my book →" : "Créer mon livre →"}
                </Link>
              </article>
            )}
          </div>
        ) : null}
        {tab === "orders" ? (
          <div className="customer-orders-real">
            {orders.length ? (
              orders.map((order) => (
                <article className="customer-order compact" key={order.id}>
                  <header>
                    <span>
                      <small>{en ? "Order" : "Commande"}</small>
                      <b>{order.order_number}</b>
                    </span>
                    <mark>{order.status}</mark>
                    <strong>{formatCad(order.total_cents, locale)}</strong>
                  </header>
                  <p>
                    {order.quantity} {en ? "copy/copies" : "exemplaire(s)"} ·{" "}
                    {new Date(order.created_at).toLocaleDateString(
                      en ? "en-CA" : "fr-CA",
                    )}
                  </p>
                  {order.tracking_url ? (
                    <a href={order.tracking_url}>
                      {en ? "Track shipment" : "Suivre la livraison"}
                    </a>
                  ) : (
                    <small>
                      {en
                        ? "Payment and printing are not active yet."
                        : "Paiement et impression non activés pour le moment."}
                    </small>
                  )}
                </article>
              ))
            ) : (
              <article className="panel empty-project">
                <h2>
                  {en ? "No order yet." : "Aucune commande pour le moment."}
                </h2>
                <p>
                  {en
                    ? "Approve a proof to prepare your first order."
                    : "Approuvez un aperçu pour préparer votre première commande."}
                </p>
              </article>
            )}
          </div>
        ) : null}
        {tab === "messages" ? (
          <div className="customer-chat real-chat">
            <header>
              <select
                value={activeThread}
                onChange={(event) => {
                  setActiveThread(event.target.value);
                  setMessages([]);
                }}
              >
                <option value="">
                  {en ? "New conversation" : "Nouvelle conversation"}
                </option>
                {threads.map((thread) => (
                  <option value={thread.id} key={thread.id}>
                    {thread.subject}
                  </option>
                ))}
              </select>
            </header>
            <div className="messages">
              {messages.map((item) => (
                <p className={item.is_mine ? "sent" : "received"} key={item.id}>
                  {item.body}
                </p>
              ))}
              {!messages.length ? (
                <p className="received">
                  {en
                    ? "Write to Emilie’s team. Your conversation stays attached to your account."
                    : "Écrivez à l’équipe d’Emilie. La conversation restera dans votre compte."}
                </p>
              ) : null}
            </div>
            <div className="message-composer">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={en ? "Write a message…" : "Écrire un message…"}
              />
              <button onClick={send}>{en ? "Send" : "Envoyer"}</button>
            </div>
          </div>
        ) : null}
        {tab === "account" ? (
          <form className="profile-settings" onSubmit={saveProfile}>
            <article className="panel">
              <h2>
                {en ? "Personal information" : "Informations personnelles"}
              </h2>
              <div className="form-grid">
                <label>
                  {en ? "Full name" : "Nom complet"}
                  <input
                    value={profile.display_name || ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        display_name: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Email
                  <input value={email} readOnly />
                </label>
                <label>
                  {en ? "Phone" : "Téléphone"}
                  <input
                    value={profile.phone || ""}
                    onChange={(event) =>
                      setProfile({ ...profile, phone: event.target.value })
                    }
                  />
                </label>
                <label>
                  {en ? "Language" : "Langue"}
                  <select
                    value={profile.preferred_locale}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        preferred_locale: event.target.value as "fr" | "en",
                      })
                    }
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="wide">
                  {en ? "Address" : "Adresse"}
                  <input
                    value={profile.shipping_address.street1 || ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        shipping_address: {
                          ...profile.shipping_address,
                          street1: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {en ? "City" : "Ville"}
                  <input
                    value={profile.shipping_address.city || ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        shipping_address: {
                          ...profile.shipping_address,
                          city: event.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {en ? "Province / State" : "Province / État"}
                  <input
                    value={profile.shipping_address.regionCode || ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        shipping_address: {
                          ...profile.shipping_address,
                          regionCode: event.target.value.toUpperCase(),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {en ? "Country" : "Pays"}
                  <input
                    value={profile.shipping_address.countryCode || ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        shipping_address: {
                          ...profile.shipping_address,
                          countryCode: event.target.value.toUpperCase(),
                        },
                      })
                    }
                  />
                </label>
                <label>
                  {en ? "Postal code" : "Code postal"}
                  <input
                    value={profile.shipping_address.postalCode || ""}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        shipping_address: {
                          ...profile.shipping_address,
                          postalCode: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </div>
              <button className="button button-small">
                {en ? "Save" : "Enregistrer"}
              </button>
            </article>
            <article className="panel">
              <h2>{en ? "Privacy & data" : "Confidentialité et données"}</h2>
              <a className="button button-small" href="/api/account/export">
                {en ? "Download my data" : "Télécharger mes données"}
              </a>
            </article>
          </form>
        ) : null}
      </section>
    </main>
  );
}
