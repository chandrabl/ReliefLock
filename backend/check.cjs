require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const txs = await db.collection('transactions').find({ type: 'add_beneficiary' }).sort({ createdAt: -1 }).limit(3).toArray();
  console.log('TXS:', JSON.stringify(txs, null, 2));
  const apps = await db.collection('applications').find({}).sort({ createdAt: -1 }).limit(3).toArray();
  console.log('APPS:', JSON.stringify(apps, null, 2));
  process.exit(0);
});
