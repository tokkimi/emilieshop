import { PDFDocument, StandardFonts, clip, cmyk, endPath, popGraphicsState, pushGraphicsState, rectangle, type PDFImage, type PDFPage, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import { ensureCompleteBook, type BookMedia, type BookPage, type GeneratedBook } from './book';

const POINTS_PER_INCH = 72;
// Legacy 8.5 × 11 in hardcover interior, including 0.125 in bleed on every edge.
const INTERIOR_WIDTH = 8.75 * POINTS_PER_INCH;
const INTERIOR_HEIGHT = 11.25 * POINTS_PER_INCH;
const TRIM_INSET = 0.125 * POINTS_PER_INCH;
const SAFE_INSET = 0.5 * POINTS_PER_INCH;

type LoadedMedia = { bytes: Uint8Array; contentType: string; widthPx?: number; heightPx?: number };
type MediaLoader = (item: BookMedia) => Promise<LoadedMedia | null>;
type Embedded = { image: PDFImage; widthPx?: number; heightPx?: number; fit?: 'contain' | 'cover' };

export type PrintPdfInput = {
  brandLogoPng?: Uint8Array;
  spineWidth?: number;
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
  white: { dark: cmyk(.68, .53, .61, .58), light: cmyk(0, 0, 0, 0), accent: cmyk(.33, .08, .35, .05) },
  forest: { dark: cmyk(.74, .42, .67, .43), light: cmyk(.05, .03, .08, 0), accent: cmyk(.33, .08, .35, .05) },
  clay: { dark: cmyk(.22, .67, .58, .28), light: cmyk(.04, .08, .08, 0), accent: cmyk(.12, .45, .40, .04) },
  sage: { dark: cmyk(.46, .28, .43, .20), light: cmyk(.08, .03, .09, 0), accent: cmyk(.30, .12, .31, .06) },
  black: { dark: cmyk(.70, .63, .62, .74), light: cmyk(.03, .02, .02, 0), accent: cmyk(.20, .10, .12, .20) },
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

function drawImageCrop(page: PDFPage, image: PDFImage, box: { x: number; y: number; width: number; height: number }, fit: 'contain' | 'cover' = 'contain') {
  const scale = (fit === 'cover' ? Math.max : Math.min)(box.width / image.width, box.height / image.height);
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
      embedded.set(item.id, { image, widthPx: loaded.widthPx, heightPx: loaded.heightPx, fit: item.fit });
      if (Math.min(image.width, image.height) < 1200) warnings.push(`Résolution faible pour l'impression: ${item.name} (${Math.round(image.width)} x ${Math.round(image.height)} px)`);
    } catch {
      warnings.push(`Format photo non imprimable: ${item.name}. Utilisez JPEG ou PNG.`);
    }
  }
  return embedded;
}

function drawPhotoBox(page: PDFPage, item: Embedded | undefined, box: { x: number; y: number; width: number; height: number }, background = cmyk(.05, .03, .05, .03)) {
  if (item) drawImageCrop(page, item.image, box, item.fit);
  else page.drawRectangle({ ...box, color: background });
}

function pagePhotos(page: BookPage, embedded: Map<string, Embedded>) {
  return page.mediaIds.map((id) => embedded.get(id)).filter((item): item is Embedded => Boolean(item));
}

