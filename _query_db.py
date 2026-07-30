
import sqlite3, json
conn = sqlite3.connect(r'C:\Users\Kobe\Documents\HDAI\server\prisma\dev.db')
row = conn.execute("SELECT chart_json FROM charts WHERE status='completed' LIMIT 1").fetchone()
if row and row[0]:
    d = json.loads(row[0])
    gongs = d['ziwei']['gongs']
    for g in gongs:
        name = g['gong']
        stars = g.get('mainStars', [])
        aux = g.get('auxStars', [])
        print(f'gong={repr(name)} mainStars={stars} auxStars={aux[:2]}')
conn.close()
