'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const testMarkdown = `# Welcome to Markdown Rendering Test

This is a **bold** text and this is *italic* text.

## Features

- **Headers** - Different levels of headings
- **Lists** - Both ordered and unordered
- **Code** - Both inline \`code\` and block code
- **Links** - [Click here](https://example.com)
- **Tables** - Structured data display

### Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

### Table Example

| Feature | Status | Description |
|---------|--------|-------------|
| Headers | ✅ | All heading levels supported |
| Lists | ✅ | Ordered and unordered |
| Code | ✅ | Inline and block |
| Tables | ✅ | Full table support |

> **Note**: This is a blockquote to demonstrate styling.

### More Examples

1. **Ordered List Item 1**
2. **Ordered List Item 2**
3. **Ordered List Item 3**

---

*This concludes our markdown test!*
`;

export default function TestPage() {
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Markdown Rendering Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Raw Markdown */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Raw Markdown</h2>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
            <pre className="text-sm whitespace-pre-wrap">{testMarkdown}</pre>
          </div>
        </div>
        
        {/* Rendered Markdown */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Rendered Markdown</h2>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg">
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {testMarkdown}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
