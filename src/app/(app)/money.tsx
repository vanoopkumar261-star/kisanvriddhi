import { View } from "react-native";
import { ExpensesScreen } from "@/components/ExpensesScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useT } from "@/components/i18n/LanguageProvider";

export default function MoneyRoute() {
  const { t } = useT();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title={t("nav.expenses")} />
      <ExpensesScreen />
    </View>
  );
}
