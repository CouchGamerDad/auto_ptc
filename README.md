AUTO PTC account creator A simple tool to create Pokémon Trainer Club (PTC) accounts in batches.

This program allows the user to generate PTC accounts, with the current setup achieving around five accounts per hour.

Note: I haven't yet implemented a proxy or VPN system—that's on my to-do list.

YOU NEED PYTHON INSTALLED https://www.python.org/downloads/

YOU NEED CHROME INSTALLED 

and the extension For generating emails, I use the Email Generator Chrome extension. You can find it here. (https://chromewebstore.google.com/detail/email-generator/nopbpkakbijkbhfcofpmfkdkdgbcjpec?hl=en&pli=1)

Features Batch creation of accounts. Streamlined email verification process. Installation To set it up:

Clone the repository, directly to C:\

bash

cd C:\auto_ptc

Run the following command to install dependencies:

cd C:\auto_ptc\auto_ptc

npm install

pip install -r requirements.txt

Copy the .env_example file and rename it to .env.
Replace all <Placeholders> with the appropriate values for your machine.
Save the file and ensure it’s in the root directory of your project.

Usage

configure the bat file to the correct install directory if you changed it from C:\auto_ptc

Copy Auto PTC Creator shortcut to desktop, If Icon not set open properties on shortcut, set icon (icon in autoptc\auto_ptc\icons)

Run Shortcut

or To start generating accounts, run:

npm start

#On first run, click to a new tab and install the email generator extension, close and re run


#################################

if you get errors you probably need to follow these steps
---

### **1. Install Visual Studio Build Tools**

`node-gyp` cannot find the necessary C++ compiler tools. Install **Visual Studio Build Tools** with the required workloads:

1. Download the installer for Visual Studio Build Tools:  
   [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

2. During installation:
   - Select **"Desktop development with C++"** workload.
   - Make sure to include the **Windows 10 SDK**.

3. Restart your machine after installation.

---

### **2. Downgrade Node.js to a Compatible Version**

`robotjs` has known issues with Node.js versions **above 18**. Use **nvm** (Node Version Manager) to switch to a compatible version:

1. **Install nvm (if not already installed):**  
   [Download nvm for Windows](https://github.com/coreybutler/nvm-windows/releases)

2. **Install Node.js 18**:
   ```powershell
   nvm install 18
   nvm use 18
   ```

3. Verify the version:
   ```powershell
   node --version
   ```

---

### **3. Clean Up and Reinstall Dependencies**

After setting up the build tools and a compatible Node.js version:

1. **Delete `node_modules` and `package-lock.json`:**
   ```powershell
   rm -r -fo node_modules
   rm package-lock.json
   ```

2. **Clean npm Cache**:
   ```powershell
   npm cache clean --force
   ```

3. **Reinstall All Dependencies**:
   ```powershell
   npm install
   ```

---

### **4. Rebuild `robotjs`**
After reinstalling, force a rebuild for `robotjs`:

```powershell
npm rebuild robotjs --build-from-source
```

---

### **5. Verify and Run Your Project**
Once everything is installed, test your project:

```powershell
npm start
```

---

### **Summary of Fixes**
- Install Visual Studio Build Tools with **"Desktop development with C++"**.
- Downgrade Node.js to version **18**.
- Clean `node_modules` and reinstall dependencies.
- Rebuild `robotjs` from source.


Progress What's Working: Account creation: up to 5 accounts per hour with the current configuration. To-Do List: Add proxy/VPN integration. Improve account generation speed. Contributions While this is primarily a personal project, feel free to reach out or suggest improvements if you’re interested. I’m always open to ideas!

Update email generator stopped working today, seems strange, May need to find new  email generator