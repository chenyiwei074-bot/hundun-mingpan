import re

path = r"C:\Users\Kobe\Documents\HDAI\frontend\components\bazi\BaziPillars.tsx"
card_path = r"C:\Users\Kobe\Documents\HDAI\_new_card.txt"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

with open(card_path, "r", encoding="utf-8") as f:
    new_card = f.read()

# 1. Remove 日主+起运
old_rz_start = '{/* 日主 + 起运 */}'
idx = content.find(old_rz_start)
if idx >= 0:
    end = content.find('</>', idx)
    if end >= 0:
        prev = content.rfind('</div>', idx - 600, idx)
        if prev >= 0:
            content = content[:prev+6] + content[end:]
            print('Removed 日主+起运')

# 2. Remove Apple card
apple_start = '{/* Apple风格'
idx = content.find(apple_start)
if idx >= 0:
    end = content.find('</>', idx)
    if end >= 0:
        prev = content.rfind('</div>', idx - 600, idx)
        if prev >= 0:
            content = content[:prev+6] + content[end:]
            print('Removed Apple card')

# 3. Insert new card before </>
closing = content.rfind('</>')
if closing >= 0:
    content = content[:closing] + '\n' + new_card + '\n' + content[closing:]
    print('Inserted new card')

with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
print('Done, size:', len(content))