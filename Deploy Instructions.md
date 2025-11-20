# Product Requirements Document: Hosted Web3 Career MCP Gateway

## 1. Executive Summary
**Objective:** Transition the current local CLI-based MCP server into a hosted, multi-tenant gateway.
**Goal:** Allow users to connect their AI agents (Claude, Cursor, etc.) directly to Web3 Career data using their existing API keys, without installing local software.
**Key Strategy:** Leverage the existing API key infrastructure at `https://web3.career/web3-jobs-api` for authentication, avoiding the need for a new user management system.

## 2. User Experience
The user experience should be "zero-setup."

1.  **User Action:** User visits `https://web3.career/web3-jobs-api` and generates/views their API Key.
2.  **Configuration:** The user copies a standard configuration block into their AI tool settings.
3.  **Usage:** The AI tool connects to our hosted URL, authenticating with the user's specific key.

### Client Configuration Snippet
Users will be provided with the following JSON to paste into their MCP client config (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "web3-career": {
      "url": "https://mcp.web3.career/sse",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## 3. Infrastructure Requirements
The architecture will be stateless and lightweight, acting as a proxy between the AI client and the backend API.

| Component | Recommendation | Description |
| :--- | :--- | :--- |
| **Compute** | AWS Fargate / DigitalOcean App Platform / Render | Hosting for the Node.js MCP Server. Must support long-lived HTTP connections for SSE (Server-Sent Events). |
| **Load Balancer** | AWS ALB / Cloudflare | Manages HTTPS termination and traffic routing. |
| **Database** | **None Required** | The service is stateless; it verifies keys by passing them to the upstream `web3.career` API. |

## 4. Technical Implementation
### A. Backend Refactoring
The current `StdioServerTransport` (CLI mode) must be replaced or augmented with an HTTP server.

1.  **HTTP & SSE Support:**
    *   Wrap the MCP server with **Express** or **Fastify**.
    *   Implement an `/sse` endpoint for initializing connections.
    *   Implement a `/messages` endpoint for JSON-RPC message handling.

2.  **Pass-Through Authentication:**
    *   **Current Logic:** Uses a single server-side `WEB3_CAREER_TOKEN`.
    *   **New Logic:**
        *   Extract `Authorization: Bearer <token>` from the incoming HTTP request headers.
        *   Instantiate the `Web3CareerService` *per request* (or per session) using the user-provided token.
        *   Ensure downstream API calls use this specific token for rate limiting and permissions.

### B. Deployment Strategy
1.  **Dockerization:** Finalize `Dockerfile` to run the HTTP server process.
2.  **Environment:** Deploy to `mcp.web3.career` (or similar subdomain).
3.  **Documentation:** Update the API page to include the "Connect to AI" section with the configuration snippet.

## 5. Benefits & Success Metrics
*   **Zero Friction:** Users do not need to run `npm install` or manage a local Node.js process.
*   **Security:** User keys are never stored; they are transiently passed to the backend.
*   **Scalability:** Stateless design allows for easy horizontal scaling if traffic spikes.

