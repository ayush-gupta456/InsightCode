
import axios from 'axios';
import "highlight.js/styles/github-dark.css";
import prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import { useEffect, useRef, useState } from 'react';
import Markdown from "react-markdown";
import Editor from "react-simple-code-editor";
import rehypeHighlight from "rehype-highlight";
import './App.css';
import Footer from './Footer';
import Header from './Header';

function App() {
  const debugRef = useRef(null);
  const reviewRef = useRef(null);
  const complexityRef = useRef(null);
  const [code, setCode] = useState(` function sum() {
  return 1 + 1
}`);

  const [result, setResult] = useState("");
  const [resultType, setResultType] = useState(""); // "review", "complexity", "debug"
  const [loading, setLoading] = useState(false); // unified loader
  const [loadingType, setLoadingType] = useState(""); // "review", "complexity", "debug"
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(""); // show copied message

  useEffect(() => {
    prism.highlightAll();
  }, []);

  async function reviewCode() {
    setLoading(true);
    setLoadingType("review");
    setError(null);
    setResult("");
    setResultType("");
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/ai/get-review`, { code });
      setResult(response.data);
      setResultType("review");
    } catch (_err) {
      setError("Failed to get review. Please try again.");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  }

  async function analyzeComplexity() {
    setLoading(true);
    setLoadingType("complexity");
    setError(null);
    setResult("");
    setResultType("");
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/ai/get-complexity`, { code });
      setResult(response.data);
      setResultType("complexity");
    } catch (_err) {
      setError("Failed to analyze complexity. Please try again.");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  }

  async function debugCode() {
    setLoading(true);
    setLoadingType("debug");
    setError(null);
    setResult("");
    setResultType("");
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/ai/debug`, { code });
      setResult(response.data);
      setResultType("debug");
    } catch (err) {
      setResult(`Error: ${err.message}`);
      setResultType("debug");
    } finally {
      setLoading(false);
      setLoadingType("");
    }
  }

  return (
    <>
      <Header />
      <main>
        <div className="left">
          <h2>Write or paste your code here</h2>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.2rem', gap: '1rem', width: '100%', justifyContent: 'flex-end' }}>
            <div className="buttons" style={{ margin: 0 }}>
              <button
                onClick={reviewCode}
                className="review"
                disabled={loading}
              >
                {loading && loadingType === "review" ? 'Reviewing...' : 'Review Code'}
              </button>
              <button
                onClick={analyzeComplexity}
                className="complexity"
                disabled={loading}
              >
                {loading && loadingType === "complexity" ? 'Analyzing...' : 'Time and Space Complexity'}
              </button>
              <button
                onClick={debugCode}
                className="debug"
                disabled={loading}
              >
                {loading && loadingType === "debug" ? 'Debugging...' : 'Debug Code'}
              </button>
            </div>
          </div>
          <div className="code">
            <div style={{ display: 'flex', width: '100%', height: '100%' }}>
              <div style={{
                background: '#282c34',
                color: '#888',
                textAlign: 'right',
                padding: '10px 5px',
                fontFamily: '"Fira code", "Fira Mono", monospace',
                fontSize: 16,
                userSelect: 'none',
                minWidth: '32px',
                borderRight: '1px solid #ddd'
              }}>
                {code.split('\n').map((_, i) => (
                  <div key={i} style={{ height: '1.5em' }}>{i + 1}</div>
                ))}
              </div>
              <Editor
                value={code}
                onValueChange={code => setCode(code)}
                highlight={code => prism.highlight(code, prism.languages.javascript, "javascript")}
                padding={10}
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 16,
                  border: "none",
                  borderRadius: "0 5px 5px 0",
                  height: "100%",
                  width: "100%"
                }}
              />
            </div>
          </div>
        </div>
        <div className="right">
          <h2 style={{ color: '#00e6a8', marginBottom: '1.5rem', fontWeight: 700, fontSize: '1.5rem' }}>Result Window</h2>
          {error && <div className="error">{error}</div>}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{
                fontSize: '1.3rem',
                color: '#00e6a8',
                fontWeight: 600,
                marginBottom: '1rem',
                letterSpacing: '1px',
                animation: 'pulse 1.2s infinite'
              }}>
                {loadingType === "review" && 'Analyzing code review...'}
                {loadingType === "complexity" && 'Analyzing complexity...'}
                {loadingType === "debug" && 'Debugging...'}
              </span>
              <span style={{
                width: '40px',
                height: '40px',
                border: '4px solid #00e6a8',
                borderTop: '4px solid #23272f',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                display: 'inline-block'
              }}></span>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes pulse {
                  0% { opacity: 1; }
                  50% { opacity: 0.5; }
                  100% { opacity: 1; }
                }
              `}</style>
            </div>
          )}
          {!loading && resultType === "debug" && result && (
            <div style={{ position: 'relative' }}>
              <h3 style={{ color: '#ffb300', marginBottom: '1rem', fontWeight: 600 }}>Debug Output</h3>
              <button
                style={{ position: 'absolute', top: 0, right: 0, background: '#ffe066', color: '#181a20', border: 'none', borderRadius: '5px', padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}
                onClick={() => {
                  if (debugRef.current) {
                    const text = debugRef.current.innerText;
                    navigator.clipboard.writeText(text);
                    setCopied("debug");
                    setTimeout(() => setCopied(""), 1200);
                  }
                }}
                title="Copy result"
              >{copied === "debug" ? "Copied!" : "Copy"}</button>
              <div ref={debugRef} className={`result-content debug-output`}>
                <Markdown rehypePlugins={[rehypeHighlight]}>{result}</Markdown>
              </div>
            </div>
          )}
          {!loading && resultType === "review" && result && (
            <div style={{ position: 'relative' }}>
              <h3 style={{ color: '#00b3ff', marginBottom: '1rem', fontWeight: 600 }}>Code Review</h3>
              <button
                style={{ position: 'absolute', top: 0, right: 0, background: '#00e6a8', color: '#181a20', border: 'none', borderRadius: '5px', padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}
                onClick={() => {
                  if (reviewRef.current) {
                    const text = reviewRef.current.innerText;
                    navigator.clipboard.writeText(text);
                    setCopied("review");
                    setTimeout(() => setCopied(""), 1200);
                  }
                }}
                title="Copy result"
              >{copied === "review" ? "Copied!" : "Copy"}</button>
              <div ref={reviewRef} className="result-content review-output">
                <Markdown rehypePlugins={[rehypeHighlight]}>{result}</Markdown>
              </div>
            </div>
          )}
          {!loading && resultType === "complexity" && result && (
            <div style={{ position: 'relative' }}>
              <h3 style={{ color: '#00b3ff', marginBottom: '1rem', fontWeight: 600 }}>Time and Space Complexity Analysis</h3>
              <button
                style={{ position: 'absolute', top: 0, right: 0, background: '#00e6a8', color: '#181a20', border: 'none', borderRadius: '5px', padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}
                onClick={() => {
                  if (complexityRef.current) {
                    const text = complexityRef.current.innerText;
                    navigator.clipboard.writeText(text);
                    setCopied("complexity");
                    setTimeout(() => setCopied(""), 1200);
                  }
                }}
                title="Copy result"
              >{copied === "complexity" ? "Copied!" : "Copy"}</button>
              <div ref={complexityRef} className="result-content complexity-output">
                <Markdown rehypePlugins={[rehypeHighlight]}>{result}</Markdown>
              </div>
            </div>
          )}
        </div>
  </main>
  <Footer />
    </>
  );
}
export default App