import CliAuth from './CliAuth';

export const metadata = {
  title: 'Authorize CLI',
  description: 'Connect the ManifoldGen CLI on this computer to your account.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/cli-auth' },
};

export default function CliAuthPage() {
  return <CliAuth />;
}
