import { WorksWheel, type WorksWheelItem } from '@/components/ui/works-wheel';
import Link from './SafeLink';

const LAPS = 4;

type Book = { name: string; title: string; text: string; price: string; focus: string };

const copy = {
  fr: {
    eyebrow: 'Les livres',
    heading: <>Choisissez la place<br />que prendra votre histoire.</>,
    hint: 'Faites tourner la roue pour découvrir chaque livre',
    label: 'Nos livres',
    action: 'Choisir',
    previous: 'Livre précédent',
    next: 'Livre suivant',
    popular: 'LE PLUS AIMÉ',
    href: '/atelier',
    price: (price: string) => `À partir de ${price}`,
    choose: (name: string) => `Choisir ${name} →`,
    books: [
      { name: 'Essentiel', title: 'Le livre qui rassemble.', text: '24 pages, couverture rigide et aperçu numérique.', price: '149 $', focus: 'left center' },
      { name: 'Souvenir', title: 'Une finition plus précieuse.', text: '24 pages, un livre rigide et Memory Link pendant 1 an.', price: '229 $', focus: 'center' },
      { name: 'Famille', title: 'À transmettre entre générations.', text: '24 pages, 2 exemplaires et Memory Link pendant 3 ans.', price: '329 $', focus: 'right center' },
    ] as Book[],
  },
  en: {
    eyebrow: 'The books',
    heading: <>Choose how your story<br />will be held.</>,
    hint: 'Turn the wheel to discover each book',
    label: 'Our books',
    action: 'Choose',
    previous: 'Previous book',
    next: 'Next book',
    popular: 'MOST LOVED',
    href: '/en/studio',
    price: (price: string) => `From ${price} CAD`,
    choose: (name: string) => `Choose ${name} →`,
    books: [
      { name: 'Essential', title: 'The book that brings it together.', text: '24 pages, one hardcover and digital proof.', price: '$149', focus: 'left center' },
      { name: 'Keepsake', title: 'A more precious finish.', text: '24 pages, one hardcover and a 1-year Memory Link.', price: '$229', focus: 'center' },
      { name: 'Family', title: 'Made for generations.', text: '24 pages, 2 copies and a 3-year Memory Link.', price: '$329', focus: 'right center' },
    ] as Book[],
  },
};

export function BookWheel({ locale = 'fr' }: { locale?: 'fr' | 'en' }) {
  const t = copy[locale];
  // The three books go round the wheel four times, so the ring closes into a
  // full circle and the drum has enough to turn. Every card keeps its offer.
  const items: WorksWheelItem[] = Array.from({ length: LAPS }, () => t.books).flat().map((book, i) => ({
    title: book.name,
    image: '/memory-book-collection-v2.jpg',
    imagePosition: book.focus,
    imageZoom: 1.9,
    href: t.href,
    details: (
      <div className="book-wheel-details">
        {i % t.books.length === 1 ? <span className="book-wheel-popular">{t.popular}</span> : null}
        <h3>{book.title}</h3>
        <p>{book.text}</p>
        <b>{t.price(book.price)}</b>
        <Link href={t.href}>{t.choose(book.name)}</Link>
      </div>
    ),
  }));

  return (
    <section className="premium-books book-wheel-section">
      <div className="section-heading"><p className="eyebrow">{t.eyebrow}</p><h2>{t.heading}</h2><p className="book-wheel-hint">{t.hint}</p></div>
      <div className="book-wheel-stage">
        <WorksWheel items={items} label={t.label} action={t.action} previousLabel={t.previous} nextLabel={t.next} aria-label={t.eyebrow} showIndex={false} scrollDriven />
      </div>
    </section>
  );
}
