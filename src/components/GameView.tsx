import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCcw, LogOut, Star, Zap, Mic, Send, Compass, Settings, Gamepad2, Users, X, Circle, Camera, Globe, ChevronRight, Check, Image as ImageIcon, Coins, Plus, MicOff, Volume2, VolumeX, UserPlus, UserMinus, Shield, ShieldCheck, Lock, Unlock, UserX, Gift, Smile, MessageSquare, Paperclip, Crown, Gem, Heart, Flame, Music, Rocket, Coffee, Pizza, IceCream, Cookie, Ghost, Cat, Dog, Bird, Moon, Sun, Cloud, Wind, Umbrella, MapPin, Search, BadgeCheck, Copy, Play, Video, FileVideo, Trash2 } from 'lucide-react';
import { logoutUser, syncHighScore, updateProfileData, createRoom, deleteRoom, updateRoom, followUser, unfollowUser, addRoomAdmin, removeRoomAdmin, kickUser, unkickUser, muteUserSeat, lockSeat, assignUserToSeat, sendMessage, sendGift, createDiscoveryPost, deleteDiscoveryPost, handleFirestoreError, OperationType } from '../lib/auth-service';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, where, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { VoiceService } from '../lib/voice-service';

type Tab = 'game' | 'chat' | 'messages' | 'discover' | 'settings';

interface Participant {
  uid: string;
  displayName: string;
  photoURL?: string;
  joinedAt: string;
}

