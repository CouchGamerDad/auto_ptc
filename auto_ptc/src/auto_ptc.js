// Import necessary libraries
import prettyjson from 'prettyjson';
import puppeteer from 'puppeteer';
import random_name from 'node-random-name';
import clipboardy from 'clipboardy'; // For accessing clipboard content
import sharp from 'sharp'; // For adding red dot markers to screenshots
import fs from 'fs';
import { spawn, exec } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config(); 

// Constants
const API_ENDPOINT = 'https://club.pokemon.com/us/pokemon-trainer-club/sign-up/';
const CHROME_PROFILE_PATH = process.env.CHROME_PROFILE_PATH;
const PASSWORD = process.env.PASSWORD;

console.log('Chrome Profile Path:', CHROME_PROFILE_PATH);
console.log('Password:', PASSWORD);


// Start of Browser Setup Function
async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1200, height: 800 }, // Fixed values remain here
    executablePath: process.env.CHROME_EXECUTABLE_PATH, // From .env
    userDataDir: process.env.CHROME_PROFILE_PATH, // From .env
    args: [
      `--disable-extensions-except=${process.env.LOAD_EXTENSION}`,
      `--load-extension=${process.env.LOAD_EXTENSION}`,
      '--disable-blink-features=AutomationControlled', // These remain fixed
      '--disable-background-timer-throttling'
    ]
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(100000); // Set global timeout to 100 seconds
  return browser;
}
// End of Browser Setup Function


async function checkCurrentPage(ptcPage) {
  try {
      // Ensure `ptcPage` is defined
      if (!ptcPage) {
          throw new Error("ptcPage is not defined. Please pass a valid page object.");
      }

      // Retry logic with exponential backoff
      const maxRetries = 5; // Number of retries
      let attempts = 0;

      while (attempts < maxRetries) {
          try {
              // Wait for either the success header or the error message to appear
              const pageDetected = await Promise.race([
                  ptcPage.waitForSelector('h1.header', { timeout: 20000 }), // Success page header
                  ptcPage.waitForSelector('h1', { timeout: 20000 }), // Error page with <h1>
              ]);

              if (pageDetected) {
                  const headerText = await ptcPage.evaluate(
                      el => el.textContent,
                      pageDetected
                  );

                  if (headerText.includes("Your code is on the way!")) {
                      // If success header is detected
                      console.log("Code confirmation page loaded.");
                      return 'codeConfirmationPage';
                  } else if (headerText.includes("Oops! There Was an Error")) {
                      // If error page is detected
                      console.log("Oops! There was an error page detected.");
                      return 'errorPage';
                  }
              }
          } catch (error) {
              console.log(`Attempt ${attempts + 1} failed: ${error.message || error}`);
              if (attempts === maxRetries - 1) {
                  throw new Error("Failed to detect the page after multiple retries.");
              }
          }

          attempts++;
          await delay(2000 * attempts); // Wait before retrying (exponential backoff)
      }
  } catch (error) {
      console.error("Error detecting the current page:", error.message || error);
      return 'unknown';
  }
}

/**
 * Step 2: Navigate to the Email Generator popup
 * Opens the email generator page and ensures it is active and visible.
 *
 * @param {object} emailPage - Puppeteer page object for email generator.
 */
async function openEmailPage(emailPage) {
  try {
    console.log('Navigating to the Email Generator popup...');
    await emailPage.goto('chrome-extension://nopbpkakbijkbhfcofpmfkdkdgbcjpec/popup.html', { waitUntil: 'load' });

    // Ensure the page is active and visible
    await emailPage.evaluateOnNewDocument(() => {
      Object.defineProperty(document, 'hidden', { value: false });
      Object.defineProperty(document, 'visibilityState', { value: 'visible' });
    });

    await emailPage.bringToFront(); // Focus on the email generator tab
    await delay(2000); // Allow time for the page to stabilize
    console.log('Email Generator popup is now open and active.');
  } catch (err) {
    console.error('Error opening the Email Generator popup:', err.message || err);
    throw new Error('Failed to open the Email Generator popup.');
  }
}

