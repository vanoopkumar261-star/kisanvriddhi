import { useCallback, useEffect, useState } from "react";
import { useT } from "./i18n/LanguageProvider";
import { colors as tokens, themed } from "@/theme";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import {
  CATEGORY_META,
  CATEGORY_ORDER,
  getNews,
  timeAgo,
  type NewsArticle,
  type NewsCategory,
} from "@/lib/news";
import { getDashboardData } from "@/lib/dashboard";
import { extractStateFromAddress } from "@/lib/market";
import { colors } from "@/constants/colors";
import { cardShadow } from "@/constants/effects";
import { EmptyState } from "./ui/EmptyState";
import { SkeletonCard } from "./ui/Skeleton";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";

/**
 * Farming news, ranked against this farmer's own crops and state.
 *
 * The ranking and provider fallback all live in the web app's /api/news; this
 * screen supplies the two inputs that make it personal (crops, state) and is
 * honest about where the text came from — when no live provider answers, the
 * route returns model-written summaries and the header says so rather than
 * letting them read as reporting.
 */
export function NewsScreen() {
  const { t } = useT();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [aiWritten, setAiWritten] = useState(false);
  const [crops, setCrops] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<NewsCategory | null>(null);

  const load = useCallback(async () => {
    setFailed(false);

    const { farmer, farms } = await getDashboardData();
    const farmerCrops = Array.from(
      new Set(farms.map((f) => f.crop?.chosen_crop).filter((c): c is string => Boolean(c)))
    );
    // Derived locally rather than via /api/market: the state is only used to
    // bias the ranking, and that route hits Agmarknet to answer.
    const state = extractStateFromAddress(farmer?.house_address);

    setCrops(farmerCrops);

    const res = await getNews(farmerCrops, state);
    if (!res || res.source === "error") {
      setFailed(true);
    } else {
      setArticles(res.articles ?? []);
      setAiWritten(res.source === "ai");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const counts = CATEGORY_ORDER.reduce<Record<NewsCategory, number>>(
    (acc, c) => {
      acc[c] = articles.filter((a) => a.category === c).length;
      return acc;
    },
    { crop: 0, oilseed: 0, farming: 0, general: 0 }
  );

  useScreenDescriber("/news", () => {
    if (loading) return "";
    if (failed || !articles.length) return "No farm news could be loaded right now.";
    return "Farm news: " + articles.slice(0, 3).map((a, i) => `${i + 1}. ${a.title}. ${a.summary.slice(0, 160)}`).join(" ");
  });

  const shown = filter ? articles.filter((a) => a.category === filter) : articles;
  const [featured, ...rest] = shown;

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.headerRow}>
                    <Text style={styles.heading}>{t("nav.news")}</Text>
          <Text style={styles.sub}>
            {crops.length > 0
              ? `Tuned to ${crops.join(", ")}`
              : "Agriculture headlines from across India"}
          </Text>
        </View>

        {aiWritten && (
          <View style={styles.aiBanner}>
            <Ionicons name="sparkles-outline" size={14} color={colors.amber} />
            <Text style={styles.aiBannerText}>
              AI generated — no live news provider answered, so these summaries were written by
              the assistant.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={{ gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : failed ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load the news"
            body="Check your connection and pull down to try again."
          />
        ) : articles.length === 0 ? (
          <EmptyState
            icon="newspaper-outline"
            title="No stories right now"
            body="Nothing farming-related came through. Pull down to refresh."
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="All"
                count={articles.length}
                color={colors.primary}
                active={filter === null}
                onPress={() => setFilter(null)}
              />
              {CATEGORY_ORDER.filter((c) => counts[c] > 0).map((c) => (
                <Chip
                  key={c}
                  label={c === "crop" && crops.length > 0 ? crops[0] : CATEGORY_META[c].label}
                  count={counts[c]}
                  color={CATEGORY_META[c].color}
                  active={filter === c}
                  onPress={() => setFilter(filter === c ? null : c)}
                />
              ))}
            </ScrollView>

            {featured && <ArticleCard article={featured} featured />}
            {rest.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  count,
  color,
  active,
  onPress,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? color : colors.sageLine },
        active && { backgroundColor: `${color}14` },
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, active && { color, fontWeight: "700" }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.chipCount}>{count}</Text>
    </Pressable>
  );
}

function ArticleCard({ article, featured }: { article: NewsArticle; featured?: boolean }) {
  const { t } = useT();
  const meta = CATEGORY_META[article.category];

  return (
    <Pressable
      style={[styles.card, cardShadow]}
      onPress={() => Linking.openURL(article.url).catch(() => {})}
    >
      {article.imageUrl && (
        <Image
          source={{ uri: article.imageUrl }}
          style={featured ? styles.imageFeatured : styles.image}
          contentFit="cover"
          transition={180}
        />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardMetaRow}>
          <View style={[styles.tag, { backgroundColor: `${meta.color}14` }]}>
            <Ionicons name={meta.icon as never} size={11} color={meta.color} />
            <Text style={[styles.tagText, { color: meta.color }]}>
              {article.relevantCrop ?? meta.label}
            </Text>
          </View>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            {article.source}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.metaText}>{timeAgo(article.publishedAt)}</Text>
        </View>

        <Text style={featured ? styles.titleFeatured : styles.title} numberOfLines={featured ? 4 : 3}>
          {article.title}
        </Text>
        <Text style={styles.summary} numberOfLines={featured ? 4 : 2}>
          {article.summary}
        </Text>

        <View style={styles.readRow}>
          <Text style={styles.readText}>{t("news.readStory")}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.leaf} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = themed(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  container: { padding: 20, gap: 14, paddingBottom: 40 },

  headerRow: { gap: 3 },
  eyebrow: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.leaf },
  heading: { fontSize: 24, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 13, color: colors.textSoft },

  aiBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: tokens.accentSoft,
    borderWidth: 1,
    borderColor: `${colors.amber}55`,
    borderRadius: 16,
    padding: 10,
  },
  aiBannerText: { flex: 1, fontSize: 12, color: colors.ink, lineHeight: 16 },

  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    maxWidth: 190,
  },
  chipDot: { width: 6, height: 6, borderRadius: 8 },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.textSoft, flexShrink: 1 },
  chipCount: { fontSize: 12, fontWeight: "700", color: colors.textFaint },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: { width: "100%", height: 128, backgroundColor: colors.sage },
  imageFeatured: { width: "100%", height: 186, backgroundColor: colors.sage },
  cardBody: { padding: 14, gap: 6 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  dot: { color: colors.textFaint, fontSize: 12 },
  metaText: { fontSize: 12, color: colors.textFaint, flexShrink: 1 },

  title: { fontSize: 15, fontWeight: "700", color: colors.ink, lineHeight: 20 },
  titleFeatured: { fontSize: 18, fontWeight: "700", color: colors.ink, lineHeight: 23 },
  summary: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },

  readRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  readText: { fontSize: 12, fontWeight: "700", color: colors.leaf },
}));
