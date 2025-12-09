# Miro MCP Server - Technical Guide

> **Source:** [Miro Board](https://miro.com/app/board/uXjVJ-Gowqk=/)  
> **Last Updated:** November 25, 2025

## System Architecture

### Overview
- **Architecture Style:** Remote MCP (Model Context Protocol) server hosted by Miro
- **Authentication:** OAuth 2.1 with dynamic client registration
- **Transport:** HTTP with Server-Sent Events (SSE), JSON-RPC 2.0 over stdio
- **Hosted Endpoint:** https://mcp.miro.com/

### Key Components

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌──────────┐
│  AI Client  │──────▶│  MCP Server  │──────▶│ OAuth 2.1 Layer │──────▶│ Miro API │
│ (Cursor,    │      │  (JSON-RPC)  │      │   Validation    │      │          │
│  VSCode,    │◀─────│              │◀─────│                 │◀─────│          │
│  etc.)      │      └──────────────┘      └─────────────────┘      └──────────┘
└─────────────┘               │                                            │
                               │                                            │
                               ▼                                            ▼
                      ┌──────────────────┐                       ┌──────────────┐
                      │ Board Context    │                       │ Board Data & │
                      │ Extraction Engine│                       │ Diagrams     │
                      └──────────────────┘                       └──────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │ AI-Powered       │
                      │ Diagram Generator│
                      └──────────────────┘
```

---

## Services & Modules

### 1. `mcp_Miro_board_get_items`
Lists board items with optional filtering by type.

**Parameters:**
- `board_id` (string, required): Board ID or full Miro board URL
- `filter_type` (string, optional): Item type filter

**Supported Item Types:**
- `sticky_note`
- `shape`
- `frame`
- `text`
- `image`
- `app_card`
- `card`
- `data_table_format`
- `document`
- `embed`
- `connector`
- `mindmap_node`
- `tag`

**Response:**
```json
{
  "items": [...],
  "cursor": "optional_pagination_cursor"
}
```

---

### 2. `mcp_Miro_context_get_board_docs`
Extracts/generates structured documentation from board context.

**Parameters:**
- `board_id` (string, required): Board ID or full Miro board URL
- `doc_types` (array, required): Array of document types to generate

**Supported Document Types:**
- `project_summary`
- `style_guide`
- `screen_design_requirements`
- `screen_functional_requirements`
- `general_board_document`
- `technical_specification`
- `functional_requirements`
- `non_functional_requirements`

**Response:**
```json
{
  "documents": {
    "project_summary": "...",
    "technical_specification": "...",
    ...
  }
}
```

**Use Cases:**
- Analyze board to understand feature requirements
- Generate PRDs, technical specs, or functional requirements
- Extract style guides and design systems from design boards

---

### 3. `mcp_Miro_board_get_image_download_url`
Retrieves download URLs for image items.

**Parameters:**
- `board_id` (string, required): Board ID or full Miro board URL
- `item_id` (string, required): Image item ID or full Miro image URL

**Response:**
```json
{
  "download_url": "https://..."
}
```

---

### 4. `mcp_Miro_draft_diagram_new`
Generates diagrams from text/code/PRDs using AI.

**Parameters:**
- `board_id` (string, required): Board ID or full Miro board URL
- `description` (string, required): Text description of the diagram
- `diagram_type` (string, optional): Diagram type (auto-detected if not specified)

**Supported Diagram Types:**
- `flowchart`
- `sequence`
- `mindmap`
- (Auto-detection available)

**Response:**
```json
{
  "diagram_id": "...",
  "status": "created"
}
```

**Behavior:**
- Creates diagram container on the board
- Generates AI-powered diagram content
- Places diagram with positioning metadata

---

## Pre-built Prompts

### 1. `/code_create_from_board`

**Purpose:** Analyze Miro board → Generate markdown documentation in IDE

**Two-Phase Approach:**
1. **Phase 1 (Analysis):** Reads board context to understand feature requirements and available documentation
2. **Phase 2 (Generation):** Generates specific documentation types as markdown files in the user's AI platform

**Benefits:**
- Retains context instructions locally in IDE
- Reduces need to continually search for context
- Creates guardrails to keep AI on correct path
- Prevents sporadic errors from context loss

**Typical Output:**
- `requirements.md`
- `technical-spec.md`
- `architecture.md`
- `style-guide.md`

---

### 2. `/code_explain_on_board`

**Purpose:** Convert code → Visual diagrams/documentation on Miro board

**Process:**
1. Analyzes code project structure
2. Generates visual assets:
   - Architecture diagrams
   - Data flow diagrams
   - Component relationship diagrams
3. Places assets on specified Miro board

**Benefits:**
- Automates hours of manual diagram creation
- Keeps documentation in sync with code changes
- Eliminates human errors in manual documentation
- Automatically updates when code changes

---

## Data Model

### Board
Container for items with the following properties:
- `id`: Unique board identifier
- `permissions`: Access control settings
- `team`: Associated team information

### Board Items (Polymorphic)
- `app_card`
- `card`
- `data_table_format`
- `document`
- `doc_format`
- `embed`
- `frame`
- `image`
- `preview`
- `shape`
- `sticky_note`
- `text`
- `connector`
- `mindmap_node`
- `tag`

### Context Documents
Structured outputs generated from board analysis:
- Project summaries
- Screen design/functional requirements
- Technical specifications
- Functional/non-functional requirements

### Diagrams
AI-generated visual artifacts with:
- Positioning metadata
- Type classification
- Parent-child relationships (diagram container → AI generation result)

---

## API Contracts

### Transport Layer
- **Protocol:** HTTP with Server-Sent Events (SSE)
- **Messaging:** JSON-RPC 2.0 over stdio
- **Format:** JSON

### Authentication
- **Method:** OAuth 2.1 with dynamic client registration
- **Authorization Flow:** Per-user OAuth tokens
- **Scope:** Standard Miro API permissions

### Rate Limits
- **Applies to:** Standard Miro API limits per user
- **Coverage:** All MCP tool calls count toward user's API limit
- **Tool-Specific Limits:** Some tools have stricter limits (subject to change)
- **Monitoring:** Standard API request logging, rate limit tracking

---

## Deployment & Configuration

### Runtime Environment
- **Hosting:** Miro-hosted MCP server
- **URL:** https://mcp.miro.com/

### Client Configuration
Add to your AI tool's MCP config (JSON):

```json
{
  "mcpServers": {
    "miro": {
      "url": "https://mcp.miro.com/",
      "auth": {
        "type": "oauth2.1"
      }
    }
  }
}
```

### Secrets Management
- OAuth tokens managed per-user via authorization flow
- No client-side token storage required
- Automatic token refresh

### Observability
- Standard API request logging
- Rate limit tracking per user
- Tool-specific limit monitoring

---

## Testing Strategy

### Unit Tests
- Validate MCP tool request/response schemas
- OAuth token handling logic
- Board item filtering logic
- Error handling for invalid inputs

### Integration Tests
End-to-end flows covering:
1. OAuth authorization → Board access → Context extraction → Diagram creation
2. Verify AI tool compatibility (Cursor, VSCode, Claude Code, etc.)
3. Token refresh and expiration handling
4. Rate limit responses

### E2E Critical Scenarios

#### Scenario 1: Code-to-Diagram
```
User authorizes MCP 
  → Opens code file in IDE
  → Runs /code_explain_on_board prompt
  → MCP creates diagrams on Miro board
  → User verifies diagrams match code structure
```

#### Scenario 2: Context-to-Code
```
User authorizes MCP
  → Runs /code_create_from_board with board URL
  → MCP extracts PRD/requirements from board
  → Generates markdown documentation in IDE
  → User uses docs to guide code generation
```

#### Scenario 3: Rate Limit Handling
```
AI tool issues multiple parallel requests
  → MCP enforces rate limits
  → Returns 429 Too Many Requests with retry headers
  → AI tool backs off and retries appropriately
```

#### Scenario 4: Diagram Auto-Detection
```
User requests diagram generation with vague description
  → MCP analyzes description
  → Auto-detects appropriate diagram type (flowchart vs. sequence)
  → Generates correct diagram type
  → Validates accuracy with user feedback
```

### Beta Testing
- Private beta with select customers
- Validate use cases: Context-to-Code, Code-to-Diagram
- Gather feedback on prompt effectiveness
- Monitor rate limit issues and adjust thresholds

---

## Integration Points

### Supported AI Coding Tools
- **Cursor**
- **Claude Code**
- **VSCode with GitHub Copilot**
- **Windsurf**
- **Gemini CLI**
- **Lovable**
- **Replit**
- **AWS Kiro**
- **Devin**
- **OpenAI Codex**

### Integration Requirements
Each AI tool must:
1. Support MCP protocol (JSON-RPC 2.0)
2. Handle OAuth 2.1 authorization flow
3. Support Server-Sent Events (SSE) for streaming responses
4. Implement rate limit backoff strategies

---

## Security Considerations

### OAuth 2.1
- Dynamic client registration
- Per-user authorization scopes
- Token expiration and refresh
- Secure token storage (handled by Miro, not client)

### Enterprise Compliance
- Standard Miro API security policies apply
- User permissions respected (read-only vs. edit access)
- Audit logging for all MCP operations
- Data residency follows Miro's existing policies

### API Security
- HTTPS-only communication
- Rate limiting to prevent abuse
- Request validation and sanitization
- Error messages don't expose sensitive information

---

## Performance Characteristics

### Latency
- **Board Context Extraction:** 2-5 seconds (depends on board size)
- **Diagram Generation:** 3-8 seconds (depends on complexity)
- **Item Listing:** <1 second (paginated for large boards)
- **Image URL Retrieval:** <500ms

### Scalability
- Horizontal scaling via Miro's infrastructure
- Rate limits prevent individual users from overloading system
- Caching strategies for frequently accessed boards

### Reliability
- 99.9% uptime target (aligned with Miro API SLA)
- Automatic retry with exponential backoff for transient failures
- Graceful degradation when AI diagram generation is unavailable

---

## Troubleshooting

### Common Issues

#### 1. OAuth Authorization Fails
- **Cause:** User hasn't authorized MCP server
- **Solution:** Re-run authorization flow in AI tool

#### 2. Rate Limit Exceeded
- **Cause:** Too many requests in short time period
- **Solution:** Implement exponential backoff, reduce request frequency

#### 3. Board Not Found
- **Cause:** Invalid board ID or insufficient permissions
- **Solution:** Verify board URL and user has access to board

#### 4. Diagram Generation Fails
- **Cause:** Vague description or unsupported diagram type
- **Solution:** Provide more specific description or explicitly specify diagram type

---

## Future Roadmap Considerations

Based on the board analysis, potential future enhancements:
1. **Resource Support:** Add static resources (API schemas, templates, workflows)
2. **Board Creation Tools:** Enable MCP to create new Miro boards
3. **Bi-directional Sync:** Keep code and Miro boards in continuous sync
4. **Custom Prompt Templates:** Allow teams to create organization-specific prompts
5. **Analytics Dashboard:** Track MCP usage, token costs, and productivity gains

---

## References

- **MCP Specification:** https://modelcontextprotocol.io/docs/getting-started/intro
- **Miro API Documentation:** https://developers.miro.com/docs
- **Miro MCP Server:** https://mcp.miro.com/

