import "dotenv/config";
import {OpenAIThreadsFetcher} from "../libs/OpenAIThreadsFetcher";

require('dotenv').config();

const runTest = async () => {
  // Replace 'YOUR_API_KEY' and 'YOUR_ORG_ID' with your actual OpenAI API key and organization ID
  const token: any = process.env.OPENAI_API_KEY;
  const org: any = process.env.OPENAI_ORGANIZATION;

  const fetcher = new OpenAIThreadsFetcher(token, org);
  await fetcher.processThreads(2); // Process threads across two pages
};

runTest().then(() => console.log('Test completed.'));