import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';

const API_BASE = 'http://10.36.10.83:8000';

interface DescribeResult {
  caption: string;
  extracted_text: string;
  full_description: string;
  cached: boolean;
  elapsed_s: number;
}

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DescribeResult | null>(null);
  const [error, setError] = useState('');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, []);

  const captureAndDescribe = useCallback(async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    setError('');
    await Speech.stop();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('Camera did not return an image');
      const form = new FormData();
      form.append('file', {
        uri: photo.uri,
        name: 'frame.jpg',
        type: 'image/jpeg',
      } as unknown as Blob);

      const res = await fetch(`${API_BASE}/describe-image`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Backend error ${res.status}`);
      }
      const data = (await res.json()) as DescribeResult;
      setResult(data);
      Speech.speak(data.full_description, { rate: 0.95 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(`${msg} — is the backend running, and is this phone on the same network as the laptop?`);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffff00" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access AI needs the camera</Text>
        <Text style={styles.hint}>It describes what you point at and reads it aloud.</Text>
        <TouchableOpacity style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        {busy && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#ffff00" />
            <Text style={styles.overlayText}>Describing...</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={() => void captureAndDescribe()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Capture and describe what the camera sees"
      >
        <Text style={styles.buttonText}>{busy ? 'Working...' : 'Describe what I see'}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultBox} accessibilityLiveRegion="polite">
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : result ? (
          <>
            <Text style={styles.label}>Scene</Text>
            <Text style={styles.text}>{result.caption}</Text>
            <Text style={styles.label}>Text found</Text>
            <Text style={styles.text}>{result.extracted_text}</Text>
            <Text style={styles.meta}>
              {result.elapsed_s}s · {result.cached ? 'cached' : 'fresh'}
            </Text>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => Speech.speak(result.full_description, { rate: 0.95 })}
            >
              <Text style={styles.buttonText}>Read again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallButton} onPress={() => void Speech.stop()}>
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.hint}>
            Point at anything — a page, a label, a face — and tap the big button.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', padding: 24 },
  cameraWrap: { flex: 1.1, backgroundColor: '#111' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayText: { color: '#ffff00', fontSize: 18, marginTop: 8 },
  button: { margin: 12, padding: 18, borderRadius: 14, backgroundColor: '#ffff00', alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontSize: 20, fontWeight: '700' },
  smallButton: { marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#222', alignItems: 'center', borderWidth: 1, borderColor: '#ffff00' },
  resultBox: { flex: 1, backgroundColor: '#000', paddingHorizontal: 16, paddingBottom: 24 },
  label: { color: '#ffff00', fontSize: 14, fontWeight: '700', marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
  text: { color: '#fff', fontSize: 18, lineHeight: 26, marginTop: 4 },
  meta: { color: '#888', fontSize: 12, marginTop: 8 },
  hint: { color: '#bbb', fontSize: 16, lineHeight: 24, marginTop: 12 },
  error: { color: '#ff6666', fontSize: 16, lineHeight: 24, marginTop: 12 },
  title: { color: '#ffff00', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
