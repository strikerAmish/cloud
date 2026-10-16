with open('scratch/master_doc_full.txt', encoding='utf-8') as f:
    text = f.read()

pages = text.split('==================== MASTER DOC PAGE ')

print("Extracted page count:", len(pages)-1)

# Write a clean table of contents / page headings
with open('scratch/master_pages_toc.txt', 'w', encoding='utf-8') as toc:
    for idx, p in enumerate(pages[1:], 1):
        lines = [l.strip() for l in p.split('\n') if l.strip()]
        toc.write(f"\n--- PAGE {idx} ({len(lines)} lines) ---\n")
        # Join words on lines to make readable
        combined = ' '.join(lines[:30])
        toc.write(combined[:250] + '\n')

print("Wrote scratch/master_pages_toc.txt")
