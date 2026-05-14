#!/usr/bin/env node
// Generates a VAPID key pair for web push and prints env-var assignments
// ready to paste into .env.local and Vercel project settings.
//
// Usage: node scripts/generate-vapid-keys.mjs
//
// You only need to run this ONCE per app. Treat the private key like
// any other secret — anyone who has it can send push notifications
// signed as your origin.

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("# Add the following to your .env.local and Vercel env:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_CONTACT_EMAIL=hello@bareroot.app`);
console.log("\n# Important: the NEXT_PUBLIC_ prefix on the public key is required so");
console.log("# the browser can read it via process.env in lib/push-client.ts.");
