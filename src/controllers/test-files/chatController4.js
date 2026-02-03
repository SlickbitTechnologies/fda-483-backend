import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { bucket } from "../utils/firebase.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY);

let pdfCache = null; 

async function getFilesFromFirebase(folderPath) {
  const [files] = await bucket.getFiles({ prefix: folderPath });
  return files.filter(f => f.name.toLowerCase().endsWith(".pdf") && !f.name.endsWith("/"));
}

async function prepareGeminiFiles(folderPath) {
  if (pdfCache) return pdfCache;

  const firebaseFiles = await getFilesFromFirebase(folderPath);
  const uploadedFiles = [];

  console.log(`Processing ${firebaseFiles.length} files...`);

  for (const file of firebaseFiles) {
    const tempPath = path.join(os.tmpdir(), path.basename(file.name));
    await file.download({ destination: tempPath });

    try {
      const upload = await fileManager.uploadFile(tempPath, {
        mimeType: "application/pdf",
        displayName: path.basename(file.name),
      });

      let geminiFile = await fileManager.getFile(upload.file.name);
      while (geminiFile.state === "PROCESSING") {
        await new Promise(r => setTimeout(r, 2000));
        geminiFile = await fileManager.getFile(upload.file.name);
      }

      uploadedFiles.push({
        fileUri: geminiFile.uri,
        mimeType: geminiFile.mimeType
      });
      console.log(`✓ Indexed: ${file.name}`);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  pdfCache = uploadedFiles;
  return uploadedFiles;
}

async function qaOnFolder(question) {
  const fileParts = await prepareGeminiFiles("test-fda/");

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: "You are an FDA expert. Search these documents and answer accurately. Cite the filename if possible."
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          ...fileParts.map(f => ({ fileData: { mimeType: f.mimeType, fileUri: f.fileUri } })),
          { text: question }
        ]
      }
    ]
  });

  const response = await result.response;
  return response.text();
}

export const chatWithPDF = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const answer = await qaOnFolder(message);
    res.json({ success: true, response: answer });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};