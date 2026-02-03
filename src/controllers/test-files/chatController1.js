import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, './uploads');

// Initialize Google AI lazily
let genAI = null;
console.log(process.env.GOOGLE_API_KEY, 'sddd')
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenAI({
      apiKey: apiKey,
    });
  }
  return genAI;
}

// Store for uploaded file (in production, use database)
let uploadedFile = null;
let isInitialized = false;

// Initialize file upload
async function initializeFileUpload() {
  try {
    if (isInitialized) return;

    const pdfPath = path.join(UPLOAD_DIR, 'dr_reddys_laboratories_limited.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.warn(`PDF file not found at ${pdfPath}`);
      isInitialized = true;
      return;
    }

    const fileData = fs.readFileSync(pdfPath);
    const mimeType = 'application/pdf';

    // Load PDF as base64 for use in requests
    uploadedFile = {
      data: Buffer.from(fileData).toString('base64'),
      mimeType: mimeType,
      displayName: 'dr_reddys_laboratories_limited.pdf'
    };

    console.log('PDF loaded successfully for file search');
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing file upload:', error);
    isInitialized = true; // Mark as initialized even if upload fails
  }
}

// Chat endpoint
export const chatWithPDF = async (req, res) => {
  try {
    const { message } = req.body;
    console.log(message, 'messagemessagemessagemessage')
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
const ai = getGenAI();
    // Initialize file upload if not already done
    if (!isInitialized) {
      await initializeFileUpload();
    }
    const config = {
        systemInstruction:[
            {
                text: 'You are a helpful assistant that answers questions based on the provided FDA 483 document about Dr. Reddys Laboratories Limited. Only answer questions using information from the document. If the information is not in the document, clearly state that the document does not contain the requested information.'
            }
        ]
    }
    console.log(message)
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: message
                }
            ]
        }
    ]

    const requestParts = [
      {
        text: message
      }
    ];

    // Add the PDF file to the request if it was successfully loaded
    if (uploadedFile) {
      requestParts.push({
        inlineData: {
          mimeType: uploadedFile.mimeType,
          data: uploadedFile.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config,
        contents,
    });
    console.log(response, 'responseresponseresponse')
    const responseText = response.candidates[0].content.parts[0].text;
    console.log(responseText, 'responseTextresponseText')

    res.json({
      success: true,
      message: message,
      response: responseText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error details:', {
      message: error.message,
      status: error.status,
      fullError: error
    });
    res.status(500).json({
      error: 'Error processing chat request',
      details: error.message
    });
  }
};

// Health check endpoint
export const healthCheck = async (req, res) => {
  try {
    // Try to initialize if not already done
    if (!isInitialized) {
      await initializeFileUpload();
    }

    res.json({
      success: true,
      initialized: isInitialized,
      fileReady: uploadedFile !== null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