const roomBackgrounds = [
  { id: 'bg-1', url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1200', name: 'Lüks Lounge' },
  { id: 'bg-2', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200', name: 'Kiber Setup' },
  { id: 'bg-3', url: 'https://images.unsplash.com/photo-1514565131-0ce08211feed?q=80&w=1200', name: 'Gecə Şəhəri' },
  { id: 'bg-4', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200', name: 'Tropik Sahil' },
  { id: 'bg-5', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1200', name: 'Dumanlı Meşə' },
  { id: 'bg-6', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200', name: 'Modern Ofis' },
  { id: 'bg-7', url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1200', name: 'Kosmos' },
  { id: 'bg-8', url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1200', name: 'VİP Klub' },
  { id: 'bg-9', url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1200', name: 'Kitabxana' },
  { id: 'bg-10', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1200', name: 'Penthaus' },
];

export default function GameView() {
  const user = auth.currentUser;
  const voiceServiceRef = useRef<VoiceService | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('game');
  const [highScore, setHighScore] = useState(0);
  const [showFriends, setShowFriends] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showFollowRoom, setShowFollowRoom] = useState(false);
  const [followRoomId, setFollowRoomId] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [friendIdToSearch, setFriendIdToSearch] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedFriendsForGroup, setSelectedFriendsForGroup] = useState<string[]>([]);
  const [userData, setUserData] = useState<any>(null);

  const handleSearchFriend = async () => {
    if (!friendIdToSearch.trim()) return;
    try {
      const userRef = doc(db, 'users', friendIdToSearch.trim());
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setSelectedUser({ uid: userSnap.id, ...userSnap.data() });
        setShowAddFriendModal(false);
        setFriendIdToSearch('');
      } else {
        alert('İstifadəçi tapılmadı.');
      }
    } catch (err) {
      alert('Xəta baş verdi.');
    }
  };
  const [tempName, setTempName] = useState('');
  const [rooms, setRooms] = useState<any[]>([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [activeRoom, setActiveRoom] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [tempRoomName, setTempRoomName] = useState('');
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [followedProfiles, setFollowedProfiles] = useState<any[]>([]);
  const [roomFollowersProfiles, setRoomFollowersProfiles] = useState<any[]>([]);
  const [kickedUsersProfiles, setKickedUsersProfiles] = useState<any[]>([]);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [messages, setMessages] = useState<any[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [showGifts, setShowGifts] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Participant | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [showSeatMenu, setShowSeatMenu] = useState(false);
  const [menuSeatIndex, setMenuSeatIndex] = useState<number | null>(null);
  const [isKicked, setIsKicked] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [roomLvlInfo, setRoomLvlInfo] = useState({ xp: 0, level: 1 });
  const [roomJoinTime, setRoomJoinTime] = useState<Date | null>(null);
  
  const [activeGiftEffect, setActiveGiftEffect] = useState<any>(null);
  
  const [discoveryPosts, setDiscoveryPosts] = useState<any[]>([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postText, setPostText] = useState('');
  const [postMedia, setPostMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [viewingUserProfile, setViewingUserProfile] = useState<any | null>(null);
  const [viewingUserPosts, setViewingUserPosts] = useState<any[]>([]);
  
  const liveActiveRoom = rooms.find(r => r.id === activeRoom?.id);
  const currentBgRaw = roomBackgrounds.find(bg => bg.id === (liveActiveRoom?.backgroundId || 'bg-1')) || roomBackgrounds[0];
  const currentBg = liveActiveRoom?.isOfficial 
    ? { id: 'official', url: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=1200', name: 'DGAME Official' }
    : currentBgRaw;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!liveActiveRoom || !roomJoinTime) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, 'rooms', liveActiveRoom.id, 'messages'),
      orderBy('timestamp', 'asc'),
      where('timestamp', '>', roomJoinTime)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.type === 'gift') {
            setActiveGiftEffect(data);
            setTimeout(() => setActiveGiftEffect(null), 5000);
          }
        }
      });
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
    }, (error) => {
      console.error("Messages snapshot error:", error);
    });

    const unsubRoom = onSnapshot(doc(db, 'rooms', liveActiveRoom.id), (d) => {
      if (d.exists()) {
        const data = d.data();
        setRoomLvlInfo({ xp: data.xp || 0, level: Math.floor((data.xp || 0) / 1000) + 1 });
      }
    }, (error) => {
      console.error("Room specific snapshot error:", error);
    });

    return () => {
      unsub();
      unsubRoom();
    };
  }, [liveActiveRoom]);

  useEffect(() => {
    const manageSystemGroup = async () => {
      if (!user || !userProfile) return;
      
      const systemGroupId = 'official_system_group';
      const systemGroupRef = doc(db, 'rooms', systemGroupId);
      
      try {
        const systemGroupSnap = await getDoc(systemGroupRef);
        const isSuperUser = user.email === 'dasdemirov2017@gmail.com';
        
        if (!systemGroupSnap.exists()) {
          if (isSuperUser) {
            await setDoc(systemGroupRef, {
              id: systemGroupId,
              name: 'SİSTEM DGAME',
              description: 'Rəsmi elanlar və yeniliklər',
              ownerId: user.uid,
              ownerName: 'SİSTEM DGAME',
              isOfficial: true,
              followers: [user.uid],
              admins: [],
              backgroundId: 'bg-1',
              type: 'group',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          }
        } else {
          const data = systemGroupSnap.data();
          // Ensure the superuser is the owner
          if (isSuperUser && (data.ownerId !== user.uid || data.ownerName !== 'SİSTEM DGAME')) {
            await updateDoc(systemGroupRef, {
              ownerId: user.uid,
              ownerName: 'SİSTEM DGAME'
            });
          }
        }
      } catch (err) {
        console.error("System group management error:", err);
      }
    };
    
    if (user && userProfile) {
      manageSystemGroup();
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (user && userProfile && rooms.length > 0) {
      const dgameRoom = rooms.find(r => r.name.toLowerCase() === 'dgame');
      if (dgameRoom && !following.has(dgameRoom.id)) {
        followUser(user.uid, dgameRoom.id);
      }
    }
  }, [user, userProfile, rooms, following]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatMessage.trim() || !user || !liveActiveRoom || !userProfile) return;

    try {
      const isOfficialGroup = liveActiveRoom.id === 'official_system_group';
      const isSuperUser = user.email === 'dasdemirov2017@gmail.com';

      await sendMessage(liveActiveRoom.id, {
        senderId: user.uid,
        senderName: (isOfficialGroup && isSuperUser) ? 'SİSTEM DGAME' : (userProfile.displayName || 'Anonim'),
        senderEmail: user.email || '',
        senderPhoto: userProfile.photoURL || '',
        text: chatMessage,
        type: 'text'
      });
      setChatMessage('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleChatImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !liveActiveRoom || !userProfile) return;
    
    // Simulate image upload (returning a temporary URL or base64)
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const isOfficialGroup = liveActiveRoom.id === 'official_system_group';
        const isSuperUser = user.email === 'dasdemirov2017@gmail.com';
        await sendMessage(liveActiveRoom.id, {
          senderId: user.uid,
          senderName: (isOfficialGroup && isSuperUser) ? 'SİSTEM DGAME' : (userProfile.displayName || 'Anonim'),
          senderEmail: user.email || '',
          senderPhoto: userProfile.photoURL || '',
          imageUrl: event.target.result as string,
          type: 'image'
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSendGift = async (gift: any) => {
    if (!user || !liveActiveRoom || !userProfile) return;
    
    // If no user is explicitly selected, we need one to send a gift
    if (!selectedUser) {
      alert('Zəhmət olmasa hədiyyə göndərmək üçün bir istifadəçi seçin.');
      return;
    }

    try {
      if (userProfile.coins < gift.price) {
        alert('Kifayət qədər coin yoxdur!');
        return;
      }
      // Pass only serializable data to the service
      await sendGift(user.uid, selectedUser.uid, liveActiveRoom.id, {
        id: gift.id,
        name: gift.name,
        price: gift.price,
        icon: gift.id // Pass ID as string reference for the icon
      });
      alert('Hədiyyə göndərildi!');
      setShowGifts(false);
      // We keep the selectedUser so the profile stays open if they were viewing it
    } catch (err) {
      console.error(err);
      alert('Xəta baş verdi. Yenidən yoxlayın.');
    }
  };

  const GIFTS = [
    { id: 'heart', name: 'Ürək', price: 10, icon: <Heart className="w-8 h-8 text-rose-500" /> },
    { id: 'flame', name: 'Alov', price: 50, icon: <Flame className="w-8 h-8 text-orange-500" /> },
    { id: 'crown', name: 'Tac', price: 100, icon: <Crown className="w-8 h-8 text-amber-500" /> },
    { id: 'gem', name: 'Almaz', price: 500, icon: <Gem className="w-8 h-8 text-indigo-500" /> },
    { id: 'rocket', name: 'Raket', price: 1000, icon: <Rocket className="w-8 h-8 text-blue-500" /> },
    { id: 'coffee', name: 'Qəhvə', price: 5, icon: <Coffee className="w-8 h-8 text-amber-700" /> },
    { id: 'music', name: 'Musiqi', price: 200, icon: <Music className="w-8 h-8 text-purple-500" /> },
    { id: 'ghost', name: 'Ruh', price: 300, icon: <Ghost className="w-8 h-8 text-slate-400" /> },
    { id: 'pizza', name: 'Pizza', price: 30, icon: <Pizza className="w-8 h-8 text-orange-400" /> },
    { id: 'icecream', name: 'Dondurma', price: 15, icon: <IceCream className="w-8 h-8 text-pink-400" /> },
    { id: 'cat', name: 'Pişik', price: 150, icon: <Cat className="w-8 h-8 text-orange-300" /> },
    { id: 'dog', name: 'İt', price: 150, icon: <Dog className="w-8 h-8 text-amber-600" /> },
    { id: 'bird', name: 'Quş', price: 80, icon: <Bird className="w-8 h-8 text-blue-400" /> },
    { id: 'sun', name: 'Günəş', price: 250, icon: <Sun className="w-8 h-8 text-yellow-500" /> },
    { id: 'moon', name: 'Ay', price: 250, icon: <Moon className="w-8 h-8 text-indigo-300" /> },
    { id: 'star', name: 'Ulduz', price: 40, icon: <Star className="w-8 h-8 text-yellow-400" /> },
  ];

  const countries = [
    "Azərbaycan", "Türkiyə", "ABŞ", "Almaniya", "Rusiya", "Böyük Britaniya", 
    "Fransa", "İtaliya", "İspaniya", "Kanada", "Braziliya", "Yaponiya", 
    "Cənubi Koreya", "Çin", "Hindistan", "Ukrayna", "Qazaxıstan"
  ];

  const avatars = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aria",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Nova"
  ];

  useEffect(() => {
    if (!user) return;
    
    // Listen to following list
    const q = query(collection(db, 'follows'), orderBy('timestamp', 'desc'));
    const unsubFollows = onSnapshot(q, (snapshot) => {
      const followingList = new Set<string>();
      const followedIds: string[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.followerId === user.uid) {
          followingList.add(data.followedId);
          followedIds.push(data.followedId);
        }
      });
      setFollowing(followingList);
      
      // Fetch followed users profiles
      if (followedIds.length > 0) {
        // Simple way for demo: listen to all users or just these
        // To be safe and within 30 limit of 'in' query:
        // const limitedIds = followedIds.slice(0, 30);
      }
    }, (error) => {
      console.error("Follows snapshot error:", error);
    });

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setHighScore(data.highScore || 0);
        setUserData(data);
        if (data.displayName && !tempName) setTempName(data.displayName);
      }
    }, (error) => {
      console.error("User context snapshot error:", error);
    });

    return () => {
      unsubFollows();
      unsubUser();
    };
  }, [user]);

  // Fetch followed profiles when following set changes
  useEffect(() => {
    if (!user || following.size === 0) {
      setFollowedProfiles([]);
      return;
    }
    
    const ids = Array.from(following).slice(0, 30);
    // Realtime listener for followed users profiles
    const unsubProfiles = onSnapshot(collection(db, 'users'), (snapshot) => {
      const profiles = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(p => following.has(p.uid));
      setFollowedProfiles(profiles);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubProfiles();
  }, [following, user]);

  useEffect(() => {
    if (!activeRoom) {
      setRoomFollowersProfiles([]);
      return;
    }

    const q = query(collection(db, 'follows'), where('followedId', '==', activeRoom.id));
    const unsubFollows = onSnapshot(q, (snapshot) => {
      const followerIds = snapshot.docs.map(doc => doc.data().followerId);
      
      const unsubProfiles = onSnapshot(collection(db, 'users'), (userSnapshot) => {
        const allProfiles = userSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        const profiles = allProfiles.filter(p => followerIds.includes(p.uid));
        setRoomFollowersProfiles(profiles);

        // Also update kicked users profiles if we have the list
        if (liveActiveRoom?.kickedUsers) {
          const kicked = allProfiles.filter(p => liveActiveRoom.kickedUsers.includes(p.uid));
          setKickedUsersProfiles(kicked);
        } else {
          setKickedUsersProfiles([]);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
      return () => unsubProfiles();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'follows');
    });

    return () => unsubFollows();
  }, [activeRoom]);

  useEffect(() => {
    if (!activeRoom) {
      setParticipants(new Map());
      return;
    }

    const unsubParticipants = onSnapshot(collection(db, 'rooms', activeRoom.id, 'signaling'), (snapshot) => {
      const participantsMap = new Map<string, Participant>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        participantsMap.set(doc.id, { 
          uid: doc.id, 
          displayName: data.displayName || 'Anonim',
          photoURL: data.photoURL,
          joinedAt: data.joinedAt || new Date().toISOString()
        });
      });
      setParticipants(participantsMap);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `rooms/${activeRoom.id}/signaling`);
    });

    return () => unsubParticipants();
  }, [activeRoom]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || user.email !== 'dasdemirov2017@gmail.com') return;
    
    // Auto-unkick from any room for superuser
    rooms.forEach(async (room) => {
      if (room.kickedUsers?.includes(user.uid)) {
        await unkickUser(room.id, user.uid);
      }
    });
  }, [rooms, user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'discover_posts'), orderBy('isPinned', 'desc'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDiscoveryPosts(posts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'discover_posts');
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!viewingUserProfile) {
      setViewingUserPosts([]);
      return;
    }
    const q = query(
      collection(db, 'discover_posts'), 
      where('userId', '==', viewingUserProfile.uid),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setViewingUserPosts(posts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'discover_posts');
    });
    return () => unsub();
  }, [viewingUserProfile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Resize and compress using Canvas
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to low quality JPEG (0.6) to ensure small file size
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          updateProfileData(user.uid, { photoURL: dataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFollowRoomById = async () => {
    if (!followRoomId.trim() || !user) return;
    const room = rooms.find(r => r.id === followRoomId.trim());
    if (room) {
      joinVoiceRoom(room);
      setShowFollowRoom(false);
      setFollowRoomId('');
    } else {
      alert('Otaq tapılmadı.');
    }
  };

  const handleRoomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && liveActiveRoom) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          updateRoom(liveActiveRoom.id, { roomPhoto: dataUrl });
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onloadend = () => {
      setPostMedia({
        url: reader.result as string,
        type: isVideo ? 'video' : 'image'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePostSubmit = async () => {
    if ((!postText.trim() && !postMedia) || !user) return;
    
    try {
      const isSuperUser = user.email === 'dasdemirov2017@gmail.com';
      
      if (isSuperUser) {
        const otherPinned = discoveryPosts.filter(p => p.userId === user.uid && p.isPinned);
        for (const p of otherPinned) {
          await updateDoc(doc(db, 'discover_posts', p.id), { isPinned: false });
        }
      }

      await createDiscoveryPost(user.uid, {
        userName: userProfile?.displayName || user.displayName || 'Anonim',
        userPhoto: userProfile?.photoURL || user.photoURL || '',
        userEmail: user.email,
        text: postText,
        mediaUrl: postMedia?.url,
        mediaType: postMedia?.type,
        isPinned: isSuperUser
      });
      
      setPostText('');
      setPostMedia(null);
      setShowCreatePost(false);
    } catch (err) {
      console.error(err);
      alert('Paylaşım zamanı xəta baş verdi.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'game':
        const games = [
          { id: 'domino', name: 'DOMİNO', icon: '🎲', image: 'https://images.unsplash.com/photo-1620803126785-2e06180df4e2?q=80&w=600', players: '2-4' },
          { id: 'ludo', name: 'NƏRD', icon: '🤴', image: 'https://images.unsplash.com/photo-1590121431265-d6ca1f464010?q=80&w=600', players: '2' },
          { id: 'okey', name: '101 OKEY', icon: '🀄', image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=600', players: '4' },
          { id: 'chess', name: 'ŞAHMAT', icon: '♟️', image: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?q=80&w=600', players: '2' },
        ];
        return (
          <div className="flex-1 flex flex-col p-6 space-y-6 pb-24 overflow-y-auto">
            <div className="flex items-center justify-between mt-4">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Məşhur Oyunlar</h1>
              <div className="bg-amber-100/50 px-4 py-2 rounded-2xl flex items-center gap-2 border border-amber-100">
                <Coins className="w-5 h-5 text-amber-500" />
                <span className="font-black text-amber-600">{userProfile?.coins || 0}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {games.map((game) => (
                <motion.div 
                  key={game.id}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative h-48 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-indigo-100 group cursor-pointer"
                >
                  <img src={game.image} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={game.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent flex flex-col justify-end p-8">
                    <div className="flex items-center justify-between w-full">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl filter drop-shadow-md">{game.icon}</span>
                          <h3 className="text-2xl font-black text-white tracking-widest uppercase">{game.name}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                              <Users className="w-3.5 h-3.5 text-white/80" />
                              <span className="text-[10px] font-bold text-white/90">{game.players} Oyunçu</span>
                           </div>
                           <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/20">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span className="text-[10px] font-bold text-emerald-400">Canlı</span>
                           </div>
                        </div>
                      </div>
                      <button className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-lg group-hover:bg-white group-hover:border-white transition-all duration-300">
                        <ChevronRight className="w-7 h-7 text-white group-hover:text-indigo-600 transition-colors" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      case 'chat':
        const userRoom = rooms.find(r => r.ownerId === user?.uid);
        return (
          <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Söhbət Otaqları</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowFollowRoom(true)}
                  className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  ODA TAKİB ET
                </button>
                {!userRoom ? (
                  <button 
                    onClick={() => setShowCreateRoom(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    OTAQ YARAT
                  </button>
                ) : (
                  <button 
                    onClick={() => user && deleteRoom(user.uid)}
                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2"
                  >
                    <X className="w-3.5 h-3.5" />
                    OTAĞI SİL
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pb-20">
              {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600">
                    <Mic className="w-10 h-10" />
                  </div>
                  <p className="text-slate-500 font-medium">Hələ ki, heç bir otaq yoxdur.<br/>İlk otağı sən yarat!</p>
                </div>
              ) : (
                rooms.map((room) => (
                  <div key={room.id} className="p-4 bg-white border border-slate-100 rounded-3xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 overflow-hidden border border-indigo-100">
                        {room.roomPhoto ? (
                          <img src={room.roomPhoto} alt={room.name} className="w-full h-full object-cover" />
                        ) : room.ownerPhoto ? (
                          <img src={room.ownerPhoto} alt={room.ownerName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold">{room.ownerName?.[0]?.toUpperCase() || '?'}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-slate-900">{room.name}</h4>
                          {room.isOfficial && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-50" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{room.ownerName} tərəfindən</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => joinVoiceRoom(room)}
                      className="px-4 py-2 bg-slate-50 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"
                    >
                      DAXİL OL
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Active Voice Room Overlay */}
            <AnimatePresence>
              {liveActiveRoom && (
                <motion.div 
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  className="fixed inset-0 bg-slate-900 z-[200] flex flex-col p-6 overflow-hidden"
                >
                  {/* Background Image */}
                  <div className="absolute inset-0 z-[-1] overflow-hidden">
                    <img 
                      src={currentBg.url} 
                      alt="Room Background" 
                      className="w-full h-full object-cover opacity-30 blur-sm scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/40 to-slate-900" />
                  </div>

                  <header className="flex items-center justify-between mb-12">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                          {liveActiveRoom.roomPhoto ? (
                            <img src={liveActiveRoom.roomPhoto} alt={liveActiveRoom.name} className="w-full h-full object-cover" />
                          ) : (
                            <Gamepad2 className="w-6 h-6 text-white/40" />
                          )}
                       </div>
                       <div>
                          <div className="flex items-center gap-3">
                            <h3 className={cn(
                              "text-2xl font-black tracking-tight",
                              liveActiveRoom.isOfficial ? "bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent" : "text-white"
                            )}>
                              {liveActiveRoom.name}
                            </h3>
                            {liveActiveRoom.isOfficial && <BadgeCheck className="w-5 h-5 text-blue-400 fill-blue-50/10" />}
                            {user && liveActiveRoom.ownerId !== user.uid && (
                              <button 
                                onClick={async () => {
                                  if (following.has(liveActiveRoom.ownerId)) {
                                    await unfollowUser(user.uid, liveActiveRoom.ownerId);
                                  } else {
                                    await followUser(user.uid, liveActiveRoom.ownerId);
                                  }
                                }}
                                className={cn(
                                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                  following.has(liveActiveRoom.ownerId) 
                                    ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" 
                                    : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                                )}
                              >
                                {following.has(liveActiveRoom.ownerId) ? 'Takibdən Çıx' : 'Takib Et'}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 group/id">
                                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest group-hover/id:text-indigo-400 transition-colors">ID:</span>
                                  <p className="text-slate-400 text-[10px] font-mono tracking-wider">
                                    {liveActiveRoom.id}
                                  </p>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(liveActiveRoom.id);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded-md transition-colors"
                                    title="Otaq ID-ni kopyala"
                                  >
                                    <Copy className="w-2.5 h-2.5 text-white/40 hover:text-indigo-400" />
                                  </button>
                                </div>
                             {liveActiveRoom.admins && liveActiveRoom.admins.length > 0 && (
                               <>
                                 <span className="text-white/20">•</span>
                                 <div className="flex items-center gap-1">
                                   <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                   <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest truncate max-w-[150px]">
                                     Admin: {liveActiveRoom.admins.map((id: string) => roomFollowersProfiles.find(p => p.uid === id)?.displayName || '...').filter(Boolean).join(', ')}
                                   </span>
                                 </div>
                               </>
                             )}
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       {(liveActiveRoom.ownerId === user?.uid || liveActiveRoom.admins?.includes(user?.uid)) && (
                          <button 
                            onClick={() => {
                              setTempRoomName(liveActiveRoom.name);
                              setShowRoomSettings(true);
                            }}
                            className="p-3 bg-white/10 rounded-2xl text-white hover:bg-white/20 transition-colors"
                          >
                            <Settings className="w-6 h-6" />
                          </button>
                       )}
                       <button 
                         onClick={leaveVoiceRoom}
                         className="p-3 bg-white/10 rounded-2xl text-white hover:bg-rose-500 transition-colors"
                       >
                         <LogOut className="w-6 h-6" />
                       </button>
                    </div>
                  </header>

                  {/* 10 Seats Grid (2-4-4 Layout) */}
                  <div className="flex-1 flex flex-col gap-8 content-start max-w-xl mx-auto w-full overflow-y-auto">
                    {/* Room Level and Stats */}
                    <div className="flex items-center justify-center gap-4 py-2">
                       <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">LVL {roomLvlInfo.level}</span>
                          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-amber-500" 
                               style={{ width: `${(roomLvlInfo.xp % 1000) / 10}%` }}
                             />
                          </div>
                          <span className="text-[8px] font-black text-white/40">{roomLvlInfo.xp % 1000}/1000</span>
                       </div>
                    </div>

                    {(() => {
                      const isModerator = liveActiveRoom && user && (liveActiveRoom.ownerId === user.uid || liveActiveRoom.admins?.includes(user.uid));
                      
                      const renderSeat = (index: number, isLarge: boolean = false) => {
                        const seatData = liveActiveRoom?.seats?.[index] || { isLocked: false, isMutedByAdmin: false };
                        const occupantId = seatData.occupantId;
                        const participant = occupantId ? participants.get(occupantId) : null;
                        const isHost = index === 0;
                        const hasUser = !!participant;
                        const isLocked = seatData.isLocked;
                        const isMutedByAdmin = seatData.isMutedByAdmin;

                        return (
                          <div 
                            key={index} 
                            className="flex flex-col items-center space-y-2 cursor-pointer"
                            onClick={() => {
                              if (isModerator) {
                                setMenuSeatIndex(index);
                                setShowSeatMenu(true);
                              } else if (hasUser && participant.uid !== user?.uid) {
                                setSelectedUser(participant);
                              } else if (!hasUser && !isLocked) {
                                // Guest can sit if not locked
                                if (user) assignUserToSeat(liveActiveRoom.id, index, user.uid);
                              }
                            }}
                          >
                            <div className="relative">
                              <div className={cn(
                                "rounded-3xl border-2 flex items-center justify-center transition-all overflow-hidden relative",
                                isLarge ? "w-20 h-20 rounded-[2rem]" : "w-14 h-14",
                                hasUser && (participant as any).email === 'dasdemirov2017@gmail.com' ? "bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 border-amber-500 shadow-[0_0_25px_rgba(251,191,36,0.7)] scale-110 z-10" :
                                isHost ? "bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20" : 
                                (isLocked ? "bg-slate-800 border-slate-700" : "bg-white/5 border-white/10")
                              )}>
                                {hasUser && (participant as any).email === 'dasdemirov2017@gmail.com' && (
                                  <div className="absolute -inset-2 border-2 border-amber-400/50 rounded-full animate-[spin_8s_linear_infinite] pointer-events-none" />
                                )}
                                {isLocked ? (
                                   <Lock className={cn("text-white/20", isLarge ? "w-8 h-8" : "w-4 h-4")} />
                                ) : hasUser ? (
                                   participant.photoURL ? (
                                     <img src={participant.photoURL} alt={participant.displayName} className="w-full h-full object-cover" />
                                   ) : (
                                     <div className="w-full h-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                        <Volume2 className={cn("text-emerald-500", isLarge ? "w-8 h-8" : "w-5 h-5", remoteStreams.has(participant.uid) && !isMutedByAdmin && "animate-pulse")} />
                                     </div>
                                   )
                                ) : (
                                  <Plus className={cn("text-white/20", isLarge ? "w-6 h-6" : "w-4 h-4")} />
                                )}
                                
                                {isMutedByAdmin && hasUser && (
                                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                                    <MicOff className="w-4 h-4 text-rose-500" />
                                  </div>
                                )}
                              </div>
                              
                              {hasUser && ((participant as any).isOfficial || (participant as any).email === 'dasdemirov2017@gmail.com') && (
                                <div className="absolute -top-2 -left-2 bg-blue-500 rounded-full p-0.5 border-2 border-white shadow-lg z-30">
                                  <BadgeCheck className="w-4 h-4 text-white fill-blue-500" />
                                </div>
                              )}

                              {hasUser && (participant as any).vipLevel > 0 && (
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm z-30 whitespace-nowrap">
                                  VIP {(participant as any).vipLevel}
                                </div>
                              )}
                              
                              {isHost && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-slate-900 shadow-lg">
                                  HOST
                                </div>
                              )}
                              
                              {hasUser && participant.uid !== liveActiveRoom.ownerId && following.has(participant.uid) && (
                                <div className={cn(
                                  "absolute bg-rose-500 text-white p-1 rounded-full border-2 border-slate-900 shadow-sm",
                                  isLarge ? "-bottom-1 -right-1" : "-bottom-0.5 -right-0.5"
                                )}>
                                  <Star className={cn("fill-white", isLarge ? "w-2 h-2" : "w-1.5 h-1.5")} />
                                </div>
                              )}
                            </div>
                            <p className={cn(
                              "font-bold text-center truncate flex items-center justify-center gap-1",
                              isLarge ? "text-[11px] text-white/80 w-24" : "text-[9px] text-slate-500 w-full",
                              hasUser && (participant as any).email === 'dasdemirov2017@gmail.com' && "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] font-black"
                            )}>
                              <span className="truncate">
                                {hasUser && (participant as any).email === 'dasdemirov2017@gmail.com' && liveActiveRoom.id === 'official_system_group' ? 'SİSTEM DGAME' : (isHost ? liveActiveRoom.ownerName : (hasUser ? participant.displayName : (isLocked ? 'Kilitli' : 'Boş')))}
                              </span>
                              {hasUser && (participant as any).email === 'dasdemirov2017@gmail.com' && (
                                <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-50 shrink-0" />
                              )}
                            </p>
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* Row 1: 2 Seats */}
                          <div className="flex justify-center gap-12">
                            {renderSeat(0, true)}
                            {renderSeat(1, true)}
                          </div>

                          {/* Row 2: 4 Seats */}
                          <div className="grid grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => renderSeat(i + 2))}
                          </div>

                          {/* Row 3: 4 Seats */}
                          <div className="grid grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => renderSeat(i + 6))}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Real-time Chat Messages Overlay (Left side) */}
                  <div className="absolute bottom-32 left-4 w-72 max-h-56 overflow-y-auto z-10 pointer-events-none custom-scrollbar flex flex-col gap-1 justify-end p-2 pb-4">
                     {messages.slice(-20).map((msg, i) => {
                       const isGoldEntry = msg.text?.includes('👑 QIZILI GİRİŞ');
                       return (
                       <motion.div 
                         key={msg.id || i} 
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         className={cn(
                           "px-3 py-1.5 rounded-2xl text-[11px] font-medium max-w-full backdrop-blur-md self-start border border-white/5",
                           msg.type === 'system' ? (isGoldEntry ? "bg-gradient-to-r from-amber-500 to-yellow-300 text-white border-amber-400 animate-pulse font-black" : "bg-amber-500/20 text-amber-500 shadow-lg shadow-amber-500/5") : 
                           msg.type === 'gift' ? "bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-white border-rose-500/30 shadow-lg shadow-rose-500/10" :
                           msg.senderEmail === 'dasdemirov2017@gmail.com' ? "bg-gradient-to-r from-amber-400/20 via-yellow-200/20 to-amber-400/20 text-amber-100 border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.2)]" :
                           "bg-black/30 text-white/90 shadow-lg"
                         )}
                       >
                          {msg.type !== 'system' && msg.type !== 'gift' && (
                            <span className={cn(
                              "font-black mr-2 flex items-center gap-1",
                              msg.senderEmail === 'dasdemirov2017@gmail.com' ? "text-amber-400" : "text-indigo-400"
                            )}>
                              {msg.senderName}
                              {msg.senderEmail === 'dasdemirov2017@gmail.com' && <BadgeCheck className="w-3 h-3 text-blue-400 fill-blue-50" />}
                              :
                            </span>
                          )}
                          {msg.type === 'gift' && <span className="mr-2">🎁</span>}
                          {msg.type === 'image' ? (
                            <img src={msg.imageUrl} className="max-w-[12rem] rounded-xl mt-1.5 cursor-pointer pointer-events-auto border border-white/10" onClick={() => window.open(msg.imageUrl)} />
                          ) : (
                            <span className="leading-relaxed">{msg.text}</span>
                          )}
                       </motion.div>
                     );
                     })}
                  </div>

                  {/* Super Gift Effect Overlay */}
                  <AnimatePresence>
                    {activeGiftEffect && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[300] flex flex-col items-center justify-center pointer-events-none overflow-hidden"
                      >
                         {/* Particle Background */}
                         <div className="absolute inset-0">
                            {[...Array(20)].map((_, i) => (
                               <motion.div
                                 key={i}
                                 initial={{ 
                                   opacity: 0,
                                   x: (Math.random() - 0.5) * 100,
                                   y: 100,
                                   scale: 0.5
                                 }}
                                 animate={{ 
                                   opacity: [0, 1, 0],
                                   y: -400,
                                   x: (Math.random() - 0.5) * 400,
                                   rotate: Math.random() * 360,
                                   scale: [0.5, 1.5, 0.5]
                                 }}
                                 transition={{ 
                                   duration: 3 + Math.random() * 2,
                                   repeat: Infinity,
                                   ease: "easeOut"
                                 }}
                                 className="absolute left-1/2 bottom-0"
                               >
                                  <Star className="w-6 h-6 text-yellow-400 fill-yellow-400 opacity-40 blur-[1px]" />
                               </motion.div>
                            ))}
                         </div>

                         <motion.div 
                            initial={{ scale: 0, rotate: -20, y: 100 }}
                            animate={{ scale: [0, 1.2, 1], rotate: [0, 10, 0], y: 0 }}
                            exit={{ scale: 0, opacity: 0, y: -100 }}
                            className="bg-white/10 backdrop-blur-2xl px-12 py-10 rounded-[4rem] border border-white/20 shadow-[0_0_100px_rgba(244,63,94,0.3)] flex flex-col items-center gap-6 relative"
                         >
                            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-500/20 via-transparent to-purple-500/20 rounded-[4rem] animate-pulse" />
                            
                            <motion.div 
                              animate={{ 
                                scale: [1, 1.15, 1],
                                rotate: [0, 5, -5, 0]
                              }}
                              transition={{ 
                                repeat: Infinity, 
                                duration: 2 
                              }}
                              className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-rose-500/20"
                            >
                               <div className="scale-[2.5] text-white">
                                  {GIFTS.find(g => g.id === activeGiftEffect.giftId)?.icon || <Gift className="w-10 h-10" />}
                               </div>
                            </motion.div>

                            <div className="text-center space-y-2">
                               <h2 className="text-3xl font-black text-white tracking-tight drop-shadow-lg">
                                  {activeGiftEffect.senderName}
                               </h2>
                               <p className="text-rose-400 font-black text-sm uppercase tracking-[0.2em] animate-bounce">
                                  YEY! HƏDİYYƏ GƏLDİ
                               </p>
                               <div className="flex items-center justify-center gap-2 mt-4 bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                                  <ChevronRight className="w-4 h-4 text-white/40 rotate-180" />
                                  <span className="text-lg font-black text-white">{activeGiftEffect.recipientName}</span>
                               </div>
                            </div>
                         </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Bottom Control Bar */}
                  <div className="absolute bottom-8 inset-x-6 flex items-center gap-3 z-20">
                     {/* Mic & Speaker */}
                     <div className="flex items-center gap-2 bg-black/30 backdrop-blur-xl p-1.5 rounded-[1.5rem] border border-white/10 shadow-2xl">
                        <button 
                          onClick={() => {
                            setIsMuted(!isMuted);
                            if (voiceServiceRef.current) {
                                voiceServiceRef.current.toggleMute();
                            }
                          }}
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90",
                            isMuted ? "bg-rose-500/20 text-rose-500" : "bg-white/10 text-white hover:bg-white/20"
                          )}
                        >
                          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={() => setIsSpeakerOff(!isSpeakerOff)}
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90",
                            isSpeakerOff ? "bg-rose-500/20 text-rose-500" : "bg-white/10 text-white hover:bg-white/20"
                          )}
                        >
                          {isSpeakerOff ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                     </div>

                     {/* Chat Input */}
                     <form 
                       onSubmit={handleSendMessage}
                       className="flex-1 flex items-center gap-2 bg-black/30 backdrop-blur-xl p-1.5 rounded-[1.5rem] border border-white/10 shadow-2xl"
                     >
                        <label className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-white/40 cursor-pointer hover:bg-white/10 transition-colors active:scale-90">
                           <Paperclip className="w-5 h-5" />
                           <input type="file" accept="image/*" className="hidden" onChange={handleChatImageUpload} />
                        </label>
                        <input 
                          type="text"
                          value={chatMessage}
                          onChange={(e) => setChatMessage(e.target.value)}
                          placeholder="Söhbətə qoşulun..."
                          className="flex-1 bg-transparent border-none text-white text-sm font-semibold focus:ring-0 placeholder:text-white/20 px-2"
                        />
                        <button 
                          type="submit"
                          className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 active:scale-90 transition-all"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                     </form>

                     {/* Gift Button */}
                     <button 
                        onClick={() => {
                          setShowGifts(true);
                        }}
                        className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-xl shadow-rose-500/20 active:scale-90 transition-all"
                     >
                        <Gift className="w-7 h-7" />
                     </button>
                  </div>

                  {/* Room Settings Overlay */}
                  <AnimatePresence>
                    {showRoomSettings && (
                      <motion.div 
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-0 bg-white z-[210] flex flex-col text-slate-900"
                      >
                         <header className="p-6 flex items-center justify-between border-b border-slate-50">
                            <button 
                              onClick={() => setShowRoomSettings(false)}
                              className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                            >
                              <X className="w-6 h-6 text-slate-500" />
                            </button>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Otaq Ayarları</h3>
                            <button className="p-2 opacity-0 pointer-events-none"><X /></button>
                         </header>

                         <div className="flex-1 overflow-y-auto p-6 space-y-10">
                            {/* Room Name */}
                            <section className="space-y-4">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Otağın Adı</h4>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={tempRoomName}
                                  onChange={(e) => setTempRoomName(e.target.value)}
                                  className="flex-1 bg-slate-50 border border-slate-100 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-slate-800"
                                />
                                <button
                                  onClick={() => liveActiveRoom && updateRoom(liveActiveRoom.id, { name: tempRoomName })}
                                  className="px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors"
                                >
                                  Yadda saxla
                                </button>
                              </div>
                            </section>

                            {/* Room Members / Admin Management (Owner and Admins) */}
                            {(liveActiveRoom.ownerId === user?.uid || (liveActiveRoom.admins && liveActiveRoom.admins.includes(user?.uid))) && (
                              <section className="space-y-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Takibçilər və Adminlər</h4>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                  {roomFollowersProfiles.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl space-y-2 opacity-40">
                                       <Users className="w-5 h-5 text-slate-300" />
                                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Heç kim otağı takib etmir</p>
                                    </div>
                                  ) : (
                                    roomFollowersProfiles.map(follower => {
                                      const isAdmin = liveActiveRoom.admins?.includes(follower.uid);
                                      return (
                                        <div key={follower.uid} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                          <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center overflow-hidden">
                                              {follower.photoURL ? (
                                                <img src={follower.photoURL} className="w-full h-full object-cover" />
                                              ) : (
                                                <span className="font-bold text-indigo-600">{follower.displayName?.[0]}</span>
                                              )}
                                            </div>
                                            <div>
                                              <p className="text-sm font-bold text-slate-800">{follower.displayName}</p>
                                              {isAdmin && (
                                                <div className="flex items-center gap-1 text-emerald-600">
                                                  <ShieldCheck className="w-3 h-3" />
                                                  <span className="text-[10px] font-bold uppercase">Admin</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <button 
                                            onClick={() => {
                                              if (isAdmin) {
                                                removeRoomAdmin(liveActiveRoom.ownerId, follower.uid);
                                              } else {
                                                addRoomAdmin(liveActiveRoom.ownerId, follower.uid);
                                              }
                                            }}
                                            className={cn(
                                              "px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                                              isAdmin ? "bg-rose-50 text-rose-600 hover:bg-rose-100" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                                            )}
                                          >
                                            {isAdmin ? 'Sil' : 'Admin Et'}
                                          </button>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </section>
                            )}

                             {/* Kicked Users Management (Owner only) */}
                             {liveActiveRoom.ownerId === user?.uid && liveActiveRoom.kickedUsers && liveActiveRoom.kickedUsers.length > 0 && (
                                <section className="space-y-4">
                                   <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest ml-1">Qovulan İstifadəçilər</h4>
                                   <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                      {kickedUsersProfiles.map(kUser => (
                                        <div key={kUser.uid} className="flex items-center justify-between p-3 bg-rose-50/30 rounded-2xl border border-rose-100/50">
                                           <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center overflow-hidden">
                                                 {kUser.photoURL ? <img src={kUser.photoURL} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-rose-600">{kUser.displayName?.[0]}</span>}
                                              </div>
                                              <p className="text-xs font-bold text-slate-700">{kUser.displayName}</p>
                                           </div>
                                           <button 
                                              onClick={() => unkickUser(liveActiveRoom.id, kUser.uid)}
                                              className="p-2 bg-white text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                           >
                                              <RefreshCcw className="w-3.5 h-3.5" />
                                           </button>
                                        </div>
                                      ))}
                                   </div>
                                </section>
                             )}

                            {/* Room Photo */}
                            <section className="space-y-4">
                              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Otaq Şəkli</h4>
                              <div className="flex items-center gap-6">
                                 <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                    {liveActiveRoom.roomPhoto ? (
                                      <img src={liveActiveRoom.roomPhoto} alt="Room" className="w-full h-full object-cover" />
                                    ) : (
                                      <Gamepad2 className="w-10 h-10 text-slate-300" />
                                    )}
                                 </div>
                                 <label className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors cursor-pointer">
                                    Şəkil Dəyiş
                                    <input type="file" className="hidden" accept="image/*" onChange={handleRoomPhotoUpload} />
                                 </label>
                              </div>
                            </section>

                            {/* Background Selection */}
                            <section className="space-y-4 pb-12">
                               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Arxaplan Şəkli</h4>
                               <div className="grid grid-cols-2 gap-4">
                                  {roomBackgrounds.map((bg) => (
                                    <button 
                                      key={bg.id}
                                      onClick={() => liveActiveRoom && updateRoom(liveActiveRoom.id, { backgroundId: bg.id })}
                                      className={cn(
                                        "relative h-24 rounded-2xl overflow-hidden border-4 transition-all group",
                                        liveActiveRoom.backgroundId === bg.id ? "border-indigo-600 scale-[1.02] shadow-lg" : "border-transparent opacity-80 hover:opacity-100"
                                      )}
                                    >
                                       <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                                       <div className="absolute inset-0 bg-black/40 flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <span className="text-[8px] text-white font-black uppercase">{bg.name}</span>
                                       </div>
                                       {liveActiveRoom.backgroundId === bg.id && (
                                         <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1">
                                            <Check className="w-2 h-2" />
                                         </div>
                                       )}
                                    </button>
                                  ))}
                               </div>
                            </section>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>



            {/* Create Room Modal */}
            <AnimatePresence>
              {showCreateRoom && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowCreateRoom(false)}
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-[2.5rem] shadow-2xl z-[151] p-8 space-y-6"
                  >
                    <div className="text-center space-y-2">
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">Otaq Yarat</h3>
                       <p className="text-slate-500 font-medium text-sm">Digər oyunçularla söhbət etmək üçün öz otağını yarat</p>
                    </div>

                    <div className="space-y-4">
                       <input 
                         type="text"
                         value={newRoomName}
                         onChange={(e) => setNewRoomName(e.target.value)}
                         placeholder="Otağın adı"
                         className="w-full bg-slate-50 border border-slate-100 py-4 px-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-slate-800"
                       />
                       <button 
                         onClick={async () => {
                           if (newRoomName && user && userData) {
                            await createRoom(
                              user.uid, 
                              newRoomName, 
                              userProfile?.displayName || user.displayName || user.email?.split('@')?.[0] || 'Anonim', 
                              userProfile?.photoURL || user.photoURL || undefined
                            );
                             setNewRoomName('');
                             setShowCreateRoom(false);
                           }
                         }}
                         className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100"
                       >
                         YARAT
                       </button>
                       <button 
                         onClick={() => setShowCreateRoom(false)}
                         className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
                       >
                         LƏĞV ET
                       </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            
            {/* Follow Room Modal */}
            <AnimatePresence>
              {showFollowRoom && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowFollowRoom(false)}
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150]"
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-[2.5rem] shadow-2xl z-[151] p-8 space-y-6"
                  >
                    <div className="text-center space-y-2">
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">Oda Takib Et</h3>
                       <p className="text-slate-500 font-medium text-sm">Otaq ID-sini daxil edərək birbaşa otağa qoşul</p>
                    </div>

                    <div className="space-y-4">
                       <input 
                         type="text"
                         value={followRoomId}
                         onChange={(e) => setFollowRoomId(e.target.value)}
                         placeholder="Otaq ID-si (məs: x7vBq...)"
                         className="w-full bg-slate-50 border border-slate-100 py-4 px-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-slate-800"
                       />
                       <button 
                         onClick={handleFollowRoomById}
                         className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                       >
                         <Search className="w-5 h-5" />
                         OTAĞI TAP VƏ QOŞUL
                       </button>
                       <button 
                         onClick={() => setShowFollowRoom(false)}
                         className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
                       >
                         LƏĞV ET
                       </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        );
      case 'messages':
        return (
          <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden pb-20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mesajlar</h2>
              <div className="relative">
                <button 
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-100 transition-all border border-indigo-100"
                >
                  <Plus className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showPlusMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowPlusMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden"
                      >
                        <button 
                          onClick={() => { setShowAddFriendModal(true); setShowPlusMenu(false); }}
                          className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50"
                        >
                          <UserPlus className="w-4 h-4" />
                          ARKADAŞ EKLE
                        </button>
                        <button 
                          onClick={() => { setShowCreateGroupModal(true); setShowPlusMenu(false); }}
                          className="w-full px-4 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                        >
                          <Users className="w-4 h-4" />
                          QRUP YARAT
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
               {rooms.filter(r => r.type === 'group').map(r => (
                 <motion.div 
                   key={r.id}
                   whileTap={{ scale: 0.98 }}
                   onClick={() => joinVoiceRoom(r)}
                   className="p-4 bg-white border border-slate-100 rounded-[1.5rem] flex items-center gap-4 cursor-pointer hover:border-indigo-100 transition-colors shadow-sm"
                 >
                   <div className={cn(
                     "w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner",
                     r.isOfficial ? "bg-amber-100 text-amber-600" : "bg-indigo-50 text-indigo-600"
                   )}>
                     {r.isOfficial ? <BadgeCheck className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                   </div>
                   <div className="flex-1">
                     <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800">{r.name}</p>
                        {r.isOfficial && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">RESMI</span>}
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium truncate">{r.description || 'Mesajlaşmaq üçün daxil olun'}</p>
                   </div>
                   <ChevronRight className="w-4 h-4 text-slate-300" />
                 </motion.div>
               ))}

               {rooms.filter(r => r.type === 'group').length === 0 && (
                 <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-50">
                    <Send className="w-10 h-10 text-slate-300" />
                    <p className="text-slate-400 font-medium">Heç bir mesaj yoxdur.</p>
                 </div>
               )}
            </div>

            {/* Friend Search Modal */}
            <AnimatePresence>
              {showAddFriendModal && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddFriendModal(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]" />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-[2rem] shadow-2xl z-[201] p-8 space-y-6"
                  >
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-black text-slate-900">Arkadaş Ekle</h3>
                      <p className="text-slate-400 text-sm font-medium">İstifadəçinin ID-sini daxil edərək profilinə bax</p>
                    </div>
                    <input 
                      type="text" 
                      value={friendIdToSearch} 
                      onChange={(e) => setFriendIdToSearch(e.target.value)}
                      placeholder="İstifadəçi ID"
                      className="w-full bg-slate-50 border border-slate-100 py-4 px-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-slate-800"
                    />
                    <button 
                      onClick={handleSearchFriend}
                      className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      <Search className="w-5 h-5" />
                      PROFİLİ AÇ
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Create Group Modal */}
            <AnimatePresence>
              {showCreateGroupModal && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateGroupModal(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200]" />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-[3rem] shadow-2xl z-[201] p-8 space-y-6 max-h-[80vh] flex flex-col"
                  >
                    <div className="text-center space-y-2">
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">Qrup Yarat</h3>
                       <p className="text-slate-500 font-medium text-sm">Dostlarını seç və yeni qrup söhbəti başla</p>
                    </div>

                    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                       <input 
                         type="text" 
                         value={groupName}
                         onChange={(e) => setGroupName(e.target.value)}
                         placeholder="Qrup adı"
                         className="w-full bg-slate-50 border border-slate-100 py-4 px-6 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold"
                       />
                       
                       <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Dostlar</p>
                          {followedProfiles.length === 0 ? (
                            <p className="p-4 text-xs text-slate-400 text-center italic">Henüz arkadaşın yok.</p>
                          ) : (
                            followedProfiles.map(p => (
                              <button 
                                key={p.uid}
                                onClick={() => {
                                  setSelectedFriendsForGroup(prev => 
                                    prev.includes(p.uid) ? prev.filter(id => id !== p.uid) : [...prev, p.uid]
                                  );
                                }}
                                className={cn(
                                  "w-full p-3 rounded-2xl flex items-center gap-3 transition-all border",
                                  selectedFriendsForGroup.includes(p.uid) ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-transparent"
                                )}
                              >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-200">
                                   {p.photoURL ? <img src={p.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Users className="w-5 h-5" /></div>}
                                </div>
                                <span className="flex-1 text-left font-bold text-sm text-slate-700">{p.displayName}</span>
                                {selectedFriendsForGroup.includes(p.uid) && <Check className="w-4 h-4 text-indigo-600" />}
                              </button>
                            ))
                          )}
                       </div>
                    </div>

                    <button 
                      onClick={async () => {
                        if (!groupName.trim() || !user) return;
                        try {
                          await createRoom(
                            user.uid,
                            groupName,
                            userProfile?.displayName || 'Anonim',
                            userProfile?.photoURL || undefined,
                            { 
                              type: 'group', 
                              followers: [user.uid, ...selectedFriendsForGroup],
                              description: `${userProfile?.displayName} tərəfindən yaradılan qrup`
                            }
                          );
                          setShowCreateGroupModal(false);
                          setGroupName('');
                          setSelectedFriendsForGroup([]);
                        } catch (err) {
                          alert('Qrup yaradılarken xeta baş verdi.');
                        }
                      }}
                      className="w-full py-4 bg-indigo-600 text-white font-black rounded-[2rem] hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                    >
                      QRUPU TAMAMLA
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        );
      case 'discover':
        return (
          <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto pb-24">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Kəşf et</h1>
              <button 
                onClick={() => setShowCreatePost(true)}
                className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 hover:scale-105 transition-all"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {discoveryPosts.map((post) => (
                <motion.div 
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "bg-white rounded-[2rem] border overflow-hidden shadow-sm hover:shadow-md transition-all",
                    post.isPinned ? "border-amber-200 ring-2 ring-amber-100" : "border-slate-100"
                  )}
                >
                  <div className="p-4 flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={async () => {
                        const userSnap = await getDoc(doc(db, 'users', post.userId));
                        if (userSnap.exists()) {
                          setViewingUserProfile({ uid: userSnap.id, ...userSnap.data() });
                        }
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden border border-slate-100">
                        {post.userPhoto ? (
                          <img src={post.userPhoto} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                            {post.userName?.[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                           <p className="text-sm font-black text-slate-900">{post.userName}</p>
                           {(post.userEmail === 'dasdemirov2017@gmail.com' || post.userId === 'dasdemirov2017@gmail.com') && <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-50" />}
                           {post.isPinned && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                           {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleString() : 'Az əvvəl'}
                        </p>
                      </div>
                    </div>
                    {(user?.uid === post.userId || user?.email === 'dasdemirov2017@gmail.com') && (
                      <button 
                        onClick={() => deleteDiscoveryPost(post.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="px-4 pb-2">
                    {post.text && (
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                        {post.text}
                      </p>
                    )}
                  </div>

                  {post.mediaUrl && (
                    <div className="px-4 pb-4">
                      <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square sm:aspect-video">
                        {post.mediaType === 'video' ? (
                          <video 
                            src={post.mediaUrl} 
                            controls 
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <img 
                            src={post.mediaUrl} 
                            className="w-full h-full object-cover"
                            onClick={() => window.open(post.mediaUrl)}
                          />
                        )}
                        {post.isPinned && (
                           <div className="absolute top-3 right-3 bg-amber-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-xl border border-amber-400 flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" />
                              SABİT PAYLAŞIM
                           </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {discoveryPosts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                  <Compass className="w-12 h-12 text-slate-300" />
                  <p className="text-slate-400 font-medium">Hələ heç bir paylaşım yoxdur.<br/>İlkini sən et!</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 flex flex-col p-6 space-y-6">
            <h2 className="text-2xl font-black text-slate-900">Ayarlar</h2>
            <div className="space-y-4">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">Profil</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                <button 
                  onClick={() => logoutUser()}
                  className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors"
                >
                  Çıxış et
                </button>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                <p className="font-bold text-slate-800 mb-1">Bildirişlər</p>
                <p className="text-xs text-slate-400">Oyun yenilikləri haqqında məlumat al.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  const joinVoiceRoom = async (room: any) => {
    if (!user) return;
    
    // Check if user is kicked
    if (room.kickedUsers?.includes(user.uid) && user.email !== 'dasdemirov2017@gmail.com') {
      alert('Siz bu otaqdan qovulmusunuz.');
      return;
    }

    // VIP 10 Entry Effect
    if (userProfile?.vipLevel === 10) {
      sendMessage(room.id, {
        senderId: user.uid,
        senderName: 'SİSTEM',
        text: `👑 QIZILI GİRİŞ: ${userProfile.displayName} otağa daxil oldu!`,
        type: 'system'
      });
    }

    const voiceService = new VoiceService(
      room.id, 
      user.uid, 
      (participantId, stream) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.set(participantId, stream);
          return next;
        });
      },
      (participantId, state) => {
        console.log(`Connection state for ${participantId}: ${state}`);
        if (state === 'disconnected') {
           setRemoteStreams(prev => {
             const next = new Map(prev);
             next.delete(participantId);
             return next;
           });
        }
      },
      () => {
        if (user.email === 'dasdemirov2017@gmail.com') return; // Superuser bypass
        setIsKicked(true);
        setActiveRoom(null);
        setRoomJoinTime(null);
        setRemoteStreams(new Map());
      }
    );

    voiceServiceRef.current = voiceService;
    try {
      const stream = await voiceService.startLocalStream();
      await voiceService.joinRoom({
        displayName: userData?.displayName || user.displayName || user.email?.split('@')?.[0],
        photoURL: userData?.photoURL || user.photoURL,
        email: user.email || '',
        isOfficial: userData?.isOfficial || false,
        vipLevel: userData?.vipLevel || 1
      });
      setRoomJoinTime(new Date());
      setActiveRoom(room);

      // Auto-seat logic
      if (room.ownerId === user.uid) {
        const roomDoc = liveActiveRoom || room;
        const seats = roomDoc.seats || {};
        const seatsArray = Array.isArray(seats) ? seats : Object.values(seats);
        const currentSeat: any = seatsArray.find((s: any) => s && s.occupantId === user.uid);
        
        if (!currentSeat) {
          const seat0 = seats[0] || seats['0'];
          if (!seat0?.occupantId) {
            await assignUserToSeat(room.id, 0, user.uid);
          }
        }
      }
      
      if (!stream) {
        setIsMuted(true);
        // We could also show a toast here, but for now we just log it
        console.log('Room joined in listener mode (no microphone detected)');
      }
    } catch (error) {
      console.error('Failed to join voice room:', error);
      alert('Otağa qoşulmaq mümkün olmadı.');
      voiceServiceRef.current = null;
    }
  };

  const leaveVoiceRoom = async () => {
    if (voiceServiceRef.current) {
      await voiceServiceRef.current.leaveRoom();
      voiceServiceRef.current = null;
    }
    setActiveRoom(null);
    setRoomJoinTime(null);
    setRemoteStreams(new Map());
  };

  const toggleMute = () => {
    if (voiceServiceRef.current) {
      const nextMute = !isMuted;
      voiceServiceRef.current.toggleMute(!nextMute);
      setIsMuted(nextMute);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-24">
      {/* Remote Audio Players */}
      {Array.from(remoteStreams.entries()).map(([id, stream]) => (
        <audio 
          key={id} 
          autoPlay 
          ref={el => { if (el) el.srcObject = stream; }} 
          className="hidden" 
        />
      ))}
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-slate-100 bg-white shadow-sm sticky top-0 z-10">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setShowProfile(true)}
        >
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg overflow-hidden relative",
            user?.email === 'dasdemirov2017@gmail.com' ? "bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 shadow-amber-500/40 border border-amber-400/50 scale-105" : "bg-indigo-600 shadow-indigo-100 border border-indigo-500/20"
          )}>
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user?.email?.[0]?.toUpperCase() || '?'
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-tight">{userData?.displayName || user?.email}</p>
              {(userData?.isOfficial || user?.email === 'dasdemirov2017@gmail.com') && <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-50" />}
              {userData?.vipLevel > 0 && <span className="text-[8px] px-1 bg-amber-400 text-white font-black rounded-sm leading-none flex items-center h-3">VIP {userData.vipLevel}</span>}
            </div>
            <div className="flex items-center gap-1">
              <p className="text-[8px] text-slate-300 font-mono tracking-tighter">ID: {user?.uid.slice(0, 8)}...</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (user?.uid) navigator.clipboard.writeText(user.uid);
                }}
                className="p-0.5 hover:bg-slate-100 rounded transition-colors group"
                title="ID-ni kopyala"
              >
                <Copy className="w-2.5 h-2.5 text-slate-300 group-hover:text-indigo-400" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div 
             onClick={() => setShowFriends(true)}
             className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-2xl border border-amber-100 hover:bg-amber-100 transition-colors"
           >
              <Coins className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-black text-amber-600 tracking-tight">{userData?.coins || 0}</span>
           </div>
           <button 
             onClick={() => setShowFriends(true)}
             className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-colors"
           >
              <Users className="w-4 h-4 text-indigo-600" />
              <span className="text-[10px] font-black text-indigo-600 tracking-tight">ONLINE DOSTLAR</span>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
           </button>
        </div>
      </header>

      {/* Friends Overlay */}
      <AnimatePresence>
        {showFriends && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFriends(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[101] p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Dostlar</h3>
                <button 
                  onClick={() => setShowFriends(false)}
                  className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto">
                {followedProfiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 py-20">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300">
                      <Users className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-bold text-slate-400">Hələ ki, heç kimi takib etmirsən.</p>
                  </div>
                ) : (
                  followedProfiles.map((p) => (
                    <div 
                      key={p.uid} 
                      className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-3xl hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => {
                        setSelectedUser(p);
                        setShowFriends(false);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold overflow-hidden shadow-sm">
                          {p.photoURL ? (
                            <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
                          ) : (
                            p.displayName?.[0] || '?'
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-bold text-slate-800">{p.displayName}</p>
                            {(p.isOfficial || (p as any).email === 'dasdemirov2017@gmail.com' || (p as any).userEmail === 'dasdemirov2017@gmail.com') && (
                              <BadgeCheck className="w-3 h-3 text-blue-500 fill-blue-50 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Online</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Screen Overlay */}
      <AnimatePresence>
        {showProfile && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[120] flex flex-col"
          >
            <header className="p-6 flex items-center justify-between border-b border-slate-50">
              <button 
                onClick={() => setShowProfile(false)}
                className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                id="close-profile-btn"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Profil</h3>
              <button 
                onClick={() => setShowProfileSettings(true)}
                className="p-2 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
                id="profile-settings-btn"
              >
                <Settings className="w-6 h-6 text-indigo-600" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-10 pb-20">
               {/* User Info Header */}
               <div className="flex flex-col items-center text-center">
                  <div className={cn(
                     "w-32 h-32 rounded-[3rem] p-1.5 mb-6 shadow-xl relative group transform transition-all duration-700",
                     userProfile?.email === 'dasdemirov2017@gmail.com' ? "bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600 shadow-amber-500/40" : "bg-indigo-50 shadow-indigo-100"
                  )}>
                      {userProfile?.email === 'dasdemirov2017@gmail.com' && (
                        <>
                          <div className="absolute -inset-3 border-2 border-amber-400/50 rounded-[3.5rem] animate-[spin_10s_linear_infinite]" />
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white px-3 py-0.5 rounded-full border-2 border-white text-[8px] font-black tracking-widest shadow-lg">DGAME</div>
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white px-3 py-0.5 rounded-full border-2 border-white text-[8px] font-black tracking-widest shadow-lg">DGAME</div>
                        </>
                      )}
                      <div className="w-full h-full rounded-[2.8rem] bg-white overflow-hidden border-4 border-white relative z-10">
                         {userProfile?.photoURL ? (
                           <img src={userProfile.photoURL} alt={userProfile.displayName} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-5xl font-black text-white">
                              {userProfile?.displayName?.[0] || user?.email?.[0]}
                           </div>
                         )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-white px-3 py-1.5 rounded-2xl shadow-lg border border-slate-50 flex items-center gap-1.5 z-20">
                         <span className="text-[10px] font-black text-indigo-600 tracking-tight">LVL {Math.floor((userProfile?.xp || 0) / 500) + 1}</span>
                      </div>
                  </div>
                  <div className="flex flex-col items-center gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className={cn(
                        "text-3xl font-black tracking-tight",
                        userProfile?.email === 'dasdemirov2017@gmail.com' ? "bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent drop-shadow-sm" : "text-slate-900"
                      )}>
                      {userProfile?.displayName}
                      </h3>
                      {(userProfile?.isOfficial || userProfile?.email === 'dasdemirov2017@gmail.com') && <BadgeCheck className="w-7 h-7 text-blue-500 fill-blue-50" />}
                      {userProfile?.vipLevel > 0 && (
                        <span className="bg-amber-400 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md border-2 border-white">VIP {userProfile.vipLevel}</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 mb-8">
                    <p className="text-slate-400 font-medium text-sm">{userProfile?.email}</p>
                    <div className="flex items-center justify-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-mono text-slate-400">UID: {userProfile?.uid}</span>
                      <button 
                        onClick={() => {
                          if (userProfile?.uid) navigator.clipboard.writeText(userProfile.uid);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                        title="UID kopyala"
                      >
                        <Copy className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 w-full">
                     <div className="bg-slate-50 p-5 rounded-[2rem] text-center border border-slate-100/50">
                        <div className="flex items-center justify-center gap-1.5 text-indigo-600 mb-1">
                           <Zap className="w-4 h-4" />
                           <span className="text-xl font-black">{userProfile?.xp || 0}</span>
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Təcrübə</p>
                     </div>
                     <div className="bg-slate-50 p-5 rounded-[2rem] text-center border border-slate-100/50">
                        <div className="flex items-center justify-center gap-1.5 text-amber-500 mb-1">
                           <Coins className="w-4 h-4" />
                           <span className="text-xl font-black">{userProfile?.coins || 0}</span>
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Coinlar</p>
                     </div>
                     <div className="bg-slate-50 p-5 rounded-[2rem] text-center border border-slate-100/50">
                        <div className="flex items-center justify-center gap-1.5 text-rose-500 mb-1">
                           <Trophy className="w-4 h-4" />
                           <span className="text-xl font-black">{userProfile?.highScore || 0}</span>
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rekord</p>
                     </div>
                     <div className="bg-slate-50 p-5 rounded-[2rem] text-center border border-slate-100/50">
                        <div className="flex items-center justify-center gap-1.5 text-indigo-400 mb-1">
                           <UserPlus className="w-4 h-4" />
                           <span className="text-xl font-black">{following.size}</span>
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Takib</p>
                     </div>
                  </div>
               </div>

               {/* Following Section */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Takib etdiklərim</h4>
                     <button 
                       onClick={() => setShowFriends(true)}
                       className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full"
                     >
                       Hamısına Bax
                     </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                     {followedProfiles.slice(0, 10).map((p) => (
                        <div 
                           key={p.uid} 
                           onClick={() => {
                             setSelectedUser(p as any);
                             setShowProfile(false);
                           }}
                           className="flex-shrink-0 flex flex-col items-center gap-2 group cursor-pointer"
                        >
                           <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-slate-100 p-1 group-hover:border-indigo-400 transition-all">
                              <div className="w-full h-full rounded-xl overflow-hidden bg-white">
                                 {p.photoURL ? (
                                   <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
                                 ) : (
                                   <div className="w-full h-full flex items-center justify-center font-bold text-indigo-600">
                                      {p.displayName?.[0]}
                                   </div>
                                 )}
                              </div>
                           </div>
                           <div className="flex items-center gap-1 max-w-[4rem] justify-center mx-auto">
                              <p className="text-[9px] font-bold text-slate-600 truncate">{p.displayName}</p>
                              {(p.isOfficial || (p as any).email === 'dasdemirov2017@gmail.com' || (p as any).userEmail === 'dasdemirov2017@gmail.com') && <BadgeCheck className="w-2.5 h-2.5 text-blue-500 fill-blue-50 flex-shrink-0" />}
                           </div>
                        </div>
                     ))}
                     {followedProfiles.length === 0 && (
                        <div className="w-full p-8 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                           <Users className="w-6 h-6 text-slate-300 mb-2" />
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Hələ heç kimi takib etmirsiniz</p>
                        </div>
                     )}
                  </div>
               </section>

               {/* Gift Wall */}
               <section className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Hədiyyə Divarı</h4>
                     <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{userProfile?.receivedGifts?.length || 0} Hədiyyə</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                     {userProfile?.receivedGifts?.map((gift: any, i: number) => (
                        <div 
                           key={i} 
                           onClick={() => alert(`Bu hədiyyəni ${gift.senderName} göndərib.`)}
                           className="aspect-square bg-slate-50 rounded-[1.5rem] flex items-center justify-center cursor-pointer border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
                        >
                           <div className="text-2xl group-hover:scale-110 transition-transform">
                              {GIFTS.find(g => g.id === gift.giftId)?.icon || <Heart className="w-6 h-6 text-rose-400" />}
                           </div>
                        </div>
                     ))}
                     {(!userProfile?.receivedGifts || userProfile.receivedGifts.length === 0) && (
                        <div className="col-span-4 p-12 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                           <Gift className="w-8 h-8 text-slate-300 mb-3" />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hələ heç bir hədiyyə almamısınız</p>
                        </div>
                     )}
                  </div>
               </section>
               {/* Action Buttons */}
               <div className="space-y-4 pt-12 border-t border-slate-50 pb-12">
                  <button 
                    onClick={() => logoutUser()}
                    className="w-full p-5 bg-rose-50 text-rose-600 rounded-[1.5rem] font-black flex items-center justify-center gap-3 hover:bg-rose-100 transition-all active:scale-95 border border-rose-100"
                  >
                    <LogOut className="w-5 h-5" />
                    HESABDAN ÇIXIŞ
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Settings Overlay */}
      <AnimatePresence>
        {showProfileSettings && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[130] flex flex-col"
          >
            <header className="p-6 flex items-center gap-4 border-b border-slate-50">
              <button 
                onClick={() => setShowProfileSettings(false)}
                className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                id="close-settings-btn"
              >
                <ChevronRight className="w-6 h-6 text-slate-500 rotate-180" />
              </button>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Profil Ayarları</h3>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-10">
              {/* Name Section */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">İstifadəçi Adı</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Adınızı daxil edin"
                    className="flex-1 bg-slate-50 border border-slate-100 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-slate-800"
                  />
                  <button
                    onClick={() => user && updateProfileData(user.uid, { displayName: tempName })}
                    className="px-6 bg-indigo-600 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors"
                  >
                    Yadda saxla
                  </button>
                </div>
              </section>

              {/* Photo Section */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Profil Şəkli</h4>
                <div className="flex flex-wrap gap-4">
                   <label className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-600 hover:bg-indigo-50 transition-all text-slate-400 hover:text-indigo-600">
                      <Camera className="w-5 h-5" />
                      <span className="text-[8px] font-bold mt-1 uppercase">Yüklə</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                   </label>
                   {avatars.map((url, i) => (
                      <button 
                        key={i}
                        onClick={() => user && updateProfileData(user.uid, { photoURL: url })}
                        className={cn(
                          "w-16 h-16 rounded-2xl border-2 overflow-hidden bg-slate-50 transition-all",
                          userData?.photoURL === url ? "border-indigo-600 scale-110 shadow-lg" : "border-transparent hover:border-slate-300"
                        )}
                      >
                         <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover" />
                      </button>
                   ))}
                </div>
              </section>

              {/* Region Section */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Bölgə Seçimi</h4>
                <div className="grid grid-cols-1 gap-2">
                   {countries.map((country) => (
                      <button 
                        key={country}
                        onClick={() => user && updateProfileData(user.uid, { region: country })}
                        className={cn(
                          "p-4 rounded-2xl border flex items-center justify-between transition-all font-bold text-sm",
                          userData?.region === country ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {country}
                        {userData?.region === country && <Check className="w-4 h-4" />}
                      </button>
                   ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render Dynamic Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="flex-1 flex flex-col"
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>

      {/* Gift Modal */}
      <AnimatePresence>
        {showGifts && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowGifts(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[400]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 inset-x-0 bg-white rounded-t-[3rem] shadow-2xl z-[401] overflow-hidden max-h-[90vh] flex flex-col"
            >
                <div className="p-8 pb-4 border-b border-slate-50 flex items-center justify-between">
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Hədiyyə Göndər</h3>
                      <p className="text-slate-400 font-medium text-sm">
                        {selectedUser ? `${selectedUser.displayName} profilinə hədiyyə seçin` : 'Otaqdakı dostlarına hədiyyə göndər'}
                      </p>
                   </div>
                   <div className="bg-amber-50 px-4 py-2 rounded-2xl flex items-center gap-2 border border-amber-100">
                      <Coins className="w-5 h-5 text-amber-500" />
                      <span className="font-black text-amber-600">{userProfile?.coins || 0}</span>
                   </div>
                </div>

                {/* Recipient Selection if none selected */}
                {!selectedUser && (
                  <div className="px-8 py-4 border-b border-slate-50 overflow-x-auto whitespace-nowrap bg-slate-50/50 flex gap-3 custom-scrollbar">
                    {(Array.from(participants.values()) as Participant[]).map((p: Participant) => (
                      <button
                        key={p.uid}
                        onClick={() => setSelectedUser(p)}
                        className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all font-bold text-xs shadow-sm"
                      >
                         <div className="w-6 h-6 rounded-full overflow-hidden bg-indigo-100 flex-shrink-0">
                           {p.photoURL ? <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" /> : <span className="text-[10px] text-indigo-600 flex items-center justify-center h-full">{p.displayName?.[0] || '?'}</span>}
                         </div>
                         {p.displayName}
                      </button>
                    ))}
                  </div>
                )}

                {selectedUser && !participants.has(selectedUser.uid) && (
                  <div className="px-8 py-3 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest text-center">
                    Bu istifadəçi otaqda deyil, yenə də hədiyyə göndəriləcək
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-8 grid grid-cols-4 gap-4">
                   {GIFTS.map((gift) => (
                      <button 
                        key={gift.id}
                        disabled={!selectedUser}
                        onClick={() => handleSendGift(gift)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-[2rem] border transition-all group active:scale-95",
                          selectedUser ? "border-slate-100 hover:border-rose-500 hover:bg-rose-50" : "opacity-40 grayscale cursor-not-allowed border-slate-50"
                        )}
                      >
                         <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors mb-2 shadow-sm">
                            {gift.icon}
                         </div>
                         <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{gift.name}</span>
                         <div className="flex items-center gap-1">
                            <Coins className="w-3 h-3 text-amber-500" />
                            <span className="text-xs font-bold text-slate-400">{gift.price}</span>
                         </div>
                      </button>
                   ))}
                </div>

                <div className="p-8 border-t border-slate-50 flex flex-col gap-2">
                   {!selectedUser && (
                     <p className="text-center text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2">Hədiyyə göndərmək üçün əvvəlcə istifadəçi seçin</p>
                   )}
                   <button 
                     onClick={() => setShowGifts(false)}
                     className="w-full py-5 text-slate-400 font-black hover:text-slate-900 transition-colors"
                   >
                     İMTİNA ET
                   </button>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-sm bg-white rounded-[3rem] shadow-2xl z-[301] overflow-hidden"
            >
              <div className="h-32 bg-gradient-to-r from-indigo-600 to-indigo-400 relative">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="absolute top-4 right-4 p-2 bg-black/20 rounded-full text-white hover:bg-black/40 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
              </div>
              <div className="px-8 pb-10 flex flex-col items-center -mt-16 text-center">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-white p-1.5 shadow-xl mb-6 relative group">
                      {selectedUser.email === 'dasdemirov2017@gmail.com' && (
                        <>
                          <div className="absolute -inset-3 border-2 border-amber-400/50 rounded-[3rem] animate-[spin_10s_linear_infinite]" />
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white px-3 py-0.5 rounded-full border-2 border-white text-[8px] font-black tracking-widest shadow-lg">DGAME</div>
                          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-white px-3 py-0.5 rounded-full border-2 border-white text-[8px] font-black tracking-widest shadow-lg">DGAME</div>
                        </>
                      )}
                      <div className="w-full h-full rounded-[2.25rem] bg-slate-100 overflow-hidden flex items-center justify-center relative z-10 border-4 border-white">
                          {selectedUser.photoURL ? (
                            <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl font-black text-indigo-600">{selectedUser.displayName?.[0]}</span>
                          )}
                      </div>
                  </div>
                  
                  <div className="space-y-1 mb-8">
                    <div className="flex flex-col items-center gap-2">
                       <div className="flex items-center gap-3">
                         <h3 className={cn(
                           "text-2xl font-black tracking-tight",
                           selectedUser.email === 'dasdemirov2017@gmail.com' ? "bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-600 bg-clip-text text-transparent drop-shadow-sm" : "text-slate-900"
                         )}>
                           {selectedUser.displayName}
                         </h3>
                         {((selectedUser as any).isOfficial || selectedUser.email === 'dasdemirov2017@gmail.com') && <BadgeCheck className="w-6 h-6 text-blue-500 fill-blue-50" />}
                         {(selectedUser as any).vipLevel > 0 && (
                            <span className="bg-amber-400 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md border-2 border-white">VIP {(selectedUser as any).vipLevel}</span>
                         )}
                       </div>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                       <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-md">LVL {Math.floor((selectedUser.xp || 0) / 500) + 1}</span>
                       <p className="text-slate-400 font-medium text-xs">Böyük Oyunçu</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 gap-3 w-full mb-8">
                     <div className="bg-slate-50 p-4 rounded-3xl text-center">
                        <div className="flex items-center justify-center gap-1.5 text-indigo-600 mb-1">
                           <Zap className="w-4 h-4" />
                           <span className="text-lg font-black">{selectedUser.xp || 0}</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Təcrübə (XP)</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-3xl text-center">
                        <div className="flex items-center justify-center gap-1.5 text-amber-500 mb-1">
                           <Coins className="w-4 h-4" />
                           <span className="text-lg font-black">{selectedUser.coins || 0}</span>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Coinlar</p>
                     </div>
                  </div>

                  {/* Gift Wall */}
                  <div className="w-full mb-8">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hədiyyə Divarı</h4>
                        <span className="text-[10px] font-bold text-indigo-600">{selectedUser.receivedGifts?.length || 0} Hədiyyə</span>
                     </div>
                     <div className="grid grid-cols-4 gap-2">
                        {selectedUser.receivedGifts?.slice(0, 8).map((gift: any, i: number) => (
                           <div 
                             key={i} 
                             onClick={() => alert(`Bu hədiyyəni ${gift.senderName} tərəfindən ${new Date(gift.timestamp).toLocaleDateString()} tarixində göndərilib.`)}
                             className="aspect-square bg-slate-50 rounded-2xl flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100 group relative"
                           >
                              <div className="text-2xl group-hover:scale-110 transition-transform">
                                 {GIFTS.find(g => g.id === gift.giftId)?.icon || <Heart className="w-6 h-6 text-rose-400" />}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full shadow-sm flex items-center justify-center border border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Plus className="w-3 h-3 text-indigo-600" />
                              </div>
                           </div>
                        ))}
                        {(!selectedUser.receivedGifts || selectedUser.receivedGifts.length === 0) && (
                           <div className="col-span-4 py-8 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center opacity-40">
                              <Gift className="w-6 h-6 text-slate-300 mb-2" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hələ hədiyyə yoxdur</p>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="w-full space-y-3">
                    <button 
                      onClick={() => setShowGifts(true)}
                      className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-rose-100 flex items-center justify-center gap-3 active:scale-95 mb-4"
                    >
                        <Gift className="w-5 h-5" />
                        HƏDİYYƏ GÖNDƏR
                    </button>

                    {user && (
                      <button 
                        onClick={async () => {
                          if (following.has(selectedUser.uid)) {
                            await unfollowUser(user.uid, selectedUser.uid);
                          } else {
                            await followUser(user.uid, selectedUser.uid);
                          }
                        }}
                        className={cn(
                          "w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-95",
                          following.has(selectedUser.uid) 
                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100" 
                            : "bg-indigo-600 text-white hover:bg-slate-900 shadow-xl shadow-indigo-100"
                        )}
                      >
                          {following.has(selectedUser.uid) ? (
                            <>
                              <UserMinus className="w-5 h-5" />
                              TAKİBDƏN ÇIX
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-5 h-5" />
                              TAKİB ET
                            </>
                          )}
                      </button>
                    )}
                    
                    {/* Moderation Action for Admins/Owners */}
                    {user && liveActiveRoom && (liveActiveRoom.ownerId === user.uid || liveActiveRoom.admins?.includes(user.uid)) && 
                     selectedUser.uid !== liveActiveRoom.ownerId && selectedUser.uid !== user.uid && !(selectedUser as any).isOfficial && (
                      <button 
                        onClick={() => {
                          if (confirm(`${selectedUser.displayName} adlı istifadəçini otaqdan qovmaq istəyirsiniz?`)) {
                            kickUser(liveActiveRoom.id, selectedUser.uid);
                            setSelectedUser(null);
                          }
                        }}
                        className="w-full py-4 bg-rose-600 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-xl shadow-rose-100 flex items-center justify-center gap-3"
                      >
                          <UserX className="w-5 h-5" />
                          OTAQDAN QOV (KİCK)
                      </button>
                    )}

                    <button 
                        onClick={() => setSelectedUser(null)}
                        className="w-full py-4 text-slate-400 font-bold hover:text-slate-900 transition-colors"
                    >
                        BAĞLA
                    </button>
                  </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Seat Moderation Menu */}
      <AnimatePresence>
        {showSeatMenu && menuSeatIndex !== null && liveActiveRoom && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSeatMenu(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[350]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-sm bg-white rounded-[3rem] shadow-2xl z-[351] overflow-hidden"
            >
                <div className="p-8 space-y-6 text-slate-900">
                  <div className="text-center">
                      <h4 className="text-xl font-black text-slate-900 tracking-tight">Kürsü {menuSeatIndex + 1}</h4>
                      <p className="text-slate-400 font-medium text-sm">İdarəetmə Menyusu</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                      {/* Mute toggle */}
                      {liveActiveRoom.seats?.[menuSeatIndex]?.occupantId && (
                        <button 
                          onClick={() => {
                            muteUserSeat(liveActiveRoom.id, menuSeatIndex, !liveActiveRoom.seats[menuSeatIndex].isMutedByAdmin);
                            setShowSeatMenu(false);
                          }}
                          className="w-full py-4 bg-slate-50 text-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
                        >
                          <MicOff className="w-5 h-5 text-indigo-600" />
                          {liveActiveRoom.seats[menuSeatIndex].isMutedByAdmin ? 'Səsi Aç' : 'Səsi Bağla'}
                        </button>
                      )}

                      {/* Lock toggle */}
                      <button 
                        onClick={() => {
                          lockSeat(liveActiveRoom.id, menuSeatIndex, !liveActiveRoom.seats?.[menuSeatIndex]?.isLocked);
                          setShowSeatMenu(false);
                        }}
                        className="w-full py-4 bg-slate-50 text-slate-800 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
                      >
                        {liveActiveRoom.seats?.[menuSeatIndex]?.isLocked ? <Unlock className="w-5 h-5 text-indigo-600" /> : <Lock className="w-5 h-5 text-indigo-600" />}
                        {liveActiveRoom.seats?.[menuSeatIndex]?.isLocked ? 'Kilidi Aç' : 'Kürsünü Kilidlə'}
                      </button>

                      {/* Kick user from seat (Drop) */}
                      {liveActiveRoom.seats?.[menuSeatIndex]?.occupantId && (
                        <button 
                          onClick={() => {
                            assignUserToSeat(liveActiveRoom.id, menuSeatIndex, null);
                            setShowSeatMenu(false);
                          }}
                          className="w-full py-4 bg-rose-50 text-rose-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-rose-100 transition-colors"
                        >
                          <UserX className="w-5 h-5" />
                          Kürsüdən düşürt
                        </button>
                      )}

                      {/* Kick user from room (Banish) - Only if not owner and not official */}
                      {liveActiveRoom.seats?.[menuSeatIndex]?.occupantId && 
                       liveActiveRoom.seats?.[menuSeatIndex]?.occupantId !== liveActiveRoom.ownerId && 
                       !roomFollowersProfiles.find(p => p.uid === liveActiveRoom.seats[menuSeatIndex].occupantId)?.isOfficial && (
                        <button 
                          onClick={() => {
                            if (confirm('İstifadəçini otaqdan birdəfəlik qovmaq istəyirsiniz?')) {
                              kickUser(liveActiveRoom.id, liveActiveRoom.seats[menuSeatIndex].occupantId);
                              setShowSeatMenu(false);
                            }
                          }}
                          className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-slate-900 transition-colors shadow-lg shadow-rose-100"
                        >
                          <UserX className="w-5 h-5" />
                          OTAQDAN QOV (KİCK)
                        </button>
                      )}
                  </div>

                  <button 
                    onClick={() => setShowSeatMenu(false)}
                    className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                  >
                    BAĞLA
                  </button>
                </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Kick Notification Overlay */}
      <AnimatePresence>
        {isKicked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900 z-[500] flex flex-col items-center justify-center p-12 text-center space-y-8"
          >
              <div className="w-32 h-32 bg-rose-100 rounded-[3rem] flex items-center justify-center text-rose-600 animate-pulse">
                <UserX className="w-16 h-16" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-tight">SİZ QOVULDUNUZ</h2>
                <p className="text-slate-400 font-medium">Bu otağın qaydalarını pozduğunuz üçün administrator tərəfindən qovuldunuz.</p>
              </div>
              <button 
                onClick={() => setIsKicked(false)}
                className="w-full max-w-xs py-5 bg-white text-slate-900 font-black rounded-3xl hover:bg-slate-100 transition-all shadow-2xl"
              >
                ANLADIM
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discovery Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setShowCreatePost(false)}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500]"
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="fixed bottom-0 inset-x-0 bg-white rounded-t-[3rem] shadow-2xl z-[501] max-h-[90vh] flex flex-col pt-8"
            >
               <div className="px-8 pb-4 flex items-center justify-between border-b border-slate-50">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Yeni Paylaşım</h3>
                  <button onClick={() => setShowCreatePost(false)} className="p-2 bg-slate-50 rounded-xl"><X className="w-6 h-6 text-slate-500"/></button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  <textarea 
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Nə düşünürsən?"
                    className="w-full h-32 bg-slate-50 border border-slate-100 rounded-3xl p-6 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all resize-none"
                  />
                  
                  {postMedia && (
                    <div className="relative rounded-[2rem] overflow-hidden bg-slate-900 group">
                       {postMedia.type === 'video' ? (
                         <video src={postMedia.url} controls className="w-full max-h-64 object-contain" />
                       ) : (
                         <img src={postMedia.url} className="w-full max-h-64 object-contain" />
                       )}
                       <button 
                         onClick={() => setPostMedia(null)}
                         className="absolute top-4 right-4 p-2 bg-rose-500 text-white rounded-full shadow-lg"
                       >
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                     <label className="flex flex-col items-center justify-center p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2rem] cursor-pointer hover:bg-indigo-100 transition-all text-indigo-600 gap-2">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Şəkil Seç</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePostMediaUpload} />
                     </label>
                     <label className="flex flex-col items-center justify-center p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2rem] cursor-pointer hover:bg-indigo-100 transition-all text-indigo-600 gap-2">
                        <Video className="w-8 h-8" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Video Seç</span>
                        <input type="file" accept="video/*" className="hidden" onChange={handlePostMediaUpload} />
                     </label>
                  </div>
               </div>
               
               <div className="p-8 pt-0">
                  <button 
                    onClick={handleCreatePostSubmit}
                    className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all mb-4"
                  >
                    PAYLAŞ
                  </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Discovery User Profile Overlay */}
      <AnimatePresence>
        {viewingUserProfile && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 bg-white z-[600] flex flex-col"
          >
            <header className="p-6 flex items-center justify-between border-b border-slate-50">
              <button 
                onClick={() => setViewingUserProfile(null)}
                className="p-2 bg-slate-50 rounded-xl"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">İstifadəçi Profili</h3>
              <div className="w-10" />
            </header>

            <div className="flex-1 overflow-y-auto">
               <div className="p-8 flex flex-col items-center text-center space-y-4 border-b border-slate-50">
                  <div className={cn(
                    "w-24 h-24 rounded-3xl bg-indigo-50 p-1 relative",
                    viewingUserProfile.email === 'dasdemirov2017@gmail.com' && "bg-gradient-to-br from-amber-400 via-yellow-200 to-amber-600"
                  )}>
                     <div className="w-full h-full rounded-[1.35rem] bg-white overflow-hidden border-4 border-white">
                        {viewingUserProfile.photoURL ? (
                          <img src={viewingUserProfile.photoURL} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl font-black text-indigo-600">
                             {viewingUserProfile.displayName?.[0]}
                          </div>
                        )}
                     </div>
                  </div>
                  <div>
                    <div className="flex flex-col items-center">
                      <div className="flex items-center justify-center gap-2">
                        <h3 className="text-2xl font-black text-slate-900">{viewingUserProfile.displayName}</h3>
                        {(viewingUserProfile.isOfficial || viewingUserProfile.email === 'dasdemirov2017@gmail.com') && (
                          <BadgeCheck className="w-6 h-6 text-blue-500 fill-blue-50" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">LVL {Math.floor((viewingUserProfile.xp || 0) / 500) + 1} Oyunçu</p>
                  </div>
                  
                  {user && user.uid !== viewingUserProfile.uid && (
                    <div className="flex gap-2 w-full max-w-sm pt-2">
                       <button 
                         onClick={async () => {
                           if (following.has(viewingUserProfile.uid)) {
                             await unfollowUser(user.uid, viewingUserProfile.uid);
                           } else {
                             await followUser(user.uid, viewingUserProfile.uid);
                           }
                         }}
                         className={cn(
                           "flex-1 py-3 rounded-2xl font-black text-xs transition-all",
                           following.has(viewingUserProfile.uid) ? "bg-rose-50 text-rose-600" : "bg-indigo-600 text-white"
                         )}
                       >
                          {following.has(viewingUserProfile.uid) ? 'Takibdən Çıx' : 'Takib Et'}
                       </button>
                    </div>
                  )}
               </div>

               <div className="p-8 space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Bütün Paylaşımlar</h4>
                  <div className="space-y-6">
                     {viewingUserPosts.map(post => (
                       <div key={post.id} className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                          <div className="p-4 flex items-center justify-between">
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {post.timestamp?.toDate ? post.timestamp.toDate().toLocaleString() : 'Az əvvəl'}
                             </p>
                          </div>
                          {post.text && <p className="px-4 pb-3 text-sm text-slate-700 leading-relaxed">{post.text}</p>}
                          {post.mediaUrl && (
                            <div className="px-4 pb-4">
                               <div className="rounded-2xl overflow-hidden bg-slate-900">
                                  {post.mediaType === 'video' ? (
                                    <video src={post.mediaUrl} controls className="w-full max-h-64 object-contain" />
                                  ) : (
                                    <img src={post.mediaUrl} className="w-full max-h-64 object-cover" />
                                  )}
                               </div>
                            </div>
                          )}
                       </div>
                     ))}
                     {viewingUserPosts.length === 0 && (
                        <div className="py-12 flex flex-col items-center justify-center opacity-40">
                           <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hələ paylaşım yoxdur</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 px-6 pb-8 flex items-center justify-between z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
        <NavButton 
          active={activeTab === 'game'} 
          onClick={() => setActiveTab('game')} 
          icon={<Gamepad2 className="w-6 h-6" />} 
          label="OYUNLAR" 
        />
        <NavButton 
          active={activeTab === 'chat'} 
          onClick={() => setActiveTab('chat')} 
          icon={<Mic className="w-6 h-6" />} 
          label="Söhbət" 
        />
        <NavButton 
          active={activeTab === 'messages'} 
          onClick={() => setActiveTab('messages')} 
          icon={<Send className="w-6 h-6" />} 
          label="Mesaj" 
        />
        <NavButton 
          active={activeTab === 'discover'} 
          onClick={() => setActiveTab('discover')} 
          icon={<Compass className="w-6 h-6" />} 
          label="Kəşf et" 
        />
        <NavButton 
          active={activeTab === 'settings'} 
          onClick={() => setActiveTab('settings')} 
          icon={<Settings className="w-6 h-6" />} 
          label="Ayarlar" 
        />
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        active ? "text-indigo-600 scale-110" : "text-slate-300 hover:text-slate-400"
      )}
    >
      <div className={cn(
        "p-1 rounded-xl transition-colors",
        active ? "bg-indigo-50" : "bg-transparent"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-[9px] font-bold tracking-tighter uppercase",
        active ? "opacity-100" : "opacity-0"
      )}>
        {label}
      </span>
    </button>
  );
}

