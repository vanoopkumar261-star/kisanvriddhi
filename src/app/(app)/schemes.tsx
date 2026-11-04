import { View } from "react-native";
import { SchemesScreen } from "@/components/SchemesScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useT } from "@/components/i18n/LanguageProvider";

export default function SchemesRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("nav.schemes")} />
      <SchemesScreen />
    </View>
  );
}
