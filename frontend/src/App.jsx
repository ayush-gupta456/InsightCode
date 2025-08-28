
import axios from 'axios';
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
          <h2 tabIndex={0} aria-label="Code input area">Write or paste your code here</h2>
          <div className="buttons">
            <button
              onClick={reviewCode}
              className="review"
              disabled={loading}
              aria-busy={loading && loadingType === 'review'}
            >
              {loading && loadingType === "review" ? 'Reviewing...' : 'Review Code'}
            </button>
            <button
              onClick={analyzeComplexity}
              className="complexity"
              disabled={loading}
              aria-busy={loading && loadingType === 'complexity'}
            >
              {loading && loadingType === "complexity" ? 'Analyzing...' : 'Time and Space Complexity'}
            </button>
            <button
              onClick={debugCode}
              className="debug"
              disabled={loading}
              aria-busy={loading && loadingType === 'debug'}
            >
              {loading && loadingType === "debug" ? 'Debugging...' : 'Debug Code'}
            </button>
          </div>
          <div className="code">
            <div className="code-editor-container">
              <div className="code-lines">
                {code.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
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
                aria-label="Code editor"
              />
            </div>
          </div>
        </div>
        <div className="right">
          <h2 style={{ color: '#00e6a8', marginBottom: '1.5rem', fontWeight: 700, fontSize: '1.5rem' }}>Result Window</h2>
          {error && <div className="error" role="alert">{error}</div>}
          {loading && (
            <div className="loader-container">
              <span className="loader-message">
                {loadingType === "review" && 'Analyzing code review...'}
                {loadingType === "complexity" && 'Analyzing complexity...'}
                {loadingType === "debug" && 'Debugging...'}
              </span>
              <span className="loader-spinner"></span>
            </div>
          )}
          {!loading && resultType === "debug" && result && (
            <div className="result-block debug-block">
              <h3>Debug Output</h3>
              <button
                className="copy-btn debug-copy"
                onClick={() => {
                  if (debugRef.current) {
                    const text = debugRef.current.innerText;
                    navigator.clipboard.writeText(text);
                    setCopied("debug");
                    setTimeout(() => setCopied(""), 1200);
                  }
                }}
                title="Copy result"
                aria-label="Copy debug result"
              >{copied === "debug" ? "Copied!" : "Copy"}</button>
              <div ref={debugRef} className={`result-content debug-output`}>
                <Markdown rehypePlugins={[rehypeHighlight]}>{result}</Markdown>
              </div>
            </div>
          )}
          {!loading && resultType === "review" && result && (
            <div className="result-block review-block">
              <h3>Code Review</h3>
              <button
                className="copy-btn review-copy"
                onClick={() => {
                  if (reviewRef.current) {
                    const text = reviewRef.current.innerText;
                    navigator.clipboard.writeText(text);
                    setCopied("review");
                    setTimeout(() => setCopied(""), 1200);
                  }
                }}
                title="Copy result"
                aria-label="Copy review result"
              >{copied === "review" ? "Copied!" : "Copy"}</button>
              <div ref={reviewRef} className="result-content review-output">
                <Markdown rehypePlugins={[rehypeHighlight]}>{result}</Markdown>
              </div>
            </div>
          )}
          {!loading && resultType === "complexity" && result && (
            <div className="result-block complexity-block">
              <h3>Time and Space Complexity Analysis</h3>
              <button
                className="copy-btn complexity-copy"
                onClick={() => {
                  if (complexityRef.current) {
                    const text = complexityRef.current.innerText;
                    navigator.clipboard.writeText(text);
                    setCopied("complexity");
                    setTimeout(() => setCopied(""), 1200);
                  }
                }}
                title="Copy result"
                aria-label="Copy complexity result"
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