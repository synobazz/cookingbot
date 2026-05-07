const MCP_ENDPOINT = "https://cookingbot.nas.synobazz.net/mcp";

const discovery = {
  name: "Cookingbot MCP",
  description: "Remote MCP endpoint for Cookingbot.",
  mcp_endpoint: MCP_ENDPOINT,
  endpoint: MCP_ENDPOINT,
  endpoints: [
    {
      url: MCP_ENDPOINT,
      transport: "streamable-http",
    },
  ],
  transport: "streamable-http",
  authentication: {
    type: "bearer",
    oauth: false,
  },
};

export async function GET() {
  return Response.json(discovery, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
