# Nexus L1 Blockchain

Nexus is a lightweight, secure, and ultra-fast Layer-1 blockchain built for seamless peer-to-peer cryptocurrency transfers. It features a modern, minimalist web interface for wallet management, real-time block explorer, and treasury pool.

## Features

- **Modern Wallet Interface:** Beautiful, glassmorphism-inspired UI with dark mode support (Zinc/Emerald theme).
- **Secure by Default:** Utilizes AES-256-GCM encryption for keystore generation and ECDSA (secp256k1) for digital signatures.
- **On-Chain Contacts:** Store your friends' addresses directly on the blockchain with human-readable aliases (e.g., `@satoshi`).
- **Real-Time Block Explorer:** Monitor new blocks, network difficulty, and transaction pool in real time.
- **Zero-Setup Node Running:** Start participating in the network and mining blocks directly from your browser.
- **Mobile Optimized:** Full support for mobile devices including an integrated HTML5 QR Code scanner for quick payments.

## Tech Stack

- **Frontend:** React, TypeScript, TailwindCSS, Vite
- **Backend:** Express.js, TypeScript, Node.js (via Bun/tsx)
- **Cryptography:** js-sha256, elliptic (secp256k1)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) or [Bun](https://bun.sh/) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/LodosLawson/nexuschain.git
   cd nexuschain
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the node and development server:
   ```bash
   bun run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

## Security

- Private keys never leave your browser unless you explicitly download your encrypted keystore file.
- All transactions are signed locally before being broadcasted to the mempool.
- Replay protection and strict nonce validation are enforced on the backend node.

## License

MIT License
