
const Header = () => (
  <header style={{
    padding: "2.5rem 2.5rem 2rem 2.5rem",
    textAlign: "left",
    background: "#23272f",
    boxShadow: "0 2px 8px #0002",
    width: "100%",
    borderBottom: "2px solid #00e6a8"
  }}>
    <h1 style={{
      margin: 0,
      fontSize: "2.5rem",
      letterSpacing: "2px",
      color: "#00e6a8",
      fontFamily: "Fira Sans, Segoe UI, sans-serif",
      fontWeight: 800
    }}>💡 InsightCode</h1>
    <p style={{
      margin: "0.75rem 0 0 0",
      fontSize: "1.1rem",
      color: "#b0b8c1",
      fontFamily: "Fira Sans, Segoe UI, sans-serif",
      fontWeight: 400,
      maxWidth: "500px"
    }}>
      AI for Code Review, Debugging & Complexity Analysis
    </p>
  </header>
);

export default Header;
