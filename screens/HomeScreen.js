import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

/**
 * User-friendly upgrades included:
 * ✅ Action menu is a single bottom-sheet style menu (one instance)
 * ✅ AestheticAlert for delete confirm (one instance)
 * ✅ Full-screen Edit Modal for long text (best UX)
 * ✅ View Modal to read full text (NEW)
 * ✅ Prevent menu opening while editing a different item
 * ✅ Better microcopy + disabled states + character count
 */

/**
 * AestheticAlert (Reusable)
 */
function AestheticAlert({
  visible,
  title,
  message,
  details,
  iconName = "alert-circle-outline",
  tone = "info", // "danger" | "info" | "success"
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  const toneConfig = useMemo(() => {
    if (tone === "danger") return { icon: "#d66a7a", button: "#d66a7a" };
    if (tone === "success") return { icon: "#10b981", button: "#10b981" };
    return { icon: "#f4c4c4", button: "#f4c4c4" };
  }, [tone]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.modalOverlay} onPress={onCancel}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalIconWrap}>
            <MaterialCommunityIcons
              name={iconName}
              size={26}
              color={toneConfig.icon}
            />
          </View>

          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>

          {!!details ? (
            <View style={styles.modalDetailsBox}>
              <Text style={styles.modalDetailsText} numberOfLines={3}>
                {details}
              </Text>
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalCancel, loading ? styles.btnDisabled : null]}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={cancelText}
            >
              <Text style={styles.modalCancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalConfirm,
                { backgroundColor: toneConfig.button },
                loading ? styles.btnDisabled : null,
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalConfirmText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * ActionMenu (Reusable) - bottom sheet feel
 * ✅ Added "View" option
 */
function ActionMenu({ visible, onClose, onView, onEdit, onDelete, disabled }) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <Pressable style={styles.menuSheet} onPress={() => {}}>
          <Text style={styles.menuTitle}>Options</Text>

          {/* VIEW */}
          <TouchableOpacity
            style={[styles.menuItem, disabled ? styles.btnDisabled : null]}
            onPress={onView}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconPill}>
              <MaterialCommunityIcons
                name="eye-outline"
                size={18}
                color="#6366f1"
              />
            </View>
            <Text style={styles.menuItemText}>View</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* EDIT */}
          <TouchableOpacity
            style={[styles.menuItem, disabled ? styles.btnDisabled : null]}
            onPress={onEdit}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconPill}>
              <MaterialCommunityIcons name="pencil" size={18} color="#e9a3b0" />
            </View>
            <Text style={styles.menuItemText}>Edit</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          {/* DELETE */}
          <TouchableOpacity
            style={[styles.menuItem, disabled ? styles.btnDisabled : null]}
            onPress={onDelete}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconPill, styles.menuIconPillDanger]}>
              <MaterialCommunityIcons name="trash-can" size={18} color="#fff" />
            </View>
            <Text style={[styles.menuItemText, { color: "#d66a7a" }]}>
              Delete
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuClose}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.menuCloseText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function HomeScreen() {
  const [input, setInput] = useState("");
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [debugError, setDebugError] = useState("");

  // ✅ Action menu (single instance)
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuItem, setMenuItem] = useState(null);

  // ✅ Delete confirm
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState("");

  // ✅ Full-screen edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingText, setEditingText] = useState("");

  // ✅ View modal (NEW)
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewItem, setViewItem] = useState(null);

  const isEditing = editModalVisible;

  const isAddDisabled = useMemo(() => {
    const title = input.trim();
    return saving || loading || !title || isEditing;
  }, [input, saving, loading, isEditing]);

  useEffect(() => {
    fetchTopics();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      fetchTopics();
    });

    return () => sub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setDebugError("");

    const { data, error } = await supabase
      .from("learning_topics")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Fetch error:", error);
      setDebugError(`${error.message} (code: ${error.code ?? "n/a"})`);
      setTopics([]);
    } else {
      setTopics(data ?? []);
    }

    setLoading(false);
  }, []);

  const addTopic = async () => {
    const title = input.trim();
    if (!title) return;

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      setSaving(false);
      Alert.alert("Sign in required", "Please sign in to add topics.");
      return;
    }

    const { error } = await supabase
      .from("learning_topics")
      .insert([{ title, user_id: userId }]);

    if (error) Alert.alert("Couldn't add topic", error.message);
    else {
      setInput("");
      fetchTopics();
    }

    setSaving(false);
  };

  // ✅ Menu
  const openMenu = (item) => {
    if (isEditing && editingItem?.id !== item.id) {
      Alert.alert("Finish editing first", "Save or cancel your current edit.");
      return;
    }
    setMenuItem(item);
    setMenuVisible(true);
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setMenuItem(null);
  };

  // ✅ View (NEW)
  const openView = (item) => {
    closeMenu();
    setViewItem(item);
    setViewModalVisible(true);
  };

  const closeView = () => {
    setViewModalVisible(false);
    setViewItem(null);
  };

  // ✅ Delete confirm
  const requestDelete = (item) => {
    closeMenu();
    setPendingDeleteId(item.id);
    setPendingDeleteTitle(item.title);
    setConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;

    setSaving(true);

    const { error } = await supabase
      .from("learning_topics")
      .delete()
      .eq("id", pendingDeleteId);

    if (error) Alert.alert("Couldn't delete topic", error.message);
    else fetchTopics();

    setSaving(false);
    setConfirmVisible(false);
    setPendingDeleteId(null);
    setPendingDeleteTitle("");
  };

  const cancelDelete = () => {
    setConfirmVisible(false);
    setPendingDeleteId(null);
    setPendingDeleteTitle("");
  };

  // ✅ Start edit (open modal)
  const startEdit = (item) => {
    closeMenu();
    setEditingItem(item);
    setEditingText(item.title);
    setEditModalVisible(true);
  };

  const saveEditFromModal = async () => {
    if (!editingItem) return;

    const next = editingText.trim();
    if (!next) {
      Alert.alert("Topic required", "Topic cannot be empty.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("learning_topics")
      .update({ title: next })
      .eq("id", editingItem.id);

    if (error) {
      Alert.alert("Couldn't save changes", error.message);
    } else {
      setEditModalVisible(false);
      setEditingItem(null);
      setEditingText("");
      fetchTopics();
    }

    setSaving(false);
  };

  const cancelModalEdit = () => {
    setEditModalVisible(false);
    setEditingItem(null);
    setEditingText("");
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemContent}>
        <View style={styles.textContainer}>
          <Text style={styles.itemText} numberOfLines={3}>
            {item.title}
          </Text>

          {/* ✅ Show date and time created */}
          <View style={styles.itemMetaRow}>
            <MaterialCommunityIcons
              name="calendar-outline"
              size={25}
              color="#9ca3af"
            />
            <Text style={styles.itemSubText}>
              {item.created_at
                ? new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "No date"}
            </Text>

            <MaterialCommunityIcons
              name="clock-outline"
              size={25}
              color="#9ca3af"
              style={{ marginLeft: 8 }}
            />
            <Text style={styles.itemSubText}>
              {item.created_at
                ? new Date(item.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })
                : "No time"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.ellipsisButton}
          onPress={() => openMenu(item)}
          disabled={saving}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open options for ${item.title}`}
        >
          <MaterialCommunityIcons
            name="dots-vertical"
            size={25}
            color="#9ca3af"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ✅ Action menu (single instance) */}
      <ActionMenu
        visible={menuVisible}
        onClose={closeMenu}
        onView={() => (menuItem ? openView(menuItem) : null)}
        onEdit={() => (menuItem ? startEdit(menuItem) : null)}
        onDelete={() => (menuItem ? requestDelete(menuItem) : null)}
        disabled={saving}
      />

      {/* ✅ Aesthetic confirm (delete) */}
      <AestheticAlert
        visible={confirmVisible}
        title="Delete topic?"
        message="This will remove the topic permanently."
        details={
          pendingDeleteTitle ? `Topic: “${pendingDeleteTitle}”` : undefined
        }
        iconName="trash-can-outline"
        tone="danger"
        cancelText="Keep"
        confirmText="Delete"
        loading={saving}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />

      {/* ✅ View Modal (NEW) */}
      <Modal
        visible={viewModalVisible}
        animationType="slide"
        onRequestClose={closeView}
      >
        <KeyboardAvoidingView
          style={styles.viewModalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.viewModalHeader}>
            <TouchableOpacity
              onPress={closeView}
              style={styles.editHeaderBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={26}
                color="#6b7280"
              />
              <Text style={styles.editHeaderBtnText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.editModalTitle}>Topic</Text>

            <View style={{ width: 70 }} />
          </View>

          <View style={styles.viewModalBody}>
            <View style={styles.viewCard}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={22}
                color="#f4c4c4"
                style={{ marginBottom: 10 }}
              />
              <Text style={styles.viewText}>{viewItem?.title ?? ""}</Text>

              {/* ✅ Date and Time with proper alignment */}
              <View style={styles.viewMetaRow}>
                <MaterialCommunityIcons
                  name="calendar-outline"
                  size={14}
                  color="#9ca3af"
                />
                <Text style={styles.viewMeta}>
                  {viewItem?.created_at
                    ? new Date(viewItem.created_at).toLocaleDateString(
                        "en-US",
                        {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )
                    : "No date"}
                </Text>
              </View>

              <View style={styles.viewMetaRow}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color="#9ca3af"
                />
                <Text style={styles.viewMeta}>
                  {viewItem?.created_at
                    ? new Date(viewItem.created_at).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        },
                      )
                    : "No time"}
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ✅ Full-screen Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={cancelModalEdit}
      >
        <KeyboardAvoidingView
          style={styles.editModalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.editModalHeader}>
            <TouchableOpacity
              onPress={cancelModalEdit}
              disabled={saving}
              style={styles.editHeaderBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={26}
                color="#6b7280"
              />
              <Text style={styles.editHeaderBtnText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.editModalTitle}>Edit Topic</Text>

            <TouchableOpacity
              onPress={saveEditFromModal}
              disabled={saving}
              style={[styles.editSaveBtn, saving ? styles.btnDisabled : null]}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="content-save"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.editSaveText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.editModalBody}>
            <Text style={styles.editHint}>Write the full topic below ✨</Text>

            <TextInput
              style={styles.editModalInput}
              value={editingText}
              onChangeText={setEditingText}
              placeholder="Type your topic..."
              multiline
              textAlignVertical="top"
              scrollEnabled
              editable={!saving}
              autoFocus
            />

            <View style={styles.editFooterRow}>
              <Text style={styles.charCount}>
                {editingText.length} characters
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={22}
            color="#f4c4c4"
          />
          <Text style={styles.title}>What I Learned Today</Text>
        </View>
        <Text style={styles.subtitle}>
          Add a small win. Edit anytime. Build consistency.
        </Text>
      </View>

      {debugError ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorBox}>Error: {debugError}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, saving ? styles.btnDisabled : null]}
            onPress={fetchTopics}
            disabled={saving}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Add Topic */}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, isEditing ? styles.inputDisabled : null]}
          placeholder={
            isEditing ? "Finish editing first…" : "e.g. React Native Basics"
          }
          value={input}
          onChangeText={setInput}
          editable={!isEditing && !saving}
          returnKeyType="done"
          onSubmitEditing={addTopic}
        />

        <TouchableOpacity
          style={[styles.button, isAddDisabled ? styles.buttonDisabled : null]}
          onPress={addTopic}
          disabled={isAddDisabled}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={topics}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={fetchTopics}
        renderItem={renderItem}
        contentContainerStyle={
          topics.length === 0 ? styles.emptyWrap : undefined
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="lightbulb-on-outline"
                size={34}
                color="#f4c4c4"
              />
              <Text style={styles.emptyTitle}>No topics yet</Text>
              <Text style={styles.emptyText}>
                Add your first “small win” for today. Even 1 line counts.
              </Text>

              <Pressable
                style={styles.exampleBox}
                onPress={() => setInput("Learned how to use FlatList")}
              >
                <Text style={styles.exampleTitle}>Need an example?</Text>
                <Text style={styles.exampleText}>
                  Tap here to auto-fill a sample topic.
                </Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 40,
    padding: 20,
    backgroundColor: "#fafafa",
  },

  header: { marginBottom: 12 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontWeight: "bold", color: "#f4c4c4" },
  subtitle: { marginTop: 6, color: "#6b7280", fontSize: 13 },

  row: { flexDirection: "row", marginBottom: 10, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#f4c4c4",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
    fontSize: 16,
    color: "#333",
  },
  inputDisabled: { opacity: 0.7 },

  button: {
    backgroundColor: "#f4c4c4",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
    minWidth: 72,
    alignItems: "center",
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.55 },

  itemRow: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f4c4c4",
    elevation: 2,
  },

  itemMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  itemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  textContainer: { flex: 1 },
  itemText: { fontSize: 16, fontWeight: "600", color: "#333" },
  itemSubText: { marginTop: 6, fontSize: 12, color: "#9ca3af" },
  ellipsisButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -4,
  },

  emptyWrap: { flexGrow: 1 },
  emptyState: { marginTop: 40, alignItems: "center", paddingHorizontal: 10 },
  emptyTitle: { marginTop: 10, fontSize: 18, fontWeight: "700", color: "#333" },
  emptyText: {
    textAlign: "center",
    marginTop: 8,
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 20,
  },
  exampleBox: {
    marginTop: 16,
    width: "100%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    borderRadius: 12,
  },
  exampleTitle: { fontWeight: "700", color: "#333" },
  exampleText: { marginTop: 6, color: "#6b7280", fontSize: 13 },

  errorWrap: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorTitle: { fontWeight: "800", color: "#991b1b", marginBottom: 6 },
  errorBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#f4c4c4",
    borderWidth: 2,
    padding: 12,
    borderRadius: 8,
    color: "#991b1b",
  },
  retryBtn: {
    marginTop: 10,
    backgroundColor: "#f4c4c4",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  btnDisabled: { opacity: 0.6 },

  // AestheticAlert styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 10,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#fff5f7",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f4c4c4",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#333" },
  modalText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 20,
  },
  modalDetailsBox: {
    width: "100%",
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  modalDetailsText: { color: "#6b7280", fontSize: 12 },
  modalActions: { flexDirection: "row", gap: 10, width: "100%" },
  modalCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  modalCancelText: { color: "#6b7280", fontWeight: "700" },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontWeight: "800" },

  // ActionMenu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.20)",
    justifyContent: "flex-end",
    padding: 14,
  },
  menuSheet: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  menuTitle: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "700",
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  menuItemText: { fontSize: 15, fontWeight: "700", color: "#111827" },
  menuDivider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 6 },
  menuIconPill: {
    width: 34,
    height: 34,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff5f7",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#f4c4c4",
  },
  menuIconPillDanger: { backgroundColor: "#d66a7a", borderColor: "#d66a7a" },
  menuClose: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  menuCloseText: { fontWeight: "800", color: "#6b7280" },

  // Full-screen Edit Modal styles
  editModalContainer: { flex: 1, backgroundColor: "#fafafa" },
  editModalHeader: {
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  editHeaderBtnText: { color: "#6b7280", fontWeight: "800" },
  editModalTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  editSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f4c4c4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editSaveText: { color: "#fff", fontWeight: "900" },
  editModalBody: { flex: 1, padding: 16 },
  editHint: { color: "#6b7280", fontSize: 13, marginBottom: 10 },
  editModalInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f4c4c4",
    padding: 14,
    fontSize: 15,
    color: "#111827",
    lineHeight: 20,
  },
  editFooterRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  charCount: { color: "#9ca3af", fontSize: 12, fontWeight: "700" },

  // View Modal styles (NEW)
  viewModalContainer: { flex: 1, backgroundColor: "#fafafa" },
  viewModalHeader: {
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewModalBody: { flex: 1, padding: 16 },
  viewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f4c4c4",
    padding: 18,
  },
  viewText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 24,
    marginBottom: 14,
  },
  viewMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  viewMeta: { color: "#6b7280", fontSize: 15, fontWeight: "600" },
});
