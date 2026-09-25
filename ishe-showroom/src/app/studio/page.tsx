import { notFound } from 'next/navigation';
import StudioClient from './StudioClient';

/**
 * Internal render studio used by `npm run render:images` to produce the sample product images.
 * Hidden in production unless ISHE_STUDIO=1.
 */
export default function StudioPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ISHE_STUDIO !== '1') notFound();
  return <StudioClient />;
}
