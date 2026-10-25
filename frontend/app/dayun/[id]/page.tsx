import LifeCurveStandalone from '@/components/bazi/LifeCurveStandalone';

export default async function DayunChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LifeCurveStandalone chartId={id} />;
}
