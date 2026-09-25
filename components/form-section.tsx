import type {ReactNode} from 'react';
import SiteForm from './site-form';
import type {FormType} from '@/lib/forms';

export default function FormSection({type, id, eyebrow, title, description, children}: {
  type: FormType; id: string; eyebrow: string; title: ReactNode; description: string; children?: ReactNode;
}) {
  return <section className="form-section" id={id} aria-labelledby={`${id}-title`}>
    <div className="form-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h2 id={`${id}-title`}>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
    <div className="form-card"><SiteForm type={type}/></div>
  </section>;
}
