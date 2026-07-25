import { z } from 'zod';

export const CreateChartSchema = z.object({
  visitor_id: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(['男', '女']),
  calendar: z.enum(['公历', '农历']).default('农历'),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
  birthPlace: z.string().optional().default(''),
  currentPlace: z.string().optional().default(''),
});

export type CreateChartInput = z.infer<typeof CreateChartSchema>;

export interface ChartResultData {
  posterHtml: string;
  posterUrl: string;
  freeContent: {
    bazi: Record<string, unknown>;
    ziwei: Record<string, unknown>;
    keywords: string[];
  };
  unlockDescription: Array<{ title: string; desc: string }>;
}
