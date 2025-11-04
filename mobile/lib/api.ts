import { Platform } from 'react-native';

// For iOS simulator you can use localhost; for Android emulator use 10.0.2.2.
// If you run on a real phone, replace with your computer’s LAN IP, e.g. 192.168.1.23
export const API_BASE = 'http://192.168.2.111:3000';

export async function identify(barcode: { raw: string; symbology: string }) {
  const r = await fetch(`${API_BASE}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barcode }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function askGpt(prompt: string) {
  const r = await fetch(`${API_BASE}/gpt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}