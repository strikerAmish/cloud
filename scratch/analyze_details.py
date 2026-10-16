import re, sys

with open('master_clean.txt', encoding='utf-8', errors='ignore') as f:
    master = f.read()

with open('rail_ai_clean.txt', encoding='utf-8', errors='ignore') as f:
    rail_ai = f.read()

with open('scratch/findings.txt', 'w', encoding='utf-8') as out:
    out.write("=== RAIL AI OVERVIEW ===\n")
    for i, p in enumerate(rail_ai.split('\n--- PAGE ')):
        lines = [l.strip() for l in p.split('\n') if l.strip()]
        out.write(f"\n[Rail AI Page {i+1}]\n")
        out.write('\n'.join(lines[:15]) + '\n')
    
    out.write("\n\n=== MASTER DOCUMENT CHECKLIST & SECTIONS ===\n")
    for i, p in enumerate(master.split('\n--- PAGE ')):
        lines = [l.strip() for l in p.split('\n') if l.strip()]
        out.write(f"\n[Master Page {i+1}]\n")
        out.write('\n'.join(lines[:12]) + '\n')

print("Wrote scratch/findings.txt successfully!")
