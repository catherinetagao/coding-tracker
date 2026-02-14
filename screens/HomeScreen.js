import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { supabase } from "../lib/supabase";
import { Swipeable } from "react-native-gesture-handler";

export default function HomeScreen() {
  const [input, setInput] = useState("");
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  // 🔹 Fetch topics on screen load
  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("learning_topics")
      
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setTopics(data);
    } else {
      console.log("Fetch error:", error);
    }

    setLoading(false);
  };

  // 🔹 Add topic
  const addTopic = async () => {
    if (!input.trim()) return;

    const { error } = await supabase
      .from("learning_topics")
      .insert([{ title: input }]);

    if (!error) {
      setInput("");
      fetchTopics();
    }
  };

  // 🔹 Update topic
  const updateTopic = async (id) => {
    if (!editingText.trim()) return;

    const { error } = await supabase
      .from("learning_topics")
      .update({ title: editingText })
      .eq("id", id);

    if (!error) {
      setEditingId(null);
      setEditingText("");
      fetchTopics();
    }
  };

  // 🔹 Confirm delete
  const confirmDelete = (item) => {
    Alert.alert("Delete Topic", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDelete(item),
      },
    ]);
  };

  // 🔹 Delete topic
  const handleDelete = async (item) => {
    setLastDeleted(item);

    const { error } = await supabase
      .from("learning_topics")
      .delete()
      .eq("id", item.id);

    if (!error) {
      fetchTopics();
    }
  };

  // 🔹 Undo delete
  const undoDelete = async () => {
    if (!lastDeleted) return;

    await supabase
      .from("learning_topics")
      .insert([{ title: lastDeleted.title }]);

    setLastDeleted(null);
    fetchTopics();
  };

  // 🔹 Swipe delete button
  const renderRightActions = (item) => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => confirmDelete(item)}
    >
      <Text style={styles.swipeDeleteText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What I Learned Today</Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          placeholder="e.g. React Native Basics"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.button} onPress={addTopic}>
          <Text style={styles.buttonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={topics}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={fetchTopics}
        renderItem={({ item }) => (
          <Swipeable renderRightActions={() => renderRightActions(item)}>
            <View style={styles.itemRow}>
              {editingId === item.id ? (
                <>
                  <TextInput
                    style={styles.editInput}
                    value={editingText}
                    onChangeText={setEditingText}
                    autoFocus
                  />

                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={() => updateTopic(item.id)}
                    >
                      <Text style={styles.actionText}>Save</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setEditingId(null);
                        setEditingText("");
                      }}
                    >
                      <Text style={styles.actionText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setEditingId(item.id);
                    setEditingText(item.title);
                  }}
                >
                  <Text style={styles.itemText}>{item.title}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Swipeable>
        )}
      />

      {/* 🔄 UNDO BAR */}
      {lastDeleted && (
        <TouchableOpacity style={styles.undoBar} onPress={undoDelete}>
          <Text style={styles.undoText}>Topic deleted – Undo</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 40,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    marginBottom: 16,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },

  // item
  itemRow: {
    padding: 14,
    backgroundColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 8,
  },
  itemText: {
    fontSize: 16,
  },

  // swipe delete
  swipeDelete: {
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 8,
    marginBottom: 8,
  },
  swipeDeleteText: {
    color: "#fff",
    fontWeight: "bold",
  },

  // undo bar
  undoBar: {
    backgroundColor: "#1f2937",
    padding: 14,
    borderRadius: 8,
    marginTop: 10,
  },
  undoText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#fff",
  },

  editActions: {
    flexDirection: "row",
    marginTop: 8,
  },

  saveButton: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },

  cancelButton: {
    backgroundColor: "#6b7280",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  actionText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
