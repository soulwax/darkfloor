# 🌟 darkfloor.art

![darkfloor.art Banner](.github/assets/emily-the-strange_vivid.png)

*A modern full-stack music streaming and discovery platform with intelligent recommendations, advanced audio features, and beautiful visualizations.*

**Current Version:** 0.7.3  
**License:** GPLv3

---

## ✨ Project Status

**Production Ready**: This is a fully-featured music streaming platform with a complete feature set including music playback, playlists, user accounts, audio visualizations, and smart recommendations. The application is deployed and actively maintained.

## 📋 Core Features

### Music Player

- **Full-Featured Audio Player**: HTML5 audio playback with advanced controls
  - Play/pause, skip forward/backward, seek controls
  - Volume control with mute functionality
  - Playback rate adjustment (0.5x - 2.0x)
  - Shuffle and repeat modes (none, one, all)
  - Persistent playback state across sessions
  - Cross-device synchronization via database

- **Queue Management**: Advanced queue system with drag-and-drop reordering
  - Visual queue panel with track management
  - Smart queue auto-population when queue runs low
  - Queue history tracking
  - Original queue order preservation for unshuffle

- **10-Band Equalizer**: Professional audio equalizer with presets
  - Customizable frequency bands
  - Multiple preset configurations
  - Real-time audio processing
  - Per-user preference storage

### Music Discovery

- **Advanced Search**: Type-safe search integrated with Deezer API
  - Real-time search results
  - Search history tracking
  - Filtered and sorted results

- **Smart Recommendations**: Hybrid recommendation system
  - API-based recommendations (Deezer)
  - Audio feature-based recommendations (when enabled)
  - Multi-seed recommendation support
  - Recommendation caching for performance
  - Configurable similarity preferences (strict, balanced, diverse)

- **Listening History**: Complete playback tracking
  - Track play history with timestamps
  - Duration tracking
  - Analytics and insights

### Playlist Management

- **Full Playlist System**: Create, edit, and manage playlists
  - Create unlimited playlists
  - Add/remove tracks with quick-add buttons
  - Drag-and-drop track reordering
  - Public/private playlist settings
  - Track count display
  - Playlist sharing via user profiles

### Audio Visualizations

