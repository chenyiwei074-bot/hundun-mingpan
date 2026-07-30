import os
base = r"C:\Users\Kobe\Documents\HDAI"
out = r"C:\Users\Kobe\Documents\HDAI\_full_export.md"

skip_dirs = {"node_modules",".next",".git","__pycache__",".turbo","dist","public",".prisma","assets","home","fonts","data","migrations","logs","uploads","output","bak","scripts","tests","templates","utils","config"}
skip_ext = {".png",".jpg",".webp",".ico",".tar.gz",".db",".tsbuildinfo",".lock",".json",".gz",".zip",".pdf",".svg",".woff2"}
skip_names = ["package-lock","tsconfig.tsbuildinfo","dev.db","deploy","qn_",".qn-","_patch","_new_card","_allinone","add_form","fix-","check-static","ecosystem","docker-compose",".qingnang",".css",".js",".html","region-data.ts"]

files = []
for root, dirs, filenames in os.walk(base):
    dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
    for f in filenames:
        ext = os.path.splitext(f)[1].lower()
        skip = False
        for sn in skip_names:
            if sn in f.lower():
                skip = True
                break
        if skip:
            continue
        if ext in skip_ext:
            continue
        fp = os.path.join(root, f)
        sz = os.path.getsize(fp)
        if sz > 150000:
            continue
        rel = fp.replace(base, "").replace("\\", "/")
        files.append((rel, sz, fp))

files.sort(key=lambda x: x[0])

with open(out, "w", encoding="utf-8") as of:
    of.write("# HDAI - Full Code Export\n\n")
    of.write("## File Tree\n\n")
    of.write("```\n")
    for rel, sz, fp in files:
        of.write(f"{rel}  ({sz} bytes)\n")
    of.write("```\n\n")

    for rel, sz, fp in files:
        ext = os.path.splitext(rel)[1][1:]
        lang = ext if ext in ("tsx","ts","py","js","css","json","yml","yaml","md","sql","prisma","html","env","txt","sh","toml","xml") else ""
        of.write(f"\n---\n\n## {rel}\n\n")
        of.write(f"```{lang}\n")
        try:
            with open(fp, "r", encoding="utf-8") as sf:
                content = sf.read()
            of.write(content)
        except Exception as e:
            of.write(f"[Read error: {e}]")
        of.write("\n```\n")

size_mb = os.path.getsize(out) / 1024 / 1024
count = len(files)
print(f"OK: {count} files, {size_mb:.1f} MB -> {out}")