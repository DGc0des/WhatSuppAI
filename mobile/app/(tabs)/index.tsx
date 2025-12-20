import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View, Image, Alert, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { identify, scanImageForBarcode } from '../../lib/api';
import { saveScannedSupplement, addToStack, isInStack } from '../../lib/storage';
import { signOut } from '../../lib/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

import { Redirect } from 'expo-router';
export  function Index() {
  return <Redirect href="../tabs"/>;
}


export default function Home() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [permission, requestPermission] = useCameraPermissions();
  const [statusText, setStatusText] = useState('booting…');
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identifyOut, setIdentifyOut] = useState<any>(null);
  const [inStack, setInStack] = useState(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastLogRef = useRef<number>(0);

  const styles = createStyles(theme);

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

        // Check if already in stack
        const stackStatus = await isInStack(raw);
        setInStack(stackStatus);
      }
    } catch (e: any) {
      setIdentifyOut({ ok: false, error: e.message });
      setStatusText(`lookup failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    // Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant access to your photos to use this feature.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: true, // Important: get base64 data
    });

    if (result.canceled) {
      return;
    }

    setLoading(true);
    setScanned(true);
    setStatusText('Scanning barcode from image…');
    setIdentifyOut(null);

    try {
      const imageAsset = result.assets[0];

      // Convert to base64 if not already
      const base64Image = imageAsset.base64
        ? `data:image/jpeg;base64,${imageAsset.base64}`
        : imageAsset.uri;

      // Send to backend for barcode scanning
      const scanResult = await scanImageForBarcode(base64Image);

      if (!scanResult.found) {
        Alert.alert(
          'No Barcode Found',
          'Could not detect a barcode in this image. Please try:\n• Taking a clearer photo\n• Ensuring good lighting\n• Getting closer to the barcode',
          [{ text: 'OK' }]
        );
        setLoading(false);
        setScanned(false);
        setStatusText('camera ready — point at a barcode');
        return;
      }

      // Found barcode! Now identify it
      setStatusText(`Found barcode: ${scanResult.barcode.raw} — looking it up…`);

      const sym = mapType(scanResult.barcode.symbology);
      const raw = String(scanResult.barcode.raw);
      const json = await identify({ raw, symbology: sym });

      console.log('[Gallery] API Response:', {
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

        // Check if already in stack
        const stackStatus = await isInStack(raw);
        setInStack(stackStatus);
      }

    } catch (e: any) {
      console.error('[Gallery] Error:', e);
      Alert.alert('Error', `Failed to process image: ${e.message}`);
      setStatusText('camera ready — point at a barcode');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToStack = async () => {
    if (!identifyOut?.found || !identifyOut?.doc) return;

    try {
      await addToStack({
        barcode: identifyOut.normalized?.ean13 || identifyOut.normalized?.upcA || '',
        name: identifyOut.doc.name || 'Unknown',
        brand: identifyOut.doc.brand || 'N/A',
        image: identifyOut.doc.images?.[0],
        analysis: identifyOut.analysis,
        rating: identifyOut.rating,
        scores: identifyOut.scores,
      });

      setInStack(true);
      Alert.alert('Success!', `${identifyOut.doc.name} has been added to your stack!`);
    } catch (error: any) {
      Alert.alert('Error', `Failed to add to stack: ${error.message}`);
    }
  };

  if (!permission) return <Center><Text>initializing camera…</Text></Center>;
  if (!permission.granted) return <Center><Text>No camera permission</Text><Button title="Grant" onPress={requestPermission} /></Center>;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Supp Scanner</Text>
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

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setScanned(false);
            lastCodeRef.current = null;
            setInStack(false);
            setIdentifyOut(null);
            setStatusText('camera ready — point at a barcode');
          }}
        >
          <Text style={styles.actionButtonText}>📷 Scan Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.galleryButton]}
          onPress={handlePickImage}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>🖼️ From Gallery</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.buttonPrimary} />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}

      <Text style={styles.h2}>Supplement Analysis</Text>
      {identifyOut?.analysis ? (
        <Text style={{ color: theme.text }}>{identifyOut.analysis}</Text>
      ) : (
        <Text style={{ color: theme.textMuted }}>No analysis available.</Text>
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

          {/* Add to Stack button */}
          <View style={styles.stackButtonContainer}>
            {inStack ? (
              <View style={styles.inStackBadge}>
                <Text style={styles.inStackText}>✓ In Your Stack</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addToStackButton}
                onPress={handleAddToStack}
              >
                <Text style={styles.addToStackButtonText}>+ Add to Stack</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : identifyOut ? (
        <Text style={{ color: theme.textMuted }}>No supplement found for this barcode.</Text>
      ) : (
        <Text style={{ color: theme.textMuted }}>—</Text>
      )}

      <Text style={styles.tip}>
        Tips: good light, hold ~15–25cm away, keep barcode straight. Or select an image from your gallery!
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

const Center = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const styles = createStyles(theme);
  return <View style={[styles.scrollContainer, { justifyContent: 'center', alignItems: 'center' }]}>{children}</View>;
};

const createStyles = (theme: typeof Colors.light) => StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: 12,
    backgroundColor: theme.background,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  h1: { fontSize: 20, fontWeight: '700', color: theme.text },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 12, color: theme.text },
  status: { color: theme.textSecondary },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.background,
    borderWidth: 1,
    borderColor: theme.buttonDanger,
    borderRadius: 8,
  },
  signOutText: {
    color: theme.buttonDanger,
    fontSize: 14,
    fontWeight: '600',
  },
  scannerBox: { height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  galleryButton: {
    backgroundColor: theme.buttonSecondary,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.buttonPrimary,
  },
  tip: { fontSize: 12, color: theme.textLight, marginTop: 8 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    backgroundColor: theme.cardBackground,
    marginTop: 8,
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.text,
  },
  brand: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 8,
  },
  image: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  stackButtonContainer: {
    width: '100%',
    marginTop: 16,
  },
  addToStackButton: {
    backgroundColor: theme.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  addToStackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inStackBadge: {
    backgroundColor: theme.successLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.success,
  },
  inStackText: {
    color: theme.success,
    fontSize: 16,
    fontWeight: '600',
  },
});
