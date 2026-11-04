import { View } from "react-native";
import { LibraryScreen } from "@/components/LibraryScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useT } from "@/components/i18n/LanguageProvider";

export default function LearnRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("nav.library")} />
      <LibraryScreen />
    </View>
  );
}