/**
 * Refreshes the email generator page and checks for the refresh button.
 *
 * @param {object} emailPage - Puppeteer page object for email generator.
 * @param {number} maxAttempts - Maximum number of refresh attempts.
 * @param {number} retryDelay - Delay (in ms) between each attempt.
 */
async function refreshEmail(emailPage, maxAttempts = 2, retryDelay = 5000) {
  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`Attempt ${attempt}: Checking for the Refresh button...`);

      const refreshButtonExists = await emailPage.$('#refresh-button'); // Check for the refresh button
      if (refreshButtonExists) {
        console.log('Refresh button is visible. Clicking it...');
        await emailPage.click('#refresh-button'); // Click the refresh button
        await delay(2000); // Wait after clicking
        console.log('Email refreshed successfully.');
        return; // Exit once refresh is successful
      }

      console.log(`Refresh button not found. Retrying in ${retryDelay / 1000} seconds...`);
      await delay(retryDelay); // Wait before retrying
    }

    console.log('Refresh button not found after max attempts. Proceeding without refreshing.');
    // No exception thrown; just proceed with the rest of the code
  } catch (err) {
    console.error('Error during email refresh:', err.message || err);
    console.log('Proceeding without refreshing the email generator.');
    // No exception re-thrown; just log the error and continue
  }
}

/**
 * Takes a screenshot of the email page for Tesseract processing.
 *
 * @param {object} emailPage - Puppeteer page object for email generator.
 */
async function captureEmailPageScreenshot(emailPage) {
  const processingDir = path.join('./', 'processing');
  const screenshotPath = path.join(processingDir, 'email_page_screenshot.png');

  try {
    console.log('Capturing screenshot of the email page...');

    // Ensure the 'processing' directory exists
    if (!fs.existsSync(processingDir)) {
      fs.mkdirSync(processingDir, { recursive: true });
    }

    // Ensure the email page is in focus
    await emailPage.bringToFront();
    await emailPage.waitForSelector('body', { visible: true }); // Wait for the body to be visible

    // Take a screenshot of the entire visible email page and save it in the 'processing' folder
    await emailPage.screenshot({ path: screenshotPath, fullPage: false });

    console.log(`Screenshot saved at: ${screenshotPath}`);
    return screenshotPath; // Return the file path for further processing
  } catch (err) {
    console.error('Error capturing screenshot of the email page:', err.message || err);
    throw new Error('Failed to capture screenshot of the email page.');
  }
}

/**
 * Watches the page until it detects the success message.
 *
 * @param {object} ptcPage - Puppeteer page object for the success page.
 * @returns {Promise<void>} - Resolves when the success message is found.
 */
async function waitForSuccessMessage(ptcPage) {
  try {
    console.log('Waiting for the success message to appear...');

    // Wait for the specific div that indicates success
    await ptcPage.waitForSelector('.title-wrapper h1', { visible: true, timeout: 60000 });
    
    // Validate that the inner text matches exactly "Success"
    const successText = await ptcPage.$eval('.title-wrapper h1', el => el.innerText.trim());
    if (successText === 'Success') {
      console.log('Success page detected with confirmation message!');
    } else {
      throw new Error('Success message text does not match the expected value.');
    }
  } catch (err) {
    console.error('Error while waiting for success message:', err.message || err);
    throw new Error('Failed to detect the success page within the timeout period.');
  }
}
/**
 * Analyzes an image using a Python script with PyTesseract to extract the 6-digit activation code.
 *
 * @param {string} imagePath - Path to the screenshot image to be analyzed.
 * @returns {Promise<string>} - Returns the extracted 6-digit activation code.
 */
async function extractActivationCode(imagePath) {
  console.log('Analyzing image for activation code using Tesseract...');

  return new Promise((resolve, reject) => {
    try {
      const pythonProcess = spawn('python', ['analyze_activation_code.py', imagePath]);

      let activationCode = '';

      pythonProcess.stdout.on('data', (data) => {
        activationCode += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error('Error during Tesseract analysis:', data.toString());
      });

      pythonProcess.on('close', (code) => {
        if (code === 0 && activationCode.trim()) {
          if (/^\d{6}$/.test(activationCode.trim())) { // Validate that the activation code is a 6-digit number
            console.log(`Activation code successfully extracted: ${activationCode.trim()}`);
            resolve(activationCode.trim());
          } else {
            console.error('Invalid activation code detected.');
            reject(new Error('Invalid activation code detected.'));
          }
        } else {
          console.error('Failed to extract activation code.');
          reject(new Error('Failed to extract activation code.'));
        }
      });
      
    } catch (err) {
      console.error('Error during activation code extraction:', err.message || err);
      reject(new Error('Activation code extraction failed.'));
    }
  });
}

