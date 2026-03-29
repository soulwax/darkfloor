import { db } from "@/server/db";
import { createDrizzleAppDataStore } from "@/server/data/drizzleAppDataStore";

export const dataStore = createDrizzleAppDataStore(db);

export type { AppDataStore } from "@/server/data/appDataStore";
