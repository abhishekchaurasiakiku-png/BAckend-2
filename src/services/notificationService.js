/**
 * Notification service — Push notification delivery
 * Placeholder for Phase 5 FCM/APNs integration
 */

import prisma from '../config/database.js';

/**
 * Send push notification to a specific user
 */
export async function sendPushNotification({ userId, title, body, data }) {
  // Get user's push tokens
  const tokens = await prisma.pushToken.findMany({
    where: { userId },
  });

  if (tokens.length === 0) {
    console.log(`⚠️ No push tokens registered for user ${userId}`);
    return { sent: 0 };
  }

  console.log(`📱 Sending push notification to ${tokens.length} device(s) for user ${userId}`);

  // TODO: Implement actual FCM/APNs sending
  // For each token:
  //   - Build platform-specific payload
  //   - Send via firebase-admin SDK
  //   - Handle failures (remove invalid tokens)

  return { sent: tokens.length };
}

/**
 * Register a push token for a user's device
 */
export async function registerPushToken({ userId, deviceId, pushToken, platform }) {
  // Upsert — update if device already registered
  return prisma.pushToken.upsert({
    where: {
      // We need a unique constraint on userId + deviceId for upsert
      // For now, delete existing and create new
      id: 'placeholder', // This won't match
    },
    update: {
      pushToken,
      platform,
    },
    create: {
      userId,
      deviceId,
      pushToken,
      platform,
    },
  }).catch(async () => {
    // Fallback: delete existing tokens for this device and create new
    await prisma.pushToken.deleteMany({
      where: { userId, deviceId },
    });
    return prisma.pushToken.create({
      data: { userId, deviceId, pushToken, platform },
    });
  });
}

/**
 * Unregister push token for a device
 */
export async function unregisterPushToken({ userId, deviceId }) {
  return prisma.pushToken.deleteMany({
    where: { userId, deviceId },
  });
}
