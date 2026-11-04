import { useMemo, useState } from "react";
import { useT } from "./i18n/LanguageProvider";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { CATEGORIES, LIBRARY, type Book } from "@/lib/library";
import { colors } from "@/constants/colors";
import { cardShadow } from "@/constants/effects";
import { EmptyState } from "./ui/EmptyState";
import { BookReader } from "./library/BookReader";

import { themed } from "@/theme";
import { useScreenDescriber } from "@/lib/agent/screenRegistry";
/**
 * The Jaivik Sathi eLibrary — six organic-farming guides, readable offline.
 *
 * All content is bundled with the app, so unlike every other screen this one
 * works with no backend and no connection. Only the optional PDF and video
 * links reach outward.
 */
export function LibraryScreen() {
  const { t } = useT();
  const [category, setCategory] = useState<Book["category"] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Book | null>(null);

  const books = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY.filter((b) => {
      if (category && b.category !== category) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.subtitle.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  useScreenDescriber("/learn", () =>
    `Farming library with ${LIBRARY.length} books: ${LIBRARY.slice(0, 5).map((b) => b.title).join(", ")}. The farmer can tap a book to read it.`
  );

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>JAIVIK SATHI</Text>
          <Text style={styles.heading}>eLibrary</Text>
          <Text style={styles.sub}>
            Practical guides to organic inputs, composting and soil care — readable offline.
          </Text>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            style={styles.search}
            placeholder={t("library.search")}
            placeholderTextColor={colors.textFaint}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <CategoryChip
            label="All"
            count={LIBRARY.length}
            active={category === null}
            onPress={() => setCategory(null)}
          />
          {CATEGORIES.map((c) => (
            <CategoryChip
              key={c.name}
              label={c.name}
              count={c.count}
              active={category === c.name}
              onPress={() => setCategory(category === c.name ? null : c.name)}
            />
          ))}
        </ScrollView>

        {books.length === 0 ? (
          <EmptyState
            icon="book-outline"
            title="No books match that"
            body="Try a different word, or clear the filters."
          />
        ) : (
          books.map((book) => (
            <BookCard key={book.id} book={book} onPress={() => setOpen(book)} />
          ))
        )}
      </ScrollView>

      {open && <BookReader book={open} onClose={() => setOpen(null)} />}
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      <Text style={[styles.chipCount, active && styles.chipTextActive]}>{count}</Text>
    </Pressable>
  );
}

function BookCard({ book, onPress }: { book: Book; onPress: () => void }) {
  return (
    <Pressable style={[styles.card, cardShadow]} onPress={onPress}>
      <Image source={book.image} style={styles.cover} contentFit="cover" transition={180} />
      {/* The spine carries the book's own hardcover colour through from the web edition. */}
      <View style={[styles.spine, { backgroundColor: book.color }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${book.accentColor}1A` }]}>
            <Ionicons name={book.icon} size={15} color={book.accentColor} />
          </View>
          <Text style={[styles.category, { color: book.accentColor }]}>{book.category}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.duration}>{book.duration}</Text>
        </View>

        <Text style={styles.title}>{book.title}</Text>
        <Text style={styles.subtitle}>{book.subtitle}</Text>
        <Text style={styles.description} numberOfLines={3}>
          {book.description}
        </Text>

        <View style={styles.footerRow}>
          <Text style={[styles.read, { color: book.accentColor }]}>
            Read {book.pages.length} pages
          </Text>
          <Ionicons name="arrow-forward" size={14} color={book.accentColor} />
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
  sub: { fontSize: 13, color: colors.textSoft, lineHeight: 18 },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  search: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.ink },

  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.sage, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  chipCount: { fontSize: 12, fontWeight: "700", color: colors.textFaint },
  chipTextActive: { color: colors.primary },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageLine,
    borderRadius: 16,
    overflow: "hidden",
  },
  cover: { width: "100%", height: 132, backgroundColor: colors.sage },
  spine: { height: 4, width: "100%" },
  cardBody: { padding: 14, gap: 4 },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  category: { fontSize: 12, fontWeight: "700" },
  dot: { color: colors.textFaint, fontSize: 12 },
  duration: { fontSize: 12, color: colors.textFaint },

  title: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 2 },
  subtitle: { fontSize: 13, fontWeight: "600", color: colors.leaf },
  description: { fontSize: 13, color: colors.textSoft, lineHeight: 18, marginTop: 2 },

  footerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  read: { fontSize: 12, fontWeight: "700" },
}));
