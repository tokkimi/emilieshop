import Link from './components/SafeLink';
import { SiteFooter, SiteHeader } from './components/SiteHeader';

const steps = [
  ['01', 'Racontez', 'Dix questions douces, par écrit ou avec votre voix.'],
  ['02', 'Rassemblez', 'Ajoutez les photos, vidéos et détails qui rendent ce lieu unique.'],
  ['03', 'Découvrez', 'Votre histoire prend forme dans une première maquette complète.'],
  ['04', 'Validez', 'Relisez et modifiez chaque page avant toute impression.'],
];

const books = [
  ['Essentiel', 'Le livre qui rassemble.', '20 à 30 pages, couverture rigide et aperçu numérique.', '149 $'],
  ['Souvenir', 'Une finition plus précieuse.', 'Papier premium, détails personnalisés et copie famille.', '199 $'],
  ['Famille', 'À transmettre entre générations.', 'Plusieurs exemplaires, coffret et archive numérique.', '249 $'],
];

export default function Home() {
  return <><SiteHeader homeThemes /><main className="home-page">
    <section className="premium-hero">
      <div className="premium-hero-copy">
        <p className="eyebrow">Livres souvenirs personnalisés · Québec</p>
        <h1>Chaque maison<br />a une histoire.</h1>
        <p className="hero-lead">Un livre d’exception créé à partir de vos photos, de vos mots et de votre voix — pour emporter avec vous tout ce qu’une adresse ne raconte pas.</p>
        <div className="hero-actions"><Link className="button" href="/atelier">Commencer mon histoire <span>→</span></Link><a className="quiet-link" href="#comment">Découvrir l’expérience <span>→</span></a></div>
        <div className="premium-signature"><span>01</span><p><b>Créé avec soin</b>Votre histoire reste la vôtre, jusqu’au dernier mot.</p></div>
      </div>
      <div className="premium-hero-media"><img src="/memory-book-hero-v2.jpg" alt="Livres souvenirs Mémoire Maison dans un intérieur lumineux" /><div className="image-caption"><span>COLLECTION 2026</span><b>Le beau livre d’une vie à la maison.</b></div></div>
    </section>

    <section className="trust-strip"><p><span>01</span> Vos mots, vos souvenirs</p><p><span>02</span> Une création accompagnée</p><p><span>03</span> Votre validation avant impression</p></section>

    <section className="premium-process" id="comment">
      <div className="section-heading"><p className="eyebrow">Simple dès le premier souvenir</p><h2>Vous racontez.<br /><em>Nous composons.</em></h2><p>Quelques minutes suffisent pour commencer. Vous ajoutez vos souvenirs à votre rythme et gardez le dernier mot à chaque étape.</p></div>
      <div className="premium-steps">{steps.map(([number, title, text]) => <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
      <Link className="button outline" href="/atelier">Découvrir l’atelier →</Link>
    </section>

    <section className="premium-collection" id="collections">
      <div className="collection-heading"><p className="eyebrow">Trois façons de transmettre</p><h2>Une collection pensée<br />comme un objet d’édition.</h2></div>
      <figure><img src="/memory-book-collection-v2.jpg" alt="Collection de trois livres souvenirs en lin ivoire, bordeaux et bleu nuit" /><figcaption>Lin ivoire · Bordeaux profond · Bleu nuit</figcaption></figure>
      <div className="collection-notes"><p><b>Notre Maison</b>Pour le lieu que l’on s’apprête à quitter.</p><p><b>Notre Première Maison</b>Pour le chapitre où tout a commencé.</p><p><b>Maison de Famille</b>Pour transmettre l’histoire entre générations.</p></div>
    </section>

    <section className="premium-memory-link">
      <div className="memory-photo-wrap"><img src="/memory-link-v2.jpg" alt="Livre photo ouvert et Memory Link privé sur téléphone" /><Link href="/memory/demo" aria-label="Explorer le Memory Link"><span>▶</span> Voir la démonstration</Link></div>
      <div className="memory-link-copy"><p className="eyebrow">Nouveau · Memory Link</p><h2>Le livre se referme.<br /><em>Les souvenirs continuent.</em></h2><p>Un QR code discret ouvre une archive privée de votre famille : photos, mini-film, récit et voix de ceux qui racontent.</p><ul><li><span>✓</span> Une page privée à transmettre aux proches</li><li><span>✓</span> Un lien qui évolue sans réimprimer le QR</li><li><span>✓</span> Carte premium ou porte-clé QR/NFC</li></ul><Link className="quiet-link" href="/memory/demo">Explorer un Memory Link →</Link></div>
    </section>

    <section className="premium-books">
      <div className="section-heading"><p className="eyebrow">Les livres</p><h2>Choisissez la place<br />que prendra votre histoire.</h2></div>
      <div className="premium-book-grid">{books.map(([name, title, text, price], index) => <article key={name} className={index === 1 ? 'is-featured' : ''}><div className={`book-crop crop-${index + 1}`}><img src="/memory-book-collection-v2.jpg" alt="" /></div>{index === 1 ? <span className="popular">LE PLUS AIMÉ</span> : null}<p className="eyebrow">{name}</p><h3>{title}</h3><p>{text}</p><b>À partir de {price}</b><Link href="/atelier">Choisir {name} →</Link></article>)}</div>
    </section>

    <section className="premium-story">
      <div className="story-photo"><img src="/family-memories-v2.jpg" alt="Une famille regarde ses photographies avant un déménagement" /><span>Les souvenirs qui nous suivent</span></div>
      <div className="story-copy"><span className="big-quote">“</span><blockquote>Je pensais que j’allais pleurer en voyant la maison. J’ai surtout souri en redécouvrant tout ce qu’on y avait vécu.</blockquote><p>— Sophie, projet pilote à Québec</p></div>
    </section>

    <section className="premium-professionals"><div><p className="eyebrow">Courtiers & agences</p><h2>Offrez une histoire,<br />pas un objet de plus.</h2><p>Une expérience de clôture profondément personnelle, entièrement prise en charge de l’invitation jusqu’à la livraison.</p><Link className="button light" href="/professionnels">L’offre professionnelle →</Link></div></section>

    <section className="faq-section"><div><p className="eyebrow">Questions fréquentes</p><h2>Avant de<br />commencer.</h2></div><div className="faq-list"><details open><summary>Est-ce que mes souvenirs sont inventés ou modifiés ?<span>−</span></summary><p>Jamais. Nous pouvons fluidifier et organiser vos mots, mais chaque personne, date et émotion vient de vos réponses. Vous validez tout avant impression.</p></details><details><summary>Combien de temps faut-il pour répondre ?<span>+</span></summary><p>Environ dix minutes pour commencer. Vous pouvez enregistrer votre progression et revenir plus tard.</p></details><details><summary>Puis-je modifier le livre avant impression ?<span>+</span></summary><p>Oui. Remplacez une photo, corrigez un texte et approuvez la version exacte qui partira en impression.</p></details><details><summary>Comment fonctionne le Memory Link ?<span>+</span></summary><p>Un QR code ou une puce NFC ouvre une page privée contenant uniquement les souvenirs autorisés par la famille.</p></details></div></section>

    <section className="premium-final"><img src="/quebec-home-v2.jpg" alt="Maison familiale québécoise au coucher du soleil" /><div><p className="eyebrow">Votre prochain chapitre peut commencer</p><h2>Gardez l’histoire.<br />Emportez-la avec vous.</h2><Link className="button light" href="/atelier">Créer mon livre souvenir →</Link></div></section>
  </main><SiteFooter /></>;
}
