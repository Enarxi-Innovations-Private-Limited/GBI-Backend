const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const TEST_EMAIL = 'test-bounce@example.com';

async function runTest() {
  console.log('🚀 Starting Local SES Bounce Webhook Test...');

  // 1. Create or reset mock user in the database
  console.log(`\n1. Creating/resetting user "${TEST_EMAIL}"...`);
  await prisma.user.deleteMany({
    where: { email: TEST_EMAIL }
  });

  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      emailVerified: true,
      isRestricted: false,
      name: 'Test Bounce User'
    }
  });

  console.log('✅ Mock user created in DB:', {
    email: user.email,
    emailVerified: user.emailVerified,
    isRestricted: user.isRestricted
  });

  // 2. Prepare mock SNS Bounce Payload
  const bouncePayload = {
    Type: 'Notification',
    MessageId: 'test-message-uuid',
    TopicArn: 'arn:aws:sns:us-east-1:123456789012:ses-bounces-and-complaints',
    Message: JSON.stringify({
      notificationType: 'Bounce',
      bounce: {
        bounceType: 'Permanent',
        bounceSubType: 'General',
        bouncedRecipients: [
          {
            emailAddress: TEST_EMAIL,
            action: 'failed',
            status: '5.1.1',
            diagnosticCode: 'smtp; 550 5.1.1 user unknown'
          }
        ],
        timestamp: new Date().toISOString(),
        feedbackId: 'test-feedback-id'
      }
    }),
    Timestamp: new Date().toISOString(),
    SignatureVersion: '1',
    Signature: 'mock-signature',
    SigningCertURL: 'mock-url'
  };

  // 3. Send POST request to the local webhook
  console.log(`\n2. Sending mock SNS Bounce payload to http://localhost:${PORT}/webhooks/aws-ses...`);
  try {
    const response = await axios.post(`http://localhost:${PORT}/webhooks/aws-ses`, bouncePayload, {
      headers: {
        'Content-Type': 'text/plain' // AWS SNS content-type
      }
    });

    console.log('✅ Webhook Response Status:', response.status);
    console.log('✅ Webhook Response Body:', response.data);
  } catch (error) {
    console.error('❌ Webhook POST Request failed. Is your local dev server running (npm run start:dev)?');
    console.error(error.message);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
    process.exit(1);
  }

  // 4. Query the database to verify changes
  console.log('\n3. Verifying user updates in local database...');
  // Wait a split second for async DB transaction to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  const updatedUser = await prisma.user.findUnique({
    where: { email: TEST_EMAIL }
  });

  if (!updatedUser) {
    console.error('❌ Error: User was deleted or not found!');
    process.exit(1);
  }

  console.log('📊 Resulting User State:');
  console.log('- emailVerified:', updatedUser.emailVerified, updatedUser.emailVerified === false ? '✅ (Changed to false)' : '❌ (Expected false)');
  console.log('- isRestricted:', updatedUser.isRestricted, updatedUser.isRestricted === true ? '✅ (Changed to true)' : '❌ (Expected true)');

  if (updatedUser.emailVerified === false && updatedUser.isRestricted === true) {
    console.log('\n🎉 SUCCESS: The webhook parsed the bounce, updated the database, and restricted the user correctly!');
  } else {
    console.error('\n❌ FAILURE: User status was not updated correctly.');
  }

  // Clean up
  await prisma.user.deleteMany({
    where: { email: TEST_EMAIL }
  });
  await prisma.$disconnect();
}

runTest().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