function drawInteriorPage(target: PDFPage, content: BookPage, pageNumber: number, embedded: Map<string, Embedded>, fonts: { serif: PDFFont; serifBold: PDFFont; sans: PDFFont; sansBold: PDFFont }, colors: PrintPalette) {
  const photos = pagePhotos(content, embedded);
  const width = target.getWidth();
  const height = target.getHeight();
  target.drawRectangle({ x: 0, y: 0, width, height, color: colors.light });
  const safe = TRIM_INSET + SAFE_INSET;
  const usable = width - safe * 2;

  const photoHeight = photos.length ? height * (content.layout === 'collage' ? .54 : .52) : 0;
  if (photos.length) {
    const x=safe, y=height-safe-photoHeight, photoWidth=width-safe*2, gap=8;
    if(photos.length===1)drawPhotoBox(target,photos[0],{x,y,width:photoWidth,height:photoHeight});
    else if(photos.length===2)photos.forEach((photo,index)=>drawPhotoBox(target,photo,{x:x+index*(photoWidth+gap)/2,y,width:(photoWidth-gap)/2,height:photoHeight}));
    else photos.slice(0,4).forEach((photo,index)=>drawPhotoBox(target,photo,{x:x+(index%2)*(photoWidth+gap)/2,y:y+(1-Math.floor(index/2))*(photoHeight+gap)/2,width:(photoWidth-gap)/2,height:(photoHeight-gap)/2}));
  }
  const top = photos.length ? height-safe-photoHeight-28 : height*.68;
  const title = printable(content.title);
  target.drawText(printable(content.eyebrow||'').toUpperCase(),{x:safe,y:top,font:fonts.sans,size:8.5,color:colors.accent});
  const afterTitle=drawWrapped(target,title,{x:safe,y:top-34,width:usable,font:fonts.serif,size:27,leading:32,color:colors.dark,maxLines:3});
  const afterBody=drawWrapped(target,content.body,{x:safe,y:afterTitle-14,width:usable,font:fonts.sans,size:12,leading:18,maxLines:10});
  if(content.quote)drawWrapped(target,content.quote,{x:safe+12,y:afterBody-22,width:usable-24,font:fonts.serif,size:14,leading:20,maxLines:3});

  target.drawText(String(pageNumber), { x: pageNumber % 2 ? width - safe - 8 : safe, y: TRIM_INSET + 15, size: 8, font: fonts.sans, color: cmyk(0, 0, 0, .45) });
}

