# Firebase Integration Setup Guide

This guide will help you integrate Firebase as your backend database for your Next.js trading application.

## Prerequisites

1. **Node.js and npm**: You need to install Node.js first
   - Go to https://nodejs.org/
   - Download the LTS version
   - Install it by following the installation wizard
   - Restart your terminal after installation

2. **Firebase Account**: You need a Google account to use Firebase

## Step 1: Install Firebase Dependencies

After installing Node.js, run this command in your project directory:

```bash
npm install firebase
```

## Step 2: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "my-trading-app")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 3: Get Firebase Configuration

1. In your Firebase console, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>)
5. Register your app with a nickname (e.g., "trading-app-web")
6. Copy the configuration object that looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz",
  authDomain: "my-trading-app.firebaseapp.com",
  projectId: "my-trading-app",
  storageBucket: "my-trading-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-ABCDEF1234"
};
```

## Step 4: Set Up Environment Variables

1. Create a file called `.env.local` in your project root
2. Add your Firebase configuration values:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Replace the values with your actual Firebase configuration.

## Step 5: Set Up Firestore Database

1. In your Firebase console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

## Step 6: Set Up Firebase Storage

1. In your Firebase console, go to "Storage"
2. Click "Get started"
3. Choose "Start in test mode" (for development)
4. Select a location close to your users
5. Click "Done"

## Step 7: Set Up Security Rules

1. In Firestore Database, go to "Rules" tab
2. Replace the default rules with these (for development):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Note**: These rules allow anyone to read and write. For production, you'll want more restrictive rules.

## Step 7: Create Collections

Your app will automatically create these collections when you first add data:
- `trades` - for storing trade data
- `claims` - for storing claim data
- `fileUploads` - for storing file metadata

## Step 8: Set Up Storage Rules

1. In Firebase Storage, go to "Rules" tab
2. Replace the default rules with these (for development):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

**Note**: These rules allow anyone to read and write. For production, you'll want more restrictive rules.

## Step 9: Update Your Components

The Firebase integration files have been created for you:

1. `lib/firebase-config.ts` - Firebase configuration
2. `lib/firebase-operations.ts` - Database operations
3. `lib/firebase-storage.ts` - Firebase Storage operations
4. `hooks/use-firebase.ts` - React hook for Firebase operations
5. `hooks/use-firebase-storage.ts` - React hook for Firebase Storage
6. `components/firebase-excel-upload.tsx` - Enhanced Excel upload with Firebase Storage

## Step 9: Replace Supabase with Firebase

To use Firebase instead of Supabase in your components:

**Before (Supabase):**
```typescript
import { useDatabase } from '../hooks/use-database';
```

**After (Firebase):**
```typescript
import { useFirebase } from '../hooks/use-firebase';
```

## Step 10: Test the Integration

1. Start your development server:
```bash
npm run dev
```

2. Test basic Firebase operations:
   - Visit `http://localhost:3000/firebase-test`
   - Try creating, reading, updating, and deleting data

3. Test Excel file uploads:
   - Visit `http://localhost:3000/firebase-excel-test`
   - Upload Excel files and see them stored in Firebase Storage
   - Check the Firebase console to see files in Storage and metadata in Firestore

## Common Operations

### Creating a Trade
```typescript
const { createTrade } = useFirebase();

const newTrade = {
  trade_id: "TRADE001",
  data_source: "equity",
  symbol: "AAPL",
  quantity: 100,
  price: 150.00,
  // ... other fields
};

await createTrade(newTrade);
```

### Loading Trades
```typescript
const { trades, loading, error } = useFirebase();
// trades will automatically load when the component mounts
```

### Updating a Trade
```typescript
const { updateTrade } = useFirebase();

await updateTrade(tradeId, {
  price: 155.00,
  updated_at: new Date().toISOString()
});
```

### Deleting a Trade
```typescript
const { deleteTrade } = useFirebase();

await deleteTrade(tradeId);
```

### Uploading Excel Files
```typescript
const { uploadFile, uploadedFiles } = useFirebaseStorage();

// Upload a file
const fileMetadata = await uploadFile(file, 'equity', 'excel');

// Get all uploaded files
console.log(uploadedFiles);
```

### Downloading Files
```typescript
const { downloadFile } = useFirebaseStorage();

await downloadFile(fileMetadata);
```

### Deleting Files
```typescript
const { deleteFile } = useFirebaseStorage();

await deleteFile(fileMetadata);
```

## Troubleshooting

### "Cannot find module 'firebase'" Error
- Make sure you've installed Firebase: `npm install firebase`
- Restart your development server

### "Firebase App named '[DEFAULT]' already exists" Error
- This usually happens when Firebase is initialized multiple times
- Check that you're only importing the Firebase config once

### Environment Variables Not Working
- Make sure your `.env.local` file is in the project root
- Restart your development server after adding environment variables
- Check that all variable names start with `NEXT_PUBLIC_`

### Database Permission Errors
- Check your Firestore security rules
- Make sure you're in test mode for development

### Storage Permission Errors
- Check your Firebase Storage security rules
- Make sure you're in test mode for development

### File Upload Errors
- Check that Firebase Storage is properly configured
- Verify your environment variables are correct
- Make sure the file size is within limits

## Next Steps

1. **Authentication**: Add user authentication with Firebase Auth
2. **Storage**: Use Firebase Storage for file uploads
3. **Real-time Updates**: Use Firestore's real-time listeners
4. **Security**: Implement proper security rules for production
5. **Backup**: Set up data backup and recovery procedures

## Support

If you encounter any issues:
1. Check the Firebase console for error messages
2. Look at the browser console for JavaScript errors
3. Verify your environment variables are correct
4. Make sure your Firebase project is properly set up 