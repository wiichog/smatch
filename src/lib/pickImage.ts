/**
 * Elegir una foto: «Tomar foto» o «Elegir de tus fotos» (2026-10-09, con cámara).
 *
 * Un solo lugar para las cuatro pantallas que piden foto (perfil, editar perfil,
 * bitácora y marcador del club). Antes cada una pedía solo la galería y, si la persona
 * había negado el permiso, el toque no hacía NADA: aquí se le dice cómo activarlo.
 * El reporte de problemas no usa esto: adjunta una captura, que siempre está en la galería.
 */
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";

export type PickedImage = { uri: string; name?: string | null; type?: string | null };

type Options = { square?: boolean; title?: string };

function askSource(title: string): Promise<"camera" | "library" | null> {
  return new Promise((resolve) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: ["Tomar foto", "Elegir de tus fotos", "Cancelar"], cancelButtonIndex: 2 },
        (i) => resolve(i === 0 ? "camera" : i === 1 ? "library" : null)
      );
      return;
    }
    Alert.alert(
      title,
      undefined,
      [
        { text: "Tomar foto", onPress: () => resolve("camera") },
        { text: "Elegir de tus fotos", onPress: () => resolve("library") },
        { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

function deniedAlert(source: "camera" | "library") {
  Alert.alert(
    source === "camera" ? "Sin acceso a la cámara" : "Sin acceso a tus fotos",
    source === "camera"
      ? "Para tomar la foto, permite que Smatch use la cámara en Ajustes."
      : "Para elegir una foto, permite que Smatch vea tus fotos en Ajustes.",
    [
      { text: "Ahora no", style: "cancel" },
      { text: "Abrir Ajustes", onPress: () => void Linking.openSettings() },
    ]
  );
}

export async function pickImage({ square = false, title = "Foto" }: Options = {}): Promise<PickedImage | null> {
  const source = await askSource(title);
  if (!source) return null;
  const perm =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    deniedAlert(source);
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.6,
    ...(square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}),
  };
  const res =
    source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.fileName, type: a.mimeType };
}
