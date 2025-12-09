# Miro MCP Server - Overview

> **Source:** [Miro Board](https://miro.com/app/board/uXjVJ-Gowqk=/)  
> **Last Updated:** November 25, 2025

## Executive Summary

The Miro Model Context Protocol (MCP) Server is a sales enablement and training resource focused on connecting AI coding assistants to Miro boards. It enables seamless **Context-to-Code** and **Code-to-Diagram** workflows, bridging the gap between product planning in Miro and code implementation in IDEs.

**Target Audience:**
- **Primary Users:** Software Engineers, Product Managers, Designers using AI coding tools
- **"Vibe Coders":** Product/design professionals leveraging AI tools (Lovable, Bolt, Replit)
- **Sales/Support Teams:** SEs, AEs, CSMs who need to understand and sell/support Miro MCP

---

## What is MCP (Model Context Protocol)?

### Definition
A **Model Context Protocol (MCP)** is an open, standardized framework that allows large language models (LLMs) to access external tools, services, and data sources to perform complex tasks. Think of it as **"a USB-C port for AI"** — a universal interface for AI applications to connect with the real world.

### MCP vs Agents

| **MCP** | **Agents** |
|---------|------------|
| A communication standard/protocol | AI systems that take autonomous actions |
| Defines HOW AI models securely connect to tools/data | USE protocols like MCP to actually DO things |
| The "plumbing" that enables connections | The intelligence that makes decisions and executes tasks |
| **Analogy:** Like USB — the standardized way to connect devices | **Analogy:** Like a smart assistant that operates devices through USB |

### Key Benefits
- ✅ **Enhanced Capabilities:** Enables LLMs to perform tasks beyond their core function (e.g., accessing live data, executing code)
- ✅ **Interoperability:** Universal connection method reduces complexity of managing custom wrappers
- ✅ **Scalability & Maintainability:** Common standard makes it easier to build and scale AI applications
- ✅ **Security:** Creates secure connections with user authorization and consent policies

---

## MCP Server Feature Types

Any MCP Server can access three types of features:

### 1. **Tools** 🔧
Functions that an LLM can call to perform specific tasks. The LLM decides when to use them based on user requests.

**Examples:** Creating boards, generating diagrams, building tables, adding content to documents/templates

### 2. **Resources** 📚
Static data sources that provide access to information for context purposes (e.g., files containing analysis instructions, API documentation, schemas, workflows, templates).

**Note:** Resources are static and used to inform the LLM on context for specific tasks.

### 3. **Prompts** 💬
Pre-built, refined sets of instructions that tell the LLM to work with defined tools and resources. Much more detailed and intentional than typical user prompts.

**Examples:** "Summarize my meeting," "Write me a decline email," "Analyze my code for bugs"

---

## Miro's MCP Implementation

### Use Case Focus
Reinforces the **"Deliver"** phase of the Discover → Define → Deliver loop by bridging the gap between project context in Miro and IDEs (Cursor, VSCode, Windsurf) and "vibe coding" tools (Lovable, Bolt, Replit).

**Goal:** Enable tech-savvy product, design, and engineering teams to create robust version zero prototypes or working prototypes.

### What Miro's MCP Can Do

#### **Tools** (4 Available)

1. **`mcp_Miro_board_get_items`**
   - Lists all items on a Miro board
   - Can filter by item type (sticky_note, shape, frame, text, image, etc.)

2. **`mcp_Miro_context_get_board_docs`**
   - Extracts and generates text representations of all board items for AI context
   - Can generate typed documentation:
     - Project summaries
     - Style guides
     - Screen design requirements
     - Screen functional requirements
     - Technical specifications
     - Functional/non-functional requirements
   - Perfect for understanding board context and generating structured documentation

3. **`mcp_Miro_board_get_image_download_url`**
   - Gets the download URL for a specific image item on a board

4. **`mcp_Miro_draft_diagram_new`**
   - Generates diagrams from text descriptions using AI
   - Supports multiple diagram types (flowchart, sequence, mindmap, etc.)
   - Auto-detects diagram type if not specified
   - Creates both the diagram container and AI generation result items on the board

#### **Resources**
Resources are not being used in the current iteration of this MCP Server.

#### **Prompts** (2 Pre-built)

1. **`/code_create_from_board`**
   - **Two-tier approach:**
     1. Analyzes board to understand feature requirements and available docs
     2. Generates specific documentation types as markdown files in the user's AI platform
   - **Benefit:** Retains context instructions locally so the IDE doesn't have to continually search for context. Creates guardrails to keep AI on the correct path.

2. **`/code_explain_on_board`**
   - Explains code implementation by creating diagrams and documentation on a specified Miro board
   - Transforms code projects into visual assets (architecture diagrams, data flows, component relationships)
   - **Benefit:** Automates laborious manual diagram creation and keeps visuals in sync with code changes

---

## Supported AI Coding Tools

Miro MCP integrates with:
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

---

## Key Pain Points Addressed

### 1. **Context Chaos**
- Keeping technical documentation/diagrams in sync with codebase
- Onboarding new engineers with accurate system understanding
- Ensuring docs match what's in production

### 2. **Translation Gaps**
- Clarifying requirements from Product to Engineering
- Pulling context from multiple sources (Miro, Jira, Slack, meetings)
- Bridging the "different languages" between Product and Engineering

### 3. **Token/Cost Waste & AI Inefficiency**
- Re-prompting AI tools multiple times to get correct outputs
- Inconsistent AI outputs across team members
- Cost of everyone independently feeding context to AI tools

### 4. **Rewrites & Wasted Sprints**
- Rework or course corrections consuming sprint time
- Bootstrapping new features vs. actual engineering work
- Features sent back for rework due to misalignment

### 5. **Communication Gap (Design/Planning → Implementation)**
- Translating Miro boards into actual engineering tasks
- Multiple meetings/Slack threads to clarify requirements
- Delay between concept presentation and confident implementation

---

## Discovery Questions Framework

### For Engineers
- "How do you keep technical documentation/diagrams in sync with your codebase?"
- "When you receive requirements from Product, how much time do you spend clarifying what they actually mean?"
- "Are you using AI coding assistants? How well do they understand your project context?"
- "What percentage of your sprint is spent on rework or course corrections?"

### For Vibe Coders/PMs
- "When you hand off a feature to engineering, what documentation do you provide?"
- "How do you currently translate your product concepts into something developers can execute on?"
- "Is your engineering team using AI coding tools? Have you seen variability in what they produce?"
- "How often do you have to send features back for rework because they didn't match expectations?"

### Follow-up Pattern
1. **Confirm the pain:** "So you're spending X hours per sprint on [specific pain]. Is that accurate?"
2. **Quantify the impact:** "How many engineers/PMs does this affect? What's the cost in velocity or budget?"
3. **Explore current solutions:** "What have you tried to solve this? Why didn't it work?"
4. **Tie to MCP capability:** "What if you could [MCP benefit]? How would that change things?"

---

## Next Steps

1. **Create a Sales Playbook:** Consolidate discovery questions, value propositions, and objection handling
2. **Develop Customer-Facing Collateral:** Create public-facing demo content and tutorial videos for each supported AI coding tool
3. **Formalize Technical Integration Guides:** Extract integration instructions into standalone, tool-specific setup guides with troubleshooting

---

## Resources

- **MCP Documentation:** https://modelcontextprotocol.io/docs/getting-started/intro
- **MCP Explained (Medium):** https://medium.com/@elisowski/mcp-explained-the-new-standard-connecting-ai-to-everything-79c5a1c98288
- **Miro MCP Server:** https://mcp.miro.com/

