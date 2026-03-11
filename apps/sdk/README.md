# XPoz NodeJS SDK

This is the NodeJS SDK for [XPoz](https://xpoz.com).

You can start by installing the package:

```bash
npm install @postiz/node
```

## Usage
```typescript
import XPoz from '@postiz/node';
const postiz = new XPoz('your api key', 'your self-hosted instance (optional)');
```

The available methods are:
- `post(posts: CreatePostDto)` - Schedule a post to XPoz
- `postList(filters: GetPostsDto)` - Get a list of posts
- `upload(file: Buffer, extension: string)` - Upload a file to XPoz
- `integrations()` - Get a list of connected channels
- `deletePost(id: string)` - Delete a post by ID

Alternatively you can use the SDK with curl, check the [XPoz API documentation](https://docs.xpoz.com/public-api) for more information.