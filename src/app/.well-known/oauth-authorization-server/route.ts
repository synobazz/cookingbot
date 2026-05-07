const MCP_ENDPOINT = "https://cookingbot.nas.synobazz.net/mcp";

export async function GET() {
  return Response.json(
    {
      error: "not_found",
      error_description:
        "Cookingbot MCP does not expose OAuth authorization-server metadata. Connect directly to the MCP endpoint with a Bearer token.",
      mcp_endpoint: MCP_ENDPOINT,
      authentication: {
        type: "bearer",
        oauth: false,
      },
    },
    { status: 404 },
  );
}
