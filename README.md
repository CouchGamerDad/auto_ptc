AUTO PTC account creator
A simple tool to create Pokémon Trainer Club (PTC) accounts in batches.

About
This program allows me to generate PTC accounts, with the current setup achieving around five accounts per hour.

Note: I haven't yet implemented a proxy or VPN system—that's on my to-do list.

YOU NEED CHROME INSTALLED and the below extension For generating emails, I use the Email Generator Chrome extension. You can find it here. (https://chromewebstore.google.com/detail/email-generator/nopbpkakbijkbhfcofpmfkdkdgbcjpec?hl=en&pli=1)

Features
Batch creation of accounts.
Streamlined email verification process.
Installation
To set it up:

Clone the repository.

Run the following command to install dependencies:

npm install

pip install -r requirements.txt

#copy.env_example, rename it to .env
#open .env set your path to chrome
#set what you want your usernames to start with, can put multiple
#set password


## Usage

To start generating accounts, run:

npm start

#On first run, click to a new tab and install the email generator extension, close and re run

Progress
What's Working:
Account creation: up to 5 accounts per hour with the current configuration.
To-Do List:
Add proxy/VPN integration.
Improve account generation speed.
Contributions
While this is primarily a personal project, feel free to reach out or suggest improvements if you’re interested. I’m always open to ideas!