/** Prodigi BOOK-FE: single pages at trim, front + 24 content + back. No added bleed. */
export async function buildProdigiPrintPdf(input: { book: GeneratedBook; logoPng: Uint8Array; loadMedia: MediaLoader; memoryUrl: string }) {
  const document = await PDFDocument.create();
  const width = 210 / 25.4 * 72;
  const height = 297 / 25.4 * 72;
  const safe = 12 / 25.4 * 72;
  const book = ensureCompleteBook(input.book);
  const warnings: string[] = [];
  const embedded = await embedMedia(document, book, input.loadMedia, warnings);
  if (warnings.some((warning) => /indisponible|non imprimable/.test(warning))) throw new Error('Certaines photos ne peuvent pas être imprimées. Remplacez-les avant de commander.');
  const colors = palette[book.coverColor] || palette.midnight;
  const fonts = { serif: await document.embedFont(StandardFonts.TimesRoman), serifBold: await document.embedFont(StandardFonts.TimesRomanBold), sans: await document.embedFont(StandardFonts.Helvetica), sansBold: await document.embedFont(StandardFonts.HelveticaBold) };
  const front = document.addPage([width, height]);
  front.drawRectangle({ x:0,y:0,width,height,color:colors.dark });
  const photo = embedded.get(book.pages[0].mediaIds[0]);
  if (photo && book.coverStyle !== 'minimal') {
    const full = book.coverStyle === 'full-photo';
    drawPhotoBox(front, photo, { x:full?0:safe*1.5, y:height*.34, width:full?width:width-safe*3, height:height*.52 });
  }
  const white = cmyk(0,0,0,0);
  front.drawText('MÉMOIRE MAISON',{x:safe,y:height-safe-12,font:fonts.sansBold,size:9,color:white});
  const titleSize = Math.min(38, width / 15);
  const titleLines = lines(book.title,fonts.serif,titleSize,width-safe*2,8);
  if (titleLines.length>4) throw new Error('Le titre de couverture est trop long pour être imprimé lisiblement.');
  const titleY = book.coverStyle === 'minimal' ? height*.57 : height*.26;
  titleLines.forEach((line,index)=>front.drawText(line,{x:(width-fonts.serif.widthOfTextAtSize(line,titleSize))/2,y:titleY-index*titleSize*1.15,font:fonts.serif,size:titleSize,color:white}));
  drawWrapped(front,book.subtitle,{x:safe,y:Math.max(safe+25,titleY-titleLines.length*titleSize*1.15-20),width:width-safe*2,font:fonts.sans,size:11,color:white,maxLines:2});
  for (const [index,page] of book.pages.filter((page)=>page.kind!=='cover').slice(0,24).entries()) {
    const target = document.addPage([width,height]);
    // Empty photo layouts become text layouts; missing assets never produce fake images.
    const photoIds = page.mediaIds.filter((id)=>embedded.has(id));
    const content = { ...page, mediaIds:photoIds, layout: !photoIds.length ? 'minimal' as const : page.layout };
    drawInteriorPage(target,content,index+1,embedded,fonts,{...colors,light:cmyk(0,0,0,0)});
    if (page.kind==='interactive' && input.memoryUrl) {
      const qr = await document.embedPng(await QRCode.toBuffer(input.memoryUrl,{width:600,margin:1,errorCorrectionLevel:'H'}));
      target.drawImage(qr,{x:width/2-45,y:safe+40,width:90,height:90});
    }
  }
  const back = document.addPage([width,height]);
  back.drawRectangle({x:0,y:0,width,height,color:colors.dark});
  const closing = book.locale==='en'?'Every home has a story.':'Chaque maison a une histoire.';
  back.drawText(closing,{x:(width-fonts.serif.widthOfTextAtSize(closing,20))/2,y:height*.58,font:fonts.serif,size:20,color:white});
  const logo = await document.embedPng(input.logoPng);
  const logoWidth = 135; const logoHeight = logoWidth*logo.height/logo.width;
  back.drawRectangle({x:(width-logoWidth)/2-8,y:safe-8,width:logoWidth+16,height:logoHeight+16,color:white});
  back.drawImage(logo,{x:(width-logoWidth)/2,y:safe,width:logoWidth,height:logoHeight});
  document.setTitle(book.title);document.setAuthor('Emilie Cauvier Inc.');
  const pdf = await document.save();
  return { pdf, pageCount:document.getPageCount(), width, height, warnings };
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
  interiorPages.forEach((content, index) => drawInteriorPage(interiorDocument.addPage([INTERIOR_WIDTH, INTERIOR_HEIGHT]), content, index + 1, embedded, fonts, colors));

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
  const spineWidth = input.spineWidth || 0;
  const backWidth = (input.coverWidth - spineWidth) / 2;
  const frontX = backWidth + spineWidth;
  const frontWidth = input.coverWidth - frontX;
  const coverPhotoId = book.pages.find((page) => page.kind === 'cover')?.mediaIds[0];
  const coverPhoto = coverPhotoId ? coverEmbedded.get(coverPhotoId) : undefined;
  if (coverPhoto && book.coverStyle !== 'minimal') {
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
    const qrY = coverSafe + (book.printProvider === 'prodigi' ? 76 : 0);
    coverPage.drawImage(qr, { x: coverSafe, y: qrY, width: 72, height: 72 });
    coverPage.drawText('PHOTOS - FILMS - VOIX', { x: coverSafe + 86, y: qrY + 43, font: coverFonts.sansBold, size: 8, color: cmyk(0, 0, 0, .05) });
    coverPage.drawText('Memory Link prive', { x: coverSafe + 86, y: qrY + 23, font: coverFonts.sans, size: 10, color: cmyk(0, 0, 0, .08) });
  } catch { warnings.push('Le QR Memory Link n’a pas pu être ajouté à la couverture.'); }

  if (book.printProvider === 'prodigi') {
    // Mandatory, fixed brand placement on the back cover; never controlled by client text.
    if (!input.brandLogoPng) throw new Error('Le logo Mémoire Maison est obligatoire sur la couverture Prodigi.');
    const logo = await coverDocument.embedPng(input.brandLogoPng);
    const width = Math.min(108, backWidth * .34);
    const height = width * logo.height / logo.width;
    const x = (backWidth - width) / 2;
    coverPage.drawRectangle({ x: x - 8, y: coverSafe - 8, width: width + 16, height: height + 16, color: cmyk(0, 0, 0, 0) });
    coverPage.drawImage(logo, { x, y: coverSafe, width, height });
  }

  return {
    interior: await interiorDocument.save({ useObjectStreams: false }),
    cover: await coverDocument.save({ useObjectStreams: false }),
    warnings: Array.from(new Set(warnings)),
    pageCount: 24,
  };
}
