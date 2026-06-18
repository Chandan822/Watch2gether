# WebRTC & Voice Chat Architecture

> **Learning Guide** for the voice chat feature built into Watch2Gether.  
> Covers WebRTC fundamentals, ICE, STUN/TURN, and how Socket.IO handles signaling.

---

## 1. What is WebRTC?

**WebRTC** (Web Real-Time Communication) is an open standard built into all modern browsers that enables **peer-to-peer (P2P) audio, video, and data streaming** without any plugins or server-side media processing.

### Key Properties

| Property | Description |
|---|---|
| **Peer-to-peer** | Media flows directly between browsers, not through a server |
| **Low latency** | Uses UDP internally (via SRTP), not HTTP |
| **Encrypted** | All media is encrypted with DTLS/SRTP by default |
| **Browser API** | Accessed via `RTCPeerConnection`, `getUserMedia`, and `RTCDataChannel` |

### Core Browser APIs Used in Watch2Gether

```js
// 1. Get microphone access
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Create a peer connection (manages the entire negotiation lifecycle)
const pc = new RTCPeerConnection({ iceServers: [...] });

// 3. Add local audio track to the connection
stream.getTracks().forEach(track => pc.addTrack(track, stream));

// 4. When a remote track arrives, play it
pc.ontrack = ({ streams }) => {
  audioElement.srcObject = streams[0];
};
```

---

## 2. The Signaling Problem

WebRTC handles media transport, but it has **no built-in way to find other peers or exchange connection metadata**. Before two browsers can connect, they must exchange two things:

1. **SDP (Session Description Protocol)** — describes the codec, resolution, direction of the connection
2. **ICE Candidates** — network paths (IP + port combinations) the browser can try to reach the other peer

This exchange requires a **signaling channel** — any out-of-band mechanism that both peers can use to talk to each other before the direct connection is set up.

### Watch2Gether Signaling via Socket.IO

```
Browser A                Socket.IO Server              Browser B
   │                           │                           │
   │── voice-join ────────────▶│                           │
   │                           │─── voice-user-joined ───▶│
   │                           │     { socketId of A }     │
   │                           │                           │
   │◀── voice-offer (SDP) ────│◀── voice-offer ──────────│
   │                           │     { to: A, offer }      │
   │── voice-answer ──────────▶│── voice-answer ──────────▶│
   │                           │                           │
   │◀── voice-ice-candidate ──│◀── voice-ice-candidate ──│
   │── voice-ice-candidate ──▶│── voice-ice-candidate ──▶│
   │                           │                           │
   │══════════ Peer-to-Peer Audio Stream (WebRTC) ════════│
```

> **Key principle:** The server is a **relay only** — it never inspects or processes the SDP or ICE candidates. It just forwards them between the right sockets.

---

## 3. Offer / Answer Negotiation (SDP)

WebRTC uses an **offer/answer model** to agree on codecs and media parameters.

### Who Creates the Offer?

In Watch2Gether, the **existing voice participants** initiate offers toward a **newcomer**:

1. User A is already in voice.
2. User B clicks "Join Voice" → server emits `voice-user-joined` to User A.
3. User A calls `createOffer()` and sends it to User B via `voice-offer` socket event.
4. User B calls `createAnswer()` and sends it back via `voice-answer`.
5. Both peers call `setLocalDescription` / `setRemoteDescription`.
6. ICE candidate exchange begins.

```js
// Offerer (existing peer A)
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit('voice-offer', { to: peerSocketId, offer });

// Answerer (new peer B)
await pc.setRemoteDescription(new RTCSessionDescription(offer));
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
socket.emit('voice-answer', { to: fromSocketId, answer });

// Back on A
await pc.setRemoteDescription(new RTCSessionDescription(answer));
```

---

## 4. ICE — Interactive Connectivity Establishment

**ICE** is the mechanism WebRTC uses to discover and negotiate network paths between two peers. The browser gathers a list of **ICE candidates** — each candidate is a potential (IP, port) pair the other peer can try to reach you through.

### Types of ICE Candidates

| Type | Description |
|---|---|
| **Host** | Direct LAN IP address — works only if both peers are on the same network |
| **Server Reflexive (srflx)** | Public IP discovered via STUN — works for most home/campus networks |
| **Relayed (relay)** | Traffic relayed through a TURN server — works even behind corporate firewalls |

### Candidate Exchange

