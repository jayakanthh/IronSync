import React, { useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme/colors';

/** The symbologies actually printed on food packaging. */
const FOOD_BARCODES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

/**
 * Full-screen barcode scanner. Reports the first code it reads and closes;
 * the caller decides what to do with it.
 */
export default function BarcodeScanner({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  // The camera fires this repeatedly for the same code — take the first only.
  const handled = useRef(false);

  const close = () => {
    handled.current = false;
    setTorch(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} onShow={() => (handled.current = false)}>
      <View style={styles.screen}>
        {!permission?.granted ? (
          <View style={styles.prompt}>
            <Text style={styles.promptTitle}>Camera access needed</Text>
            <Text style={styles.promptText}>
              IronSync uses the camera only to read barcodes on food packaging.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
              <Text style={styles.primaryBtnText}>Allow camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={close} style={styles.linkBtn}>
              <Text style={styles.linkText}>Not now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: [...FOOD_BARCODES] }}
              onBarcodeScanned={({ data }) => {
                if (handled.current || !data) return;
                handled.current = true;
                onScanned(data);
              }}
            />

            {/* Aiming frame */}
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.reticle} />
              <Text style={styles.hint}>Line the barcode up inside the frame</Text>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={close}>
              <X size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.torchBtn} onPress={() => setTorch((t) => !t)}>
              <Text style={styles.torchText}>{torch ? 'Torch off' : 'Torch on'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  reticle: {
    width: '78%',
    height: 170,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  hint: { color: '#ffffff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  closeBtn: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchBtn: {
    position: 'absolute',
    bottom: 56,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  torchText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  prompt: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
  promptTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  promptText: { color: '#b6b6b6', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  primaryBtnText: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' },
  linkBtn: { paddingVertical: 10 },
  linkText: { color: '#9a9a9a', fontSize: 14 },
});
