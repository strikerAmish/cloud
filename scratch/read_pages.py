with open('scratch/master_doc_full.txt', encoding='utf-8') as f:
    text = f.read()

pages = text.split('==================== MASTER DOC PAGE ')

def get_page_text(p_num):
    if p_num < len(pages):
        raw = pages[p_num]
        lines = [l.strip() for l in raw.split('\n') if l.strip()]
        return ' '.join(lines)
    return ""

with open('scratch/deep_inspection.txt', 'w', encoding='utf-8') as out:
    for p in [3, 4, 11, 12, 13, 26, 27, 28, 29, 30, 31, 32, 33, 34, 37, 43, 44, 45, 46, 47, 48, 49]:
        out.write(f"\n\n==================== PAGE {p} ====================\n")
        out.write(get_page_text(p))

print("Saved scratch/deep_inspection.txt")
