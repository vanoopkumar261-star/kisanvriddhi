import { useRef, useState } from "react";
import { FlatList, Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Pressable } from "@/components/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import type { Book, BookPage } from "@/lib/library";
import { API_BASE_URL } from "@/lib/apiBase";
import { colors } from "@/constants/colors";

import { themed } from "@/theme";
/**
 * Full-screen book reader.
 *
 * The web app renders these books in a page-flip widget; the native equivalent
 * of "turning a page" is a horizontal paged swipe, so this is a paged FlatList
 * rather than a port of the flip animation. Each page scrolls vertically on its
 * own, since a page of prose is taller than a phone.
 */
export function BookReader({ book, onClose }: { book: Book; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<BookPage>>(null);

  // The two supplied PDFs are served by the web app, so the button is only
  // offered when there is a backend to serve them from.
  const pdfHref = book.pdfUrl && API_BASE_URL ? `${API_BASE_URL}${book.pdfUrl}` : null;
  const videoHref = book.youtubeId ? `https://www.youtube.com/watch?v=${book.youtubeId}` : null;

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(book.pages.length - 1, next));
    listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    setPage(clamped);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={["top", "left", "right"]} style={[styles.root, { backgroundColor: book.color }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close book">
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {book.title}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {book.subtitle}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {videoHref && (
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(videoHref)}
                hitSlop={10}
                accessibilityLabel="Watch the video"
              >
                <Ionicons name="logo-youtube" size={21} color="#fff" />
              </Pressable>
            )}
            {pdfHref && (
              <Pressable
                onPress={() => WebBrowser.openBrowserAsync(pdfHref)}
                hitSlop={10}
                accessibilityLabel="Open the PDF"
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={book.pages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item }) => (
            <View style={{ width }}>
              <PageView page={item} accent={book.accentColor} />
            </View>
          )}
        />

        <View style={styles.footer}>
          <Pressable
            onPress={() => goTo(page - 1)}
            disabled={page === 0}
            hitSlop={10}
            style={page === 0 && styles.disabled}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.footerText}>
            {page + 1} / {book.pages.length}
          </Text>
          <Pressable
            onPress={() => goTo(page + 1)}
            disabled={page >= book.pages.length - 1}
            hitSlop={10}
            style={page >= book.pages.length - 1 && styles.disabled}
          >
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function PageView({ page, accent }: { page: BookPage; accent: string }) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.sheet}>
        {page.header && (
          <Text style={[styles.pageHeader, { color: accent }]}>{page.header.toUpperCase()}</Text>
        )}
        <View style={styles.titleRow}>
          {page.icon && <Text style={styles.pageIcon}>{page.icon}</Text>}
          <Text style={styles.pageTitle}>{page.title}</Text>
        </View>

        {page.content.map((para, i) => (
          <Text key={i} style={styles.para}>
            {para}
          </Text>
        ))}

        {page.bullets && page.bullets.length > 0 && (
          <View style={styles.bullets}>
            {page.bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: accent }]} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {page.tip && (
          <View style={[styles.tip, { borderLeftColor: accent }]}>
            <Text style={[styles.tipLabel, { color: accent }]}>TIP</Text>
            <Text style={styles.tipText}>{page.tip}</Text>
          </View>
        )}

        {page.quote && <Text style={styles.quote}>{page.quote}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerText: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 14 },

  page: { padding: 14, paddingBottom: 28 },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  pageHeader: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pageIcon: { fontSize: 28 },
  pageTitle: { flex: 1, fontSize: 24, fontWeight: "700", color: colors.ink, lineHeight: 27 },
  para: { fontSize: 15, color: colors.textSoft, lineHeight: 23 },

  bullets: { gap: 8, marginTop: 2 },
  bulletRow: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  bulletDot: { width: 6, height: 6, borderRadius: 8, marginTop: 8 },
  bulletText: { flex: 1, fontSize: 15, color: colors.textSoft, lineHeight: 21 },

  tip: {
    backgroundColor: colors.bg,
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  tipLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2 },
  tipText: { fontSize: 13, color: colors.ink, lineHeight: 20 },

  quote: {
    fontSize: 15,
    fontStyle: "italic",
    color: colors.primary,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 4,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  footerText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.3 },
}));
