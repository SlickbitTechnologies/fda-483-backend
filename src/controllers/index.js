import { askGemini, askGpt } from '../utils/index.js';
import { getDocumentsByDateRange, downloadPDFFromURL, getDocumentsByFeiNumbers, getFirebaseData } from '../utils/pdfExtractor.js';

const getDocumentResult = async(documents) => {

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
        
        // console.log(`[API] Processing documents:`, documents.map(d => d.companyName));
        
        // // Process documents with LLM
        // const llmStartTime = Date.now();
        // const result = await getDocumentResult(documents);
        // const llmEndTime = Date.now();
        // console.log(`[API] LLM processing completed in ${llmEndTime - llmStartTime}ms`);

        // const totalApiTime = Date.now() - apiStartTime;
        // console.log(`[API] Total /timeAnalysis API call completed in ${totalApiTime}ms`);
        // console.log(`[API] Breakdown: Firestore=${firestoreEndTime - firestoreStartTime}ms, LLM=${llmEndTime - llmStartTime}ms`);
        return documents;        
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
        // const result = await getDocumentResult(documents);
        return documents;
    } catch (error) {
        console.error('Error in fetchFeiNumbers:', error);
        return { error: 'Failed to process request', details: error.message };
    }
}

export const fetchFirebaseData = async() => {
    try {
        const documents = await getFirebaseData();
        if (documents.length === 0) {
            return { error: `No documents found in Firebase Firestore` };
        }
        return documents;
    } catch (error) {
        console.error('Error in fetchFirebaseData:', error);
        return { error: 'Failed to process request', details: error.message };
    }
}