// Switch to Active Tab Before Use
async function ensureActiveTab(page) {
  console.log('Bringing tab to front...');
  await page.bringToFront(); // Ensure Puppeteer interacts with the active tab
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { value: false });
    Object.defineProperty(document, 'visibilityState', { value: 'visible' });
  });
}

// Utility Function: Generate a random screen name
function getScreenName() {
  let randomFirstName;
  do {
    randomFirstName = random_name({ first: true, gender: 'all' }).slice(0, 6); // Get a random first name and limit to 6 characters
  } while (randomFirstName.toLowerCase() === 'will'); // Regenerate if the name is "Will"

  let randomNumbers;
  do {
    randomNumbers = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6 random digits
  } while (randomNumbers.includes('69')); // Regenerate if "69" is present

  const screenName = randomFirstName + randomNumbers; // Combine the name and numbers
  console.log(`Generated screen name: ${screenName}`); // Log the generated screen name
  return screenName;
}

// Utility Function: Generate a random username
let currentPrefixIndex = 0; // Track the current prefix index
let prefixUsageCount = 0; // Track the usage count of the current prefix

function getUsername() {
  // Load prefixes from .env
  const prefixes = process.env.USERNAME_PREFIXES.split(','); // Split prefixes by comma

  // Check if the current prefix has been used 10 times
  if (prefixUsageCount >= 10) {
    currentPrefixIndex = (currentPrefixIndex + 1) % prefixes.length; // Move to the next prefix
    prefixUsageCount = 0; // Reset usage count
  }

  const currentPrefix = prefixes[currentPrefixIndex]; // Get the current prefix
  const randomNumbers = Math.floor(10000 + Math.random() * 90000).toString(); // Generate 5 random digits

  prefixUsageCount++; // Increment usage count for the current prefix

  return `${currentPrefix}${randomNumbers}`; // Combine the prefix with the numbers
}

// End of function getUsername


// Utility Function: Add delay

// Start of function delay
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
// End of function delay

// start of function call change_vpn

async function changeVPN() {
  return new Promise((resolve, reject) => {
    exec('python change_vpn.py', (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        reject(new Error('Failed to change VPN'));
        return;
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }
      console.log(`stdout: ${stdout}`);
      console.log('VPN successfully changed.');
      resolve();
    });
  });
}
// end of function call change_vpn

