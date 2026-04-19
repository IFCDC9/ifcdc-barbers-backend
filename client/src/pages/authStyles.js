/** Shared black + gold auth screens */
export const container = {
  display: "flex",
  flexDirection: "column",
  padding: "clamp(0.75rem, 3vw, 1.25rem)",
  gap: "clamp(0.5rem, 2vw, 0.65rem)",
  color: "white",
  width: "100%",
  maxWidth: "min(100%, 25rem)",
  margin: "0 auto",
  boxSizing: "border-box",
};

export const title = {
  color: "gold",
  textAlign: "center",
  marginBottom: 8,
};

export const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #333",
  background: "#111",
  color: "white",
  fontSize: "1rem",
  boxSizing: "border-box",
  width: "100%",
};

export const button = {
  padding: 12,
  background: "gold",
  color: "black",
  border: "none",
  borderRadius: 8,
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: 4,
};

export const linkStyle = {
  color: "gold",
  textDecoration: "none",
};
