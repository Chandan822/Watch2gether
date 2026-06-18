import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { useAuth } from '../context/AuthContext.jsx';
import { socket } from '../services/socket.js';
import {
  Send,
  Users,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  LogOut,
  Trash2,
  UserMinus,
  UserPlus,
  Lock,
  Crown,
  Shield,
  BarChart2,
  Plus,
  X,
  HelpCircle,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  Sparkles,
  Video
} from 'lucide-react';

import Whiteboard from '../components/Whiteboard.jsx';
import AiPanel from '../components/AiPanel.jsx';
import StudyWorkspace from '../components/StudyWorkspace.jsx';


export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, accessToken, fetchWithAuth } = useAuth();
  const username = user?.username;

  
  const [roomData, setRoomData] = useState(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoProcessingStatus, setVideoProcessingStatus] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [queue, setQueue] = useState([]);
  const [queueInput, setQueueInput] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); 
  const [leftView, setLeftView] = useState('video'); 
  const [polls, setPolls] = useState([]);
  const [aiState, setAiState] = useState(null);
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollType, setNewPollType] = useState('custom'); 
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState('');

  
  const [activeTypers, setActiveTypers] = useState({});
  const [showMentions, setShowMentions] = useState(false);
  const [mentionsQuery, setMentionsQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const chatInputRef = useRef(null);
  const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '👏'];

  
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [joining, setJoining] = useState(false);

  
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);

  
  const playerRef = useRef(null);
  const isIncomingSync = useRef(false); 
  const chatEndRef = useRef(null);

  
  const [voiceParticipants, setVoiceParticipants] = useState([]); 
  const [isInVoice, setIsInVoice] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState(new Set()); 
  const [micError, setMicError] = useState('');

  
  const localStreamRef = useRef(null);                
  const peerConnectionsRef = useRef({});              
  const audioContextRef = useRef(null);               
  const analyserNodesRef = useRef({});                
  const speakingIntervalRef = useRef(null);           
  const localAnalyserRef = useRef(null);              
  

  
  const getCurrentTime = () => {
    const el = playerRef.current;
    if (!el) return 0;
    return el.currentTime || 0;
  };

  
  const seekTo = (time) => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = time;
  };

  
  const fetchRoom = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}`);
      const data = await res.json();

      if (res.status === 403 && data.code === 'PASSWORD_REQUIRED') {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Room not found');
      }

      setRoomData(data.data);
      setVideoUrlInput(data.data.videoUrl || '');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not load room. Check your connection or login again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoom();
  }, [roomId]);

  const fetchMessages = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/messages`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    if (roomData) {
      fetchMessages();
    }
  }, [roomData?.id]);

  
  const roomDataRef = useRef(roomData);
  useEffect(() => {
    roomDataRef.current = roomData;
  }, [roomData]);

  const hasRoomData = !!roomData;

  
  useEffect(() => {
    if (!username || !hasRoomData) return;

    const handleConnect = () => {
      socket.emit('join-room', { roomId, username });
      console.log(`🔌 Joined room: ${roomId}`);
    };

    socket.on('connect', handleConnect);
    socket.connect();

    if (socket.connected) {
      handleConnect();
    }

    
    socket.on('room-users-update', (users) => {
      setUsersList(users);
    });

    socket.on('queue-update', (updatedQueue) => {
      setQueue(updatedQueue);
    });

    socket.on('polls-update', (updatedPolls) => {
      setPolls(updatedPolls);
    });

    socket.on('ai-init', (state) => {
      setAiState(state);
    });

    socket.on('ai-update', (state) => {
      setAiState(state);
    });

    socket.on('message-received', (message) => {
      setMessages((prev) => [...prev, { ...message, reactions: message.reactions || [] }]);
    });

    socket.on('message-deleted', ({ messageId }) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    socket.on('user-typing-status', ({ userId, username: typerName, isTyping }) => {
      setActiveTypers((prev) => {
        const updated = { ...prev };
        if (isTyping) {
          updated[userId] = typerName;
        } else {
          delete updated[userId];
        }
        return updated;
      });
    });

    socket.on('reaction-updated', ({ messageId, emoji, userId, username: reactorName, action }) => {
      setMessages((prevMessages) => {
        return prevMessages.map((msg) => {
          if (msg.id !== messageId) return msg;

          let updatedReactions = [...(msg.reactions || [])];
          if (action === 'added') {
            if (!updatedReactions.some((r) => r.userId === userId && r.emoji === emoji)) {
              updatedReactions.push({ userId, username: reactorName, emoji });
            }
          } else if (action === 'removed') {
            updatedReactions = updatedReactions.filter(
              (r) => !(r.userId === userId && r.emoji === emoji)
            );
          }
          return { ...msg, reactions: updatedReactions };
        });
      });
    });

    socket.on('user-role-changed', ({ userId: changedUserId, role }) => {
      if (user && changedUserId === user.id) {
        setRoomData((prev) => prev ? { ...prev, currentUserRole: role } : null);
      }
    });

    socket.on('user-kicked', ({ userId: kickedUserId }) => {
      if (user && kickedUserId === user.id) {
        alert('You have been kicked from this watch room by the Host.');
        navigate('/');
      }
    });

    socket.on('room-deleted', ({ message }) => {
      alert(message || 'This watch room has been deleted by the Host.');
      navigate('/');
    });

    socket.on('video-state-change', ({ action, time, videoUrl }) => {
      isIncomingSync.current = true;

      
      const currentRoomData = roomDataRef.current;
      if (videoUrl !== undefined && currentRoomData?.videoUrl !== videoUrl) {
        setRoomData((prev) => (prev ? { ...prev, videoUrl } : null));
        setVideoUrlInput(videoUrl);
      }

      
      const currentVideoTime = getCurrentTime();
      if (Math.abs(currentVideoTime - time) > 1.5) {
        seekTo(time);
      }

      
      if (action === 'play') {
        setIsPlaying(true);
      } else if (action === 'pause') {
        setIsPlaying(false);
      }

      setTimeout(() => {
        isIncomingSync.current = false;
      }, 200);
    });

    socket.on('video-processing', (status) => {
      setVideoProcessingStatus(status);
      if (status.status === 'completed' || status.status === 'failed') {
        setTimeout(() => {
          setVideoProcessingStatus(null);
        }, 5000);
      }
    });

    
    socket.on('voice-participants-update', (participants) => {
      setVoiceParticipants(participants);
    });

    
    
    socket.on('voice-user-joined', ({ userId: newUserId, username: newUsername, socketId: newSocketId }) => {
      
      initiatePeerOfferRef.current(newSocketId);
    });

    socket.on('voice-user-left', ({ socketId: leftSocketId }) => {
      closePeerConnectionRef.current(leftSocketId);
    });

    socket.on('voice-offer', ({ from, offer }) => {
      handleVoiceOfferRef.current(from, offer);
    });

    socket.on('voice-answer', ({ from, answer }) => {
      handleVoiceAnswerRef.current(from, answer);
    });

    socket.on('voice-ice-candidate', ({ from, candidate }) => {
      handleIceCandidateRef.current(from, candidate);
    });
    

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room-users-update');
      socket.off('queue-update');
      socket.off('polls-update');
      socket.off('ai-init');
      socket.off('ai-update');
      socket.off('message-received');
      socket.off('message-deleted');
      socket.off('user-typing-status');
      socket.off('reaction-updated');
      socket.off('user-role-changed');
      socket.off('user-kicked');
      socket.off('room-deleted');
      socket.off('video-state-change');
      socket.off('voice-participants-update');
      socket.off('voice-user-joined');
      socket.off('voice-user-left');
      socket.off('voice-offer');
      socket.off('voice-answer');
      socket.off('voice-ice-candidate');
      socket.off('video-processing');
      socket.emit('leave-room');
    };
  }, [username, roomId, hasRoomData]);

  
  
  

  const STUN_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  
  const startSpeakingDetection = () => {
    if (speakingIntervalRef.current) return;
    speakingIntervalRef.current = setInterval(() => {
      const speaking = new Set();
      const threshold = 15; 

      const getAvgVolume = (analyser) => {
        if (!analyser) return 0;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        return data.reduce((sum, v) => sum + v, 0) / data.length;
      };

      
      if (localAnalyserRef.current && !isMuted) {
        if (getAvgVolume(localAnalyserRef.current) > threshold) {
          speaking.add('local');
        }
      }

      
      Object.entries(analyserNodesRef.current).forEach(([socketId, analyser]) => {
        if (getAvgVolume(analyser) > threshold) {
          speaking.add(socketId);
        }
      });

      setSpeakingUsers(new Set(speaking));
    }, 80);
  };

  const stopSpeakingDetection = () => {
    if (speakingIntervalRef.current) {
      clearInterval(speakingIntervalRef.current);
      speakingIntervalRef.current = null;
    }
    setSpeakingUsers(new Set());
  };

  
  const createPeerConnection = (peerSocketId) => {
    if (peerConnectionsRef.current[peerSocketId]) {
      return peerConnectionsRef.current[peerSocketId];
    }

    const pc = new RTCPeerConnection(STUN_CONFIG);

    
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('voice-ice-candidate', { to: peerSocketId, candidate });
      }
    };

    
    pc.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (!stream) return;

      
      let audioEl = document.getElementById(`voice-audio-${peerSocketId}`);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = `voice-audio-${peerSocketId}`;
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = stream;

      
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserNodesRef.current[peerSocketId] = analyser;
      } catch (e) {
        console.warn('AudioContext for speaking detection failed:', e);
      }
    };

    peerConnectionsRef.current[peerSocketId] = pc;
    return pc;
  };

  
  const closePeerConnection = (peerSocketId) => {
    const pc = peerConnectionsRef.current[peerSocketId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[peerSocketId];
    }
    
    const audioEl = document.getElementById(`voice-audio-${peerSocketId}`);
    if (audioEl) audioEl.remove();
    
    delete analyserNodesRef.current[peerSocketId];
  };

  
  const initiatePeerOffer = async (peerSocketId) => {
    try {
      const pc = createPeerConnection(peerSocketId);

      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('voice-offer', { to: peerSocketId, offer });
    } catch (e) {
      console.error('Error creating offer:', e);
    }
  };

  
  const handleVoiceOffer = async (fromSocketId, offer) => {
    try {
      const pc = createPeerConnection(fromSocketId);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice-answer', { to: fromSocketId, answer });
    } catch (e) {
      console.error('Error handling offer:', e);
    }
  };

  
  const handleVoiceAnswer = async (fromSocketId, answer) => {
    try {
      const pc = peerConnectionsRef.current[fromSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (e) {
      console.error('Error handling answer:', e);
    }
  };

  
  const handleIceCandidate = async (fromSocketId, candidate) => {
    try {
      const pc = peerConnectionsRef.current[fromSocketId];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (e) {
      console.error('Error adding ICE candidate:', e);
    }
  };

  
  const initiatePeerOfferRef = useRef(initiatePeerOffer);
  const closePeerConnectionRef = useRef(closePeerConnection);
  const handleVoiceOfferRef = useRef(handleVoiceOffer);
  const handleVoiceAnswerRef = useRef(handleVoiceAnswer);
  const handleIceCandidateRef = useRef(handleIceCandidate);

  useEffect(() => {
    initiatePeerOfferRef.current = initiatePeerOffer;
    closePeerConnectionRef.current = closePeerConnection;
    handleVoiceOfferRef.current = handleVoiceOffer;
    handleVoiceAnswerRef.current = handleVoiceAnswer;
    handleIceCandidateRef.current = handleIceCandidate;
  });

  
  const joinVoice = async () => {
    setMicError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        localAnalyserRef.current = analyser;
      } catch (e) {
        console.warn('Local speaking detection setup failed:', e);
      }

      setIsInVoice(true);
      setIsMuted(false);
      startSpeakingDetection();
      socket.emit('voice-join');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setMicError('Microphone access denied. Please allow mic permissions and try again.');
      } else {
        setMicError('Could not access microphone. Please check your device settings.');
      }
      console.error('getUserMedia error:', err);
    }
  };

  
  const leaveVoice = () => {
    
    Object.keys(peerConnectionsRef.current).forEach(closePeerConnection);
    peerConnectionsRef.current = {};
    analyserNodesRef.current = {};
    localAnalyserRef.current = null;

    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    stopSpeakingDetection();
    setIsInVoice(false);
    setIsMuted(false);
    socket.emit('voice-leave');
  };

  
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  
  useEffect(() => {
    return () => {
      if (isInVoice) leaveVoice();
    };
    
  }, []);

  
  
  

  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  
  const userRole = roomData?.currentUserRole || 'member';
  const isHost = userRole === 'host';
  const isHostOrCoHost = userRole === 'host' || userRole === 'co-host';
  const isWhiteboardEnabled = roomData && ['study_group', 'coding_session', 'community_event'].includes(roomData.roomTypeCode);

  
  useEffect(() => {
    if (!isHostOrCoHost || !isPlaying) return;

    const intervalId = setInterval(() => {
      const currentTime = getCurrentTime();
      console.log(`📡 Sending periodic host heartbeat sync: ${currentTime}s`);
      socket.emit('video-state-change', {
        action: 'play',
        time: currentTime,
        videoUrl: roomData?.videoUrl,
      });
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isHostOrCoHost, isPlaying, roomData?.videoUrl]);

  const autocompleteList = usersList.filter((u) => {
    if (u.username === username) return false;
    if (!mentionsQuery) return true;
    return u.username.toLowerCase().includes(mentionsQuery.toLowerCase());
  });

  const fileInputRef = useRef(null);

  const handleUploadVideoClick = () => {
    fileInputRef.current?.click();
  };

  const handleVideoFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.3gp'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      alert('Only video files (MP4, WEBM, OGG, MOV, MKV, AVI, 3GP) are supported.');
      return;
    }

    if (file.size > 1024 * 1024 * 1024) {
      alert('Video file size exceeds the 1GB limit.');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);

    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    setVideoProcessingStatus({ status: 'started', message: 'Uploading video file to server...' });

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiUrl}/rooms/${roomId}/video`);
        
        if (accessToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setVideoUploadProgress(pct);
            setVideoProcessingStatus({ status: 'started', message: `Uploading video to server (${pct}%)` });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            const response = xhr.responseText ? JSON.parse(xhr.responseText) : {};
            reject(new Error(response.message || 'File upload failed'));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during file upload'));
        };

        xhr.send(formData);
      });

      setVideoUploadProgress(100);
      setVideoProcessingStatus({ status: 'segmenting', message: 'Video uploaded! Initializing HLS processing on server...' });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error uploading video.');
      setVideoProcessingStatus(null);
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const handleDeleteUploadedVideo = async () => {
    if (!confirm('Are you sure you want to permanently delete the uploaded video files? This will clear the active video.')) return;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/video`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete video files');
      }

      alert('Uploaded video deleted successfully.');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error deleting video.');
    }
  };

  
  const handlePlay = () => {
    if (!isHostOrCoHost || isIncomingSync.current) return;

    setIsPlaying(true);
    setVideoError('');
    socket.emit('video-state-change', {
      action: 'play',
      time: getCurrentTime(),
      videoUrl: roomData?.videoUrl,
    });
  };

  const handlePause = () => {
    if (!isHostOrCoHost || isIncomingSync.current) return;

    setIsPlaying(false);
    socket.emit('video-state-change', {
      action: 'pause',
      time: getCurrentTime(),
      videoUrl: roomData?.videoUrl,
    });
  };

  const handleSeeked = () => {
    if (!isHostOrCoHost || isIncomingSync.current) return;

    socket.emit('video-state-change', {
      action: 'seek',
      time: getCurrentTime(),
      videoUrl: roomData?.videoUrl,
    });
  };

  const handleError = (e) => {
    console.error('ReactPlayer error:', e);
    setVideoError('Video failed to load. Please check the URL and try again.');
  };

  
  const handleUpdateVideoUrl = (e) => {
    e.preventDefault();
    if (!isHostOrCoHost || !videoUrlInput.trim()) return;

    setVideoError('');
    setRoomData((prev) => (prev ? { ...prev, videoUrl: videoUrlInput.trim() } : null));
    setIsPlaying(false);

    socket.emit('video-state-change', {
      action: 'pause',
      time: 0,
      videoUrl: videoUrlInput.trim(),
    });
  };

  
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    socket.emit('send-message', { content: chatInput.trim() });
    setChatInput('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socket.emit('typing-status', { isTyping: false });
  };

  const handleChatInputChange = (e) => {
    const val = e.target.value;
    setChatInput(val);
    handleMentionsAutocomplete(val);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing-status', { isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing-status', { isTyping: false });
    }, 2000);
  };

  const handleMentionsAutocomplete = (text) => {
    const selectionStart = chatInputRef.current?.selectionStart || text.length;
    const textBeforeCaret = text.slice(0, selectionStart);
    const lastAtIdx = textBeforeCaret.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCaret[lastAtIdx - 1] : ' ';
      const wordAfterAt = textBeforeCaret.slice(lastAtIdx + 1);

      
      if (/\s/.test(wordAfterAt) || !/^\w*$/.test(wordAfterAt) || !/\s/.test(charBeforeAt)) {
        setShowMentions(false);
        setMentionStartIndex(-1);
        setMentionsQuery('');
      } else {
        setShowMentions(true);
        setMentionStartIndex(lastAtIdx);
        setMentionsQuery(wordAfterAt);
      }
    } else {
      setShowMentions(false);
      setMentionStartIndex(-1);
      setMentionsQuery('');
    }
  };

  const selectMention = (selectedUsername) => {
    if (mentionStartIndex === -1) return;
    const before = chatInput.slice(0, mentionStartIndex);
    const after = chatInput.slice(chatInputRef.current?.selectionStart || chatInput.length);
    const updatedInput = `${before}@${selectedUsername} ${after}`;
    setChatInput(updatedInput);
    setShowMentions(false);
    setMentionStartIndex(-1);
    setMentionsQuery('');
    chatInputRef.current?.focus();
  };

  const handleToggleReaction = (messageId, emoji) => {
    socket.emit('toggle-reaction', { messageId, emoji });
  };

  const handleDeleteMessage = (messageId) => {
    socket.emit('delete-message', { messageId });
  };

  const renderMessageContent = (content) => {
    const parts = content.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('@') && part.length > 1) {
        const potentialUser = part.slice(1);
        const cleanUser = potentialUser.replace(/[^\w]/g, '');
        const suffix = potentialUser.slice(cleanUser.length);

        const isUserMentioned = cleanUser === username || usersList.some((u) => u.username === cleanUser);
        if (isUserMentioned) {
          const isUs = cleanUser === username;
          return (
            <span
              key={index}
              className={`px-1 rounded font-bold text-[10px] select-none ${isUs
                  ? 'bg-amber-500/25 text-amber-600 dark:text-amber-300 border border-amber-500/35 shadow-sm shadow-amber-500/10'
                  : 'bg-indigo-100 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/30'
                }`}
            >
              @{cleanUser}
              {suffix}
            </span>
          );
        }
      }
      return part;
    });
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  
  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    setInviting(true);
    setInviteSuccess('');
    setInviteError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inviteUsername.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send invite');
      }

      setInviteSuccess(`Invitation sent to ${inviteUsername}!`);
      setInviteUsername('');
      setTimeout(() => setInviteSuccess(''), 4500);
    } catch (err) {
      setInviteError(err.message || 'Error inviting user.');
      setTimeout(() => setInviteError(''), 4500);
    } finally {
      setInviting(false);
    }
  };

  
  const handleUpdateRole = async (targetUserId, newRole) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/members/${targetUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update role');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error updating member role');
    }
  };

  const handleKickMember = async (targetUserId) => {
    if (!confirm('Are you sure you want to kick this user from the room?')) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to kick member');
      }
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error kicking member');
    }
  };

  
  const handleAddToQueue = (e) => {
    e.preventDefault();
    if (!queueInput.trim()) return;
    socket.emit('add-to-queue', { videoUrl: queueInput.trim() });
    setQueueInput('');
  };

  const handleRemoveFromQueue = (queueItemId) => {
    socket.emit('remove-from-queue', { queueItemId });
  };

  const handleSkipVideo = () => {
    socket.emit('skip-video');
  };

  
  const handleCreatePoll = (e) => {
    e.preventDefault();
    if (!newPollQuestion.trim()) return;

    
    const options = newPollOptions.map(opt => opt.trim()).filter(Boolean);
    if (options.length < 2) {
      alert('A poll must have at least 2 non-empty options.');
      return;
    }

    socket.emit('create-poll', {
      question: newPollQuestion.trim(),
      type: newPollType,
      options
    });

    
    setNewPollQuestion('');
    setNewPollType('custom');
    setNewPollOptions(['', '']);
    setIsCreatingPoll(false);
  };

  const handleVotePoll = (pollId, optionId) => {
    socket.emit('vote-poll', { pollId, optionId });
  };

  const handleClosePoll = (pollId) => {
    socket.emit('close-poll', { pollId });
  };

  const handleDeletePoll = (pollId) => {
    if (confirm('Are you sure you want to delete this poll?')) {
      socket.emit('delete-poll', { pollId });
    }
  };

  
  const handleAddPollOptionField = () => {
    setNewPollOptions(prev => [...prev, '']);
  };

  const handleRemovePollOptionField = (idx) => {
    if (newPollOptions.length <= 2) return;
    setNewPollOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePollOptionChange = (idx, val) => {
    setNewPollOptions(prev => {
      const updated = [...prev];
      updated[idx] = val;
      return updated;
    });
  };

  
  useEffect(() => {
    if (newPollType === 'satisfaction_feedback') {
      setNewPollQuestion('How are you enjoying the watch party?');
      setNewPollOptions(['Love it! 😍', "It's okay 😐", 'Boring 🥱']);
    } else if (newPollType === 'audio_quality') {
      setNewPollQuestion('How is the stream audio quality?');
      setNewPollOptions(['Perfect 👍', 'Too loud 🔊', 'Too quiet 🔉', 'Static/Laggy 🔇']);
    } else if (newPollType === 'content_selection') {
      setNewPollQuestion('What should we watch next?');
      setNewPollOptions(['', '']);
    } else if (newPollType === 'custom') {
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
    }
  }, [newPollType]);

  
  const handleDeleteRoom = async () => {
    if (!confirm('WARNING: Are you sure you want to permanently delete this room? This action cannot be undone.')) return;
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete room');
      }
      navigate('/');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error deleting room');
    }
  };

  
  const handleJoinWithPassword = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setJoining(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Incorrect room password');
      }

      setPasswordRequired(false);
      setLoading(true);
      fetchRoom();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to join room.');
    } finally {
      setJoining(false);
    }
  };

  
  const getFullVideoUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const backendBaseUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    return `${backendBaseUrl}${url}`;
  };

  const videoSrc = getFullVideoUrl(roomData?.videoUrl);

  
  useEffect(() => {
    setVideoError('');
  }, [videoSrc]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium">Entering watch lounge...</p>
      </div>
    );
  }

  
  if (passwordRequired) {
    return (
      <div className="max-w-md mx-auto my-16 bg-white dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-3xl p-8 shadow-2xl backdrop-blur-sm space-y-6 animate-fade-in">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="p-3.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-full border border-amber-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">Password Protected Lounge</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">This watch room is private and requires a password to enter.</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleJoinWithPassword} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold block px-1">
              Room Password
            </label>
            <input
              type="password"
              placeholder="Enter password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-all text-sm font-medium"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-xl py-2.5 text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={joining}
              className="flex-1 bg-indigo-650 hover:bg-indigo-500 text-white font-semibold rounded-xl py-2.5 text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {joining ? 'Verifying...' : 'Join Party'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold font-display text-rose-400">Connection Fail</h1>
        <p className="text-slate-400 text-sm">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium cursor-pointer"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  const onlineCount = usersList.filter((u) => u.isOnline).length;

  const sortedUsersList = [...usersList].sort((a, b) => {
    
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;

    
    const roleOrder = { host: 0, 'co-host': 1, member: 2, guest: 3 };
    const roleA = roleOrder[a.role] !== undefined ? roleOrder[a.role] : 4;
    const roleB = roleOrder[b.role] !== undefined ? roleOrder[b.role] : 4;
    if (roleA !== roleB) return roleA - roleB;

    
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 rounded-3xl backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">{roomData?.name}</h1>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-900 rounded text-[9px] font-bold uppercase ml-2 tracking-wider">
              {roomData?.visibility.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono">ID: {roomId}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={copyRoomId}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Copied Code</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Invite Friends</span>
              </>
            )}
          </button>

          {isHost && (
            <button
              onClick={handleDeleteRoom}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/35 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-white text-xs font-semibold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Lounge</span>
            </button>
          )}

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Room</span>
          </button>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {}
        <div className="lg:col-span-2 space-y-4">

          {}
          {isWhiteboardEnabled && (
            <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 p-1 rounded-2xl gap-2 w-fit animate-fade-in">
              <button
                type="button"
                onClick={() => setLeftView('video')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${leftView === 'video'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900/40'
                  }`}
              >
                Video Stream
              </button>
              <button
                type="button"
                onClick={() => setLeftView('whiteboard')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${leftView === 'whiteboard'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900/40'
                  }`}
              >
                Collaborative Whiteboard
              </button>
              <button
                type="button"
                onClick={() => setLeftView('study')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${leftView === 'study'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900/40'
                  }`}
              >
                Study Workspace
              </button>
            </div>
          )}

          {leftView === 'video' && (
            <>
              {}
              <div
                className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-slate-900 shadow-2xl flex items-center justify-center w-full"
                style={!isHostOrCoHost ? { pointerEvents: 'none' } : {}}
              >
                {!videoSrc ? (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4 text-center z-10 select-none">
                    <div className="p-4 bg-slate-900/60 text-slate-500 rounded-full border border-slate-800/80 mb-2">
                      <Video className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-md font-bold text-slate-200 font-display">No Video Active</h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      Lounge is ready. Paste a video URL or upload a local file to start streaming!
                    </p>
                  </div>
                ) : (
                  <ReactPlayer
                    key={videoSrc}
                    ref={playerRef}
                    src={videoSrc}
                    playing={isPlaying}
                    controls={isHostOrCoHost}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={handleSeeked}
                    onError={handleError}
                    width="100%"
                    height="100%"
                    style={{ position: 'absolute', top: 0, left: 0 }}
                    config={{
                      file: {
                        forceHLS: videoSrc.includes('.m3u8') || videoSrc.includes('/hls-'),
                      }
                    }}
                  />
                )}

                {}
                {videoProcessingStatus && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-4 text-center z-25 animate-fade-in">
                    {videoProcessingStatus.status === 'failed' ? (
                      <div className="p-3 bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-full border border-rose-500/20 mb-2">
                        <X className="w-8 h-8" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    )}
                    
                    <h3 className="text-md font-bold text-white font-display">
                      {videoProcessingStatus.status === 'failed' ? 'Processing Failed' : 'Processing Local Video'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm">
                      {videoProcessingStatus.message}
                    </p>

                    {}
                    {videoProcessingStatus.status === 'started' && videoUploadProgress > 0 && (
                      <div className="w-48 bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-700">
                        <div 
                          className="bg-indigo-550 h-1.5 rounded-full transition-all duration-300" 
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {}
              {videoError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-between animate-shake">
                  <span className="flex-1 text-center">{videoError}</span>
                  <button 
                    type="button" 
                    onClick={() => setVideoError('')} 
                    className="text-rose-400 hover:text-rose-650 dark:hover:text-rose-350 p-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {}
              {isHostOrCoHost ? (
                <form
                  onSubmit={handleUpdateVideoUrl}
                  className="flex gap-2 p-3 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 rounded-2xl animate-fade-in"
                >
                  <input
                    type="text"
                    placeholder="Paste YouTube, MP4, or video source URL..."
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleUploadVideoClick}
                    disabled={isUploadingVideo || !!videoProcessingStatus}
                    className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Upload Video</span>
                  </button>
                  {roomData?.videoUrl?.includes('/hls-') && (
                    <button
                      type="button"
                      onClick={handleDeleteUploadedVideo}
                      className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/35 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Video</span>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleVideoFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Sync Video
                  </button>
                </form>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/10 border border-slate-200 dark:border-slate-900 rounded-2xl text-center text-xs text-slate-500 italic">
                  Video state is controlled in real-time by the lounge Host or Co-hosts.
                </div>
              )}
            </>
          )}

          {leftView === 'whiteboard' && (
            <div className="animate-fade-in">
              <Whiteboard roomId={roomId} socket={socket} userRole={userRole} />
            </div>
          )}

          {leftView === 'study' && (
            <div className="animate-fade-in">
              <StudyWorkspace roomId={roomId} socket={socket} userRole={userRole} onClose={() => setLeftView('video')} />
            </div>
          )}
        </div>

        {}
        <div className="grid grid-rows-[auto_1fr] h-[640px] bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 rounded-3xl overflow-hidden shadow-xl">

          {}
          <div className="p-4 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-white">Party Attendees ({onlineCount} online / {usersList.length} total)</h2>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 px-2 py-0.5 rounded capitalize">
                Role: {userRole}
              </span>
            </div>

            {}
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
              {sortedUsersList.map((userMember) => {
                const isUs = user && userMember.username === username;

                return (
                  <div
                    key={userMember.id}
                    className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900/60 rounded-xl"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {}
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${userMember.isOnline
                            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                            : 'bg-slate-650'
                          }`}
                        title={userMember.isOnline ? 'Online' : 'Offline'}
                      />
                      <div className={`text-xs font-semibold truncate ${userMember.isOnline ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 italic'}`}>
                        {userMember.username}
                        {isUs && <span className="text-[9px] text-slate-400 dark:text-slate-550 ml-1 not-italic">(you)</span>}
                      </div>

                      {}
                      {userMember.role === 'host' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          <Crown className="w-2.5 h-2.5 text-amber-400" />
                          Host
                        </span>
                      )}
                      {userMember.role === 'co-host' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 bg-purple-650/20 text-purple-400 border border-purple-500/30">
                          <Shield className="w-2.5 h-2.5 text-purple-400" />
                          Co-host
                        </span>
                      )}
                      {userMember.role === 'member' && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                          Member
                        </span>
                      )}
                      {userMember.role === 'guest' && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-600 border border-slate-200 dark:border-slate-900">
                          Guest
                        </span>
                      )}
                    </div>

                    {}
                    {isHost && !isUs && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={userMember.role}
                          onChange={(e) => handleUpdateRole(userMember.id, e.target.value)}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="co-host">Co-host</option>
                          <option value="member">Member</option>
                          <option value="guest">Guest</option>
                        </select>

                        <button
                          onClick={() => handleKickMember(userMember.id)}
                          title="Kick Member"
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 rounded transition-colors cursor-pointer"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-2 mb-2 text-indigo-500 dark:text-indigo-400">
                <UserPlus className="w-3.5 h-3.5" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Invite user to room</h3>
              </div>
              <form onSubmit={handleInviteUser} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter username..."
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="submit"
                  disabled={inviting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Invite'}
                </button>
              </form>
              {inviteSuccess && (
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5 text-center animate-fade-in">{inviteSuccess}</p>
              )}
              {inviteError && (
                <p className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold mt-1.5 text-center animate-fade-in">{inviteError}</p>
              )}
            </div>
          </div>

          {}
          <div className="border-b border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950/30 px-4 py-3 shrink-0 space-y-2">
            {}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className={`w-3.5 h-3.5 ${isInVoice ? 'text-emerald-400' : 'text-slate-500 dark:text-slate-500'}`} />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Voice Channel</span>
                {voiceParticipants.length > 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 rounded-full">
                    {voiceParticipants.length} in voice
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {}
                {isInVoice && (
                  <button
                    id="voice-mute-btn"
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${isMuted
                        ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                      }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                )}
                {}
                <button
                  id={isInVoice ? 'voice-leave-btn' : 'voice-join-btn'}
                  onClick={isInVoice ? leaveVoice : joinVoice}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${isInVoice
                      ? 'bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 active:scale-95'
                      : 'bg-emerald-50 dark:bg-emerald-900/25 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/35 active:scale-95'
                    }`}
                >
                  {isInVoice ? (
                    <><PhoneOff className="w-3 h-3" /> Leave</>
                  ) : (
                    <><PhoneCall className="w-3 h-3" /> Join</>
                  )}
                </button>
              </div>
            </div>

            {}
            {micError && (
              <div className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-lg px-2.5 py-1.5 animate-fade-in">
                {micError}
              </div>
            )}

            {}
            {voiceParticipants.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {voiceParticipants.map((p) => {
                  const isLocalUser = user && p.userId === user.id;
                  const isSpeaking = speakingUsers.has(p.socketId) || (isLocalUser && speakingUsers.has('local'));
                  return (
                    <div key={p.socketId} className="flex flex-col items-center gap-1" title={p.username}>
                      {}
                      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isSpeaking
                          ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-white dark:ring-offset-slate-950 shadow-md shadow-emerald-500/30'
                          : 'ring-1 ring-slate-200 dark:ring-slate-700'
                        } ${isLocalUser ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                        {p.username.slice(0, 2).toUpperCase()}
                        {}
                        {isLocalUser && isMuted && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full flex items-center justify-center">
                            <MicOff className="w-2 h-2 text-white" />
                          </span>
                        )}
                        {}
                        {isSpeaking && (
                          <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-40" />
                        )}
                      </div>
                      <span className={`text-[8px] font-semibold truncate max-w-[3rem] ${isLocalUser ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {isLocalUser ? 'You' : p.username}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[9px] text-slate-500 dark:text-slate-600 italic">No one is in voice yet. Be the first!</p>
            )}
          </div>
          {}

          {}
          <div className="flex flex-col h-full overflow-hidden relative">

            {}
            <div className="flex border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 p-2 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/40'
                  }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${activeTab === 'queue'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/40'
                  }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Queue ({queue.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('polls')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${activeTab === 'polls'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                    : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/40'
                  }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Polls {polls.filter(p => !p.isClosed).length > 0 && `(${polls.filter(p => !p.isClosed).length})`}</span>
              </button>
              {roomData?.isAiEnabled && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${activeTab === 'ai'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15'
                      : 'text-slate-550 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/40'
                    }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI</span>
                </button>
              )}
            </div>

            {activeTab === 'chat' && (
              <>
                {}
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 text-xs text-center space-y-1">
                      <MessageSquare className="w-5 h-5 text-slate-400 dark:text-slate-750" />
                      <p>Send a message to kick off the chat!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isSystem = msg.username === 'System';
                      if (isSystem) {
                        let alertType = 'info';
                        if (msg.content.includes('joined') || msg.content.includes('online')) {
                          alertType = 'join';
                        } else if (msg.content.includes('left') || msg.content.includes('offline')) {
                          alertType = 'leave';
                        } else if (msg.content.includes('role') || msg.content.includes('set to') || msg.content.includes('kicked')) {
                          alertType = 'role';
                        }

                        return (
                          <div
                            key={msg.id}
                            className={`text-[10px] font-semibold text-center py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 shadow-sm transition-all duration-200 ${alertType === 'join'
                                ? 'bg-emerald-50 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-500/20 text-emerald-650 dark:text-emerald-400 shadow-emerald-500/5'
                                : alertType === 'leave'
                                  ? 'bg-rose-50 dark:bg-rose-950/15 border-rose-200 dark:border-rose-500/20 text-rose-650 dark:text-rose-400 shadow-rose-500/5'
                                  : alertType === 'role'
                                    ? 'bg-purple-50 dark:bg-purple-950/15 border-purple-200 dark:border-purple-500/20 text-purple-650 dark:text-purple-400 shadow-purple-500/5'
                                    : 'bg-indigo-50 dark:bg-indigo-950/15 border-indigo-200 dark:border-indigo-500/20 text-indigo-650 dark:text-indigo-400 shadow-indigo-500/5'
                              }`}
                          >
                            {alertType === 'join' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping shrink-0" />}
                            {alertType === 'leave' && <span className="w-1.5 h-1.5 bg-rose-550 rounded-full shrink-0" />}
                            {alertType === 'role' && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shrink-0" />}
                            <span>{msg.content}</span>
                          </div>
                        );
                      }

                      const hasMention = msg.content.includes(`@${username}`);
                      const isUs = msg.username === username;
                      const senderMember = usersList.find((u) => u.id === msg.userId || u.username === msg.username);
                      const senderRole = senderMember?.role;

                      
                      const groupedReactions = {};
                      (msg.reactions || []).forEach((r) => {
                        if (!groupedReactions[r.emoji]) {
                          groupedReactions[r.emoji] = [];
                        }
                        groupedReactions[r.emoji].push(r.username);
                      });

                      return (
                        <div
                          key={msg.id}
                          className={`p-2.5 rounded-2xl relative group transition-all text-xs flex flex-col gap-1 border ${hasMention
                              ? 'bg-amber-50 dark:bg-amber-950/15 border-amber-200 dark:border-amber-500/25 shadow-sm shadow-amber-500/5'
                              : 'bg-slate-50 dark:bg-slate-950/30 border-slate-100 dark:border-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-950/50 hover:border-slate-200 dark:hover:border-slate-900/60'
                            }`}
                        >
                          {}
                          <div className="absolute right-2.5 -top-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg px-1.5 py-0.5 shadow-xl gap-1 items-center hidden group-hover:flex z-10 transition-all">
                            {EMOJI_LIST.map((emoji) => {
                              const hasReacted = msg.reactions?.some((r) => r.userId === user?.id && r.emoji === emoji);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`hover:scale-125 transition-transform p-0.5 text-xs cursor-pointer select-none rounded ${hasReacted ? 'bg-indigo-100 dark:bg-indigo-650/25 border border-indigo-200 dark:border-indigo-500/30' : ''
                                    }`}
                                >
                                  {emoji}
                                </button>
                              );
                            })}
                            {isHostOrCoHost && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                title="Delete Message"
                                className="hover:scale-125 transition-transform p-0.5 text-xs text-rose-500 hover:text-rose-450 cursor-pointer ml-1 pl-1 border-l border-slate-200 dark:border-slate-800 flex items-center justify-center"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-550" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`font-bold truncate ${isUs ? 'text-indigo-650 dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>
                                {msg.username}
                              </span>

                              {}
                              {senderRole === 'host' && (
                                <span className="flex items-center gap-0.5 px-1 bg-amber-550/15 border border-amber-500/25 rounded text-[8px] font-extrabold uppercase text-amber-500 dark:text-amber-450 select-none scale-[0.9] origin-left shrink-0">
                                  <Crown className="w-2 h-2 text-amber-500 dark:text-amber-400 shrink-0" />
                                  Host
                                </span>
                              )}
                              {senderRole === 'co-host' && (
                                <span className="flex items-center gap-0.5 px-1 bg-purple-650/15 border border-purple-500/25 rounded text-[8px] font-extrabold uppercase text-purple-600 dark:text-purple-400 select-none scale-[0.9] origin-left shrink-0">
                                  <Shield className="w-2 h-2 text-purple-600 dark:text-purple-455 shrink-0" />
                                  Co-host
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 dark:text-slate-550 shrink-0">
                              {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">
                            {renderMessageContent(msg.content)}
                          </p>

                          {}
                          {Object.keys(groupedReactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(groupedReactions).map(([emoji, usersWhoReacted]) => {
                                const hasReacted = msg.reactions?.some((r) => r.userId === user?.id && r.emoji === emoji);
                                const tooltipText = usersWhoReacted.join(', ');
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    title={tooltipText}
                                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold border transition-all cursor-pointer select-none ${hasReacted
                                        ? 'bg-indigo-50 dark:bg-indigo-650/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20'
                                        : 'bg-slate-100 dark:bg-slate-950/65 text-slate-600 dark:text-slate-450 border-slate-200 dark:border-slate-900/60 hover:border-slate-300 dark:hover:border-slate-800'
                                      }`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{usersWhoReacted.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {}
                {showMentions && autocompleteList.length > 0 && (
                  <div className="absolute bottom-16 left-3 right-3 bg-white dark:bg-slate-950/95 border border-slate-200 dark:border-slate-855 rounded-2xl shadow-2xl p-2 max-h-36 overflow-y-auto z-20 animate-fade-in flex flex-col gap-0.5 backdrop-blur-sm">
                    <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 uppercase tracking-wider text-left">Mention attendee...</p>
                    {autocompleteList.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMention(m.username)}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-900/80 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all cursor-pointer font-semibold"
                      >
                        @{m.username}
                      </button>
                    ))}
                  </div>
                )}

                {}
                {Object.keys(activeTypers).length > 0 && (
                  <div className="px-4 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/15 border-t border-slate-100 dark:border-slate-900/40 italic flex items-center gap-2 select-none animate-fade-in shrink-0">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span>
                      {Object.values(activeTypers).join(', ')} {Object.keys(activeTypers).length === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}

                {}
                {userRole !== 'guest' ? (
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-150 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 flex gap-2 shrink-0">
                    <input
                      ref={chatInputRef}
                      type="text"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={handleChatInputChange}
                      className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-indigo-500"
                      maxLength={100}
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-600/10 active:scale-[0.98] transition-all flex items-center justify-center shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="p-3.5 border-t border-slate-150 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/30 text-center text-[10px] text-slate-500 italic shrink-0">
                    Guests do not have permission to send chat messages.
                  </div>
                )}
              </>
            )}

            {activeTab === 'queue' && (
              <>
                {}
                <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
                  {}
                  {isHostOrCoHost && queue.length > 0 && (
                    <button
                      onClick={handleSkipVideo}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-550 hover:to-indigo-550 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                    >
                      <span>Skip to Next Video</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {queue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-650 text-xs text-center space-y-1 py-8">
                        <Users className="w-5 h-5 text-slate-400 dark:text-slate-700" />
                        <p className="font-semibold text-slate-800 dark:text-white">Your playlist is empty</p>
                        <p className="text-[10px] text-slate-500">Paste links below to add videos!</p>
                      </div>
                    ) : (
                      queue.map((item, index) => {
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-800 transition-all gap-2 text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" title={item.title}>
                                {index + 1}. {item.title}
                              </span>
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono block mt-0.5">
                                Added by: {item.addedByUsername || 'System'}
                              </span>
                            </div>

                            {}
                            {isHostOrCoHost && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFromQueue(item.id)}
                                title="Remove item"
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {}
                {isHostOrCoHost ? (
                  <form
                    onSubmit={handleAddToQueue}
                    className="p-3 border-t border-slate-150 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 flex gap-2 shrink-0"
                  >
                    <input
                      type="text"
                      placeholder="Add YouTube or MP4 video URL..."
                      value={queueInput}
                      onChange={(e) => setQueueInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-indigo-500 font-sans"
                      required
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer active:scale-[0.98] transition-all shrink-0 font-sans"
                    >
                      Add
                    </button>
                  </form>
                ) : (
                  <div className="p-3.5 border-t border-slate-150 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/30 text-center text-[10px] text-slate-500 italic shrink-0 font-sans">
                    Only Host and Co-hosts can manage the queue.
                  </div>
                )}
              </>
            )}

            {activeTab === 'polls' && (
              <div className="flex flex-col h-full overflow-hidden relative">
                {}
                <div className="p-3 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-900 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <BarChart2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>Lounge Polls</span>
                  </div>
                  {isHostOrCoHost && !isCreatingPoll && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingPoll(true)}
                      className="flex items-center gap-1 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-xl active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New Poll</span>
                    </button>
                  )}
                </div>

                {}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {}
                  {isCreatingPoll ? (
                    <form onSubmit={handleCreatePoll} className="bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-2xl p-4 space-y-4 animate-fade-in text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider">Create Lounge Poll</span>
                        <button
                          type="button"
                          onClick={() => setIsCreatingPoll(false)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-705 rounded transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-600 dark:text-slate-450 font-bold block px-1">Poll Template Type</label>
                        <select
                          value={newPollType}
                          onChange={(e) => setNewPollType(e.target.value)}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="custom">Custom Poll (Write Own)</option>
                          <option value="content_selection">Content Selection (Templates next video)</option>
                          <option value="satisfaction_feedback">Satisfaction Feedback (Pops a review)</option>
                          <option value="audio_quality">Audio Quality Check (Volume & Streams)</option>
                        </select>
                      </div>

                      {}
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-600 dark:text-slate-455 font-bold block px-1">Poll Question</label>
                        <textarea
                          placeholder="What is your question?"
                          value={newPollQuestion}
                          onChange={(e) => setNewPollQuestion(e.target.value)}
                          disabled={newPollType === 'satisfaction_feedback' || newPollType === 'audio_quality'}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:border-indigo-500 resize-none h-16 disabled:opacity-60"
                          required
                        />
                      </div>

                      {}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] text-slate-600 dark:text-slate-455 font-bold">Choices/Options</label>
                          {(newPollType === 'custom' || newPollType === 'content_selection') && (
                            <button
                              type="button"
                              onClick={handleAddPollOptionField}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Option</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {newPollOptions.map((opt, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                placeholder={`Option ${idx + 1}...`}
                                value={opt}
                                onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                                disabled={newPollType === 'satisfaction_feedback' || newPollType === 'audio_quality'}
                                className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                                required
                              />
                              {(newPollType === 'custom' || newPollType === 'content_selection') && newPollOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePollOptionField(idx)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-550 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {}
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsCreatingPoll(false)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-855 text-slate-700 dark:text-slate-300 font-bold rounded-xl py-2 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-xl py-2 text-xs cursor-pointer active:scale-[0.98] transition-all"
                        >
                          Create Poll
                        </button>
                      </div>
                    </form>
                  ) : null}

                  {}
                  {polls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-605 text-xs text-center space-y-1">
                      <HelpCircle className="w-6 h-6 text-slate-400 dark:text-slate-750" />
                      <p className="font-semibold text-slate-800 dark:text-white">No polls created yet</p>
                      <p className="text-[10px] text-slate-500">Create a poll to gather feedback!</p>
                    </div>
                  ) : (
                    polls.map((poll) => {
                      const totalVotes = poll.options.reduce((sum, o) => sum + o.votesCount, 0);

                      
                      let votedOptionId = null;
                      poll.options.forEach((o) => {
                        const hasVotedForThis = o.voters?.some(v => v.username === username);
                        if (hasVotedForThis) votedOptionId = o.id;
                      });

                      return (
                        <div
                          key={poll.id}
                          className={`p-4 bg-white dark:bg-slate-950/30 border rounded-2xl flex flex-col gap-3 transition-all relative text-left ${poll.isClosed
                              ? 'border-slate-200 dark:border-slate-900/50 opacity-80'
                              : votedOptionId
                                ? 'border-slate-300 dark:border-slate-850 bg-slate-50 dark:bg-slate-950/40'
                                : 'border-slate-200 dark:border-slate-850 hover:border-slate-300 dark:hover:border-slate-800'
                            }`}
                        >
                          {}
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide block mb-0.5">
                                {poll.type.replace('_', ' ')} • {poll.isClosed ? 'Closed' : 'Active'}
                              </span>
                              <h3 className="text-xs font-bold text-slate-800 dark:text-white leading-relaxed break-words font-sans">
                                {poll.question}
                              </h3>
                              <span className="text-[8px] text-slate-500 dark:text-slate-550 block mt-1 font-mono">
                                Created by: {poll.creatorUsername || 'System'}
                              </span>
                            </div>

                            {}
                            {isHostOrCoHost && (
                              <div className="flex items-center gap-1 shrink-0">
                                {!poll.isClosed && (
                                  <button
                                    onClick={() => handleClosePoll(poll.id)}
                                    title="Close Poll"
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 text-[10px] font-bold text-amber-600 dark:text-amber-450 hover:text-amber-700 dark:hover:text-amber-400 rounded-lg cursor-pointer"
                                  >
                                    Close
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePoll(poll.id)}
                                  title="Delete Poll"
                                  className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-455 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>

                          {}
                          <div className="space-y-2">
                            {poll.options.map((opt) => {
                              const isUsersVote = votedOptionId === opt.id;
                              const percent = totalVotes > 0 ? Math.round((opt.votesCount / totalVotes) * 100) : 0;

                              
                              const voterTooltip = opt.voters && opt.voters.length > 0
                                ? `Voted by: ${opt.voters.map(v => v.username).join(', ')}`
                                : 'No votes';

                              if (poll.isClosed) {
                                return (
                                  <div
                                    key={opt.id}
                                    title={voterTooltip}
                                    className={`relative w-full p-2.5 border rounded-xl overflow-hidden transition-all text-xs flex justify-between items-center ${isUsersVote
                                        ? 'border-indigo-200 dark:border-indigo-500/45 bg-indigo-50 dark:bg-indigo-950/15'
                                        : 'border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950/50'
                                      }`}
                                  >
                                    <div
                                      className="absolute inset-y-0 left-0 bg-indigo-500/10 transition-all duration-500"
                                      style={{ width: `${percent}%` }}
                                    />
                                    <span className={`relative font-semibold truncate ${isUsersVote ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-350'}`}>
                                      {opt.optionText}
                                      {isUsersVote && <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold ml-1.5">(your vote)</span>}
                                    </span>
                                    <span className="relative text-[10px] text-slate-500 dark:text-slate-400 font-bold font-mono">
                                      {percent}% ({opt.votesCount})
                                    </span>
                                  </div>
                                );
                              }

                              
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleVotePoll(poll.id, opt.id)}
                                  title={voterTooltip}
                                  className={`relative w-full p-2.5 border rounded-xl overflow-hidden transition-all text-xs flex justify-between items-center cursor-pointer text-left focus:outline-none ${isUsersVote
                                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-600/10 shadow shadow-indigo-600/5 hover:border-indigo-400'
                                      : 'border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950/50 hover:border-slate-300 dark:hover:border-slate-800'
                                    }`}
                                >
                                  {}
                                  <div
                                    className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${isUsersVote ? 'bg-indigo-50 dark:bg-indigo-650/15' : 'bg-slate-100/50 dark:bg-slate-900/40'
                                      }`}
                                    style={{ width: `${percent}%` }}
                                  />
                                  <span className={`relative font-semibold truncate ${isUsersVote ? 'text-indigo-600 dark:text-indigo-350 font-bold' : 'text-slate-700 dark:text-slate-350'}`}>
                                    {opt.optionText}
                                    {isUsersVote && <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold ml-1.5">(your vote)</span>}
                                  </span>
                                  <span className="relative text-[10px] text-slate-500 dark:text-slate-400 font-bold font-mono">
                                    {percent}% ({opt.votesCount})
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {}
                          <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-bold px-1 font-mono">
                            <span>Total Votes: {totalVotes}</span>
                            {poll.isClosed && poll.closedAt ? (
                              <span>Closed</span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-500 animate-pulse">● Accepting Votes</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'ai' && roomData?.isAiEnabled && (
              <AiPanel
                roomId={roomId}
                socket={socket}
                aiState={aiState}
                videoTitle={roomData?.videoUrl ? (queue.find(item => item.videoUrl === roomData.videoUrl)?.title || "Current Video") : "Current Video"}
                videoUrl={roomData?.videoUrl}
              />
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
