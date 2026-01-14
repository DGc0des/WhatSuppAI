import { Platform } from 'react-native';

// For iOS simulator you can use localhost; for Android emulator use 10.0.2.2.
// For real phone on same WiFi, use your computer's LAN IP
// For real phone on mobile data, use ngrok URL

// Set this to true when using mobile data, false when on same WiFi as your laptop
const USE_NGROK = true;

export const API_BASE = USE_NGROK
  ? 'https://marissa-unlanded-pseudoimpartially.ngrok-free.dev'
  : 'http://192.168.1.84:3000';

export async function identify(barcode: { raw: string; symbology: string }) {
  const r = await fetch(`${API_BASE}/identify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ barcode }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function askGpt(prompt: string) {
  const r = await fetch(`${API_BASE}/gpt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function scanImageForBarcode(imageUri: string) {
  const r = await fetch(`${API_BASE}/scan-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({ imageUri }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}