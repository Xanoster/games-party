# 🎉 Party Games Hub

**One link. Multiple games. Pure chaos.**

A real-time multiplayer party games app — no downloads, no logins. Just share a room code and play!

🔗 **Live Demo**: [party-night.onrender.com](https://party-night.onrender.com/)

---

## 🎮 Games Included

| Game | Description |
|------|-------------|
| 🎯 **Truth or Dare** | Spin the bottle, answer honestly or face a dare! Includes expose votes, timer, and punishments. |
| 🙈 **Never Have I Ever** | Secret taps, reveal together with counters. Quick and tension-filled! |
| 👆 **Who's Most Likely** | Silent votes with bar tally. Call-outs and chaos. |
| 🕵️ **Impostor / Spy** | Hidden spy with location word. Vote them out! |

---

## ✨ Features

- 📱 **PWA** — Install on any device, works offline-ready
- 🔗 **QR Code Sharing** — Scan to join instantly
- 🎨 **Multiple Themes** — Classic, Party, After Dark
- ⚡ **Real-time Sync** — WebSocket-powered multiplayer
- 🏠 **Host Controls** — Manage players, pick games, change settings
- 📊 **Live Voting** — See results in real-time
- 🎲 **Bottle Spin** — Animated spinner for Truth or Dare

---

## 🚀 Quick Start

### Play Online
Just visit [party-night.onrender.com](https://party-night.onrender.com/) and host a room!

### Run Locally

```bash
# Clone the repo
git clone https://github.com/Xanoster/games-party.git
cd games-party

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000` in your browser.

### AI prompts (optional)

- Set `GEMINI_API_KEY` in your env before running the server to enable dynamic questions.
- Optionally set `GEMINI_MODEL` (default: `gemini-1.5-flash`).
- Without a key, the app falls back to the built-in prompt lists.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JS, CSS3 (no frameworks!)
- **Backend**: Node.js, Express
- **Real-time**: WebSockets (ws)
- **PWA**: Service Worker, Web App Manifest

---

## 📁 Project Structure

```
├── server.js          # Express + WebSocket server
├── package.json
└── public/
    ├── index.html     # Main HTML
    ├── app.js         # Game logic & UI
    ├── styles.css     # All styles
    ├── sw.js          # Service worker
    └── manifest.json  # PWA manifest
```

---

## 🌐 Deployment

Deployed on [Render](https://render.com) (free tier).

To deploy your own:
1. Fork this repo
2. Connect to Render as a **Web Service**
3. Set Build Command: `npm install`
4. Set Start Command: `npm start`
5. Deploy!

---

## 📝 License

MIT — do whatever you want with it!

---

Made with 🎲 for fun nights with friends.
