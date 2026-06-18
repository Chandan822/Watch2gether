# Watch2Gether

Watch2Gether is a full-stack, real-time video watch party platform. It allows users to create virtual rooms, paste video URLs, and synchronize playback (play, pause, seek) in real-time while chatting with other room members.

---

## Features

### 1. Room Management & Privacy Levels
When setting up a Watch Lounge, creators can select a custom name, category, and access level:
* **Public Rooms**: Open lounges listed directly on the Lobby dashboard for anyone to browse and join.
* **Private Rooms**: Hidden lounges that do not appear on the dashboard. They require a direct invitation or knowing the exact Room ID to join.
* **Password-Protected Rooms**: Lounges secured by a password. Non-members are prompted for the password on entry before they can join.

### 2. Role-Based Permissions (RBAC)
Every room membership is assigned a room-specific role that dictates what actions they can perform:
* **Host (Owner)**: Absolute control. Can delete the room, promote/demote members to co-hosts/guests, kick users, invite others, control video sync, and participate in chat.
* **Co-host**: Collaborative moderator. Can invite others, control the synchronized video player state (play, pause, seek, set URL), and chat.
* **Member**: Standard viewer. Can participate in chat and watch the synchronized stream.
* **Guest**: Watch-only viewer. Cannot chat or interact with playback states.

### 3. Friend System & Online Status
Connect with other viewers on the platform through the tabbed Friends Panel:
* **Send Request**: Invite other users by typing their exact username. Prevents duplicate requests or self-inviting.
* **Request Management**: Receive alerts on incoming friend requests. Users can choose to **Accept** (establishing an active relationship) or **Decline** (removing the request).
* **Friends List & Removals**: View all active friends and remove them at any time.
* **Real-Time Online Indicators**: Sockets dynamically track logged-in users. When a friend goes online or offline, their status dot (green/gray indicator) toggles in real-time on your dashboard.

### 4. Room Invitations & System Notifications
Users can invite others directly from inside a room by username. Sending an invitation:
* Creates a secure, tracked invitation token in the database.
* Sends a persistent in-app system notification to the invitee.
* Broadcasts a real-time system message inside the room chat.

### 5. Secure Socket.IO Architecture & Reconnection
A unified WebSocket communication layout that manages state synchronization and status:
* **JWT-Authenticated Handshake**: Intercepts socket connection requests at the handshake stage. Sockets are verified using JWT access tokens, eliminating client identity spoofing.
* **Auto-Reconnection Restoral**: Handles network drops gracefully. The client registers reconnection listeners that automatically trigger user status updates globally and rejoin active room channels without user intervention.

### 6. Real-Time Chat & Emoji Reactions
A full-featured instant communication panel within each watch lounge:
* **Message History Persistence**: Messages are saved in PostgreSQL and reloaded chronologically when users enter the room.
* **Typing Indicators**: Displays active typing statuses of other room members in real-time.
* **Mentions**: Typing `@` triggers a floating member autocomplete popup. Messages mentioning a user are automatically highlighted with an amber border in their chat window.
* **Emoji Reactions**: Users can hover over chat messages to select and toggle popular emojis (👍, ❤️, 😂, 😮, 😢, 👏) in real-time, persisted in database storage.

---

## Technologies Used

### Frontend
- **React**: Modern component-based library for building UI.
- **Vite**: Ultra-fast next-generation frontend tool and bundler.
- **Tailwind CSS**: A utility-first CSS framework for custom responsive styling.
- **React Router**: Client-side routing library for structuring SPA page flows.
- **Socket.IO Client**: Connection utility to stream real-time events between browser and backend.

### Backend
- **Node.js**: Asynchronous event-driven JavaScript runtime environment.
- **Express.js**: Minimal and flexible Node.js web application framework.
- **Socket.IO Server**: Real-time websocket gateway to synchronize client player actions and status events.
- **PostgreSQL**: Robust, production-grade object-relational database.
- **Drizzle ORM**: Type-safe, high-performance object-relational mapper.
- **Zod**: Schema validation library.
- **Bcrypt**: Hashing library for securing user passwords and watch lounges.

---

## Folder Structure

```
watch2gether/
├── frontend/             # React client application (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── context/      # React contexts (AuthContext, SocketContext)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Main views (Lobby, Room)
│   │   ├── routes/       # React Router setup
│   │   └── services/     # Socket connection interface
│   ├── .env.example      # Sample client environment variables
│   ├── tailwind.config.js# Tailwind config
│   └── vite.config.js    # Vite configuration
├── backend/              # Node.js Express server
│   ├── src/
│   │   ├── config/       # Environment parsing & validation using Zod
│   │   ├── controllers/  # Route handler controllers
│   │   ├── db/           # PostgreSQL connection, schemas & migrations
│   │   ├── middleware/   # Request validators & global error handlers
│   │   ├── routes/       # API router structures (v1 versioning)
│   │   └── services/     # Socket event handling logic
│   ├── .env.example      # Sample server environment variables
│   └── drizzle.config.js # Database migration configurations
├── docs/                 # Extended system documentation
│   ├── architecture.md   # Architectural flows & event contracts
│   ├── authentication.md # JWT lifecycle, cookie flows & bcrypt setups
│   ├── database.md       # PostgreSQL ERD, normalization & index plans
│   ├── friends.md        # Friend requests, database schemas & online tracking
│   ├── rooms.md          # Room lookup types, normalizations, creation flows & permissions
│   ├── socketio.md       # Real-time WebSocket vs HTTP, Engine.IO layer, handshake validation & auto-reconnection
│   └── users.md          # User settings, profile authorization & upload architectures
└── package.json          # Root orchestration package
```

---

## Setup Steps

### Prerequisites
- Node.js (v18 or higher recommended)
- PostgreSQL database instance (local or Neon serverless)

### Quick Start

1. **Clone the project & install dependencies:**
   Install workspace root packages alongside frontend and backend dependencies:
   ```bash
   npm run install:all
   ```

2. **Configure Environment Variables:**
   - Copy `backend/.env.example` to `backend/.env` and fill in your database details (`DATABASE_URL`).
   - Copy `frontend/.env.example` to `frontend/.env` and update the backend URL if necessary.

3. **Database Migration:**
   - Run Drizzle schemas push command to apply changes:
     ```bash
     cd backend
     npm run db:push
     ```

4. **Launch Dev Servers:**
   From the project root directory, spin up both the Vite frontend and Express server concurrently:
   ```bash
   npm run dev
   ```

   - **Frontend:** http://localhost:5173
   - **Backend:** http://localhost:3000
   - **API Health Endpoint:** http://localhost:3000/api/v1/health
