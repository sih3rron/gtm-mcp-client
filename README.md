# MCP Chat Client

A Next.js-based chat interface for interacting with Model Context Protocol (MCP) servers, specifically designed for Miro board analysis and collaboration.

## Features

- 🔐 **Google OAuth Authentication** via NextAuth.js
- 💬 **Sophisticated Chat Interface** with tool call visibility
- 📊 **Miro Board Analysis** - Analyze board content, get insights, and recommendations
- 🎨 **Template Recommendations** - AI-powered Miro template suggestions
- 💾 **Conversation Persistence** with PostgreSQL
- 🎯 **Modern UI** built with Tailwind CSS and Shadcn/UI
- 🔄 **Real-time Tool Execution** with detailed logging
- 📱 **Responsive Design** for desktop and mobile

## Architecture

```
Next.js Frontend → Backend API → HTTP MCP Service (Miro) → Miro API
                ↓
           PostgreSQL Database
```

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Google OAuth app credentials
- Miro API access token
- Anthropic API key

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd mcp-chat-client
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/mcp_chat

# MCP Server Configuration
MIRO_MCP_SERVICE_URL=http://localhost:3001
MIRO_ACCESS_TOKEN=your-miro-access-token

# Anthropic API
ANTHROPIC_API_KEY=your-anthropic-api-key
```

### 3. Database Setup

```bash
# Generate and run database migrations
npm run db:generate
npm run db:migrate

# Optional: Open database studio
npm run db:studio
```

### 4. Start the MCP Service

First, start the Miro HTTP MCP service:

```bash
# In a separate terminal
cd services
node miro-http-service.js
```

### 5. Start the Application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
mcp-chat-client/
├── app/                          # Next.js App Router
│   ├── api/                     # API routes
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── chat/               # Chat API
│   │   ├── conversations/      # Conversation management
│   │   └── mcp/                # MCP service integration
│   ├── auth/signin/            # Authentication pages
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page
├── components/                   # React components
│   ├── chat/                   # Chat-specific components
│   │   ├── ChatInterface.tsx   # Main chat UI
│   │   ├── ChatLayout.tsx      # Layout with sidebar
│   │   └── ConversationList.tsx # Conversation history
│   ├── ui/                     # Reusable UI components
│   └── theme-provider.tsx      # Theme configuration
├── hooks/                       # Custom React hooks
│   └── use-toast.ts            # Toast notifications
├── lib/                         # Utility libraries
│   ├── auth.ts                 # NextAuth configuration
│   ├── db/                     # Database setup
│   │   ├── index.ts            # Database connection
│   │   └── schema.ts           # Drizzle ORM schema
│   └── utils.ts                # Utility functions
├── services/                    # External services
│   └── miro-http-service.ts    # HTTP MCP service
├── types/                       # TypeScript definitions
│   └── chat.ts                 # Chat-related types
└── README.md                    # This file
```

## Core Components

### ChatInterface
The main chat component that handles:
- Message display and input
- Tool call execution and visualization
- Real-time conversation updates
- Template recommendation display

### ChatLayout
The overall layout component featuring:
- Collapsible sidebar with conversation history
- User authentication state
- Responsive design for mobile/desktop

### MCP Service Integration
- HTTP-based MCP service for Miro integration
- Tool discovery and execution
- Error handling and retry logic

## Available MCP Tools

### `analyze_board_content`
Analyzes Miro board content with smart summarization.

**Parameters:**
- `boardId` (string): Miro board ID or URL
- `maxContent` (number): Maximum items to analyze (default: 15)
- `includeTemplateRecommendations` (boolean): Include template suggestions

**Example Usage:**
```
Analyze this Miro board: https://miro.com/app/board/uXjVKMOJbXg=
```

### `recommend_templates`
Get AI-powered template recommendations.

**Parameters:**
- `boardId` (string): Miro board to analyze
- `meetingNotes` (string): Alternative text input
- `maxRecommendations` (number): Max templates to return

**Example Usage:**
```
Recommend templates for a design sprint workshop
```

### `create_miro_board`
Create new Miro boards programmatically.

**Parameters:**
- `name` (string): Board name
- `description` (string): Board description

**Example Usage:**
```
Create a new board called "Sprint Planning Q2 2024"
```

## Database Schema

The application uses PostgreSQL with Drizzle ORM:

### Tables
- **users**: User accounts (NextAuth integration)
- **accounts**: OAuth account linking
- **sessions**: User sessions
- **conversations**: Chat conversations
- **messages**: Individual chat messages with tool call data

### Key Relationships
- Users have many conversations
- Conversations have many messages
- Messages can contain tool call data (JSON)

## Authentication Flow

1. User clicks "Sign in with Google"
2. NextAuth redirects to Google OAuth
3. On success, user record is created/updated
4. Session established with secure cookies
5. Database adapter stores session data

## API Endpoints

### Chat API (`/api/chat`)
**POST** - Send message and get AI response
- Authenticates user
- Fetches available MCP tools
- Calls Anthropic API with tools
- Executes tool calls via MCP service
- Saves conversation to database

### Conversations API (`/api/conversations`)
**GET** - List user's conversations
**POST** - Create new conversation
**DELETE** `/api/conversations/[id]` - Delete conversation

### MCP Tools API (`/api/mcp/tools`)
**GET** - List available MCP tools from service

## Environment Configuration

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select a project
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://yourdomain.com/api/auth/callback/google` (prod)

### Miro API Setup
1. Go to [Miro Developer Console](https://developers.miro.com/)
2. Create a new app
3. Get your access token
4. Set required scopes: `boards:read`, `boards:write`

### Database Setup
```sql
-- Create database
CREATE DATABASE mcp_chat;

-- The app will automatically create tables via migrations
```

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production
- Update `NEXTAUTH_URL` to your production domain
- Use secure random string for `NEXTAUTH_SECRET`
- Configure production PostgreSQL database
- Update MCP service URL if deployed separately

## Development

### Adding New MCP Tools
1. Update the HTTP MCP service with new tool definition
2. Add tool handler in `/app/api/chat/route.ts`
3. Update UI components to handle new tool responses
4. Add TypeScript types as needed

### Styling
- Uses Tailwind CSS for utility-first styling
- Shadcn/UI for consistent component library
- CSS variables for theming (light/dark mode ready)
- Responsive design with mobile-first approach

### Database Changes
```bash
# After modifying schema.ts
npm run db:generate  # Generate migration
npm run db:migrate   # Apply migration
```

## Troubleshooting

### Common Issues

**"Database connection failed"**
- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Verify database exists

**"MCP tools not loading"**
- Confirm MCP service is running on correct port
- Check MIRO_MCP_SERVICE_URL environment variable
- Verify Miro API token is valid

**"Google OAuth not working"**
- Verify client ID/secret are correct
- Check authorized redirect URIs
- Ensure Google+ API is enabled

**"Tool calls failing"**
- Check Anthropic API key
- Verify MCP service connectivity
- Review server logs for detailed errors

### Logs
- Browser console for frontend errors
- Terminal for server-side logs
- MCP service logs for tool execution

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Support

- Check the [Issues](https://github.com/your-repo/issues) for known problems
- Create a new issue for bugs or feature requests
- Review [Next.js documentation](https://nextjs.org/docs)
- Check [NextAuth.js documentation](https://next-auth.js.org/)

## Roadmap

- [ ] File upload support for document analysis
- [ ] Multiple MCP server support
- [ ] Advanced conversation search
- [ ] Export conversation history
- [ ] Real-time collaboration features
- [ ] Custom template creation
- [ ] Analytics and usage insights