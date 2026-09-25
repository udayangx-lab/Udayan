import {Fragment} from 'react';

// Admin-edited text: new lines become line breaks and *words* are highlighted. No HTML is interpreted.
function Highlight({text}: {text: string}) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, index) => part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <em key={index}>{part.slice(1, -1)}</em> : <Fragment key={index}>{part}</Fragment>);
}
export function Lines({text}: {text: string}) {
  return text.split('\n').map((line, index) => <Fragment key={index}>{index > 0 && <br/>}<Highlight text={line}/></Fragment>);
}
export function Paragraphs({text}: {text: string}) {
  return text.split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).map((block, index) => <p key={index}><Lines text={block}/></p>);
}
