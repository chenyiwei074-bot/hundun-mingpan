const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.chart.findFirst({orderBy:{createdAt:'desc'}}).then(c => {
  const d = JSON.parse(c.chartData||'{}');
  console.log('起运:', d.bazi?.dayunStart);
  console.log('日主:', d.bazi?.dayMaster);
  const dys = d.bazi?.dayun || [];
  dys.forEach((x,i) => console.log('大运'+(i+1)+':', x.startAge+'-'+x.endAge+'岁', x.ganZhi.gan+x.ganZhi.zhi, x.startYear+'-'+x.endYear));
  p.disconnect();
});
