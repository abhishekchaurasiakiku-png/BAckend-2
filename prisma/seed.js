import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.messageReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.user.deleteMany();

  // Create test users
  const passwordHash = await bcrypt.hash('password123', 12);

  const alice = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      emailOrPhone: 'alice@example.com',
      passwordHash,
      avatarUrl: null,
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      emailOrPhone: 'bob@example.com',
      passwordHash,
      avatarUrl: null,
    },
  });

  const charlie = await prisma.user.create({
    data: {
      name: 'Charlie Brown',
      emailOrPhone: 'charlie@example.com',
      passwordHash,
      avatarUrl: null,
    },
  });

  const diana = await prisma.user.create({
    data: {
      name: 'Diana Prince',
      emailOrPhone: 'diana@example.com',
      passwordHash,
      avatarUrl: null,
    },
  });

  console.log('✅ Created 4 test users');

  // Create a direct conversation between Alice and Bob
  const directConv = await prisma.conversation.create({
    data: {
      type: 'direct',
      members: {
        create: [
          { userId: alice.id, role: 'default_role' },
          { userId: bob.id, role: 'default_role' },
        ],
      },
    },
  });

  // Create a group conversation
  const groupConv = await prisma.conversation.create({
    data: {
      type: 'group',
      title: 'Project Team 🚀',
      members: {
        create: [
          { userId: alice.id, role: 'admin' },
          { userId: bob.id, role: 'default_role' },
          { userId: charlie.id, role: 'default_role' },
          { userId: diana.id, role: 'default_role' },
        ],
      },
    },
  });

  console.log('✅ Created 2 conversations (1 direct, 1 group)');

  // Create some messages in the direct conversation
  const msg1 = await prisma.message.create({
    data: {
      conversationId: directConv.id,
      senderId: alice.id,
      content: 'Hey Bob! How are you?',
    },
  });

  const msg2 = await prisma.message.create({
    data: {
      conversationId: directConv.id,
      senderId: bob.id,
      content: "Hi Alice! I'm doing great. Working on the new project.",
    },
  });

  const msg3 = await prisma.message.create({
    data: {
      conversationId: directConv.id,
      senderId: alice.id,
      content: 'Awesome! Let me know if you need any help 😊',
    },
  });

  // Create receipts for the messages
  await prisma.messageReceipt.create({
    data: {
      messageId: msg1.id,
      userId: bob.id,
      deliveredAt: new Date(),
      readAt: new Date(),
    },
  });

  await prisma.messageReceipt.create({
    data: {
      messageId: msg2.id,
      userId: alice.id,
      deliveredAt: new Date(),
      readAt: new Date(),
    },
  });

  await prisma.messageReceipt.create({
    data: {
      messageId: msg3.id,
      userId: bob.id,
      deliveredAt: new Date(),
      readAt: null, // Unread
    },
  });

  // Create messages in group
  await prisma.message.create({
    data: {
      conversationId: groupConv.id,
      senderId: alice.id,
      content: 'Welcome everyone to the project team! 🎉',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: groupConv.id,
      senderId: charlie.id,
      content: 'Thanks for adding me! Excited to get started.',
    },
  });

  await prisma.message.create({
    data: {
      conversationId: groupConv.id,
      senderId: diana.id,
      content: "Let's crush it! 💪",
    },
  });

  // Update conversation timestamps
  await prisma.conversation.update({
    where: { id: directConv.id },
    data: { updatedAt: new Date() },
  });

  await prisma.conversation.update({
    where: { id: groupConv.id },
    data: { updatedAt: new Date() },
  });

  console.log('✅ Created 6 test messages with receipts');

  console.log('\n📋 Test Credentials:');
  console.log('  alice@example.com / password123');
  console.log('  bob@example.com / password123');
  console.log('  charlie@example.com / password123');
  console.log('  diana@example.com / password123');
  console.log('\n🌱 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
