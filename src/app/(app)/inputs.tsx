import { View } from "react-native";
import { useT } from "@/components/i18n/LanguageProvider";
import { InputPricesScreen } from "@/components/InputPricesScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

export default function InputsRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("hub.inputs")} />
      <InputPricesScreen />
    </View>
  );
}
