import { GoogleGenAI } from "@google/genai";
import { bucket } from "../utils/firebase.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const STORE_DISPLAY_NAME = "FDA_Docs_Store";
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


  for (const file of pdfFiles) {
    const tempPath = path.join(os.tmpdir(), path.basename(file?.name));
    await file.download({ destination: tempPath });

    try {
      console.log(`Indexing: ${file?.name}`);
      
      const operation = await ai.fileSearchStores.uploadToFileSearchStore({
        file: tempPath,
        fileSearchStoreName: storeName,
        config: { displayName: path.basename(file?.name) }
      });

      if (!operation || !operation.name) {
        throw new Error("Upload did not return a valid operation name.");
      }

      console.log(`Operation started: ${operation.name}`);

      while (true) {
        const status = await ai.operations.get({ name: operation.name });
        if (status.done) {
          if (status.error) {
            console.error(`Indexing failed for ${file?.name}:`, status.error.message);
          } else {
            console.log(`Successfully indexed: ${file?.name}`);
          }
          break;
        }

        process.stdout.write(".");
        await new Promise(r => setTimeout(r, 4000));
      }
    } catch (error) {
      console.error(`Error processing ${file?.name}:`, error.message);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

async function queryStore(question) {
  const storeName = await getOrCreateStore();

  const listDocs = await ai.fileSearchStores.documents.list({
    parent: storeName
  });

  for await (const doc of listDocs) {
    console.log(`Document in store: ${doc.displayName}`);
  }
  if (!storeName) throw new Error("Store name could not be resolved.");

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: question }] }],
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [storeName]
          }
        }
      ],
      systemInstruction: "You are an FDA expert. Strictly use the provided File Search store to retrieve facts. Cite filenames in your answer."
    }
  });

  return response.text;
}

export const chatWithPDF = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });
    const answer = await queryStore(message);

    res.json({
      success: true,
      response: answer
    });
  } catch (error) {
    console.error("Gemini System Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};