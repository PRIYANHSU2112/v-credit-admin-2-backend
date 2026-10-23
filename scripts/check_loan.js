const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

const uri = process.env.MONGO_URI;

async function run() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('v-locker');
        const collection = db.collection('customerloans');
        const loan = await collection.findOne({ _id: new ObjectId('696f51b948e98477c9962f74') });
        if (!loan) {
            console.log('LOAN_NOT_FOUND');
        } else {
            console.log('LOAN_DATA:', JSON.stringify(loan, null, 2));
        }
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await client.close();
    }
}
run();
