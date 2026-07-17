const admin = require('firebase-admin');

// We use environment variables for Firebase initialization.
// The user will provide these in the .env file later.
// Note: Some environments allow initializing without credentials if deployed to GCP, 
// but for local dev we expect FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY

if (process.env.FIREBASE_PROJECT_ID) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
    // Strip leading and trailing quotes, commas, and whitespace (common JSON copy/paste errors)
    privateKey = privateKey.replace(/^["'\s]+|["',\s]+$/g, '');
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.warn('Firebase configuration missing. Firebase Admin SDK not initialized.');
}

module.exports = admin;
