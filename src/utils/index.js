import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { downloadPDFFromURL, getFirebaseData } from './pdfExtractor.js';

const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const askGemini = async (prompt, documents = []) => {
    documents = await getFirebaseData()
    console.log(documents, 'documentsdassocumentsdocuments')
    prompt = `
    - Extract the repeated_issues from the ${documents}
    -List any findings explicitly noted as "repeated" or "previously cited.
    -The repeated_issues should be a list of strings.
    -Each document should be processed separately
    -Extract the data from the firebaseUrl which is in the each document.
    `
    const config = {
        // Ultra-aggressive performance optimizations for maximum speed
        generationConfig: {
            maxOutputTokens: 800,   // Increased for more complete responses
            temperature: 0.0,        // Zero temperature for fastest responses
            topP: 0.1,              // Very low randomness for speed
            topK: 1,                // Minimum token selection
            candidateCount: 1,      // Only generate one response
        },
        // Disable safety for maximum speed
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE"
            }
        ],
        responseMimeType: 'application/json',
        systemInstruction: [
            {
                text: prompt,
            }
        ],
    }
    // Use fastest model
    const model = 'gemini-1.5-flash';
    const startTime = Date.now();
    
    try {
        console.log(`[LLM] Starting Gemini processing for ${documents.length} documents`);
        
        // Process documents sequentially for better control and speed
        const results = [];
        
        for (let index = 0; index < documents.length; index++) {
            const document = documents[index];
            const docStartTime = Date.now();
            
            // Download PDF from Firebase Storage URL
            const fileBuffer = await downloadPDFFromURL(document.url);
            const docEndTime = Date.now();
            console.log(`[LLM] PDF ${index + 1}/${documents.length} downloaded in ${docEndTime - docStartTime}ms (size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
            
            // Two-tier file size approach for optimal speed
            const maxSizeFast = 1 * 1024 * 1024; // 1MB for fast processing
            const maxSizeFallback = 3 * 1024 * 1024; // 3MB fallback for larger files
            
            if (fileBuffer.length > maxSizeFallback) {
                console.log(`[LLM] PDF ${index + 1} is too large (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB), skipping...`);
                results.push(`Document ${index + 1}: ${document.fileName || 'Unknown'} - File too large for processing`);
                continue;
            }
            
            // Adaptive timeout based on file size
            let timeoutMs;
            if (fileBuffer.length <= maxSizeFast) {
                timeoutMs = 8000; // 8s for small files
            } else if (fileBuffer.length <= 1.5 * 1024 * 1024) {
                timeoutMs = 20000; // 20s for medium files (1-1.5MB)
            } else {
                timeoutMs = 30000; // 30s for larger files (1.5-3MB)
            }
            console.log(`[LLM] Using ${timeoutMs}ms timeout for PDF ${index + 1} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
            
            // Process single document
            const llmStartTime = Date.now();
            console.log(`[LLM] Processing PDF ${index + 1} using ${model}`);
            
            const contents = [
                {
                    role: 'user',
                    parts: [{
                        inlineData: {
                            data: fileBuffer.toString('base64'),
                            mimeType: 'application/pdf'
                        }
                    }]
                }
            ];
            
            // Increased timeout for larger documents (15 seconds)
            const apiCallPromise = genAI.models.generateContent({model, contents, config});
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`PDF ${index + 1} timeout after ${timeoutMs}ms`)), timeoutMs);
            });
            
            try {
                const response = await Promise.race([apiCallPromise, timeoutPromise]);
                const llmEndTime = Date.now();
                console.log(`[LLM] PDF ${index + 1} processed in ${llmEndTime - llmStartTime}ms`);
                
                results.push(response.text);
                
                // Early termination if we have enough results
                if (results.length >= 3) {
                    console.log(`[LLM] Early termination after processing ${results.length} documents`);
                    break;
                }
                
            } catch (error) {
                console.error(`[LLM] Error processing PDF ${index + 1}:`, error.message);
                
                // If it's a timeout and we're processing a larger file, try with reduced processing
                if (error.message.includes('timeout') && fileBuffer.length > maxSizeFast) {
                    console.log(`[LLM] Timeout detected for larger file, trying with reduced processing...`);
                    
                    // Try again with even more aggressive settings
                    const reducedConfig = {
                        ...config,
                        generationConfig: {
                            ...config.generationConfig,
                            maxOutputTokens: 400, // Reduced for speed
                        }
                    };
                    
                    try {
                        const reducedTimeoutMs = Math.min(timeoutMs, 15000); // Cap at 15s for retry
                        const retryPromise = genAI.models.generateContent({model, contents, config: reducedConfig});
                        const retryTimeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error(`PDF ${index + 1} retry timeout after ${reducedTimeoutMs}ms`)), reducedTimeoutMs);
                        });
                        
                        const retryResponse = await Promise.race([retryPromise, retryTimeoutPromise]);
                        console.log(`[LLM] PDF ${index + 1} retry successful`);
                        results.push(retryResponse.text);
                    } catch (retryError) {
                        console.error(`[LLM] Retry also failed for PDF ${index + 1}:`, retryError.message);
                        results.push(`Document ${index + 1}: ${document.fileName || 'Unknown'} - Processing failed after retry`);
                    }
                } else {
                    results.push(`Document ${index + 1}: ${document.fileName || 'Unknown'} - Processing failed`);
                }
            }
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`[LLM] Total Gemini processing time: ${totalTime}ms`);
        
        // Filter out error messages and only keep valid responses
        const validResults = results.filter(result => {
            if (typeof result !== 'string') {
                return false;
            }
            
            // Check for specific error patterns
            const isError = (
                result.startsWith('Document') && 
                (result.includes('too large') || result.includes('Processing failed'))
            );
            
            // Check if it looks like JSON (starts with [ or {)
            const looksLikeJson = result.trim().startsWith('[') || result.trim().startsWith('{');
            
            return !isError && (looksLikeJson || result.length > 50); // Keep JSON or substantial responses
        });
        
        console.log(`[LLM] Raw results count: ${results.length}`);
        console.log(`[LLM] Valid results count: ${validResults.length}`);
        if (results.length > 0) {
            console.log(`[LLM] First raw result preview:`, results[0].substring(0, 200) + '...');
        }
        
        // Return the first successful result or combine all results
        if (validResults.length === 0) {
            console.log(`[LLM] No valid results found, returning empty JSON array`);
            return '[]';
        } else if (validResults.length === 1) {
            return validResults[0];
        } else {
            // Combine multiple results
            return validResults.join('\n\n');
        }
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`[LLM] Error with Gemini API after ${totalTime}ms:`, error);
        throw error;
    }
}

