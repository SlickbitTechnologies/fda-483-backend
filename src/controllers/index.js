import { askGemini, askGpt } from '../utils/index.js';
import { getDocumentsByDateRange, downloadPDFFromURL, getDocumentsByFeiNumbers, getFirebaseData } from '../utils/pdfExtractor.js';

const getDocumentResult = async(documents) => {

    const categories = [
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

    const cfrNumber = [
       '§211.22',
       '§211.25',
       '§211.42',
       '§211.63',
       '§211.67',
       '§211.68',
       '§211.84',
       '§211.100',
       '§211.110',
       '§211.113',
       '§211.115',
       '§211.122',
       '§211.130',
       '§211.160',
       '§211.165',
       '§211.166',
       '§211.180',
       '§211.192',
       '§211.198',
       '§211.208',
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
            repeatFinding: 'repeatFinding',
            cfrNumber: '§211.208',
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
    - repeatFinding: "Yes" if repeat finding, "No" otherwise
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
    
    // Get AI analysis with PDF files
    // const result = await askGpt(prompt, documents);
    const result = await askGemini(prompt, documents);
    
    // Try to parse the JSON response
    let parsedResult;
    let responseText; // Declare responseText in the outer scope
    
    try {
        // Handle different response types
        if (typeof result === 'string') {
            responseText = result;
        } else if (result && typeof result === 'object' && result.text) {
            responseText = result.text;
        } else if (Array.isArray(result)) {
            // If result is already an array, return it directly
            return result;
        } else {
            console.error('Unexpected result type:', typeof result, result);
            return [];
        }
        
        // Check if the response contains error messages instead of JSON
        if (responseText.includes('Document') && (responseText.includes('too large') || responseText.includes('Processing failed'))) {
            console.log('Detected error messages in response, returning empty array');
            return [];
        }
        
        // Extract JSON from the response (in case there's extra text)
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            try {
                parsedResult = JSON.parse(jsonMatch[0]);
            } catch (matchError) {
                console.log('Failed to parse matched JSON, trying to clean and parse...');
                // Try to clean the JSON by removing extra characters
                const cleanedJson = jsonMatch[0]
                    .replace(/,\s*]/g, ']') // Remove trailing commas
                    .replace(/,\s*}/g, '}') // Remove trailing commas in objects
                    .replace(/\[\s*\[/g, '[') // Remove nested array starts
                    .replace(/\]\s*\]/g, ']'); // Remove nested array ends
                parsedResult = JSON.parse(cleanedJson);
            }
        } else {
            // Try to parse the entire response as JSON
            try {
                parsedResult = JSON.parse(responseText);
            } catch (fullError) {
                console.log('Failed to parse full response, trying to extract JSON...');
                // Try to find any JSON-like structure
                const jsonLikeMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
                if (jsonLikeMatch) {
                    try {
                        const cleanedJson = jsonLikeMatch[0]
                            .replace(/,\s*]/g, ']')
                            .replace(/,\s*}/g, '}')
                            .replace(/\[\s*\[/g, '[')
                            .replace(/\]\s*\]/g, ']');
                        parsedResult = JSON.parse(cleanedJson);
                    } catch (cleanError) {
                        console.error('Failed to parse cleaned JSON:', cleanError);
                        return [];
                    }
                } else {
                    console.error('No JSON-like structure found in response');
                    return [];
                }
            }
        }
    } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        console.error('Raw result:', result);
        console.error('Result type:', typeof result);
        
        // If it's a syntax error, show the content around the error position
        if (parseError instanceof SyntaxError && parseError.message.includes('position') && responseText) {
            const positionMatch = parseError.message.match(/position (\d+)/);
            if (positionMatch) {
                const position = parseInt(positionMatch[1]);
                const start = Math.max(0, position - 50);
                const end = Math.min(responseText.length, position + 50);
                console.error('Content around error position:', responseText.substring(start, end));
                console.error('Error position marker:', ' '.repeat(Math.min(50, position - start)) + '^');
            }
        }
        
        // If it's a syntax error and the response contains error messages, return empty array
        if (parseError instanceof SyntaxError && typeof result === 'string' && 
            (result.includes('Document') && (result.includes('too large') || result.includes('Processing failed')))) {
            console.log('Syntax error due to error messages, returning empty array');
            return [];
        }
        
        return [];
    }
    
    return parsedResult
}

export const fetchTimeAnalysis = async (startDate, endDate) => {
    const apiStartTime = Date.now();
    console.log(`[API] /timeAnalysis endpoint called at ${new Date().toISOString()}`);
    console.log(`[API] Date range: ${startDate} to ${endDate}`);
    
    try {
        // Get documents from Firestore based on date range
        const firestoreStartTime = Date.now();
        console.log(`[API] Starting Firestore query for documents`);
        const documents = await getDocumentsByDateRange(startDate, endDate);
        const firestoreEndTime = Date.now();
        console.log(`[API] Firestore query completed in ${firestoreEndTime - firestoreStartTime}ms`);
        console.log(`[API] Documents found in date range: ${documents.length}`);
        
        if (documents.length === 0) {
            const totalTime = Date.now() - apiStartTime;
            console.log(`[API] No documents found. Total API time: ${totalTime}ms`);
            return 'No documents found in Firebase Firestore for the date range'
        }
        
        console.log(`[API] Processing documents:`, documents.map(d => d.companyName));
        
        // Process documents with LLM
        const llmStartTime = Date.now();
        const result = await getDocumentResult(documents);
        const llmEndTime = Date.now();
        console.log(`[API] LLM processing completed in ${llmEndTime - llmStartTime}ms`);

        const totalApiTime = Date.now() - apiStartTime;
        console.log(`[API] Total /timeAnalysis API call completed in ${totalApiTime}ms`);
        console.log(`[API] Breakdown: Firestore=${firestoreEndTime - firestoreStartTime}ms, LLM=${llmEndTime - llmStartTime}ms`);

        return result;        
    } catch (error) {
        const totalTime = Date.now() - apiStartTime;
        console.error(`[API] Error in fetchTimeAnalysis after ${totalTime}ms:`, error);
        return { error: 'Failed to process request', details: error.message };
    }
}

export const fetchFeiNumbers = async(feiNumbers) => {
    try {
        const documents = await getDocumentsByFeiNumbers(feiNumbers);
        if (documents.length === 0) {
            return { error: `No documents found in Firebase Firestore for the feiNumbers: ${feiNumbers}` };
        }
        const result = await getDocumentResult(documents);
        return result;
    } catch (error) {
        console.error('Error in fetchFeiNumbers:', error);
        return { error: 'Failed to process request', details: error.message };
    }
}

export const fetchFirebaseData = async() => {
    try {
        const documents = await getFirebaseData();
        if (documents.length === 0) {
            return { error: `No documents found in Firebase Firestore for the date range: ${startDate} to ${endDate}` };
        }
        return documents;
    } catch (error) {
        console.error('Error in fetchFirebaseData:', error);
        return { error: 'Failed to process request', details: error.message };
    }
}
