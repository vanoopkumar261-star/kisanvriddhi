import { View } from "react-native";
import { MarketScreen } from "@/components/MarketScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useT } from "@/components/i18n/LanguageProvider";

export default function MarketRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("nav.market")} />
      <MarketScreen />
    </View>
  );
}
