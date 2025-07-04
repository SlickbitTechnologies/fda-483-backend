import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { bucket, db } from './src/utils/firebase.js';
import pdf2pic from 'pdf2pic';

// Load environment variables
dotenv.config();

const DATA_PATH = './originalData.json';

// Function to extract repeat findings from text
function extractRepeatFindingsFromText(text) {
  const repeatKeywords = [
    'repeated', 'previously cited', 'same issue as prior inspection', 
    'continuing violation', 'repeat observation', 'ongoing problem', 
    'persistent violation', 'recurring issue', 'same finding', 
    'previously identified', 'continuing deficiency'
  ];
  
  const findings = [];
  const lowerText = text.toLowerCase();
  
  repeatKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) {
      findings.push(keyword);
    }
  });
  
  return findings;
}

async function ensureUploadsDir() {
  const uploadsDir = './uploads';
  try {
    await fs.access(uploadsDir);
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true });
  }
}

async function downloadAndUploadPDF(url, fileName) {
  const filePath = path.join('./uploads', fileName);
  
  // Download PDF
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }
  
  const buffer = await response.buffer();
  await fs.writeFile(filePath, buffer);
  console.log(`📥 Downloaded: ${fileName}`);
  
  // Upload to Firebase Storage
  const file = bucket.file(`fda-483-documents/${fileName}`);
  let retries = 3;
  
  while (retries > 0) {
    try {
      await file.save(buffer, {
        metadata: {
          contentType: 'application/pdf',
        },
      });
      console.log(`📤 Uploaded to Firebase Storage: ${fileName}`);
      break; // Success, exit retry loop
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.log(`⚠️  Failed to upload to Firebase Storage after 3 attempts: ${fileName}`);
        // Return local path only if upload fails
        return { localPath: filePath, firebaseUrl: url };
      }
      console.log(`⚠️  Upload attempt failed, retrying... (${3 - retries}/3)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
    }
  }
  
  // Get signed URL (valid for 1 year)
  try {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });
    return { localPath: filePath, firebaseUrl: signedUrl };
  } catch (error) {
    console.log(`⚠️  Failed to get signed URL for ${fileName}, using original URL`);
    return { localPath: filePath, firebaseUrl: url };
  }
}

async function convertPDFToImages(pdfPath) {
  const options = {
    density: 300,           // Output resolution
    saveFilename: "page",   // Output filename
    savePath: "./temp_images", // Output path
    format: "png",          // Output format
    width: 2480,            // Output width
    height: 3508            // Output height
  };
  
  const convert = pdf2pic.fromPath(pdfPath, options);
  
  // Create temp directory
  try {
    await fs.mkdir('./temp_images', { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Get number of pages and convert them
  const pageCount = await convert.bulk(-1);
  console.log(`📄 Converting ${pageCount.length} pages to images...`);
  
  const imagePaths = [];
  for (let i = 1; i <= pageCount.length; i++) {
    const imagePath = `./temp_images/page.${i}.png`;
    imagePaths.push(imagePath);
  }
  
  return imagePaths;
}

async function main() {
  await ensureUploadsDir();
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  const docs = JSON.parse(raw); // Process all documents
  const results = [];

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    
    // Pause for 2 seconds every 5 documents
    if (i > 0 && i % 5 === 0) {
      console.log(`\n⏸️  Pausing for 2 seconds after processing ${i} documents...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    try {
      const safeName = doc.name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40);
      const fileName = `${safeName}_${doc.fei_number}.pdf`;
      console.log(`Processing: ${doc.name} (${doc.fei_number})`);
      console.log(`Downloading: ${doc.firebaseUrl}`);
      
      const { localPath, firebaseUrl: storageUrl } = await downloadAndUploadPDF(doc.firebaseUrl, fileName);
    
      // Convert PDF to images
      const imagePaths = await convertPDFToImages(localPath);
      
      // Initialize OpenAI
      const openai = new OpenAI({
        apiKey: 'sk-KnLxnFSQ5fZBlm-Ep_SezdAlAdhM9RgaJNVqHDXr1KT3BlbkFJsex4z3ekUfqavn5DuQpUJhPopAx5fdVy8CiwEV72EA'
      });
      
      // Create prompt for FDA 483 analysis
      const prompt = `
      Analyze this FDA 483 inspection report PDF and extract key information in JSON format.
      
      IMPORTANT REQUIREMENTS:
      1. Each observation must have EXACTLY ONE CFR number (e.g., "§211.22" or "§211.100")
      2. Each observation must use ONLY ONE category from this exact list:
         - Poor Documentation
         - Procedures Not Followed
         - Inadequate Investigations (CAPA)
         - Lack of Training
         - Facility & Equipment Issues
         - Validation Failures
         - Inadequate Testing
         - Improper Handling & Storage
         - Poor Record-Keeping
         - Adverse Event Reporting Failures
      3. Extract MULTIPLE observations (at least 3-8 observations per document)
      4. Each observation should be a distinct, separate finding from the FDA 483 report
      
      Return a JSON object with the following structure:
      {
        "summary": "2-line summary focusing on key compliance violations and critical issues",
        "category": "One of the predefined categories above",
        "cfrNumber": "The most relevant CFR section (e.g., §211.22, §211.100, etc.)",
        "observations": [
          {
            "summary": "Brief description of the observation",
            "category": "ONE category from the predefined list above",
            "cfrNumber": "EXACTLY ONE CFR section (e.g., §211.22)"
          }
        ],
        "repeatFinding": [
          "List any findings explicitly noted as repeated, previously cited, or continuing violations"
        ]
      }
      
      CRITICAL: For repeatFinding analysis, be EXTREMELY thorough and look for:
      1. Explicit language: "repeated", "previously cited", "same issue as prior inspection", "continuing violation", "repeat observation", "ongoing problem", "persistent violation", "recurring issue", "same finding", "previously identified", "continuing deficiency"
      2. Systemic patterns: Multiple observations pointing to the same root cause (e.g., "multiple documentation failures suggest systemic QA oversight issues")
      3. Historical references: Any mention of previous inspections, dates, or time periods indicating ongoing problems
      4. Escalating severity: Issues that have worsened or expanded over time
      5. Corrective action failures: Problems that persist despite previous corrective actions
      
      If you find ANY indication of repeated issues, list them as separate items in the repeatFinding array. Be comprehensive and don't miss any repeated findings.
      `;
      
      // Prepare content array with prompt and all images
      const content = [
        { type: "text", text: prompt }
      ];
      
      // Add all images to content array
      for (const imagePath of imagePaths) {
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${base64Image}`
          }
        });
      }
      
      // Create OpenAI API call
      const result = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        max_tokens: 1500,
        temperature: 0.0,
        response_format: { type: "json_object" }
      });
      
      const openaiOutput = result.choices[0].message.content;
      
      // Create new object structure for fda-483-list collection
      const newDocument = {
        name: doc.name,
        date: doc.date,
        pdfFileName: fileName,
        inspectionNumber: doc.fei_number.toString(),
        fei_number: doc.fei_number,
        firebaseUrl: storageUrl, // Use Firebase Storage URL instead of original FDA URL
        observations: [], // Will be populated by OpenAI
        repeatFinding: [] // Will be populated by OpenAI
      };
      
      // Parse OpenAI output and populate the fields
      try {
        if (typeof openaiOutput === 'string') {
          // Parse JSON from OpenAI response
          const parsed = JSON.parse(openaiOutput);
            
            // Extract summary, category, and CFR number will be handled within observations
            
            // Extract observations array
            if (parsed.observations && Array.isArray(parsed.observations)) {
              newDocument.observations = parsed.observations.map(obs => {
                // Use the exact categories array from utils/index.js
                const categoryLabels = [
                  'Poor Documentation',
                  'Procedures Not Followed', 
                  'Inadequate Investigations (CAPA)',
                  'Lack of Training',
                  'Facility & Equipment Issues',
                  'Validation Failures',
                  'Inadequate Testing',
                  'Improper Handling & Storage',
                  'Poor Record-Keeping',
                  'Adverse Event Reporting Failures'
                ];
                
                // Find the first matching category (use only the label)
                const foundCategory = categoryLabels.find(label => 
                  obs.category && obs.category.includes(label)
                );
                
                // Ensure only one CFR number (take the first one if multiple)
                let cfrNumber = obs.cfrNumber || '';
                if (cfrNumber.includes(',')) {
                  cfrNumber = cfrNumber.split(',')[0].trim();
                }
                if (cfrNumber.includes('§')) {
                  // Extract just the first CFR reference
                  const cfrMatch = cfrNumber.match(/§\d+\.\d+/);
                  cfrNumber = cfrMatch ? cfrMatch[0] : cfrNumber;
                }
                
                return {
                  summary: obs.summary || '',
                  category: foundCategory || 'Procedures Not Followed', // Use only the label
                  cfrNumber: cfrNumber
                };
              });
            } else if (parsed.summary) {
              // If no observations array but we have a summary, create a single observation
              const categoryLabels = [
                'Poor Documentation',
                'Procedures Not Followed', 
                'Inadequate Investigations (CAPA)',
                'Lack of Training',
                'Facility & Equipment Issues',
                'Validation Failures',
                'Inadequate Testing',
                'Improper Handling & Storage',
                'Poor Record-Keeping',
                'Adverse Event Reporting Failures'
              ];
              
              const foundCategory = categoryLabels.find(label => 
                parsed.category && parsed.category.includes(label)
              );
              
              // Ensure only one CFR number
              let cfrNumber = parsed.cfrNumber || '';
              if (cfrNumber.includes(',')) {
                cfrNumber = cfrNumber.split(',')[0].trim();
              }
              if (cfrNumber.includes('§')) {
                const cfrMatch = cfrNumber.match(/§\d+\.\d+/);
                cfrNumber = cfrMatch ? cfrMatch[0] : cfrNumber;
              }
              
              newDocument.observations = [{
                summary: parsed.summary,
                category: foundCategory || 'Procedures Not Followed', // Use only the label
                cfrNumber: cfrNumber
              }];
            }
            
            // Extract repeat findings array
            if (parsed.repeatFinding && Array.isArray(parsed.repeatFinding)) {
              newDocument.repeatFinding = parsed.repeatFinding;
            }
            // Post-process OpenAI output for repeat keywords
            const extraRepeatFindings = extractRepeatFindingsFromText(openaiOutput);
            for (const finding of extraRepeatFindings) {
              if (!newDocument.repeatFinding.includes(finding)) {
                newDocument.repeatFinding.push(finding);
              }
            }
          }
        
      } catch (parseError) {
        console.log('Could not parse OpenAI output, using default values');
        console.log('Raw OpenAI output:', openaiOutput);
      }
      
      // Upload document to Firestore
      try {
        await db.collection('fda-483-list').add(newDocument);
        console.log(`✅ Uploaded to Firestore: ${doc.name}`);
      } catch (uploadError) {
        console.log(`❌ Failed to upload ${doc.name} to Firestore: ${uploadError.message}`);
      }
      
      results.push(newDocument);
      
      // Clean up temp images
      try {
        for (const imagePath of imagePaths) {
          await fs.unlink(imagePath);
        }
        await fs.rmdir('./temp_images');
      } catch (cleanupError) {
        console.log(`⚠️  Could not clean up temp images: ${cleanupError.message}`);
      }
      
      // Wait 2 seconds after each document
      console.log(`⏸️  Waiting 2 seconds before next document...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(`❌ Error processing ${doc.name}: ${error.message}`);
      // Continue with next document
    }
  } // close for loop
  console.log(`\n✅ Processing complete! ${results.length} documents processed and uploaded to Firestore collection 'fda-483-list'.`);
}

main().catch(e => { console.error(e); process.exit(1); }); 