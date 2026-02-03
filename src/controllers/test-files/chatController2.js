import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { bucket } from "../utils/firebase.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import os from "os";

dotenv.config();
if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is missing in .env");
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GOOGLE_API_KEY);

const uploadPdfsMap = new Map();
async function uploadPDFsToGemini(folderPath) {
  const [files] = await bucket.getFiles({ prefix: folderPath });

  const pdfFiles = files.filter(
    file => file.name.toLowerCase().endsWith(".pdf") && !file.name.endsWith("/")
  );

  if (!pdfFiles.length) {
    throw new Error("No PDF files found in Firebase Storage.");
  }

  const uploadedFiles = [];

  for (const file of pdfFiles) {
    const tempPath = path.join(os.tmpdir(), path.basename(file.name));

    await file.download({ destination: tempPath });

    try {
      const upload = await fileManager.uploadFile(tempPath, {
        mimeType: "application/pdf",
        displayName: path.basename(file.name),
      });

      let geminiFile = await fileManager.getFile(upload.file.name);

      while (geminiFile.state === "PROCESSING") {
        await new Promise(resolve => setTimeout(resolve, 2000));
        geminiFile = await fileManager.getFile(upload.file.name);
      }

      if (geminiFile.state !== "ACTIVE") {
        throw new Error(`Gemini failed processing: ${file.name}`);
      }

      uploadedFiles.push(geminiFile);
      console.log(`✓ PDF ready: ${file.name}`);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
  uploadPdfsMap.set(folderPath, uploadedFiles);
  return uploadedFiles;
}

async function qaOnFolder(folderPath, question) {
  let uploadedFiles = uploadPdfsMap.get(folderPath);
  if (!uploadedFiles) {
   uploadedFiles = await uploadPDFsToGemini(folderPath);
  }
  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          ...uploadedFiles.map(file => ({
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri,
            },
          })),
          {
            text: question,
          },
        ],
      },
    ],
  });

  return result.response.text();
}

export const chatWithPDF = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const answer = await qaOnFolder("test-fda/", message);

    res.json({
      success: true,
      response: answer,
    });
  } catch (error) {
    console.error("Gemini Error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
