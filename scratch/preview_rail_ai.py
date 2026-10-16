with open('rail_ai_clean.txt', encoding='utf-8') as f:
    text = f.read()

print("Rail AI Preview:")
for p in text.split('\n--- PAGE '):
    lines = p.split('\n')
    header = lines[0] if lines else ''
    content = ' '.join(lines[1:6])
    print(f"Page {header[:20]}: {content[:120]}")
