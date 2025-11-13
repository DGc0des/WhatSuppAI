import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View, Image, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { identify } from '../../lib/api';
import { saveScannedSupplement } from '../../lib/storage';
import { signOut } from '../../lib/auth';


import { Redirect } from 'expo-router';
export  function Index() {
  return <Redirect href="../tabs"/>;
}


export default function Home() {
  const [permission, requestPermission] = useCameraPermissions();
  const [statusText, setStatusText] = useState('booting…');
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifyOut, setIdentifyOut] = useState<any>(null);
  const lastCodeRef = useRef<string | null>(null);
  const lastLogRef = useRef<number>(0);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) {
      setStatusText('requesting camera permission…');
      requestPermission();
    } else {
      setStatusText('camera ready — point at a barcode');
    }
  }, [permission]);

  const onScan = async ({ type, data }: BarcodeScanningResult) => {
    const now = Date.now();
    if (now - lastLogRef.current > 1000) {
      console.log('[SCAN EVENT]', { type, data });
      lastLogRef.current = now;
    }

    if (loading) return;
    if (lastCodeRef.current === data) return;
    lastCodeRef.current = data;

    setScanned(true);
    setStatusText(`got code: ${data} (${type}) — looking it up…`);
    setLoading(true);
    setIdentifyOut(null);

    try {
      const sym = mapType(type);
      const raw = String(data);
      const json = await identify({ raw, symbology: sym });

      console.log('[Scanner] API Response:', {
        found: json?.found,
        hasAnalysis: !!json?.analysis,
        hasRating: !!json?.rating,
        hasScores: !!json?.scores,
      });

      setIdentifyOut(json);
      setStatusText(`lookup done (found=${json?.found})`);

      // Save to history if found
      if (json?.found && json?.doc) {
        await saveScannedSupplement({
          barcode: raw,
          name: json.doc.name || 'Unknown',
          brand: json.doc.brand || 'N/A',
          image: json.doc.images?.[0],
          analysis: json.analysis,
          rating: json.rating,
          scores: json.scores,
        });
      }
    } catch (e: any) {
      setIdentifyOut({ ok: false, error: e.message });
      setStatusText(`lookup failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) return <Center><Text>initializing camera…</Text></Center>;
  if (!permission.granted) return <Center><Text>No camera permission</Text><Button title="Grant" onPress={requestPermission} /></Center>;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Supp Scanner</Text>
          <Text style={styles.status}>{statusText}</Text>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={async () => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    await signOut();
                  }
                }
              ]
            );
          }}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scannerBox}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : onScan}
          barcodeScannerSettings={{
            barcodeTypes: [
              'ean13','ean8','upc_a','upc_e',
              'code128','code39','code93','itf14',
              'qr','pdf417','aztec','datamatrix'
            ],
          }}
        />
      </View>

      <View style={styles.row}>
        <Button
          title="Scan again"
          onPress={() => {
            setScanned(false);
            lastCodeRef.current = null;
            setStatusText('camera ready — point at a barcode');
          }}
        />
        {loading && <ActivityIndicator />}
      </View>

      <Text style={styles.h2}>Supplement Analysis</Text>
      {identifyOut?.analysis ? (
        <Text>{identifyOut.analysis}</Text>
      ) : (
        <Text>No analysis available.</Text>
      )}

      <Text style={styles.h2}>Supplement Info</Text>
      {identifyOut?.found ? (
        <View style={styles.card}>
          <Text style={styles.name}>{identifyOut.doc?.name || 'Unknown name'}</Text>
          <Text style={styles.brand}>Brand: {identifyOut.doc?.brand || 'N/A'}</Text>
          {identifyOut.doc?.images?.[0] && (
            <Image
              source={{ uri: identifyOut.doc.images[0] }}
              style={styles.image}
              resizeMode="contain"
            />
          )}
        </View>
      ) : identifyOut ? (
        <Text>No supplement found for this barcode.</Text>
      ) : (
        <Text>—</Text>
      )}

      <Text style={styles.tip}>
        Tips: good light, hold ~15–25cm away, keep barcode straight. Test with a known EAN/UPC.
      </Text>
    </ScrollView>
  );
}

function mapType(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('ean') && t.includes('13')) return 'ean-13';
  if (t.includes('ean') && t.includes('8'))  return 'ean-8';
  if (t.includes('upc') && t.includes('a'))  return 'upc-a';
  if (t.includes('upc') && t.includes('e'))  return 'upc-e';
  return 'unknown';
}

const Center = ({ children }: { children: React.ReactNode }) =>
  <View style={[styles.scrollContainer, { justifyContent: 'center', alignItems: 'center' }]}>{children}</View>;

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  h1: { fontSize: 20, fontWeight: '700' },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  status: { color: '#555' },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc3545',
    borderRadius: 8,
  },
  signOutText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
  },
  scannerBox: { height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  tip: { fontSize: 12, color: '#777', marginTop: 8 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    marginTop: 8,
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  brand: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
});