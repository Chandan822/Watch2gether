# Watch2Gether Architecture

This document provides a detailed overview of the system architecture, real-time communication patterns, database schema design, and folder organization of the Watch2Gether application.

---

## High-Level System Architecture

Watch2Gether uses a standard client-server architecture augmented with a real-time bi-directional event stream for synchronization.

```mermaid
graph TD
    Client[React Client] <-->|Socket.IO Events| Server[Node/Express Server]
    Client -->|REST API HTTP Request| Server
    Server <-->|SQL Queries| DB[(PostgreSQL Database)]
```

### Communication Channels

1. **REST API (HTTP):** Used for stateless, request-response operations.
   - Example: Fetching user details, creating room records, validating room availability.
   - Uses versioning (e.g., prefixing endpoints with `/api/v1/`).
2. **WebSockets (Socket.IO):** Used for low-latency, real-time sync.
   - Example: Synchronization of player states (play/pause/seek), real-time chat messages, and updates on room participants.
   - Communicates via named event payloads.

---

## Real-Time Synchronization Flow

When a user interacts with the video player (e.g., pausing or scrubbing), the event flows through the system to keep all other participants synchronized.

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Host)
    participant AC as Alice Client (Socket.IO Client)
    participant S as Express/Socket Server
    participant BC as Bob Client (Socket.IO Client)
    actor Bob as Bob (Viewer)

    Alice->>AC: Clicks Pause
    AC->>S: emit("video-state-change", { action: "pause", time: 124.5 })
    S->>S: Validate Alice's permissions in room
    S->>BC: broadcast.to(roomId).emit("video-state-change", { action: "pause", time: 124.5 })
    BC->>Bob: Pauses player & aligns time to 124.5s
```

### Key Socket Events

| Event Name | Sender | Payload Schema | Description |
| :--- | :--- | :--- | :--- |
| `join-room` | Client | `{ roomId, username }` | Instructs the server to subscribe the current connection to a room channel. |
| `video-state-change` | Client | `{ action: 'play'\|'pause'\|'seek', time: number }` | Sent by the controller when the player status changes. |
| `send-message` | Client | `{ content: string }` | Sends a chat message to the room. |
| `room-users-update` | Server | `[{ id, username }]` | Sent to all clients in a room when someone joins/leaves. |
| `message-received` | Server | `{ id, username, content, timestamp }` | Broadcasted to room members when a message is processed. |

---

## Database Schema (PostgreSQL + Drizzle ORM)

The relational schema is configured using **Drizzle ORM**. Drizzle maps Javascript schemas directly to SQL tables.

```mermaid
erDiagram
    rooms ||--o{ users : "has"
    rooms ||--o{ chat_messages : "contains"
    users ||--o{ chat_messages : "writes"

    rooms {
        uuid id PK
        varchar name
        varchar video_url
        varchar video_state
        float video_time
        timestamp created_at
    }

    users {
        uuid id PK
        varchar username
        uuid room_id FK
        timestamp joined_at
    }

    chat_messages {
        uuid id PK
        uuid room_id FK
        uuid user_id FK
        text content
        timestamp created_at
    }
```

---

## Folder Structure Decisions

### Backend Layout
We organize the backend by logical layers to support modular scaling:
* `src/config/`: Keeps variable parsing in one place. Ensures configuration errors throw on start, not hours later.
* `src/db/`: Keeps the database configuration and Drizzle schema code separated from business routes.
* `src/routes/v1/`: Organizes route structures by API resource version. Helps prevent legacy endpoints from breaking when new versions release.
* `src/middleware/`: Global checks like schema validation and error wrapping.
* `src/services/`: Reusable, stateful business utilities (e.g., room synchronization logic).

### Frontend Layout
We arrange the React app using standard layout groupings:
* `src/components/`: Reusable visual building blocks (Button, ChatInput, VideoPlayer).
* `src/context/`: Context engines that control state (Socket connection, User registration).
* `src/routes/`: Router paths and route authentication filters.
* `src/services/`: API requests and Socket event subscriptions.
* `src/hooks/`: Abstract UI-state triggers (e.g., custom listener hooks).
