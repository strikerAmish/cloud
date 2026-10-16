with open('rail_ai_clean.txt', encoding='utf-8', errors='ignore') as f:
    text = f.read()

with open('scratch/rail_ai_full.txt', 'w', encoding='utf-8') as out:
    for i, page in enumerate(text.split('\n--- PAGE ')):
        out.write(f"\n=== RAIL_AI PAGE {i+1} ===\n")
        out.write(page)
        out.write("\n" + "="*50 + "\n")

print("Saved scratch/rail_ai_full.txt")
