# Contributing to Territory NFT

First off, thank you for considering contributing to Territory NFT Marketplace! This document provides guidelines for contributing to our Web3 application, backend API, frontend web app, and smart contracts.

## 🛠️ Development Workflow

We use a Turborepo monorepo setup powered by Bun. Familiarize yourself with our stack before diving in:
- **Backend API (`apps/api`)**: Elysia, Bun, Postgres, Redis, Viem
- **Frontend (`apps/web`)**: Next.js 14, Tailwind CSS, Wagmi, RainbowKit
- **Smart Contracts (`packages/contracts`)**: Solidity ^0.8.24, Foundry

### 1. Initial Setup
```bash
# Clone the repo, install dependencies, and start background Docker services
git clone <repository-url>
cd fitquest-a
bun run setup
```

### 2. Making Changes
- **Branching**: Create a new branch for your feature or bugfix (e.g., `feature/auction-timer` or `fix/api-caching`).
- **Committing**: Write clear, descriptive commit messages.
- **Testing Requirements**:
  - For smart contracts, ensure all Foundry tests pass (`forge test`). Add new fuzz or unit tests for any new solidity functionality.
  - For typescript packages, run `bun run type-check` before submitting.
- **Formatting**: Please make sure your code follows the shared formatting configuration.

### 3. Submitting a Pull Request
- Push your changes to your fork or branch.
- Open a Pull Request clearly describing the problem being solved and the approach taken.
- Ensure all CI/CD pipelines pass successfully.
- Request a review from the core maintainers.

## 🐛 Bug Reports & Feature Requests

If you find a bug or have an idea for a new feature, please open an Issue containing:
- A clear description of the bug or feature.
- Steps to reproduce (if it's a bug).
- Useful context like console logs, transaction hashes, or environment details.

## 🤝 Code of Conduct

Always be respectful and considerate to all members of our community. Harassment or abusive behavior will not be tolerated. Keep discussions focused on constructive technical feedback and collaboration.