// Start of Email Generator Interaction
async function generateEmail(page) {
  console.log('Interacting with the Email Generator extension...');

  // Step 1: Close the initial tab
  const pages = await page.browser().pages();
  for (const p of pages) {
    const url = await p.url();
    if (url.includes('email-generator.tilda.ws')) {
      console.log('Closing tab:', url);
      await p.close();
    }
  }

  // Step 2: Navigate to the Email Generator popup
  console.log('Navigating to the Email Generator popup...');
  await page.goto('chrome-extension://nopbpkakbijkbhfcofpmfkdkdgbcjpec/popup.html', { waitUntil: 'load' });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { value: false });
    Object.defineProperty(document, 'visibilityState', { value: 'visible' });
});

  await page.bringToFront();
  await delay(2000);

  // Step 3: Check for and handle email generation buttons
  console.log('Checking for email generation buttons...');
  try {
    // Check if the "Regenerate Email" button exists
    await page.waitForSelector('#regenerate-email-button', { visible: true, timeout: 3000 });
    console.log('Regenerate Email button found. Clicking it...');
    await page.click('#regenerate-email-button');
  } catch {
    
    // If "Regenerate Email" button doesn't exist, check for "Generate Email Address" button
    console.log('"Regenerate Email" button not found. Checking for "Generate Email Address" button...');
    await page.waitForSelector('#generate-email-button', { visible: true });
    console.log('"Generate Email Address" button found. Clicking it...');
    await page.click('#generate-email-button');
  }

  // Step 4: Wait for the email address to change
  console.log('Waiting for the email address to change...');
  const previousEmail = await page.$eval('#email', (emailElement) => emailElement.textContent.trim());

  await page.waitForFunction(
    (prevEmail) => {
      const emailElement = document.querySelector('#email');
      return emailElement && emailElement.textContent.trim() !== prevEmail;
    },
    { timeout: 100000 }, // Wait up to 100 seconds for the email to change
    previousEmail
  );

  console.log('Email address has changed. Fetching the updated email...');
  const newEmail = await page.$eval('#email', (emailElement) => emailElement.textContent.trim());
  console.log(`Generated email address: ${newEmail}`);

  // Step 4: Copy the email to the clipboard
  console.log('Copying email address...');
  await page.waitForSelector('#copy-email-button', { visible: true });
  await page.click('#copy-email-button');
  await delay(1000); // Ensure the email is copied to the clipboard

  // Use clipboardy to get the copied email address
  const email = await clipboardy.read();
  console.log(`Generated email address: ${email}`);
  return email;
}
// End of Email Generator Interaction

// Function: Main Account Creation Process

