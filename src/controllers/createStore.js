import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: 'AIzaSyAtdCx4sdH5FLzNu1z8Kk_zVTbPh97mfuw'
});

async function createStore() {
  const store = await ai.fileSearchStores.create({
    config: {
      displayName: "FDA_Regulatory_Docs_Store"
    }
  });

  console.log("✅ STORE CREATED");
  console.log("Display Name:", store.displayName);
  console.log("Store Name (SAVE THIS):", store.name);
}

createStore().catch(console.error);
