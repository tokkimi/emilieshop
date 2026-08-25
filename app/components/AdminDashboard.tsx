'use client';

import { useState } from 'react';
import Link from 'next/link';

const projects = [
  { client: 'Sophie & Marc', address: '284, rue des Érables', status: 'À relire', progress: 72, due: '28 août', product: 'Souvenir' },
  { client: 'Amélie Roy', address: '19, avenue du Parc', status: 'Aperçu envoyé', progress: 90, due: '29 août', product: 'Heritage' },
  { client: 'Famille Gagnon', address: '62, chemin du Lac', status: 'Photos reçues', progress: 48, due: '2 sept.', product: 'Famille' },
  { client: 'Julie Tremblay', address: '731, rue Saint-Joseph', status: 'En impression', progress: 100, due: '4 sept.', product: 'Essentiel' },
];

export function AdminDashboard({ name }: { name: string }) {
  const [section, setSection] = useState('Vue d’ensemble');
  const menu = ['Vue d’ensemble', 'Projets', 'Commandes', 'Clients', 'Professionnels', 'Production', 'Memory Links', 'Contenus', 'Finances'];
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar"><Link className="studio-brand" href="/"><span className="brand-mark">M</span><span>Mémoire<br />Maison</span></Link><small>ADMINISTRATION</small><nav>{menu.map((item) => <button key={item} className={section === item ? 'active' : ''} onClick={() => setSection(item)}><span>{item === 'Vue d’ensemble' ? '⌂' : item === 'Projets' ? '▤' : item === 'Commandes' ? '□' : item === 'Clients' ? '◎' : item === 'Professionnels' ? '◇' : item === 'Production' ? '◫' : item === 'Memory Links' ? '⌁' : item === 'Contenus' ? '✦' : '$'}</span>{item}</button>)}</nav><div className="admin-account"><span>EC</span><p><b>{name}</b><small>Administratrice</small></p></div></aside>
      <main className="admin-main">
        <header className="admin-top"><div><p>Bonjour {name.split(' ')[0]} 👋</p><small>Mardi 25 août 2026 · Les priorités du jour</small></div><div><button className="icon-button">⌕</button><button className="icon-button">♢<i>3</i></button><Link className="button button-small" href="/atelier">＋ Nouveau projet</Link></div></header>
        <div className="admin-body">
          <div className="admin-title-row"><div><p className="eyebrow">{section}</p><h1>{section === 'Vue d’ensemble' ? 'L’atelier en un coup d’œil.' : section}</h1></div><select aria-label="Période"><option>Ce mois-ci</option><option>Cette semaine</option><option>Cette année</option></select></div>
          {section !== 'Vue d’ensemble' && <div className="empty-panel"><span>✦</span><h2>{section}</h2><p>Cette section est prête à recevoir les données réelles de la plateforme. Les filtres, exports, actions en lot et permissions seront accessibles ici.</p><button className="button">Configurer {section.toLowerCase()}</button></div>}
          {section === 'Vue d’ensemble' && <>
            <section className="metric-grid"><article><span className="metric-icon sage">▤</span><p>Projets actifs</p><b>24</b><small><i>+ 12 %</i> vs mois dernier</small></article><article><span className="metric-icon gold">□</span><p>À valider aujourd’hui</p><b>6</b><small>3 aperçus · 3 récits</small></article><article><span className="metric-icon clay">$</span><p>Chiffre d’affaires</p><b>8 642 $</b><small><i>+ 18 %</i> vs mois dernier</small></article><article><span className="metric-icon ink">◇</span><p>Crédits B2B utilisés</p><b>37 / 65</b><small>8 courtiers actifs</small></article></section>
            <section className="admin-grid"><article className="panel project-panel"><div className="panel-head"><div><h2>Projets à suivre</h2><p>Les dossiers qui demandent votre attention</p></div><button>Voir tous →</button></div><div className="project-table"><div className="table-head"><span>Client & propriété</span><span>Offre</span><span>Progression</span><span>Statut</span><span>Échéance</span></div>{projects.map((project) => <div className="table-row" key={project.address}><span><i>{project.client.split(' ').map((word) => word[0]).join('').slice(0,2)}</i><b>{project.client}<small>{project.address}</small></b></span><span>{project.product}</span><span><em><i style={{ width: `${project.progress}%` }} /></em>{project.progress}%</span><span><mark>{project.status}</mark></span><span>{project.due}</span></div>)}</div></article><article className="panel activity-panel"><div className="panel-head"><div><h2>Activité récente</h2><p>Les dernières 24 heures</p></div></div><ul><li><span>✓</span><p><b>Aperçu approuvé</b><small>Amélie Roy · il y a 18 min</small></p></li><li><span>▧</span><p><b>18 photos ajoutées</b><small>Famille Gagnon · il y a 1 h</small></p></li><li><span>$</span><p><b>Commande de 278 $</b><small>Sophie & Marc · il y a 3 h</small></p></li><li><span>◇</span><p><b>10 crédits achetés</b><small>Équipe Beaulieu · hier</small></p></li></ul></article></section>
            <section className="admin-grid lower"><article className="panel production-panel"><div className="panel-head"><div><h2>Chaîne de production</h2><p>32 projets en circulation</p></div></div><div className="pipeline">{[['Questionnaire',8],['Récit & contrôle',6],['Mise en page',7],['Validation',5],['Impression',4],['Expédition',2]].map(([label,count]) => <div key={label}><b>{count}</b><span>{label}</span></div>)}</div></article><article className="panel b2b-panel"><div><p className="eyebrow">B2B</p><h2>3 invitations vendeurs<br />à relancer</h2><p>Deux crédits expirent dans moins de 30 jours.</p><button>Ouvrir le portail pro →</button></div><span className="credit-ring">57%<small>crédits<br />utilisés</small></span></article></section>
          </>}
        </div>
      </main>
    </div>
  );
}
