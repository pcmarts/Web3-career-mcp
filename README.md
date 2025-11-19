# Web3 Career MCP Server

This is a Model Context Protocol (MCP) server that wraps the [Web3.career API](https://web3.career/api). It allows AI agents to search for the latest Web3 jobs with various filters.

## Features

- **Query Jobs**: Fetch the latest job listings.
- **Filters**:
    - Remote only
    - Limit number of results
    - Filter by country (e.g., 'united-states')
    - Filter by tag/skill (e.g., 'react', 'rust')
    - Toggle job descriptions

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
        "WEB3_CAREER_TOKEN": "99utwADPU3UL4NWtSDk2LPBHnQ7BaAeW"
      }
    }
  }
}
```

**Note**: The server includes a default token, so setting `WEB3_CAREER_TOKEN` is optional but recommended if you have your own.

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

