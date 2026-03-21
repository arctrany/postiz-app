import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { createPost, listPosts, deletePost, findSlot } from './commands/posts';
import { listIntegrations, getIntegrationSettings, triggerIntegrationTool } from './commands/integrations';
import { uploadFile, uploadFromUrl } from './commands/upload';
import { channelAnalytics, postAnalytics } from './commands/analytics';
import { connectChannel, disconnectChannel } from './commands/channels';
import { listNotifications } from './commands/notifications';
import { showStatus } from './commands/status';
import type { Argv } from 'yargs';

yargs(hideBin(process.argv))
  .scriptName('xpoz')
  .usage('$0 <command> [options]')

  // ─── Posts ────────────────────────────────────────────────
  .command(
    'posts:create',
    'Create a new post',
    (yargs: Argv) => {
      return yargs
        .option('content', {
          alias: 'c',
          describe: 'Post/comment content (can be used multiple times)',
          type: 'string',
        })
        .option('media', {
          alias: 'm',
          describe: 'Comma-separated media URLs for the corresponding -c (can be used multiple times)',
          type: 'string',
        })
        .option('integrations', {
          alias: 'i',
          describe: 'Comma-separated list of integration IDs',
          type: 'string',
        })
        .option('date', {
          alias: 's',
          describe: 'Schedule date (ISO 8601 format) - REQUIRED',
          type: 'string',
        })
        .option('type', {
          alias: 't',
          describe: 'Post type: "schedule" or "draft"',
          type: 'string',
          choices: ['schedule', 'draft'],
          default: 'schedule',
        })
        .option('delay', {
          alias: 'd',
          describe: 'Delay in milliseconds between comments (default: 5000)',
          type: 'number',
          default: 5000,
        })
        .option('json', {
          alias: 'j',
          describe: 'Path to JSON file with full post structure',
          type: 'string',
        })
        .option('shortLink', {
          describe: 'Use short links',
          type: 'boolean',
          default: true,
        })
        .option('settings', {
          describe: 'Platform-specific settings as JSON string',
          type: 'string',
        })
        .check((argv) => {
          if (!argv.json && !argv.content) {
            throw new Error('Either --content or --json is required');
          }
          if (!argv.json && !argv.integrations) {
            throw new Error('--integrations is required when not using --json');
          }
          if (!argv.json && !argv.date) {
            throw new Error('--date is required when not using --json');
          }
          return true;
        })
        .example(
          '$0 posts:create -c "Hello World!" -s "2024-12-31T12:00:00Z" -i "twitter-123"',
          'Simple scheduled post'
        )
        .example(
          '$0 posts:create -c "Main post" -m "img1.jpg" -c "Comment" -m "img2.jpg" -s "2024-12-31T12:00:00Z" -i "twitter-123"',
          'Post with comments and media'
        )
        .example(
          '$0 posts:create --json ./post.json',
          'Complex post from JSON file'
        );
    },
    createPost as any
  )
  .command(
    'posts:list',
    'List all posts',
    (yargs: Argv) => {
      return yargs
        .option('startDate', {
          describe: 'Start date (ISO 8601 format). Default: 30 days ago',
          type: 'string',
        })
        .option('endDate', {
          describe: 'End date (ISO 8601 format). Default: 30 days from now',
          type: 'string',
        })
        .option('customer', {
          describe: 'Customer ID (optional)',
          type: 'string',
        })
        .example('$0 posts:list', 'List all posts (last 30 days to next 30 days)')
        .example(
          '$0 posts:list --startDate "2024-01-01T00:00:00Z" --endDate "2024-12-31T23:59:59Z"',
          'List posts for a specific date range'
        );
    },
    listPosts as any
  )
  .command(
    'posts:delete <id>',
    'Delete a post',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Post ID to delete',
          type: 'string',
        })
        .example('$0 posts:delete abc123', 'Delete post with ID abc123');
    },
    deletePost as any
  )
  .command(
    'posts:slot [id]',
    'Find next available scheduling slot',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Integration ID (optional, for integration-specific slot)',
          type: 'string',
        })
        .example('$0 posts:slot', 'Find next free scheduling slot')
        .example('$0 posts:slot twitter-123', 'Find slot for specific integration');
    },
    findSlot as any
  )

  // ─── Integrations ────────────────────────────────────────
  .command(
    'integrations:list',
    'List all connected integrations',
    {},
    listIntegrations as any
  )
  .command(
    'integrations:settings <id>',
    'Get settings schema for a specific integration',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Integration ID',
          type: 'string',
        })
        .example(
          '$0 integrations:settings reddit-123',
          'Get settings schema for Reddit integration'
        );
    },
    getIntegrationSettings as any
  )
  .command(
    'integrations:trigger <id> <method>',
    'Trigger an integration tool to fetch additional data',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Integration ID',
          type: 'string',
        })
        .positional('method', {
          describe: 'Method name from the integration tools',
          type: 'string',
        })
        .option('data', {
          alias: 'd',
          describe: 'Data to pass to the tool as JSON string',
          type: 'string',
        })
        .example(
          '$0 integrations:trigger reddit-123 getSubreddits',
          'Get list of subreddits'
        )
        .example(
          '$0 integrations:trigger youtube-123 getPlaylists',
          'Get YouTube playlists'
        );
    },
    triggerIntegrationTool as any
  )

  // ─── Channels ─────────────────────────────────────────────
  .command(
    'channels:connect <provider>',
    'Generate OAuth URL to connect a new channel',
    (yargs: Argv) => {
      return yargs
        .positional('provider', {
          describe: 'Provider name (e.g. x, linkedin, facebook, instagram, youtube, tiktok, reddit)',
          type: 'string',
        })
        .option('refresh', {
          describe: 'Integration ID to reconnect/refresh',
          type: 'string',
        })
        .example('$0 channels:connect x', 'Connect a new X (Twitter) channel')
        .example('$0 channels:connect linkedin', 'Connect a new LinkedIn channel')
        .example(
          '$0 channels:connect x --refresh integration-123',
          'Reconnect an existing X channel'
        );
    },
    connectChannel as any
  )
  .command(
    'channels:disconnect <id>',
    'Disconnect/remove a channel',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Channel/integration ID to disconnect',
          type: 'string',
        })
        .example(
          '$0 channels:disconnect integration-123',
          'Disconnect a channel'
        );
    },
    disconnectChannel as any
  )

  // ─── Analytics ────────────────────────────────────────────
  .command(
    'analytics:channel <id>',
    'Get analytics for a specific channel',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Integration/channel ID',
          type: 'string',
        })
        .option('date', {
          describe: 'Date to fetch analytics from (ISO 8601 format)',
          type: 'string',
        })
        .example(
          '$0 analytics:channel twitter-123',
          'Get analytics for X channel'
        )
        .example(
          '$0 analytics:channel twitter-123 --date "2024-03-01T00:00:00Z"',
          'Get analytics from a specific date'
        );
    },
    channelAnalytics as any
  )
  .command(
    'analytics:post <id>',
    'Get analytics for a specific post',
    (yargs: Argv) => {
      return yargs
        .positional('id', {
          describe: 'Post ID',
          type: 'string',
        })
        .option('date', {
          describe: 'Date to fetch analytics from (ISO 8601 format)',
          type: 'string',
        })
        .example(
          '$0 analytics:post post-123',
          'Get analytics for a specific post'
        );
    },
    postAnalytics as any
  )

  // ─── Notifications ───────────────────────────────────────
  .command(
    'notifications:list',
    'List notifications',
    (yargs: Argv) => {
      return yargs
        .option('page', {
          alias: 'p',
          describe: 'Page number (default: 0)',
          type: 'number',
          default: 0,
        })
        .example('$0 notifications:list', 'List notifications')
        .example('$0 notifications:list -p 2', 'List page 2 of notifications');
    },
    listNotifications as any
  )

  // ─── Upload ───────────────────────────────────────────────
  .command(
    'upload <file>',
    'Upload a local file',
    (yargs: Argv) => {
      return yargs
        .positional('file', {
          describe: 'File path to upload',
          type: 'string',
        })
        .example('$0 upload ./image.png', 'Upload an image');
    },
    uploadFile as any
  )
  .command(
    'upload:url <url>',
    'Upload media from a remote URL',
    (yargs: Argv) => {
      return yargs
        .positional('url', {
          describe: 'Remote URL to download and upload',
          type: 'string',
        })
        .example(
          '$0 upload:url "https://example.com/image.jpg"',
          'Upload image from URL'
        );
    },
    uploadFromUrl as any
  )

  // ─── Status ───────────────────────────────────────────────
  .command(
    'status',
    'Check API connection and show account summary',
    {},
    showStatus as any
  )

  .demandCommand(1, 'You need at least one command')
  .help()
  .alias('h', 'help')
  .version()
  .alias('v', 'version')
  .epilogue(
    'For more information, visit: https://xpoz.com\n\nSet your API key: export XPOZ_API_KEY=your_api_key'
  )
  .parse();
