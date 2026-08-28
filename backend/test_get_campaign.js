import { ContractClient } from '../backend/dist/services/contractClient.js';

const client = new ContractClient('CBGVHVHLAWWYKHRTGJY7N7BGNJBQKCGA4ETOJ4U57HUXFVE5QNXFYVN3');

client.getCampaign(19).then(res => {
  console.log('Campaign 18:', res);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
