# Open-Terminal (V1.0.0)

> A professional, open-source Bloomberg-style trading terminal for Everyone.
> Compatible with Openalgo API, Make Your Openalgo More Advance.

##  Terminal Interface Screenshots

<img width="1080" height="720" alt="Screenshot 2026-03-27 105252" src="https://github.com/user-attachments/assets/42e378a0-337c-4750-a7f5-b806e30dec0d" />
&nbsp;&nbsp;
<img width="1080" height="720" alt="Screenshot (33)" src="https://github.com/user-attachments/assets/45a493ce-9ac3-4b71-8c6a-57ae4e9790f0" />
&nbsp;&nbsp;
<img width="1080" height="720" alt="Screenshot (34)" src="https://github.com/user-attachments/assets/e8e437be-aeca-4a6a-805c-bd17046259ff" />
&nbsp;&nbsp;
<img width="1080" height="720" alt="Screenshot (35)" src="https://github.com/user-attachments/assets/bce2d1bf-cdd4-4af8-912f-4e4e8cf5ef71" />
&nbsp;&nbsp;

## ✨ Features

### 📊 Market Data

- **Real-time Streaming** — WebSocket-powered live price updates
- **Interactive Charts** — Candlestick charts with multiple timeframes (1m to Weekly)
- **Custom Watchlists** — Multiple named watchlists with add/remove/import/export
- **Market Depth** — Level 2 bid/ask visualization with volume bars
- **Market Overview** — Index tracking, VIX fear gauge, market breadth

### ⚡ Trading

- **One-Click Trading** — Quick buy/sell buttons on watchlist rows
- **Full Order Ticket** — MARKET, LIMIT, SL, SL-M order types
- **Bracket Orders** — Entry + Stop Loss + Target (3-leg orders)
- **Cover Orders** — Entry + Stop Loss (2-leg orders)
- **Order Management** — View, filter, cancel orders with one click
- **Position Tracking** — Live P&L with one-click exit

### 📈 Options

- **Option Chain** — Full CE/PE matrix with ATM highlighting
- **Option Greeks** — Delta, Gamma, Theta, Vega, Rho with IV
- **Strategy Builder** — Visual strategy builder (Bull Call, Iron Condor, etc.)
- **Multi-leg Execution** — Execute all spread legs with margin check
- **PCR Monitoring** — Put-Call Ratio tracking

### 🖥️ Terminal

- **Command Bar** — Bloomberg-style command interface (20+ commands)
- **Autocomplete** — Type-ahead suggestions with Tab completion
- **Keyboard Shortcuts** — Full keyboard-driven workflow
- **Price Alerts** — Configurable alerts with sound notifications
- **P&L Analytics** — Performance dashboard with charts
- **Strategy Monitor** — Track and manage multiple strategies
- **Emergency Controls** — One-click cancel all / close all

### 🎨 Interface

- **Draggable Panels** — Customize your workspace layout
- **Resizable Panels** — Adjust panel sizes to your needs
- **Dark Theme** — Professional Bloomberg-inspired dark UI
- **Persistent Layout** — Your workspace saves automatically
- **Export/Import** — CSV/JSON data export for all panels

## 🚀 Quick Start

### Prerequisites

