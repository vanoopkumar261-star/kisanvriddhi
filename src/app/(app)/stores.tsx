import { View } from "react-native";
import { StoreLocatorScreen } from "@/components/StoreLocatorScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useT } from "@/components/i18n/LanguageProvider";

export default function StoresRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("nav.storeLocator")} />
      <StoreLocatorScreen />
    </View>
  );
}
