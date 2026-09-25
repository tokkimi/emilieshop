import { PDFDocument, StandardFonts, clip, cmyk, endPath, popGraphicsState, pushGraphicsState, rectangle, type PDFImage, type PDFPage, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import { ensureCompleteBook, type BookMedia, type BookPage, type GeneratedBook } from './book';

const POINTS_PER_INCH = 72;
const INTERIOR_SIZE = 8.75 * POINTS_PER_INCH;
const TRIM_INSET = 0.125 * POINTS_PER_INCH;
const SAFE_INSET = 0.5 * POINTS_PER_INCH;

type LoadedMedia = { bytes: Uint8Array; contentType: string; widthPx?: number; heightPx?: number };
type MediaLoader = (item: BookMedia) => Promise<LoadedMedia | null>;
type Embedded = { image: PDFImage; widthPx?: number; heightPx?: number };

export type PrintPdfInput = {
  book: GeneratedBook;
  coverWidth: number;
  coverHeight: number;
  memoryUrl: string;
  loadMedia: MediaLoader;
};

export type PrintPdfResult = {
  interior: Uint8Array;
  cover: Uint8Array;
  warnings: string[];
  pageCount: number;
};

const palette: Record<string, { dark: ReturnType<typeof cmyk>; light: ReturnType<typeof cmyk>; accent: ReturnType<typeof cmyk> }> = {
  forest: { dark: cmyk(.74, .42, .67, .43), light: cmyk(.05, .03, .08, 0), accent: cmyk(.33, .08, .35, .05) },
  clay: { dark: cmyk(.22, .67, .58, .28), light: cmyk(.04, .08, .08, 0), accent: cmyk(.12, .45, .40, .04) },
  linen: { dark: cmyk(.44, .38, .39, .42), light: cmyk(.03, .03, .05, 0), accent: cmyk(.17, .20, .29, .05) },
  midnight: { dark: cmyk(.83, .65, .39, .49), light: cmyk(.05, .03, .02, 0), accent: cmyk(.49, .31, .13, .11) },
};
type PrintPalette = (typeof palette)[string];

function printable(value: string) {
  return value
    .normalize('NFC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function lines(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 20) {
  const result: string[] = [];
  for (const paragraph of printable(text).split(/\n+/)) {
    let current = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
      else {
        if (current) result.push(current);
        current = word;
      }
      if (result.length >= maxLines) break;
    }
    if (current && result.length < maxLines) result.push(current);
    if (result.length >= maxLines) break;
  }
  if (result.length === maxLines && font.widthOfTextAtSize(result[maxLines - 1], size) > maxWidth - 15) {
    result[maxLines - 1] = `${result[maxLines - 1].slice(0, -4)}...`;
  }
  return result;
}

function drawWrapped(page: PDFPage, text: string, options: { x: number; y: number; width: number; font: PDFFont; size: number; leading?: number; color?: ReturnType<typeof cmyk>; maxLines?: number }) {
  const leading = options.leading || options.size * 1.35;
  const wrapped = lines(text, options.font, options.size, options.width, options.maxLines);
  wrapped.forEach((line, index) => page.drawText(line, { x: options.x, y: options.y - index * leading, size: options.size, font: options.font, color: options.color || cmyk(0, 0, 0, .82) }));
  return options.y - wrapped.length * leading;
}

function drawImageCrop(page: PDFPage, image: PDFImage, box: { x: number; y: number; width: number; height: number }) {
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.pushOperators(pushGraphicsState(), rectangle(box.x, box.y, box.width, box.height), clip(), endPath());
  page.drawImage(image, { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height });
  page.pushOperators(popGraphicsState());
}

async function embedMedia(document: PDFDocument, book: GeneratedBook, loadMedia: MediaLoader, warnings: string[]) {
  const embedded = new Map<string, Embedded>();
  for (const item of book.media.filter((media) => media.kind === 'photo')) {
    const loaded = await loadMedia(item);
    if (!loaded) { warnings.push(`Photo indisponible: ${item.name}`); continue; }
    try {
      const image = loaded.contentType.includes('png') ? await document.embedPng(loaded.bytes) : await document.embedJpg(loaded.bytes);
      embedded.set(item.id, { image, widthPx: loaded.widthPx, heightPx: loaded.heightPx });
      if (Math.min(image.width, image.height) < 1200) warnings.push(`Résolution faible pour l'impression: ${item.name} (${Math.round(image.width)} x ${Math.round(image.height)} px)`);
    } catch {
      warnings.push(`Format photo non imprimable: ${item.name}. Utilisez JPEG ou PNG.`);
    }
  }
  return embedded;
}

function drawPhotoBox(page: PDFPage, item: Embedded | undefined, box: { x: number; y: number; width: number; height: number }, background = cmyk(.05, .03, .05, .03)) {
  if (item) drawImageCrop(page, item.image, box);
  else page.drawRectangle({ ...box, color: background });
}

function pagePhotos(page: BookPage, embedded: Map<string, Embedded>) {
  return page.mediaIds.map((id) => embedded.get(id)).filter((item): item is Embedded => Boolean(item));
}

function drawInteriorPage(target: PDFPage, content: BookPage, pageNumber: number, embedded: Map<string, Embedded>, fonts: { serif: PDFFont; serifBold: PDFFont; sans: PDFFont; sansBold: PDFFont }, colors: PrintPalette) {
  const photos = pagePhotos(content, embedded);
  const width = INTERIOR_SIZE;
  const height = INTERIOR_SIZE;
  target.drawRectangle({ x: 0, y: 0, width, height, color: colors.light });
  const safe = TRIM_INSET + SAFE_INSET;
  const usable = width - safe * 2;

  if (content.layout === 'full-photo') {
    drawPhotoBox(target, photos[0], { x: 0, y: 0, width, height }, colors.dark);
    target.drawRectangle({ x: 0, y: 0, width, height: 230, color: colors.dark, opacity: .88 });
    target.drawText(printable(content.eyebrow || 'MEMOIRE MAISON').toUpperCase(), { x: safe, y: 184, font: fonts.sansBold, size: 9, color: cmyk(0, 0, 0, 0) });
    drawWrapped(target, content.title, { x: safe, y: 154, width: usable, font: fonts.serifBold, size: 27, leading: 29, color: cmyk(0, 0, 0, 0), maxLines: 2 });
    drawWrapped(target, content.body, { x: safe, y: 92, width: usable, font: fonts.serif, size: 10.5, leading: 14.5, color: cmyk(0, 0, 0, .05), maxLines: 4 });
  } else if (content.layout === 'split') {
    const photoWidth = width * .47;
    drawPhotoBox(target, photos[0], { x: 0, y: 0, width: photoWidth, height });
    const x = photoWidth + 42;
    target.drawText(printable(content.eyebrow || '').toUpperCase(), { x, y: height - safe, font: fonts.sansBold, size: 8.5, color: colors.accent });
    const afterTitle = drawWrapped(target, content.title, { x, y: height - safe - 38, width: width - x - safe, font: fonts.serifBold, size: 26, leading: 29, color: colors.dark, maxLines: 4 });
    drawWrapped(target, content.quote || content.body, { x, y: afterTitle - 28, width: width - x - safe, font: content.quote ? fonts.serif : fonts.sans, size: content.quote ? 15 : 10.5, leading: content.quote ? 20 : 15, color: cmyk(.05, .02, .02, .68), maxLines: 11 });
  } else if (content.layout === 'collage') {
    const gap = 8;
    const photoHeight = height * .52;
    const cellWidth = (width - gap) / 2;
    const cellHeight = (photoHeight - gap) / 2;
    for (let index = 0; index < 4; index += 1) drawPhotoBox(target, photos[index], { x: (index % 2) * (cellWidth + gap), y: height - photoHeight + Math.floor(index / 2) * (cellHeight + gap), width: cellWidth, height: cellHeight });
    target.drawText(printable(content.eyebrow || '').toUpperCase(), { x: safe, y: height - photoHeight - 40, font: fonts.sansBold, size: 8.5, color: colors.accent });
    drawWrapped(target, content.title, { x: safe, y: height - photoHeight - 74, width: usable * .45, font: fonts.serifBold, size: 24, leading: 27, color: colors.dark, maxLines: 3 });
    drawWrapped(target, content.body, { x: safe + usable * .5, y: height - photoHeight - 45, width: usable * .5, font: fonts.sans, size: 10, leading: 14, maxLines: 11 });
  } else if (content.layout === 'minimal') {
    target.drawRectangle({ x: safe, y: safe, width: 2, height: height - safe * 2, color: colors.accent });
    target.drawText(printable(content.eyebrow || '').toUpperCase(), { x: safe + 34, y: height - safe - 25, font: fonts.sansBold, size: 9, color: colors.accent });
    const afterTitle = drawWrapped(target, content.title, { x: safe + 34, y: height - safe - 85, width: usable - 60, font: fonts.serifBold, size: 34, leading: 38, color: colors.dark, maxLines: 4 });
    drawWrapped(target, content.quote || content.body, { x: safe + 34, y: afterTitle - 45, width: usable - 80, font: content.quote ? fonts.serif : fonts.sans, size: content.quote ? 17 : 11, leading: content.quote ? 23 : 16, maxLines: 13 });
  } else {
    const imageHeight = height * .49;
    drawPhotoBox(target, photos[0], { x: 0, y: height - imageHeight, width, height: imageHeight });
    target.drawText(printable(content.eyebrow || '').toUpperCase(), { x: safe, y: height - imageHeight - 39, font: fonts.sansBold, size: 8.5, color: colors.accent });
    drawWrapped(target, content.title, { x: safe, y: height - imageHeight - 76, width: usable * .44, font: fonts.serifBold, size: 25, leading: 28, color: colors.dark, maxLines: 4 });
    drawWrapped(target, content.body, { x: safe + usable * .51, y: height - imageHeight - 42, width: usable * .49, font: fonts.sans, size: 10, leading: 14.5, maxLines: 13 });
  }

  target.drawText(String(pageNumber), { x: pageNumber % 2 ? width - safe - 8 : safe, y: TRIM_INSET + 15, size: 8, font: fonts.sans, color: cmyk(0, 0, 0, .45) });
}

export async function buildPrintPdfs(input: PrintPdfInput): Promise<PrintPdfResult> {
  const book = ensureCompleteBook(input.book);
  const warnings: string[] = [];
  const interiorDocument = await PDFDocument.create();
  interiorDocument.setTitle(printable(book.title));
  interiorDocument.setAuthor('Emilie Cauvier Inc.');
  interiorDocument.setCreator('Mémoire Maison');
  interiorDocument.setProducer('Mémoire Maison print pipeline');
  const fonts = {
    serif: await interiorDocument.embedFont(StandardFonts.TimesRoman),
    serifBold: await interiorDocument.embedFont(StandardFonts.TimesRomanBold),
    sans: await interiorDocument.embedFont(StandardFonts.Helvetica),
    sansBold: await interiorDocument.embedFont(StandardFonts.HelveticaBold),
  };
  const embedded = await embedMedia(interiorDocument, book, input.loadMedia, warnings);
  const colors = palette[book.coverColor] || palette.forest;
  const interiorPages = book.pages.filter((page) => page.kind !== 'cover').slice(0, 24);
  while (interiorPages.length < 24) interiorPages.push({ id: `blank-${interiorPages.length}`, kind: 'story', title: '', body: '', mediaIds: [], layout: 'minimal' });
  interiorPages.forEach((content, index) => drawInteriorPage(interiorDocument.addPage([INTERIOR_SIZE, INTERIOR_SIZE]), content, index + 1, embedded, fonts, colors));

  const coverDocument = await PDFDocument.create();
  coverDocument.setTitle(`${printable(book.title)} - couverture`);
  coverDocument.setAuthor('Emilie Cauvier Inc.');
  const coverFonts = {
    serif: await coverDocument.embedFont(StandardFonts.TimesRoman),
    serifBold: await coverDocument.embedFont(StandardFonts.TimesRomanBold),
    sans: await coverDocument.embedFont(StandardFonts.Helvetica),
    sansBold: await coverDocument.embedFont(StandardFonts.HelveticaBold),
  };
  const coverEmbedded = await embedMedia(coverDocument, book, input.loadMedia, warnings);
  const coverPage = coverDocument.addPage([input.coverWidth, input.coverHeight]);
  coverPage.drawRectangle({ x: 0, y: 0, width: input.coverWidth, height: input.coverHeight, color: colors.dark });
  const frontX = input.coverWidth / 2;
  const frontWidth = input.coverWidth - frontX;
  const coverPhotoId = book.pages.find((page) => page.kind === 'cover')?.mediaIds[0];
  const coverPhoto = coverPhotoId ? coverEmbedded.get(coverPhotoId) : undefined;
  if (coverPhoto) {
    drawPhotoBox(coverPage, coverPhoto, { x: frontX, y: 0, width: frontWidth, height: input.coverHeight }, colors.dark);
    coverPage.drawRectangle({ x: frontX, y: 0, width: frontWidth, height: input.coverHeight, color: colors.dark, opacity: .36 });
  }
  const coverSafe = .75 * POINTS_PER_INCH;
  coverPage.drawText('MEMOIRE MAISON', { x: frontX + coverSafe, y: input.coverHeight - coverSafe - 12, font: coverFonts.sansBold, size: 9, color: cmyk(0, 0, 0, 0) });
  const titleY = input.coverHeight * .55;
  const titleSize = Math.max(28, Math.min(46, frontWidth / 8.4));
  drawWrapped(coverPage, book.title, { x: frontX + coverSafe, y: titleY, width: frontWidth - coverSafe * 2, font: coverFonts.serifBold, size: titleSize, leading: titleSize * 1.03, color: cmyk(0, 0, 0, 0), maxLines: 4 });
  drawWrapped(coverPage, [book.address, book.subtitle].filter(Boolean).join(' - '), { x: frontX + coverSafe, y: input.coverHeight * .24, width: frontWidth - coverSafe * 2, font: coverFonts.sans, size: 11, leading: 15, color: cmyk(0, 0, 0, .04), maxLines: 3 });
  coverPage.drawText('Chaque maison a une histoire.', { x: coverSafe, y: input.coverHeight - coverSafe - 12, font: coverFonts.serif, size: 17, color: cmyk(0, 0, 0, .04) });
  drawWrapped(coverPage, 'Un livre souvenir personnel, compose avec vos photos, vos mots et les voix de votre famille.', { x: coverSafe, y: input.coverHeight * .55, width: input.coverWidth / 2 - coverSafe * 2, font: coverFonts.serif, size: 13, leading: 19, color: cmyk(0, 0, 0, .04), maxLines: 6 });
  try {
    const qrData = await QRCode.toDataURL(input.memoryUrl, { width: 640, margin: 1, errorCorrectionLevel: 'H', color: { dark: '#16271F', light: '#FFFFFF' } });
    const qr = await coverDocument.embedPng(Uint8Array.from(Buffer.from(qrData.split(',')[1], 'base64')));
    coverPage.drawImage(qr, { x: coverSafe, y: coverSafe, width: 72, height: 72 });
    coverPage.drawText('PHOTOS - FILMS - VOIX', { x: coverSafe + 86, y: coverSafe + 43, font: coverFonts.sansBold, size: 8, color: cmyk(0, 0, 0, .05) });
    coverPage.drawText('Memory Link prive', { x: coverSafe + 86, y: coverSafe + 23, font: coverFonts.sans, size: 10, color: cmyk(0, 0, 0, .08) });
  } catch { warnings.push('Le QR Memory Link n’a pas pu être ajouté à la couverture.'); }

  return {
    interior: await interiorDocument.save({ useObjectStreams: false }),
    cover: await coverDocument.save({ useObjectStreams: false }),
    warnings: Array.from(new Set(warnings)),
    pageCount: 24,
  };
}