export const askGpt = async (prompt, documents = []) => {
    const startTime = Date.now();
    
    try {
        console.log(`[LLM] Starting GPT-4.1 processing for ${documents.length} documents`);
        
        // Prepare and upload files for OpenAI
        const pdfDownloadStartTime = Date.now();
        const fileUploadPromises = documents.map(async (document, index) => {
            try {
                const docStartTime = Date.now();
                // Download PDF from Firebase Storage URL
                console.log(`[LLM] Starting download for PDF ${index + 1}/${documents.length}`);
                const fileBuffer = await downloadPDFFromURL(document.url);
                const docEndTime = Date.now();
                console.log(`[LLM] PDF ${index + 1}/${documents.length} downloaded in ${docEndTime - docStartTime}ms (size: ${fileBuffer.length} bytes)`);
                
                // Upload file to OpenAI
                const uploadStartTime = Date.now();
                console.log(`[LLM] Starting upload for PDF ${index + 1}/${documents.length} to OpenAI`);
                
                // Create a proper file object for OpenAI
                const fileName = document.fileName || `document_${index + 1}.pdf`;
                
                return {
                    type: "file",
                    file: {
                        filename: fileName,
                        file_data: `data:application/pdf;base64,${fileBuffer.toString('base64')}`,
                    }
                };
            } catch (error) {
                console.error(`[LLM] Error processing PDF ${index + 1}/${documents.length}:`, error);
                console.error(`[LLM] Error stack:`, error.stack);
                throw error;
            }
        });
        
        // Wait for all PDF downloads and uploads to complete in parallel
        console.log(`[LLM] Waiting for all file operations to complete...`);
        const fileData = await Promise.all(fileUploadPromises);
        const pdfDownloadEndTime = Date.now();
        console.log(`[LLM] All PDF downloads and uploads completed in ${pdfDownloadEndTime - pdfDownloadStartTime}ms (parallel processing)`);
        console.log(`[LLM] File data prepared:`, fileData.length, 'files');
        
        // Generate content with files using GPT-4.1
        const llmStartTime = Date.now();
        console.log(`[LLM] Starting GPT-4.1 API call with ${documents.length} documents`);
        const max_tokens = 512 + fileData.length * 265;
        const response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                {
                    role: "system",
                    content:prompt
                },
                {
                    role: "user",
                    content: [
                        ...fileData
                    ]
                }
            ],
            max_tokens: max_tokens,
            temperature: 0.1
        });
        
        const llmEndTime = Date.now();
        console.log(`[LLM] GPT-4.1 API call completed in ${llmEndTime - llmStartTime}ms`);
        console.log(response.choices[0].message.content);
        const totalTime = Date.now() - startTime;
        console.log(`[LLM] Total GPT-4.1 processing time: ${totalTime}ms`);
        
        return response.choices[0].message.content;
        
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`[LLM] Error with GPT-4.1 API after ${totalTime}ms:`, error);
        console.error(`[LLM] Error details:`, error.message);
        if (error.response) {
            console.error(`[LLM] Error response:`, error.response.data);
        }
        throw error;
    }
}