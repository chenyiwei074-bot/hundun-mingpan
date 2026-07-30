const {PrismaClient} = require("@prisma/client");
const p = new PrismaClient();
p.chart.findFirst({where:{id:"cms5p8zfb0000tl30hxulqdf9"}}).then(c => {
  if (!c) { console.log("not found"); process.exit(0); }
  console.log("has chartJson:", !!c.chartJson);
  if (c.chartJson) {
    const d = JSON.parse(c.chartJson);
    const b = d.bazi;
    console.log("dayunStart:", b?.dayunStart);
    console.log("dayMaster:", b?.dayMaster);
    const dys = b?.dayun || [];
    dys.forEach((x,i) => console.log("dy"+(i+1)+":", x.startAge+"-"+x.endAge+"岁", x.ganZhi?.gan+x.ganZhi?.zhi, x.startYear+"-"+x.endYear));
  } else {
    console.log("chartJson is null");
  }
  process.exit(0);
});
