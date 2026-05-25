import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5.5;
const MENU_MAX_HEIGHT = Math.round(ROW_HEIGHT * VISIBLE_ROWS);

/**
 * Compact inline appointment time selector — available slots only.
 * @param {{ label?: string, placeholder?: string, value: string|null, options: string[], disabled?: boolean, onSelect: (time: string) => void }} props
 */
export default function AppointmentTimeDropdown({
  label = 'Select Appointment Time',
  placeholder = 'Choose a time',
  value,
  options = [],
  disabled = false,
  onSelect,
}) {
  const [open, setOpen] = useState(false);

  const hasOptions = options.length > 0;
  const fieldDisabled = disabled || !hasOptions;

  useEffect(() => {
    setOpen(false);
  }, [options]);

  useEffect(() => {
    if (fieldDisabled) setOpen(false);
  }, [fieldDisabled]);

  const toggleOpen = () => {
    if (fieldDisabled) return;
    setOpen((prev) => !prev);
  };

  const handleSelect = (time) => {
    onSelect(time);
    setOpen(false);
  };

  return (
    <View style={[styles.wrap, open && styles.wrapOpen]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={toggleOpen}
        disabled={fieldDisabled}
        style={({ pressed }) => [
          styles.field,
          open && styles.fieldOpen,
          fieldDisabled && styles.fieldDisabled,
          pressed && !fieldDisabled && styles.fieldPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: fieldDisabled, expanded: open }}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={[styles.chevron, open && styles.chevronOpen]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open && hasOptions ? (
        <View style={styles.menu}>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {options.map((time) => {
              const selected = value === time;
              return (
                <Pressable
                  key={time}
                  onPress={() => handleSelect(time)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.optionPressed,
                  ]}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  wrapOpen: {
    zIndex: 20,
  },
  label: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,200,66,0.35)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fieldOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: 'rgba(245,200,66,0.2)',
    backgroundColor: '#141414',
  },
  fieldDisabled: {
    opacity: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  fieldPressed: {
    backgroundColor: 'rgba(245,200,66,0.08)',
  },
  fieldText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  placeholder: {
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  chevron: {
    color: '#FFD700',
    fontSize: 16,
    marginLeft: 4,
  },
  chevronOpen: {
    transform: [{ translateY: -1 }],
  },
  menu: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(245,200,66,0.35)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    maxHeight: MENU_MAX_HEIGHT,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  list: {
    maxHeight: MENU_MAX_HEIGHT,
  },
  listContent: {
    paddingVertical: 4,
  },
  option: {
    minHeight: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  optionSelected: {
    backgroundColor: 'rgba(245,200,66,0.12)',
  },
  optionPressed: {
    backgroundColor: 'rgba(245,200,66,0.08)',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#FFD700',
  },
});
