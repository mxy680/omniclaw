import { useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Attachment } from '../types/attachment';
import { AttachmentTray } from './AttachmentTray';

interface Props {
  text: string;
  onChangeText: (text: string) => void;
  pendingAttachments: Attachment[];
  isStreaming: boolean;
  onSend: () => void;
  onCancel: () => void;
  onPickFromLibrary: () => void;
  onPickFromCamera: () => void;
  onPickFromFiles: () => void;
  onRemoveAttachment: (attachment: Attachment) => void;
}

const ATTACHMENT_OPTIONS = ['Photo Library', 'Camera', 'Browse Files', 'Cancel'] as const;
const CANCEL_INDEX = 3;

export function MessageInputBar({
  text,
  onChangeText,
  pendingAttachments,
  isStreaming,
  onSend,
  onCancel,
  onPickFromLibrary,
  onPickFromCamera,
  onPickFromFiles,
  onRemoveAttachment,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [showAndroidMenu, setShowAndroidMenu] = useState(false);

  const canSend = text.trim().length > 0 || pendingAttachments.length > 0;

  const handlePlusPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...ATTACHMENT_OPTIONS],
          cancelButtonIndex: CANCEL_INDEX,
          title: 'Add Attachment',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) onPickFromLibrary();
          else if (buttonIndex === 1) onPickFromCamera();
          else if (buttonIndex === 2) onPickFromFiles();
        },
      );
    } else {
      setShowAndroidMenu(prev => !prev);
    }
  }, [onPickFromLibrary, onPickFromCamera, onPickFromFiles]);

  const handleAndroidOption = useCallback(
    (option: 'library' | 'camera' | 'files') => {
      setShowAndroidMenu(false);
      if (option === 'library') onPickFromLibrary();
      else if (option === 'camera') onPickFromCamera();
      else onPickFromFiles();
    },
    [onPickFromLibrary, onPickFromCamera, onPickFromFiles],
  );

  return (
    <View style={styles.wrapper}>
      {/* Attachment tray — shown only when there are pending attachments */}
      {pendingAttachments.length > 0 && (
        <AttachmentTray
          attachments={pendingAttachments}
          onRemove={onRemoveAttachment}
        />
      )}

      {/* Android attachment menu (simple inline fallback) */}
      {showAndroidMenu && (
        <View style={styles.androidMenu}>
          <Pressable
            style={styles.androidMenuItem}
            onPress={() => handleAndroidOption('library')}
          >
            <Ionicons name="image" size={20} color="#007AFF" />
            <Text style={styles.androidMenuItemText}>Photo Library</Text>
          </Pressable>
          <Pressable
            style={styles.androidMenuItem}
            onPress={() => handleAndroidOption('camera')}
          >
            <Ionicons name="camera" size={20} color="#007AFF" />
            <Text style={styles.androidMenuItemText}>Camera</Text>
          </Pressable>
          <Pressable
            style={styles.androidMenuItem}
            onPress={() => handleAndroidOption('files')}
          >
            <Ionicons name="document" size={20} color="#007AFF" />
            <Text style={styles.androidMenuItemText}>Browse Files</Text>
          </Pressable>
        </View>
      )}

      {/* Main input row */}
      <View style={styles.inputRow}>
        {/* Plus / attachment button */}
        <Pressable
          style={styles.plusButton}
          onPress={handlePlusPress}
          hitSlop={8}
        >
          <Ionicons name="add-circle" size={32} color="#007AFF" />
        </Pressable>

        {/* Text input in rounded capsule */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Message"
          placeholderTextColor="#8E8E93"
          value={text}
          onChangeText={onChangeText}
          multiline
          maxLength={4000}
          returnKeyType="default"
          enablesReturnKeyAutomatically={false}
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <Pressable style={styles.actionButton} onPress={onCancel} hitSlop={8}>
            <View style={styles.stopIconOuter}>
              <View style={styles.stopIconInner} />
            </View>
          </Pressable>
        ) : (
          <Pressable
            style={styles.actionButton}
            onPress={onSend}
            disabled={!canSend}
            hitSlop={8}
          >
            <Ionicons
              name="arrow-up-circle"
              size={32}
              color={canSend ? '#007AFF' : '#C7C7CC'}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  plusButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 36,
    marginBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120, // ~6 lines
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
    color: '#000000',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  stopIconOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIconInner: {
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  // Android-only attachment menu
  androidMenu: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  androidMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  androidMenuItemText: {
    fontSize: 16,
    color: '#007AFF',
  },
});
