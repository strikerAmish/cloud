with open('reports.md', 'r', encoding='utf-8') as f:
    original = f.read()

with open('scratch/section_16.md', 'r', encoding='utf-8') as f:
    sec16 = f.read()

marker = "# 15. Conclusion & Future Roadmap"

if marker in original:
    parts = original.split(marker)
    merged = parts[0] + sec16 + "\n" + marker + parts[1]
else:
    merged = original + "\n\n" + sec16

with open('reports.md', 'w', encoding='utf-8') as f:
    f.write(merged)

print("Merged section 16 into reports.md! Total size:", len(merged))
