import { MongoClient, type Collection, type Db, type Document } from "mongodb";

/**
 * MongoDB holds flexible, unstructured knowledge: document content, tags, rules,
 * requirements, chunks and FAQ enrichment (tags/keywords).
 *
 * Configure with MONGODB_URI (and optionally MONGODB_DB, default "CampusQuery").
 * The client connects lazily on first use so the API can still start (and serve
 * MySQL-only results) while MongoDB is unavailable.
 */
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI must be set, e.g. mongodb://localhost:27017");
}

const dbName = process.env.MONGODB_DB ?? "CampusQuery";
export const mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });

let connecting: Promise<Db> | null = null;

export function getMongoDb(): Promise<Db> {
  if (!connecting) {
    connecting = mongoClient
      .connect()
      .then(() => mongoClient.db(dbName))
      .catch((error) => {
        connecting = null; // allow a retry on the next request
        throw error;
      });
  }
  return connecting;
}

export async function mongoCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  return (await getMongoDb()).collection<T>(name);
}
