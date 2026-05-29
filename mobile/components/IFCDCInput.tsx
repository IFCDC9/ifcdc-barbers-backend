import React, { useState } from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { IFCDC_THEME } from "../src/theme/ifcdcTheme";

type Props = TextInputProps;

/** Dark input with gold focus border — Phase 3 design system. */
export default function IFCDCInput({
  style,
  onFocus,
  onBlur,
  placeholderTextColor = IFCDC_THEME.colors.muted,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      {...rest}
      placeholderTextColor={placeholderTextColor}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        focused && styles.inputFocused,
        style,
      ]}
    />
  );
}

const { inputs } = IFCDC_THEME;

const styles = StyleSheet.create({
  input: {
    backgroundColor: inputs.background,
    borderWidth: 1,
    borderColor: inputs.border,
    borderRadius: inputs.borderRadius,
    paddingHorizontal: inputs.paddingHorizontal,
    paddingVertical: inputs.paddingVertical,
    color: inputs.text,
    fontSize: inputs.fontSize,
  },
  inputFocused: {
    borderColor: inputs.borderFocus,
    ...IFCDC_THEME.shadow.goldGlowSoft,
  },
});
