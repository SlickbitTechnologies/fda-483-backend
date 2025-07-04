import { bucket, db } from './firebase.js';

export const getPDFFiles = async () => {
    try {
        const [files] = await bucket.getFiles();
        const pdfFiles = files
            .filter(file => file.name.toLowerCase().endsWith('.pdf'))
            .map(file => file.name);
        
        return pdfFiles;
    } catch (error) {
        console.error('Error reading PDF files from Firebase:', error);
        return [];
    }
};

export const getDocumentsByDateRange = async (startDate, endDate) => {
    try {
        console.log(`Fetching documents from Firestore between ${startDate} and ${endDate}`);
        
        // Convert date strings to Date objects for comparison
        const start = startDate;
        const end = endDate;
        
        // Query Firestore collection
        const snapshot = await db.collection('fda83docs').get();
        
        let documents = [];
        let seenKeys = new Set(); // Track unique combinations to prevent duplicates
        
        console.log(`Total documents in snapshot: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const docDate = new Date(data.date).getTime();
            
            // Create a unique key for deduplication
            const uniqueKey = `${data.fei_number}_${data.date}_${data.name}`;
            
            console.log(`Processing document ID: ${doc.id}, Unique Key: ${uniqueKey}`);
            
            // Check if document date falls within the range and has observations
            if (docDate >= start && docDate <= end && data.observations && data.observations.length > 0) {
                // Only add if we haven't seen this unique combination before
                if (!seenKeys.has(uniqueKey)) {
                    seenKeys.add(uniqueKey);
                    documents.push({
                        id: doc.id,
                        companyName: data.name || 'Company',
                        date: data.date,
                        url: data.firebaseUrl,
                        feiNumber: data.fei_number,
                        observations: data.observations,
                        repeatFinding: data.repeatFinding,
                    });
                    console.log(`Added document: ${doc.id}`);
                } else {
                    console.log(`Skipped duplicate document: ${doc.id} (key: ${uniqueKey})`);
                }
            } else {
                console.log(`Skipped document ${doc.id} - date range or observations check failed`);
            }
        });
        
        console.log(`Found ${documents.length} unique documents in date range`);
        console.log(`Total duplicates skipped: ${snapshot.size - documents.length}`);
        return documents;
        
    } catch (error) {
        console.error('Error fetching documents from Firestore:', error);
        return [];
    }
};

export const getDocumentsByFeiNumbers = async (feiNumbers) => {
    try {
        console.log('Fetching documents by FEI numbers:', feiNumbers);
        const snapshot = await db.collection('fda83docs').where('fei_number', 'in', feiNumbers).get();
        const documents = [];
        let seenKeys = new Set(); // Track unique combinations to prevent duplicates
        
        console.log(`Total documents in snapshot: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const uniqueKey = `${data.fei_number}_${data.date}_${data.name}`;
            
            console.log(`Processing document ID: ${doc.id}, Unique Key: ${uniqueKey}`);
            
            // Only add if we haven't seen this unique combination before
            if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                documents.push({
                    id: doc.id,
                    companyName: data.name || 'Company',
                    date: data.date,
                    url: data.firebaseUrl,
                    feiNumber: data.fei_number,
                    observations: data.observations,
                });
                console.log(`Added document: ${doc.id}`);
            } else {
                console.log(`Skipped duplicate document: ${doc.id} (key: ${uniqueKey})`);
            }
        });
        console.log(`Found ${documents.length} unique documents by FEI numbers`);
        console.log(`Total duplicates skipped: ${snapshot.size - documents.length}`);
        return documents;
    } catch (error) {
        console.error('Error fetching documents from Firestore:', error);
        return [];
    }
};

export const getFirebaseData = async() => {
    try {
        const snapshot = await db.collection('fda83docs').get();
        const documents = [];
        let seenKeys = new Set(); // Track unique combinations to prevent duplicates
        
        console.log(`getFirebaseData: Total documents in snapshot: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const uniqueKey = `${data.fei_number}_${data.date}_${data.name}`;
            
            console.log(`getFirebaseData: Processing document ID: ${doc.id}, Unique Key: ${uniqueKey}`);
            
            // Only add if we haven't seen this unique combination before
            if (!seenKeys.has(uniqueKey)) {
                seenKeys.add(uniqueKey);
                documents.push(data);
                console.log(`getFirebaseData: Added document: ${doc.id}`);
            } else {
                console.log(`getFirebaseData: Skipped duplicate document: ${doc.id} (key: ${uniqueKey})`);
            }
        });
        console.log(`getFirebaseData: Found ${documents.length} unique documents`);
        console.log(`getFirebaseData: Total duplicates skipped: ${snapshot.size - documents.length}`);
        return documents;
    } catch (error) {
        console.error('Error fetching documents from Firestore:', error);
        return [];
    }
};

export const downloadPDFFromFirebase = async (fileName) => {
    try {
        const file = bucket.file(fileName);
        const [buffer] = await file.download();
        return buffer;
    } catch (error) {
        console.error(`Error downloading PDF ${fileName} from Firebase:`, error);
        throw error;
    }
};

export const downloadPDFFromURL = async (url) => {
    console.log(url, 'urlurlurlurl')
    try {
        // Handle new clean public URLs: https://storage.googleapis.com/bucket-name/path/to/file.pdf
        const urlObj = new URL(url);
        
        // Extract the file path from the clean public URL
        // URL format: https://storage.googleapis.com/fda-483.firebasestorage.app/fda-483-documents/filename.pdf
        // We need to get everything after the bucket name
        const pathParts = urlObj.pathname.split('/');
        
        // The path should be: ["", "fda-483.firebasestorage.app", "fda-483-documents", "filename.pdf"]
        // We want everything after the bucket name (index 1)
        const filePath = pathParts.slice(2).join('/');
        
        if (!filePath) {
            throw new Error('Invalid Firebase Storage URL format');
        }
        
        console.log('Extracted file path:', filePath);
        const file = bucket.file(filePath);
        const [buffer] = await file.download();
        return buffer;
    } catch (error) {
        console.error(`Error downloading PDF from URL ${url}:`, error);
        throw error;
    }
}; 