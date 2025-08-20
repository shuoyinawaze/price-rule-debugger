import React from 'react';

/**
 * XML Popup Modal component to display the original XML for a rule
 */
export default function XMLPopup({ rule, onClose }) {
  if (!rule) return null;

  // Format XML with proper indentation
  const formatXml = (xml) => {
    const PADDING = ' '.repeat(2);
    const reg = /(>)(<)(\/*)/g;
    let formatted = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    return formatted.split('\r\n').map(line => {
      let indent = 0;
      if (line.match(/.+<\/\w[^>]*>$/)) {
        indent = 0;
      } else if (line.match(/^<\/\w/)) {
        if (pad !== 0) {
          pad -= 1;
        }
      } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
        indent = 1;
      } else {
        indent = 0;
      }
      
      const padding = PADDING.repeat(pad);
      pad += indent;
      return padding + line;
    }).join('\n');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(rule.originalXml).then(() => {
      // You could add a toast notification here
      alert('XML copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy XML:', err);
    });
  };

  return (
    <div className="xml-popup-backdrop" onClick={handleBackdropClick}>
      <div className="xml-popup-modal">
        <div className="xml-popup-header">
          <h3>Rule {rule.id} - Original XML</h3>
          <div className="xml-popup-actions">
            <button onClick={handleCopyToClipboard} className="copy-button">
              Copy XML
            </button>
            <button onClick={onClose} className="close-button">
              ×
            </button>
          </div>
        </div>
        <div className="xml-popup-content">
          <pre className="xml-content">
            <code>{formatXml(rule.originalXml)}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
