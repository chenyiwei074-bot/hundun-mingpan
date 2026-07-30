import re

path = r"C:\Users\Kobe\Documents\HDAI\frontend\app\create\page.tsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Change title
content = content.replace("八字 & 紫微排盘", "创建你的专属命理档案")
content = content.replace("录入诞辰，共振星寰", "八字 × 紫微双体系 AI 合参")

# 2. Change button text
content = content.replace("开启推演", "生成我的双盘命格")
content = content.replace("推演中...", "生成中...")

# 3. Add unknownTime state
# Add after 'minute: '00',' 
old = "minute: '00',"
new = "minute: '00', unknownTime: false,"
content = content.replace(old, new)

# 4. Add twelve shichen after hour/minute selects
# Find the time selection div and add shichen option
old_time_label = '<span className="text-[11px] text-black/35 block mb-1.5 tracking-wider">时间</span>'
new_time_section = '''<div className="flex items-center justify-between mb-1.5">
  <span className="text-[11px] text-black/35 tracking-wider">时间</span>
  <button type="button" onClick={() => setField('unknownTime', form.unknownTime ? 'false' : 'true')} className="text-[11px] tracking-wider" style={{color: form.unknownTime ? '#b2955d' : 'rgba(0,0,0,0.35)'}}>
    {form.unknownTime ? '精确时间' : '时辰选择'}
  </button>
</div>'''
content = content.replace(old_time_label, new_time_section, 1)  # only first occurrence (single mode)

# 5. Add shichen select conditional rendering after the time div
old_time_div_end = '<div className="flex items-center gap-1.5">'
# Find the first time div and add conditional rendering
old_select_start = '''<div className="flex items-center gap-1.5">
            <select className="qn-select text-center text-sm flex-1 min-w-0 !px-1.5" value={h} onChange={e => setField(pf('hour'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {Array.from({ length: 24 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
            <span className="text-black/20 text-sm select-none">:</span>
            <select className="qn-select text-center text-sm flex-1 min-w-0 !px-1.5" value={min} onChange={e => setField(pf('minute'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {Array.from({ length: 60 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
          </div>'''

shichen_select = '''{form.unknownTime ? (
            <select className="qn-select text-center text-sm w-full" value={h} onChange={e => setField(pf('hour'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {["23-01 子时","01-03 丑时","03-05 寅时","05-07 卯时","07-09 辰时","09-11 巳时","11-13 午时","13-15 未时","15-17 申时","17-19 酉时","19-21 戌时","21-23 亥时"].map((sc, i) => {
                const hv = String(i*2).padStart(2,'0');
                return <option key={i} value={hv}>{sc}</option>;
              })}
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
            <select className="qn-select text-center text-sm flex-1 min-w-0 !px-1.5" value={h} onChange={e => setField(pf('hour'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {Array.from({ length: 24 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
            <span className="text-black/20 text-sm select-none">:</span>
            <select className="qn-select text-center text-sm flex-1 min-w-0 !px-1.5" value={min} onChange={e => setField(pf('minute'), e.target.value)} onKeyDown={cycleSelect} onWheel={cycleSelect}>
              {Array.from({ length: 60 }, (_, i) => (<option key={i} value={String(i).padStart(2,'0')}>{String(i).padStart(2,'0')}</option>))}
            </select>
          </div>
          )}'''

content = content.replace(old_select_start, shichen_select)

# 6. Update the handleSubmit to handle unknownTime
# When unknownTime=true, set hour based on shichen selection
old_birthinfo = '''const birthInfo: BirthInfo = {
        year: parseInt(form.year), month: parseInt(form.month), day: parseInt(form.day),
        hour: parseInt(form.hour), minute: parseInt(form.minute || '0'),
        isLunar: form.calendar === '农历',
        gender: form.gender === '男' ? 'male' : 'female',
        timeZone: 8,
      };'''
new_birthinfo = '''const birthInfo: BirthInfo = {
        year: parseInt(form.year), month: parseInt(form.month), day: parseInt(form.day),
        hour: parseInt(form.hour), minute: form.unknownTime ? 0 : parseInt(form.minute || '0'),
        isLunar: form.calendar === '农历',
        gender: form.gender === '男' ? 'male' : 'female',
        timeZone: 8,
      };'''
content = content.replace(old_birthinfo, new_birthinfo)

with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
print("Modified create page successfully")