import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  LULU_DEFAULT_POD_PACKAGE_ID,
  LuluApiError,
  getLuluConfiguration,
  isTrustedProductionRequest,
  luluRequest,
} from '../../../../lib/lulu';

export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  name: z.string().min(1).max(120),
  street1: z.string().min(1).max(150),
  street2: z.string().max(150).optional(),
  city: z.string().min(1).max(100),
  stateCode: z.string().max(3).optional(),
  countryCode: z.string().length(2).transform((value) => value.toUpperCase()),
  postcode: z.string().min(1).max(64),
  phoneNumber: z.string().min(8).max(20),
  email: z.string().email().optional(),
});

const printJobSchema = z.object({
  externalId: z.string().min(1).max(100),
  contactEmail: z.string().email(),
  shippingLevel: z.enum(['MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS']).default('MAIL'),
  shippingAddress: addressSchema,
  lineItems: z.array(z.object({
    externalId: z.string().min(1).max(100),
    title: z.string().min(1).max(255),
    quantity: z.number().int().min(1).max(100),
    podPackageId: z.string().min(10).max(80).default(LULU_DEFAULT_POD_PACKAGE_ID),
    interiorUrl: z.string().url().startsWith('https://').max(2048),
    interiorMd5: z.string().regex(/^[a-fA-F0-9]{32}$/).optional(),
    coverUrl: z.string().url().startsWith('https://').max(2048),
    coverMd5: z.string().regex(/^[a-fA-F0-9]{32}$/).optional(),
  })).min(1).max(20),
});

export async function POST(request: Request) {
  const configuration = getLuluConfiguration();
  if (!configuration.ordersEnabled) {
    return NextResponse.json({ error: 'L’envoi automatique à l’impression est désactivé.' }, { status: 423 });
  }
  if (!isTrustedProductionRequest(request)) {
    return NextResponse.json({ error: 'Action de production non autorisée.' }, { status: 401 });
  }

  try {
    const input = printJobSchema.parse(await request.json());
    const printJob = await luluRequest('/print-jobs/', {
      method: 'POST',
      body: JSON.stringify({
        external_id: input.externalId,
        contact_email: input.contactEmail,
        shipping_level: input.shippingLevel,
        shipping_address: {
          name: input.shippingAddress.name,
          street1: input.shippingAddress.street1,
          street2: input.shippingAddress.street2,
          city: input.shippingAddress.city,
          state_code: input.shippingAddress.stateCode,
          country_code: input.shippingAddress.countryCode,
          postcode: input.shippingAddress.postcode,
          phone_number: input.shippingAddress.phoneNumber,
          email: input.shippingAddress.email,
        },
        line_items: input.lineItems.map((item) => ({
          external_id: item.externalId,
          title: item.title,
          quantity: item.quantity,
          pod_package_id: item.podPackageId,
          interior: { source_url: item.interiorUrl, source_md5sum: item.interiorMd5 },
          cover: { source_url: item.coverUrl, source_md5sum: item.coverMd5 },
        })),
      }),
    });
    return NextResponse.json({ printJob }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Commande d’impression incomplète.' }, { status: 400 });
    if (error instanceof LuluApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    return NextResponse.json({ error: 'La commande d’impression n’a pas pu être créée.' }, { status: 500 });
  }
}
