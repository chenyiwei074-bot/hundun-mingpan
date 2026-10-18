import { z } from 'zod';

export const CreateChartSchema = z.object({
  visitor_id: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(['男', '女']),
  calendar: z.enum(['公历', '农历']).default('农历'),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
  /** 农历闰月位。additive：老客户端不传 → 按平月；birthday 字段本身放不下闰月。 */
  isLeapMonth: z.boolean().optional().default(false),
  birthPlace: z.string().optional().default(''),
  currentPlace: z.string().optional().default(''),
  persona: z.enum(['standard', 'casual']).optional().default('standard'),
  depth: z.enum(['brief', 'detail']).optional().default('brief'),
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
