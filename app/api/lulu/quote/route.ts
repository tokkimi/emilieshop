import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  LULU_DEFAULT_POD_PACKAGE_ID,
  LuluApiError,
  luluRequest,
} from '../../../../lib/lulu';

export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  name: z.string().max(120).optional(),
  organization: z.string().max(120).optional(),
  street1: z.string().min(1).max(150),
  street2: z.string().max(150).optional(),
  city: z.string().min(1).max(100),
  stateCode: z.string().max(3).optional(),
  countryCode: z.string().length(2).transform((value) => value.toUpperCase()),
  postcode: z.string().min(1).max(64),
  phoneNumber: z.string().min(8).max(20),
  email: z.string().email().optional(),
});

const quoteSchema = z.object({
  quantity: z.number().int().min(1).max(100).default(1),
  pageCount: z.number().int().min(24).max(800).default(24),
  podPackageId: z.string().min(10).max(80).default(LULU_DEFAULT_POD_PACKAGE_ID),
  shippingLevel: z.enum(['MAIL', 'PRIORITY_MAIL', 'GROUND', 'EXPEDITED', 'EXPRESS']).default('MAIL'),
  shippingAddress: addressSchema,
});

export async function POST(request: Request) {
  try {
    const input = quoteSchema.parse(await request.json());
    const quote = await luluRequest('/print-job-cost-calculations/', {
      method: 'POST',
      body: JSON.stringify({
        line_items: [{
          quantity: input.quantity,
          page_count: input.pageCount,
          pod_package_id: input.podPackageId,
        }],
        shipping_option: input.shippingLevel,
        shipping_address: {
          name: input.shippingAddress.name,
          organization: input.shippingAddress.organization,
          street1: input.shippingAddress.street1,
          street2: input.shippingAddress.street2,
          city: input.shippingAddress.city,
          state_code: input.shippingAddress.stateCode,
          country_code: input.shippingAddress.countryCode,
          postcode: input.shippingAddress.postcode,
          phone_number: input.shippingAddress.phoneNumber,
          email: input.shippingAddress.email,
        },
      }),
    });
    return NextResponse.json({ quote });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Adresse ou produit incomplet.' }, { status: 400 });
    if (error instanceof LuluApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    return NextResponse.json({ error: 'Le tarif d’impression est momentanément indisponible.' }, { status: 500 });
  }
}