- [OpenAlgo](https://github.com/marketcalls/openalgo) running on your machine
- Python 3.10+ (for backend)
- Node.js 18+ (for frontend)

### Installation

```bash
# Clone
git clone https://github.com/your-username/open-terminal.git
cd open-terminal

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your OpenAlgo API key
python run.py

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

### Docker (Alternative)

```bash
cp .env.example .env
# Edit .env with your API key
docker-compose up -d
```

### Open Terminal

Navigate to **http://localhost:3000**

## ⌨️ Keyboard Shortcuts

| Key     | Action                         |
| ------- | ------------------------------ |
| `/`     | Focus command bar              |
| `Tab`   | Accept autocomplete suggestion |
| `↑` `↓` | Navigate command history       |
| `Alt+W` | Toggle Watchlist               |
| `Alt+C` | Toggle Chart                   |
| `Alt+O` | Toggle Orders                  |
| `Alt+P` | Toggle Positions               |
| `Alt+T` | Toggle Trades                  |
| `Alt+S` | Open Settings                  |
| `F2`    | Toggle Option Chain            |
| `F5`    | Refresh all data               |
| `Esc`   | Close/blur                     |

## 📝 Command Reference

### Trading

| Command                     | Description                 |
| --------------------------- | --------------------------- |
| `/buy SYMBOL QTY [PRICE]`   | Buy order (MARKET or LIMIT) |
| `/sell SYMBOL QTY [PRICE]`  | Sell order                  |
| `/cancel ORDERID`           | Cancel specific order       |
| `/cancel all`               | Cancel all open orders      |
| `/exit SYMBOL`              | Exit position at market     |
| `/exit all`                 | ⚠️ Close ALL positions      |
| `/modify ORDERID QTY PRICE` | Modify pending order        |

### Market Data

| Command                | Description           |
| ---------------------- | --------------------- |
| `/quote SYMBOL` (`/q`) | Get current quote     |
| `/depth SYMBOL`        | Market depth          |
| `/watch SYMBOL` (`/w`) | Add to watchlist      |
| `/unwatch SYMBOL`      | Remove from watchlist |

### Portfolio

| Command               | Description            |
| --------------------- | ---------------------- |
| `/positions` (`/pos`) | Show open positions    |
| `/orders`             | Show today's orders    |
| `/trades`             | Show executed trades   |
| `/funds`              | Account funds & margin |
| `/holdings`           | Portfolio holdings     |

### Options

| Command             | Description            |
| ------------------- | ---------------------- |
| `/chain UNDERLYING` | Open option chain      |
| `/greeks SYMBOL`    | Option Greeks & IV     |
| `/expiry SYMBOL`    | Available expiry dates |

### System

| Command              | Description      |
| -------------------- | ---------------- | ------------------- | ----------- |
| `/alert SYMBOL above | below PRICE`     | Set price alert     |
| `/export orders      | trades           | positions`          | Export data |
| `/mode [live         | paper]`          | Switch trading mode |
| `/ping`              | Check connection |
| `/help [command]`    | Show help        |
| `/clear`             | Clear output     |

## 🏗️ Architecture

```
┌─────────────────────┐
│  Browser (:3000)     │
│  Next.js + React     │
│  └─ Zustand Store    │
│  └─ React Query      │
│  └─ WebSocket Client │
└────────┬────────────┘
         │ HTTP + WebSocket
┌────────▼────────────┐
│  Backend (:8000)     │
│  FastAPI + Python    │
│  └─ OpenAlgo Client  │
│  └─ WS Bridge        │
│  └─ Command Parser   │
└────────┬────────────┘
         │ HTTP + WebSocket
┌────────▼────────────┐
│  OpenAlgo (:5000)    │
│  + WebSocket (:8765) │
│  └─ Broker API       │
│     (Upstox, Zerodha,│
│      Fyers, etc.)    │
└─────────────────────┘
```

## 🔧 Configuration

### Backend (.env)

```env
OPENALGO_API_KEY=your_api_key
OPENALGO_HOST=http://127.0.0.1:5000
OPENALGO_WS_URL=ws://127.0.0.1:8765
TERMINAL_PORT=8000
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws/market
```

## 📊 Panels

| Panel           | Description          | Default |
| --------------- | -------------------- | ------- |
| Watchlist       | Live price tracking  | Visible |
| Chart           | Candlestick charts   | Visible |
| Order Ticket    | Place orders         | Visible |
| Order Book      | View/cancel orders   | Visible |
| Positions       | Track open positions | Visible |
| Trade Book      | Executed trades      | Visible |
| Funds           | Account margin       | Visible |
| Market Depth    | Level 2 data         | Hidden  |
| Option Chain    | CE/PE matrix         | Hidden  |
| Greeks          | Option Greeks        | Hidden  |
| Holdings        | CNC portfolio        | Hidden  |
| Analytics       | P&L dashboard        | Hidden  |
| Market Overview | Index tracking       | Hidden  |
| Spread Builder  | Options strategies   | Hidden  |
| Alerts          | Price alerts         | Hidden  |
| Strategies      | Strategy monitor     | Hidden  |

## 📄 License

MIT License — Open Source for everyone.

## 🤝 Contributing

Contributions welcome! Please open an issue first to discuss changes.

## ⚠️ Disclaimer

This software is for educational purposes. Use at your own risk.
Always verify orders before placing. The developers are not
responsible for any trading losses.
