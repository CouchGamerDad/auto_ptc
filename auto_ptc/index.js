import 'babel-polyfill/lib/index.js';
import 'babel-register/lib/node.js';
import fs from 'fs';
import createAccount from './src/auto_ptc.js';

const STORE_FILE = './accounts.txt';
const CSV_FILE_PATH = 'C:\\pgauto\\pgauto\\credentials.csv';

async function createSingleAccount() {
  try {
    console.log('Creating account...');
    const account = await createAccount();

    // Append account details to accounts.txt (as JSON)
    fs.appendFileSync(STORE_FILE, "\n\n" + JSON.stringify(account, null, 2));
    console.log('Account created successfully.');

    // Append account details to credentials.csv in the username,password format
    const accountCsvEntry = `${account.username},${account.password}\n`;
    fs.appendFileSync(CSV_FILE_PATH, accountCsvEntry);
    console.log('Account details added to CSV file successfully.');

  } catch (err) {
    console.error('Error creating account:', err.message || err);
    fs.appendFileSync('error-log.txt', `${new Date().toISOString()} - Error creating account: ${err.stack || err}\n`);
  }
}

async function createMultipleAccounts(count) {
  for (let i = 1; i <= count; i++) {
    console.log(`Starting account creation ${i} of ${count}...`);
    await createSingleAccount();
  }
}

// Run the account creation X amount of times
createMultipleAccounts(5);
