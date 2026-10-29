<<<<<<< HEAD
# PulseBoard — Mini Social Media App

## Technologies
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express.js
- Data storage: local JSON file (`pulseboard-data.json`) — avoids native database compilation
- Authentication: Express sessions + bcrypt password hashing

## Features
- Register, log in and log out
- User profiles with editable bio and avatar
- Create posts with mood tags
- Comment on posts
- Like/unlike posts
- Follow/unfollow users
- Responsive desktop/mobile interface

## Run on Windows
1. Install Node.js LTS from https://nodejs.org/ if needed.
2. Open PowerShell in the folder containing `package.json`.
3. If you previously tried installing dependencies, you can remove the incomplete install first:
   ```powershell
   Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
   Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
   ```
4. Install:
   ```powershell
   npm install
   ```
5. Start:
   ```powershell
   npm start
   ```
6. Open http://localhost:3000

The `pulseboard-data.json` file is created automatically.

## Note
This is a learning/demo app. JSON-file storage is suitable for a small local demo, not concurrent high-traffic production. Before public deployment, set a strong SESSION_SECRET, use HTTPS and secure cookies, add rate limiting and CSRF protections, and use a persistent production session store.
=======
# PulseBoard
PulseBoard is a mini social media web app built with HTML, CSS, JavaScript, Node.js, Express.js, and JSON-file storage. It features user authentication, profiles, posts, likes, comments, and a follow system.
>>>>>>> 43eaecb1fee0b75ae62dfb7bc4b14579f1d82872
