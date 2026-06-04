# 🌐 DocuChain AI

DocuChain AI is a next-generation decentralized document repository and verification platform. It operates on a local Hardhat Ethereum node, leveraging IPFS for decentralized storage and public/private key encryption layers, and integrates a highly optimized, client-side AI chat companion powered by Google Gemini.

---

## 🚀 Key Features

* **Decentralized Storage & On-Chain Verification**: Documents are uploaded and pinned securely via the **Pinata IPFS Gateway**. The resulting immutable IPFS content hash (CID) is anchored onto the Ethereum blockchain through a Solidity smart contract deployed locally.
* **Granular Encryption Tiers**: Supports three distinct security categories for document uploads:
  * **Public (`[U]-`)**: Accessible to anyone via the IPFS Gateway.
  * **Wallet-Secured (`[W]-`)**: Encrypted using a key derived from a MetaMask signature. Only the uploader can decrypt the file.
  * **Password-Secured (`[P]-`)**: Encrypted using an AES-256 key derived in-memory from a custom user password.
* **True AI Chat Memory**: Implements native multi-turn conversation memory using Gemini's `model.startChat({ history })` session lifecycle. It reconstructs past chats from local storage so the assistant retains full context across the entire thread.
* **Auto-Summary & Smart Pills**: Upon opening a new chat window, the AI automatically generates a 3-bullet point summary of the document context and suggests 3 interactive questions, rendered as responsive Tailwind pills.
* **Intelligent Dual-Model Router**: 
  * **Credit Saver**: Automatically routes low-complexity queries (e.g., greetings like "hi", "ok", "thanks") to the cost-efficient `gemini-1.5-flash` model.
  * **Dynamic Fallback (429 Handling)**: Document-related queries default to the premium `gemini-2.5-flash`. If a rate limit or quota exceeded error occurs, it is caught instantly. The engine transparently shifts to `gemini-1.5-flash`, rebuilds the session history, and retries the prompt without causing client-side crashes.

---

## 🛠️ Tech Stack

* **Frontend**: React, Vite, Tailwind CSS, Dexie.js (IndexedDB wrapper)
* **Blockchain**: Hardhat, Ethers.js (v6), MetaMask wallet extension
* **Storage**: Pinata IPFS API
* **AI Engine**: Google Gemini API (`@google/generative-ai`)

---

## 📦 Installation & Setup

### 1. Install Dependencies
Clone the repository and install the packages in both the project root (smart contract / server environment) and the frontend directory:
```bash
# In the root folder
npm install

# Navigate to the frontend folder and install
cd frontend
npm install
cd ..
```

---

### 2. Configure Environment Variables
Create the environment files. 

> [!WARNING]
> **Environment Variables Safety**: Never commit API keys or private keys to source control. These files are securely ignored in [.gitignore](file:///c:/Users/spe95/Desktop/juncr/final%20project/DocuChain/.gitignore).

#### Server Environment (`/server/.env`)
Create a `.env` file inside the `server/` directory:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```

#### Frontend Environment (`/frontend/.env`)
Create a `.env` file inside the `frontend/` directory:
```env
VITE_PINATA_API_KEY=your_pinata_api_key_here
VITE_PINATA_SECRET_API_KEY=your_pinata_secret_key_here
VITE_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_BACKEND_URL=http://localhost:5000
```

---

### 3. Start Local Blockchain & Deploy Contracts
Spin up the local Ethereum network node and deploy the Solidity registry contracts:
```bash
# Terminal 1: Spin up local Hardhat node
npx hardhat node

# Terminal 2: Compile and Deploy contracts to the local network
npx hardhat run scripts/deploy.js --network localhost
```
*Note: Make sure to copy the newly deployed contract address from the terminal output and update `VITE_CONTRACT_ADDRESS` inside `/frontend/.env` if it changes.*

---

### 4. Configure MetaMask for Hardhat Localhost
To interact with the smart contract, configure a custom network in your MetaMask browser extension:
* **Network Name**: Hardhat Localhost
* **New RPC URL**: `http://127.0.0.1:8545/`
* **Chain ID**: `31337` (or `1337` depending on your node config)
* **Currency Symbol**: `ETH`

Import one of the default accounts printed in the `npx hardhat node` terminal output using its **Private Key** to start with a test balance of 10,000 developer ETH.

---

### 5. Launch the Application
Run the proxy backend server and Vite frontend server simultaneously:
```bash
# Terminal 1: Launch backend proxy server (starts on port 5000)
cd server
npm start

# Terminal 2: Launch Vite dev server
cd frontend
npm run dev
```
Open `http://localhost:5173` (or the URL printed in the terminal) in your browser.

---

## 🏗️ Production Build

To compile the frontend for production deployment:
```bash
cd frontend
npm run build
```
The optimized build output will be stored in the `/frontend/dist/` directory.