// Start of function createAccount
export default async function createAccount(newConfig = {}) {
  const username = getUsername();
  const password = PASSWORD;

  console.log('Generating identity...');
  const config = {
    username,
    password,
    ...newConfig,
  };

  console.log(prettyjson.render(config));

  console.log('Auto PTC Account creator..');
  const browser = await setupBrowser();
  const emailPage = await browser.newPage(); // Email generator tab
  const ptcPage = await browser.newPage(); // PTC account creation tab

  //const vpn = await openNewExtensionPage(vpnPage) // activate the vpn and choose a locatioon
  const email = await generateEmail(emailPage); // Generate the initial email
 

  try {
    console.log('Navigating to the sign-up page...');
    await ptcPage.goto(API_ENDPOINT, { waitUntil: 'load', timeout: 60000 });
    await ptcPage.bringToFront();
    await ptcPage.evaluateOnNewDocument(() => {
      Object.defineProperty(document, 'hidden', { value: false });
      Object.defineProperty(document, 'visibilityState', { value: 'visible' });
    });

    await delay(1000);
    console.log('Determining the initial page...');
    const isEmailPage = await ptcPage.$('#email-text-input');
    await delay(1000);
    if (isEmailPage) {
      console.log('Detected email input page first.');
      console.log('Entering email address...');
      await ptcPage.type('#email-text-input', email);
      await ptcPage.type('#confirm-text-input', email);
      await delay(2000);
      console.log('Continuing with email input and account creation...');

      // Check if the Continue button is present and enabled
      const continueButtonSelector = 'button.basic-button.primary';
      const continueButton = await ptcPage.$(continueButtonSelector);
      
      if (continueButton) {
        const isDisabled = await ptcPage.evaluate(
          (selector) => document.querySelector(selector).disabled,
          continueButtonSelector
        );
      
        if (!isDisabled) {
          console.log('Clicking the Continue button...');
          await ptcPage.click(continueButtonSelector);
          await delay(1000);
        } else {
          console.log('Continue button is disabled. Waiting for it to become enabled...');
          await ptcPage.waitForFunction(
            (selector) => !document.querySelector(selector).disabled,
            {},
            continueButtonSelector
          );
          console.log('Continue button is now enabled. Clicking it...');
          await ptcPage.click(continueButtonSelector);
          await delay(1000);
        }
      } else {
        console.log('No Continue button found. Proceeding...');
      }
      
    } else {

      console.log('Detected country and date of birth page first.');
      console.log('Filling out the country and date of birth...');
      await ptcPage.waitForSelector('#country-select', { visible: true });
      await ptcPage.select('#country-select', 'United States');
      await ptcPage.select('#year-select', '1981');
      await ptcPage.select('#month-select', 'November');
      await ptcPage.select('#day-select', '23');
      await delay(500);

      console.log('Pressing Continue button...');
      await ptcPage.click('#ageGateSubmit');
      await delay(500);
    }

    console.log('Clicking "I Am Sure" button...');
    let yOffset = 0; // Start offset
    let maxAttempts = 20; // Maximum number of attempts to locate and click the button
    let buttonClicked = false;  
    let successfulButtonLocation = null; // Variable to store successful button coordinates
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let x, y;
    
        if (successfulButtonLocation) {
          // Use the previously stored button location
          console.log('Reusing the previously stored button location...');
          ({ x, y } = successfulButtonLocation);
        } else {
          // Try to locate the button
          const buttonPosition = await ptcPage.evaluate(() => {
            const button = document.querySelector('button.basic-button.primary');
            if (button) {
              const rect = button.getBoundingClientRect();
              return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
            return null;
          });
    
          if (buttonPosition) {
            ({ x, y } = buttonPosition);
          } else {
            // Default to clicking near the bottom center of the page
            const viewport = await ptcPage.viewport();
            await delay(2000);
            x = viewport.width / 2; // Center horizontally
            y = viewport.height - 55 + yOffset; // Start near the bottom, adjust with yOffset
            console.log(`Defaulting to bottom-center position: x=${x}, y=${y}`);
          }
        }
    
        console.log(`Attempt ${attempt}: Clicking at (x: ${x}, y: ${y})`);
        await ptcPage.mouse.click(x, y + yOffset); // Apply the offset
        yOffset -= 10; // Move up by 10 pixels after each attempt
        await delay(100);
    
        // Check if the email input field exists (indicating success)
        const emailInputExists = await ptcPage.$('#email-text-input');
        if (emailInputExists) {
          buttonClicked = true; // Mark the button as successfully clicked
    
          // Save the successful button location
          if (!successfulButtonLocation) {
            successfulButtonLocation = { x, y }; // Store the coordinates for future use
            console.log(`Button location stored: x=${x}, y=${y}`);
          }
          break; // Exit the loop if the button is successfully clicked
        }
      } catch (err) {
        console.error(`Attempt ${attempt} failed: ${err.message}`);
      }
    }
    
    if (!buttonClicked) {
      console.log('Failed to click the "I Am Sure" button after maximum attempts.');
    }

    console.log('Continuing with email input and account creation...');
    await ptcPage.type('#email-text-input', email);
    await ptcPage.type('#confirm-text-input', email);
    await delay(1000);

    console.log('Submitting email form...');
    await ptcPage.click('button.basic-button.primary[type=submit]');
    await delay(1000);
    // Additional logic for handling errors and terms acceptance...
  } catch (error) {
    console.error('An error occurred during navigation and sign-up process:', error.message);
  } finally {
    console.log('Sign-up process complete. Proceeding to the next steps...');
  }

  await delay(1000);

  // Check for the "Oops! There Was an Error" page
  const errorPageExists = await ptcPage.evaluate(() => {
    const errorHeader = document.querySelector('h1');
    return errorHeader && errorHeader.textContent.includes('Oops! There Was an Error');
  });

  if (errorPageExists) {
    console.log('ERROR: TOO MANY ATTEMPTS, CHANGING VPN LOCATION');
    await changeVPN(); // change vpn function
    await delay(20000);
    await browser.close(); // Correctly close the browser
    await createAccount(); // Restart the account creation process
  }

  let termsAccepted = false;
  let attemptCounter = 0; // Counter for attempts to click the "Accept Terms of Service" button
  
  while (!termsAccepted && attemptCounter < 10) {
    try {
      console.log(`Attempt ${attemptCounter + 1}: Accepting terms of service...`);
  
      // Check if the "Unable to Create Account" page is visible
      const unableToCreateAccount = await ptcPage.evaluate(() => {
        const header = document.querySelector('h1.header');
        return header && header.textContent.includes("We are unable to create an account for you.");
      });
  
      if (unableToCreateAccount) {
        console.log('"Unable to Create an Account" page detected. Generating a new email and retrying...');
  
        // Switch to the email generator tab
        await emailPage.bringToFront();
        const newEmail = await generateEmail(emailPage);
  
        // Switch back to the PTC tab
        await ptcPage.bringToFront();
  
        // Click the back button
        console.log('Clicking the back button...');
        await ptcPage.waitForSelector('img[alt="Back"]', { visible: true });
        await ptcPage.click('img[alt="Back"]');
        await delay(1000);
  
        // Re-enter the new email address
        console.log('Re-entering the new email address...');
        await ptcPage.waitForSelector('#email-text-input', { visible: true });
        await ptcPage.evaluate(() => {
          document.querySelector('#email-text-input').value = ''; // Clear existing email
          document.querySelector('#confirm-text-input').value = ''; // Clear existing confirmation email
        });
        await ptcPage.type('#email-text-input', newEmail);
        await ptcPage.type('#confirm-text-input', newEmail);
        await delay(1000);
  
        // Submit the new email
        console.log('Submitting the new email...');
        await ptcPage.click('button.basic-button.primary[type=submit]');
        await delay(1000);
  
        continue; // Restart the loop to recheck the page
      }
  
      // If not on the "Unable to Create Account" page, proceed with the "Terms of Service" handling
      console.log(`Attempt ${attemptCounter + 1}: Accepting terms of service...`);
  
      // Scroll down to bring the button into view
      if (attemptCounter === 0) {
        console.log('Scrolling down to bring the "Accept Terms of Service" button into view...');
        await ptcPage.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await delay(2000); // Allow time for the scroll to complete
      }
      await delay(1000);
      // Determine where to click
      const viewport = await ptcPage.viewport();
      const x = viewport.width - 450; // Slightly to the right
      let y = viewport.height - 161; // Near the bottom
      console.log('Using default starting position...');
  
      console.log(`Attempt ${attemptCounter + 1}: Clicking at (x: ${x}, y: ${y})`);
      await ptcPage.mouse.click(x, y); // Click at the calculated position
  

      // Take a screenshot with a red dot marker for troubleshooting
      const screenshotPath = `./processing/terms-attempt-${attemptCounter + 1}.png`;
      const markedScreenshotPath = `./processing/marked-terms-attempt-${attemptCounter + 1}.png`;
      await ptcPage.screenshot({ path: screenshotPath });
      console.log(`Screenshot taken: ${screenshotPath}`);
  
      // Add a red dot marker to the screenshot
      const markerSize = 10; // Size of the red dot
      await sharp(screenshotPath)
        .composite([
          {
            input: Buffer.from(
              `<svg height="${markerSize}" width="${markerSize}">
                <circle cx="${markerSize / 2}" cy="${markerSize / 2}" r="${markerSize / 2}" fill="red" />
              </svg>`
            ),
            top: Math.round(y) - markerSize / 2,
            left: Math.round(x) - markerSize / 2,
          },
        ])
        .toFile(markedScreenshotPath);
      console.log(`Screenshot with red dot marker saved: ${markedScreenshotPath}`);
  
      await ptcPage.mouse.click(x, y); // Click again for good measure
      y -= 10; // Move up by 10 pixels for the next attempt
      await delay(1000);
  
      // Verify if the page has transitioned to the next step
      const screenNameInputExists = await ptcPage.$('#screen_name-text-input');
      if (screenNameInputExists) {
        console.log('"Accept Terms of Service" button clicked successfully.');
        termsAccepted = true;
        break; // Exit the loop
      } else {
        console.log('Page has not transitioned yet. Retrying...');
      }
    } catch (err) {
      console.error(`Attempt ${attemptCounter + 1} failed: ${err.message}`);
    }
  
    attemptCounter++;
  
    if (attemptCounter >= 10) {
      console.log('Maximum attempts reached.Closing Browser');
      await ptcPage.close(); // Stop the loop after 10 attempts
    }
  }
  
  if (termsAccepted) {
    console.log('Proceeding to the next step...');
  } else {
    console.log('Failed to accept Terms of Service after maximum attempts.');
  }

  if (termsAccepted) {
    let screenNameAccepted = false;
  
    while (!screenNameAccepted) {
      console.log('Generating a screen name...');
      const screenName = getScreenName(); // Generate a random screen name
      console.log(`Generated screen name: ${screenName}`);
      await delay(1000);
  
      console.log('Entering screen name...');
  
      // Ensure the input field is cleared by pushing Delete 12 times
      await ptcPage.focus('#screen_name-text-input'); // Focus on the input field
      for (let i = 0; i < 12; i++) {
        await ptcPage.keyboard.press('Delete');
      }
  
      // Wait for the field to reflect the cleared value (optional, based on previous behavior)
      await ptcPage.waitForFunction(
        () => document.querySelector('#screen_name-text-input')?.value === '',
        { timeout: 5000 }
      );
  
      // Enter the new screen name
      await ptcPage.type('#screen_name-text-input', screenName);
  
      console.log('Submitting screen name form...');
      try {
        // Try clicking the "Submit" button for the screen name
        await ptcPage.click('button[data-testid="screen-name-page-submit-button"]');
        await delay(2000); // Allow some time for the form to process
  
        // Check if the username and password fields appear, indicating the screen name was accepted
        const usernameFieldExists = await ptcPage.$('#Username-text-input');
        const passwordFieldExists = await ptcPage.$('#password-text-input-test');
  
        if (usernameFieldExists && passwordFieldExists) {
          console.log('Screen name accepted successfully.');
          screenNameAccepted = true;
        } else {
          // Check for error messages indicating inappropriate language
          const errorExists = await ptcPage.evaluate(() => {
            const errorElement = document.querySelector('.error-message'); // Replace with the actual class or selector for error messages
            return errorElement && errorElement.textContent.includes('inappropriate language');
          });
  
          if (errorExists) {
            console.log('Screen name flagged as inappropriate. Generating a new screen name...');
          } else {
            throw new Error('Unexpected issue during screen name submission.');
          }
        }
      } catch (err) {
        console.error('Error while submitting screen name:', err.message || err);
        console.log('Retrying with a new screen name...');
      }
    }
  } else {
    console.log('Failed to accept Terms of Service after maximum attempts.');
  }
  
  console.log('Entering username and password...');
  await delay(500); 
  await ptcPage.type('#Username-text-input', username);
  await delay(500);
  await ptcPage.type('#password-text-input-test', password); // Updated selector to match the actual field
  await delay(500);    

  console.log('Submitting User name and Password form...');
  await ptcPage.click('button[data-testid="create-account-button"]'); // Updated selector
  await delay(1000);
  
