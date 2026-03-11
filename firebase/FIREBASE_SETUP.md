# Firebase Setup For Team Photos

This app writes submissions to Firestore collections:
- `quote_requests`
- `question_requests`
- `estimate_requests`

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

## 3) Apply Firestore Rules

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

## 4) Verify Writes

1. Open the site.
2. Submit a Quote request.
3. Submit a Questions request.
4. In Firestore Data tab, confirm docs appear in:
   - `quote_requests`
   - `question_requests`

If the UI says "Saved on this device only", Firestore write is still blocked (config or rules issue).

## 5) Common Issues

- `REPLACE_WITH_...` values still in `firebase-web-config.js`
  - Fix by pasting real web app config.
- Firestore not created yet
  - Create Firestore database in console.
- Rules are too strict or default deny
  - Publish the provided `firestore.rules`.
- Wrong project
  - Confirm `projectId` in web config matches the console project.
