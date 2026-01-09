# Deployment Guide

## Overview

The MCP Service now supports **both REST API and MCP Protocol (JSON-RPC 2.0)** from a single URL. No changes to your deployment strategy are required - the updates are fully backward compatible.

## Current Deployment Setup

- **Platform**: AWS ECS Fargate
- **Container**: Docker
- **Port**: 3001
- **Deployment Method**: GitHub Actions (automatic on PR merge)
- **Service URL**: `http://mainstage-mcp-2095625313.us-east-1.elb.amazonaws.com`

## Deployment Process

### Automatic Deployment (Recommended)

The service automatically deploys when a PR is merged to `main`:

1. **Merge your PR** to the `main` branch
2. **GitHub Actions** will:
   - Build the Docker image
   - Push to Amazon ECR
   - Update the ECS task definition
   - Deploy to ECS Fargate
   - Verify the deployment

### Manual Deployment

If you need to deploy manually:

```bash
# 1. Build and push Docker image
docker build --platform linux/amd64 -t 587928088166.dkr.ecr.us-east-1.amazonaws.com/mcp-service:latest .
docker push 587928088166.dkr.ecr.us-east-1.amazonaws.com/mcp-service:latest

# 2. Update ECS service (via AWS Console or CLI)
aws ecs update-service \
  --cluster mcp-cluster \
  --service mcp-service-mainstage \
  --force-new-deployment
```

## What Changed (No Action Required)

✅ **No deployment configuration changes needed**
- All existing endpoints continue to work
- New MCP endpoints are additive only
- Health check endpoint unchanged
- Port configuration unchanged
- Environment variables unchanged

## New Endpoints Available

After deployment, these endpoints will be available:

### MCP Protocol Endpoints
- `POST /mcp` - Dedicated MCP protocol endpoint (JSON-RPC 2.0)
- `POST /` - Auto-detects REST vs MCP protocol

### REST API Endpoints (Unchanged)
- `GET /health` - Health check
- `GET /tools` - List available tools
- `POST /tools/call` - Execute a tool

## Verification After Deployment

### 1. Check Health Endpoint

```bash
curl http://mainstage-mcp-2095625313.us-east-1.elb.amazonaws.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "miro-mcp-http",
  "protocols": ["REST", "MCP (JSON-RPC 2.0)"],
  ...
}
```

### 2. Test MCP Protocol Endpoint

```bash
# Test MCP initialize
curl -X POST http://mainstage-mcp-2095625313.us-east-1.elb.amazonaws.com/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {}
  }'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "experimental": {
        "progressNotifications": true
      }
    },
    "serverInfo": {
      "name": "miro-mcp-http",
      "version": "1.0.0"
    }
  }
}
```

### 3. Test REST API (Backward Compatibility)

```bash
# Test REST tools endpoint
curl http://mainstage-mcp-2095625313.us-east-1.elb.amazonaws.com/tools \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Environment Variables

No new environment variables required. Existing variables remain:

- `MIRO_ACCESS_TOKEN` - Miro API access token
- `GONG_KEY` - Gong API key
- `GONG_SECRET` - Gong API secret
- `ANTHROPIC_MODEL` - Anthropic model identifier
- `SERVICE_API_KEY` - API key for service authentication
- `AWS_REGION` - AWS region (us-east-1)
- `NODE_ENV` - Environment (production)

## Load Balancer Configuration

Ensure your Application Load Balancer (ALB) allows:
- **HTTP POST** requests to `/`, `/mcp`, and `/tools/call`
- **HTTP GET** requests to `/health` and `/tools`
- **Content-Type**: `application/json` headers

No changes needed if your ALB already allows these.

## Monitoring

### CloudWatch Logs

Monitor deployment logs:
```bash
aws logs tail /ecs/mcp-service --follow
```

### Health Check

The Docker health check uses `/health` endpoint:
- Interval: 30 seconds
- Timeout: 3 seconds
- Retries: 3

## Troubleshooting

### Service Not Starting

1. Check ECS task logs:
   ```bash
   aws logs tail /ecs/mcp-service --follow
   ```

2. Verify environment variables are set in AWS Systems Manager Parameter Store

3. Check ECS task status:
   ```bash
   aws ecs describe-tasks \
     --cluster mcp-cluster \
     --tasks <task-id>
   ```

### MCP Endpoint Not Responding

1. Verify the service is running:
   ```bash
   curl http://mainstage-mcp-2095625313.us-east-1.elb.amazonaws.com/health
   ```

2. Check if MCP requests are reaching the service (check ALB access logs)

3. Verify API key is correct:
   ```bash
   curl -X POST http://mainstage-mcp-2095625313.us-east-1.elb.amazonaws.com/mcp \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
   ```

### REST API Still Works

If MCP doesn't work but REST does, check:
- Request format (must include `jsonrpc: "2.0"`, `method`, and `id`)
- Content-Type header (`application/json`)
- API key authentication

## Rollback

If you need to rollback:

```bash
# Find previous task definition revision
aws ecs list-task-definitions --family-prefix mcp-service

# Update service to previous revision
aws ecs update-service \
  --cluster mcp-cluster \
  --service mcp-service-mainstage \
  --task-definition mcp-service:<previous-revision>
```

## Client Configuration

### For MCP Clients (New)

Your colleagues can now configure their MCP clients with:

```json
{
  "mcpServers": {
    "miro": {
      "url": "https://your-service-url.com/mcp",
      "transport": "http"
    }
  }
}
```

### For REST Clients (Unchanged)

Existing REST clients continue to work:
- `GET https://your-service-url.com/tools`
- `POST https://your-service-url.com/tools/call`

## Next Steps

1. ✅ Deploy the updated service (automatic via GitHub Actions)
2. ✅ Verify health endpoint shows `"protocols": ["REST", "MCP (JSON-RPC 2.0)"]`
3. ✅ Test MCP endpoint with a sample request
4. ✅ Share the service URL with colleagues
5. ✅ Provide them with MCP client configuration example

No additional configuration or infrastructure changes are required!
