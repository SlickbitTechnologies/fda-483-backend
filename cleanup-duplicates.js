import { db } from './src/utils/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

const cleanupDuplicates = async () => {
    try {
        console.log('Starting duplicate cleanup...');
        
        // Get all documents from Firestore
        const snapshot = await db.collection('fda-483-documents').get();
        console.log(`Total documents in Firestore: ${snapshot.size}`);
        
        // Group documents by unique identifiers (fei_number + date + name)
        const groupedDocs = new Map();
        const duplicates = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.fei_number}_${data.date}_${data.name}`;
            
            if (groupedDocs.has(key)) {
                // This is a duplicate
                duplicates.push({
                    id: doc.id,
                    key: key,
                    data: data
                });
            } else {
                // First occurrence
                groupedDocs.set(key, {
                    id: doc.id,
                    data: data
                });
            }
        });
        
        console.log(`Found ${duplicates.length} duplicate documents`);
        console.log(`Unique documents: ${groupedDocs.size}`);
        
        if (duplicates.length === 0) {
            console.log('No duplicates found!');
            return;
        }
        
        // Show duplicates before deletion
        console.log('\nDuplicate documents to be deleted:');
        duplicates.forEach((dup, index) => {
            console.log(`${index + 1}. ID: ${dup.id}, FEI: ${dup.data.fei_number}, Date: ${dup.data.date}, Name: ${dup.data.name}`);
        });
        
        // Ask for confirmation
        console.log('\nDo you want to proceed with deletion? (y/n)');
        // For now, we'll proceed with deletion
        // In a real scenario, you might want to add user input confirmation
        
        // Delete duplicate documents
        console.log('\nDeleting duplicate documents...');
        const batch = db.batch();
        
        duplicates.forEach(dup => {
            const docRef = db.collection('fda-483-documents').doc(dup.id);
            batch.delete(docRef);
        });
        
        await batch.commit();
        
        console.log(`Successfully deleted ${duplicates.length} duplicate documents`);
        console.log(`Remaining documents: ${groupedDocs.size}`);
        
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
};

// Run the cleanup
cleanupDuplicates().then(() => {
    console.log('Cleanup completed');
    process.exit(0);
}).catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
}); 