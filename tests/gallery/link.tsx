import type {AnchorHTMLAttributes} from 'react';
// Next routing is outside this isolated UI suite; links retain their real href.
export default function Link(props:AnchorHTMLAttributes<HTMLAnchorElement>){return <a {...props}/>}
