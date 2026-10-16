with open('master_clean.txt', encoding='utf-8', errors='ignore') as f:
    text = f.read()

pages = text.split('\n--- PAGE ')
print(f"Total pages in master: {len(pages)}")

# Print page summary
with open('scratch/master_summary.txt', 'w', encoding='utf-8') as out:
    for i, p in enumerate(pages):
        lines = [l.strip() for l in p.split('\n') if l.strip()]
        heading = lines[0] if lines else 'Empty'
        first_few = ' '.join(lines[1:5])[:150]
        out.write(f"Page {i+1} | {heading} | {first_few}\n")

print("Saved scratch/master_summary.txt")
