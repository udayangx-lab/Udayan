import Link from 'next/link';
export default function NotFound(){return <section className="container section"><span className="eyebrow">404 · THAT SCENE IS MISSING</span><h1 style={{fontSize:64}}>Let’s get you back to the movies.</h1><p style={{margin:'24px 0'}}>We couldn’t find the page you were looking for.</p><Link href="/" className="button red">Back to Udayan</Link></section>}