// Handle the second "I Am Sure" button
console.log('Clicking "I Am Sure" button...');
let yOffset = 0; // Start offset for button clicking
for (let attempt = 1; attempt <= 30; attempt++) { // Max 30 attempts
  try {
    // Evaluate the button position
    const buttonPosition = await ptcPage.evaluate(() => {
      const button = document.querySelector('button.basic-button.primary'); // Target button
      if (button) {
        const rect = button.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return null;
    });

    if (!buttonPosition) {
      console.log('Second "I Am Sure" button not found. Retrying...');
      continue; // Retry if button is not found
    }

    const { x, y } = buttonPosition;

    console.log(`Attempt ${attempt}: Clicking at (x: ${x}, y: ${y + yOffset})`);
    await ptcPage.mouse.click(x, y + yOffset); // Apply the yOffset to click position
    yOffset -= 10; // Move up by 10 pixels for each attempt
    await delay(2000); // Wait for the page to potentially transition

    console.log('"I Am Sure" button clicked successfully. Proceeding to the next steps...');
    break; // Exit the loop after clicking the button successfully
  } catch (err) {
    console.error(`Attempt ${attempt} failed: ${err.message}`);
  }
}

await delay(2000);

const pageResult = await checkCurrentPage(ptcPage);

if (pageResult === 'codeConfirmationPage') {
    // Proceed with the next steps
    console.log("Activation Code confirmation page detected. Proceeding...");
    // Add your next steps here
} else if (pageResult === 'errorPage') {
    // Handle the error page
    console.log('ERROR: TOO MANY ATTEMPTS, CHANGING VPN LOCATION');
    await changeVPN(); // change vpn function
    await delay(20000);
    await browser.close(); // Correctly close the browser
    await createAccount(); // Restart the account creation process
} else {
    console.error("Unexpected page detected. Closing the browser.");
    await ptcPage.close();
}

// Proceed with the rest of the code

 // Step 2: Open Email Generator
try {
  // Step 2: Navigate to the Email Generator popup
  console.log('Navigating to the Email Generator popup...');
  await openEmailPage(emailPage);
  await delay(1000);

  console. log ('Refreshing emails if button present')
  await refreshEmail(emailPage, 2, 5000)
  await delay(1000);

 
  let activationCode = null;
  let maxRetries = 4; // You can adjust the number of retries if needed
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await delay(15000); // Wait for 15 seconds before retrying

      console.log(`Attempt ${attempt}: Processing screenshot and extracting activation code...`);
  
      // Step 4: Take a screenshot of the email page
      const screenshotPath = './processing/email_page_screenshot.png'; // Screenshot file path
      await captureEmailPageScreenshot(emailPage);
      await delay(1000); // Allow time for the submission to process
  
      // Step 5: Extract Activation Code
      activationCode = await extractActivationCode(screenshotPath);
  
      if (!activationCode) {
        throw new Error('No activation code extracted.');
      }
  
      // If the activation code was successfully extracted, break out of the retry loop
      break;
  
    } catch (err) {
      console.error(`Attempt ${attempt} failed: ${err.message || err}`);
      if (attempt < maxRetries) {
        console.log('Waiting for 15 seconds before retrying Steps 4 and 5...');
      } else {
        console.error('Maximum retries reached. Aborting the process.');
        throw new Error('Failed to process the email page and extract activation code after maximum attempts.');
      }
    }
  }
  
  // Continue with the process after successfully extracting the activation code
  console.log('Activation code extracted:', activationCode);
  

  // Step 6: Switch Back to PTC Page
  console.log('Switching back to the PTC page to enter the activation code...');
  await ptcPage.bringToFront();

  // Step 7: Enter and Submit the Activation Code
  console.log('Entering the activation code...');
  await ptcPage.type('#code-text-input', activationCode);

  // Handle the second "I Am Sure" button
  console.log('Clicking "Submit" button...');
  let yOffset = 0; // Start offset for button clicking
  for (let attempt = 1; attempt <= 30; attempt++) { // Max 30 attempts
    try {
      // Evaluate the button position
      const buttonPosition = await ptcPage.evaluate(() => {
        const button = document.querySelector('button.basic-button.primary'); // Target button
        if (button) {
          const rect = button.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        return null;
      });

      if (!buttonPosition) {
        console.log('"Submit" button not found. Retrying...');
        continue; // Retry if button is not found
      }

      const { x, y } = buttonPosition;

      console.log(`Attempt ${attempt}: Clicking at (x: ${x}, y: ${y + yOffset})`);
      await ptcPage.mouse.click(x, y + yOffset); // Apply the yOffset to click position
      yOffset -= 10; // Move up by 10 pixels for each attempt
      await delay(2000); // Wait for the page to potentially transition

      console.log('"SUBMIT" button clicked successfully. Proceeding to the next steps...');
      break; // Exit the loop after clicking the button successfully
    } catch (err) {
      console.error(`Attempt ${attempt} failed: ${err.message}`);
    }
  }
  let successfulValidation = false; // Flag to track if final page validation was successful

for (let attempt = 1; attempt <= 30; attempt++) { // Max 30 attempts
  try {
    // Step 8: Validate Final Page
    console.log('Validating final success page...');
    
    // Call the function to wait for the success message
    await waitForSuccessMessage(ptcPage);
    
    console.log('Account activation completed successfully!');
    
    successfulValidation = true; // Mark as successful if validation completes without errors
    break; // Exit the loop early if successful

  } catch (err) {
    console.error('Error during activation process:', err.message || err);
    if (attempt === 30) {
      throw err; // If it's the last attempt, propagate the error
    }
  }
}

if (!successfulValidation) {
  console.error('Final success page validation failed after maximum attempts.');
  throw new Error('Final success page validation failed.');
}

// Only return config if validation was successful
return config;
}
finally {
  await browser.close();
}
}