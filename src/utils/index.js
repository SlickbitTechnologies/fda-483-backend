import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { downloadPDFFromURL, getFirebaseData } from './pdfExtractor.js';

const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const categories = [
    {
      label: 'Poor Documentation',
      definition: 'This refers to the failure to have established written procedures (SOPs) for operations, or having procedures that are incomplete, not formally approved, or outdated.',
      example: 'A company was cited for a lack of validated procedures for its production and process controls prior to releasing products for distribution.'
    },
    {
      label: 'Procedures Not Followed',
      definition: "This occurs when personnel do not adhere to the company's own established and written procedures during manufacturing, testing, or other operations.",
      example: 'Investigators observed that operators documented in production records that equipment had been cleaned and sterilized, when in fact, these critical activities were never performed.'
    },
    {
      label: 'Inadequate Investigations (CAPA)',
      definition: 'This is the failure to thoroughly investigate deviations, complaints, or out-of-specification results to identify the true root cause and implement effective Corrective and Preventive Actions (CAPA) to prevent recurrence.',
      example: 'A firm\'s investigation into a media fill failure that resulted in 124 contaminated units was deemed inadequate because it did not sufficiently explore the systemic reasons for the contamination.'
    },
    {
      label: 'Lack of Training',
      definition: 'This category addresses instances where personnel lack the necessary training, education, or experience to correctly perform their assigned duties in accordance with regulations.',
      example: 'A company was cited for failing to provide sufficient training to its employees on critical quality control procedures and product testing methods.'
    },
    {
      label: 'Facility & Equipment Issues',
      definition: 'This pertains to deficiencies where the physical plant and equipment are not properly designed, maintained, cleaned, or operated in a way that prevents product contamination and ensures quality.',
      example: 'An investigator observed liquid dripping from a ceiling pipe junction in a processing area directly above equipment that was labeled as "clean and ready for use".'
    },
    {
      label: 'Validation Failures',
      definition: 'This is the failure to establish with objective evidence that a process or piece of equipment will consistently produce a result or product meeting its predetermined specifications.',
      example: 'A company relocated manufacturing equipment but failed to requalify it in the new location or update the associated process control documentation before resuming production.'
    },
    {
      label: 'Inadequate Testing',
      definition: 'This involves the failure to perform appropriate and scientifically sound testing on raw materials, in-process materials, or finished products to ensure they meet all quality specifications before release.',
      example: 'A facility that handles human tissue failed to test a specimen from an anonymous oocyte donor for West Nile Virus during the required testing window.'
    },
    {
      label: 'Improper Handling & Storage',
      definition: 'This is the failure to handle, store, or label materials and products in a manner that prevents contamination, mix-ups, degradation, or other quality defects.',
      example: 'In a food facility, investigators observed rodent gnaw holes in bags of raw ingredients and apparent rodent excreta pellets on and around pallets of food.'
    },
    {
      label: 'Poor Record-Keeping',
      definition: 'This deficiency involves records that are not established or maintained, are incomplete or inaccurate, or are not retained for the required period. This is a cornerstone of data integrity.',
      example: "A firm's quality control incubators had no usage logbooks, creating significant gaps in equipment tracking and traceability."
    },
    {
      label: 'Adverse Event Reporting Failures',
      definition: 'This is the failure to properly and promptly report adverse events, product malfunctions, or other incidents to the FDA as required by regulation.',
      example: 'A medical device manufacturer fails to submit a required report of a device malfunction that could cause or contribute to a death or serious injury.'
    }
    ];
    

    const cfrNumber = [
        {
        section: '§211.22',
        title: 'Responsibilities of the Quality Control Unit'
        },
        {
        section: '§211.25',
        title: 'Personnel Qualifications'
        },
        {
        section: '§211.42',
        title: 'Design and Construction Features (Facility Design)'
        },
        {
        section: '§211.63',
        title: 'Equipment Design, Size, and Location'
        },
        {
        section: '§211.67',
        title: 'Equipment Cleaning and Maintenance'
        },
        {
        section: '§211.68',
        title: 'Automated, Mechanical, and Electronic Equipment'
        },
        {
        section: '§211.84',
        title: 'Testing and Approval of Incoming Components'
        },
        {
        section: '§211.100',
        title: 'Written Procedures (Production and Process Control)'
        },
        {
        section: '§211.110',
        title: 'Sampling and Testing of In-Process Materials'
        },
        {
        section: '§211.113',
        title: 'Control of Microbiological Contamination'
        },
        {
        section: '§211.115',
        title: 'Reprocessing'
        },
        {
        section: '§211.122',
        title: 'Labeling Control'
        },
        {
        section: '§211.130',
        title: 'Packaging and Labeling Operations'
        },
        {
        section: '§211.160',
        title: 'Laboratory Controls'
        },
        {
        section: '§211.165',
        title: 'Testing and Release for Distribution'
        },
        {
        section: '§211.166',
        title: 'Stability Testing'
        },
        {
        section: '§211.180',
        title: 'General Requirements (Records and Reports)'
        },
        {
        section: '§211.192',
        title: 'Production Record Review'
        },
        {
        section: '§211.198',
        title: 'Complaint Files'
        },
        {
        section: '§211.208',
        title: 'Recall Procedures'
        },
        {
        section: '21 CFR Part 210',
        title: 'GMP for Manufacturing, Processing, Packing, or Holding of Drugs (for APIs)'
        },
        {
        section: 'ICH Q7',
        title: 'GMP Guidance for Active Pharmaceutical Ingredients (recognized by FDA)'
        },
        {
        section: '21 CFR Part 820',
        title: 'Quality System Regulation (QSR) for Medical Devices'
        },
        {
        section: '21 CFR Parts 600–680',
        title: 'Biologics-Specific Requirements'
        },
        {
        section: '21 CFR Part 11',
        title: 'Electronic Records and Signatures (Data Integrity)'
        }
    ];

    const observationExample = [
        {
            "summary": "Quality control unit failed to follow its responsibilities and procedures, specifically document control. Uncontrolled \"SAMPLE LOCATION CHART\" documents for stability samples were found lacking required stamping as \"UNCONTROLLED COPY\" and proper validation details per SOP.",
            "category": "Documentation",
            "cfrNumber": "§211.22"
        },
        {
            "summary": "Reserve samples of drug products are not visually examined at least once a year for deterioration. Retain samples of Sarracenia Purpurea 0.17g/ml injection were not subjected to annual visual examination.",
            "category": "Laboratory Controls",
            "cfrNumber": "§211.170"
        }
    ]

    const repeatFindingExample = [
        'Documentation control appears to be an industry-wide challenge',
        'Cleaning validation protocols require standardization across the industry'
    ]

    const output = [
        {
            companyName: 'Company Name from the PDF',
            dateOfInspection: 'YYYY-MM-DD (date when inspection was conducted)',
            pdfFileName: 'exact filename of the PDF',
            inspectionNumber: 'inspection number if available, otherwise null',
            inspectionDate: 'YYYY-MM-DD (date when 483 was issued)',
            summary: '2-line summary focusing on key compliance violations and critical issues',
            category: 'Poor Documentation',
            cfrNumber: '§211.208',
            observations: observationExample,
            repeatFinding: repeatFindingExample
        }
    ]

    // Create prompt for analysis
    const prompt = `
        Analyze FDA 483 inspection reports and extract key information in JSON format.

        For each observation found, create an object with:
        - companyName: Company name from PDF
        - dateOfInspection: YYYY-MM-DD (inspection date)
        - pdfFileName: Exact PDF filename
        - inspectionNumber: Inspection number or null
        - inspectionDate: YYYY-MM-DD (483 issue date)
        - summary: 2-line summary of compliance violations
        - category: One from: ${JSON.stringify(categories)}
        - repeatFinding: Look for language indicating that a problem has occurred previously (e.g., “repeated,” “previously cited,” “same issue as prior inspection”)
        - cfrNumber: One from: ${JSON.stringify(cfrNumber)}

        Rules:
        - Create separate object for each observation
        - Don't combine observations from same company
        - Be concise and focused
        - Return ONLY valid JSON array - no extra text, no explanations
        - Ensure proper JSON syntax with no trailing commas
        - Use double quotes for all strings
        - Do not include any text before or after the JSON array

        Output format: ${JSON.stringify(output)}

        IMPORTANT: Return ONLY the JSON array, nothing else.
    `;
export const askGemini = async () => {
    let documents = [];
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
    const model = 'gemini-2.5-flash';
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