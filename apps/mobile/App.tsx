import { useEffect, type JSX } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
import { Platform } from "react-native";

import { MobileApp } from "./src/mobile-shell/MobileApp";

export default function App(): JSX.Element {
  useEffect(() => {
    if (Platform.OS === "web") return;

    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => undefined);
  }, []);

  return <MobileApp />;
}
