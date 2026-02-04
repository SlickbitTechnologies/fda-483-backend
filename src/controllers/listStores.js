import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});

async function listFileSearchStores() {
  console.log("📂 Listing File Search Stores...\n");

  const stores = await ai.fileSearchStores.list();

  let found = false;

  for await (const store of stores) {
    found = true;
    console.log("Display Name :", store.displayName);
    console.log("Store Name   :", store.name);
    console.log("--------------------------------");
  }

  if (!found) {
    console.log("⚠️ No File Search Stores found.");
  }
}

listFileSearchStores().catch(err => {
  console.error("❌ Error listing stores:", err);
});
