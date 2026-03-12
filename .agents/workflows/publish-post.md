---
description: Publish a post to X/Twitter via XPoz CLI Skill (Public API)
---

# Publish via XPoz CLI Skill

This workflow uses the XPoz Public API (as defined in `apps/cli/SKILL.md`) to publish posts.

## Prerequisites

- Backend running at `http://localhost:3333`
- Orchestrator running (for immediate delivery)
- X integration connected
- API Key available (auto-extracted from DB)

## Steps

// turbo
1. Extract API Key from database:
```bash
API_KEY=$(docker exec xpoz-postgres psql -U xpoz-user -d xpoz-db-local -t -A -c 'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;' 2>/dev/null || psql "$(grep DATABASE_URL .env | cut -d= -f2- | tr -d '"')" -t -A -c 'SELECT "apiKey" FROM "Organization" ORDER BY "createdAt" DESC LIMIT 1;')
echo "API_KEY=$API_KEY"
```

// turbo
2. List connected integrations:
```bash
curl -s -H "Authorization: $API_KEY" http://localhost:3333/public/v1/integrations | python3 -m json.tool
```
Save the X integration `id` as `INTEGRATION_ID`.

3. (Optional) Upload an image:
```bash
curl -s -X POST -H "Authorization: $API_KEY" -F "file=@path/to/image.png" http://localhost:3333/public/v1/upload | python3 -m json.tool
```
Save the returned `id` and `path` for use in the post.

4. Create and publish a post (type=now for immediate, type=schedule for later):
```bash
NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
curl -s -X POST \
  -H "Authorization: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"now\",
    \"date\": \"$NOW\",
    \"shortLink\": true,
    \"tags\": [],
    \"posts\": [{
      \"integration\": {\"id\": \"$INTEGRATION_ID\"},
      \"value\": [{
        \"content\": \"Your tweet content here\",
        \"image\": [{\"path\": \"UPLOADED_IMAGE_URL\", \"id\": \"UPLOADED_IMAGE_ID\"}]
      }],
      \"settings\": {\"who_can_reply_post\": \"everyone\"}
    }]
  }" \
  http://localhost:3333/public/v1/posts | python3 -m json.tool
```

// turbo
5. Verify post was published:
```bash
curl -s -H "Authorization: $API_KEY" "http://localhost:3333/public/v1/posts?startDate=$(date -u '+%Y-%m-%d')T00:00:00Z&endDate=$(date -u -v+1d '+%Y-%m-%d')T00:00:00Z" | python3 -c "
import json,sys
data = json.load(sys.stdin)
for p in data.get('posts', []):
    print(f'State={p[\"state\"]} URL={p.get(\"releaseURL\",\"none\")}')
"
```

## Notes

- **type=now**: Publishes immediately (requires orchestrator running)
- **type=schedule**: Schedules for the specified date (requires orchestrator)
- **type=draft**: Saves as draft only
- Always check post state after creation: QUEUE → PUBLISHED means success
- Do NOT create duplicate posts — always check existing posts first
