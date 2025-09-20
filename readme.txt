Quick iPad Setup (No App Store)

1) Start the app on your laptop
Use a local server (example):
Install Node.js (if not already installed).
Option A (Node):
- In the project folder, run:
    npx serve . -l 3000
    npx serve . -l tcp://0.0.0.0:3000
Option B (Python):
- In the project folder, run:
    python -m http.server 3000

2) Open it on iPad
Make sure iPad + laptop are on the same Wi‑Fi.
In Safari on iPad, go to:
http://<your-laptop-ip>:3000
Example: http://192.168.1.12:3000

3) Add to Home Screen
Safari → Share → Add to Home Screen
Now it launches like an app.

4) Offline use
After the first open, it works offline.
If you update files later, refresh once.

Notes
- If the page does not load, check your laptop firewall and allow the server.
- Find your laptop IP by running: ipconfig (Windows) and use the IPv4 address.
- If the keyboard stops opening on iPad, use the new "Reset UI" button, then try again.
- Use Export/Import to back up and restore data anytime.

Reference: 
  You only need internet once to load the app and add it to the Home Screen. After that it runs offline with your data saved locally. If you ever lose the app or cache, you can reconnect briefly on any Wi‑Fi, open the app URL once, then go offline again. If you’re worried, use Export to save a backup file so you can restore anytime.