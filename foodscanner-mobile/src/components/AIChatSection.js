import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { askNutritionAssistant } from '../services/api';

const C = {
  cream: '#F5F2EC',
  ink: '#1A1A17',
  sage: '#4E8C52',
  sageLight: '#C3D9C5',
  amberLight: '#F0D9A8',
  redLight: '#F0C8C0',
  border: '#DDD8CE',
  muted: '#888179',
  white: '#FFFFFF',
  red: '#B83C28',
};

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
        content: res?.answer || 'No response returned.',
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
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded((v) => !v)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>🤖 AI Nutrition Assistant</Text>
          <Text style={styles.cardSubtitle}>
            Grounded Q&A using official ICMR, WHO & FSSAI nutrition guidelines
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.contentWrap}>
          {messages.length === 0 ? (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestTitle}>Suggested Questions:</Text>
              <View style={styles.chipsRow}>
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.chip}
                    onPress={() => handleSend(q)}
                    disabled={loading}
                  >
                    <Text style={styles.chipText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {messages.length > 0 ? (
            <View style={styles.messagesList}>
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <View
                    key={idx}
                    style={[
                      styles.bubbleWrap,
                      isUser ? styles.userBubbleWrap : styles.assistantBubbleWrap,
                    ]}
                  >
                    <View
                      style={[
                        styles.bubble,
                        isUser ? styles.userBubble : styles.assistantBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          isUser ? styles.userBubbleText : styles.assistantBubbleText,
                        ]}
                      >
                        {m.content}
                      </Text>

                      {!isUser && Array.isArray(m.sources) && m.sources.length > 0 ? (
                        <View style={styles.sourcesBox}>
                          <Text style={styles.sourcesTitle}>Sources:</Text>
                          {m.sources.map((s, sIdx) => {
                            const title = s?.title || s?.source || `Source #${sIdx + 1}`;
                            const type = s?.source_type ? ` (${s.source_type})` : '';
                            return (
                              <Text key={sIdx} style={styles.sourceItem}>
                                • {title}{type}
                              </Text>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={C.sage} size="small" />
              <Text style={styles.loadingText}>PRAMAAN AI is thinking...</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask about this food..."
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
              editable={!loading}
              onSubmitEditing={() => handleSend(query)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !query.trim() || loading ? styles.sendBtnDisabled : null]}
              onPress={() => handleSend(query)}
              disabled={!query.trim() || loading}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.ink,
  },
  cardSubtitle: {
    marginTop: 4,
    color: C.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 18,
    fontWeight: '900',
    color: C.ink,
  },
  contentWrap: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  suggestionsWrap: {
    marginBottom: 10,
  },
  suggestTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: C.muted,
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: C.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink,
  },
  messagesList: {
    marginBottom: 10,
    gap: 8,
  },
  bubbleWrap: {
    flexDirection: 'row',
  },
  userBubbleWrap: {
    justifyContent: 'flex-end',
  },
  assistantBubbleWrap: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '90%',
    borderRadius: 14,
    padding: 10,
  },
  userBubble: {
    backgroundColor: C.ink,
  },
  assistantBubble: {
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  userBubbleText: {
    color: C.white,
    fontWeight: '700',
  },
  assistantBubbleText: {
    color: C.ink,
    fontWeight: '600',
  },
  sourcesBox: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
  sourcesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.muted,
  },
  sourceItem: {
    fontSize: 10,
    color: C.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
  },
  errorBox: {
    marginBottom: 8,
    backgroundColor: C.redLight,
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#8c1a0a',
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: C.ink,
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: C.sage,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: C.white,
    fontWeight: '900',
    fontSize: 13,
  },
});
