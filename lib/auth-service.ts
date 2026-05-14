import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  collection,
  addDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  throw new Error(errorJson);
}

export async function sendMessage(roomId: string, message: { senderId: string, senderName: string, senderEmail?: string, senderPhoto?: string, text?: string, imageUrl?: string, type: 'text' | 'image' | 'system' | 'gift', giftId?: string, recipientName?: string }) {
  const messagesRef = collection(db, 'rooms', roomId, 'messages');
  try {
    await addDoc(messagesRef, {
      ...message,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rooms/${roomId}/messages`);
  }
}

export async function sendGift(senderId: string, recipientId: string, roomId: string, gift: { id: string, name: string, price: number, icon: string }) {
  const senderRef = doc(db, 'users', senderId);
  const recipientRef = doc(db, 'users', recipientId);
  const roomRef = doc(db, 'rooms', roomId);

  const senderSnap = await getDoc(senderRef);
  if (senderSnap.exists() && (senderSnap.data().coins || 0) >= gift.price) {
    const senderData = senderSnap.data();
    
    // 1. Decrement sender coins and add XP
    const giftVIPXP = gift.price;
    const newVIPXP = (senderData.vipXP || 0) + giftVIPXP;
    const newVIPLevel = Math.min(10, Math.floor(newVIPXP / 5000) + 1);

    try {
      await updateDoc(senderRef, {
        coins: (senderData.coins || 0) - gift.price,
        xp: (senderData.xp || 0) + (gift.price * 2),
        vipXP: newVIPXP,
        vipLevel: senderData.email === 'dasdemirov2017@gmail.com' ? 10 : newVIPLevel,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${senderId}`);
    }

    // 2. Add gift to recipient
    const recipientSnap = await getDoc(recipientRef);
    if (recipientSnap.exists()) {
      const recipientData = recipientSnap.data();
      const randomCoins = Math.floor(Math.random() * (gift.price / 2)) + 1;
      try {
        await updateDoc(recipientRef, {
          coins: (recipientData.coins || 0) + randomCoins,
          receivedGifts: arrayUnion({
            giftId: gift.id,
            giftName: gift.name,
            giftIcon: gift.icon,
            senderId,
            senderName: senderData.displayName,
            timestamp: new Date().toISOString()
          })
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${recipientId}`);
      }

      // 3. Increment room XP
      try {
        const roomSnap = await getDoc(roomRef);
        await updateDoc(roomRef, {
          xp: (roomSnap.data()?.xp || 0) + gift.price
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
      }

      // 4. Send gift message
      await sendMessage(roomId, {
        senderId: senderId,
        senderName: senderData.displayName,
        text: `${senderData.displayName} istifadəçisi ${recipientData.displayName} istifadəçisinə ${gift.name} göndərdi!`,
        type: 'gift',
        giftId: gift.id,
        recipientName: recipientData.displayName
      });
    }
  } else {
    throw new Error('Kifayət qədər coin yoxdur');
  }
}

async function initUserDoc(user: User) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    const isSuperUser = user.email === 'dasdemirov2017@gmail.com';
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Player',
      highScore: 0,
      level: isSuperUser ? 100 : 1,
      xp: isSuperUser ? 1000000 : 0,
      vipLevel: isSuperUser ? 10 : 1,
      vipXP: isSuperUser ? 50000 : 0,
      coins: isSuperUser ? 9999999 : 1000,
      isOfficial: isSuperUser,
      isAdmin: isSuperUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else if (user.email === 'dasdemirov2017@gmail.com') {
    // Ensure super user stays super
    await updateDoc(userRef, {
      isOfficial: true,
      isAdmin: true,
      coins: 9999999,
      xp: 1000000,
      level: 100,
      vipLevel: 10
    });
  }
}

export async function registerUser(email: string, pass: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  await initUserDoc(userCredential.user);
  return userCredential.user;
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  await initUserDoc(userCredential.user);
  return userCredential.user;
}

export async function loginWithApple() {
  const provider = new OAuthProvider('apple.com');
  const userCredential = await signInWithPopup(auth, provider);
  await initUserDoc(userCredential.user);
  return userCredential.user;
}

export async function loginUser(email: string, pass: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  return userCredential.user;
}

export async function logoutUser() {
  await signOut(auth);
}

export async function updateProfileData(uid: string, data: { displayName?: string, region?: string, photoURL?: string }) {
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function syncHighScore(uid: string, score: number) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const currentHigh = snap.data().highScore || 0;
    if (score > currentHigh) {
      await updateDoc(userRef, {
        highScore: score,
        updatedAt: serverTimestamp()
      });
    }
  }
}

export async function createRoom(uid: string, name: string, ownerName: string, ownerPhoto?: string, options: { description?: string, type?: string, followers?: string[], isOfficial?: boolean } = {}) {
  const isOfficial = options.isOfficial || name.toLowerCase() === 'dgame';
  
  // For groups, use a random ID or user prefix
  const roomId = options.type === 'group' ? `group_${uid}_${Date.now()}` : uid;
  const roomRef = doc(db, 'rooms', roomId);
  
  try {
    await setDoc(roomRef, {
      id: roomId,
      name,
      description: options.description || '',
      ownerId: uid,
      ownerName,
      ownerPhoto: ownerPhoto || '',
      roomPhoto: '',
      backgroundId: 'bg-1',
      isOfficial: isOfficial,
      xp: isOfficial ? 1000000 : 0,
      level: isOfficial ? 100 : 1,
      type: options.type || 'voice',
      followers: options.followers || [uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`);
  }
  return roomId;
}

export async function updateRoom(uid: string, data: { name?: string, roomPhoto?: string, backgroundId?: string }) {
  const roomRef = doc(db, 'rooms', uid);
  await updateDoc(roomRef, data);
}

export async function deleteRoom(uid: string) {
  const roomRef = doc(db, 'rooms', uid);
  await deleteDoc(roomRef);
}

export async function followUser(followerId: string, followedId: string) {
  const followId = `${followerId}_${followedId}`;
  await setDoc(doc(db, 'follows', followId), {
    followerId,
    followedId,
    timestamp: serverTimestamp()
  });
}

export async function unfollowUser(followerId: string, followedId: string) {
  const followId = `${followerId}_${followedId}`;
  await deleteDoc(doc(db, 'follows', followId));
}

export async function addRoomAdmin(ownerId: string, adminId: string) {
  const roomRef = doc(db, 'rooms', ownerId);
  await updateDoc(roomRef, {
    admins: arrayUnion(adminId)
  });
}

export async function removeRoomAdmin(ownerId: string, adminId: string) {
  const roomRef = doc(db, 'rooms', ownerId);
  await updateDoc(roomRef, {
    admins: arrayRemove(adminId)
  });
}

export async function kickUser(roomId: string, userId: string) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && (userSnap.data().isOfficial || userSnap.data().email === 'dasdemirov2017@gmail.com')) {
    return; // Cannot kick official or super users
  }

  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    kickedUsers: arrayUnion(userId)
  });
  // Also delete their signaling document to disconnect them immediately
  await deleteDoc(doc(db, 'rooms', roomId, 'signaling', userId));
}

export async function unkickUser(roomId: string, userId: string) {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    kickedUsers: arrayRemove(userId)
  });
}

export async function muteUserSeat(roomId: string, seatIndex: number, isMuted: boolean) {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    [`seats.${seatIndex}.isMutedByAdmin`]: isMuted
  });
}

export async function lockSeat(roomId: string, seatIndex: number, isLocked: boolean) {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    [`seats.${seatIndex}.isLocked`]: isLocked
  });
}

export async function assignUserToSeat(roomId: string, seatIndex: number, userId: string | null) {
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, {
      [`seats.${seatIndex}.occupantId`]: userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function createDiscoveryPost(userId: string, data: { userName: string, userPhoto?: string, text?: string, mediaUrl?: string, mediaType?: 'image' | 'video', isPinned?: boolean }) {
  const postsRef = collection(db, 'discover_posts');
  await addDoc(postsRef, {
    ...data,
    userId,
    timestamp: serverTimestamp()
  });
}

export async function deleteDiscoveryPost(postId: string) {
  await deleteDoc(doc(db, 'discover_posts', postId));
}