```js
// When browser generates a candidate, forward it to the peer
pc.onicecandidate = ({ candidate }) => {
  if (candidate) {
    socket.emit('voice-ice-candidate', { to: peerSocketId, candidate });
  }
};

// When a candidate arrives from the peer, add it to the connection
socket.on('voice-ice-candidate', ({ from, candidate }) => {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
});
```

ICE tries all candidate pairs and uses the one with the lowest latency that actually works.

---

## 5. STUN and TURN Servers

### STUN (Session Traversal Utilities for NAT)

Most users are behind **NAT** (Network Address Translation) — their private IP (e.g., `192.168.1.x`) is not reachable from the internet. A STUN server lets a browser discover its **public IP and port** so it can include it as a server-reflexive ICE candidate.

```
Browser ──── "What's my public IP?" ───▶ STUN Server
              ◀─── "203.0.113.42:54321" ────
```

Watch2Gether uses **Google's free public STUN servers**:
```js
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]
```

**STUN is sufficient for ~85% of connections** (home routers, campus networks).

### TURN (Traversal Using Relays around NAT)

Some networks (strict corporate firewalls, symmetric NAT) block direct P2P connections even with STUN. In that case, a **TURN server** acts as a relay — all media passes through it.

```
Browser A ─── audio ──▶ TURN Server ─── audio ──▶ Browser B
```

> Watch2Gether currently uses STUN only. A TURN server can be added via the `iceServers` config if needed for enterprise deployments (e.g., Coturn, Twilio TURN).

---

## 6. Topology: Full Mesh

Watch2Gether uses a **full mesh** topology — every participant connects directly to every other participant.

```
User A ←──────────────→ User B
  │                       │
  └──────── User C ───────┘
```

- **Pros:** No server-side media processing, zero infrastructure cost, minimal latency
- **Cons:** Scales poorly. For N participants, each needs N−1 connections and encodes audio N−1 times
- **Practical limit:** Works well up to ~6 participants. For larger groups, an **SFU** (Selective Forwarding Unit, e.g., mediasoup, LiveKit) is the right solution

---

## 7. Speaking Detection

Watch2Gether uses the **Web Audio API** to detect who is speaking without any server involvement.

```js
const ctx = new AudioContext();
const source = ctx.createMediaStreamSource(stream); // local or remote stream
const analyser = ctx.createAnalyser();
analyser.fftSize = 256;
source.connect(analyser);

// Poll every 80ms
setInterval(() => {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const avg = data.reduce((s, v) => s + v, 0) / data.length;
  const isSpeaking = avg > 15; // threshold 0-255
}, 80);
```

The result drives the green animated ring around participant avatars in the UI.

---

## 8. Socket.IO Events Reference

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `voice-join` | _(none)_ | Enter voice channel for current room |
| `voice-leave` | _(none)_ | Leave voice channel |
| `voice-offer` | `{ to: socketId, offer: RTCSessionDescriptionInit }` | Send SDP offer to a specific peer |
| `voice-answer` | `{ to: socketId, answer: RTCSessionDescriptionInit }` | Send SDP answer to a specific peer |
| `voice-ice-candidate` | `{ to: socketId, candidate: RTCIceCandidateInit }` | Forward ICE candidate to a peer |

### Server → Client

| Event | Recipients | Payload | Purpose |
|---|---|---|---|
| `voice-participants-update` | Entire room | `[{ socketId, userId, username }]` | Sync participant list in UI |
| `voice-user-joined` | Existing voice peers | `{ userId, username, socketId }` | Trigger offer creation |
| `voice-user-left` | Remaining voice peers | `{ userId, socketId }` | Tear down peer connection |
| `voice-offer` | Target peer | `{ from: socketId, offer }` | Relayed SDP offer |
| `voice-answer` | Target peer | `{ from: socketId, answer }` | Relayed SDP answer |
| `voice-ice-candidate` | Target peer | `{ from: socketId, candidate }` | Relayed ICE candidate |

---

## 9. Security Notes

- **Authentication enforced:** Only users with a valid JWT can connect to the Socket.IO namespace (enforced in the auth middleware). Voice events are tied to the same authenticated socket session.
- **Media encrypted:** WebRTC mandates DTLS/SRTP — audio is always end-to-end encrypted in transit.
- **Server never touches audio:** The signaling server only sees SDP strings and ICE candidate objects; it never processes or records any audio.
