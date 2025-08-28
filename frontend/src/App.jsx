
import axios from 'axios';
import prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css";
import { useEffect, useState } from 'react';
import Markdown from "react-markdown";
import Editor from "react-simple-code-editor";
import rehypeHighlight from "rehype-highlight";
import './App.css';
import Footer from './Footer';
import Header from './Header';

function App() {
  const [code, setCode] = useState(`function sum() {
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
    } catch {
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
    } catch {
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
          <h2 className='result-window-title'>Result Window</h2>
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
                  navigator.clipboard.writeText(result);
                  setCopied("debug");
                  setTimeout(() => setCopied(""), 2000);
                }}
                title="Copy result"
                aria-label="Copy debug result"
              >
                {copied === "debug" ? <span className="copied-message">Copied!</span> : "Copy"}
              </button>
              <div className={`result-content debug-output`}>
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
                  navigator.clipboard.writeText(result);
                  setCopied("review");
                  setTimeout(() => setCopied(""), 2000);
                }}
                title="Copy result"
                aria-label="Copy review result"
              >
                {copied === "review" ? <span className="copied-message">Copied!</span> : "Copy"}
              </button>
              <div className="result-content review-output">
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
                  navigator.clipboard.writeText(result);
                  setCopied("complexity");
                  setTimeout(() => setCopied(""), 2000);
                }}
                title="Copy result"
                aria-label="Copy complexity result"
              >
                {copied === "complexity" ? <span className="copied-message">Copied!</span> : "Copy"}
              </button>
              <div className="result-content complexity-output">
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