- **80+ Visualization Patterns**: Extensive collection of audio-reactive visualizations
  - Kaleidoscope effects
  - Sacred geometry patterns (Flower of Life, Metatron's Cube, Sri Yantra)
  - Particle systems (fireworks, bubbles, starfield, swarm)
  - Fractal patterns (Mandelbrot, Julia sets)
  - Galaxy and cosmic effects
  - Portal and vortex effects
  - Real-time audio reactivity
  - Smooth pattern transitions
  - Pattern controls and customization

- **Background Visualizations**: Immersive full-screen visual experiences
  - Flow field backgrounds
  - Lightweight particle systems
  - Audio-reactive color schemes

### User Features

- **Authentication**: Discord OAuth 2.0 integration via NextAuth.js
  - Secure session management
  - User profile pages with custom URLs
  - Public/private profile settings
  - Bio and profile customization

- **User Preferences**: Comprehensive preference system
  - Volume, playback rate, repeat mode, shuffle
  - Equalizer settings and presets
  - Visualizer preferences (type, enabled state)
  - Smart queue settings
  - Theme preferences
  - UI layout preferences (compact mode, panel states)

- **Favorites System**: Save and manage favorite tracks
  - Quick favorite/unfavorite actions
  - Favorites library view

### Technical Capabilities

- **Type-Safe Architecture**: End-to-end type safety
  - TypeScript with strict mode
  - tRPC for type-safe API calls
  - Zod validation schemas
  - Type-safe environment variables

- **Responsive Design**: Mobile-first responsive UI
  - Separate mobile and desktop player components
  - Touch-optimized gestures
  - Haptic feedback on mobile
  - Pull-to-refresh support
  - Swipeable track cards

- **Performance Optimizations**:
  - React Virtual for large lists
  - Code splitting and lazy loading
  - Optimized bundle imports
  - Object pooling for visualizations
  - Recommendation caching
  - Standalone Next.js builds

## 🧱 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 15 (App Router) | Server-side rendering & routing |
| **Language** | TypeScript 5.9 | Type-safe development with strict mode |
| **Styling** | TailwindCSS v4 | Utility-first CSS framework |
| **API Layer** | tRPC v11 | End-to-end type-safe API |
| **Database** | PostgreSQL + Drizzle ORM | Type-safe database queries & migrations |
| **Authentication** | NextAuth.js v5 | Discord OAuth 2.0 / Session management |
| **State Management** | React Context + TanStack Query | Global state & server state |
| **Audio** | HTML5 Audio API + Tone.js | Native playback + advanced audio processing |
| **Visualizations** | Canvas2D | 80+ audio-reactive patterns |
| **UI Libraries** | Framer Motion, Lucide React, @dnd-kit | Animations, icons, drag & drop |
| **Desktop** | Electron | Cross-platform desktop application |
| **Deployment** | PM2 + Standalone Next.js | Production process management |
| **Environment** | @t3-oss/env-nextjs | Type-safe environment configuration |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (for production use)

### Installation

1. **Clone & Install**

    ```bash
    git clone https://github.com/soulwax/starchild-music-frontend.git
    cd darkfloor-art
    npm install
    ```

2. **Environment Configuration**

    Create a `.env.local` file with required variables:

    ```yaml
    # NextAuth Configuration
    AUTH_SECRET=generate-with->npx auth secret
    AUTH_DISCORD_ID="your-discord-app-id"
    AUTH_DISCORD_SECRET="your-discord-app-secret"
    NEXTAUTH_URL="http://localhost:3222"  # Optional, defaults to auto-detect

    # Database Configuration
    DATABASE_URL="postgres://user:password@host:port/dbname?sslmode=require"
    DB_HOST="localhost"
    DB_PORT="5432"
    DB_NAME="darkfloor"
    DB_ADMIN_USER="postgres"
    DB_ADMIN_PASSWORD="your-password"
    DB_SSL_CA=""  # Optional: Path to SSL CA certificate

    # API Configuration
    NEXT_PUBLIC_API_URL="https://api.deezer.com/"
    STREAMING_KEY="your-secure-stream-key"
    SONGBIRD_API_KEY=""  # Optional: For enhanced features
    NEXT_PUBLIC_SONGBIRD_API_URL=""  # Optional: For enhanced features

    # Server Configuration
    NODE_ENV="development"
    PORT="3222"  # Default port for the application
    ```

    **Generate NextAuth Secret:**

    ```bash
    npx auth secret
    ```

3. **Database Setup**

    The application requires PostgreSQL. Set up your database:

    ```bash
    # Create database (if not exists)
    createdb darkfloor

    # Run migrations
    npm run db:generate  # Generate migration files
    npm run db:migrate   # Run migrations
    npm run db:push      # Push schema changes (alternative to migrate)
    ```

    For database operations, the `drizzle.env.ts` file is already configured to read from your `.env.local` file.

4. **SSL Certificates (Optional)**

    For production with SSL-enabled databases, place your CA certificate at:
    ```
    certs/ca.pem
    ```

    Or generate self-signed certificates:
    ```bash
    npm run generate:ssl
    ```

5. **Run Development Server**

    ```bash
    npm run dev
    ```

    Visit `http://localhost:3222` to see the application.

    **Note**: The default port is `3222` (not 3000) as configured in the project.

## 📁 Project Structure

```shell
darkfloor-player/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── [userhash]/         # User profile pages
│   │   ├── api/                # API routes (health, OG images)
│   │   ├── library/            # User library page
│   │   ├── playlists/          # Playlist management pages
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Home page
│   │
│   ├── components/             # React components
│   │   ├── visualizers/        # Audio visualizations (80+ patterns)
│   │   │   └── FlowFieldRenderer.ts  # Main visualization engine
│   │   ├── Player.tsx          # Desktop audio player
│   │   ├── MobilePlayer.tsx    # Mobile audio player
│   │   ├── PersistentPlayer.tsx # Global player wrapper
│   │   ├── EnhancedQueue.tsx   # Queue management
│   │   ├── Equalizer.tsx       # Audio equalizer
│   │   ├── TrackCard.tsx       # Track display component
│   │   └── ... (50+ components)
│   │
│   ├── server/
│   │   ├── api/
│   │   │   ├── routers/        # tRPC routers
│   │   │   │   ├── music.ts    # Music operations
│   │   │   │   ├── preferences.ts
│   │   │   │   └── equalizer.ts
│   │   │   └── root.ts         # Main router
│   │   ├── auth/               # NextAuth configuration
│   │   └── db/
│   │       ├── schema.ts       # Drizzle schema (15+ tables)
│   │       └── index.ts        # Database connection
│   │
│   ├── contexts/                # React contexts
│   │   ├── AudioPlayerContext.tsx
│   │   ├── MenuContext.tsx
│   │   └── ToastContext.tsx
│   │
│   ├── services/               # Business logic
│   │   ├── smartQueue.ts       # Auto-queue recommendations
│   │   ├── songbird.ts         # External API integration
│   │   └── storage.ts          # Storage utilities
│   │
│   ├── trpc/                   # tRPC client setup
│   ├── types/                   # TypeScript definitions
│   ├── utils/                   # Utility functions
│   ├── styles/                  # Global styles
│   └── env.js                   # Typed environment validation
│
├── electron/                    # Electron main process
│   ├── main.cjs                 # Electron entry point
│   ├── preload.cjs              # Preload script
│   └── prepare-package.js      # Build preparation
│
├── drizzle/                    # Database migrations
├── scripts/                     # Build & deployment scripts
│   ├── server.js                # Production server wrapper
│   └── ensure-build.js          # Build validation
├── public/                      # Static assets
├── certs/                       # SSL certificates (optional)
└── logs/                        # PM2 logs
```

## 🎨 Design System

| Element | Description |
|---------|-------------|
| **Cards & Buttons** | Rounded corners, flat surfaces with neon indigo borders/text |
| **Background** | Matte deep gray gradient with subtle animated accents |
| **Typography** | System sans-serif stack for crisp, accessible typography |
| **Animations** | CSS-based `slide-up`, `fade-in`, and gradient flows |
| **Color Palette** | Indigo accents on dark backgrounds for modern, minimal aesthetic |

### Design Tokens

Available in `src/styles/globals.css`:

```css
:root {
  --primary: #6366f1;      /* Indigo accent */
  --background: #0f172a;   /* Deep gray */
  --surface: #1e293b;      /* Card surface */
  --text: #f1f5f9;         /* Primary text */
  --text-muted: #94a3b8;   /* Secondary text */
}
```

## 🏗️ How It Works

### Architecture Overview

**darkfloor.art** is built as a full-stack Next.js application with the following architecture:

1. **Frontend (Next.js App Router)**
   - Server-side rendering for initial page loads
   - Client-side React for interactive features
   - Global audio player context for state management
   - Real-time audio visualizations

2. **API Layer (tRPC)**
   - Type-safe API calls between client and server
   - Automatic request/response validation
   - Optimistic updates with React Query
   - Server-side data fetching

3. **Database (PostgreSQL + Drizzle ORM)**
   - Type-safe database queries
   - Automatic migrations
   - Connection pooling
   - SSL support for secure connections

4. **Authentication (NextAuth.js)**
   - Discord OAuth 2.0 integration
   - Secure session management
   - Protected API routes
   - User profile management

### Key Workflows

#### Music Playback Flow
1. User searches for tracks via tRPC `music.search`
2. Results displayed with track cards
3. User clicks play → track added to global player context
4. HTML5 Audio element handles playback
5. Audio data analyzed for visualizations
6. Playback state synced to database (if authenticated)
7. Listening history recorded

#### Playlist Management Flow
1. User creates playlist via tRPC `music.createPlaylist`
2. Playlist stored in database with user association
3. User adds tracks via `music.addToPlaylist`
4. Tracks can be reordered via drag-and-drop
5. Playlist state persisted in database
6. Playlists accessible via user profile pages

#### Smart Queue Flow
1. User enables auto-queue in preferences
2. When queue drops below threshold, system triggers recommendations
3. Recommendations fetched from Deezer API or audio features (if enabled)
4. Tracks filtered and shuffled for diversity
5. Recommendations cached for performance
6. Tracks automatically added to queue

#### Visualization Flow
1. Audio element provides audio data via Web Audio API
2. Frequency data extracted and normalized
3. Visualization patterns receive audio data as input
4. Canvas2D renders patterns in real-time (60fps target)
5. Patterns transition smoothly when changed
6. Audio-reactive effects respond to bass, mid, treble frequencies

### State Management

- **Global Player State**: React Context (`AudioPlayerContext`)
  - Current track, queue, playback state
  - Persisted to localStorage and database
  
- **Server State**: TanStack Query
  - Playlists, favorites, recommendations
  - Automatic caching and refetching
  
- **UI State**: React Context
  - Menu state, toast notifications
  - Panel visibility (queue, equalizer)

### Performance Optimizations

- **Code Splitting**: Automatic route-based splitting
- **Virtual Scrolling**: React Virtual for large track lists
- **Object Pooling**: Reused objects in visualizations
- **Recommendation Caching**: Cached API responses
- **Standalone Builds**: Optimized Next.js standalone output
- **Bundle Optimization**: Tree-shaking and optimized imports

## 🔌 API Architecture

### tRPC API

The application uses **tRPC** for end-to-end type-safe API communication. All API calls are type-safe from client to server.

#### Main API Routers

1. **musicRouter** - Music operations
   - `search` - Search tracks
   - `getRecommendations` - Get track recommendations
   - `getPlaylists` - Get user playlists
   - `createPlaylist` - Create new playlist
   - `addToPlaylist` - Add track to playlist
   - `removeFromPlaylist` - Remove track from playlist
   - `reorderPlaylistTracks` - Reorder playlist tracks
   - `getFavorites` - Get user favorites
   - `addFavorite` - Add track to favorites
   - `removeFavorite` - Remove track from favorites
   - `getListeningHistory` - Get playback history
   - `getSmartQueueRecommendations` - Get smart queue suggestions

2. **preferencesRouter** - User preferences
   - `get` - Get user preferences
   - `update` - Update user preferences
   - `updateEqualizer` - Update equalizer settings
   - `updateVisualizer` - Update visualizer preferences

3. **equalizerRouter** - Audio equalizer
   - `getBands` - Get current EQ bands
   - `updateBands` - Update EQ bands
   - `getPresets` - Get available presets

### External API Integration

The application integrates with multiple APIs for music search, streaming, and enhanced features:

#### Backend APIs

- **[Songbird API](https://songbird.darkfloor.art)** - Main music backend API
  - Music search and discovery
  - Track metadata and streaming
  - Enhanced recommendations
  
- **[Darkfloor API](https://api.darkfloor.art)** - Additional API services
  - Extended features and integrations
  - Additional music services

#### Deezer API

The application also integrates with the **Deezer API** for music search and streaming:

- **Search**: Uses Deezer search API via `NEXT_PUBLIC_API_URL`
- **Track Data**: Fetches track metadata, album art, and preview URLs
- **Recommendations**: Uses Deezer recommendations API
- **Streaming**: Uses Deezer preview URLs for audio playback

### Type-Safe API Usage

Example usage with tRPC:

```typescript
import { api } from "@/trpc/react";

function MyComponent() {
  // Type-safe query
  const { data: playlists } = api.music.getPlaylists.useQuery();
  
  // Type-safe mutation
  const addToPlaylist = api.music.addToPlaylist.useMutation({
    onSuccess: () => {
      // Automatically refetch playlists
      utils.music.getPlaylists.invalidate();
    },
  });
  
  const handleAdd = () => {
    addToPlaylist.mutate({
      playlistId: "123",
      track: { /* track data */ },
    });
  };
  
  return <div>{/* ... */}</div>;
}
```

### Database Schema

The application uses **PostgreSQL** with **Drizzle ORM** for data persistence:

**Key Tables:**
- `users` - User accounts and profiles
- `playlists` - User playlists
- `playlist_tracks` - Playlist-track relationships
- `favorites` - User favorite tracks
- `listening_history` - Playback history
- `user_preferences` - User settings and preferences
- `playback_state` - Current playback state
- `listening_analytics` - Analytics data
- `audio_features` - Audio analysis data (BPM, key, energy)
- `recommendation_cache` - Cached recommendations
- And more...

See `src/server/db/schema.ts` for the complete schema.

## 🖥️ Desktop Application (Electron)

The application can be built as a cross-platform desktop application using Electron.

### Building Desktop Apps

```bash
# Development mode (runs Next.js dev server + Electron)
npm run electron:dev

# Production build (all platforms)
npm run electron:build

# Platform-specific builds
npm run electron:build:win    # Windows (NSIS installer + portable)
npm run electron:build:mac    # macOS (DMG)
npm run electron:build:linux   # Linux (AppImage + DEB)
```

### Electron Features

- **Standalone Next.js Server**: Bundled Next.js server runs locally
- **Window Management**: Custom window state persistence
- **Code Signing**: Windows code signing support (see `electron/SIGNING.md`)
- **Auto-Updates**: Ready for auto-update integration
- **Native Menus**: Context menus and native OS integration
- **Storage**: Electron-specific storage initialization

### Electron Configuration

The Electron app uses:
- **Main Process**: `electron/main.cjs`
- **Preload Script**: `electron/preload.cjs`
- **Build Config**: Defined in `package.json` build section
- **Icons**: Platform-specific icons in `public/`

See `electron/README.md` for detailed Electron setup instructions.

## ⚖️ Legal & Licensing

### Important Notice

This project does **not** include or distribute copyrighted music. It is a frontend interface designed to work with legitimate, licensed music APIs.

**To deploy publicly, you must connect it to a legally compliant music service**, such as:

- **Deezer API** - Official music catalog with licensing
- **Spotify Web API** - Requires OAuth and subscription agreement
- **Apple Music API** - Licensed music streaming service
- **Your own licensed content** - Self-hosted audio with proper rights

**Do not use this with unauthorized music sources.**

### License

This project is licensed under the **GPL-3.0 License**. See the LICENSE file for details.

## 🛠️ Development

### Available Scripts

#### Development
```bash
# Development server with hot reload
npm run dev

# Development server (Windows)
npm run dev:win

# Next.js dev server only (port 3222)
npm run dev:next
```

#### Building
```bash
# Build for production
npm run build

# Build with bundle analyzer
npm run build:analyzer

# Preview production build
npm run preview
```

#### Database
```bash
# Generate migration files
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes (alternative to migrate)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

#### Type Checking & Linting
```bash
# Type checking
npm run typecheck

# ESLint check
npm run lint

# ESLint fix
npm run lint:fix

# Format check
npm run format:check

# Format write
npm run format:write

# Full check (lint + typecheck)
npm run check
```

#### Electron (Desktop App)
```bash
# Development mode
npm run electron:dev

# Development mode (Windows)
npm run electron:dev:win

# Production build
npm run electron:build

# Platform-specific builds
npm run electron:build:win
npm run electron:build:mac
npm run electron:build:linux
```

#### Production Deployment (PM2)
```bash
# Start production server
npm run pm2:start

# Start development server with PM2
npm run pm2:dev

# Reload with zero-downtime
npm run pm2:reload

# Restart server
npm run pm2:restart

# Stop server
npm run pm2:stop

# View logs
npm run pm2:logs
npm run pm2:logs:dev
npm run pm2:logs:error

# View status
npm run pm2:status

# Deploy (build + reload)
npm run deploy
```

#### Utilities
```bash
# Generate SSL certificates
npm run generate:ssl

# Clean build artifacts
npm run clean
npm run clean:win  # Windows
```

## 🚀 Production Deployment & Server Management

### PM2 Process Manager

This project uses **PM2** for production process management, providing automatic restarts, logging, and monitoring capabilities.

### Server Startup & Shutdown

#### Starting the Server

**Production Mode:**
```bash
# Build and start production server
npm run pm2:start

# Or manually:
npm run build
pm2 start ecosystem.config.cjs --env production
```

**Development Mode:**
```bash
# Start development server with PM2
npm run pm2:dev

# Or manually:
pm2 start ecosystem.config.cjs --only songbird-frontend-dev --env development
```

#### Stopping the Server

```bash
# Stop all processes
npm run pm2:stop

# Stop specific process
pm2 stop songbird-frontend-prod
pm2 stop songbird-frontend-dev

# Delete processes from PM2
npm run pm2:delete
```

#### Restarting the Server

```bash
# Reload with zero-downtime (graceful restart)
npm run pm2:reload

# Hard restart (kills and starts)
npm run pm2:restart

# Or manually:
pm2 reload ecosystem.config.cjs --env production --update-env
pm2 restart songbird-frontend-prod --update-env
```

### Server Startup Mechanism

The production server uses a **multi-layer startup process** to ensure reliability:

#### 1. **PM2 Pre-Start Hook**
Before starting the server, PM2 runs:
```bash
node scripts/ensure-build.js
```

This script:
- Checks if `.next/BUILD_ID` file exists
- Automatically runs `npm run build` if build is missing
- Prevents crash loops by ensuring build exists before startup
- Logs build process for debugging

#### 2. **Server Script Validation**
The `scripts/server.js` wrapper performs additional validation:
- Verifies `.next` directory exists
- Checks for `BUILD_ID` file (required by Next.js)
- Validates `.next/server` directory
- Exits immediately with clear error if build is invalid
- Prevents infinite restart loops

#### 3. **Next.js Production Server**
Once validation passes:
- Next.js starts in production mode (`next start`)
- Binds to configured port (uses PORT from .env, default: 3222)
- Health check endpoint becomes available at `/api/health`
- PM2 monitors the process and performs health checks

### Server Shutdown Mechanism

#### Graceful Shutdown
PM2 handles graceful shutdown through:
- **SIGTERM/SIGINT signals**: PM2 sends these to the process
- **Kill timeout**: 5 seconds grace period before force kill
- **Next.js cleanup**: Next.js handles cleanup automatically
- **Database pool closure**: Database connections are closed gracefully

#### Force Shutdown
If graceful shutdown fails:
```bash
pm2 delete songbird-frontend-prod  # Force remove
pm2 kill  # Kill PM2 daemon (use with caution)
```

### Monitoring & Logs

#### View Logs
```bash
# Production logs
npm run pm2:logs

# Development logs
npm run pm2:logs:dev

# Error logs only
npm run pm2:logs:error

# Real-time monitoring
npm run pm2:monit

# View last N lines
pm2 logs songbird-frontend-prod --lines 100
```

#### Check Status
```bash
# List all processes
npm run pm2:status

# Detailed process info
pm2 describe songbird-frontend-prod

# Process metrics
pm2 show songbird-frontend-prod
```

#### Log Files
Logs are stored in `logs/pm2/`:
- `error.log` - Error output only
- `out.log` - Standard output only
- `combined.log` - All logs combined
- `dev-*.log` - Development-specific logs

### Health Checks

The server includes a health check endpoint for monitoring:

```bash
# Check server health
curl http://localhost:3222/api/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2025-12-09T...",
  "uptime": 3600,
  "memory": {
    "heapUsed": 150,
    "heapTotal": 200,
    "rss": 300
  },
  "checks": {
    "database": "ok"
  },
  "responseTime": 5
}
```

PM2 is configured to:
- Check health endpoint every few seconds
- Restart process if health check fails
- Grace period of 5 seconds after startup before health checks begin

### Automatic Restart Behavior

PM2 automatically restarts the process when:
- Process crashes (exit code != 0)
- Memory exceeds 2GB (`max_memory_restart: "2G"`)
- Health check fails (if configured)
- Manual restart command issued

**Restart Limits:**
- Maximum 10 restarts within restart delay window
- Exponential backoff prevents crash loops
- Minimum uptime of 30 seconds before considered stable
- Restart delay of 5 seconds between attempts

### Build Management

#### Automatic Build Recovery
If the production build is missing:
1. PM2 pre-start hook detects missing BUILD_ID
2. Automatically runs `npm run build`
3. Server starts only if build succeeds
4. Process exits cleanly if build fails (no crash loop)

#### Manual Build
```bash
# Build for production
npm run build

# Verify build exists
test -f .next/BUILD_ID && echo "Build OK" || echo "Build missing"

# Build and deploy
npm run deploy
```

### Environment Configuration

The server loads environment variables in this order:
1. `.env` - Base configuration
2. `.env.production` or `.env.development` - Environment-specific
3. `.env.local` - Local overrides (never committed)

**Production Environment Variables:**
```bash
NODE_ENV=production
PORT=3222
HOSTNAME=localhost
```

**Development Environment Variables:**
```bash
NODE_ENV=development
PORT=3222  # Single port configuration - set in .env
HOSTNAME=0.0.0.0
```

### Troubleshooting Server Issues

#### Process Won't Start
1. Check if build exists: `test -f .next/BUILD_ID`
2. Build manually: `npm run build`
3. Check logs: `pm2 logs songbird-frontend-prod --err`
4. Verify port is available: `netstat -tlnp | grep 3222`

#### Process Keeps Restarting
1. Check error logs: `pm2 logs --err`
2. Verify build is complete: Check `.next/BUILD_ID` exists
3. Check memory usage: `pm2 monit`
4. Review restart count: `pm2 describe songbird-frontend-prod`

#### Health Check Failing
1. Test endpoint manually: `curl http://localhost:3222/api/health`
2. Check database connection in health endpoint
3. Verify server is actually running: `pm2 status`
4. Check for port conflicts

#### Build Issues
1. Clear build cache: `rm -rf .next`
2. Rebuild: `npm run build`
3. Check for TypeScript errors: `npm run typecheck`
4. Verify all dependencies: `npm install`

### TypeScript Configuration

The project enforces strict TypeScript settings:

- Full type checking enabled
- No implicit `any` types
- Required explicit null/undefined handling
- Strict property initialization

### Working with TailwindCSS v4

This project uses **TailwindCSS v4** with pure CSS Variables (no `@apply` directives):

```css
/* globals.css */
@import "tailwindcss";

:root {
  --primary: #6366f1;
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 rounded bg-[rgb(var(--primary))];
  }
}
```

## 🚨 Common Issues & Solutions

### Issue: "Missing required env var"

**Solution**: Ensure all required environment variables in `.env.local` are set and valid.

### Issue: NextAuth not working

**Solution**:

1. Generate secret: `npx auth secret`
2. Verify Discord OAuth app credentials
3. Check callback URL matches your domain

### Issue: Routing conflicts

**Solution**: Ensure `src/pages/` directory is removed if using App Router (`src/app/`).

### Issue: Database connection fails

**Solution**:

1. Verify DATABASE_URL format includes `?sslmode=require`
2. Check PostgreSQL is running and accessible
3. Confirm database exists and credentials are correct

### Issue: 502 Bad Gateway / Process crash loop

**Solution**:

1. **Check if build exists**: `test -f .next/BUILD_ID && echo "OK" || echo "Missing"`
2. **Build the application**: `npm run build`
3. **Check PM2 status**: `pm2 list` - look for processes with high restart count
4. **View error logs**: `pm2 logs darkfloor-art-prod --err`
5. **Restart with new config**: `pm2 reload ecosystem.config.cjs --env production --update-env`

**Root Cause**: Missing production build causes Next.js to crash immediately on startup, creating an infinite restart loop.

**Prevention**: The server now automatically builds if BUILD_ID is missing via PM2 pre-start hook.

### Issue: Process shows as "online" but not responding

**Solution**:

1. **Test health endpoint**: `curl http://localhost:3222/api/health`
2. **Check if port is listening**: `netstat -tlnp | grep 3222`
3. **Verify process is actually running**: `ps aux | grep "next start"`
4. **Check PM2 logs for startup errors**: `pm2 logs --lines 50`
5. **Restart the process**: `pm2 restart songbird-frontend-prod`

### Issue: Build fails during deployment

**Solution**:

1. **Check TypeScript errors**: `npm run typecheck`
2. **Clear build cache**: `rm -rf .next`
3. **Reinstall dependencies**: `rm -rf node_modules && npm install`
4. **Check disk space**: `df -h`
5. **Review build logs**: Check for specific error messages
6. **Build manually to see errors**: `npm run build`

## 📈 Future Roadmap

### Planned Enhancements

#### WebGL Visualization Migration (Major)
- **Status**: Planned (see `ROADMAP.md` for details)
- **Goal**: Migrate 80+ Canvas2D patterns to WebGL shaders
- **Benefits**: 
  - 60fps at 4K resolution
  - Reduced CPU usage (60% reduction)
  - Better mobile battery life
  - GPU-accelerated post-processing effects
- **Timeline**: 3-4 months estimated

#### Audio Features Integration
- **Essentia Microservice**: Integration for advanced audio analysis
- **BPM/Key Matching**: Smooth transitions based on audio features
- **Audio-Based Recommendations**: Enhanced recommendations using audio similarity
- **Feature Display**: Show BPM, key, energy in track details

#### Social Features
- **Playlist Sharing**: Enhanced sharing capabilities
- **Social Recommendations**: Recommendations from friends
- **Collaborative Playlists**: Multi-user playlist editing
- **Activity Feed**: Recent activity from followed users

#### Additional Features
- **Advanced Search Filters**: Filter by genre, artist, release date, BPM, key
- **Lyrics Integration**: Display synchronized lyrics
- **Offline Mode**: Cache downloaded tracks for offline playback
- **Light Theme**: Dark/light theme toggle (currently dark only)
- **Keyboard Shortcuts**: Global keyboard controls
- **Media Session API**: Better integration with OS media controls

## 📝 Configuration Examples

### Minimal Setup (Search Only)

For a basic search-only interface without user accounts:

```yaml
# Required
AUTH_SECRET="your-secret"  # Generate with: npx auth secret
# API URLs: https://songbird.darkfloor.art (main) or https://api.darkfloor.art
NEXT_PUBLIC_API_URL="https://songbird.darkfloor.art"
STREAMING_KEY="your-secure-stream-key"

# Database (minimal - for basic functionality)
DATABASE_URL="postgres://user:pass@localhost:5432/darkfloor?sslmode=require"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="darkfloor"
DB_ADMIN_USER="postgres"
DB_ADMIN_PASSWORD="password"
```

### Full Production Setup

Complete setup with all features enabled:

```yaml
# Authentication
AUTH_SECRET="your-secret"  # Generate with: npx auth secret
AUTH_DISCORD_ID="your-discord-app-id"
AUTH_DISCORD_SECRET="your-discord-app-secret"
NEXTAUTH_URL="https://darkfloor.art"  # Your production URL

# Database
DATABASE_URL="postgres://prod_user:prod_pass@prod-host:5432/darkfloor?sslmode=require"
DB_HOST="prod-host"
DB_PORT="5432"
DB_NAME="darkfloor"
DB_ADMIN_USER="prod_user"
DB_ADMIN_PASSWORD="prod_pass"
DB_SSL_CA=""  # Optional: Path to SSL CA certificate

# API Configuration
# Main music backend API: https://songbird.darkfloor.art
# Additional API services: https://api.darkfloor.art
NEXT_PUBLIC_API_URL="https://songbird.darkfloor.art"
STREAMING_KEY="your-secure-stream-key"
SONGBIRD_API_KEY=""  # Optional: For enhanced features
NEXT_PUBLIC_SONGBIRD_API_URL="https://api.darkfloor.art"  # Optional: For enhanced features

# Server
NODE_ENV="production"
PORT="3222"
```

### Development Setup

Development configuration with hot reload:

```yaml
# Authentication (can use test credentials)
AUTH_SECRET="dev-secret"
AUTH_DISCORD_ID="dev-discord-id"
AUTH_DISCORD_SECRET="dev-discord-secret"
NEXTAUTH_URL="http://localhost:3222"

# Database (local)
DATABASE_URL="postgres://postgres:password@localhost:5432/darkfloor_dev"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="darkfloor_dev"
DB_ADMIN_USER="postgres"
DB_ADMIN_PASSWORD="password"

# API
# Use production APIs or local development APIs
# Production: https://songbird.darkfloor.art and https://api.darkfloor.art
NEXT_PUBLIC_API_URL="https://songbird.darkfloor.art"
STREAMING_KEY="dev-key"

# Server
NODE_ENV="development"
PORT="3222"
```

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. All code is TypeScript with strict mode enabled
2. Components are properly typed with interfaces
3. Styling follows TailwindCSS v4 conventions
4. Environment variables are added to type validation

## 📜 Acknowledgments

Built with the **T3 Stack** - a modern, type-safe full-stack framework for Next.js applications.

---

## © 2025 soulwax @ GitHub

*All music data, streaming rights, and trademarks remain the property of their respective owners.*
