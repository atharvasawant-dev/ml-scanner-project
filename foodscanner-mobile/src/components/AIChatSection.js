import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { askNutritionAssistant } from '../services/api';
import { NEO_COLORS, NEO_BORDERS, NEO_RADIUS, NEO_SHADOWS } from '../theme/neoTheme';

const SUGGESTED_QUESTIONS = [
  'Is this good for weight loss?',
  'Why did this product get this score?',
  'Explain the additives',
  'How much sugar does it contain?',
];

export default function AIChatSection({
  barcode = null,
  productName = null,
  nutrition = null,
  healthScore = null,
  decision = null,
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async (textToSend) => {
    const message = String(textToSend || query || '').trim();
    if (!message || loading) return;

    const userMsg = { role: 'user', content: message };
    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    setError(null);

    const productContext = {
      product_name: productName || null,
      barcode: barcode && String(barcode) !== '00000000' ? String(barcode) : null,
      nutrition: nutrition || null,
      health_score: healthScore != null ? Number(healthScore) : null,
      final_decision: decision || null,
    };

    try {
      const res = await askNutritionAssistant({
        message,
        barcode: barcode && String(barcode) !== '00000000' ? String(barcode) : null,
        productContext,
      });

      const assistantMsg = {
        role: 'assistant',
        content: res?.answer || res?.reply || 'No response returned.',
        sources: Array.isArray(res?.sources) ? res.sources : [],
        disclaimer: res?.disclaimer || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const status = e?.response?.status;
      let msg = 'AI assistant is temporarily unavailable. Please try again later.';
      if (status === 400 && e?.response?.data?.detail) {
        msg = String(e.response.data.detail);
      } else if (e?.response?.data?.detail) {
        msg = String(e.response.data.detail);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, NEO_SHADOWS.md]}>
      {/* Neo-Brutalist Purple Banner */}
      <TouchableOpacity
        style={styles.headerBanner}
        activeOpacity={0.85}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={styles.headerLeft}>
          <View style={styles.circleMarker} />
          <Text style={styles.headerTitle}>AI NUTRITION ASSISTANT</Text>
        </View>
        <View style={styles.toggleTag}>
          <Text style={styles.toggleTagText}>{expanded ? 'COLLAPSE ▴' : 'ASK AI ▾'}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.cardContent}>
        <Text style={styles.cardSubtitle}>
          Grounded Q&A using official ICMR, WHO & FSSAI nutrition guidelines
        </Text>

        {expanded ? (
          <View style={styles.chatSection}>
            {/* Suggested prompts */}
            <View style={styles.suggestWrap}>
              <Text style={styles.suggestLabel}>SUGGESTED QUESTIONS:</Text>
              <View style={styles.chipsRow}>
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.suggestChip}
                    activeOpacity={0.8}
                    onPress={() => handleSend(q)}
                  >
                    <Text style={styles.suggestText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Messages */}
            <View style={styles.messagesWrap}>
              {messages.length === 0 ? (
                <View style={styles.emptyPrompt}>
                  <Text style={styles.emptyPromptText}>
                    Ask anything about this food's ingredients, allergens, or diet suitability!
                  </Text>
                </View>
              ) : null}

              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <View
                    key={idx}
                    style={[
                      styles.bubble,
                      isUser ? styles.userBubble : styles.assistantBubble,
                      NEO_SHADOWS.sm,
                    ]}
                  >
                    <View style={styles.bubbleHeader}>
                      <Text style={styles.bubbleSender}>{isUser ? 'YOU' : 'PRAMAAN AI'}</Text>
                    </View>
                    <Text style={styles.bubbleText}>{m.content}</Text>

                    {m.sources && m.sources.length > 0 ? (
                      <View style={styles.sourcesBox}>
                        <Text style={styles.sourcesTitle}>EVIDENCE SOURCES:</Text>
                        <View style={styles.sourcesRow}>
                          {m.sources.map((s, sIdx) => {
                            const name = typeof s === 'string' ? s : s?.title || s?.source || `Ref #${sIdx + 1}`;
                            return (
                              <View key={sIdx} style={styles.sourceTag}>
                                <Text style={styles.sourceTagText}>📖 {name}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {m.disclaimer ? (
                      <Text style={styles.msgDisclaimer}>{m.disclaimer}</Text>
                    ) : null}
                  </View>
                );
              })}

              {loading ? (
                <View style={styles.loadingBubble}>
                  <ActivityIndicator color={NEO_COLORS.ink} size="small" />
                  <Text style={styles.loadingText}>Synthesizing clinical & statutory nutrition context...</Text>
                </View>
              ) : null}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <View style={[styles.inputBox, NEO_SHADOWS.sm]}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask a question..."
                  placeholderTextColor={NEO_COLORS.muted}
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={() => handleSend()}
                  returnKeyType="send"
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, NEO_SHADOWS.sm, (!query.trim() || loading) && styles.sendBtnDisabled]}
                activeOpacity={0.85}
                onPress={() => handleSend()}
                disabled={!query.trim() || loading}
              >
                <Text style={styles.sendBtnText}>SEND</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: NEO_COLORS.white,
    borderRadius: NEO_RADIUS.md,
    borderWidth: NEO_BORDERS.thick,
    borderColor: NEO_COLORS.border,
    overflow: 'hidden',
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NEO_COLORS.purple,
    borderBottomWidth: NEO_BORDERS.thick,
    borderBottomColor: NEO_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: NEO_COLORS.white,
    letterSpacing: 0.5,
  },
  toggleTag: {
    backgroundColor: NEO_COLORS.white,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  toggleTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.ink,
  },
  cardContent: {
    padding: 14,
  },
  cardSubtitle: {
    color: NEO_COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  chatSection: {
    marginTop: 12,
  },
  suggestWrap: {
    marginBottom: 10,
  },
  suggestLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestChip: {
    backgroundColor: NEO_COLORS.purpleLight,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  suggestText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  messagesWrap: {
    gap: 10,
    marginVertical: 10,
  },
  emptyPrompt: {
    padding: 12,
    backgroundColor: NEO_COLORS.bgAlt,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    borderStyle: 'dashed',
  },
  emptyPromptText: {
    fontSize: 12,
    fontWeight: '700',
    color: NEO_COLORS.muted,
    textAlign: 'center',
    lineHeight: 17,
  },
  bubble: {
    borderRadius: NEO_RADIUS.sm,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    padding: 12,
  },
  userBubble: {
    backgroundColor: NEO_COLORS.yellow,
    alignSelf: 'flex-end',
    maxWidth: '90%',
  },
  assistantBubble: {
    backgroundColor: NEO_COLORS.white,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  bubbleHeader: {
    marginBottom: 4,
  },
  bubbleSender: {
    fontSize: 10,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    letterSpacing: 0.5,
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '700',
    color: NEO_COLORS.ink,
    lineHeight: 18,
  },
  sourcesBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.bgAlt,
  },
  sourcesTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: NEO_COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  sourceTag: {
    backgroundColor: NEO_COLORS.bgAlt,
    borderWidth: 1,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  msgDisclaimer: {
    marginTop: 6,
    fontSize: 9,
    fontStyle: 'italic',
    color: NEO_COLORS.muted,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: NEO_COLORS.bgAlt,
    borderRadius: NEO_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  errorBox: {
    backgroundColor: NEO_COLORS.status.avoidBg,
    borderWidth: 1.5,
    borderColor: NEO_COLORS.border,
    padding: 8,
    borderRadius: NEO_RADIUS.sm,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '800',
    color: NEO_COLORS.ink,
  },
  inputBar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inputBox: {
    flex: 1,
    backgroundColor: NEO_COLORS.white,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    paddingHorizontal: 10,
  },
  input: {
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: NEO_COLORS.ink,
  },
  sendBtn: {
    backgroundColor: NEO_COLORS.yellow,
    borderWidth: NEO_BORDERS.regular,
    borderColor: NEO_COLORS.border,
    borderRadius: NEO_RADIUS.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: NEO_COLORS.ink,
    letterSpacing: 0.5,
  },
});
