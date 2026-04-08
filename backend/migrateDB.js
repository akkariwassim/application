const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/smart_fence';
const REMOTE_URI = 'mongodb+srv://wassim:Wassimakkari1@smartfence.7zypd8b.mongodb.net/smart_fence?appName=smartfence';

const collectionsToMigrate = ['users', 'animals', 'zones', 'alerts', 'sensordatas'];

async function migrate() {
    console.log('Connecting to Local Database...');
    const localConn = await mongoose.createConnection(LOCAL_URI, {
      serverSelectionTimeoutMS: 5000,
    }).asPromise();
    console.log('✅ Local DB Connected');

    console.log('Connecting to Remote DB (Atlas)...');
    const remoteConn = await mongoose.createConnection(REMOTE_URI, {
      serverSelectionTimeoutMS: 15000,
    }).asPromise();
    console.log('✅ Remote DB Connected');

    for (const collName of collectionsToMigrate) {
        console.log(`\nMigration -> [${collName}]`);
        
        try {
            // Get local data
            const localCollection = localConn.collection(collName);
            const docs = await localCollection.find({}).toArray();
            
            console.log(`Found ${docs.length} documents in local collection ${collName}.`);
            
            if (docs.length > 0) {
                const remoteCollection = remoteConn.collection(collName);
                
                // Clear remote collection optional if it exists? Usually yes, to avoid dupes on retries
                await remoteCollection.deleteMany({});
                
                // Insert directly keeping the existing _id
                await remoteCollection.insertMany(docs);
                console.log(`✅ Successfully inserted ${docs.length} documents into Atlas ${collName}.`);
            } else {
                console.log(`No documents to insert for ${collName}.`);
            }
        } catch (error) {
            console.error(`❌ Error migrating collection ${collName}:`, error.message);
        }
    }

    console.log('\nMigration fully completed. Closing connections...');
    await localConn.close();
    await remoteConn.close();
    process.exit(0);
}

migrate().catch(err => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
});
