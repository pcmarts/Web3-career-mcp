# Web3 Career MCP Server

This is a Model Context Protocol (MCP) server that wraps the [Web3.career API](https://web3.career/api). It allows AI agents to search for the latest Web3 jobs with various filters.

## Features

- **Query Jobs**: Fetch the latest job listings.
- **Filters**:
    - Remote only
    - Limit number of results
    - Filter by country (e.g., 'united-states')
    - Filter by tag/skill (e.g., 'react', 'rust', 'marketing')
    - Toggle job descriptions

## Usage Tips & Limitations

- **Tags**: The `tag` filter expects a **single keyword** or slug.
  - ✅ Good: "marketing", "react", "solidity", "design"
  - ❌ Bad: "marketing jobs", "senior react developer", "web3 marketing"
  - If you want to search for "marketing jobs", just use `tag: "marketing"`.

- **Country**: Use country slugs (lowercase, hyphenated).
  - ✅ Good: "united-states", "united-kingdom", "germany"
  - ❌ Bad: "USA", "United Kingdom"

## Available Tags

Here is a list of common tags you can use to filter jobs. Remember to use the exact slug/keyword.

### Roles & Levels
`analyst`, `community manager`, `cto`, `customer support`, `data science`, `design`, `developer relations`, `devops`, `economy designer`, `entry level`, `executive`, `finance`, `founder`, `hr`, `intern`, `legal`, `marketing`, `moderator`, `operations`, `product manager`, `project manager`, `research`, `sales`

### Engineering & Tech
`backend`, `cryptography`, `front end`, `full stack`, `gaming`, `mobile`, `smart contract`, `security`

### Languages & Frameworks
`golang`, `java`, `javascript`, `node`, `python`, `react`, `ruby`, `rust`, `solidity`, `typescript`, `web3js`, `web3 py`

### Blockchain & Ecosystems
`bitcoin`, `blockchain`, `cosmos`, `ethereum`, `evm`, `layer 2`, `polkadot`, `polygon`, `solana`, `tezos`

### Web3 Specific
`ai`, `crypto`, `dao`, `defi`, `discord`, `erc`, `erc 20`, `ganache`, `hardhat`, `metaverse`, `nft`, `non tech`, `open source`, `openzeppelin`, `pay in crypto`, `refi`, `truffle`, `zero knowledge`

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository (if applicable) or download the source.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

### Claude Desktop / Cursor

Add the following configuration to your MCP settings file (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS).

```json
{
  "mcpServers": {
    "web3-career": {
      "command": "node",
      "args": ["/path/to/web3-career-mcp/dist/index.js"],
      "env": {
        "WEB3_CAREER_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

**Note**: The `WEB3_CAREER_TOKEN` environment variable is **required**. You can obtain an API token from [web3.career](https://web3.career/web3-jobs-api). Do not commit your token to version control.

## Usage

The server exposes a single tool: `get_web3_jobs`.

### Tool Arguments

- `remote` (boolean): Show only remote jobs.
- `limit` (number): Number of jobs to return (default 50, max 100).
- `country` (string): Filter by country slug (e.g., `united-states`, `france`).
- `tag` (string): Filter by tag (e.g., `react`, `solidity`).
- `show_description` (boolean): Include job description in the response (default true).

## Development

To build the project in watch mode:

```bash
npx tsc --watch
```
