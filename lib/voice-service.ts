import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  deleteDoc, 
  addDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from './firebase';

export class VoiceService {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private roomId: string;
  private userId: string;
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onConnectionStateChange?: (userId: string, state: string) => void;
  private onKicked?: () => void;
  private isConnectionActive = true;
  private signalingUnsubscribe: (() => void) | null = null;
  private signalingDocUnsubscribe: (() => void) | null = null;
 
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };
 
  constructor(
    roomId: string, 
    userId: string, 
    onRemoteStream: (userId: string, stream: MediaStream) => void,
    onConnectionStateChange?: (userId: string, state: string) => void,
    onKicked?: () => void
  ) {
    this.roomId = roomId;
    this.userId = userId;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onKicked = onKicked;
  }
 
  get hasLocalStream() {
    return this.localStream !== null;
  }
 
  async startLocalStream() {
    this.isConnectionActive = true;
    try {
      // Check if any audio input devices exist first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudioInput = devices.some(device => device.kind === 'audioinput');
      
      if (!hasAudioInput) {
        console.warn('No audio input devices found. Room will start in listener mode.');
        this.localStream = null;
        return null;
      }
 
      // Try with high quality constraints first
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      return this.localStream;
    } catch (error) {
      console.warn('Microphone high-quality constraints failed, trying basic audio:', error);
      try {
        // Fallback to basic audio
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        return this.localStream;
      } catch (fallbackError) {
        console.info('Microphone access unavailable (expected in some environments). Entering listener mode.');
        this.localStream = null;
        return null; 
      }
    }
  }
 
  toggleMute(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }
 
  async joinRoom(profile: { displayName?: string, photoURL?: string, email?: string, isOfficial?: boolean, vipLevel?: number }) {
    const signalingRef = collection(db, 'rooms', this.roomId, 'signaling');
    const mySignalingRef = doc(db, 'rooms', this.roomId, 'signaling', this.userId);
    
    // Listen for my own document to detect kicks
    this.signalingDocUnsubscribe = onSnapshot(mySignalingRef, (snapshot) => {
      if (!snapshot.exists() && this.isConnectionActive) {
        // If our doc was deleted but we are still "in", we might have been kicked
        if (this.onKicked) this.onKicked();
        this.leaveRoom();
      }
    });

    // Listen for new members or signaling data
    this.signalingUnsubscribe = onSnapshot(signalingRef, async (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const data = change.doc.data();
        const otherUserId = change.doc.id;
 
        if (otherUserId === this.userId) return;
 
        if (change.type === 'added' || change.type === 'modified') {
          if (data.offer && !this.peerConnections.has(otherUserId)) {
            await this.handleOffer(otherUserId, data.offer);
          } else if (data.answer) {
            await this.handleAnswer(otherUserId, data.answer);
          } else if (data.candidate) {
            await this.handleCandidate(otherUserId, data.candidate);
          }
        } else if (change.type === 'removed') {
          this.closeConnection(otherUserId);
        }
      });
    });
 
    // Notify others that we joined with profile info
    await setDoc(mySignalingRef, {
      displayName: profile.displayName || 'Anonim',
      photoURL: profile.photoURL || '',
      joinedAt: new Date().toISOString(),
    });
  }
 
  async callUser(otherUserId: string) {
    const pc = this.createPeerConnection(otherUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
 
    await setDoc(doc(db, 'rooms', this.roomId, 'signaling', this.userId), {
      offer: { type: offer.type, sdp: offer.sdp },
      to: otherUserId
    }, { merge: true });
  }
 
  private async handleOffer(otherUserId: string, offer: RTCSessionDescriptionInit) {
    const pc = this.createPeerConnection(otherUserId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
 
    await setDoc(doc(db, 'rooms', this.roomId, 'signaling', this.userId), {
      answer: { type: answer.type, sdp: answer.sdp },
      to: otherUserId
    }, { merge: true });
  }
 
  private async handleAnswer(otherUserId: string, answer: RTCSessionDescriptionInit) {
    const pc = this.peerConnections.get(otherUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }
 
  private async handleCandidate(otherUserId: string, candidate: RTCIceCandidateInit) {
    const pc = this.peerConnections.get(otherUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
 
  private createPeerConnection(otherUserId: string) {
    const pc = new RTCPeerConnection(this.configuration);
    this.peerConnections.set(otherUserId, pc);
 
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }
 
    pc.onicecandidate = (event) => {
      if (this.isConnectionActive && event.candidate) {
        setDoc(doc(db, 'rooms', this.roomId, 'signaling', this.userId), {
          candidate: event.candidate.toJSON(),
          to: otherUserId
        }, { merge: true });
      }
    };
 
    pc.ontrack = (event) => {
      this.onRemoteStream(otherUserId, event.streams[0]);
    };
 
    pc.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(otherUserId, pc.connectionState);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        this.closeConnection(otherUserId);
      }
    };
 
    return pc;
  }
 
  closeConnection(otherUserId: string) {
    const pc = this.peerConnections.get(otherUserId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(otherUserId);
    }
  }
 
  async leaveRoom() {
    this.isConnectionActive = false;
    if (this.signalingUnsubscribe) this.signalingUnsubscribe();
    if (this.signalingDocUnsubscribe) this.signalingDocUnsubscribe();
    this.peerConnections.forEach((pc, id) => this.closeConnection(id));
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    await deleteDoc(doc(db, 'rooms', this.roomId, 'signaling', this.userId)).catch(() => {});
  }
}
