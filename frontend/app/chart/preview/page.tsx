import { redirect } from 'next/navigation';

export default function LegacyChartPreviewPage() {
  redirect('/create');
}