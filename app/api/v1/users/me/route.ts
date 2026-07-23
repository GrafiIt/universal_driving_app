import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET() {
  const headersList = await headers()
  const userLevel = headersList.get('X-User-Level')
  const companyName = headersList.get('X-Company-Name')
  const companyCode = headersList.get('X-Company-Code')

  return NextResponse.json(
    {
      userLevel: userLevel && userLevel !== '' ? Number(userLevel) : null,
      companyName: companyName || null,
      companyCode: companyCode || null,
    },
    { status: 200, headers: CORS_HEADERS },
  )
}
