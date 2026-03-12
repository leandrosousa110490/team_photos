# Firebase Setup For Team Photos

This app writes submissions to Firestore collections:
- `quote_requests`
- `question_requests`
- `estimate_requests`
- `page_views`
- `calendar_events`
- `admin_users`

If Firebase is not configured correctly, the app falls back to local browser storage and shows a warning message.

## 1) Use Web Config (Not Admin Key)

Do **not** use `firebase-adminsdk-*.json` in browser code.

Open Firebase Console:
1. Project settings
2. Your apps
3. Add/Register a **Web app**
4. Copy the Firebase web config values

Update [firebase-web-config.js](./firebase-web-config.js):

```js
window.EDGEFRAME_FIREBASE_CONFIG = {
  apiKey: "YOUR_WEB_API_KEY",
  authDomain: "alyssa-c95c3.firebaseapp.com",
  projectId: "alyssa-c95c3",
  storageBucket: "alyssa-c95c3.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_WEB_APP_ID"
};
```

## 2) Enable Firestore Database

In Firebase Console:
1. Build -> Firestore Database
2. Create database (Native mode)
3. Choose your region

## 3) Enable Firebase Authentication

In Firebase Console:
1. Build -> Authentication
2. Get started
3. Sign-in method -> enable **Email/Password**
4. Add your owner login account (`leoisdabest@yahoo.com`) in Authentication -> Users

## 4) Apply Firestore Rules

Use rules from [firestore.rules](./firestore.rules) in this folder.

Console method:
1. Firestore Database -> Rules
2. Replace existing rules with file content
3. Publish

CLI method:
1. Install CLI: `npm i -g firebase-tools`
2. Login: `firebase login`
3. In project root: `firebase init firestore`
4. Replace generated rules with `firebase/firestore.rules`
5. Deploy: `firebase deploy --only firestore:rules`

## 5) Verify Website Writes

1. Open the site.
2. Submit a Quote request.
3. Submit a Questions request.
4. In Firestore Data tab, confirm docs appear in:
   - `quote_requests`
   - `question_requests`

If the UI says "Saved on this device only", Firestore write is still blocked (config or rules issue).

## 6) Verify Admin Dashboard

1. Open `/admin_alyssa` in your site URL.
2. Sign in with your **username** and password.
3. Confirm you can see:
   - Quote and question requests
   - Calendar events
   - Site traffic
   - Admin users
4. First owner login auto-creates an `admin_users/{uid}` record.
5. New users are created from username/password in the dashboard (email is generated internally for Firebase Auth).

## 7) Common Issues

- `REPLACE_WITH_...` values still in `firebase-web-config.js`
  - Fix by pasting real web app config.
- Firestore not created yet
  - Create Firestore database in console.
- Email/password login disabled
  - Enable it in Authentication -> Sign-in method.
- Rules are too strict or default deny
  - Publish the provided `firestore.rules`.
- Wrong project
  - Confirm `projectId` in web config matches the console project.
