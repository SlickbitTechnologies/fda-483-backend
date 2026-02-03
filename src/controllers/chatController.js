import { GoogleGenAI } from "@google/genai"; // New Unified SDK
import { bucket } from "../utils/firebase.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const STORE_DISPLAY_NAME = "FDA_Regulatory_Docs_Store";
let cachedStoreName = null;

async function getOrCreateStore() {
  if (cachedStoreName) return cachedStoreName;

  const existingStores = await ai.fileSearchStores.list();
  for await (const store of existingStores) {
    if (store.displayName === STORE_DISPLAY_NAME) {
      cachedStoreName = store.name;
      console.log(`Using existing store: ${cachedStoreName}`);
      return cachedStoreName;
    }
  }

  const newStore = await ai.fileSearchStores.create({
    config: { displayName: STORE_DISPLAY_NAME }
  });
  cachedStoreName = newStore.name;
  console.log(`Created new store: ${cachedStoreName}`);
  return cachedStoreName;
}

async function syncFirebaseToStore(folderPath) {
  const storeName = await getOrCreateStore();
  const [files] = await bucket.getFiles({ prefix: folderPath });
  const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith(".pdf") && !f.name.endsWith("/"));

  console.log(`Syncing ${pdfFiles.length} files...`);

  for (const file of pdfFiles) {
    const tempPath = path.join(os.tmpdir(), path.basename(file.name));
    await file.download({ destination: tempPath });

    try {
      console.log(`Indexing: ${file.name}`);
      let operation = await ai.fileSearchStores.uploadToFileSearchStore({
        file: tempPath,
        fileSearchStoreName: storeName,
        config: { displayName: path.basename(file.name) }
      });

      // Poll until the operation is done (indexing completes)
      while (!operation.done) {
        await new Promise(r => setTimeout(r, 3000));
        operation = await ai.operations.get({ name: operation.name });
      }
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
  console.log("Sync Complete.");
}

async function queryStore(question) {
  const storeName = await getOrCreateStore();

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Use 2.0 or 1.5 Flash
    contents: [{ role: 'user', parts: [{ text: question }] }],
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [storeName]
          }
        }
      ]
    }
  });
  console.log(response, 'response_')
  return response.text;
}

export const chatWithPDF = async (req, res) => {
  try {
    const { message } = req.body;
    
    const answer = await queryStore(message);
    console.log(answer, 'answer_answer')
    res.json({
      success: true,
      response: answer
    });
  } catch (error) {
    console.error("FileSearch Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};