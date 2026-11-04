import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import type { EntityMap } from "../shared/types.js";

// The local driver is intentionally single-process; production uses MongoDB.
export class Store {
  private data: Record<string, Record<string, unknown>> = {};
  private writes: Promise<void> = Promise.resolve();
  private models = new Map<string, mongoose.Model<any>>();
  constructor(
    private directory = process.env.DATA_DIR || "./data",
    private mongoUri = process.env.MONGODB_URI,
  ) {}
  async init() {
    if (this.mongoUri) {
      await mongoose.connect(this.mongoUri);
      await this.model('users').init();
      await this.model('sessions').init();
      return;
    }
    if (process.env.NODE_ENV === "production")
      throw new Error("MONGODB_URI is required in production");
    await fs.mkdir(this.directory, { recursive: true });
    try {
      this.data = JSON.parse(
        await fs.readFile(path.join(this.directory, "store.json"), "utf8"),
      );
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  private model(collection: string) {
    if (!this.models.has(collection)) {
      const schema = new mongoose.Schema(
        {
          id: { type: String, unique: true, required: true },
          ownerId: { type: String, index: true },
          email: String,
        },
        { strict: false, versionKey: false },
      );
      if (collection === "users") schema.index({ email: 1 }, { unique: true });
      this.models.set(
        collection,
        mongoose.models[collection] || mongoose.model(collection, schema),
      );
    }
    return this.models.get(collection)!;
  }
  async list<K extends keyof EntityMap>(
    collection: K,
    ownerId?: string,
  ): Promise<EntityMap[K][]> {
    if (this.mongoUri)
      return (await this.model(collection)
        .find(ownerId ? { ownerId } : {}, { _id: 0 })
        .lean()) as unknown as EntityMap[K][];
    return structuredClone(
      Object.values(this.data[collection] || {}).filter(
        (x: any) => !ownerId || x.ownerId === ownerId,
      ),
    ) as EntityMap[K][];
  }
  async get<K extends keyof EntityMap>(
    collection: K,
    id: string,
  ): Promise<EntityMap[K] | undefined> {
    if (this.mongoUri)
      return ((await this.model(collection)
        .findOne({ id }, { _id: 0 })
        .lean()) || undefined) as EntityMap[K] | undefined;
    return structuredClone(this.data[collection]?.[id]) as
      EntityMap[K] | undefined;
  }
  async put<K extends keyof EntityMap>(collection: K, value: EntityMap[K]) {
    if (this.mongoUri) {
      await this.model(collection).replaceOne({ id: value.id }, value, {
        upsert: true,
      });
      return;
    }
    (this.data[collection] ||= {})[value.id] = structuredClone(value);
    await this.persist();
  }
  async remove(collection: keyof EntityMap, id: string) {
    if (this.mongoUri) {
      await this.model(collection).deleteOne({ id });
      return;
    }
    delete (this.data[collection] || {})[id];
    await this.persist();
  }
  async consume<K extends keyof EntityMap>(collection: K, id: string): Promise<EntityMap[K] | undefined> {
    if (this.mongoUri) return (await this.model(collection).findOneAndDelete({ id }, { projection: { _id: 0 } }).lean() || undefined) as EntityMap[K] | undefined;
    const value = this.data[collection]?.[id];
    if (!value) return undefined;
    delete this.data[collection][id];
    await this.persist();
    return structuredClone(value) as EntityMap[K];
  }
  private persist() {
    const snapshot = JSON.stringify(this.data);
    const task = this.writes.then(async () => {
      const target = path.join(this.directory, "store.json");
      await fs.writeFile(target + ".tmp", snapshot, { mode: 0o600 });
      await fs.rename(target + ".tmp", target);
    });
    this.writes = task.catch(() => {});
    return task;
  }
}
