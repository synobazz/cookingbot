import { MicrosoftConnection, ShoppingListItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_TENANT = "consumers";
const SCOPES = ["offline_access", "User.Read", "Tasks.ReadWrite"];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type GraphList = { id: string; displayName: string; wellknownListName?: string };
type GraphMe = { displayName?: string; mail?: string; userPrincipalName?: string };
type GraphTask = { id: string; title: string; webUrl?: string };

function requireMicrosoftEnv() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const baseUrl = process.env.APP_BASE_URL;
  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error("MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET and APP_BASE_URL must be configured");
  }
  return {
    clientId,
    clientSecret,
    tenant: process.env.MICROSOFT_TENANT_ID || DEFAULT_TENANT,
    redirectUri: `${baseUrl.replace(/\/$/, "")}/api/microsoft/callback`,
  };
}

function tokenUrl(tenant: string) {
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
}

export function microsoftAuthUrl(state: string) {
  const { clientId, tenant, redirectUri } = requireMicrosoftEnv();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPES.join(" "),
    state,
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

async function requestToken(params: URLSearchParams) {
  const { clientSecret, tenant } = requireMicrosoftEnv();
  params.set("client_secret", clientSecret);
  const res = await fetch(tokenUrl(tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Microsoft token request failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeMicrosoftCode(code: string) {
  const { clientId, redirectUri } = requireMicrosoftEnv();
  return requestToken(new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
  }));
}

async function refreshMicrosoftToken(connection: MicrosoftConnection) {
  const { clientId } = requireMicrosoftEnv();
  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const token = await requestToken(new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES.join(" "),
  }));
  return prisma.microsoftConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encrypt(token.access_token),
      encryptedRefreshToken: encrypt(token.refresh_token || refreshToken),
      expiresAt: new Date(Date.now() + Math.max(token.expires_in - 60, 60) * 1000),
      scopes: token.scope || SCOPES.join(" "),
    },
  });
}

export async function saveMicrosoftConnection(token: TokenResponse) {
  const expiresAt = new Date(Date.now() + Math.max(token.expires_in - 60, 60) * 1000);
  const accessToken = token.access_token;
  const me = await graphFetch<GraphMe>("/me", accessToken);
  return prisma.microsoftConnection.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      accountName: me.displayName || "",
      accountEmail: me.mail || me.userPrincipalName || "",
      encryptedAccessToken: encrypt(accessToken),
      encryptedRefreshToken: encrypt(token.refresh_token || ""),
      expiresAt,
      scopes: token.scope || SCOPES.join(" "),
    },
    update: {
      accountName: me.displayName || "",
      accountEmail: me.mail || me.userPrincipalName || "",
      encryptedAccessToken: encrypt(accessToken),
      encryptedRefreshToken: encrypt(token.refresh_token || ""),
      expiresAt,
      scopes: token.scope || SCOPES.join(" "),
    },
  });
}

export async function getMicrosoftConnection() {
  return prisma.microsoftConnection.findUnique({ where: { id: "default" } });
}

export async function disconnectMicrosoft() {
  await prisma.microsoftConnection.deleteMany({ where: { id: "default" } });
}

export async function getMicrosoftAccessToken() {
  const connection = await getMicrosoftConnection();
  if (!connection) throw new Error("Microsoft To Do is not connected");
  const valid = connection.expiresAt.getTime() > Date.now() + 60_000;
  const fresh = valid ? connection : await refreshMicrosoftToken(connection);
  return decrypt(fresh.encryptedAccessToken);
}

async function graphFetch<T>(path: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Microsoft Graph request failed (${res.status})`);
  return (await res.json()) as T;
}

export async function listMicrosoftTodoLists() {
  const token = await getMicrosoftAccessToken();
  const result = await graphFetch<{ value: GraphList[] }>("/me/todo/lists", token);
  return result.value.sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
}

export function todoTaskTitle(item: Pick<ShoppingListItem, "name" | "quantity">) {
  return [item.quantity, item.name].filter(Boolean).join(" ").trim();
}

export async function createMicrosoftTodoTask(listId: string, item: Pick<ShoppingListItem, "name" | "quantity" | "source">) {
  const token = await getMicrosoftAccessToken();
  const title = todoTaskTitle(item);
  const body = item.source ? `Aus cookingbot: ${item.source}` : "Aus cookingbot Einkaufsliste";
  return graphFetch<GraphTask>(`/me/todo/lists/${encodeURIComponent(listId)}/tasks`, token, {
    method: "POST",
    body: JSON.stringify({
      title,
      body: { contentType: "text", content: body },
      categories: ["cookingbot"],
    }),
  });
}
