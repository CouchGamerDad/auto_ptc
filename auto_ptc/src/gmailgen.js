import fs from 'fs';

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateGmail() {
  const email = `poke${rand(1000, 9999)}@gmail.com`;
  return email;
}

function saveEmailToFile(email) {
  const filePath = './gmail_accounts.txt';
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8'); // Create the file if it doesn't exist
  }
  fs.appendFileSync(filePath, `${email}\n`, 'utf8'); // Append the email to the file
}

export function createGmailAccount() {
  const email = generateGmail();
  saveEmailToFile(email);
  console.log(`Generated Gmail account: ${email}`);
  return email;
}

// Run the generator multiple times to create a pool of emails
console.log('Generating Gmail accounts...');
for (let i = 0; i < 10; i++) {
  createGmailAccount();
}
