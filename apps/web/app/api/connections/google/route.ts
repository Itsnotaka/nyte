import {
  disconnectGoogleConnection,
  getGoogleConnectionStatus,
  upsertGoogleConnection,
} from "@/lib/server/connections";

type ConnectBody = {
  providerAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  scopes?: string[];
};

export async function GET() {
  const status = await getGoogleConnectionStatus();
  return Response.json(status);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ConnectBody;
  const status = await upsertGoogleConnection(
    {
      providerAccountId: body.providerAccountId,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      scopes: body.scopes,
    },
    new Date(),
  );

  return Response.json(status);
}

export async function DELETE() {
  const status = await disconnectGoogleConnection();
  return Response.json(status);
}
