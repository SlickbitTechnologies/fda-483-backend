import { db } from './src/utils/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

const addDeduplicationLogic = async () => {
    try {
        console.log('Adding deduplication logic to existing documents...');
        
        // Get all documents from Firestore
        const snapshot = await db.collection('fda-483-documents').get();
        console.log(`Total documents in Firestore: ${snapshot.size}`);
        
        // Create a map to track unique combinations
        const uniqueDocs = new Map();
        const documentsToUpdate = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.fei_number}_${data.date}_${data.name}`;
            
            if (uniqueDocs.has(key)) {
                // This is a duplicate - mark for deletion
                console.log(`Duplicate found: ${doc.id} (${key})`);
            } else {
                // First occurrence - keep this one and add unique identifier
                uniqueDocs.set(key, doc.id);
                documentsToUpdate.push({
                    id: doc.id,
                    data: {
                        ...data,
                        uniqueKey: key // Add a unique key for future deduplication
                    }
                });
            }
        });
        
        console.log(`Documents to update with unique keys: ${documentsToUpdate.length}`);
        
        // Update documents with unique keys
        const batch = db.batch();
        
        documentsToUpdate.forEach(doc => {
            const docRef = db.collection('fda-483-documents').doc(doc.id);
            batch.update(docRef, { uniqueKey: doc.data.uniqueKey });
        });
        
        await batch.commit();
        
        console.log(`Successfully updated ${documentsToUpdate.length} documents with unique keys`);
        
        // Create a composite index for better querying
        console.log('\nRecommendation: Create a composite index in Firestore for:');
        console.log('- Collection: fda-483-documents');
        console.log('- Fields: fei_number (Ascending), date (Ascending), name (Ascending)');
        console.log('- This will help with efficient deduplication queries');
        
    } catch (error) {
        console.error('Error adding deduplication logic:', error);
    }
};

// Run the deduplication logic addition
addDeduplicationLogic().then(() => {
    console.log('Deduplication logic addition completed');
    process.exit(0);
}).catch(error => {
    console.error('Deduplication logic addition failed:', error);
    process.exit(1);
}); 