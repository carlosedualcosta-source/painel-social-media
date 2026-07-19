import { createClient, type Client } from "@libsql/client";

let instance: Client | null = null;

export function getDb(): Client {
  if (!instance) {
    instance = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:local.db",
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return instance;
}
