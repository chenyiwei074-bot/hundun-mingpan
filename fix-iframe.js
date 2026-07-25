const fs = require('fs');
const path = 'C:/Users/Kobe/Documents/HDAI/frontend/app/chart/[id]/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Add iframeRef + iframeHeight state
c = c.replace(
  'const [data, setData] = useState<ChartResultData | null>(null);',
  'const [data, setData] = useState<ChartResultData | null>(null);' + '\n' +
  '  const iframeRef = useRef<HTMLIFrameElement>(null);' + '\n' +
  '  const [iframeHeight, setIframeHeight] = useState(\x27100vh\x27);'
);

// Replace dangerouslySetInnerHTML with iframe
const oldDiv = '<div dangerouslySetInnerHTML={{ __html: data.posterHtml }} />';
const newIframe = '<iframe' + '\n' +
'                ref={iframeRef}' + '\n' +
'                srcDoc={data.posterHtml}' + '\n' +
'                className="w-full border-0"' + '\n' +
'                style={{ height: iframeHeight }}' + '\n' +
'                scrolling="no"' + '\n' +
'                onLoad={() => {' + '\n' +
'                  try {' + '\n' +
'                    const doc = iframeRef.current?.contentDocument;' + '\n' +
'                    if (doc?.body) {' + '\n' +
'                      const h = doc.body.scrollHeight;' + '\n' +
'                      if (h > 0) setIframeHeight((h + 40) + \x27px\x27);' + '\n' +
'                    }' + '\n' +
'                  } catch(e) {}' + '\n' +
'                }}' + '\n' +
'                title="\u547D\u76D8\u6D77\u62A5"' + '\n' +
'              />';

c = c.replace(oldDiv, newIframe);

fs.writeFileSync(path, c, 'utf8');
console.log('OK');
