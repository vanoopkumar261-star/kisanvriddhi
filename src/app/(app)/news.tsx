import { View } from "react-native";
import { NewsScreen } from "@/components/NewsScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useT } from "@/components/i18n/LanguageProvider";

export default function NewsRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("nav.news")} />
      <NewsScreen />
    </View>
  );
}
