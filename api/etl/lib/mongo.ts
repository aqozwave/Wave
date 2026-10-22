import { MongoClient, type Db } from "mongodb";

/**
 * Abre Mongo en solo lectura para ETL.
 * Usa MONGO_URI + MONGO_DB_NAME (nunca escribe).
 */
export async function connectMongoReadOnly(): Promise<{
  client: MongoClient;
  db: Db;
}> {
  const uri = process.env.MONGO_URI?.trim();
  const dbName = process.env.MONGO_DB_NAME?.trim();

  if (!uri) {
    throw new Error("Falta MONGO_URI en el entorno (api/.env).");
  }
  if (!dbName) {
    throw new Error(
      "Falta MONGO_DB_NAME (ej. core-api, nachipa-prod-test). No uses prod sin querer.",
    );
  }

  const client = new MongoClient(uri, {
    // ETL: timeouts cortos para fallar claro si el cluster no responde.
    serverSelectionTimeoutMS: 15_000,
  });
  await client.connect();
  return { client, db: client.db(dbName) };
}
